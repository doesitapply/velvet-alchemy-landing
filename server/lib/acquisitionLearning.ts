export const MINIMUM_ACQUISITION_SEGMENT_SAMPLE = 10;
export const MINIMUM_ACQUISITION_LIFT = 0.05;

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

const POSITIVE_OUTCOMES = new Set<AcquisitionOutcome>([
  "replied",
  "qualified",
  "demo_booked",
  "converted",
  "call_connected",
]);

function stableRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
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

function canonicalizeAcquisitionObservations(
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
    if (POSITIVE_OUTCOMES.has(observation.outcome)) score.positive += 1;
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
        segment: AcquisitionSegmentScore;
        comparisonSampleSize: number;
        comparisonPositiveRate: number;
        absoluteLift: number;
      };
    }
  | {
      ready: false;
      code: "INSUFFICIENT_SAMPLE" | "NO_MEASURED_LIFT";
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
      segment,
      comparisonSampleSize,
      comparisonPositiveRate,
      absoluteLift,
    },
  };
}
