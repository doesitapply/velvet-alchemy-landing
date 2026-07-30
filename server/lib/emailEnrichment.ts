/**
 * Email Enrichment Service
 *
 * Finds a verified owner/founder/CEO email address for a domain using a
 * single-result Hunter.io lookup.
 *
 * If no verified email is found, the lead remains research-only. Cold SMS is disabled.
 *
 * Environment variables required:
 *   ENABLE_HUNTER_OWNER_ENRICHMENT=true
 *   HUNTER_API_KEY
 *   HUNTER_COST_CENTS_PER_CREDIT
 */

import {
  reserveApiCallCost,
  settleApiCallCostReservation,
} from "../apiCostTracker";

const OWNER_TITLE_PATTERN =
  /owner|founder|ceo|president|managing director|proprietor/i;

export interface EnrichedContact {
  email: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  confidence: number; // 0-100
  source: "hunter";
}

export type EmailEnrichmentContext = {
  userId: number;
  leadId?: number;
};

export function readHunterOwnerEnrichmentConfig(
  env: Record<string, string | undefined> = process.env
): {
  configured: boolean;
  apiKey: string;
  costCentsPerCredit: number | null;
  missing: string[];
} {
  const apiKey = String(env.HUNTER_API_KEY || "").trim();
  const costCentsPerCredit = Number(
    String(env.HUNTER_COST_CENTS_PER_CREDIT || "").trim()
  );
  const missing: string[] = [];
  if (env.ENABLE_HUNTER_OWNER_ENRICHMENT !== "true") {
    missing.push("ENABLE_HUNTER_OWNER_ENRICHMENT=true");
  }
  if (!apiKey) missing.push("HUNTER_API_KEY");
  if (
    !Number.isSafeInteger(costCentsPerCredit) ||
    costCentsPerCredit <= 0 ||
    costCentsPerCredit > 10_000
  ) {
    missing.push("HUNTER_COST_CENTS_PER_CREDIT");
  }
  return {
    configured: missing.length === 0,
    apiKey,
    costCentsPerCredit:
      Number.isSafeInteger(costCentsPerCredit) &&
      costCentsPerCredit > 0 &&
      costCentsPerCredit <= 10_000
        ? costCentsPerCredit
        : null,
    missing,
  };
}

/**
 * Find a verified owner/founder/CEO email for a domain.
 * Returns null if no verified contact is found.
 */
export async function findVerifiedOwnerEmail(
  domain: string,
  context: EmailEnrichmentContext
): Promise<EnrichedContact | null> {
  // Normalize domain: strip protocol and path
  const cleanDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];

  // Try Hunter.io first
  const hunterResult = await tryHunter(cleanDomain, context);
  if (hunterResult) return hunterResult;

  return null;
}

/**
 * Hunter.io domain search
 * Docs: https://hunter.io/api/v2/domain-search
 */
async function tryHunter(
  domain: string,
  context: EmailEnrichmentContext
): Promise<EnrichedContact | null> {
  const config = readHunterOwnerEnrichmentConfig();
  if (!config.configured || !config.costCentsPerCredit) {
    console.warn(
      `[EmailEnrichment] Hunter owner lookup disabled: ${config.missing.join(", ")}`
    );
    return null;
  }

  const reservation = await reserveApiCallCost({
    userId: context.userId,
    leadId: context.leadId,
    service: "other",
    operation: "hunter_owner_domain_search_one_credit_max",
    estimatedCostCents: config.costCentsPerCredit,
    requestData: { domain, maximumResults: 1 },
  });
  let responseStatus:
    | "success"
    | "error"
    | "timeout"
    | "outcome_unknown" = "outcome_unknown";
  try {
    const params = new URLSearchParams({
      domain,
      api_key: config.apiKey,
      limit: "1",
      type: "personal",
      decision_maker: "true",
      verification_status: "valid",
      required_field: "position",
    });
    const url = `https://api.hunter.io/v2/domain-search?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    if (!res.ok) {
      console.warn(
        `[EmailEnrichment] Hunter.io returned ${res.status} for ${domain}`
      );
      return null;
    }

    const data = (await res.json()) as HunterDomainSearchResponse;
    responseStatus = "success";
    return selectHunterVerifiedOwner(data?.data?.emails ?? []);
  } catch (err) {
    console.error("[EmailEnrichment] Hunter.io error:", err);
    responseStatus =
      err instanceof Error && err.name === "TimeoutError"
        ? "timeout"
        : "error";
    return null;
  } finally {
    await settleApiCallCostReservation(
      reservation.id,
      responseStatus,
    );
  }
}

// ─── Type definitions ────────────────────────────────────────────────────────

export interface HunterEmail {
  value: string;
  confidence: number;
  type?: string;
  decision_maker?: boolean | null;
  position?: string;
  first_name?: string;
  last_name?: string;
  verification?: {
    status?: string;
  };
}

interface HunterDomainSearchResponse {
  data?: { emails: HunterEmail[] };
}

export function selectHunterVerifiedOwner(
  emails: HunterEmail[]
): EnrichedContact | null {
  const best = [...emails]
    .filter(
      email =>
        email.type === "personal" &&
        email.decision_maker === true &&
        email.verification?.status === "valid" &&
        email.confidence >= 70 &&
        Boolean(email.position && OWNER_TITLE_PATTERN.test(email.position))
    )
    .sort((a, b) => b.confidence - a.confidence)[0];
  if (!best) return null;
  return {
    email: best.value,
    firstName: best.first_name ?? undefined,
    lastName: best.last_name ?? undefined,
    title: best.position,
    confidence: best.confidence,
    source: "hunter",
  };
}
