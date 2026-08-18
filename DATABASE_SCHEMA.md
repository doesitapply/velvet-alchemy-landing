# Database Schema — Current Operating Model

**Source of truth:** [`drizzle/schema.ts`](./drizzle/schema.ts). This document is an operational summary, not a substitute for the schema file or managed database inspection.

## Migration Rule

The Drizzle migration journal is known to be drifted. Do **not** assume `pnpm db:push` is safe. For real schema changes:

1. Update `drizzle/schema.ts`.
2. Review dependencies and destructive implications.
3. Apply a deliberate SQL migration through the managed database path.
4. Verify the resulting schema and application behavior.
5. Document the change in `HANDOFF.md` if it affects operations.

## Core Operational Tables

| Table | Purpose |
|---|---|
| `users` | Authenticated operators and ownership boundary. |
| `leads` | Business identity, discovery data, audit state, contact evidence, qualification inputs, and SMIRK lifecycle fields. |
| `audits` | Stored audit summaries and visual/evidence payloads. |
| `pipeline_jobs` | Pipeline work state. |
| `api_keys` | Scoped REST credentials; secrets are stored as hashes. |
| `outreach_drafts` | Draft-first outreach records; direct send is disabled. |
| `api_calls` | Provider cost and rate/accounting information. |
| `system_config` | Operational config including safety controls. |
| `payments` | Existing Stripe test-mode workflow data; not evidence of revenue. |

## Lead Fields Relevant to SMIRK

| Field family | Purpose |
|---|---|
| Ownership | `userId` scopes lead reads, mutations, drafts, and outcomes. |
| Identity/contact | Company name, website, phone, address, business status, category. |
| Reputation | Google rating and review count feed qualification. |
| Audit evidence | Audit state and `prestigeScore` feed qualification and call brief context. |
| SMIRK lifecycle | Handoff time, workspace binding, call outcome, and call summary preserve the operator trail. |

## Qualification Is Derived, Not Persisted as a Bypass Flag

`shared/smirkQualification.ts` evaluates the current lead evidence at handoff time. Qualification requires an audited, operational lead with a callable phone, rating ≥ 4.2, at least 30 reviews, and audit score 1–60. Do not add an editable “qualified” boolean that could drift from the evidence or bypass server enforcement.

## Data Integrity Rules

1. Never seed operator-visible mock leads, reviews, outcomes, or metrics.
2. Database-backed tests must remove leads and dependent records they create.
3. Never manufacture a call outcome; wait for a real SMIRK callback.
4. Keep secret values out of database metadata and documentation.

Known historical test fixtures were removed from the shared operator inventory, and test cleanup now prevents their recurrence.
