import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.resolve(process.cwd(), "drizzle");

function sqlMigrations(): Array<{ name: string; sql: string }> {
  return fs
    .readdirSync(migrationsDirectory)
    .filter(name => name.endsWith(".sql"))
    .sort()
    .map(name => ({
      name,
      sql: fs.readFileSync(path.join(migrationsDirectory, name), "utf8"),
    }));
}

describe("MySQL migration portability", () => {
  it("does not use unsupported ADD COLUMN IF NOT EXISTS syntax", () => {
    const offenders = sqlMigrations()
      .filter(migration =>
        /\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/i.test(migration.sql)
      )
      .map(migration => migration.name);

    expect(offenders).toEqual([]);
  });

  it("guards the four historical SMIRK columns through information_schema", () => {
    const migration = sqlMigrations().find(
      item => item.name === "0022_smirk_outcome_events.sql"
    );
    expect(migration).toBeDefined();
    for (const column of [
      "smirkHandoffAt",
      "smirkCallOutcome",
      "smirkCallSummary",
      "smirkWorkspaceId",
    ]) {
      expect(migration?.sql).toContain(`column_name = '${column}'`);
      expect(migration?.sql).toContain(
        `ALTER TABLE \`leads\` ADD COLUMN \`${column}\``
      );
    }
    expect(
      migration?.sql.match(/^PREPARE smirk_add_column_stmt/gm)
    ).toHaveLength(4);
    expect(
      migration?.sql.match(
        /^DEALLOCATE PREPARE smirk_add_column_stmt/gm
      )
    ).toHaveLength(4);
  });
});
