# Velvet Alchemy - TODO

## Curator MVP
- [x] Add leads table to database schema
- [x] Add audits table to database schema
- [x] Run database migration
- [x] Implement screenshot capture function (Playwright)
- [x] Implement S3 storage for screenshots (using existing storagePut)
- [x] Create tRPC procedure: leads.create
- [x] Create tRPC procedure: leads.list
- [x] Create tRPC procedure: leads.getById
- [x] Build /dashboard page with leads list
- [x] Build /leads/[id] detail page with screenshot and audit
- [x] Write unit tests for lead creation
- [x] Manual test: create lead, verify DB + S3 + UI (all tests passing)

## Curator v1 (In Progress)
- [x] Create LLM visual audit function
- [x] Define visual debt schema (JSON structure)
- [x] Implement prestige score calculation logic
- [x] Integrate audit into leads.create procedure
- [x] Update LeadDetail UI to display visual debt findings
- [x] Write unit tests for audit logic (3/3 passing)
- [x] Manual test: verify audit quality (LLM producing structured results)

## Governor (In Progress)
- [x] Add rate_limits table to database schema
- [x] Add system_config table for kill-switch and settings
- [x] Add audit_log table for compliance tracking
- [x] Implement rate limiting middleware
- [x] Implement domain reputation check function
- [x] Implement kill-switch logic (global + per-user)
- [x] Add audit logging to all critical operations
- [x] Build admin dashboard for Governor controls
- [x] Write unit tests for rate limiting (10/10 passing)
- [x] Write unit tests for kill-switch (10/10 passing)
- [x] Manual test: verify rate limits trigger correctly (all tests passing)

## Future Enhancements
- Curator v2: Automated lead scraping
- Charmer: Draft-only outreach generation
- Visionary: Asset pack generation
- Stripe integration
- Pinecone memory
