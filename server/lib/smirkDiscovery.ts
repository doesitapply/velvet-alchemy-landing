import { createHash } from "node:crypto";
import { z } from "zod";
import { readMapsRequestCostConfig } from "../_core/map";
import {
  appliedLearningCandidateSchema,
  isReleasedAcquisitionLearningMode,
  type AppliedLearningCandidate,
} from "./smirkLeadBatch";
import {
  acquisitionSourcingExperimentAssignmentSchema,
  acquisitionSourcingExperimentBindingSchema,
  type AcquisitionSourcingExperimentAssignment,
} from "./acquisitionSourcingExperiment";

export const SMIRK_DISCOVERY_REQUEST_CONTRACT =
  "smirk-velvet.discovery-request.v1" as const;
export const SMIRK_DISCOVERY_RESPONSE_CONTRACT =
  "velvet-smirk.discovery-response.v1" as const;
export const SMIRK_DISCOVERY_STATUS_CONTRACT =
  "velvet-smirk.discovery-status.v1" as const;
export const SMIRK_DISCOVERY_SCOPE = "smirk:research" as const;
export const SMIRK_DISCOVERY_APPROVAL_CONFIRMATION =
  "approve-one-smirk-discovery-v1" as const;
export const SMIRK_DISCOVERY_EXECUTION_CONFIRMATION =
  "execute-one-smirk-discovery-v1" as const;
export const SMIRK_DISCOVERY_REJECTION_CONFIRMATION =
  "reject-one-smirk-discovery-v1" as const;
export const SMIRK_DISCOVERY_CANCELLATION_CONFIRMATION =
  "cancel-one-smirk-discovery-v1" as const;
export const MAX_SMIRK_DISCOVERY_LEADS = 20;
export const MAX_SMIRK_DISCOVERY_BUDGET_CENTS = 500;
export const SMIRK_DISCOVERY_APPROVAL_TTL_MS = 24 * 60 * 60 * 1_000;

const SAFE_EXTERNAL_ID = /^[A-Za-z0-9:_-]+$/;

export const smirkDiscoveryCriteriaSchema = z
  .object({
    limit: z.number().int().min(1).max(MAX_SMIRK_DISCOVERY_LEADS),
    category: z.string().trim().min(2).max(120).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().min(2).max(80).optional(),
    learningMode: z.enum([
      "none",
      "latest_released",
      "latest_approved",
      "experiment",
    ]),
  })
  .strict()
  .superRefine((criteria, ctx) => {
    if (Boolean(criteria.city) !== Boolean(criteria.state)) {
      ctx.addIssue({
        code: "custom",
        message: "City and state must be supplied together.",
      });
    }
    if (
      isReleasedAcquisitionLearningMode(criteria.learningMode) &&
      Boolean(criteria.category) === Boolean(criteria.city && criteria.state)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Learned discovery requires exactly one complementary manual dimension: category or city/state.",
      });
    }
    if (
      criteria.learningMode === "none" &&
      (!criteria.category || !criteria.city || !criteria.state)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Manual discovery requires category, city, and state filters.",
      });
    }
    if (
      criteria.learningMode === "experiment" &&
      (criteria.category || criteria.city || criteria.state)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Experiment discovery criteria come only from the frozen assignment.",
      });
    }
  });

export const smirkDiscoveryRequestSchema = z
  .object({
    contractVersion: z.literal(SMIRK_DISCOVERY_REQUEST_CONTRACT),
    requestId: z.string().min(20).max(160).regex(SAFE_EXTERNAL_ID),
    workspaceId: z.number().int().positive(),
    criteria: smirkDiscoveryCriteriaSchema,
    acquisitionExperiment:
      acquisitionSourcingExperimentBindingSchema.optional(),
    contactActionAllowed: z.literal(false),
    spendAuthorized: z.literal(false),
  })
  .strict()
  .superRefine((request, ctx) => {
    if (
      (request.criteria.learningMode === "experiment") !==
      Boolean(request.acquisitionExperiment)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["acquisitionExperiment"],
        message:
          "Experiment mode requires exactly one immutable experiment binding.",
      });
    }
  });

export const smirkDiscoveryEffectiveCriteriaSchema = z
  .object({
    limit: z.number().int().min(1).max(MAX_SMIRK_DISCOVERY_LEADS),
    category: z.string().trim().min(2).max(120),
    city: z.string().trim().min(1).max(120),
    state: z.string().trim().min(2).max(80),
  })
  .strict();

export const smirkDiscoveryQuoteSchema = z
  .object({
    provider: z.literal("google_maps_proxy"),
    maximumRequests: z
      .number()
      .int()
      .min(2)
      .max(MAX_SMIRK_DISCOVERY_LEADS + 1),
    costCentsPerRequest: z.number().int().positive().max(10_000),
    maximumCostCents: z
      .number()
      .int()
      .positive()
      .max(MAX_SMIRK_DISCOVERY_BUDGET_CENTS),
    quotedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const smirkDiscoveryStateSchema = z.enum([
  "PREPARED",
  "APPROVED",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "EMPTY",
  "PARTIAL",
  "FAILED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);

export const smirkDiscoveryPreparedResponseSchema = z
  .object({
    ok: z.literal(true),
    contractVersion: z.literal(SMIRK_DISCOVERY_RESPONSE_CONTRACT),
    state: z.enum(["PREPARED", "DUPLICATE"]),
    originalState: z.literal("PREPARED"),
    currentState: smirkDiscoveryStateSchema,
    requestId: z.string().min(20).max(160).regex(SAFE_EXTERNAL_ID),
    requestPayloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    quotePayloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    discoveryId: z.number().int().positive(),
    effectiveCriteria: smirkDiscoveryEffectiveCriteriaSchema,
    appliedLearningCandidate: appliedLearningCandidateSchema.nullable(),
    acquisitionExperimentAssignment:
      acquisitionSourcingExperimentAssignmentSchema.nullable().default(null),
    quote: smirkDiscoveryQuoteSchema,
    approvalRequired: z.boolean(),
    executionStarted: z.boolean(),
    contactActionAllowed: z.literal(false),
    spendAuthorized: z.literal(false),
    externalAction: z.enum(["discovery_approval_required", "none"]),
  })
  .strict();

export const smirkDiscoveryStatusResponseSchema = z
  .object({
    ok: z.literal(true),
    contractVersion: z.literal(SMIRK_DISCOVERY_STATUS_CONTRACT),
    requestId: z.string().min(20).max(160).regex(SAFE_EXTERNAL_ID),
    requestPayloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    quotePayloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    discoveryId: z.number().int().positive(),
    state: smirkDiscoveryStateSchema,
    effectiveCriteria: smirkDiscoveryEffectiveCriteriaSchema,
    appliedLearningCandidate: appliedLearningCandidateSchema.nullable(),
    acquisitionExperimentAssignment:
      acquisitionSourcingExperimentAssignmentSchema.nullable().default(null),
    quote: smirkDiscoveryQuoteSchema,
    createdLeadCount: z.number().int().nonnegative(),
    readyLeadCount: z.number().int().nonnegative(),
    skippedLeadCount: z.number().int().nonnegative(),
    failedLeadCount: z.number().int().nonnegative(),
    providerRequests: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_SMIRK_DISCOVERY_LEADS + 1),
    approvedMaxSpendCents: z.number().int().nonnegative().nullable(),
    error: z.string().max(2_000).nullable(),
    contactActionAllowed: z.literal(false),
    externalAction: z.literal("discovery_status_only"),
  })
  .strict();

export type SmirkDiscoveryCriteria = z.infer<
  typeof smirkDiscoveryCriteriaSchema
>;
export type SmirkDiscoveryRequest = z.infer<
  typeof smirkDiscoveryRequestSchema
>;
export type SmirkDiscoveryEffectiveCriteria = z.infer<
  typeof smirkDiscoveryEffectiveCriteriaSchema
>;
export type SmirkDiscoveryQuote = z.infer<typeof smirkDiscoveryQuoteSchema>;
export type SmirkDiscoveryState = z.infer<typeof smirkDiscoveryStateSchema>;
export type SmirkDiscoveryPreparedResponse = z.infer<
  typeof smirkDiscoveryPreparedResponseSchema
>;
export type SmirkDiscoveryStatusResponse = z.infer<
  typeof smirkDiscoveryStatusResponseSchema
>;

export function hashSmirkDiscoveryValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildSmirkDiscoveryEffectiveCriteria(input: {
  request: SmirkDiscoveryRequest;
  candidate: AppliedLearningCandidate | null;
  experimentAssignment?: AcquisitionSourcingExperimentAssignment | null;
}): SmirkDiscoveryEffectiveCriteria {
  const { request, candidate, experimentAssignment = null } = input;
  if (request.criteria.learningMode === "experiment") {
    if (
      !request.acquisitionExperiment ||
      !experimentAssignment ||
      experimentAssignment.experimentId !==
        request.acquisitionExperiment.experimentId ||
      experimentAssignment.definitionHash !==
        request.acquisitionExperiment.definitionHash ||
      experimentAssignment.requestId !== request.requestId
    ) {
      throw new Error(
        "A valid frozen sourcing assignment is required for experiment discovery."
      );
    }
    return smirkDiscoveryEffectiveCriteriaSchema.parse(
      experimentAssignment.effectiveCriteria
    );
  }
  if (experimentAssignment || request.acquisitionExperiment) {
    throw new Error(
      "A sourcing experiment assignment cannot alter a non-experiment discovery."
    );
  }
  if (request.criteria.learningMode === "none") {
    return smirkDiscoveryEffectiveCriteriaSchema.parse({
      limit: request.criteria.limit,
      category: request.criteria.category,
      city: request.criteria.city,
      state: request.criteria.state?.toUpperCase(),
    });
  }
  if (!candidate) {
    throw new Error(
      "A valid released sourcing candidate is required for learned discovery."
    );
  }
  const limit = Math.min(
    request.criteria.limit,
    candidate.proposal.maximumNextBatchSize
  );
  if (candidate.proposal.dimension === "category") {
    if (!request.criteria.city || !request.criteria.state) {
      throw new Error(
        "The released category candidate requires an operator-selected city and state."
      );
    }
    return smirkDiscoveryEffectiveCriteriaSchema.parse({
      limit,
      category: candidate.proposal.value,
      city: request.criteria.city,
      state: request.criteria.state.toUpperCase(),
    });
  }
  const separator = candidate.proposal.value.lastIndexOf(",");
  const city = candidate.proposal.value.slice(0, separator).trim();
  const state = candidate.proposal.value.slice(separator + 1).trim();
  if (!city || !state) {
    throw new Error(
      "The released metro candidate is not formatted as City, State."
    );
  }
  if (!request.criteria.category) {
    throw new Error(
      "The released metro candidate requires an operator-selected category."
    );
  }
  return smirkDiscoveryEffectiveCriteriaSchema.parse({
    limit,
    category: request.criteria.category,
    city,
    state: state.toUpperCase(),
  });
}

export function buildSmirkDiscoveryQuote(
  criteria: SmirkDiscoveryEffectiveCriteria,
  env: Record<string, string | undefined> = process.env,
  quotedAt = new Date()
): SmirkDiscoveryQuote {
  const config = readMapsRequestCostConfig(env);
  if (!config.configured || !config.costCentsPerRequest) {
    throw new Error(
      `Maps discovery cannot be quoted: ${config.missing.join(", ")}`
    );
  }
  const maximumRequests = criteria.limit + 1;
  const maximumCostCents =
    maximumRequests * config.costCentsPerRequest;
  if (maximumCostCents > MAX_SMIRK_DISCOVERY_BUDGET_CENTS) {
    throw new Error(
      `The discovery quote exceeds the ${MAX_SMIRK_DISCOVERY_BUDGET_CENTS}-cent per-request cap.`
    );
  }
  return smirkDiscoveryQuoteSchema.parse({
    provider: "google_maps_proxy",
    maximumRequests,
    costCentsPerRequest: config.costCentsPerRequest,
    maximumCostCents,
    quotedAt: quotedAt.toISOString(),
  });
}

export function assertSmirkDiscoveryProviderRequest(input: {
  quote: SmirkDiscoveryQuote;
  approvedMaxSpendCents: number;
  nextRequestNumber: number;
}): void {
  const { quote, approvedMaxSpendCents, nextRequestNumber } = input;
  if (
    approvedMaxSpendCents !== quote.maximumCostCents ||
    !Number.isSafeInteger(nextRequestNumber) ||
    nextRequestNumber < 1 ||
    nextRequestNumber > quote.maximumRequests ||
    nextRequestNumber * quote.costCentsPerRequest >
      approvedMaxSpendCents
  ) {
    throw new Error(
      "The next Maps request is outside the exact operator-approved discovery cap."
    );
  }
}
