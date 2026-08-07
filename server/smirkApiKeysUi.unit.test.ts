import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  new URL("../client/src/pages/ApiKeys.tsx", import.meta.url),
  "utf8"
);

describe("SMIRK API Keys UI safety contract", () => {
  it("offers separate least-privilege research and outcome keys", () => {
    expect(source).toContain('scopes: ["smirk:research"]');
    expect(source).toContain('scopes: ["outcome:write"]');
    expect(source).toContain("Create research key");
    expect(source).toContain("Create outcome key");
    expect(source).not.toMatch(
      /scopes:\s*\[\s*["']smirk:research["']\s*,\s*["']outcome:write["']/
    );
  });

  it("maps the exact guarded SMIRK staging variables", () => {
    for (const variable of [
      "VELVET_LEAD_SOURCE_BASE_URL",
      "VELVET_BASE_URL",
      "VELVET_LEAD_SOURCE_API_KEY",
      "VELVET_OUTCOME_API_KEY",
      "VELVET_OUTCOME_SIGNING_SECRET",
      "VELVET_LEAD_SOURCE_WORKSPACE_ID",
      "VELVET_OUTCOME_WORKSPACE_ID",
    ]) {
      expect(source).toContain(variable);
    }
  });

  it("does not present the legacy push handoff as a live integration", () => {
    expect(source).not.toContain("handoff:write");
    expect(source).not.toContain("SMIRK Full Integration");
    expect(source).not.toContain("Handoffs are live");
    expect(source).not.toContain("autonomous calling");
    expect(source).not.toContain("Queue SMIRK Call");
    expect(source).toContain("no contact or spend");
  });
});
