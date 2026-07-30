import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  leads,
  audits,
  assets,
  campaigns,
  outreachDrafts,
} from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateOutreachCopy } from "./charmer";
import { checkKillSwitch, checkRateLimit, logAudit } from "./governor";
import { externalActionBlock } from "./lib/externalActionPolicy";
import { requireCostAuthority } from "./lib/accessControl";

function throwExternalEmailBlocked(): never {
  const block = externalActionBlock("email_send");
  throw new TRPCError({
    code: "METHOD_NOT_SUPPORTED",
    message:
      "Direct send is disabled. Use the draft approval flow for review, then send manually outside Velvet.",
    cause: block,
  });
}

async function getOwnedDraft(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  draftId: number,
  userId: number
) {
  const [result] = await db
    .select({
      draft: outreachDrafts,
      campaign: campaigns,
    })
    .from(outreachDrafts)
    .leftJoin(campaigns, eq(outreachDrafts.campaignId, campaigns.id))
    .where(and(eq(outreachDrafts.id, draftId), eq(campaigns.userId, userId)))
    .limit(1);
  return result;
}

export const charmerRouter = router({
  /**
   * Retained as a fail-closed compatibility route. Direct sends bypass the
   * approval record and are never allowed.
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
      throwExternalEmailBlocked();
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
      requireCostAuthority(ctx.user);
      await checkKillSwitch(ctx.user.id);
      await checkRateLimit(ctx.user.id, "draft_generate");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch lead
      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.userId, ctx.user.id)))
        .limit(1);
      if (!lead) throw new Error("Lead not found");

      // Fetch audit
      const [audit] = await db
        .select()
        .from(audits)
        .where(eq(audits.leadId, input.leadId))
        .orderBy(desc(audits.createdAt))
        .limit(1);

      // Fetch assets
      const leadAssets = await db
        .select()
        .from(assets)
        .where(eq(assets.leadId, input.leadId));

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
        details: JSON.stringify({
          leadId: input.leadId,
          campaignId: campaign.id,
        }),
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
          status: z
            .enum(["draft", "pending_approval", "approved", "rejected", "sent"])
            .optional(),
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
            and(
              eq(campaigns.userId, ctx.user.id),
              eq(outreachDrafts.status, input.status)
            )
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
          and(
            eq(outreachDrafts.id, input.draftId),
            eq(campaigns.userId, ctx.user.id)
          )
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

      const owned = await getOwnedDraft(db, input.draftId, ctx.user.id);
      if (!owned?.draft) throw new Error("Draft not found");
      if (owned.draft.status !== "pending_approval") {
        throw new Error("Only a pending draft can be approved");
      }

      await db
        .update(outreachDrafts)
        .set({
          status: "approved",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
        })
        .where(
          and(
            eq(outreachDrafts.id, input.draftId),
            eq(outreachDrafts.status, "pending_approval")
          )
        );

      const verified = await getOwnedDraft(db, input.draftId, ctx.user.id);
      if (
        verified?.draft?.status !== "approved" ||
        verified.draft.approvedBy !== ctx.user.id
      ) {
        throw new Error("Draft approval was not persisted");
      }

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

      const owned = await getOwnedDraft(db, input.draftId, ctx.user.id);
      if (!owned?.draft) throw new Error("Draft not found");
      if (!["pending_approval", "approved"].includes(owned.draft.status)) {
        throw new Error("Only a pending or approved draft can be rejected");
      }

      await db
        .update(outreachDrafts)
        .set({
          status: "rejected",
          rejectionReason: input.reason,
        })
        .where(
          and(
            eq(outreachDrafts.id, input.draftId),
            eq(outreachDrafts.status, owned.draft.status)
          )
        );

      const verified = await getOwnedDraft(db, input.draftId, ctx.user.id);
      if (verified?.draft?.status !== "rejected") {
        throw new Error("Draft rejection was not persisted");
      }

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
   * Sending remains disabled until single-use, idempotent approval and delivery
   * receipts are implemented.
   */
  sendDraft: protectedProcedure
    .input(
      z.object({
        draftId: z.number(),
      })
    )
    .mutation(async () => {
      throwExternalEmailBlocked();
    }),
});
