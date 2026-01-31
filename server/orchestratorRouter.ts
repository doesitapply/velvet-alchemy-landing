import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { executePipeline, getPipelineJobStatus, getPipelineJobsForLead } from "./orchestrator";
import { checkRateLimit, checkKillSwitch } from "./governor";

export const orchestratorRouter = router({
  /**
   * Execute the complete pipeline for a lead
   */
  executePipeline: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await checkKillSwitch(ctx.user.id);
      await checkRateLimit(ctx.user.id, "pipeline_execute");

      // Execute pipeline in the background (non-blocking)
      executePipeline(input.leadId, ctx.user.id).catch(error => {
        console.error("[Orchestrator] Pipeline execution failed:", error);
      });

      return { success: true, message: "Pipeline execution started" };
    }),

  /**
   * Get pipeline job status by job ID
   */
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const job = await getPipelineJobStatus(input.jobId);
      return job;
    }),

  /**
   * Get all pipeline jobs for a lead
   */
  getJobsForLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const jobs = await getPipelineJobsForLead(input.leadId);
      return jobs;
    }),

  /**
   * Batch audit selected leads (max 5, sequential processing in background)
   */
  batchAuditSelected: publicProcedure
    .input(z.object({ leadIds: z.array(z.number()).max(5) }))
    .mutation(async ({ input, ctx }) => {
      // Allow public access (e.g. for testing scripts), fallback to Admin ID 1 if no user session
      const userId = ctx.user?.id || 1;

      await checkKillSwitch(userId);
      await checkRateLimit(userId, "batch_audit");

      const { getLeadById, getAuditByLeadId, createAudit, updateLead } = await import("./db");
      const { analyzeVisualDebt } = await import("./visualAudit");
      const { enrichLead } = await import("./lib/enrichment");

      // Process leads in background (non-blocking)
      (async () => {
        for (let i = 0; i < input.leadIds.length; i++) {
          const leadId = input.leadIds[i];

          try {
            console.log(`[BatchAudit] Starting pipeline for lead ${leadId} (${i + 1}/${input.leadIds.length}) as user ${userId}`);

            // Use the full pipeline (Screenshot -> Audit -> Assets -> Outreach)
            await executePipeline(leadId, userId);

            console.log(`[BatchAudit] ✓ Pipeline initiated for lead ${leadId}`);
          } catch (error) {
            console.error(`[BatchAudit] Error starting pipeline for lead ${leadId}:`, error);
          }
        }
        console.log(`[BatchAudit] Batch initiation complete`);
      })().catch(error => {
        console.error('[BatchAudit] Background processing failed:', error);
      });

      // Return immediately
      return {
        success: true,
        message: `Started auditing ${input.leadIds.length} leads`,
        total: input.leadIds.length,
      };
    }),

  /**
   * Batch audit all pending leads
   */
  batchAuditAll: protectedProcedure
    .mutation(async ({ ctx }) => {
      await checkKillSwitch(ctx.user.id);
      await checkRateLimit(ctx.user.id, "batch_audit");

      // Get all pending leads
      const { getAllLeads } = await import("./db");
      const pendingLeads = await getAllLeads();
      const leadsToAudit = pendingLeads.filter((lead: any) => lead.status === "pending");

      if (leadsToAudit.length === 0) {
        return { success: true, message: "No pending leads to audit", processed: 0 };
      }

      // Execute pipeline for each pending lead (non-blocking)
      let processed = 0;
      for (const lead of leadsToAudit) {
        executePipeline(lead.id, ctx.user.id).catch(error => {
          console.error(`[Orchestrator] Batch audit failed for lead ${lead.id}:`, error);
        });
        processed++;
      }

      return {
        success: true,
        message: `Batch audit started for ${processed} leads`,
        processed
      };
    }),
});
