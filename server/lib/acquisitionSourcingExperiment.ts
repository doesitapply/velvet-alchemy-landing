import { createHash } from "node:crypto";
import { z } from "zod";
import {
  ACQUISITION_LEARNING_STATISTICAL_TEST,
  ACQUISITION_SOURCING_EXPERIMENT_EVIDENCE_INTERPRETATION,
  ACQUISITION_SOURCING_EXPERIMENT_EVIDENCE_STUDY_DESIGN,
  MAXIMUM_ACQUISITION_FISHER_P_VALUE,
  calculateAcquisitionFisherExactPValue,
  canonicalizeAcquisitionObservations,
  isPositiveAcquisitionOutcome,
  verifyAcquisitionLearningCandidateSnapshot,
  type AcquisitionDimension,
  type AcquisitionLearningEvidence,
  type AcquisitionLearningProposal,
  type AcquisitionObservation,
} from "./acquisitionLearning";

export const ACQUISITION_SOURCING_EXPERIMENT_CONTRACT =
  "velvet.acquisition-sourcing-experiment.v1" as const;
export const ACQUISITION_SOURCING_EXPERIMENT_STUDY_DESIGN =
  ACQUISITION_SOURCING_EXPERIMENT_EVIDENCE_STUDY_DESIGN;
export const ACQUISITION_SOURCING_ASSIGNMENT_CONTRACT =
  "velvet.acquisition-sourcing-assignment.v1" as const;
export const ACQUISITION_SOURCING_BINDING_CONTRACT =
  "smirk-velvet.acquisition-sourcing-binding.v1" as const;
export const ACQUISITION_SOURCING_ASSIGNMENT_BINDING_CONTRACT =
  "smirk-velvet.acquisition-sourcing-assignment-binding.v1" as const;
export const ACQUISITION_SOURCING_ACTIVE_RESPONSE_CONTRACT =
  "velvet-smirk.acquisition-sourcing-active.v1" as const;
export const ACQUISITION_SOURCING_ACTIVATION_CONFIRMATION =
  "activate-one-acquisition-sourcing-experiment-v1" as const;
export const ACQUISITION_SOURCING_CANCELLATION_CONFIRMATION =
  "cancel-one-open-acquisition-sourcing-experiment-v1" as const;
export const ACQUISITION_SOURCING_CLOSE_CONFIRMATION =
  "close-one-acquisition-sourcing-experiment-v1" as const;
export const ACQUISITION_SOURCING_CANDIDATE_CONFIRMATION =
  "propose-one-closed-acquisition-sourcing-candidate-v1" as const;
export const ACQUISITION_SOURCING_MAX_REQUESTS_PER_ARM = 10;
export const ACQUISITION_SOURCING_MAX_TOTAL_LEAD_CAPACITY = 40;
export const ACQUISITION_SOURCING_MIN_MEASURED_PER_ARM = 10;
export const ACQUISITION_SOURCING_MINIMUM_LIFT = 0.05;
export const ACQUISITION_SOURCING_MAXIMUM_FISHER_P_VALUE = 0.05;
export const ACQUISITION_SOURCING_INTERPRETATION =
  ACQUISITION_SOURCING_EXPERIMENT_EVIDENCE_INTERPRETATION;

const SAFE_EXTERNAL_ID = /^[A-Za-z0-9:_-]+$/;
const HASH = /^[a-f0-9]{64}$/;

function stableRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }
  return value;
}

export function hashAcquisitionSourcingValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export const acquisitionSourcingCriteriaSchema = z
  .object({
    category: z.string().trim().min(2).max(120),
    city: z.string().trim().min(1).max(120),
    state: z.string().trim().min(2).max(80),
  })
  .strict();

export type AcquisitionSourcingCriteria = z.infer<
  typeof acquisitionSourcingCriteriaSchema
>;

function normalizeCriteria(
  criteria: AcquisitionSourcingCriteria
): AcquisitionSourcingCriteria {
  return acquisitionSourcingCriteriaSchema.parse({
    category: criteria.category.trim().toLowerCase(),
    city: criteria.city.trim(),
    state: criteria.state.trim().toUpperCase(),
  });
}

const acquisitionSourcingArmSchema = z
  .object({
    label: z.string().trim().min(2).max(100),
    criteria: acquisitionSourcingCriteriaSchema,
  })
  .strict();

const acquisitionSourcingSlotSchema = z
  .object({
    slotOrdinal: z.number().int().positive(),
    arm: z.enum(["control", "challenger"]),
    armOrdinal: z.number().int().positive(),
    selectionHash: z.string().regex(HASH),
  })
  .strict();

export type AcquisitionSourcingExperimentArm = z.infer<
  typeof acquisitionSourcingArmSchema
>;
export type AcquisitionSourcingExperimentSlot = z.infer<
  typeof acquisitionSourcingSlotSchema
>;

function buildAssignmentSchedule(input: {
  experimentId: string;
  workspaceId: number;
  requestsPerArm: number;
}): AcquisitionSourcingExperimentSlot[] {
  const slots: Array<Omit<AcquisitionSourcingExperimentSlot, "slotOrdinal">> =
    [];
  for (const arm of ["control", "challenger"] as const) {
    for (
      let armOrdinal = 1;
      armOrdinal <= input.requestsPerArm;
      armOrdinal += 1
    ) {
      slots.push({
        arm,
        armOrdinal,
        selectionHash: hashAcquisitionSourcingValue({
          contractVersion: ACQUISITION_SOURCING_EXPERIMENT_CONTRACT,
          studyDesign: ACQUISITION_SOURCING_EXPERIMENT_STUDY_DESIGN,
          experimentId: input.experimentId,
          workspaceId: input.workspaceId,
          arm,
          armOrdinal,
        }),
      });
    }
  }
  return slots
    .sort(
      (left, right) =>
        left.selectionHash.localeCompare(right.selectionHash) ||
        left.arm.localeCompare(right.arm) ||
        left.armOrdinal - right.armOrdinal
    )
    .map((slot, index) => ({ ...slot, slotOrdinal: index + 1 }));
}

export const acquisitionSourcingExperimentDefinitionSchema = z
  .object({
    contractVersion: z.literal(ACQUISITION_SOURCING_EXPERIMENT_CONTRACT),
    studyDesign: z.literal(ACQUISITION_SOURCING_EXPERIMENT_STUDY_DESIGN),
    experimentId: z.string().uuid(),
    workspaceId: z.number().int().positive(),
    dimension: z.enum(["category", "metro"]),
    arms: z
      .object({
        control: acquisitionSourcingArmSchema,
        challenger: acquisitionSourcingArmSchema,
      })
      .strict(),
    requestsPerArm: z
      .number()
      .int()
      .min(1)
      .max(ACQUISITION_SOURCING_MAX_REQUESTS_PER_ARM),
    leadsPerRequest: z.number().int().min(1).max(20),
    totalRequestSlots: z.number().int().min(2).max(20),
    totalLeadCapacity: z
      .number()
      .int()
      .min(ACQUISITION_SOURCING_MIN_MEASURED_PER_ARM * 2)
      .max(ACQUISITION_SOURCING_MAX_TOTAL_LEAD_CAPACITY),
    assignmentSchedule: z.array(acquisitionSourcingSlotSchema).min(2).max(20),
    preparedAt: z.string().datetime({ offset: true }),
    contactActionAllowed: z.literal(false),
    spendAuthorized: z.literal(false),
  })
  .strict()
  .superRefine((definition, ctx) => {
    const control = normalizeCriteria(definition.arms.control.criteria);
    const challenger = normalizeCriteria(definition.arms.challenger.criteria);
    if (
      JSON.stringify(control) !==
        JSON.stringify(definition.arms.control.criteria) ||
      JSON.stringify(challenger) !==
        JSON.stringify(definition.arms.challenger.criteria)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["arms"],
        message:
          "Experiment criteria must use normalized lowercase categories and uppercase states.",
      });
    }
    if (definition.dimension === "category") {
      if (
        control.category === challenger.category ||
        control.city.toLowerCase() !== challenger.city.toLowerCase() ||
        control.state !== challenger.state
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["arms"],
          message:
            "A category experiment must hold metro constant and vary only category.",
        });
      }
    } else if (
      control.category !== challenger.category ||
      (control.city.toLowerCase() === challenger.city.toLowerCase() &&
        control.state === challenger.state)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["arms"],
        message:
          "A metro experiment must hold category constant and vary only metro.",
      });
    }
    const totalRequestSlots = definition.requestsPerArm * 2;
    const totalLeadCapacity = totalRequestSlots * definition.leadsPerRequest;
    if (
      definition.totalRequestSlots !== totalRequestSlots ||
      definition.totalLeadCapacity !== totalLeadCapacity ||
      definition.requestsPerArm * definition.leadsPerRequest <
        ACQUISITION_SOURCING_MIN_MEASURED_PER_ARM
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["totalLeadCapacity"],
        message:
          "Experiment capacity must be exact and provide at least ten requested leads per arm.",
      });
    }
    const expectedSchedule = buildAssignmentSchedule(definition);
    if (
      hashAcquisitionSourcingValue(definition.assignmentSchedule) !==
      hashAcquisitionSourcingValue(expectedSchedule)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["assignmentSchedule"],
        message:
          "The assignment schedule does not match deterministic balanced allocation.",
      });
    }
  });

export type AcquisitionSourcingExperimentDefinition = z.infer<
  typeof acquisitionSourcingExperimentDefinitionSchema
>;

export function buildAcquisitionSourcingExperimentDefinition(input: {
  experimentId: string;
  workspaceId: number;
  dimension: AcquisitionDimension;
  control: AcquisitionSourcingExperimentArm;
  challenger: AcquisitionSourcingExperimentArm;
  requestsPerArm: number;
  leadsPerRequest: number;
  preparedAt?: Date;
}): AcquisitionSourcingExperimentDefinition {
  const preparedAt = input.preparedAt || new Date();
  const totalRequestSlots = input.requestsPerArm * 2;
  return acquisitionSourcingExperimentDefinitionSchema.parse({
    contractVersion: ACQUISITION_SOURCING_EXPERIMENT_CONTRACT,
    studyDesign: ACQUISITION_SOURCING_EXPERIMENT_STUDY_DESIGN,
    experimentId: input.experimentId,
    workspaceId: input.workspaceId,
    dimension: input.dimension,
    arms: {
      control: {
        label: input.control.label.trim(),
        criteria: normalizeCriteria(input.control.criteria),
      },
      challenger: {
        label: input.challenger.label.trim(),
        criteria: normalizeCriteria(input.challenger.criteria),
      },
    },
    requestsPerArm: input.requestsPerArm,
    leadsPerRequest: input.leadsPerRequest,
    totalRequestSlots,
    totalLeadCapacity: totalRequestSlots * input.leadsPerRequest,
    assignmentSchedule: buildAssignmentSchedule({
      experimentId: input.experimentId,
      workspaceId: input.workspaceId,
      requestsPerArm: input.requestsPerArm,
    }),
    preparedAt: preparedAt.toISOString(),
    contactActionAllowed: false,
    spendAuthorized: false,
  });
}

export const acquisitionSourcingExperimentBindingSchema = z
  .object({
    contractVersion: z.literal(ACQUISITION_SOURCING_BINDING_CONTRACT),
    experimentId: z.string().uuid(),
    definitionHash: z.string().regex(HASH),
  })
  .strict();

export type AcquisitionSourcingExperimentBinding = z.infer<
  typeof acquisitionSourcingExperimentBindingSchema
>;

export const acquisitionSourcingActiveResponseSchema = z
  .object({
    ok: z.literal(true),
    contractVersion: z.literal(ACQUISITION_SOURCING_ACTIVE_RESPONSE_CONTRACT),
    state: z.enum(["ACTIVE", "NONE"]),
    workspaceId: z.number().int().positive(),
    experiment: z
      .object({
        binding: acquisitionSourcingExperimentBindingSchema,
        dimension: z.enum(["category", "metro"]),
        arms: z
          .object({
            control: acquisitionSourcingArmSchema,
            challenger: acquisitionSourcingArmSchema,
          })
          .strict(),
        requestsPerArm: z.number().int().min(1).max(10),
        leadsPerRequest: z.number().int().min(1).max(20),
        totalRequestSlots: z.number().int().min(2).max(20),
        assignedRequests: z.number().int().nonnegative().max(20),
      })
      .strict()
      .nullable(),
    contactActionAllowed: z.literal(false),
    spendAuthorized: z.literal(false),
    policyChanged: z.literal(false),
    externalAction: z.literal("experiment_status_only"),
  })
  .strict()
  .superRefine((response, ctx) => {
    if ((response.state === "ACTIVE") !== Boolean(response.experiment)) {
      ctx.addIssue({
        code: "custom",
        path: ["experiment"],
        message: "ACTIVE state must contain exactly one experiment.",
      });
    }
    if (
      response.experiment &&
      (response.experiment.binding.experimentId.length === 0 ||
        response.experiment.assignedRequests >
          response.experiment.totalRequestSlots)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["experiment"],
        message: "The active experiment summary is inconsistent.",
      });
    }
  });

export type AcquisitionSourcingActiveResponse = z.infer<
  typeof acquisitionSourcingActiveResponseSchema
>;

const assignmentPayloadSchema = z
  .object({
    contractVersion: z.literal(ACQUISITION_SOURCING_ASSIGNMENT_CONTRACT),
    experimentId: z.string().uuid(),
    definitionHash: z.string().regex(HASH),
    requestId: z.string().min(20).max(160).regex(SAFE_EXTERNAL_ID),
    slotOrdinal: z.number().int().positive().max(20),
    arm: z.enum(["control", "challenger"]),
    armOrdinal: z.number().int().positive().max(10),
    selectionHash: z.string().regex(HASH),
    effectiveCriteria: acquisitionSourcingCriteriaSchema.extend({
      limit: z.number().int().min(1).max(20),
    }),
    contactActionAllowed: z.literal(false),
    spendAuthorized: z.literal(false),
  })
  .strict();

export const acquisitionSourcingExperimentAssignmentSchema =
  assignmentPayloadSchema
    .extend({ assignmentHash: z.string().regex(HASH) })
    .strict()
    .superRefine((assignment, ctx) => {
      const { assignmentHash, ...payload } = assignment;
      if (assignmentHash !== hashAcquisitionSourcingValue(payload)) {
        ctx.addIssue({
          code: "custom",
          path: ["assignmentHash"],
          message: "The sourcing assignment hash is invalid.",
        });
      }
    });

export type AcquisitionSourcingExperimentAssignment = z.infer<
  typeof acquisitionSourcingExperimentAssignmentSchema
>;

export const acquisitionSourcingExperimentAssignmentBindingSchema = z
  .object({
    contractVersion: z.literal(
      ACQUISITION_SOURCING_ASSIGNMENT_BINDING_CONTRACT
    ),
    experimentId: z.string().uuid(),
    definitionHash: z.string().regex(HASH),
    assignmentHash: z.string().regex(HASH),
    sourceDiscoveryRequestId: z
      .string()
      .min(20)
      .max(160)
      .regex(SAFE_EXTERNAL_ID),
    slotOrdinal: z.number().int().positive().max(20),
    arm: z.enum(["control", "challenger"]),
  })
  .strict();

export type AcquisitionSourcingExperimentAssignmentBinding = z.infer<
  typeof acquisitionSourcingExperimentAssignmentBindingSchema
>;

export function buildAcquisitionSourcingExperimentAssignmentBinding(
  assignment: AcquisitionSourcingExperimentAssignment
): AcquisitionSourcingExperimentAssignmentBinding {
  return acquisitionSourcingExperimentAssignmentBindingSchema.parse({
    contractVersion: ACQUISITION_SOURCING_ASSIGNMENT_BINDING_CONTRACT,
    experimentId: assignment.experimentId,
    definitionHash: assignment.definitionHash,
    assignmentHash: assignment.assignmentHash,
    sourceDiscoveryRequestId: assignment.requestId,
    slotOrdinal: assignment.slotOrdinal,
    arm: assignment.arm,
  });
}

export function assignmentMatchesSourceBinding(input: {
  assignment: AcquisitionSourcingExperimentAssignment | null;
  binding: AcquisitionSourcingExperimentAssignmentBinding | undefined;
}): boolean {
  if (!input.binding) return input.assignment === null;
  return Boolean(
    input.assignment &&
      input.assignment.experimentId === input.binding.experimentId &&
      input.assignment.definitionHash === input.binding.definitionHash &&
      input.assignment.assignmentHash === input.binding.assignmentHash &&
      input.assignment.requestId === input.binding.sourceDiscoveryRequestId &&
      input.assignment.slotOrdinal === input.binding.slotOrdinal &&
      input.assignment.arm === input.binding.arm
  );
}

export function buildAcquisitionSourcingExperimentAssignment(input: {
  definition: AcquisitionSourcingExperimentDefinition;
  definitionHash: string;
  requestId: string;
  slotOrdinal: number;
}): AcquisitionSourcingExperimentAssignment {
  const definition = acquisitionSourcingExperimentDefinitionSchema.parse(
    input.definition
  );
  if (hashAcquisitionSourcingValue(definition) !== input.definitionHash) {
    throw new Error("The sourcing experiment definition hash changed.");
  }
  const slot = definition.assignmentSchedule.find(
    candidate => candidate.slotOrdinal === input.slotOrdinal
  );
  if (!slot) {
    throw new Error("The sourcing experiment assignment slot is invalid.");
  }
  const strategy = definition.arms[slot.arm];
  const payload = assignmentPayloadSchema.parse({
    contractVersion: ACQUISITION_SOURCING_ASSIGNMENT_CONTRACT,
    experimentId: definition.experimentId,
    definitionHash: input.definitionHash,
    requestId: input.requestId,
    slotOrdinal: slot.slotOrdinal,
    arm: slot.arm,
    armOrdinal: slot.armOrdinal,
    selectionHash: slot.selectionHash,
    effectiveCriteria: {
      ...strategy.criteria,
      limit: definition.leadsPerRequest,
    },
    contactActionAllowed: false,
    spendAuthorized: false,
  });
  return acquisitionSourcingExperimentAssignmentSchema.parse({
    ...payload,
    assignmentHash: hashAcquisitionSourcingValue(payload),
  });
}

export function verifyAcquisitionSourcingExperimentAssignment(input: {
  definition: AcquisitionSourcingExperimentDefinition;
  definitionHash: string;
  assignment: unknown;
}): AcquisitionSourcingExperimentAssignment {
  const assignment = acquisitionSourcingExperimentAssignmentSchema.parse(
    input.assignment
  );
  const expected = buildAcquisitionSourcingExperimentAssignment({
    definition: input.definition,
    definitionHash: input.definitionHash,
    requestId: assignment.requestId,
    slotOrdinal: assignment.slotOrdinal,
  });
  if (
    hashAcquisitionSourcingValue(assignment) !==
    hashAcquisitionSourcingValue(expected)
  ) {
    throw new Error(
      "The sourcing assignment does not match the frozen experiment."
    );
  }
  return assignment;
}

export type AcquisitionSourcingExperimentRun = {
  assignment: AcquisitionSourcingExperimentAssignment;
  discoveryState:
    | "PREPARED"
    | "APPROVED"
    | "QUEUED"
    | "RUNNING"
    | "COMPLETED"
    | "EMPTY"
    | "PARTIAL"
    | "FAILED"
    | "REJECTED"
    | "CANCELLED"
    | "EXPIRED";
  readyLeadIds: number[];
};

const armCoverageSchema = z
  .object({
    assignedRequests: z.number().int().nonnegative(),
    terminalRequests: z.number().int().nonnegative(),
    requestedLeadCapacity: z.number().int().nonnegative(),
    readyLeads: z.number().int().nonnegative(),
    measuredLeads: z.number().int().nonnegative(),
    positive: z.number().int().nonnegative(),
    positiveRate: z.number().min(0).max(1),
    providerAttrition: z.number().int().nonnegative(),
  })
  .strict();

type ArmCoverage = z.infer<typeof armCoverageSchema>;

const evaluationPayloadSchema = z
  .object({
    status: z.enum([
      "INCOMPLETE",
      "COMPLETE_NO_RECOMMENDATION",
      "RECOMMENDATION_READY",
    ]),
    code: z.enum([
      "ASSIGNMENT_COVERAGE_INCOMPLETE",
      "DISCOVERY_EXECUTION_INCOMPLETE",
      "PROTOCOL_ATTRITION",
      "OUTCOME_COVERAGE_INCOMPLETE",
      "INSUFFICIENT_SAMPLE",
      "NO_MEASURED_LIFT",
      "INSUFFICIENT_CONFIDENCE",
      "READY",
    ]),
    experimentId: z.string().uuid(),
    definitionHash: z.string().regex(HASH),
    interpretation: z.literal(ACQUISITION_SOURCING_INTERPRETATION),
    coverage: z
      .object({
        expectedAssignments: z.number().int().positive(),
        assignedRequests: z.number().int().nonnegative(),
        terminalRequests: z.number().int().nonnegative(),
        readyLeads: z.number().int().nonnegative(),
        measuredLeads: z.number().int().nonnegative(),
        control: armCoverageSchema,
        challenger: armCoverageSchema,
      })
      .strict(),
    winner: z.enum(["control", "challenger"]).nullable(),
    absoluteLift: z.number().min(0).max(1).nullable(),
    oneSidedFisherPValue: z.number().min(0).max(1).nullable(),
    proposal: z
      .object({
        action: z.literal("prioritize_for_next_research_batch"),
        dimension: z.enum(["category", "metro"]),
        value: z.string().trim().min(2).max(160),
        maximumNextBatchSize: z.literal(20),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const acquisitionSourcingExperimentEvaluationSchema =
  evaluationPayloadSchema
    .extend({ resultHash: z.string().regex(HASH) })
    .strict()
    .superRefine((evaluation, ctx) => {
      const { resultHash, ...payload } = evaluation;
      if (resultHash !== hashAcquisitionSourcingValue(payload)) {
        ctx.addIssue({
          code: "custom",
          path: ["resultHash"],
          message: "The sourcing experiment result hash is invalid.",
        });
      }
      if (
        (evaluation.status === "RECOMMENDATION_READY") !==
          (evaluation.code === "READY") ||
        (evaluation.status === "RECOMMENDATION_READY") !==
          Boolean(evaluation.proposal)
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "Only a ready experiment result may contain a recommendation.",
        });
      }
    });

export type AcquisitionSourcingExperimentEvaluation = z.infer<
  typeof acquisitionSourcingExperimentEvaluationSchema
>;

function sourceValue(
  definition: AcquisitionSourcingExperimentDefinition,
  arm: "control" | "challenger"
): string {
  const criteria = definition.arms[arm].criteria;
  return definition.dimension === "category"
    ? criteria.category
    : `${criteria.city}, ${criteria.state}`;
}

export function evaluateAcquisitionSourcingExperiment(input: {
  definition: AcquisitionSourcingExperimentDefinition;
  definitionHash: string;
  runs: AcquisitionSourcingExperimentRun[];
  observations: AcquisitionObservation[];
}): AcquisitionSourcingExperimentEvaluation {
  const definition = acquisitionSourcingExperimentDefinitionSchema.parse(
    input.definition
  );
  if (hashAcquisitionSourcingValue(definition) !== input.definitionHash) {
    throw new Error("The sourcing experiment definition hash changed.");
  }

  const runs = input.runs.map(run => ({
    ...run,
    assignment: verifyAcquisitionSourcingExperimentAssignment({
      definition,
      definitionHash: input.definitionHash,
      assignment: run.assignment,
    }),
    readyLeadIds: Array.from(new Set(run.readyLeadIds)).sort(
      (left, right) => left - right
    ),
  }));
  const slotOrdinals = new Set<number>();
  const requestIds = new Set<string>();
  const readyLeadArm = new Map<number, "control" | "challenger">();
  for (const run of runs) {
    if (
      slotOrdinals.has(run.assignment.slotOrdinal) ||
      requestIds.has(run.assignment.requestId)
    ) {
      throw new Error(
        "A sourcing experiment assignment was enrolled more than once."
      );
    }
    slotOrdinals.add(run.assignment.slotOrdinal);
    requestIds.add(run.assignment.requestId);
    for (const leadId of run.readyLeadIds) {
      if (!Number.isSafeInteger(leadId) || leadId <= 0) {
        throw new Error("Experiment lead IDs must be positive integers.");
      }
      if (readyLeadArm.has(leadId)) {
        throw new Error(
          "A sourced lead was attributed to more than one experiment arm."
        );
      }
      readyLeadArm.set(leadId, run.assignment.arm);
    }
  }

  const canonicalOutcomes = canonicalizeAcquisitionObservations(
    input.observations
  );
  const outcomeByLead = new Map<number, (typeof canonicalOutcomes)[number]>();
  for (const outcome of canonicalOutcomes) {
    const leadId = Number(outcome.prospectId);
    if (!Number.isSafeInteger(leadId) || !readyLeadArm.has(leadId)) {
      throw new Error(
        "Experiment outcomes must reference only assigned ready leads."
      );
    }
    outcomeByLead.set(leadId, outcome);
  }

  const completedStates = new Set(["COMPLETED", "EMPTY", "PARTIAL"]);
  const attritionStates = new Set([
    "FAILED",
    "REJECTED",
    "CANCELLED",
    "EXPIRED",
  ]);
  const coverageFor = (arm: "control" | "challenger"): ArmCoverage => {
    const armRuns = runs.filter(run => run.assignment.arm === arm);
    const leadIds = armRuns.flatMap(run => run.readyLeadIds);
    const outcomes = leadIds
      .map(leadId => outcomeByLead.get(leadId))
      .filter(Boolean) as Array<(typeof canonicalOutcomes)[number]>;
    const requestedLeadCapacity = armRuns.length * definition.leadsPerRequest;
    return {
      assignedRequests: armRuns.length,
      terminalRequests: armRuns.filter(run =>
        completedStates.has(run.discoveryState)
      ).length,
      requestedLeadCapacity,
      readyLeads: leadIds.length,
      measuredLeads: outcomes.length,
      positive: outcomes.filter(outcome =>
        isPositiveAcquisitionOutcome(outcome.outcome)
      ).length,
      positiveRate: outcomes.length
        ? stableRate(
            outcomes.filter(outcome =>
              isPositiveAcquisitionOutcome(outcome.outcome)
            ).length / outcomes.length
          )
        : 0,
      providerAttrition: requestedLeadCapacity - leadIds.length,
    };
  };
  const control = coverageFor("control");
  const challenger = coverageFor("challenger");
  const coverage = {
    expectedAssignments: definition.totalRequestSlots,
    assignedRequests: runs.length,
    terminalRequests: control.terminalRequests + challenger.terminalRequests,
    readyLeads: readyLeadArm.size,
    measuredLeads: outcomeByLead.size,
    control,
    challenger,
  };

  let status: AcquisitionSourcingExperimentEvaluation["status"] = "INCOMPLETE";
  let code: AcquisitionSourcingExperimentEvaluation["code"] =
    "ASSIGNMENT_COVERAGE_INCOMPLETE";
  let winner: "control" | "challenger" | null = null;
  let absoluteLift: number | null = null;
  let oneSidedFisherPValue: number | null = null;
  let proposal: AcquisitionSourcingExperimentEvaluation["proposal"] = null;

  if (runs.length === definition.totalRequestSlots) {
    if (runs.some(run => attritionStates.has(run.discoveryState))) {
      code = "PROTOCOL_ATTRITION";
    } else if (runs.some(run => !completedStates.has(run.discoveryState))) {
      code = "DISCOVERY_EXECUTION_INCOMPLETE";
    } else if (outcomeByLead.size !== readyLeadArm.size) {
      code = "OUTCOME_COVERAGE_INCOMPLETE";
    } else {
      status = "COMPLETE_NO_RECOMMENDATION";
      if (
        control.measuredLeads < ACQUISITION_SOURCING_MIN_MEASURED_PER_ARM ||
        challenger.measuredLeads < ACQUISITION_SOURCING_MIN_MEASURED_PER_ARM
      ) {
        code = "INSUFFICIENT_SAMPLE";
      } else if (control.positiveRate === challenger.positiveRate) {
        code = "NO_MEASURED_LIFT";
      } else {
        winner =
          control.positiveRate > challenger.positiveRate
            ? "control"
            : "challenger";
        const loser = winner === "control" ? challenger : control;
        const winnerCoverage = winner === "control" ? control : challenger;
        absoluteLift = stableRate(
          winnerCoverage.positiveRate - loser.positiveRate
        );
        oneSidedFisherPValue = calculateAcquisitionFisherExactPValue({
          comparisonPositive: loser.positive,
          comparisonSampleSize: loser.measuredLeads,
          segmentPositive: winnerCoverage.positive,
          segmentSampleSize: winnerCoverage.measuredLeads,
        });
        if (absoluteLift < ACQUISITION_SOURCING_MINIMUM_LIFT) {
          code = "NO_MEASURED_LIFT";
        } else if (
          oneSidedFisherPValue > ACQUISITION_SOURCING_MAXIMUM_FISHER_P_VALUE
        ) {
          code = "INSUFFICIENT_CONFIDENCE";
        } else {
          status = "RECOMMENDATION_READY";
          code = "READY";
          proposal = {
            action: "prioritize_for_next_research_batch",
            dimension: definition.dimension,
            value: sourceValue(definition, winner),
            maximumNextBatchSize: 20,
          };
        }
      }
    }
  }

  const result = {
    status,
    code,
    experimentId: definition.experimentId,
    definitionHash: input.definitionHash,
    interpretation: ACQUISITION_SOURCING_INTERPRETATION,
    coverage,
    winner,
    absoluteLift,
    oneSidedFisherPValue,
    proposal,
  };
  return acquisitionSourcingExperimentEvaluationSchema.parse({
    ...result,
    resultHash: hashAcquisitionSourcingValue(result),
  });
}

export function buildAcquisitionLearningSnapshotFromSourcingExperiment(input: {
  definition: AcquisitionSourcingExperimentDefinition;
  definitionHash: string;
  evaluation: AcquisitionSourcingExperimentEvaluation;
}): {
  proposal: AcquisitionLearningProposal;
  evidence: AcquisitionLearningEvidence;
  sampleSize: number;
} {
  const definition = acquisitionSourcingExperimentDefinitionSchema.parse(
    input.definition
  );
  const evaluation = acquisitionSourcingExperimentEvaluationSchema.parse(
    input.evaluation
  );
  if (
    hashAcquisitionSourcingValue(definition) !== input.definitionHash ||
    evaluation.experimentId !== definition.experimentId ||
    evaluation.definitionHash !== input.definitionHash ||
    evaluation.status !== "RECOMMENDATION_READY" ||
    evaluation.code !== "READY" ||
    !evaluation.winner ||
    !evaluation.proposal ||
    evaluation.absoluteLift === null ||
    evaluation.oneSidedFisherPValue === null
  ) {
    throw new Error(
      "Only an exact closed recommendation can become a learning candidate."
    );
  }
  const winnerCoverage = evaluation.coverage[evaluation.winner];
  const loserCoverage =
    evaluation.coverage[
      evaluation.winner === "control" ? "challenger" : "control"
    ];
  const proposal = evaluation.proposal;
  const evidence = {
    studyDesign: ACQUISITION_SOURCING_EXPERIMENT_STUDY_DESIGN,
    interpretation: ACQUISITION_SOURCING_INTERPRETATION,
    source: {
      experimentId: evaluation.experimentId,
      definitionHash: evaluation.definitionHash,
      resultHash: evaluation.resultHash,
      winner: evaluation.winner,
    },
    segment: {
      dimension: proposal.dimension,
      value: proposal.value,
      sampleSize: winnerCoverage.measuredLeads,
      eventCount: winnerCoverage.measuredLeads,
      positive: winnerCoverage.positive,
      positiveRate: winnerCoverage.positiveRate,
    },
    comparisonSampleSize: loserCoverage.measuredLeads,
    comparisonPositive: loserCoverage.positive,
    comparisonPositiveRate: loserCoverage.positiveRate,
    absoluteLift: evaluation.absoluteLift,
    statisticalTest: ACQUISITION_LEARNING_STATISTICAL_TEST,
    oneSidedFisherPValue: evaluation.oneSidedFisherPValue,
    maximumOneSidedFisherPValue: MAXIMUM_ACQUISITION_FISHER_P_VALUE,
  } satisfies AcquisitionLearningEvidence;
  const sampleSize = winnerCoverage.measuredLeads + loserCoverage.measuredLeads;
  return {
    ...verifyAcquisitionLearningCandidateSnapshot({
      proposal,
      evidence,
      sampleSize,
    }),
    sampleSize,
  };
}
