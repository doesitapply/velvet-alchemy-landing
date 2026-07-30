/**
 * Pipeline Queue Worker
 *
 * FIFO background worker that processes pending pipeline jobs from the
 * pipelineJobs table. It is disabled unless ENABLE_PIPELINE_WORKER=true.
 * When enabled, it polls every five minutes and processes one lead at a time.
 *
 * Architecture:
 *   - pipelineJobs acts as a strict FIFO state machine
 *   - Worker claims jobs by marking them 'running' before processing
 *   - Failed jobs are retried up to MAX_RETRIES times with exponential backoff
 *   - If the global kill-switch is active, the worker pauses until it's cleared
 *
 * Registration: called from server/index.ts on startup via startWorker()
 */

import { getDb } from "./db";
import { leads, pipelineJobs, systemConfig, users } from "../drizzle/schema";
import { eq, and, lte, asc } from "drizzle-orm";
import { executePipeline } from "./orchestrator";
import { isPrivilegedUser } from "./lib/accessControl";

const WORKER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 1; // Conservative spend boundary
const MAX_RETRIES = 2; // Retry failed jobs up to 2 times

let workerTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Check if the global kill-switch is active.
 * Returns true if the system should be paused.
 */
async function isKillSwitchActive(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return true;
    const rows = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, "global_kill_switch"))
      .limit(1);
    return rows[0]?.value === "true";
  } catch {
    return true;
  }
}

/**
 * Claim and return the next batch of pending pipeline jobs.
 * Each conditional update is atomic, so another worker cannot claim a row
 * after its status has changed.
 */
async function claimNextBatch(): Promise<
  Array<{ id: number; leadId: number; retryCount: number }>
> {
  const db = await getDb();
  if (!db) return [];

  // Find pending jobs (or failed jobs eligible for retry), oldest first
  const candidates = await db
    .select({
      id: pipelineJobs.id,
      leadId: pipelineJobs.leadId,
      retryCount: pipelineJobs.retryCount,
    })
    .from(pipelineJobs)
    .where(
      and(
        eq(pipelineJobs.status, "pending"),
        lte(pipelineJobs.retryCount, MAX_RETRIES)
      )
    )
    .orderBy(asc(pipelineJobs.createdAt))
    .limit(BATCH_SIZE);

  if (candidates.length === 0) return [];

  const claimed: typeof candidates = [];
  for (const candidate of candidates) {
    const result = await db
      .update(pipelineJobs)
      .set({ status: "running", currentStage: "queued", updatedAt: new Date() })
      .where(
        and(
          eq(pipelineJobs.id, candidate.id),
          eq(pipelineJobs.status, "pending"),
          lte(pipelineJobs.retryCount, MAX_RETRIES)
        )
      );
    if (Number(result[0]?.affectedRows ?? 0) === 1) {
      claimed.push(candidate);
    }
  }

  return claimed;
}

/**
 * Re-queue a failed job for retry (increments retryCount).
 * If retryCount exceeds MAX_RETRIES, marks it permanently failed.
 */
async function requeueOrFail(
  jobId: number,
  retryCount: number,
  errorMessage: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  if (retryCount >= MAX_RETRIES) {
    await db
      .update(pipelineJobs)
      .set({ status: "failed", errorMessage, updatedAt: new Date() })
      .where(eq(pipelineJobs.id, jobId));
    console.log(
      `[Worker] Job ${jobId} permanently failed after ${retryCount} retries`
    );
  } else {
    await db
      .update(pipelineJobs)
      .set({
        status: "pending",
        retryCount: retryCount + 1,
        errorMessage,
        currentStage: null,
        updatedAt: new Date(),
      })
      .where(eq(pipelineJobs.id, jobId));
    console.log(
      `[Worker] Job ${jobId} re-queued (retry ${retryCount + 1}/${MAX_RETRIES})`
    );
  }
}

/**
 * Process a single pipeline job.
 * Delegates to executePipeline() which handles all 3 stages.
 * Verifies that the lead owner has cost authority before starting work.
 */
async function processJob(job: {
  id: number;
  leadId: number;
  retryCount: number;
}): Promise<void> {
  console.log(
    `[Worker] Processing job ${job.id} for lead ${job.leadId} (retry ${job.retryCount})`
  );

  try {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable before worker execution.");
    const [owner] = await db
      .select({
        id: users.id,
        openId: users.openId,
        role: users.role,
      })
      .from(leads)
      .innerJoin(users, eq(leads.userId, users.id))
      .where(eq(leads.id, job.leadId))
      .limit(1);
    if (!owner || !isPrivilegedUser(owner)) {
      await db
        .update(pipelineJobs)
        .set({
          status: "failed",
          errorMessage:
            "The lead owner does not have authority to run metered background work.",
          updatedAt: new Date(),
        })
        .where(eq(pipelineJobs.id, job.id));
      console.warn(
        `[Worker] Job ${job.id} blocked because its lead owner lacks cost authority.`
      );
      return;
    }

    // executePipeline handles its own job status updates internally
    await executePipeline(job.leadId, owner.id);
    console.log(`[Worker] ✓ Job ${job.id} completed for lead ${job.leadId}`);
  } catch (err: any) {
    const errorMessage = err?.message ?? "Unknown error";
    console.error(
      `[Worker] ✗ Job ${job.id} failed for lead ${job.leadId}:`,
      errorMessage
    );
    await requeueOrFail(job.id, job.retryCount, errorMessage);
  }
}

/**
 * Single worker tick: claim a batch and process sequentially.
 */
async function tick(): Promise<void> {
  if (isRunning) {
    console.log("[Worker] Previous tick still running, skipping");
    return;
  }

  isRunning = true;

  try {
    // Respect kill-switch
    if (await isKillSwitchActive()) {
      console.log("[Worker] Kill-switch active — pausing");
      return;
    }

    const batch = await claimNextBatch();
    if (batch.length === 0) return;

    console.log(
      `[Worker] Claimed ${batch.length} job(s): ${batch.map(j => j.id).join(", ")}`
    );

    // Process sequentially — do not parallelize, respects API rate limits
    for (const job of batch) {
      if (await isKillSwitchActive()) {
        console.warn(
          "[Worker] Kill-switch state is active or unavailable; stopping the batch."
        );
        break;
      }
      await processJob(job);
    }
  } catch (err) {
    console.error("[Worker] Tick error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the background worker.
 * Safe to call multiple times — only one interval is ever active.
 */
export function startWorker(): void {
  if (process.env.ENABLE_PIPELINE_WORKER !== "true") {
    console.log(
      "[Worker] Disabled. Set ENABLE_PIPELINE_WORKER=true only after reviewing queued work and spend limits."
    );
    return;
  }
  if (workerTimer) {
    console.log("[Worker] Already running");
    return;
  }

  console.log(
    `[Worker] Starting — polling every ${WORKER_INTERVAL_MS / 1000}s, batch size ${BATCH_SIZE}`
  );

  // Run immediately on startup, then on interval
  tick().catch(err => console.error("[Worker] Initial tick error:", err));
  workerTimer = setInterval(() => {
    tick().catch(err => console.error("[Worker] Interval tick error:", err));
  }, WORKER_INTERVAL_MS);
}

/**
 * Stop the background worker (used in tests / graceful shutdown).
 */
export function stopWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log("[Worker] Stopped");
  }
}

/**
 * Enqueue a new pipeline job for a lead.
 * Called by scraperRouter and leads.create when a new lead is created.
 * Idempotent: skips if a pending/running job already exists for this lead.
 */
export async function enqueueLeadForPipeline(
  leadId: number
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Check for existing active job
  const existing = await db
    .select({ id: pipelineJobs.id, status: pipelineJobs.status })
    .from(pipelineJobs)
    .where(eq(pipelineJobs.leadId, leadId))
    .limit(1);

  const activeStatuses = ["pending", "running"];
  if (existing.length > 0 && activeStatuses.includes(existing[0].status)) {
    console.log(
      `[Worker] Lead ${leadId} already has an active job (${existing[0].status}), skipping enqueue`
    );
    return existing[0].id;
  }

  const result = await db.insert(pipelineJobs).values({
    leadId,
    status: "pending",
    currentStage: null,
    stagesCompleted: JSON.stringify([]),
    retryCount: 0,
  });

  const jobId = result[0].insertId;
  console.log(`[Worker] Enqueued lead ${leadId} as job ${jobId}`);
  return jobId;
}
