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

  getSalesPacket: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 1. Fetch Lead
      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.userId, ctx.user.id)))
        .limit(1);

      if (!lead) throw new Error("Lead not found");

      // 2. Fetch Audit
      const [audit] = await db
        .select()
        .from(audits)
        .where(eq(audits.leadId, lead.id))
        .limit(1);

      // 3. Parse Leaks
      // NOTE: audits.visualDebtData is stored as JSON string. In this codebase it is usually
      // either an array of VisualDebt items (most common) OR an object that contains
      // { visualDebt: [...] }.
      let topLeaks: { issue: string; severity: string }[] = [];
      if (audit && audit.visualDebtData) {
        try {
          const parsed = JSON.parse(audit.visualDebtData as string);
          const debtItems = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.visualDebt)
              ? parsed.visualDebt
              : [];

          topLeaks = debtItems
            .filter((i: any) => i?.severity === "critical" || i?.severity === "high")
            .slice(0, 5)
            .map((i: any) => ({ issue: i.issue, severity: i.severity }));
        } catch {
          // ignore
        }
      }

      // 4. Construct Offer
      // Hardcoded "One-Time" offer for now as per 'Fastest Cash' logic
      const offer = {
        title: "Velvet Alchemy Remediation",
        price: "$5,000",
        type: "One-Time Investment",
        features: [
          "Complete Visual Overhaul (Luxury Design)",
          "Customer Journey Optimization",
          "Mobile-First Rebuild",
          "SEO Technical Fixes",
        ],
        // SalesPacket page can generate a real Stripe Checkout URL on-demand.
        stripeLink: "",
      };

      return {
        companyName: lead.companyName,
        websiteUrl: lead.websiteUrl,
        screenshotUrl: lead.screenshotUrl,
        prestigeScore: lead.prestigeScore || 0,
        topLeaks,
        offer,
        generatedAt: new Date().toISOString()
      };
    }),
});
