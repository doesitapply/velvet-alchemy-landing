#!/usr/bin/env node
import mysql from "mysql2/promise";
import {
  buildVelvetSmirkConnectionReadiness,
  type VelvetSmirkDatabaseEvidence,
} from "./lib/smirkConnectionReadiness";

const REQUIRED_TABLES = [
  "acquisition_learning_candidates",
  "api_keys",
  "smirk_discovery_events",
  "smirk_discovery_lead_items",
  "smirk_discovery_requests",
  "smirk_lead_batch_items",
  "smirk_lead_batches",
  "smirk_outcome_events",
  "users",
] as const;

type ApiKeyRow = {
  id: number;
  userId: number;
  scopes: string;
  expiresAt: Date | string | null;
  role: string;
};

function unavailableDatabaseEvidence(
  missing: string[]
): VelvetSmirkDatabaseEvidence {
  return {
    checked: false,
    available: false,
    schemaReady: false,
    activeDedicatedResearchKeyCount: 0,
    activeDedicatedOutcomeKeyCount: 0,
    keysDistinct: false,
    sameAdminOwner: false,
    missing,
  };
}

function exactScopes(raw: string, expected: string): boolean {
  try {
    const parsed = JSON.parse(raw);
    return (
      Array.isArray(parsed) && parsed.length === 1 && parsed[0] === expected
    );
  } catch {
    return false;
  }
}

async function readDatabaseEvidence(
  databaseUrl: string
): Promise<VelvetSmirkDatabaseEvidence> {
  if (!databaseUrl.trim()) {
    return unavailableDatabaseEvidence(["DATABASE_URL"]);
  }
  let connection: mysql.Connection | null = null;
  try {
    connection = await mysql.createConnection(databaseUrl);
    const placeholders = REQUIRED_TABLES.map(() => "?").join(",");
    const [tableRows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT table_name AS tableName
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name IN (${placeholders})`,
      [...REQUIRED_TABLES]
    );
    const presentTables = new Set(tableRows.map(row => String(row.tableName)));
    const schemaReady = REQUIRED_TABLES.every(table =>
      presentTables.has(table)
    );
    if (!presentTables.has("api_keys") || !presentTables.has("users")) {
      return {
        ...unavailableDatabaseEvidence(["VELVET_SMIRK_SCHEMA_READINESS"]),
        checked: true,
        available: true,
        schemaReady,
      };
    }

    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT k.id, k.userId, k.scopes, k.expiresAt, u.role
       FROM api_keys k
       INNER JOIN users u ON u.id = k.userId
       WHERE k.isActive = 1`
    );
    const now = Date.now();
    const activeRows = (rows as ApiKeyRow[]).filter(row => {
      if (!row.expiresAt) return true;
      const expiresAt = new Date(row.expiresAt).getTime();
      return Number.isFinite(expiresAt) && expiresAt > now;
    });
    const researchRows = activeRows.filter(
      row => row.role === "admin" && exactScopes(row.scopes, "smirk:research")
    );
    const outcomeRows = activeRows.filter(
      row => row.role === "admin" && exactScopes(row.scopes, "outcome:write")
    );
    const keysDistinct =
      researchRows.length === 1 &&
      outcomeRows.length === 1 &&
      researchRows[0].id !== outcomeRows[0].id;
    const sameAdminOwner =
      keysDistinct && researchRows[0].userId === outcomeRows[0].userId;
    const missing = [
      ...(schemaReady ? [] : ["VELVET_SMIRK_SCHEMA_READINESS"]),
      ...(researchRows.length === 1 ? [] : ["VELVET_SMIRK_RESEARCH_KEY_SCOPE"]),
      ...(outcomeRows.length === 1 ? [] : ["VELVET_SMIRK_OUTCOME_KEY_SCOPE"]),
      ...(keysDistinct ? [] : ["VELVET_SMIRK_DATABASE_KEY_SEPARATION"]),
      ...(sameAdminOwner ? [] : ["VELVET_SMIRK_KEY_OWNER_ALIGNMENT"]),
    ];
    return {
      checked: true,
      available: true,
      schemaReady,
      activeDedicatedResearchKeyCount: researchRows.length,
      activeDedicatedOutcomeKeyCount: outcomeRows.length,
      keysDistinct,
      sameAdminOwner,
      missing,
    };
  } catch {
    return unavailableDatabaseEvidence(["VELVET_SMIRK_DATABASE_READ_FAILED"]);
  } finally {
    await connection?.end().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const databaseEvidence = await readDatabaseEvidence(
    String(process.env.DATABASE_URL || "")
  );
  const report = buildVelvetSmirkConnectionReadiness({
    env: process.env,
    databaseEvidence,
    source: "process-environment",
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

main().catch(() => {
  process.stdout.write(
    `${JSON.stringify(
      {
        contractVersion: "velvet-smirk.connection-readiness.v1",
        ok: false,
        readinessScope: "velvet-runtime-preflight",
        endToEndReady: false,
        source: "process-environment",
        blockers: ["VELVET_SMIRK_PREFLIGHT_FAILED"],
        guardrails: {
          coldSmsAllowed: false,
          velvetOutreachExecutionAllowed: false,
          automatedProspectDialingAllowed: false,
          contactAuthorized: false,
          spendAuthorized: false,
          providerRequestPerformed: false,
          databaseMutationPerformed: false,
        },
        externalAction: "none",
      },
      null,
      2
    )}\n`
  );
  process.exitCode = 1;
});
