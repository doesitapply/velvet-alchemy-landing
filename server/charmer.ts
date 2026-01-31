import { invokeAI } from "./aiProvider";
import type { Lead, Audit, Asset } from "../drizzle/schema";

export interface OutreachCopyResult {
  subject: string;
  body: string;
  htmlBody: string; // New field for rich email
  recipientName: string | null;
  recipientEmail: string;
}

/**
 * Generate personalized outreach email copy based on lead audit and assets
 */
export async function generateOutreachCopy(
  lead: Lead,
  audit: Audit | null,
  assets: Asset[],
  technographicData?: any,
  currentScreenshotUrl?: string // Optional current site image
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
        issues.slice(0, 2).forEach((issue: any) => {
          if (issue.description) {
            keyIssues.push(`${category}: ${issue.description}`);
          }
        });
      }
    });
  }

  const prompt = `You are the lead "Strategic Yield Lead" at Velvet Alchemy. Your mission is to protect high-ticket businesses from "Revenue Leaks"—silent technical failures that burn advertising dollars. Your tone is authoritative, diagnostic, and 100% ROI-focused.

**PERSONA GUIDELINES:**
- **Tone**: Senior-level strategic advisor. You don't "design websites"; you "fix capital inefficiency."
- **The Hook**: "Revenue Leak Detected." You've identified a specific gap in their marketing stack that is costing them money.
- **Reno Local**: Mention you are localized to Reno.
- **The Diagnostic**: Focus on technographic "Risk Signals":
   ${technographicData?.signals?.meta_pixel === false ? "- MISSING META PIXEL: You are losing 100% of your retargeting data on every click." : ""}
   ${technographicData?.signals?.ga4 === false ? "- ANALYTICS FAILURE: You have no visibility on where your leads are coming from." : ""}
   ${technographicData?.pain_points?.neglected_site ? "- TRUST FRICTION: Your site copyright is outdated, signaling neglect to high-prestige clients." : ""}
- **Signature**: Cameron C. | Senior Yield Strategist

**Target Lead:**
- Company: ${lead.companyName}
- Website: ${lead.websiteUrl}

**Technographic Signal Analysis:**
${JSON.stringify(technographicData, null, 2)}

**Your Task:**
Write a brief, high-stakes email. 
- Subject line must be a "Diagnostic Alert" or "Revenue Gap identified".
- Frame the email as a "Yield Audit" you've already completed.
- Don't ask for a "meeting"—ask to "share the unblocked vision."
- Signature: Cameron C. | Senior Yield Strategist

**Output Format (JSON):**
{
  "subject": "Diagnostic Alert",
  "subject": "[ID] Clinical Subject",
  "body": "Plain text record of findings.",
  "htmlBody": "Monospace-heavy, minimal HTML. It should look like an internal audit memo. No colors except #000 and #666. Use <pre> tags or monospace fonts.",
  "recipientName": "Name or null"
}
`;

  const response = await invokeAI({
    messages: [
      {
        role: "system",
        content: "You are a Senior Yield Strategist. You write clinical, courtroom-ready disclosures of technical revenue failure. You are localized to Reno, NV.",
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
          subject: { type: "string" },
          body: { type: "string" },
          htmlBody: { type: "string" },
          recipientName: { type: ["string", "null"] },
        },
        required: ["subject", "body", "htmlBody", "recipientName"],
        additionalProperties: false,
      },
    },
  });

  if (!response.content) {
    throw new Error("LLM returned empty response");
  }

  const parsed = JSON.parse(response.content);

  // Use the lead's contact email if we found one
  let recipientEmail = lead.contactEmail;

  if (!recipientEmail && lead.websiteUrl) {
    try {
      recipientEmail = `contact@${new URL(lead.websiteUrl).hostname}`;
    } catch {
      recipientEmail = "contact@example.com";
    }
  }

  // Final Hardening of HTML - Force Monospace / Audit Record Style
  const hardenedHtml = `
    <div style="font-family: 'Courier New', Courier, monospace; color: #000; padding: 40px; line-height: 1.4; max-width: 650px;">
      <div style="border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
        <span style="font-weight: bold; font-size: 18px;">VELVET ALCHEMY // INTERNAL YIELD DIAGNOSTIC</span><br>
        <span style="font-size: 12px; color: #666;">LOCALIZED RENO SCAN: ${new Date().toLocaleDateString()}</span>
      </div>
      
      <div style="margin-bottom: 30px;">
        ${parsed.htmlBody}
      </div>

      <div style="margin-top: 50px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 11px; color: #666;">
        REFERENCE ID: ${diagnosticId}<br>
        ENTITY: ${lead.companyName}<br>
        STATUS: UNRECONCILED VARIANCE
      </div>
    </div>
  `;

  return {
    subject: parsed.subject,
    body: parsed.body,
    htmlBody: hardenedHtml,
    recipientName: parsed.recipientName,
    recipientEmail: recipientEmail || "contact@example.com",
  };
}

/**
 * Generate a seductive, luxury reply to an incoming lead email
 */
export async function generateReply(
  lead: Lead,
  originalEmail: { subject: string; body: string },
  incomingReply: { from: string; subject: string; body: string }
): Promise<{ subject: string; body: string }> {
  const prompt = `You are "The Charmer," an elite copywriter for a luxury digital transformation agency. 
A lead has responded to our initial outreach. Your task is to write a follow-up reply that keeps the conversation seductive, high-value, and moves them toward a meeting.

**Context:**
- Company: ${lead.companyName}
- Original Email Subject: ${originalEmail.subject}
- Original Email Body: ${originalEmail.body}

**Incoming Reply from Lead:**
- From: ${incomingReply.from}
- Subject: ${incomingReply.subject}
- Body: ${incomingReply.body}

**Your Task:**
1. Acknowledge their point immediately (whether they are curious or skeptical)
2. Maintain the high-prestige, luxury tone. Do not apologize for anything.
3. Provide one "micro-insight" based on their response.
4. Close with a specific, low-friction invitation (e.g., "I've carved out 10 minutes on Tuesday or Wednesday for a quick reveal. Which works for your schedule?")

**Tone:**
- Confident, effortless, and slightly mysterious.
- Focused on the "transformation," not the technical details.

**Format (JSON):**
{
  "subject": "A compelling reply subject (usually 'Re: ' + incoming subject)",
  "body": "The reply body in plain text"
}
`;

  const response = await invokeAI({
    messages: [
      {
        role: "system",
        content: "You are The Charmer. You specialize in converting curious leads into high-ticket clients with effortless, seductive copy.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    responseFormat: "json_schema",
    schema: {
      name: "reply_email",
      strict: true,
      schema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["subject", "body"],
        additionalProperties: false,
      },
    },
  });

  if (!response.content) {
    throw new Error("LLM returned empty response");
  }

  return JSON.parse(response.content);
}
