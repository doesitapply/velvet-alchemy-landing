import { z } from "zod";
import { hashAcquisitionLearningValue } from "./acquisitionLearning";

export const ACQUISITION_LEARNING_POLICY_RELEASE_CONTRACT =
  "velvet.acquisition-learning-policy-release.v1" as const;
export const ACQUISITION_LEARNING_POLICY_RELEASE_CONFIRMATION =
  "release-one-approved-acquisition-candidate-v1" as const;
export const ACQUISITION_LEARNING_POLICY_DEACTIVATE_CONFIRMATION =
  "deactivate-current-acquisition-policy-v1" as const;

const releaseAttestationsSchema = z
  .object({
    evidenceReviewed: z.literal(true),
    observationalNotCausal: z.literal(true),
    noContactOrSpendApproved: z.literal(true),
  })
  .strict();

export const acquisitionLearningPolicyReleaseInputSchema = z
  .object({
    candidateId: z.number().int().positive(),
    releaseId: z.string().uuid(),
    proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
    evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
    confirmation: z.literal(ACQUISITION_LEARNING_POLICY_RELEASE_CONFIRMATION),
    attestations: releaseAttestationsSchema,
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export const acquisitionLearningPolicyDeactivateInputSchema = z
  .object({
    currentReleaseId: z.string().uuid(),
    releaseId: z.string().uuid(),
    confirmation: z.literal(
      ACQUISITION_LEARNING_POLICY_DEACTIVATE_CONFIRMATION
    ),
    reason: z.string().trim().min(10).max(500),
  })
  .strict()
  .refine(value => value.currentReleaseId !== value.releaseId, {
    message: "The deactivation receipt must use a new release ID.",
  });

export type AcquisitionLearningPolicyReleaseInput = z.infer<
  typeof acquisitionLearningPolicyReleaseInputSchema
>;
export type AcquisitionLearningPolicyDeactivateInput = z.infer<
  typeof acquisitionLearningPolicyDeactivateInputSchema
>;

export type AcquisitionLearningPolicyCandidateBinding = {
  id: number;
  candidateKey: string;
  version: number;
  proposalHash: string;
  evidenceHash: string;
};

const acquisitionLearningPolicyCandidateBindingSchema = z
  .object({
    id: z.number().int().positive(),
    candidateKey: z.string().trim().min(3).max(180),
    version: z.number().int().positive(),
    proposalHash: z.string().regex(/^[a-f0-9]{64}$/),
    evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type AcquisitionLearningPolicyReceipt = {
  contractVersion: typeof ACQUISITION_LEARNING_POLICY_RELEASE_CONTRACT;
  releaseId: string;
  action: "APPLY" | "DEACTIVATE";
  userId: number;
  activeCandidate: AcquisitionLearningPolicyCandidateBinding | null;
  previousCandidateId: number | null;
  requestHash: string;
  reason: string;
  createdBy: number;
  controls: {
    affectsFutureResearchCriteriaOnly: true;
    existingBatchesChanged: false;
    contactAuthorized: false;
    providerExecutionAuthorized: false;
    spendAuthorized: false;
  };
  receiptHash: string;
};

export function buildAcquisitionLearningPolicyReceipt(input: {
  releaseId: string;
  action: "APPLY" | "DEACTIVATE";
  userId: number;
  activeCandidate: AcquisitionLearningPolicyCandidateBinding | null;
  previousCandidateId: number | null;
  requestHash: string;
  reason: string;
  createdBy: number;
}): AcquisitionLearningPolicyReceipt {
  const action = z.enum(["APPLY", "DEACTIVATE"]).parse(input.action);
  const activeCandidate = input.activeCandidate
    ? acquisitionLearningPolicyCandidateBindingSchema.parse(
        input.activeCandidate
      )
    : null;
  if (
    (action === "APPLY" && !activeCandidate) ||
    (action === "DEACTIVATE" && activeCandidate)
  ) {
    throw new Error("The acquisition policy release shape is invalid.");
  }
  const payload = {
    contractVersion: ACQUISITION_LEARNING_POLICY_RELEASE_CONTRACT,
    releaseId: z.string().uuid().parse(input.releaseId),
    action,
    userId: z.number().int().positive().parse(input.userId),
    activeCandidate,
    previousCandidateId: z
      .number()
      .int()
      .positive()
      .nullable()
      .parse(input.previousCandidateId),
    requestHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(input.requestHash),
    reason: z.string().trim().min(10).max(500).parse(input.reason),
    createdBy: z.number().int().positive().parse(input.createdBy),
    controls: {
      affectsFutureResearchCriteriaOnly: true as const,
      existingBatchesChanged: false as const,
      contactAuthorized: false as const,
      providerExecutionAuthorized: false as const,
      spendAuthorized: false as const,
    },
  };
  return {
    ...payload,
    receiptHash: hashAcquisitionLearningValue(payload),
  };
}

export function verifyAcquisitionLearningPolicyReceipt(input: {
  releaseId: string;
  action: "APPLY" | "DEACTIVATE";
  userId: number;
  activeCandidateId: number | null;
  previousCandidateId: number | null;
  candidateKey: string | null;
  candidateVersion: number | null;
  proposalHash: string | null;
  evidenceHash: string | null;
  requestHash: string;
  receiptHash: string;
  reason: string;
  createdBy: number;
}): AcquisitionLearningPolicyReceipt {
  const activeCandidate =
    input.activeCandidateId === null
      ? null
      : {
          id: input.activeCandidateId,
          candidateKey: String(input.candidateKey || ""),
          version: Number(input.candidateVersion || 0),
          proposalHash: String(input.proposalHash || ""),
          evidenceHash: String(input.evidenceHash || ""),
        };
  const candidateColumns = [
    input.candidateKey,
    input.candidateVersion,
    input.proposalHash,
    input.evidenceHash,
  ];
  if (
    (input.action === "APPLY" && !activeCandidate) ||
    (input.action === "DEACTIVATE" &&
      (activeCandidate || candidateColumns.some(value => value !== null)))
  ) {
    throw new Error("The acquisition policy release shape is invalid.");
  }
  if (activeCandidate) {
    acquisitionLearningPolicyCandidateBindingSchema.parse(activeCandidate);
  }
  const receipt = buildAcquisitionLearningPolicyReceipt({
    releaseId: input.releaseId,
    action: input.action,
    userId: input.userId,
    activeCandidate,
    previousCandidateId: input.previousCandidateId,
    requestHash: input.requestHash,
    reason: input.reason,
    createdBy: input.createdBy,
  });
  if (receipt.receiptHash !== input.receiptHash) {
    throw new Error("The acquisition policy release receipt hash is invalid.");
  }
  return receipt;
}
