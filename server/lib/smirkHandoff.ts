import { and, desc, eq } from "drizzle-orm";
import { audits, leads } from "../../drizzle/schema";
import { getDb } from "../db";

const SMIRK_HANDOFF_PATH = "/api/integrations/velvet/handoffs";

export interface SmirkHandoffPayload {
  workspaceId: number;
  externalId: string;
  caller: {
    phone: string;
    name?: string;
    email?: string;
  };
  companyName?: string;
  reason: string;
  urgency: "low" | "normal" | "high" | "emergency";
  transcriptSnippet?: string;
  recommendedAction?: string;
  notes?: string;
}

export interface SmirkHandoffResponse {
  success: boolean;
  state?: "RECEIVED" | "DUPLICATE";
  httpStatus?: number;
  handoffId?: number;
  taskId?: number | null;
  code?: string;
  error?: string;
  retryable?: boolean;
}

export interface CallBrief {
  velvetLeadId: number;
  businessName: string;
  phoneNumber: string;
  ownerName: string | null;
  websiteUrl: string;
  signals: string[];
  openingLine: string;
  auditSummary: string;
  prestigeScore: number;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type SmirkHandoffOptions = {
  env?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
};

function readConfig(env: Record<string, string | undefined>) {
  const rawBaseUrl = String(env.SMIRK_BASE_URL || "").trim();
  const apiKey = String(env.SMIRK_API_KEY || "").trim();
  const workspaceId = Number(String(env.SMIRK_WORKSPACE_ID || "").trim());
  if (!rawBaseUrl || !apiKey || !Number.isSafeInteger(workspaceId) || workspaceId <= 0) {
    return {
      ok: false as const,
      error: "SMIRK is not configured with a valid base URL, dedicated API key, and workspace ID.",
    };
  }

  try {
    const url = new URL(rawBaseUrl);
    const isLocalDevelopment = env.NODE_ENV !== "production"
      && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (
      url.username
      || url.password
      || url.search
      || url.hash
      || (url.pathname && url.pathname !== "/")
      || (url.protocol !== "https:" && !isLocalDevelopment)
    ) {
      return { ok: false as const, error: "SMIRK_BASE_URL must be a trusted HTTPS origin." };
    }
    return { ok: true as const, baseUrl: url.origin, apiKey, workspaceId };
  } catch {
    return { ok: false as const, error: "SMIRK_BASE_URL is invalid." };
  }
}

function readRemoteError(body: unknown): { code?: string; error?: string } {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code.slice(0, 120) : undefined,
    error: typeof record.error === "string" ? record.error.slice(0, 500) : undefined,
  };
}

type AuditEvidence = {
  summary?: string | null;
  visualDebtData?: string | null;
};

const FAILED_AUDIT_EVIDENCE =
  /\b(?:audit failed|automated audit failed|audit system error|unable to analyze)\b/i;

function normalizeEvidenceText(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  if (!normalized || FAILED_AUDIT_EVIDENCE.test(normalized)) return null;
  return normalized;
}

function readAuditIssue(visualDebtData: string | null | undefined): string | null {
  if (!visualDebtData) return null;

  try {
    const parsed = JSON.parse(visualDebtData) as unknown;
    const record = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
    const candidates = Array.isArray(parsed)
      ? parsed
      : Array.isArray(record?.visualDebt)
        ? record.visualDebt
        : Array.isArray(record?.issues)
          ? record.issues
          : [];

    for (const candidate of candidates) {
      const issue = candidate && typeof candidate === "object"
        ? (candidate as Record<string, unknown>).issue
        : candidate;
      const normalized = normalizeEvidenceText(issue);
      if (normalized) return normalized;
    }
  } catch {
    return null;
  }

  return null;
}

export function buildAuditEvidenceOpeningLine(
  companyName: string,
  audit?: AuditEvidence | null,
): string {
  const businessName = normalizeEvidenceText(companyName, 120) || "this business";
  const issue = readAuditIssue(audit?.visualDebtData);
  if (issue) {
    const punctuation = /[.!?]$/.test(issue) ? "" : ".";
    return `The latest audit for ${businessName} flagged this for human review: ${issue}${punctuation}`;
  }

  const summary = normalizeEvidenceText(audit?.summary);
  if (summary && !/^no audit available[.!]?$/i.test(summary)) {
    const punctuation = /[.!?]$/.test(summary) ? "" : ".";
    return `The latest audit summary for ${businessName} is ready for human review: ${summary}${punctuation}`;
  }

  return `Complete a human review for ${businessName} before deciding whether any manual outreach is appropriate.`;
}

function readPersistedConfirmation(
  body: unknown,
  expectedState: "RECEIVED" | "DUPLICATE",
): { handoffId: number; taskId: number | null } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const handoffId = record.handoffId;
  const rawTaskId = record.taskId;
  const taskId = rawTaskId === null || rawTaskId === undefined ? null : rawTaskId;
  if (
    record.ok !== true
    || record.state !== expectedState
    || typeof handoffId !== "number"
    || !Number.isSafeInteger(handoffId)
    || handoffId <= 0
    || (
      taskId !== null
      && (
        typeof taskId !== "number"
        || !Number.isSafeInteger(taskId)
        || taskId <= 0
      )
    )
  ) {
    return null;
  }
  return { handoffId, taskId };
}

async function postSmirkHandoff(
  payload: SmirkHandoffPayload,
  options: SmirkHandoffOptions = {},
): Promise<SmirkHandoffResponse> {
  const config = readConfig(options.env ?? process.env);
  if (!config.ok) {
    return {
      success: false,
      code: "SMIRK_HANDOFF_NOT_CONFIGURED",
      error: config.error,
      retryable: false,
    };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  try {
    const response = await fetchImpl(`${config.baseUrl}${SMIRK_HANDOFF_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...payload, workspaceId: config.workspaceId }),
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });

    const httpStatus = response.status;
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return {
          success: false,
          httpStatus,
          code: "SMIRK_HANDOFF_INVALID_RESPONSE",
          error: "SMIRK returned a non-JSON response.",
          retryable: httpStatus >= 500,
        };
      }
    }

    if (httpStatus === 201) {
      const confirmation = readPersistedConfirmation(body, "RECEIVED");
      if (confirmation) {
        return {
          success: true,
          state: "RECEIVED",
          httpStatus,
          handoffId: confirmation.handoffId,
          taskId: confirmation.taskId,
        };
      }
    }

    if (httpStatus === 200) {
      const confirmation = readPersistedConfirmation(body, "DUPLICATE");
      if (confirmation) {
        return {
          success: true,
          state: "DUPLICATE",
          httpStatus,
          handoffId: confirmation.handoffId,
          taskId: confirmation.taskId,
        };
      }
    }

    const remote = readRemoteError(body);
    if (httpStatus === 409 && remote.code === "VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT") {
      return {
        success: false,
        httpStatus,
        code: remote.code,
        error: remote.error || "The external handoff ID was reused with a different payload.",
        retryable: false,
      };
    }

    return {
      success: false,
      httpStatus,
      code: remote.code || "SMIRK_HANDOFF_REJECTED",
      error: remote.error || `SMIRK rejected the handoff (${httpStatus}).`,
      retryable: httpStatus >= 500 || httpStatus === 429,
    };
  } catch {
    return {
      success: false,
      code: "SMIRK_HANDOFF_NETWORK_ERROR",
      error: "SMIRK could not be reached. No delivery was confirmed.",
      retryable: true,
    };
  }
}

export async function buildCallBrief(leadId: number, userId: number): Promise<CallBrief | null> {
  const db = await getDb();
  if (!db) return null;

  const leadRows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.userId, userId)))
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
    signals.push(`Internal website review score ${score}/100`);
  }
  if (lead.category) signals.push(`Category: ${lead.category}`);

  return {
    velvetLeadId: leadId,
    businessName: lead.companyName,
    phoneNumber: lead.phone,
    ownerName: null,
    websiteUrl: lead.websiteUrl,
    signals,
    openingLine: buildAuditEvidenceOpeningLine(lead.companyName, audit),
    auditSummary: audit?.summary ?? "No audit available.",
    prestigeScore: audit?.prestigeScore ?? lead.prestigeScore ?? 0,
  };
}

export async function createSmirkHandoff(
  leadId: number,
  userId: number,
  options: SmirkHandoffOptions & { externalId?: string } = {},
): Promise<SmirkHandoffResponse> {
  const brief = await buildCallBrief(leadId, userId);
  if (!brief) {
    return {
      success: false,
      code: "SMIRK_HANDOFF_LEAD_NOT_READY",
      error: "Lead not found or has no phone number.",
      retryable: false,
    };
  }

  const config = readConfig(options.env ?? process.env);
  if (!config.ok) {
    return {
      success: false,
      code: "SMIRK_HANDOFF_NOT_CONFIGURED",
      error: config.error,
      retryable: false,
    };
  }

  const payload: SmirkHandoffPayload = {
    workspaceId: config.workspaceId,
    externalId: options.externalId ?? `velvet-lead-${leadId}`,
    caller: {
      phone: brief.phoneNumber,
      ...(brief.ownerName && { name: brief.ownerName }),
    },
    companyName: brief.businessName,
    reason: "Human-review handoff from Velvet Alchemy. No external contact is authorized.",
    urgency: "normal",
    transcriptSnippet: brief.openingLine,
    recommendedAction: "Human review only. Decide whether a manual demo invitation is appropriate.",
    notes: `Internal audit summary for review: ${brief.auditSummary.slice(0, 300)}`,
  };

  const result = await postSmirkHandoff(payload, options);
  if (result.success) {
    const db = await getDb();
    if (db) {
      await db
        .update(leads)
        .set({
          smirkHandoffAt: new Date(),
          smirkWorkspaceId: String(config.workspaceId),
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
    }
  }
  return result;
}

export async function sendSyntheticTestHandoff(
  suffix: string,
  options: SmirkHandoffOptions & { reason?: string } = {},
): Promise<SmirkHandoffResponse> {
  if (!/^[A-Za-z0-9:_-]{1,120}$/.test(suffix)) {
    return {
      success: false,
      code: "SMIRK_HANDOFF_INVALID_SYNTHETIC_ID",
      error: "Synthetic handoff suffix is invalid.",
      retryable: false,
    };
  }

  const config = readConfig(options.env ?? process.env);
  if (!config.ok) {
    return {
      success: false,
      code: "SMIRK_HANDOFF_NOT_CONFIGURED",
      error: config.error,
      retryable: false,
    };
  }

  return postSmirkHandoff({
    workspaceId: config.workspaceId,
    externalId: `velvet-manus-fake-${suffix}`,
    caller: {
      phone: "+12025550124",
      name: "Velvet Alchemy Synthetic Test",
    },
    companyName: "Velvet Alchemy Test Fixture",
    reason: options.reason || "Synthetic cross-system proof. This is not a real prospect.",
    urgency: "low",
    transcriptSnippet: "Synthetic test payload. Do not call, text, or email.",
    recommendedAction: "No external action. Verify persistence only.",
    notes: "Synthetic internal integration test retained for audit.",
  }, options);
}
