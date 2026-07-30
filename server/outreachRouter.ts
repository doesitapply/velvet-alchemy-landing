import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads, voiceProfiles, emailQueue } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  analyzeVoice,
  type EmailSample,
} from "./voiceAnalyzer";
import { TRPCError } from "@trpc/server";
import { checkKillSwitch, checkRateLimit, logAudit } from "./governor";
import { requireCostAuthority } from "./lib/accessControl";
import { throwSmirkOutreachAuthority } from "./lib/smirkOutreachBoundary";

/**
 * Outreach Router
 * Handles review-only email drafting and approval.
 */

export const outreachRouter = router({
  /**
   * Initialize voice profile by analyzing user's Gmail sent emails
   */
  initializeVoiceProfile: protectedProcedure
    .input(
      z.object({
        sampleEmails: z
          .array(
            z.object({
              subject: z.string(),
              body: z.string(),
              to: z.string(),
              date: z.string(), // ISO date string
            })
          )
          .min(1)
          .max(20), // Analyze 1-20 emails
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireCostAuthority(ctx.user);
      await checkKillSwitch(ctx.user.id);
      await checkRateLimit(ctx.user.id, "voice_analyze");
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });

      // Convert date strings to Date objects
      const emailSamples: EmailSample[] = input.sampleEmails.map(e => ({
        ...e,
        date: new Date(e.date),
      }));

      // Analyze voice
      const voiceProfile = await analyzeVoice(emailSamples);

      // Check if profile already exists
      const existing = await db
        .select()
        .from(voiceProfiles)
        .where(eq(voiceProfiles.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        // Update existing profile
        await db
          .update(voiceProfiles)
          .set({
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
          })
          .where(eq(voiceProfiles.userId, ctx.user.id));

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

        return { success: true, profileId: result[0].insertId, updated: false };
      }
    }),

  /**
   * Get current voice profile
   */
  getVoiceProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });

    const profile = await db
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.userId, ctx.user.id))
      .limit(1);

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
    .input(
      z.object({
        leadId: z.number(),
      })
    )
    .mutation(async () => {
      throwSmirkOutreachAuthority();
    }),

  /**
   * Get emails pending approval
   */
  getPendingEmails: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });

    const emails = await db
      .select({
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
      .where(
        and(
          eq(emailQueue.status, "pending_approval"),
          eq(leads.userId, ctx.user.id)
        )
      )
      .orderBy(emailQueue.createdAt);

    return emails;
  }),

  /**
   * Approve or edit an email for separate manual handling. This never sends.
   */
  approveEmail: protectedProcedure
    .input(
      z.object({
        emailId: z.number(),
        subject: z.string().optional(), // Edited subject
        body: z.string().optional(), // Edited body
        sendNow: z.boolean().default(false),
      })
    )
    .mutation(async () => {
      throwSmirkOutreachAuthority();
    }),

  /**
   * Reject email (remove from queue)
   */
  rejectEmail: protectedProcedure
    .input(
      z.object({
        emailId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });

      const owned = await db
        .select({ id: emailQueue.id, status: emailQueue.status })
        .from(emailQueue)
        .leftJoin(leads, eq(emailQueue.leadId, leads.id))
        .where(
          and(eq(emailQueue.id, input.emailId), eq(leads.userId, ctx.user.id))
        )
        .limit(1);
      if (!owned[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      }
      if (!["pending_approval", "approved"].includes(owned[0].status)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only a pending or approved email can be rejected.",
        });
      }

      await db
        .update(emailQueue)
        .set({
          status: "failed",
          errorMessage: input.reason || "Rejected by user",
        })
        .where(
          and(
            eq(emailQueue.id, input.emailId),
            eq(emailQueue.status, owned[0].status)
          )
        );

      const rejected = await db
        .select({ status: emailQueue.status })
        .from(emailQueue)
        .leftJoin(leads, eq(emailQueue.leadId, leads.id))
        .where(
          and(
            eq(emailQueue.id, input.emailId),
            eq(emailQueue.status, "failed"),
            eq(leads.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!rejected[0]) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email rejection was not persisted.",
        });
      }
      await logAudit({
        userId: ctx.user.id,
        action: "email_rejected",
        resource: "email_queue",
        resourceId: input.emailId,
        details: JSON.stringify({ reason: input.reason || "Rejected by user" }),
        status: "success",
      });

      return { success: true };
    }),

  /**
   * Retained as a fail-closed compatibility route. Approval prepares an email
   * for manual handling; it does not authorize this process to send it.
   */
  sendApprovedEmails: protectedProcedure.mutation(async () => {
    throwSmirkOutreachAuthority();
  }),
});
