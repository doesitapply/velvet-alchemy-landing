import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import {
  acquisitionSourcingExperimentEvents,
  acquisitionSourcingExperiments,
  acquisitionLearningCandidates,
  smirkDiscoveryLeadItems,
  smirkDiscoveryRequests,
  smirkOutcomeEvents,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  acquisitionSourcingExperimentAssignmentSchema,
  acquisitionSourcingExperimentBindingSchema,
  acquisitionSourcingExperimentDefinitionSchema,
  acquisitionSourcingExperimentEvaluationSchema,
  buildAcquisitionSourcingExperimentAssignment,
  buildAcquisitionSourcingExperimentDefinition,
  buildAcquisitionLearningSnapshotFromSourcingExperiment,
  evaluateAcquisitionSourcingExperiment,
  hashAcquisitionSourcingValue,
  verifyAcquisitionSourcingExperimentAssignment,
  type AcquisitionSourcingExperimentArm,
  type AcquisitionSourcingExperimentAssignment,
  type AcquisitionSourcingExperimentBinding,
  type AcquisitionSourcingExperimentDefinition,
  type AcquisitionSourcingExperimentEvaluation,
  type AcquisitionSourcingExperimentRun,
} from "./acquisitionSourcingExperiment";
import type {
  AcquisitionDimension,
  AcquisitionObservation,
} from "./acquisitionLearning";
import {
  buildAcquisitionLearningCandidateKey,
  hashAcquisitionLearningValue,
  verifyAcquisitionLearningCandidateSnapshot,
} from "./acquisitionLearning";

export class AcquisitionSourcingExperimentStoreError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
  }
}

type StoredExperiment = {
  id: number;
  userId: number;
  experimentId: string;
  workspaceId: number;
  state: "PREPARED" | "ACTIVE" | "CLOSED" | "CANCELLED";
  definition: string;
  definitionHash: string;
  resultPayload: string | null;
  resultPayloadHash: string | null;
  learningCandidateId: number | null;
  preparedBy: number;
  activatedBy: number | null;
  activatedAt: Date | null;
  closedBy: number | null;
  closedAt: Date | null;
  cancelledBy: number | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AcquisitionSourcingExperimentView = {
  rowId: number;
  userId: number;
  experimentId: string;
  workspaceId: number;
  state: StoredExperiment["state"];
  definition: AcquisitionSourcingExperimentDefinition;
  definitionHash: string;
  result: AcquisitionSourcingExperimentEvaluation | null;
  learningCandidateId: number | null;
  assignedRequests: number;
  contactActionAllowed: false;
  spendAuthorized: false;
  policyChanged: false;
  createdAt: Date;
  updatedAt: Date;
};

function selection() {
  return {
    id: acquisitionSourcingExperiments.id,
    userId: acquisitionSourcingExperiments.userId,
    experimentId: acquisitionSourcingExperiments.experimentId,
    workspaceId: acquisitionSourcingExperiments.workspaceId,
    state: acquisitionSourcingExperiments.state,
    definition: acquisitionSourcingExperiments.definition,
    definitionHash: acquisitionSourcingExperiments.definitionHash,
    resultPayload: acquisitionSourcingExperiments.resultPayload,
    resultPayloadHash: acquisitionSourcingExperiments.resultPayloadHash,
    learningCandidateId: acquisitionSourcingExperiments.learningCandidateId,
    preparedBy: acquisitionSourcingExperiments.preparedBy,
    activatedBy: acquisitionSourcingExperiments.activatedBy,
    activatedAt: acquisitionSourcingExperiments.activatedAt,
    closedBy: acquisitionSourcingExperiments.closedBy,
    closedAt: acquisitionSourcingExperiments.closedAt,
    cancelledBy: acquisitionSourcingExperiments.cancelledBy,
    cancelledAt: acquisitionSourcingExperiments.cancelledAt,
    createdAt: acquisitionSourcingExperiments.createdAt,
    updatedAt: acquisitionSourcingExperiments.updatedAt,
  };
}

function parseDefinition(
  row: StoredExperiment
): AcquisitionSourcingExperimentDefinition {
  try {
    const definition = acquisitionSourcingExperimentDefinitionSchema.parse(
      JSON.parse(row.definition)
    );
    if (
      definition.experimentId !== row.experimentId ||
      definition.workspaceId !== row.workspaceId ||
      hashAcquisitionSourcingValue(definition) !== row.definitionHash
    ) {
      throw new Error("definition mismatch");
    }
    return definition;
  } catch {
    throw new AcquisitionSourcingExperimentStoreError(
      "The stored sourcing experiment definition is not verifiable.",
      "ACQUISITION_EXPERIMENT_DEFINITION_INVALID",
      500
    );
  }
}

function parseResult(
  row: StoredExperiment
): AcquisitionSourcingExperimentEvaluation | null {
  if (!row.resultPayload && !row.resultPayloadHash) return null;
  try {
    if (!row.resultPayload || !row.resultPayloadHash) {
      throw new Error("partial result receipt");
    }
    const result = acquisitionSourcingExperimentEvaluationSchema.parse(
      JSON.parse(row.resultPayload)
    );
    if (
      result.experimentId !== row.experimentId ||
      result.definitionHash !== row.definitionHash ||
      hashAcquisitionSourcingValue(result) !== row.resultPayloadHash
    ) {
      throw new Error("result mismatch");
    }
    return result;
  } catch {
    throw new AcquisitionSourcingExperimentStoreError(
      "The stored sourcing experiment result is not verifiable.",
      "ACQUISITION_EXPERIMENT_RESULT_INVALID",
      500
    );
  }
}

function definitionSpecification(
  definition: AcquisitionSourcingExperimentDefinition
): unknown {
  return {
    workspaceId: definition.workspaceId,
    dimension: definition.dimension,
    arms: definition.arms,
    requestsPerArm: definition.requestsPerArm,
    leadsPerRequest: definition.leadsPerRequest,
    contactActionAllowed: false,
    spendAuthorized: false,
  };
}

function duplicateStorageError(error: unknown): boolean {
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

async function appendEvent(
  tx: any,
  input: {
    experimentRowId: number;
    userId: number;
    actorId: number;
    action: string;
    fromState: StoredExperiment["state"] | null;
    toState: StoredExperiment["state"];
    details: Record<string, unknown>;
  }
): Promise<void> {
  const inserted = await tx
    .insert(acquisitionSourcingExperimentEvents)
    .values({
      experimentRowId: input.experimentRowId,
      userId: input.userId,
      actorId: input.actorId,
      action: input.action.slice(0, 80),
      fromState: input.fromState,
      toState: input.toState,
      payloadHash: hashAcquisitionSourcingValue(input.details),
      details: JSON.stringify(input.details),
    })
    .$returningId();
  if (!inserted[0]?.id) {
    throw new AcquisitionSourcingExperimentStoreError(
      "The sourcing experiment audit event was not persisted.",
      "ACQUISITION_EXPERIMENT_AUDIT_FAILED",
      500
    );
  }
}

async function findExperiment(
  db: any,
  experimentId: string,
  lock = false
): Promise<StoredExperiment | null> {
  let query = db
    .select(selection())
    .from(acquisitionSourcingExperiments)
    .where(eq(acquisitionSourcingExperiments.experimentId, experimentId))
    .limit(1);
  if (lock) query = query.for("update");
  const rows = await query;
  return (rows[0] as StoredExperiment | undefined) || null;
}

async function lockExperimentOwner(tx: any, userId: number): Promise<void> {
  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for("update");
  if (!rows[0]) {
    throw new AcquisitionSourcingExperimentStoreError(
      "The sourcing experiment owner does not exist.",
      "ACQUISITION_EXPERIMENT_OWNER_NOT_FOUND",
      404
    );
  }
}

function assertOwner(
  row: StoredExperiment | null,
  userId: number,
  workspaceId?: number
): asserts row is StoredExperiment {
  if (
    !row ||
    row.userId !== userId ||
    (workspaceId !== undefined && row.workspaceId !== workspaceId)
  ) {
    throw new AcquisitionSourcingExperimentStoreError(
      "The sourcing experiment is not available to this owner and workspace.",
      "ACQUISITION_EXPERIMENT_NOT_FOUND",
      404
    );
  }
}

function sameSpecification(
  stored: AcquisitionSourcingExperimentDefinition,
  requested: AcquisitionSourcingExperimentDefinition
): boolean {
  return (
    hashAcquisitionSourcingValue(definitionSpecification(stored)) ===
    hashAcquisitionSourcingValue(definitionSpecification(requested))
  );
}

async function toView(
  db: any,
  row: StoredExperiment
): Promise<AcquisitionSourcingExperimentView> {
  const assigned = await db
    .select({ slot: smirkDiscoveryRequests.acquisitionSourcingSlotOrdinal })
    .from(smirkDiscoveryRequests)
    .where(
      and(
        eq(smirkDiscoveryRequests.userId, row.userId),
        eq(smirkDiscoveryRequests.acquisitionSourcingExperimentId, row.id),
        isNotNull(smirkDiscoveryRequests.acquisitionSourcingSlotOrdinal)
      )
    );
  return {
    rowId: row.id,
    userId: row.userId,
    experimentId: row.experimentId,
    workspaceId: row.workspaceId,
    state: row.state,
    definition: parseDefinition(row),
    definitionHash: row.definitionHash,
    result: parseResult(row),
    learningCandidateId: row.learningCandidateId,
    assignedRequests: assigned.length,
    contactActionAllowed: false,
    spendAuthorized: false,
    policyChanged: false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function prepareAcquisitionSourcingExperiment(input: {
  experimentId: string;
  workspaceId: number;
  dimension: AcquisitionDimension;
  control: AcquisitionSourcingExperimentArm;
  challenger: AcquisitionSourcingExperimentArm;
  requestsPerArm: number;
  leadsPerRequest: number;
  userId: number;
  actorId: number;
  preparedAt?: Date;
}): Promise<{
  outcome: "created" | "duplicate";
  experiment: AcquisitionSourcingExperimentView;
}> {
  const db = await getDb();
  if (!db) {
    throw new AcquisitionSourcingExperimentStoreError(
      "Database unavailable.",
      "ACQUISITION_EXPERIMENT_STORAGE_REQUIRED",
      503
    );
  }
  const requested = buildAcquisitionSourcingExperimentDefinition(input);
  try {
    return await db.transaction(async tx => {
      const existing = await findExperiment(tx, input.experimentId, true);
      if (existing) {
        assertOwner(existing, input.userId, input.workspaceId);
        if (!sameSpecification(parseDefinition(existing), requested)) {
          throw new AcquisitionSourcingExperimentStoreError(
            "This experiment ID is already bound to another definition.",
            "ACQUISITION_EXPERIMENT_IDEMPOTENCY_CONFLICT",
            409
          );
        }
        return {
          outcome: "duplicate" as const,
          experiment: await toView(tx, existing),
        };
      }
      const definition = requested;
      const definitionHash = hashAcquisitionSourcingValue(definition);
      const inserted = await tx
        .insert(acquisitionSourcingExperiments)
        .values({
          userId: input.userId,
          experimentId: definition.experimentId,
          workspaceId: definition.workspaceId,
          state: "PREPARED",
          definition: JSON.stringify(definition),
          definitionHash,
          preparedBy: input.actorId,
        })
        .$returningId();
      const rowId = Number(inserted[0]?.id || 0);
      if (!rowId) {
        throw new AcquisitionSourcingExperimentStoreError(
          "The sourcing experiment receipt was not created.",
          "ACQUISITION_EXPERIMENT_STORAGE_FAILED",
          500
        );
      }
      await appendEvent(tx, {
        experimentRowId: rowId,
        userId: input.userId,
        actorId: input.actorId,
        action: "prepared",
        fromState: null,
        toState: "PREPARED",
        details: {
          experimentId: definition.experimentId,
          definitionHash,
          contactActionAllowed: false,
          spendAuthorized: false,
          policyChanged: false,
        },
      });
      const stored = await findExperiment(tx, input.experimentId);
      if (!stored) {
        throw new AcquisitionSourcingExperimentStoreError(
          "The sourcing experiment could not be read after creation.",
          "ACQUISITION_EXPERIMENT_STORAGE_FAILED",
          500
        );
      }
      return {
        outcome: "created" as const,
        experiment: await toView(tx, stored),
      };
    });
  } catch (error) {
    if (!duplicateStorageError(error)) throw error;
    const existing = await findExperiment(db, input.experimentId);
    assertOwner(existing, input.userId, input.workspaceId);
    if (!sameSpecification(parseDefinition(existing), requested)) {
      throw new AcquisitionSourcingExperimentStoreError(
        "This experiment ID is already bound to another definition.",
        "ACQUISITION_EXPERIMENT_IDEMPOTENCY_CONFLICT",
        409
      );
    }
    return {
      outcome: "duplicate",
      experiment: await toView(db, existing),
    };
  }
}

export async function listAcquisitionSourcingExperiments(
  userId: number,
  limit: number
): Promise<AcquisitionSourcingExperimentView[]> {
  const db = await getDb();
  if (!db) {
    throw new AcquisitionSourcingExperimentStoreError(
      "Database unavailable.",
      "ACQUISITION_EXPERIMENT_STORAGE_REQUIRED",
      503
    );
  }
  const rows = await db
    .select(selection())
    .from(acquisitionSourcingExperiments)
    .where(eq(acquisitionSourcingExperiments.userId, userId))
    .orderBy(desc(acquisitionSourcingExperiments.id))
    .limit(limit);
  return Promise.all(rows.map((row: StoredExperiment) => toView(db, row)));
}

export async function getActiveAcquisitionSourcingExperiment(
  userId: number,
  workspaceId: number
): Promise<AcquisitionSourcingExperimentView | null> {
  const db = await getDb();
  if (!db) {
    throw new AcquisitionSourcingExperimentStoreError(
      "Database unavailable.",
      "ACQUISITION_EXPERIMENT_STORAGE_REQUIRED",
      503
    );
  }
  const rows = await db
    .select(selection())
    .from(acquisitionSourcingExperiments)
    .where(
      and(
        eq(acquisitionSourcingExperiments.userId, userId),
        eq(acquisitionSourcingExperiments.workspaceId, workspaceId),
        eq(acquisitionSourcingExperiments.state, "ACTIVE")
      )
    )
    .orderBy(desc(acquisitionSourcingExperiments.id))
    .limit(2);
  if (rows.length > 1) {
    throw new AcquisitionSourcingExperimentStoreError(
      "More than one active sourcing experiment exists for this workspace.",
      "ACQUISITION_EXPERIMENT_ACTIVE_CONFLICT",
      500
    );
  }
  return rows[0] ? toView(db, rows[0] as StoredExperiment) : null;
}

export async function activateAcquisitionSourcingExperiment(input: {
  experimentId: string;
  definitionHash: string;
  userId: number;
  actorId: number;
}): Promise<AcquisitionSourcingExperimentView> {
  const db = await getDb();
  if (!db) {
    throw new AcquisitionSourcingExperimentStoreError(
      "Database unavailable.",
      "ACQUISITION_EXPERIMENT_STORAGE_REQUIRED",
      503
    );
  }
  return db.transaction(async tx => {
    await lockExperimentOwner(tx, input.userId);
    const row = await findExperiment(tx, input.experimentId, true);
    assertOwner(row, input.userId);
    parseDefinition(row);
    if (row.definitionHash !== input.definitionHash) {
      throw new AcquisitionSourcingExperimentStoreError(
        "The activation does not match the frozen experiment definition.",
        "ACQUISITION_EXPERIMENT_DEFINITION_MISMATCH",
        409
      );
    }
    if (row.state === "ACTIVE") return toView(tx, row);
    if (row.state !== "PREPARED") {
      throw new AcquisitionSourcingExperimentStoreError(
        `A ${row.state} sourcing experiment cannot be activated.`,
        "ACQUISITION_EXPERIMENT_STATE_CONFLICT",
        409
      );
    }
    const otherActive = await tx
      .select({ id: acquisitionSourcingExperiments.id })
      .from(acquisitionSourcingExperiments)
      .where(
        and(
          eq(acquisitionSourcingExperiments.userId, input.userId),
          eq(acquisitionSourcingExperiments.workspaceId, row.workspaceId),
          eq(acquisitionSourcingExperiments.state, "ACTIVE")
        )
      )
      .limit(1)
      .for("update");
    if (otherActive[0]) {
      throw new AcquisitionSourcingExperimentStoreError(
        "Close the active sourcing experiment before activating another for this workspace.",
        "ACQUISITION_EXPERIMENT_ACTIVE_CONFLICT",
        409
      );
    }
    const activatedAt = new Date();
    await tx
      .update(acquisitionSourcingExperiments)
      .set({
        state: "ACTIVE",
        activatedBy: input.actorId,
        activatedAt,
      })
      .where(
        and(
          eq(acquisitionSourcingExperiments.id, row.id),
          eq(acquisitionSourcingExperiments.state, "PREPARED")
        )
      );
    const updated = await findExperiment(tx, input.experimentId);
    if (
      !updated ||
      updated.state !== "ACTIVE" ||
      updated.activatedBy !== input.actorId
    ) {
      throw new AcquisitionSourcingExperimentStoreError(
        "The sourcing experiment activation changed no expected row.",
        "ACQUISITION_EXPERIMENT_ACTIVATION_FAILED",
        500
      );
    }
    await appendEvent(tx, {
      experimentRowId: row.id,
      userId: input.userId,
      actorId: input.actorId,
      action: "activated",
      fromState: "PREPARED",
      toState: "ACTIVE",
      details: {
        experimentId: row.experimentId,
        definitionHash: row.definitionHash,
        contactActionAllowed: false,
        spendAuthorized: false,
        policyChanged: false,
      },
    });
    return toView(tx, updated);
  });
}

export async function cancelAcquisitionSourcingExperiment(input: {
  experimentId: string;
  definitionHash: string;
  userId: number;
  actorId: number;
}): Promise<AcquisitionSourcingExperimentView> {
  const db = await getDb();
  if (!db) {
    throw new AcquisitionSourcingExperimentStoreError(
      "Database unavailable.",
      "ACQUISITION_EXPERIMENT_STORAGE_REQUIRED",
      503
    );
  }
  return db.transaction(async tx => {
    await lockExperimentOwner(tx, input.userId);
    const row = await findExperiment(tx, input.experimentId, true);
    assertOwner(row, input.userId);
    parseDefinition(row);
    if (row.definitionHash !== input.definitionHash) {
      throw new AcquisitionSourcingExperimentStoreError(
        "The cancellation does not match the frozen experiment definition.",
        "ACQUISITION_EXPERIMENT_DEFINITION_MISMATCH",
        409
      );
    }
    if (row.state === "CANCELLED") return toView(tx, row);
    if (row.state !== "PREPARED" && row.state !== "ACTIVE") {
      throw new AcquisitionSourcingExperimentStoreError(
        `A ${row.state} sourcing experiment cannot be cancelled.`,
        "ACQUISITION_EXPERIMENT_STATE_CONFLICT",
        409
      );
    }
    const fromState = row.state;
    await tx
      .update(acquisitionSourcingExperiments)
      .set({
        state: "CANCELLED",
        cancelledBy: input.actorId,
        cancelledAt: new Date(),
      })
      .where(
        and(
          eq(acquisitionSourcingExperiments.id, row.id),
          eq(acquisitionSourcingExperiments.state, fromState)
        )
      );
    const updated = await findExperiment(tx, input.experimentId);
    if (!updated || updated.state !== "CANCELLED") {
      throw new AcquisitionSourcingExperimentStoreError(
        "The sourcing experiment cancellation changed no expected row.",
        "ACQUISITION_EXPERIMENT_CANCELLATION_FAILED",
        500
      );
    }
    const updatedView = await toView(tx, updated);
    await appendEvent(tx, {
      experimentRowId: row.id,
      userId: input.userId,
      actorId: input.actorId,
      action: "cancelled",
      fromState,
      toState: "CANCELLED",
      details: {
        experimentId: row.experimentId,
        definitionHash: row.definitionHash,
        assignedRequests: updatedView.assignedRequests,
        contactActionAllowed: false,
        spendAuthorized: false,
        policyChanged: false,
      },
    });
    return updatedView;
  });
}

export async function assignAcquisitionSourcingExperimentDiscovery(
  tx: any,
  input: {
    binding: AcquisitionSourcingExperimentBinding;
    requestId: string;
    userId: number;
    workspaceId: number;
    apiKeyId: number;
  }
): Promise<{
  experimentRowId: number;
  assignment: AcquisitionSourcingExperimentAssignment;
}> {
  const binding = acquisitionSourcingExperimentBindingSchema.parse(
    input.binding
  );
  const row = await findExperiment(tx, binding.experimentId, true);
  assertOwner(row, input.userId, input.workspaceId);
  const definition = parseDefinition(row);
  if (row.state !== "ACTIVE" || row.definitionHash !== binding.definitionHash) {
    throw new AcquisitionSourcingExperimentStoreError(
      "The requested sourcing experiment is not active at the exact frozen definition.",
      "ACQUISITION_EXPERIMENT_ACTIVE_BINDING_REQUIRED",
      412
    );
  }
  const existingAssignments = await tx
    .select({
      slotOrdinal: smirkDiscoveryRequests.acquisitionSourcingSlotOrdinal,
      payload: smirkDiscoveryRequests.acquisitionSourcingAssignmentPayload,
    })
    .from(smirkDiscoveryRequests)
    .where(
      and(
        eq(smirkDiscoveryRequests.userId, input.userId),
        eq(smirkDiscoveryRequests.acquisitionSourcingExperimentId, row.id)
      )
    )
    .orderBy(asc(smirkDiscoveryRequests.acquisitionSourcingSlotOrdinal));
  const usedSlots = new Set<number>();
  for (const stored of existingAssignments) {
    if (!stored.slotOrdinal || !stored.payload) {
      throw new AcquisitionSourcingExperimentStoreError(
        "A stored sourcing experiment assignment is incomplete.",
        "ACQUISITION_EXPERIMENT_ASSIGNMENT_INVALID",
        500
      );
    }
    let assignment;
    try {
      assignment = verifyAcquisitionSourcingExperimentAssignment({
        definition,
        definitionHash: row.definitionHash,
        assignment: acquisitionSourcingExperimentAssignmentSchema.parse(
          JSON.parse(stored.payload)
        ),
      });
    } catch {
      throw new AcquisitionSourcingExperimentStoreError(
        "A stored sourcing experiment assignment failed verification.",
        "ACQUISITION_EXPERIMENT_ASSIGNMENT_INVALID",
        500
      );
    }
    if (
      assignment.slotOrdinal !== stored.slotOrdinal ||
      usedSlots.has(assignment.slotOrdinal)
    ) {
      throw new AcquisitionSourcingExperimentStoreError(
        "A stored sourcing experiment slot is duplicated or inconsistent.",
        "ACQUISITION_EXPERIMENT_ASSIGNMENT_INVALID",
        500
      );
    }
    usedSlots.add(assignment.slotOrdinal);
  }
  const slot = definition.assignmentSchedule.find(
    candidate => !usedSlots.has(candidate.slotOrdinal)
  );
  if (!slot) {
    throw new AcquisitionSourcingExperimentStoreError(
      "The sourcing experiment has assigned every frozen request slot.",
      "ACQUISITION_EXPERIMENT_COHORT_FULL",
      412
    );
  }
  const assignment = buildAcquisitionSourcingExperimentAssignment({
    definition,
    definitionHash: row.definitionHash,
    requestId: input.requestId,
    slotOrdinal: slot.slotOrdinal,
  });
  await appendEvent(tx, {
    experimentRowId: row.id,
    userId: input.userId,
    actorId: input.apiKeyId,
    action: "request_assigned",
    fromState: "ACTIVE",
    toState: "ACTIVE",
    details: {
      experimentId: row.experimentId,
      definitionHash: row.definitionHash,
      requestId: input.requestId,
      slotOrdinal: assignment.slotOrdinal,
      arm: assignment.arm,
      assignmentHash: assignment.assignmentHash,
      requestedByApiKeyId: input.apiKeyId,
      contactActionAllowed: false,
      spendAuthorized: false,
    },
  });
  return { experimentRowId: row.id, assignment };
}

export async function closeAcquisitionSourcingExperiment(input: {
  experimentId: string;
  definitionHash: string;
  userId: number;
  actorId: number;
}): Promise<AcquisitionSourcingExperimentView> {
  const db = await getDb();
  if (!db) {
    throw new AcquisitionSourcingExperimentStoreError(
      "Database unavailable.",
      "ACQUISITION_EXPERIMENT_STORAGE_REQUIRED",
      503
    );
  }
  return db.transaction(async tx => {
    await lockExperimentOwner(tx, input.userId);
    const row = await findExperiment(tx, input.experimentId, true);
    assertOwner(row, input.userId);
    const definition = parseDefinition(row);
    if (row.definitionHash !== input.definitionHash) {
      throw new AcquisitionSourcingExperimentStoreError(
        "The close request does not match the frozen experiment definition.",
        "ACQUISITION_EXPERIMENT_DEFINITION_MISMATCH",
        409
      );
    }
    if (row.state === "CLOSED") return toView(tx, row);
    if (row.state !== "ACTIVE") {
      throw new AcquisitionSourcingExperimentStoreError(
        `A ${row.state} sourcing experiment cannot be closed.`,
        "ACQUISITION_EXPERIMENT_STATE_CONFLICT",
        409
      );
    }
    const discoveryRows = await tx
      .select({
        id: smirkDiscoveryRequests.id,
        requestId: smirkDiscoveryRequests.requestId,
        workspaceId: smirkDiscoveryRequests.workspaceId,
        state: smirkDiscoveryRequests.state,
        assignmentSlotOrdinal:
          smirkDiscoveryRequests.acquisitionSourcingSlotOrdinal,
        assignmentArm: smirkDiscoveryRequests.acquisitionSourcingArm,
        assignmentPayload:
          smirkDiscoveryRequests.acquisitionSourcingAssignmentPayload,
        assignmentHash:
          smirkDiscoveryRequests.acquisitionSourcingAssignmentHash,
      })
      .from(smirkDiscoveryRequests)
      .where(
        and(
          eq(smirkDiscoveryRequests.userId, input.userId),
          eq(smirkDiscoveryRequests.acquisitionSourcingExperimentId, row.id)
        )
      )
      .orderBy(asc(smirkDiscoveryRequests.acquisitionSourcingSlotOrdinal));
    const discoveryIds = discoveryRows.map(value => value.id);
    const leadItems = discoveryIds.length
      ? await tx
          .select({
            discoveryId: smirkDiscoveryLeadItems.discoveryId,
            leadId: smirkDiscoveryLeadItems.leadId,
          })
          .from(smirkDiscoveryLeadItems)
          .where(
            and(
              eq(smirkDiscoveryLeadItems.userId, input.userId),
              eq(smirkDiscoveryLeadItems.state, "READY"),
              isNotNull(smirkDiscoveryLeadItems.leadId),
              inArray(smirkDiscoveryLeadItems.discoveryId, discoveryIds)
            )
          )
      : [];
    const leadIdsByDiscovery = new Map<number, number[]>();
    for (const item of leadItems) {
      const leadId = Number(item.leadId || 0);
      if (!leadId) continue;
      const ids = leadIdsByDiscovery.get(item.discoveryId) || [];
      ids.push(leadId);
      leadIdsByDiscovery.set(item.discoveryId, ids);
    }
    const readyLeadIds = Array.from(
      new Set(leadItems.map(item => Number(item.leadId || 0)).filter(Boolean))
    );
    const outcomeRows = readyLeadIds.length
      ? await tx
          .select({
            prospectId: smirkOutcomeEvents.leadId,
            channel: smirkOutcomeEvents.channel,
            outcome: smirkOutcomeEvents.outcome,
            occurredAt: smirkOutcomeEvents.occurredAt,
          })
          .from(smirkOutcomeEvents)
          .where(
            and(
              eq(smirkOutcomeEvents.userId, input.userId),
              eq(smirkOutcomeEvents.workspaceId, row.workspaceId),
              inArray(smirkOutcomeEvents.leadId, readyLeadIds)
            )
          )
      : [];
    const runs: AcquisitionSourcingExperimentRun[] = discoveryRows.map(
      discovery => {
        if (
          !discovery.assignmentPayload ||
          !discovery.assignmentSlotOrdinal ||
          !discovery.assignmentArm ||
          !discovery.assignmentHash
        ) {
          throw new AcquisitionSourcingExperimentStoreError(
            "A discovery request has no experiment assignment receipt.",
            "ACQUISITION_EXPERIMENT_ASSIGNMENT_INVALID",
            500
          );
        }
        let assignment: AcquisitionSourcingExperimentAssignment;
        try {
          assignment = verifyAcquisitionSourcingExperimentAssignment({
            definition,
            definitionHash: row.definitionHash,
            assignment: acquisitionSourcingExperimentAssignmentSchema.parse(
              JSON.parse(discovery.assignmentPayload)
            ),
          });
        } catch {
          throw new AcquisitionSourcingExperimentStoreError(
            "A discovery request has an invalid experiment assignment receipt.",
            "ACQUISITION_EXPERIMENT_ASSIGNMENT_INVALID",
            500
          );
        }
        if (
          discovery.workspaceId !== row.workspaceId ||
          assignment.requestId !== discovery.requestId ||
          assignment.slotOrdinal !== discovery.assignmentSlotOrdinal ||
          assignment.arm !== discovery.assignmentArm ||
          assignment.assignmentHash !== discovery.assignmentHash
        ) {
          throw new AcquisitionSourcingExperimentStoreError(
            "A discovery request no longer matches its experiment assignment receipt.",
            "ACQUISITION_EXPERIMENT_ASSIGNMENT_INVALID",
            500
          );
        }
        return {
          assignment,
          discoveryState: discovery.state,
          readyLeadIds: leadIdsByDiscovery.get(discovery.id) || [],
        };
      }
    );
    const observations: AcquisitionObservation[] = outcomeRows.map(outcome => ({
      prospectId: String(outcome.prospectId),
      category: null,
      city: null,
      state: null,
      channel: outcome.channel,
      outcome: outcome.outcome,
      occurredAt: outcome.occurredAt,
    }));
    let result: AcquisitionSourcingExperimentEvaluation;
    try {
      result = evaluateAcquisitionSourcingExperiment({
        definition,
        definitionHash: row.definitionHash,
        runs,
        observations,
      });
    } catch (error) {
      throw new AcquisitionSourcingExperimentStoreError(
        error instanceof Error
          ? error.message
          : "The sourcing experiment evidence is invalid.",
        "ACQUISITION_EXPERIMENT_EVIDENCE_INVALID",
        412
      );
    }
    if (result.status === "INCOMPLETE") {
      throw new AcquisitionSourcingExperimentStoreError(
        `The sourcing experiment cannot close: ${result.code}.`,
        result.code,
        412
      );
    }
    const resultPayload = JSON.stringify(result);
    const resultPayloadHash = hashAcquisitionSourcingValue(result);
    await tx
      .update(acquisitionSourcingExperiments)
      .set({
        state: "CLOSED",
        resultPayload,
        resultPayloadHash,
        closedBy: input.actorId,
        closedAt: new Date(),
      })
      .where(
        and(
          eq(acquisitionSourcingExperiments.id, row.id),
          eq(acquisitionSourcingExperiments.state, "ACTIVE")
        )
      );
    const updated = await findExperiment(tx, input.experimentId);
    if (
      !updated ||
      updated.state !== "CLOSED" ||
      updated.resultPayloadHash !== resultPayloadHash
    ) {
      throw new AcquisitionSourcingExperimentStoreError(
        "The sourcing experiment close changed no expected row.",
        "ACQUISITION_EXPERIMENT_CLOSE_FAILED",
        500
      );
    }
    await appendEvent(tx, {
      experimentRowId: row.id,
      userId: input.userId,
      actorId: input.actorId,
      action: "closed",
      fromState: "ACTIVE",
      toState: "CLOSED",
      details: {
        experimentId: row.experimentId,
        definitionHash: row.definitionHash,
        resultHash: result.resultHash,
        resultPayloadHash,
        recommendationReady: result.status === "RECOMMENDATION_READY",
        contactActionAllowed: false,
        spendAuthorized: false,
        policyChanged: false,
      },
    });
    return toView(tx, updated);
  });
}

export async function proposeCandidateFromAcquisitionSourcingExperiment(input: {
  experimentId: string;
  definitionHash: string;
  resultHash: string;
  userId: number;
  actorId: number;
}): Promise<{
  outcome: "created" | "duplicate";
  candidate: {
    id: number;
    candidateKey: string;
    version: number;
    state: "CANDIDATE" | "APPROVED" | "REJECTED";
    proposal: ReturnType<
      typeof buildAcquisitionLearningSnapshotFromSourcingExperiment
    >["proposal"];
    evidence: ReturnType<
      typeof buildAcquisitionLearningSnapshotFromSourcingExperiment
    >["evidence"];
    proposalHash: string;
    evidenceHash: string;
    sampleSize: number;
  };
  policyChanged: false;
  contactActionAllowed: false;
  spendAuthorized: false;
}> {
  const db = await getDb();
  if (!db) {
    throw new AcquisitionSourcingExperimentStoreError(
      "Database unavailable.",
      "ACQUISITION_EXPERIMENT_STORAGE_REQUIRED",
      503
    );
  }
  return db.transaction(async tx => {
    await lockExperimentOwner(tx, input.userId);
    const row = await findExperiment(tx, input.experimentId, true);
    assertOwner(row, input.userId);
    const definition = parseDefinition(row);
    const result = parseResult(row);
    if (
      row.state !== "CLOSED" ||
      row.definitionHash !== input.definitionHash ||
      !result ||
      result.resultHash !== input.resultHash ||
      result.status !== "RECOMMENDATION_READY"
    ) {
      throw new AcquisitionSourcingExperimentStoreError(
        "Only the exact closed recommendation can be proposed as a candidate.",
        "ACQUISITION_EXPERIMENT_RECOMMENDATION_REQUIRED",
        412
      );
    }
    let snapshot;
    try {
      snapshot = buildAcquisitionLearningSnapshotFromSourcingExperiment({
        definition,
        definitionHash: row.definitionHash,
        evaluation: result,
      });
    } catch (error) {
      throw new AcquisitionSourcingExperimentStoreError(
        error instanceof Error
          ? error.message
          : "The experiment recommendation is not verifiable.",
        "ACQUISITION_EXPERIMENT_RECOMMENDATION_INVALID",
        412
      );
    }
    const candidateKey = buildAcquisitionLearningCandidateKey(
      snapshot.proposal.dimension,
      snapshot.proposal.value
    );
    const proposalHash = hashAcquisitionLearningValue(snapshot.proposal);
    const evidenceHash = hashAcquisitionLearningValue(snapshot.evidence);

    const verifyCandidate = (candidate: {
      id: number;
      candidateKey: string;
      version: number;
      state: "CANDIDATE" | "APPROVED" | "REJECTED";
      proposal: string;
      evidence: string;
      sampleSize: number;
    }) => {
      let stored;
      try {
        stored = verifyAcquisitionLearningCandidateSnapshot({
          proposal: JSON.parse(candidate.proposal),
          evidence: JSON.parse(candidate.evidence),
          sampleSize: candidate.sampleSize,
        });
      } catch {
        throw new AcquisitionSourcingExperimentStoreError(
          "The linked learning candidate is not verifiable.",
          "ACQUISITION_EXPERIMENT_CANDIDATE_INVALID",
          500
        );
      }
      if (
        candidate.candidateKey !== candidateKey ||
        candidate.sampleSize !== snapshot.sampleSize ||
        hashAcquisitionLearningValue(stored.proposal) !== proposalHash ||
        hashAcquisitionLearningValue(stored.evidence) !== evidenceHash
      ) {
        throw new AcquisitionSourcingExperimentStoreError(
          "The linked learning candidate does not match the closed experiment.",
          "ACQUISITION_EXPERIMENT_CANDIDATE_MISMATCH",
          500
        );
      }
      return {
        id: candidate.id,
        candidateKey: candidate.candidateKey,
        version: candidate.version,
        state: candidate.state,
        proposal: stored.proposal,
        evidence: stored.evidence,
        proposalHash,
        evidenceHash,
        sampleSize: candidate.sampleSize,
      };
    };

    if (row.learningCandidateId) {
      const existing = await tx
        .select()
        .from(acquisitionLearningCandidates)
        .where(
          and(
            eq(acquisitionLearningCandidates.id, row.learningCandidateId),
            eq(acquisitionLearningCandidates.userId, input.userId)
          )
        )
        .limit(1)
        .for("update");
      if (!existing[0]) {
        throw new AcquisitionSourcingExperimentStoreError(
          "The experiment candidate pointer has no owner-scoped row.",
          "ACQUISITION_EXPERIMENT_CANDIDATE_MISSING",
          500
        );
      }
      return {
        outcome: "duplicate",
        candidate: verifyCandidate(existing[0]),
        policyChanged: false,
        contactActionAllowed: false,
        spendAuthorized: false,
      };
    }

    const versions = await tx
      .select({ version: acquisitionLearningCandidates.version })
      .from(acquisitionLearningCandidates)
      .where(
        and(
          eq(acquisitionLearningCandidates.userId, input.userId),
          eq(acquisitionLearningCandidates.candidateKey, candidateKey)
        )
      )
      .orderBy(desc(acquisitionLearningCandidates.version))
      .limit(1)
      .for("update");
    const version = Number(versions[0]?.version || 0) + 1;
    const inserted = await tx
      .insert(acquisitionLearningCandidates)
      .values({
        userId: input.userId,
        candidateKey,
        version,
        state: "CANDIDATE",
        proposal: JSON.stringify(snapshot.proposal),
        evidence: JSON.stringify(snapshot.evidence),
        sampleSize: snapshot.sampleSize,
      })
      .$returningId();
    const candidateId = Number(inserted[0]?.id || 0);
    if (!candidateId) {
      throw new AcquisitionSourcingExperimentStoreError(
        "The experiment recommendation candidate was not recorded.",
        "ACQUISITION_EXPERIMENT_CANDIDATE_STORAGE_FAILED",
        500
      );
    }
    await tx
      .update(acquisitionSourcingExperiments)
      .set({ learningCandidateId: candidateId })
      .where(
        and(
          eq(acquisitionSourcingExperiments.id, row.id),
          eq(acquisitionSourcingExperiments.state, "CLOSED"),
          isNull(acquisitionSourcingExperiments.learningCandidateId)
        )
      );
    const updated = await findExperiment(tx, input.experimentId);
    if (!updated || updated.learningCandidateId !== candidateId) {
      throw new AcquisitionSourcingExperimentStoreError(
        "The experiment candidate pointer changed no expected row.",
        "ACQUISITION_EXPERIMENT_CANDIDATE_STORAGE_FAILED",
        500
      );
    }
    const candidates = await tx
      .select()
      .from(acquisitionLearningCandidates)
      .where(
        and(
          eq(acquisitionLearningCandidates.id, candidateId),
          eq(acquisitionLearningCandidates.userId, input.userId)
        )
      )
      .limit(1);
    if (!candidates[0]) {
      throw new AcquisitionSourcingExperimentStoreError(
        "The experiment recommendation candidate could not be re-read.",
        "ACQUISITION_EXPERIMENT_CANDIDATE_STORAGE_FAILED",
        500
      );
    }
    await appendEvent(tx, {
      experimentRowId: row.id,
      userId: input.userId,
      actorId: input.actorId,
      action: "candidate_proposed",
      fromState: "CLOSED",
      toState: "CLOSED",
      details: {
        experimentId: row.experimentId,
        definitionHash: row.definitionHash,
        resultHash: result.resultHash,
        candidateId,
        candidateKey,
        candidateVersion: version,
        proposalHash,
        evidenceHash,
        policyChanged: false,
        contactActionAllowed: false,
        spendAuthorized: false,
      },
    });
    return {
      outcome: "created",
      candidate: verifyCandidate(candidates[0]),
      policyChanged: false,
      contactActionAllowed: false,
      spendAuthorized: false,
    };
  });
}
