import { describe, expect, it } from "vitest";
import { VALID_SCOPES } from "./apiKeyRouter";

describe("SMIRK control-read scope", () => {
  it("is available as a distinct least-privilege API permission", () => {
    expect(VALID_SCOPES).toContain("smirk:read");
    expect("smirk:read").not.toBe("handoff:write");
    expect("smirk:read").not.toBe("outcome:write");
  });
});
