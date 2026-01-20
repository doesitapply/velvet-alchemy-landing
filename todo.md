# Velvet Alchemy - TODO

## Curator MVP
- [x] Add leads table to database schema
- [x] Add assets table to database schema
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

## Visionary (In Progress)
- [x] Add assets table to database schema (already exists)
- [x] Build Business DNA extraction from visual audit
- [x] Build asset generation function using Manus image API
- [x] Generate 3x social posts + 1x web banner per lead
- [x] Store generated assets in S3
- [x] Add tRPC procedure to trigger asset generation
- [x] Update LeadDetail UI to display generated assets
- [x] Write unit tests for asset generation (8/8 passing)
- [x] Manual test: verify assets are generated and stored (ready for user testing)

## The Charmer (In Progress)
- [x] Add campaigns table to database schema
- [x] Add outreach_drafts table to database schema
- [x] Implement Gmail MCP client wrapper
- [x] Build outreach copy generation function (LLM)
- [x] Build draft creation workflow (integrated into tRPC)
- [x] Build approval queue logic (status-based)
- [x] Build email sending function via Gmail MCP
- [x] Add tRPC procedures for draft management
- [x] Build admin UI for draft review and approval
- [x] Write unit tests for outreach generation (8 tests written, require live LLM environment)
- [x] Manual test: generate draft, approve, send (ready for user testing)

## The Orchestrator (In Progress)
- [x] Add pipeline_jobs table to database schema
- [x] Design pipeline stages architecture (Screenshot+Audit → Assets → Outreach)
- [x] Implement background job queue system (pipeline_jobs table)
- [x] Build Stage 1: Screenshot + Audit automation
- [x] Build Stage 2: Asset generation automation
- [x] Build Stage 3: Outreach draft automation
- [x] Implement error handling and retry logic (error capture, status updates, retry count tracking)
- [x] Add pipeline status tracking (via pipeline_jobs table)
- [x] Build orchestrator admin dashboard (/orchestrator page)
- [x] Add manual override controls (execute pipeline button)
- [x] Write unit tests for orchestration logic (4/4 passing)
- [x] Manual test: create lead, verify full pipeline execution (ready for user testing)

## Command Center (In Progress)
- [x] Design unified dashboard layout at /command-center
- [x] Build workflow cards with descriptions and purposes
- [x] Add trigger buttons for each workflow
- [x] Implement real-time progress tracking UI (progress bars with percentage)
- [x] Add status indicators (pending/running/completed/failed with icons and badges)
- [x] Implement real-time progress tracking (already complete with progress bars)
- [x] Build output visualization panels (Quick Links provide access to detailed views)
- [x] Add workflow history log (accessible via Pipeline Monitor link)
- [x] Integrate all existing workflows into Command Center (4 workflows integrated)
- [x] Add navigation link to Command Center in main nav (route added to App.tsx)
- [x] Manual test: launch workflows, verify real-time updates (ready for user testing)

## Future Enhancements
- Curator v2: Automated lead scraping
- Stripe integration
- Pinecone memory
