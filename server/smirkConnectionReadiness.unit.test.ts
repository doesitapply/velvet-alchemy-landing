import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  buildVelvetSmirkConnectionReadiness,
  type VelvetSmirkDatabaseEvidence,
} from "./lib/smirkConnectionReadiness";

function configuredEnv(): Record<string, string> {
  return {
    DATABASE_URL: "mysql://user:password@127.0.0.1:3306/fixture",
    BUILT_IN_FORGE_API_URL: "https://forge.example.invalid",
    BUILT_IN_FORGE_API_KEY: `forge-${"a".repeat(32)}`,
    ENABLE_MAPS_RESEARCH: "true",
    MAPS_COST_CENTS_PER_REQUEST: "2",
    ENABLE_SMIRK_DISCOVERY_WORKER: "true",
    ENABLE_HUNTER_OWNER_ENRICHMENT: "true",
    HUNTER_API_KEY: `hunter-${"b".repeat(32)}`,
    HUNTER_COST_CENTS_PER_CREDIT: "3",
    SMIRK_RESEARCH_WORKSPACE_ID: "7",
    SMIRK_OUTCOME_SIGNING_SECRET: `outcome-${"c".repeat(32)}`,
    SMIRK_BASE_URL: "https://smirkcalls.com",
    SMIRK_RESEARCH_API_KEY: `research-${"d".repeat(32)}`,
    SMIRK_API_KEY: `synthetic-${"e".repeat(32)}`,
  };
}

function databaseEvidence(): VelvetSmirkDatabaseEvidence {
  return {
    checked: true,
    available: true,
    schemaReady: true,
    activeDedicatedResearchKeyCount: 1,
    activeDedicatedOutcomeKeyCount: 1,
    keysDistinct: true,
    sameAdminOwner: true,
    missing: [],
  };
}

describe("Velvet SMIRK connection readiness", () => {
  it("reports a complete redacted canonical pull-loop configuration", () => {
    const env = configuredEnv();
    const report = buildVelvetSmirkConnectionReadiness({
      env,
      databaseEvidence: databaseEvidence(),
      source: "synthetic-test",
    });

    expect(report.ok).toBe(true);
    expect(report.connections.smirkWorkspaceBoundary.workspaceId).toBe(7);
    expect(report.connections.mapsDiscovery.unitCostCents).toBe(2);
    expect(report.connections.ownerEmailEnrichment.unitCostCents).toBe(3);
    expect(
      report.connections.optionalResearchPush.requiredForCanonicalPullLoop
    ).toBe(false);
    expect(report.externalAction).toBe("none");
    expect(report.readinessScope).toBe("velvet-runtime-preflight");
    expect(report.endToEndReady).toBe(false);
    expect(report.guardrails.coldSmsAllowed).toBe(false);
    expect(report.guardrails.contactAuthorized).toBe(false);
    expect(report.guardrails.spendAuthorized).toBe(false);

    const serialized = JSON.stringify(report);
    for (const key of [
      "DATABASE_URL",
      "BUILT_IN_FORGE_API_KEY",
      "HUNTER_API_KEY",
      "SMIRK_OUTCOME_SIGNING_SECRET",
      "SMIRK_RESEARCH_API_KEY",
      "SMIRK_API_KEY",
    ]) {
      expect(serialized).not.toContain(env[key]);
    }
  });

  it("fails closed when required providers, worker, and database proof are absent", () => {
    const report = buildVelvetSmirkConnectionReadiness({
      env: {},
      databaseEvidence: {
        ...databaseEvidence(),
        checked: false,
        available: false,
        schemaReady: false,
        activeDedicatedResearchKeyCount: 0,
        activeDedicatedOutcomeKeyCount: 0,
        keysDistinct: false,
        sameAdminOwner: false,
        missing: ["VELVET_SMIRK_DATABASE_PROOF"],
      },
      source: "synthetic-test",
    });

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain("DATABASE_URL");
    expect(report.blockers).toContain("ENABLE_MAPS_RESEARCH");
    expect(report.blockers).toContain("ENABLE_SMIRK_DISCOVERY_WORKER");
    expect(report.blockers).toContain("ENABLE_HUNTER_OWNER_ENRICHMENT");
    expect(report.blockers).toContain("SMIRK_OUTCOME_SIGNING_SECRET");
    expect(report.blockers).toContain("VELVET_SMIRK_DATABASE_PROOF");
  });

  it("keeps optional push gaps separate and blocks reused environment secrets", () => {
    const env = configuredEnv();
    delete env.SMIRK_BASE_URL;
    delete env.SMIRK_RESEARCH_API_KEY;
    env.HUNTER_API_KEY = env.BUILT_IN_FORGE_API_KEY;
    const report = buildVelvetSmirkConnectionReadiness({
      env,
      databaseEvidence: databaseEvidence(),
      source: "synthetic-test",
    });

    expect(report.ok).toBe(false);
    expect(report.optionalGaps).toContain("SMIRK_BASE_URL");
    expect(report.optionalGaps).toContain("SMIRK_RESEARCH_API_KEY");
    expect(report.blockers).toContain("VELVET_SMIRK_ENV_SECRET_SEPARATION");
  });

  it("rejects ambiguous or misaligned dedicated database keys", () => {
    const evidence = databaseEvidence();
    evidence.activeDedicatedResearchKeyCount = 2;
    evidence.keysDistinct = false;
    evidence.sameAdminOwner = false;
    const report = buildVelvetSmirkConnectionReadiness({
      env: configuredEnv(),
      databaseEvidence: evidence,
      source: "synthetic-test",
    });

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain("VELVET_SMIRK_RESEARCH_KEY_SCOPE");
    expect(report.blockers).toContain("VELVET_SMIRK_DATABASE_KEY_SEPARATION");
    expect(report.blockers).toContain("VELVET_SMIRK_KEY_OWNER_ALIGNMENT");
  });

  it("keeps the CLI database and provider paths read-only", () => {
    const checkSource = fs.readFileSync(
      new URL("./smirkConnectionReadinessCheck.ts", import.meta.url),
      "utf8"
    );
    const readinessSource = fs.readFileSync(
      new URL("./lib/smirkConnectionReadiness.ts", import.meta.url),
      "utf8"
    );
    const source = `${checkSource}\n${readinessSource}`;
    expect(checkSource).toMatch(/SELECT table_name/);
    expect(checkSource).toMatch(/SELECT k\.id/);
    expect(checkSource).not.toMatch(
      /\b(?:INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CREATE)\b/i
    );
    expect(checkSource).not.toMatch(
      /\b(?:fetch|axios|makeRequest|findVerifiedOwnerEmail)\s*\(/
    );
    expect(source).toMatch(/databaseMutationPerformed/);
    expect(source).toMatch(/providerRequestPerformed/);
  });
});
