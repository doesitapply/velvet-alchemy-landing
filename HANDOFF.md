# Velvet Alchemy — Operator Handoff Document

**Source checkpoint:** `2fe3591` (includes `e9f88818`) | **Date:** 2026-07-29

**Current local proof:** TypeScript clean; portable unit tests `84/84`. Credentialed and live results are separate gates below.

This document is the authoritative reference for any operator, agent, or AI continuing work on Velvet Alchemy. It reflects the actual current state of the codebase — not aspirational design.

---

## What This System Is

Velvet Alchemy is a **private operator intelligence platform**. It finds businesses matching configurable signal predicates, runs audits on public digital surfaces, and prepares evidence-based outreach drafts for human review.

Velvet does not send email or SMS and does not place or queue prospect calls. The deployed SMIRK handoff receiver accepts a call-shaped `caller` payload, so it is restricted to explicitly enabled synthetic integration tests. No deployed SMIRK-to-Velvet outcome callback has been verified.

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
[Real prospect handoff]         -> BLOCKED
[Email delivery]                -> BLOCKED
[SMS delivery]                  -> BLOCKED
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Wouter routing |
| Backend | Express 4, tRPC 11, Superjson |
| Database | MySQL (TiDB), Drizzle ORM |
| Auth | Manus OAuth, JWT session cookies |
| File Storage | S3 (via `storagePut` / `storageGet`) |
| AI | Manus built-in LLM → Google Gemini 2.5 Flash fallback |
| Payments | Stripe (test mode, sandbox claimed) |
| Email | Review-only generation; delivery adapter is fail-closed |
| SMS | Cold SMS is disabled; no Twilio delivery path is active |
| Email Enrichment | Hunter.io primary, Snov.io fallback |
| Phone Agent | SMIRK at `https://smirkcalls.com` |

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

| File | Purpose |
|---|---|
| `server/routers.ts` | All tRPC procedures — leads, auth, system |
| `server/scraperRouter.ts` | Google Maps scraping, business search |
| `server/orchestratorRouter.ts` | Full pipeline: scrape → screenshot → audit → enrich |
| `server/orchestrator.ts` | Pipeline stage execution logic |
| `server/charmerRouter.ts` | Outreach draft generation and approval |
| `server/paymentRouter.ts` | Stripe checkout session creation |
| `server/apiRouter.ts` | Public REST API (`/api/v1/*`) |
| `server/apiKeyRouter.ts` | API key management (create/revoke/list) |
| `server/governor.ts` | Rate limits, kill-switch, system config |
| `server/worker.ts` | Opt-in FIFO worker (polls every 5 min, 1 job/batch) |
| `server/apiCostTracker.ts` | Per-call cost tracking + daily kill-switch ($10/day) |
| `server/lib/smirkHandoff.ts` | Review brief builder + synthetic-only SMIRK contract client |
| `server/lib/emailEnrichment.ts` | Hunter.io / Snov.io verified email lookup |
| `server/lib/smsOutreach.ts` | Fail-closed cold-SMS compatibility adapter |
| `server/lib/emailOutreach.ts` | Review-only copy + fail-closed delivery adapter |
| `server/lib/externalActionPolicy.ts` | Central prepare-only policy and unsupported-claim checks |
| `server/lib/enrichment.ts` | Audit enrichment; phones remain research-only |
| `server/visualAudit.ts` | AI screenshot analysis, prestige score (0-100) |
| `server/screenshot.ts` | Headless browser screenshot capture → S3 |
| `server/products.ts` | Stripe package definitions ($3K/$5K/$8K) |
| `server/_core/env.ts` | All environment variable definitions |
| `server/_core/llm.ts` | LLM invocation with Manus → Gemini fallback |

### Client

| File | Purpose |
|---|---|
| `client/src/App.tsx` | Route definitions |
| `client/src/pages/LandingHome.tsx` | Minimal auth gate (root URL) |
| `client/src/pages/CommandCenter.tsx` | Operator dashboard, workflow steps |
| `client/src/pages/Leads.tsx` | Lead list with SMIRK status badges |
| `client/src/pages/LeadDetail.tsx` | Full lead view; historical SMIRK outcomes remain readable |
| `client/src/pages/BusinessScraper.tsx` | Hunt engine UI |
| `client/src/pages/Charmer.tsx` | Outreach draft review and approval |
| `client/src/pages/RevenueDashboard.tsx` | Stripe payments and invoicing |
| `client/src/pages/GovernorDashboard.tsx` | Rate limits, kill-switch, cost monitoring |
| `client/src/pages/ApiKeys.tsx` | API key management UI |

### Database

| File | Purpose |
|---|---|
| `drizzle/schema.ts` | All 21 table definitions |

---

## Database Tables (Key)

| Table | Purpose |
|---|---|
| `leads` | Core lead records — business info, status, SMIRK fields |
| `audits` | AI audit results per lead — prestige score, visual debt JSON |
| `pipeline_jobs` | FIFO queue for background processing |
| `api_keys` | Bearer tokens for REST API access |
| `api_calls` | Per-call cost tracking for kill-switch |
| `system_config` | Key-value store for runtime config (kill-switch, budgets) |
| `outreach_drafts` | Charmer-generated email drafts pending approval |
| `payments` | Stripe checkout sessions and payment status |
| `users` | Authenticated operators (Manus OAuth) |

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

| Variable | Purpose |
|---|---|
| `SMIRK_BASE_URL` | Synthetic cross-system test target |
| `SMIRK_API_KEY` | Dedicated synthetic handoff bearer token; never use a dashboard-wide key |
| `SMIRK_WORKSPACE_ID` | Synthetic handoff target workspace |
| `STRIPE_SECRET_KEY` | Credentialed Stripe integration tests and checkout |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe client initialization |
| `HUNTER_API_KEY` | Public business email enrichment |
| `GOOGLE_AI_API_KEY` | Optional LLM fallback |
| `ENABLE_PIPELINE_WORKER` | Must equal `true` to start the cost-bearing background worker; disabled by default |

Twilio variables are intentionally not required because cold SMS is disabled.

---

## SMIRK Integration

This contract is synthetic-test only. The SMIRK schema requires `caller`; it has no `prospect` or `target` field. A business prospect is a callee, so sending real leads through this route would misrepresent the data and is blocked.

### Endpoint

```
POST https://smirkcalls.com/api/integrations/velvet/handoffs
Authorization: Bearer <SMIRK_API_KEY>
Content-Type: application/json
```

### Request Body

```typescript
{
  workspaceId: number,          // Number(SMIRK_WORKSPACE_ID)
  externalId: string,           // "velvet-manus-fake-*" for synthetic tests
  caller: {
    phone: string,              // E.164 format: +1XXXXXXXXXX
    name?: string,
    email?: string,
  },
  companyName?: string,
  reason: string,               // Human-readable signal description
  urgency: "low" | "normal" | "high" | "emergency",
  transcriptSnippet?: string,
  recommendedAction?: string,
  notes?: string,
}
```

### Response Codes

| Status | State | Meaning |
|---|---|---|
| 201 | `RECEIVED` | Synthetic handoff persisted; must include `handoffId` |
| 200 | `DUPLICATE` | Exact replay; must return the existing `handoffId` |
| 409 | `VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT` | Same externalId, different payload |
| 404 | — | Endpoint not found (check SMIRK deployment) |
| 401 | — | Invalid API key |

### Outcome Callback

Not active. The compatibility route returns `409 SMIRK_OUTCOME_CALLBACK_NOT_CONFIGURED`. Activation requires an authenticated, idempotent event contract, owner-scoped updates, and a receipt proving the expected row changed.

---

## REST API (`/api/v1/*`)

All endpoints require `Authorization: Bearer <api_key>`.

| Method | Endpoint | Scope | Purpose |
|---|---|---|---|
| GET | `/api/v1/status` | any | Health check |
| GET | `/api/v1/leads` | `leads:read` | List leads with filters |
| GET | `/api/v1/leads/:id` | `leads:read` | Get single lead |
| POST | `/api/v1/leads` | `leads:write` | Create lead |
| POST | `/api/v1/scrape` | `scrape` | Trigger Google Maps scrape |
| POST | `/api/v1/leads/:id/audit` | `audit` | Trigger audit on one owned lead |
| POST | `/api/v1/pipeline` | `pipeline` | Scrape, create leads, and optionally audit |
| GET | `/api/v1/leads/ready` | `leads:read` | Get audited leads for human review; no contact authorization |
| POST | `/api/v1/leads/:id/handoff` | `handoff:write` | Compatibility route; returns a policy block |
| POST | `/api/v1/leads/:id/outcome` | `outcome:write` | Compatibility route; returns a configuration block |

---

## Operator Workflow

Cost-bearing steps require `admin` or the configured owner. A normal operator can inspect owned leads, drafts, historical artifacts, and owned costs, but cannot start scraping, screenshots, AI analysis, pipeline work, asset/website generation, voice analysis, or Stripe checkout creation. Provider settings, global provider logs, the Governor, and global cost telemetry are privileged. These checks are server-side.

The intended admin/owner loop is:

1. **Hunt** — go to Business Scraper, enter a city + vertical (e.g., "HVAC Las Vegas NV"), run scrape. System finds businesses, pre-screens, stores leads.
2. **Audit** — leads may enqueue for the pipeline worker, but the worker is disabled unless `ENABLE_PIPELINE_WORKER=true`. When enabled it runs one privileged-owner job at a time. Audits can also be triggered manually.
3. **Review** — check Lead Detail for prestige score, strengths/weaknesses, verified email, outreach channel.
4. **Draft** - generate evidence-based email copy only when a verified public business email exists.
5. **Approve** - approve, reject, edit, or copy one draft at a time. Approval does not send.
6. **Contact** - any real outreach is a separate manual action outside Velvet and must follow the campaign guardrails. Cold SMS and automated calls are prohibited.
7. **Record** - manually record replies, demos, checkout, and activation evidence until an idempotent outcome contract is implemented.

---

## API Key Scopes

| Scope | Purpose |
|---|---|
| `leads:read` | Read lead data |
| `leads:write` | Create/delete leads |
| `scrape` | Trigger scraping |
| `audit` | Trigger audits |
| `pipeline` | Run full pipeline |
| `handoff:write` | Reserved compatibility scope; real handoffs are blocked |
| `outcome:write` | Reserved compatibility scope; callbacks are blocked |
| `*` | All scopes |

Normal operators cannot create or use `scrape`, `audit`, `pipeline`, or `*` authority. Both key creation and REST request handling enforce that restriction, including for older keys.

---

## Known Issues and Deferred Work

### Active Issues

| Issue | Impact | Fix |
|---|---|---|
| `pnpm db:push` fails (migration journal drift) | Medium — schema changes must be applied via SQL | Apply via `webdev_execute_sql` or DB panel |
| Google AI key (`AQ.*`) is a short-lived OAuth token | High — Gemini fallback will die | Get permanent `AIzaSy*` key from aistudio.google.com/apikey |
| SMIRK receiver uses a call-shaped `caller` contract | Real prospect registration would be semantically wrong | Design a separate prospect intake contract before activation |
| No SMIRK-to-Velvet outcome sender is verified | No automatic closed loop | Add signed, idempotent events and owner-scoped update receipts |

### Deferred Features

| Feature | Priority | Notes |
|---|---|---|
| Scheduled hunt runs (cron) | Deferred | Requires separate approval, reviewed queue, cost cap, and explicit worker enablement |
| Configurable hunt specs (save/load predicates) | High | Currently ad-hoc per scrape |
| Evidence review packet (personalized prospect URL) | High | Must distinguish observed friction from measured business impact |
| Active probes | Deferred | Require exact owner approval, consent analysis, cost caps, and a separate outbound contract |
| Worker status on Governor dashboard | Low | Visibility only |
| Bulk scraping (50-100 businesses) | Medium | Pagination exists, needs UI |
| Follow-up draft sequences | Deferred | No automatic delivery; each contact remains a separate approval |
| Rebuild landing page as SMIRK acquisition page | Low | Only if selling SMIRK access to others |

---

## Test Suite

Historical checkpoint `e9f88818` reported `88/88` in the Manus runtime with injected database, LLM, storage, Stripe, and SMIRK credentials. That result is environment-coupled and is not a portable guarantee.

Current gates:

| Command | Boundary | Credential-free result on 2026-07-29 |
|---|---|---|
| `pnpm test:unit` | Pure logic and fail-closed route policy | 84 passed, 0 failed, 0 skipped |
| `pnpm test:integration` | Database, LLM, storage, Stripe, and network suites | 0 passed, 0 failed, 59 explicitly skipped |
| `pnpm test:live` | Synthetic production SMIRK write | 0 passed, 0 failed, 2 explicitly skipped |

`pnpm test:live` only executes when `RUN_LIVE_TESTS=1` and all three SMIRK variables are present. Running it writes a fake handoff to production and therefore requires explicit approval.

Integration credentials do not authorize execution by themselves. `RUN_INTEGRATION_TESTS=1` is required for every integration suite. Suites that mutate the database additionally require `RUN_DB_WRITE_TESTS=1` and must target a disposable test database. Provider/network and Stripe suites additionally require `RUN_COSTED_TESTS=1`, `RUN_NETWORK_TESTS=1`, or `RUN_STRIPE_TESTS=1` as applicable. Set only the exact gate that Cameron has approved.

---

## Deployment

The project deploys via the Manus Management UI Publish button. No manual deploy steps.

**Before publishing:** run `pnpm check`, `pnpm test:unit`, the credentialed integration gate in the intended runtime, and only separately approved live tests. A green build does not establish deploy parity or contact authorization.

**Do not** attempt to deploy via Railway, Vercel, or any external host — the project uses Manus-managed hosting with injected secrets that are not available externally.

---

## For External Agents (Hermes / OpenClaw)

External agents may read owned leads, generate internal evidence, and prepare drafts. They must not treat `leads/ready` as contact authorization. The handoff and outcome compatibility routes intentionally return policy blocks.

The synthetic SMIRK test client is idempotent by its fake `externalId`; real prospect registration and automatic outcomes are not implemented.

---

## Checkpoint History

| Commit | Description |
|---|---|
| `e9f88818` | UI coherence pass: minimal auth gate, SMIRK outcome panel, handoff button |
| `a5c3d11e` | SMIRK ↔ VA bidirectional integration, live cross-system proof |
| `74213332` | Phase 1-3: email enrichment, FIFO worker, cost kill-switch |
| `29eceb7e` | Bug fix session: 79/79 tests |
| `a80ed4f` | Scraper v2: pagination, parallel fetch, 10 new columns |
| `b2d6ed3` | Public REST API, API key management |

---

*Last updated: 2026-07-29 by Manus. Reflects checkpoint `e9f88818`.*
