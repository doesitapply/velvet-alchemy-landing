import crypto from "node:crypto";
import express from "express";
import { createServer, type Server } from "node:http";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiKeys,
  auditLog,
  leads,
  smirkLeadBatchItems,
  smirkLeadBatches,
  smirkOutcomeEvents,
  users,
} from "../drizzle/schema";
import { createApiRouter } from "./apiRouter";
import { getDb } from "./db";
import {
  signSmirkOutcome,
  smirkOutcomePayloadSchema,
} from "./lib/smirkOutcome";
import { requireDisposableLoopbackDatabase } from "./testSupport/disposableDatabase";

const rawApiKey = "local-outcome-persistence-key-000000000001";
const signingSecret = "local-outcome-signing-secret-000000000001";
const externalEventId = "synthetic-batch-outcome-0001";
const batchRequestId = "smirk-source-outcome-persistence-0001";
const fixturePlaceId = "synthetic-outcome-place-0001";

const enabled = requireDisposableLoopbackDatabase(
  process.env.RUN_SMIRK_PERSISTENCE_TEST === "1"
);

describe.skipIf(!enabled)("SMIRK signed outcome persistence", () => {
  const originalSigningSecret =
    process.env.SMIRK_OUTCOME_SIGNING_SECRET;
  let server: Server | null = null;
  let baseUrl = "";
  let userId = 0;
  let apiKeyId = 0;
  let leadId = 0;
  let payload!: ReturnType<typeof smirkOutcomePayloadSchema.parse>;

  beforeAll(async () => {
    process.env.SMIRK_OUTCOME_SIGNING_SECRET = signingSecret;
    const db = await getDb();
    if (!db) throw new Error("A loopback DATABASE_URL is required.");

    await db
      .insert(users)
      .values({
        openId: "codex-local-outcome-owner",
        name: "Local Outcome Owner",
        email: "local-outcome@example.com",
        loginMethod: "local",
        role: "admin",
      })
      .onDuplicateKeyUpdate({
        set: { role: "admin", name: "Local Outcome Owner" },
      });
    const ownerRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, "codex-local-outcome-owner"))
      .limit(1);
    userId = Number(ownerRows[0]?.id || 0);
    if (!userId) throw new Error("Synthetic outcome owner was not created.");

    const keyHash = crypto
      .createHash("sha256")
      .update(rawApiKey)
      .digest("hex");
    await db
      .insert(apiKeys)
      .values({
        userId,
        name: "SMIRK local outcome fixture",
        keyHash,
        keyPrefix: rawApiKey.slice(0, 12),
        scopes: JSON.stringify(["outcome:write"]),
        isActive: true,
      })
      .onDuplicateKeyUpdate({
        set: {
          userId,
          scopes: JSON.stringify(["outcome:write"]),
          isActive: true,
        },
      });
    const keyRows = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    apiKeyId = Number(keyRows[0]?.id || 0);
    if (!apiKeyId) throw new Error("Synthetic outcome API key was not created.");

    await db
      .delete(smirkOutcomeEvents)
      .where(eq(smirkOutcomeEvents.externalEventId, externalEventId));
    const priorLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.userId, userId),
          eq(leads.googlePlaceId, fixturePlaceId)
        )
      );
    for (const lead of priorLeads) {
      await db
        .delete(auditLog)
        .where(
          and(
            eq(auditLog.resource, "lead"),
            eq(auditLog.resourceId, lead.id)
          )
        );
      await db
        .delete(smirkLeadBatchItems)
        .where(eq(smirkLeadBatchItems.leadId, lead.id));
      await db.delete(leads).where(eq(leads.id, lead.id));
    }
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

    const insertedLead = await db
      .insert(leads)
      .values({
        userId,
        companyName: "Synthetic Outcome Plumbing",
        websiteUrl: "https://example.com/synthetic-outcome-plumbing",
        status: "audited",
        phone: "+12025550124",
        googlePlaceId: fixturePlaceId,
        category: "Plumbing",
        city: "Reno",
        state: "NV",
        outreachChannel: "none",
      } as any)
      .$returningId();
    leadId = Number(insertedLead[0]?.id || 0);
    if (!leadId) throw new Error("Synthetic outcome lead was not created.");

    const batchPayloadHash = "a".repeat(64);
    const insertedBatch = await db
      .insert(smirkLeadBatches)
      .values({
        userId,
        requestId: batchRequestId,
        workspaceId: 1,
        requestedByApiKeyId: apiKeyId,
        requestedByApiKeyName: "SMIRK local outcome fixture",
        requestPayload: JSON.stringify({ fixture: true }),
        requestPayloadHash: batchPayloadHash,
        state: "EXPORTED",
        responsePayload: JSON.stringify({ fixture: true }),
        responsePayloadHash: "b".repeat(64),
        leadCount: 1,
        completedAt: new Date(),
      })
      .$returningId();
    const batchId = Number(insertedBatch[0]?.id || 0);
    if (!batchId) throw new Error("Synthetic outcome batch was not created.");
    await db.insert(smirkLeadBatchItems).values({
      batchId,
      userId,
      leadId,
      ordinal: 1,
      prospectPayloadHash: "c".repeat(64),
    });

    payload = smirkOutcomePayloadSchema.parse({
      contractVersion: "smirk-velvet.outcome.v1",
      workspaceId: 1,
      externalProspectId: `velvet-owner-${userId}-lead-${leadId}`,
      externalEventId,
      outreachApprovalId: "0dbe230c-9f38-4c2c-9496-6fdd0f0605b6",
      channel: "call",
      outcome: "no_answer",
      occurredAt: "2026-07-30T18:10:11.000Z",
      evidenceHash: "d".repeat(64),
      outreachPayloadHash: "e".repeat(64),
      notes: "Synthetic local outcome only. No external call occurred.",
    });

    const app = express();
    app.use(express.json());
    app.use("/api/v1", createApiRouter());
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server?.once("error", reject);
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server?.address();
    if (!address || typeof address === "string") {
      throw new Error("Synthetic outcome server did not bind.");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close(error => (error ? reject(error) : resolve()));
      });
      server = null;
    }
    const db = await getDb();
    if (!db) throw new Error("A disposable DATABASE_URL is required.");
    await db
      .delete(smirkOutcomeEvents)
      .where(eq(smirkOutcomeEvents.externalEventId, externalEventId));
    await db
      .delete(smirkOutcomeEvents)
      .where(
        eq(
          smirkOutcomeEvents.externalEventId,
          `${externalEventId}-wrong-workspace`
        )
      );
    if (leadId) {
      await db
        .delete(auditLog)
        .where(
          and(
            eq(auditLog.resource, "lead"),
            eq(auditLog.resourceId, leadId)
          )
        );
      await db
        .delete(smirkLeadBatchItems)
        .where(eq(smirkLeadBatchItems.leadId, leadId));
      await db.delete(leads).where(eq(leads.id, leadId));
    }
    await db
      .delete(smirkLeadBatches)
      .where(eq(smirkLeadBatches.requestId, batchRequestId));
    if (originalSigningSecret === undefined) {
      delete process.env.SMIRK_OUTCOME_SIGNING_SECRET;
    } else {
      process.env.SMIRK_OUTCOME_SIGNING_SECRET =
        originalSigningSecret;
    }
  });

  async function send(
    body: typeof payload,
    signatureOverride?: string
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const response = await fetch(
      `${baseUrl}/api/v1/leads/${leadId}/outcome`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${rawApiKey}`,
          "x-smirk-timestamp": timestamp,
          "x-smirk-signature":
            signatureOverride ||
            signSmirkOutcome(body, timestamp, signingSecret),
        },
        body: JSON.stringify(body),
      }
    );
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  }

  it("rejects forgery and cross-workspace callbacks, then records once with replay safety", async () => {
    const forged = await send(payload, `sha256=${"0".repeat(64)}`);
    expect(forged).toMatchObject({
      status: 401,
      body: { code: "SMIRK_OUTCOME_SIGNATURE_INVALID" },
    });

    const wrongWorkspaceEventId = `${externalEventId}-wrong-workspace`;
    const wrongWorkspace = await send({
      ...payload,
      externalEventId: wrongWorkspaceEventId,
      workspaceId: 2,
    });
    expect(wrongWorkspace).toMatchObject({
      status: 409,
      body: { code: "SMIRK_OUTCOME_RESEARCH_RECEIPT_MISMATCH" },
    });

    const first = await send(payload);
    const replay = await send(payload);
    const changed = await send({ ...payload, outcome: "voicemail" });

    expect(first).toMatchObject({
      status: 201,
      body: { success: true, state: "RECORDED", externalAction: "none" },
    });
    expect(replay).toMatchObject({
      status: 200,
      body: { success: true, state: "DUPLICATE", externalAction: "none" },
    });
    expect(changed).toMatchObject({
      status: 409,
      body: { code: "SMIRK_OUTCOME_IDEMPOTENCY_CONFLICT" },
    });

    const db = await getDb();
    if (!db) throw new Error("Database unavailable after outcome write.");
    const stored = await db
      .select()
      .from(smirkOutcomeEvents)
      .where(eq(smirkOutcomeEvents.externalEventId, externalEventId));
    expect(stored).toHaveLength(1);
    const rejected = await db
      .select()
      .from(smirkOutcomeEvents)
      .where(eq(smirkOutcomeEvents.externalEventId, wrongWorkspaceEventId));
    expect(rejected).toHaveLength(0);
    const updatedLead = await db
      .select({
        outcome: leads.smirkCallOutcome,
        workspaceId: leads.smirkWorkspaceId,
      })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, userId)))
      .limit(1);
    expect(updatedLead[0]).toEqual({
      outcome: "no_answer",
      workspaceId: "1",
    });
  });
});
