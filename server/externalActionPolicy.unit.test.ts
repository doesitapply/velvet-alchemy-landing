import { describe, expect, it } from "vitest";
import {
  assertSafeExternalCopy,
  buildStableVelvetExternalId,
  externalActionBlock,
  findUnsupportedExternalClaim,
} from "./lib/externalActionPolicy";

describe("external action policy", () => {
  it.each([
    "email_send",
    "sms_send",
    "automated_call",
    "prospect_handoff",
  ] as const)("blocks %s in prepare-only mode", action => {
    expect(externalActionBlock(action)).toMatchObject({
      allowed: false,
      action,
      mode: "prepare_only",
      code: "EXTERNAL_ACTION_APPROVAL_REQUIRED",
    });
  });

  it("rejects unsupported loss and guarantee claims", () => {
    expect(findUnsupportedExternalClaim("This is costing you jobs.")).toBe(
      "costing you jobs"
    );
    expect(findUnsupportedExternalClaim("Those are lost emergency jobs.")).toBe(
      "lost emergency jobs"
    );
    expect(() =>
      assertSafeExternalCopy(
        "Guaranteed revenue",
        "We can recover your lost revenue."
      )
    ).toThrow(/unsupported external claim/i);
  });

  it("allows a qualified observation", () => {
    expect(() =>
      assertSafeExternalCopy(
        "Mobile contact review",
        "I noticed a possible mobile booking issue that may be creating friction."
      )
    ).not.toThrow();
  });

  it("builds deterministic lead references", () => {
    expect(buildStableVelvetExternalId(42)).toBe("va-lead-42");
    expect(() => buildStableVelvetExternalId(0)).toThrow(/positive integer/i);
  });
});
