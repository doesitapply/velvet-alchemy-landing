import { getDb } from "./db";
import { apiCalls, systemConfig } from "../drizzle/schema";
import { eq, gte, sql } from "drizzle-orm";

/**
 * API Cost Tracker — logs all API usage and enforces a daily spend budget.
 *
 * Pricing (as of Jan 2026):
 *   LLM (GPT-4):   ~$0.03/1K input tokens, ~$0.06/1K output tokens
 *   Screenshot:     ~$0.01 per capture
 *   Storage (S3):   ~$0.023/GB stored, ~$0.09/GB transfer
 *
 * Kill-switch:
 *   After every tracked call, the daily total is checked against
 *   DAILY_COST_BUDGET_CENTS (default 1000 = $10.00).
 *   If the budget is exceeded, global_kill_switch is flipped to "true"
 *   and all background workers pause until the operator resets it.
 */

/** Default daily budget in cents ($10.00). Override via DB systemConfig key. */
export const DEFAULT_DAILY_BUDGET_CENTS = 1_000;

export type DailyBudgetDecision = {
  allowed: boolean;
  totalCents: number;
  budgetCents: number;
  reserveCents: number;
  remainingCents: number;
};

export function evaluateDailyBudget(
  totalCents: number,
  budgetCents: number,
  reserveCents = 0
): DailyBudgetDecision {
  const normalizedTotal = Math.max(0, Math.floor(totalCents));
  const normalizedBudget = Math.max(1, Math.floor(budgetCents));
  const normalizedReserve = Math.max(0, Math.ceil(reserveCents));
  return {
    allowed:
      normalizedTotal < normalizedBudget &&
      normalizedTotal + normalizedReserve <= normalizedBudget,
    totalCents: normalizedTotal,
    budgetCents: normalizedBudget,
    reserveCents: normalizedReserve,
    remainingCents: Math.max(0, normalizedBudget - normalizedTotal),
  };
}

async function getBudgetState(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
): Promise<{ totalCents: number; budgetCents: number }> {
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const rows = await db
    .select({ total: sql<number>`COALESCE(SUM(estimatedCost), 0)` })
    .from(apiCalls)
    .where(gte(apiCalls.createdAt, todayMidnight));
  const budgetRow = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "daily_cost_budget_cents"))
    .limit(1);
  const configured = Number.parseInt(budgetRow[0]?.value ?? "", 10);

  return {
    totalCents: Number(rows[0]?.total ?? 0),
    budgetCents:
      Number.isSafeInteger(configured) && configured > 0
        ? configured
        : DEFAULT_DAILY_BUDGET_CENTS,
  };
}

async function tripGlobalKillSwitch(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  description: string
): Promise<void> {
  const [existing] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, "global_kill_switch"))
    .limit(1);

  if (existing) {
    await db
      .update(systemConfig)
      .set({ value: "true", description, updatedAt: new Date() })
      .where(eq(systemConfig.key, "global_kill_switch"));
    return;
  }

  await db.insert(systemConfig).values({
    key: "global_kill_switch",
    value: "true",
    description,
  });
}

export async function assertDailyBudgetAvailable(
  reserveCents = 0
): Promise<DailyBudgetDecision> {
  const db = await getDb();
  if (!db) {
    throw new Error(
      "Cost state is unavailable; the external API request was not started."
    );
  }

  const state = await getBudgetState(db);
  const decision = evaluateDailyBudget(
    state.totalCents,
    state.budgetCents,
    reserveCents
  );
  if (!decision.allowed) {
    await tripGlobalKillSwitch(
      db,
      `Auto-tripped before external API call: daily cost $${(decision.totalCents / 100).toFixed(2)}, reserved $${(decision.reserveCents / 100).toFixed(2)}, budget $${(decision.budgetCents / 100).toFixed(2)} at ${new Date().toISOString()}`
    );
    throw new Error(
      `Daily API budget would be exceeded: ${decision.remainingCents} cents remain and ${decision.reserveCents} cents are reserved for this request.`
    );
  }
  return decision;
}

interface TrackApiCallParams {
  userId: number;
  leadId?: number;
  service: "llm" | "screenshot" | "storage" | "other";
  operation: string;
  tokensUsed?: number;
  estimatedCostCents: number; // e.g., 50 = $0.50
  requestData?: Record<string, any>;
  responseStatus: "success" | "error" | "timeout";
}

/**
 * Track an API call, persist it to the database, and check the daily budget.
 * Never throws — cost tracking must not break the main flow.
 */
export async function trackApiCall(params: TrackApiCallParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[CostTracker] Database not available");
      return;
    }

    await db.insert(apiCalls).values({
      userId: params.userId,
      leadId: params.leadId,
      service: params.service,
      operation: params.operation,
      tokensUsed: params.tokensUsed,
      estimatedCost: params.estimatedCostCents,
      requestData: params.requestData
        ? JSON.stringify(params.requestData)
        : null,
      responseStatus: params.responseStatus,
    });

    // Check daily budget after every successful insert
    await checkDailyBudget(db);
  } catch (error) {
    console.error("[CostTracker] Failed to log API call:", error);
  }
}

/**
 * Sum all API costs since midnight UTC today.
 * If the total exceeds the configured budget, flip global_kill_switch to "true".
 */
async function checkDailyBudget(
  db: Awaited<ReturnType<typeof getDb>>
): Promise<void> {
  if (!db) return;

  try {
    const state = await getBudgetState(db);
    const decision = evaluateDailyBudget(state.totalCents, state.budgetCents);
    if (!decision.allowed) {
      await tripGlobalKillSwitch(
        db,
        `Auto-tripped: daily cost $${(decision.totalCents / 100).toFixed(2)} reached budget $${(decision.budgetCents / 100).toFixed(2)} at ${new Date().toISOString()}`
      );
      console.warn(
        `[CostTracker] Kill-switch tripped at $${(decision.totalCents / 100).toFixed(2)} of $${(decision.budgetCents / 100).toFixed(2)}.`
      );
    }
  } catch (err) {
    // Don't let budget check crash the tracker
    console.error("[CostTracker] Budget check failed:", err);
  }
}

/**
 * Estimate cost for LLM API call based on token counts.
 * GPT-4 pricing: ~$0.03/1K input, ~$0.06/1K output
 */
export function estimateLLMCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCostPer1K = 3; // cents
  const outputCostPer1K = 6; // cents
  const inputCost = (inputTokens / 1000) * inputCostPer1K;
  const outputCost = (outputTokens / 1000) * outputCostPer1K;
  return Math.ceil(inputCost + outputCost);
}

/** Fixed cost for a single screenshot capture. */
export const SCREENSHOT_COST_CENTS = 1; // $0.01

/**
 * Estimate cost for an S3 storage operation.
 */
export function estimateStorageCost(
  sizeBytes: number,
  operation: "upload" | "download"
): number {
  const sizeGB = sizeBytes / (1024 * 1024 * 1024);
  if (operation === "upload") {
    return Math.max(1, Math.ceil(sizeGB * 2.3));
  } else {
    return Math.max(1, Math.ceil(sizeGB * 9));
  }
}

/**
 * Get total API costs for a user (all time).
 */
export async function getUserApiCosts(userId: number): Promise<{
  totalCostCents: number;
  llmCostCents: number;
  screenshotCostCents: number;
  storageCostCents: number;
  callCount: number;
}> {
  const db = await getDb();
  if (!db) {
    throw new Error("Cost state is unavailable.");
  }

  const calls = await db
    .select()
    .from(apiCalls)
    .where(eq(apiCalls.userId, userId));

  let totalCost = 0,
    llmCost = 0,
    screenshotCost = 0,
    storageCost = 0;

  for (const call of calls) {
    totalCost += call.estimatedCost;
    if (call.service === "llm") llmCost += call.estimatedCost;
    else if (call.service === "screenshot")
      screenshotCost += call.estimatedCost;
    else if (call.service === "storage") storageCost += call.estimatedCost;
  }

  return {
    totalCostCents: totalCost,
    llmCostCents: llmCost,
    screenshotCostCents: screenshotCost,
    storageCostCents: storageCost,
    callCount: calls.length,
  };
}

/**
 * Get today's total API cost across all users (UTC day).
 */
export async function getDailyTotalCostCents(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Cost state is unavailable.");

  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  const rows = await db
    .select({ total: sql<number>`COALESCE(SUM(estimatedCost), 0)` })
    .from(apiCalls)
    .where(gte(apiCalls.createdAt, todayMidnight));

  return Number(rows[0]?.total ?? 0);
}
