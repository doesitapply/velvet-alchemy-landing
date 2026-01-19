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
});
