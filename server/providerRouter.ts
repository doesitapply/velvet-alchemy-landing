/**
 * AI Provider Management Router
 * 
 * tRPC procedures for managing AI providers, API keys, and monitoring health
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { aiProviders, providerHealth, apiUsageLogs } from "../drizzle/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const providerRouter = router({
  /**
   * List all AI providers with their health status
   */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const providers = await db
      .select({
        id: aiProviders.id,
        name: aiProviders.name,
        displayName: aiProviders.displayName,
        isEnabled: aiProviders.isEnabled,
        priority: aiProviders.priority,
        hasApiKey: sql<boolean>`${aiProviders.apiKey} IS NOT NULL`,
        costPer1kTokens: aiProviders.costPer1kTokens,
        health: {
          status: providerHealth.status,
          lastSuccessAt: providerHealth.lastSuccessAt,
          lastFailureAt: providerHealth.lastFailureAt,
          consecutiveFailures: providerHealth.consecutiveFailures,
          avgLatencyMs: providerHealth.avgLatencyMs,
          successRate: providerHealth.successRate,
        },
      })
      .from(aiProviders)
      .leftJoin(providerHealth, eq(aiProviders.id, providerHealth.providerId))
      .orderBy(aiProviders.priority);

    return providers;
  }),

  /**
   * Get detailed stats for a specific provider
   */
  getStats: protectedProcedure
    .input(z.object({ providerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get provider info
      const provider = await db
        .select()
        .from(aiProviders)
        .where(eq(aiProviders.id, input.providerId))
        .limit(1);

      if (provider.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      }

      // Get usage stats (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const usageStats = await db
        .select({
          totalRequests: sql<number>`COUNT(*)`,
          successfulRequests: sql<number>`SUM(CASE WHEN ${apiUsageLogs.success} = 1 THEN 1 ELSE 0 END)`,
          failedRequests: sql<number>`SUM(CASE WHEN ${apiUsageLogs.success} = 0 THEN 1 ELSE 0 END)`,
          totalTokens: sql<number>`SUM(${apiUsageLogs.totalTokens})`,
          totalCost: sql<number>`SUM(${apiUsageLogs.cost})`,
          avgLatencyMs: sql<number>`AVG(${apiUsageLogs.latencyMs})`,
        })
        .from(apiUsageLogs)
        .where(
          and(
            eq(apiUsageLogs.providerId, input.providerId),
            gte(apiUsageLogs.createdAt, thirtyDaysAgo)
          )
        );

      return {
        provider: provider[0],
        stats: usageStats[0],
      };
    }),

  /**
   * Update provider configuration (enable/disable, priority, API key)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        isEnabled: z.boolean().optional(),
        priority: z.number().optional(),
        apiKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const updates: any = {};
      if (input.isEnabled !== undefined) updates.isEnabled = input.isEnabled;
      if (input.priority !== undefined) updates.priority = input.priority;
      if (input.apiKey !== undefined) updates.apiKey = input.apiKey;

      await db.update(aiProviders).set(updates).where(eq(aiProviders.id, input.id));

      return { success: true };
    }),

  /**
   * Get recent API usage logs
   */
  getRecentLogs: protectedProcedure
    .input(
      z.object({
        providerId: z.number().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const query = db
        .select({
          id: apiUsageLogs.id,
          provider: aiProviders.displayName,
          operation: apiUsageLogs.operation,
          model: apiUsageLogs.model,
          totalTokens: apiUsageLogs.totalTokens,
          cost: apiUsageLogs.cost,
          latencyMs: apiUsageLogs.latencyMs,
          success: apiUsageLogs.success,
          errorMessage: apiUsageLogs.errorMessage,
          createdAt: apiUsageLogs.createdAt,
        })
        .from(apiUsageLogs)
        .leftJoin(aiProviders, eq(apiUsageLogs.providerId, aiProviders.id))
        .orderBy(desc(apiUsageLogs.createdAt))
        .limit(input.limit);

      if (input.providerId) {
        query.where(eq(apiUsageLogs.providerId, input.providerId));
      }

      return await query;
    }),

  /**
   * Get cost summary (daily/weekly/monthly)
   */
  getCostSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dailyCost, weeklyCost, monthlyCost] = await Promise.all([
      db
        .select({
          totalCost: sql<number>`SUM(${apiUsageLogs.cost})`,
          totalTokens: sql<number>`SUM(${apiUsageLogs.totalTokens})`,
          totalRequests: sql<number>`COUNT(*)`,
        })
        .from(apiUsageLogs)
        .where(
          sql`DATE(${apiUsageLogs.createdAt}) = DATE(NOW())`
        ),
      db
        .select({
          totalCost: sql<number>`SUM(${apiUsageLogs.cost})`,
          totalTokens: sql<number>`SUM(${apiUsageLogs.totalTokens})`,
          totalRequests: sql<number>`COUNT(*)`,
        })
        .from(apiUsageLogs)
        .where(gte(apiUsageLogs.createdAt, weekAgo)),
      db
        .select({
          totalCost: sql<number>`SUM(${apiUsageLogs.cost})`,
          totalTokens: sql<number>`SUM(${apiUsageLogs.totalTokens})`,
          totalRequests: sql<number>`COUNT(*)`,
        })
        .from(apiUsageLogs)
        .where(gte(apiUsageLogs.createdAt, monthAgo)),
    ]);

    return {
      daily: dailyCost[0],
      weekly: weeklyCost[0],
      monthly: monthlyCost[0],
    };
  }),
});
