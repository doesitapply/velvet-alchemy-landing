import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads, audits, voiceProfiles, emailQueue, followUpSequences } from "../drizzle/schema";
import { eq, and, or, lt, isNull, ne } from "drizzle-orm";
import { analyzeVoice, generateEmailInVoice, refineVoiceProfile, type EmailSample } from "./voiceAnalyzer";
import { TRPCError } from "@trpc/server";
import { sendGmailMessage, getSentEmails } from "./gmailClient";

/**
 * Outreach Router
 * Handles automated email outreach with voice matching and approval workflow
 */

export const outreachRouter = router({
  /**
   * Initialize voice profile by analyzing user's Gmail sent emails
   */
  initializeVoiceProfile: protectedProcedure
    .input(z.object({
      sampleEmails: z.array(z.object({
        subject: z.string(),
        body: z.string(),
        to: z.string(),
        date: z.string(), // ISO date string
      })).min(1).max(20), // Analyze 1-20 emails
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Convert date strings to Date objects
      const emailSamples: EmailSample[] = input.sampleEmails.map(e => ({
        ...e,
        date: new Date(e.date),
      }));

      // Analyze voice
      const voiceProfile = await analyzeVoice(emailSamples);

      // Check if profile already exists
      const existing = await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, ctx.user.id)).limit(1);

      if (existing.length > 0) {
        // Update existing profile
        await db.update(voiceProfiles).set({
          formality: voiceProfile.formality,
          directness: voiceProfile.directness,
          enthusiasm: voiceProfile.enthusiasm,
          avgSentenceLength: voiceProfile.avgSentenceLength,
          avgParagraphLength: voiceProfile.avgParagraphLength,
          usesContractions: voiceProfile.usesContractions,
          usesEmoji: voiceProfile.usesEmoji,
          usesProfanity: voiceProfile.usesProfanity,
          commonPhrases: JSON.stringify(voiceProfile.commonPhrases),
          industryJargon: JSON.stringify(voiceProfile.industryJargon),
          signOffStyle: voiceProfile.signOffStyle,
          greetingStyle: voiceProfile.greetingStyle,
          usesLists: voiceProfile.usesLists,
          usesBoldText: voiceProfile.usesBoldText,
          usesQuestions: voiceProfile.usesQuestions,
          exampleEmails: JSON.stringify(voiceProfile.exampleEmails),
          updatedAt: new Date(),
        }).where(eq(voiceProfiles.userId, ctx.user.id));

        return { success: true, profileId: existing[0].id, updated: true };
      } else {
        // Create new profile
        const result = await db.insert(voiceProfiles).values({
          userId: ctx.user.id,
          formality: voiceProfile.formality,
          directness: voiceProfile.directness,
          enthusiasm: voiceProfile.enthusiasm,
          avgSentenceLength: voiceProfile.avgSentenceLength,
          avgParagraphLength: voiceProfile.avgParagraphLength,
          usesContractions: voiceProfile.usesContractions,
          usesEmoji: voiceProfile.usesEmoji,
          usesProfanity: voiceProfile.usesProfanity,
          commonPhrases: JSON.stringify(voiceProfile.commonPhrases),
          industryJargon: JSON.stringify(voiceProfile.industryJargon),
          signOffStyle: voiceProfile.signOffStyle,
          greetingStyle: voiceProfile.greetingStyle,
          usesLists: voiceProfile.usesLists,
          usesBoldText: voiceProfile.usesBoldText,
          usesQuestions: voiceProfile.usesQuestions,
          exampleEmails: JSON.stringify(voiceProfile.exampleEmails),
        });

        const profileId = (result as any)[0]?.insertId ?? (result as any).lastInsertRowid ?? 0;
        return { success: true, profileId, updated: false };
      }
    }),

  /**
   * Get current voice profile
   */
  getVoiceProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const profile = await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, ctx.user.id)).limit(1);

      if (profile.length === 0) {
        return null;
      }

      const p = profile[0];
      return {
        ...p,
        commonPhrases: JSON.parse(p.commonPhrases),
        industryJargon: JSON.parse(p.industryJargon),
        exampleEmails: JSON.parse(p.exampleEmails),
      };
    }),

  /**
   * Generate outreach email for a lead
   */
  generateOutreachEmail: protectedProcedure
    .input(z.object({
      leadId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get voice profile
      const profileResult = await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, ctx.user.id)).limit(1);
      if (profileResult.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Voice profile not initialized. Please analyze your emails first."
        });
      }

      const profileRow = profileResult[0];
      const voiceProfile = {
        ...profileRow,
        // DB stores JSON strings
        commonPhrases: JSON.parse(profileRow.commonPhrases),
        industryJargon: JSON.parse(profileRow.industryJargon),
        exampleEmails: JSON.parse(profileRow.exampleEmails),
        // DB columns are TEXT; narrow them back to the VoiceProfile unions
        formality: profileRow.formality as any,
        directness: profileRow.directness as any,
        enthusiasm: profileRow.enthusiasm as any,
      } as any;

      // Get lead and audit
      const leadResult = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (leadResult.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }
      const lead = leadResult[0];

      const auditResult = await db.select().from(audits).where(eq(audits.leadId, input.leadId)).limit(1);
      if (auditResult.length === 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Lead must be audited first" });
      }
      const audit = auditResult[0];

      // Parse visual debt data
      const parsedDebt = audit.visualDebtData ? JSON.parse(audit.visualDebtData) : null;
      const debtItems = Array.isArray(parsedDebt)
        ? parsedDebt
        : Array.isArray((parsedDebt as any)?.visualDebt)
          ? (parsedDebt as any).visualDebt
          : [];

      const topIssues = debtItems
        .slice(0, 3)
        .map((i: any) => i.issue || i.title)
        .filter(Boolean);

      // Generate email
      const email = await generateEmailInVoice(voiceProfile, {
        recipientName: lead.companyName, // TODO: Extract actual contact name
        recipientCompany: lead.companyName,
        recipientWebsite: lead.websiteUrl,
        auditSummary: audit.summary || "Website audit completed",
        prestigeScore: audit.prestigeScore || 0,
        topIssues,
      });

      // Check if voice is calibrated (>= 5 approved emails)
      const isCalibrated = profileRow.calibrationCount >= 5;

      // Add to email queue (auto-send if calibrated, otherwise pending_approval)
      const queueResult = await db.insert(emailQueue).values({
        leadId: input.leadId,
        recipientEmail: "placeholder@example.com", // TODO: Extract from lead or user input
        recipientName: lead.companyName,
        subject: email.subject,
        body: email.body,
        status: isCalibrated ? "approved" : "pending_approval",
      });

      // If calibrated, send immediately
      if (isCalibrated) {
        try {
          const result = await sendGmailMessage({
            to: "placeholder@example.com", // TODO: Extract from lead
            subject: email.subject,
            body: email.body,
          });

          await db.update(emailQueue).set({
            status: "sent",
            sentAt: new Date(),
            gmailMessageId: result.messageId,
            gmailThreadId: result.threadId,
          }).where(eq(emailQueue.id, queueResult[0].insertId));

          // Increment emails_sent_count
          await db.update(voiceProfiles).set({
            emailsSentCount: profileRow.emailsSentCount + 1,
          }).where(eq(voiceProfiles.userId, ctx.user.id));
        } catch (error: any) {
          // If send fails, mark as failed
          await db.update(emailQueue).set({
            status: "failed",
            errorMessage: error.message,
          }).where(eq(emailQueue.id, queueResult[0].insertId));

          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: `Failed to send email: ${error.message}` 
          });
        }
      }

      const emailId = (queueResult as any)[0]?.insertId ?? (queueResult as any).lastInsertRowid ?? 0;

      return {
        success: true,
        emailId,
        subject: email.subject,
        body: email.body,
      };
    }),

  /**
   * Get emails pending approval
   */
  getPendingEmails: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const emails = await db.select({
        id: emailQueue.id,
        leadId: emailQueue.leadId,
        companyName: leads.companyName,
        websiteUrl: leads.websiteUrl,
        recipientEmail: emailQueue.recipientEmail,
        recipientName: emailQueue.recipientName,
        subject: emailQueue.subject,
        body: emailQueue.body,
        status: emailQueue.status,
        scheduledFor: emailQueue.scheduledFor,
        createdAt: emailQueue.createdAt,
      })
        .from(emailQueue)
        .leftJoin(leads, eq(emailQueue.leadId, leads.id))
        .where(eq(emailQueue.status, "pending_approval"))
        .orderBy(emailQueue.createdAt);

      return emails;
    }),

  /**
   * Approve email and optionally edit before sending
   */
  approveEmail: protectedProcedure
    .input(z.object({
      emailId: z.number(),
      subject: z.string().optional(), // Edited subject
      body: z.string().optional(), // Edited body
      sendNow: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get email
      const emailResult = await db.select().from(emailQueue).where(eq(emailQueue.id, input.emailId)).limit(1);
      if (emailResult.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      }
      const email = emailResult[0];

      // Update email with edits if provided
      const updates: any = {
        status: input.sendNow ? "approved" : "pending",
      };
      if (input.subject) updates.subject = input.subject;
      if (input.body) updates.body = input.body;

      await db.update(emailQueue).set(updates).where(eq(emailQueue.id, input.emailId));

      // If user edited the email, use it to refine voice profile
      if (input.subject || input.body) {
        const profileResult = await db.select().from(voiceProfiles).where(eq(voiceProfiles.userId, ctx.user.id)).limit(1);
        if (profileResult.length > 0) {
          const profileRow = profileResult[0];
          const currentProfile = {
            ...profileRow,
            commonPhrases: JSON.parse(profileRow.commonPhrases),
            industryJargon: JSON.parse(profileRow.industryJargon),
            exampleEmails: JSON.parse(profileRow.exampleEmails),
            formality: profileRow.formality as any,
            directness: profileRow.directness as any,
            enthusiasm: profileRow.enthusiasm as any,
          } as any;

          // Refine profile based on edits
          const refinedProfile = await refineVoiceProfile(currentProfile, {
            emailGenerated: `Subject: ${email.subject}\n\n${email.body}`,
            userEdits: `Subject: ${input.subject || email.subject}\n\n${input.body || email.body}`,
            feedbackNotes: "User edited the generated email",
          });

          // Update profile
          await db.update(voiceProfiles).set({
            formality: refinedProfile.formality,
            directness: refinedProfile.directness,
            enthusiasm: refinedProfile.enthusiasm,
            avgSentenceLength: refinedProfile.avgSentenceLength,
            avgParagraphLength: refinedProfile.avgParagraphLength,
            usesContractions: refinedProfile.usesContractions,
            usesEmoji: refinedProfile.usesEmoji,
            usesProfanity: refinedProfile.usesProfanity,
            commonPhrases: JSON.stringify(refinedProfile.commonPhrases),
            industryJargon: JSON.stringify(refinedProfile.industryJargon),
            signOffStyle: refinedProfile.signOffStyle,
            greetingStyle: refinedProfile.greetingStyle,
            usesLists: refinedProfile.usesLists,
            usesBoldText: refinedProfile.usesBoldText,
            usesQuestions: refinedProfile.usesQuestions,
            calibrationCount: profileRow.calibrationCount + 1,
            isCalibrated: profileRow.calibrationCount + 1 >= 5,
          }).where(eq(voiceProfiles.userId, ctx.user.id));
        }
      }

      return { success: true, willSend: input.sendNow };
    }),

  /**
   * Reject email (remove from queue)
   */
  rejectEmail: protectedProcedure
    .input(z.object({
      emailId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.update(emailQueue).set({
        status: "failed",
        errorMessage: input.reason || "Rejected by user",
      }).where(eq(emailQueue.id, input.emailId));

      return { success: true };
    }),

  /**
   * Send approved emails (called by cron job or manual trigger)
   */
  sendApprovedEmails: protectedProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get approved emails ready to send
      const emails = await db.select().from(emailQueue)
        .where(
          and(
            eq(emailQueue.status, "approved"),
            or(
              isNull(emailQueue.scheduledFor),
              lt(emailQueue.scheduledFor, new Date())
            )
          )
        )
        .limit(10); // Send 10 at a time to avoid rate limits

      const results: { emailId: number; success: boolean; error?: string }[] = [];
      for (const email of emails) {
        try {
          // Mark as sending
          await db.update(emailQueue).set({ status: "sending" }).where(eq(emailQueue.id, email.id));

          // Send via Gmail MCP
          const result = await sendGmailMessage({
            to: email.recipientEmail,
            subject: email.subject,
            body: email.body,
          });

          await db.update(emailQueue).set({
            status: "sent",
            sentAt: new Date(),
            gmailMessageId: result.messageId,
            gmailThreadId: result.threadId,
          }).where(eq(emailQueue.id, email.id));

          results.push({ emailId: email.id, success: true });
        } catch (error) {
          await db.update(emailQueue).set({
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            retryCount: email.retryCount + 1,
          }).where(eq(emailQueue.id, email.id));

          results.push({ emailId: email.id, success: false, error: error instanceof Error ? error.message : "Unknown error" });
        }
      }

      return { sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
    }),

  /**
   * Generate a reply draft to an incoming email
   */
  generateReplyDraft: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      replyMessageId: z.number(), // The ID in our emailQueue table for the incoming reply
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // 1. Get lead
      const leadResult = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (leadResult.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      const lead = leadResult[0];

      // 2. Get the incoming reply
      const replyResult = await db.select().from(emailQueue).where(eq(emailQueue.id, input.replyMessageId)).limit(1);
      if (replyResult.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Incoming reply not found" });
      const incomingReply = replyResult[0];

      // 3. Get the original sent email (to provide context to the reply generator)
      const sentEmailResult = await db.select().from(emailQueue)
        .where(
          and(
            eq(emailQueue.leadId, input.leadId),
            eq(emailQueue.status, "sent"),
            ne(emailQueue.id, input.replyMessageId)
          )
        )
        .orderBy(emailQueue.sentAt)
        .limit(1);

      const originalEmail = sentEmailResult.length > 0 ? sentEmailResult[0] : { subject: "", body: "" };

      // 4. Generate the reply
      const { generateReply } = await import("./charmer");
      const draft = await generateReply(lead, originalEmail, {
        from: incomingReply.recipientEmail,
        subject: incomingReply.subject,
        body: incomingReply.body,
      });

      // 5. Add the draft to the email queue
      const queueResult = await db.insert(emailQueue).values({
        leadId: input.leadId,
        recipientEmail: incomingReply.recipientEmail,
        recipientName: lead.companyName,
        subject: draft.subject,
        body: draft.body,
        status: "pending_approval",
        gmailThreadId: incomingReply.gmailThreadId,
      });

      const emailId = (queueResult as any)[0]?.insertId ?? (queueResult as any).lastInsertRowid ?? 0;

      return {
        success: true,
        emailId,
        subject: draft.subject,
        body: draft.body,
      };
    }),
});
