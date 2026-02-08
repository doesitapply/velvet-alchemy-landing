import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { emailThreads, emailMessages, intentClassifications, autoResponses, scheduledFollowUps, followUpSequences, leads } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Conversations Router
 * View and manage email conversations
 */

export const conversationsRouter = router({
  /**
   * Get all email threads
   */
  getThreads: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "closed_won", "closed_lost", "paused"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let query = db
        .select({
          thread: emailThreads,
          lead: leads,
        })
        .from(emailThreads)
        .leftJoin(leads, eq(emailThreads.leadId, leads.id))
        .orderBy(desc(emailThreads.lastMessageAt))
        .limit(input.limit);

      if (input.status) {
        query = query.where(eq(emailThreads.status, input.status)) as any;
      }

      const results = await query;
      return results.map(r => ({
        ...r.thread,
        lead: r.lead,
      }));
    }),

  /**
   * Get full conversation thread
   */
  getThread: protectedProcedure
    .input(z.object({
      threadId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Get thread
      const threadResult = await db
        .select({
          thread: emailThreads,
          lead: leads,
        })
        .from(emailThreads)
        .leftJoin(leads, eq(emailThreads.leadId, leads.id))
        .where(eq(emailThreads.id, input.threadId))
        .limit(1);

      if (threadResult.length === 0) return null;

      // Get all messages
      const messages = await db
        .select({
          message: emailMessages,
          intent: intentClassifications,
        })
        .from(emailMessages)
        .leftJoin(intentClassifications, eq(emailMessages.id, intentClassifications.messageId))
        .where(eq(emailMessages.threadId, input.threadId))
        .orderBy(emailMessages.sentAt);

      // Get pending auto-responses
      const pendingResponses = await db
        .select()
        .from(autoResponses)
        .where(eq(autoResponses.threadId, input.threadId))
        .orderBy(desc(autoResponses.createdAt));

      // Get scheduled follow-ups
      const followUps = await db
        .select({
          followUp: scheduledFollowUps,
          sequence: followUpSequences,
        })
        .from(scheduledFollowUps)
        .leftJoin(followUpSequences, eq(scheduledFollowUps.sequenceId, followUpSequences.id))
        .where(eq(scheduledFollowUps.threadId, input.threadId))
        .orderBy(scheduledFollowUps.scheduledFor);

      return {
        thread: threadResult[0].thread,
        lead: threadResult[0].lead,
        messages: messages.map(m => ({
          ...m.message,
          intent: m.intent,
        })),
        pendingResponses,
        followUps: followUps.map(f => ({
          ...f.followUp,
          sequence: f.sequence,
        })),
      };
    }),

  /**
   * Update thread status
   */
  updateThreadStatus: protectedProcedure
    .input(z.object({
      threadId: z.number(),
      status: z.enum(["active", "closed_won", "closed_lost", "paused"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      await db.update(emailThreads).set({
        status: input.status,
      }).where(eq(emailThreads.id, input.threadId));

      return { success: true };
    }),

  /**
   * Get recent autonomous actions (for activity feed)
   */
  getRecentActions: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Get recent auto-responses
      const responses = await db
        .select({
          response: autoResponses,
          thread: emailThreads,
          lead: leads,
        })
        .from(autoResponses)
        .leftJoin(emailThreads, eq(autoResponses.threadId, emailThreads.id))
        .leftJoin(leads, eq(emailThreads.leadId, leads.id))
        .orderBy(desc(autoResponses.createdAt))
        .limit(input.limit);

      // Get recent follow-ups
      const followUps = await db
        .select({
          followUp: scheduledFollowUps,
          sequence: followUpSequences,
          thread: emailThreads,
          lead: leads,
        })
        .from(scheduledFollowUps)
        .leftJoin(followUpSequences, eq(scheduledFollowUps.sequenceId, followUpSequences.id))
        .leftJoin(emailThreads, eq(scheduledFollowUps.threadId, emailThreads.id))
        .leftJoin(leads, eq(emailThreads.leadId, leads.id))
        .where(eq(scheduledFollowUps.status, "sent"))
        .orderBy(desc(scheduledFollowUps.sentAt))
        .limit(input.limit);

      // Combine and sort by timestamp
      const actions = [
        ...responses.map(r => ({
          type: "auto_response" as const,
          timestamp: r.response.createdAt,
          leadName: r.lead?.companyName || "Unknown",
          status: r.response.status,
          subject: r.response.subject,
        })),
        ...followUps.map(f => ({
          type: "follow_up" as const,
          timestamp: f.followUp.sentAt || f.followUp.scheduledFor,
          leadName: f.lead?.companyName || "Unknown",
          sequenceName: f.sequence?.name || "Unknown",
        })),
      ];

      actions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return actions.slice(0, input.limit);
    }),

  /**
   * Get stats for dashboard
   */
  getStats: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return null;

      // Count active threads
      const activeThreads = await db.select().from(emailThreads).where(eq(emailThreads.status, "active"));

      // Count pending responses
      const pendingResponses = await db.select().from(autoResponses).where(eq(autoResponses.status, "pending_approval"));

      // Count scheduled follow-ups
      const scheduledFollowUps = await db.select().from(scheduledFollowUps).where(eq(scheduledFollowUps.status, "pending"));

      // Count intents (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentIntents = await db.select().from(intentClassifications);

      const intentCounts = {
        interested: recentIntents.filter(i => i.intent === "interested").length,
        objection: recentIntents.filter(i => i.intent === "objection").length,
        not_now: recentIntents.filter(i => i.intent === "not_now").length,
        spam: recentIntents.filter(i => i.intent === "spam").length,
        unsubscribe: recentIntents.filter(i => i.intent === "unsubscribe").length,
      };

      return {
        activeThreads: activeThreads.length,
        pendingResponses: pendingResponses.length,
        scheduledFollowUps: scheduledFollowUps.length,
        intentCounts,
      };
    }),
});
