import { and, eq, isNull, or } from "drizzle-orm";
import { audits, leads, smirkDiscoveryLeadItems } from "../../drizzle/schema";
import {
  makeRequest,
  type PlaceDetailsResult,
  type PlacesSearchResult,
} from "../_core/map";
import { getDb } from "../db";
import {
  findVerifiedOwnerEmail,
  ownerContactMatchesRequestedDomain,
  type EnrichedContact,
} from "./emailEnrichment";
import {
  hashSmirkDiscoveryValue,
  nextSmirkDiscoveryProviderRequestCounts,
  type SmirkDiscoveryProviderRequestCounts,
} from "./smirkDiscovery";
import {
  completeSmirkDiscovery,
  type ClaimedSmirkDiscovery,
} from "./smirkDiscoveryStore";

const AGGREGATOR_DOMAINS = [
  "yelp.com",
  "yellowpages.com",
  "facebook.com",
  "google.com",
  "angi.com",
  "angieslist.com",
  "houzz.com",
  "thumbtack.com",
  "homeadvisor.com",
  "bbb.org",
  "manta.com",
  "mapquest.com",
  "nextdoor.com",
];

const CHAIN_SIGNALS = [
  "home depot",
  "lowe's",
  "walmart",
  "costco",
  "aspen dental",
  "one hour heating",
  "mr. rooter",
  "roto-rooter",
];

type DiscoveryDetail = PlaceDetailsResult["result"] & {
  sourcePlaceId: string;
};

type PersistResult = {
  state: "READY" | "SKIPPED";
  leadId: number | null;
  newlyCreated: boolean;
  reason?: string;
};

export type SmirkDiscoveryExecutorDeps = {
  requestMaps?: typeof makeRequest;
  findOwnerEmail?: typeof findVerifiedOwnerEmail;
};

function normalizeWebsite(raw: string): string {
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Business website must use HTTP or HTTPS.");
  }
  parsed.hash = "";
  parsed.search = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.toString();
}

function normalizedPhone(raw: string | null | undefined): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function evaluateSmirkDiscoveryDetail(detail: DiscoveryDetail):
  | {
      accepted: true;
      website: string;
      phone: string;
      reviewCount: number;
    }
  | { accepted: false; reason: string } {
  const name = String(detail.name || "").trim();
  if (name.length < 2) {
    return { accepted: false, reason: "missing_business_name" };
  }
  let website: string;
  try {
    website = normalizeWebsite(String(detail.website || ""));
  } catch {
    return { accepted: false, reason: "invalid_or_missing_website" };
  }
  const hostname = new URL(website).hostname.toLowerCase();
  if (AGGREGATOR_DOMAINS.some(domain => hostname.endsWith(domain))) {
    return { accepted: false, reason: "aggregator_or_directory" };
  }
  const normalizedName = name.toLowerCase();
  if (CHAIN_SIGNALS.some(signal => normalizedName.includes(signal))) {
    return { accepted: false, reason: "known_chain_signal" };
  }
  if (detail.business_status && detail.business_status !== "OPERATIONAL") {
    return { accepted: false, reason: "business_not_operational" };
  }
  const reviewCount = Number(detail.user_ratings_total || 0);
  if (
    !Number.isSafeInteger(reviewCount) ||
    reviewCount < 3 ||
    reviewCount > 2_000
  ) {
    return { accepted: false, reason: "review_count_outside_bounds" };
  }
  const phone = normalizedPhone(detail.formatted_phone_number);
  if (!phone) {
    return {
      accepted: false,
      reason: "no_operator_review_phone",
    };
  }
  return { accepted: true, website, phone, reviewCount };
}

async function persistDiscoveryItem(input: {
  claim: ClaimedSmirkDiscovery;
  detail: DiscoveryDetail;
}): Promise<PersistResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while storing discovery.");
  const sourcePayloadHash = hashSmirkDiscoveryValue(input.detail);
  return db.transaction(async tx => {
    const existingItems = await tx
      .select({
        state: smirkDiscoveryLeadItems.state,
        leadId: smirkDiscoveryLeadItems.leadId,
        error: smirkDiscoveryLeadItems.error,
        sourcePayloadHash: smirkDiscoveryLeadItems.sourcePayloadHash,
      })
      .from(smirkDiscoveryLeadItems)
      .where(
        and(
          eq(smirkDiscoveryLeadItems.discoveryId, input.claim.discoveryId),
          eq(smirkDiscoveryLeadItems.sourcePlaceId, input.detail.sourcePlaceId)
        )
      )
      .limit(1);
    const existingItem = existingItems[0];
    if (existingItem) {
      if (existingItem.sourcePayloadHash !== sourcePayloadHash) {
        throw new Error(
          "A discovery place ID was replayed with changed source data."
        );
      }
      return {
        state: existingItem.state === "READY" ? "READY" : "SKIPPED",
        leadId: existingItem.leadId,
        newlyCreated: false,
        reason: existingItem.error || undefined,
      };
    }

    const policy = evaluateSmirkDiscoveryDetail(input.detail);
    if (!policy.accepted) {
      await tx.insert(smirkDiscoveryLeadItems).values({
        discoveryId: input.claim.discoveryId,
        userId: input.claim.userId,
        sourcePlaceId: input.detail.sourcePlaceId,
        state: "SKIPPED",
        sourcePayloadHash,
        error: policy.reason,
      });
      return {
        state: "SKIPPED",
        leadId: null,
        newlyCreated: false,
        reason: policy.reason,
      };
    }

    const existingLeads = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.userId, input.claim.userId),
          or(
            eq(leads.googlePlaceId, input.detail.sourcePlaceId),
            eq(leads.websiteUrl, policy.website)
          )
        )
      )
      .limit(1);
    if (existingLeads[0]) {
      await tx.insert(smirkDiscoveryLeadItems).values({
        discoveryId: input.claim.discoveryId,
        userId: input.claim.userId,
        sourcePlaceId: input.detail.sourcePlaceId,
        leadId: existingLeads[0].id,
        state: "SKIPPED",
        sourcePayloadHash,
        error: "owner_scoped_duplicate",
      });
      return {
        state: "SKIPPED",
        leadId: existingLeads[0].id,
        newlyCreated: false,
        reason: "owner_scoped_duplicate",
      };
    }

    const reviewSnippets = (input.detail.reviews || [])
      .slice(0, 3)
      .map(review =>
        String(review.text || "")
          .trim()
          .slice(0, 200)
      )
      .filter(Boolean);
    const insertedLead = await tx
      .insert(leads)
      .values({
        userId: input.claim.userId,
        companyName: String(input.detail.name).trim().slice(0, 255),
        websiteUrl: policy.website,
        status: "pending",
        outreachChannel: "none",
        phone: policy.phone,
        address:
          String(input.detail.formatted_address || "")
            .trim()
            .slice(0, 512) || null,
        city: input.claim.effectiveCriteria.city,
        state: input.claim.effectiveCriteria.state,
        googleRating: Number.isFinite(Number(input.detail.rating))
          ? String(input.detail.rating)
          : null,
        reviewCount: policy.reviewCount,
        reviewSnippets:
          reviewSnippets.length > 0 ? JSON.stringify(reviewSnippets) : null,
        googlePlaceId: input.detail.sourcePlaceId,
        businessStatus: input.detail.business_status || "OPERATIONAL",
        category: input.claim.effectiveCriteria.category,
      })
      .$returningId();
    const leadId = Number(insertedLead[0]?.id || 0);
    if (!leadId) {
      throw new Error("The discovered lead was not persisted.");
    }

    const auditPayload = {
      report_version: "velvet.public-source-review.v1",
      basis: "observed",
      sources: ["public_website", "google_maps_listing"],
      websitePerformanceMeasured: false,
      conversionImpactMeasured: false,
      revenueImpactMeasured: false,
      contactActionAllowed: false,
    };
    const insertedAudit = await tx
      .insert(audits)
      .values({
        leadId,
        summary:
          "Public website and Google Maps listing recorded for operator review. No website performance, conversion impact, customer loss, or revenue impact was measured.",
        prestigeScore: null,
        visualDebtData: JSON.stringify(auditPayload),
      })
      .$returningId();
    if (!insertedAudit[0]?.id) {
      throw new Error("The public-source review was not persisted.");
    }

    const updatedLead = await tx
      .update(leads)
      .set({ status: "audited" })
      .where(
        and(
          eq(leads.id, leadId),
          eq(leads.userId, input.claim.userId),
          eq(leads.status, "pending")
        )
      );
    if (Number(updatedLead[0]?.affectedRows ?? 0) !== 1) {
      throw new Error("The discovered lead was not marked review-ready.");
    }
    const insertedItem = await tx
      .insert(smirkDiscoveryLeadItems)
      .values({
        discoveryId: input.claim.discoveryId,
        userId: input.claim.userId,
        sourcePlaceId: input.detail.sourcePlaceId,
        leadId,
        state: "READY",
        sourcePayloadHash,
      })
      .$returningId();
    if (!insertedItem[0]?.id) {
      throw new Error("The discovery lead receipt was not persisted.");
    }
    return { state: "READY" as const, leadId, newlyCreated: true };
  });
}

async function persistVerifiedDiscoveryOwnerEmail(input: {
  claim: ClaimedSmirkDiscovery;
  leadId: number;
  website: string;
  contact: EnrichedContact;
}): Promise<void> {
  const requestedDomain = new URL(input.website).hostname.replace(
    /^www\./i,
    ""
  );
  if (
    input.contact.source !== "hunter" ||
    input.contact.confidence < 70 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact.email) ||
    !ownerContactMatchesRequestedDomain(input.contact, requestedDomain)
  ) {
    throw new Error("The owner-email result lacks verified Hunter provenance.");
  }
  const db = await getDb();
  if (!db) {
    throw new Error("Database unavailable while storing verified owner email.");
  }
  await db.transaction(async tx => {
    const updated = await tx
      .update(leads)
      .set({
        verifiedOwnerEmail: input.contact.email,
        outreachChannel: "email",
      })
      .where(
        and(
          eq(leads.id, input.leadId),
          eq(leads.userId, input.claim.userId),
          eq(leads.status, "audited"),
          eq(leads.outreachChannel, "none"),
          isNull(leads.verifiedOwnerEmail)
        )
      );
    if (Number(updated[0]?.affectedRows ?? 0) !== 1) {
      throw new Error(
        "The verified owner email did not match one newly discovered lead."
      );
    }
    const verified = await tx
      .select({
        email: leads.verifiedOwnerEmail,
        outreachChannel: leads.outreachChannel,
      })
      .from(leads)
      .where(
        and(eq(leads.id, input.leadId), eq(leads.userId, input.claim.userId))
      )
      .limit(1);
    if (
      verified[0]?.email !== input.contact.email ||
      verified[0]?.outreachChannel !== "email"
    ) {
      throw new Error("The verified owner email was not durably stored.");
    }
  });
}

export async function executeClaimedSmirkDiscovery(
  claim: ClaimedSmirkDiscovery,
  deps: SmirkDiscoveryExecutorDeps = {}
): Promise<void> {
  const requestMaps = deps.requestMaps || makeRequest;
  const findOwnerEmail = deps.findOwnerEmail || findVerifiedOwnerEmail;
  let providerRequestCounts: SmirkDiscoveryProviderRequestCounts = {
    maps: 0,
    ownerEmailEnrichment: 0,
  };
  let createdLeadCount = 0;
  let readyLeadCount = 0;
  let verifiedOwnerEmailCount = 0;
  let skippedLeadCount = 0;
  let failedLeadCount = 0;
  const leadIds: number[] = [];
  const errors: string[] = [];
  try {
    providerRequestCounts = nextSmirkDiscoveryProviderRequestCounts({
      quote: claim.quote,
      approvedMaxSpendCents: claim.approvedMaxSpendCents,
      provider: "maps",
      current: providerRequestCounts,
    });
    const query = `${claim.effectiveCriteria.category} in ${claim.effectiveCriteria.city}, ${claim.effectiveCriteria.state}`;
    const search = await requestMaps<PlacesSearchResult>(
      "/maps/api/place/textsearch/json",
      { query },
      {
        userId: claim.userId,
        operation: "smirk_discovery_text_search",
        expectedCostCentsPerRequest:
          claim.quote.providers.maps.costCentsPerRequest,
      }
    );
    if (search.status !== "OK" || !Array.isArray(search.results)) {
      throw new Error(
        `Maps discovery returned a non-OK status: ${String(search.status)}.`
      );
    }

    const places = search.results.slice(0, claim.effectiveCriteria.limit);
    for (const place of places) {
      providerRequestCounts = nextSmirkDiscoveryProviderRequestCounts({
        quote: claim.quote,
        approvedMaxSpendCents: claim.approvedMaxSpendCents,
        provider: "maps",
        current: providerRequestCounts,
      });
      let details: PlaceDetailsResult;
      try {
        details = await requestMaps<PlaceDetailsResult>(
          "/maps/api/place/details/json",
          {
            place_id: place.place_id,
            fields:
              "name,website,formatted_address,formatted_phone_number,rating,user_ratings_total,business_status,reviews",
          },
          {
            userId: claim.userId,
            operation: "smirk_discovery_place_details",
            expectedCostCentsPerRequest:
              claim.quote.providers.maps.costCentsPerRequest,
          }
        );
      } catch (error) {
        failedLeadCount += 1;
        errors.push(
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Maps detail request failed."
        );
        break;
      }
      if (!details.result) {
        skippedLeadCount += 1;
        continue;
      }
      try {
        const persisted = await persistDiscoveryItem({
          claim,
          detail: {
            ...details.result,
            sourcePlaceId: place.place_id,
          },
        });
        if (persisted.state === "READY" && persisted.leadId) {
          createdLeadCount += 1;
          readyLeadCount += 1;
          leadIds.push(persisted.leadId);
          if (persisted.newlyCreated) {
            providerRequestCounts = nextSmirkDiscoveryProviderRequestCounts({
              quote: claim.quote,
              approvedMaxSpendCents: claim.approvedMaxSpendCents,
              provider: "ownerEmailEnrichment",
              current: providerRequestCounts,
            });
            try {
              const contact = await findOwnerEmail(
                String(details.result.website || ""),
                {
                  userId: claim.userId,
                  leadId: persisted.leadId,
                  approvedCostCentsPerCredit:
                    claim.quote.providers.ownerEmailEnrichment
                      .costCentsPerRequest,
                }
              );
              if (contact) {
                await persistVerifiedDiscoveryOwnerEmail({
                  claim,
                  leadId: persisted.leadId,
                  website: String(details.result.website || ""),
                  contact,
                });
                verifiedOwnerEmailCount += 1;
              }
            } catch (error) {
              failedLeadCount += 1;
              errors.push(
                error instanceof Error
                  ? error.message.slice(0, 500)
                  : "Owner-email enrichment failed."
              );
              break;
            }
          }
        } else {
          skippedLeadCount += 1;
        }
      } catch (error) {
        failedLeadCount += 1;
        errors.push(
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Lead persistence failed."
        );
        break;
      }
    }

    const state =
      failedLeadCount > 0
        ? readyLeadCount > 0
          ? "PARTIAL"
          : "FAILED"
        : readyLeadCount > 0
          ? "COMPLETED"
          : "EMPTY";
    const providerRequests =
      providerRequestCounts.maps + providerRequestCounts.ownerEmailEnrichment;
    await completeSmirkDiscovery({
      discoveryId: claim.discoveryId,
      userId: claim.userId,
      executionToken: claim.executionToken,
      state,
      providerRequests,
      createdLeadCount,
      readyLeadCount,
      skippedLeadCount,
      failedLeadCount,
      result: {
        contractVersion: "velvet-smirk.discovery-result.v2",
        requestId: claim.requestId,
        state,
        leadIds,
        counts: {
          providerRequests,
          providerRequestCounts,
          createdLeadCount,
          readyLeadCount,
          verifiedOwnerEmailCount,
          skippedLeadCount,
          failedLeadCount,
        },
        errors,
        contactActionAllowed: false,
        externalAction: "research_records_created_only",
      },
      error: errors[0] || null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 2_000)
        : "Discovery execution failed.";
    const providerRequests =
      providerRequestCounts.maps + providerRequestCounts.ownerEmailEnrichment;
    await completeSmirkDiscovery({
      discoveryId: claim.discoveryId,
      userId: claim.userId,
      executionToken: claim.executionToken,
      state: readyLeadCount > 0 ? "PARTIAL" : "FAILED",
      providerRequests,
      createdLeadCount,
      readyLeadCount,
      skippedLeadCount,
      failedLeadCount: Math.max(1, failedLeadCount),
      result: {
        contractVersion: "velvet-smirk.discovery-result.v2",
        requestId: claim.requestId,
        state: readyLeadCount > 0 ? "PARTIAL" : "FAILED",
        leadIds,
        counts: {
          providerRequests,
          providerRequestCounts,
          createdLeadCount,
          readyLeadCount,
          verifiedOwnerEmailCount,
          skippedLeadCount,
          failedLeadCount: Math.max(1, failedLeadCount),
        },
        errors: [...errors, message],
        contactActionAllowed: false,
        externalAction: "research_records_created_only",
      },
      error: message,
    });
  }
}
