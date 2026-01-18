import { describe, expect, it } from "vitest";
import { extractBusinessDNA } from "./visionary";

describe("Visionary", () => {
  describe("extractBusinessDNA", () => {
    it("extracts default DNA when no visual debt provided", () => {
      const dna = extractBusinessDNA("Test Company", "https://example.com", null);

      expect(dna.companyName).toBe("Test Company");
      expect(dna.primaryColor).toBeDefined();
      expect(dna.secondaryColor).toBeDefined();
      expect(dna.accentColor).toBeDefined();
      expect(dna.fontStyle).toBeDefined();
      expect(dna.brandVibe).toBeDefined();
      expect(dna.industry).toBeDefined();
    });

    it("infers pool & spa industry from URL", () => {
      const dna = extractBusinessDNA(
        "Luxury Pools",
        "https://luxurypools.com",
        null
      );

      expect(dna.industry).toBe("pool & spa");
      expect(dna.brandVibe).toBe("luxury resort");
    });

    it("infers construction industry from URL", () => {
      const dna = extractBusinessDNA(
        "ABC Construction",
        "https://abccontractor.com",
        null
      );

      expect(dna.industry).toBe("construction");
      expect(dna.brandVibe).toBe("industrial strength");
    });

    it("infers food & beverage industry from URL", () => {
      const dna = extractBusinessDNA(
        "Fine Dining",
        "https://finedining-restaurant.com",
        null
      );

      expect(dna.industry).toBe("food & beverage");
      expect(dna.brandVibe).toBe("artisanal craft");
    });

    it("extracts colors from visual debt design issues", () => {
      const visualDebt = {
        categories: {
          design: [
            {
              description: "Primary color #FF5733 clashes with secondary #C70039",
            },
          ],
        },
      };

      const dna = extractBusinessDNA(
        "Test Company",
        "https://example.com",
        visualDebt
      );

      expect(dna.primaryColor).toBe("#FF5733");
      expect(dna.secondaryColor).toBe("#C70039");
    });

    it("handles visual debt without color information", () => {
      const visualDebt = {
        categories: {
          design: [
            {
              description: "Layout is inconsistent across pages",
            },
          ],
        },
      };

      const dna = extractBusinessDNA(
        "Test Company",
        "https://example.com",
        visualDebt
      );

      // Should fall back to defaults
      expect(dna.primaryColor).toBe("#1a1a1a");
      expect(dna.secondaryColor).toBe("#ffffff");
    });

    it("handles empty visual debt categories", () => {
      const visualDebt = {
        categories: {
          design: [],
          branding: [],
        },
      };

      const dna = extractBusinessDNA(
        "Test Company",
        "https://example.com",
        visualDebt
      );

      expect(dna).toBeDefined();
      expect(dna.companyName).toBe("Test Company");
    });

    it("handles malformed visual debt gracefully", () => {
      const visualDebt = {
        // Missing categories
      };

      const dna = extractBusinessDNA(
        "Test Company",
        "https://example.com",
        visualDebt
      );

      expect(dna).toBeDefined();
      expect(dna.companyName).toBe("Test Company");
    });
  });
});
