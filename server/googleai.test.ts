import { describe, it, expect } from "vitest";

describe("Google AI API Key Validation", () => {
  it("should authenticate and get a response from Gemini native API", async () => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    expect(apiKey, "GOOGLE_AI_API_KEY must be set").toBeTruthy();

    // Use the native Gemini REST API (same as our fallback implementation)
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey!,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say OK" }] }],
        }),
      }
    );

    const body = await response.json();
    expect(response.ok, `Gemini returned ${response.status}: ${JSON.stringify(body).slice(0, 300)}`).toBe(true);
    expect(body.candidates?.[0]?.content?.parts?.[0]?.text).toBeDefined();
  }, 30000);
});
