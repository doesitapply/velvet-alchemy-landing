import {
  EXTERNAL_ACTION_BLOCKED_CODE,
  assertSafeExternalCopy,
  externalActionBlock,
} from "./externalActionPolicy";

/**
 * Build a review-only email from observed audit details.
 *
 * The generator deliberately excludes estimated revenue loss. A visual or
 * technical audit can identify possible friction; it cannot establish that a
 * business lost customers or money.
 */
export function generateOutreachEmail(lead: {
  companyName: string;
  websiteUrl: string;
  prestigeScore: number;
  detailedReport: any;
  contactEmail?: string;
}): {
  subject: string;
  body: string;
  recipientEmail: string;
} {
  const recipientEmail = String(lead.contactEmail || "").trim();
  if (!recipientEmail) {
    throw new Error(
      "A verified public business email is required before preparing outreach."
    );
  }

  const technicalIssues = Array.isArray(
    lead.detailedReport?.technical_audit?.issues
  )
    ? lead.detailedReport.technical_audit.issues
        .filter(
          (issue: unknown): issue is string =>
            typeof issue === "string" && issue.trim().length > 0
        )
        .slice(0, 2)
    : [];

  const observation = technicalIssues[0]
    ? technicalIssues[0]
    : "a possible mobile booking issue";
  const subject = `A possible booking issue for ${lead.companyName}`;
  const body = `Hi ${lead.companyName} team,

I reviewed the publicly visible booking path on ${lead.websiteUrl} and noticed ${observation}. It may be creating friction for people trying to contact the business from a phone.

This is an observation from a limited website review, not a measurement of lost customers or revenue. I can share the exact screen and the small set of checks behind it.

Would a short review-only walkthrough be useful, or should I leave this off your plate?

Best,
Velvet Alchemy`;

  assertSafeExternalCopy(subject, body);
  return { subject, body, recipientEmail };
}

/**
 * External delivery remains disabled until a durable, single-use approval
 * ledger is implemented and verified with a fake target.
 */
export async function sendEmailViaGmail(_params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{
  success: false;
  code: typeof EXTERNAL_ACTION_BLOCKED_CODE;
  error: string;
}> {
  const block = externalActionBlock("email_send");
  return {
    success: false,
    code: block.code,
    error: block.message,
  };
}

export async function checkDailySendLimit(_userId: number): Promise<{
  canSend: false;
  sent: number;
  limit: number;
}> {
  return {
    canSend: false,
    sent: 0,
    limit: 0,
  };
}
