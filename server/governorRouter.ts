import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { systemConfig, rateLimits, auditLog } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const governorRouter = router({
  /**
   * Get system configuration
   */
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }

    return await db.select().from(systemConfig);
  }),

  /**
   * Toggle global kill-switch
   */
  toggleKillSwitch: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }

    const existing = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "global_kill_switch"))
      .limit(1);

    if (existing.length === 0) {
      // Create if doesn't exist
      await db.insert(systemConfig).values({
        key: "global_kill_switch",
        value: "false",
        description: "Global system kill-switch",
      });
      return { enabled: false };
    }

    const currentValue = existing[0].value === "true";
    const newValue = !currentValue;

    await db
      .update(systemConfig)
      .set({ value: newValue ? "true" : "false", updatedAt: new Date() })
      .where(eq(systemConfig.key, "global_kill_switch"));

    return { enabled: newValue };
  }),

  /**
   * Get rate limit statistics
   */
  getRateLimitStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    }

    const now = new Date();
    return await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.windowEnd, now))
      .orderBy(desc(rateLimits.updatedAt))
      .limit(50);
  }),

  /**
   * Get audit logs
   */
  getAuditLogs: protectedProcedure
    .input(z.object({ limit: z.number().optional().default(20) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      }

      return await db
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit);
    }),
});
