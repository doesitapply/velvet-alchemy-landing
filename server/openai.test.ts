import { describe, it, expect } from "vitest";
import OpenAI from "openai";

describe("OpenAI API Key Validation", () => {
  it("should successfully authenticate with OpenAI API", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");
    
    const openai = new OpenAI({ apiKey });
    
    // Make a minimal API call to validate the key
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
    });
    
    expect(response.choices).toBeDefined();
    expect(response.choices.length).toBeGreaterThan(0);
    expect(response.choices[0].message.content).toBeDefined();
  }, 30000); // 30 second timeout for API call
});
