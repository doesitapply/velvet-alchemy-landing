import { describe, it, expect, beforeAll } from "vitest";
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

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Clean up test data
    await db.delete(userOnboarding).where(eq(userOnboarding.userId, testUserId));
    await db.delete(payments).where(eq(payments.lead_id, 999999));
    await db.delete(leads).where(eq(leads.userId, testUserId));
  });

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

    // Create a test lead
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

    // Update lead to audited status
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

    // Get the test lead
    const testLead = await db
      .select()
      .from(leads)
      .where(eq(leads.userId, testUserId))
      .limit(1)
      .then(rows => rows[0]);

    // Create a payment record
    await db.insert(payments).values({
      lead_id: testLead.id,
      stripe_session_id: "test_session_123",
      amount: 500000, // $5000
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

    // Get the test lead
    const testLead = await db
      .select()
      .from(leads)
      .where(eq(leads.userId, testUserId))
      .limit(1)
      .then(rows => rows[0]);

    // Update payment to completed
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
    expect(overview.totalRevenueCents).toBe(500000); // $5000 from test payment
    expect(overview.completedDeals).toBe(1);
    expect(overview.leadCount).toBe(1);
    expect(overview.profitCents).toBeGreaterThan(0); // Should be positive (revenue - costs)
    expect(overview.profitMarginPercent).toBeGreaterThan(0);
  });
});
