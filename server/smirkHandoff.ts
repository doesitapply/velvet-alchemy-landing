import { z } from "zod";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;
const EXTERNAL_ID = /^[A-Za-z0-9:_-]+$/;

export const smirkHandoffPayloadSchema = z.object({
  externalId: z.string().trim().min(12).max(160).regex(EXTERNAL_ID),
  caller: z.object({
    phone: z.string().trim().regex(E164_PHONE, "caller.phone must be an E.164 phone number."),
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(320).optional(),
  }).strict(),
  companyName: z.string().trim().min(1).max(240).optional(),
  reason: z.string().trim().min(4).max(500),
  urgency: z.enum(["low", "normal", "high", "emergency"]).default("normal"),
  transcriptSnippet: z.string().trim().min(1).max(4_000).optional(),
  recommendedAction: z.string().trim().min(1).max(1_000).optional(),
  notes: z.string().trim().min(1).max(2_000).optional(),
}).strict();

export type SmirkHandoffPayload = z.infer<typeof smirkHandoffPayloadSchema>;

export type SmirkHandoffConfig = {
  baseUrl: string | null;
  apiKey: string;
  workspaceId: number | null;
  missing: string[];
  configured: boolean;
  error?: string;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type SmirkHandoffResult =
  | { ok: true; state: "RECEIVED" | "DUPLICATE"; handoffId: number; taskId: number | null }
  | { ok: false; code: string; error: string; retryable: boolean };

function normalizeBaseUrl(value: string, isProduction: boolean): { baseUrl: string | null; error?: string } {
  if (!value) return { baseUrl: null };
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== "/")) {
      return { baseUrl: null, error: "SMIRK_BASE_URL must be an origin without credentials, a path, query, or fragment." };
    }
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && (isProduction || !isLocal)) {
      return { baseUrl: null, error: "SMIRK_BASE_URL must use HTTPS outside local development." };
    }
    return { baseUrl: url.origin };
  } catch {
    return { baseUrl: null, error: "SMIRK_BASE_URL must be a valid URL." };
  }
}

export function getSmirkHandoffConfig(env: Record<string, string | undefined> = process.env): SmirkHandoffConfig {
  const rawBaseUrl = String(env.SMIRK_BASE_URL || "").trim();
  const apiKey = String(env.SMIRK_API_KEY || "").trim();
  const rawWorkspaceId = String(env.SMIRK_WORKSPACE_ID || "").trim();
  const workspaceId = Number(rawWorkspaceId);
  const validWorkspaceId = Number.isSafeInteger(workspaceId) && workspaceId > 0 ? workspaceId : null;
  const normalizedBase = normalizeBaseUrl(rawBaseUrl, env.NODE_ENV === "production");
  const missing: string[] = [];
  if (!rawBaseUrl) missing.push("SMIRK_BASE_URL");
  if (!apiKey) missing.push("SMIRK_API_KEY");
  if (!validWorkspaceId) missing.push("SMIRK_WORKSPACE_ID");
  if (normalizedBase.error && !missing.includes("SMIRK_BASE_URL")) missing.push("SMIRK_BASE_URL");
  return {
    baseUrl: normalizedBase.baseUrl,
    apiKey,
    workspaceId: validWorkspaceId,
    missing,
    configured: missing.length === 0 && !!normalizedBase.baseUrl,
    error: normalizedBase.error,
  };
}

function asErrorPayload(value: unknown): { code?: string; error?: string } {
  if (!value || typeof value !== "object") return {};
  const candidate = value as Record<string, unknown>;
  return {
    code: typeof candidate.code === "string" ? candidate.code.slice(0, 120) : undefined,
    error: typeof candidate.error === "string" ? candidate.error.slice(0, 500) : undefined,
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function sendSmirkHandoff(
  payload: SmirkHandoffPayload,
  options: { env?: Record<string, string | undefined>; fetch?: FetchLike } = {},
): Promise<SmirkHandoffResult> {
  const config = getSmirkHandoffConfig(options.env);
  if (!config.configured || !config.baseUrl || !config.workspaceId) {
    return {
      ok: false,
      code: "SMIRK_HANDOFF_NOT_CONFIGURED",
      error: config.error || `SMIRK handoff is not configured. Missing: ${config.missing.join(", ")}.`,
      retryable: false,
    };
  }

  const parsed = smirkHandoffPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      code: "SMIRK_HANDOFF_INVALID_PAYLOAD",
      error: "The SMIRK handoff payload is invalid.",
      retryable: false,
    };
  }

  const requestBody = { ...parsed.data, workspaceId: config.workspaceId };
  const fetchImpl = options.fetch || globalThis.fetch;
  try {
    const response = await fetchImpl(`${config.baseUrl}/api/integrations/velvet/handoffs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const body = await readJson(response);
    if (!response.ok) {
      const remote = asErrorPayload(body);
      return {
        ok: false,
        code: remote.code || `SMIRK_HANDOFF_HTTP_${response.status}`,
        error: remote.error || `SMIRK rejected the handoff (${response.status}).`,
        retryable: response.status >= 500 || response.status === 429,
      };
    }
    const result = body as Record<string, unknown> | null;
    const handoffId = Number(result?.handoffId || 0);
    const state = result?.state === "DUPLICATE" ? "DUPLICATE" : "RECEIVED";
    if (!result?.ok || !Number.isSafeInteger(handoffId) || handoffId <= 0) {
      return {
        ok: false,
        code: "SMIRK_HANDOFF_INVALID_RESPONSE",
        error: "SMIRK did not confirm a persisted handoff.",
        retryable: true,
      };
    }
    const taskId = result.taskId === null || result.taskId === undefined ? null : Number(result.taskId);
    return {
      ok: true,
      state,
      handoffId,
      taskId: Number.isSafeInteger(taskId) && Number(taskId) > 0 ? Number(taskId) : null,
    };
  } catch {
    return {
      ok: false,
      code: "SMIRK_HANDOFF_NETWORK_ERROR",
      error: "SMIRK could not be reached. No delivery was confirmed.",
      retryable: true,
    };
  }
}
