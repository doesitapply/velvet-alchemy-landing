# Velvet Alchemy — Operator Handoff Document

**Checkpoint:** SMIRK review-handoff hardening | **Date:** 2026-08-06 | **Verification:** type-check/build pass; targeted tests 23 passed, 11 credential-gated skips

This document is the authoritative reference for any operator, agent, or AI continuing work on Velvet Alchemy. It reflects the actual current state of the codebase — not aspirational design.

---

## What This System Is

Velvet Alchemy is a **private operator intelligence platform**. It finds businesses matching configurable signal predicates, runs AI-powered audits on their digital presence, and can create review-only SMIRK handoffs. A handoff records evidence for human review; it does not authorize or place a call.

It is not a SaaS product. It has no public marketing page. The root URL shows a minimal auth gate and redirects authenticated operators to the Command Center.

The system is designed to be operated by a single person or a small team, with external agents (Hermes, OpenClaw, or any HTTP client) able to query and act via the REST API.

---

## System Architecture

```
[Hunt Engine]          [Signal Library]        [Audit Pipeline]
Google Maps Scraper → Screenshot Capture → AI Visual Audit → Prestige Score
       ↓                                              ↓
[Enrichment]                                  [Review Brief Generator]
Hunter.io email → verifiedOwnerEmail          buildCallBrief() → evidence/signals/openingLine
outreachChannel records a signal; automatic SMS is disabled
       ↓
[FIFO Queue Worker]                           [SMIRK Review Handoff]
pipelineJobs table → worker.ts (5min poll) → persisted review record
       ↓                                              ↓
[Operator Review]                             [Historical Fields]
Any external action requires a human decision; outcome callback remains deferred
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
| Email | Resend (via `server/lib/emailOutreach.ts`) |
| SMS | Twilio (optional, degrades gracefully if unconfigured) |
| Email Enrichment | Hunter.io primary, Snov.io fallback |
| Phone Agent | SMIRK at `https://smirkcalls.com` |

---

## Repository

**GitHub:** `https://github.com/doesitapply/velvet-alchemy-landing`
**Branch:** `main`
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
| `server/worker.ts` | FIFO queue worker (polls every 5 min, 3 jobs/batch) |
| `server/apiCostTracker.ts` | Per-call cost tracking + daily kill-switch ($10/day) |
| `server/lib/smirkHandoff.ts` | Evidence-derived review brief builder + fail-closed SMIRK handoff client |
| `server/lib/emailEnrichment.ts` | Hunter.io / Snov.io verified email lookup |
| `server/lib/smsOutreach.ts` | Twilio SMS drop with audit portal link |
| `server/lib/enrichment.ts` | Orchestrates email enrichment + SMS routing |
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
| `client/src/pages/LeadDetail.tsx` | Full lead view with review-handoff controls and historical SMIRK fields |
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

These columns are represented by canonical migration `drizzle/0022_add_smirk_handoff_fields.sql`. The live schema was already current when verified, so the safe apply command performed exact-definition preflight/postflight checks without replaying the Drizzle ledger.

```sql
smirk_handoff_at     DATETIME NULL
smirk_call_outcome   VARCHAR(50) NULL   -- interested|not_interested|callback|no_answer|voicemail|booked
smirk_call_summary   TEXT NULL
smirk_workspace_id   VARCHAR(100) NULL
outreach_channel     VARCHAR(20) NULL   -- email|sms|none
verified_owner_email VARCHAR(255) NULL
```

**Important:** do not use `db:push`, blind migration replay, or ledger stamping for this schema-ahead database. Use `pnpm db:apply:smirk`; it fails closed unless the live enum and columns are exactly missing or exactly current.

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

| Variable | Status | Source |
|---|---|---|
| `SMIRK_BASE_URL` | ✅ Set — `https://smirkcalls.com` | SMIRK Railway deployment |
| `SMIRK_API_KEY` | ✅ Set — dedicated Velvet handoff token | SMIRK dashboard → API keys |
| `SMIRK_WORKSPACE_ID` | ✅ Set — workspace `1` | SMIRK dashboard |
| `STRIPE_SECRET_KEY` | ✅ Set — test mode | Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | ✅ Set | Stripe dashboard |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ✅ Set | Stripe dashboard |
| `HUNTER_API_KEY` | ⚠️ Pending — secrets card shown | hunter.io/api-keys (free: 25/mo) |
| `TWILIO_ACCOUNT_SID` | ⚠️ Optional | Twilio console |
| `TWILIO_AUTH_TOKEN` | ⚠️ Optional | Twilio console |
| `TWILIO_FROM_NUMBER` | ⚠️ Optional | Twilio console |
| `GOOGLE_AI_API_KEY` | ⚠️ Expires — get permanent key | aistudio.google.com/apikey |

---

## SMIRK Integration

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
  externalId: string,           // "velvet-lead-{leadId}" — stable idempotency key
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
| 201 | `RECEIVED` | First-time review handoff persisted |
| 200 | `DUPLICATE` | Exact replay — existing persisted record returned |
| 409 | `VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT` | Same externalId, different payload |
| 404 | — | Endpoint not found (check SMIRK deployment) |
| 401 | — | Invalid API key |

### Outcome Callback (deferred)

`outcome:write` and `POST /api/v1/leads/:id/outcome` are intentionally unavailable. The inspected SMIRK source does not provide a verified sender contract, and production use of the former callback has not been ruled out. Preserve the historical outcome columns, but do not advertise or recreate this endpoint until both sides and existing-use evidence are reviewed.

---

## REST API (`/api/v1/*`)

All endpoints require `Authorization: Bearer <api_key>`.

| Method | Endpoint | Scope | Purpose |
|---|---|---|---|
| GET | `/api/v1/status` | any | Health check |
| GET | `/api/v1/leads` | `leads:read` | List leads with filters |
| GET | `/api/v1/leads/:id` | `leads:read` | Get single lead |
| POST | `/api/v1/leads` | `leads:write` | Create lead |
| DELETE | `/api/v1/leads/:id` | `leads:write` | Delete lead |
| POST | `/api/v1/scrape` | `scrape` | Trigger Google Maps scrape |
| POST | `/api/v1/audit/:id` | `audit` | Trigger audit on lead |
| POST | `/api/v1/pipeline/:id` | `pipeline` | Run full pipeline on lead |
| GET | `/api/v1/leads/ready` | `handoff:write` | Get audited leads ready for human review |
| POST | `/api/v1/leads/:id/handoff` | `handoff:write` | Create a review-only SMIRK handoff; does not place a call |

---

## Operator Workflow

The intended operator loop is:

1. **Hunt** — go to Business Scraper, enter a city + vertical (e.g., "HVAC Las Vegas NV"), run scrape. System finds businesses, pre-screens, stores leads.
2. **Audit** — leads auto-enqueue for the pipeline worker. Worker runs screenshot → AI audit → enrichment. Or trigger manually from Lead Detail.
3. **Review** — check Lead Detail for prestige score, strengths/weaknesses, verified email, outreach channel.
4. **Handoff** — create a SMIRK review handoff for an audited lead with a phone number. This persists review evidence and does not authorize contact.
5. **Decide** — a human operator reviews the evidence and separately decides whether any external action is appropriate.
6. **Revenue** — use payment tooling only after an independently confirmed customer decision and the normal operator checks.

---

## API Key Scopes

| Scope | Purpose |
|---|---|
| `leads:read` | Read lead data |
| `leads:write` | Create/delete leads |
| `scrape` | Trigger scraping |
| `audit` | Trigger audits |
| `pipeline` | Run full pipeline |
| `handoff:write` | Read review-ready leads and create review-only SMIRK handoffs |
| `*` | All scopes |

---

## Known Issues and Deferred Work

### Active Issues

| Issue | Impact | Fix |
|---|---|---|
| Schema-ahead migration ledger drift | High — blind replay or `db:push` can be unsafe | Use `pnpm db:apply:smirk` exact-definition preflight/postflight |
| Google AI key (`AQ.*`) is a short-lived OAuth token | High — Gemini fallback will die | Get permanent `AIzaSy*` key from aistudio.google.com/apikey |
| SMIRK receiver deployed at commit `2138435` | ✅ Resolved — live at smirkcalls.com | Synthetic test confirmed: 201 RECEIVED + 200 DUPLICATE |

### Deferred Features

| Feature | Priority | Notes |
|---|---|---|
| Scheduled hunt runs (cron) | High | Worker exists, needs schedule trigger |
| Configurable hunt specs (save/load predicates) | High | Currently ad-hoc per scrape |
| Loss Report generator (personalized prospect URL) | High | The actual sales artifact |
| Active probes (after-hours call test via SMIRK) | Medium | Requires a separately approved calling workflow and verified outcome contract |
| Worker status on Governor dashboard | Low | Visibility only |
| Bulk scraping (50-100 businesses) | Medium | Pagination exists, needs UI |
| Follow-up sequences | Medium | Single-shot only right now |
| Rebuild landing page as SMIRK acquisition page | Low | Only if selling SMIRK access to others |

---

## Test Suite

Current post-merge local verification:

- `pnpm check`: pass
- production build: pass (analytics placeholders and chunk-size warnings only)
- focused SMIRK/API-key suite: 23 passed, 11 credential-gated skips
- full portable run: 57 passed, 34 skipped, 14 failed because database, LLM, and storage-proxy credentials are unavailable locally

Do not carry forward the earlier `88/88` claim as current evidence. Rerun the full suite in the credentialed deployment runtime before relying on it.

```
server/auth.logout.test.ts          Auth flow
server/activityFeed.test.ts         Activity feed
server/apiKey.test.ts               API key CRUD
server/charmer.test.ts              Outreach generation (LLM, 30s timeout)
server/charmer.sendDirectEmail.test.ts  Verifies sendDirectEmail is disabled (D2 hardening)
server/curator.test.ts              Full pipeline: scrape → audit (LLM, 30s timeout)
server/governor.test.ts             Rate limits, kill-switch, domain blacklist
server/onboarding.test.ts           Onboarding wizard + Stripe
server/orchestrator.test.ts         Pipeline orchestration
server/payment.test.ts              Stripe checkout
server/scraper.test.ts              Google Maps scraping
server/screenshot.test.ts           Screenshot capture
server/smirkHandoff.test.ts         Mocked SMIRK contract + explicit opt-in live test
server/visionary.test.ts            Asset generation
server/visualAudit.test.ts          AI audit scoring
server/waitlist.test.ts             Waitlist signup
```

Run with: `pnpm test`

---

## Deployment

The project deploys via the Manus Management UI Publish button. No manual deploy steps.

**Before publishing:** run `pnpm test` and `npx tsc --noEmit` to confirm clean state, then `webdev_save_checkpoint`.

**Do not** attempt to deploy via Railway, Vercel, or any external host — the project uses Manus-managed hosting with injected secrets that are not available externally.

---

## For External Agents (Hermes / OpenClaw)

To integrate an external agent with Velvet Alchemy:

1. Generate an API key from the Velvet Alchemy UI at `/api-keys` with the appropriate scopes.
2. Use `GET /api/v1/leads/ready` to poll for audited leads ready for human review.
3. Use `POST /api/v1/leads/:id/handoff` to create a review-only SMIRK record. This does not authorize or place a call.

Handoff delivery uses a stable external ID and freezes the exact payload in a tenant-scoped local attempt before any remote request. An exact retry replays only that frozen payload. Remote success and local lead/audit finalization are reconciled transactionally; ambiguous delivery returns `SMIRK_HANDOFF_RECONCILIATION_REQUIRED` and remains safely replayable. A changed payload for the same ID fails closed.

---

## Checkpoint History

These labels describe historical checkpoints and can include behavior superseded by the current review-only boundary above.

| Commit | Description |
|---|---|
| `e9f88818` | UI coherence pass: minimal auth gate, SMIRK outcome panel, handoff button |
| `a5c3d11e` | SMIRK ↔ VA bidirectional integration, live cross-system proof |
| `74213332` | Phase 1-3: email enrichment, FIFO worker, cost kill-switch |
| `29eceb7e` | Bug fix session: 79/79 tests |
| `a80ed4f` | Scraper v2: pagination, parallel fetch, 10 new columns |
| `b2d6ed3` | Public REST API, API key management |

---

*Last updated: 2026-08-06 during PR #1 rebase and verification.*
