# Troubleshooting — Velvet Alchemy

This guide covers the current private operator workflow. Do not work around a qualification, credential, or receiver failure by manually crafting an unreviewed handoff.

## SMIRK Receiver States

| Console state | Meaning | Action |
|---|---|---|
| `Verifying receiver` | Diagnostics are still loading. | Wait; this is not a failure. |
| `Receiver reachable` | The non-contacting route probe reached SMIRK. | Continue to review leads; this alone does not prove a real handoff. |
| `Receiver blocked` | Missing config, rejected bearer, receiver error, or network failure. | Do not approve a handoff. Open the SMIRK connection panel and investigate. |

### Synthetic Integration Proof Fails

Use only the approved synthetic fixture. Never substitute a real lead to debug plumbing.

| Response | Likely cause | Correct response |
|---|---|---|
| `401` | Inbound bearer does not match or is stale. | Rotate through protected stores, apply it to both required inbound locations, restart, then retry a synthetic fixture. |
| `404` | Wrong receiver path or wrong deployment. | Treat as failure; verify `POST /api/integrations/velvet/handoffs`. |
| `503` | Receiver lacks required runtime configuration. | Check Railway variable names and restart/redeploy the actual service. |
| `409` | Reused external ID with different content. | Generate a new synthetic external ID; do not weaken idempotency. |

## Lead Is Blocked

The qualification gate is expected to block leads with insufficient evidence. Read the reason shown in Live Queue or Lead Detail.

| Block reason | Correct action |
|---|---|
| Not audited | Run or repair the audit; do not guess the score. |
| Not operational | Leave blocked unless reliable evidence changes the business state. |
| No callable phone | Find real verified contact data or leave blocked. |
| Rating/review floor not met | Leave blocked; do not alter reviews or thresholds per lead. |
| No actionable audit opportunity | Review the evidence; do not force a handoff. |

## Audit or Hunt Fails

1. Check the specific error in the lead or pipeline job.
2. Confirm the business URL and business state are real.
3. Verify configured AI/provider availability through the operator environment.
4. Retry only after identifying the failed dependency. Do not create a manual audit summary or placeholder score.

## Outcome Is Missing

SMIRK outcomes appear only after SMIRK posts a real terminal call result. Do not create a manual outcome to test the display. Check the SMIRK call record, then verify its separate `outcome:write` callback configuration and workspace binding.

## Development Failures

| Failure | Action |
|---|---|
| Tests fail due to external service absence | Confirm the test uses `it.skipIf` where the service is optional; do not convert it to an early-return pass. |
| Synthetic records appear in leads | Stop and check test teardown. Curator/payment tests must clean their own data. |
| Schema change needed | Update schema and apply managed SQL cautiously; the Drizzle journal is drifted, so do not assume `pnpm db:push` is safe. |
| Secret exposed | Treat as compromised: rotate through protected stores, restart affected processes, and report only non-sensitive evidence. |
