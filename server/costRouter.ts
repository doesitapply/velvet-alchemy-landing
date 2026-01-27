import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { apiCalls, payments, leads } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Cost Router - Tracks API costs and profit margins
 */
export const costRouter = router({
  /**
   * Get cost/profit overview for current user
   */
  getOverview: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get total API costs
    const costs = await db
      .select({
        totalCost: sql<number>`SUM(${apiCalls.estimatedCost})`,
        llmCost: sql<number>`SUM(CASE WHEN ${apiCalls.service} = 'llm' THEN ${apiCalls.estimatedCost} ELSE 0 END)`,
        screenshotCost: sql<number>`SUM(CASE WHEN ${apiCalls.service} = 'screenshot' THEN ${apiCalls.estimatedCost} ELSE 0 END)`,
        storageCost: sql<number>`SUM(CASE WHEN ${apiCalls.service} = 'storage' THEN ${apiCalls.estimatedCost} ELSE 0 END)`,
        callCount: sql<number>`COUNT(*)`,
      })
      .from(apiCalls)
      .where(eq(apiCalls.userId, ctx.user.id))
      .then(rows => rows[0] || {
        totalCost: 0,
        llmCost: 0,
        screenshotCost: 0,
        storageCost: 0,
        callCount: 0,
      });

    // Get total revenue from completed payments
    const revenue = await db
      .select({
        totalRevenue: sql<number>`SUM(${payments.amount})`,
        completedCount: sql<number>`COUNT(*)`,
      })
      .from(payments)
      .innerJoin(leads, eq(payments.lead_id, leads.id))
      .where(
        and(
          eq(leads.userId, ctx.user.id),
          eq(payments.status, "completed")
        )
      )
      .then(rows => rows[0] || {
        totalRevenue: 0,
        completedCount: 0,
      });

    const totalCostCents = Number(costs.totalCost) || 0;
    const totalRevenueCents = Number(revenue.totalRevenue) || 0;
    const profitCents = totalRevenueCents - totalCostCents;
    const profitMarginPercent = totalRevenueCents > 0
      ? ((profitCents / totalRevenueCents) * 100).toFixed(1)
      : "0.0";

    // Get cost per lead
    const leadCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(leads)
      .where(eq(leads.userId, ctx.user.id))
      .then(rows => Number(rows[0]?.count) || 0);

    const costPerLeadCents = leadCount > 0
      ? Math.round(totalCostCents / leadCount)
      : 0;

    // Get cost per completed deal
    const completedDeals = Number(revenue.completedCount) || 0;
    const costPerDealCents = completedDeals > 0
      ? Math.round(totalCostCents / completedDeals)
      : 0;

    return {
      totalCostCents,
      totalRevenueCents,
      profitCents,
      profitMarginPercent: parseFloat(profitMarginPercent),
      
      // Cost breakdown
      llmCostCents: Number(costs.llmCost) || 0,
      screenshotCostCents: Number(costs.screenshotCost) || 0,
      storageCostCents: Number(costs.storageCost) || 0,
      
      // Metrics
      apiCallCount: Number(costs.callCount) || 0,
      leadCount,
      completedDeals,
      costPerLeadCents,
      costPerDealCents,
      
      // ROI calculation
      roi: totalCostCents > 0
        ? ((profitCents / totalCostCents) * 100).toFixed(1)
        : "0.0",
    };
  }),

  /**
   * Get recent API calls for debugging
   */
  getRecentCalls: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      return [];
    }

    const calls = await db
      .select()
      .from(apiCalls)
      .where(eq(apiCalls.userId, ctx.user.id))
      .orderBy(sql`${apiCalls.createdAt} DESC`)
      .limit(50);

    return calls.map(call => ({
      id: call.id,
      service: call.service,
      operation: call.operation,
      tokensUsed: call.tokensUsed,
      estimatedCostCents: call.estimatedCost,
      responseStatus: call.responseStatus,
      createdAt: call.createdAt,
    }));
  }),
});
