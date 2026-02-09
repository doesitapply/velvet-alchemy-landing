import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads, audits, assets } from "../drizzle/schema";
import { eq, inArray, and, gte, lte } from "drizzle-orm";

export const exportRouter = router({
  getExportData: protectedProcedure
    .input(
      z.object({
        leadIds: z.array(z.number()).optional(),
        minPrestigeScore: z.number().min(0).max(100).optional(),
        maxPrestigeScore: z.number().min(0).max(100).optional(),
        status: z.enum(["pending", "audited", "contacted", "closed"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");
      const conditions = [eq(leads.userId, ctx.user.id)];
      
      if (input.leadIds && input.leadIds.length > 0) {
        conditions.push(inArray(leads.id, input.leadIds));
      }
      
      if (input.status) {
        conditions.push(eq(leads.status, input.status));
      }
      
      if (input.minPrestigeScore !== undefined) {
        conditions.push(gte(leads.prestigeScore, input.minPrestigeScore));
      }
      
      if (input.maxPrestigeScore !== undefined) {
        conditions.push(lte(leads.prestigeScore, input.maxPrestigeScore));
      }

      const leadsData = await db
        .select()
        .from(leads)
        .where(and(...conditions));

      const leadIds = leadsData.map((l: any) => l.id);
      const auditsData = leadIds.length > 0
        ? await db.select().from(audits).where(inArray(audits.leadId, leadIds))
        : [];

      const assetsData = leadIds.length > 0
        ? await db.select().from(assets).where(inArray(assets.leadId, leadIds))
        : [];

      const exportData = leadsData.map((lead) => {
        const audit = auditsData.find((a: any) => a.leadId === lead.id);
        const leadAssets = assetsData.filter((a: any) => a.leadId === lead.id);

        let topIssues = "N/A";
        if (audit && audit.visualDebtData) {
          try {
            const debtAnalysis = JSON.parse(audit.visualDebtData as string);
            if (Array.isArray(debtAnalysis)) {
              topIssues = debtAnalysis
                .slice(0, 3)
                .map((issue: any) => issue.severity + ": " + issue.issue)
                .join(" | ");
            }
          } catch (e) {
            // Keep as N/A
          }
        }

        const socialPostUrls = leadAssets
          .filter((a: any) => a.type === "social_post")
          .map((a: any) => a.imageUrl)
          .join(" | ");

        const bannerUrls = leadAssets
          .filter((a: any) => a.type === "web_banner")
          .map((a: any) => a.imageUrl)
          .join(" | ");

        let visualDebtDetails = "N/A";
        if (audit && audit.visualDebtData) {
          try {
            const debtData = JSON.parse(audit.visualDebtData as string);
            if (debtData && typeof debtData === 'object') {
              visualDebtDetails = JSON.stringify(debtData);
            }
          } catch (e) {
            // Keep as N/A
          }
        }

        return {
          companyName: lead.companyName,
          websiteUrl: lead.websiteUrl,
          prestigeScore: lead.prestigeScore || "N/A",
          status: lead.status,
          auditSummary: audit?.summary || "N/A",
          topIssues,
          visualDebtDetails,
          socialPostUrls: socialPostUrls || "N/A",
          bannerUrls: bannerUrls || "N/A",
          screenshotUrl: lead.screenshotUrl || "N/A",
          createdAt: lead.createdAt.toISOString(),
          auditDate: audit?.createdAt?.toISOString() || "N/A",
        };
      });

      return exportData;
    }),
});
