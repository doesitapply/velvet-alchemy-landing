import { afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { audits, leads } from "../drizzle/schema";
import { getDb } from "./db";
import {
  buildAuditEvidenceOpeningLine,
  buildCallBrief,
  createSmirkHandoff,
  sendSyntheticTestHandoff,
} from "./lib/smirkHandoff";

const TEST_USER_ID = 1;
const configuredEnv = {
  NODE_ENV: "production",
  SMIRK_BASE_URL: "https://smirkcalls.com",
  SMIRK_API_KEY: "dedicated-velvet-test-token",
  SMIRK_WORKSPACE_ID: "1",
};

let testLeadId: number | null = null;
let testLeadNoPhoneId: number | null = null;

async function ensureTestLeads() {
  if (testLeadId && testLeadNoPhoneId) return;
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required for DB-backed SMIRK tests");

  const [withPhone] = await db.insert(leads).values({
    userId: TEST_USER_ID,
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
    userId: TEST_USER_ID,
    companyName: "No Phone Plumbing",
    websiteUrl: "https://nophone.example.com",
    status: "audited",
    prestigeScore: 30,
  }).$returningId();
  testLeadNoPhoneId = noPhone?.id ?? null;

  if (testLeadId) {
    await db.insert(audits).values({
      leadId: testLeadId,
      summary: "The mobile contact path may be creating friction.",
      prestigeScore: 45,
      visualDebtData: JSON.stringify({ issues: ["mobile contact path"] }),
    });
  }
  if (!testLeadId || !testLeadNoPhoneId) {
    throw new Error("Failed to create DB-backed SMIRK test leads");
  }
}

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (testLeadId) {
    await db.delete(audits).where(eq(audits.leadId, testLeadId));
    await db.delete(leads).where(eq(leads.id, testLeadId));
  }
  if (testLeadNoPhoneId) await db.delete(leads).where(eq(leads.id, testLeadNoPhoneId));
});

describe.skipIf(!process.env.DATABASE_URL)("buildCallBrief", () => {
  it("returns null for a lead with no phone number", async () => {
    await ensureTestLeads();
    expect(await buildCallBrief(testLeadNoPhoneId!, TEST_USER_ID)).toBeNull();
  });

  it("does not return another user's lead", async () => {
    await ensureTestLeads();
    expect(await buildCallBrief(testLeadId!, TEST_USER_ID + 1)).toBeNull();
  });

  it("builds evidence-derived review-only copy without unsupported loss claims", async () => {
    await ensureTestLeads();
    const brief = await buildCallBrief(testLeadId!, TEST_USER_ID);
    expect(brief).not.toBeNull();
    expect(brief!.businessName).toBe("Test HVAC Co");
    expect(brief!.phoneNumber).toBe("+17755550001");
    expect(brief!.openingLine).toContain("mobile contact path");
    expect(brief!.openingLine).not.toMatch(/costing you|losing money|lost revenue/i);
  });
});

describe("audit-grounded opening copy", () => {
  it("derives the opening from a structured audit issue", () => {
    const openingLine = buildAuditEvidenceOpeningLine("Example Plumbing", {
      summary: "The website needs review.",
      visualDebtData: JSON.stringify({
        visualDebt: [{
          category: "ux",
          severity: "high",
          issue: "The primary contact action is difficult to locate",
          recommendation: "Make the contact action persistent",
        }],
      }),
    });

    expect(openingLine).toBe(
      "The latest audit for Example Plumbing flagged this for human review: " +
      "The primary contact action is difficult to locate.",
    );
  });

  it("uses a non-assertive fallback when the audit failed", () => {
    const openingLine = buildAuditEvidenceOpeningLine("Example Plumbing", {
      summary: "Audit failed for Example Plumbing. Error: upstream timeout",
      visualDebtData: JSON.stringify({
        visualDebt: [{
          category: "technical",
          severity: "high",
          issue: "Automated audit failed",
          recommendation: "Manual review required",
        }],
      }),
    });

    expect(openingLine).toBe(
      "Complete a human review for Example Plumbing before deciding whether any manual outreach is appropriate.",
    );
    expect(openingLine).not.toMatch(/mobile|booking|defect|friction/i);
  });

  it("uses the audit summary when no structured issue is available", () => {
    const openingLine = buildAuditEvidenceOpeningLine("Example Plumbing", {
      summary: "The main navigation lacks a visible contact path",
      visualDebtData: "{not-json",
    });

    expect(openingLine).toContain(
      "The main navigation lacks a visible contact path",
    );
  });
});

describe.skipIf(!process.env.DATABASE_URL)("createSmirkHandoff", () => {
  it("does not call SMIRK for a missing or unowned lead", async () => {
    await ensureTestLeads();
    const fetchImpl = vi.fn();
    const result = await createSmirkHandoff(testLeadId!, TEST_USER_ID + 1, {
      env: configuredEnv,
      fetchImpl,
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("SMIRK_HANDOFF_LEAD_NOT_READY");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses a stable external ID and preserves SMIRK record identifiers", async () => {
    await ensureTestLeads();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        state: "RECEIVED",
        handoffId: 51,
        taskId: 61,
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        state: "DUPLICATE",
        handoffId: 51,
        taskId: 61,
      }), { status: 200 }));

    const first = await createSmirkHandoff(testLeadId!, TEST_USER_ID, {
      env: configuredEnv,
      fetchImpl,
    });
    const replay = await createSmirkHandoff(testLeadId!, TEST_USER_ID, {
      env: configuredEnv,
      fetchImpl,
    });

    expect(first).toMatchObject({
      success: true,
      state: "RECEIVED",
      handoffId: 51,
      taskId: 61,
    });
    expect(replay).toMatchObject({
      success: true,
      state: "DUPLICATE",
      handoffId: 51,
      taskId: 61,
    });

    const firstBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const replayBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(firstBody.externalId).toBe(`velvet-lead-${testLeadId}`);
    expect(replayBody.externalId).toBe(firstBody.externalId);
    expect(firstBody.recommendedAction).toContain("Human review only");
  });
});

describe("SMIRK receiver contract", () => {
  it("maps a persisted RECEIVED response with its handoff and task IDs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      state: "RECEIVED",
      handoffId: 71,
      taskId: 81,
    }), { status: 201 }));

    const result = await sendSyntheticTestHandoff("unit-received", {
      env: configuredEnv,
      fetchImpl,
    });

    expect(result).toEqual({
      success: true,
      state: "RECEIVED",
      httpStatus: 201,
      handoffId: 71,
      taskId: 81,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://smirkcalls.com/api/integrations/velvet/handoffs",
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.workspaceId).toBe(1);
    expect(body.externalId).toBe("velvet-manus-fake-unit-received");
    expect(body.caller.phone).toBe("+12025550124");
  });

  it("maps an exact replay only when SMIRK confirms durable IDs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      state: "DUPLICATE",
      handoffId: 71,
      taskId: 81,
    }), { status: 200 }));

    const result = await sendSyntheticTestHandoff("unit-duplicate", {
      env: configuredEnv,
      fetchImpl,
    });

    expect(result).toMatchObject({
      success: true,
      state: "DUPLICATE",
      handoffId: 71,
      taskId: 81,
    });
  });

  it("fails closed when a success-shaped response lacks a persisted handoff ID", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      state: "RECEIVED",
    }), { status: 201 }));

    const result = await sendSyntheticTestHandoff("unit-missing-id", {
      env: configuredEnv,
      fetchImpl,
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe("SMIRK_HANDOFF_REJECTED");
  });

  it("accepts a conflict only with SMIRK's exact idempotency code", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "This external handoff ID was already used for a different payload.",
      code: "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT",
    }), { status: 409 }));

    const result = await sendSyntheticTestHandoff("unit-conflict", {
      env: configuredEnv,
      fetchImpl,
      reason: "Changed synthetic payload used to verify conflict handling.",
    });

    expect(result).toMatchObject({
      success: false,
      httpStatus: 409,
      code: "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT",
      retryable: false,
    });
  });

  it("keeps 404 and forged-key failures closed", async () => {
    for (const [status, code] of [
      [404, "API_NOT_FOUND"],
      [401, "VELVET_ALCHEMY_HANDOFF_UNAUTHORIZED"],
    ] as const) {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        error: "Rejected",
        code,
      }), { status }));
      const result = await sendSyntheticTestHandoff(`unit-${status}`, {
        env: configuredEnv,
        fetchImpl,
      });
      expect(result.success).toBe(false);
      expect(result.httpStatus).toBe(status);
    }
  });

  it("does not make a request when the integration is not configured", async () => {
    const fetchImpl = vi.fn();
    const result = await sendSyntheticTestHandoff("unit-unconfigured", {
      env: {},
      fetchImpl,
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("SMIRK_HANDOFF_NOT_CONFIGURED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an HTTP origin in production before making a request", async () => {
    const fetchImpl = vi.fn();
    const result = await sendSyntheticTestHandoff("unit-http-origin", {
      env: {
        ...configuredEnv,
        SMIRK_BASE_URL: "http://127.0.0.1:3000",
      },
      fetchImpl,
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("SMIRK_HANDOFF_NOT_CONFIGURED");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects string-shaped persisted IDs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      state: "RECEIVED",
      handoffId: "71",
      taskId: "81",
    }), { status: 201 }));
    const result = await sendSyntheticTestHandoff("unit-string-ids", {
      env: configuredEnv,
      fetchImpl,
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("SMIRK_HANDOFF_REJECTED");
  });

  it("rejects malformed synthetic IDs before making a request", async () => {
    const fetchImpl = vi.fn();
    const result = await sendSyntheticTestHandoff("../unsafe", {
      env: configuredEnv,
      fetchImpl,
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("SMIRK_HANDOFF_INVALID_SYNTHETIC_ID");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

const liveTest = process.env.RUN_SMIRK_LIVE_HANDOFF_TEST === "1" ? it : it.skip;

describe("SMIRK live integration (explicit opt-in only)", () => {
  liveTest(
    "creates once and replays the exact owner-approved synthetic external ID",
    async () => {
      const externalId = String(process.env.SMIRK_LIVE_TEST_EXTERNAL_ID || "");
      expect(externalId).toMatch(/^velvet-manus-fake-[A-Za-z0-9:_-]+$/);
      const suffix = externalId.replace(/^velvet-manus-fake-/, "");

      const first = await sendSyntheticTestHandoff(suffix);
      const replay = await sendSyntheticTestHandoff(suffix);

      expect(first).toMatchObject({ success: true, state: "RECEIVED", httpStatus: 201 });
      expect(replay).toMatchObject({
        success: true,
        state: "DUPLICATE",
        httpStatus: 200,
        handoffId: first.handoffId,
        taskId: first.taskId,
      });
    },
    20_000,
  );
});
