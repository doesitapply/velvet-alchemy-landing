import { describe, expect, it } from "vitest";
import {
  ACQUISITION_SOURCING_BINDING_CONTRACT,
  acquisitionSourcingExperimentBindingSchema,
  buildAcquisitionLearningSnapshotFromSourcingExperiment,
  buildAcquisitionSourcingExperimentAssignment,
  buildAcquisitionSourcingExperimentDefinition,
  evaluateAcquisitionSourcingExperiment,
  hashAcquisitionSourcingValue,
  verifyAcquisitionSourcingExperimentAssignment,
} from "./lib/acquisitionSourcingExperiment";
import type { AcquisitionObservation } from "./lib/acquisitionLearning";

const experimentId = "5a947baf-1c5d-48dc-b96e-716476503c86";

function definition() {
  return buildAcquisitionSourcingExperimentDefinition({
    experimentId,
    workspaceId: 1,
    dimension: "category",
    control: {
      label: "Reno plumbing",
      criteria: { category: "Plumbing", city: "Reno", state: "nv" },
    },
    challenger: {
      label: "Reno HVAC",
      criteria: { category: "HVAC", city: "Reno", state: "NV" },
    },
    requestsPerArm: 1,
    leadsPerRequest: 10,
    preparedAt: new Date("2026-08-01T16:00:00.000Z"),
  });
}

function completedFixture(outcomesPerArm: {
  controlPositive: number;
  challengerPositive: number;
}) {
  const frozen = definition();
  const definitionHash = hashAcquisitionSourcingValue(frozen);
  const runs = frozen.assignmentSchedule.map(slot => {
    const assignment = buildAcquisitionSourcingExperimentAssignment({
      definition: frozen,
      definitionHash,
      requestId: `smirk-experiment-request-${slot.slotOrdinal}-0001`,
      slotOrdinal: slot.slotOrdinal,
    });
    const base = slot.arm === "control" ? 100 : 200;
    return {
      assignment,
      discoveryState: "COMPLETED" as const,
      readyLeadIds: Array.from({ length: 10 }, (_, index) => base + index),
    };
  });
  const observations: AcquisitionObservation[] = [];
  for (const run of runs) {
    const positiveCount =
      run.assignment.arm === "control"
        ? outcomesPerArm.controlPositive
        : outcomesPerArm.challengerPositive;
    run.readyLeadIds.forEach((leadId, index) => {
      observations.push({
        prospectId: String(leadId),
        category: run.assignment.effectiveCriteria.category,
        city: run.assignment.effectiveCriteria.city,
        state: run.assignment.effectiveCriteria.state,
        channel: "email",
        outcome: index < positiveCount ? "replied" : "delivered",
        occurredAt: new Date(
          `2026-08-${String(index + 1).padStart(2, "0")}T17:00:00.000Z`
        ),
      });
    });
  }
  return {
    definition: frozen,
    definitionHash,
    runs,
    observations,
  };
}

describe("deterministic acquisition sourcing experiments", () => {
  it("freezes normalized criteria and an exact balanced assignment schedule", () => {
    const frozen = definition();

    expect(frozen.arms.control.criteria).toEqual({
      category: "plumbing",
      city: "Reno",
      state: "NV",
    });
    expect(frozen.arms.challenger.criteria.category).toBe("hvac");
    expect(frozen.totalRequestSlots).toBe(2);
    expect(frozen.totalLeadCapacity).toBe(20);
    expect(frozen.assignmentSchedule.map(slot => slot.arm).sort()).toEqual([
      "challenger",
      "control",
    ]);
    expect(
      acquisitionSourcingExperimentBindingSchema.parse({
        contractVersion: ACQUISITION_SOURCING_BINDING_CONTRACT,
        experimentId,
        definitionHash: hashAcquisitionSourcingValue(frozen),
      })
    ).toBeTruthy();
  });

  it("binds one request to one immutable frozen slot", () => {
    const frozen = definition();
    const definitionHash = hashAcquisitionSourcingValue(frozen);
    const assignment = buildAcquisitionSourcingExperimentAssignment({
      definition: frozen,
      definitionHash,
      requestId: "smirk-experiment-request-control-0001",
      slotOrdinal: 1,
    });

    expect(
      verifyAcquisitionSourcingExperimentAssignment({
        definition: frozen,
        definitionHash,
        assignment,
      })
    ).toEqual(assignment);
    expect(() =>
      verifyAcquisitionSourcingExperimentAssignment({
        definition: frozen,
        definitionHash,
        assignment: {
          ...assignment,
          arm: assignment.arm === "control" ? "challenger" : "control",
        },
      })
    ).toThrow();
  });

  it("refuses to close when any assigned lead lacks an outcome", () => {
    const fixture = completedFixture({
      controlPositive: 1,
      challengerPositive: 9,
    });
    fixture.observations.pop();

    const result = evaluateAcquisitionSourcingExperiment(fixture);

    expect(result.status).toBe("INCOMPLETE");
    expect(result.code).toBe("OUTCOME_COVERAGE_INCOMPLETE");
    expect(result.coverage.assignedRequests).toBe(2);
    expect(result.coverage.measuredLeads).toBe(19);
  });

  it("keeps failed or cancelled source slots visible as protocol attrition", () => {
    const fixture = completedFixture({
      controlPositive: 1,
      challengerPositive: 9,
    });
    fixture.runs[0].discoveryState = "CANCELLED";

    const result = evaluateAcquisitionSourcingExperiment(fixture);

    expect(result.status).toBe("INCOMPLETE");
    expect(result.code).toBe("PROTOCOL_ATTRITION");
  });

  it("produces only a human-review recommendation after complete coverage", () => {
    const fixture = completedFixture({
      controlPositive: 0,
      challengerPositive: 10,
    });

    const result = evaluateAcquisitionSourcingExperiment(fixture);

    expect(result.status).toBe("RECOMMENDATION_READY");
    expect(result.code).toBe("READY");
    expect(result.winner).toBe("challenger");
    expect(result.proposal).toEqual({
      action: "prioritize_for_next_research_batch",
      dimension: "category",
      value: "hvac",
      maximumNextBatchSize: 20,
    });
    expect(result.oneSidedFisherPValue).toBeLessThanOrEqual(0.05);
    expect(result.coverage.control.measuredLeads).toBe(10);
    expect(result.coverage.challenger.measuredLeads).toBe(10);

    const snapshot = buildAcquisitionLearningSnapshotFromSourcingExperiment({
      definition: fixture.definition,
      definitionHash: fixture.definitionHash,
      evaluation: result,
    });
    expect(snapshot.proposal).toEqual(result.proposal);
    expect(snapshot.sampleSize).toBe(20);
    expect(snapshot.evidence.studyDesign).toBe(
      "deterministic-balanced-source-allocation-v1"
    );
    if (
      snapshot.evidence.studyDesign ===
      "deterministic-balanced-source-allocation-v1"
    ) {
      expect(snapshot.evidence.source).toEqual({
        experimentId,
        definitionHash: fixture.definitionHash,
        resultHash: result.resultHash,
        winner: "challenger",
      });
    }
  });

  it("does not call a fully measured weak result a winner", () => {
    const fixture = completedFixture({
      controlPositive: 4,
      challengerPositive: 5,
    });

    const result = evaluateAcquisitionSourcingExperiment(fixture);

    expect(result.status).toBe("COMPLETE_NO_RECOMMENDATION");
    expect(result.code).toBe("INSUFFICIENT_CONFIDENCE");
    expect(result.proposal).toBeNull();
    expect(() =>
      buildAcquisitionLearningSnapshotFromSourcingExperiment({
        definition: fixture.definition,
        definitionHash: fixture.definitionHash,
        evaluation: result,
      })
    ).toThrow(/exact closed recommendation/i);
  });
});
