/**
 * SMIRK Handoff Service
 *
 * Provides a synthetic-only client for SMIRK's inbound handoff receiver.
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
 * The deployed receiver requires a call-shaped `caller` object. It is not a
 * prospect registration or outbound dialing API, so real leads are blocked.
 */

import { getDb } from "../db";
import { leads, audits } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { externalActionBlock } from "./externalActionPolicy";

// ─── SMIRK Handoff Payload Contract ──────────────────────────────────────────

export interface SmirkHandoffPayload {
  workspaceId: number;
  /** Stable synthetic test ID. Real lead handoffs are disabled. */
  externalId: string;
  caller: {
    phone: string; // E.164 format required
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
  handoffId?: number;
  taskId?: number | null;
  code?: string;
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
  internalScenarioMonthlyValue: number;
  openingLine: string;
  auditSummary: string;
  prestigeScore: number;
}

// ─── Build Call Brief ─────────────────────────────────────────────────────────

export async function buildCallBrief(
  leadId: number
): Promise<CallBrief | null> {
  const db = await getDb();
  if (!db) return null;

  const leadRows = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
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
    signals.push(`${lead.reviewCount} public reviews`);
  }
  if (lead.googleRating && parseFloat(String(lead.googleRating)) >= 4.2) {
    signals.push(`${lead.googleRating} public rating`);
  }
  if ((audit?.prestigeScore ?? lead.prestigeScore ?? 100) < 60) {
    const score = audit?.prestigeScore ?? lead.prestigeScore;
    signals.push(`Internal website review score: ${score}/100`);
  }
  if (lead.category) {
    signals.push(`Category: ${lead.category}`);
  }

  let internalScenarioMonthlyValue = 0;
  if (lead.detailedReport) {
    try {
      const report = JSON.parse(lead.detailedReport);
      internalScenarioMonthlyValue = report?.revenue_impact?.monthly_loss ?? 0;
    } catch {
      /* ignore */
    }
  }

  const openingLine = `I noticed a possible mobile booking issue on ${lead.companyName}'s public website that may be creating friction. This is a limited observation, not evidence of lost jobs or revenue.`;
  return {
    velvetLeadId: leadId,
    businessName: lead.companyName,
    phoneNumber: lead.phone,
    ownerName: null,
    websiteUrl: lead.websiteUrl,
    signals,
    internalScenarioMonthlyValue,
    openingLine,
    auditSummary: audit?.summary ?? "No audit available.",
    prestigeScore: audit?.prestigeScore ?? lead.prestigeScore ?? 0,
  };
}

// ─── SMIRK Handoff Dispatcher ─────────────────────────────────────────────────

/**
 * Real prospect handoffs are blocked until SMIRK has a prospect-specific intake
 * endpoint and Velvet has a durable, single-use contact approval. The existing
 * SMIRK handoff endpoint records a call-shaped artifact; it does not authorize
 * or place an outbound call.
 */
export async function queueSmirkCall(
  _leadId: number,
  _options?: {
    scheduledAt?: string;
    maxAttempts?: number;
    externalId?: string;
  }
): Promise<SmirkHandoffResponse> {
  const block = externalActionBlock("prospect_handoff");
  return {
    success: false,
    code: block.code,
    error: block.message,
  };
}

type SmirkResponseBody = {
  state?: unknown;
  handoffId?: unknown;
  taskId?: unknown;
  code?: unknown;
  error?: unknown;
};

function positiveInteger(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : undefined;
}

export function parseSmirkHandoffResponse(
  httpStatus: number,
  rawBody: unknown
): SmirkHandoffResponse {
  const body =
    rawBody && typeof rawBody === "object"
      ? (rawBody as SmirkResponseBody)
      : {};

  if (
    (httpStatus === 201 && body.state === "RECEIVED") ||
    (httpStatus === 200 && body.state === "DUPLICATE")
  ) {
    const handoffId = positiveInteger(body.handoffId);
    const taskId = body.taskId == null ? null : positiveInteger(body.taskId);
    if (!handoffId || (body.taskId != null && !taskId)) {
      return {
        success: false,
        httpStatus,
        error:
          "SMIRK acknowledged the handoff without valid persisted record identifiers.",
      };
    }
    return {
      success: true,
      state: body.state,
      httpStatus,
      handoffId,
      taskId,
    };
  }

  if (httpStatus === 409) {
    return {
      success: false,
      state: "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT",
      httpStatus,
      code: typeof body.code === "string" ? body.code : undefined,
      error:
        typeof body.error === "string"
          ? body.error
          : "Idempotency conflict on synthetic test.",
    };
  }

  return {
    success: false,
    httpStatus,
    code: typeof body.code === "string" ? body.code : undefined,
    error:
      typeof body.error === "string"
        ? body.error
        : `Unexpected SMIRK response (${httpStatus}).`,
  };
}

// ─── Synthetic Test Handoff ───────────────────────────────────────────────────

/**
 * Send a harmless synthetic handoff to SMIRK using a fake phone number.
 * Used for cross-system proof without touching real prospects.
 *
 * Phone: +12025550124 (non-routable test number)
 * externalId prefix: velvet-manus-fake-
 */
export async function sendSyntheticTestHandoff(
  suffix: string
): Promise<SmirkHandoffResponse> {
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
    notes:
      "Generated by sendSyntheticTestHandoff() for integration verification only.",
  };

  try {
    const response = await fetch(
      `${smirkBaseUrl}/api/integrations/velvet/handoffs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${smirkApiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      }
    );

    const httpStatus = response.status;
    let body: any = {};
    try {
      body = await response.json();
    } catch {
      /* non-JSON body */
    }

    return parseSmirkHandoffResponse(httpStatus, body);
  } catch (err: any) {
    return { success: false, error: err.message ?? "Network error" };
  }
}
