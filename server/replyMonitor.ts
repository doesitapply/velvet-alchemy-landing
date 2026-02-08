import { getDb } from "./db";
import { emailThreads, emailMessages, emailQueue } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { checkForReplies } from "./gmailClient";

/**
 * Reply Monitor Service
 * Polls Gmail for replies to sent outreach emails
 */

export interface ReplyDetected {
  threadId: number;
  messageId: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

/**
 * Monitor all active email threads for new replies
 * Called by cron job every 5 minutes
 */
export async function monitorReplies(): Promise<ReplyDetected[]> {
  const db = await getDb();
  if (!db) {
    console.error("[Reply Monitor] Database not available");
    return [];
  }

  console.log("[Reply Monitor] Starting reply check...");

  // Get all active threads
  const activeThreads = await db
    .select()
    .from(emailThreads)
    .where(eq(emailThreads.status, "active"));

  console.log(`[Reply Monitor] Found ${activeThreads.length} active threads`);

  const newReplies: ReplyDetected[] = [];

  for (const thread of activeThreads) {
    if (!thread.gmailThreadId) {
      console.log(`[Reply Monitor] Thread ${thread.id} has no Gmail thread ID, skipping`);
      continue;
    }

    try {
      // Get all messages in thread from Gmail
      const messages = await checkForReplies(thread.gmailThreadId);
      
      if (messages.length === 0) {
        console.log(`[Reply Monitor] No messages found for thread ${thread.id}`);
        continue;
      }

      // Find messages we haven't seen yet (from them, not us)
      const lastMessageTime = thread.lastMessageAt || new Date(0);
      const newMessages = messages.filter((msg: any) => {
        const msgDate = new Date(msg.date);
        return msgDate > lastMessageTime && !isOurEmail(msg.from);
      });

      if (newMessages.length === 0) {
        continue;
      }

      console.log(`[Reply Monitor] Found ${newMessages.length} new replies in thread ${thread.id}`);

      // Process each new message
      for (const msg of newMessages) {
        const receivedAt = new Date(msg.date);

        // Insert into email_messages
        await db.insert(emailMessages).values({
          threadId: thread.id,
          gmailMessageId: msg.id,
          sender: "them",
          subject: msg.subject,
          bodyText: msg.body,
          bodyHtml: msg.body,
          sentAt: receivedAt,
        });

        // Update thread
        await db.update(emailThreads).set({
          lastMessageAt: receivedAt,
          lastSender: "them",
        }).where(eq(emailThreads.id, thread.id));

        newReplies.push({
          threadId: thread.id,
          messageId: msg.id,
          from: msg.from,
          subject: msg.subject,
          body: msg.body,
          receivedAt,
        });

        console.log(`[Reply Monitor] Recorded reply from ${msg.from} in thread ${thread.id}`);
      }
    } catch (error: any) {
      console.error(`[Reply Monitor] Error checking thread ${thread.id}:`, error.message);
    }
  }

  console.log(`[Reply Monitor] Completed. Found ${newReplies.length} total new replies`);
  return newReplies;
}

/**
 * Check if an email is from us (not a reply)
 */
function isOurEmail(from: string): boolean {
  // TODO: Get actual user email from database
  const ourEmails = ["cameron", "velvet-alchemy", "@manus"];
  return ourEmails.some(email => from.toLowerCase().includes(email));
}

/**
 * Create email thread when sending initial outreach
 */
export async function createEmailThread(leadId: number, gmailThreadId: string, subject: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(emailThreads).values({
    leadId,
    gmailThreadId,
    subject,
    status: "active",
    lastMessageAt: new Date(),
    lastSender: "us",
  });

  return result[0].insertId;
}

/**
 * Record our sent message in the thread
 */
export async function recordSentMessage(
  threadId: number,
  gmailMessageId: string,
  subject: string,
  body: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(emailMessages).values({
    threadId,
    gmailMessageId,
    sender: "us",
    subject,
    bodyText: body,
    bodyHtml: body,
    sentAt: new Date(),
  });

  await db.update(emailThreads).set({
    lastMessageAt: new Date(),
    lastSender: "us",
  }).where(eq(emailThreads.id, threadId));
}
