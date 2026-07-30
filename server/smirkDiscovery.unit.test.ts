import { describe, expect, it } from "vitest";
import {
  SMIRK_DISCOVERY_REQUEST_CONTRACT,
  assertSmirkDiscoveryProviderRequest,
  buildSmirkDiscoveryEffectiveCriteria,
  buildSmirkDiscoveryQuote,
  hashSmirkDiscoveryValue,
  smirkDiscoveryPreparedResponseSchema,
  smirkDiscoveryRequestSchema,
  smirkDiscoveryStatusResponseSchema,
} from "./lib/smirkDiscovery";
import type { AppliedLearningCandidate } from "./lib/smirkLeadBatch";

function manualRequest() {
  return smirkDiscoveryRequestSchema.parse({
    contractVersion: SMIRK_DISCOVERY_REQUEST_CONTRACT,
    requestId: "smirk_discovery_20260730_example_001",
    workspaceId: 1,
    criteria: {
      limit: 5,
      category: "plumbing",
      city: "Reno",
      state: "NV",
      learningMode: "none",
    },
    contactActionAllowed: false,
    spendAuthorized: false,
  });
}

describe("SMIRK discovery contract", () => {
  it("requires no-contact and no-spend request semantics", () => {
    expect(
      smirkDiscoveryRequestSchema.safeParse({
        ...manualRequest(),
        contactActionAllowed: true,
      }).success
    ).toBe(false);
    expect(
      smirkDiscoveryRequestSchema.safeParse({
        ...manualRequest(),
        spendAuthorized: true,
      }).success
    ).toBe(false);
  });

  it("builds a deterministic bounded Maps quote", () => {
    const criteria = buildSmirkDiscoveryEffectiveCriteria({
      request: manualRequest(),
      candidate: null,
    });
    const quote = buildSmirkDiscoveryQuote(
      criteria,
      {
        ENABLE_MAPS_RESEARCH: "true",
        MAPS_COST_CENTS_PER_REQUEST: "2",
      },
      new Date("2026-07-30T12:00:00.000Z")
    );
    expect(quote).toEqual({
      provider: "google_maps_proxy",
      maximumRequests: 6,
      costCentsPerRequest: 2,
      maximumCostCents: 12,
      quotedAt: "2026-07-30T12:00:00.000Z",
    });
  });

  it("rejects a quote above the five-dollar request cap", () => {
    const request = smirkDiscoveryRequestSchema.parse({
      ...manualRequest(),
      criteria: { ...manualRequest().criteria, limit: 20 },
    });
    const criteria = buildSmirkDiscoveryEffectiveCriteria({
      request,
      candidate: null,
    });
    expect(() =>
      buildSmirkDiscoveryQuote(criteria, {
        ENABLE_MAPS_RESEARCH: "true",
        MAPS_COST_CENTS_PER_REQUEST: "25",
      })
    ).toThrow("exceeds the 500-cent");
  });

  it("enforces the exact approved amount and provider-request count", () => {
    const quote = buildSmirkDiscoveryQuote(
      buildSmirkDiscoveryEffectiveCriteria({
        request: manualRequest(),
        candidate: null,
      }),
      {
        ENABLE_MAPS_RESEARCH: "true",
        MAPS_COST_CENTS_PER_REQUEST: "2",
      },
      new Date("2026-07-30T12:00:00.000Z")
    );
    expect(() =>
      assertSmirkDiscoveryProviderRequest({
        quote,
        approvedMaxSpendCents: 12,
        nextRequestNumber: 6,
      })
    ).not.toThrow();
    expect(() =>
      assertSmirkDiscoveryProviderRequest({
        quote,
        approvedMaxSpendCents: 11,
        nextRequestNumber: 1,
      })
    ).toThrow("exact operator-approved");
    expect(() =>
      assertSmirkDiscoveryProviderRequest({
        quote,
        approvedMaxSpendCents: 12,
        nextRequestNumber: 7,
      })
    ).toThrow("exact operator-approved");
  });

  it("combines an approved category candidate with an operator-selected metro", () => {
    const candidate: AppliedLearningCandidate = {
      id: 7,
      candidateKey: "category:plumbing",
      version: 2,
      proposal: {
        action: "prioritize_for_next_research_batch",
        dimension: "category",
        value: "plumbing",
        maximumNextBatchSize: 4,
      },
    };
    const request = smirkDiscoveryRequestSchema.parse({
      contractVersion: SMIRK_DISCOVERY_REQUEST_CONTRACT,
      requestId: "smirk_discovery_20260730_learned_001",
      workspaceId: 1,
      criteria: {
        limit: 10,
        city: "Reno",
        state: "NV",
        learningMode: "latest_approved",
      },
      contactActionAllowed: false,
      spendAuthorized: false,
    });
    expect(
      buildSmirkDiscoveryEffectiveCriteria({ request, candidate })
    ).toEqual({
      limit: 4,
      category: "plumbing",
      city: "Reno",
      state: "NV",
    });
  });

  it("combines an approved metro candidate with an operator-selected category", () => {
    const candidate: AppliedLearningCandidate = {
      id: 8,
      candidateKey: "metro:reno-nv",
      version: 1,
      proposal: {
        action: "prioritize_for_next_research_batch",
        dimension: "metro",
        value: "Reno, NV",
        maximumNextBatchSize: 8,
      },
    };
    const request = smirkDiscoveryRequestSchema.parse({
      contractVersion: SMIRK_DISCOVERY_REQUEST_CONTRACT,
      requestId: "smirk_discovery_20260730_learned_002",
      workspaceId: 1,
      criteria: {
        limit: 6,
        category: "hvac",
        learningMode: "latest_approved",
      },
      contactActionAllowed: false,
      spendAuthorized: false,
    });
    expect(
      buildSmirkDiscoveryEffectiveCriteria({ request, candidate })
    ).toEqual({
      limit: 6,
      category: "hvac",
      city: "Reno",
      state: "NV",
    });
  });

  it("validates prepared and status receipts without granting execution", () => {
    const request = manualRequest();
    const criteria = buildSmirkDiscoveryEffectiveCriteria({
      request,
      candidate: null,
    });
    const quote = buildSmirkDiscoveryQuote(
      criteria,
      {
        ENABLE_MAPS_RESEARCH: "true",
        MAPS_COST_CENTS_PER_REQUEST: "1",
      },
      new Date("2026-07-30T12:00:00.000Z")
    );
    const requestPayloadHash = hashSmirkDiscoveryValue(request);
    expect(
      smirkDiscoveryPreparedResponseSchema.parse({
        ok: true,
        contractVersion: "velvet-smirk.discovery-response.v1",
        state: "PREPARED",
        originalState: "PREPARED",
        currentState: "PREPARED",
        requestId: request.requestId,
        requestPayloadHash,
        quotePayloadHash: hashSmirkDiscoveryValue(quote),
        discoveryId: 11,
        effectiveCriteria: criteria,
        appliedLearningCandidate: null,
        quote,
        approvalRequired: true,
        executionStarted: false,
        contactActionAllowed: false,
        spendAuthorized: false,
        externalAction: "discovery_approval_required",
      }).executionStarted
    ).toBe(false);
    expect(
      smirkDiscoveryStatusResponseSchema.parse({
        ok: true,
        contractVersion: "velvet-smirk.discovery-status.v1",
        requestId: request.requestId,
        requestPayloadHash,
        quotePayloadHash: hashSmirkDiscoveryValue(quote),
        discoveryId: 11,
        state: "PREPARED",
        effectiveCriteria: criteria,
        appliedLearningCandidate: null,
        quote,
        createdLeadCount: 0,
        readyLeadCount: 0,
        skippedLeadCount: 0,
        failedLeadCount: 0,
        providerRequests: 0,
        approvedMaxSpendCents: null,
        error: null,
        contactActionAllowed: false,
        externalAction: "discovery_status_only",
      }).contactActionAllowed
    ).toBe(false);
  });
});
