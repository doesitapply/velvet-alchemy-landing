import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateSmirkDiscoveryDetail } from "./lib/smirkDiscoveryExecutor";
import {
  SMIRK_DISCOVERY_APPROVAL_CONFIRMATION,
  SMIRK_DISCOVERY_CANCELLATION_CONFIRMATION,
  SMIRK_DISCOVERY_EXECUTION_CONFIRMATION,
  SMIRK_DISCOVERY_REJECTION_CONFIRMATION,
} from "./lib/smirkDiscovery";

const storeSource = readFileSync(
  new URL("./lib/smirkDiscoveryStore.ts", import.meta.url),
  "utf8"
);
const leadBatchStoreSource = readFileSync(
  new URL("./lib/smirkLeadBatchStore.ts", import.meta.url),
  "utf8"
);
const executorSource = readFileSync(
  new URL("./lib/smirkDiscoveryExecutor.ts", import.meta.url),
  "utf8"
);
const workerSource = readFileSync(
  new URL("./smirkDiscoveryWorker.ts", import.meta.url),
  "utf8"
);
const routerSource = readFileSync(
  new URL("./smirkDiscoveryRouter.ts", import.meta.url),
  "utf8"
);
const apiSource = readFileSync(
  new URL("./apiRouter.ts", import.meta.url),
  "utf8"
);
const schemaSource = readFileSync(
  new URL("../drizzle/schema.ts", import.meta.url),
  "utf8"
);

function detail(overrides: Record<string, unknown> = {}) {
  return {
    sourcePlaceId: "safe-place-1",
    place_id: "safe-place-1",
    name: "Silver State Plumbing",
    formatted_address: "123 Test Ave, Reno, NV",
    formatted_phone_number: "(775) 555-0100",
    website: "https://example.test/",
    rating: 4.7,
    user_ratings_total: 80,
    business_status: "OPERATIONAL",
    geometry: { location: { lat: 39.5, lng: -119.8 } },
    ...overrides,
  };
}

describe("SMIRK discovery execution safety", () => {
  it("accepts only an operational public business with a review phone", () => {
    expect(evaluateSmirkDiscoveryDetail(detail())).toEqual({
      accepted: true,
      website: "https://example.test/",
      phone: "+17755550100",
      reviewCount: 80,
    });
    expect(
      evaluateSmirkDiscoveryDetail(
        detail({ formatted_phone_number: undefined })
      )
    ).toEqual({
      accepted: false,
      reason: "no_operator_review_phone",
    });
  });

  it("rejects aggregators, known chains, and non-operational listings", () => {
    expect(
      evaluateSmirkDiscoveryDetail(
        detail({ website: "https://www.yelp.com/biz/test" })
      )
    ).toEqual({
      accepted: false,
      reason: "aggregator_or_directory",
    });
    expect(
      evaluateSmirkDiscoveryDetail(detail({ name: "Roto-Rooter Reno" }))
    ).toEqual({
      accepted: false,
      reason: "known_chain_signal",
    });
    expect(
      evaluateSmirkDiscoveryDetail(
        detail({ business_status: "CLOSED_PERMANENTLY" })
      )
    ).toEqual({
      accepted: false,
      reason: "business_not_operational",
    });
  });

  it("keeps approval, queueing, execution, expiration, and leases separate", () => {
    expect(storeSource).toContain('state: "APPROVED"');
    expect(storeSource).toContain('state: "QUEUED"');
    expect(storeSource).toContain('state: "RUNNING"');
    expect(storeSource).toContain('state: "EXPIRED"');
    expect(storeSource).toContain("automatic retry is disabled");
    expect(storeSource).toContain("smirk_discovery_worker_lock");
    expect(storeSource).toContain('"global_kill_switch"');
    expect(storeSource).toContain("user_kill_switch_");
    expect(SMIRK_DISCOVERY_APPROVAL_CONFIRMATION).toBe(
      "approve-one-smirk-discovery-v2"
    );
    expect(SMIRK_DISCOVERY_EXECUTION_CONFIRMATION).toBe(
      "execute-one-smirk-discovery-v2"
    );
    expect(SMIRK_DISCOVERY_REJECTION_CONFIRMATION).toBe(
      "reject-one-smirk-discovery-v2"
    );
    expect(SMIRK_DISCOVERY_CANCELLATION_CONFIRMATION).toBe(
      "cancel-one-smirk-discovery-v2"
    );
    expect(routerSource).toContain("SMIRK_DISCOVERY_APPROVAL_CONFIRMATION");
  });

  it("keeps the worker disabled by default and bounded to one claimed job", () => {
    expect(workerSource).toContain(
      'process.env.ENABLE_SMIRK_DISCOVERY_WORKER !== "true"'
    );
    expect(workerSource).toContain("claimNextSmirkDiscovery()");
    expect(workerSource).not.toContain("Promise.all");
    expect(workerSource).not.toContain("retry");
  });

  it("creates research records and bounded owner-email evidence without contact code", () => {
    expect(executorSource).toContain("contactActionAllowed: false");
    expect(executorSource).toContain('outreachChannel: "none"');
    expect(executorSource).toContain(
      "claim.quote.providers.maps.costCentsPerRequest"
    );
    expect(executorSource).toContain("findVerifiedOwnerEmail");
    expect(executorSource).toContain("ownerContactMatchesRequestedDomain");
    expect(executorSource).toContain('outreachChannel: "email"');
    expect(executorSource).toContain("approvedCostCentsPerCredit");
    expect(executorSource).not.toContain("sendEmail");
    expect(executorSource).not.toContain("sendSms");
    expect(executorSource).not.toContain("Twilio");
    expect(executorSource).not.toContain("invokeLLM");
  });

  it("exposes only prepare and status to the dedicated SMIRK key", () => {
    expect(apiSource).toContain('"/smirk/discovery-requests"');
    expect(apiSource).toContain('"/smirk/discovery-requests/:requestId"');
    expect(apiSource).not.toContain(
      '"/smirk/discovery-requests/:requestId/approve"'
    );
    expect(schemaSource).toContain("smirk_discovery_requests");
    expect(schemaSource).toContain("smirk_discovery_lead_items");
    expect(schemaSource).toContain("smirk_discovery_events");
  });

  it("exports a discovery-bound batch only from exact READY receipts", () => {
    expect(leadBatchStoreSource).toContain("request.sourceDiscoveryRequestId");
    expect(leadBatchStoreSource).toContain("smirkDiscoveryRequests.requestId");
    expect(leadBatchStoreSource).toContain(
      'eq(smirkDiscoveryLeadItems.state, "READY")'
    );
    expect(leadBatchStoreSource).toContain(
      "inArray(leads.id, discoveryLeadIds)"
    );
    expect(leadBatchStoreSource).toContain(
      "SMIRK_LEAD_BATCH_DISCOVERY_NOT_READY"
    );
  });
});
