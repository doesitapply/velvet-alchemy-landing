export const SMIRK_QUALIFICATION_RULES = {
  minimumReviewCount: 30,
  minimumGoogleRating: 4.2,
  minimumOpportunityScore: 1,
  maximumOpportunityScore: 60,
} as const;

export type SmirkQualificationLead = {
  status: string;
  phone?: string | null;
  businessStatus?: string | null;
  reviewCount?: number | null;
  googleRating?: string | number | null;
  prestigeScore?: number | null;
};

export type SmirkQualificationItem = {
  code: string;
  label: string;
  detail: string;
};

export type SmirkQualification = {
  eligible: boolean;
  normalizedPhone: string | null;
  evidence: SmirkQualificationItem[];
  blockers: SmirkQualificationItem[];
  rules: typeof SMIRK_QUALIFICATION_RULES;
};

/**
 * Normalize only clearly North American 10/11-digit numbers or valid E.164 input.
 * Any ambiguous number remains blocked instead of being guessed.
 */
export function normalizeSmirkPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function evaluateSmirkQualification(lead: SmirkQualificationLead): SmirkQualification {
  const evidence: SmirkQualificationItem[] = [];
  const blockers: SmirkQualificationItem[] = [];
  const normalizedPhone = normalizeSmirkPhone(lead.phone);
  const rating = typeof lead.googleRating === "number"
    ? lead.googleRating
    : Number.parseFloat(String(lead.googleRating ?? ""));
  const reviewCount = Number(lead.reviewCount ?? 0);
  const prestigeScore = Number(lead.prestigeScore ?? 0);

  if (lead.status === "audited") {
    evidence.push({ code: "audited", label: "Audit completed", detail: "Lead status is audited." });
  } else {
    blockers.push({ code: "audit_required", label: "Audit required", detail: "A completed audit is required before a SMIRK handoff." });
  }

  if (String(lead.businessStatus ?? "").toUpperCase() === "OPERATIONAL") {
    evidence.push({ code: "operational", label: "Operational listing", detail: "Google business status is OPERATIONAL." });
  } else {
    blockers.push({ code: "operational_required", label: "Operational status required", detail: "Google business status must be OPERATIONAL; unknown or closed listings are blocked." });
  }

  if (normalizedPhone) {
    evidence.push({ code: "callable_phone", label: "Callable phone", detail: `Normalized to ${normalizedPhone}.` });
  } else {
    blockers.push({ code: "callable_phone_required", label: "Callable phone required", detail: "A valid E.164 or unambiguous North American phone number is required." });
  }

  if (Number.isFinite(rating) && rating >= SMIRK_QUALIFICATION_RULES.minimumGoogleRating) {
    evidence.push({ code: "rating", label: "Customer rating signal", detail: `${rating.toFixed(1)}★ meets the ${SMIRK_QUALIFICATION_RULES.minimumGoogleRating}★ minimum.` });
  } else {
    blockers.push({ code: "rating_required", label: "Rating threshold not met", detail: `Google rating must be at least ${SMIRK_QUALIFICATION_RULES.minimumGoogleRating}★.` });
  }

  if (Number.isFinite(reviewCount) && reviewCount >= SMIRK_QUALIFICATION_RULES.minimumReviewCount) {
    evidence.push({ code: "reviews", label: "Demand signal", detail: `${reviewCount} reviews meets the ${SMIRK_QUALIFICATION_RULES.minimumReviewCount}-review minimum.` });
  } else {
    blockers.push({ code: "reviews_required", label: "Review threshold not met", detail: `At least ${SMIRK_QUALIFICATION_RULES.minimumReviewCount} reviews are required.` });
  }

  if (Number.isFinite(prestigeScore)
    && prestigeScore >= SMIRK_QUALIFICATION_RULES.minimumOpportunityScore
    && prestigeScore <= SMIRK_QUALIFICATION_RULES.maximumOpportunityScore) {
    evidence.push({ code: "opportunity", label: "Audited opportunity", detail: `Audit score ${prestigeScore}/100 is inside the ${SMIRK_QUALIFICATION_RULES.minimumOpportunityScore}–${SMIRK_QUALIFICATION_RULES.maximumOpportunityScore} opportunity range.` });
  } else {
    blockers.push({ code: "opportunity_required", label: "Audited opportunity threshold not met", detail: `Audit score must be between ${SMIRK_QUALIFICATION_RULES.minimumOpportunityScore} and ${SMIRK_QUALIFICATION_RULES.maximumOpportunityScore}; 0 and missing scores are not actionable evidence.` });
  }

  return {
    eligible: blockers.length === 0,
    normalizedPhone,
    evidence,
    blockers,
    rules: SMIRK_QUALIFICATION_RULES,
  };
}
