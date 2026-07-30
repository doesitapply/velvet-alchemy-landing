import { describe, expect, it } from "vitest";
import { isPrivilegedUser, requireCostAuthority } from "./lib/accessControl";
import { getRateLimitPolicy } from "./governor";
import { apiScopeMaySpend, canGrantApiScopes } from "./lib/apiScopePolicy";

describe("operator access policy", () => {
  it("recognizes administrators", () => {
    expect(isPrivilegedUser({ id: 1, role: "admin" })).toBe(true);
  });

  it("does not elevate a normal operator", () => {
    expect(isPrivilegedUser({ id: 2, role: "user" })).toBe(false);
  });

  it("blocks a normal operator from paid or metered actions", () => {
    expect(() => requireCostAuthority({ id: 2, role: "user" })).toThrow(
      /administrator approval/i
    );
  });

  it("allows an administrator to start a paid or metered action", () => {
    expect(() => requireCostAuthority({ id: 1, role: "admin" })).not.toThrow();
  });
});

describe("cost-bearing action limits", () => {
  it.each([
    "lead_create",
    "screenshot_capture",
    "pipeline_execute",
    "batch_audit",
    "asset_generate",
    "website_generate",
    "scrape_search",
    "scrape_bulk",
    "ranking_check",
    "prescreen",
    "checkout_create",
    "draft_generate",
    "voice_analyze",
    "smirk_research_export",
  ])("has an explicit policy for %s", action => {
    expect(getRateLimitPolicy(action)).toMatchObject({
      maxRequests: expect.any(Number),
      windowMs: expect.any(Number),
    });
  });

  it("returns null for an ungoverned action", () => {
    expect(getRateLimitPolicy("not_configured")).toBeNull();
  });
});

describe("REST API scope policy", () => {
  it.each(["scrape", "audit", "pipeline", "*"])(
    "treats %s as cost-bearing",
    scope => {
      expect(apiScopeMaySpend(scope)).toBe(true);
    }
  );

  it("allows a normal operator to grant read-only scopes", () => {
    expect(canGrantApiScopes(false, ["leads:read"])).toBe(true);
  });

  it("denies cost-bearing scopes to a normal operator", () => {
    expect(canGrantApiScopes(false, ["leads:read", "pipeline"])).toBe(false);
  });

  it("allows an administrator to grant cost-bearing scopes", () => {
    expect(canGrantApiScopes(true, ["*"])).toBe(true);
  });
});
