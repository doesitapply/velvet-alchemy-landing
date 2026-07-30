import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { audits, leads } from "../drizzle/schema";
import { getDb } from "./db";
import { buildCallBrief } from "./lib/smirkHandoff";

const hasDatabase =
  process.env.RUN_INTEGRATION_TESTS === "1" &&
  process.env.RUN_DB_WRITE_TESTS === "1" &&
  Boolean(process.env.DATABASE_URL);
const TEST_USER_ID = 990_729;
let phoneLeadId: number | null = null;
let noPhoneLeadId: number | null = null;

describe.skipIf(!hasDatabase)("SMIRK call brief database integration", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL is required.");

    const [phoneLead] = await db
      .insert(leads)
      .values({
        userId: TEST_USER_ID,
        companyName: "Synthetic HVAC Example",
        websiteUrl: "https://synthetic-hvac.example.com",
        phone: "+12025550125",
        status: "audited",
        prestigeScore: 45,
        reviewCount: 87,
        googleRating: "4.6",
        category: "HVAC",
      })
      .$returningId();
    phoneLeadId = phoneLead.id;

    const [noPhoneLead] = await db
      .insert(leads)
      .values({
        userId: TEST_USER_ID,
        companyName: "Synthetic No Phone Example",
        websiteUrl: "https://synthetic-no-phone.example.com",
        status: "audited",
      })
      .$returningId();
    noPhoneLeadId = noPhoneLead.id;

    await db.insert(audits).values({
      leadId: phoneLeadId,
      summary: "The public contact path should be reviewed on mobile.",
      prestigeScore: 45,
      visualDebtData: JSON.stringify({ issues: ["Contact path needs review"] }),
    });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    if (phoneLeadId) {
      await db.delete(audits).where(eq(audits.leadId, phoneLeadId));
      await db.delete(leads).where(eq(leads.id, phoneLeadId));
    }
    if (noPhoneLeadId) {
      await db.delete(leads).where(eq(leads.id, noPhoneLeadId));
    }
  });

  it("builds a review-only brief from persisted data", async () => {
    const brief = await buildCallBrief(phoneLeadId!);
    expect(brief).toMatchObject({
      velvetLeadId: phoneLeadId,
      businessName: "Synthetic HVAC Example",
      phoneNumber: "+12025550125",
    });
    expect(brief?.openingLine).not.toMatch(
      /costing you|losing money|lost revenue/i
    );
    expect(brief?.signals).toContain("87 public reviews");
  });

  it("returns null when the persisted lead has no phone", async () => {
    await expect(buildCallBrief(noPhoneLeadId!)).resolves.toBeNull();
  });
});
