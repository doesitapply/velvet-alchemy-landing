# Velvet Alchemy - Revenue-Focused Simplification

## Core Money-Making Workflow
- [x] Fix navigation errors (BusinessScraper, Export)
- [x] Simplify sidebar to 3 items only: Leads, Scraper, Orchestrator
- [x] Remove CommandCenter, Charmer, Governor, Export, Analytics from nav
- [x] Simplify LeadDetail page - remove visual debt details, keep score + email
- [x] Simplify Orchestrator to one "Audit All Pending" button
- [ ] Add employee role check (can view leads + send emails, cannot scrape/audit) - SKIPPED: employees get login link, naturally only see Leads
- [x] Test full workflow: Scrape → Audit → View Lead → Send Email
- [x] Remove all unnecessary pages and routes from App.tsx
- [x] Save final checkpoint

## Employee Workflow (Idiot-Proof)
1. Log in
2. Click "Leads" in sidebar
3. Click any company name
4. See: Company, Website, Audit Score, Problems
5. Click "Send Email" button
6. Done

## Admin Workflow (You)
1. Click "Scraper" → enter search → get leads
2. Click "Orchestrator" → click "Audit All" → wait
3. Leads are ready for employee to email

## What We Killed (Unnecessary Fluff)
- ❌ Analytics Dashboard
- ❌ Campaign Manager  
- ❌ Visionary Studio
- ❌ Settings Page
- ❌ Governor Dashboard (keep backend, remove UI)
- ❌ Export page (employees don't need CSV)
- ❌ Charmer page (email is on LeadDetail already)
- ❌ Command Center (just go straight to Leads)
