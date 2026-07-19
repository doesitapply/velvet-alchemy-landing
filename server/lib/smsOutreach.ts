/**
 * SMS Outreach Service (Twilio)
 *
 * Used when email enrichment returns null — the lead has a verified phone
 * number from Google Maps but no confirmed owner email.
 *
 * Environment variables required:
 *   TWILIO_ACCOUNT_SID  — Twilio account SID
 *   TWILIO_AUTH_TOKEN   — Twilio auth token
 *   TWILIO_FROM_NUMBER  — Your Twilio phone number (E.164 format, e.g. +17025551234)
 *   VITE_APP_ID         — Used to build the portal URL
 */

const PORTAL_BASE_URL = process.env.VITE_FRONTEND_FORGE_API_URL
  ? "https://velvetalchemy.manus.space"
  : "https://velvetalchemy.manus.space";

export interface SmsOutreachParams {
  toPhone: string;       // E.164 or 10-digit US number
  companyName: string;
  ownerFirstName?: string;
  prestigeScore: number; // Used to personalize the hook
  leadId: number;        // Used to build the portal link
  auditSummary?: string; // One-line hook from the audit
}

export interface SmsResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Send a personalized SMS outreach message via Twilio.
 * Message is kept under 160 chars to avoid multi-part billing.
 */
export async function sendSmsOutreach(params: SmsOutreachParams): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("[SMS] Twilio credentials not configured — skipping SMS send");
    return { success: false, error: "Twilio credentials not configured" };
  }

  const to = normalizePhone(params.toPhone);
  if (!to) {
    return { success: false, error: `Invalid phone number: ${params.toPhone}` };
  }

  const portalLink = `${PORTAL_BASE_URL}/customer-portal?lead=${params.leadId}`;
  const greeting = params.ownerFirstName ? `Hey ${params.ownerFirstName}` : "Hey";
  const body = buildSmsBody(greeting, params.companyName, params.prestigeScore, portalLink);

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
        signal: AbortSignal.timeout(10_000),
      }
    );

    const data = (await res.json()) as { sid?: string; message?: string; code?: number };

    if (!res.ok) {
      console.error("[SMS] Twilio error:", data);
      return { success: false, error: data.message ?? `HTTP ${res.status}` };
    }

    console.log(`[SMS] Sent to ${to} (SID: ${data.sid})`);
    return { success: true, sid: data.sid };
  } catch (err: any) {
    console.error("[SMS] Send failed:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Build a concise, personalized SMS under 160 characters.
 * Score < 40 = "broken layout" hook. Score 40-60 = "missing leads" hook.
 */
function buildSmsBody(
  greeting: string,
  companyName: string,
  prestigeScore: number,
  portalLink: string
): string {
  const hook =
    prestigeScore < 40
      ? `your site for ${companyName} has a broken mobile layout that's costing you leads`
      : `your site for ${companyName} is losing customers on mobile`;

  // Keep under 160 chars — truncate company name if needed
  const msg = `${greeting}, ${hook}. Free audit: ${portalLink}`;
  return msg.length <= 160 ? msg : msg.slice(0, 157) + "...";
}

/**
 * Normalize phone to E.164 format.
 * Handles 10-digit US numbers and already-formatted E.164.
 */
function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 7) return `+${digits}`; // International
  return null;
}
