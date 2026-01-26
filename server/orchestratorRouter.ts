import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
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
  batchAuditSelected: protectedProcedure
    .input(z.object({ leadIds: z.array(z.number()).max(5) }))
    .mutation(async ({ input, ctx }) => {
      await checkKillSwitch(ctx.user.id);
      await checkRateLimit(ctx.user.id, "batch_audit");

      const { getLeadById, getAuditByLeadId, createAudit, updateLead } = await import("./db");
      const { analyzeVisualDebt } = await import("./visualAudit");
      const { enrichLead } = await import("./lib/enrichment");

      // Process leads in background (non-blocking)
      (async () => {
        for (let i = 0; i < input.leadIds.length; i++) {
          const leadId = input.leadIds[i];
          
          try {
            // Check if lead already has an audit
            const existingAudit = await getAuditByLeadId(leadId);
            if (existingAudit) {
              console.log(`[BatchAudit] Lead ${leadId} already audited, skipping`);
              continue;
            }

            // Get lead details
            const lead = await getLeadById(leadId);
            if (!lead) {
              console.error(`[BatchAudit] Lead ${leadId} not found`);
              continue;
            }

            // Run visual audit
            if (!lead.screenshotUrl) {
              console.error(`[BatchAudit] Lead ${leadId} has no screenshot`);
              continue;
            }

            console.log(`[BatchAudit] Processing lead ${i + 1}/${input.leadIds.length}: ${lead.companyName}`);

            const auditResult = await analyzeVisualDebt(
              lead.screenshotUrl,
              lead.websiteUrl,
              lead.companyName
            );

            // Create audit record
            const audit = await createAudit({
              leadId,
              summary: auditResult.summary,
              prestigeScore: auditResult.prestigeScore,
              visualDebtData: JSON.stringify(auditResult),
            });

            // Run enrichment to populate detailed report
            const enrichmentResult = await enrichLead({
              id: lead.id,
              companyName: lead.companyName,
              websiteUrl: lead.websiteUrl,
              category: 'default', // TODO: Add category field to leads table
              location: '', // TODO: Add location field to leads table
              screenshotUrl: lead.screenshotUrl,
              prestigeScore: auditResult.prestigeScore,
            });

            // Update lead with prestige score and detailed report
            await updateLead(leadId, {
              prestigeScore: auditResult.prestigeScore,
              status: 'audited',
              detailedReport: JSON.stringify(enrichmentResult.detailedReport),
              lastDeepScanAt: new Date(),
            });
            
            if (!audit) {
              console.error(`[BatchAudit] Failed to create audit for lead ${leadId}`);
              continue;
            }

            console.log(`[BatchAudit] ✓ Lead ${leadId} audited successfully (prestige: ${audit.prestigeScore})`);
          } catch (error) {
            console.error(`[BatchAudit] Error auditing lead ${leadId}:`, error);
            // Continue with next lead even if this one fails
          }
        }
        console.log(`[BatchAudit] Batch complete`);
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
