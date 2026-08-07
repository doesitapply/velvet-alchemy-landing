import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { prescreenLead } from "../lib/prescreener";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import { checkKillSwitch, checkRateLimit } from "../governor";
import { requireCostAuthority, requireOwnedLead } from "../lib/accessControl";

export const prescreenerRouter = router({
  /**
   * Pre-screen a single lead to calculate priority score
   */
  prescreenOne: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireCostAuthority(ctx.user);
      await checkKillSwitch(ctx.user.id);
      await checkRateLimit(ctx.user.id, "prescreen");
      const lead = await requireOwnedLead(input.leadId, ctx.user);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Run pre-screening
      const result = await prescreenLead(lead.websiteUrl, "general");

      // Update lead with priority score
      await db
        .update(leads)
        .set({
          priorityScore: result.priorityScore,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.leadId));

      return {
        leadId: input.leadId,
        priorityScore: result.priorityScore,
        reasoning: result.reasoning,
        checks: result.checks,
      };
    }),

  /**
   * Pre-screen all pending leads in batch
   */
  prescreenAll: protectedProcedure.mutation(async ({ ctx }) => {
    requireCostAuthority(ctx.user);
    await checkKillSwitch(ctx.user.id);
    await checkRateLimit(ctx.user.id, "prescreen");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get all leads without priority scores
    const pendingLeads = await db
      .select()
      .from(leads)
      .where(and(eq(leads.userId, ctx.user.id), isNull(leads.priorityScore)))
      .limit(10);

    const results = [];

    for (const lead of pendingLeads) {
      try {
        const result = await prescreenLead(lead.websiteUrl, "general");

        // Update lead with priority score
        await db
          .update(leads)
          .set({
            priorityScore: result.priorityScore,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, lead.id));

        results.push({
          leadId: lead.id,
          companyName: lead.companyName,
          priorityScore: result.priorityScore,
          reasoning: result.reasoning,
        });
      } catch (error) {
        console.error(
          `[Prescreener] Failed to prescreen lead ${lead.id}:`,
          error
        );
        results.push({
          leadId: lead.id,
          companyName: lead.companyName,
          priorityScore: 0,
          reasoning: "Error during pre-screening",
        });
      }
    }

    return {
      total: pendingLeads.length,
      processed: results.length,
      results,
    };
  }),

  /**
   * Get priority rankings for all leads
   */
  getRankings: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const allLeads = await db
      .select({
        id: leads.id,
        companyName: leads.companyName,
        websiteUrl: leads.websiteUrl,
        priorityScore: leads.priorityScore,
        prestigeScore: leads.prestigeScore,
        status: leads.status,
      })
      .from(leads)
      .where(eq(leads.userId, ctx.user.id))
      .orderBy(desc(leads.priorityScore)); // Sort by priority score descending (highest first)

    return allLeads;
  }),
});
