import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

type ColumnDefinition = RowDataPacket & {
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: "YES" | "NO";
  COLUMN_DEFAULT: string | null;
};

const targetStatus =
  "enum('pending','audited','contacted','closed','paid','smirk_queued','smirk_contacted')";
const previousStatus =
  "enum('pending','audited','contacted','closed','paid')";

const targetColumns = [
  {
    name: "smirkHandoffAt",
    type: "timestamp",
    addSql: "ALTER TABLE `leads` ADD `smirkHandoffAt` timestamp",
  },
  {
    name: "smirkCallOutcome",
    type: "varchar(64)",
    addSql: "ALTER TABLE `leads` ADD `smirkCallOutcome` varchar(64)",
  },
  {
    name: "smirkCallSummary",
    type: "text",
    addSql: "ALTER TABLE `leads` ADD `smirkCallSummary` text",
  },
  {
    name: "smirkWorkspaceId",
    type: "varchar(128)",
    addSql: "ALTER TABLE `leads` ADD `smirkWorkspaceId` varchar(128)",
  },
] as const;

function normalizeType(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function assertTargetColumn(column: ColumnDefinition, expectedType: string) {
  if (
    normalizeType(column.COLUMN_TYPE) !== normalizeType(expectedType)
    || column.IS_NULLABLE !== "YES"
    || column.COLUMN_DEFAULT !== null
  ) {
    throw new Error(
      `Refusing to continue: leads.${column.COLUMN_NAME} exists with an incompatible definition.`,
    );
  }
}

async function readColumns(
  connection: Connection,
): Promise<Map<string, ColumnDefinition>> {
  const [rows] = await connection.query<ColumnDefinition[]>(`
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'leads'
      AND (
        COLUMN_NAME = 'status'
        OR COLUMN_NAME IN (
          'smirkHandoffAt',
          'smirkCallOutcome',
          'smirkCallSummary',
          'smirkWorkspaceId'
        )
      )
  `);
  return new Map(rows.map(row => [row.COLUMN_NAME, row]));
}

async function main() {
  const connectionString = String(process.env.DATABASE_URL || "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const connection = await mysql.createConnection(connectionString);
  const applied: string[] = [];

  try {
    const before = await readColumns(connection);
    const status = before.get("status");
    if (!status) {
      throw new Error("Refusing to continue: leads.status does not exist.");
    }

    const currentStatus = normalizeType(status.COLUMN_TYPE);
    if (currentStatus === normalizeType(previousStatus)) {
      await connection.query(
        "ALTER TABLE `leads` MODIFY COLUMN `status` " +
        `${targetStatus} NOT NULL DEFAULT 'pending'`,
      );
      applied.push("expanded leads.status");
    } else if (currentStatus !== normalizeType(targetStatus)) {
      throw new Error(
        "Refusing to continue: leads.status has an unexpected enum definition.",
      );
    }

    for (const target of targetColumns) {
      const existing = before.get(target.name);
      if (existing) {
        assertTargetColumn(existing, target.type);
        continue;
      }
      await connection.query(target.addSql);
      applied.push(`added leads.${target.name}`);
    }

    const after = await readColumns(connection);
    const updatedStatus = after.get("status");
    if (
      !updatedStatus
      || normalizeType(updatedStatus.COLUMN_TYPE) !== normalizeType(targetStatus)
      || updatedStatus.IS_NULLABLE !== "NO"
      || updatedStatus.COLUMN_DEFAULT !== "pending"
    ) {
      throw new Error("SMIRK migration postflight failed for leads.status.");
    }

    for (const target of targetColumns) {
      const column = after.get(target.name);
      if (!column) {
        throw new Error(`SMIRK migration postflight failed for leads.${target.name}.`);
      }
      assertTargetColumn(column, target.type);
    }

    console.log(JSON.stringify({
      ok: true,
      applied,
      alreadyCurrent: applied.length === 0,
      verified: ["status", ...targetColumns.map(column => column.name)],
    }));
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
