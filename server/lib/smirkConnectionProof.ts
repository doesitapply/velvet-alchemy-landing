import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";

export const VELVET_SMIRK_CONNECTION_PROOF_CONTRACT =
  "velvet-smirk.connection-proof.v1" as const;

const hexDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const velvetSmirkConnectionProofRequestSchema = z
  .object({
    workspaceId: z.number().int().positive(),
    challenge: hexDigestSchema,
  })
  .strict();

const velvetSmirkConnectionProofUnsignedSchema = z
  .object({
    contractVersion: z.literal(
      VELVET_SMIRK_CONNECTION_PROOF_CONTRACT
    ),
    workspaceId: z.number().int().positive(),
    challenge: hexDigestSchema,
    credentialRole: z.enum(["research", "outcome"]),
    ownerBinding: hexDigestSchema,
    credentialBinding: hexDigestSchema,
    checks: z
      .object({
        exactDedicatedScope: z.literal(true),
        privilegedOwner: z.literal(true),
        workspaceBound: z.literal(true),
        signingSecretConfigured: z.literal(true),
      })
      .strict(),
    guardrails: z
      .object({
        contactAuthorized: z.literal(false),
        spendAuthorized: z.literal(false),
        providerRequestPerformed: z.literal(false),
        databaseMutationPerformed: z.literal(false),
      })
      .strict(),
    externalAction: z.literal("none"),
  })
  .strict();

export const velvetSmirkConnectionProofResponseSchema =
  velvetSmirkConnectionProofUnsignedSchema
    .extend({
      proof: hexDigestSchema,
    })
    .strict();

export type VelvetSmirkConnectionProofResponse = z.infer<
  typeof velvetSmirkConnectionProofResponseSchema
>;

export type VelvetSmirkConnectionProofResult =
  | {
      ok: true;
      response: VelvetSmirkConnectionProofResponse;
    }
  | {
      ok: false;
      status: 403 | 503;
      code:
        | "VELVET_SMIRK_CONNECTION_PROOF_NOT_CONFIGURED"
        | "VELVET_SMIRK_CONNECTION_PROOF_WORKSPACE_MISMATCH"
        | "VELVET_SMIRK_CONNECTION_PROOF_ADMIN_REQUIRED"
        | "VELVET_SMIRK_CONNECTION_PROOF_DEDICATED_SCOPE_REQUIRED";
    };

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map(
      key =>
        `${JSON.stringify(key)}:${canonicalJson(object[key])}`
    )
    .join(",")}}`;
}

function connectionProofHmac(
  domain: string,
  value: unknown,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(`${domain}\0${canonicalJson(value)}`)
    .digest("hex");
}

export function buildVelvetSmirkConnectionProof(input: {
  request: z.infer<
    typeof velvetSmirkConnectionProofRequestSchema
  >;
  apiKey: {
    id: number;
    userId: number;
    scopes: string[];
    privileged: boolean;
  };
  configuredWorkspaceId: number | null;
  signingSecret: string;
}): VelvetSmirkConnectionProofResult {
  if (
    !input.configuredWorkspaceId ||
    input.signingSecret.length < 32
  ) {
    return {
      ok: false,
      status: 503,
      code: "VELVET_SMIRK_CONNECTION_PROOF_NOT_CONFIGURED",
    };
  }
  if (input.request.workspaceId !== input.configuredWorkspaceId) {
    return {
      ok: false,
      status: 403,
      code: "VELVET_SMIRK_CONNECTION_PROOF_WORKSPACE_MISMATCH",
    };
  }
  if (!input.apiKey.privileged) {
    return {
      ok: false,
      status: 403,
      code: "VELVET_SMIRK_CONNECTION_PROOF_ADMIN_REQUIRED",
    };
  }
  const role =
    input.apiKey.scopes.length === 1 &&
    input.apiKey.scopes[0] === "smirk:research"
      ? "research"
      : input.apiKey.scopes.length === 1 &&
          input.apiKey.scopes[0] === "outcome:write"
        ? "outcome"
        : null;
  if (!role) {
    return {
      ok: false,
      status: 403,
      code: "VELVET_SMIRK_CONNECTION_PROOF_DEDICATED_SCOPE_REQUIRED",
    };
  }

  const unsigned =
    velvetSmirkConnectionProofUnsignedSchema.parse({
      contractVersion:
        VELVET_SMIRK_CONNECTION_PROOF_CONTRACT,
      workspaceId: input.request.workspaceId,
      challenge: input.request.challenge,
      credentialRole: role,
      ownerBinding: connectionProofHmac(
        "velvet-smirk.connection-proof.owner.v1",
        {
          userId: input.apiKey.userId,
          workspaceId: input.request.workspaceId,
          challenge: input.request.challenge,
        },
        input.signingSecret
      ),
      credentialBinding: connectionProofHmac(
        "velvet-smirk.connection-proof.credential.v1",
        {
          apiKeyId: input.apiKey.id,
          credentialRole: role,
          workspaceId: input.request.workspaceId,
          challenge: input.request.challenge,
        },
        input.signingSecret
      ),
      checks: {
        exactDedicatedScope: true,
        privilegedOwner: true,
        workspaceBound: true,
        signingSecretConfigured: true,
      },
      guardrails: {
        contactAuthorized: false,
        spendAuthorized: false,
        providerRequestPerformed: false,
        databaseMutationPerformed: false,
      },
      externalAction: "none",
    });
  return {
    ok: true,
    response: velvetSmirkConnectionProofResponseSchema.parse({
      ...unsigned,
      proof: connectionProofHmac(
        "velvet-smirk.connection-proof.response.v1",
        unsigned,
        input.signingSecret
      ),
    }),
  };
}

export function verifyVelvetSmirkConnectionProofSignature(input: {
  response: VelvetSmirkConnectionProofResponse;
  signingSecret: string;
}): boolean {
  if (input.signingSecret.length < 32) return false;
  const parsed =
    velvetSmirkConnectionProofResponseSchema.safeParse(
      input.response
    );
  if (!parsed.success) return false;
  const { proof, ...unsigned } = parsed.data;
  const expected = Buffer.from(
    connectionProofHmac(
      "velvet-smirk.connection-proof.response.v1",
      unsigned,
      input.signingSecret
    ),
    "hex"
  );
  const actual = Buffer.from(proof, "hex");
  return (
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  );
}
