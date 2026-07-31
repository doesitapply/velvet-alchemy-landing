import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildVelvetSmirkConnectionProof,
  verifyVelvetSmirkConnectionProofSignature,
} from "./lib/smirkConnectionProof";

const request = {
  workspaceId: 7,
  challenge: "a".repeat(64),
};
const signingSecret = `connection-proof-${"s".repeat(32)}`;

function build(input: {
  id: number;
  userId?: number;
  scopes: string[];
  privileged?: boolean;
  workspaceId?: number | null;
  secret?: string;
  challenge?: string;
}) {
  return buildVelvetSmirkConnectionProof({
    request: {
      ...request,
      challenge: input.challenge ?? request.challenge,
    },
    apiKey: {
      id: input.id,
      userId: input.userId ?? 42,
      scopes: input.scopes,
      privileged: input.privileged ?? true,
    },
    configuredWorkspaceId:
      input.workspaceId === undefined ? 7 : input.workspaceId,
    signingSecret: input.secret ?? signingSecret,
  });
}

describe("Velvet SMIRK remote connection proof", () => {
  it("binds two exact dedicated credentials to one owner, workspace, and secret", () => {
    const research = build({
      id: 11,
      scopes: ["smirk:research"],
    });
    const outcome = build({
      id: 12,
      scopes: ["outcome:write"],
    });
    expect(research.ok).toBe(true);
    expect(outcome.ok).toBe(true);
    if (!research.ok || !outcome.ok) return;

    expect(research.response.credentialRole).toBe("research");
    expect(outcome.response.credentialRole).toBe("outcome");
    expect(research.response.ownerBinding).toBe(
      outcome.response.ownerBinding
    );
    expect(research.response.credentialBinding).not.toBe(
      outcome.response.credentialBinding
    );
    const nextChallenge = build({
      id: 11,
      scopes: ["smirk:research"],
      challenge: "b".repeat(64),
    });
    expect(nextChallenge.ok).toBe(true);
    if (!nextChallenge.ok) return;
    expect(nextChallenge.response.ownerBinding).not.toBe(
      research.response.ownerBinding
    );
    expect(nextChallenge.response.credentialBinding).not.toBe(
      research.response.credentialBinding
    );
    expect(research.response.guardrails).toEqual({
      contactAuthorized: false,
      spendAuthorized: false,
      providerRequestPerformed: false,
      databaseMutationPerformed: false,
    });
    expect(
      verifyVelvetSmirkConnectionProofSignature({
        response: research.response,
        signingSecret,
      })
    ).toBe(true);
    expect(
      verifyVelvetSmirkConnectionProofSignature({
        response: outcome.response,
        signingSecret: `wrong-${"x".repeat(32)}`,
      })
    ).toBe(false);
  });

  it("rejects wildcard, mixed-scope, non-admin, workspace-drifted, and unconfigured proofs", () => {
    expect(build({ id: 1, scopes: ["*"] })).toMatchObject({
      ok: false,
      code: "VELVET_SMIRK_CONNECTION_PROOF_DEDICATED_SCOPE_REQUIRED",
    });
    expect(
      build({
        id: 1,
        scopes: ["smirk:research", "outcome:write"],
      })
    ).toMatchObject({
      ok: false,
      code: "VELVET_SMIRK_CONNECTION_PROOF_DEDICATED_SCOPE_REQUIRED",
    });
    expect(
      build({
        id: 1,
        scopes: ["smirk:research"],
        privileged: false,
      })
    ).toMatchObject({
      ok: false,
      code: "VELVET_SMIRK_CONNECTION_PROOF_ADMIN_REQUIRED",
    });
    expect(
      build({
        id: 1,
        scopes: ["smirk:research"],
        workspaceId: 8,
      })
    ).toMatchObject({
      ok: false,
      code: "VELVET_SMIRK_CONNECTION_PROOF_WORKSPACE_MISMATCH",
    });
    expect(
      build({
        id: 1,
        scopes: ["smirk:research"],
        secret: "",
      })
    ).toMatchObject({
      ok: false,
      code: "VELVET_SMIRK_CONNECTION_PROOF_NOT_CONFIGURED",
    });
  });

  it("registers the proof before usage-tracking authentication", () => {
    const source = fs.readFileSync(
      new URL("./apiRouter.ts", import.meta.url),
      "utf8"
    );
    const contractSource = fs.readFileSync(
      new URL("./lib/smirkConnectionProof.ts", import.meta.url),
      "utf8"
    );
    const proofRoute = source.indexOf(
      '"/smirk/connection-proof"'
    );
    const trackedAuth = source.indexOf("r.use(requireApiKey)");
    expect(proofRoute).toBeGreaterThan(0);
    expect(trackedAuth).toBeGreaterThan(proofRoute);
    expect(source).toMatch(
      /requireApiKeyWithoutUsageWrite = createApiKeyAuth\(false\)/
    );
    expect(contractSource).toMatch(
      /databaseMutationPerformed:\s*z\.literal\(false\)/
    );
  });
});
