import { describe, expect, it } from "vitest";
import { analyzeVisualDebt } from "./visualAudit";

describe("Visual Audit", () => {
  describe("analyzeVisualDebt", () => {
    it("returns structured audit result with prestige score", async () => {
      // Use a real, publicly accessible screenshot URL for testing
      const screenshotUrl = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800";
      const websiteUrl = "https://example.com";
      const companyName = "Test Company";

      const result = await analyzeVisualDebt(screenshotUrl, websiteUrl, companyName);

      // Verify structure
      expect(result).toBeDefined();
      expect(result.prestigeScore).toBeGreaterThanOrEqual(0);
      expect(result.prestigeScore).toBeLessThanOrEqual(100);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe("string");
      expect(result.summary.length).toBeGreaterThan(0);

      // Verify arrays
      expect(Array.isArray(result.visualDebt)).toBe(true);
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.weaknesses)).toBe(true);

      // Verify visual debt items structure
      if (result.visualDebt.length > 0) {
        const item = result.visualDebt[0];
        expect(item.category).toBeDefined();
        expect(["design", "ux", "branding", "content", "technical"]).toContain(item.category);
        expect(item.severity).toBeDefined();
        expect(["critical", "high", "medium", "low"]).toContain(item.severity);
        expect(item.issue).toBeDefined();
        expect(typeof item.issue).toBe("string");
        expect(item.recommendation).toBeDefined();
        expect(typeof item.recommendation).toBe("string");
      }
    }, 60000); // 60s timeout for LLM call

    it("handles invalid URL gracefully", async () => {
      const screenshotUrl = "not-a-valid-url";
      const websiteUrl = "https://example.com";
      const companyName = "Test Company";

      const result = await analyzeVisualDebt(screenshotUrl, websiteUrl, companyName);

      // Should return fallback result
      expect(result).toBeDefined();
      expect(result.prestigeScore).toBe(50);
      expect(result.summary).toContain("failed");
    }, 60000);

    it("returns valid prestige score range", async () => {
      const screenshotUrl = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800";
      const websiteUrl = "https://example.com";
      const companyName = "Test Company";

      const result = await analyzeVisualDebt(screenshotUrl, websiteUrl, companyName);

      expect(result.prestigeScore).toBeGreaterThanOrEqual(0);
      expect(result.prestigeScore).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.prestigeScore)).toBe(true);
    }, 60000);
  });
});
