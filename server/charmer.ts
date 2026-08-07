import { invokeLLM } from "./_core/llm";
import type { Lead, Audit, Asset } from "../drizzle/schema";
import { assertSafeExternalCopy } from "./lib/externalActionPolicy";

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
    Object.entries(visualDebt.categories).forEach(
      ([category, issues]: [string, any]) => {
        if (Array.isArray(issues) && issues.length > 0) {
          // Take top 2 issues from each category
          issues.slice(0, 2).forEach((issue: any) => {
            if (issue.description) {
              keyIssues.push(`${category}: ${issue.description}`);
            }
          });
        }
      }
    );
  }

  // Extract strengths
  const strengths: string[] = [];
  if (visualDebt?.strengths && Array.isArray(visualDebt.strengths)) {
    strengths.push(...visualDebt.strengths.slice(0, 2));
  }

  // Build asset URLs for email
  const assetUrls = assets.map(asset => ({
    type: asset.type,
    url: asset.url,
  }));

  // Generate outreach copy using LLM
  const prompt = `Write a concise, factual outreach draft for a local business owner.

**Target Lead:**
- Company: ${lead.companyName}
- Website: ${lead.websiteUrl}
- Prestige Score: ${audit?.prestigeScore || "N/A"}/100

**Visual Audit Findings:**
${keyIssues.length > 0 ? `Key Issues:\n${keyIssues.map(issue => `- ${issue}`).join("\n")}` : "No specific issues identified."}

${strengths.length > 0 ? `\nStrengths:\n${strengths.map(s => `- ${s}`).join("\n")}` : ""}

**Generated Assets:**
${assetUrls.length > 0 ? assetUrls.map(a => `- ${a.type}: ${a.url}`).join("\n") : "No assets generated yet."}

**Your Task:**
Write a short outreach email (100-150 words) that:
1. Opens with a compliment about their strengths (if any)
2. Describes at most one observed issue as a possible source of friction
3. Clearly says the review does not prove lost customers or revenue
4. Avoids urgency, accusation, and invented facts
5. Ends with a low-pressure review-only CTA

**Tone:**
- Direct and respectful
- Specific and evidence-bound
- Plain language
- No unsupported revenue or conversion claims

**Output Format (JSON):**
{
  "subject": "A short, intriguing subject line (5-8 words)",
  "body": "The email body in plain text (no HTML)",
  "recipientName": "Inferred name from company (e.g., 'John' from 'John's Pools') or null if unknown"
}

Generate the email now.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "Write evidence-bound business outreach. Never claim an audit proves lost customers, jobs, leads, money, revenue, or conversion impact.",
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

  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);
  const parsed = JSON.parse(content);

  const recipientEmail = String((lead as any).verifiedOwnerEmail || "").trim();
  if (!recipientEmail) {
    throw new Error(
      "A verified public business email is required before preparing outreach."
    );
  }

  assertSafeExternalCopy(parsed.subject, parsed.body);

  return {
    subject: parsed.subject,
    body: parsed.body,
    recipientName: parsed.recipientName,
    recipientEmail,
  };
}
