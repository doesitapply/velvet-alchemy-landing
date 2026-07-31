import { describe, expect, it } from "vitest";
import {
  buildAcquisitionLearningSummary,
  buildAcquisitionSegmentScorecard,
  calculateAcquisitionFisherExactPValue,
  evaluateAcquisitionLearningCandidate,
  verifyAcquisitionLearningCandidateSnapshot,
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
    prospectId: `${input.category}-${input.city}-${index + 1}`,
    category: input.category,
    city: input.city,
    state: input.state,
    channel: "email" as const,
    outcome: index < input.positives ? "replied" : "delivered",
    occurredAt: new Date(
      Date.UTC(2026, 6, 1, 9, index)
    ).toISOString(),
  }));
}

const dataset = [
  ...observations({
    category: "plumbing",
    city: "Reno",
    state: "NV",
    count: 10,
    positives: 6,
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
      eventCount: 10,
      positive: 6,
      positiveRate: 0.6,
    });
    expect(buildAcquisitionSegmentScorecard(dataset, "metro")[0].value).toBe(
      "Reno, NV"
    );
  });

  it("counts one canonical lifecycle result per unique prospect", () => {
    const summary = buildAcquisitionLearningSummary(
      [
        {
          prospectId: "prospect-1",
          category: "plumbing",
          city: "Reno",
          state: "NV",
          channel: "email",
          outcome: "delivered",
          occurredAt: "2026-07-01T09:00:00.000Z",
        },
        {
          prospectId: "prospect-1",
          category: "plumbing",
          city: "Reno",
          state: "NV",
          channel: "email",
          outcome: "replied",
          occurredAt: "2026-07-01T09:05:00.000Z",
        },
        {
          prospectId: "prospect-1",
          category: "plumbing",
          city: "Reno",
          state: "NV",
          channel: "call",
          outcome: "qualified",
          occurredAt: "2026-07-01T09:10:00.000Z",
        },
        {
          prospectId: "prospect-2",
          category: "plumbing",
          city: "Reno",
          state: "NV",
          channel: "email",
          outcome: "replied",
          occurredAt: "2026-07-01T10:00:00.000Z",
        },
        {
          prospectId: "prospect-2",
          category: "plumbing",
          city: "Reno",
          state: "NV",
          channel: "call",
          outcome: "not_interested",
          occurredAt: "2026-07-01T10:05:00.000Z",
        },
      ],
      "category"
    );

    expect(summary).toMatchObject({
      sampleSize: 2,
      eventCount: 5,
      segments: [
        {
          value: "plumbing",
          sampleSize: 2,
          eventCount: 5,
          positive: 1,
          positiveRate: 0.5,
        },
      ],
    });
  });

  it("does not let repeated events satisfy the ten-prospect gate", () => {
    const repeatedPlumbing = Array.from({ length: 20 }, (_, index) => ({
      prospectId: `plumbing-${(index % 5) + 1}`,
      category: "plumbing",
      city: "Reno",
      state: "NV",
      channel: "email" as const,
      outcome: index % 2 === 0 ? ("delivered" as const) : ("replied" as const),
      occurredAt: new Date(
        Date.UTC(2026, 6, 2, 9, index)
      ).toISOString(),
    }));

    expect(
      evaluateAcquisitionLearningCandidate({
        observations: [
          ...repeatedPlumbing,
          ...observations({
            category: "hvac",
            city: "Sacramento",
            state: "CA",
            count: 10,
            positives: 1,
          }),
        ],
        dimension: "category",
        value: "plumbing",
      })
    ).toMatchObject({
      ready: false,
      code: "INSUFFICIENT_SAMPLE",
      sampleSize: 15,
    });
  });

  it("fails closed when one prospect changes source-segment attribution", () => {
    expect(() =>
      buildAcquisitionLearningSummary(
        [
          {
            prospectId: "prospect-conflict",
            category: "plumbing",
            city: "Reno",
            state: "NV",
            channel: "email",
            outcome: "delivered",
            occurredAt: "2026-07-01T09:00:00.000Z",
          },
          {
            prospectId: "prospect-conflict",
            category: "hvac",
            city: "Sacramento",
            state: "CA",
            channel: "email",
            outcome: "replied",
            occurredAt: "2026-07-01T09:05:00.000Z",
          },
        ],
        "category"
      )
    ).toThrow(/changed source-segment attribution/);
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
        comparisonPositive: 1,
        comparisonPositiveRate: 0.1,
        absoluteLift: 0.5,
        statisticalTest: "fisher-exact-one-sided-v1",
        oneSidedFisherPValue: 0.028638,
        maximumOneSidedFisherPValue: 0.05,
      },
    });
  });

  it("requires exact statistical confidence before proposing a source change", () => {
    expect(
      calculateAcquisitionFisherExactPValue({
        comparisonPositive: 1,
        comparisonSampleSize: 10,
        segmentPositive: 6,
        segmentSampleSize: 10,
      })
    ).toBe(0.028638);
    expect(
      evaluateAcquisitionLearningCandidate({
        observations: [
          ...observations({
            category: "plumbing",
            city: "Reno",
            state: "NV",
            count: 10,
            positives: 2,
          }),
          ...observations({
            category: "hvac",
            city: "Sacramento",
            state: "CA",
            count: 10,
            positives: 1,
          }),
        ],
        dimension: "category",
        value: "plumbing",
      })
    ).toMatchObject({
      ready: false,
      code: "INSUFFICIENT_CONFIDENCE",
    });
  });

  it("rejects internally inconsistent candidate confidence evidence", () => {
    const candidate = evaluateAcquisitionLearningCandidate({
      observations: dataset,
      dimension: "category",
      value: "plumbing",
    });
    expect(candidate.ready).toBe(true);
    if (candidate.ready === false) return;
    expect(
      verifyAcquisitionLearningCandidateSnapshot({
        proposal: candidate.proposal,
        evidence: candidate.evidence,
        sampleSize: candidate.sampleSize,
      })
    ).toEqual({
      proposal: candidate.proposal,
      evidence: candidate.evidence,
    });
    expect(() =>
      verifyAcquisitionLearningCandidateSnapshot({
        proposal: candidate.proposal,
        evidence: {
          ...candidate.evidence,
          oneSidedFisherPValue: 0.000001,
        },
        sampleSize: candidate.sampleSize,
      })
    ).toThrow(/internally inconsistent/);
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
