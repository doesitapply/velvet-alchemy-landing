# SYSTEM ARCHITECTURE 🏗️

**Last Updated:** January 26, 2026 at 4:23 AM PST  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Overview

Velvet Alchemy is a full-stack web application built for automated lead generation, website auditing, AI-powered website generation, and payment processing. This document provides the complete technical architecture for developers who need to understand, maintain, or duplicate the system.

---

## Technology Stack

### Frontend
- **Framework:** React 19 with TypeScript
- **Routing:** Wouter (lightweight React router)
- **Styling:** Tailwind CSS 4
- **UI Components:** shadcn/ui
- **State Management:** TanStack Query (via tRPC)
- **Build Tool:** Vite 7.1.9

### Backend
- **Runtime:** Node.js 22.13.0
- **Framework:** Express 4
- **API Layer:** tRPC 11 (end-to-end type safety)
- **ORM:** Drizzle ORM
- **Database:** MySQL/TiDB (cloud-hosted)
- **File Storage:** AWS S3
- **Payment Processing:** Stripe API

### AI & Automation
- **Vision AI:** GPT-4o Vision (website auditing)
- **Text Generation:** GPT-4o (website generation, email copy)
- **Image Generation:** Manus AI API
- **Browser Automation:** Playwright (screenshot capture)

### External Services
- **Google Maps API:** Lead scraping
- **Stripe:** Payment processing
- **Gmail MCP:** Email integration (optional)
- **AWS S3:** Asset storage

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Scraper    │  │    Leads     │  │   Revenue    │         │
│  │     Page     │  │     Page     │  │  Dashboard   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                 │
│                            │                                    │
│                     tRPC Client                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                    HTTP/JSON over /api/trpc
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                      BACKEND (Express + tRPC)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Scraper    │  │ Orchestrator │  │   Payment    │         │
│  │    Router    │  │    Router    │  │    Router    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Website    │  │  Enrichment  │  │    Email     │         │
│  │  Generator   │  │    Engine    │  │    Router    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                 │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Database   │    │   AWS S3     │    │   Stripe     │
│  (MySQL/TiDB)│    │  (Storage)   │    │   (Payment)  │
└──────────────┘    └──────────────┘    └──────────────┘
        │
        │ Stores:
        │ • Leads
        │ • Audits
        │ • Assets
        │ • Payments
        │ • Users
        └────────────────────────────────────────────────
```

---

## Frontend Architecture

### Page Structure

```
client/src/pages/
├── LandingHome.tsx          # Public landing page
├── CommandCenter.tsx        # Main dashboard (authenticated)
├── Leads.tsx                # Lead list with filtering
├── LeadDetail.tsx           # Individual lead view + actions
├── BusinessScraper.tsx      # Google Maps scraper UI
├── Orchestrator.tsx         # Batch audit processing
├── RevenueDashboard.tsx     # Payment tracking & metrics
└── Help.tsx                 # Documentation
```

### Component Architecture

```
client/src/components/
├── ui/                      # shadcn/ui base components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── AppHeader.tsx            # Navigation header
├── AuditProgressBar.tsx     # Real-time audit progress
├── ReportDrawer.tsx         # Detailed audit report UI
├── WebsiteEditorModal.tsx   # Website customization UI
└── EmailComposeDialog.tsx   # Email outreach UI
```

### State Management

- **tRPC Queries:** Automatic caching, refetching, and invalidation
- **React Context:** Theme, sound effects, auth state
- **Local State:** Form inputs, UI toggles, modals

### Routing

```typescript
/ → LandingHome (public)
/command-center → CommandCenter (auth required)
/leads → Leads (auth required)
/leads/:id → LeadDetail (auth required)
/scraper → BusinessScraper (auth required)
/orchestrator → Orchestrator (auth required)
/revenue → RevenueDashboard (auth required)
```

---

## Backend Architecture

### Router Structure

```
server/
├── routers.ts               # Main router (aggregates all sub-routers)
├── scraperRouter.ts         # Google Maps lead scraping
├── orchestratorRouter.ts    # Batch audit processing
├── paymentRouter.ts         # Stripe payment integration
├── websiteGeneratorRouter.ts # AI website generation
├── emailRouter.ts           # Email generation & sending
├── prescreenerRouter.ts     # Lead pre-screening
├── visionaryRouter.ts       # AI asset generation
└── charmerRouter.ts         # Outreach management
```

### Core Services

```
server/lib/
├── screenshotService.ts     # Playwright browser automation
├── enrichmentEngine.ts      # Revenue loss calculations
├── gmapsService.ts          # Google Maps API wrapper
└── auditAnalyzer.ts         # GPT-4o Vision analysis
```

### Database Layer

```
server/
├── db.ts                    # Database connection & helpers
└── drizzle/
    ├── schema.ts            # Table definitions
    └── migrations/          # SQL migration files
```

---

## Database Schema

### Core Tables

#### `leads`
```sql
CREATE TABLE leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  companyName VARCHAR(255) NOT NULL,
  websiteUrl VARCHAR(512) NOT NULL,
  screenshotUrl VARCHAR(512),
  screenshotKey VARCHAR(512),
  status ENUM('pending', 'audited', 'contacted', 'closed', 'paid') DEFAULT 'pending',
  prestigeScore INT,           -- 0-100, copied from audit
  priorityScore INT,           -- 0-100, pre-screening score
  hasAssets BOOLEAN DEFAULT FALSE,
  hasOutreach BOOLEAN DEFAULT FALSE,
  detailedReport TEXT,         -- JSON string
  lastDeepScanAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

#### `audits`
```sql
CREATE TABLE audits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadId INT NOT NULL,
  summary TEXT,
  prestigeScore INT,           -- 0-100
  visualDebtData TEXT,         -- JSON string
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

#### `payments`
```sql
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL,
  stripe_checkout_session_id VARCHAR(255) NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  amount INT NOT NULL,         -- in cents
  currency VARCHAR(3) DEFAULT 'usd',
  status ENUM('pending', 'completed', 'expired', 'refunded') DEFAULT 'pending',
  package_type ENUM('basic', 'standard', 'premium') NOT NULL,
  payment_link TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

#### `assets`
```sql
CREATE TABLE assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadId INT NOT NULL,
  type ENUM('hero_header', 'social_post', 'web_banner') NOT NULL,
  url VARCHAR(512) NOT NULL,
  s3Key VARCHAR(512) NOT NULL,
  metadata TEXT,               -- JSON string
  createdAt TIMESTAMP DEFAULT NOW()
);
```

#### `pipeline_jobs`
```sql
CREATE TABLE pipeline_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadId INT NOT NULL,
  stage ENUM('screenshot', 'audit', 'assets', 'outreach', 'complete', 'failed') DEFAULT 'screenshot',
  progressPercentage INT DEFAULT 0,
  errorMessage TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

### Supporting Tables

- `users` - User authentication
- `waitlist` - Access requests
- `rate_limits` - API rate limiting
- `outreach_history` - Email tracking

---

## API Endpoints

### tRPC Procedures

#### Scraper Router
```typescript
scraper.scrapeBusinesses(query, location, maxResults) → Lead[]
scraper.getLeads(filters) → Lead[]
```

#### Orchestrator Router
```typescript
orchestrator.executePipeline(leadId) → Job
orchestrator.batchAudit(leadIds[]) → Job[]
orchestrator.getJobStatus(jobId) → Job
```

#### Payment Router
```typescript
payment.createCheckoutSession(leadId, packageType) → { checkoutUrl, sessionId }
payment.getPaymentsByLead(leadId) → Payment[]
payment.getAllPayments() → Payment[]
```

#### Website Generator Router
```typescript
websiteGenerator.generate(leadId) → { html, css, js }
websiteGenerator.saveCustomizations(leadId, customizations) → Success
websiteGenerator.downloadZip(leadId) → { filename, buffer }
```

### REST Endpoints

```
POST /api/webhooks/stripe          # Stripe webhook handler
GET  /api/oauth/callback            # OAuth authentication
GET  /api/download/:filename        # File download
```

---

## Data Flow

### Lead Generation Flow
```
1. User enters search query (e.g., "plumbers in Austin TX")
2. Frontend calls scraper.scrapeBusinesses()
3. Backend hits Google Maps API
4. Extracts business name, website URL, location
5. Stores in leads table with status='pending'
6. Returns lead list to frontend
```

### Audit Flow
```
1. User clicks "START AUDIT" on lead
2. Frontend calls orchestrator.executePipeline(leadId)
3. Backend creates pipeline_job record
4. Stage 1: Screenshot
   - Playwright launches headless browser
   - Captures full-page screenshot
   - Uploads to S3
   - Updates lead.screenshotUrl
5. Stage 2: Audit
   - Sends screenshot to GPT-4o Vision
   - Analyzes design, UX, technical issues
   - Calculates prestige score (0-100)
   - Stores in audits table
6. Stage 3: Enrichment
   - Runs technical leak detection (SSL, speed, mobile)
   - Calculates revenue loss estimates
   - Stores in lead.detailedReport (JSON)
7. Stage 4: Complete
   - Updates lead.status = 'audited'
   - Frontend shows audit report
```

### Website Generation Flow
```
1. User clicks "Generate Website" on audited lead
2. Frontend calls websiteGenerator.generate(leadId)
3. Backend fetches lead + audit data
4. Sends prompt to GPT-4o:
   - Company name, industry, audit findings
   - Revenue loss stats, color palette
   - Request: "Generate complete HTML/CSS/JS website"
5. GPT-4o returns full website code
6. Backend saves to /tmp/websites/{leadId}/
7. Returns HTML preview to frontend
8. User customizes in WebsiteEditorModal
9. User downloads ZIP file
```

### Payment Flow
```
1. User clicks "Send Invoice ($5k)" on lead
2. Frontend calls payment.createCheckoutSession(leadId, 'standard')
3. Backend creates Stripe Checkout Session
4. Stores payment record with status='pending'
5. Returns checkout URL to frontend
6. Frontend copies link to clipboard + opens in new tab
7. Client pays via Stripe
8. Stripe sends webhook to /api/webhooks/stripe
9. Backend verifies signature
10. Updates payment.status = 'completed'
11. Updates lead.status = 'paid'
12. Revenue Dashboard auto-updates
```

---

## File Storage Structure

### S3 Bucket Organization
```
velvet-alchemy-assets/
├── screenshots/
│   ├── {leadId}-{timestamp}.png
│   └── ...
├── generated-assets/
│   ├── {leadId}-hero-{timestamp}.png
│   ├── {leadId}-social-{timestamp}.png
│   └── ...
└── websites/
    ├── {leadId}-website.zip
    └── ...
```

### Local File System (Temporary)
```
/tmp/
├── screenshots/
│   └── {leadId}.png
└── websites/
    └── {leadId}/
        ├── index.html
        ├── styles.css
        └── script.js
```

---

## Environment Variables

### Required
```bash
# Database
DATABASE_URL=mysql://user:pass@host:port/db

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=velvet-alchemy-assets

# Manus Platform (Auto-injected)
BUILT_IN_FORGE_API_KEY=...
BUILT_IN_FORGE_API_URL=...
VITE_FRONTEND_FORGE_API_KEY=...
VITE_FRONTEND_FORGE_API_URL=...

# OAuth (Auto-injected)
OAUTH_SERVER_URL=...
VITE_OAUTH_PORTAL_URL=...
VITE_APP_ID=...
JWT_SECRET=...
```

### Optional
```bash
# Google Maps (for scraping)
GOOGLE_MAPS_API_KEY=...

# Gmail MCP (for email sending)
GMAIL_MCP_ENABLED=true
```

---

## Deployment Architecture

### Development
```
Local Machine
├── Vite Dev Server (port 3000)
├── Express API Server (port 3000)
├── Hot Module Replacement
└── TypeScript Compiler (watch mode)
```

### Production
```
Manus Platform
├── Static Assets (CDN)
├── Express Server (containerized)
├── Database (TiDB Cloud)
├── S3 Storage (AWS)
└── Stripe Webhooks (HTTPS)
```

---

## Security Considerations

### Authentication
- OAuth 2.0 via Manus platform
- JWT session tokens (HTTP-only cookies)
- Role-based access control (admin/user)

### API Security
- tRPC procedures require authentication
- Rate limiting on scraper endpoints
- Input validation with Zod schemas

### Payment Security
- Stripe handles all card data (PCI compliant)
- Webhook signature verification
- No sensitive data stored locally

### Data Protection
- S3 bucket with private ACL
- Database credentials in environment variables
- No API keys in frontend code

---

## Performance Optimizations

### Frontend
- Code splitting with React.lazy()
- Image lazy loading
- tRPC query caching
- Debounced search inputs

### Backend
- Database connection pooling
- Parallel audit processing
- S3 presigned URLs for direct uploads
- Cached API responses

### Database
- Indexed columns: leadId, userId, status
- Compound indexes on common queries
- Pagination for large result sets

---

## Monitoring & Logging

### Application Logs
```typescript
console.log('[SCRAPER] Found 47 businesses')
console.error('[AUDIT] GPT-4o API error:', error)
console.info('[PAYMENT] Checkout session created:', sessionId)
```

### Error Tracking
- Try/catch blocks in all async operations
- Error messages stored in pipeline_jobs table
- Frontend toast notifications for user errors

### Metrics to Track
- Leads scraped per day
- Audit completion rate
- Payment conversion rate
- Average deal size
- Revenue per month

---

## Testing Strategy

### Unit Tests
```bash
pnpm test                    # Run all tests
pnpm test server/payment.test.ts  # Run specific test
```

### Test Coverage
- Payment router: 6/6 tests passing
- Scraper router: Not yet implemented
- Website generator: Not yet implemented

### Manual Testing Checklist
- [ ] Scrape leads from Google Maps
- [ ] Pre-screen leads
- [ ] Run full audit on lead
- [ ] Generate website
- [ ] Customize website colors/content
- [ ] Download ZIP file
- [ ] Create Stripe checkout session
- [ ] Complete test payment
- [ ] Verify webhook updates status
- [ ] Check Revenue Dashboard

---

## Common Issues & Solutions

### Issue: Playwright browser not found
**Solution:** Run `npx playwright install chromium`

### Issue: Stripe webhook signature verification fails
**Solution:** Ensure STRIPE_WEBHOOK_SECRET is set correctly

### Issue: S3 upload fails
**Solution:** Check AWS credentials and bucket permissions

### Issue: GPT-4o rate limit exceeded
**Solution:** Implement exponential backoff or reduce concurrent requests

### Issue: Database connection timeout
**Solution:** Check DATABASE_URL and network connectivity

---

## Scaling Considerations

### Current Capacity
- **Leads:** Unlimited (database-limited)
- **Audits:** ~100/hour (GPT-4o rate limit)
- **Payments:** Unlimited (Stripe handles scale)

### Bottlenecks
1. **GPT-4o API:** Rate limits on vision analysis
   - Solution: Queue system with retry logic
2. **Screenshot capture:** Playwright is CPU-intensive
   - Solution: Offload to worker processes
3. **Database queries:** Large lead lists slow down
   - Solution: Implement pagination + caching

### Horizontal Scaling
- Deploy multiple Express instances behind load balancer
- Use Redis for session storage
- Implement job queue (Bull/BullMQ) for audits

---

## Developer Onboarding

### Setup (5 minutes)
```bash
# Clone repo
git clone <repo-url>
cd velvet-alchemy-landing

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Push database schema
pnpm db:push

# Start dev server
pnpm dev
```

### Key Files to Understand
1. `server/routers.ts` - All API endpoints
2. `drizzle/schema.ts` - Database structure
3. `client/src/App.tsx` - Frontend routing
4. `server/lib/enrichmentEngine.ts` - Revenue calculations
5. `server/paymentRouter.ts` - Stripe integration

### Making Changes
1. Update schema in `drizzle/schema.ts`
2. Run `pnpm db:push` to migrate
3. Add tRPC procedure in appropriate router
4. Call from frontend with `trpc.*.useQuery/useMutation`
5. Test manually + write unit test
6. Commit changes

---

## API Rate Limits

### External Services
- **Google Maps API:** 1000 requests/day (free tier)
- **GPT-4o Vision:** 500 requests/minute (paid tier)
- **Stripe API:** No hard limit (rate limited by account)
- **S3 API:** 3500 PUT/s, 5500 GET/s per prefix

### Internal Rate Limits
- Scraper: 10 requests/minute per user
- Audit: 5 concurrent audits per user
- Website generation: 3 requests/minute per user

---

## Backup & Recovery

### Database Backups
- Automated daily backups (TiDB Cloud)
- Point-in-time recovery available
- Manual export: `pnpm db:export`

### S3 Backups
- Versioning enabled on bucket
- Cross-region replication (optional)
- Lifecycle policies for old files

### Code Backups
- Git repository (GitHub/GitLab)
- Checkpoint system (Manus platform)
- Manual exports via Management UI

---

## Future Enhancements

### Planned Features
- [ ] Multi-user support (team accounts)
- [ ] Custom branding for generated websites
- [ ] Automated email sequences
- [ ] CRM integration (HubSpot, Salesforce)
- [ ] Mobile app for operators
- [ ] White-label version for agencies

### Technical Debt
- [ ] Add comprehensive test coverage
- [ ] Implement job queue for audits
- [ ] Add Redis caching layer
- [ ] Optimize database queries
- [ ] Add error monitoring (Sentry)

---

## Support & Resources

### Documentation
- `THE_MONEY_MANUAL.md` - Business guide
- `OPERATOR_TRAINING_GUIDE.md` - User manual
- `SYSTEM_ARCHITECTURE.md` - This document
- `DEVELOPER_HANDOFF.md` - Technical specs

### External Docs
- [tRPC Documentation](https://trpc.io)
- [Drizzle ORM](https://orm.drizzle.team)
- [Stripe API](https://stripe.com/docs/api)
- [React Documentation](https://react.dev)

---

**Questions? Check the other documentation files or review the code comments.**
