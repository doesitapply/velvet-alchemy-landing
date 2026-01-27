import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { userOnboarding, leads, payments } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Onboarding Router - Tracks user progress through first revenue
 */
export const onboardingRouter = router({
  /**
   * Get current user's onboarding progress
   */
  getProgress: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get or create onboarding record
    let progress = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, ctx.user.id))
      .limit(1)
      .then(rows => rows[0]);

    if (!progress) {
      // Create initial onboarding record
      await db.insert(userOnboarding).values({
        userId: ctx.user.id,
        hasCompletedScraper: false,
        hasReviewedAudit: false,
        hasSentInvoice: false,
        hasReceivedPayment: false,
      });

      progress = {
        id: 0,
        userId: ctx.user.id,
        hasCompletedScraper: false,
        hasReviewedAudit: false,
        hasSentInvoice: false,
        hasReceivedPayment: false,
        onboardingCompletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Auto-update progress based on actual data
    const updates: Partial<typeof userOnboarding.$inferInsert> = {};

    // Check if user has created any leads (scraper completed)
    if (!progress.hasCompletedScraper) {
      const leadCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(eq(leads.userId, ctx.user.id))
        .then(rows => rows[0]?.count || 0);

      if (leadCount > 0) {
        updates.hasCompletedScraper = true;
      }
    }

    // Check if user has any audited leads (reviewed audit)
    if (!progress.hasReviewedAudit) {
      const auditedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(
          and(
            eq(leads.userId, ctx.user.id),
            eq(leads.status, "audited")
          )
        )
        .then(rows => rows[0]?.count || 0);

      if (auditedCount > 0) {
        updates.hasReviewedAudit = true;
      }
    }

    // Check if user has sent any invoices
    if (!progress.hasSentInvoice) {
      const paymentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(payments)
        .innerJoin(leads, eq(payments.lead_id, leads.id))
        .where(eq(leads.userId, ctx.user.id))
        .then(rows => rows[0]?.count || 0);

      if (paymentCount > 0) {
        updates.hasSentInvoice = true;
      }
    }

    // Check if user has received any payments
    if (!progress.hasReceivedPayment) {
      const completedPaymentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(payments)
        .innerJoin(leads, eq(payments.lead_id, leads.id))
        .where(
          and(
            eq(leads.userId, ctx.user.id),
            eq(payments.status, "completed")
          )
        )
        .then(rows => rows[0]?.count || 0);

      if (completedPaymentCount > 0) {
        updates.hasReceivedPayment = true;
      }
    }

    // Check if all steps completed
    const allCompleted =
      (updates.hasCompletedScraper ?? progress.hasCompletedScraper) &&
      (updates.hasReviewedAudit ?? progress.hasReviewedAudit) &&
      (updates.hasSentInvoice ?? progress.hasSentInvoice) &&
      (updates.hasReceivedPayment ?? progress.hasReceivedPayment);

    if (allCompleted && !progress.onboardingCompletedAt) {
      updates.onboardingCompletedAt = new Date();
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await db
        .update(userOnboarding)
        .set(updates)
        .where(eq(userOnboarding.userId, ctx.user.id));

      // Merge updates into progress
      progress = { ...progress, ...updates };
    }

    return {
      hasCompletedScraper: progress.hasCompletedScraper,
      hasReviewedAudit: progress.hasReviewedAudit,
      hasSentInvoice: progress.hasSentInvoice,
      hasReceivedPayment: progress.hasReceivedPayment,
      onboardingCompletedAt: progress.onboardingCompletedAt,
    };
  }),
});
