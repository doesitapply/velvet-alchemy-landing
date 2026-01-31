
import { google } from "googleapis";
import { ENV } from "./_core/env";

/**
 * Direct Gmail API Client (Manus-free)
 */

export interface GmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  contentId?: string;
}

export interface GmailMessage {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  cc?: string;
  bcc?: string;
  attachments?: GmailAttachment[];
}

export interface SentMessage {
  messageId: string;
  threadId: string;
}

function getOAuth2Client() {
  const { googleClientId, googleClientSecret } = ENV as any;
  // Fallback to what we have in ENV or direct process.env
  const clientId = googleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail API credentials missing. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

/**
 * Send an email via direct Gmail API
 */
export async function sendGmailMessage(message: GmailMessage): Promise<SentMessage> {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });

  const mainBoundary = "-------" + Math.random().toString(16).slice(2);
  const altBoundary = "-------" + Math.random().toString(16).slice(2);
  const utf8Subject = `=?utf-8?B?${Buffer.from(message.subject).toString("base64")}?=`;

  let raw = "";
  raw += `To: ${message.to}\r\n`;
  if (message.cc) raw += `Cc: ${message.cc}\r\n`;
  if (message.bcc) raw += `Bcc: ${message.bcc}\r\n`;
  raw += `Subject: ${utf8Subject}\r\n`;
  raw += `MIME-Version: 1.0\r\n`;
  raw += `Content-Type: multipart/mixed; boundary="${mainBoundary}"\r\n`;
  raw += `\r\n`;

  // Body container (Multipart Alternative)
  raw += `--${mainBoundary}\r\n`;
  raw += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n`;
  raw += `\r\n`;

  // Plain Text
  raw += `--${altBoundary}\r\n`;
  raw += `Content-Type: text/plain; charset=utf-8\r\n`;
  raw += `Content-Transfer-Encoding: 7bit\r\n`;
  raw += `\r\n`;
  raw += `${message.body}\r\n`;
  raw += `\r\n`;

  // HTML
  raw += `--${altBoundary}\r\n`;
  raw += `Content-Type: text/html; charset=utf-8\r\n`;
  raw += `Content-Transfer-Encoding: 7bit\r\n`;
  raw += `\r\n`;
  raw += `${message.htmlBody || `<html><body>${message.body.replace(/\n/g, '<br>')}</body></html>`}\r\n`;
  raw += `\r\n`;
  raw += `--${altBoundary}--\r\n`;

  // Attachments
  if (message.attachments && message.attachments.length > 0) {
    for (const attachment of message.attachments) {
      const b64Content = typeof attachment.content === 'string'
        ? Buffer.from(attachment.content).toString('base64')
        : (attachment.content as Buffer).toString('base64');

      raw += `--${mainBoundary}\r\n`;
      raw += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
      raw += `Content-Description: ${attachment.filename}\r\n`;
      raw += `Content-Disposition: ${attachment.contentId ? 'inline' : 'attachment'}; filename="${attachment.filename}"\r\n`;
      if (attachment.contentId) {
        raw += `Content-ID: <${attachment.contentId}>\r\n`;
        raw += `X-Attachment-Id: ${attachment.contentId}\r\n`;
      }
      raw += `Content-Transfer-Encoding: base64\r\n`;
      raw += `\r\n`;
      raw += `${b64Content}\r\n`;
      raw += `\r\n`;
    }
  }

  raw += `--${mainBoundary}--\r\n`;

  const encodedMessage = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`[Gmail API] Email sent to ${message.to}, ID: ${res.data.id}`);

    return {
      messageId: res.data.id || "unknown",
      threadId: res.data.threadId || "unknown",
    };
  } catch (error) {
    console.error("[Gmail API] Failed to send email:", error);
    throw error;
  }
}

/**
 * Get sent emails
 */
export async function getSentEmails(maxResults: number = 20): Promise<Array<{
  id: string;
  subject: string;
  body: string;
  to: string;
  date: string;
}>> {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });

  try {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "in:sent",
      maxResults,
    });

    const messages = listRes.data.messages || [];
    const results = [];

    for (const msg of messages) {
      const details = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
      });

      const headers = details.data.payload?.headers || [];
      const subject = headers.find(h => h.name === "Subject")?.value || "";
      const to = headers.find(h => h.name === "To")?.value || "";
      const date = headers.find(h => h.name === "Date")?.value || "";

      // Basic snippet for body
      const body = details.data.snippet || "";

      results.push({
        id: msg.id!,
        subject,
        body,
        to,
        date,
      });
    }

    return results;
  } catch (error) {
    console.error("[Gmail API] Failed to fetch sent emails:", error);
    throw error;
  }
}

/**
 * Check for replies to a specific thread
 */
export async function checkForReplies(threadId: string): Promise<Array<{
  id: string;
  from: string;
  subject: string;
  body: string;
  date: string;
}>> {
  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });

  try {
    const res = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
    });

    const messages = res.data.messages || [];
    // We want messages after the first one (which is our outreach)
    // and specifically from the lead
    return messages.map((msg: any) => {
      const headers = msg.payload?.headers || [];
      return {
        id: msg.id || "unknown",
        from: headers.find((h: any) => h.name === "From")?.value || "",
        subject: headers.find((h: any) => h.name === "Subject")?.value || "",
        body: msg.snippet || "",
        date: headers.find((h: any) => h.name === "Date")?.value || "",
      };
    });
  } catch (error) {
    console.error("[Gmail API] Failed to check for replies:", error);
    return [];
  }
}

export async function listGmailTools(): Promise<string[]> {
  return ["send_email", "search_messages", "get_thread"];
}
