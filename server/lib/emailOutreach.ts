

/**
 * Email Template Generator
 * Creates personalized outreach emails with audit findings
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
  const report = lead.detailedReport;
  const revenueLoss = report.revenue_impact;

  const subject = `${lead.companyName} - Your website may be costing you $${(revenueLoss.annual_loss / 1000).toFixed(0)}k/year`;

  const body = `Hi ${lead.companyName} team,

I ran a quick analysis on ${lead.websiteUrl} and found some concerning issues that could be costing you significant revenue.

**Current Website Score: ${lead.prestigeScore}/100**

Here's what I found:

**Revenue Impact:**
${revenueLoss.explanation}

**Estimated Annual Loss: $${revenueLoss.annual_loss.toLocaleString()}**
**Monthly Loss: $${revenueLoss.monthly_loss.toLocaleString()}**

**Technical Issues:**
${report.technical_audit.issues.map((issue: string) => `• ${issue}`).join('\n')}

**Conversion Leaks:**
${report.conversion_leaks.slice(0, 3).map((leak: string) => `• ${leak}`).join('\n')}

**The Good News:**
These issues are fixable. A modern website redesign could recover this lost revenue and position you ahead of competitors.

I specialize in helping local businesses like yours turn their websites into revenue-generating machines. Would you be open to a 15-minute call to discuss how we can fix these issues?

Best regards,
Velvet Alchemy
Revenue Instrument for Local Businesses

P.S. I've attached a detailed audit report showing exactly where your website is losing customers.`;

  return {
    subject,
    body,
    recipientEmail: lead.contactEmail || `info@${new URL(lead.websiteUrl).hostname}`,
  };
}

import { sendGmailMessage, type GmailAttachment } from "../gmailClient";

/**
 * Send Email via Direct Gmail API
 */
export async function sendEmailViaGmail(params: {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: GmailAttachment[];
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log(`[EmailOutreach] Sending email to ${params.to}`);

    const result = await sendGmailMessage({
      to: params.to,
      subject: params.subject,
      body: params.body,
      htmlBody: params.htmlBody,
      attachments: params.attachments,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error('[EmailOutreach] Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Track Email Status
 * Records email send attempts and responses
 */
export interface EmailLog {
  leadId: number;
  recipientEmail: string;
  subject: string;
  sentAt: Date;
  status: 'sent' | 'failed' | 'bounced' | 'replied';
  messageId?: string;
  errorMessage?: string;
}

/**
 * Check Daily Send Limit
 * Prevents spam by limiting emails per day
 */
export async function checkDailySendLimit(userId: number): Promise<{
  canSend: boolean;
  sent: number;
  limit: number;
}> {
  // In production, query database for emails sent today
  // For now, return placeholder
  const DAILY_LIMIT = 20;
  const sentToday = 0; // TODO: Query from email_logs table

  return {
    canSend: sentToday < DAILY_LIMIT,
    sent: sentToday,
    limit: DAILY_LIMIT,
  };
}
