import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { requirePrivilegedUser } from "./lib/accessControl";
import {
  SMIRK_DISCOVERY_APPROVAL_CONFIRMATION,
  SMIRK_DISCOVERY_CANCELLATION_CONFIRMATION,
  SMIRK_DISCOVERY_EXECUTION_CONFIRMATION,
  SMIRK_DISCOVERY_REJECTION_CONFIRMATION,
} from "./lib/smirkDiscovery";
import {
  SmirkDiscoveryStoreError,
  approveSmirkDiscovery,
  decideSmirkDiscovery,
  getSmirkDiscoveryStatus,
  listSmirkDiscoveries,
  queueSmirkDiscovery,
} from "./lib/smirkDiscoveryStore";

const HASH = z.string().regex(/^[a-f0-9]{64}$/);

function toTrpcError(error: unknown): never {
  if (!(error instanceof SmirkDiscoveryStoreError)) throw error;
  const code =
    error.status === 404
      ? "NOT_FOUND"
      : error.status === 403
        ? "FORBIDDEN"
        : error.status === 410
          ? "PRECONDITION_FAILED"
          : error.status === 412
            ? "PRECONDITION_FAILED"
            : error.status === 409
              ? "CONFLICT"
              : error.status === 503
                ? "SERVICE_UNAVAILABLE"
                : "INTERNAL_SERVER_ERROR";
  throw new TRPCError({
    code,
    message: error.message,
    cause: error,
  });
}

export const smirkDiscoveryRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(25) }))
    .query(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await listSmirkDiscoveries(ctx.user.id, input.limit);
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  status: protectedProcedure
    .input(z.object({ requestId: z.string().min(20).max(160) }))
    .query(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await getSmirkDiscoveryStatus(
          input.requestId,
          ctx.user.id
        );
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  approve: protectedProcedure
    .input(
      z
        .object({
          discoveryId: z.number().int().positive(),
          requestPayloadHash: HASH,
          quotePayloadHash: HASH,
          approvedMaxSpendCents: z.number().int().min(1).max(500),
          confirmation: z.literal(
            SMIRK_DISCOVERY_APPROVAL_CONFIRMATION
          ),
          attestNoContactAuthority: z.literal(true),
          attestExactSpendCap: z.literal(true),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await approveSmirkDiscovery({
          discoveryId: input.discoveryId,
          userId: ctx.user.id,
          actorId: ctx.user.id,
          requestPayloadHash: input.requestPayloadHash,
          quotePayloadHash: input.quotePayloadHash,
          approvedMaxSpendCents: input.approvedMaxSpendCents,
        });
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  execute: protectedProcedure
    .input(
      z
        .object({
          discoveryId: z.number().int().positive(),
          requestPayloadHash: HASH,
          quotePayloadHash: HASH,
          confirmation: z.literal(
            SMIRK_DISCOVERY_EXECUTION_CONFIRMATION
          ),
          attestWorkerMayUseApprovedCap: z.literal(true),
          attestNoContactAuthority: z.literal(true),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await queueSmirkDiscovery({
          discoveryId: input.discoveryId,
          userId: ctx.user.id,
          actorId: ctx.user.id,
          requestPayloadHash: input.requestPayloadHash,
          quotePayloadHash: input.quotePayloadHash,
        });
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  reject: protectedProcedure
    .input(
      z
        .object({
          discoveryId: z.number().int().positive(),
          confirmation: z.literal(
            SMIRK_DISCOVERY_REJECTION_CONFIRMATION
          ),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await decideSmirkDiscovery({
          discoveryId: input.discoveryId,
          userId: ctx.user.id,
          actorId: ctx.user.id,
          decision: "REJECTED",
        });
      } catch (error) {
        return toTrpcError(error);
      }
    }),

  cancel: protectedProcedure
    .input(
      z
        .object({
          discoveryId: z.number().int().positive(),
          confirmation: z.literal(
            SMIRK_DISCOVERY_CANCELLATION_CONFIRMATION
          ),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      requirePrivilegedUser(ctx.user);
      try {
        return await decideSmirkDiscovery({
          discoveryId: input.discoveryId,
          userId: ctx.user.id,
          actorId: ctx.user.id,
          decision: "CANCELLED",
        });
      } catch (error) {
        return toTrpcError(error);
      }
    }),
});
