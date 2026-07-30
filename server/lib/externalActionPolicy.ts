export const EXTERNAL_ACTION_MODE = "prepare_only" as const;

export const EXTERNAL_ACTION_BLOCKED_CODE = "EXTERNAL_ACTION_APPROVAL_REQUIRED";

export type ExternalAction =
  | "email_send"
  | "sms_send"
  | "automated_call"
  | "prospect_handoff";

export type ExternalActionBlock = {
  allowed: false;
  code: typeof EXTERNAL_ACTION_BLOCKED_CODE;
  action: ExternalAction;
  mode: typeof EXTERNAL_ACTION_MODE;
  message: string;
};

export function externalActionBlock(
  action: ExternalAction
): ExternalActionBlock {
  return {
    allowed: false,
    code: EXTERNAL_ACTION_BLOCKED_CODE,
    action,
    mode: EXTERNAL_ACTION_MODE,
    message:
      action === "sms_send"
        ? "Cold SMS is disabled and cannot be prepared or sent."
        : "External contact is disabled. Prepare and review the action, then use a separately approved manual send or manual dial.",
  };
}

export function externalActionError(action: ExternalAction): Error {
  const block = externalActionBlock(action);
  const error = new Error(block.message);
  Object.assign(error, block);
  return error;
}

const UNSUPPORTED_EXTERNAL_CLAIMS = [
  /\bcosting you (?:jobs|customers|money|revenue|leads)\b/i,
  /\byou(?:'re| are) losing (?:jobs|customers|money|revenue|leads)\b/i,
  /\blost (?:emergency |service |potential )?(?:jobs?|customers?|money|revenue|income|profit|leads?)\b/i,
  /\bcritical leaks?\b/i,
  /\bguarantee(?:d|s)?\b/i,
  /\brecover (?:this|the|your) (?:lost )?revenue\b/i,
] as const;

export function findUnsupportedExternalClaim(text: string): string | null {
  for (const pattern of UNSUPPORTED_EXTERNAL_CLAIMS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

export function assertSafeExternalCopy(subject: string, body: string): void {
  const unsupportedClaim = findUnsupportedExternalClaim(`${subject}\n${body}`);
  if (unsupportedClaim) {
    throw new Error(
      `Draft contains an unsupported external claim: "${unsupportedClaim}". Describe an observed issue as a possible source of friction instead.`
    );
  }
}

export function buildStableVelvetExternalId(leadId: number): string {
  if (!Number.isSafeInteger(leadId) || leadId <= 0) {
    throw new Error("leadId must be a positive integer.");
  }
  return `va-lead-${leadId}`;
}
