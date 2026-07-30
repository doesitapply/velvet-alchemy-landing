import { describe, expect, it } from "vitest";
import {
  readHunterOwnerEnrichmentConfig,
  selectHunterVerifiedOwner,
} from "./lib/emailEnrichment";

describe("verified owner email provenance", () => {
  it("fails closed without explicit enablement and owner-priced credits", () => {
    expect(
      readHunterOwnerEnrichmentConfig({
        HUNTER_API_KEY: "hunter-key",
      })
    ).toMatchObject({
      configured: false,
      costCentsPerCredit: null,
    });
    expect(
      readHunterOwnerEnrichmentConfig({
        ENABLE_HUNTER_OWNER_ENRICHMENT: "true",
        HUNTER_API_KEY: "hunter-key",
        HUNTER_COST_CENTS_PER_CREDIT: "7",
      })
    ).toMatchObject({
      configured: true,
      costCentsPerCredit: 7,
    });
  });

  it("accepts only a valid personal Hunter decision-maker with an owner title", () => {
    expect(
      selectHunterVerifiedOwner([
        {
          value: "sales@example.com",
          confidence: 99,
          type: "personal",
          decision_maker: false,
          position: "Sales Manager",
          verification: { status: "valid" },
        },
        {
          value: "owner@example.com",
          confidence: 86,
          type: "personal",
          decision_maker: true,
          position: "Owner",
          verification: { status: "valid" },
        },
      ])
    ).toMatchObject({
      email: "owner@example.com",
      title: "Owner",
      source: "hunter",
    });
  });

  it("rejects Hunter confidence without valid owner provenance", () => {
    expect(
      selectHunterVerifiedOwner([
        {
          value: "contact@example.com",
          confidence: 99,
          type: "generic",
          decision_maker: true,
          position: "Owner",
          verification: { status: "valid" },
        },
        {
          value: "founder@example.com",
          confidence: 99,
          type: "personal",
          decision_maker: true,
          position: "Founder",
          verification: { status: "unknown" },
        },
      ])
    ).toBeNull();
  });

});
