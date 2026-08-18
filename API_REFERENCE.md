# Velvet Alchemy API Reference

All REST endpoints are under `/api/v1` and use bearer API keys. Create keys in `/api-keys`; never use wildcard or dashboard credentials where a scope-specific key exists.

## Core Endpoints

| Method | Endpoint | Required scope | Behavior |
|---|---|---|---|
| `GET` | `/status` | Any valid key | Service status. |
| `GET` | `/leads` | `leads:read` | List stored leads. |
| `GET` | `/leads/:id` | `leads:read` | Retrieve one lead. |
| `POST` | `/leads` | `leads:write` | Create a lead. |
| `DELETE` | `/leads/:id` | `leads:write` | Delete a lead. |
| `POST` | `/scrape` | `scrape` | Start the current discovery workflow. |
| `POST` | `/audit/:id` | `audit` | Run an audit. |
| `POST` | `/pipeline/:id` | `pipeline` | Run the pipeline. |

## SMIRK Endpoints

| Method | Endpoint | Scope | Safety behavior |
|---|---|---|---|
| `GET` | `/integrations/smirk/diagnostics` | `handoff:write` | Non-contacting `OPTIONS` probe; receiver errors are action-blocking. |
| `GET` | `/leads/ready` | `handoff:write` | Returns only leads that pass the server qualification gate. |
| `POST` | `/leads/:id/handoff` | `handoff:write` | Re-evaluates qualification and submits only an eligible lead. |
| `POST` | `/leads/:id/outcome` | `outcome:write` | SMIRK callback; validates workspace, owner, and outcome payload. |

### Qualification Response Model

The UI and tRPC layer expose a qualification decision containing `qualified`, `reasons`, and evidence fields. REST callers must treat an unqualified lead as non-actionable even if the lead exists in the database.

## Handoff Contract

Velvet submits an operator-approved lead to:

```text
POST https://smirkcalls.com/api/integrations/velvet/handoffs
Authorization: Bearer <Velvet SMIRK_API_KEY>
```

The body includes `workspaceId`, idempotent `externalId`, caller phone/name/email, company name, reason, urgency, and optional call-brief context. Success is `201 RECEIVED`; exact replay is `200 DUPLICATE`; changed content at the same `externalId` is `409 VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT`.

## Outcome Callback Contract

SMIRK posts to:

```text
POST https://velvetalchemy.manus.space/api/v1/leads/:id/outcome
Authorization: Bearer <outcome:write-only Velvet API key>
```

```json
{
  "outcome": "interested | not_interested | callback | no_answer | voicemail | booked",
  "summary": "optional bounded call summary",
  "workspaceId": 1,
  "callDuration": 0,
  "calledAt": "ISO-8601 timestamp"
}
```

The callback key is separate from the inbound SMIRK bearer. See [`HANDOFF.md`](./HANDOFF.md) for the complete directional mapping and operational rules.
