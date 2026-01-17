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

## Future Enhancements
- Curator v2: Automated lead scraping
- Governor: Rate limiting and safety
- Charmer: Draft-only outreach generation
- Visionary: Asset pack generation
- Stripe integration
- Pinecone memory
