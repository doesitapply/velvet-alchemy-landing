import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { leads, payments } from "../drizzle/schema";
import { eq, sql, and, gte } from "drizzle-orm";

export const dashboardRouter = router({
  /**
   * Get overall dashboard metrics
   */
  getMetrics: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return {
        totalLeads: 3,
        pendingAudits: 1,
        completedAudits: 2,
        withAssets: 2,
        withOutreach: 1,
        avgPrestigeScore: 75,
        leadsToday: 1,
        conversionRate: 33,
      };
    }

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
    if (!db) {
      return {
        scraped: 142,
        audited: 97,
        assets: 82,
        outreach: 12,
      };
    }

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
    if (!db) {
      return [
        { id: 1, companyName: "Silver and Blue Outfitters", activity: "Audit completed (score: 90)", timestamp: new Date(Date.now() - 3600000) },
        { id: 2, companyName: "Reno Running Company", activity: "Outreach sent via Charmer", timestamp: new Date(Date.now() - 7200000) },
        { id: 3, companyName: "Flowing Tide Pub", activity: "Lead created via Scraper", timestamp: new Date() },
      ];
    }

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
   * Get unified activity feed (leads, audits, payments)
   */
  getActivityFeed: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get recent leads (last 20)
    const recentLeads = await db
      .select({
        id: leads.id,
        companyName: leads.companyName,
        status: leads.status,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        prestigeScore: leads.prestigeScore,
      })
      .from(leads)
      .orderBy(sql`${leads.createdAt} DESC`)
      .limit(20);

    // Get recent payments (last 20)
    const recentPayments = await db
      .select({
        id: payments.id,
        leadId: payments.lead_id,
        amount: payments.amount,
        status: payments.status,
        packageType: payments.package_type,
        createdAt: payments.created_at,
      })
      .from(payments)
      .orderBy(sql`${payments.created_at} DESC`)
      .limit(20);

    // Get lead names for payments
    const leadIds = recentPayments.map(p => p.leadId);
    const leadNames: Record<number, string> = {};
    if (leadIds.length > 0) {
      const leadsForPayments = await db
        .select({ id: leads.id, companyName: leads.companyName })
        .from(leads)
        .where(sql`${leads.id} IN (${sql.join(leadIds.map(id => sql`${id}`), sql`, `)})`)
        ;
      leadsForPayments.forEach(lead => {
        leadNames[lead.id] = lead.companyName;
      });
    }

    // Combine and format activities
    const activities: Array<{
      id: string;
      type: 'lead_created' | 'audit_completed' | 'payment_received' | 'outreach_sent';
      title: string;
      description: string;
      timestamp: Date;
      metadata?: any;
    }> = [];

    // Add lead activities
    recentLeads.forEach(lead => {
      if (lead.status === 'audited' && lead.prestigeScore !== null) {
        activities.push({
          id: `audit-${lead.id}`,
          type: 'audit_completed',
          title: `Audit completed for ${lead.companyName}`,
          description: `Prestige score: ${lead.prestigeScore}/100`,
          timestamp: lead.updatedAt,
          metadata: { leadId: lead.id, score: lead.prestigeScore },
        });
      } else {
        activities.push({
          id: `lead-${lead.id}`,
          type: 'lead_created',
          title: `New lead: ${lead.companyName}`,
          description: `Status: ${lead.status}`,
          timestamp: lead.createdAt,
          metadata: { leadId: lead.id },
        });
      }
    });

    // Add payment activities
    recentPayments.forEach(payment => {
      if (payment.status === 'completed') {
        const companyName = leadNames[payment.leadId] || 'Unknown Company';
        activities.push({
          id: `payment-${payment.id}`,
          type: 'payment_received',
          title: `Payment received from ${companyName}`,
          description: `$${payment.amount.toLocaleString()} (${payment.packageType} package)`,
          timestamp: payment.createdAt,
          metadata: { paymentId: payment.id, leadId: payment.leadId, amount: payment.amount },
        });
      }
    });

    // Sort by timestamp descending and return top 15
    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 15);
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
