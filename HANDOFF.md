# Velvet Alchemy — Current Operator and Developer Handoff

**Authoritative state date:** 2026-08-17

**Verification baseline:** 106 passed, 2 explicitly skipped; production build passes.
**Default verification:** 106 passed, 2 intentionally skipped; production build passes.

This document describes the system that is actually deployed and tested. It supersedes old revenue, agency, payment, and automatic-outreach descriptions elsewhere in the repository.

## System Purpose

Velvet is the **evidence, qualification, and approval layer** in front of SMIRK. It does not autonomously contact prospects. It helps an operator decide whether a business should reach SMIRK, records why, and preserves the eventual call outcome.

```text
Hunt → Audit → Qualification Gate → Operator Review → Approved Handoff → SMIRK
                                      ↑                                  ↓
                              blocked reasons                    scoped outcome callback
```

## Non-Negotiable Safety Rules

1. No automatic SMS, email, or SMIRK handoff.
2. Every real handoff requires an explicit operator confirmation of the exact business and phone number.
3. The server re-evaluates qualification; the UI is not a security boundary.
4. Draft outreach follows `generateDraft → approveDraft → sendDraft`; direct email send is disabled.
5. Use synthetic fixture `+12025550124` and an `externalId` beginning `velvet-manus-fake-` for live integration proof only.
6. Never place API keys or bearer values in source, documentation, test output, browser-visible notes, or chat.

## Qualification Contract

`shared/smirkQualification.ts` is the common eligibility rule. All of the following must pass:

| Field | Requirement | Failure result |
|---|---|---|
| `status` | `audited` | Not audited |
| Business status | `OPERATIONAL` | Not operational |
| `phone` | Callable E.164-normalizable value | No callable phone |
| `googleRating` | ≥ 4.2 | Rating below floor |
| `reviewCount` | ≥ 30 | Insufficient reviews |
| `prestigeScore` | 1–60 | No actionable audit opportunity |

The current logic intentionally does not claim to identify purchase intent. A passing lead is **eligible for operator review**, not pre-sold.

## SMIRK Contract

### Velvet → SMIRK: Approved Handoff

```http
POST https://smirkcalls.com/api/integrations/velvet/handoffs
Authorization: Bearer <SMIRK_API_KEY>
Content-Type: application/json
```

```json
{
  "workspaceId": 1,
  "externalId": "va-lead-<lead-id>",
  "caller": { "phone": "+1...", "name": "...", "email": "..." },
  "companyName": "...",
  "reason": "...",
  "urgency": "low|normal|high|emergency",
  "transcriptSnippet": "...",
  "recommendedAction": "...",
  "notes": "..."
}
```

| Response | Meaning |
|---|---|
| `201 RECEIVED` | First receipt; one durable handoff/task exists. |
| `200 DUPLICATE` | Exact replay; no duplicate task. |
| `409 VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT` | Same external ID with different payload. |
| `401 VELVET_ALCHEMY_HANDOFF_UNAUTHORIZED` | Inbound bearer rejected. |
| Any `5xx` / `404` | Action-blocking receiver failure. |

### SMIRK → Velvet: Outcome Callback

```http
POST https://velvetalchemy.manus.space/api/v1/leads/:id/outcome
Authorization: Bearer <outcome:write-only Velvet API key>
Content-Type: application/json
```

The accepted outcome values are `interested`, `not_interested`, `callback`, `no_answer`, `voicemail`, and `booked`. Velvet validates the workspace binding, owner, payload shape, and summary size. The path is deployed and unit-covered; it has not been exercised with a manufactured outcome or a real completed call.

### Directional Secret Mapping

| Location | Variable | Purpose |
|---|---|---|
| Velvet protected secrets | `SMIRK_BASE_URL`, `SMIRK_API_KEY`, `SMIRK_WORKSPACE_ID` | Submit approved Velvet → SMIRK handoffs. |
| SMIRK Railway | `VELVET_ALCHEMY_HANDOFF_API_KEY` | Must match Velvet `SMIRK_API_KEY`; inbound bearer only. |
| SMIRK Railway | `VELVET_ALCHEMY_OUTCOME_KEY` | Separate Velvet API key with only `outcome:write`. |
| SMIRK Railway | `VELVET_ALCHEMY_BASE_URL` | `https://velvetalchemy.manus.space`. |
| SMIRK Railway | `VELVET_ALCHEMY_WORKSPACE_ID` | Current bound workspace: `1`. |

## Proven Integration Evidence

The latest named protected-runtime synthetic fixture returned `201 RECEIVED`, with `handoffId 33` and `taskId 245`. Its exact replay returned `200 DUPLICATE` with the same IDs. A separate invalid-bearer control returned `401`. No real prospect was contacted.

## Key Files

| File | Responsibility |
|---|---|
| `shared/smirkQualification.ts` | Eligibility requirements and block reasons. |
| `shared/smirkLifecycle.ts` | Shared queue/lifecycle presentation rules. |
| `server/lib/smirkHandoff.ts` | Call brief construction, diagnostics, dispatch, and response mapping. |
| `server/apiRouter.ts` | Scoped REST handoff, ready-lead, outcome, and diagnostic endpoints. |
| `server/routers.ts` | Protected tRPC lead/SMIRK procedures and dashboard data. |
| `client/src/pages/SmirkQueue.tsx` | Qualified queue and blocked lead evidence. |
| `client/src/pages/LeadDetail.tsx` | Handoff confirmation and outcome panel. |
| `client/src/components/OperatorShell.tsx` | Receiver state, including neutral loading presentation. |
| `client/src/pages/ApiKeys.tsx` | Scoped integration setup and callback contract. |

## Development and Database Notes

```bash
pnpm test
pnpm build
pnpm test:smirk-live  # explicit durable synthetic receiver proof
```

The Drizzle migration journal is drifted. For actual schema changes, update `drizzle/schema.ts`, apply cautious SQL through the managed database path, and document the change. Do not assume `pnpm db:push` is safe.

Database-backed tests must clean their records. Curator and payment tests now remove their own synthetic leads and dependents; zero known synthetic fixture leads remain after the full suite.

## Current Limits

| Limit | Practical implication |
|---|---|
| No real outcome callback proof | Do not claim closed-loop conversion until an actual completed SMIRK call returns. |
| Fixed hunt workflow | Configurable predicate hunting is planned, not shipped. |
| Railway GitHub CI skips | Active direct callback deployment is healthy; normal GitHub-driven deployment drift needs repair. |
| AI provider dependencies | Audit behavior degrades when required LLM credentials are absent or exhausted. |

## Next High-Leverage Work

Build the configurable hunt-predicate engine only after confirming the qualification rule is producing useful operator-reviewed leads. Do not add volume or automatic outreach before the first real supervised handoff/outcome loop is reviewed.
