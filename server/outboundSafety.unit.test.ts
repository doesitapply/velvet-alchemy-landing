import { describe, expect, it } from "vitest";
import {
  buildNotMeasuredRevenueImpact,
  findCompetitorGaps,
  performTechnicalAudit,
} from "./lib/enrichment";
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

  it("does not manufacture modeled customer or revenue loss", () => {
    expect(buildNotMeasuredRevenueImpact()).toEqual({
      status: "not_measured",
      annualLoss: null,
      monthlyLoss: null,
      explanation:
        "Velvet did not measure customer loss or revenue impact. Modeled loss is excluded from prospect evidence and outreach.",
    });
  });

  it("does not fabricate performance, mobile, or competitor evidence", async () => {
    await expect(
      performTechnicalAudit("https://example.com")
    ).resolves.toMatchObject({
      loadSpeed: null,
      mobileFriendly: null,
      httpsUrl: true,
      sslEnabled: null,
      measurementStatus: "not_measured",
      issues: [],
    });
    await expect(
      findCompetitorGaps("Synthetic Plumbing", "plumbing", "Reno, NV")
    ).resolves.toEqual({
      status: "not_measured",
      competitorUrl: null,
      gapFound: null,
    });
  });
});
