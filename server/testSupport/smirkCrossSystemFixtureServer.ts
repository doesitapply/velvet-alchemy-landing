import crypto from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import { and, eq } from "drizzle-orm";
import {
  acquisitionLearningCandidates,
  acquisitionSourcingExperimentEvents,
  acquisitionSourcingExperiments,
  apiKeys,
  leads,
  smirkDiscoveryLeadItems,
  smirkDiscoveryRequests,
  smirkLeadBatches,
  smirkOutcomeEvents,
  systemConfig,
  users,
} from "../../drizzle/schema";
import { createApiRouter } from "../apiRouter";
import { getDb } from "../db";
import {
  activateAcquisitionSourcingExperiment,
  closeAcquisitionSourcingExperiment,
  prepareAcquisitionSourcingExperiment,
  AcquisitionSourcingExperimentStoreError,
} from "../lib/acquisitionSourcingExperimentStore";
import { executeClaimedSmirkDiscovery } from "../lib/smirkDiscoveryExecutor";
import {
  approveSmirkDiscovery,
  claimNextSmirkDiscovery,
  getSmirkDiscoveryStatus,
  prepareSmirkDiscovery,
  queueSmirkDiscovery,
  SmirkDiscoveryStoreError,
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
if (String(process.env.SMIRK_OUTCOME_SIGNING_SECRET || "").trim().length < 32) {
  throw new Error(
    "The cross-system fixture requires an outcome signing secret."
  );
}

process.env.ENABLE_MAPS_RESEARCH = "true";
process.env.MAPS_COST_CENTS_PER_REQUEST = "1";
process.env.ENABLE_HUNTER_OWNER_ENRICHMENT = "true";
process.env.HUNTER_API_KEY = "synthetic-cross-db-hunter-key";
process.env.HUNTER_COST_CENTS_PER_CREDIT = "1";

const openId = `codex-cross-db-owner-${runId}`;
const discoveryRequestId = `smirk-discovery-${runId}`;
const placeId = `synthetic-place-${runId}`;
const expectedCompanyName = "Synthetic Silver State Plumbing";
const experimentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
  experimentId: string;
  experimentDefinitionHash: string;
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
    contractVersion: "smirk-velvet.discovery-request.v2",
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
  let ownerEmailCalls = 0;
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
    findOwnerEmail: async (domain, context) => {
      ownerEmailCalls += 1;
      if (
        domain !== "https://example.invalid/synthetic-plumbing" ||
        context.approvedCostCentsPerCredit !== 1
      ) {
        throw new Error(
          "The synthetic owner-email request was not quote-bound."
        );
      }
      return {
        email: `owner-${runId}@example.invalid`,
        title: "Owner",
        confidence: 95,
        source: "hunter",
      };
    },
  });
  const status = await getSmirkDiscoveryStatus(discoveryRequestId, userId);
  if (
    status.state !== "COMPLETED" ||
    status.createdLeadCount !== 1 ||
    status.readyLeadCount !== 1 ||
    status.providerRequests !== 3 ||
    adapterCalls !== 2 ||
    ownerEmailCalls !== 1
  ) {
    throw new Error("The synthetic discovery did not complete as expected.");
  }
  const leadRows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.userId, userId), eq(leads.googlePlaceId, placeId)))
    .limit(1);
  const leadId = Number(leadRows[0]?.id || 0);
  if (!leadId) throw new Error("The synthetic discovered lead is missing.");
  const preparedExperiment = await prepareAcquisitionSourcingExperiment({
    experimentId,
    workspaceId: 1,
    dimension: "category",
    control: {
      label: "Reno plumbing",
      criteria: {
        category: "Plumbing",
        city: "Reno",
        state: "NV",
      },
    },
    challenger: {
      label: "Reno HVAC",
      criteria: {
        category: "HVAC",
        city: "Reno",
        state: "NV",
      },
    },
    requestsPerArm: 1,
    leadsPerRequest: 10,
    userId,
    actorId: userId,
  });
  const activatedExperiment = await activateAcquisitionSourcingExperiment({
    experimentId,
    definitionHash: preparedExperiment.experiment.definitionHash,
    userId,
    actorId: userId,
  });
  if (
    activatedExperiment.state !== "ACTIVE" ||
    activatedExperiment.assignedRequests !== 0 ||
    activatedExperiment.contactActionAllowed !== false ||
    activatedExperiment.spendAuthorized !== false ||
    activatedExperiment.policyChanged !== false
  ) {
    throw new Error(
      "The synthetic sourcing experiment was not activated safely."
    );
  }

  return {
    userId,
    sourceApiKeyId,
    leadId,
    externalProspectId: `velvet-owner-${userId}-lead-${leadId}`,
    providerRequests: adapterCalls + ownerEmailCalls,
    experimentId,
    experimentDefinitionHash: activatedExperiment.definitionHash,
  };
}

async function executeSyntheticExperimentDiscovery(input: {
  userId: number;
  requestId: string;
  assignmentHash: string;
}): Promise<Record<string, unknown>> {
  const db = await getDb();
  if (!db) throw new Error("The disposable Velvet database is unavailable.");
  const before = await getSmirkDiscoveryStatus(input.requestId, input.userId);
  if (
    before.state !== "PREPARED" ||
    before.acquisitionExperimentAssignment?.experimentId !== experimentId ||
    before.acquisitionExperimentAssignment.assignmentHash !==
      input.assignmentHash ||
    before.effectiveCriteria.limit !== 10
  ) {
    throw new Error("The experiment discovery assignment is not exact.");
  }
  const approved = await approveSmirkDiscovery({
    discoveryId: before.discoveryId,
    userId: input.userId,
    actorId: input.userId,
    requestPayloadHash: before.requestPayloadHash,
    quotePayloadHash: before.quotePayloadHash,
    approvedMaxSpendCents: before.quote.maximumCostCents,
  });
  if (approved.state !== "APPROVED") {
    throw new Error("The experiment discovery was not approved.");
  }
  const queued = await queueSmirkDiscovery({
    discoveryId: before.discoveryId,
    userId: input.userId,
    actorId: input.userId,
    requestPayloadHash: before.requestPayloadHash,
    quotePayloadHash: before.quotePayloadHash,
  });
  if (queued.state !== "QUEUED") {
    throw new Error("The experiment discovery was not queued.");
  }
  const claim = await claimNextSmirkDiscovery();
  if (!claim || claim.requestId !== input.requestId) {
    throw new Error("The exact experiment discovery was not claimed.");
  }

  const arm = before.acquisitionExperimentAssignment.arm;
  const placeIds = Array.from(
    { length: 10 },
    (_, index) => `synthetic-${arm}-${index + 1}-${runId}`
  );
  let adapterCalls = 0;
  let ownerEmailCalls = 0;
  let detailIndex = 0;
  await executeClaimedSmirkDiscovery(claim, {
    requestMaps: async <T = unknown>(path: string): Promise<T> => {
      adapterCalls += 1;
      if (path.includes("textsearch")) {
        return {
          status: "OK",
          results: placeIds.map(value => ({ place_id: value })),
        } as T;
      }
      const index = detailIndex;
      detailIndex += 1;
      return {
        status: "OK",
        result: {
          name: `Synthetic ${arm} Trade ${index + 1}`,
          website: `https://example.invalid/${arm}-${index + 1}`,
          formatted_address: `${200 + index} Example Avenue, Reno, NV 89501`,
          formatted_phone_number: `+1202555${String(100 + index).padStart(4, "0")}`,
          rating: 4.5,
          user_ratings_total: 20 + index,
          business_status: "OPERATIONAL",
          reviews: [{ text: "Synthetic experiment fixture review only." }],
        },
      } as T;
    },
    findOwnerEmail: async (domain, context) => {
      ownerEmailCalls += 1;
      if (
        !domain.startsWith("https://example.invalid/") ||
        context.approvedCostCentsPerCredit !== 1
      ) {
        throw new Error(
          "The experiment owner-email request was not quote-bound."
        );
      }
      return {
        email: `${arm}-${ownerEmailCalls}-${runId}@example.invalid`,
        title: "Owner",
        confidence: 95,
        source: "hunter",
      };
    },
  });
  const completed = await getSmirkDiscoveryStatus(
    input.requestId,
    input.userId
  );
  if (
    completed.state !== "COMPLETED" ||
    completed.createdLeadCount !== 10 ||
    completed.readyLeadCount !== 10 ||
    completed.providerRequests !== 21 ||
    adapterCalls !== 11 ||
    ownerEmailCalls !== 10 ||
    completed.acquisitionExperimentAssignment?.assignmentHash !==
      input.assignmentHash
  ) {
    throw new Error(
      "The synthetic experiment discovery did not complete exactly."
    );
  }
  const itemRows = await db
    .select({ leadId: smirkDiscoveryLeadItems.leadId })
    .from(smirkDiscoveryLeadItems)
    .where(
      and(
        eq(smirkDiscoveryLeadItems.discoveryId, completed.discoveryId),
        eq(smirkDiscoveryLeadItems.userId, input.userId),
        eq(smirkDiscoveryLeadItems.state, "READY")
      )
    );
  const leadIds = itemRows
    .map(item => Number(item.leadId || 0))
    .filter(value => value > 0);
  if (leadIds.length !== 10) {
    throw new Error(
      "The experiment discovery did not persist ten ready leads."
    );
  }
  return {
    requestId: input.requestId,
    state: completed.state,
    arm,
    assignmentHash: input.assignmentHash,
    readyLeadCount: completed.readyLeadCount,
    providerRequests: completed.providerRequests,
    contactActionAllowed: false,
    spendAuthorized: false,
    externalAction: "synthetic_fixture_only",
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
    .where(and(eq(leads.id, input.leadId), eq(leads.userId, input.userId)))
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
      experimentId: smirkDiscoveryRequests.acquisitionSourcingExperimentId,
      slotOrdinal: smirkDiscoveryRequests.acquisitionSourcingSlotOrdinal,
      arm: smirkDiscoveryRequests.acquisitionSourcingArm,
      assignmentHash: smirkDiscoveryRequests.acquisitionSourcingAssignmentHash,
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
  const experimentRows = await db
    .select({
      id: acquisitionSourcingExperiments.id,
      experimentId: acquisitionSourcingExperiments.experimentId,
      state: acquisitionSourcingExperiments.state,
      definitionHash: acquisitionSourcingExperiments.definitionHash,
      resultPayload: acquisitionSourcingExperiments.resultPayload,
      learningCandidateId: acquisitionSourcingExperiments.learningCandidateId,
    })
    .from(acquisitionSourcingExperiments)
    .where(eq(acquisitionSourcingExperiments.userId, input.userId));
  const experimentEventRows = await db
    .select({
      action: acquisitionSourcingExperimentEvents.action,
      fromState: acquisitionSourcingExperimentEvents.fromState,
      toState: acquisitionSourcingExperimentEvents.toState,
    })
    .from(acquisitionSourcingExperimentEvents)
    .where(eq(acquisitionSourcingExperimentEvents.userId, input.userId));
  const candidateRows = await db
    .select({ id: acquisitionLearningCandidates.id })
    .from(acquisitionLearningCandidates)
    .where(eq(acquisitionLearningCandidates.userId, input.userId));
  return {
    mode: FIXTURE_MODE,
    lead: leadRows[0] || null,
    outcomes: outcomeRows,
    batches: batchRows,
    discoveries: discoveryRows,
    apiKeys: keyRows,
    experiments: experimentRows,
    experimentEvents: experimentEventRows,
    learningCandidateCount: candidateRows.length,
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
  app.post("/__fixture/discoveries/:requestId/execute", async (req, res) => {
    if (req.headers["x-fixture-token"] !== controlToken) {
      return res.status(401).json({ error: "Unauthorized fixture request." });
    }
    const requestId = String(req.params.requestId || "").trim();
    const assignmentHash = String(req.body?.assignmentHash || "").trim();
    if (
      requestId.length < 20 ||
      !/^[A-Za-z0-9:_-]+$/.test(requestId) ||
      !/^[a-f0-9]{64}$/.test(assignmentHash)
    ) {
      return res
        .status(400)
        .json({ error: "Invalid fixture execution request." });
    }
    try {
      return res.json(
        await executeSyntheticExperimentDiscovery({
          userId: fixture.userId,
          requestId,
          assignmentHash,
        })
      );
    } catch (error) {
      if (error instanceof SmirkDiscoveryStoreError) {
        return res
          .status(error.status)
          .json({ error: error.message, code: error.code });
      }
      return res.status(503).json({
        error:
          error instanceof Error ? error.message : "Fixture execution failed.",
      });
    }
  });
  app.post("/__fixture/experiments/:experimentId/close", async (req, res) => {
    if (req.headers["x-fixture-token"] !== controlToken) {
      return res.status(401).json({ error: "Unauthorized fixture request." });
    }
    const requestedExperimentId = String(req.params.experimentId || "").trim();
    const definitionHash = String(req.body?.definitionHash || "").trim();
    if (
      requestedExperimentId !== fixture.experimentId ||
      definitionHash !== fixture.experimentDefinitionHash ||
      req.body?.confirmation !== "close-synthetic-experiment-v1"
    ) {
      return res.status(400).json({ error: "Invalid fixture close request." });
    }
    try {
      const experiment = await closeAcquisitionSourcingExperiment({
        experimentId: fixture.experimentId,
        definitionHash: fixture.experimentDefinitionHash,
        userId: fixture.userId,
        actorId: fixture.userId,
      });
      return res.json({
        experiment,
        candidateCreated: false,
        policyChanged: false,
        contactActionAllowed: false,
        spendAuthorized: false,
        externalAction: "evaluation_recorded_only",
      });
    } catch (error) {
      if (error instanceof AcquisitionSourcingExperimentStoreError) {
        return res
          .status(error.status)
          .json({ error: error.message, code: error.code });
      }
      return res.status(503).json({
        error: error instanceof Error ? error.message : "Fixture close failed.",
      });
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
      experimentId: fixture.experimentId,
      experimentDefinitionHash: fixture.experimentDefinitionHash,
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
