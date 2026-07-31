import crypto from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import { and, eq } from "drizzle-orm";
import {
  apiKeys,
  leads,
  smirkDiscoveryRequests,
  smirkLeadBatches,
  smirkOutcomeEvents,
  systemConfig,
  users,
} from "../../drizzle/schema";
import { createApiRouter } from "../apiRouter";
import { getDb } from "../db";
import { executeClaimedSmirkDiscovery } from "../lib/smirkDiscoveryExecutor";
import {
  approveSmirkDiscovery,
  claimNextSmirkDiscovery,
  getSmirkDiscoveryStatus,
  prepareSmirkDiscovery,
  queueSmirkDiscovery,
} from "../lib/smirkDiscoveryStore";
import { smirkDiscoveryRequestSchema } from "../lib/smirkDiscovery";
import { requireDisposableLoopbackDatabase } from "./disposableDatabase";

const FIXTURE_MODE = "smirk-cross-db-v1";
const sourceApiKey = String(
  process.env.VELVET_CROSS_DB_SOURCE_API_KEY || ""
).trim();
const outcomeApiKey = String(
  process.env.VELVET_CROSS_DB_OUTCOME_API_KEY || ""
).trim();
const controlToken = String(
  process.env.VELVET_CROSS_DB_CONTROL_TOKEN || ""
).trim();
const runId = String(process.env.VELVET_CROSS_DB_RUN_ID || "")
  .trim()
  .replace(/[^A-Za-z0-9_-]/g, "")
  .slice(0, 80);

if (process.env.VELVET_CROSS_DB_FIXTURE !== "1") {
  throw new Error("The cross-system fixture requires explicit fixture mode.");
}
requireDisposableLoopbackDatabase(true);
if (
  sourceApiKey.length < 32 ||
  outcomeApiKey.length < 32 ||
  sourceApiKey === outcomeApiKey ||
  controlToken.length < 32 ||
  runId.length < 12
) {
  throw new Error("The cross-system fixture credentials are invalid.");
}
if (process.env.SMIRK_RESEARCH_WORKSPACE_ID !== "1") {
  throw new Error("The cross-system fixture is locked to workspace 1.");
}
if (
  String(process.env.SMIRK_OUTCOME_SIGNING_SECRET || "").trim().length < 32
) {
  throw new Error("The cross-system fixture requires an outcome signing secret.");
}

process.env.ENABLE_MAPS_RESEARCH = "true";
process.env.MAPS_COST_CENTS_PER_REQUEST = "1";

const openId = `codex-cross-db-owner-${runId}`;
const discoveryRequestId = `smirk-discovery-${runId}`;
const placeId = `synthetic-place-${runId}`;
const expectedCompanyName = "Synthetic Silver State Plumbing";

function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

async function seedApiKey(input: {
  userId: number;
  rawKey: string;
  name: string;
  scopes: string[];
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("The disposable Velvet database is unavailable.");
  const keyHash = hashApiKey(input.rawKey);
  await db
    .insert(apiKeys)
    .values({
      userId: input.userId,
      name: input.name,
      keyHash,
      keyPrefix: input.rawKey.slice(0, 12),
      scopes: JSON.stringify(input.scopes),
      isActive: true,
    })
    .onDuplicateKeyUpdate({
      set: {
        userId: input.userId,
        name: input.name,
        scopes: JSON.stringify(input.scopes),
        isActive: true,
      },
    });
  const rows = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);
  const id = Number(rows[0]?.id || 0);
  if (!id) throw new Error("The synthetic API key was not persisted.");
  return id;
}

async function prepareSyntheticDiscovery(): Promise<{
  userId: number;
  sourceApiKeyId: number;
  leadId: number;
  externalProspectId: string;
  providerRequests: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("The disposable Velvet database is unavailable.");

  await db
    .insert(users)
    .values({
      openId,
      name: "Synthetic Cross-DB Owner",
      email: `${runId}@example.invalid`,
      loginMethod: "local",
      role: "admin",
    })
    .onDuplicateKeyUpdate({
      set: {
        name: "Synthetic Cross-DB Owner",
        role: "admin",
      },
    });
  const ownerRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  const userId = Number(ownerRows[0]?.id || 0);
  if (!userId) throw new Error("The synthetic owner was not persisted.");

  const sourceApiKeyId = await seedApiKey({
    userId,
    rawKey: sourceApiKey,
    name: "SMIRK disposable source fixture",
    scopes: ["smirk:research"],
  });
  await seedApiKey({
    userId,
    rawKey: outcomeApiKey,
    name: "SMIRK disposable outcome fixture",
    scopes: ["outcome:write"],
  });

  for (const [key, value] of [
    ["smirk_discovery_worker_lock", "unlocked"],
    ["global_kill_switch", "false"],
    [`user_kill_switch_${userId}`, "false"],
  ] as const) {
    await db
      .insert(systemConfig)
      .values({
        key,
        value,
        description: "Synthetic cross-database fixture only.",
      })
      .onDuplicateKeyUpdate({ set: { value } });
  }

  const request = smirkDiscoveryRequestSchema.parse({
    contractVersion: "smirk-velvet.discovery-request.v1",
    requestId: discoveryRequestId,
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
  const actor = {
    userId,
    apiKeyId: sourceApiKeyId,
    apiKeyName: "SMIRK disposable source fixture",
  };
  const prepared = await prepareSmirkDiscovery(request, actor);
  const approved = await approveSmirkDiscovery({
    discoveryId: prepared.response.discoveryId,
    userId,
    actorId: userId,
    requestPayloadHash: prepared.response.requestPayloadHash,
    quotePayloadHash: prepared.response.quotePayloadHash,
    approvedMaxSpendCents: prepared.response.quote.maximumCostCents,
  });
  if (approved.state !== "APPROVED") {
    throw new Error(`Unexpected discovery approval state: ${approved.state}`);
  }
  const queued = await queueSmirkDiscovery({
    discoveryId: prepared.response.discoveryId,
    userId,
    actorId: userId,
    requestPayloadHash: prepared.response.requestPayloadHash,
    quotePayloadHash: prepared.response.quotePayloadHash,
  });
  if (queued.state !== "QUEUED") {
    throw new Error(`Unexpected discovery queue state: ${queued.state}`);
  }
  const claim = await claimNextSmirkDiscovery();
  if (!claim || claim.requestId !== discoveryRequestId) {
    throw new Error("The synthetic discovery was not claimed exactly once.");
  }

  let adapterCalls = 0;
  await executeClaimedSmirkDiscovery(claim, {
    requestMaps: async <T = unknown>(path: string): Promise<T> => {
      adapterCalls += 1;
      if (path.includes("textsearch")) {
        return {
          status: "OK",
          results: [{ place_id: placeId }],
        } as T;
      }
      return {
        status: "OK",
        result: {
          name: expectedCompanyName,
          website: "https://example.invalid/synthetic-plumbing",
          formatted_address: "100 Example Avenue, Reno, NV 89501",
          formatted_phone_number: "+12025550124",
          rating: 4.8,
          user_ratings_total: 24,
          business_status: "OPERATIONAL",
          reviews: [{ text: "Synthetic fixture review only." }],
        },
      } as T;
    },
  });
  const status = await getSmirkDiscoveryStatus(discoveryRequestId, userId);
  if (
    status.state !== "COMPLETED" ||
    status.createdLeadCount !== 1 ||
    status.readyLeadCount !== 1 ||
    status.providerRequests !== 2 ||
    adapterCalls !== 2
  ) {
    throw new Error("The synthetic discovery did not complete as expected.");
  }
  const leadRows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.userId, userId),
        eq(leads.googlePlaceId, placeId)
      )
    )
    .limit(1);
  const leadId = Number(leadRows[0]?.id || 0);
  if (!leadId) throw new Error("The synthetic discovered lead is missing.");
  await db
    .update(leads)
    .set({
      verifiedOwnerEmail: `owner-${runId}@example.invalid`,
      outreachChannel: "email",
    })
    .where(
      and(
        eq(leads.id, leadId),
        eq(leads.userId, userId)
      )
    );

  return {
    userId,
    sourceApiKeyId,
    leadId,
    externalProspectId: `velvet-owner-${userId}-lead-${leadId}`,
    providerRequests: adapterCalls,
  };
}

async function fixtureState(input: {
  userId: number;
  leadId: number;
}): Promise<Record<string, unknown>> {
  const db = await getDb();
  if (!db) throw new Error("The disposable Velvet database is unavailable.");
  const leadRows = await db
    .select({
      id: leads.id,
      companyName: leads.companyName,
      status: leads.status,
      smirkCallOutcome: leads.smirkCallOutcome,
      smirkWorkspaceId: leads.smirkWorkspaceId,
    })
    .from(leads)
    .where(
      and(
        eq(leads.id, input.leadId),
        eq(leads.userId, input.userId)
      )
    )
    .limit(1);
  const outcomeRows = await db
    .select({
      id: smirkOutcomeEvents.id,
      externalEventId: smirkOutcomeEvents.externalEventId,
      outcome: smirkOutcomeEvents.outcome,
      eventPayloadHash: smirkOutcomeEvents.eventPayloadHash,
    })
    .from(smirkOutcomeEvents)
    .where(eq(smirkOutcomeEvents.userId, input.userId));
  const batchRows = await db
    .select({
      id: smirkLeadBatches.id,
      requestId: smirkLeadBatches.requestId,
      state: smirkLeadBatches.state,
      leadCount: smirkLeadBatches.leadCount,
    })
    .from(smirkLeadBatches)
    .where(eq(smirkLeadBatches.userId, input.userId));
  const discoveryRows = await db
    .select({
      id: smirkDiscoveryRequests.id,
      requestId: smirkDiscoveryRequests.requestId,
      state: smirkDiscoveryRequests.state,
      providerRequests: smirkDiscoveryRequests.providerRequests,
      readyLeadCount: smirkDiscoveryRequests.readyLeadCount,
    })
    .from(smirkDiscoveryRequests)
    .where(eq(smirkDiscoveryRequests.userId, input.userId));
  const keyRows = await db
    .select({
      id: apiKeys.id,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, input.userId));
  return {
    mode: FIXTURE_MODE,
    lead: leadRows[0] || null,
    outcomes: outcomeRows,
    batches: batchRows,
    discoveries: discoveryRows,
    apiKeys: keyRows,
  };
}

async function main(): Promise<void> {
  const fixture = await prepareSyntheticDiscovery();
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.get("/__fixture/state", async (req, res) => {
    if (req.headers["x-fixture-token"] !== controlToken) {
      return res.status(401).json({ error: "Unauthorized fixture request." });
    }
    try {
      return res.json(
        await fixtureState({
          userId: fixture.userId,
          leadId: fixture.leadId,
        })
      );
    } catch {
      return res.status(503).json({ error: "Fixture state unavailable." });
    }
  });
  app.use("/api/v1", createApiRouter());

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("The fixture server did not bind to loopback.");
  }

  process.stdout.write(
    `VELVET_CROSS_DB_READY ${JSON.stringify({
      mode: FIXTURE_MODE,
      port: address.port,
      userId: fixture.userId,
      leadId: fixture.leadId,
      externalProspectId: fixture.externalProspectId,
      discoveryRequestId,
      providerRequests: fixture.providerRequests,
    })}\n`
  );

  const stop = async () => {
    await closeServer(server);
    process.exit(0);
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`VELVET_CROSS_DB_ERROR ${message}\n`);
  process.exit(1);
});
