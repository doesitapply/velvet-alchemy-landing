import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { leads, audits, pipelineJobs, assets } from "../drizzle/schema";
import { captureScreenshot } from "./screenshot";
import { storagePut } from "./storage";
import { analyzeVisualDebt } from "./visualAudit";
import { generateAssetsForLead } from "./visionary";
import { generateOutreachCopy } from "./charmer";
import { logAudit } from "./governor";

/**
 * The Orchestrator
 * Automates the complete pipeline from lead creation to outreach draft generation
 */

export type PipelineStage = "screenshot" | "audit" | "outreach";

export interface PipelineResult {
  success: boolean;
  stage: PipelineStage;
  error?: string;
}

/**
 * Create a new pipeline job for a lead
 */
export async function createPipelineJob(leadId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(pipelineJobs).values({
    leadId,
    status: "pending",
    currentStage: null,
    stagesCompleted: JSON.stringify([]),
    retryCount: 0,
  });

  return result[0].insertId;
}

/**
 * Update pipeline job status
 */
async function updatePipelineJob(
  jobId: number,
  updates: {
    status?: "pending" | "running" | "completed" | "failed";
    currentStage?: string | null;
    progressPercentage?: number;
    stagesCompleted?: string[];
    errorMessage?: string | null;
    retryCount?: number;
    completedAt?: Date | null;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Record<string, unknown> = {};
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.currentStage !== undefined) updateData.currentStage = updates.currentStage;
  if (updates.progressPercentage !== undefined) updateData.progressPercentage = updates.progressPercentage;
  if (updates.stagesCompleted !== undefined) updateData.stagesCompleted = JSON.stringify(updates.stagesCompleted);
  if (updates.errorMessage !== undefined) updateData.errorMessage = updates.errorMessage;
  if (updates.retryCount !== undefined) updateData.retryCount = updates.retryCount;
  if (updates.completedAt !== undefined) updateData.completedAt = updates.completedAt;

  await db.update(pipelineJobs).set(updateData).where(eq(pipelineJobs.id, jobId));
}

/**
 * Stage 1: Screenshot + Visual Audit
 */
async function runScreenshotAndAuditStage(leadId: number, userId: number): Promise<PipelineResult> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Fetch lead
    const leadResult = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (leadResult.length === 0) {
      return { success: false, stage: "screenshot", error: "Lead not found" };
    }
    const lead = leadResult[0];

    // Capture screenshot if not already done
    if (!lead.screenshotUrl) {
      const screenshotResult = await captureScreenshot(lead.websiteUrl);
      if (!screenshotResult.success) {
        return { success: false, stage: "screenshot", error: screenshotResult.error || "Screenshot capture failed" };
      }
      const fileKey = `leads/${leadId}/screenshot-${Date.now()}.png`;
      const { url } = await storagePut(fileKey, screenshotResult.buffer, "image/png");

      await db.update(leads).set({
        screenshotUrl: url,
        screenshotKey: fileKey,
      }).where(eq(leads.id, leadId));
    }

    // Fetch updated lead with screenshot
    const updatedLeadResult = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    const updatedLead = updatedLeadResult[0];

    // Check if audit already exists
    const existingAudit = await db.select().from(audits).where(eq(audits.leadId, leadId)).limit(1);
    if (existingAudit.length === 0) {
      // Perform visual audit
      const auditResult = await analyzeVisualDebt(updatedLead.screenshotUrl!, lead.websiteUrl, lead.companyName);

      await db.insert(audits).values({
        leadId,
        summary: auditResult.summary,
        prestigeScore: auditResult.prestigeScore,
        visualDebtData: JSON.stringify(auditResult.visualDebt),
      });

      // Update lead status to 'audited' and copy prestige score
      await db.update(leads).set({
        status: 'audited',
        prestigeScore: auditResult.prestigeScore,
      }).where(eq(leads.id, leadId));
    } else {
      // Audit already exists, ensure lead status is 'audited'
      const audit = existingAudit[0];
      await db.update(leads).set({
        status: 'audited',
        prestigeScore: audit.prestigeScore,
      }).where(eq(leads.id, leadId));
    }

    await logAudit({
      userId,
      action: "pipeline_stage_complete",
      resource: "pipeline",
      resourceId: leadId,
      details: JSON.stringify({ stage: "screenshot_audit", leadId }),
      status: "success",
    });

    return { success: true, stage: "screenshot" };
  } catch (error) {
    console.error("[Orchestrator] Screenshot/Audit stage failed:", error);
    return {
      success: false,
      stage: "screenshot",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Stage 2: Outreach Draft Generation
 * Note: Asset generation has been moved to on-demand (manual trigger via LeadDetail page)
 */
async function runOutreachDraftStage(leadId: number, userId: number): Promise<PipelineResult> {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Fetch lead, audit, and assets
    const leadResult = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (leadResult.length === 0) {
      return { success: false, stage: "outreach", error: "Lead not found" };
    }
    const lead = leadResult[0];

    const auditResult = await db.select().from(audits).where(eq(audits.leadId, leadId)).limit(1);
    if (auditResult.length === 0) {
      return { success: false, stage: "outreach", error: "Audit not found" };
    }
    const audit = auditResult[0];

    // Fetch assets
    const assetsResult = await db.select().from(assets).where(eq(assets.leadId, leadId));

    // Generate outreach copy
    const outreach = await generateOutreachCopy(lead, audit, assetsResult);

    // Create campaign and draft (this will be handled by the charmer router in the UI)
    // For now, we just log that outreach was generated
    await logAudit({
      userId,
      action: "pipeline_stage_complete",
      resource: "pipeline",
      resourceId: leadId,
      details: JSON.stringify({ stage: "outreach_draft", leadId, subject: outreach.subject }),
      status: "success",
    });

    return { success: true, stage: "outreach" };
  } catch (error) {
    console.error("[Orchestrator] Outreach draft stage failed:", error);
    return {
      success: false,
      stage: "outreach",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Execute the complete pipeline for a lead
 */
export async function executePipeline(leadId: number, userId: number): Promise<void> {
  const jobId = await createPipelineJob(leadId);

  try {
    await updatePipelineJob(jobId, { status: "running", currentStage: "screenshot", progressPercentage: 0 });

    // Stage 1: Screenshot + Audit (0-66%)
    const stage1Result = await runScreenshotAndAuditStage(leadId, userId);
    if (!stage1Result.success) {
      await updatePipelineJob(jobId, {
        status: "failed",
        errorMessage: stage1Result.error || "Screenshot/Audit stage failed",
        currentStage: "screenshot",
      });
      return;
    }
    await updatePipelineJob(jobId, {
      currentStage: "outreach",
      progressPercentage: 66,
      stagesCompleted: ["screenshot"],
    });

    // Stage 2: Outreach Draft (66-100%)
    const stage2Result = await runOutreachDraftStage(leadId, userId);
    if (!stage2Result.success) {
      await updatePipelineJob(jobId, {
        status: "failed",
        errorMessage: stage2Result.error || "Outreach draft stage failed",
        currentStage: "outreach",
      });
      return;
    }

    // Pipeline complete (assets generation is now on-demand via LeadDetail page)
    await updatePipelineJob(jobId, {
      status: "completed",
      currentStage: null,
      progressPercentage: 100,
      stagesCompleted: ["screenshot", "outreach"],
      completedAt: new Date(),
    });

    await logAudit({
      userId,
      action: "pipeline_complete",
      resource: "pipeline",
      resourceId: leadId,
      details: JSON.stringify({ jobId, leadId }),
      status: "success",
    });
  } catch (error) {
    console.error("[Orchestrator] Pipeline execution failed:", error);
    await updatePipelineJob(jobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Get pipeline job status
 */
export async function getPipelineJobStatus(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(pipelineJobs).where(eq(pipelineJobs.id, jobId)).limit(1);
  if (result.length === 0) {
    return null;
  }

  const job = result[0];
  return {
    ...job,
    stagesCompleted: job.stagesCompleted ? JSON.parse(job.stagesCompleted) : [],
  };
}

/**
 * Get all pipeline jobs for a lead
 */
export async function getPipelineJobsForLead(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const jobs = await db.select().from(pipelineJobs).where(eq(pipelineJobs.leadId, leadId));
  return jobs.map(job => ({
    ...job,
    stagesCompleted: job.stagesCompleted ? JSON.parse(job.stagesCompleted) : [],
  }));
}
