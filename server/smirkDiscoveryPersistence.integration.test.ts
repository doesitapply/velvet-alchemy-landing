import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  audits,
  leads,
  smirkDiscoveryEvents,
  smirkDiscoveryLeadItems,
  smirkDiscoveryRequests,
  smirkLeadBatchItems,
  smirkLeadBatches,
  systemConfig,
} from "../drizzle/schema";
import { getDb } from "./db";
import { smirkDiscoveryRequestSchema } from "./lib/smirkDiscovery";
import { executeClaimedSmirkDiscovery } from "./lib/smirkDiscoveryExecutor";
import {
  approveSmirkDiscovery,
  claimNextSmirkDiscovery,
  getSmirkDiscoveryStatus,
  prepareSmirkDiscovery,
  queueSmirkDiscovery,
} from "./lib/smirkDiscoveryStore";
import { exportSmirkLeadBatch } from "./lib/smirkLeadBatchStore";
import { requireDisposableLoopbackDatabase } from "./testSupport/disposableDatabase";

const requestId = "smirk-discovery-local-persistence-0003";
const batchRequestId = "smirk-source-local-persistence-0003";
const placeId = "synthetic-place-local-loop-0003";
const actor = {
  userId: 1,
  apiKeyId: 1,
  apiKeyName: "SMIRK local research fixture",
};
const configKeys = [
  "smirk_discovery_worker_lock",
  "global_kill_switch",
  `user_kill_switch_${actor.userId}`,
] as const;

const enabled = requireDisposableLoopbackDatabase(
  process.env.RUN_SMIRK_PERSISTENCE_TEST === "1"
);

describe.skipIf(!enabled)("SMIRK discovery persistence loop", () => {
  const originalConfig = new Map<
    string,
    { value: string; description: string | null } | null
  >();
  const originalMapsEnabled = process.env.ENABLE_MAPS_RESEARCH;
  const originalMapsCost = process.env.MAPS_COST_CENTS_PER_REQUEST;
  const originalHunterEnabled = process.env.ENABLE_HUNTER_OWNER_ENRICHMENT;
  const originalHunterKey = process.env.HUNTER_API_KEY;
  const originalHunterCost = process.env.HUNTER_COST_CENTS_PER_CREDIT;

  async function cleanFixture(): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("A loopback DATABASE_URL is required.");

    const priorDiscoveries = await db
      .select({ id: smirkDiscoveryRequests.id })
      .from(smirkDiscoveryRequests)
      .where(eq(smirkDiscoveryRequests.requestId, requestId));
    const discoveryIds = priorDiscoveries.map(row => row.id);
    for (const discoveryId of discoveryIds) {
      await db
        .delete(smirkDiscoveryEvents)
        .where(eq(smirkDiscoveryEvents.discoveryId, discoveryId));
      await db
        .delete(smirkDiscoveryLeadItems)
        .where(eq(smirkDiscoveryLeadItems.discoveryId, discoveryId));
    }
    await db
      .delete(smirkDiscoveryRequests)
      .where(eq(smirkDiscoveryRequests.requestId, requestId));

    const priorBatches = await db
      .select({ id: smirkLeadBatches.id })
      .from(smirkLeadBatches)
      .where(eq(smirkLeadBatches.requestId, batchRequestId));
    for (const batch of priorBatches) {
      await db
        .delete(smirkLeadBatchItems)
        .where(eq(smirkLeadBatchItems.batchId, batch.id));
    }
    await db
      .delete(smirkLeadBatches)
      .where(eq(smirkLeadBatches.requestId, batchRequestId));

    const priorLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(eq(leads.userId, actor.userId), eq(leads.googlePlaceId, placeId))
      );
    for (const lead of priorLeads) {
      await db.delete(audits).where(eq(audits.leadId, lead.id));
      await db.delete(leads).where(eq(leads.id, lead.id));
    }
  }

  beforeAll(async () => {
    process.env.ENABLE_MAPS_RESEARCH = "true";
    process.env.MAPS_COST_CENTS_PER_REQUEST = "1";
    process.env.ENABLE_HUNTER_OWNER_ENRICHMENT = "true";
    process.env.HUNTER_API_KEY = "synthetic-hunter-key";
    process.env.HUNTER_COST_CENTS_PER_CREDIT = "3";
    const db = await getDb();
    if (!db) throw new Error("A loopback DATABASE_URL is required.");
    await cleanFixture();

    for (const key of configKeys) {
      const rows = await db
        .select({
          value: systemConfig.value,
          description: systemConfig.description,
        })
        .from(systemConfig)
        .where(eq(systemConfig.key, key))
        .limit(1);
      originalConfig.set(key, rows[0] || null);
    }
    await db
      .insert(systemConfig)
      .values({
        key: "smirk_discovery_worker_lock",
        value: "unlocked",
        description: "Synthetic local persistence test lock.",
      })
      .onDuplicateKeyUpdate({
        set: { value: "unlocked" },
      });
    await db
      .insert(systemConfig)
      .values({
        key: "global_kill_switch",
        value: "false",
        description: "Synthetic local persistence test only.",
      })
      .onDuplicateKeyUpdate({
        set: { value: "false" },
      });
    await db
      .insert(systemConfig)
      .values({
        key: `user_kill_switch_${actor.userId}`,
        value: "false",
        description: "Synthetic local persistence test only.",
      })
      .onDuplicateKeyUpdate({
        set: { value: "false" },
      });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("A loopback DATABASE_URL is required.");
    await cleanFixture();
    for (const key of configKeys) {
      if (!originalConfig.has(key)) continue;
      const previous = originalConfig.get(key);
      if (!previous) {
        await db.delete(systemConfig).where(eq(systemConfig.key, key));
        continue;
      }
      await db
        .insert(systemConfig)
        .values({
          key,
          value: previous.value,
          description: previous.description,
        })
        .onDuplicateKeyUpdate({
          set: {
            value: previous.value,
            description: previous.description,
          },
        });
    }
    if (originalMapsEnabled === undefined) {
      delete process.env.ENABLE_MAPS_RESEARCH;
    } else {
      process.env.ENABLE_MAPS_RESEARCH = originalMapsEnabled;
    }
    if (originalMapsCost === undefined) {
      delete process.env.MAPS_COST_CENTS_PER_REQUEST;
    } else {
      process.env.MAPS_COST_CENTS_PER_REQUEST = originalMapsCost;
    }
    if (originalHunterEnabled === undefined) {
      delete process.env.ENABLE_HUNTER_OWNER_ENRICHMENT;
    } else {
      process.env.ENABLE_HUNTER_OWNER_ENRICHMENT = originalHunterEnabled;
    }
    if (originalHunterKey === undefined) {
      delete process.env.HUNTER_API_KEY;
    } else {
      process.env.HUNTER_API_KEY = originalHunterKey;
    }
    if (originalHunterCost === undefined) {
      delete process.env.HUNTER_COST_CENTS_PER_CREDIT;
    } else {
      process.env.HUNTER_COST_CENTS_PER_CREDIT = originalHunterCost;
    }
  });

  it("persists discovery, review evidence, export, and exact replay", async () => {
    const request = smirkDiscoveryRequestSchema.parse({
      contractVersion: "smirk-velvet.discovery-request.v2",
      requestId,
      workspaceId: 1,
      criteria: {
        limit: 1,
        category: "Plumbing",
        city: "Reno",
        state: "NV",
        learningMode: "none",
      },
      contactActionAllowed: false,
      spendAuthorized: false,
    });

    const prepared = await prepareSmirkDiscovery(request, actor);
    expect(prepared.outcome).toBe("created");
    expect(prepared.response.quote.maximumCostCents).toBe(5);

    const approved = await approveSmirkDiscovery({
      discoveryId: prepared.response.discoveryId,
      userId: actor.userId,
      actorId: actor.userId,
      requestPayloadHash: prepared.response.requestPayloadHash,
      quotePayloadHash: prepared.response.quotePayloadHash,
      approvedMaxSpendCents: prepared.response.quote.maximumCostCents,
    });
    expect(approved.state).toBe("APPROVED");

    process.env.HUNTER_COST_CENTS_PER_CREDIT = "4";
    await expect(
      queueSmirkDiscovery({
        discoveryId: prepared.response.discoveryId,
        userId: actor.userId,
        actorId: actor.userId,
        requestPayloadHash: prepared.response.requestPayloadHash,
        quotePayloadHash: prepared.response.quotePayloadHash,
      })
    ).rejects.toMatchObject({
      code: "SMIRK_DISCOVERY_QUOTE_CHANGED",
      status: 412,
    });
    process.env.HUNTER_COST_CENTS_PER_CREDIT = "3";

    const queued = await queueSmirkDiscovery({
      discoveryId: prepared.response.discoveryId,
      userId: actor.userId,
      actorId: actor.userId,
      requestPayloadHash: prepared.response.requestPayloadHash,
      quotePayloadHash: prepared.response.quotePayloadHash,
    });
    expect(queued.state).toBe("QUEUED");

    const claim = await claimNextSmirkDiscovery();
    expect(claim?.requestId).toBe(requestId);
    if (!claim) throw new Error("The synthetic discovery was not claimed.");

    let providerCalls = 0;
    let ownerEmailCalls = 0;
    await executeClaimedSmirkDiscovery(claim, {
      requestMaps: async (path: string) => {
        providerCalls += 1;
        if (path.includes("textsearch")) {
          return {
            status: "OK",
            results: [{ place_id: placeId }],
          };
        }
        return {
          status: "OK",
          result: {
            name: "Synthetic Reno Plumbing",
            website: "https://example.com/synthetic-reno-plumbing",
            formatted_address: "100 Example Avenue, Reno, NV 89501",
            formatted_phone_number: "+12025550124",
            rating: 4.7,
            user_ratings_total: 19,
            business_status: "OPERATIONAL",
            reviews: [{ text: "Synthetic fixture review." }],
          },
        };
      },
      findOwnerEmail: async (domain, context) => {
        ownerEmailCalls += 1;
        expect(domain).toBe("https://example.com/synthetic-reno-plumbing");
        expect(context).toMatchObject({
          userId: actor.userId,
          approvedCostCentsPerCredit: 3,
        });
        return {
          email: "owner@example.com",
          title: "Owner",
          confidence: 95,
          source: "hunter",
        };
      },
    });
    expect(providerCalls).toBe(2);
    expect(ownerEmailCalls).toBe(1);

    const status = await getSmirkDiscoveryStatus(requestId, actor.userId);
    expect(status).toMatchObject({
      state: "COMPLETED",
      providerRequests: 3,
      createdLeadCount: 1,
      readyLeadCount: 1,
      skippedLeadCount: 0,
      failedLeadCount: 0,
      contactActionAllowed: false,
    });

    const batchRequest = {
      contractVersion: "smirk-velvet.lead-batch-request.v1" as const,
      requestId: batchRequestId,
      workspaceId: 1,
      sourceDiscoveryRequestId: requestId,
      criteria: {
        limit: 1,
        category: "Plumbing",
        city: "Reno",
        state: "NV",
        learningMode: "none" as const,
      },
      contactActionAllowed: false as const,
      maxSpendCents: 0 as const,
    };
    const exported = await exportSmirkLeadBatch(batchRequest, actor);
    const replay = await exportSmirkLeadBatch(batchRequest, actor);

    expect(exported).toMatchObject({
      outcome: "created",
      originalState: "EXPORTED",
      sourceDiscoveryRequestId: requestId,
    });
    expect(exported.prospects).toHaveLength(1);
    expect(exported.prospects[0]).toMatchObject({
      workspaceId: 1,
      prospect: {
        companyName: "Synthetic Reno Plumbing",
        email: "owner@example.com",
        emailVerification: "verified_owner_email",
        phoneContactMode: "operator_review_only",
      },
    });
    expect(replay).toEqual({
      ...exported,
      outcome: "duplicate",
    });
  });
});
