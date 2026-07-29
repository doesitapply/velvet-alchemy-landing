/**
 * SMIRK Handoff Service
 *
 * Sends qualified leads to SMIRK's inbound handoff receiver.
 *
 * Endpoint:   POST https://smirkcalls.com/api/integrations/velvet/handoffs
 * Auth:       Authorization: Bearer <SMIRK_API_KEY>
 * Idempotency:
 *   - First POST with a given externalId → 201 { state: "RECEIVED" }
 *   - Exact replay (same payload)        → 200 { state: "DUPLICATE" }
 *   - Changed payload, same externalId   → 409 { state: "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT" }
 *
 * Environment variables required:
 *   SMIRK_BASE_URL       — https://smirkcalls.com
 *   SMIRK_API_KEY        — dedicated Velvet handoff bearer token
 *   SMIRK_WORKSPACE_ID   — numeric workspace ID (e.g. "1")
 *
 * Security model:
 *   - Velvet Alchemy → SMIRK: uses SMIRK_API_KEY (Bearer)
 *   - SMIRK → Velvet Alchemy: uses a VA API key with outcome:write scope
 *     (stored in SMIRK Railway env as VELVET_ALCHEMY_OUTCOME_KEY)
 */

import { getDb } from "../db";
import { leads, audits } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── SMIRK Handoff Payload Contract ──────────────────────────────────────────

export interface SmirkHandoffPayload {
  workspaceId: number;
  /** Stable unique ID for idempotency — use `velvet-<leadId>-<timestamp>` for real, `velvet-manus-fake-*` for tests */
  externalId: string;
  caller: {
    phone: string;       // E.164 format required
    name?: string;
    email?: string;
  };
  companyName?: string;
  /** Why this lead is being handed off — specific signal text */
  reason: string;
  urgency: "low" | "normal" | "high" | "emergency";
  transcriptSnippet?: string;
  recommendedAction?: string;
  notes?: string;
}

export interface SmirkHandoffResponse {
  success: boolean;
  state?: "RECEIVED" | "DUPLICATE" | "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT";
  httpStatus?: number;
  jobId?: string;
  error?: string;
}

// ─── Call Brief (internal — used to build the SMIRK payload) ─────────────────

export interface CallBrief {
  velvetLeadId: number;
  businessName: string;
  phoneNumber: string;
  ownerName: string | null;
  websiteUrl: string;
  signals: string[];
  estimatedMonthlyLoss: number;
  openingLine: string;
  auditSummary: string;
  prestigeScore: number;
  outcomeWebhookUrl: string;
}

// ─── Build Call Brief ─────────────────────────────────────────────────────────

export async function buildCallBrief(leadId: number): Promise<CallBrief | null> {
  const db = await getDb();
  if (!db) return null;

  const leadRows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const lead = leadRows[0];
  if (!lead || !lead.phone) return null;

  const auditRows = await db
    .select()
    .from(audits)
    .where(eq(audits.leadId, leadId))
    .orderBy(desc(audits.createdAt))
    .limit(1);
  const audit = auditRows[0];

  const signals: string[] = [];
  if (lead.reviewCount && lead.reviewCount > 30) {
    signals.push(`${lead.reviewCount} Google reviews (proven demand)`);
  }
  if (lead.googleRating && parseFloat(String(lead.googleRating)) >= 4.2) {
    signals.push(`${lead.googleRating}★ Google rating`);
  }
  if ((audit?.prestigeScore ?? lead.prestigeScore ?? 100) < 60) {
    const score = audit?.prestigeScore ?? lead.prestigeScore;
    signals.push(`Website prestige score ${score}/100 — significant conversion gaps`);
  }
  if (!lead.verifiedOwnerEmail) {
    signals.push("No verified owner email — phone is primary contact channel");
  }
  if (lead.category) {
    signals.push(`Category: ${lead.category}`);
  }

  let estimatedMonthlyLoss = 0;
  if (lead.detailedReport) {
    try {
      const report = JSON.parse(lead.detailedReport);
      estimatedMonthlyLoss = report?.revenue_impact?.monthly_loss ?? 0;
    } catch { /* ignore */ }
  }

  const openingLine = lead.reviewCount && lead.reviewCount > 30
    ? `Hi, I'm calling about ${lead.companyName}. You have ${lead.reviewCount} Google reviews — clearly people love you. I wanted to share something specific about your call handling that I think is costing you jobs. Do you have 90 seconds?`
    : `Hi, I'm calling about ${lead.companyName}. We ran a quick analysis on your business and found something specific about your phone coverage I think is worth 2 minutes of your time.`;

  const baseUrl = process.env.SMIRK_BASE_URL
    ? "https://velvetalchemy.manus.space"
    : "https://velvetalchemy.manus.space";
  const outcomeWebhookUrl = `${baseUrl}/api/v1/leads/${leadId}/outcome`;

  return {
    velvetLeadId: leadId,
    businessName: lead.companyName,
    phoneNumber: lead.phone,
    ownerName: null,
    websiteUrl: lead.websiteUrl,
    signals,
    estimatedMonthlyLoss,
    openingLine,
    auditSummary: audit?.summary ?? "No audit available.",
    prestigeScore: audit?.prestigeScore ?? lead.prestigeScore ?? 0,
    outcomeWebhookUrl,
  };
}

// ─── SMIRK Handoff Dispatcher ─────────────────────────────────────────────────

/**
 * Send a handoff to SMIRK for a given lead.
 *
 * On 201 RECEIVED:   updates lead.status = 'smirk_queued', sets smirkHandoffAt
 * On 200 DUPLICATE:  no-op (already queued), returns success: true
 * On 409 CONFLICT:   returns success: false — caller must resolve the externalId collision
 * On 401:            returns success: false — API key rejected
 * On 404:            returns success: false — endpoint not deployed
 * On any other error: returns success: false
 */
export async function queueSmirkCall(
  leadId: number,
  options?: {
    scheduledAt?: string;
    maxAttempts?: number;
    /** Override externalId — used for synthetic tests */
    externalId?: string;
  }
): Promise<SmirkHandoffResponse> {
  const smirkBaseUrl = process.env.SMIRK_BASE_URL ?? "";
  const smirkApiKey = process.env.SMIRK_API_KEY ?? "";
  const smirkWorkspaceId = process.env.SMIRK_WORKSPACE_ID ?? "";

  if (!smirkBaseUrl || !smirkApiKey || !smirkWorkspaceId) {
    return {
      success: false,
      error: "SMIRK not configured — set SMIRK_BASE_URL, SMIRK_API_KEY, and SMIRK_WORKSPACE_ID",
    };
  }

  const brief = await buildCallBrief(leadId);
  if (!brief) {
    return {
      success: false,
      error: "Lead not found or has no phone number — cannot queue call",
    };
  }

  const externalId = options?.externalId ?? `velvet-${leadId}-${Date.now()}`;
  const urgency: SmirkHandoffPayload["urgency"] =
    brief.prestigeScore < 40 ? "high" :
    brief.prestigeScore < 60 ? "normal" : "low";

  const payload: SmirkHandoffPayload = {
    workspaceId: Number(smirkWorkspaceId),
    externalId,
    caller: {
      phone: brief.phoneNumber,
      ...(brief.ownerName && { name: brief.ownerName }),
    },
    companyName: brief.businessName,
    reason: brief.signals.join("; ") || "Qualified lead from Velvet Alchemy hunt engine",
    urgency,
    transcriptSnippet: brief.openingLine,
    recommendedAction: "Schedule a demo call for SMIRK AI phone agent",
    notes: `Audit summary: ${brief.auditSummary.slice(0, 300)}. Outcome webhook: ${brief.outcomeWebhookUrl}`,
  };

  try {
    const response = await fetch(`${smirkBaseUrl}/api/integrations/velvet/handoffs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${smirkApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const httpStatus = response.status;
    let body: any = {};
    try { body = await response.json(); } catch { /* non-JSON body */ }

    // 201 = new handoff received
    if (httpStatus === 201 && body?.state === "RECEIVED") {
      const db = await getDb();
      if (db) {
        await db.update(leads).set({
          status: "smirk_queued",
          smirkHandoffAt: new Date(),
          smirkWorkspaceId: String(smirkWorkspaceId),
          updatedAt: new Date(),
        }).where(eq(leads.id, leadId));
      }
      return { success: true, state: "RECEIVED", httpStatus, jobId: body?.id };
    }

    // 200 = exact duplicate — already queued, treat as success
    if (httpStatus === 200 && body?.state === "DUPLICATE") {
      return { success: true, state: "DUPLICATE", httpStatus };
    }

    // 409 = idempotency conflict — same externalId, different payload
    if (httpStatus === 409) {
      return {
        success: false,
        state: "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT",
        httpStatus,
        error: "Idempotency conflict: externalId already used with a different payload",
      };
    }

    // 401 = key rejected
    if (httpStatus === 401) {
      return { success: false, httpStatus, error: "SMIRK rejected the API key (401)" };
    }

    // 404 = endpoint not deployed
    if (httpStatus === 404) {
      return { success: false, httpStatus, error: "SMIRK handoff endpoint not found (404) — check deployment" };
    }

    return {
      success: false,
      httpStatus,
      error: `SMIRK returned unexpected status ${httpStatus}: ${JSON.stringify(body).slice(0, 200)}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Unknown network error" };
  }
}

// ─── Synthetic Test Handoff ───────────────────────────────────────────────────

/**
 * Send a harmless synthetic handoff to SMIRK using a fake phone number.
 * Used for cross-system proof without touching real prospects.
 *
 * Phone: +12025550124 (non-routable test number)
 * externalId prefix: velvet-manus-fake-
 */
export async function sendSyntheticTestHandoff(suffix: string): Promise<SmirkHandoffResponse> {
  const smirkBaseUrl = process.env.SMIRK_BASE_URL ?? "";
  const smirkApiKey = process.env.SMIRK_API_KEY ?? "";
  const smirkWorkspaceId = process.env.SMIRK_WORKSPACE_ID ?? "";

  if (!smirkBaseUrl || !smirkApiKey || !smirkWorkspaceId) {
    return { success: false, error: "SMIRK not configured" };
  }

  const externalId = `velvet-manus-fake-${suffix}`;
  const payload: SmirkHandoffPayload = {
    workspaceId: Number(smirkWorkspaceId),
    externalId,
    caller: {
      phone: "+12025550124",
      name: "Velvet Alchemy Synthetic Test",
    },
    companyName: "Velvet Alchemy Test Co",
    reason: "Synthetic cross-system proof — not a real prospect",
    urgency: "low",
    transcriptSnippet: "This is a synthetic test handoff from Velvet Alchemy.",
    recommendedAction: "No action required — synthetic test",
    notes: "Generated by sendSyntheticTestHandoff() for integration verification only.",
  };

  try {
    const response = await fetch(`${smirkBaseUrl}/api/integrations/velvet/handoffs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${smirkApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const httpStatus = response.status;
    let body: any = {};
    try { body = await response.json(); } catch { /* non-JSON body */ }

    if (httpStatus === 201 && body?.state === "RECEIVED") {
      return { success: true, state: "RECEIVED", httpStatus, jobId: body?.id };
    }
    if (httpStatus === 200 && body?.state === "DUPLICATE") {
      return { success: true, state: "DUPLICATE", httpStatus };
    }
    if (httpStatus === 409) {
      return { success: false, state: "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT", httpStatus,
        error: "Idempotency conflict on synthetic test" };
    }

    return {
      success: false,
      httpStatus,
      error: `Unexpected ${httpStatus}: ${JSON.stringify(body).slice(0, 200)}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Network error" };
  }
}
