import { createHash } from "node:crypto";
import type { Audit, Lead } from "../../drizzle/schema";
import { z } from "zod";

const SMIRK_PRODUCTION_ORIGIN = "https://smirkcalls.com";
export const SMIRK_RESEARCH_CONTRACT_VERSION =
  "velvet-smirk.prospect.v1" as const;
const MINIMUM_API_KEY_LENGTH = 32;
const MAX_RESPONSE_BYTES = 64 * 1024;
const E164_PHONE = /^\+[1-9]\d{7,14}$/;
const EXTERNAL_ID = /^[A-Za-z0-9:_-]+$/;

export const smirkResearchPayloadSchema = z
  .object({
    contractVersion: z.literal(SMIRK_RESEARCH_CONTRACT_VERSION),
    workspaceId: z.number().int().positive(),
    externalId: z.string().min(12).max(160).regex(EXTERNAL_ID),
    batch: z
      .object({
        externalId: z.string().min(8).max(160).regex(EXTERNAL_ID),
        name: z.string().min(2).max(160),
        targetIndustry: z.string().min(2).max(120).optional(),
        targetLocation: z.string().min(2).max(160).optional(),
      })
      .strict(),
    prospect: z
      .object({
        companyName: z.string().min(2).max(240),
        phone: z.string().regex(E164_PHONE).optional(),
        phoneContactMode: z.literal("operator_review_only").optional(),
        email: z.string().email().max(320).optional(),
        emailVerification: z.literal("verified_owner_email").optional(),
        website: z.string().url().max(2_000),
        industry: z.string().min(2).max(120).optional(),
        address: z.string().min(2).max(500).optional(),
        city: z.string().min(1).max(120).optional(),
        state: z.string().min(2).max(80).optional(),
        evidence: z
          .array(
            z
              .object({
                url: z.string().url().max(2_000),
                observation: z.string().min(1).max(1_000),
                observedAt: z.string().datetime({ offset: true }),
                kind: z.enum([
                  "website",
                  "contact_path",
                  "visual_usability",
                  "performance",
                  "public_reputation",
                  "other",
                ]),
                basis: z.enum(["observed", "measured", "inferred"]),
                confidence: z.enum(["high", "medium", "low"]),
              })
              .strict()
          )
          .min(1)
          .max(10),
        notes: z.string().min(1).max(2_000),
      })
      .strict()
      .superRefine((prospect, ctx) => {
        if (
          Boolean(prospect.email) !==
          (prospect.emailVerification === "verified_owner_email")
        ) {
          ctx.addIssue({
            code: "custom",
            message:
              "A research email must be paired with verified_owner_email provenance.",
          });
        }
        if (
          Boolean(prospect.phone) !==
          (prospect.phoneContactMode === "operator_review_only")
        ) {
          ctx.addIssue({
            code: "custom",
            message:
              "A research phone must remain operator_review_only.",
          });
        }
      }),
  })
  .strict();

export type SmirkResearchPayload = z.infer<typeof smirkResearchPayloadSchema>;

export type SmirkResearchConfig = {
  baseUrl: string;
  apiKey: string;
  workspaceId: number | null;
  configured: boolean;
  missing: string[];
};

export type SmirkResearchResult = {
  success: boolean;
  state?: "IMPORTED" | "DUPLICATE";
  httpStatus?: number;
  campaignId?: number;
  prospectId?: number;
  externalAction?: "none";
  code?: string;
  error?: string;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

function publicWebsiteUrl(raw: string): string {
  const parsed = new URL(raw);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Lead website must use HTTP or HTTPS.");
  }
  parsed.hash = "";
  return parsed.toString();
}

function optionalText(raw: string | null | undefined, maxLength: number) {
  const value = String(raw || "").trim();
  return value ? value.slice(0, maxLength) : undefined;
}

function optionalEmail(raw: string | null | undefined): string | undefined {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (
    !value ||
    value.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) {
    return undefined;
  }
  return value;
}

export function normalizeResearchPhone(
  raw: string | null | undefined
): string | undefined {
  const value = String(raw || "").trim();
  if (E164_PHONE.test(value)) return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return undefined;
}

type SmirkResearchLead = Pick<
  Lead,
  | "id"
  | "userId"
  | "companyName"
  | "websiteUrl"
  | "phone"
  | "verifiedOwnerEmail"
  | "category"
  | "address"
  | "city"
  | "state"
  | "screenshotUrl"
  | "googleRating"
  | "reviewCount"
  | "googlePlaceId"
  | "updatedAt"
>;

type SmirkResearchAudit = Pick<
  Audit,
  "summary" | "visualDebtData" | "updatedAt"
>;

type ResearchEvidence = SmirkResearchPayload["prospect"]["evidence"][number];

export type SmirkResearchBatchOverride = {
  externalId: string;
  name: string;
  targetIndustry?: string;
  targetLocation?: string;
};

const unsupportedOutcomeClaim =
  /\b(lost|losing|costing|revenue|income|profit|customers?|jobs?|leads?|conversions?|ranking|rankings|page speed|load time|mobile[- ]friendly|responsive)\b/i;

function safeVisualObservation(raw: unknown): string | undefined {
  const value = String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value || unsupportedOutcomeClaim.test(value)) return undefined;
  return value.slice(0, 850);
}

function toObservedAt(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("Research evidence requires a valid observation time.");
  }
  return parsed.toISOString();
}

function googleMapsPlaceUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

export function buildResearchEvidence(
  lead: SmirkResearchLead,
  audit?: SmirkResearchAudit | null
): ResearchEvidence[] {
  const website = publicWebsiteUrl(lead.websiteUrl);
  const leadObservedAt = toObservedAt(lead.updatedAt);
  const evidence: ResearchEvidence[] = [
    {
      url: website,
      observation: `Public business website recorded for operator review: ${lead.companyName.trim().slice(0, 200)}.`,
      observedAt: leadObservedAt,
      kind: "website",
      basis: "observed",
      confidence: "high",
    },
    {
      url: website,
      observation:
        new URL(website).protocol === "https:"
          ? "The recorded public website URL uses HTTPS."
          : "The recorded public website URL uses HTTP. Certificate behavior was not independently tested.",
      observedAt: leadObservedAt,
      kind: "website",
      basis: "observed",
      confidence: "high",
    },
  ];

  if (lead.googlePlaceId) {
    const rating = Number(lead.googleRating);
    const reviewCount = Number(lead.reviewCount);
    if (
      Number.isFinite(rating) &&
      rating >= 0 &&
      rating <= 5 &&
      Number.isSafeInteger(reviewCount) &&
      reviewCount >= 0
    ) {
      evidence.push({
        url: googleMapsPlaceUrl(lead.googlePlaceId),
        observation: `The stored Google Maps record reported a ${rating.toFixed(1)} rating from ${reviewCount} reviews.`,
        observedAt: leadObservedAt,
        kind: "public_reputation",
        basis: "observed",
        confidence: "high",
      });
    }
  }

  if (audit && lead.screenshotUrl) {
    const auditObservedAt = toObservedAt(audit.updatedAt);
    const observations: string[] = [];
    const summary = safeVisualObservation(audit.summary);
    if (summary) observations.push(summary);
    try {
      const parsed = JSON.parse(audit.visualDebtData || "{}");
      if (Array.isArray(parsed.visualDebt)) {
        for (const item of parsed.visualDebt) {
          const observation = safeVisualObservation(item?.issue);
          if (observation) observations.push(observation);
        }
      }
    } catch {
      // A malformed legacy audit is omitted rather than promoted as evidence.
    }
    for (const observation of Array.from(new Set(observations)).slice(0, 5)) {
      evidence.push({
        url: publicWebsiteUrl(lead.screenshotUrl),
        observation: `Screenshot review inference: ${observation}`,
        observedAt: auditObservedAt,
        kind: "visual_usability",
        basis: "inferred",
        confidence: "medium",
      });
    }
  }

  return evidence.slice(0, 10);
}

export function buildSmirkResearchPayload(
  lead: SmirkResearchLead,
  workspaceId: number,
  audit?: SmirkResearchAudit | null,
  batchOverride?: SmirkResearchBatchOverride
): SmirkResearchPayload {
  if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0) {
    throw new Error("SMIRK research workspace must be a positive integer.");
  }
  const website = publicWebsiteUrl(lead.websiteUrl);
  const targetLocation = [lead.city, lead.state].filter(Boolean).join(", ");
  const phone = normalizeResearchPhone(lead.phone);
  const email = optionalEmail(lead.verifiedOwnerEmail);

  return {
    contractVersion: SMIRK_RESEARCH_CONTRACT_VERSION,
    workspaceId,
    externalId: `velvet-owner-${lead.userId}-lead-${lead.id}`,
    batch: {
      externalId:
        batchOverride?.externalId ||
        `velvet-owner-${lead.userId}-smirk-research`,
      name: batchOverride?.name || "Velvet Alchemy Research Review",
      targetIndustry: optionalText(
        batchOverride?.targetIndustry || lead.category,
        120
      ),
      targetLocation: optionalText(
        batchOverride?.targetLocation || targetLocation,
        160
      ),
    },
    prospect: {
      companyName: lead.companyName.trim().slice(0, 240),
      phone,
      phoneContactMode: phone ? "operator_review_only" : undefined,
      email,
      emailVerification: email ? "verified_owner_email" : undefined,
      website,
      industry: optionalText(lead.category, 120),
      address: optionalText(lead.address, 500),
      city: optionalText(lead.city, 120),
      state: optionalText(lead.state, 80),
      evidence: buildResearchEvidence(lead, audit),
      notes:
        "Research-only import from Velvet Alchemy using versioned, source-classified evidence. No outreach, SMS, call, handoff, or callback task is authorized.",
    },
  };
}

export function buildSmirkResearchPayloadHash(
  payload: SmirkResearchPayload
): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function readSmirkResearchConfig(
  env: Record<string, string | undefined> = process.env
): SmirkResearchConfig {
  const rawBaseUrl = String(env.SMIRK_BASE_URL || "").trim();
  const apiKey = String(env.SMIRK_RESEARCH_API_KEY || "").trim();
  const legacyHandoffKey = String(env.SMIRK_API_KEY || "").trim();
  const rawWorkspaceId = String(env.SMIRK_RESEARCH_WORKSPACE_ID || "").trim();
  const workspaceId = Number(rawWorkspaceId);
  const validWorkspaceId =
    Number.isSafeInteger(workspaceId) && workspaceId > 0 ? workspaceId : null;
  const missing: string[] = [];
  let baseUrl = "";

  try {
    const parsed = new URL(rawBaseUrl);
    if (
      parsed.origin !== SMIRK_PRODUCTION_ORIGIN ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("Unexpected SMIRK origin.");
    }
    baseUrl = parsed.origin;
  } catch {
    missing.push("SMIRK_BASE_URL");
  }
  if (
    apiKey.length < MINIMUM_API_KEY_LENGTH ||
    (legacyHandoffKey && apiKey === legacyHandoffKey)
  ) {
    missing.push("SMIRK_RESEARCH_API_KEY");
  }
  if (!validWorkspaceId) missing.push("SMIRK_RESEARCH_WORKSPACE_ID");

  return {
    baseUrl,
    apiKey,
    workspaceId: validWorkspaceId,
    configured: missing.length === 0,
    missing,
  };
}

function positiveInteger(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : undefined;
}

export function parseSmirkResearchResponse(
  httpStatus: number,
  rawBody: unknown
): SmirkResearchResult {
  const body =
    rawBody && typeof rawBody === "object"
      ? (rawBody as Record<string, unknown>)
      : {};
  const expectedState =
    httpStatus === 201 ? "IMPORTED" : httpStatus === 200 ? "DUPLICATE" : null;

  if (
    expectedState &&
    body.ok === true &&
    body.state === expectedState &&
    body.externalAction === "none"
  ) {
    const campaignId = positiveInteger(body.campaignId);
    const prospectId = positiveInteger(body.prospectId);
    if (!campaignId || !prospectId) {
      return {
        success: false,
        httpStatus,
        error:
          "SMIRK acknowledged the research import without valid persisted record identifiers.",
      };
    }
    return {
      success: true,
      state: expectedState,
      httpStatus,
      campaignId,
      prospectId,
      externalAction: "none",
    };
  }

  return {
    success: false,
    httpStatus,
    code: typeof body.code === "string" ? body.code : undefined,
    error:
      typeof body.error === "string"
        ? body.error
        : `Unexpected SMIRK research response (${httpStatus}).`,
  };
}

async function readBoundedResponse(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error("SMIRK research response exceeded the safe size limit.");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("SMIRK research response exceeded the safe size limit.");
    }
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

export async function sendSmirkResearchProspect(
  payload: SmirkResearchPayload,
  config: SmirkResearchConfig,
  fetchImpl: FetchLike = fetch
): Promise<SmirkResearchResult> {
  if (
    !config.configured ||
    !config.workspaceId ||
    config.baseUrl !== SMIRK_PRODUCTION_ORIGIN ||
    config.apiKey.length < MINIMUM_API_KEY_LENGTH
  ) {
    return {
      success: false,
      code: "SMIRK_RESEARCH_NOT_CONFIGURED",
      error: `SMIRK research integration is not configured: ${config.missing.join(", ")}`,
    };
  }
  if (payload.workspaceId !== config.workspaceId) {
    return {
      success: false,
      code: "SMIRK_RESEARCH_WORKSPACE_MISMATCH",
      error:
        "The research payload does not match the configured SMIRK workspace.",
    };
  }
  const parsedPayload = smirkResearchPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return {
      success: false,
      code: "SMIRK_RESEARCH_INVALID_PAYLOAD",
      error: "The research payload failed local validation.",
    };
  }

  try {
    const response = await fetchImpl(
      `${config.baseUrl}/api/integrations/velvet/prospects`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(parsedPayload.data),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );
    const responseText = await readBoundedResponse(response);
    let responseBody: unknown = {};
    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch {
      return {
        success: false,
        httpStatus: response.status,
        error: "SMIRK research response was not valid JSON.",
      };
    }
    return parseSmirkResearchResponse(response.status, responseBody);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "SMIRK research request failed.",
    };
  }
}
