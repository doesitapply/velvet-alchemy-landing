# Velvet Alchemy — Operator Handoff Document

**Checkpoint:** post-hardening | **Date:** 2026-08-04 | **Tests:** 88/88 in Manus runtime | **TypeScript:** Clean

This document is the authoritative reference for any operator, agent, or AI continuing work on Velvet Alchemy. It reflects the actual current state of the codebase — not aspirational design.

---

## What This System Is

Velvet Alchemy is a **private operator intelligence platform**. It finds businesses matching configurable signal predicates, runs AI-powered audits on their digital presence, and hands qualified leads to SMIRK (an autonomous AI phone agent) for outbound contact. Every call outcome fires back into Velvet Alchemy, closing the loop.

It is not a SaaS product. It has no public marketing page. The root URL shows a minimal auth gate and redirects authenticated operators to the Command Center.

The system is designed to be operated by a single person or a small team, with external agents (Hermes, OpenClaw, or any HTTP client) able to query and act via the REST API.

---

## System Architecture

```
[Hunt Engine]          [Signal Library]        [Audit Pipeline]
Google Maps Scraper → Screenshot Capture → AI Visual Audit → Prestige Score
       ↓                                              ↓
[Enrichment]                                  [Call Brief Generator]
Hunter.io email → verifiedOwnerEmail          buildCallBrief() → urgency/signals/openingLine
Twilio SMS fallback → outreachChannel
       ↓
[FIFO Queue Worker]                           [SMIRK Handoff]
pipelineJobs table → worker.ts (5min poll) → POST /api/integrations/velvet/handoffs
       ↓                                              ↓
[Outcome Loop]                                [Lead Status Update]
POST /api/v1/leads/:id/outcome ← SMIRK       smirk_queued → smirk_contacted
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
| `server/lib/smirkHandoff.ts` | Call brief builder + SMIRK queue dispatcher |
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
| `client/src/pages/LeadDetail.tsx` | Full lead view with SMIRK outcome panel + handoff button |
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
  externalId: string,           // "va-lead-{leadId}" — idempotency key
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
| 201 | `RECEIVED` | First-time handoff accepted |
| 200 | `DUPLICATE` | Exact replay — already queued |
| 409 | `VELVET_ALCHEMY_IDEMPOTENCY_CONFLICT` | Same externalId, different payload |
| 404 | — | Endpoint not found (check SMIRK deployment) |
| 401 | — | Invalid API key |

### Outcome Callback (SMIRK → Velvet Alchemy)

```
POST https://velvetalchemy.manus.space/api/v1/leads/:id/outcome
Authorization: Bearer <outcome:write scoped API key>
Content-Type: application/json

{
  outcome: "interested" | "not_interested" | "callback" | "no_answer" | "voicemail" | "booked",
  summary?: string,
  callDuration?: number,
  recordingUrl?: string,
}
```

SMIRK must set `VELVET_ALCHEMY_OUTCOME_KEY` in Railway env vars — generate this key from the Velvet Alchemy API Keys page with `outcome:write` scope.

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
| GET | `/api/v1/leads/ready` | `handoff:write` | Get audited leads ready for SMIRK |
| POST | `/api/v1/leads/:id/handoff` | `handoff:write` | Queue SMIRK call for lead |
| POST | `/api/v1/leads/:id/outcome` | `outcome:write` | Post SMIRK call result |

---

## Operator Workflow

The intended operator loop is:

1. **Hunt** — go to Business Scraper, enter a city + vertical (e.g., "HVAC Las Vegas NV"), run scrape. System finds businesses, pre-screens, stores leads.
2. **Audit** — leads auto-enqueue for the pipeline worker. Worker runs screenshot → AI audit → enrichment. Or trigger manually from Lead Detail.
3. **Review** — check Lead Detail for prestige score, strengths/weaknesses, verified email, outreach channel.
4. **Handoff** — click "Queue SMIRK Call" on any audited lead with a phone number. SMIRK queues the call.
5. **Outcome** — SMIRK calls the business, records the conversation, posts the outcome back. Lead status updates to `smirk_contacted`. Call summary appears in the SMIRK Call Intelligence panel.
6. **Revenue** — if interested, create a Stripe invoice from Lead Detail. Send payment link.

---

## API Key Scopes

| Scope | Purpose |
|---|---|
| `leads:read` | Read lead data |
| `leads:write` | Create/delete leads |
| `scrape` | Trigger scraping |
| `audit` | Trigger audits |
| `pipeline` | Run full pipeline |
| `handoff:write` | Queue SMIRK calls, read ready leads |
| `outcome:write` | Post call outcomes (SMIRK → VA) |
| `*` | All scopes |

---

## Known Issues and Deferred Work

### Active Issues

| Issue | Impact | Fix |
|---|---|---|
| `pnpm db:push` fails (migration journal drift) | Medium — schema changes must be applied via SQL | Apply via `webdev_execute_sql` or DB panel |
| Google AI key (`AQ.*`) is a short-lived OAuth token | High — Gemini fallback will die | Get permanent `AIzaSy*` key from aistudio.google.com/apikey |
| SMIRK receiver deployed at commit `2138435` | ✅ Resolved — live at smirkcalls.com | Synthetic test confirmed: 201 RECEIVED + 200 DUPLICATE |

### Deferred Features

| Feature | Priority | Notes |
|---|---|---|
| Scheduled hunt runs (cron) | High | Worker exists, needs schedule trigger |
| Configurable hunt specs (save/load predicates) | High | Currently ad-hoc per scrape |
| Loss Report generator (personalized prospect URL) | High | The actual sales artifact |
| Active probes (after-hours call test via SMIRK) | Medium | SMIRK makes the probe call, outcome = signal |
| Worker status on Governor dashboard | Low | Visibility only |
| Bulk scraping (50-100 businesses) | Medium | Pagination exists, needs UI |
| Follow-up sequences | Medium | Single-shot only right now |
| Rebuild landing page as SMIRK acquisition page | Low | Only if selling SMIRK access to others |

---

## Test Suite

**88/88 tests passing** in the Manus runtime (integration tests requiring injected database, LLM, and storage credentials). Outside Manus: ~53 tests pass as portable unit tests; the remainder properly skip via `it.skipIf` guards rather than returning vacuously. This is the correct behavior — do not treat skipped tests as failures.

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
server/smirkHandoff.test.ts         SMIRK integration (live cross-system test)
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
2. Use `GET /api/v1/leads/ready` to poll for qualified leads ready for SMIRK handoff.
3. Use `POST /api/v1/leads/:id/handoff` to queue a SMIRK call.
4. Use `POST /api/v1/leads/:id/outcome` (with `outcome:write` key) to post call results back.

The API is stateless and idempotent. Repeated handoff requests with the same lead ID will return the existing SMIRK state without re-queuing.

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
