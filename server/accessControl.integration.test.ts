import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { leads } from "../drizzle/schema";
import { getDb } from "./db";
import { requireOwnedLead } from "./lib/accessControl";

const hasDatabase =
  process.env.RUN_INTEGRATION_TESTS === "1" &&
  process.env.RUN_DB_WRITE_TESTS === "1" &&
  Boolean(process.env.DATABASE_URL);
const USER_A = 990_731;
const USER_B = 990_732;
let leadA: number | null = null;
let leadB: number | null = null;

describe.skipIf(!hasDatabase)("lead tenant isolation", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL is required.");
    const [createdA] = await db
      .insert(leads)
      .values({
        userId: USER_A,
        companyName: "Tenant A Synthetic",
        websiteUrl: "https://tenant-a.example.com",
        status: "pending",
      })
      .$returningId();
    const [createdB] = await db
      .insert(leads)
      .values({
        userId: USER_B,
        companyName: "Tenant B Synthetic",
        websiteUrl: "https://tenant-b.example.com",
        status: "pending",
      })
      .$returningId();
    leadA = createdA.id;
    leadB = createdB.id;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    if (leadA) await db.delete(leads).where(eq(leads.id, leadA));
    if (leadB) await db.delete(leads).where(eq(leads.id, leadB));
  });

  it("loads an owned lead", async () => {
    await expect(
      requireOwnedLead(leadA!, { id: USER_A, role: "user" })
    ).resolves.toMatchObject({ id: leadA, userId: USER_A });
  });

  it("denies another tenant's lead without revealing it", async () => {
    await expect(
      requireOwnedLead(leadB!, { id: USER_A, role: "user" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows an administrator to inspect either tenant", async () => {
    await expect(
      requireOwnedLead(leadB!, { id: 1, role: "admin" })
    ).resolves.toMatchObject({ id: leadB, userId: USER_B });
  });
});
