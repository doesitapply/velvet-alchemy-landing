import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";

export const SMIRK_OUTCOME_CONTRACT_VERSION =
  "smirk-velvet.outcome.v1" as const;
const MAX_CLOCK_SKEW_SECONDS = 300;

export const smirkOutcomePayloadSchema = z
  .object({
    contractVersion: z.literal(SMIRK_OUTCOME_CONTRACT_VERSION),
    workspaceId: z.number().int().positive(),
    externalProspectId: z
      .string()
      .min(12)
      .max(160)
      .regex(/^[A-Za-z0-9:_-]+$/),
    externalEventId: z
      .string()
      .min(12)
      .max(160)
      .regex(/^[A-Za-z0-9:_-]+$/),
    outreachApprovalId: z.string().uuid(),
    channel: z.enum(["email", "call"]),
    outcome: z.enum([
      "delivered",
      "bounced",
      "replied",
      "qualified",
      "demo_booked",
      "converted",
      "not_interested",
      "dnc",
      "call_connected",
      "voicemail",
      "no_answer",
      "failed",
    ]),
    occurredAt: z.string().datetime({ offset: true }),
    evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
    outreachPayloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    notes: z.string().trim().max(2_000).optional(),
  })
  .strict();

export type SmirkOutcomePayload = z.infer<typeof smirkOutcomePayloadSchema>;

export function isDuplicateOutcomeStorageError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object") return false;
    const candidate = current as {
      code?: unknown;
      errno?: unknown;
      sqlState?: unknown;
      cause?: unknown;
    };
    if (
      candidate.code === "ER_DUP_ENTRY" ||
      candidate.errno === 1062 ||
      candidate.sqlState === "23000"
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export function validateSmirkOutcomeResearchReceipt(
  rawDetails: string | null | undefined,
  payload: SmirkOutcomePayload
):
  | { ok: true }
  | {
      ok: false;
      code:
        | "SMIRK_OUTCOME_RESEARCH_RECEIPT_REQUIRED"
        | "SMIRK_OUTCOME_RESEARCH_RECEIPT_MISMATCH";
    } {
  let receipt: Record<string, unknown> | null = null;
  try {
    receipt = JSON.parse(rawDetails || "null");
  } catch {
    receipt = null;
  }
  if (!receipt) {
    return {
      ok: false,
      code: "SMIRK_OUTCOME_RESEARCH_RECEIPT_REQUIRED",
    };
  }
  if (
    receipt.externalId !== payload.externalProspectId ||
    Number(receipt.workspaceId) !== payload.workspaceId ||
    !["IMPORTED", "DUPLICATE"].includes(String(receipt.state)) ||
    Number(receipt.campaignId) <= 0 ||
    Number(receipt.prospectId) <= 0 ||
    receipt.externalAction !== "none"
  ) {
    return {
      ok: false,
      code: "SMIRK_OUTCOME_RESEARCH_RECEIPT_MISMATCH",
    };
  }
  return { ok: true };
}

export function canonicalOutcomeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalOutcomeJson(item)).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalOutcomeJson(object[key])}`
    )
    .join(",")}}`;
}

export function hashSmirkOutcomePayload(payload: SmirkOutcomePayload): string {
  return createHash("sha256")
    .update(canonicalOutcomeJson(payload))
    .digest("hex");
}

export function signSmirkOutcome(
  payload: SmirkOutcomePayload,
  timestamp: string,
  secret: string
): string {
  return `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${canonicalOutcomeJson(payload)}`)
    .digest("hex")}`;
}

export function verifySmirkOutcomeSignature(input: {
  payload: SmirkOutcomePayload;
  timestamp: string | undefined;
  signature: string | undefined;
  secret: string;
  now?: Date;
}): { ok: true } | { ok: false; code: string } {
  if (input.secret.length < 32) {
    return { ok: false, code: "SMIRK_OUTCOME_NOT_CONFIGURED" };
  }
  const timestampSeconds = Number(input.timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds <= 0) {
    return { ok: false, code: "SMIRK_OUTCOME_TIMESTAMP_INVALID" };
  }
  const nowSeconds = Math.floor((input.now || new Date()).getTime() / 1_000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, code: "SMIRK_OUTCOME_TIMESTAMP_EXPIRED" };
  }
  const expected = signSmirkOutcome(
    input.payload,
    String(timestampSeconds),
    input.secret
  );
  const provided = String(input.signature || "");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { ok: false, code: "SMIRK_OUTCOME_SIGNATURE_INVALID" };
  }
  return { ok: true };
}
