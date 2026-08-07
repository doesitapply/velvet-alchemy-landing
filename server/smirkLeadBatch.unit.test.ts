import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  SMIRK_LEAD_BATCH_REQUEST_CONTRACT,
  SMIRK_LEAD_BATCH_RESPONSE_CONTRACT,
  buildSmirkAcquisitionExperimentCampaignBinding,
  hashSmirkLeadBatchValue,
  parseApprovedSourcingCandidate,
  smirkLeadBatchRequestSchema,
  smirkLeadBatchResponseSchema,
  sourcingFiltersForRequest,
} from "./lib/smirkLeadBatch";
import {
  buildAcquisitionSourcingExperimentAssignment,
  buildAcquisitionSourcingExperimentDefinition,
  hashAcquisitionSourcingValue,
} from "./lib/acquisitionSourcingExperiment";
import {
  parseStoredSmirkLeadBatchResponse,
  SmirkLeadBatchStoreError,
} from "./lib/smirkLeadBatchStore";

const request = {
  contractVersion: SMIRK_LEAD_BATCH_REQUEST_CONTRACT,
  requestId: "smirk-source-11111111-1111-4111-8111-111111111111",
  workspaceId: 1,
  criteria: {
    limit: 8,
    category: "Plumbing",
    city: "Reno",
    state: "nv",
    learningMode: "none" as const,
  },
  contactActionAllowed: false as const,
  maxSpendCents: 0 as const,
};

const prospect = {
  contractVersion: "velvet-smirk.prospect.v1" as const,
  workspaceId: 1,
  externalId: "velvet-owner-1-lead-42",
  batch: {
    externalId: request.requestId,
    name: "Velvet reviewed leads: plumbing / Reno, NV",
  },
  prospect: {
    companyName: "Synthetic Plumbing Test",
    phone: "+17755550142",
    phoneContactMode: "operator_review_only" as const,
    email: "owner@example.com",
    emailVerification: "verified_owner_email" as const,
    website: "https://example.com/synthetic",
    evidence: [
      {
        url: "https://example.com/synthetic",
        observation: "Public website recorded for operator review.",
        observedAt: "2026-07-30T18:00:00.000Z",
        kind: "website" as const,
        basis: "observed" as const,
        confidence: "high" as const,
      },
    ],
    notes:
      "Research-only import. No outreach, SMS, call, handoff, or callback task is authorized.",
  },
};

describe("SMIRK lead batch request", () => {
  it("accepts one bounded no-contact, zero-spend request", () => {
    const parsed = smirkLeadBatchRequestSchema.parse(request);
    expect(sourcingFiltersForRequest(parsed, null)).toEqual({
      category: "plumbing",
      city: "Reno",
      state: "NV",
      limit: 8,
    });
    expect(hashSmirkLeadBatchValue(parsed)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects contact authority, spend, oversized batches, and partial metros", () => {
    for (const invalid of [
      { ...request, contactActionAllowed: true },
      { ...request, maxSpendCents: 1 },
      {
        ...request,
        criteria: { ...request.criteria, limit: 21 },
      },
      {
        ...request,
        criteria: { ...request.criteria, state: undefined },
      },
    ]) {
      expect(smirkLeadBatchRequestSchema.safeParse(invalid).success).toBe(
        false
      );
    }
  });

  it("does not mix a learned segment with manual filters", () => {
    expect(
      smirkLeadBatchRequestSchema.safeParse({
        ...request,
        criteria: {
          ...request.criteria,
          learningMode: "latest_released",
        },
      }).success
    ).toBe(false);
  });

  it("requires exact manual filters for a discovery-bound batch", () => {
    const sourceDiscoveryRequestId =
      "smirk-discovery-22222222-2222-4222-8222-222222222222";
    expect(
      smirkLeadBatchRequestSchema.parse({
        ...request,
        sourceDiscoveryRequestId,
      }).sourceDiscoveryRequestId
    ).toBe(sourceDiscoveryRequestId);
    expect(
      smirkLeadBatchRequestSchema.safeParse({
        ...request,
        sourceDiscoveryRequestId,
        criteria: {
          limit: 8,
          learningMode: "latest_released",
        },
      }).success
    ).toBe(false);
  });
});

describe("SMIRK acquisition experiment campaign binding", () => {
  it("groups every immutable arm assignment under one stable SMIRK campaign", () => {
    const definition = buildAcquisitionSourcingExperimentDefinition({
      experimentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      workspaceId: 1,
      dimension: "category",
      control: {
        label: "Reno plumbing",
        criteria: {
          category: "plumbing",
          city: "Reno",
          state: "NV",
        },
      },
      challenger: {
        label: "Reno HVAC",
        criteria: {
          category: "hvac",
          city: "Reno",
          state: "NV",
        },
      },
      requestsPerArm: 1,
      leadsPerRequest: 10,
      preparedAt: new Date("2026-07-30T18:00:00.000Z"),
    });
    const definitionHash = hashAcquisitionSourcingValue(definition);
    const assignments = definition.assignmentSchedule.map(slot =>
      buildAcquisitionSourcingExperimentAssignment({
        definition,
        definitionHash,
        requestId: `smirk-discovery-${slot.arm}-${slot.slotOrdinal}-fixture`,
        slotOrdinal: slot.slotOrdinal,
      })
    );
    const bindings = assignments.map(
      buildSmirkAcquisitionExperimentCampaignBinding
    );

    expect(new Set(bindings.map(binding => binding.externalId))).toEqual(
      new Set([
        "velvet-acquisition-experiment-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ])
    );
    expect(new Set(bindings.map(binding => binding.name))).toEqual(
      new Set(["Velvet controlled sourcing cohort aaaaaaaa"])
    );
    expect(assignments.map(assignment => assignment.arm).sort()).toEqual([
      "challenger",
      "control",
    ]);
  });
});

describe("SMIRK lead batch learning gate", () => {
  it("uses only a valid released proposal and honors its smaller cap", () => {
    const candidate = parseApprovedSourcingCandidate({
      id: 17,
      candidateKey: "category:plumbing",
      version: 2,
      proposal: JSON.stringify({
        action: "prioritize_for_next_research_batch",
        dimension: "category",
        value: "plumbing",
        maximumNextBatchSize: 5,
      }),
      policyReleaseId: "a630721e-2213-40a5-af3a-d19b31714bf0",
      policyReleaseReceiptHash: "a".repeat(64),
    });
    expect(candidate).not.toBeNull();
    const learnedRequest = smirkLeadBatchRequestSchema.parse({
      ...request,
      criteria: {
        limit: 12,
        learningMode: "latest_released",
      },
    });
    expect(sourcingFiltersForRequest(learnedRequest, candidate)).toEqual({
      category: "plumbing",
      limit: 5,
    });
  });

  it("rejects malformed or action-changing proposals", () => {
    expect(
      parseApprovedSourcingCandidate({
        id: 17,
        candidateKey: "category:plumbing",
        version: 2,
        proposal: JSON.stringify({
          action: "auto_send",
          dimension: "category",
          value: "plumbing",
          maximumNextBatchSize: 20,
        }),
        policyReleaseId: "a630721e-2213-40a5-af3a-d19b31714bf0",
        policyReleaseReceiptHash: "a".repeat(64),
      })
    ).toBeNull();
  });
});

describe("SMIRK lead batch response", () => {
  it("proves a research-only export and its immutable prospect hash", () => {
    const prospects = [prospect];
    expect(
      smirkLeadBatchResponseSchema.parse({
        ok: true,
        contractVersion: SMIRK_LEAD_BATCH_RESPONSE_CONTRACT,
        state: "EXPORTED",
        originalState: "EXPORTED",
        requestId: request.requestId,
        requestPayloadHash: hashSmirkLeadBatchValue(request),
        batchId: 9,
        prospectsHash: hashSmirkLeadBatchValue(prospects),
        prospects,
        appliedLearningCandidate: null,
        sourceDiscoveryRequestId: null,
        contactActionAllowed: false,
        spendAuthorized: false,
        externalAction: "research_export_only",
      })
    ).toMatchObject({
      state: "EXPORTED",
      contactActionAllowed: false,
      spendAuthorized: false,
    });
  });

  it("rejects an EMPTY claim when prospects are present", () => {
    expect(
      smirkLeadBatchResponseSchema.safeParse({
        ok: true,
        contractVersion: SMIRK_LEAD_BATCH_RESPONSE_CONTRACT,
        state: "EMPTY",
        originalState: "EMPTY",
        requestId: request.requestId,
        requestPayloadHash: "a".repeat(64),
        batchId: 9,
        prospectsHash: "b".repeat(64),
        prospects: [prospect],
        appliedLearningCandidate: null,
        contactActionAllowed: false,
        spendAuthorized: false,
        externalAction: "research_export_only",
      }).success
    ).toBe(false);
  });

  it("rejects duplicate prospect identities inside one response", () => {
    expect(
      smirkLeadBatchResponseSchema.safeParse({
        ok: true,
        contractVersion: SMIRK_LEAD_BATCH_RESPONSE_CONTRACT,
        state: "EXPORTED",
        originalState: "EXPORTED",
        requestId: request.requestId,
        requestPayloadHash: hashSmirkLeadBatchValue(request),
        batchId: 9,
        prospectsHash: hashSmirkLeadBatchValue([prospect, prospect]),
        prospects: [prospect, prospect],
        appliedLearningCandidate: null,
        contactActionAllowed: false,
        spendAuthorized: false,
        externalAction: "research_export_only",
      }).success
    ).toBe(false);
  });

  it("verifies the complete durable response before replay", () => {
    const prospects = [prospect];
    const stored = {
      prospects,
      appliedLearningCandidate: null,
      prospectsHash: hashSmirkLeadBatchValue(prospects),
      sourceDiscoveryRequestId:
        "smirk-discovery-22222222-2222-4222-8222-222222222222",
    };
    expect(
      parseStoredSmirkLeadBatchResponse(
        JSON.stringify(stored),
        hashSmirkLeadBatchValue(stored)
      )
    ).toEqual({ ...stored, acquisitionExperimentAssignment: null });
    expect(() =>
      parseStoredSmirkLeadBatchResponse(
        JSON.stringify({
          ...stored,
          acquisitionExperimentAssignment: null,
        }),
        hashSmirkLeadBatchValue(stored)
      )
    ).toThrowError(SmirkLeadBatchStoreError);
    expect(() =>
      parseStoredSmirkLeadBatchResponse(
        JSON.stringify({ ...stored, prospects: [] }),
        hashSmirkLeadBatchValue(stored)
      )
    ).toThrowError(SmirkLeadBatchStoreError);
  });
});

describe("SMIRK lead batch migration", () => {
  it("uses a response column large enough for twenty evidence-rich prospects", () => {
    const migration = fs.readFileSync(
      "drizzle/0023_high_loners.sql",
      "utf8"
    );
    expect(migration).toContain("`responsePayload` mediumtext");
    expect(migration).toContain(
      "smirk_lead_batch_items_owner_lead_unique"
    );
    expect(migration).toContain("smirk_lead_batches_request_unique");
  });
});
