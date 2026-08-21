# Velvet Alchemy — Private SMIRK Operator Console

**Status:** Operational lead-screening and controlled SMIRK handoff system.

**Last reconciled:** 2026-08-20.
**Repository:** [`doesitapply/velvet-alchemy-landing`](https://github.com/doesitapply/velvet-alchemy-landing).

Velvet Alchemy is a **private operator tool**. It stores and audits business leads, applies an explicit qualification gate, and lets an operator deliberately hand an eligible lead to SMIRK. It is not a public SaaS product, a revenue guarantee, or an unattended outbound system.

> **Operating rule:** Velvet supplies evidence and eligibility. The operator approves a specific handoff. SMIRK receives the approved call brief. No SMS, email, call, or paid action is sent automatically by Velvet.

## What Is Verified

| Capability | Verified state | Boundary |
|---|---|---|
| Lead inventory | Working | Known synthetic `Test Company` and `Test Payment Company` records were removed; tests now clean their own fixtures. |
| Audit and qualification | Working | Leads must satisfy the hard eligibility rule before SMIRK handoff. |
| Operator review | Working | Live Queue and Lead Detail expose qualification evidence, block reasons, and explicit confirmation. |
| Velvet → SMIRK handoff | Proven synthetically and exercised once with explicit operator approval | A protected-runtime synthetic request returned `201 RECEIVED`; exact replay returned `200 DUPLICATE`. One approved real lead is now queued; see the current lifecycle note below. |
| Inbound receiver security | Proven | An unauthorized synthetic control returned `401`. |
| SMIRK → Velvet outcome callback | Deployed and unit-covered | No real terminal call outcome has returned. Velvet will not fabricate one. |

The latest default test run completed with **106 passing tests and 2 explicit skips**. `pnpm build` succeeds.

### Current Real Handoff Lifecycle

After explicit operator approval, Velvet submitted **one** real handoff: **Weaklands Heating & Air Conditioning, Inc** (lead `480011`). SMIRK returned `201 RECEIVED`, and Velvet recorded `status = smirk_queued`, `smirkHandoffAt = 2026-08-20 09:04:29`, and workspace `1`. Velvet sent no SMS or email and no second lead was submitted.

This is a receipt state, **not a completed sale or call result**. SMIRK now owns any configured calling, timing, recording, escalation, and retry behavior. The only valid next lifecycle record is a real terminal outcome delivered through the scoped SMIRK → Velvet callback.

## Qualification Gate

Before any UI, tRPC, or REST handoff can reach SMIRK, the lead must have all of the following:

| Requirement | Rule |
|---|---|
| Audit state | Audited |
| Business state | Operational |
| Callability | Valid callable phone number |
| Reputation floor | Rating ≥ 4.2 and review count ≥ 30 |
| Actionability | Audit/prestige score from 1 through 60 |

The gate is **fail closed**. A lead that fails is not sent to SMIRK, and the console displays the first blocking reason. Qualification means only that the lead passes this evidence rule; it does **not** mean that the business is interested, budgeted, reachable, or likely to convert.

## Operator Workflow

1. **Hunt:** Use **Hunt** to obtain businesses through the current Google Maps workflow.
2. **Audit:** Run or wait for audit processing to produce stored evidence.
3. **Qualify:** Open **Live Queue**. Only eligible leads appear as ready; other records show explicit blocks.
4. **Review:** Inspect the business, call brief, phone number, audit evidence, and qualification details.
5. **Approve:** Confirm the exact target in Lead Detail. This is the only path that can send a handoff to SMIRK.
6. **Observe:** SMIRK outcomes return to Velvet when SMIRK posts them through its restricted callback integration.

## System Boundaries

| Direction | Function | Credential model |
|---|---|---|
| Velvet → SMIRK | Submit approved call briefs | `SMIRK_API_KEY` in Velvet exactly matches SMIRK Railway `VELVET_ALCHEMY_HANDOFF_API_KEY`. |
| SMIRK → Velvet | Post terminal call outcomes | SMIRK Railway `VELVET_ALCHEMY_OUTCOME_KEY` is a separate Velvet key with **only** `outcome:write`; it also uses `VELVET_ALCHEMY_BASE_URL`. |

Never reuse either credential in the other direction. Do not use a dashboard, wildcard, or administrative API key for either boundary.

## Main Routes

| Route | Purpose |
|---|---|
| `/command-center` | Operations view: receiver state, queue counts, and outcome counts. |
| `/smirk-queue` | Qualified queue, blocked reasons, and handoff review. |
| `/leads` | Lead Intelligence inventory. |
| `/leads/:id` | Audit evidence, qualification decision, and explicit SMIRK confirmation. |
| `/hunt` | Current lead discovery workflow. |
| `/api-keys` | Scoped API key management and SMIRK connection guidance. |

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

The default suite does not submit a synthetic handoff. Use `pnpm test:smirk-live` only when intentionally creating the approved durable synthetic receiver record.

## Documentation Map

| Document | Use it for |
|---|---|
| [`HANDOFF.md`](./HANDOFF.md) | Authoritative operational and integration handoff. |
| [`SYSTEM_STATUS.md`](./SYSTEM_STATUS.md) | Current verified state and remaining limits. |
| [`API_REFERENCE.md`](./API_REFERENCE.md) | REST API scopes and SMIRK contract. |
| [`DEVELOPER_HANDOFF.md`](./DEVELOPER_HANDOFF.md) | Local development and change-safety guide. |
| [`OPERATOR_TRAINING_GUIDE.md`](./OPERATOR_TRAINING_GUIDE.md) | Day-to-day operator workflow. |
| [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) | Failure modes and corrective actions. |
| [`DOCUMENTATION_STATUS.md`](./DOCUMENTATION_STATUS.md) | Which older documents are historical rather than current instructions. |

## Known Limits

The configurable predicate hunt engine is not built yet; the current hunt flow is not arbitrary business-pattern search. One real handoff is queued, but no completed call or terminal outcome has been observed. Railway’s active direct callback deployment is healthy, while its normal GitHub-triggered deployment path remains skipped by a failing CI suite. These are tracked limitations, not evidence of sales performance.

## License

Proprietary. Private operator use only.
