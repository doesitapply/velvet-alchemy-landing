import { describe, expect, it } from "vitest";
import {
  buildAcquisitionLearningPolicyReceipt,
  verifyAcquisitionLearningPolicyReceipt,
} from "./lib/acquisitionLearningPolicy";

const activeCandidate = {
  id: 42,
  candidateKey: "category:plumbing",
  version: 2,
  proposalHash: "a".repeat(64),
  evidenceHash: "b".repeat(64),
};

describe("Velvet acquisition policy receipts", () => {
  it("binds one approved candidate without authorizing contact or spend", () => {
    const receipt = buildAcquisitionLearningPolicyReceipt({
      releaseId: "c836a5e0-e24b-42bb-b3b6-12b550427d25",
      action: "APPLY",
      userId: 7,
      activeCandidate,
      previousCandidateId: null,
      requestHash: "c".repeat(64),
      reason: "Use this measured segment for the next bounded research batch.",
      createdBy: 7,
    });

    expect(receipt).toMatchObject({
      action: "APPLY",
      activeCandidate,
      controls: {
        affectsFutureResearchCriteriaOnly: true,
        existingBatchesChanged: false,
        contactAuthorized: false,
        providerExecutionAuthorized: false,
        spendAuthorized: false,
      },
    });
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      verifyAcquisitionLearningPolicyReceipt({
        releaseId: receipt.releaseId,
        action: receipt.action,
        userId: receipt.userId,
        activeCandidateId: activeCandidate.id,
        previousCandidateId: null,
        candidateKey: activeCandidate.candidateKey,
        candidateVersion: activeCandidate.version,
        proposalHash: activeCandidate.proposalHash,
        evidenceHash: activeCandidate.evidenceHash,
        requestHash: receipt.requestHash,
        receiptHash: receipt.receiptHash,
        reason: receipt.reason,
        createdBy: receipt.createdBy,
      })
    ).toEqual(receipt);
  });

  it("rejects altered release bytes and malformed action shape", () => {
    const receipt = buildAcquisitionLearningPolicyReceipt({
      releaseId: "4cb1fc83-7fb2-44d7-bbf3-d87c6d564b65",
      action: "DEACTIVATE",
      userId: 7,
      activeCandidate: null,
      previousCandidateId: 42,
      requestHash: "d".repeat(64),
      reason:
        "Disable learned sourcing while the segment evidence is reviewed.",
      createdBy: 7,
    });
    expect(() =>
      verifyAcquisitionLearningPolicyReceipt({
        releaseId: receipt.releaseId,
        action: receipt.action,
        userId: receipt.userId,
        activeCandidateId: null,
        previousCandidateId: 42,
        candidateKey: null,
        candidateVersion: null,
        proposalHash: null,
        evidenceHash: null,
        requestHash: receipt.requestHash,
        receiptHash: receipt.receiptHash,
        reason: `${receipt.reason} changed`,
        createdBy: receipt.createdBy,
      })
    ).toThrow(/receipt hash is invalid/);
    expect(() =>
      verifyAcquisitionLearningPolicyReceipt({
        releaseId: receipt.releaseId,
        action: "APPLY",
        userId: receipt.userId,
        activeCandidateId: null,
        previousCandidateId: 42,
        candidateKey: null,
        candidateVersion: null,
        proposalHash: null,
        evidenceHash: null,
        requestHash: receipt.requestHash,
        receiptHash: receipt.receiptHash,
        reason: receipt.reason,
        createdBy: receipt.createdBy,
      })
    ).toThrow(/shape is invalid/);
    expect(() =>
      verifyAcquisitionLearningPolicyReceipt({
        releaseId: receipt.releaseId,
        action: receipt.action,
        userId: receipt.userId,
        activeCandidateId: null,
        previousCandidateId: 42,
        candidateKey: "category:plumbing",
        candidateVersion: null,
        proposalHash: null,
        evidenceHash: null,
        requestHash: receipt.requestHash,
        receiptHash: receipt.receiptHash,
        reason: receipt.reason,
        createdBy: receipt.createdBy,
      })
    ).toThrow(/shape is invalid/);
    expect(() =>
      buildAcquisitionLearningPolicyReceipt({
        releaseId: "61400de2-3fc4-4a08-9882-f27cc35b0093",
        action: "APPLY",
        userId: 7,
        activeCandidate: null,
        previousCandidateId: null,
        requestHash: "e".repeat(64),
        reason: "An apply receipt cannot omit its reviewed candidate binding.",
        createdBy: 7,
      })
    ).toThrow(/shape is invalid/);
  });
});
