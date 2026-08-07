import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  executePipeline,
  getPipelineJobStatus,
  getPipelineJobsForLead,
} from "./orchestrator";
import { checkRateLimit, checkKillSwitch } from "./governor";
import { requireCostAuthority, requireOwnedLead } from "./lib/accessControl";
import { TRPCError } from "@trpc/server";
import { selectBoundedBatch } from "./lib/batchSafety";

export const orchestratorRouter = router({
  /**
   * Execute the complete pipeline for a lead
   */
  executePipeline: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireCostAuthority(ctx.user);
      await checkKillSwitch(ctx.user.id);
      await checkRateLimit(ctx.user.id, "pipeline_execute");
      await requireOwnedLead(input.leadId, ctx.user);

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
    .query(async ({ input, ctx }) => {
      const job = await getPipelineJobStatus(input.jobId);
      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pipeline job not found.",
        });
      }
      await requireOwnedLead(job.leadId, ctx.user);
      return job;
    }),

  /**
   * Get all pipeline jobs for a lead
   */
  getJobsForLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOwnedLead(input.leadId, ctx.user);
      const jobs = await getPipelineJobsForLead(input.leadId);
      return jobs;
    }),

  /**
   * Batch audit selected leads (max 5, sequential processing in background)
   */
  batchAuditSelected: protectedProcedure
    .input(z.object({ leadIds: z.array(z.number()).max(5) }))
    .mutation(async ({ input, ctx }) => {
      requireCostAuthority(ctx.user);
      await checkKillSwitch(ctx.user.id);
      await checkRateLimit(ctx.user.id, "batch_audit");
      await Promise.all(
        input.leadIds.map(leadId => requireOwnedLead(leadId, ctx.user))
      );

      const { getLeadById, getAuditByLeadId, createAudit, updateLead } =
        await import("./db");
      const { analyzeVisualDebt } = await import("./visualAudit");
      const { enrichLead } = await import("./lib/enrichment");

      // Process leads in background (non-blocking)
      (async () => {
        for (let i = 0; i < input.leadIds.length; i++) {
          const leadId = input.leadIds[i];

          try {
            // Get lead details first
            const lead = await getLeadById(leadId);
            if (!lead) {
              console.error(`[BatchAudit] Lead ${leadId} not found`);
              continue;
            }

            // Check if lead already has an audit with detailed report
            const existingAudit = await getAuditByLeadId(leadId);
            if (existingAudit && lead.detailedReport) {
              console.log(
                `[BatchAudit] Lead ${leadId} already has detailed report, skipping`
              );
              continue;
            }

            // Allow re-audit if detailedReport is missing (for enrichment testing)
            if (existingAudit) {
              console.log(
                `[BatchAudit] Re-auditing lead ${leadId} to populate detailedReport`
              );
            }
            // Run visual audit
            if (!lead.screenshotUrl) {
              console.error(`[BatchAudit] Lead ${leadId} has no screenshot`);
              continue;
            }

            console.log(
              `[BatchAudit] Processing lead ${i + 1}/${input.leadIds.length}: ${lead.companyName}`
            );

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

            // Run enrichment to populate the report and verified review channel.
            const enrichmentResult = await enrichLead({
              id: lead.id,
              userId: lead.userId,
              companyName: lead.companyName,
              websiteUrl: lead.websiteUrl,
              category: lead.category ?? "default",
              location: lead.city ? `${lead.city}, ${lead.state ?? ""}` : "",
              screenshotUrl: lead.screenshotUrl,
              prestigeScore: auditResult.prestigeScore,
              phone: lead.phone,
            });

            // Always persist the current channel so a historical SMS value is cleared.
            const leadUpdates: Record<string, any> = {
              prestigeScore: auditResult.prestigeScore,
              status: "audited",
              detailedReport: JSON.stringify(enrichmentResult.detailedReport),
              lastDeepScanAt: new Date(),
              outreachChannel: enrichmentResult.outreachChannel,
            };
            if (enrichmentResult.verifiedEmail) {
              // Store verified email in the lead record for the Charmer to use
              (leadUpdates as any).verifiedOwnerEmail =
                enrichmentResult.verifiedEmail;
            }
            await updateLead(leadId, leadUpdates);

            if (!audit) {
              console.error(
                `[BatchAudit] Failed to create audit for lead ${leadId}`
              );
              continue;
            }

            console.log(
              `[BatchAudit] ✓ Lead ${leadId} audited successfully (prestige: ${audit.prestigeScore})`
            );
          } catch (error) {
            console.error(`[BatchAudit] Error auditing lead ${leadId}:`, error);
            // Continue with next lead even if this one fails
          }
        }
        console.log(`[BatchAudit] Batch complete`);
      })().catch(error => {
        console.error("[BatchAudit] Background processing failed:", error);
      });

      // Return immediately
      return {
        success: true,
        message: `Started auditing ${input.leadIds.length} leads`,
        total: input.leadIds.length,
      };
    }),

  /**
   * Audit a bounded slice of pending leads, sequentially.
   */
  batchAuditAll: protectedProcedure.mutation(async ({ ctx }) => {
    requireCostAuthority(ctx.user);
    await checkKillSwitch(ctx.user.id);
    await checkRateLimit(ctx.user.id, "batch_audit");

    // Get all pending leads
    const { getLeadsByUserId } = await import("./db");
    const pendingLeads = await getLeadsByUserId(ctx.user.id);
    const pending = pendingLeads.filter(
      (lead: any) => lead.status === "pending"
    );
    const { selected: leadsToAudit, deferred } = selectBoundedBatch(pending);

    if (leadsToAudit.length === 0) {
      return {
        success: true,
        message: "No pending leads to audit",
        processed: 0,
      };
    }

    // Run the bounded batch sequentially so paid stages cannot burst locally.
    void (async () => {
      for (const lead of leadsToAudit) {
        try {
          await executePipeline(lead.id, ctx.user.id);
        } catch (error) {
          console.error(
            `[Orchestrator] Batch audit failed for lead ${lead.id}:`,
            error
          );
        }
      }
    })();

    return {
      success: true,
      message: `Batch audit started for ${leadsToAudit.length} leads; ${deferred} remain deferred`,
      processed: leadsToAudit.length,
      deferred,
      execution: "sequential" as const,
    };
  }),
});
