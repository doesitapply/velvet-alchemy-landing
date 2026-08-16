export const SMIRK_RAILWAY_CALLBACK_KEY = "VELVET_ALCHEMY_HANDOFF_API_KEY";
export const SMIRK_RAILWAY_WORKSPACE_ID = "VELVET_ALCHEMY_WORKSPACE_ID";
export const SMIRK_RAILWAY_BASE_URL = "VELVET_ALCHEMY_BASE_URL";

export function buildSmirkOutcomeContract(baseUrl: string) {
  const outcomeWebhookUrl = `${baseUrl}/api/v1/leads/:id/outcome`;
  return `POST ${outcomeWebhookUrl}\nAuthorization: Bearer <${SMIRK_RAILWAY_CALLBACK_KEY}>\nContent-Type: application/json\n\n{\n  "outcome": "interested | not_interested | callback | booked | no_answer | voicemail",\n  "summary": "SMIRK post-call summary",\n  "workspaceId": 1,\n  "callDuration": 86,\n  "calledAt": "2026-08-15T12:34:56.000Z"\n}`;
}
