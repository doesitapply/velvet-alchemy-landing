import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { requirePrivilegedUser } from "./lib/accessControl";
import {
  ACQUISITION_SOURCING_ACTIVATION_CONFIRMATION,
  ACQUISITION_SOURCING_CANDIDATE_CONFIRMATION,
  ACQUISITION_SOURCING_CANCELLATION_CONFIRMATION,
  ACQUISITION_SOURCING_CLOSE_CONFIRMATION,
  acquisitionSourcingCriteriaSchema,
} from "./lib/acquisitionSourcingExperiment";
import {
  AcquisitionSourcingExperimentStoreError,
  activateAcquisitionSourcingExperiment,
  cancelAcquisitionSourcingExperiment,
  closeAcquisitionSourcingExperiment,
  listAcquisitionSourcingExperiments,
  prepareAcquisitionSourcingExperiment,
  proposeCandidateFromAcquisitionSourcingExperiment,
} from "./lib/acquisitionSourcingExperimentStore";

const HASH = z.string().regex(/^[a-f0-9]{64}$/);
const armSchema = z
  .object({
    label: z.string().trim().min(2).max(100),
    criteria: acquisitionSourcingCriteriaSchema,
  })
  .strict();

function toTrpcError(error: unknown): never {
  if (!(error instanceof AcquisitionSourcingExperimentStoreError)) {
    throw error;
  }
  const code =
    error.status === 404
      ? "NOT_FOUND"
      : error.status === 403
        ? "FORBIDDEN"
        : error.status === 412
          ? "PRECONDITION_FAILED"
          : error.status === 409
            ? "CONFLICT"
            : error.status === 503
              ? "SERVICE_UNAVAILABLE"
              : "INTERNAL_SERVER_ERROR";
  throw new TRPCError({ code, message: error.message, cause: error });
}

export const acquisitionSourcingExperimentRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(25) }))
    .query(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await listAcquisitionSourcingExperiments(
          ctx.user.id,
          input.limit
        );
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  prepare: protectedProcedure
    .input(
      z
        .object({
          experimentId: z.string().uuid(),
          workspaceId: z.number().int().positive(),
          dimension: z.enum(["category", "metro"]),
          control: armSchema,
          challenger: armSchema,
          requestsPerArm: z.number().int().min(1).max(10),
          leadsPerRequest: z.number().int().min(1).max(20),
          attestNoContactAuthority: z.literal(true),
          attestNoSpendAuthority: z.literal(true),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await prepareAcquisitionSourcingExperiment({
          ...input,
          userId: ctx.user.id,
          actorId: ctx.user.id,
        });
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  activate: protectedProcedure
    .input(
      z
        .object({
          experimentId: z.string().uuid(),
          definitionHash: HASH,
          confirmation: z.literal(ACQUISITION_SOURCING_ACTIVATION_CONFIRMATION),
          attestFrozenBalancedAssignment: z.literal(true),
          attestNoContactAuthority: z.literal(true),
          attestNoSpendAuthority: z.literal(true),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await activateAcquisitionSourcingExperiment({
          experimentId: input.experimentId,
          definitionHash: input.definitionHash,
          userId: ctx.user.id,
          actorId: ctx.user.id,
        });
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  cancel: protectedProcedure
    .input(
      z
        .object({
          experimentId: z.string().uuid(),
          definitionHash: HASH,
          confirmation: z.literal(
            ACQUISITION_SOURCING_CANCELLATION_CONFIRMATION
          ),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await cancelAcquisitionSourcingExperiment({
          experimentId: input.experimentId,
          definitionHash: input.definitionHash,
          userId: ctx.user.id,
          actorId: ctx.user.id,
        });
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  close: protectedProcedure
    .input(
      z
        .object({
          experimentId: z.string().uuid(),
          definitionHash: HASH,
          confirmation: z.literal(ACQUISITION_SOURCING_CLOSE_CONFIRMATION),
          attestAllAssignmentsAndOutcomesReviewed: z.literal(true),
          attestNoAutomaticPolicyChange: z.literal(true),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await closeAcquisitionSourcingExperiment({
          experimentId: input.experimentId,
          definitionHash: input.definitionHash,
          userId: ctx.user.id,
          actorId: ctx.user.id,
        });
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  proposeCandidate: protectedProcedure
    .input(
      z
        .object({
          experimentId: z.string().uuid(),
          definitionHash: HASH,
          resultHash: HASH,
          confirmation: z.literal(ACQUISITION_SOURCING_CANDIDATE_CONFIRMATION),
          attestRecommendationReviewed: z.literal(true),
          attestNoAutomaticPolicyChange: z.literal(true),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await proposeCandidateFromAcquisitionSourcingExperiment({
          experimentId: input.experimentId,
          definitionHash: input.definitionHash,
          resultHash: input.resultHash,
          userId: ctx.user.id,
          actorId: ctx.user.id,
        });
      } catch (error) {
        return toTrpcError(error);
      }
    }),
});
