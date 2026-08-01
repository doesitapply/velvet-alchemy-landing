import crypto from "node:crypto";
import express from "express";
import { createServer, type Server } from "node:http";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acquisitionLearningCandidates,
  acquisitionLearningPolicyReleases,
  acquisitionSourcingExperimentEvents,
  acquisitionSourcingExperiments,
  apiKeys,
  leads,
  smirkDiscoveryLeadItems,
  smirkDiscoveryRequests,
  smirkOutcomeEvents,
  users,
  type User,
} from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { createApiRouter } from "./apiRouter";
import { getDb } from "./db";
import {
  ACQUISITION_SOURCING_ACTIVATION_CONFIRMATION,
  ACQUISITION_SOURCING_BINDING_CONTRACT,
  ACQUISITION_SOURCING_CANDIDATE_CONFIRMATION,
  ACQUISITION_SOURCING_CANCELLATION_CONFIRMATION,
  ACQUISITION_SOURCING_CLOSE_CONFIRMATION,
  acquisitionSourcingExperimentAssignmentSchema,
  buildAcquisitionSourcingExperimentAssignmentBinding,
} from "./lib/acquisitionSourcingExperiment";
import { SMIRK_DISCOVERY_REQUEST_CONTRACT } from "./lib/smirkDiscovery";
import { SMIRK_LEAD_BATCH_REQUEST_CONTRACT } from "./lib/smirkLeadBatch";
import { appRouter } from "./routers";
import { requireDisposableLoopbackDatabase } from "./testSupport/disposableDatabase";

const rawApiKey = "local-sourcing-experiment-key-000000000000000001";
const fixtureOpenId = "codex-local-sourcing-experiment-owner";
const otherOpenId = "codex-local-sourcing-experiment-other";
const experimentId = "61f3301c-848f-4354-81f7-5fb6b365ce84";
const enabled = requireDisposableLoopbackDatabase(
  process.env.RUN_SMIRK_PERSISTENCE_TEST === "1"
);

describe.skipIf(!enabled)(
  "deterministic acquisition sourcing persistence",
  () => {
    const originalMapsEnabled = process.env.ENABLE_MAPS_RESEARCH;
    const originalMapsCost = process.env.MAPS_COST_CENTS_PER_REQUEST;
    const originalWorkspace = process.env.SMIRK_RESEARCH_WORKSPACE_ID;
    let server: Server | null = null;
    let baseUrl = "";
    let owner!: User;
    let other!: User;

    function context(user: User): TrpcContext {
      return {
        user,
        req: { protocol: "http", headers: {} } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      };
    }

    async function cleanup(): Promise<void> {
      const db = await getDb();
      if (!db) throw new Error("A loopback DATABASE_URL is required.");
      const ownerRows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, fixtureOpenId))
        .limit(1);
      const userId = Number(ownerRows[0]?.id || 0);
      if (!userId) return;
      const experiments = await db
        .select({ id: acquisitionSourcingExperiments.id })
        .from(acquisitionSourcingExperiments)
        .where(eq(acquisitionSourcingExperiments.userId, userId));
      const experimentRowIds = experiments.map(value => value.id);
      const discoveries = await db
        .select({ id: smirkDiscoveryRequests.id })
        .from(smirkDiscoveryRequests)
        .where(eq(smirkDiscoveryRequests.userId, userId));
      for (const discovery of discoveries) {
        await db
          .delete(smirkDiscoveryLeadItems)
          .where(eq(smirkDiscoveryLeadItems.discoveryId, discovery.id));
      }
      await db
        .delete(smirkOutcomeEvents)
        .where(eq(smirkOutcomeEvents.userId, userId));
      await db
        .delete(smirkDiscoveryRequests)
        .where(eq(smirkDiscoveryRequests.userId, userId));
      for (const rowId of experimentRowIds) {
        await db
          .delete(acquisitionSourcingExperimentEvents)
          .where(
            eq(acquisitionSourcingExperimentEvents.experimentRowId, rowId)
          );
      }
      await db
        .delete(acquisitionSourcingExperiments)
        .where(eq(acquisitionSourcingExperiments.userId, userId));
      await db
        .delete(acquisitionLearningPolicyReleases)
        .where(eq(acquisitionLearningPolicyReleases.userId, userId));
      await db
        .delete(acquisitionLearningCandidates)
        .where(eq(acquisitionLearningCandidates.userId, userId));
      await db.delete(leads).where(eq(leads.userId, userId));
    }

    beforeAll(async () => {
      process.env.ENABLE_MAPS_RESEARCH = "true";
      process.env.MAPS_COST_CENTS_PER_REQUEST = "1";
      process.env.SMIRK_RESEARCH_WORKSPACE_ID = "1";
      const db = await getDb();
      if (!db) throw new Error("A loopback DATABASE_URL is required.");
      await db
        .insert(users)
        .values({
          openId: fixtureOpenId,
          name: "Local Sourcing Experiment Owner",
          email: "local-sourcing-experiment@example.com",
          loginMethod: "local",
          role: "admin",
        })
        .onDuplicateKeyUpdate({ set: { role: "admin" } });
      await db
        .insert(users)
        .values({
          openId: otherOpenId,
          name: "Other Sourcing Experiment Owner",
          email: "other-sourcing-experiment@example.com",
          loginMethod: "local",
          role: "admin",
        })
        .onDuplicateKeyUpdate({ set: { role: "admin" } });
      owner = (
        await db
          .select()
          .from(users)
          .where(eq(users.openId, fixtureOpenId))
          .limit(1)
      )[0]!;
      other = (
        await db
          .select()
          .from(users)
          .where(eq(users.openId, otherOpenId))
          .limit(1)
      )[0]!;
      await cleanup();
      const keyHash = crypto
        .createHash("sha256")
        .update(rawApiKey)
        .digest("hex");
      await db
        .insert(apiKeys)
        .values({
          userId: owner.id,
          name: "SMIRK sourcing experiment fixture",
          keyHash,
          keyPrefix: rawApiKey.slice(0, 12),
          scopes: JSON.stringify(["smirk:research"]),
          isActive: true,
        })
        .onDuplicateKeyUpdate({
          set: {
            userId: owner.id,
            scopes: JSON.stringify(["smirk:research"]),
            isActive: true,
          },
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
        throw new Error("Synthetic experiment server did not bind.");
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
      await cleanup();
      if (originalMapsEnabled === undefined) {
        delete process.env.ENABLE_MAPS_RESEARCH;
      } else process.env.ENABLE_MAPS_RESEARCH = originalMapsEnabled;
      if (originalMapsCost === undefined) {
        delete process.env.MAPS_COST_CENTS_PER_REQUEST;
      } else process.env.MAPS_COST_CENTS_PER_REQUEST = originalMapsCost;
      if (originalWorkspace === undefined) {
        delete process.env.SMIRK_RESEARCH_WORKSPACE_ID;
      } else process.env.SMIRK_RESEARCH_WORKSPACE_ID = originalWorkspace;
    });

    async function prepareDiscovery(requestId: string) {
      const response = await fetch(
        `${baseUrl}/api/v1/smirk/discovery-requests`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${rawApiKey}`,
            "idempotency-key": requestId,
          },
          body: JSON.stringify({
            contractVersion: SMIRK_DISCOVERY_REQUEST_CONTRACT,
            requestId,
            workspaceId: 1,
            criteria: { limit: 10, learningMode: "experiment" },
            acquisitionExperiment: {
              contractVersion: ACQUISITION_SOURCING_BINDING_CONTRACT,
              experimentId,
              definitionHash: preparedDefinitionHash,
            },
            contactActionAllowed: false,
            spendAuthorized: false,
          }),
        }
      );
      return { status: response.status, body: await response.json() };
    }

    let preparedDefinitionHash = "";

    it("persists balanced assignments and closes only on full outcome coverage", async () => {
      const caller = appRouter.createCaller(context(owner));
      const prepared = await caller.acquisitionSourcingExperiments.prepare({
        experimentId,
        workspaceId: 1,
        dimension: "category",
        control: {
          label: "Reno plumbing",
          criteria: { category: "plumbing", city: "Reno", state: "NV" },
        },
        challenger: {
          label: "Reno HVAC",
          criteria: { category: "hvac", city: "Reno", state: "NV" },
        },
        requestsPerArm: 1,
        leadsPerRequest: 10,
        attestNoContactAuthority: true,
        attestNoSpendAuthority: true,
      });
      preparedDefinitionHash = prepared.experiment.definitionHash;
      expect(prepared.experiment.state).toBe("PREPARED");
      expect(prepared.experiment.contactActionAllowed).toBe(false);
      expect(prepared.experiment.spendAuthorized).toBe(false);

      const active = await caller.acquisitionSourcingExperiments.activate({
        experimentId,
        definitionHash: preparedDefinitionHash,
        confirmation: ACQUISITION_SOURCING_ACTIVATION_CONFIRMATION,
        attestFrozenBalancedAssignment: true,
        attestNoContactAuthority: true,
        attestNoSpendAuthority: true,
      });
      expect(active.state).toBe("ACTIVE");

      const activeStatusResponse = await fetch(
        `${baseUrl}/api/v1/smirk/acquisition-sourcing-experiments/active?workspaceId=1`,
        {
          headers: { authorization: `Bearer ${rawApiKey}` },
        }
      );
      const activeStatus = await activeStatusResponse.json();
      expect(activeStatusResponse.status, JSON.stringify(activeStatus)).toBe(
        200
      );
      expect(activeStatus.state).toBe("ACTIVE");
      expect(activeStatus.experiment.binding).toEqual({
        contractVersion: ACQUISITION_SOURCING_BINDING_CONTRACT,
        experimentId,
        definitionHash: preparedDefinitionHash,
      });
      expect(activeStatus.experiment.assignedRequests).toBe(0);
      expect(activeStatus.contactActionAllowed).toBe(false);
      expect(activeStatus.spendAuthorized).toBe(false);
      expect(activeStatus.policyChanged).toBe(false);

      const first = await prepareDiscovery(
        "smirk-sourcing-experiment-request-0001"
      );
      expect(first.status, JSON.stringify(first.body)).toBe(201);
      expect(first.body.currentState).toBe("PREPARED");
      expect(first.body.providerRequests).toBeUndefined();
      const replay = await prepareDiscovery(
        "smirk-sourcing-experiment-request-0001"
      );
      expect(replay.status).toBe(200);
      expect(replay.body.acquisitionExperimentAssignment).toEqual(
        first.body.acquisitionExperimentAssignment
      );
      const second = await prepareDiscovery(
        "smirk-sourcing-experiment-request-0002"
      );
      expect(second.status).toBe(201);
      expect(
        [
          first.body.acquisitionExperimentAssignment.arm,
          second.body.acquisitionExperimentAssignment.arm,
        ].sort()
      ).toEqual(["challenger", "control"]);
      expect(
        new Set([
          first.body.acquisitionExperimentAssignment.slotOrdinal,
          second.body.acquisitionExperimentAssignment.slotOrdinal,
        ]).size
      ).toBe(2);
      const full = await prepareDiscovery(
        "smirk-sourcing-experiment-request-0003"
      );
      expect(full.status).toBe(412);
      expect(full.body.code).toBe("ACQUISITION_EXPERIMENT_COHORT_FULL");

      await expect(
        caller.acquisitionSourcingExperiments.close({
          experimentId,
          definitionHash: preparedDefinitionHash,
          confirmation: ACQUISITION_SOURCING_CLOSE_CONFIRMATION,
          attestAllAssignmentsAndOutcomesReviewed: true,
          attestNoAutomaticPolicyChange: true,
        })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

      const db = await getDb();
      if (!db) throw new Error("A loopback DATABASE_URL is required.");
      const discoveryRows = await db
        .select({
          id: smirkDiscoveryRequests.id,
          requestId: smirkDiscoveryRequests.requestId,
          arm: smirkDiscoveryRequests.acquisitionSourcingArm,
          assignmentPayload:
            smirkDiscoveryRequests.acquisitionSourcingAssignmentPayload,
        })
        .from(smirkDiscoveryRequests)
        .where(eq(smirkDiscoveryRequests.userId, owner.id));
      let leadSequence = 0;
      for (const discovery of discoveryRows) {
        const arm = discovery.arm!;
        for (let index = 0; index < 10; index += 1) {
          leadSequence += 1;
          const inserted = await db
            .insert(leads)
            .values({
              userId: owner.id,
              companyName: `Synthetic ${arm} Source ${index + 1}`,
              websiteUrl: `https://example.com/source-${leadSequence}`,
              status: "audited",
              phone: `+1202555${String(1000 + leadSequence)}`,
              category: arm === "control" ? "plumbing" : "hvac",
              city: "Reno",
              state: "NV",
              outreachChannel: "none",
            })
            .$returningId();
          const leadId = Number(inserted[0]?.id || 0);
          await db.insert(smirkDiscoveryLeadItems).values({
            discoveryId: discovery.id,
            userId: owner.id,
            sourcePlaceId: `synthetic-experiment-${leadSequence}`,
            leadId,
            state: "READY",
            sourcePayloadHash: crypto
              .createHash("sha256")
              .update(`source-${leadSequence}`)
              .digest("hex"),
          });
          await db.insert(smirkOutcomeEvents).values({
            userId: owner.id,
            leadId,
            workspaceId: 1,
            externalProspectId: `synthetic-prospect-${leadSequence}`,
            externalEventId: `synthetic-experiment-event-${leadSequence}`,
            outreachApprovalId: `approval-${leadSequence}`,
            channel: "email",
            outcome: arm === "challenger" ? "replied" : "delivered",
            evidenceHash: "a".repeat(64),
            outreachPayloadHash: "b".repeat(64),
            eventPayloadHash: crypto
              .createHash("sha256")
              .update(`event-${leadSequence}`)
              .digest("hex"),
            occurredAt: new Date(
              `2026-08-${String(index + 1).padStart(2, "0")}T17:00:00.000Z`
            ),
          });
        }
        await db
          .update(smirkDiscoveryRequests)
          .set({
            state: "COMPLETED",
            createdLeadCount: 10,
            readyLeadCount: 10,
            providerRequests: 0,
            completedAt: new Date(),
          })
          .where(
            and(
              eq(smirkDiscoveryRequests.id, discovery.id),
              eq(smirkDiscoveryRequests.state, "PREPARED")
            )
          );

        const assignment = acquisitionSourcingExperimentAssignmentSchema.parse(
          JSON.parse(discovery.assignmentPayload || "null")
        );
        const sourceRequestId = `smirk-experiment-source-${discovery.id}-0001`;
        const sourceResponse = await fetch(
          `${baseUrl}/api/v1/smirk/lead-batches`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${rawApiKey}`,
              "idempotency-key": sourceRequestId,
            },
            body: JSON.stringify({
              contractVersion: SMIRK_LEAD_BATCH_REQUEST_CONTRACT,
              requestId: sourceRequestId,
              workspaceId: 1,
              sourceDiscoveryRequestId: discovery.requestId,
              sourceAcquisitionExperimentAssignment:
                buildAcquisitionSourcingExperimentAssignmentBinding(assignment),
              criteria: {
                limit: 10,
                category: assignment.effectiveCriteria.category,
                city: assignment.effectiveCriteria.city,
                state: assignment.effectiveCriteria.state,
                learningMode: "none",
              },
              contactActionAllowed: false,
              maxSpendCents: 0,
            }),
          }
        );
        const sourceBody = await sourceResponse.json();
        expect(sourceResponse.status, JSON.stringify(sourceBody)).toBe(201);
        expect(sourceBody.prospects).toHaveLength(10);
        expect(sourceBody.acquisitionExperimentAssignment).toEqual(assignment);
        expect(sourceBody.contactActionAllowed).toBe(false);
        expect(sourceBody.spendAuthorized).toBe(false);
      }

      const firstAssignment = acquisitionSourcingExperimentAssignmentSchema.parse(
        JSON.parse(discoveryRows[0]!.assignmentPayload || "null")
      );
      await db
        .update(smirkDiscoveryRequests)
        .set({ acquisitionSourcingAssignmentHash: "f".repeat(64) })
        .where(eq(smirkDiscoveryRequests.id, discoveryRows[0]!.id));
      await expect(
        caller.acquisitionSourcingExperiments.close({
          experimentId,
          definitionHash: preparedDefinitionHash,
          confirmation: ACQUISITION_SOURCING_CLOSE_CONFIRMATION,
          attestAllAssignmentsAndOutcomesReviewed: true,
          attestNoAutomaticPolicyChange: true,
        })
      ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .update(smirkDiscoveryRequests)
        .set({
          acquisitionSourcingAssignmentHash: firstAssignment.assignmentHash,
        })
        .where(eq(smirkDiscoveryRequests.id, discoveryRows[0]!.id));

      const closed = await caller.acquisitionSourcingExperiments.close({
        experimentId,
        definitionHash: preparedDefinitionHash,
        confirmation: ACQUISITION_SOURCING_CLOSE_CONFIRMATION,
        attestAllAssignmentsAndOutcomesReviewed: true,
        attestNoAutomaticPolicyChange: true,
      });
      expect(closed.state).toBe("CLOSED");
      expect(closed.result?.status).toBe("RECOMMENDATION_READY");
      expect(closed.result?.winner).toBe("challenger");
      expect(closed.result?.proposal?.value).toBe("hvac");
      expect(closed.policyChanged).toBe(false);

      const closedStatusResponse = await fetch(
        `${baseUrl}/api/v1/smirk/acquisition-sourcing-experiments/active?workspaceId=1`,
        {
          headers: { authorization: `Bearer ${rawApiKey}` },
        }
      );
      const closedStatus = await closedStatusResponse.json();
      expect(closedStatusResponse.status).toBe(200);
      expect(closedStatus.state).toBe("NONE");
      expect(closedStatus.experiment).toBeNull();
      expect(closedStatus.policyChanged).toBe(false);

      const candidatesBeforeProposal = await db
        .select()
        .from(acquisitionLearningCandidates)
        .where(eq(acquisitionLearningCandidates.userId, owner.id));
      const releasesBeforeProposal = await db
        .select()
        .from(acquisitionLearningPolicyReleases)
        .where(eq(acquisitionLearningPolicyReleases.userId, owner.id));
      expect(candidatesBeforeProposal).toHaveLength(0);
      expect(releasesBeforeProposal).toHaveLength(0);

      const otherCaller = appRouter.createCaller(context(other));
      expect(
        await otherCaller.acquisitionSourcingExperiments.list({ limit: 10 })
      ).toEqual([]);
      await expect(
        otherCaller.acquisitionSourcingExperiments.activate({
          experimentId,
          definitionHash: preparedDefinitionHash,
          confirmation: ACQUISITION_SOURCING_ACTIVATION_CONFIRMATION,
          attestFrozenBalancedAssignment: true,
          attestNoContactAuthority: true,
          attestNoSpendAuthority: true,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      await expect(
        otherCaller.acquisitionSourcingExperiments.proposeCandidate({
          experimentId,
          definitionHash: preparedDefinitionHash,
          resultHash: closed.result!.resultHash,
          confirmation: ACQUISITION_SOURCING_CANDIDATE_CONFIRMATION,
          attestRecommendationReviewed: true,
          attestNoAutomaticPolicyChange: true,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      const proposed =
        await caller.acquisitionSourcingExperiments.proposeCandidate({
          experimentId,
          definitionHash: preparedDefinitionHash,
          resultHash: closed.result!.resultHash,
          confirmation: ACQUISITION_SOURCING_CANDIDATE_CONFIRMATION,
          attestRecommendationReviewed: true,
          attestNoAutomaticPolicyChange: true,
        });
      expect(proposed.outcome).toBe("created");
      expect(proposed.candidate.state).toBe("CANDIDATE");
      expect(proposed.candidate.proposal.value).toBe("hvac");
      expect(proposed.candidate.evidence.studyDesign).toBe(
        "deterministic-balanced-source-allocation-v1"
      );
      expect(proposed.policyChanged).toBe(false);
      expect(proposed.contactActionAllowed).toBe(false);
      expect(proposed.spendAuthorized).toBe(false);

      const proposedReplay =
        await caller.acquisitionSourcingExperiments.proposeCandidate({
          experimentId,
          definitionHash: preparedDefinitionHash,
          resultHash: closed.result!.resultHash,
          confirmation: ACQUISITION_SOURCING_CANDIDATE_CONFIRMATION,
          attestRecommendationReviewed: true,
          attestNoAutomaticPolicyChange: true,
        });
      expect(proposedReplay.outcome).toBe("duplicate");
      expect(proposedReplay.candidate.id).toBe(proposed.candidate.id);

      const experimentRows = await db
        .select({
          id: acquisitionSourcingExperiments.id,
          resultPayloadHash: acquisitionSourcingExperiments.resultPayloadHash,
        })
        .from(acquisitionSourcingExperiments)
        .where(eq(acquisitionSourcingExperiments.experimentId, experimentId))
        .limit(1);
      const storedResultPayloadHash = experimentRows[0]?.resultPayloadHash;
      expect(storedResultPayloadHash).toMatch(/^[a-f0-9]{64}$/);
      await db
        .update(acquisitionSourcingExperiments)
        .set({ resultPayloadHash: "f".repeat(64) })
        .where(eq(acquisitionSourcingExperiments.id, experimentRows[0]!.id));
      await expect(
        caller.acquisitionLearning.decideCandidate({
          id: proposed.candidate.id,
          decision: "APPROVED",
        })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      await db
        .update(acquisitionSourcingExperiments)
        .set({ resultPayloadHash: storedResultPayloadHash! })
        .where(eq(acquisitionSourcingExperiments.id, experimentRows[0]!.id));

      const candidateDecision =
        await caller.acquisitionLearning.decideCandidate({
          id: proposed.candidate.id,
          decision: "APPROVED",
        });
      expect(candidateDecision.state).toBe("APPROVED");
      expect(candidateDecision.policyChanged).toBe(false);
      expect(
        await db
          .select()
          .from(acquisitionLearningPolicyReleases)
          .where(eq(acquisitionLearningPolicyReleases.userId, owner.id))
      ).toHaveLength(0);

      const released = await caller.acquisitionLearning.releaseCandidate({
        candidateId: proposed.candidate.id,
        releaseId: "4b47db42-a42b-4813-979c-496c6f273cff",
        proposalHash: proposed.candidate.proposalHash,
        evidenceHash: proposed.candidate.evidenceHash,
        confirmation: "release-one-approved-acquisition-candidate-v1",
        attestations: {
          evidenceReviewed: true,
          observationalNotCausal: true,
          noContactOrSpendApproved: true,
        },
        reason:
          "Synthetic approval verifies a future research-only policy release.",
      });
      expect(released.outcome).toBe("released");
      expect(released.policyChanged).toBe(true);
      expect(released.contactAuthorized).toBe(false);
      expect(released.providerExecutionAuthorized).toBe(false);
      expect(released.spendAuthorized).toBe(false);

      const learnedRequestId = "smirk-sourcing-experiment-learned-request-0001";
      const learnedResponse = await fetch(
        `${baseUrl}/api/v1/smirk/discovery-requests`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${rawApiKey}`,
            "idempotency-key": learnedRequestId,
          },
          body: JSON.stringify({
            contractVersion: SMIRK_DISCOVERY_REQUEST_CONTRACT,
            requestId: learnedRequestId,
            workspaceId: 1,
            criteria: {
              limit: 10,
              city: "Reno",
              state: "NV",
              learningMode: "latest_released",
            },
            contactActionAllowed: false,
            spendAuthorized: false,
          }),
        }
      );
      const learnedBody = await learnedResponse.json();
      expect(learnedResponse.status, JSON.stringify(learnedBody)).toBe(201);
      expect(learnedBody.effectiveCriteria.category).toBe("hvac");
      expect(learnedBody.appliedLearningCandidate.id).toBe(
        proposed.candidate.id
      );
      expect(learnedBody.contactActionAllowed).toBe(false);
      expect(learnedBody.spendAuthorized).toBe(false);

      const finalCandidates = await db
        .select()
        .from(acquisitionLearningCandidates)
        .where(eq(acquisitionLearningCandidates.userId, owner.id));
      const finalReleases = await db
        .select()
        .from(acquisitionLearningPolicyReleases)
        .where(eq(acquisitionLearningPolicyReleases.userId, owner.id));
      expect(finalCandidates).toHaveLength(1);
      expect(finalReleases).toHaveLength(1);
    });

    it("serializes concurrent activation for one owner and workspace", async () => {
      const caller = appRouter.createCaller(context(owner));
      const firstId = "2e93d8af-678a-43de-b755-175f5c2bb12c";
      const secondId = "aec449a9-b183-43db-87b4-e297354980cc";
      const prepare = (candidateExperimentId: string) =>
        caller.acquisitionSourcingExperiments.prepare({
          experimentId: candidateExperimentId,
          workspaceId: 1,
          dimension: "category",
          control: {
            label: "Reno plumbing",
            criteria: { category: "plumbing", city: "Reno", state: "NV" },
          },
          challenger: {
            label: "Reno HVAC",
            criteria: { category: "hvac", city: "Reno", state: "NV" },
          },
          requestsPerArm: 1,
          leadsPerRequest: 10,
          attestNoContactAuthority: true,
          attestNoSpendAuthority: true,
        });
      const [first, second] = await Promise.all([
        prepare(firstId),
        prepare(secondId),
      ]);
      const activate = (prepared: typeof first) =>
        caller.acquisitionSourcingExperiments.activate({
          experimentId: prepared.experiment.experimentId,
          definitionHash: prepared.experiment.definitionHash,
          confirmation: ACQUISITION_SOURCING_ACTIVATION_CONFIRMATION,
          attestFrozenBalancedAssignment: true,
          attestNoContactAuthority: true,
          attestNoSpendAuthority: true,
        });

      const results = await Promise.allSettled([
        activate(first),
        activate(second),
      ]);
      expect(
        results.filter(result => result.status === "fulfilled")
      ).toHaveLength(1);
      const rejected = results.find(result => result.status === "rejected");
      expect(rejected).toMatchObject({
        status: "rejected",
        reason: { code: "CONFLICT" },
      });

      const db = await getDb();
      if (!db) throw new Error("A loopback DATABASE_URL is required.");
      const activeRows = await db
        .select({
          id: acquisitionSourcingExperiments.id,
          experimentId: acquisitionSourcingExperiments.experimentId,
          definitionHash: acquisitionSourcingExperiments.definitionHash,
        })
        .from(acquisitionSourcingExperiments)
        .where(
          and(
            eq(acquisitionSourcingExperiments.userId, owner.id),
            eq(acquisitionSourcingExperiments.workspaceId, 1),
            eq(acquisitionSourcingExperiments.state, "ACTIVE")
          )
        );
      expect(activeRows).toHaveLength(1);

      const cancelled = await caller.acquisitionSourcingExperiments.cancel({
        experimentId: activeRows[0]!.experimentId,
        definitionHash: activeRows[0]!.definitionHash,
        confirmation: ACQUISITION_SOURCING_CANCELLATION_CONFIRMATION,
      });
      expect(cancelled.state).toBe("CANCELLED");
      expect(cancelled.learningCandidateId).toBeNull();
      expect(cancelled.policyChanged).toBe(false);
      expect(cancelled.contactActionAllowed).toBe(false);
      expect(cancelled.spendAuthorized).toBe(false);
      expect(
        await db
          .select({ id: acquisitionSourcingExperiments.id })
          .from(acquisitionSourcingExperiments)
          .where(
            and(
              eq(acquisitionSourcingExperiments.userId, owner.id),
              eq(acquisitionSourcingExperiments.workspaceId, 1),
              eq(acquisitionSourcingExperiments.state, "ACTIVE")
            )
          )
      ).toHaveLength(0);
    });
  }
);
