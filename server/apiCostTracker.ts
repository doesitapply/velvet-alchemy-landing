import { getDb } from "./db";
import { apiCalls } from "../drizzle/schema";

/**
 * API Cost Tracker - Logs all API usage with estimated costs
 * 
 * Pricing (as of Jan 2026):
 * - LLM (GPT-4): ~$0.03 per 1K tokens input, ~$0.06 per 1K tokens output
 * - Screenshot API: ~$0.01 per screenshot
 * - Storage (S3): ~$0.023 per GB stored, ~$0.09 per GB transfer
 */

interface TrackApiCallParams {
  userId: number;
  leadId?: number;
  service: 'llm' | 'screenshot' | 'storage' | 'other';
  operation: string;
  tokensUsed?: number;
  estimatedCostCents: number; // Cost in cents (e.g., 50 = $0.50)
  requestData?: Record<string, any>;
  responseStatus: 'success' | 'error' | 'timeout';
}

/**
 * Track an API call and log it to the database
 */
export async function trackApiCall(params: TrackApiCallParams): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[API Cost Tracker] Database not available');
      return;
    }
    
    await db.insert(apiCalls).values({
      userId: params.userId,
      leadId: params.leadId,
      service: params.service,
      operation: params.operation,
      tokensUsed: params.tokensUsed,
      estimatedCost: params.estimatedCostCents,
      requestData: params.requestData ? JSON.stringify(params.requestData) : null,
      responseStatus: params.responseStatus,
    });
  } catch (error) {
    // Don't throw - we don't want cost tracking to break the main flow
    console.error('[API Cost Tracker] Failed to log API call:', error);
  }
}

/**
 * Estimate cost for LLM API call based on tokens
 * GPT-4 pricing: ~$0.03/1K input tokens, ~$0.06/1K output tokens
 */
export function estimateLLMCost(inputTokens: number, outputTokens: number): number {
  const inputCostPer1K = 3; // 3 cents per 1K tokens
  const outputCostPer1K = 6; // 6 cents per 1K tokens
  
  const inputCost = (inputTokens / 1000) * inputCostPer1K;
  const outputCost = (outputTokens / 1000) * outputCostPer1K;
  
  return Math.ceil(inputCost + outputCost); // Round up to nearest cent
}

/**
 * Fixed cost for screenshot API call
 */
export const SCREENSHOT_COST_CENTS = 1; // $0.01 per screenshot

/**
 * Estimate cost for S3 storage operation
 */
export function estimateStorageCost(sizeBytes: number, operation: 'upload' | 'download'): number {
  const sizeGB = sizeBytes / (1024 * 1024 * 1024);
  
  if (operation === 'upload') {
    // Storage cost: $0.023 per GB per month (amortize to per-operation)
    return Math.max(1, Math.ceil(sizeGB * 2.3)); // Minimum 1 cent
  } else {
    // Transfer cost: $0.09 per GB
    return Math.max(1, Math.ceil(sizeGB * 9)); // Minimum 1 cent
  }
}

/**
 * Get total API costs for a user
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
    return {
      totalCostCents: 0,
      llmCostCents: 0,
      screenshotCostCents: 0,
      storageCostCents: 0,
      callCount: 0,
    };
  }
  
  const calls = await db
    .select()
    .from(apiCalls)
    .where(eq(apiCalls.userId, userId));

  let totalCost = 0;
  let llmCost = 0;
  let screenshotCost = 0;
  let storageCost = 0;

  for (const call of calls) {
    totalCost += call.estimatedCost;
    
    if (call.service === 'llm') {
      llmCost += call.estimatedCost;
    } else if (call.service === 'screenshot') {
      screenshotCost += call.estimatedCost;
    } else if (call.service === 'storage') {
      storageCost += call.estimatedCost;
    }
  }

  return {
    totalCostCents: totalCost,
    llmCostCents: llmCost,
    screenshotCostCents: screenshotCost,
    storageCostCents: storageCost,
    callCount: calls.length,
  };
}

// Import eq for where clause
import { eq } from "drizzle-orm";
