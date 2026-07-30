import { describe, expect, it } from "vitest";
import {
  buildAcquisitionSegmentScorecard,
  evaluateAcquisitionLearningCandidate,
  type AcquisitionObservation,
} from "./lib/acquisitionLearning";

function observations(input: {
  category: string;
  city: string;
  state: string;
  count: number;
  positives: number;
}): AcquisitionObservation[] {
  return Array.from({ length: input.count }, (_, index) => ({
    category: input.category,
    city: input.city,
    state: input.state,
    channel: "email" as const,
    outcome: index < input.positives ? "replied" : "delivered",
  }));
}

const dataset = [
  ...observations({
    category: "plumbing",
    city: "Reno",
    state: "NV",
    count: 10,
    positives: 4,
  }),
  ...observations({
    category: "hvac",
    city: "Sacramento",
    state: "CA",
    count: 10,
    positives: 1,
  }),
];

describe("Velvet acquisition learning", () => {
  it("scores outcome-linked trade and metro segments", () => {
    expect(buildAcquisitionSegmentScorecard(dataset, "category")[0]).toMatchObject({
      value: "plumbing",
      sampleSize: 10,
      positive: 4,
      positiveRate: 0.4,
    });
    expect(buildAcquisitionSegmentScorecard(dataset, "metro")[0].value).toBe(
      "Reno, NV"
    );
  });

  it("proposes only a bounded human-review sourcing candidate", () => {
    expect(
      evaluateAcquisitionLearningCandidate({
        observations: dataset,
        dimension: "category",
        value: "plumbing",
      })
    ).toMatchObject({
      ready: true,
      proposal: {
        action: "prioritize_for_next_research_batch",
        dimension: "category",
        value: "plumbing",
        maximumNextBatchSize: 20,
      },
      evidence: {
        comparisonSampleSize: 10,
        comparisonPositiveRate: 0.1,
        absoluteLift: 0.3,
      },
    });
  });

  it("refuses low-sample or no-lift sourcing changes", () => {
    expect(
      evaluateAcquisitionLearningCandidate({
        observations: dataset.slice(0, 9),
        dimension: "category",
        value: "plumbing",
      })
    ).toMatchObject({ ready: false, code: "INSUFFICIENT_SAMPLE" });
    expect(
      evaluateAcquisitionLearningCandidate({
        observations: [
          ...observations({
            category: "plumbing",
            city: "Reno",
            state: "NV",
            count: 10,
            positives: 1,
          }),
          ...observations({
            category: "hvac",
            city: "Sacramento",
            state: "CA",
            count: 10,
            positives: 4,
          }),
        ],
        dimension: "category",
        value: "plumbing",
      })
    ).toMatchObject({ ready: false, code: "NO_MEASURED_LIFT" });
  });
});
