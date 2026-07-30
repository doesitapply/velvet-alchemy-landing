import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  leads,
  campaigns,
  outreachDrafts,
} from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAudit } from "./governor";
import { throwSmirkOutreachAuthority } from "./lib/smirkOutreachBoundary";

function throwExternalEmailBlocked(): never {
  throwSmirkOutreachAuthority();
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
    .mutation(async () => {
      throwSmirkOutreachAuthority();
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
    .mutation(async () => {
      throwSmirkOutreachAuthority();
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
