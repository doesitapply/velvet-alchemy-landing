import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { generateAssetsForLead, getAssetsByLeadId } from "./visionary";
import { getLeadById } from "./db";
import { ENV } from "./_core/env";

export const visionaryRouter = router({
  /**
   * Generate assets for a lead
   */
  generateAssets: protectedProcedure
    .input(z.object({ 
      leadId: z.number(),
      force: z.boolean().optional().default(false)
    }))
    .mutation(async ({ input }) => {
      if (!ENV.enableAssets) {
        throw new Error("Assets are disabled on this deployment (VELVET_ENABLE_ASSETS=1 to enable)");
      }

      // Get lead details
      const lead = await getLeadById(input.leadId);
      if (!lead) {
        throw new Error("Lead not found");
      }

      if (lead.status !== "audited") {
        throw new Error("Lead must be audited before generating assets");
      }

      // Idempotency check: return existing assets if already generated
      const existingAssets = await getAssetsByLeadId(input.leadId);
      if (existingAssets.length > 0 && !input.force) {
        // Check if assets were generated recently (within 24h)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (lead.assetsGeneratedAt && lead.assetsGeneratedAt > twentyFourHoursAgo) {
          return {
            success: true,
            assetCount: existingAssets.length,
            cached: true,
            message: "Assets already exist. Use force=true to regenerate."
          };
        }
      }

      // Rate limiting: prevent regeneration within 24h unless force=true
      if (lead.assetsGeneratedAt && !input.force) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (lead.assetsGeneratedAt > twentyFourHoursAgo) {
          const hoursRemaining = Math.ceil(
            (lead.assetsGeneratedAt.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000)
          );
          throw new Error(
            `Assets were generated ${hoursRemaining}h ago. Please wait ${24 - hoursRemaining}h or use force=true to regenerate.`
          );
        }
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

      // Update status to generating
      const { updateLeadAssetsStatus } = await import("./db");
      await updateLeadAssetsStatus(input.leadId, "generating");

      try {
        // Generate assets
        const result = await generateAssetsForLead(
          input.leadId,
          lead.companyName,
          lead.websiteUrl,
          visualDebt
        );

        if (!result.success) {
          await updateLeadAssetsStatus(input.leadId, "failed");
          throw new Error(result.error || "Asset generation failed");
        }

        // Update status to ready and set timestamp
        await updateLeadAssetsStatus(input.leadId, "ready", new Date());

        return {
          success: true,
          assetCount: result.assetCount,
          cached: false
        };
      } catch (error) {
        await updateLeadAssetsStatus(input.leadId, "failed");
        throw error;
      }
    }),

  /**
   * Get all assets for a lead
   */
  getAssets: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      if (!ENV.enableAssets) return [];
      const assets = await getAssetsByLeadId(input.leadId);
      return assets;
    }),
});
