# Velvet Alchemy - Backend Architecture Audit

## ✅ FINAL IMPLEMENTATION STATUS (100% COMPLETE)

**Date:** January 28, 2026  
**Status:** Production-ready, fully optimized

### What Was Built:
1. ✅ **Optimized 2-stage pipeline** (Screenshot+Audit → Outreach)
2. ✅ **Asset generation removed from automatic flow** (80% cost savings)
3. ✅ **Manual "Generate Assets" button** with idempotency + 24h cooldown
4. ✅ **Cost reduced from $0.21-0.46 to $0.01-0.06 per lead**
5. ✅ **All database schema issues fixed** (assetsStatus, assetsGeneratedAt columns)
6. ✅ **Lead status properly updated to 'audited'** after audit completion
7. ✅ **58 leads scraped and ready for processing**

---

## Current Pipeline Flow

### Phase 1: Lead Scraping (Business Scraper)
**Entry Point:** `/command-center` → Business Scraper  
**Backend:** `server/scraperRouter.ts` → `searchBusinesses()`

**What Happens:**
1. User enters search query (e.g., "pizza restaurant Reno NV")
2. System calls Google Maps Places API
3. Extracts: business name, address, phone, website URL
4. Creates lead records in database with `status='pending'`

**Credit Usage:** ❌ **NONE** (Google Maps API is free tier, 100 requests/day)

---

### Phase 2: Visual Audit (Orchestrator)
**Entry Point:** `/orchestrator` → Execute Pipeline OR `/leads/[id]` → Start Audit  
**Backend:** `server/orchestrator.ts` → `executePipeline()`

**What Happens:**

#### Stage 1: Screenshot Capture (25% progress)
- **Function:** `server/screenshot.ts` → `captureScreenshot()`
- **API:** Microlink.io (free, no auth)
- **Process:** Fetches full-page PNG screenshot of website
- **Storage:** Uploads to S3 via `storagePut()`
- **Credit Usage:** ❌ **NONE** (Microlink is free)

#### Stage 2: GPT-4o Vision Analysis (75% progress)
- **Function:** `server/curator.ts` → `performVisualAudit()`
- **API:** `invokeLLM()` with GPT-4o Vision
- **Process:** Sends screenshot + prompt to analyze visual debt
- **Output:** Prestige score (0-100), top 5 issues, detailed recommendations
- **Storage:** Saves audit results to `audits` table
- **Credit Usage:** 🔥 **HIGH** (~$0.01-0.05 per audit depending on image size)

#### Stage 3: Outreach Draft (100% progress)
- **Function:** `server/charmer.ts` → `generateOutreachDraft()`
- **API:** `invokeLLM()` with GPT-4
- **Process:** Creates personalized email draft
- **Storage:** Saves to `outreach_drafts` table
- **Credit Usage:** 🔥 **LOW** (~$0.001-0.01 per draft)

---

#### ❌ REMOVED FROM AUTOMATIC PIPELINE: Asset Generation
- **Function:** `server/visionary.ts` → `generateAssets()` (NOW ON-DEMAND ONLY)
- **API:** `generateImage()` (Manus built-in image generation)
- **Process:** Creates 3 social posts + 1 web banner based on audit findings
- **Storage:** Uploads 4 images to S3
- **Trigger:** Manual button click in LeadDetail page
- **Idempotency:** Returns existing assets if generated within 24h (unless force=true)
- **Credit Usage:** 🔥 **VERY HIGH** (~$0.20-0.40 for 4 images) - ONLY when manually requested

---

## Cost Analysis Per Lead

| Operation | Credit Cost | Required? |
|-----------|-------------|-----------|
| Screenshot | $0.00 | ✅ YES |
| GPT-4o Audit | $0.01-0.05 | ✅ YES |
| Asset Generation (4 images) | $0.20-0.40 | ❌ **OVERKILL** |
| Outreach Draft | $0.001-0.01 | ✅ YES |
| **TOTAL (current)** | **$0.21-0.46** | |
| **TOTAL (optimized)** | **$0.01-0.06** | |

---

## What's Essential vs. Overkill

### ✅ ESSENTIAL (Keep These)
1. **Screenshot** - Free, proves the website exists, provides visual evidence
2. **GPT-4o Audit** - Core value prop, generates prestige score + issues
3. **Outreach Draft** - Cheap, saves time, helps close deals

### ❌ OVERKILL (Make Optional)
1. **Asset Generation** - Burns 80% of credits, most leads won't convert
2. **Why it's overkill:**
   - You're generating 4 custom images for EVERY lead
   - Most leads won't respond or buy
   - Assets are only useful AFTER you close the deal
   - Burning $0.20-0.40 per lead when only 10-20% convert = waste

---

## Recommended Architecture (Lean & Mean)

### Automatic Pipeline (Runs on Every Lead)
```
Scrape → Screenshot → GPT-4o Audit → Outreach Draft
Cost: $0.01-0.06 per lead
```

### On-Demand Asset Generation (Manual Trigger)
```
Lead Detail Page → "Generate Assets" Button → Create 4 Images
Cost: $0.20-0.40 per lead (only when needed)
```

**When to generate assets:**
- Lead responds positively to outreach
- Lead books a call
- Lead agrees to pay for website redesign
- You're about to close the deal and need deliverables

---

## Current Database Schema

### Tables
- `leads` - Business contact info, prestige score, status
- `audits` - Visual debt analysis, recommendations
- `assets` - Generated social posts and banners (URLs to S3)
- `outreach_drafts` - Personalized email copy
- `pipeline_jobs` - Tracks audit progress and status
- `campaigns` - Groups leads for bulk outreach
- `rate_limits` - API usage tracking
- `audit_log` - Compliance and debugging

### Key Fields
- `leads.status` - 'pending' | 'audited' | 'contacted' | 'qualified' | 'closed'
- `leads.prestigeScore` - 0-100 (calculated from audit)
- `audits.visualDebt` - JSON with 5 categories of issues
- `pipeline_jobs.progressPercentage` - 0-100 for real-time tracking

---

## API Integrations

### External APIs
1. **Google Maps Places API** - Find businesses (free tier)
2. **Microlink.io** - Screenshot capture (free, no auth)
3. **Gmail MCP** - Send outreach emails (user's Gmail account)

### Manus Built-in APIs
1. **LLM (GPT-4o Vision)** - Visual audits
2. **LLM (GPT-4)** - Outreach copy generation
3. **Image Generation** - Asset creation (currently auto, should be manual)
4. **S3 Storage** - Screenshot and asset storage

---

## Optimization Plan

### Changes to Make:
1. **Remove asset generation from `orchestrator.ts` pipeline**
2. **Add `visionary.generateAssets` as standalone tRPC mutation**
3. **Add "Generate Assets" button to LeadDetail page**
4. **Update pipeline stages from 4 to 3 (remove Stage 3)**
5. **Update progress tracking (0% → 33% → 66% → 100%)**

### Result:
- **80% cost reduction** per lead
- **Faster audits** (no waiting for image generation)
- **Selective asset creation** (only for hot leads)
- **Same core value** (prestige score + audit + outreach)

---

## What You Get After Optimization

### Automatic (Every Lead):
- Screenshot proof
- Prestige score (0-100)
- Top 5 visual debt issues
- Detailed recommendations
- Personalized outreach email draft
- **Cost: $0.01-0.06 per lead**

### On-Demand (Hot Leads Only):
- 3 social media posts
- 1 web banner
- All assets branded and ready to deliver
- **Cost: $0.20-0.40 per lead (only when needed)**

---

## Is This Overkill?

**NO.** The optimized pipeline is lean and focused:
- Screenshot = proof
- Audit = value
- Outreach = conversion tool

**YES, the current asset generation is overkill:**
- Burning credits on leads that won't convert
- Slowing down the pipeline
- Creating deliverables before you have a buyer

**Solution:** Make assets on-demand, not automatic.
