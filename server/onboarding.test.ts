import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/trpc";
import { getDb } from "./db";
import { leads, payments, userOnboarding } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Onboarding & Cost Tracking", () => {
  const testUserId = 999999;
  const testUser = {
    id: testUserId,
    openId: "test-onboarding-user",
    name: "Test User",
    email: "test@example.com",
    role: "user" as const,
  };

  const mockContext: TrpcContext = {
    user: testUser,
    req: {} as any,
    res: {} as any,
  };

  const caller = appRouter.createCaller(mockContext);

  async function cleanup() {
    const db = await getDb();
    if (!db) return;
    await db.delete(userOnboarding).where(eq(userOnboarding.userId, testUserId));
    // Get test lead ids first
    const testLeads = await db.select().from(leads).where(eq(leads.userId, testUserId));
    for (const lead of testLeads) {
      await db.delete(payments).where(eq(payments.lead_id, lead.id));
    }
    await db.delete(leads).where(eq(leads.userId, testUserId));
  }

  beforeAll(cleanup);
  afterAll(cleanup);

  it("should create initial onboarding record with all steps incomplete", async () => {
    const progress = await caller.onboarding.getProgress();

    expect(progress).toBeDefined();
    expect(progress.hasCompletedScraper).toBe(false);
    expect(progress.hasReviewedAudit).toBe(false);
    expect(progress.hasSentInvoice).toBe(false);
    expect(progress.hasReceivedPayment).toBe(false);
    expect(progress.onboardingCompletedAt).toBeNull();
  });

  it("should mark scraper complete when user creates a lead", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.insert(leads).values({
      userId: testUserId,
      companyName: "Test Business",
      websiteUrl: "https://test.com",
      status: "pending",
    });

    const progress = await caller.onboarding.getProgress();

    expect(progress.hasCompletedScraper).toBe(true);
    expect(progress.hasReviewedAudit).toBe(false);
  });

  it("should mark audit reviewed when lead status changes to audited", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(leads)
      .set({ status: "audited" })
      .where(eq(leads.userId, testUserId));

    const progress = await caller.onboarding.getProgress();

    expect(progress.hasCompletedScraper).toBe(true);
    expect(progress.hasReviewedAudit).toBe(true);
    expect(progress.hasSentInvoice).toBe(false);
  });

  it("should mark invoice sent when payment record is created", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const testLead = await db
      .select()
      .from(leads)
      .where(eq(leads.userId, testUserId))
      .limit(1)
      .then(rows => rows[0]);

    // Use correct column name: stripe_checkout_session_id
    await db.insert(payments).values({
      lead_id: testLead.id,
      stripe_checkout_session_id: `test_session_${Date.now()}`,
      amount: 500000, // $5000 in cents
      status: "pending",
      package_type: "standard",
    });

    const progress = await caller.onboarding.getProgress();

    expect(progress.hasCompletedScraper).toBe(true);
    expect(progress.hasReviewedAudit).toBe(true);
    expect(progress.hasSentInvoice).toBe(true);
    expect(progress.hasReceivedPayment).toBe(false);
  });

  it("should mark payment received and complete onboarding when payment status is completed", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const testLead = await db
      .select()
      .from(leads)
      .where(eq(leads.userId, testUserId))
      .limit(1)
      .then(rows => rows[0]);

    await db
      .update(payments)
      .set({ status: "completed" })
      .where(eq(payments.lead_id, testLead.id));

    const progress = await caller.onboarding.getProgress();

    expect(progress.hasCompletedScraper).toBe(true);
    expect(progress.hasReviewedAudit).toBe(true);
    expect(progress.hasSentInvoice).toBe(true);
    expect(progress.hasReceivedPayment).toBe(true);
    expect(progress.onboardingCompletedAt).not.toBeNull();
  });

  it("should calculate cost/profit overview correctly", async () => {
    const overview = await caller.cost.getOverview();

    expect(overview).toBeDefined();
    // Revenue should include the $5000 test payment
    expect(overview.totalRevenueCents).toBeGreaterThanOrEqual(500000);
    expect(overview.completedDeals).toBeGreaterThanOrEqual(1);
    expect(overview.leadCount).toBeGreaterThanOrEqual(1);
  });
});
