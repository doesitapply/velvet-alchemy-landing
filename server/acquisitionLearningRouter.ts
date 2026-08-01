import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  acquisitionLearningCandidates,
  acquisitionLearningPolicyReleases,
  acquisitionSourcingExperiments,
  leads,
  smirkOutcomeEvents,
  users,
} from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  ACQUISITION_SOURCING_EXPERIMENT_EVIDENCE_STUDY_DESIGN,
  buildAcquisitionLearningCandidateKey,
  buildAcquisitionLearningSummary,
  evaluateAcquisitionLearningCandidate,
  hashAcquisitionLearningValue,
  verifyAcquisitionLearningCandidateSnapshot,
  type AcquisitionObservation,
} from "./lib/acquisitionLearning";
import {
  acquisitionSourcingExperimentDefinitionSchema,
  acquisitionSourcingExperimentEvaluationSchema,
  buildAcquisitionLearningSnapshotFromSourcingExperiment,
  hashAcquisitionSourcingValue,
} from "./lib/acquisitionSourcingExperiment";
import {
  acquisitionLearningPolicyDeactivateInputSchema,
  acquisitionLearningPolicyReleaseInputSchema,
  buildAcquisitionLearningPolicyReceipt,
  verifyAcquisitionLearningPolicyReceipt,
} from "./lib/acquisitionLearningPolicy";
import { requirePrivilegedUser } from "./lib/accessControl";

const dimensionSchema = z.enum(["category", "metro"]);

async function loadObservationsFromDb(
  db: any,
  userId: number
): Promise<AcquisitionObservation[]> {
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
  return rows.map((row: any) => ({
    ...row,
    prospectId: String(row.prospectId),
  }));
}

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
  return loadObservationsFromDb(db, userId);
}

function parseStoredJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Stored acquisition-learning evidence is invalid.",
    });
  }
}

async function requireCurrentCandidateEvidence(input: {
  db: any;
  userId: number;
  proposal: string;
  evidence: string;
  sampleSize: number;
}): Promise<ReturnType<typeof verifyAcquisitionLearningCandidateSnapshot>> {
  let stored;
  try {
    stored = verifyAcquisitionLearningCandidateSnapshot({
      proposal: parseStoredJson(input.proposal),
      evidence: parseStoredJson(input.evidence),
      sampleSize: input.sampleSize,
    });
  } catch {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "The acquisition-learning candidate evidence is invalid or no longer meets the release gate.",
    });
  }
  if (
    stored.evidence.studyDesign ===
    ACQUISITION_SOURCING_EXPERIMENT_EVIDENCE_STUDY_DESIGN
  ) {
    const experimentRows = await input.db
      .select()
      .from(acquisitionSourcingExperiments)
      .where(
        and(
          eq(acquisitionSourcingExperiments.userId, input.userId),
          eq(
            acquisitionSourcingExperiments.experimentId,
            stored.evidence.source.experimentId
          )
        )
      )
      .limit(1)
      .for("update");
    const experiment = experimentRows[0];
    try {
      if (
        !experiment ||
        experiment.state !== "CLOSED" ||
        experiment.definitionHash !== stored.evidence.source.definitionHash ||
        !experiment.resultPayload ||
        !experiment.resultPayloadHash
      ) {
        throw new Error("closed experiment missing");
      }
      const definition = acquisitionSourcingExperimentDefinitionSchema.parse(
        JSON.parse(experiment.definition)
      );
      const evaluation = acquisitionSourcingExperimentEvaluationSchema.parse(
        JSON.parse(experiment.resultPayload)
      );
      if (
        hashAcquisitionSourcingValue(definition) !==
          experiment.definitionHash ||
        hashAcquisitionSourcingValue(evaluation) !==
          experiment.resultPayloadHash ||
        evaluation.resultHash !== stored.evidence.source.resultHash
      ) {
        throw new Error("experiment receipt mismatch");
      }
      const current = buildAcquisitionLearningSnapshotFromSourcingExperiment({
        definition,
        definitionHash: experiment.definitionHash,
        evaluation,
      });
      if (
        current.sampleSize !== input.sampleSize ||
        hashAcquisitionLearningValue(current.proposal) !==
          hashAcquisitionLearningValue(stored.proposal) ||
        hashAcquisitionLearningValue(current.evidence) !==
          hashAcquisitionLearningValue(stored.evidence)
      ) {
        throw new Error("candidate snapshot mismatch");
      }
      return stored;
    } catch {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "The closed source-experiment receipt no longer matches this candidate.",
      });
    }
  }
  const observations = await loadObservationsFromDb(input.db, input.userId);
  const current = evaluateAcquisitionLearningCandidate({
    observations,
    dimension: stored.proposal.dimension,
    value: stored.proposal.value,
  });
  if (
    current.ready === false ||
    current.sampleSize !== input.sampleSize ||
    hashAcquisitionLearningValue(current.proposal) !==
      hashAcquisitionLearningValue(stored.proposal) ||
    hashAcquisitionLearningValue(current.evidence) !==
      hashAcquisitionLearningValue(stored.evidence)
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Measured acquisition evidence changed. Create and review a fresh candidate before release.",
    });
  }
  return stored;
}

async function lockAcquisitionPolicyOwner(
  tx: any,
  userId: number
): Promise<void> {
  const owner = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for("update");
  if (!owner[0]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "The acquisition policy owner does not exist.",
    });
  }
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
    const releaseRows = await db
      .select()
      .from(acquisitionLearningPolicyReleases)
      .where(eq(acquisitionLearningPolicyReleases.userId, ctx.user.id))
      .orderBy(desc(acquisitionLearningPolicyReleases.id))
      .limit(1);
    let currentPolicy = null;
    if (releaseRows[0]) {
      try {
        currentPolicy = verifyAcquisitionLearningPolicyReceipt(
          releaseRows[0]
        );
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The current acquisition policy receipt is invalid.",
        });
      }
    }
    return {
      candidates: rows.map(row => {
        const proposal = parseStoredJson(row.proposal);
        const evidence = parseStoredJson(row.evidence);
        return {
          ...row,
          proposal,
          evidence,
          proposalHash: hashAcquisitionLearningValue(proposal),
          evidenceHash: hashAcquisitionLearningValue(evidence),
        };
      }),
      currentPolicy,
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
              : evaluation.code === "INSUFFICIENT_CONFIDENCE"
                ? "The candidate segment lift does not pass the exact one-sided confidence gate."
                : "The candidate segment has no measured positive lift.",
        });
      }
      const key = buildAcquisitionLearningCandidateKey(
        input.dimension,
        evaluation.proposal.value
      );
      const created = await db.transaction(async tx => {
        await lockAcquisitionPolicyOwner(tx, ctx.user.id);
        const versions = await tx
          .select({ version: acquisitionLearningCandidates.version })
          .from(acquisitionLearningCandidates)
          .where(
            and(
              eq(acquisitionLearningCandidates.userId, ctx.user.id),
              eq(acquisitionLearningCandidates.candidateKey, key)
            )
          )
          .orderBy(desc(acquisitionLearningCandidates.version))
          .limit(1)
          .for("update");
        const version = Number(versions[0]?.version || 0) + 1;
        const inserted = await tx
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
        return { id: inserted[0].id, version };
      });
      return {
        id: created.id,
        candidateKey: key,
        version: created.version,
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
      await db.transaction(async tx => {
        await lockAcquisitionPolicyOwner(tx, ctx.user.id);
        const candidates = await tx
          .select()
          .from(acquisitionLearningCandidates)
          .where(
            and(
              eq(acquisitionLearningCandidates.id, input.id),
              eq(acquisitionLearningCandidates.userId, ctx.user.id)
            )
          )
          .limit(1)
          .for("update");
        const candidate = candidates[0];
        if (!candidate || candidate.state !== "CANDIDATE") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Candidate not found or already decided.",
          });
        }
        if (input.decision === "APPROVED") {
          await requireCurrentCandidateEvidence({
            db: tx,
            userId: ctx.user.id,
            proposal: candidate.proposal,
            evidence: candidate.evidence,
            sampleSize: candidate.sampleSize,
          });
        }
        const updated = await tx
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
      });
      return {
        id: input.id,
        state: input.decision,
        policyChanged: false as const,
        externalAction: "none" as const,
        note:
          "Decision recorded. Hunt criteria remain unchanged until a separately reviewed configuration release.",
      };
    }),

  releaseCandidate: protectedProcedure
    .input(acquisitionLearningPolicyReleaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "Database unavailable.",
        });
      }
      const requestHash = hashAcquisitionLearningValue(input);
      const result = await db.transaction(async tx => {
        await lockAcquisitionPolicyOwner(tx, ctx.user.id);
        const existingRows = await tx
          .select()
          .from(acquisitionLearningPolicyReleases)
          .where(
            eq(acquisitionLearningPolicyReleases.releaseId, input.releaseId)
          )
          .limit(1)
          .for("update");
        if (existingRows[0]) {
          let receipt;
          try {
            receipt = verifyAcquisitionLearningPolicyReceipt(
              existingRows[0]
            );
          } catch {
            throw new TRPCError({
              code: "CONFLICT",
              message: "The stored acquisition policy receipt is invalid.",
            });
          }
          if (
            receipt.userId !== ctx.user.id ||
            receipt.action !== "APPLY" ||
            receipt.requestHash !== requestHash ||
            receipt.activeCandidate?.id !== input.candidateId
          ) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "This acquisition policy release ID is already bound to another request.",
            });
          }
          return { outcome: "duplicate" as const, receipt };
        }

        const candidateRows = await tx
          .select()
          .from(acquisitionLearningCandidates)
          .where(
            and(
              eq(acquisitionLearningCandidates.id, input.candidateId),
              eq(acquisitionLearningCandidates.userId, ctx.user.id)
            )
          )
          .limit(1)
          .for("update");
        const candidate = candidateRows[0];
        if (!candidate || candidate.state !== "APPROVED") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Only an approved acquisition-learning candidate can be released.",
          });
        }
        const snapshot = await requireCurrentCandidateEvidence({
          db: tx,
          userId: ctx.user.id,
          proposal: candidate.proposal,
          evidence: candidate.evidence,
          sampleSize: candidate.sampleSize,
        });
        const proposalHash = hashAcquisitionLearningValue(snapshot.proposal);
        const evidenceHash = hashAcquisitionLearningValue(snapshot.evidence);
        if (
          proposalHash !== input.proposalHash ||
          evidenceHash !== input.evidenceHash
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "The release request does not match the reviewed candidate evidence.",
          });
        }

        const latestRows = await tx
          .select()
          .from(acquisitionLearningPolicyReleases)
          .where(eq(acquisitionLearningPolicyReleases.userId, ctx.user.id))
          .orderBy(desc(acquisitionLearningPolicyReleases.id))
          .limit(1)
          .for("update");
        let previousCandidateId: number | null = null;
        if (latestRows[0]) {
          let latest;
          try {
            latest = verifyAcquisitionLearningPolicyReceipt(latestRows[0]);
          } catch {
            throw new TRPCError({
              code: "CONFLICT",
              message: "The current acquisition policy receipt is invalid.",
            });
          }
          previousCandidateId = latest.activeCandidate?.id || null;
        }
        const receipt = buildAcquisitionLearningPolicyReceipt({
          releaseId: input.releaseId,
          action: "APPLY",
          userId: ctx.user.id,
          activeCandidate: {
            id: candidate.id,
            candidateKey: candidate.candidateKey,
            version: candidate.version,
            proposalHash,
            evidenceHash,
          },
          previousCandidateId,
          requestHash,
          reason: input.reason,
          createdBy: ctx.user.id,
        });
        const inserted = await tx
          .insert(acquisitionLearningPolicyReleases)
          .values({
            userId: ctx.user.id,
            releaseId: receipt.releaseId,
            action: receipt.action,
            activeCandidateId: candidate.id,
            previousCandidateId,
            candidateKey: candidate.candidateKey,
            candidateVersion: candidate.version,
            proposalHash,
            evidenceHash,
            requestHash,
            receiptHash: receipt.receiptHash,
            reason: receipt.reason,
            createdBy: ctx.user.id,
          })
          .$returningId();
        if (!inserted[0]?.id) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "The acquisition policy release was not recorded.",
          });
        }
        return { outcome: "released" as const, receipt };
      });
      return {
        ...result,
        policyChanged: result.outcome === "released",
        externalAction: "none" as const,
        contactAuthorized: false as const,
        providerExecutionAuthorized: false as const,
        spendAuthorized: false as const,
      };
    }),

  deactivatePolicy: protectedProcedure
    .input(acquisitionLearningPolicyDeactivateInputSchema)
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: "Database unavailable.",
        });
      }
      const requestHash = hashAcquisitionLearningValue(input);
      const result = await db.transaction(async tx => {
        await lockAcquisitionPolicyOwner(tx, ctx.user.id);
        const existingRows = await tx
          .select()
          .from(acquisitionLearningPolicyReleases)
          .where(
            eq(acquisitionLearningPolicyReleases.releaseId, input.releaseId)
          )
          .limit(1)
          .for("update");
        if (existingRows[0]) {
          let receipt;
          try {
            receipt = verifyAcquisitionLearningPolicyReceipt(
              existingRows[0]
            );
          } catch {
            throw new TRPCError({
              code: "CONFLICT",
              message: "The stored acquisition policy receipt is invalid.",
            });
          }
          if (
            receipt.userId !== ctx.user.id ||
            receipt.action !== "DEACTIVATE" ||
            receipt.requestHash !== requestHash
          ) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "This acquisition policy release ID is already bound to another request.",
            });
          }
          return { outcome: "duplicate" as const, receipt };
        }

        const latestRows = await tx
          .select()
          .from(acquisitionLearningPolicyReleases)
          .where(eq(acquisitionLearningPolicyReleases.userId, ctx.user.id))
          .orderBy(desc(acquisitionLearningPolicyReleases.id))
          .limit(1)
          .for("update");
        if (!latestRows[0]) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "No acquisition policy is currently released.",
          });
        }
        let current;
        try {
          current = verifyAcquisitionLearningPolicyReceipt(latestRows[0]);
        } catch {
          throw new TRPCError({
            code: "CONFLICT",
            message: "The current acquisition policy receipt is invalid.",
          });
        }
        if (
          current.releaseId !== input.currentReleaseId ||
          !current.activeCandidate
        ) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "The deactivation request does not match the current released acquisition policy.",
          });
        }
        const receipt = buildAcquisitionLearningPolicyReceipt({
          releaseId: input.releaseId,
          action: "DEACTIVATE",
          userId: ctx.user.id,
          activeCandidate: null,
          previousCandidateId: current.activeCandidate.id,
          requestHash,
          reason: input.reason,
          createdBy: ctx.user.id,
        });
        const inserted = await tx
          .insert(acquisitionLearningPolicyReleases)
          .values({
            userId: ctx.user.id,
            releaseId: receipt.releaseId,
            action: receipt.action,
            activeCandidateId: null,
            previousCandidateId: current.activeCandidate.id,
            candidateKey: null,
            candidateVersion: null,
            proposalHash: null,
            evidenceHash: null,
            requestHash,
            receiptHash: receipt.receiptHash,
            reason: receipt.reason,
            createdBy: ctx.user.id,
          })
          .$returningId();
        if (!inserted[0]?.id) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "The acquisition policy deactivation was not recorded.",
          });
        }
        return { outcome: "deactivated" as const, receipt };
      });
      return {
        ...result,
        policyChanged: result.outcome === "deactivated",
        externalAction: "none" as const,
        contactAuthorized: false as const,
        providerExecutionAuthorized: false as const,
        spendAuthorized: false as const,
      };
    }),
});
