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
  const diagnosticId = `REF-${Math.floor(Math.random() * 90000) + 10000}`;

  const prompt = `You are a helpful local "Revenue Guide" at Velvet Alchemy in Reno. Your mission is to help local businesses stop burning money on their websites. 

**TONE GUIDELINES:**
- **Simple & Clear**: No big words. No "fiduciary," no "variance," no "instrumentation."
- **Helpful Local**: You're a Reno guy who noticed something broken and wanted to flag it.
- **Value-First**: Show them exactly where the money is leaking in plain English.
- **The Offer**: You've already built a "Vision" to fix these leaks. You want to show it to them in a 5-minute reveal.

**PLAIN ENGLISH TRANSLATIONS (USE THESE):**
- Missing Meta Pixel = "Your site isn't 'tagging' visitors. This means you can't show ads to people who already visited your site. It's like paying for a billboard that people see once and forget."
- Missing Analytics = "You're flying blind. You have no way to see which ads are actually making you money and which ones are a waste."
- Legacy Trust Signals = "The site looks a bit dusty. When people see an old copyright date or a site that doesn't work well on a phone, they move on to the next guy."

**THE PROFIT MATH (KEEP IT SIMPLE):**
Instead of projected reconciliation, use: "Every 1,000 visitors who leave without being 'tagged' is basically throwing $1,000 of your ad budget in the trash."

**Target Business:**
- Company: ${lead.companyName}
- Website: ${lead.websiteUrl}

**Technographic Signal Analysis:**
${JSON.stringify(technographicData, null, 2)}

**Outreach Construction:**
1. **Subject**: Quick question about ${lead.companyName} (Reno local)
2. **Body**: 
   - "Hey, I was looking at your site and noticed a couple of 'money leaks' I wanted to flag."
   - Explain the leaks in the Plain English style above.
   - "I've actually already mapped out a way to fix this for you."
   - "If you have 5 minutes this week, I'd love to show you what I've built. No strings, just wanted to show a fellow Reno business how to stop the bleeding."
   - Signature: Cameron C. | Velvet Alchemy
`;

  const response = await invokeAI({
    messages: [
      {
        role: "system",
        content: "You are a helpful Reno local who fixes websites. You hate jargon. You speak like a real person having a cup of coffee at Hub or Old Bridge. You're direct, friendly, and very clear about how they are losing money.",
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

  // Final Hardening of HTML - Force Bureaucratic Monospace
  const hardenedHtml = `
    <div style="font-family: 'Courier New', Courier, monospace; color: #000; padding: 40px; line-height: 1.5; max-width: 650px; background-color: #ffffff;">
      <div style="border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 30px;">
        <span style="font-weight: bold; font-size: 14px; letter-spacing: 1px;">INTERNAL USE ONLY // REVENUE YIELD DIAGNOSTIC</span><br>
        <span style="font-size: 11px; color: #666;">LOG_DATE: ${new Date().toLocaleDateString()} | LOC_REF: RENO_NV</span>
      </div>
      
      <div style="margin-bottom: 40px; white-space: pre-wrap;">
        ${parsed.htmlBody}
      </div>

      <div style="margin-top: 60px; border-top: 1px solid #000; padding-top: 20px;">
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 10px;">SIGNATURE SECURELY LOGGED:</div>
        <div style="font-size: 13px;">
          Internal Use Only<br>
          Revenue Yield Diagnostics<br>
          Velvet Alchemy
        </div>
        <div style="margin-top: 20px; font-size: 10px; color: #999; letter-spacing: 0.5px;">
          ID_TAG: ${diagnosticId}<br>
          ENTITY: ${lead.companyName.toUpperCase()}<br>
          STATUS: UNRECONCILED
        </div>
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
