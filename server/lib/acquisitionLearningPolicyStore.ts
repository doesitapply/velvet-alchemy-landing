import { and, desc, eq } from "drizzle-orm";
import {
  acquisitionLearningCandidates,
  acquisitionLearningPolicyReleases,
} from "../../drizzle/schema";
import {
  hashAcquisitionLearningValue,
  verifyAcquisitionLearningCandidateSnapshot,
} from "./acquisitionLearning";
import { verifyAcquisitionLearningPolicyReceipt } from "./acquisitionLearningPolicy";
import {
  parseApprovedSourcingCandidate,
  type AppliedLearningCandidate,
} from "./smirkLeadBatch";

export type ReleasedAcquisitionPolicy =
  | { state: "NONE" }
  | { state: "ACTIVE"; candidate: AppliedLearningCandidate }
  | { state: "INVALID"; reason: string };

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function loadCurrentReleasedAcquisitionPolicy(
  tx: any,
  userId: number
): Promise<ReleasedAcquisitionPolicy> {
  const releaseRows = await tx
    .select()
    .from(acquisitionLearningPolicyReleases)
    .where(eq(acquisitionLearningPolicyReleases.userId, userId))
    .orderBy(desc(acquisitionLearningPolicyReleases.id))
    .limit(1);
  const releaseRow = releaseRows[0];
  if (!releaseRow) return { state: "NONE" };

  let receipt;
  try {
    receipt = verifyAcquisitionLearningPolicyReceipt(releaseRow);
  } catch {
    return { state: "INVALID", reason: "release_receipt_invalid" };
  }
  if (!receipt.activeCandidate) return { state: "NONE" };

  const candidateRows = await tx
    .select()
    .from(acquisitionLearningCandidates)
    .where(
      and(
        eq(acquisitionLearningCandidates.userId, userId),
        eq(
          acquisitionLearningCandidates.id,
          receipt.activeCandidate.id
        ),
        eq(acquisitionLearningCandidates.state, "APPROVED")
      )
    )
    .limit(1);
  const candidateRow = candidateRows[0];
  if (!candidateRow) {
    return { state: "INVALID", reason: "released_candidate_missing" };
  }
  let snapshot;
  try {
    snapshot = verifyAcquisitionLearningCandidateSnapshot({
      proposal: parseJson(candidateRow.proposal),
      evidence: parseJson(candidateRow.evidence),
      sampleSize: candidateRow.sampleSize,
    });
  } catch {
    return { state: "INVALID", reason: "released_candidate_invalid" };
  }
  if (
    candidateRow.candidateKey !== receipt.activeCandidate.candidateKey ||
    candidateRow.version !== receipt.activeCandidate.version ||
    hashAcquisitionLearningValue(snapshot.proposal) !==
      receipt.activeCandidate.proposalHash ||
    hashAcquisitionLearningValue(snapshot.evidence) !==
      receipt.activeCandidate.evidenceHash
  ) {
    return { state: "INVALID", reason: "released_candidate_hash_drift" };
  }
  const candidate = parseApprovedSourcingCandidate({
    id: candidateRow.id,
    candidateKey: candidateRow.candidateKey,
    version: candidateRow.version,
    proposal: candidateRow.proposal,
    policyReleaseId: receipt.releaseId,
    policyReleaseReceiptHash: receipt.receiptHash,
  });
  return candidate
    ? { state: "ACTIVE", candidate }
    : { state: "INVALID", reason: "released_candidate_payload_invalid" };
}
