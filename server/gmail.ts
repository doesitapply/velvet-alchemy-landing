
import { sendGmailMessage } from "./gmailClient";

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email (Wrapper for gmailClient to maintain compatibility)
 */
export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  try {
    const result = await sendGmailMessage({
      to: options.to,
      subject: options.subject,
      body: options.body,
    });
    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listGmailTools(): Promise<string[]> {
  return ["send_email"];
}
