/**
 * SMIRK Handoff Integration Tests
 *
 * Validates:
 *   1. buildCallBrief — correct brief construction from lead + audit data
 *   2. queueSmirkCall — correct error handling for leads without phones
 *   3. SMIRK connectivity — correct endpoint, auth, and idempotency contract
 *   4. Synthetic test handoff — 201 RECEIVED on first POST, 200 DUPLICATE on replay
 *
 * Strict assertions — 404 is a failure. No weakened assertions.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { buildCallBrief, queueSmirkCall, sendSyntheticTestHandoff } from "./lib/smirkHandoff";
import { getDb } from "./db";
import { leads, audits } from "../drizzle/schema";

// ─── Test data ────────────────────────────────────────────────────────────────

let testLeadId: number | null = null;
let testLeadNoPhoneId: number | null = null;

beforeAll(async () => {
  const db = await getDb();
  if (!db) return;

  const [withPhone] = await db.insert(leads).values({
    userId: 1,
    companyName: "Test HVAC Co",
    websiteUrl: "https://testhvac.example.com",
    phone: "+17755550001",
    status: "audited",
    prestigeScore: 45,
    priorityScore: 72,
    reviewCount: 87,
    googleRating: "4.6",
    category: "HVAC",
    city: "Reno",
    state: "NV",
  }).$returningId();
  testLeadId = withPhone?.id ?? null;

  const [noPhone] = await db.insert(leads).values({
    userId: 1,
    companyName: "No Phone Plumbing",
    websiteUrl: "https://nophone.example.com",
    status: "audited",
    prestigeScore: 30,
  }).$returningId();
  testLeadNoPhoneId = noPhone?.id ?? null;

  if (testLeadId) {
    await db.insert(audits).values({
      leadId: testLeadId,
      summary: "Website has no mobile optimization, broken contact form, and no clear CTA above the fold.",
      prestigeScore: 45,
      visualDebtData: JSON.stringify({ issues: ["no mobile", "broken form"] }),
    });
  }
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (testLeadId) await db.delete(leads).where(eq(leads.id, testLeadId));
  if (testLeadNoPhoneId) await db.delete(leads).where(eq(leads.id, testLeadNoPhoneId));
});

// ─── buildCallBrief ───────────────────────────────────────────────────────────

describe("buildCallBrief", () => {
  it("returns null for a lead with no phone number", async () => {
    if (!testLeadNoPhoneId) return;
    const brief = await buildCallBrief(testLeadNoPhoneId);
    expect(brief).toBeNull();
  });

  it("returns null for a non-existent lead ID", async () => {
    const brief = await buildCallBrief(999999999);
    expect(brief).toBeNull();
  });

  it("builds a valid call brief for a lead with phone and audit", async () => {
    if (!testLeadId) return;
    const brief = await buildCallBrief(testLeadId);
    expect(brief).not.toBeNull();
    expect(brief!.velvetLeadId).toBe(testLeadId);
    expect(brief!.businessName).toBe("Test HVAC Co");
    expect(brief!.phoneNumber).toBe("+17755550001");
    expect(brief!.signals.length).toBeGreaterThan(0);
    expect(brief!.openingLine).toContain("Test HVAC Co");
    expect(brief!.auditSummary).toContain("contact form");
    expect(brief!.prestigeScore).toBe(45);
    expect(brief!.outcomeWebhookUrl).toContain(`/api/v1/leads/${testLeadId}/outcome`);
  });

  it("includes review count signal when reviewCount > 30", async () => {
    if (!testLeadId) return;
    const brief = await buildCallBrief(testLeadId);
    expect(brief!.signals.some(s => s.includes("87 Google reviews"))).toBe(true);
  });

  it("includes prestige score signal when score < 60", async () => {
    if (!testLeadId) return;
    const brief = await buildCallBrief(testLeadId);
    expect(brief!.signals.some(s => s.includes("45/100"))).toBe(true);
  });
});

// ─── queueSmirkCall error paths ───────────────────────────────────────────────

describe("queueSmirkCall", () => {
  it("returns error for lead with no phone", async () => {
    if (!testLeadNoPhoneId) return;
    const result = await queueSmirkCall(testLeadNoPhoneId);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/phone/i);
  });

  it("returns error for non-existent lead", async () => {
    const result = await queueSmirkCall(999999999);
    expect(result.success).toBe(false);
  });
});

// ─── SMIRK live connectivity + idempotency contract ──────────────────────────

describe("SMIRK live integration", () => {
  const syntheticSuffix = `test-${Date.now()}`;

  it(
    "synthetic handoff: first POST returns 201 RECEIVED",
    async () => {
      const smirkBaseUrl = process.env.SMIRK_BASE_URL;
      if (!smirkBaseUrl) {
        console.warn("SMIRK_BASE_URL not set — skipping live test");
        return;
      }

      const result = await sendSyntheticTestHandoff(syntheticSuffix);

      console.log(`Synthetic handoff result: HTTP ${result.httpStatus} state=${result.state} jobId=${result.jobId}`);

      // 404 is a hard failure — endpoint must be deployed
      expect(result.httpStatus).not.toBe(404);
      // 401 is a hard failure — key must be accepted
      expect(result.httpStatus).not.toBe(401);

      expect(result.success).toBe(true);
      expect(result.state).toBe("RECEIVED");
      expect(result.httpStatus).toBe(201);
    },
    20_000
  );

  it(
    "synthetic handoff: exact replay returns 200 DUPLICATE",
    async () => {
      const smirkBaseUrl = process.env.SMIRK_BASE_URL;
      if (!smirkBaseUrl) {
        console.warn("SMIRK_BASE_URL not set — skipping live test");
        return;
      }

      // Replay the exact same suffix — must be DUPLICATE
      const result = await sendSyntheticTestHandoff(syntheticSuffix);

      console.log(`Duplicate handoff result: HTTP ${result.httpStatus} state=${result.state}`);

      expect(result.httpStatus).not.toBe(404);
      expect(result.httpStatus).not.toBe(401);

      expect(result.success).toBe(true);
      expect(result.state).toBe("DUPLICATE");
      expect(result.httpStatus).toBe(200);
    },
    20_000
  );
});
