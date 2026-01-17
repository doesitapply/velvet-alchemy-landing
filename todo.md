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

## Future Enhancements (Not MVP)
- Curator v1: LLM audit + prestige score
- Governor: Rate limiting and safety
- Charmer: Draft-only outreach generation
- Visionary: Asset pack generation
- Stripe integration
- Pinecone memory
