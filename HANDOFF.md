# Velvet Alchemy — Operator Handoff Document

**Hardening baseline:** `aea0743` | **Date:** 2026-07-29

**Current local proof:** TypeScript clean; portable unit tests `96/96`. Credentialed, deployed, and live results are separate gates below.

This document is the authoritative reference for any operator, agent, or AI continuing work on Velvet Alchemy. It reflects the actual current state of the codebase — not aspirational design.

---

## What This System Is

Velvet Alchemy is a **private operator intelligence platform**. It finds businesses matching configurable signal predicates, runs audits on public digital surfaces, and prepares evidence-based outreach drafts for human review.

Velvet does not send email or SMS and does not place or queue prospect calls. The deployed SMIRK handoff receiver accepts a call-shaped `caller` payload, so it remains restricted to explicitly enabled synthetic integration tests.

The hardening branches now contain a separate research-only prospect intake. A privileged owner or administrator can explicitly move one audited lead into SMIRK's operator review queue. That path has a dedicated token, exact workspace lock, stable opaque ID, local audit receipt, 10-per-hour cap, and no contact semantics. It is not deployed, configured, or live-tested yet. No deployed SMIRK-to-Velvet outcome callback has been verified.

It is not a SaaS product. It has no public marketing page. The root URL shows a minimal auth gate and redirects authenticated operators to the Command Center.

The system is designed to be operated by a single person or a small team, with external agents (Hermes, OpenClaw, or any HTTP client) able to query and act via the REST API.

---

## System Architecture

```
[Hunt Engine] -> [Public Evidence] -> [Audit Pipeline] -> [Lead Record]
                                                           |
                                          [Verified public email lookup]
                                                           |
                                          [Review-only draft generation]
                                                           |
                                         [Human approve / reject / copy]

[Synthetic contract test only] -> POST /api/integrations/velvet/handoffs
[Admin-reviewed research]       -> POST /api/integrations/velvet/prospects
[Prospect call handoff]         -> BLOCKED
[Email delivery]                -> BLOCKED
[SMS delivery]                  -> BLOCKED
```

---

## Tech Stack

| Layer            | Technology                                              |
| ---------------- | ------------------------------------------------------- |
| Frontend         | React 19, Tailwind CSS 4, shadcn/ui, Wouter routing     |
| Backend          | Express 4, tRPC 11, Superjson                           |
| Database         | MySQL (TiDB), Drizzle ORM                               |
| Auth             | Manus OAuth, JWT session cookies                        |
| File Storage     | S3 (via `storagePut` / `storageGet`)                    |
| AI               | Manus built-in LLM → Google Gemini 2.5 Flash fallback   |
| Payments         | Stripe (test mode, sandbox claimed)                     |
| Email            | Review-only generation; delivery adapter is fail-closed |
| SMS              | Cold SMS is disabled; no Twilio delivery path is active |
| Email Enrichment | Hunter.io primary, Snov.io fallback                     |
| Phone Agent      | SMIRK at `https://smirkcalls.com`                       |

---

## Repository

**GitHub:** `https://github.com/doesitapply/velvet-alchemy-landing`
**Base branch:** `main`
**Hardening branch:** `codex/revenue-loop-hardening-2026-07-29`
**Manus Project:** `velvet-alchemy-landing` (NoDSk44rgow8LomXTTpLHq)
**Live URL:** `https://velvetalchemy.manus.space`

---

## Key Files

### Server

| File                                 | Purpose                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| `server/routers.ts`                  | All tRPC procedures — leads, auth, system                          |
| `server/scraperRouter.ts`            | Google Maps scraping, business search                              |
| `server/orchestratorRouter.ts`       | Full pipeline: scrape → screenshot → audit → enrich                |
| `server/orchestrator.ts`             | Pipeline stage execution logic                                     |
| `server/charmerRouter.ts`            | Outreach draft generation and approval                             |
| `server/paymentRouter.ts`            | Stripe checkout session creation                                   |
| `server/apiRouter.ts`                | Public REST API (`/api/v1/*`)                                      |
| `server/apiKeyRouter.ts`             | API key management (create/revoke/list)                            |
| `server/governor.ts`                 | Rate limits, kill-switch, system config                            |
| `server/worker.ts`                   | Opt-in FIFO worker (polls every 5 min, 1 job/batch)                |
| `server/apiCostTracker.ts`           | Per-call cost tracking + daily kill-switch ($10/day)               |
| `server/lib/smirkHandoff.ts`         | Review brief builder + synthetic-only SMIRK contract client        |
| `server/lib/smirkResearch.ts`        | Research-only SMIRK client, payload validation, and response proof |
| `server/lib/emailEnrichment.ts`      | Hunter.io / Snov.io verified email lookup                          |
| `server/lib/smsOutreach.ts`          | Fail-closed cold-SMS compatibility adapter                         |
| `server/lib/emailOutreach.ts`        | Review-only copy + fail-closed delivery adapter                    |
| `server/lib/externalActionPolicy.ts` | Central prepare-only policy and unsupported-claim checks           |
| `server/lib/enrichment.ts`           | Audit enrichment; phones remain research-only                      |
| `server/visualAudit.ts`              | AI screenshot analysis, prestige score (0-100)                     |
| `server/screenshot.ts`               | Headless browser screenshot capture → S3                           |
| `server/products.ts`                 | Stripe package definitions ($3K/$5K/$8K)                           |
| `server/_core/env.ts`                | All environment variable definitions                               |
| `server/_core/llm.ts`                | LLM invocation with Manus → Gemini fallback                        |

### Client

| File                                     | Purpose                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `client/src/App.tsx`                     | Route definitions                                                   |
| `client/src/pages/LandingHome.tsx`       | Minimal auth gate (root URL)                                        |
| `client/src/pages/CommandCenter.tsx`     | Operator dashboard, workflow steps                                  |
| `client/src/pages/Leads.tsx`             | Lead list with SMIRK status badges                                  |
| `client/src/pages/LeadDetail.tsx`        | Full lead view, historical outcomes, and admin-only research import |
| `client/src/pages/BusinessScraper.tsx`   | Hunt engine UI                                                      |
| `client/src/pages/Charmer.tsx`           | Outreach draft review and approval                                  |
| `client/src/pages/RevenueDashboard.tsx`  | Stripe payments and invoicing                                       |
| `client/src/pages/GovernorDashboard.tsx` | Rate limits, kill-switch, cost monitoring                           |
| `client/src/pages/ApiKeys.tsx`           | API key management UI                                               |

### Database

| File                | Purpose                  |
| ------------------- | ------------------------ |
| `drizzle/schema.ts` | All 21 table definitions |

---

## Database Tables (Key)

| Table             | Purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `leads`           | Core lead records — business info, status, SMIRK fields      |
| `audits`          | AI audit results per lead — prestige score, visual debt JSON |
| `pipeline_jobs`   | FIFO queue for background processing                         |
| `api_keys`        | Bearer tokens for REST API access                            |
| `api_calls`       | Per-call cost tracking for kill-switch                       |
| `system_config`   | Key-value store for runtime config (kill-switch, budgets)    |
| `outreach_drafts` | Charmer-generated email drafts pending approval              |
| `payments`        | Stripe checkout sessions and payment status                  |
| `users`           | Authenticated operators (Manus OAuth)                        |

### SMIRK Fields on `leads` Table

These columns were added via `ALTER TABLE` (not via drizzle migration — the migration journal is out of sync with the DB):

```sql
smirk_handoff_at     DATETIME NULL
smirk_call_outcome   VARCHAR(50) NULL   -- interested|not_interested|callback|no_answer|voicemail|booked
smirk_call_summary   TEXT NULL
smirk_workspace_id   VARCHAR(100) NULL
outreach_channel     VARCHAR(20) NULL   -- email|sms|none
verified_owner_email VARCHAR(255) NULL
```

**Important:** `pnpm db:push` will fail due to migration journal drift. Apply schema changes directly via `webdev_execute_sql` or the Database panel in the Manus Management UI.

---

## Environment Variables

All defined in `server/_core/env.ts`. Set via Manus Secrets (Settings → Secrets in Management UI).

### System-Injected (Do Not Touch)

```
DATABASE_URL          MySQL/TiDB connection
JWT_SECRET            Session cookie signing
VITE_APP_ID           Manus OAuth app ID
OAUTH_SERVER_URL      Manus OAuth backend
VITE_OAUTH_PORTAL_URL Manus login portal
OWNER_OPEN_ID         Owner's Manus ID
OWNER_NAME            Owner's name
BUILT_IN_FORGE_API_URL  Manus built-in APIs
BUILT_IN_FORGE_API_KEY  Server-side Manus API key
VITE_FRONTEND_FORGE_API_KEY  Frontend Manus API key
VITE_FRONTEND_FORGE_API_URL  Frontend Manus API URL
```

### Operator-Configured

Repository contents do not prove whether a runtime secret is currently installed. Verify variable presence in the responsible provider without printing values.

| Variable                      | Purpose                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `SMIRK_BASE_URL`              | Exact SMIRK origin; currently restricted to `https://smirkcalls.com`                            |
| `SMIRK_API_KEY`               | Dedicated synthetic handoff bearer token; never use a dashboard-wide key                        |
| `SMIRK_WORKSPACE_ID`          | Synthetic handoff target workspace                                                              |
| `SMIRK_RESEARCH_API_KEY`      | Dedicated research-only bearer token; at least 32 characters and different from `SMIRK_API_KEY` |
| `SMIRK_RESEARCH_WORKSPACE_ID` | Exact workspace allowed to receive reviewed research records                                    |
| `STRIPE_SECRET_KEY`           | Credentialed Stripe integration tests and checkout                                              |
| `STRIPE_WEBHOOK_SECRET`       | Stripe webhook verification                                                                     |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe client initialization                                                                    |
| `HUNTER_API_KEY`              | Public business email enrichment                                                                |
| `GOOGLE_AI_API_KEY`           | Optional LLM fallback                                                                           |
| `ENABLE_PIPELINE_WORKER`      | Must equal `true` to start the cost-bearing background worker; disabled by default              |

Twilio variables are intentionally not required because cold SMS is disabled.

---

## SMIRK Integration

There are two separate contracts. Their credentials and semantics must never be mixed.

### Research-Only Prospect Intake

Implemented on the current Velvet and SMIRK hardening branches. Not deployed, configured, or live-tested.

```
POST https://smirkcalls.com/api/integrations/velvet/prospects
Authorization: Bearer <SMIRK_RESEARCH_API_KEY>
Content-Type: application/json
```

The Lead Detail action is visible only to a privileged owner or administrator. The server also requires an owned, audited lead, a clear global/user kill-switch, the dedicated token and workspace, and the `smirk_research_export` rate-limit gate. Every attempt records an intent plus a success/failure receipt in `audit_log`.

Request shape:

```typescript
{
  workspaceId: number,          // Number(SMIRK_RESEARCH_WORKSPACE_ID)
  externalId: string,           // stable opaque Velvet owner + lead reference
  batch: {
    externalId: string,
    name: string,
    targetIndustry?: string,
    targetLocation?: string,
  },
  prospect: {
    companyName: string,
    phone?: string,             // research data only; never dialed
    email?: string,             // research data only; never sent
    website: string,
    industry?: string,
    address?: string,
    city?: string,
    state?: string,
    evidence: Array<{ url: string; observation: string }>,
    notes: string,
  }
}
```

Success requires positive persisted `campaignId` and `prospectId` values plus `externalAction: "none"`.

| Status  | State       | Meaning                                                  |
| ------- | ----------- | -------------------------------------------------------- |
| 201     | `IMPORTED`  | New research record persisted; no contact action created |
| 200     | `DUPLICATE` | Exact replay returned the existing research record       |
| 409     | conflict    | Same external ID was reused with changed payload bytes   |
| 401/403 | rejected    | Invalid dedicated token or wrong workspace               |

Activation remains approval-gated:

1. Approve and deploy the exact SMIRK receiver commit.
2. Approve and deploy the exact Velvet client commit.
3. Generate and configure a new dedicated research token in both systems.
4. Run one synthetic import and exact replay.
5. Verify SMIRK queue visibility, Velvet audit receipt, and no contact/call/task/handoff rows.
6. Only then use the admin button for one real researched lead.

No outreach approval is implied by an import.

### Synthetic Call-Shaped Handoff

The existing `/api/integrations/velvet/handoffs` contract is synthetic-test only. It requires `caller`; a business prospect is a callee, so sending real leads through it would misrepresent the data and remains blocked. Its credential names remain `SMIRK_API_KEY` and `SMIRK_WORKSPACE_ID`.

### Outcome Callback

Not active. The compatibility route returns `409 SMIRK_OUTCOME_CALLBACK_NOT_CONFIGURED`. Activation requires an authenticated, idempotent event contract, owner-scoped updates, and a receipt proving the expected row changed.

---

## REST API (`/api/v1/*`)

All endpoints require `Authorization: Bearer <api_key>`.

| Method | Endpoint                    | Scope           | Purpose                                                      |
| ------ | --------------------------- | --------------- | ------------------------------------------------------------ |
| GET    | `/api/v1/status`            | any             | Health check                                                 |
| GET    | `/api/v1/leads`             | `leads:read`    | List leads with filters                                      |
| GET    | `/api/v1/leads/:id`         | `leads:read`    | Get single lead                                              |
| POST   | `/api/v1/leads`             | `leads:write`   | Create lead                                                  |
| POST   | `/api/v1/scrape`            | `scrape`        | Trigger Google Maps scrape                                   |
| POST   | `/api/v1/leads/:id/audit`   | `audit`         | Trigger audit on one owned lead                              |
| POST   | `/api/v1/pipeline`          | `pipeline`      | Scrape, create leads, and optionally audit                   |
| GET    | `/api/v1/leads/ready`       | `leads:read`    | Get audited leads for human review; no contact authorization |
| POST   | `/api/v1/leads/:id/handoff` | `handoff:write` | Compatibility route; returns a policy block                  |
| POST   | `/api/v1/leads/:id/outcome` | `outcome:write` | Compatibility route; returns a configuration block           |

---

## Operator Workflow

Cost-bearing steps require `admin` or the configured owner. A normal operator can inspect owned leads, drafts, historical artifacts, and owned costs, but cannot start scraping, screenshots, AI analysis, pipeline work, asset/website generation, voice analysis, or Stripe checkout creation. Provider settings, global provider logs, the Governor, and global cost telemetry are privileged. These checks are server-side.

The intended admin/owner loop is:

1. **Hunt** — go to Business Scraper, enter a city + vertical (e.g., "HVAC Las Vegas NV"), run scrape. System finds businesses, pre-screens, stores leads.
2. **Audit** — leads may enqueue for the pipeline worker, but the worker is disabled unless `ENABLE_PIPELINE_WORKER=true`. When enabled it runs one privileged-owner job at a time. Audits can also be triggered manually.
3. **Review** — check Lead Detail for prestige score, strengths/weaknesses, verified email, outreach channel.
4. **SMIRK research** - after the two deploys, dedicated credentials, and synthetic proof are approved, an admin may move one audited lead into SMIRK's review-only queue. This does not authorize contact.
5. **Draft** - generate evidence-based email copy only when a verified public business email exists.
6. **Approve** - approve, reject, edit, or copy one draft at a time. Approval does not send.
7. **Contact** - any real outreach is a separate manual action outside Velvet and must follow the campaign guardrails. Cold SMS and automated calls are prohibited.
8. **Record** - manually record replies, demos, checkout, and activation evidence until an idempotent outcome contract is implemented.

---

## API Key Scopes

| Scope           | Purpose                                                 |
| --------------- | ------------------------------------------------------- |
| `leads:read`    | Read lead data                                          |
| `leads:write`   | Create/delete leads                                     |
| `scrape`        | Trigger scraping                                        |
| `audit`         | Trigger audits                                          |
| `pipeline`      | Run full pipeline                                       |
| `handoff:write` | Reserved compatibility scope; real handoffs are blocked |
| `outcome:write` | Reserved compatibility scope; callbacks are blocked     |
| `*`             | All scopes                                              |

Normal operators cannot create or use `scrape`, `audit`, `pipeline`, or `*` authority. Both key creation and REST request handling enforce that restriction, including for older keys.

---

## Known Issues and Deferred Work

### Active Issues

| Issue                                                     | Impact                                          | Fix                                                                                                     |
| --------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm db:push` fails (migration journal drift)            | Medium — schema changes must be applied via SQL | Apply via `webdev_execute_sql` or DB panel                                                              |
| Google AI key (`AQ.*`) is a short-lived OAuth token       | High — Gemini fallback will die                 | Get permanent `AIzaSy*` key from aistudio.google.com/apikey                                             |
| Builder JSX-location plugin expects Vite 4/5, not Vite 7  | Low — install warning; current build passes     | Upgrade or remove the development-only plugin before the next Vite upgrade                              |
| Research receiver/client exist only on hardening branches | Real prospect registration is not active        | Approve exact commits, deploy both sides, configure dedicated credentials, then run one synthetic proof |
| No SMIRK-to-Velvet outcome sender is verified             | No automatic closed loop                        | Add signed, idempotent events and owner-scoped update receipts                                          |

### Deferred Features

| Feature                                            | Priority | Notes                                                                                       |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| Scheduled hunt runs (cron)                         | Deferred | Requires separate approval, reviewed queue, cost cap, and explicit worker enablement        |
| Configurable hunt specs (save/load predicates)     | High     | Currently ad-hoc per scrape                                                                 |
| Evidence review packet (personalized prospect URL) | High     | Must distinguish observed friction from measured business impact                            |
| Active probes                                      | Deferred | Require exact owner approval, consent analysis, cost caps, and a separate outbound contract |
| Worker status on Governor dashboard                | Low      | Visibility only                                                                             |
| Bulk scraping (50-100 businesses)                  | Medium   | Pagination exists, needs UI                                                                 |
| Follow-up draft sequences                          | Deferred | No automatic delivery; each contact remains a separate approval                             |
| Rebuild landing page as SMIRK acquisition page     | Low      | Only if selling SMIRK access to others                                                      |

---

## Test Suite

Historical checkpoint `e9f88818` reported `88/88` in the Manus runtime with injected database, LLM, storage, Stripe, and SMIRK credentials. That result is environment-coupled and is not a portable guarantee.

Current gates:

| Command                 | Boundary                                           | Credential-free result on 2026-07-29      |
| ----------------------- | -------------------------------------------------- | ----------------------------------------- |
| `pnpm test:unit`        | Pure logic and fail-closed route policy            | 96 passed, 0 failed, 0 skipped            |
| `pnpm test:integration` | Database, LLM, storage, Stripe, and network suites | 0 passed, 0 failed, 59 explicitly skipped |
| `pnpm test:live`        | Synthetic production SMIRK write                   | 0 passed, 0 failed, 2 explicitly skipped  |
| `pnpm audit --prod --audit-level high` | Production dependency advisories       | 0 known vulnerabilities                   |

`pnpm test:live` only executes when `RUN_LIVE_TESTS=1` and all three SMIRK variables are present. Running it writes a fake handoff to production and therefore requires explicit approval.

Integration credentials do not authorize execution by themselves. `RUN_INTEGRATION_TESTS=1` is required for every integration suite. Suites that mutate the database additionally require `RUN_DB_WRITE_TESTS=1` and must target a disposable test database. Provider/network and Stripe suites additionally require `RUN_COSTED_TESTS=1`, `RUN_NETWORK_TESTS=1`, or `RUN_STRIPE_TESTS=1` as applicable. Set only the exact gate that Cameron has approved.

---

## Deployment

The project deploys via the Manus Management UI Publish button. No manual deploy steps.

**Before publishing:** run `pnpm check`, `pnpm test:unit`, the credentialed integration gate in the intended runtime, and only separately approved live tests. A green build does not establish deploy parity or contact authorization.

**Do not** attempt to deploy via Railway, Vercel, or any external host — the project uses Manus-managed hosting with injected secrets that are not available externally.

---

## For External Agents (Hermes / OpenClaw)

External agents may read owned leads, generate internal evidence, and prepare drafts. They must not treat `leads/ready` or a SMIRK research import as contact authorization. The handoff and outcome compatibility routes intentionally return policy blocks.

The synthetic handoff client remains restricted to fake fixtures. The research client is an admin-only UI action and is not exposed through the public REST API. Automatic prospect registration and automatic outcomes are not implemented.

---

## Checkpoint History

| Commit     | Description                                                               |
| ---------- | ------------------------------------------------------------------------- |
| `e9f88818` | UI coherence pass: minimal auth gate, SMIRK outcome panel, handoff button |
| `a5c3d11e` | SMIRK ↔ VA bidirectional integration, live cross-system proof            |
| `74213332` | Phase 1-3: email enrichment, FIFO worker, cost kill-switch                |
| `29eceb7e` | Bug fix session: 79/79 tests                                              |
| `a80ed4f`  | Scraper v2: pagination, parallel fetch, 10 new columns                    |
| `b2d6ed3`  | Public REST API, API key management                                       |

---

_Last updated: 2026-07-29 by Codex. Hardening baseline `aea0743`; research bridge remains un-deployed._
