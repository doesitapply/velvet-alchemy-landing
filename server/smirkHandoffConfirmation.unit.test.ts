import { describe, expect, it } from "vitest";
import { buildSmirkHandoffConfirmation } from "../shared/smirkHandoffConfirmation";

describe("buildSmirkHandoffConfirmation", () => {
  it("makes the exact real-lead target and downstream effect explicit before submission", () => {
    const confirmation = buildSmirkHandoffConfirmation({
      leadId: 42,
      companyName: "Northstar HVAC",
      phone: "+17755550123",
    });

    expect(confirmation.title).toBe("Confirm SMIRK Handoff");
    expect(confirmation.actionLabel).toBe("Confirm Handoff to SMIRK");
    expect(confirmation.target).toEqual([
      ["Business", "Northstar HVAC"],
      ["Phone", "+17755550123"],
      ["Lead ID", "42"],
    ]);
    expect(confirmation.description).toMatch(/does not itself place a call/i);
    expect(confirmation.description).toMatch(/outbound workflow/i);
  });
});
