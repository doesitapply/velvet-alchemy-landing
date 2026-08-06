import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { auditLog, audits, leads, type Audit, type Lead } from "../../drizzle/schema";
import { getDb } from "../db";

const SMIRK_HANDOFF_PATH = "/api/integrations/velvet/handoffs";
const SMIRK_HANDOFF_ATTEMPT_ACTION = "smirk_handoff_attempt_v1";
const SMIRK_HANDOFF_RESOURCE = "leads";
const SMIRK_HANDOFF_ATTEMPT_VERSION = 1 as const;
// Version-one values are part of the durable frozen-attempt contract. Do not
// change them in place; introduce a new attempt version and reader instead.
const SMIRK_HANDOFF_REASON_V1 =
  "Human-review handoff from Velvet Alchemy. No external contact is authorized.";
const SMIRK_HANDOFF_RECOMMENDED_ACTION_V1 =
  "Human review only. Decide whether a manual demo invitation is appropriate.";

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
  attemptId?: number;
  reconciliationRequired?: boolean;
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

type SmirkHandoffConfirmation = {
  state: "RECEIVED" | "DUPLICATE";
  httpStatus: number;
  handoffId: number;
  taskId: number | null;
};

type SmirkHandoffFailure = {
  code: string;
  error: string;
  httpStatus?: number;
  retryable: false;
};

type SmirkHandoffAttempt = {
  version: typeof SMIRK_HANDOFF_ATTEMPT_VERSION;
  state: "prepared" | "finalized" | "blocked";
  leadId: number;
  userId: number;
  workspaceId: number;
  externalId: string;
  payload: SmirkHandoffPayload;
  payloadSha256: string;
  preparedAt: string;
  finalizedAt?: string;
  blockedAt?: string;
  confirmation?: SmirkHandoffConfirmation;
  failure?: SmirkHandoffFailure;
};

type PreparedHandoff = {
  attemptId: number;
  attempt: SmirkHandoffAttempt;
};

const FAILED_AUDIT_EVIDENCE =
  /\b(?:audit failed|automated audit failed|audit system error|unable to analyze)\b/i;

function normalizeEvidenceText(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || FAILED_AUDIT_EVIDENCE.test(normalized)) return null;
  return normalized.slice(0, maxLength);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(record).every(key => allowed.has(key));
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function payloadSha256(payload: SmirkHandoffPayload): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function isSafeFrozenPayload(
  value: unknown,
  version: unknown,
  workspaceId: number,
  externalId: string,
): value is SmirkHandoffPayload {
  if (version !== SMIRK_HANDOFF_ATTEMPT_VERSION) return false;
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "workspaceId",
    "externalId",
    "caller",
    "companyName",
    "reason",
    "urgency",
    "transcriptSnippet",
    "recommendedAction",
    "notes",
  ])) return false;

  const caller = value.caller;
  if (!isRecord(caller) || !hasOnlyKeys(caller, ["phone", "name", "email"])) return false;
  if (!isBoundedString(caller.phone, 32)) return false;
  if (caller.name !== undefined && !isBoundedString(caller.name, 255)) return false;
  if (caller.email !== undefined && !isBoundedString(caller.email, 320)) return false;

  return value.workspaceId === workspaceId
    && value.externalId === externalId
    && /^[A-Za-z0-9:_-]{1,180}$/.test(externalId)
    && value.reason === SMIRK_HANDOFF_REASON_V1
    && value.recommendedAction === SMIRK_HANDOFF_RECOMMENDED_ACTION_V1
    && value.urgency === "normal"
    && (value.companyName === undefined || isBoundedString(value.companyName, 255))
    && (value.transcriptSnippet === undefined || isBoundedString(value.transcriptSnippet, 500))
    && (value.notes === undefined || (
      isBoundedString(value.notes, 500)
      && value.notes.startsWith("Internal audit summary for review: ")
    ));
}

function readConfirmation(value: unknown): SmirkHandoffConfirmation | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "state",
    "httpStatus",
    "handoffId",
    "taskId",
  ])) return null;
  const taskId = value.taskId;
  if (
    (value.state !== "RECEIVED" && value.state !== "DUPLICATE")
    || typeof value.httpStatus !== "number"
    || value.httpStatus !== (value.state === "RECEIVED" ? 201 : 200)
    || typeof value.handoffId !== "number"
    || !Number.isSafeInteger(value.handoffId)
    || value.handoffId <= 0
    || (
      taskId !== null
      && (
        typeof taskId !== "number"
        || !Number.isSafeInteger(taskId)
        || taskId <= 0
      )
    )
  ) return null;

  return {
    state: value.state,
    httpStatus: value.httpStatus,
    handoffId: value.handoffId,
    taskId,
  };
}

function readFailure(value: unknown): SmirkHandoffFailure | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["code", "error", "httpStatus", "retryable"])) {
    return null;
  }
  if (
    !isBoundedString(value.code, 120)
    || !isBoundedString(value.error, 500)
    || value.retryable !== false
    || (
      value.httpStatus !== undefined
      && (
        typeof value.httpStatus !== "number"
        || !Number.isSafeInteger(value.httpStatus)
        || value.httpStatus < 400
        || value.httpStatus > 599
      )
    )
  ) return null;

  return {
    code: value.code,
    error: value.error,
    ...(value.httpStatus !== undefined && { httpStatus: value.httpStatus }),
    retryable: false,
  };
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && Number.isFinite(Date.parse(value));
}

function readHandoffAttempt(
  details: string | null,
  expected: { leadId: number; userId: number; workspaceId: number; externalId: string },
): SmirkHandoffAttempt | null {
  if (!details) return null;

  let value: unknown;
  try {
    value = JSON.parse(details);
  } catch {
    return null;
  }
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "version",
    "state",
    "leadId",
    "userId",
    "workspaceId",
    "externalId",
    "payload",
    "payloadSha256",
    "preparedAt",
    "finalizedAt",
    "blockedAt",
    "confirmation",
    "failure",
  ])) return null;
  if (
    value.version !== SMIRK_HANDOFF_ATTEMPT_VERSION
    || (value.state !== "prepared" && value.state !== "finalized" && value.state !== "blocked")
    || value.leadId !== expected.leadId
    || value.userId !== expected.userId
    || value.workspaceId !== expected.workspaceId
    || value.externalId !== expected.externalId
    || !isIsoTimestamp(value.preparedAt)
    || !isSafeFrozenPayload(
      value.payload,
      value.version,
      expected.workspaceId,
      expected.externalId,
    )
    || typeof value.payloadSha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(value.payloadSha256)
    || payloadSha256(value.payload) !== value.payloadSha256
  ) return null;

  const base = {
    version: SMIRK_HANDOFF_ATTEMPT_VERSION,
    leadId: expected.leadId,
    userId: expected.userId,
    workspaceId: expected.workspaceId,
    externalId: expected.externalId,
    payload: value.payload,
    payloadSha256: value.payloadSha256,
    preparedAt: value.preparedAt,
  };

  if (
    value.state === "prepared"
    && value.finalizedAt === undefined
    && value.blockedAt === undefined
    && value.confirmation === undefined
    && value.failure === undefined
  ) {
    return { ...base, state: "prepared" };
  }

  if (
    value.state === "finalized"
    && isIsoTimestamp(value.finalizedAt)
    && value.blockedAt === undefined
    && value.failure === undefined
  ) {
    const confirmation = readConfirmation(value.confirmation);
    if (confirmation) return { ...base, state: "finalized", finalizedAt: value.finalizedAt, confirmation };
  }

  if (
    value.state === "blocked"
    && isIsoTimestamp(value.blockedAt)
    && value.finalizedAt === undefined
    && value.confirmation === undefined
  ) {
    const failure = readFailure(value.failure);
    if (failure) return { ...base, state: "blocked", blockedAt: value.blockedAt, failure };
  }

  return null;
}

function buildCallBriefFromRows(lead: Lead, audit?: Audit): CallBrief {
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
    velvetLeadId: lead.id,
    businessName: lead.companyName,
    phoneNumber: lead.phone!,
    ownerName: null,
    websiteUrl: lead.websiteUrl,
    signals,
    openingLine: buildAuditEvidenceOpeningLine(lead.companyName, audit),
    auditSummary: audit?.summary ?? "No audit available.",
    prestigeScore: audit?.prestigeScore ?? lead.prestigeScore ?? 0,
  };
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
  if (payload.workspaceId !== config.workspaceId) {
    return {
      success: false,
      code: "SMIRK_HANDOFF_WORKSPACE_MISMATCH",
      error: "The frozen handoff workspace does not match the active SMIRK configuration.",
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
      body: JSON.stringify(payload),
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
        const ambiguousDelivery = httpStatus >= 200 && httpStatus < 300;
        return {
          success: false,
          httpStatus,
          code: "SMIRK_HANDOFF_INVALID_RESPONSE",
          error: ambiguousDelivery
            ? "SMIRK returned a successful status without a valid persistence confirmation. Retry to reconcile the frozen payload."
            : "SMIRK returned a non-JSON response.",
          retryable: ambiguousDelivery || httpStatus >= 500,
          ...(ambiguousDelivery && { reconciliationRequired: true }),
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
    if (httpStatus >= 200 && httpStatus < 300) {
      return {
        success: false,
        httpStatus,
        code: "SMIRK_HANDOFF_INVALID_CONFIRMATION",
        error: "SMIRK returned a successful status without a valid persistence confirmation. Retry to reconcile the frozen payload.",
        retryable: true,
        reconciliationRequired: true,
      };
    }

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

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

type AttemptPreparation =
  | { ok: true; prepared: PreparedHandoff; finalized?: undefined }
  | { ok: true; finalized: SmirkHandoffResponse; prepared?: undefined }
  | { ok: false; response: SmirkHandoffResponse };

function attemptFailure(
  code: string,
  error: string,
  retryable: boolean,
  attemptId?: number,
): SmirkHandoffResponse {
  return {
    success: false,
    code,
    error,
    retryable,
    ...(attemptId !== undefined && { attemptId }),
  };
}

function finalizedResponse(attemptId: number, attempt: SmirkHandoffAttempt): SmirkHandoffResponse {
  const confirmation = attempt.confirmation!;
  return {
    success: true,
    state: confirmation.state,
    httpStatus: confirmation.httpStatus,
    handoffId: confirmation.handoffId,
    taskId: confirmation.taskId,
    attemptId,
  };
}

async function prepareHandoffAttempt(
  db: Database,
  leadId: number,
  userId: number,
  workspaceId: number,
  externalId: string,
): Promise<AttemptPreparation> {
  return db.transaction(async tx => {
    const leadRows = await tx
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, userId)))
      .for("update")
      .limit(1);
    const lead = leadRows[0];
    if (!lead || !lead.phone) {
      return {
        ok: false as const,
        response: attemptFailure(
          "SMIRK_HANDOFF_LEAD_NOT_READY",
          "Lead not found or has no phone number.",
          false,
        ),
      };
    }

    const attemptRows = await tx
      .select()
      .from(auditLog)
      .where(and(
        eq(auditLog.userId, userId),
        eq(auditLog.action, SMIRK_HANDOFF_ATTEMPT_ACTION),
        eq(auditLog.resource, SMIRK_HANDOFF_RESOURCE),
        eq(auditLog.resourceId, leadId),
      ))
      .orderBy(desc(auditLog.id))
      .for("update")
      .limit(2);

    if (attemptRows.length > 1) {
      return {
        ok: false as const,
        response: attemptFailure(
          "SMIRK_HANDOFF_ATTEMPT_AMBIGUOUS",
          "Multiple local handoff attempts exist for this lead. Delivery is blocked pending review.",
          false,
        ),
      };
    }

    const expected = { leadId, userId, workspaceId, externalId };
    const attemptRow = attemptRows[0];
    if (attemptRow) {
      const attempt = readHandoffAttempt(attemptRow.details, expected);
      if (!attempt) {
        return {
          ok: false as const,
          response: attemptFailure(
            "SMIRK_HANDOFF_ATTEMPT_CORRUPT",
            "The frozen local handoff attempt is missing or corrupt. Delivery is blocked pending review.",
            false,
            attemptRow.id,
          ),
        };
      }

      if (attempt.state === "finalized") {
        if (!lead.smirkHandoffAt) {
          return {
            ok: false as const,
            response: attemptFailure(
              "SMIRK_HANDOFF_ATTEMPT_INCONSISTENT",
              "The local handoff records disagree. Delivery is blocked pending review.",
              false,
              attemptRow.id,
            ),
          };
        }
        return { ok: true as const, finalized: finalizedResponse(attemptRow.id, attempt) };
      }

      if (lead.smirkHandoffAt) {
        return {
          ok: false as const,
          response: attemptFailure(
            "SMIRK_HANDOFF_ATTEMPT_INCONSISTENT",
            "The lead is finalized but its frozen handoff attempt is not. Delivery is blocked pending review.",
            false,
            attemptRow.id,
          ),
        };
      }

      if (attempt.state === "blocked") {
        return {
          ok: false as const,
          response: {
            success: false,
            ...attempt.failure!,
            attemptId: attemptRow.id,
          },
        };
      }

      return {
        ok: true as const,
        prepared: { attemptId: attemptRow.id, attempt },
      };
    }

    if (lead.smirkHandoffAt) {
      return {
        ok: false as const,
        response: attemptFailure(
          "SMIRK_HANDOFF_FINALIZED_WITHOUT_ATTEMPT",
          "This lead is already marked as handed off, but no frozen attempt is available. Re-delivery is blocked.",
          false,
        ),
      };
    }

    const auditRows = await tx
      .select()
      .from(audits)
      .where(eq(audits.leadId, leadId))
      .orderBy(desc(audits.createdAt))
      .limit(1);
    const brief = buildCallBriefFromRows(lead, auditRows[0]);
    const payload: SmirkHandoffPayload = {
      workspaceId,
      externalId,
      caller: {
        phone: brief.phoneNumber,
        ...(brief.ownerName && { name: brief.ownerName }),
      },
      companyName: brief.businessName,
      reason: SMIRK_HANDOFF_REASON_V1,
      urgency: "normal",
      transcriptSnippet: brief.openingLine,
      recommendedAction: SMIRK_HANDOFF_RECOMMENDED_ACTION_V1,
      notes: `Internal audit summary for review: ${brief.auditSummary.slice(0, 300)}`,
    };
    const now = new Date().toISOString();
    const attempt: SmirkHandoffAttempt = {
      version: SMIRK_HANDOFF_ATTEMPT_VERSION,
      state: "prepared",
      leadId,
      userId,
      workspaceId,
      externalId,
      payload,
      payloadSha256: payloadSha256(payload),
      preparedAt: now,
    };
    const [inserted] = await tx.insert(auditLog).values({
      userId,
      action: SMIRK_HANDOFF_ATTEMPT_ACTION,
      resource: SMIRK_HANDOFF_RESOURCE,
      resourceId: leadId,
      details: JSON.stringify(attempt),
      // A prepared row freezes delivery data; only local finalization is a success.
      status: "blocked",
    }).$returningId();
    if (!inserted?.id) throw new Error("Failed to persist the SMIRK handoff attempt");

    return {
      ok: true as const,
      prepared: { attemptId: inserted.id, attempt },
    };
  });
}

async function finalizeHandoffAttempt(
  db: Database,
  prepared: PreparedHandoff,
  confirmation: SmirkHandoffConfirmation,
): Promise<SmirkHandoffResponse> {
  return db.transaction(async tx => {
    const leadRows = await tx
      .select({ smirkHandoffAt: leads.smirkHandoffAt })
      .from(leads)
      .where(and(
        eq(leads.id, prepared.attempt.leadId),
        eq(leads.userId, prepared.attempt.userId),
      ))
      .for("update")
      .limit(1);
    const lead = leadRows[0];
    if (!lead) throw new Error("The tenant-scoped lead disappeared during finalization");

    const attemptRows = await tx
      .select()
      .from(auditLog)
      .where(and(
        eq(auditLog.id, prepared.attemptId),
        eq(auditLog.userId, prepared.attempt.userId),
        eq(auditLog.action, SMIRK_HANDOFF_ATTEMPT_ACTION),
        eq(auditLog.resource, SMIRK_HANDOFF_RESOURCE),
        eq(auditLog.resourceId, prepared.attempt.leadId),
      ))
      .for("update")
      .limit(1);
    const attemptRow = attemptRows[0];
    const current = readHandoffAttempt(attemptRow?.details ?? null, {
      leadId: prepared.attempt.leadId,
      userId: prepared.attempt.userId,
      workspaceId: prepared.attempt.workspaceId,
      externalId: prepared.attempt.externalId,
    });
    if (!attemptRow || !current || current.payloadSha256 !== prepared.attempt.payloadSha256) {
      throw new Error("The frozen handoff attempt changed before finalization");
    }

    if (current.state === "finalized") {
      if (!lead.smirkHandoffAt) throw new Error("The local handoff records disagree");
      return finalizedResponse(attemptRow.id, current);
    }
    if (current.state !== "prepared" || lead.smirkHandoffAt) {
      throw new Error("The handoff attempt cannot be finalized from its current state");
    }

    const finalized: SmirkHandoffAttempt = {
      ...current,
      state: "finalized",
      finalizedAt: new Date().toISOString(),
      confirmation,
    };
    const now = new Date();
    await tx.update(auditLog).set({
      details: JSON.stringify(finalized),
      status: "success",
    }).where(and(
      eq(auditLog.id, attemptRow.id),
      eq(auditLog.userId, prepared.attempt.userId),
    ));
    await tx.update(leads).set({
      smirkHandoffAt: now,
      smirkWorkspaceId: String(prepared.attempt.workspaceId),
      updatedAt: now,
    }).where(and(
      eq(leads.id, prepared.attempt.leadId),
      eq(leads.userId, prepared.attempt.userId),
    ));

    return finalizedResponse(attemptRow.id, finalized);
  });
}

async function blockHandoffAttempt(
  db: Database,
  prepared: PreparedHandoff,
  response: SmirkHandoffResponse,
): Promise<void> {
  if (!response.code || !response.error || response.retryable !== false) return;
  const failure: SmirkHandoffFailure = {
    code: response.code,
    error: response.error,
    ...(response.httpStatus !== undefined && { httpStatus: response.httpStatus }),
    retryable: false,
  };

  await db.transaction(async tx => {
    const rows = await tx
      .select()
      .from(auditLog)
      .where(and(
        eq(auditLog.id, prepared.attemptId),
        eq(auditLog.userId, prepared.attempt.userId),
        eq(auditLog.action, SMIRK_HANDOFF_ATTEMPT_ACTION),
        eq(auditLog.resource, SMIRK_HANDOFF_RESOURCE),
        eq(auditLog.resourceId, prepared.attempt.leadId),
      ))
      .for("update")
      .limit(1);
    const row = rows[0];
    const current = readHandoffAttempt(row?.details ?? null, {
      leadId: prepared.attempt.leadId,
      userId: prepared.attempt.userId,
      workspaceId: prepared.attempt.workspaceId,
      externalId: prepared.attempt.externalId,
    });
    if (!row || !current || current.payloadSha256 !== prepared.attempt.payloadSha256) {
      throw new Error("The frozen handoff attempt changed before it could be blocked");
    }
    if (current.state !== "prepared") return;

    const blocked: SmirkHandoffAttempt = {
      ...current,
      state: "blocked",
      blockedAt: new Date().toISOString(),
      failure,
    };
    await tx.update(auditLog).set({
      details: JSON.stringify(blocked),
      status: "blocked",
    }).where(and(
      eq(auditLog.id, row.id),
      eq(auditLog.userId, prepared.attempt.userId),
    ));
  });
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
  return buildCallBriefFromRows(lead, auditRows[0]);
}

export async function createSmirkHandoff(
  leadId: number,
  userId: number,
  options: SmirkHandoffOptions & { externalId?: string } = {},
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

  const externalId = options.externalId ?? `velvet-lead-${leadId}`;
  if (!/^[A-Za-z0-9:_-]{1,180}$/.test(externalId)) {
    return {
      success: false,
      code: "SMIRK_HANDOFF_INVALID_EXTERNAL_ID",
      error: "The SMIRK handoff external ID is invalid.",
      retryable: false,
    };
  }

  const db = await getDb();
  if (!db) {
    return attemptFailure(
      "SMIRK_HANDOFF_DATABASE_UNAVAILABLE",
      "The handoff attempt could not be persisted before delivery.",
      true,
    );
  }

  let preparation: AttemptPreparation;
  try {
    preparation = await prepareHandoffAttempt(
      db,
      leadId,
      userId,
      config.workspaceId,
      externalId,
    );
  } catch {
    return attemptFailure(
      "SMIRK_HANDOFF_ATTEMPT_PERSISTENCE_FAILED",
      "The handoff attempt could not be frozen before delivery. No request was sent.",
      true,
    );
  }
  if (!preparation.ok) return preparation.response;
  if (preparation.finalized) return preparation.finalized;

  const prepared = preparation.prepared!;
  const result = await postSmirkHandoff(prepared.attempt.payload, options);
  if (result.success) {
    if (
      !result.state
      || !result.httpStatus
      || !result.handoffId
      || result.taskId === undefined
    ) {
      return attemptFailure(
        "SMIRK_HANDOFF_INVALID_CONFIRMATION",
        "SMIRK returned an incomplete persistence confirmation.",
        false,
        prepared.attemptId,
      );
    }

    try {
      return await finalizeHandoffAttempt(db, prepared, {
        state: result.state,
        httpStatus: result.httpStatus,
        handoffId: result.handoffId,
        taskId: result.taskId,
      });
    } catch {
      return {
        success: false,
        code: "SMIRK_HANDOFF_RECONCILIATION_REQUIRED",
        error: "SMIRK accepted the frozen handoff, but local finalization failed. Retry this lead to reconcile the exact same payload.",
        retryable: true,
        httpStatus: result.httpStatus,
        handoffId: result.handoffId,
        taskId: result.taskId,
        attemptId: prepared.attemptId,
        reconciliationRequired: true,
      };
    }
  }

  if (result.retryable === false) {
    try {
      await blockHandoffAttempt(db, prepared, result);
    } catch {
      return attemptFailure(
        "SMIRK_HANDOFF_ATTEMPT_PERSISTENCE_FAILED",
        "SMIRK rejected the handoff, but the local attempt could not be safely blocked.",
        true,
        prepared.attemptId,
      );
    }
  }
  return { ...result, attemptId: prepared.attemptId };
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
