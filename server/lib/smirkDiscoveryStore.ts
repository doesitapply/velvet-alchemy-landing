import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import {
  smirkDiscoveryEvents,
  smirkDiscoveryRequests,
  systemConfig,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  SMIRK_DISCOVERY_APPROVAL_TTL_MS,
  SMIRK_DISCOVERY_RESPONSE_CONTRACT,
  SMIRK_DISCOVERY_STATUS_CONTRACT,
  buildSmirkDiscoveryEffectiveCriteria,
  buildSmirkDiscoveryQuote,
  hashSmirkDiscoveryValue,
  smirkDiscoveryEffectiveCriteriaSchema,
  smirkDiscoveryPreparedResponseSchema,
  smirkDiscoveryQuoteSchema,
  smirkDiscoveryRequestSchema,
  smirkDiscoveryStatusResponseSchema,
  type SmirkDiscoveryPreparedResponse,
  type SmirkDiscoveryRequest,
  type SmirkDiscoveryState,
  type SmirkDiscoveryStatusResponse,
} from "./smirkDiscovery";
import {
  appliedLearningCandidateSchema,
  isReleasedAcquisitionLearningMode,
  type AppliedLearningCandidate,
} from "./smirkLeadBatch";
import { loadCurrentReleasedAcquisitionPolicy } from "./acquisitionLearningPolicyStore";

const DISCOVERY_LEASE_MS = 15 * 60 * 1_000;
const DISCOVERY_WORKER_LOCK_KEY = "smirk_discovery_worker_lock";

export class SmirkDiscoveryStoreError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
  }
}

type DiscoveryActor = {
  userId: number;
  apiKeyId: number;
  apiKeyName: string;
};

type StoredDiscovery = {
  id: number;
  userId: number;
  requestId: string;
  workspaceId: number;
  requestPayload: string;
  requestPayloadHash: string;
  effectiveCriteria: string;
  effectiveCriteriaHash: string;
  appliedLearningCandidatePayload: string | null;
  quotePayload: string;
  quotePayloadHash: string;
  state: SmirkDiscoveryState;
  approvedMaxSpendCents: number | null;
  providerRequests: number;
  createdLeadCount: number;
  readyLeadCount: number;
  skippedLeadCount: number;
  failedLeadCount: number;
  error: string | null;
};

function isDuplicateStorageError(error: unknown): boolean {
  const values = [
    error,
    error && typeof error === "object" && "cause" in error
      ? (error as { cause?: unknown }).cause
      : null,
  ];
  return values.some(value => {
    if (!value || typeof value !== "object") return false;
    const record = value as {
      code?: unknown;
      errno?: unknown;
      sqlState?: unknown;
    };
    return (
      record.code === "ER_DUP_ENTRY" ||
      record.errno === 1062 ||
      record.sqlState === "23000"
    );
  });
}

function parseStoredDiscovery(row: StoredDiscovery): {
  request: SmirkDiscoveryRequest;
  effectiveCriteria: ReturnType<
    typeof smirkDiscoveryEffectiveCriteriaSchema.parse
  >;
  candidate: AppliedLearningCandidate | null;
  quote: ReturnType<typeof smirkDiscoveryQuoteSchema.parse>;
} {
  try {
    const request = smirkDiscoveryRequestSchema.parse(
      JSON.parse(row.requestPayload)
    );
    const effectiveCriteria = smirkDiscoveryEffectiveCriteriaSchema.parse(
      JSON.parse(row.effectiveCriteria)
    );
    const candidate = row.appliedLearningCandidatePayload
      ? appliedLearningCandidateSchema.parse(
          JSON.parse(row.appliedLearningCandidatePayload)
        )
      : null;
    const quote = smirkDiscoveryQuoteSchema.parse(
      JSON.parse(row.quotePayload)
    );
    if (
      hashSmirkDiscoveryValue(request) !== row.requestPayloadHash ||
      hashSmirkDiscoveryValue(effectiveCriteria) !==
        row.effectiveCriteriaHash ||
      hashSmirkDiscoveryValue(quote) !== row.quotePayloadHash
    ) {
      throw new Error("stored hash mismatch");
    }
    return { request, effectiveCriteria, candidate, quote };
  } catch {
    throw new SmirkDiscoveryStoreError(
      "The stored discovery request is not verifiable.",
      "SMIRK_DISCOVERY_STORED_STATE_INVALID",
      500
    );
  }
}

async function appendEvent(
  tx: any,
  input: {
    discoveryId: number;
    userId: number;
    actorType: "smirk_api" | "velvet_user" | "worker" | "system";
    actorId: string;
    action: string;
    fromState: SmirkDiscoveryState | null;
    toState: SmirkDiscoveryState;
    details: Record<string, unknown>;
  }
): Promise<void> {
  const details = JSON.stringify(input.details);
  const inserted = await tx
    .insert(smirkDiscoveryEvents)
    .values({
      discoveryId: input.discoveryId,
      userId: input.userId,
      actorType: input.actorType,
      actorId: input.actorId.slice(0, 160),
      action: input.action.slice(0, 80),
      fromState: input.fromState,
      toState: input.toState,
      payloadHash: hashSmirkDiscoveryValue(input.details),
      details,
    })
    .$returningId();
  if (!inserted[0]?.id) {
    throw new SmirkDiscoveryStoreError(
      "The discovery audit event was not persisted.",
      "SMIRK_DISCOVERY_AUDIT_FAILED",
      500
    );
  }
}

function preparedResponse(
  row: StoredDiscovery,
  outcome: "created" | "duplicate"
): SmirkDiscoveryPreparedResponse {
  const stored = parseStoredDiscovery(row);
  const executionStarted = [
    "QUEUED",
    "RUNNING",
    "COMPLETED",
    "EMPTY",
    "PARTIAL",
    "FAILED",
  ].includes(row.state);
  return smirkDiscoveryPreparedResponseSchema.parse({
    ok: true,
    contractVersion: SMIRK_DISCOVERY_RESPONSE_CONTRACT,
    state: outcome === "duplicate" ? "DUPLICATE" : "PREPARED",
    originalState: "PREPARED",
    currentState: row.state,
    requestId: row.requestId,
    requestPayloadHash: row.requestPayloadHash,
    quotePayloadHash: row.quotePayloadHash,
    discoveryId: row.id,
    effectiveCriteria: stored.effectiveCriteria,
    appliedLearningCandidate: stored.candidate,
    quote: stored.quote,
    approvalRequired: row.state === "PREPARED",
    executionStarted,
    contactActionAllowed: false,
    spendAuthorized: false,
    externalAction:
      row.state === "PREPARED" ? "discovery_approval_required" : "none",
  });
}

function statusResponse(row: StoredDiscovery): SmirkDiscoveryStatusResponse {
  const stored = parseStoredDiscovery(row);
  return smirkDiscoveryStatusResponseSchema.parse({
    ok: true,
    contractVersion: SMIRK_DISCOVERY_STATUS_CONTRACT,
    requestId: row.requestId,
    requestPayloadHash: row.requestPayloadHash,
    quotePayloadHash: row.quotePayloadHash,
    discoveryId: row.id,
    state: row.state,
    effectiveCriteria: stored.effectiveCriteria,
    appliedLearningCandidate: stored.candidate,
    quote: stored.quote,
    createdLeadCount: row.createdLeadCount,
    readyLeadCount: row.readyLeadCount,
    skippedLeadCount: row.skippedLeadCount,
    failedLeadCount: row.failedLeadCount,
    providerRequests: row.providerRequests,
    approvedMaxSpendCents: row.approvedMaxSpendCents,
    error: row.error,
    contactActionAllowed: false,
    externalAction: "discovery_status_only",
  });
}

function selection() {
  return {
    id: smirkDiscoveryRequests.id,
    userId: smirkDiscoveryRequests.userId,
    requestId: smirkDiscoveryRequests.requestId,
    workspaceId: smirkDiscoveryRequests.workspaceId,
    requestPayload: smirkDiscoveryRequests.requestPayload,
    requestPayloadHash: smirkDiscoveryRequests.requestPayloadHash,
    effectiveCriteria: smirkDiscoveryRequests.effectiveCriteria,
    effectiveCriteriaHash: smirkDiscoveryRequests.effectiveCriteriaHash,
    appliedLearningCandidatePayload:
      smirkDiscoveryRequests.appliedLearningCandidatePayload,
    quotePayload: smirkDiscoveryRequests.quotePayload,
    quotePayloadHash: smirkDiscoveryRequests.quotePayloadHash,
    state: smirkDiscoveryRequests.state,
    approvedMaxSpendCents: smirkDiscoveryRequests.approvedMaxSpendCents,
    providerRequests: smirkDiscoveryRequests.providerRequests,
    createdLeadCount: smirkDiscoveryRequests.createdLeadCount,
    readyLeadCount: smirkDiscoveryRequests.readyLeadCount,
    skippedLeadCount: smirkDiscoveryRequests.skippedLeadCount,
    failedLeadCount: smirkDiscoveryRequests.failedLeadCount,
    error: smirkDiscoveryRequests.error,
  };
}

async function findByRequestId(
  db: any,
  requestId: string
): Promise<StoredDiscovery | null> {
  const rows = await db
    .select(selection())
    .from(smirkDiscoveryRequests)
    .where(eq(smirkDiscoveryRequests.requestId, requestId))
    .limit(1);
  return (rows[0] as StoredDiscovery | undefined) || null;
}

async function replayPrepared(
  db: any,
  input: {
    requestId: string;
    userId: number;
    requestPayloadHash: string;
  }
): Promise<SmirkDiscoveryPreparedResponse> {
  const existing = await findByRequestId(db, input.requestId);
  if (
    !existing ||
    existing.userId !== input.userId ||
    existing.requestPayloadHash !== input.requestPayloadHash
  ) {
    throw new SmirkDiscoveryStoreError(
      "This request ID is already bound to another discovery request.",
      "SMIRK_DISCOVERY_IDEMPOTENCY_CONFLICT",
      409
    );
  }
  return preparedResponse(existing, "duplicate");
}

export async function prepareSmirkDiscovery(
  request: SmirkDiscoveryRequest,
  actor: DiscoveryActor
): Promise<{
  outcome: "created" | "duplicate";
  response: SmirkDiscoveryPreparedResponse;
}> {
  const db = await getDb();
  if (!db) {
    throw new SmirkDiscoveryStoreError(
      "Database unavailable.",
      "SMIRK_DISCOVERY_STORAGE_REQUIRED",
      503
    );
  }
  const requestPayloadHash = hashSmirkDiscoveryValue(request);
  try {
    return await db.transaction(async tx => {
      const existing = await findByRequestId(tx, request.requestId);
      if (existing) {
        if (
          existing.userId !== actor.userId ||
          existing.requestPayloadHash !== requestPayloadHash
        ) {
          throw new SmirkDiscoveryStoreError(
            "This request ID is already bound to another discovery request.",
            "SMIRK_DISCOVERY_IDEMPOTENCY_CONFLICT",
            409
          );
        }
        return {
          outcome: "duplicate" as const,
          response: preparedResponse(existing, "duplicate"),
        };
      }

      let candidate: AppliedLearningCandidate | null = null;
      if (
        isReleasedAcquisitionLearningMode(
          request.criteria.learningMode
        )
      ) {
        const policy = await loadCurrentReleasedAcquisitionPolicy(
          tx,
          actor.userId
        );
        if (policy.state === "INVALID") {
          throw new SmirkDiscoveryStoreError(
            "The released sourcing policy failed integrity verification.",
            "SMIRK_DISCOVERY_LEARNING_POLICY_INVALID",
            412
          );
        }
        if (policy.state !== "ACTIVE") {
          throw new SmirkDiscoveryStoreError(
            "No released sourcing policy is available.",
            "SMIRK_DISCOVERY_LEARNING_RELEASE_REQUIRED",
            412
          );
        }
        candidate = policy.candidate;
      }
      let effectiveCriteria;
      let quote;
      try {
        effectiveCriteria = buildSmirkDiscoveryEffectiveCriteria({
          request,
          candidate,
        });
        quote = buildSmirkDiscoveryQuote(effectiveCriteria);
      } catch (error) {
        throw new SmirkDiscoveryStoreError(
          error instanceof Error
            ? error.message
            : "The discovery request cannot be quoted.",
          "SMIRK_DISCOVERY_QUOTE_REJECTED",
          412
        );
      }
      const effectiveCriteriaHash =
        hashSmirkDiscoveryValue(effectiveCriteria);
      const quotePayloadHash = hashSmirkDiscoveryValue(quote);
      const inserted = await tx
        .insert(smirkDiscoveryRequests)
        .values({
          userId: actor.userId,
          requestId: request.requestId,
          workspaceId: request.workspaceId,
          requestedByApiKeyId: actor.apiKeyId,
          requestedByApiKeyName: actor.apiKeyName,
          requestPayload: JSON.stringify(request),
          requestPayloadHash,
          effectiveCriteria: JSON.stringify(effectiveCriteria),
          effectiveCriteriaHash,
          appliedLearningCandidateId: candidate?.id,
          appliedLearningCandidatePayload: candidate
            ? JSON.stringify(candidate)
            : null,
          quotePayload: JSON.stringify(quote),
          quotePayloadHash,
          state: "PREPARED",
          expiresAt: new Date(
            Date.now() + SMIRK_DISCOVERY_APPROVAL_TTL_MS
          ),
        })
        .$returningId();
      const discoveryId = Number(inserted[0]?.id || 0);
      if (!discoveryId) {
        throw new SmirkDiscoveryStoreError(
          "The discovery request receipt was not created.",
          "SMIRK_DISCOVERY_STORAGE_FAILED",
          500
        );
      }
      await appendEvent(tx, {
        discoveryId,
        userId: actor.userId,
        actorType: "smirk_api",
        actorId: String(actor.apiKeyId),
        action: "prepared",
        fromState: null,
        toState: "PREPARED",
        details: {
          requestPayloadHash,
          effectiveCriteriaHash,
          quotePayloadHash,
          contactActionAllowed: false,
          spendAuthorized: false,
        },
      });
      const stored = await findByRequestId(tx, request.requestId);
      if (!stored) {
        throw new SmirkDiscoveryStoreError(
          "The discovery request could not be read after creation.",
          "SMIRK_DISCOVERY_STORAGE_FAILED",
          500
        );
      }
      return {
        outcome: "created" as const,
        response: preparedResponse(stored, "created"),
      };
    });
  } catch (error) {
    if (!isDuplicateStorageError(error)) throw error;
    return {
      outcome: "duplicate",
      response: await replayPrepared(db, {
        requestId: request.requestId,
        userId: actor.userId,
        requestPayloadHash,
      }),
    };
  }
}

export async function getSmirkDiscoveryStatus(
  requestId: string,
  userId: number
): Promise<SmirkDiscoveryStatusResponse> {
  const db = await getDb();
  if (!db) {
    throw new SmirkDiscoveryStoreError(
      "Database unavailable.",
      "SMIRK_DISCOVERY_STORAGE_REQUIRED",
      503
    );
  }
  const row = await findByRequestId(db, requestId);
  if (!row || row.userId !== userId) {
    throw new SmirkDiscoveryStoreError(
      "Discovery request not found.",
      "SMIRK_DISCOVERY_NOT_FOUND",
      404
    );
  }
  return statusResponse(row);
}

export async function listSmirkDiscoveries(
  userId: number,
  limit = 25
): Promise<SmirkDiscoveryStatusResponse[]> {
  const db = await getDb();
  if (!db) {
    throw new SmirkDiscoveryStoreError(
      "Database unavailable.",
      "SMIRK_DISCOVERY_STORAGE_REQUIRED",
      503
    );
  }
  const rows = await db
    .select(selection())
    .from(smirkDiscoveryRequests)
    .where(eq(smirkDiscoveryRequests.userId, userId))
    .orderBy(desc(smirkDiscoveryRequests.createdAt))
    .limit(Math.min(100, Math.max(1, limit)));
  return rows.map(row => statusResponse(row as StoredDiscovery));
}

type ApprovalInput = {
  discoveryId: number;
  userId: number;
  actorId: number;
  requestPayloadHash: string;
  quotePayloadHash: string;
  approvedMaxSpendCents: number;
};

export async function approveSmirkDiscovery(
  input: ApprovalInput
): Promise<SmirkDiscoveryStatusResponse> {
  const db = await getDb();
  if (!db) {
    throw new SmirkDiscoveryStoreError(
      "Database unavailable.",
      "SMIRK_DISCOVERY_STORAGE_REQUIRED",
      503
    );
  }
  const result = await db.transaction(async tx => {
    const rows = await tx
      .select({
        ...selection(),
        expiresAt: smirkDiscoveryRequests.expiresAt,
      })
      .from(smirkDiscoveryRequests)
      .where(
        and(
          eq(smirkDiscoveryRequests.id, input.discoveryId),
          eq(smirkDiscoveryRequests.userId, input.userId)
        )
      )
      .limit(1)
      .for("update");
    const row = rows[0] as (StoredDiscovery & { expiresAt: Date }) | undefined;
    if (!row) {
      throw new SmirkDiscoveryStoreError(
        "Discovery request not found.",
        "SMIRK_DISCOVERY_NOT_FOUND",
        404
      );
    }
    if (row.state !== "PREPARED") {
      throw new SmirkDiscoveryStoreError(
        "Only a prepared discovery request can be approved.",
        "SMIRK_DISCOVERY_STATE_CONFLICT",
        409
      );
    }
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      await tx
        .update(smirkDiscoveryRequests)
        .set({ state: "EXPIRED", completedAt: new Date() })
        .where(
          and(
            eq(smirkDiscoveryRequests.id, row.id),
            eq(smirkDiscoveryRequests.state, "PREPARED")
          )
        );
      await appendEvent(tx, {
        discoveryId: row.id,
        userId: row.userId,
        actorType: "system",
        actorId: "expiration",
        action: "expired",
        fromState: "PREPARED",
        toState: "EXPIRED",
        details: { expiresAt: new Date(row.expiresAt).toISOString() },
      });
      return { expired: true as const };
    }
    const stored = parseStoredDiscovery(row);
    if (
      row.requestPayloadHash !== input.requestPayloadHash ||
      row.quotePayloadHash !== input.quotePayloadHash ||
      stored.quote.maximumCostCents !== input.approvedMaxSpendCents
    ) {
      throw new SmirkDiscoveryStoreError(
        "The approval does not match the immutable request and quote.",
        "SMIRK_DISCOVERY_APPROVAL_MISMATCH",
        409
      );
    }
    const approvalPayloadHash = hashSmirkDiscoveryValue({
      discoveryId: row.id,
      requestPayloadHash: row.requestPayloadHash,
      quotePayloadHash: row.quotePayloadHash,
      approvedMaxSpendCents: input.approvedMaxSpendCents,
      contactActionAllowed: false,
    });
    const updated = await tx
      .update(smirkDiscoveryRequests)
      .set({
        state: "APPROVED",
        approvalPayloadHash,
        approvedMaxSpendCents: input.approvedMaxSpendCents,
        approvedBy: input.actorId,
        approvedAt: new Date(),
      })
      .where(
        and(
          eq(smirkDiscoveryRequests.id, row.id),
          eq(smirkDiscoveryRequests.state, "PREPARED")
        )
      );
    if (Number(updated[0]?.affectedRows ?? 0) !== 1) {
      throw new SmirkDiscoveryStoreError(
        "The discovery approval did not change the expected row.",
        "SMIRK_DISCOVERY_APPROVAL_FAILED",
        409
      );
    }
    await appendEvent(tx, {
      discoveryId: row.id,
      userId: row.userId,
      actorType: "velvet_user",
      actorId: String(input.actorId),
      action: "approved",
      fromState: "PREPARED",
      toState: "APPROVED",
      details: {
        approvalPayloadHash,
        approvedMaxSpendCents: input.approvedMaxSpendCents,
        contactActionAllowed: false,
      },
    });
    const refreshed = await findByRequestId(tx, row.requestId);
    if (!refreshed || refreshed.state !== "APPROVED") {
      throw new SmirkDiscoveryStoreError(
        "The approved discovery state could not be verified.",
        "SMIRK_DISCOVERY_APPROVAL_FAILED",
        500
      );
    }
    return { expired: false as const, response: statusResponse(refreshed) };
  });
  if (result.expired) {
    throw new SmirkDiscoveryStoreError(
      "The discovery request expired before approval.",
      "SMIRK_DISCOVERY_EXPIRED",
      410
    );
  }
  return result.response;
}

export async function queueSmirkDiscovery(input: {
  discoveryId: number;
  userId: number;
  actorId: number;
  requestPayloadHash: string;
  quotePayloadHash: string;
}): Promise<SmirkDiscoveryStatusResponse> {
  const db = await getDb();
  if (!db) {
    throw new SmirkDiscoveryStoreError(
      "Database unavailable.",
      "SMIRK_DISCOVERY_STORAGE_REQUIRED",
      503
    );
  }
  return db.transaction(async tx => {
    const rows = await tx
      .select(selection())
      .from(smirkDiscoveryRequests)
      .where(
        and(
          eq(smirkDiscoveryRequests.id, input.discoveryId),
          eq(smirkDiscoveryRequests.userId, input.userId)
        )
      )
      .limit(1)
      .for("update");
    const row = rows[0] as StoredDiscovery | undefined;
    if (!row) {
      throw new SmirkDiscoveryStoreError(
        "Discovery request not found.",
        "SMIRK_DISCOVERY_NOT_FOUND",
        404
      );
    }
    if (
      row.state !== "APPROVED" ||
      row.requestPayloadHash !== input.requestPayloadHash ||
      row.quotePayloadHash !== input.quotePayloadHash
    ) {
      throw new SmirkDiscoveryStoreError(
        "The execution request does not match one approved discovery.",
        "SMIRK_DISCOVERY_EXECUTION_MISMATCH",
        409
      );
    }
    const stored = parseStoredDiscovery(row);
    const currentQuote = buildSmirkDiscoveryQuote(
      stored.effectiveCriteria,
      process.env,
      new Date(stored.quote.quotedAt)
    );
    if (
      currentQuote.costCentsPerRequest !==
        stored.quote.costCentsPerRequest ||
      currentQuote.maximumCostCents !== stored.quote.maximumCostCents ||
      row.approvedMaxSpendCents !== stored.quote.maximumCostCents
    ) {
      throw new SmirkDiscoveryStoreError(
        "The provider cost configuration changed after approval.",
        "SMIRK_DISCOVERY_QUOTE_CHANGED",
        412
      );
    }
    const updated = await tx
      .update(smirkDiscoveryRequests)
      .set({
        state: "QUEUED",
        queuedBy: input.actorId,
        queuedAt: new Date(),
      })
      .where(
        and(
          eq(smirkDiscoveryRequests.id, row.id),
          eq(smirkDiscoveryRequests.state, "APPROVED")
        )
      );
    if (Number(updated[0]?.affectedRows ?? 0) !== 1) {
      throw new SmirkDiscoveryStoreError(
        "The approved discovery was not queued.",
        "SMIRK_DISCOVERY_QUEUE_FAILED",
        409
      );
    }
    await appendEvent(tx, {
      discoveryId: row.id,
      userId: row.userId,
      actorType: "velvet_user",
      actorId: String(input.actorId),
      action: "queued",
      fromState: "APPROVED",
      toState: "QUEUED",
      details: {
        requestPayloadHash: row.requestPayloadHash,
        quotePayloadHash: row.quotePayloadHash,
      },
    });
    const refreshed = await findByRequestId(tx, row.requestId);
    if (!refreshed || refreshed.state !== "QUEUED") {
      throw new SmirkDiscoveryStoreError(
        "The queued discovery state could not be verified.",
        "SMIRK_DISCOVERY_QUEUE_FAILED",
        500
      );
    }
    return statusResponse(refreshed);
  });
}

export async function decideSmirkDiscovery(input: {
  discoveryId: number;
  userId: number;
  actorId: number;
  decision: "REJECTED" | "CANCELLED";
}): Promise<SmirkDiscoveryStatusResponse> {
  const db = await getDb();
  if (!db) {
    throw new SmirkDiscoveryStoreError(
      "Database unavailable.",
      "SMIRK_DISCOVERY_STORAGE_REQUIRED",
      503
    );
  }
  return db.transaction(async tx => {
    const rows = await tx
      .select(selection())
      .from(smirkDiscoveryRequests)
      .where(
        and(
          eq(smirkDiscoveryRequests.id, input.discoveryId),
          eq(smirkDiscoveryRequests.userId, input.userId)
        )
      )
      .limit(1)
      .for("update");
    const row = rows[0] as StoredDiscovery | undefined;
    if (!row) {
      throw new SmirkDiscoveryStoreError(
        "Discovery request not found.",
        "SMIRK_DISCOVERY_NOT_FOUND",
        404
      );
    }
    const allowed =
      input.decision === "REJECTED"
        ? ["PREPARED"]
        : ["PREPARED", "APPROVED", "QUEUED"];
    if (!allowed.includes(row.state)) {
      throw new SmirkDiscoveryStoreError(
        "The discovery request can no longer be changed.",
        "SMIRK_DISCOVERY_STATE_CONFLICT",
        409
      );
    }
    const updated = await tx
      .update(smirkDiscoveryRequests)
      .set({ state: input.decision, completedAt: new Date() })
      .where(
        and(
          eq(smirkDiscoveryRequests.id, row.id),
          eq(smirkDiscoveryRequests.state, row.state)
        )
      );
    if (Number(updated[0]?.affectedRows ?? 0) !== 1) {
      throw new SmirkDiscoveryStoreError(
        "The discovery decision did not change the expected row.",
        "SMIRK_DISCOVERY_DECISION_FAILED",
        409
      );
    }
    await appendEvent(tx, {
      discoveryId: row.id,
      userId: row.userId,
      actorType: "velvet_user",
      actorId: String(input.actorId),
      action: input.decision.toLowerCase(),
      fromState: row.state,
      toState: input.decision,
      details: { contactActionAllowed: false },
    });
    const refreshed = await findByRequestId(tx, row.requestId);
    if (!refreshed || refreshed.state !== input.decision) {
      throw new SmirkDiscoveryStoreError(
        "The discovery decision could not be verified.",
        "SMIRK_DISCOVERY_DECISION_FAILED",
        500
      );
    }
    return statusResponse(refreshed);
  });
}

export type ClaimedSmirkDiscovery = {
  discoveryId: number;
  userId: number;
  requestId: string;
  executionToken: string;
  effectiveCriteria: ReturnType<
    typeof smirkDiscoveryEffectiveCriteriaSchema.parse
  >;
  quote: ReturnType<typeof smirkDiscoveryQuoteSchema.parse>;
  approvedMaxSpendCents: number;
};

export async function claimNextSmirkDiscovery(): Promise<ClaimedSmirkDiscovery | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async tx => {
    const lockRows = await tx
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, DISCOVERY_WORKER_LOCK_KEY))
      .limit(1)
      .for("update");
    if (!lockRows[0]) {
      throw new SmirkDiscoveryStoreError(
        "The discovery worker lock is not initialized.",
        "SMIRK_DISCOVERY_WORKER_LOCK_MISSING",
        503
      );
    }
    const globalSwitchRows = await tx
      .select({ value: systemConfig.value })
      .from(systemConfig)
      .where(eq(systemConfig.key, "global_kill_switch"))
      .limit(1);
    if (
      !globalSwitchRows[0] ||
      globalSwitchRows[0].value !== "false"
    ) {
      return null;
    }
    const now = new Date();
    const staleRows = await tx
      .select(selection())
      .from(smirkDiscoveryRequests)
      .where(
        and(
          eq(smirkDiscoveryRequests.state, "RUNNING"),
          lte(smirkDiscoveryRequests.leaseExpiresAt, now)
        )
      )
      .orderBy(asc(smirkDiscoveryRequests.createdAt))
      .limit(1)
      .for("update");
    const stale = staleRows[0] as StoredDiscovery | undefined;
    if (stale) {
      await tx
        .update(smirkDiscoveryRequests)
        .set({
          state: "FAILED",
          error:
            "Execution lease expired with an uncertain provider outcome; automatic retry is disabled.",
          completedAt: now,
        })
        .where(
          and(
            eq(smirkDiscoveryRequests.id, stale.id),
            eq(smirkDiscoveryRequests.state, "RUNNING")
          )
        );
      await appendEvent(tx, {
        discoveryId: stale.id,
        userId: stale.userId,
        actorType: "system",
        actorId: "lease-expiration",
        action: "lease_expired",
        fromState: "RUNNING",
        toState: "FAILED",
        details: { automaticRetry: false, outcome: "uncertain" },
      });
      return null;
    }
    const activeRows = await tx
      .select({ id: smirkDiscoveryRequests.id })
      .from(smirkDiscoveryRequests)
      .where(
        and(
          eq(smirkDiscoveryRequests.state, "RUNNING"),
          gt(smirkDiscoveryRequests.leaseExpiresAt, now)
        )
      )
      .limit(1);
    if (activeRows[0]) return null;
    const queuedRows = await tx
      .select(selection())
      .from(smirkDiscoveryRequests)
      .where(eq(smirkDiscoveryRequests.state, "QUEUED"))
      .orderBy(asc(smirkDiscoveryRequests.createdAt))
      .limit(1)
      .for("update");
    const queued = queuedRows[0] as StoredDiscovery | undefined;
    if (!queued) return null;
    const userSwitchRows = await tx
      .select({ value: systemConfig.value })
      .from(systemConfig)
      .where(
        eq(systemConfig.key, `user_kill_switch_${queued.userId}`)
      )
      .limit(1);
    if (userSwitchRows[0]?.value === "true") return null;
    const executionToken = randomUUID().replace(/-/g, "");
    const updated = await tx
      .update(smirkDiscoveryRequests)
      .set({
        state: "RUNNING",
        executionToken,
        leaseExpiresAt: new Date(now.getTime() + DISCOVERY_LEASE_MS),
        error: null,
      })
      .where(
        and(
          eq(smirkDiscoveryRequests.id, queued.id),
          eq(smirkDiscoveryRequests.state, "QUEUED")
        )
      );
    if (Number(updated[0]?.affectedRows ?? 0) !== 1) return null;
    await appendEvent(tx, {
      discoveryId: queued.id,
      userId: queued.userId,
      actorType: "worker",
      actorId: executionToken,
      action: "claimed",
      fromState: "QUEUED",
      toState: "RUNNING",
      details: { leaseMs: DISCOVERY_LEASE_MS },
    });
    const stored = parseStoredDiscovery(queued);
    if (
      queued.approvedMaxSpendCents !== stored.quote.maximumCostCents
    ) {
      throw new SmirkDiscoveryStoreError(
        "The queued discovery no longer matches its approved spend cap.",
        "SMIRK_DISCOVERY_APPROVAL_INVALID",
        409
      );
    }
    return {
      discoveryId: queued.id,
      userId: queued.userId,
      requestId: queued.requestId,
      executionToken,
      effectiveCriteria: stored.effectiveCriteria,
      quote: stored.quote,
      approvedMaxSpendCents: queued.approvedMaxSpendCents,
    };
  });
}

export async function completeSmirkDiscovery(input: {
  discoveryId: number;
  userId: number;
  executionToken: string;
  state: "COMPLETED" | "EMPTY" | "PARTIAL" | "FAILED";
  providerRequests: number;
  createdLeadCount: number;
  readyLeadCount: number;
  skippedLeadCount: number;
  failedLeadCount: number;
  result: Record<string, unknown>;
  error?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new SmirkDiscoveryStoreError(
      "Database unavailable while completing discovery.",
      "SMIRK_DISCOVERY_COMPLETION_STORAGE_REQUIRED",
      503
    );
  }
  await db.transaction(async tx => {
    const resultPayload = JSON.stringify(input.result);
    const resultPayloadHash = hashSmirkDiscoveryValue(input.result);
    const updated = await tx
      .update(smirkDiscoveryRequests)
      .set({
        state: input.state,
        providerRequests: input.providerRequests,
        createdLeadCount: input.createdLeadCount,
        readyLeadCount: input.readyLeadCount,
        skippedLeadCount: input.skippedLeadCount,
        failedLeadCount: input.failedLeadCount,
        resultPayload,
        resultPayloadHash,
        error: input.error || null,
        executionToken: null,
        leaseExpiresAt: null,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(smirkDiscoveryRequests.id, input.discoveryId),
          eq(smirkDiscoveryRequests.userId, input.userId),
          eq(smirkDiscoveryRequests.state, "RUNNING"),
          eq(smirkDiscoveryRequests.executionToken, input.executionToken)
        )
      );
    if (Number(updated[0]?.affectedRows ?? 0) !== 1) {
      throw new SmirkDiscoveryStoreError(
        "The discovery completion did not match the active lease.",
        "SMIRK_DISCOVERY_COMPLETION_MISMATCH",
        409
      );
    }
    await appendEvent(tx, {
      discoveryId: input.discoveryId,
      userId: input.userId,
      actorType: "worker",
      actorId: input.executionToken,
      action: "completed",
      fromState: "RUNNING",
      toState: input.state,
      details: {
        resultPayloadHash,
        providerRequests: input.providerRequests,
        createdLeadCount: input.createdLeadCount,
        readyLeadCount: input.readyLeadCount,
        skippedLeadCount: input.skippedLeadCount,
        failedLeadCount: input.failedLeadCount,
      },
    });
  });
}
