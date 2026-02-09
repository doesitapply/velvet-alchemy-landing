import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads, audits, assets, campaigns, outreachDrafts } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateOutreachCopy } from "./charmer";
import { sendEmail } from "./gmail";
import { logAudit } from "./governor";

export const charmerRouter = router({
  /**
   * Send email directly from lead profile (bypasses draft system)
   */
  sendDirectEmail: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify lead exists and belongs to user
      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!lead) throw new Error("Lead not found");

      // Send email via Gmail MCP
      const result = await sendEmail({
        to: input.to,
        subject: input.subject,
        body: input.body,
      });

      if (!result.success) {
        // Log failure
        await logAudit({
          userId: ctx.user.id,
          action: "direct_email_failed",
          resource: "leads",
          resourceId: input.leadId,
          details: JSON.stringify({ error: result.error, to: input.to }),
          status: "failure",
        });

        throw new Error(`Failed to send email: ${result.error}`);
      }

      // Log success
      await logAudit({
        userId: ctx.user.id,
        action: "direct_email_sent",
        resource: "leads",
        resourceId: input.leadId,
        details: JSON.stringify({ to: input.to, subject: input.subject, messageId: result.messageId }),
        status: "success",
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    }),

  /**
   * Generate outreach draft for a lead
   */
  generateDraft: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch lead
      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!lead) throw new Error("Lead not found");

      // Fetch audit
      const [audit] = await db
        .select()
        .from(audits)
        .where(eq(audits.leadId, input.leadId))
        .orderBy(desc(audits.createdAt))
        .limit(1);

      // Fetch assets
      const leadAssets = await db.select().from(assets).where(eq(assets.leadId, input.leadId));

      // Generate outreach copy
      const copy = await generateOutreachCopy(lead, audit || null, leadAssets);

      // Create campaign
      const [campaign] = await db
        .insert(campaigns)
        .values({
          leadId: input.leadId,
          userId: ctx.user.id,
          name: `${lead.companyName} - Outreach`,
          status: "draft",
        })
        .$returningId();

      // Create draft
      const [draft] = await db
        .insert(outreachDrafts)
        .values({
          campaignId: campaign.id,
          subject: copy.subject,
          body: copy.body,
          recipientEmail: copy.recipientEmail,
          recipientName: copy.recipientName,
          status: "pending_approval",
        })
        .$returningId();

      // Log audit event
      await logAudit({
        userId: ctx.user.id,
        action: "draft_generated",
        resource: "outreach_draft",
        resourceId: draft.id,
        details: JSON.stringify({ leadId: input.leadId, campaignId: campaign.id }),
        status: "success",
      });

      return {
        draftId: draft.id,
        campaignId: campaign.id,
        subject: copy.subject,
        body: copy.body,
      };
    }),

  /**
   * List all drafts (with optional filtering)
   */
  listDrafts: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["draft", "pending_approval", "approved", "rejected", "sent"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let results;
      if (input?.status) {
        results = await db
          .select({
            draft: outreachDrafts,
            campaign: campaigns,
            lead: leads,
          })
          .from(outreachDrafts)
          .leftJoin(campaigns, eq(outreachDrafts.campaignId, campaigns.id))
          .leftJoin(leads, eq(campaigns.leadId, leads.id))
          .where(
            and(eq(campaigns.userId, ctx.user.id), eq(outreachDrafts.status, input.status))
          )
          .orderBy(desc(outreachDrafts.createdAt));
      } else {
        results = await db
          .select({
            draft: outreachDrafts,
            campaign: campaigns,
            lead: leads,
          })
          .from(outreachDrafts)
          .leftJoin(campaigns, eq(outreachDrafts.campaignId, campaigns.id))
          .leftJoin(leads, eq(campaigns.leadId, leads.id))
          .where(eq(campaigns.userId, ctx.user.id))
          .orderBy(desc(outreachDrafts.createdAt));
      }
      return results;
    }),

  /**
   * Get draft by ID
   */
  getDraft: protectedProcedure
    .input(
      z.object({
        draftId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [result] = await db
        .select({
          draft: outreachDrafts,
          campaign: campaigns,
          lead: leads,
        })
        .from(outreachDrafts)
        .leftJoin(campaigns, eq(outreachDrafts.campaignId, campaigns.id))
        .leftJoin(leads, eq(campaigns.leadId, leads.id))
        .where(
          and(eq(outreachDrafts.id, input.draftId), eq(campaigns.userId, ctx.user.id))
        )
        .limit(1);

      if (!result) throw new Error("Draft not found");
      return result;
    }),

  /**
   * Approve draft
   */
  approveDraft: protectedProcedure
    .input(
      z.object({
        draftId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(outreachDrafts)
        .set({
          status: "approved",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
        })
        .where(eq(outreachDrafts.id, input.draftId));

      // Log audit event
      await logAudit({
        userId: ctx.user.id,
        action: "draft_approved",
        resource: "outreach_draft",
        resourceId: input.draftId,
        status: "success",
      });

      return { success: true };
    }),

  /**
   * Reject draft
   */
  rejectDraft: protectedProcedure
    .input(
      z.object({
        draftId: z.number(),
        reason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(outreachDrafts)
        .set({
          status: "rejected",
          rejectionReason: input.reason,
        })
        .where(eq(outreachDrafts.id, input.draftId));

      // Log audit event
      await logAudit({
        userId: ctx.user.id,
        action: "draft_rejected",
        resource: "outreach_draft",
        resourceId: input.draftId,
        details: JSON.stringify({ reason: input.reason }),
        status: "success",
      });

      return { success: true };
    }),

  /**
   * Send approved draft via Gmail
   */
  sendDraft: protectedProcedure
    .input(
      z.object({
        draftId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch draft
      const [draft] = await db
        .select()
        .from(outreachDrafts)
        .where(eq(outreachDrafts.id, input.draftId))
        .limit(1);

      if (!draft) throw new Error("Draft not found");
      if (draft.status !== "approved") {
        throw new Error("Draft must be approved before sending");
      }

      // Send email via Gmail MCP
      const result = await sendEmail({
        to: draft.recipientEmail,
        subject: draft.subject,
        body: draft.body,
      });

      if (!result.success) {
        // Log failure
        await logAudit({
          userId: ctx.user.id,
          action: "draft_send_failed",
          resource: "outreach_draft",
          resourceId: input.draftId,
          details: JSON.stringify({ error: result.error }),
          status: "failure",
        });

        throw new Error(`Failed to send email: ${result.error}`);
      }

      // Update draft status
      await db
        .update(outreachDrafts)
        .set({
          status: "sent",
          sentAt: new Date(),
          gmailMessageId: result.messageId,
        })
        .where(eq(outreachDrafts.id, input.draftId));

      // Update campaign status
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, draft.campaignId))
        .limit(1);

      if (campaign) {
        await db
          .update(campaigns)
          .set({
            status: "sent",
            sentAt: new Date(),
          })
          .where(eq(campaigns.id, draft.campaignId));
      }

      // Log success
      await logAudit({
        userId: ctx.user.id,
        action: "draft_sent",
        resource: "outreach_draft",
        resourceId: input.draftId,
        details: JSON.stringify({ messageId: result.messageId }),
        status: "success",
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    }),
});
