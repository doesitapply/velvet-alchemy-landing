# Velvet Alchemy to SMIRK Handoff

This integration is optional and off by default. It only creates a callback-ready handoff, task, contact record, and audit receipt in SMIRK. It never places a call, sends SMS, sends email, starts outreach, or enables any paid provider action.

## Required Velvet environment values

```dotenv
SMIRK_BASE_URL=https://smirkcalls.com
SMIRK_API_KEY=<dedicated Velvet handoff token>
SMIRK_WORKSPACE_ID=<target SMIRK workspace id>
```

Use the public SMIRK origin, not a historical Railway deployment URL. `SMIRK_API_KEY` must be the dedicated Velvet handoff token, never `DASHBOARD_API_KEY`, a Stripe key, a Twilio key, or a general workspace bearer token.

## Required SMIRK Railway values

```dotenv
VELVET_ALCHEMY_HANDOFF_API_KEY=<same dedicated Velvet handoff token>
VELVET_ALCHEMY_WORKSPACE_ID=<same target SMIRK workspace id>
```

Generate the token with a password manager or `openssl rand -hex 32`. Set the two Railway values and the three Velvet values only after the SMIRK receiver has been deployed. Keep the token in the deployment secret managers; do not commit it to `.env`, source, tickets, or chat.

## Contract

Velvet calls `POST /api/integrations/velvet/handoffs` with a bearer token and a strict payload. The receiver requires an E.164 caller phone number, binds every request to the configured workspace, creates an idempotency receipt keyed by `workspaceId + source + externalId`, and returns either `RECEIVED` or `DUPLICATE` only after storage succeeds.

An unset integration returns `SMIRK_HANDOFF_NOT_CONFIGURED` from Velvet. A deployed-but-unconfigured SMIRK receiver returns `VELVET_ALCHEMY_HANDOFF_NOT_CONFIGURED`. Neither state attempts a fallback delivery.

## Activation sequence

1. Deploy the SMIRK receiver code.
2. Set the two SMIRK Railway variables and the three Velvet secret-manager variables.
3. Use a fake E.164 number and a unique external ID for one harmless end-to-end test.
4. Confirm a single SMIRK handoff, task, contact, call event, and receipt were created.
5. Re-submit the same external ID and confirm `DUPLICATE` rather than a second queue entry.
6. Only then expose an operator UI action for real handoffs.
