import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { leads } from "../drizzle/schema";
import { eq, sql, and, gte } from "drizzle-orm";

export const dashboardRouter = router({
  /**
   * Get overall dashboard metrics
   */
  getMetrics: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Total leads
    const totalLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads);
    const totalLeads = Number(totalLeadsResult[0]?.count || 0);

    // Pending audits (status = 'pending')
    const pendingAuditsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.status, "pending"));
    const pendingAudits = Number(pendingAuditsResult[0]?.count || 0);

    // Completed audits (status = 'completed')
    const completedAuditsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.status, "audited"));
    const completedAudits = Number(completedAuditsResult[0]?.count || 0);

    // Leads with assets generated (hasAssets = true)
    const withAssetsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.hasAssets, true));
    const withAssets = Number(withAssetsResult[0]?.count || 0);

    // Leads with outreach sent (hasOutreach = true)
    const withOutreachResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.hasOutreach, true));
    const withOutreach = Number(withOutreachResult[0]?.count || 0);

    // Average prestige score
    const avgScoreResult = await db
      .select({ avg: sql<number>`avg(${leads.prestigeScore})` })
      .from(leads)
      .where(sql`${leads.prestigeScore} IS NOT NULL`);
    const avgPrestigeScore = Math.round(Number(avgScoreResult[0]?.avg || 0));

    // Leads created today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(gte(leads.createdAt, today));
    const leadsToday = Number(todayLeadsResult[0]?.count || 0);

    return {
      totalLeads,
      pendingAudits,
      completedAudits,
      withAssets,
      withOutreach,
      avgPrestigeScore,
      leadsToday,
      conversionRate: totalLeads > 0 ? Math.round((withOutreach / totalLeads) * 100) : 0,
    };
  }),

  /**
   * Get lead pipeline stats (funnel view)
   */
  getPipelineStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const totalLeadsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads);
    const total = Number(totalLeadsResult[0]?.count || 0);

    const auditedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.status, "audited"));
    const audited = Number(auditedResult[0]?.count || 0);

    const withAssetsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.hasAssets, true));
    const withAssets = Number(withAssetsResult[0]?.count || 0);

    const withOutreachResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.hasOutreach, true));
    const withOutreach = Number(withOutreachResult[0]?.count || 0);

    return {
      scraped: total,
      audited,
      assets: withAssets,
      outreach: withOutreach,
    };
  }),

  /**
   * Get recent activity (last 10 lead updates)
   */
  getRecentActivity: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const recentLeads = await db
      .select({
        id: leads.id,
        companyName: leads.companyName,
        status: leads.status,
        prestigeScore: leads.prestigeScore,
        hasAssets: leads.hasAssets,
        hasOutreach: leads.hasOutreach,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .orderBy(sql`${leads.updatedAt} DESC`)
      .limit(10);

    return recentLeads.map((lead: any) => {
      let activity = "Lead created";
      if (lead.hasOutreach) {
        activity = "Outreach sent";
      } else if (lead.hasAssets) {
        activity = "Assets generated";
      } else if (lead.status === "completed") {
        activity = `Audit completed (score: ${lead.prestigeScore})`;
      } else if (lead.status === "pending") {
        activity = "Audit pending";
      }

      return {
        id: lead.id,
        companyName: lead.companyName,
        activity,
        timestamp: lead.updatedAt,
      };
    });
  }),

  /**
   * Get prestige score distribution
   */
  getScoreDistribution: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const allScores = await db
      .select({ score: leads.prestigeScore })
      .from(leads)
      .where(sql`${leads.prestigeScore} IS NOT NULL`);

    const distribution = {
      excellent: 0, // 80-100
      good: 0, // 60-79
      fair: 0, // 40-59
      poor: 0, // 0-39
    };

    allScores.forEach(({ score }: any) => {
      if (score === null) return;
      if (score >= 80) distribution.excellent++;
      else if (score >= 60) distribution.good++;
      else if (score >= 40) distribution.fair++;
      else distribution.poor++;
    });

    return distribution;
  }),
});
