import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getSystemConfigEntries, getSystemConfigValue, setSystemConfigValue, getRateLimitRecords, getAuditLogEntries } from "./db";
import { TRPCError } from "@trpc/server";

export const governorRouter = router({
  /**
   * Get system configuration
   */
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    return await getSystemConfigEntries();
  }),

  /**
   * Toggle global kill-switch
   */
  toggleKillSwitch: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const existing = await getSystemConfigValue("global_kill_switch");
    if (!existing) {
      await setSystemConfigValue("global_kill_switch", "false", "Global system kill-switch");
      return { enabled: false };
    }

    const currentValue = existing.value === "true";
    const newValue = !currentValue;

    await setSystemConfigValue("global_kill_switch", newValue ? "true" : "false", existing.description);

    return { enabled: newValue };
  }),

  /**
   * Get rate limit statistics
   */
  getRateLimitStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
    }

    const records = await getRateLimitRecords();
    return records
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 50);
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

      return await getAuditLogEntries(input.limit);
    }),
});
