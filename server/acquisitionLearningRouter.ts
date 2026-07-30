import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  acquisitionLearningCandidates,
  leads,
  smirkOutcomeEvents,
} from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  buildAcquisitionLearningSummary,
  evaluateAcquisitionLearningCandidate,
  type AcquisitionDimension,
  type AcquisitionObservation,
} from "./lib/acquisitionLearning";
import { requirePrivilegedUser } from "./lib/accessControl";

const dimensionSchema = z.enum(["category", "metro"]);

async function loadObservations(
  userId: number
): Promise<AcquisitionObservation[]> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Database unavailable.",
    });
  }
  const rows = await db
    .select({
      prospectId: smirkOutcomeEvents.leadId,
      category: leads.category,
      city: leads.city,
      state: leads.state,
      channel: smirkOutcomeEvents.channel,
      outcome: smirkOutcomeEvents.outcome,
      occurredAt: smirkOutcomeEvents.occurredAt,
    })
    .from(smirkOutcomeEvents)
    .innerJoin(
      leads,
      and(
        eq(leads.id, smirkOutcomeEvents.leadId),
        eq(leads.userId, smirkOutcomeEvents.userId)
      )
    )
    .where(eq(smirkOutcomeEvents.userId, userId));
  return rows.map(row => ({
    ...row,
    prospectId: String(row.prospectId),
  }));
}

function candidateKey(
  dimension: AcquisitionDimension,
  value: string
): string {
  return `${dimension}:${value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150)}`;
}

export const acquisitionLearningRouter = router({
  scorecard: protectedProcedure
    .input(
      z
        .object({ dimension: dimensionSchema.default("category") })
        .default({ dimension: "category" })
    )
    .query(async ({ ctx, input }) => {
      const observations = await loadObservations(ctx.user.id);
      const summary = buildAcquisitionLearningSummary(
        observations,
        input.dimension
      );
      return {
        dimension: input.dimension,
        sampleSize: summary.sampleSize,
        eventCount: summary.eventCount,
        segments: summary.segments,
        policyChanged: false as const,
        externalAction: "none" as const,
      };
    }),

  candidates: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Database unavailable.",
      });
    }
    const rows = await db
      .select()
      .from(acquisitionLearningCandidates)
      .where(eq(acquisitionLearningCandidates.userId, ctx.user.id))
      .orderBy(desc(acquisitionLearningCandidates.generatedAt))
      .limit(100);
    return {
      candidates: rows.map(row => ({
        ...row,
        proposal: JSON.parse(row.proposal),
        evidence: JSON.parse(row.evidence),
      })),
      policyChanged: false as const,
      externalAction: "none" as const,
    };
  }),

  createCandidate: protectedProcedure
    .input(
      z.object({
        dimension: dimensionSchema,
        value: z.string().trim().min(2).max(160),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "Database unavailable.",
        });
      }
      const observations = await loadObservations(ctx.user.id);
      const evaluation = evaluateAcquisitionLearningCandidate({
        observations,
        dimension: input.dimension,
        value: input.value,
      });
      if (evaluation.ready === false) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            evaluation.code === "INSUFFICIENT_SAMPLE"
              ? "The candidate and comparison group each need at least 10 unique prospects with measured outcomes."
              : "The candidate segment has no measured positive lift.",
        });
      }
      const key = candidateKey(input.dimension, evaluation.proposal.value);
      const versions = await db
        .select({ version: acquisitionLearningCandidates.version })
        .from(acquisitionLearningCandidates)
        .where(
          and(
            eq(acquisitionLearningCandidates.userId, ctx.user.id),
            eq(acquisitionLearningCandidates.candidateKey, key)
          )
        )
        .orderBy(desc(acquisitionLearningCandidates.version))
        .limit(1);
      const version = Number(versions[0]?.version || 0) + 1;
      const inserted = await db
        .insert(acquisitionLearningCandidates)
        .values({
          userId: ctx.user.id,
          candidateKey: key,
          version,
          state: "CANDIDATE",
          proposal: JSON.stringify(evaluation.proposal),
          evidence: JSON.stringify(evaluation.evidence),
          sampleSize: evaluation.sampleSize,
        })
        .$returningId();
      if (!inserted[0]?.id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The sourcing candidate was not durably recorded.",
        });
      }
      return {
        id: inserted[0].id,
        candidateKey: key,
        version,
        state: "CANDIDATE" as const,
        proposal: evaluation.proposal,
        evidence: evaluation.evidence,
        policyChanged: false as const,
        externalAction: "none" as const,
      };
    }),

  decideCandidate: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        decision: z.enum(["APPROVED", "REJECTED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "Database unavailable.",
        });
      }
      const updated = await db
        .update(acquisitionLearningCandidates)
        .set({
          state: input.decision,
          decidedBy: ctx.user.id,
          decidedAt: new Date(),
        })
        .where(
          and(
            eq(acquisitionLearningCandidates.id, input.id),
            eq(acquisitionLearningCandidates.userId, ctx.user.id),
            eq(acquisitionLearningCandidates.state, "CANDIDATE")
          )
        );
      if (Number(updated[0]?.affectedRows ?? 0) !== 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Candidate not found or already decided.",
        });
      }
      return {
        id: input.id,
        state: input.decision,
        policyChanged: false as const,
        externalAction: "none" as const,
        note:
          "Decision recorded. Hunt criteria remain unchanged until a separately reviewed configuration release.",
      };
    }),
});
