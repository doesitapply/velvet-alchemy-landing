# Console Rebuild Validation Notes

## 2026-08-16 — Authenticated Preview

The rebuilt **Operations** and **Live Queue** routes rendered under the authenticated preview with the persistent SMIRK operator shell, workflow navigation, real lead counts, and lead records from the database.

The Live Queue displayed 46 audited leads with phone numbers as **Awaiting review**, with no queued calls and no outcomes recorded. This is a real lifecycle state derived from the current database; it is not placeholder data.

The UI correctly surfaced the current fail-closed SMIRK state: the receiver probe timed out and showed **Handoff is blocked**. Review and navigation remain available, but a real handoff cannot be approved while receiver diagnostics are not reachable.

## 2026-08-16 — Connection Surface and Queue Revisit

The new **SMIRK Connection** surface rendered inside the shared operator shell and presented the callback contract, scoped key presets, `VELVET_ALCHEMY_HANDOFF_API_KEY`, workspace binding, ready-leads endpoint, and non-contacting diagnostics endpoint.

On a subsequent fresh navigation to Live Queue, the list query returned no records despite the prior authenticated view rendering 46 audited records. This is being treated as a data-loading regression to investigate before release rather than represented as an empty live queue.

The queue resolved normally after its query settled and rendered all 46 real review-ready records. The temporary zero state was the initial client loading phase, not missing data. A real lead-detail record was then opened and correctly entered its explicit loading state while its detail query resolved.

The loaded lead-detail page rendered the real audit summary and handoff readiness. Selecting **Review SMIRK handoff** opened a confirmation dialog showing the exact business, phone number, lead ID, the downstream-contact warning, and a separate **Confirm Handoff to SMIRK** action. The confirmation action was not invoked; no handoff, call, text, or email was triggered during validation.

## 2026-08-16 — Opt-in Live SMIRK Contract Check

The opt-in `pnpm test:smirk-live` check was executed using only the approved synthetic fixture. Both the initial submission and exact replay returned HTTP 503 rather than the required `201 RECEIVED` and `200 DUPLICATE`, so the test correctly failed. This remains the documented external Railway deployment gate: SMIRK must be configured with a dedicated Velvet Alchemy `outcome:write` key under `VELVET_ALCHEMY_HANDOFF_API_KEY` and `VELVET_ALCHEMY_WORKSPACE_ID=1`. No real prospect was contacted.

## 2026-08-16 — Railway Receiver Inspection

The authenticated Railway project is **ai-phone-agent**, service **ai-phone-agent**, bound to `www.smirkcalls.com` and reporting online in production. The active deployment is `smirk-reviewed-deploy:68c0d086d4af604da6169446380dfa354c0a0eaf` from six days ago. A newer GitHub deployment titled `fix: harden Railway archive deploy and launch gate` is marked skipped because its CI check suite failed. Receiver-variable installation will target the active production service only; deployment history is retained as an independent release-health concern.

The production Velvet connection page confirms the callback endpoint is `https://velvetalchemy.manus.space/api/v1/leads/:id/outcome`, the required Railway variable name is `VELVET_ALCHEMY_HANDOFF_API_KEY`, and no existing Velvet API keys are active. A new callback key can therefore be created with `outcome:write` as its sole scope without reusing or broadening another credential.

When selecting the outcome-key preset, the deployed Velvet session redirected to the Manus OAuth account chooser. The available account is the authenticated operator account already associated with the project. No credential was created before the redirect, and no Railway variables were changed.

After completing OAuth, the production key list showed two existing active keys, **OpenClaw Full Access** and **hermes**, each with wildcard (`*`) scope. Neither meets the least-privilege requirement and neither will be used for SMIRK. A new dedicated key restricted to `outcome:write` only is required.

The dedicated **SMIRK Outcome Webhook** preset opened the key form with only **SMIRK Outcome** selected. Read, write, scrape, audit, pipeline, SMIRK handoff, and full-access controls were all unselected. This confirms the pending credential is constrained to `outcome:write` before creation.

The key dialog exposes the scope controls but its primary creation action is not reachable through the normal browser accessibility snapshot after the dialog opens. The selection state remains unchanged; no key has been created and no broader scope has been added.

The dedicated **SMIRK Outcome Webhook** credential was then created through the authorized form submission. Its persisted key listing shows exactly `outcome:write`, with no wildcard, read, handoff, admin, or credential-management scope. The one-time raw secret was used only for the pending Railway-variable installation and is not recorded in this repository or report.

The production SMIRK Railway service-variable form is open and awaiting the restricted callback key plus workspace binding. No existing Railway variable has been overwritten and no service restart has occurred at this point.

The new `VELVET_ALCHEMY_HANDOFF_API_KEY` variable name and the one-time outcome-only credential have been entered into Railway's pending form. The value is not recorded here. The Railway **Add** action has not yet been invoked, so the production receiver has not yet been changed.

Railway accepted the callback credential as one staged service change and then applied it through the production deploy action. The service variable count increased from 64 to 65 and the staging indicator cleared, which confirms the active service received the change. The workspace binding remains the next required configuration step.

The second service-variable form is now configured with the exact workspace-binding variable name `VELVET_ALCHEMY_WORKSPACE_ID`. Its value has not yet been submitted, and the receiver has not yet been restarted for this second configuration change.

Railway detected an existing `VELVET_ALCHEMY_WORKSPACE_ID` variable when the approved value `1` was submitted. The existing value was not disclosed, and no overwrite has yet been committed. The next action will apply the explicitly requested binding of `1` to the active SMIRK receiver.

The overwrite confirmation was accepted for the requested workspace binding of `1`. Railway returned to the normal service-variable view with no staging indicator, indicating the updated value was saved. The production service remains online; its visible active source deployment is still `smirk-reviewed-deploy:68c0d086d4af604da6169446380dfa354c0a0eaf`. An explicit service restart is still required before the synthetic proof.

The active deployment's Railway action menu exposes an explicit **Restart** operation. The restart confirmation dialog is open and states that it will restart the production container. No restart has been executed prior to the confirmation action.

The restart confirmation was executed. Railway displayed **Restart successful** and the production `ai-phone-agent` service returned to **Online** status. The callback credential and workspace binding are now installed on the active receiver, so the approved synthetic receipt/replay contract check is ready to run.

The post-restart synthetic check still returned `VELVET_ALCHEMY_HANDOFF_NOT_CONFIGURED` with HTTP 503. Railway's service-variable search has been opened to verify the active variable names and identify whether a deployment environment, service, or variable-scope mismatch remains.

Railway's active service-variable search confirms that both `VELVET_ALCHEMY_HANDOFF_API_KEY` and `VELVET_ALCHEMY_WORKSPACE_ID` exist on the production `ai-phone-agent` service. Their values remain masked. The receiver nevertheless reports the callback key as missing, narrowing the remaining fault to environment propagation or the active runtime/deployment rather than a missing variable name.

The Railway runtime console reports an active connection to the production container. A non-secret environment-presence check was prepared to print only boolean presence and workspace status, but the browser terminal refreshed before submission. No runtime value or credential has been printed.

The refreshed Railway terminal remains connected, but the browser control cannot target its terminal surface as an editable field. The non-secret runtime check has not been executed; no secret was exposed or altered during this diagnostic attempt.

Because the active runtime still reports the callback key missing despite verified service-variable names and a successful restart, the active deployment's **Redeploy** action has been opened. A clean redeploy is the next remediation to force a new container with the current Railway environment; it has not yet been executed.

The user approved the same-source redeploy. The first confirmation attempt encountered a stale Railway browser snapshot before any deploy action executed. The page is being refreshed before re-opening and confirming the exact same authorized redeploy.

After a clean receiver deployment, the synthetic proof changed from HTTP 503 to HTTP 401. Inspection of the verified SMIRK receiver source shows that `VELVET_ALCHEMY_HANDOFF_API_KEY` is the **inbound Velvet-to-SMIRK shared bearer secret**; it is not a Velvet `outcome:write` credential. Therefore the outcome-only Velvet key installed under that name is intentionally rejected by the receiver. The receiver commit contains no separate Velvet outcome-callback client or `VELVET_ALCHEMY_OUTCOME_KEY` configuration, so the requested one-variable mapping is directionally incorrect and cannot complete both security boundaries.

The corrected two-direction design is approved. Railway's active service-variable filter is now open to determine whether the prior dedicated inbound SMIRK token is already available under a separate service-variable name, without revealing its value.

The active SMIRK service has no `SMIRK_API_KEY` variable and no separate variable matching `HANDOFF`; the only handoff variable is the one previously overwritten with the Velvet outcome credential. The original dedicated inbound SMIRK token is therefore not recoverable from Railway variable names and must be safely rotated or reissued before the inbound receiver can be restored.

Railway confirms that the active `ai-phone-agent` deployment was uploaded via CLI from the separate `smirk-reviewed-deploy` artifact. GitHub-triggered deployments are currently skipped because their CI check suite fails. A branch push alone therefore cannot alter the active receiver; a controlled Railway CLI deployment is required after source and credential work are ready.

The user approved Railway CLI authorization for the identified SMIRK deployment path. Railway presented the standard device-authorization consent page; no deployment or source change has been performed through that credential yet.

The authorization consent remains open under the existing authenticated Railway session. The approval control is below the initial viewport, and the session is being positioned to complete only the already approved CLI sign-in.

Railway confirmed **Device Authorized** for the approved CLI session. The local CLI can now be limited to the identified SMIRK production project for the reviewed deployment and verification workflow. No secret values were exposed or retained.

The approved replacement-key dialog is open in Velvet. Its only selected scope is `outcome:write`; read, handoff, full-access, administrative, and credential-management scopes are unselected. The existing exposed outcome-only key remains present pending successful replacement and verification.

The existing key list confirms the predecessor is limited to `outcome:write` and is the only SMIRK callback key. The replacement dialog remains outcome-only; the creation control is being reached without modifying any other scope selection.

## 2026-08-17 — Two-Direction Credential Correction and Final Synthetic Proof

The active SMIRK receiver was deployed directly from the reviewed `velvet-outcome-callback` branch at commit `162307b9d9c471b71bf38d804ad225f1b6d2cf4a`, rather than from the repository’s current `main` branch. Railway deployment `540cffc2-ca94-4939-aeda-f59159562df6` completed successfully after the inbound bearer rotation.

The receiver’s live authentication boundary was verified with deliberately malformed, non-persisting requests: a request bearing Velvet’s protected inbound token returned `400 VELVET_ALCHEMY_HANDOFF_INVALID_PAYLOAD`, while the same request without a bearer returned `401 VELVET_ALCHEMY_HANDOFF_UNAUTHORIZED`. This proves the live route authenticates the inbound bearer before payload validation and no handoff was created by that check.

The final approved synthetic fixture `velvet-manus-fake-rotated-1786968503` with phone `+12025550124` returned `201 RECEIVED` for handoff record `31` and task `243`; its exact replay returned `200 DUPLICATE` for those same records. The fixture is explicitly synthetic and no call, SMS, email, or prospect contact occurred.

The active boundary is now directional: `VELVET_ALCHEMY_HANDOFF_API_KEY` is the private Velvet-to-SMIRK bearer, while `VELVET_ALCHEMY_OUTCOME_KEY` is the separate Velvet API key restricted to `outcome:write` for SMIRK-to-Velvet callbacks. A live post-call outcome delivery cannot be exercised without a real completed call, so it remains guarded by the deployed callback code and focused unit coverage rather than fabricated outcome data.

## 2026-08-17 — Console Receiver Status Refresh

The initial Command Center screenshot after protected bearer rotation showed **Receiver blocked** while the long-lived development server still held its pre-rotation environment. Restarting the Velvet development server reloaded the protected `SMIRK_API_KEY`. A fresh Command Center view then resolved **Receiver reachable** and displayed the expected non-contacting diagnostic message, alongside 104 audited leads and 46 leads ready for review. This was a process-environment refresh issue, not a receiver or UI mapping defect.

## 2026-08-17 — Protected Rotation Reverification

From Velvet’s protected runtime, the named synthetic fixture `velvet-manus-fake-rotation-proof-1786970304` returned `201 RECEIVED` with `handoffId` **33** and `taskId` **245**. The exact same payload and external ID returned `200 DUPLICATE` with the same record IDs. The fixture used only `+12025550124`; no real prospect, call, SMS, or email was involved.

The retired inbound bearer was intentionally unavailable to this session, so it was not retrieved or reintroduced merely to test it. An unauthorized synthetic control request using a non-secret invalid bearer returned `401 VELVET_ALCHEMY_HANDOFF_UNAUTHORIZED`, confirming the receiver rejects untrusted credentials. This is an authentication-rejection control, not a claim that the unretrieved predecessor itself was replayed.

## 2026-08-17 — Hard Qualification Gate Validation

The Live Queue now states its auditable qualification criteria and, after data loaded, showed **24 Qualified** records rather than the prior 46 phone-bearing audited records. Each ready-row carried a visible **Qualified** badge, while the receiver remained reachable. The threshold was derived from the current real inventory: audited, operational businesses with a callable phone, at least 30 reviews, a rating of at least 4.2, and an actionable audit score from 1 through 60. The queue did not submit any lead during this validation.

The all-states view explicitly marks failed records with a **Blocked** badge and the first concrete reason, such as operational status, rating, review-count, or actionable-opportunity threshold. The older `Ready for review` status label was removed from all audited records; audit completion and qualification are now visibly distinct.
