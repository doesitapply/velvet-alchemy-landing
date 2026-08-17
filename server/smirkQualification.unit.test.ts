import { describe, expect, it } from "vitest";
import { evaluateSmirkQualification, normalizeSmirkPhone } from "@shared/smirkQualification";

const qualifyingLead = {
  status: "audited",
  businessStatus: "OPERATIONAL",
  phone: "(775) 555-0123",
  reviewCount: 87,
  googleRating: "4.6",
  prestigeScore: 45,
};

describe("SMIRK qualification gate", () => {
  it("qualifies only leads that meet every auditable criterion", () => {
    const result = evaluateSmirkQualification(qualifyingLead);
    expect(result.eligible).toBe(true);
    expect(result.normalizedPhone).toBe("+17755550123");
    expect(result.blockers).toEqual([]);
    expect(result.evidence.map(item => item.code)).toEqual(expect.arrayContaining(["audited", "operational", "callable_phone", "rating", "reviews", "opportunity"]));
  });

  it("fails closed with specific reasons when evidence is incomplete or below threshold", () => {
    const result = evaluateSmirkQualification({
      status: "pending",
      businessStatus: "CLOSED_TEMPORARILY",
      phone: "unknown",
      reviewCount: 12,
      googleRating: "3.9",
      prestigeScore: 0,
    });
    expect(result.eligible).toBe(false);
    expect(result.blockers.map(item => item.code)).toEqual(expect.arrayContaining([
      "audit_required", "operational_required", "callable_phone_required", "rating_required", "reviews_required", "opportunity_required",
    ]));
  });

  it("normalizes only unambiguous North American calling numbers", () => {
    expect(normalizeSmirkPhone("775-555-0123")).toBe("+17755550123");
    expect(normalizeSmirkPhone("+447700900123")).toBe("+447700900123");
    expect(normalizeSmirkPhone("555-0123")).toBeNull();
  });
});
