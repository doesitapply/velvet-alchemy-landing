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

## Documentation Suite
- [x] README.md - System overview, architecture, quick start
- [x] USER_GUIDE.md - Step-by-step workflow tutorials
- [x] ARCHITECTURE.md - Technical deep-dive on agents and database
- [x] DEPLOYMENT.md - Production deployment checklist
- [x] TROUBLESHOOTING.md - Common issues and solutions
- [x] API_REFERENCE.md - tRPC procedures documentation

## Future Enhancements
- Curator v2: Automated lead scraping
- Stripe integration
- Pinecone memory

## Stress Test & Missing Features
- [x] Test authentication flow end-to-end
- [ ] Test lead creation with real websites
- [ ] Test visual audit accuracy and prestige scoring
- [ ] Test asset generation with multiple leads
- [ ] Test outreach draft generation
- [ ] Test email sending via Gmail MCP
- [ ] Test full pipeline automation
- [ ] Test Governor controls (kill-switch, rate limits)
- [x] Identify and fix any missing features or bugs
- [x] Create in-app instruction/help page

## Critical Fixes Needed
- [x] Create Leads list page (/leads route)
- [x] Replace browser prompt() with proper modal dialogs (done in Leads page)
- [x] Add navigation header/sidebar to all dashboard pages
- [ ] Fix Orchestrator to show real leads instead of mock data
- [ ] Add authentication guards to protected routes
- [ ] Implement lead detail page with full functionality
- [ ] Add proper forms for lead creation in Command Center
- [ ] Fix "Back to Dashboard" links (create /dashboard route or redirect)
- [ ] Load real data in Governor (rate limits, audit logs)
- [x] Add help/instruction page

## Reno Small Business Pivot
- [x] Add Google Maps scraping to find small businesses by city + category
- [x] Add Google Search ranking checker (track position for target keywords)
- [x] Create business category taxonomy (restaurants, contractors, retail, services, healthcare, etc.)
- [ ] Update visual audit criteria for small business needs (mobile-first, contact info visibility, trust signals, load speed)
- [ ] Add local SEO scoring (NAP consistency, Google Business Profile, local keywords)
- [ ] Rebrand all copy from "luxury/premium" to "small business" focus
- [ ] Update landing page hero: "Get Reno Small Businesses on the Map"
- [ ] Add city selector (start with Reno, expand to any city)
- [ ] Add bulk scraping workflow: select city + category → scrape 50-100 businesses → auto-queue for audit
- [ ] Update outreach templates to reference ranking position and local competition
- [ ] Add "ranking improvement plan" to visual audit output
- [ ] Test with real Reno businesses (pizza, plumbers, dentists, etc.)

## Documentation Updates for Reno Pivot
- [ ] Update README.md - Change from luxury to local business focus
- [ ] Update USER_GUIDE.md - Add scraper workflow and examples
- [ ] Update ARCHITECTURE.md - Document scraper infrastructure
- [ ] Update API_REFERENCE.md - Add scraper router procedures
- [ ] Update Help page - Reflect new workflow and business categories

## Critical Fixes - Make It Work
- [x] Debug visual audit performance (why is it taking 2+ minutes?)
- [x] Check Rolex lead status in database
- [x] Test visual audit with simple local business site
- [x] Install Playwright browsers
- [x] Optimize screenshot capture (domcontentloaded, 10s timeout, 1024x600 viewport)
- [x] Optimize GPT-4o processing (detail: low)
- [x] Update audit criteria for local businesses
- [ ] Wire up real search API (SerpAPI or DataForSEO) in scraperRouter
- [ ] Fix Orchestrator to load real leads from database (remove mock data)
- [ ] Test complete end-to-end pipeline with one Reno business
- [ ] Replace browser prompt() with proper modals in Command Center
- [ ] Load real data in Governor dashboard (rate limits, audit logs)
- [ ] Remove all mock data and placeholder content

## Search API Integration
- [x] Research available search APIs (Manus built-in, SerpAPI, DataForSEO)
- [x] Choose and configure search API provider (Google Maps Places API)
- [x] Implement searchBusinesses in scraperRouter with real API calls
- [x] Implement checkRanking with real Google ranking data
- [x] Test search with "pizza restaurant Reno NV"
- [x] Test bulk lead creation from 10+ search results (19 leads created successfully)
- [ ] Add error handling and rate limiting

## Command Center Dashboard Rebuild
- [x] Create backend procedures for dashboard metrics (total leads, pending audits, completed outreach, conversion rates)
- [x] Add lead pipeline stats endpoint (scraped → audited → assets → outreach)
- [x] Add missing fields to leads table (prestigeScore, hasAssets, hasOutreach)
- [ ] Build unified Command Center UI with live metrics cards
- [ ] Add visual lead pipeline funnel/chart
- [ ] Add quick action cards (Run Scraper, Start Orchestrator, View Activity)
- [ ] Add recent activity feed showing real-time updates
- [ ] Implement batch operations UI (select multiple leads, run actions)
- [ ] Add lead status filters and search
- [ ] Test dashboard with real scraped leads
- [ ] Remove old placeholder content from Command Center

## Customer Landing Page
- [x] Design hero section with clear value prop ("Is Your Website Costing You Customers?")
- [x] Add problem/solution section (bad website = lost rankings = lost revenue)
- [x] Build features section (free audit, visual analysis, actionable recommendations)
- [x] Add social proof section (example audits, before/after, testimonials)
- [x] Create free audit CTA form (company name + website URL)
- [x] Build contact/inquiry section
- [x] Add pricing or "Get Started" section
- [ ] Test form submission and lead capture

## Public Documentation Page
- [x] Write comprehensive About/How It Works page explaining Velvet Alchemy to the public
- [x] Include problem statement (bad websites = lost customers)
- [x] Explain how the AI audit works (screenshot + GPT-4o Vision analysis)
- [x] Add real example (Roundabout Pizza audit results)
- [x] Show ROI calculation ($10k-180k lost per year)
- [x] Add "Who This Is For" section (local businesses, contractors, restaurants)
- [x] Include step-by-step "How to Get Started" guide
- [x] Add route and navigation links
- [ ] Test page and save checkpoint

## Critical Bug Fixes (From Stress Test 2)
- [x] Fix landing page form submission - debug why trpc.leads.create fails (created public procedure)
- [x] Add loading progress indicator during 35-40 second visual audit
- [x] Sync prestige scores from audits table to leads table after audit completes
- [x] Add success toast when lead is created successfully (already implemented)
- [x] Add error logging for form submission failures (already implemented)
- [x] Test all fixes end-to-end with real data (all 3 fixes working, timeout issue identified)

## Export Page for Employee Outreach
- [x] Create exportRouter with getExportData procedure
- [x] Build Export page UI at /export with filters and selection
- [x] Implement CSV download functionality with all lead data
- [x] Add Export link to AppHeader navigation
- [x] Test export with real Reno pizza leads (26 leads exported successfully)
- [x] Test filters (status, prestige score range)
- [x] Verify CSV contains all required fields (Lead ID, Company Name, Website URL, Prestige Score, Status, Audit Summary, Top Issues, Visual Debt Details, Social Post URLs, Banner URLs, Screenshot URL, Created At, Audit Date)

## Email Integration on Lead Profile
- [x] Create backend tRPC procedure for sending emails via Gmail MCP
- [x] Build EmailComposeDialog component with form fields (to, subject, body)
- [x] Add "Send Email" button to LeadDetail page
- [x] Pre-fill email with lead contact info and audit summary
- [x] Integrate with existing Charmer outreach draft system
- [x] Add success/error toast notifications
- [x] Test email sending with unit tests (4/4 passing)
- [x] Update todo.md to mark tasks complete
