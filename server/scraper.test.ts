/**
 * Scraper AI qualification test
 * Verifies that invokeAI() correctly delegates to invokeLLM() and returns a valid qualification result.
 */
import { describe, it, expect } from "vitest";
import { invokeAI } from "./aiProvider";

describe("Scraper AI Qualification", () => {
  it("should qualify a business via invokeAI → invokeLLM fallback chain", async () => {
    const result = await invokeAI({
      messages: [
        {
          role: "system",
          content: `You are a lead qualifier. Return a JSON object with isQualified (boolean) and reason (string).`,
        },
        {
          role: "user",
          content: `Qualify this business:
Name: Reno Family Dentistry
Category: dentist
Address: 123 Main St, Reno, NV
Reviews: 87

Is this a valid high-ticket prospect?`,
        },
      ],
      responseFormat: "json_schema",
      schema: {
        name: "lead_qualification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            isQualified: { type: "boolean" },
            reason: { type: "string" },
          },
          required: ["isQualified", "reason"],
          additionalProperties: false,
        },
      },
    });

    expect(result).toBeDefined();
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);

    const parsed = JSON.parse(result.content);
    expect(typeof parsed.isQualified).toBe("boolean");
    expect(typeof parsed.reason).toBe("string");

    console.log(`[Test] Provider: ${result.provider}, Model: ${result.model}`);
    console.log(`[Test] Result: ${result.content}`);
  }, 30000);
});
