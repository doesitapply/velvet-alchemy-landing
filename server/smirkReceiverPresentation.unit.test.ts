import { describe, expect, it } from "vitest";
import { getSmirkReceiverPresentation } from "@shared/smirkReceiverPresentation";

describe("SMIRK receiver presentation", () => {
  it("renders missing diagnostic data as neutral verification rather than a false blocked state", () => {
    expect(getSmirkReceiverPresentation()).toEqual({ label: "Verifying receiver", tone: "verifying" });
  });

  it("preserves reachable and actual failure states", () => {
    expect(getSmirkReceiverPresentation("reachable")).toEqual({ label: "Receiver reachable", tone: "reachable" });
    expect(getSmirkReceiverPresentation("degraded")).toEqual({ label: "Receiver blocked", tone: "blocked" });
  });
});
