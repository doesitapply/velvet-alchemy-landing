import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { generateAssetsForLead, getAssetsByLeadId } from "./visionary";
import { getLeadById } from "./db";

export const visionaryRouter = router({
  /**
   * Generate assets for a lead
   */
  generateAssets: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input }) => {
      // Get lead details
      const lead = await getLeadById(input.leadId);
      if (!lead) {
        throw new Error("Lead not found");
      }

      if (lead.status !== "audited") {
        throw new Error("Lead must be audited before generating assets");
      }

      // Get audit data
      const { getAuditByLeadId } = await import("./db");
      const audit = await getAuditByLeadId(input.leadId);
      if (!audit) {
        throw new Error("Audit not found");
      }

      // Parse visual debt data
      let visualDebt = null;
      try {
        visualDebt = audit.visualDebtData ? JSON.parse(audit.visualDebtData) : null;
      } catch (e) {
        console.error("[Visionary] Failed to parse visual debt data:", e);
      }

      // Generate assets
      const result = await generateAssetsForLead(
        input.leadId,
        lead.companyName,
        lead.websiteUrl,
        visualDebt
      );

      if (!result.success) {
        throw new Error(result.error || "Asset generation failed");
      }

      return {
        success: true,
        assetCount: result.assetCount,
      };
    }),

  /**
   * Get all assets for a lead
   */
  getAssets: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const assets = await getAssetsByLeadId(input.leadId);
      return assets;
    }),
});
