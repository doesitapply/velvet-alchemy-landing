import { createHash } from "node:crypto";
import { z } from "zod";
import { smirkResearchPayloadSchema } from "./smirkResearch";

export const SMIRK_LEAD_BATCH_REQUEST_CONTRACT =
  "smirk-velvet.lead-batch-request.v1" as const;
export const SMIRK_LEAD_BATCH_RESPONSE_CONTRACT =
  "velvet-smirk.lead-batch-response.v1" as const;
export const SMIRK_LEAD_BATCH_SCOPE = "smirk:research" as const;
export const MAX_SMIRK_LEAD_BATCH_SIZE = 20;

const SAFE_EXTERNAL_ID = /^[A-Za-z0-9:_-]+$/;

export const smirkLeadBatchRequestSchema = z
  .object({
    contractVersion: z.literal(SMIRK_LEAD_BATCH_REQUEST_CONTRACT),
    requestId: z.string().min(20).max(160).regex(SAFE_EXTERNAL_ID),
    workspaceId: z.number().int().positive(),
    criteria: z
      .object({
        limit: z.number().int().min(1).max(MAX_SMIRK_LEAD_BATCH_SIZE),
        category: z.string().trim().min(2).max(120).optional(),
        city: z.string().trim().min(1).max(120).optional(),
        state: z.string().trim().min(2).max(80).optional(),
        learningMode: z.enum(["none", "latest_approved"]),
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
          criteria.learningMode === "latest_approved" &&
          (criteria.category || criteria.city || criteria.state)
        ) {
          ctx.addIssue({
            code: "custom",
            message:
              "An approved learning candidate and manual segment filters cannot be combined.",
          });
        }
      }),
    contactActionAllowed: z.literal(false),
    maxSpendCents: z.literal(0),
  })
  .strict();

export const acquisitionSourcingProposalSchema = z
  .object({
    action: z.literal("prioritize_for_next_research_batch"),
    dimension: z.enum(["category", "metro"]),
    value: z.string().trim().min(2).max(160),
    maximumNextBatchSize: z
      .number()
      .int()
      .min(1)
      .max(MAX_SMIRK_LEAD_BATCH_SIZE),
  })
  .strict();

export const appliedLearningCandidateSchema = z
  .object({
    id: z.number().int().positive(),
    candidateKey: z.string().min(3).max(180),
    version: z.number().int().positive(),
    proposal: acquisitionSourcingProposalSchema,
  })
  .strict();

export const smirkLeadBatchResponseSchema = z
  .object({
    ok: z.literal(true),
    contractVersion: z.literal(SMIRK_LEAD_BATCH_RESPONSE_CONTRACT),
    state: z.enum(["EXPORTED", "EMPTY", "DUPLICATE"]),
    originalState: z.enum(["EXPORTED", "EMPTY"]),
    requestId: z.string().min(20).max(160).regex(SAFE_EXTERNAL_ID),
    requestPayloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    batchId: z.number().int().positive(),
    prospectsHash: z.string().regex(/^[a-f0-9]{64}$/),
    prospects: z
      .array(smirkResearchPayloadSchema)
      .max(MAX_SMIRK_LEAD_BATCH_SIZE),
    appliedLearningCandidate: appliedLearningCandidateSchema.nullable(),
    contactActionAllowed: z.literal(false),
    spendAuthorized: z.literal(false),
    externalAction: z.literal("research_export_only"),
  })
  .strict()
  .superRefine((response, ctx) => {
    if (
      (response.originalState === "EMPTY") !==
      (response.prospects.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "EMPTY state must exactly match an empty prospect list.",
      });
    }
    const externalIds = new Set<string>();
    for (let index = 0; index < response.prospects.length; index += 1) {
      const prospect = response.prospects[index];
      if (externalIds.has(prospect.externalId)) {
        ctx.addIssue({
          code: "custom",
          path: ["prospects", index, "externalId"],
          message: "Prospect external IDs must be unique within a batch.",
        });
      }
      externalIds.add(prospect.externalId);
    }
  });

export type SmirkLeadBatchRequest = z.infer<
  typeof smirkLeadBatchRequestSchema
>;
export type AppliedLearningCandidate = z.infer<
  typeof appliedLearningCandidateSchema
>;
export type SmirkLeadBatchResponse = z.infer<
  typeof smirkLeadBatchResponseSchema
>;

export function hashSmirkLeadBatchValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function parseApprovedSourcingCandidate(input: {
  id: number;
  candidateKey: string;
  version: number;
  proposal: string;
}): AppliedLearningCandidate | null {
  let rawProposal: unknown;
  try {
    rawProposal = JSON.parse(input.proposal);
  } catch {
    return null;
  }
  const parsed = appliedLearningCandidateSchema.safeParse({
    id: input.id,
    candidateKey: input.candidateKey,
    version: input.version,
    proposal: rawProposal,
  });
  return parsed.success ? parsed.data : null;
}

export function sourcingFiltersForRequest(
  request: SmirkLeadBatchRequest,
  candidate: AppliedLearningCandidate | null
): {
  category?: string;
  city?: string;
  state?: string;
  limit: number;
} {
  if (request.criteria.learningMode === "latest_approved") {
    if (!candidate) {
      throw new Error(
        "A valid approved sourcing candidate is required for this request."
      );
    }
    const limit = Math.min(
      request.criteria.limit,
      candidate.proposal.maximumNextBatchSize
    );
    if (candidate.proposal.dimension === "category") {
      return {
        category: candidate.proposal.value.trim().toLowerCase(),
        limit,
      };
    }
    const separator = candidate.proposal.value.lastIndexOf(",");
    const city = candidate.proposal.value.slice(0, separator).trim();
    const state = candidate.proposal.value.slice(separator + 1).trim();
    if (!city || !state) {
      throw new Error(
        "The approved metro candidate is not formatted as City, State."
      );
    }
    return { city, state: state.toUpperCase(), limit };
  }
  return {
    category: request.criteria.category?.trim().toLowerCase(),
    city: request.criteria.city?.trim(),
    state: request.criteria.state?.trim().toUpperCase(),
    limit: request.criteria.limit,
  };
}
