import { describe, expect, it } from "vitest";
import { getSmirkLifecycleCounts, isInSmirkLifecycle, isReadyForSmirkReview } from "../shared/smirkLifecycle";

describe("SMIRK lifecycle presentation rules", () => {
  it("allows review only for audited or contacted leads with a phone number", () => {
    expect(isReadyForSmirkReview({ status: "audited", phone: "+12025550124" })).toBe(true);
    expect(isReadyForSmirkReview({ status: "contacted", phone: "+12025550124" })).toBe(true);
    expect(isReadyForSmirkReview({ status: "audited", phone: null })).toBe(false);
    expect(isReadyForSmirkReview({ status: "pending", phone: "+12025550124" })).toBe(false);
  });

  it("separates review readiness from an accepted SMIRK lifecycle record", () => {
    expect(isInSmirkLifecycle({ status: "smirk_queued" })).toBe(true);
    expect(isInSmirkLifecycle({ status: "closed", smirkCallOutcome: "booked" })).toBe(true);
    expect(isInSmirkLifecycle({ status: "audited", phone: "+12025550124" })).toBe(false);
  });

  it("derives only real lifecycle counts from stored lead state", () => {
    expect(getSmirkLifecycleCounts([
      { status: "audited", phone: "+12025550124" },
      { status: "audited", phone: null },
      { status: "smirk_queued", phone: "+12025550125" },
      { status: "closed", smirkCallOutcome: "booked" },
    ])).toEqual({ audited: 2, ready: 1, queued: 1, outcomes: 1 });
  });
});
