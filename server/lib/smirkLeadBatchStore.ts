import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import {
  acquisitionLearningCandidates,
  audits,
  leads,
  smirkDiscoveryLeadItems,
  smirkDiscoveryRequests,
  smirkLeadBatchItems,
  smirkLeadBatches,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  buildSmirkResearchPayload,
  buildSmirkResearchPayloadHash,
  smirkResearchPayloadSchema,
  type SmirkResearchPayload,
} from "./smirkResearch";
import {
  appliedLearningCandidateSchema,
  hashSmirkLeadBatchValue,
  MAX_SMIRK_LEAD_BATCH_SIZE,
  parseApprovedSourcingCandidate,
  sourcingFiltersForRequest,
  type AppliedLearningCandidate,
  type SmirkLeadBatchRequest,
} from "./smirkLeadBatch";
import { z } from "zod";

export class SmirkLeadBatchStoreError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
  }
}

export type SmirkLeadBatchStoreResult = {
  outcome: "created" | "duplicate";
  originalState: "EXPORTED" | "EMPTY";
  batchId: number;
  requestPayloadHash: string;
  prospectsHash: string;
  prospects: SmirkResearchPayload[];
  appliedLearningCandidate: AppliedLearningCandidate | null;
  sourceDiscoveryRequestId: string | null;
};

type BatchActor = {
  userId: number;
  apiKeyId: number;
  apiKeyName: string;
};

type StoredResponse = {
  prospects: SmirkResearchPayload[];
  appliedLearningCandidate: AppliedLearningCandidate | null;
  prospectsHash: string;
  sourceDiscoveryRequestId?: string | null;
};

const storedResponseSchema = z
  .object({
    prospects: z
      .array(smirkResearchPayloadSchema)
      .max(MAX_SMIRK_LEAD_BATCH_SIZE),
    appliedLearningCandidate: appliedLearningCandidateSchema.nullable(),
    prospectsHash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceDiscoveryRequestId: z
      .string()
      .min(20)
      .max(160)
      .nullable()
      .optional(),
  })
  .strict();

export function parseStoredSmirkLeadBatchResponse(
  raw: string | null,
  expectedResponseHash: string | null
): StoredResponse {
  if (!raw || !expectedResponseHash) {
    throw new SmirkLeadBatchStoreError(
      "The existing lead batch has no verifiable durable response.",
      "SMIRK_LEAD_BATCH_STORED_RESPONSE_INVALID",
      500
    );
  }
  try {
    const parsed = storedResponseSchema.parse(JSON.parse(raw));
    if (
      hashSmirkLeadBatchValue(parsed) !== expectedResponseHash ||
      hashSmirkLeadBatchValue(parsed.prospects) !== parsed.prospectsHash
    ) {
      throw new Error("invalid stored response");
    }
    return parsed;
  } catch {
    throw new SmirkLeadBatchStoreError(
      "The existing lead batch response is not readable.",
      "SMIRK_LEAD_BATCH_STORED_RESPONSE_INVALID",
      500
    );
  }
}

function isDuplicateStorageError(error: unknown): boolean {
  const candidates = [
    error,
    error &&
    typeof error === "object" &&
    "cause" in error
      ? (error as { cause?: unknown }).cause
      : null,
  ];
  return candidates.some(candidate => {
    if (!candidate || typeof candidate !== "object") return false;
    const value = candidate as {
      code?: unknown;
      errno?: unknown;
      sqlState?: unknown;
    };
    return (
      value.code === "ER_DUP_ENTRY" ||
      value.errno === 1062 ||
      value.sqlState === "23000"
    );
  });
}

async function replayExistingBatch(
  db: any,
  input: {
    requestId: string;
    userId: number;
    requestPayloadHash: string;
  }
): Promise<SmirkLeadBatchStoreResult> {
  const rows = await db
    .select({
      id: smirkLeadBatches.id,
      userId: smirkLeadBatches.userId,
      requestPayloadHash: smirkLeadBatches.requestPayloadHash,
      state: smirkLeadBatches.state,
      responsePayload: smirkLeadBatches.responsePayload,
      responsePayloadHash: smirkLeadBatches.responsePayloadHash,
    })
    .from(smirkLeadBatches)
    .where(eq(smirkLeadBatches.requestId, input.requestId))
    .limit(1);
  const existing = rows[0];
  if (
    !existing ||
    existing.userId !== input.userId ||
    existing.requestPayloadHash !== input.requestPayloadHash
  ) {
    throw new SmirkLeadBatchStoreError(
      "This request ID is already bound to another lead batch.",
      "SMIRK_LEAD_BATCH_IDEMPOTENCY_CONFLICT",
      409
    );
  }
  if (existing.state === "PROCESSING") {
    throw new SmirkLeadBatchStoreError(
      "This lead batch is still being prepared.",
      "SMIRK_LEAD_BATCH_IN_PROGRESS",
      409
    );
  }
  const stored = parseStoredSmirkLeadBatchResponse(
    existing.responsePayload,
    existing.responsePayloadHash
  );
  return {
    outcome: "duplicate",
    originalState: existing.state,
    batchId: existing.id,
    requestPayloadHash: input.requestPayloadHash,
    prospectsHash: stored.prospectsHash,
    prospects: stored.prospects,
    appliedLearningCandidate: stored.appliedLearningCandidate,
    sourceDiscoveryRequestId:
      stored.sourceDiscoveryRequestId || null,
  };
}

function batchName(input: {
  candidate: AppliedLearningCandidate | null;
  category?: string;
  city?: string;
  state?: string;
}): string {
  if (input.candidate) {
    return `Velvet learned segment: ${input.candidate.proposal.value}`.slice(
      0,
      160
    );
  }
  const segment = [
    input.category,
    input.city && input.state ? `${input.city}, ${input.state}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
  return (segment
    ? `Velvet reviewed leads: ${segment}`
    : "Velvet reviewed leads"
  ).slice(0, 160);
}

async function latestApprovedCandidate(
  tx: any,
  userId: number
): Promise<AppliedLearningCandidate | null> {
  const rows = await tx
    .select({
      id: acquisitionLearningCandidates.id,
      candidateKey: acquisitionLearningCandidates.candidateKey,
      version: acquisitionLearningCandidates.version,
      proposal: acquisitionLearningCandidates.proposal,
    })
    .from(acquisitionLearningCandidates)
    .where(
      and(
        eq(acquisitionLearningCandidates.userId, userId),
        eq(acquisitionLearningCandidates.state, "APPROVED")
      )
    )
    .orderBy(
      desc(acquisitionLearningCandidates.decidedAt),
      desc(acquisitionLearningCandidates.generatedAt)
    )
    .limit(25);
  for (const row of rows) {
    const candidate = parseApprovedSourcingCandidate(row);
    if (candidate) return candidate;
  }
  return null;
}

export async function exportSmirkLeadBatch(
  request: SmirkLeadBatchRequest,
  actor: BatchActor
): Promise<SmirkLeadBatchStoreResult> {
  const db = await getDb();
  if (!db) {
    throw new SmirkLeadBatchStoreError(
      "Database unavailable.",
      "SMIRK_LEAD_BATCH_STORAGE_REQUIRED",
      503
    );
  }
  const requestPayloadHash = hashSmirkLeadBatchValue(request);

  try {
    return await db.transaction(async tx => {
    const existingRows = await tx
      .select({
        id: smirkLeadBatches.id,
        userId: smirkLeadBatches.userId,
        requestPayloadHash: smirkLeadBatches.requestPayloadHash,
        state: smirkLeadBatches.state,
        responsePayload: smirkLeadBatches.responsePayload,
        responsePayloadHash: smirkLeadBatches.responsePayloadHash,
      })
      .from(smirkLeadBatches)
      .where(eq(smirkLeadBatches.requestId, request.requestId))
      .limit(1);
    const existing = existingRows[0];
    if (existing) {
      if (existing.userId !== actor.userId) {
        throw new SmirkLeadBatchStoreError(
          "This request ID is already bound to another lead batch.",
          "SMIRK_LEAD_BATCH_IDEMPOTENCY_CONFLICT",
          409
        );
      }
      if (existing.requestPayloadHash !== requestPayloadHash) {
        throw new SmirkLeadBatchStoreError(
          "This request ID was replayed with different criteria.",
          "SMIRK_LEAD_BATCH_IDEMPOTENCY_CONFLICT",
          409
        );
      }
      if (existing.state === "PROCESSING") {
        throw new SmirkLeadBatchStoreError(
          "This lead batch is still being prepared.",
          "SMIRK_LEAD_BATCH_IN_PROGRESS",
          409
        );
      }
      const stored = parseStoredSmirkLeadBatchResponse(
        existing.responsePayload,
        existing.responsePayloadHash
      );
      return {
        outcome: "duplicate",
        originalState: existing.state,
        batchId: existing.id,
        requestPayloadHash,
        prospectsHash: stored.prospectsHash,
        prospects: stored.prospects,
        appliedLearningCandidate: stored.appliedLearningCandidate,
        sourceDiscoveryRequestId:
          stored.sourceDiscoveryRequestId || null,
      };
    }

    const inserted = await tx
      .insert(smirkLeadBatches)
      .values({
        userId: actor.userId,
        requestId: request.requestId,
        workspaceId: request.workspaceId,
        requestedByApiKeyId: actor.apiKeyId,
        requestedByApiKeyName: actor.apiKeyName,
        requestPayload: JSON.stringify(request),
        requestPayloadHash,
        state: "PROCESSING",
      })
      .$returningId();
    const batchId = Number(inserted[0]?.id || 0);
    if (!batchId) {
      throw new SmirkLeadBatchStoreError(
        "The lead batch receipt was not created.",
        "SMIRK_LEAD_BATCH_STORAGE_FAILED",
        500
      );
    }

    const candidate =
      request.criteria.learningMode === "latest_approved"
        ? await latestApprovedCandidate(tx, actor.userId)
        : null;
    if (
      request.criteria.learningMode === "latest_approved" &&
      !candidate
    ) {
      throw new SmirkLeadBatchStoreError(
        "No valid approved sourcing candidate is available.",
        "SMIRK_LEAD_BATCH_LEARNING_CANDIDATE_REQUIRED",
        412
      );
    }

    let filters;
    try {
      filters = sourcingFiltersForRequest(request, candidate);
    } catch (error) {
      throw new SmirkLeadBatchStoreError(
        error instanceof Error
          ? error.message
          : "The sourcing filters are invalid.",
        "SMIRK_LEAD_BATCH_LEARNING_CANDIDATE_INVALID",
        412
      );
    }

    let discoveryLeadIds: number[] | null = null;
    if (request.sourceDiscoveryRequestId) {
      const discoveries = await tx
        .select({
          id: smirkDiscoveryRequests.id,
          userId: smirkDiscoveryRequests.userId,
          workspaceId: smirkDiscoveryRequests.workspaceId,
          state: smirkDiscoveryRequests.state,
        })
        .from(smirkDiscoveryRequests)
        .where(
          eq(
            smirkDiscoveryRequests.requestId,
            request.sourceDiscoveryRequestId
          )
        )
        .limit(1);
      const discovery = discoveries[0];
      if (
        !discovery ||
        discovery.userId !== actor.userId ||
        discovery.workspaceId !== request.workspaceId
      ) {
        throw new SmirkLeadBatchStoreError(
          "The source discovery is not available to this owner and workspace.",
          "SMIRK_LEAD_BATCH_DISCOVERY_NOT_FOUND",
          404
        );
      }
      if (!["COMPLETED", "PARTIAL"].includes(discovery.state)) {
        throw new SmirkLeadBatchStoreError(
          `The source discovery is ${discovery.state}, not ready for export.`,
          "SMIRK_LEAD_BATCH_DISCOVERY_NOT_READY",
          412
        );
      }
      const discoveryItems = await tx
        .select({ leadId: smirkDiscoveryLeadItems.leadId })
        .from(smirkDiscoveryLeadItems)
        .where(
          and(
            eq(
              smirkDiscoveryLeadItems.discoveryId,
              discovery.id
            ),
            eq(smirkDiscoveryLeadItems.userId, actor.userId),
            eq(smirkDiscoveryLeadItems.state, "READY"),
            isNotNull(smirkDiscoveryLeadItems.leadId)
          )
        );
      discoveryLeadIds = discoveryItems
        .map(item => Number(item.leadId || 0))
        .filter(
          leadId => Number.isSafeInteger(leadId) && leadId > 0
        );
    }

    const conditions = [
      eq(leads.userId, actor.userId),
      eq(leads.status, "audited"),
      isNull(smirkLeadBatchItems.id),
      or(
        isNotNull(leads.verifiedOwnerEmail),
        isNotNull(leads.phone)
      )!,
    ];
    if (discoveryLeadIds) {
      conditions.push(
        discoveryLeadIds.length > 0
          ? inArray(leads.id, discoveryLeadIds)
          : sql`FALSE`
      );
    }
    if (filters.category) {
      conditions.push(
        sql`LOWER(TRIM(${leads.category})) = ${filters.category}`
      );
    }
    if (filters.city && filters.state) {
      conditions.push(sql`LOWER(TRIM(${leads.city})) = ${filters.city.toLowerCase()}`);
      conditions.push(sql`UPPER(TRIM(${leads.state})) = ${filters.state}`);
    }

    const candidates = await tx
      .select({
        id: leads.id,
        userId: leads.userId,
        companyName: leads.companyName,
        websiteUrl: leads.websiteUrl,
        phone: leads.phone,
        verifiedOwnerEmail: leads.verifiedOwnerEmail,
        category: leads.category,
        address: leads.address,
        city: leads.city,
        state: leads.state,
        screenshotUrl: leads.screenshotUrl,
        googleRating: leads.googleRating,
        reviewCount: leads.reviewCount,
        googlePlaceId: leads.googlePlaceId,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .leftJoin(
        smirkLeadBatchItems,
        and(
          eq(smirkLeadBatchItems.userId, actor.userId),
          eq(smirkLeadBatchItems.leadId, leads.id)
        )
      )
      .where(and(...conditions))
      .orderBy(
        desc(leads.priorityScore),
        desc(leads.reviewCount),
        desc(leads.createdAt)
      )
      .limit(Math.min(100, filters.limit * 5));

    const prospects: SmirkResearchPayload[] = [];
    for (const lead of candidates) {
      if (prospects.length >= filters.limit) break;
      const ordinal = prospects.length + 1;
      await tx
        .insert(smirkLeadBatchItems)
        .values({
          batchId,
          userId: actor.userId,
          leadId: lead.id,
          ordinal,
        })
        .onDuplicateKeyUpdate({
          set: {
            id: sql`${smirkLeadBatchItems.id}`,
          },
        });
      const reservationRows = await tx
        .select({ batchId: smirkLeadBatchItems.batchId })
        .from(smirkLeadBatchItems)
        .where(
          and(
            eq(smirkLeadBatchItems.userId, actor.userId),
            eq(smirkLeadBatchItems.leadId, lead.id)
          )
        )
        .limit(1);
      if (reservationRows[0]?.batchId !== batchId) continue;

      const auditRows = await tx
        .select({
          summary: audits.summary,
          visualDebtData: audits.visualDebtData,
          updatedAt: audits.updatedAt,
        })
        .from(audits)
        .where(eq(audits.leadId, lead.id))
        .orderBy(desc(audits.createdAt))
        .limit(1);
      const targetLocation =
        filters.city && filters.state
          ? `${filters.city}, ${filters.state}`
          : undefined;
      let prospect: SmirkResearchPayload;
      try {
        prospect = buildSmirkResearchPayload(
          lead,
          request.workspaceId,
          auditRows[0] || null,
          {
            externalId: request.requestId,
            name: batchName({
              candidate,
              category: filters.category,
              city: filters.city,
              state: filters.state,
            }),
            targetIndustry: filters.category,
            targetLocation,
          }
        );
      } catch {
        await tx
          .delete(smirkLeadBatchItems)
          .where(
            and(
              eq(smirkLeadBatchItems.batchId, batchId),
              eq(smirkLeadBatchItems.leadId, lead.id)
            )
          );
        continue;
      }
      if (!prospect.prospect.email && !prospect.prospect.phone) {
        await tx
          .delete(smirkLeadBatchItems)
          .where(
            and(
              eq(smirkLeadBatchItems.batchId, batchId),
              eq(smirkLeadBatchItems.leadId, lead.id)
            )
          );
        continue;
      }
      const prospectPayloadHash = buildSmirkResearchPayloadHash(prospect);
      await tx
        .update(smirkLeadBatchItems)
        .set({ prospectPayloadHash })
        .where(
          and(
            eq(smirkLeadBatchItems.batchId, batchId),
            eq(smirkLeadBatchItems.leadId, lead.id)
          )
        );
      prospects.push(prospect);
    }

    const prospectsHash = hashSmirkLeadBatchValue(prospects);
    const storedResponse: StoredResponse = {
      prospects,
      appliedLearningCandidate: candidate,
      prospectsHash,
      sourceDiscoveryRequestId:
        request.sourceDiscoveryRequestId || null,
    };
    const responsePayload = JSON.stringify(storedResponse);
    const responsePayloadHash = hashSmirkLeadBatchValue(storedResponse);
    const originalState = prospects.length > 0 ? "EXPORTED" : "EMPTY";
    await tx
      .update(smirkLeadBatches)
      .set({
        state: originalState,
        responsePayload,
        responsePayloadHash,
        appliedLearningCandidateId: candidate?.id,
        leadCount: prospects.length,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(smirkLeadBatches.id, batchId),
          eq(smirkLeadBatches.state, "PROCESSING")
        )
      );
    const completedRows = await tx
      .select({
        state: smirkLeadBatches.state,
        responsePayloadHash: smirkLeadBatches.responsePayloadHash,
        leadCount: smirkLeadBatches.leadCount,
      })
      .from(smirkLeadBatches)
      .where(eq(smirkLeadBatches.id, batchId))
      .limit(1);
    if (
      completedRows[0]?.state !== originalState ||
      completedRows[0]?.responsePayloadHash !== responsePayloadHash ||
      completedRows[0]?.leadCount !== prospects.length
    ) {
      throw new SmirkLeadBatchStoreError(
        "The lead batch completion receipt did not change as expected.",
        "SMIRK_LEAD_BATCH_COMPLETION_FAILED",
        500
      );
    }

    return {
      outcome: "created",
      originalState,
      batchId,
      requestPayloadHash,
      prospectsHash,
      prospects,
      appliedLearningCandidate: candidate,
      sourceDiscoveryRequestId:
        request.sourceDiscoveryRequestId || null,
    };
    });
  } catch (error) {
    if (!isDuplicateStorageError(error)) throw error;
    return replayExistingBatch(db, {
      requestId: request.requestId,
      userId: actor.userId,
      requestPayloadHash,
    });
  }
}
