import { invokeLLM } from "./_core/llm";
import type { Lead, Audit, Asset } from "../drizzle/schema";

export interface OutreachCopyResult {
  subject: string;
  body: string;
  recipientName: string | null;
  recipientEmail: string;
}

/**
 * Generate personalized outreach email copy based on lead audit and assets
 */
export async function generateOutreachCopy(
  lead: Lead,
  audit: Audit | null,
  assets: Asset[]
): Promise<OutreachCopyResult> {
  // Parse visual debt data
  let visualDebt: any = null;
  if (audit?.visualDebtData) {
    try {
      visualDebt = JSON.parse(audit.visualDebtData);
    } catch (e) {
      console.warn("[Charmer] Failed to parse visual debt data:", e);
    }
  }

  // Extract key issues from visual debt
  const keyIssues: string[] = [];
  if (visualDebt?.categories) {
    Object.entries(visualDebt.categories).forEach(([category, issues]: [string, any]) => {
      if (Array.isArray(issues) && issues.length > 0) {
        // Take top 2 issues from each category
        issues.slice(0, 2).forEach((issue: any) => {
          if (issue.description) {
            keyIssues.push(`${category}: ${issue.description}`);
          }
        });
      }
    });
  }

  // Extract strengths
  const strengths: string[] = [];
  if (visualDebt?.strengths && Array.isArray(visualDebt.strengths)) {
    strengths.push(...visualDebt.strengths.slice(0, 2));
  }

  // Build asset URLs for email
  const assetUrls = assets.map((asset) => ({
    type: asset.type,
    url: asset.url,
  }));

  // Generate outreach copy using LLM
  const prompt = `You are an elite outreach consultant for a premium digital solutions partner. Your job is to write a personalized, compelling outreach email to a business owner.

**Target Lead:**
- Company: ${lead.companyName}
- Website: ${lead.websiteUrl}
- Prestige Score: ${audit?.prestigeScore || "N/A"}/100

**Visual Audit Findings:**
${keyIssues.length > 0 ? `Key Issues:\n${keyIssues.map((issue) => `- ${issue}`).join("\n")}` : "No specific issues identified."}

${strengths.length > 0 ? `\nStrengths:\n${strengths.map((s) => `- ${s}`).join("\n")}` : ""}

**Generated Assets:**
${assetUrls.length > 0 ? assetUrls.map((a) => `- ${a.type}: ${a.url}`).join("\n") : "No assets generated yet."}

**Your Task:**
Write a short, high-impact outreach email (150-200 words) that:
1. Opens with a sincere compliment about their strengths (if any)
2. Professionaly identifies 1-2 specific visual debt issues without being critical
3. Introduces the generated assets as a vision of their potentially upgraded digital presence
4. Creates genuine value and curiosity
5. Ends with a professional CTA (e.g., "Would you like to see the full audit?")

**Tone:**
- Confident and authoritative
- Professional and value-driven
- Specific and data-backed
- Premium and sophisticated

**Output Format (JSON):**
{
  "subject": "A short, professional subject line (5-8 words)",
  "body": "The email body in plain text (no HTML)",
  "recipientName": "Inferred name from company or null if unknown"
}

Generate the email now.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a premium business outreach specialist. You write compelling, high-converting emails that lead with value and professional insight.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "outreach_email",
        strict: true,
        schema: {
          type: "object",
          properties: {
            subject: {
              type: "string",
              description: "Email subject line (5-8 words)",
            },
            body: {
              type: "string",
              description: "Email body in plain text",
            },
            recipientName: {
              type: ["string", "null"],
              description: "Inferred recipient name or null",
            },
          },
          required: ["subject", "body", "recipientName"],
          additionalProperties: false,
        },
      },
    },
  });

  const message = response.choices[0]?.message;
  if (!message || !message.content) {
    throw new Error("LLM returned empty response");
  }

  const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
  const parsed = JSON.parse(content);

  // Infer recipient email (for now, use a placeholder or website domain)
  // In production, this would come from lead enrichment or manual input
  const recipientEmail = lead.websiteUrl
    ? `contact@${new URL(lead.websiteUrl).hostname}`
    : "contact@example.com";

  return {
    subject: parsed.subject,
    body: parsed.body,
    recipientName: parsed.recipientName,
    recipientEmail,
  };
}
