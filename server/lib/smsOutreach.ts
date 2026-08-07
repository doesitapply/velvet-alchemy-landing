/**
 * SMS is intentionally unavailable for prospect outreach.
 *
 * A public business phone number is not consent to receive marketing texts.
 * Keep this fail-closed adapter so a future import cannot silently restore the
 * old Twilio fallback merely because credentials happen to be configured.
 */

import {
  EXTERNAL_ACTION_BLOCKED_CODE,
  externalActionBlock,
} from "./externalActionPolicy";

export interface SmsOutreachParams {
  toPhone: string;
  companyName: string;
  ownerFirstName?: string;
  prestigeScore: number;
  leadId: number;
  auditSummary?: string;
}

export interface SmsResult {
  success: false;
  code: typeof EXTERNAL_ACTION_BLOCKED_CODE;
  error: string;
}

export async function sendSmsOutreach(
  _params: SmsOutreachParams
): Promise<SmsResult> {
  const block = externalActionBlock("sms_send");
  return {
    success: false,
    code: block.code,
    error: block.message,
  };
}
