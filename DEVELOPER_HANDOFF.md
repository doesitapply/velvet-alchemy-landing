# Developer Handoff — Velvet Alchemy

## Purpose

This repository is a private React/Express/tRPC operator console for discovering, auditing, qualifying, and deliberately handing business leads to SMIRK. Start with [`HANDOFF.md`](./HANDOFF.md), then read this file before changing behavior.

## Stack

| Layer | Technology |
|---|---|
| Client | React 19, Tailwind CSS 4, Wouter, shadcn/ui |
| Server | Express 4, tRPC 11, Superjson |
| Data | MySQL/TiDB with Drizzle |
| Auth | Manus OAuth and JWT cookies |
| Storage | S3 helpers |
| AI | Manus LLM with configured fallbacks |

## Local Commands

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm test:smirk-live  # deliberate durable synthetic integration check only
```

The default suite intentionally does not create a durable SMIRK handoff. Tests requiring absent external services skip explicitly rather than passing vacuously.

## Change-Safety Rules

1. **Do not re-enable automatic outreach.** SMS, email, and SMIRK need explicit operator approval.
2. **Do not bypass `evaluateSmirkQualification`.** It is required in UI-facing and REST-facing handoff paths.
3. **Do not merge the two SMIRK credential directions.** Inbound handoff bearer and outcome callback key are different secrets with different permissions.
4. **Do not fabricate outcomes, reviews, lead metrics, testimonials, or fixtures in operator-visible data.** Database tests must clean records they create.
5. **Do not call real prospects from tests.** Use only the approved synthetic phone and `velvet-manus-fake-` external ID prefix.
6. **Do not rely on `pnpm db:push`.** The Drizzle journal is drifted; apply schema changes cautiously through the managed SQL path and mirror them in `drizzle/schema.ts`.

## SMIRK Files

| File | Responsibility |
|---|---|
| `shared/smirkQualification.ts` | Gate criteria and failure reasons. |
| `shared/smirkLifecycle.ts` | Queue state semantics. |
| `server/lib/smirkHandoff.ts` | Diagnostics, call-brief construction, dispatch, and response mapping. |
| `server/apiRouter.ts` | Scoped REST contract. |
| `client/src/pages/SmirkQueue.tsx` | Qualified and blocked queue presentation. |
| `client/src/pages/LeadDetail.tsx` | Explicit target review and outcome evidence. |

## Secret Handling

Use protected secret-management surfaces only. Do not place secret values in `.env` files, commits, documentation, shell output, or chat. If a bearer is exposed, treat it as compromised, rotate it through protected stores, restart the affected process, and verify only with status codes/record IDs.

## Deployment

Velvet deploys through Manus checkpoint and Publish workflow. SMIRK is a separate Railway receiver. Its active direct callback deployment is healthy; its normal GitHub-triggered deployment path has a CI skip issue and should be repaired before relying on source-triggered release automation.
