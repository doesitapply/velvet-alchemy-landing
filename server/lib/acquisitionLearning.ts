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
  category: string | null;
  city: string | null;
  state: string | null;
  channel: "email" | "call";
  outcome: AcquisitionOutcome;
};

export type AcquisitionDimension = "category" | "metro";

export type AcquisitionSegmentScore = {
  dimension: AcquisitionDimension;
  value: string;
  sampleSize: number;
  positive: number;
  positiveRate: number;
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

export function buildAcquisitionSegmentScorecard(
  observations: AcquisitionObservation[],
  dimension: AcquisitionDimension
): AcquisitionSegmentScore[] {
  const segments = new Map<string, AcquisitionSegmentScore>();
  for (const observation of observations) {
    const value = normalizedSegmentValue(observation, dimension);
    if (!value) continue;
    const score =
      segments.get(value) ||
      ({
        dimension,
        value,
        sampleSize: 0,
        positive: 0,
        positiveRate: 0,
      } satisfies AcquisitionSegmentScore);
    score.sampleSize += 1;
    if (POSITIVE_OUTCOMES.has(observation.outcome)) score.positive += 1;
    score.positiveRate = stableRate(score.positive / score.sampleSize);
    segments.set(value, score);
  }
  return Array.from(segments.values()).sort(
    (a, b) =>
      b.positiveRate - a.positiveRate ||
      b.sampleSize - a.sampleSize ||
      a.value.localeCompare(b.value)
  );
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
  const segment = buildAcquisitionSegmentScorecard(
    input.observations,
    input.dimension
  ).find((score) => score.value === normalizedValue);
  const comparison = input.observations.filter(
    (observation) => {
      const value = normalizedSegmentValue(observation, input.dimension);
      return Boolean(value) && value !== normalizedValue;
    }
  );
  const comparisonPositive = comparison.filter((observation) =>
    POSITIVE_OUTCOMES.has(observation.outcome)
  ).length;
  const comparisonPositiveRate = stableRate(
    comparison.length > 0 ? comparisonPositive / comparison.length : 0
  );
  const sampleSize = (segment?.sampleSize || 0) + comparison.length;

  if (
    !segment ||
    segment.sampleSize < MINIMUM_ACQUISITION_SEGMENT_SAMPLE ||
    comparison.length < MINIMUM_ACQUISITION_SEGMENT_SAMPLE
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
      comparisonSampleSize: comparison.length,
      comparisonPositiveRate,
      absoluteLift,
    },
  };
}
