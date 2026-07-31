import { readMapsRequestCostConfig } from "../_core/map";
import { readHunterOwnerEnrichmentConfig } from "./emailEnrichment";
import { readSmirkResearchConfig } from "./smirkResearch";

export const VELVET_SMIRK_CONNECTION_READINESS_CONTRACT =
  "velvet-smirk.connection-readiness.v1" as const;

type ConnectionSummary = {
  configured: boolean;
  enabled: boolean;
  available: boolean;
  missing: string[];
};

export type VelvetSmirkDatabaseEvidence = {
  checked: boolean;
  available: boolean;
  schemaReady: boolean;
  activeDedicatedResearchKeyCount: number;
  activeDedicatedOutcomeKeyCount: number;
  keysDistinct: boolean;
  sameAdminOwner: boolean;
  missing: string[];
};

export type VelvetSmirkConnectionReadiness = {
  contractVersion: typeof VELVET_SMIRK_CONNECTION_READINESS_CONTRACT;
  ok: boolean;
  readinessScope: "velvet-runtime-preflight";
  endToEndReady: false;
  source: "process-environment" | "synthetic-test";
  connections: {
    durableStore: ConnectionSummary;
    smirkWorkspaceBoundary: ConnectionSummary & {
      workspaceId: number | null;
    };
    mapsDiscovery: ConnectionSummary & {
      unitCostCents: number | null;
    };
    discoveryWorker: ConnectionSummary;
    ownerEmailEnrichment: ConnectionSummary & {
      unitCostCents: number | null;
    };
    outcomeReceiver: ConnectionSummary;
    optionalResearchPush: ConnectionSummary & {
      workspaceId: number | null;
      requiredForCanonicalPullLoop: false;
    };
  };
  databaseProof: VelvetSmirkDatabaseEvidence;
  credentialSeparation: {
    environmentSecretsDistinct: boolean;
    dedicatedDatabaseKeysDistinct: boolean;
  };
  blockers: string[];
  optionalGaps: string[];
  guardrails: {
    coldSmsAllowed: false;
    velvetOutreachExecutionAllowed: false;
    automatedProspectDialingAllowed: false;
    contactAuthorized: false;
    spendAuthorized: false;
    providerRequestPerformed: false;
    databaseMutationPerformed: false;
  };
  unproven: string[];
  externalAction: "none";
};

function uniqueNames(values: string[]): string[] {
  return Array.from(
    new Set(values.map(value => value.replace(/=true$/, "")))
  ).sort();
}

function connection(input: {
  configured: boolean;
  enabled: boolean;
  missing: string[];
}): ConnectionSummary {
  return {
    configured: input.configured,
    enabled: input.enabled,
    available: input.configured && input.enabled,
    missing: uniqueNames(input.missing),
  };
}

function positiveWorkspaceId(raw: string | undefined): number | null {
  const normalized = String(raw || "").trim();
  const value = Number(normalized);
  return /^\d+$/.test(normalized) && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function validHttpsUrl(raw: string | undefined): boolean {
  try {
    const url = new URL(String(raw || "").trim());
    return (
      url.protocol === "https:" && url.username === "" && url.password === ""
    );
  } catch {
    return false;
  }
}

function environmentSecretsAreDistinct(
  env: Record<string, string | undefined>
): boolean {
  const required = [
    String(env.BUILT_IN_FORGE_API_KEY || "").trim(),
    String(env.HUNTER_API_KEY || "").trim(),
    String(env.SMIRK_OUTCOME_SIGNING_SECRET || "").trim(),
  ];
  if (required.some(value => value.length < 16)) return false;
  const optional = [
    String(env.SMIRK_RESEARCH_API_KEY || "").trim(),
    String(env.SMIRK_API_KEY || "").trim(),
  ].filter(Boolean);
  const values = [...required, ...optional];
  return new Set(values).size === values.length;
}

export function buildVelvetSmirkConnectionReadiness(input: {
  env: Record<string, string | undefined>;
  databaseEvidence: VelvetSmirkDatabaseEvidence;
  source: VelvetSmirkConnectionReadiness["source"];
}): VelvetSmirkConnectionReadiness {
  const env = input.env;
  const workspaceId = positiveWorkspaceId(env.SMIRK_RESEARCH_WORKSPACE_ID);
  const maps = readMapsRequestCostConfig(env);
  const hunter = readHunterOwnerEnrichmentConfig(env);
  const optionalPush = readSmirkResearchConfig(env);
  const durableStoreConfigured = Boolean(String(env.DATABASE_URL || "").trim());
  const forgeConfigured =
    validHttpsUrl(env.BUILT_IN_FORGE_API_URL) &&
    String(env.BUILT_IN_FORGE_API_KEY || "").trim().length >= 16;
  const mapsEnabled = env.ENABLE_MAPS_RESEARCH === "true";
  const workerEnabled = env.ENABLE_SMIRK_DISCOVERY_WORKER === "true";
  const hunterEnabled = env.ENABLE_HUNTER_OWNER_ENRICHMENT === "true";
  const outcomeSecret = String(env.SMIRK_OUTCOME_SIGNING_SECRET || "").trim();
  const outcomeConfigured = outcomeSecret.length >= 32;
  const secretsDistinct = environmentSecretsAreDistinct(env);

  const connections = {
    durableStore: connection({
      configured: durableStoreConfigured,
      enabled: durableStoreConfigured,
      missing: durableStoreConfigured ? [] : ["DATABASE_URL"],
    }),
    smirkWorkspaceBoundary: {
      ...connection({
        configured: workspaceId !== null,
        enabled: workspaceId !== null,
        missing: workspaceId ? [] : ["SMIRK_RESEARCH_WORKSPACE_ID"],
      }),
      workspaceId,
    },
    mapsDiscovery: {
      ...connection({
        configured: maps.configured && forgeConfigured,
        enabled: mapsEnabled,
        missing: [
          ...maps.missing,
          ...(validHttpsUrl(env.BUILT_IN_FORGE_API_URL)
            ? []
            : ["BUILT_IN_FORGE_API_URL"]),
          ...(String(env.BUILT_IN_FORGE_API_KEY || "").trim().length >= 16
            ? []
            : ["BUILT_IN_FORGE_API_KEY"]),
        ],
      }),
      unitCostCents: maps.costCentsPerRequest,
    },
    discoveryWorker: connection({
      configured: workerEnabled,
      enabled: workerEnabled,
      missing: workerEnabled ? [] : ["ENABLE_SMIRK_DISCOVERY_WORKER"],
    }),
    ownerEmailEnrichment: {
      ...connection({
        configured: hunter.configured,
        enabled: hunterEnabled,
        missing: hunter.missing,
      }),
      unitCostCents: hunter.costCentsPerCredit,
    },
    outcomeReceiver: connection({
      configured: outcomeConfigured && secretsDistinct,
      enabled: outcomeConfigured,
      missing: [
        ...(outcomeConfigured ? [] : ["SMIRK_OUTCOME_SIGNING_SECRET"]),
        ...(secretsDistinct ? [] : ["VELVET_SMIRK_ENV_SECRET_SEPARATION"]),
      ],
    }),
    optionalResearchPush: {
      ...connection({
        configured: optionalPush.configured,
        enabled: optionalPush.configured,
        missing: optionalPush.missing,
      }),
      workspaceId: optionalPush.workspaceId,
      requiredForCanonicalPullLoop: false as const,
    },
  };

  const requiredConnections = [
    connections.durableStore,
    connections.smirkWorkspaceBoundary,
    connections.mapsDiscovery,
    connections.discoveryWorker,
    connections.ownerEmailEnrichment,
    connections.outcomeReceiver,
  ];
  const blockers = uniqueNames([
    ...requiredConnections.flatMap(item => item.missing),
    ...input.databaseEvidence.missing,
    ...(input.databaseEvidence.checked ? [] : ["VELVET_SMIRK_DATABASE_PROOF"]),
    ...(input.databaseEvidence.schemaReady
      ? []
      : ["VELVET_SMIRK_SCHEMA_READINESS"]),
    ...(input.databaseEvidence.activeDedicatedResearchKeyCount === 1
      ? []
      : ["VELVET_SMIRK_RESEARCH_KEY_SCOPE"]),
    ...(input.databaseEvidence.activeDedicatedOutcomeKeyCount === 1
      ? []
      : ["VELVET_SMIRK_OUTCOME_KEY_SCOPE"]),
    ...(input.databaseEvidence.keysDistinct
      ? []
      : ["VELVET_SMIRK_DATABASE_KEY_SEPARATION"]),
    ...(input.databaseEvidence.sameAdminOwner
      ? []
      : ["VELVET_SMIRK_KEY_OWNER_ALIGNMENT"]),
  ]);
  const allRequiredConnectionsAvailable = requiredConnections.every(
    item => item.available
  );

  return {
    contractVersion: VELVET_SMIRK_CONNECTION_READINESS_CONTRACT,
    ok:
      allRequiredConnectionsAvailable &&
      input.databaseEvidence.available &&
      input.databaseEvidence.schemaReady &&
      input.databaseEvidence.activeDedicatedResearchKeyCount === 1 &&
      input.databaseEvidence.activeDedicatedOutcomeKeyCount === 1 &&
      input.databaseEvidence.keysDistinct &&
      input.databaseEvidence.sameAdminOwner,
    readinessScope: "velvet-runtime-preflight",
    endToEndReady: false,
    source: input.source,
    connections,
    databaseProof: {
      ...input.databaseEvidence,
      missing: uniqueNames(input.databaseEvidence.missing),
    },
    credentialSeparation: {
      environmentSecretsDistinct: secretsDistinct,
      dedicatedDatabaseKeysDistinct: input.databaseEvidence.keysDistinct,
    },
    blockers,
    optionalGaps: connections.optionalResearchPush.available
      ? []
      : uniqueNames(connections.optionalResearchPush.missing),
    guardrails: {
      coldSmsAllowed: false,
      velvetOutreachExecutionAllowed: false,
      automatedProspectDialingAllowed: false,
      contactAuthorized: false,
      spendAuthorized: false,
      providerRequestPerformed: false,
      databaseMutationPerformed: false,
    },
    unproven: [
      "the raw SMIRK-held tokens match the two active Velvet key rows",
      "the SMIRK and Velvet outcome signing secrets match",
      "the configured provider credentials are funded and accepted",
      "production migration, deploy parity, worker health, or scheduled execution",
      "provider results, verified inbox placement, prospect contact, conversion, or revenue",
    ],
    externalAction: "none",
  };
}
