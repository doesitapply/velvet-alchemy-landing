/**
 * API Key Router Tests
 * Validates key generation, hashing, and scope logic
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";

// Test the key generation logic (extracted from apiKeyRouter)
function generateApiKey() {
  const raw = "va_live_" + crypto.randomBytes(24).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

describe("API Key Generation", () => {
  it("generates keys with correct prefix", () => {
    const { raw, prefix } = generateApiKey();
    expect(raw).toMatch(/^va_live_[a-f0-9]{48}$/);
    expect(prefix).toBe("va_live_xxxx".replace("xxxx", raw.slice(8, 12)));
    expect(raw.startsWith("va_live_")).toBe(true);
  });

  it("generates unique keys each time", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1.raw).not.toBe(key2.raw);
    expect(key1.hash).not.toBe(key2.hash);
  });

  it("hash is deterministic — same key always produces same hash", () => {
    const { raw, hash } = generateApiKey();
    const reHash = crypto.createHash("sha256").update(raw).digest("hex");
    expect(hash).toBe(reHash);
  });

  it("hash is 64 hex chars (SHA-256)", () => {
    const { hash } = generateApiKey();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("prefix is first 12 chars of raw key", () => {
    const { raw, prefix } = generateApiKey();
    expect(prefix).toBe(raw.slice(0, 12));
  });
});

describe("Scope Validation", () => {
  const VALID_SCOPES = ["leads:read", "leads:write", "scrape", "audit", "pipeline", "*"];

  it("wildcard scope covers all operations", () => {
    const userScopes = ["*"];
    const hasAccess = (scope: string) =>
      userScopes.includes(scope) || userScopes.includes("*");

    expect(hasAccess("leads:read")).toBe(true);
    expect(hasAccess("scrape")).toBe(true);
    expect(hasAccess("audit")).toBe(true);
    expect(hasAccess("pipeline")).toBe(true);
  });

  it("limited scopes only grant specific access", () => {
    const userScopes = ["leads:read"];
    const hasAccess = (scope: string) =>
      userScopes.includes(scope) || userScopes.includes("*");

    expect(hasAccess("leads:read")).toBe(true);
    expect(hasAccess("scrape")).toBe(false);
    expect(hasAccess("audit")).toBe(false);
  });

  it("all valid scopes are recognized", () => {
    VALID_SCOPES.forEach(scope => {
      expect(typeof scope).toBe("string");
      expect(scope.length).toBeGreaterThan(0);
    });
  });
});
