import { invokeAI } from "./aiProvider";
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
  const prompt = `You are "The Charmer," an elite copywriter for a luxury digital transformation agency. Your job is to write a personalized, seductive outreach email to a high-net-worth business owner.

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
1. Opens with a compliment about their strengths (if any)
2. Subtly identifies 1-2 specific visual debt issues without being insulting
3. Teases the generated assets as a "gift" or "vision" of their upgraded brand
4. Creates urgency and curiosity without being salesy
5. Ends with a soft CTA (e.g., "Would you like to see the full transformation?")

**Tone:**
- Confident, not arrogant
- Seductive, not desperate
- Specific, not generic
- Luxury, not cheap

**Output Format (JSON):**
{
  "subject": "A short, intriguing subject line (5-8 words)",
  "body": "The email body in plain text (no HTML)",
  "recipientName": "Inferred name from company (e.g., 'John' from 'John's Pools') or null if unknown"
}

Generate the email now.`;

  const response = await invokeAI({
    messages: [
      {
        role: "system",
        content:
          "You are The Charmer, an elite copywriter specializing in luxury outreach. You write seductive, high-converting emails that make business owners feel seen and valued.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    responseFormat: "json_schema",
    schema: {
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
  });

  if (!response.content) {
    throw new Error("LLM returned empty response");
  }

  const parsed = JSON.parse(response.content);

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
