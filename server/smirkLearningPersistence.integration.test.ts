import crypto from "node:crypto";
import express from "express";
import { createServer, type Server } from "node:http";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acquisitionLearningCandidates,
  acquisitionLearningPolicyReleases,
  apiKeys,
  auditLog,
  audits,
  leads,
  smirkLeadBatchItems,
  smirkLeadBatches,
  smirkOutcomeEvents,
  users,
  type User,
} from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { createApiRouter } from "./apiRouter";
import { getDb } from "./db";
import { hashAcquisitionLearningValue } from "./lib/acquisitionLearning";
import {
  ACQUISITION_LEARNING_POLICY_DEACTIVATE_CONFIRMATION,
  ACQUISITION_LEARNING_POLICY_RELEASE_CONFIRMATION,
} from "./lib/acquisitionLearningPolicy";
import {
  signSmirkOutcome,
  smirkOutcomePayloadSchema,
} from "./lib/smirkOutcome";
import { appRouter } from "./routers";
import { requireDisposableLoopbackDatabase } from "./testSupport/disposableDatabase";

const rawApiKey = "local-learning-loop-key-000000000000000001";
const signingSecret = "local-learning-signing-secret-000000000000000001";
const fixtureOpenId = "codex-local-learning-owner";
const fixturePlacePrefix = "synthetic-learning-place-";
const initialBatchRequestId = "smirk-learning-source-batch-0001";
const learnedBatchRequestId = "smirk-learning-applied-batch-0001";
const deactivatedBatchRequestId = "smirk-learning-deactivated-batch-0001";
const tamperedPolicyBatchRequestId =
  "smirk-learning-tampered-policy-batch-0001";
const releaseId = "d29d9241-690f-4473-b76a-74579dfbfcf8";
const staleReleaseId = "d6e66528-72ab-459f-9d57-a94fa1dcf131";
const deactivateReleaseId = "c97bec4c-1397-4b86-a6b6-7657d42327a4";

const enabled = requireDisposableLoopbackDatabase(
  process.env.RUN_SMIRK_PERSISTENCE_TEST === "1"
);

describe.skipIf(!enabled)("SMIRK human-reviewed learning persistence", () => {
  const originalSigningSecret = process.env.SMIRK_OUTCOME_SIGNING_SECRET;
  const originalResearchWorkspace = process.env.SMIRK_RESEARCH_WORKSPACE_ID;
  let server: Server | null = null;
  let baseUrl = "";
  let owner!: User;

  function context(): TrpcContext {
    return {
      user: owner,
      req: { protocol: "http", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
  }

  async function cleanFixture(): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("A loopback DATABASE_URL is required.");
    const ownerRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, fixtureOpenId))
      .limit(1);
    const userId = Number(ownerRows[0]?.id || 0);
    if (!userId) return;

    const ownedLeads = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.userId, userId));
    await db
      .delete(smirkOutcomeEvents)
      .where(eq(smirkOutcomeEvents.userId, userId));
    await db
      .delete(smirkLeadBatchItems)
      .where(eq(smirkLeadBatchItems.userId, userId));
    await db
      .delete(smirkLeadBatches)
      .where(eq(smirkLeadBatches.userId, userId));
    await db
      .delete(acquisitionLearningPolicyReleases)
      .where(eq(acquisitionLearningPolicyReleases.userId, userId));
    await db
      .delete(acquisitionLearningCandidates)
      .where(eq(acquisitionLearningCandidates.userId, userId));
    await db.delete(auditLog).where(eq(auditLog.userId, userId));
    for (const lead of ownedLeads) {
      await db.delete(audits).where(eq(audits.leadId, lead.id));
    }
    await db.delete(leads).where(eq(leads.userId, userId));
  }

  beforeAll(async () => {
    process.env.SMIRK_OUTCOME_SIGNING_SECRET = signingSecret;
    process.env.SMIRK_RESEARCH_WORKSPACE_ID = "1";
    const db = await getDb();
    if (!db) throw new Error("A loopback DATABASE_URL is required.");

    await db
      .insert(users)
      .values({
        openId: fixtureOpenId,
        name: "Local Learning Owner",
        email: "local-learning@example.com",
        loginMethod: "local",
        role: "admin",
      })
      .onDuplicateKeyUpdate({
        set: { role: "admin", name: "Local Learning Owner" },
      });
    const ownerRows = await db
      .select()
      .from(users)
      .where(eq(users.openId, fixtureOpenId))
      .limit(1);
    owner = ownerRows[0]!;
    if (!owner?.id)
      throw new Error("Synthetic learning owner was not created.");

    const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
    await db
      .insert(apiKeys)
      .values({
        userId: owner.id,
        name: "SMIRK local learning fixture",
        keyHash,
        keyPrefix: rawApiKey.slice(0, 12),
        scopes: JSON.stringify(["smirk:research", "outcome:write"]),
        isActive: true,
      })
      .onDuplicateKeyUpdate({
        set: {
          userId: owner.id,
          scopes: JSON.stringify(["smirk:research", "outcome:write"]),
          isActive: true,
        },
      });
    await cleanFixture();

    for (let index = 0; index < 20; index += 1) {
      const category = index < 10 ? "Plumbing" : "HVAC";
      const city = index < 10 ? "Reno" : "Sacramento";
      const state = index < 10 ? "NV" : "CA";
      await db.insert(leads).values({
        userId: owner.id,
        companyName: `Synthetic ${category} Observation ${index + 1}`,
        websiteUrl: `https://example.com/learning-${index + 1}`,
        status: "audited",
        phone: `+12025550${String(100 + index)}`,
        googlePlaceId: `${fixturePlacePrefix}${index + 1}`,
        category,
        city,
        state,
        outreachChannel: "none",
      });
    }

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
      throw new Error("Synthetic learning server did not bind.");
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
    await cleanFixture();
    if (originalSigningSecret === undefined) {
      delete process.env.SMIRK_OUTCOME_SIGNING_SECRET;
    } else {
      process.env.SMIRK_OUTCOME_SIGNING_SECRET = originalSigningSecret;
    }
    if (originalResearchWorkspace === undefined) {
      delete process.env.SMIRK_RESEARCH_WORKSPACE_ID;
    } else {
      process.env.SMIRK_RESEARCH_WORKSPACE_ID = originalResearchWorkspace;
    }
  });

  async function postJson(
    path: string,
    body: unknown,
    headers: Record<string, string> = {}
  ): Promise<{ status: number; body: any }> {
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${rawApiKey}`,
        ...headers,
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  it("turns receipt-bound outcomes into one approved, bounded next-batch filter", async () => {
    const initialRequest = {
      contractVersion: "smirk-velvet.lead-batch-request.v1",
      requestId: initialBatchRequestId,
      workspaceId: 1,
      criteria: {
        limit: 20,
        learningMode: "none",
      },
      contactActionAllowed: false,
      maxSpendCents: 0,
    };
    const initial = await postJson("/smirk/lead-batches", initialRequest, {
      "idempotency-key": initialBatchRequestId,
    });
    expect(initial).toMatchObject({
      status: 201,
      body: {
        state: "EXPORTED",
        contactActionAllowed: false,
        spendAuthorized: false,
        externalAction: "research_export_only",
        appliedLearningCandidate: null,
      },
    });
    expect(initial.body.prospects).toHaveLength(20);

    const categoryCounters = { plumbing: 0, hvac: 0 };
    let firstPlumbingProspect: { leadId: number; externalId: string } | null =
      null;
    let firstHvacProspect: { leadId: number; externalId: string } | null = null;
    for (const prospect of initial.body.prospects as Array<any>) {
      const match = String(prospect.externalId).match(/-lead-(\d+)$/);
      const leadId = Number(match?.[1] || 0);
      const category = String(prospect.prospect.industry || "").toLowerCase();
      if (!leadId || !(category in categoryCounters)) {
        throw new Error("Synthetic batch returned an unexpected prospect.");
      }
      const ordinal = categoryCounters[
        category as keyof typeof categoryCounters
      ]++;
      if (category === "plumbing" && ordinal === 0) {
        firstPlumbingProspect = {
          leadId,
          externalId: prospect.externalId,
        };
      }
      if (category === "hvac" && ordinal === 1) {
        firstHvacProspect = {
          leadId,
          externalId: prospect.externalId,
        };
      }
      const positiveLimit = category === "plumbing" ? 6 : 1;
      const outcome = ordinal < positiveLimit ? "replied" : "delivered";
      const event = smirkOutcomePayloadSchema.parse({
        contractVersion: "smirk-velvet.outcome.v1",
        workspaceId: 1,
        externalProspectId: prospect.externalId,
        externalEventId: `synthetic-learning-outcome-${leadId}`,
        outreachApprovalId: "0dbe230c-9f38-4c2c-9496-6fdd0f0605b6",
        channel: "email",
        outcome,
        occurredAt: "2026-07-30T18:30:00.000Z",
        evidenceHash: "d".repeat(64),
        outreachPayloadHash: "e".repeat(64),
        notes:
          "Synthetic local learning event only. No email, SMS, or call occurred.",
      });
      const timestamp = String(Math.floor(Date.now() / 1_000));
      const result = await postJson(`/leads/${leadId}/outcome`, event, {
        "x-smirk-timestamp": timestamp,
        "x-smirk-signature": signSmirkOutcome(event, timestamp, signingSecret),
      });
      expect(result).toMatchObject({
        status: 201,
        body: {
          success: true,
          state: "RECORDED",
          externalAction: "none",
        },
      });
    }

    if (!firstPlumbingProspect) {
      throw new Error("Synthetic batch did not return a plumbing prospect.");
    }
    const lifecycleEvent = smirkOutcomePayloadSchema.parse({
      contractVersion: "smirk-velvet.outcome.v1",
      workspaceId: 1,
      externalProspectId: firstPlumbingProspect.externalId,
      externalEventId: `synthetic-learning-qualified-${firstPlumbingProspect.leadId}`,
      outreachApprovalId: "0dbe230c-9f38-4c2c-9496-6fdd0f0605b6",
      channel: "email",
      outcome: "qualified",
      occurredAt: "2026-07-30T18:35:00.000Z",
      evidenceHash: "d".repeat(64),
      outreachPayloadHash: "e".repeat(64),
      notes: "Synthetic lifecycle event only. No email, SMS, or call occurred.",
    });
    const lifecycleTimestamp = String(Math.floor(Date.now() / 1_000));
    expect(
      await postJson(
        `/leads/${firstPlumbingProspect.leadId}/outcome`,
        lifecycleEvent,
        {
          "x-smirk-timestamp": lifecycleTimestamp,
          "x-smirk-signature": signSmirkOutcome(
            lifecycleEvent,
            lifecycleTimestamp,
            signingSecret
          ),
        }
      )
    ).toMatchObject({
      status: 201,
      body: {
        success: true,
        state: "RECORDED",
        externalAction: "none",
      },
    });

    const caller = appRouter.createCaller(context());
    const scorecard = await caller.acquisitionLearning.scorecard({
      dimension: "category",
    });
    expect(scorecard).toMatchObject({
      sampleSize: 20,
      eventCount: 21,
      policyChanged: false,
      externalAction: "none",
    });
    expect(scorecard.segments[0]).toMatchObject({
      value: "plumbing",
      sampleSize: 10,
      eventCount: 11,
      positive: 6,
      positiveRate: 0.6,
    });

    const candidate = await caller.acquisitionLearning.createCandidate({
      dimension: "category",
      value: "plumbing",
    });
    expect(candidate).toMatchObject({
      state: "CANDIDATE",
      policyChanged: false,
      externalAction: "none",
      proposal: {
        action: "prioritize_for_next_research_batch",
        dimension: "category",
        value: "plumbing",
        maximumNextBatchSize: 20,
      },
    });
    const approved = await caller.acquisitionLearning.decideCandidate({
      id: candidate.id,
      decision: "APPROVED",
    });
    expect(approved).toMatchObject({
      state: "APPROVED",
      policyChanged: false,
      externalAction: "none",
    });

    await expect(
      caller.acquisitionLearning.releaseCandidate({
        candidateId: candidate.id,
        releaseId: "911b314d-a3ea-4a5e-a5ec-1887e543d296",
        proposalHash: "f".repeat(64),
        evidenceHash: hashAcquisitionLearningValue(candidate.evidence),
        confirmation: ACQUISITION_LEARNING_POLICY_RELEASE_CONFIRMATION,
        attestations: {
          evidenceReviewed: true,
          observationalNotCausal: true,
          noContactOrSpendApproved: true,
        },
        reason:
          "This deliberately altered hash must not release a sourcing policy.",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    if (!firstHvacProspect) {
      throw new Error("Synthetic batch did not return an HVAC prospect.");
    }
    const staleOutcomeId = `synthetic-learning-stale-${firstHvacProspect.leadId}`;
    const staleOutcome = smirkOutcomePayloadSchema.parse({
      contractVersion: "smirk-velvet.outcome.v1",
      workspaceId: 1,
      externalProspectId: firstHvacProspect.externalId,
      externalEventId: staleOutcomeId,
      outreachApprovalId: "0dbe230c-9f38-4c2c-9496-6fdd0f0605b6",
      channel: "email",
      outcome: "replied",
      occurredAt: "2026-07-30T18:40:00.000Z",
      evidenceHash: "d".repeat(64),
      outreachPayloadHash: "e".repeat(64),
      notes:
        "Synthetic stale-evidence event only. No email, SMS, or call occurred.",
    });
    const staleTimestamp = String(Math.floor(Date.now() / 1_000));
    expect(
      await postJson(
        `/leads/${firstHvacProspect.leadId}/outcome`,
        staleOutcome,
        {
          "x-smirk-timestamp": staleTimestamp,
          "x-smirk-signature": signSmirkOutcome(
            staleOutcome,
            staleTimestamp,
            signingSecret
          ),
        }
      )
    ).toMatchObject({ status: 201, body: { state: "RECORDED" } });
    await expect(
      caller.acquisitionLearning.releaseCandidate({
        candidateId: candidate.id,
        releaseId: staleReleaseId,
        proposalHash: hashAcquisitionLearningValue(candidate.proposal),
        evidenceHash: hashAcquisitionLearningValue(candidate.evidence),
        confirmation: ACQUISITION_LEARNING_POLICY_RELEASE_CONFIRMATION,
        attestations: {
          evidenceReviewed: true,
          observationalNotCausal: true,
          noContactOrSpendApproved: true,
        },
        reason:
          "This stale observation snapshot must not release a sourcing policy.",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const db = await getDb();
    if (!db) throw new Error("Database unavailable after stale-evidence test.");
    await db
      .delete(smirkOutcomeEvents)
      .where(eq(smirkOutcomeEvents.externalEventId, staleOutcomeId));

    const learnedRequest = {
      contractVersion: "smirk-velvet.lead-batch-request.v1",
      requestId: learnedBatchRequestId,
      workspaceId: 1,
      criteria: {
        limit: 2,
        learningMode: "latest_released",
      },
      contactActionAllowed: false,
      maxSpendCents: 0,
    };
    expect(
      await postJson("/smirk/lead-batches", learnedRequest, {
        "idempotency-key": learnedBatchRequestId,
      })
    ).toMatchObject({
      status: 412,
      body: {
        code: "SMIRK_LEAD_BATCH_LEARNING_RELEASE_REQUIRED",
      },
    });

    const released = await caller.acquisitionLearning.releaseCandidate({
      candidateId: candidate.id,
      releaseId,
      proposalHash: hashAcquisitionLearningValue(candidate.proposal),
      evidenceHash: hashAcquisitionLearningValue(candidate.evidence),
      confirmation: ACQUISITION_LEARNING_POLICY_RELEASE_CONFIRMATION,
      attestations: {
        evidenceReviewed: true,
        observationalNotCausal: true,
        noContactOrSpendApproved: true,
      },
      reason:
        "Use the measured plumbing association for one bounded research batch.",
    });
    expect(released).toMatchObject({
      outcome: "released",
      policyChanged: true,
      externalAction: "none",
      contactAuthorized: false,
      providerExecutionAuthorized: false,
      spendAuthorized: false,
      receipt: {
        releaseId,
        action: "APPLY",
        activeCandidate: { id: candidate.id },
      },
    });
    expect(
      await caller.acquisitionLearning.releaseCandidate({
        candidateId: candidate.id,
        releaseId,
        proposalHash: hashAcquisitionLearningValue(candidate.proposal),
        evidenceHash: hashAcquisitionLearningValue(candidate.evidence),
        confirmation: ACQUISITION_LEARNING_POLICY_RELEASE_CONFIRMATION,
        attestations: {
          evidenceReviewed: true,
          observationalNotCausal: true,
          noContactOrSpendApproved: true,
        },
        reason:
          "Use the measured plumbing association for one bounded research batch.",
      })
    ).toMatchObject({ outcome: "duplicate", policyChanged: false });
    await expect(
      caller.acquisitionLearning.releaseCandidate({
        candidateId: candidate.id,
        releaseId,
        proposalHash: hashAcquisitionLearningValue(candidate.proposal),
        evidenceHash: hashAcquisitionLearningValue(candidate.evidence),
        confirmation: ACQUISITION_LEARNING_POLICY_RELEASE_CONFIRMATION,
        attestations: {
          evidenceReviewed: true,
          observationalNotCausal: true,
          noContactOrSpendApproved: true,
        },
        reason: "Changing a replayed release request must produce a conflict.",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await db
      .update(acquisitionLearningCandidates)
      .set({
        evidence: JSON.stringify({
          ...candidate.evidence,
          absoluteLift: 0.4,
        }),
      })
      .where(eq(acquisitionLearningCandidates.id, candidate.id));
    expect(
      await postJson(
        "/smirk/lead-batches",
        {
          ...learnedRequest,
          requestId: tamperedPolicyBatchRequestId,
        },
        { "idempotency-key": tamperedPolicyBatchRequestId }
      )
    ).toMatchObject({
      status: 412,
      body: { code: "SMIRK_LEAD_BATCH_LEARNING_POLICY_INVALID" },
    });
    await db
      .update(acquisitionLearningCandidates)
      .set({ evidence: JSON.stringify(candidate.evidence) })
      .where(eq(acquisitionLearningCandidates.id, candidate.id));

    await db.insert(leads).values([
      {
        userId: owner.id,
        companyName: "Synthetic Next Plumbing",
        websiteUrl: "https://example.com/next-plumbing",
        status: "audited",
        phone: "+12025550124",
        googlePlaceId: `${fixturePlacePrefix}next-plumbing`,
        category: "Plumbing",
        city: "Boise",
        state: "ID",
        outreachChannel: "none",
      },
      {
        userId: owner.id,
        companyName: "Synthetic Next HVAC",
        websiteUrl: "https://example.com/next-hvac",
        status: "audited",
        phone: "+12025550125",
        googlePlaceId: `${fixturePlacePrefix}next-hvac`,
        category: "HVAC",
        city: "Boise",
        state: "ID",
        outreachChannel: "none",
      },
    ]);

    const learned = await postJson("/smirk/lead-batches", learnedRequest, {
      "idempotency-key": learnedBatchRequestId,
    });
    const replay = await postJson("/smirk/lead-batches", learnedRequest, {
      "idempotency-key": learnedBatchRequestId,
    });
    expect(learned).toMatchObject({
      status: 201,
      body: {
        state: "EXPORTED",
        contactActionAllowed: false,
        spendAuthorized: false,
        externalAction: "research_export_only",
        appliedLearningCandidate: {
          id: candidate.id,
          policyReleaseId: releaseId,
          policyReleaseReceiptHash: released.receipt.receiptHash,
          proposal: {
            dimension: "category",
            value: "plumbing",
          },
        },
      },
    });

    const deactivated = await caller.acquisitionLearning.deactivatePolicy({
      currentReleaseId: releaseId,
      releaseId: deactivateReleaseId,
      confirmation: ACQUISITION_LEARNING_POLICY_DEACTIVATE_CONFIRMATION,
      reason:
        "Disable learned sourcing after the bounded release verification.",
    });
    expect(deactivated).toMatchObject({
      outcome: "deactivated",
      policyChanged: true,
      externalAction: "none",
      receipt: {
        releaseId: deactivateReleaseId,
        action: "DEACTIVATE",
        activeCandidate: null,
        previousCandidateId: candidate.id,
      },
    });
    expect(
      await caller.acquisitionLearning.deactivatePolicy({
        currentReleaseId: releaseId,
        releaseId: deactivateReleaseId,
        confirmation: ACQUISITION_LEARNING_POLICY_DEACTIVATE_CONFIRMATION,
        reason:
          "Disable learned sourcing after the bounded release verification.",
      })
    ).toMatchObject({ outcome: "duplicate", policyChanged: false });
    await expect(
      caller.acquisitionLearning.deactivatePolicy({
        currentReleaseId: releaseId,
        releaseId: deactivateReleaseId,
        confirmation: ACQUISITION_LEARNING_POLICY_DEACTIVATE_CONFIRMATION,
        reason:
          "Changing a replayed deactivation request must produce a conflict.",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await postJson(
        "/smirk/lead-batches",
        {
          ...learnedRequest,
          requestId: deactivatedBatchRequestId,
        },
        { "idempotency-key": deactivatedBatchRequestId }
      )
    ).toMatchObject({
      status: 412,
      body: {
        code: "SMIRK_LEAD_BATCH_LEARNING_RELEASE_REQUIRED",
      },
    });
    expect(learned.body.prospects).toHaveLength(1);
    expect(learned.body.prospects[0].prospect).toMatchObject({
      companyName: "Synthetic Next Plumbing",
      industry: "Plumbing",
      phoneContactMode: "operator_review_only",
    });
    expect(replay).toMatchObject({
      status: 200,
      body: {
        state: "DUPLICATE",
        originalState: "EXPORTED",
        requestPayloadHash: learned.body.requestPayloadHash,
        prospectsHash: learned.body.prospectsHash,
      },
    });

    const storedCandidates = await db
      .select()
      .from(acquisitionLearningCandidates)
      .where(
        and(
          eq(acquisitionLearningCandidates.id, candidate.id),
          eq(acquisitionLearningCandidates.userId, owner.id)
        )
      );
    expect(storedCandidates).toHaveLength(1);
    expect(storedCandidates[0]).toMatchObject({
      state: "APPROVED",
      sampleSize: 20,
      decidedBy: owner.id,
    });
    const policyReleases = await db
      .select()
      .from(acquisitionLearningPolicyReleases)
      .where(eq(acquisitionLearningPolicyReleases.userId, owner.id))
      .orderBy(asc(acquisitionLearningPolicyReleases.id));
    expect(policyReleases).toHaveLength(2);
    expect(policyReleases.map(row => row.action)).toEqual([
      "APPLY",
      "DEACTIVATE",
    ]);
    const learnedBatches = await db
      .select()
      .from(smirkLeadBatches)
      .where(eq(smirkLeadBatches.requestId, learnedBatchRequestId));
    expect(learnedBatches[0]).toMatchObject({
      userId: owner.id,
      workspaceId: 1,
      state: "EXPORTED",
      appliedLearningCandidateId: candidate.id,
      leadCount: 1,
    });
  });
});
