import { describe, expect, it } from "vitest";
import { getSmirkLifecycleCounts, isInSmirkLifecycle, isReadyForSmirkReview } from "../shared/smirkLifecycle";

describe("SMIRK lifecycle presentation rules", () => {
  const qualifiedLead = {
    status: "audited",
    phone: "+12025550124",
    businessStatus: "OPERATIONAL",
    reviewCount: 87,
    googleRating: "4.6",
    prestigeScore: 45,
  };

  it("allows review only for fully qualified audited leads", () => {
    expect(isReadyForSmirkReview(qualifiedLead)).toBe(true);
    expect(isReadyForSmirkReview({ ...qualifiedLead, status: "contacted" })).toBe(false);
    expect(isReadyForSmirkReview({ ...qualifiedLead, phone: null })).toBe(false);
    expect(isReadyForSmirkReview({ ...qualifiedLead, businessStatus: "CLOSED_TEMPORARILY" })).toBe(false);
    expect(isReadyForSmirkReview({ ...qualifiedLead, reviewCount: 12 })).toBe(false);
  });

  it("separates review readiness from an accepted SMIRK lifecycle record", () => {
    expect(isInSmirkLifecycle({ status: "smirk_queued" })).toBe(true);
    expect(isInSmirkLifecycle({ status: "closed", smirkCallOutcome: "booked" })).toBe(true);
    expect(isInSmirkLifecycle(qualifiedLead)).toBe(false);
  });

  it("derives only real lifecycle counts from stored lead state", () => {
    expect(getSmirkLifecycleCounts([
      qualifiedLead,
      { ...qualifiedLead, phone: null },
      { status: "smirk_queued", phone: "+12025550125" },
      { status: "closed", smirkCallOutcome: "booked" },
    ])).toEqual({ audited: 2, ready: 1, queued: 1, outcomes: 1 });
  });
});
