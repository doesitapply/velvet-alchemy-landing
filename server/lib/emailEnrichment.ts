/**
 * Email Enrichment Service
 *
 * Finds verified owner/founder/CEO email addresses for a domain using
 * Hunter.io as primary, Snov.io as fallback.
 *
 * If no verified email is found, the lead is routed to SMS via Twilio.
 *
 * Environment variables required:
 *   HUNTER_API_KEY   — Hunter.io API key (https://hunter.io/api-keys)
 *   SNOV_CLIENT_ID   — Snov.io client ID (optional fallback)
 *   SNOV_CLIENT_SECRET — Snov.io client secret (optional fallback)
 */

const OWNER_TITLE_PATTERN = /owner|founder|ceo|president|managing director|proprietor/i;

export interface EnrichedContact {
  email: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  confidence: number; // 0-100
  source: "hunter" | "snov" | "fallback";
}

/**
 * Find a verified owner/founder/CEO email for a domain.
 * Returns null if no verified contact is found.
 */
export async function findVerifiedOwnerEmail(
  domain: string
): Promise<EnrichedContact | null> {
  // Normalize domain: strip protocol and path
  const cleanDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];

  // Try Hunter.io first
  const hunterResult = await tryHunter(cleanDomain);
  if (hunterResult) return hunterResult;

  // Fallback to Snov.io
  const snovResult = await trySnov(cleanDomain);
  if (snovResult) return snovResult;

  return null;
}

/**
 * Hunter.io domain search
 * Docs: https://hunter.io/api/v2/domain-search
 */
async function tryHunter(domain: string): Promise<EnrichedContact | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    console.warn("[EmailEnrichment] HUNTER_API_KEY not set, skipping Hunter.io");
    return null;
  }

  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    if (!res.ok) {
      console.warn(`[EmailEnrichment] Hunter.io returned ${res.status} for ${domain}`);
      return null;
    }

    const data = (await res.json()) as HunterDomainSearchResponse;
    const emails = data?.data?.emails ?? [];

    // Filter for owner-level titles, sort by confidence descending
    const ownerEmails = emails
      .filter(
        (e) =>
          e.confidence >= 50 &&
          e.position &&
          OWNER_TITLE_PATTERN.test(e.position)
      )
      .sort((a, b) => b.confidence - a.confidence);

    // Fall back to highest-confidence email if no owner title found
    const best =
      ownerEmails[0] ??
      emails.sort((a, b) => b.confidence - a.confidence)[0];

    if (!best) return null;

    return {
      email: best.value,
      firstName: best.first_name ?? undefined,
      lastName: best.last_name ?? undefined,
      title: best.position ?? undefined,
      confidence: best.confidence,
      source: "hunter",
    };
  } catch (err) {
    console.error("[EmailEnrichment] Hunter.io error:", err);
    return null;
  }
}

/**
 * Snov.io domain search (fallback)
 * Docs: https://snov.io/api
 */
async function trySnov(domain: string): Promise<EnrichedContact | null> {
  const clientId = process.env.SNOV_CLIENT_ID;
  const clientSecret = process.env.SNOV_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    // Get OAuth access token
    const tokenRes = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!tokenRes.ok) return null;
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    // Domain search
    const searchRes = await fetch(
      `https://api.snov.io/v2/domain-emails-with-info?domain=${encodeURIComponent(domain)}&type=all&limit=10`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!searchRes.ok) return null;
    const searchData = (await searchRes.json()) as SnovDomainResponse;
    const contacts = searchData?.emails ?? [];

    const ownerContacts = contacts
      .filter(
        (c) =>
          c.emailStatus === "valid" &&
          c.position &&
          OWNER_TITLE_PATTERN.test(c.position)
      )
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

    const best = ownerContacts[0] ?? contacts.filter((c) => c.emailStatus === "valid")[0];
    if (!best) return null;

    return {
      email: best.email,
      firstName: best.firstName ?? undefined,
      lastName: best.lastName ?? undefined,
      title: best.position ?? undefined,
      confidence: best.confidence ?? 60,
      source: "snov",
    };
  } catch (err) {
    console.error("[EmailEnrichment] Snov.io error:", err);
    return null;
  }
}

// ─── Type definitions ────────────────────────────────────────────────────────

interface HunterEmail {
  value: string;
  confidence: number;
  position?: string;
  first_name?: string;
  last_name?: string;
}

interface HunterDomainSearchResponse {
  data?: { emails: HunterEmail[] };
}

interface SnovEmail {
  email: string;
  emailStatus: string;
  confidence?: number;
  position?: string;
  firstName?: string;
  lastName?: string;
}

interface SnovDomainResponse {
  emails?: SnovEmail[];
}
