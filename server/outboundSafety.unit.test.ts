import { describe, expect, it } from "vitest";
import { calculateRevenueLoss } from "./lib/enrichment";
import { sendEmailViaGmail } from "./lib/emailOutreach";
import { sendSmsOutreach } from "./lib/smsOutreach";

describe("outbound adapters", () => {
  it("cannot send cold SMS", async () => {
    await expect(
      sendSmsOutreach({
        toPhone: "+12025550126",
        companyName: "Synthetic Plumbing Example",
        prestigeScore: 50,
        leadId: 1,
        auditSummary: "Synthetic review only.",
      })
    ).resolves.toMatchObject({
      success: false,
      code: "EXTERNAL_ACTION_APPROVAL_REQUIRED",
    });
  });

  it("cannot send email from the legacy adapter", async () => {
    await expect(
      sendEmailViaGmail({
        to: "review@example.com",
        subject: "Review only",
        body: "Synthetic review-only draft.",
      })
    ).resolves.toMatchObject({
      success: false,
      code: "EXTERNAL_ACTION_APPROVAL_REQUIRED",
    });
  });

  it("labels modeled value as an internal scenario, not measured loss", () => {
    const scenario = calculateRevenueLoss(45, "plumber");
    expect(scenario.monthlyLoss).toBeGreaterThan(0);
    expect(scenario.explanation).toMatch(/illustrative scenario only/i);
    expect(scenario.explanation).toMatch(
      /not measured customer or revenue loss/i
    );
  });
});
