import { invokeAI } from "./aiProvider";

export interface VisualDebtItem {
  category: "design" | "ux" | "branding" | "content" | "technical";
  severity: "critical" | "high" | "medium" | "low";
  issue: string;
  recommendation: string;
}

export interface VisualAuditResult {
  visualDebt: VisualDebtItem[];
  prestigeScore: number; // 0-100
  summary: string;
  strengths: string[];
  weaknesses: string[];
}

/**
 * Analyzes a website screenshot using GPT-4o Vision to identify visual debt
 * and compute a prestige score for luxury market targeting.
 * 
 * @param screenshotUrl Public URL of the screenshot
 * @param websiteUrl Original website URL for context
 * @param companyName Company name for context
 * @returns Structured audit result
 */
export async function analyzeVisualDebt(
  screenshotUrl: string,
  websiteUrl: string,
  companyName: string
): Promise<VisualAuditResult> {
  try {
    const response = await invokeAI({
      messages: [
        {
          role: "system",
          content: `You are an expert web designer and local business consultant. Your task is to audit website screenshots for small businesses. Evaluate design quality, user experience, mobile-friendliness, trust signals, and conversion optimization. Focus on practical improvements that help local businesses compete online. Be critical but constructive.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this screenshot of ${companyName}'s website (${websiteUrl}). Provide a detailed visual audit focusing on:

1. **Design Quality**: Typography readability, color contrast, spacing, visual hierarchy
2. **User Experience**: Navigation clarity, mobile-friendliness, contact info visibility
3. **Trust Signals**: Professional appearance, credibility indicators, social proof
4. **Content**: Clear value proposition, call-to-action effectiveness, local keywords
5. **Technical**: Page speed indicators, responsive design, visual polish

Return your analysis in the following JSON format:
{
  "visualDebt": [
    {
      "category": "design" | "ux" | "branding" | "content" | "technical",
      "severity": "critical" | "high" | "medium" | "low",
      "issue": "Brief description of the problem",
      "recommendation": "Specific actionable fix"
    }
  ],
  "prestigeScore": 0-100 (integer, where 100 = perfect small business website execution),
  "summary": "2-3 sentence overall assessment",
  "strengths": ["List of 2-3 positive aspects"],
  "weaknesses": ["List of 2-3 critical issues that hurt conversions or rankings"]
}

Be honest and specific. Focus on issues that directly impact local search rankings and customer trust. A score of 70+ should be reserved for truly exceptional execution.`,
            },
            {
              type: "image_url",
              image_url: {
                url: screenshotUrl,
                detail: "low", // Use low detail for faster processing (512px)
              },
            },
          ],
        },
      ],
      responseFormat: "json_schema",
      schema: {
        name: "visual_audit",
        strict: true,
        schema: {
          type: "object",
          properties: {
            visualDebt: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    enum: ["design", "ux", "branding", "content", "technical"],
                  },
                  severity: {
                    type: "string",
                    enum: ["critical", "high", "medium", "low"],
                  },
                  issue: { type: "string" },
                  recommendation: { type: "string" },
                },
                required: ["category", "severity", "issue", "recommendation"],
                additionalProperties: false,
              },
            },
            prestigeScore: { type: "integer", minimum: 0, maximum: 100 },
            summary: { type: "string" },
            strengths: {
              type: "array",
              items: { type: "string" },
            },
            weaknesses: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["visualDebt", "prestigeScore", "summary", "strengths", "weaknesses"],
          additionalProperties: false,
        },
      },
    });

    if (!response.content) {
      throw new Error("No response from LLM");
    }

    const content = response.content;

    const result: VisualAuditResult = JSON.parse(content);
    return result;
  } catch (error: any) {
    console.error("[Visual Audit] Failed to analyze screenshot:", error);
    
    // Return fallback result on error
    return {
      visualDebt: [
        {
          category: "technical",
          severity: "high",
          issue: "Automated audit failed",
          recommendation: "Manual review required",
        },
      ],
      prestigeScore: 50,
      summary: `Audit failed for ${companyName}. Error: ${error.message}`,
      strengths: ["Unable to analyze"],
      weaknesses: ["Audit system error"],
    };
  }
}
