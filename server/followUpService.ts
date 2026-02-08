import { getDb } from "./db";
import { scheduledFollowUps, followUpSequences, emailThreads, emailQueue, leads, audits } from "../drizzle/schema";
import { eq, and, lt } from "drizzle-orm";
import { sendGmailMessage } from "./gmailClient";

/**
 * Follow-Up Sequence Service
 * Automatically schedules and sends follow-up emails
 */

/**
 * Schedule all follow-ups for a new thread
 * Called after initial outreach is sent
 */
export async function scheduleFollowUps(threadId: number, initialSentAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Follow-Up] Database not available");
    return;
  }

  // Get all active sequences
  const sequences = await db.select().from(followUpSequences).where(eq(followUpSequences.active, true));

  console.log(`[Follow-Up] Scheduling ${sequences.length} follow-ups for thread ${threadId}`);

  for (const sequence of sequences) {
    const scheduledFor = new Date(initialSentAt);
    scheduledFor.setDate(scheduledFor.getDate() + sequence.dayOffset);

    await db.insert(scheduledFollowUps).values({
      threadId,
      sequenceId: sequence.id,
      scheduledFor,
      status: "pending",
    });

    console.log(`[Follow-Up] Scheduled "${sequence.name}" for ${scheduledFor.toISOString()}`);
  }
}

/**
 * Send all due follow-ups
 * Called by cron job every hour
 */
export async function sendDueFollowUps(): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.error("[Follow-Up] Database not available");
    return 0;
  }

  console.log("[Follow-Up] Checking for due follow-ups...");

  // Get all pending follow-ups that are due
  const dueFollowUps = await db
    .select({
      followUp: scheduledFollowUps,
      sequence: followUpSequences,
      thread: emailThreads,
      lead: leads,
      audit: audits,
    })
    .from(scheduledFollowUps)
    .leftJoin(followUpSequences, eq(scheduledFollowUps.sequenceId, followUpSequences.id))
    .leftJoin(emailThreads, eq(scheduledFollowUps.threadId, emailThreads.id))
    .leftJoin(leads, eq(emailThreads.leadId, leads.id))
    .leftJoin(audits, eq(leads.id, audits.leadId))
    .where(
      and(
        eq(scheduledFollowUps.status, "pending"),
        lt(scheduledFollowUps.scheduledFor, new Date())
      )
    )
    .limit(20); // Send 20 at a time

  console.log(`[Follow-Up] Found ${dueFollowUps.length} due follow-ups`);

  let sentCount = 0;

  for (const row of dueFollowUps) {
    const { followUp, sequence, thread, lead, audit } = row;

    if (!sequence || !thread || !lead) {
      console.error(`[Follow-Up] Missing data for follow-up ${followUp.id}`);
      continue;
    }

    // Check if lead replied (if so, cancel follow-up)
    if (thread.lastSender === "them") {
      console.log(`[Follow-Up] Cancelling follow-up ${followUp.id} - lead replied`);
      await db.update(scheduledFollowUps).set({
        status: "cancelled",
      }).where(eq(scheduledFollowUps.id, followUp.id));
      continue;
    }

    // Check if thread is still active
    if (thread.status !== "active") {
      console.log(`[Follow-Up] Cancelling follow-up ${followUp.id} - thread not active`);
      await db.update(scheduledFollowUps).set({
        status: "cancelled",
      }).where(eq(scheduledFollowUps.id, followUp.id));
      continue;
    }

    try {
      // Render email from template
      const email = renderFollowUpEmail(sequence, lead, audit);

      // Send via Gmail
      const result = await sendGmailMessage({
        to: lead.contactEmail || "placeholder@example.com", // TODO: Get actual email
        subject: email.subject,
        body: email.body,
      });

      // Mark as sent
      await db.update(scheduledFollowUps).set({
        status: "sent",
        sentAt: new Date(),
      }).where(eq(scheduledFollowUps.id, followUp.id));

      // Update thread
      await db.update(emailThreads).set({
        lastMessageAt: new Date(),
        lastSender: "us",
      }).where(eq(emailThreads.id, thread.id));

      console.log(`[Follow-Up] Sent "${sequence.name}" to ${lead.companyName}`);
      sentCount++;
    } catch (error: any) {
      console.error(`[Follow-Up] Failed to send follow-up ${followUp.id}:`, error.message);
      // Don't mark as failed yet, will retry next hour
    }
  }

  console.log(`[Follow-Up] Sent ${sentCount} follow-ups`);
  return sentCount;
}

/**
 * Render follow-up email from template
 */
function renderFollowUpEmail(
  sequence: typeof followUpSequences.$inferSelect,
  lead: typeof leads.$inferSelect,
  audit: typeof audits.$inferSelect | null
): { subject: string; body: string } {
  // Extract variables
  const businessName = lead.companyName;
  const firstName = extractFirstName(lead.contactName || lead.companyName);
  const specificIssue = audit ? extractTopIssue(audit) : "website issues";

  // Render subject
  let subject = sequence.subjectTemplate
    .replace(/\{\{business_name\}\}/g, businessName)
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{specific_issue\}\}/g, specificIssue);

  // Render body
  let body = sequence.bodyTemplate
    .replace(/\{\{business_name\}\}/g, businessName)
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{specific_issue\}\}/g, specificIssue);

  return { subject, body };
}

/**
 * Extract first name from full name or company name
 */
function extractFirstName(name: string): string {
  const parts = name.split(" ");
  return parts[0] || name;
}

/**
 * Extract top issue from audit for personalization
 */
function extractTopIssue(audit: typeof audits.$inferSelect): string {
  try {
    const visualDebt = audit.visualDebtData ? JSON.parse(audit.visualDebtData) : {};
    const topIssue = visualDebt.issues?.[0]?.title;
    return topIssue || "website issues";
  } catch {
    return "website issues";
  }
}

/**
 * Cancel all follow-ups for a thread
 * Called when lead replies or unsubscribes
 */
export async function cancelFollowUps(threadId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(scheduledFollowUps).set({
    status: "cancelled",
  }).where(
    and(
      eq(scheduledFollowUps.threadId, threadId),
      eq(scheduledFollowUps.status, "pending")
    )
  );

  console.log(`[Follow-Up] Cancelled all pending follow-ups for thread ${threadId}`);
}
