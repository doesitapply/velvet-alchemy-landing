import { createHash } from "node:crypto";
import { z } from "zod";

export const MINIMUM_ACQUISITION_SEGMENT_SAMPLE = 10;
export const MINIMUM_ACQUISITION_LIFT = 0.05;
export const ACQUISITION_LEARNING_STUDY_DESIGN =
  "observational-segment-comparison-v1" as const;
export const ACQUISITION_LEARNING_STATISTICAL_TEST =
  "fisher-exact-one-sided-v1" as const;
export const MAXIMUM_ACQUISITION_FISHER_P_VALUE = 0.05;
export const ACQUISITION_LEARNING_INTERPRETATION =
  "Outcome-linked segment association only. Operator selection and market mix remain possible confounders; this receipt may support a bounded human release but does not establish causation or authorize contact, provider execution, or spend." as const;
export const ACQUISITION_SOURCING_EXPERIMENT_EVIDENCE_STUDY_DESIGN =
  "deterministic-balanced-source-allocation-v1" as const;
export const ACQUISITION_SOURCING_EXPERIMENT_EVIDENCE_INTERPRETATION =
  "Predeclared equal source allocation with immutable request assignment. It removes operator arm selection after activation, but provider yield, market composition, and nonresponse can still confound results. The receipt can support human review only and authorizes no contact, provider execution, or spend." as const;

export type AcquisitionOutcome =
  | "delivered"
  | "bounced"
  | "replied"
  | "qualified"
  | "demo_booked"
  | "converted"
  | "not_interested"
  | "dnc"
  | "call_connected"
  | "voicemail"
  | "no_answer"
  | "failed";

export type AcquisitionObservation = {
  prospectId: string;
  category: string | null;
  city: string | null;
  state: string | null;
  channel: "email" | "call";
  outcome: AcquisitionOutcome;
  occurredAt: string | Date;
};

export type AcquisitionDimension = "category" | "metro";

export type AcquisitionSegmentScore = {
  dimension: AcquisitionDimension;
  value: string;
  sampleSize: number;
  eventCount: number;
  positive: number;
  positiveRate: number;
};

export type AcquisitionLearningSummary = {
  sampleSize: number;
  eventCount: number;
  segments: AcquisitionSegmentScore[];
};

const acquisitionSegmentScoreSchema = z
  .object({
    dimension: z.enum(["category", "metro"]),
    value: z.string().trim().min(1).max(160),
    sampleSize: z.number().int().min(MINIMUM_ACQUISITION_SEGMENT_SAMPLE),
    eventCount: z.number().int().positive(),
    positive: z.number().int().nonnegative(),
    positiveRate: z.number().min(0).max(1),
  })
  .strict()
  .refine(value => value.positive <= value.sampleSize, {
    message: "Positive outcomes cannot exceed the segment sample size.",
  });

export const acquisitionLearningProposalSchema = z
  .object({
    action: z.literal("prioritize_for_next_research_batch"),
    dimension: z.enum(["category", "metro"]),
    value: z.string().trim().min(2).max(160),
    maximumNextBatchSize: z.literal(20),
  })
  .strict();

const acquisitionObservationalLearningEvidenceSchema = z
  .object({
    studyDesign: z.literal(ACQUISITION_LEARNING_STUDY_DESIGN),
    interpretation: z.literal(ACQUISITION_LEARNING_INTERPRETATION),
    segment: acquisitionSegmentScoreSchema,
    comparisonSampleSize: z
      .number()
      .int()
      .min(MINIMUM_ACQUISITION_SEGMENT_SAMPLE),
    comparisonPositive: z.number().int().nonnegative(),
    comparisonPositiveRate: z.number().min(0).max(1),
    absoluteLift: z.number().min(MINIMUM_ACQUISITION_LIFT).max(1),
    statisticalTest: z.literal(ACQUISITION_LEARNING_STATISTICAL_TEST),
    oneSidedFisherPValue: z
      .number()
      .min(0)
      .max(MAXIMUM_ACQUISITION_FISHER_P_VALUE),
    maximumOneSidedFisherPValue: z.literal(
      MAXIMUM_ACQUISITION_FISHER_P_VALUE
    ),
  })
  .strict()
  .refine(
    value => value.comparisonPositive <= value.comparisonSampleSize,
    {
      message:
        "Comparison positives cannot exceed the comparison sample size.",
    }
  );

const acquisitionSourcingExperimentLearningEvidenceSchema = z
  .object({
    studyDesign: z.literal(
      ACQUISITION_SOURCING_EXPERIMENT_EVIDENCE_STUDY_DESIGN
    ),
    interpretation: z.literal(
      ACQUISITION_SOURCING_EXPERIMENT_EVIDENCE_INTERPRETATION
    ),
    source: z
      .object({
        experimentId: z.string().uuid(),
        definitionHash: z.string().regex(/^[a-f0-9]{64}$/),
        resultHash: z.string().regex(/^[a-f0-9]{64}$/),
        winner: z.enum(["control", "challenger"]),
      })
      .strict(),
    segment: acquisitionSegmentScoreSchema,
    comparisonSampleSize: z
      .number()
      .int()
      .min(MINIMUM_ACQUISITION_SEGMENT_SAMPLE),
    comparisonPositive: z.number().int().nonnegative(),
    comparisonPositiveRate: z.number().min(0).max(1),
    absoluteLift: z.number().min(MINIMUM_ACQUISITION_LIFT).max(1),
    statisticalTest: z.literal(ACQUISITION_LEARNING_STATISTICAL_TEST),
    oneSidedFisherPValue: z
      .number()
      .min(0)
      .max(MAXIMUM_ACQUISITION_FISHER_P_VALUE),
    maximumOneSidedFisherPValue: z.literal(MAXIMUM_ACQUISITION_FISHER_P_VALUE),
  })
  .strict()
  .refine(value => value.comparisonPositive <= value.comparisonSampleSize, {
    message: "Comparison positives cannot exceed the comparison sample size.",
  });

export const acquisitionLearningEvidenceSchema = z.union([
  acquisitionObservationalLearningEvidenceSchema,
  acquisitionSourcingExperimentLearningEvidenceSchema,
]);

export type AcquisitionLearningProposal = z.infer<
  typeof acquisitionLearningProposalSchema
>;
export type AcquisitionLearningEvidence = z.infer<
  typeof acquisitionLearningEvidenceSchema
>;

const POSITIVE_OUTCOMES = new Set<AcquisitionOutcome>([
  "replied",
  "qualified",
  "demo_booked",
  "converted",
  "call_connected",
]);

export function isPositiveAcquisitionOutcome(
  outcome: AcquisitionOutcome
): boolean {
  return POSITIVE_OUTCOMES.has(outcome);
}

function stableRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function stableProbability(value: number): number {
  return Math.ceil(value * 1_000_000) / 1_000_000;
}

export function calculateAcquisitionFisherExactPValue(input: {
  comparisonPositive: number;
  comparisonSampleSize: number;
  segmentPositive: number;
  segmentSampleSize: number;
}): number {
  const values = [
    input.comparisonPositive,
    input.comparisonSampleSize,
    input.segmentPositive,
    input.segmentSampleSize,
  ];
  if (
    values.some(value => !Number.isSafeInteger(value) || value < 0) ||
    input.comparisonPositive > input.comparisonSampleSize ||
    input.segmentPositive > input.segmentSampleSize ||
    input.comparisonSampleSize + input.segmentSampleSize === 0
  ) {
    throw new Error("Fisher exact inputs must be valid binary counts.");
  }

  const totalSampleSize =
    input.comparisonSampleSize + input.segmentSampleSize;
  const totalPositive =
    input.comparisonPositive + input.segmentPositive;
  const logFactorials = new Array<number>(totalSampleSize + 1).fill(0);
  for (let value = 2; value <= totalSampleSize; value += 1) {
    logFactorials[value] = logFactorials[value - 1] + Math.log(value);
  }
  const logCombination = (n: number, k: number): number => {
    if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
    return logFactorials[n] - logFactorials[k] - logFactorials[n - k];
  };
  const denominator = logCombination(totalSampleSize, totalPositive);
  const maximumSegmentPositive = Math.min(
    input.segmentSampleSize,
    totalPositive
  );
  let probability = 0;
  for (
    let segmentPositive = input.segmentPositive;
    segmentPositive <= maximumSegmentPositive;
    segmentPositive += 1
  ) {
    const comparisonPositive = totalPositive - segmentPositive;
    if (
      comparisonPositive < 0 ||
      comparisonPositive > input.comparisonSampleSize
    ) {
      continue;
    }
    probability += Math.exp(
      logCombination(input.segmentSampleSize, segmentPositive) +
        logCombination(input.comparisonSampleSize, comparisonPositive) -
        denominator
    );
  }
  return stableProbability(Math.min(1, Math.max(0, probability)));
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

export function hashAcquisitionLearningValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

export function buildAcquisitionLearningCandidateKey(
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

export function verifyAcquisitionLearningCandidateSnapshot(input: {
  proposal: unknown;
  evidence: unknown;
  sampleSize: number;
}): {
  proposal: AcquisitionLearningProposal;
  evidence: AcquisitionLearningEvidence;
} {
  const proposal = acquisitionLearningProposalSchema.parse(input.proposal);
  const evidence = acquisitionLearningEvidenceSchema.parse(input.evidence);
  const expectedSegmentRate = stableRate(
    evidence.segment.positive / evidence.segment.sampleSize
  );
  const expectedComparisonRate = stableRate(
    evidence.comparisonPositive / evidence.comparisonSampleSize
  );
  const expectedLift = stableRate(
    expectedSegmentRate - expectedComparisonRate
  );
  const expectedPValue = calculateAcquisitionFisherExactPValue({
    comparisonPositive: evidence.comparisonPositive,
    comparisonSampleSize: evidence.comparisonSampleSize,
    segmentPositive: evidence.segment.positive,
    segmentSampleSize: evidence.segment.sampleSize,
  });
  const valid =
    proposal.dimension === evidence.segment.dimension &&
    proposal.value === evidence.segment.value &&
    input.sampleSize ===
      evidence.segment.sampleSize + evidence.comparisonSampleSize &&
    evidence.segment.positiveRate === expectedSegmentRate &&
    evidence.comparisonPositiveRate === expectedComparisonRate &&
    evidence.absoluteLift === expectedLift &&
    evidence.oneSidedFisherPValue === expectedPValue;
  if (!valid) {
    throw new Error(
      "The acquisition-learning candidate evidence is internally inconsistent."
    );
  }
  return { proposal, evidence };
}

function normalizedSegmentValue(
  observation: AcquisitionObservation,
  dimension: AcquisitionDimension
): string | null {
  if (dimension === "category") {
    const category = String(observation.category || "")
      .trim()
      .toLowerCase();
    return category || null;
  }
  const city = String(observation.city || "").trim();
  const state = String(observation.state || "")
    .trim()
    .toUpperCase();
  return city && state ? `${city}, ${state}` : null;
}

const OUTCOME_STAGE: Record<AcquisitionOutcome, number> = {
  delivered: 1,
  bounced: 1,
  voicemail: 1,
  no_answer: 1,
  failed: 1,
  replied: 2,
  call_connected: 2,
  qualified: 3,
  demo_booked: 3,
  converted: 3,
  not_interested: 3,
  dnc: 3,
};

const OUTCOME_TIE_BREAKER: AcquisitionOutcome[] = [
  "failed",
  "delivered",
  "voicemail",
  "no_answer",
  "bounced",
  "replied",
  "call_connected",
  "qualified",
  "demo_booked",
  "converted",
  "not_interested",
  "dnc",
];

function occurredAtMs(observation: AcquisitionObservation): number {
  const value = new Date(observation.occurredAt).getTime();
  if (!Number.isFinite(value)) {
    throw new Error(
      `Acquisition observation ${observation.prospectId} has an invalid occurrence time.`
    );
  }
  return value;
}

function selectCanonicalOutcome(
  current: AcquisitionObservation,
  candidate: AcquisitionObservation
): AcquisitionObservation {
  const currentStage = OUTCOME_STAGE[current.outcome];
  const candidateStage = OUTCOME_STAGE[candidate.outcome];
  if (candidateStage !== currentStage) {
    return candidateStage > currentStage ? candidate : current;
  }

  const currentTime = occurredAtMs(current);
  const candidateTime = occurredAtMs(candidate);
  if (candidateTime !== currentTime) {
    return candidateTime > currentTime ? candidate : current;
  }

  return OUTCOME_TIE_BREAKER.indexOf(candidate.outcome) >
    OUTCOME_TIE_BREAKER.indexOf(current.outcome)
    ? candidate
    : current;
}

function sourceIdentity(observation: AcquisitionObservation): string {
  return JSON.stringify({
    category: normalizedSegmentValue(observation, "category"),
    metro: normalizedSegmentValue(observation, "metro"),
  });
}

export function canonicalizeAcquisitionObservations(
  observations: AcquisitionObservation[]
): Array<AcquisitionObservation & { eventCount: number }> {
  const prospects = new Map<
    string,
    { canonical: AcquisitionObservation; eventCount: number }
  >();

  for (const observation of observations) {
    const prospectId = String(observation.prospectId || "").trim();
    if (!prospectId) {
      throw new Error("Acquisition observations require a prospect ID.");
    }
    occurredAtMs(observation);
    const existing = prospects.get(prospectId);
    if (!existing) {
      prospects.set(prospectId, {
        canonical: { ...observation, prospectId },
        eventCount: 1,
      });
      continue;
    }
    if (sourceIdentity(existing.canonical) !== sourceIdentity(observation)) {
      throw new Error(
        `Acquisition observation ${prospectId} changed source-segment attribution.`
      );
    }
    existing.canonical = selectCanonicalOutcome(
      existing.canonical,
      observation
    );
    existing.eventCount += 1;
  }

  return Array.from(prospects.values()).map(
    ({ canonical, eventCount }) => ({
      ...canonical,
      eventCount,
    })
  );
}

export function buildAcquisitionLearningSummary(
  observations: AcquisitionObservation[],
  dimension: AcquisitionDimension
): AcquisitionLearningSummary {
  const segments = new Map<string, AcquisitionSegmentScore>();
  for (const observation of canonicalizeAcquisitionObservations(observations)) {
    const value = normalizedSegmentValue(observation, dimension);
    if (!value) continue;
    const score =
      segments.get(value) ||
      ({
        dimension,
        value,
        sampleSize: 0,
        eventCount: 0,
        positive: 0,
        positiveRate: 0,
      } satisfies AcquisitionSegmentScore);
    score.sampleSize += 1;
    score.eventCount += observation.eventCount;
    if (isPositiveAcquisitionOutcome(observation.outcome)) {
      score.positive += 1;
    }
    score.positiveRate = stableRate(score.positive / score.sampleSize);
    segments.set(value, score);
  }
  const scores = Array.from(segments.values()).sort(
    (a, b) =>
      b.positiveRate - a.positiveRate ||
      b.sampleSize - a.sampleSize ||
      a.value.localeCompare(b.value)
  );
  return {
    sampleSize: scores.reduce(
      (total, score) => total + score.sampleSize,
      0
    ),
    eventCount: scores.reduce(
      (total, score) => total + score.eventCount,
      0
    ),
    segments: scores,
  };
}

export function buildAcquisitionSegmentScorecard(
  observations: AcquisitionObservation[],
  dimension: AcquisitionDimension
): AcquisitionSegmentScore[] {
  return buildAcquisitionLearningSummary(observations, dimension).segments;
}

export function evaluateAcquisitionLearningCandidate(input: {
  observations: AcquisitionObservation[];
  dimension: AcquisitionDimension;
  value: string;
}):
  | {
      ready: true;
      sampleSize: number;
      proposal: {
        action: "prioritize_for_next_research_batch";
        dimension: AcquisitionDimension;
        value: string;
        maximumNextBatchSize: 20;
      };
      evidence: {
        studyDesign: typeof ACQUISITION_LEARNING_STUDY_DESIGN;
        interpretation: typeof ACQUISITION_LEARNING_INTERPRETATION;
        segment: AcquisitionSegmentScore;
        comparisonSampleSize: number;
        comparisonPositive: number;
        comparisonPositiveRate: number;
        absoluteLift: number;
        statisticalTest: typeof ACQUISITION_LEARNING_STATISTICAL_TEST;
        oneSidedFisherPValue: number;
        maximumOneSidedFisherPValue:
          typeof MAXIMUM_ACQUISITION_FISHER_P_VALUE;
      };
    }
  | {
      ready: false;
      code:
        | "INSUFFICIENT_SAMPLE"
        | "NO_MEASURED_LIFT"
        | "INSUFFICIENT_CONFIDENCE";
      sampleSize: number;
    } {
  const normalizedValue =
    input.dimension === "category"
      ? input.value.trim().toLowerCase()
      : input.value.trim();
  const summary = buildAcquisitionLearningSummary(
    input.observations,
    input.dimension
  );
  const segment = summary.segments.find(
    (score) => score.value === normalizedValue
  );
  const comparison = summary.segments.filter(
    (score) => score.value !== normalizedValue
  );
  const comparisonSampleSize = comparison.reduce(
    (total, score) => total + score.sampleSize,
    0
  );
  const comparisonPositive = comparison.reduce(
    (total, score) => total + score.positive,
    0
  );
  const comparisonPositiveRate = stableRate(
    comparisonSampleSize > 0
      ? comparisonPositive / comparisonSampleSize
      : 0
  );
  const sampleSize = (segment?.sampleSize || 0) + comparisonSampleSize;

  if (
    !segment ||
    segment.sampleSize < MINIMUM_ACQUISITION_SEGMENT_SAMPLE ||
    comparisonSampleSize < MINIMUM_ACQUISITION_SEGMENT_SAMPLE
  ) {
    return { ready: false, code: "INSUFFICIENT_SAMPLE", sampleSize };
  }
  const absoluteLift = stableRate(
    segment.positiveRate - comparisonPositiveRate
  );
  if (absoluteLift < MINIMUM_ACQUISITION_LIFT) {
    return { ready: false, code: "NO_MEASURED_LIFT", sampleSize };
  }
  const oneSidedFisherPValue =
    calculateAcquisitionFisherExactPValue({
      comparisonPositive,
      comparisonSampleSize,
      segmentPositive: segment.positive,
      segmentSampleSize: segment.sampleSize,
    });
  if (
    oneSidedFisherPValue > MAXIMUM_ACQUISITION_FISHER_P_VALUE
  ) {
    return {
      ready: false,
      code: "INSUFFICIENT_CONFIDENCE",
      sampleSize,
    };
  }
  return {
    ready: true,
    sampleSize,
    proposal: {
      action: "prioritize_for_next_research_batch",
      dimension: input.dimension,
      value: normalizedValue,
      maximumNextBatchSize: 20,
    },
    evidence: {
      studyDesign: ACQUISITION_LEARNING_STUDY_DESIGN,
      interpretation: ACQUISITION_LEARNING_INTERPRETATION,
      segment,
      comparisonSampleSize,
      comparisonPositive,
      comparisonPositiveRate,
      absoluteLift,
      statisticalTest: ACQUISITION_LEARNING_STATISTICAL_TEST,
      oneSidedFisherPValue,
      maximumOneSidedFisherPValue:
        MAXIMUM_ACQUISITION_FISHER_P_VALUE,
    },
  };
}
