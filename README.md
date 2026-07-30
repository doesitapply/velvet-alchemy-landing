# Velvet Alchemy

Velvet Alchemy is a private operator workspace for finding public business
signals, reviewing evidence, and preparing outreach drafts. It is not an
autonomous sales system, and repository contents do not prove revenue,
conversion impact, deployed parity, or current provider configuration.

`HANDOFF.md` is the current operator and engineering reference. Older revenue,
outreach, architecture, and training documents are historical unless their
claims are reverified against the current code.

## Current Safety Boundary

- Email delivery is blocked.
- Cold SMS is blocked. No SMS draft or fallback path is active.
- Bulk sending is blocked.
- Automated prospect calls are blocked.
- Real-prospect SMIRK handoff is blocked because the deployed receiver accepts
  a call-shaped `caller` artifact rather than a prospect or target.
- Draft approval means approved for separate manual handling. It does not mean
  sent.
- Payment-link creation does not send an invoice or contact a buyer.
- Unsupported claims about lost jobs, lost revenue, guaranteed outcomes, or
  proven conversion impact are rejected from generated external copy.

## Access Model

- `admin` or the configured owner can run paid or metered work, manage provider
  configuration, inspect global provider/cost telemetry, create Stripe checkout
  sessions, and operate the Governor.
- A normal operator can inspect owned leads, historical artifacts, approved
  drafts, and owned cost records.
- Normal operators cannot start screenshots, AI audits, scraping, asset or
  website generation, voice analysis, pipeline work, or Stripe checkout
  creation.
- Existing and newly created REST keys owned by a normal operator cannot invoke
  scrape, audit, pipeline, or wildcard scopes.
- The background worker is disabled unless `ENABLE_PIPELINE_WORKER=true`, runs
  one job at a time, and rejects jobs whose lead owner lacks cost authority.

These restrictions are enforced on the server. They do not depend on hiding a
button in the browser.

## Development

Requirements:

- Node.js 22+
- pnpm

Install and run:

```bash
pnpm install
pnpm dev
```

The application requires the environment documented in `HANDOFF.md`. Do not
infer that a secret is configured from an example file or from a prior runtime.

## Verification Gates

Portable:

```bash
pnpm check
pnpm test:unit
pnpm build
```

Credentialed integration tests are explicitly gated. Credentials alone do not
authorize them:

```bash
RUN_INTEGRATION_TESTS=1 pnpm test:integration
```

Database mutation suites also require `RUN_DB_WRITE_TESTS=1` and a disposable
test database. Provider/network or Stripe suites additionally require the
specific `RUN_COSTED_TESTS=1`, `RUN_NETWORK_TESTS=1`, or `RUN_STRIPE_TESTS=1`
gate. Never point a write-enabled test at production.

The live SMIRK test writes a synthetic handoff to production. It is disabled
unless `RUN_LIVE_TESTS=1` and the dedicated SMIRK variables are present, and it
still requires explicit approval for that exact run.

## Operational Rules

1. Review public evidence before drafting.
2. Keep observations factual and distinguish possible friction from measured
   business impact.
3. Approve or reject one draft at a time.
4. Treat any real contact as a separate, human-controlled action.
5. Do not use cold SMS, automated phone spam, purchased lists, or uncapped
   provider tests.
6. Verify database, provider, budget, and kill-switch state before enabling the
   worker.
7. Keep deployment, live tests, outreach, billing changes, and production data
   changes as separate approval gates.

## Current Known Limitations

- The credentialed integration suites were not run during the portable
  hardening pass.
- The production SMIRK test was not run.
- The deployed Velvet runtime has not been compared with this branch.
- Analytics placeholders are optional but emit build warnings when unset.
- The frontend bundle currently exceeds Vite's default size warning threshold.
- Several historical docs describe removed delivery behavior. Use
  `HANDOFF.md` and this README for current boundaries.

## Repository

- GitHub: `https://github.com/doesitapply/velvet-alchemy-landing`
- Base branch: `main`
- Current hardening branch: `codex/revenue-loop-hardening-2026-07-29`

No deployment, outreach, live call, SMS, or production write is performed by
the commands in the portable gate.
