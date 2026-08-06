import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads, audits, assets, campaigns, outreachDrafts } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateOutreachCopy } from "./charmer";
import { sendEmail } from "./gmail";
import { logAudit } from "./governor";

// ─── Ownership helper ─────────────────────────────────────────────────────────
/**
 * Verify a draft belongs to the calling user by joining through campaigns.
 * Throws FORBIDDEN if the draft does not exist or belongs to another user.
 */
async function assertDraftOwner(
  db: Awaited<ReturnType<typeof getDb>>,
  draftId: number,
  userId: number
): Promise<void> {
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select({ draftId: outreachDrafts.id })
    .from(outreachDrafts)
    .leftJoin(campaigns, eq(outreachDrafts.campaignId, campaigns.id))
    .where(and(eq(outreachDrafts.id, draftId), eq(campaigns.userId, userId)))
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Draft not found or does not belong to you.",
    });
  }
}

export const charmerRouter = router({
  /**
   * Direct email send is DISABLED.
   * All outreach must go through the draft → approve → send flow.
   * Use charmer.generateDraft + charmer.approveDraft + charmer.sendDraft instead.
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
    .mutation(async () => {
      throw new TRPCError({
        code: "METHOD_NOT_SUPPORTED",
        message:
          "Direct email send is disabled. Use generateDraft → approveDraft → sendDraft to send outreach.",
      });
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

      // Create draft — always starts as pending_approval
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
   * List all drafts (with optional filtering) — scoped to calling user
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
   * Get draft by ID — scoped to calling user
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

      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      return result;
    }),

  /**
   * Approve draft — owner-scoped
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

      // Verify ownership before mutating
      await assertDraftOwner(db, input.draftId, ctx.user.id);

      await db
        .update(outreachDrafts)
        .set({
          status: "approved",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
        })
        .where(eq(outreachDrafts.id, input.draftId));

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
   * Reject draft — owner-scoped
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

      // Verify ownership before mutating
      await assertDraftOwner(db, input.draftId, ctx.user.id);

      await db
        .update(outreachDrafts)
        .set({
          status: "rejected",
          rejectionReason: input.reason,
        })
        .where(eq(outreachDrafts.id, input.draftId));

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
   * Send approved draft via Gmail — owner-scoped
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

      // Verify ownership before fetching or sending
      await assertDraftOwner(db, input.draftId, ctx.user.id);

      // Fetch draft
      const [draft] = await db
        .select()
        .from(outreachDrafts)
        .where(eq(outreachDrafts.id, input.draftId))
        .limit(1);

      if (!draft) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
      if (draft.status !== "approved") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Draft must be approved before sending",
        });
      }

      // Send email via Gmail MCP
      const result = await sendEmail({
        to: draft.recipientEmail,
        subject: draft.subject,
        body: draft.body,
      });

      if (!result.success) {
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
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(campaigns.id, draft.campaignId));
      }

      await logAudit({
        userId: ctx.user.id,
        action: "draft_sent",
        resource: "outreach_draft",
        resourceId: input.draftId,
        details: JSON.stringify({ messageId: result.messageId }),
        status: "success",
      });

      return { success: true, messageId: result.messageId };
    }),
});
