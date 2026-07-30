import { describe, expect, it } from "vitest";
import {
  evaluateDailyBudget,
  estimateLLMCost,
  estimateStorageCost,
  SCREENSHOT_COST_CENTS,
} from "./apiCostTracker";

describe("API cost estimates", () => {
  it("rounds LLM estimates up to a whole cent", () => {
    expect(estimateLLMCost(1_000, 1_000)).toBe(9);
    expect(estimateLLMCost(1, 1)).toBe(1);
  });

  it("never reports a storage operation below one cent", () => {
    expect(estimateStorageCost(1, "upload")).toBe(1);
    expect(estimateStorageCost(1, "download")).toBe(1);
  });

  it("keeps screenshot estimates explicit", () => {
    expect(SCREENSHOT_COST_CENTS).toBe(1);
  });

  it("blocks a request whose reserve would cross the daily cap", () => {
    expect(evaluateDailyBudget(950, 1_000, 51)).toMatchObject({
      allowed: false,
      remainingCents: 50,
    });
    expect(evaluateDailyBudget(950, 1_000, 50)).toMatchObject({
      allowed: true,
      remainingCents: 50,
    });
  });
});
