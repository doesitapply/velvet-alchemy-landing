import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { leads } from "../drizzle/schema";
import { getSmirkHandoffConfig, sendSmirkHandoff } from "./smirkHandoff";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;
const EXTERNAL_ID = /^[A-Za-z0-9:_-]+$/;

export const smirkRouter = router({
  status: adminProcedure.query(() => {
    const config = getSmirkHandoffConfig();
    return {
      configured: config.configured,
      missing: config.missing,
      error: config.error || null,
      baseUrlConfigured: !!config.baseUrl,
      workspaceConfigured: !!config.workspaceId,
      apiKeyConfigured: !!config.apiKey,
    };
  }),

  handoffLead: adminProcedure
    .input(z.object({
      leadId: z.number().int().positive(),
      externalId: z.string().trim().min(12).max(160).regex(EXTERNAL_ID),
      caller: z.object({
        phone: z.string().trim().regex(E164_PHONE),
        name: z.string().trim().min(1).max(120).optional(),
        email: z.string().trim().email().max(320).optional(),
      }).strict(),
      reason: z.string().trim().min(4).max(500),
      urgency: z.enum(["low", "normal", "high", "emergency"]).default("normal"),
      transcriptSnippet: z.string().trim().min(1).max(4_000).optional(),
      recommendedAction: z.string().trim().min(1).max(1_000).optional(),
      notes: z.string().trim().min(1).max(2_000).optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Velvet storage is unavailable." });

      const [lead] = await db
        .select({ id: leads.id, companyName: leads.companyName })
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.userId, ctx.user.id)))
        .limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found." });

      const result = await sendSmirkHandoff({
        externalId: input.externalId,
        caller: input.caller,
        companyName: lead.companyName,
        reason: input.reason,
        urgency: input.urgency,
        transcriptSnippet: input.transcriptSnippet,
        recommendedAction: input.recommendedAction,
        notes: input.notes,
      });
      if (!result.ok) {
        throw new TRPCError({
          code: result.retryable ? "TIMEOUT" : "PRECONDITION_FAILED",
          message: result.error,
          cause: result.code,
        });
      }
      return result;
    }),
});
