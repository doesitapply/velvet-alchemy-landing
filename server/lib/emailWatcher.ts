
import { getDb } from "../db";
import { leads, emailQueue } from "../../drizzle/schema";
import { eq, and, ne } from "drizzle-orm";
import { checkForReplies } from "../gmailClient";

/**
 * Email Watcher Service
 * Periodically checks for replies to outreach emails
 */

export async function watchForReplies() {
    console.log("[EmailWatcher] Checking for new replies...");

    const db = await getDb();
    if (!db) return;

    // 1. Find all leads that have been contacted but haven't replied yet
    const contactedLeads = await db.select()
        .from(leads)
        .where(eq(leads.status, "contacted"));

    for (const lead of contactedLeads) {
        // 2. Find the last sent email for this lead to get the thread ID
        const sentEmails = await db.select()
            .from(emailQueue)
            .where(
                and(
                    eq(emailQueue.leadId, lead.id),
                    eq(emailQueue.status, "sent")
                )
            )
            .orderBy(emailQueue.sentAt);

        if (sentEmails.length === 0) continue;

        const lastEmail = sentEmails[sentEmails.length - 1];
        if (!lastEmail.gmailThreadId) continue;

        try {
            // 3. Check Gmail for replies in this thread
            const threadMessages = await checkForReplies(lastEmail.gmailThreadId);

            // 4. Identify if there are new messages NOT from us
            // Assuming lead.recipientEmail is the target. We check if any message 'from' matches recipient.
            const replies = threadMessages.filter(msg =>
                msg.from.toLowerCase().includes(lead.companyName.toLowerCase()) ||
                (lead.detailedReport && JSON.parse(lead.detailedReport).contactEmail && msg.from.includes(JSON.parse(lead.detailedReport).contactEmail))
            );

            // Find replies that we haven't processed yet
            // Check if any message ID in the thread is already in our emailQueue
            const knownMessageIds = new Set(sentEmails.map((e: any) => e.gmailMessageId));
            const newReplies = replies.filter(r => !knownMessageIds.has(r.id));

            if (newReplies.length > 0) {
                console.log(`[EmailWatcher] Found ${newReplies.length} new replies for lead: ${lead.companyName}`);

                for (const reply of newReplies) {
                    // Update lead status
                    await db.update(leads)
                        .set({ status: "replied" })
                        .where(eq(leads.id, lead.id));

                    // Log the reply in the queue
                    await db.insert(emailQueue).values({
                        leadId: lead.id,
                        recipientEmail: reply.from,
                        recipientName: lead.companyName,
                        subject: reply.subject,
                        body: reply.body,
                        status: "sent", // Mark as 'sent' but it's an incoming one
                        gmailMessageId: reply.id,
                        gmailThreadId: lastEmail.gmailThreadId,
                        sentAt: new Date(reply.date),
                    });

                    console.log(`[EmailWatcher] Logged reply from ${reply.from}`);
                }
            }
        } catch (error: any) {
            console.error(`[EmailWatcher] Failed to check for replies for lead ${lead.id}:`, error.message);

            // Auto-shutdown on Auth failures to prevent log spam
            const errStr = JSON.stringify(error).toLowerCase();
            if (errStr.includes("invalid_grant") || errStr.includes("unauthorized") || errStr.includes("401") || errStr.includes("403")) {
                console.error("[EmailWatcher] 🛑 Critical Auth Error detected. Stopping watcher service.");
                stopEmailWatcher();
                return; // Exit loop
            }
        }
    }
}

let watchInterval: NodeJS.Timeout | null = null;

export function startEmailWatcher(intervalMs: number = 1000 * 60 * 15) { // Default 15 mins
    if (watchInterval) return;

    console.log(`[EmailWatcher] Starting watcher service (interval: ${intervalMs}ms)`);

    // Run immediately on start
    watchForReplies().catch(console.error);

    watchInterval = setInterval(() => {
        watchForReplies().catch(console.error);
    }, intervalMs);
}

export function stopEmailWatcher() {
    if (watchInterval) {
        clearInterval(watchInterval);
        watchInterval = null;
        console.log("[EmailWatcher] Watcher service stopped");
    }
}
