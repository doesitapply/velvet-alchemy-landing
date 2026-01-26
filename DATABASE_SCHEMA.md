# DATABASE SCHEMA 🗄️

**Last Updated:** January 26, 2026 at 4:25 AM PST  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Schema Overview

Velvet Alchemy uses **8 core tables** to manage the entire lead-to-payment workflow:

1. **users** - Authentication & authorization
2. **leads** - Business prospects
3. **audits** - AI website analysis
4. **assets** - Generated images
5. **pipeline_jobs** - Audit progress tracking
6. **payments** - Stripe transactions
7. **outreach_history** - Email tracking
8. **waitlist** - Access requests

---

## Entity Relationship Diagram

```
┌──────────────┐
│    users     │
│──────────────│
│ id (PK)      │◄────────┐
│ openId       │         │
│ name         │         │
│ email        │         │
│ role         │         │
└──────────────┘         │
                         │
                         │ userId (FK)
                         │
┌──────────────┐         │
│    leads     │◄────────┘
│──────────────│
│ id (PK)      │◄────────┐
│ userId (FK)  │         │
│ companyName  │         │
│ websiteUrl   │         │
│ status       │         │
│ prestigeScore│         │
│ priorityScore│         │
│ detailedReport│        │
└──────────────┘         │
       │                 │
       │                 │
       │ leadId (FK)     │ leadId (FK)
       │                 │
       ▼                 │
┌──────────────┐         │
│   audits     │         │
│──────────────│         │
│ id (PK)      │         │
│ leadId (FK)  │         │
│ summary      │         │
│ prestigeScore│         │
│ visualDebtData│        │
└──────────────┘         │
                         │
       ┌─────────────────┴─────────────────┬─────────────────┐
       │                                   │                 │
       ▼                                   ▼                 ▼
┌──────────────┐                  ┌──────────────┐  ┌──────────────┐
│   assets     │                  │  payments    │  │pipeline_jobs │
│──────────────│                  │──────────────│  │──────────────│
│ id (PK)      │                  │ id (PK)      │  │ id (PK)      │
│ leadId (FK)  │                  │ lead_id (FK) │  │ leadId (FK)  │
│ type         │                  │ amount       │  │ stage        │
│ url          │                  │ status       │  │ progress%    │
│ s3Key        │                  │ package_type │  │ errorMessage │
└──────────────┘                  └──────────────┘  └──────────────┘
```

---

## Table Definitions

### 1. users

**Purpose:** Store user authentication and authorization data.

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openId VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  loginMethod VARCHAR(64),
  role ENUM('user', 'admin') DEFAULT 'user' NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL,
  lastSignedIn TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Columns:**
- `id` - Surrogate primary key
- `openId` - Manus OAuth identifier (unique per user)
- `name` - User's display name
- `email` - User's email address
- `loginMethod` - OAuth provider (e.g., "google", "github")
- `role` - Access level: "user" or "admin"
- `createdAt` - Account creation timestamp
- `updatedAt` - Last profile update timestamp
- `lastSignedIn` - Last login timestamp

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `openId`

**Sample Data:**
```json
{
  "id": 1,
  "openId": "oauth_abc123",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "admin",
  "createdAt": "2026-01-15T10:00:00Z"
}
```

---

### 2. leads

**Purpose:** Store business prospects scraped from Google Maps.

```sql
CREATE TABLE leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  companyName VARCHAR(255) NOT NULL,
  websiteUrl VARCHAR(512) NOT NULL,
  screenshotUrl VARCHAR(512),
  screenshotKey VARCHAR(512),
  status ENUM('pending', 'audited', 'contacted', 'closed', 'paid') DEFAULT 'pending' NOT NULL,
  prestigeScore INT,
  priorityScore INT,
  hasAssets BOOLEAN DEFAULT FALSE NOT NULL,
  hasOutreach BOOLEAN DEFAULT FALSE NOT NULL,
  detailedReport TEXT,
  lastDeepScanAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL
);
```

**Columns:**
- `id` - Unique lead identifier
- `userId` - Owner of this lead (FK to users.id)
- `companyName` - Business name
- `websiteUrl` - Business website URL
- `screenshotUrl` - S3 URL of website screenshot
- `screenshotKey` - S3 key for deletion
- `status` - Lead lifecycle stage
- `prestigeScore` - AI-calculated design quality (0-100)
- `priorityScore` - Pre-screening score (0-100)
- `hasAssets` - True if AI generated marketing assets
- `hasOutreach` - True if email sent
- `detailedReport` - JSON string with technical audit data
- `lastDeepScanAt` - Last enrichment scan timestamp

**Status Flow:**
```
pending → audited → contacted → closed → paid
```

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `userId`
- INDEX on `status`

**Sample Data:**
```json
{
  "id": 1,
  "userId": 1,
  "companyName": "Legacy Heating & Cooling",
  "websiteUrl": "https://legacyheating.com",
  "screenshotUrl": "https://s3.../screenshot-1.png",
  "status": "audited",
  "prestigeScore": 42,
  "priorityScore": 78,
  "hasAssets": true,
  "hasOutreach": false,
  "detailedReport": "{\"technicalLeaks\":[...],\"revenueLoss\":19200}",
  "createdAt": "2026-01-20T14:30:00Z"
}
```

---

### 3. audits

**Purpose:** Store AI-generated website analysis results.

```sql
CREATE TABLE audits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadId INT NOT NULL,
  summary TEXT,
  prestigeScore INT,
  visualDebtData TEXT,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL
);
```

**Columns:**
- `id` - Unique audit identifier
- `leadId` - Associated lead (FK to leads.id)
- `summary` - Human-readable audit summary
- `prestigeScore` - Overall design quality (0-100)
- `visualDebtData` - JSON string with detailed findings

**Visual Debt Data Structure:**
```json
{
  "strengths": [
    "Clear company branding",
    "Contact information visible"
  ],
  "weaknesses": [
    "Outdated design patterns",
    "Poor mobile responsiveness",
    "Slow page load time"
  ],
  "visualDebt": [
    {
      "severity": "critical",
      "category": "mobile",
      "issue": "Text too small on mobile devices",
      "recommendation": "Increase base font size to 16px minimum"
    },
    {
      "severity": "high",
      "category": "performance",
      "issue": "Unoptimized images (3.2MB total)",
      "recommendation": "Compress images to reduce load time"
    }
  ]
}
```

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `leadId`

**Sample Data:**
```json
{
  "id": 1,
  "leadId": 1,
  "summary": "Website shows significant design debt with outdated patterns and poor mobile experience. Estimated 42% conversion loss due to UX issues.",
  "prestigeScore": 42,
  "visualDebtData": "{...}",
  "createdAt": "2026-01-20T14:35:00Z"
}
```

---

### 4. assets

**Purpose:** Store AI-generated marketing images for each lead.

```sql
CREATE TABLE assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadId INT NOT NULL,
  type ENUM('hero_header', 'social_post', 'web_banner') NOT NULL,
  url VARCHAR(512) NOT NULL,
  s3Key VARCHAR(512) NOT NULL,
  metadata TEXT,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Columns:**
- `id` - Unique asset identifier
- `leadId` - Associated lead (FK to leads.id)
- `type` - Asset category
- `url` - Public S3 URL
- `s3Key` - S3 key for deletion
- `metadata` - JSON string with generation parameters

**Asset Types:**
- `hero_header` - Website hero image
- `social_post` - Social media graphic
- `web_banner` - Banner ad

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `leadId`

**Sample Data:**
```json
{
  "id": 1,
  "leadId": 1,
  "type": "hero_header",
  "url": "https://s3.../asset-hero-1.png",
  "s3Key": "generated-assets/1-hero-1234567890.png",
  "metadata": "{\"prompt\":\"...\",\"model\":\"dall-e-3\"}",
  "createdAt": "2026-01-20T14:40:00Z"
}
```

---

### 5. pipeline_jobs

**Purpose:** Track progress of multi-stage audit pipeline.

```sql
CREATE TABLE pipeline_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadId INT NOT NULL,
  stage ENUM('screenshot', 'audit', 'assets', 'outreach', 'complete', 'failed') DEFAULT 'screenshot' NOT NULL,
  progressPercentage INT DEFAULT 0 NOT NULL,
  errorMessage TEXT,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL
);
```

**Columns:**
- `id` - Unique job identifier
- `leadId` - Associated lead (FK to leads.id)
- `stage` - Current pipeline stage
- `progressPercentage` - Completion percentage (0-100)
- `errorMessage` - Error details if failed
- `createdAt` - Job start timestamp
- `updatedAt` - Last progress update

**Stage Flow:**
```
screenshot (0%) → audit (33%) → assets (66%) → complete (100%)
                                              ↘ failed (error)
```

**Progress Mapping:**
- `screenshot`: 0-33%
- `audit`: 33-66%
- `assets`: 66-100%
- `complete`: 100%

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `leadId`
- INDEX on `stage`

**Sample Data:**
```json
{
  "id": 1,
  "leadId": 1,
  "stage": "audit",
  "progressPercentage": 50,
  "errorMessage": null,
  "createdAt": "2026-01-20T14:30:00Z",
  "updatedAt": "2026-01-20T14:35:00Z"
}
```

---

### 6. payments

**Purpose:** Track Stripe payment transactions.

```sql
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT NOT NULL,
  stripe_checkout_session_id VARCHAR(255) NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  amount INT NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd' NOT NULL,
  status ENUM('pending', 'completed', 'expired', 'refunded') DEFAULT 'pending' NOT NULL,
  package_type ENUM('basic', 'standard', 'premium') NOT NULL,
  payment_link TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL
);
```

**Columns:**
- `id` - Unique payment identifier
- `lead_id` - Associated lead (FK to leads.id)
- `stripe_checkout_session_id` - Stripe session ID
- `stripe_payment_intent_id` - Stripe payment intent ID (set after payment)
- `amount` - Payment amount in cents (e.g., 500000 = $5,000)
- `currency` - Currency code (default: "usd")
- `status` - Payment lifecycle stage
- `package_type` - Website package tier
- `payment_link` - Stripe checkout URL
- `paid_at` - Payment completion timestamp
- `created_at` - Invoice creation timestamp
- `updated_at` - Last status update

**Package Pricing:**
- `basic`: $3,000 (300000 cents)
- `standard`: $5,000 (500000 cents)
- `premium`: $8,000 (800000 cents)

**Status Flow:**
```
pending → completed
        ↘ expired
        ↘ refunded
```

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `lead_id`
- INDEX on `stripe_checkout_session_id`
- INDEX on `status`

**Sample Data:**
```json
{
  "id": 1,
  "lead_id": 1,
  "stripe_checkout_session_id": "cs_test_abc123",
  "stripe_payment_intent_id": "pi_test_xyz789",
  "amount": 500000,
  "currency": "usd",
  "status": "completed",
  "package_type": "standard",
  "payment_link": "https://checkout.stripe.com/...",
  "paid_at": "2026-01-21T10:00:00Z",
  "created_at": "2026-01-21T09:45:00Z"
}
```

---

### 7. outreach_history

**Purpose:** Track email outreach attempts.

```sql
CREATE TABLE outreach_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  leadId INT NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  sentAt TIMESTAMP,
  status ENUM('draft', 'sent', 'failed') DEFAULT 'draft' NOT NULL,
  errorMessage TEXT,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Columns:**
- `id` - Unique outreach identifier
- `leadId` - Associated lead (FK to leads.id)
- `subject` - Email subject line
- `body` - Email body content
- `sentAt` - Email send timestamp
- `status` - Outreach status
- `errorMessage` - Error details if failed

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `leadId`

**Sample Data:**
```json
{
  "id": 1,
  "leadId": 1,
  "subject": "Your website is costing you $19,200/year",
  "body": "Hi John, I analyzed your website...",
  "sentAt": "2026-01-21T08:00:00Z",
  "status": "sent",
  "createdAt": "2026-01-21T07:55:00Z"
}
```

---

### 8. waitlist

**Purpose:** Store access requests from landing page.

```sql
CREATE TABLE waitlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  targetNiche VARCHAR(255),
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW() NOT NULL
);
```

**Columns:**
- `id` - Unique request identifier
- `email` - Requester's email (unique)
- `targetNiche` - Desired business niche
- `status` - Request status
- `createdAt` - Request submission timestamp

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `email`

**Sample Data:**
```json
{
  "id": 1,
  "email": "operator@example.com",
  "targetNiche": "Real estate agents",
  "status": "approved",
  "createdAt": "2026-01-15T12:00:00Z"
}
```

---

## Data Relationships

### One-to-Many Relationships

**users → leads**
- One user can own many leads
- `leads.userId` references `users.id`

**leads → audits**
- One lead can have many audits (re-auditing)
- `audits.leadId` references `leads.id`

**leads → assets**
- One lead can have many generated assets
- `assets.leadId` references `leads.id`

**leads → pipeline_jobs**
- One lead can have many pipeline jobs (retry logic)
- `pipeline_jobs.leadId` references `leads.id`

**leads → payments**
- One lead can have many payment attempts
- `payments.lead_id` references `leads.id`

**leads → outreach_history**
- One lead can have many outreach attempts
- `outreach_history.leadId` references `leads.id`

---

## Common Queries

### Get all leads for a user
```sql
SELECT * FROM leads 
WHERE userId = 1 
ORDER BY createdAt DESC;
```

### Get lead with audit data
```sql
SELECT l.*, a.summary, a.prestigeScore, a.visualDebtData
FROM leads l
LEFT JOIN audits a ON l.id = a.leadId
WHERE l.id = 1;
```

### Get all paid leads
```sql
SELECT l.*, p.amount, p.package_type, p.paid_at
FROM leads l
INNER JOIN payments p ON l.id = p.lead_id
WHERE p.status = 'completed'
ORDER BY p.paid_at DESC;
```

### Get revenue by month
```sql
SELECT 
  DATE_FORMAT(paid_at, '%Y-%m') AS month,
  COUNT(*) AS deals,
  SUM(amount) / 100 AS revenue_usd
FROM payments
WHERE status = 'completed'
GROUP BY month
ORDER BY month DESC;
```

### Get leads needing follow-up
```sql
SELECT l.*
FROM leads l
LEFT JOIN outreach_history oh ON l.id = oh.leadId
WHERE l.status = 'audited'
  AND l.hasOutreach = FALSE
  AND oh.id IS NULL
ORDER BY l.priorityScore DESC
LIMIT 10;
```

### Get audit pipeline progress
```sql
SELECT l.companyName, pj.stage, pj.progressPercentage
FROM leads l
INNER JOIN pipeline_jobs pj ON l.id = pj.leadId
WHERE pj.stage NOT IN ('complete', 'failed')
ORDER BY pj.updatedAt DESC;
```

---

## Data Migration Guide

### Adding a New Column

1. **Update schema:**
```typescript
// drizzle/schema.ts
export const leads = mysqlTable("leads", {
  // ... existing columns ...
  newColumn: varchar("newColumn", { length: 255 }),
});
```

2. **Generate migration:**
```bash
pnpm db:push
```

3. **Verify:**
```sql
DESCRIBE leads;
```

### Backfilling Data

```sql
-- Example: Set default priorityScore for existing leads
UPDATE leads 
SET priorityScore = 50 
WHERE priorityScore IS NULL;
```

### Renaming a Column

```sql
-- MySQL syntax
ALTER TABLE leads 
CHANGE COLUMN oldName newName VARCHAR(255);
```

---

## Performance Optimization

### Recommended Indexes

```sql
-- Leads table
CREATE INDEX idx_leads_userId ON leads(userId);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_prestigeScore ON leads(prestigeScore);
CREATE INDEX idx_leads_createdAt ON leads(createdAt);

-- Audits table
CREATE INDEX idx_audits_leadId ON audits(leadId);

-- Payments table
CREATE INDEX idx_payments_lead_id ON payments(lead_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);

-- Pipeline jobs
CREATE INDEX idx_pipeline_jobs_leadId ON pipeline_jobs(leadId);
CREATE INDEX idx_pipeline_jobs_stage ON pipeline_jobs(stage);
```

### Query Optimization Tips

1. **Use indexes on WHERE clauses:**
```sql
-- Good (uses index)
SELECT * FROM leads WHERE status = 'audited';

-- Bad (no index)
SELECT * FROM leads WHERE LOWER(companyName) = 'acme';
```

2. **Limit result sets:**
```sql
-- Always use LIMIT for large tables
SELECT * FROM leads ORDER BY createdAt DESC LIMIT 50;
```

3. **Avoid SELECT *:**
```sql
-- Good (only needed columns)
SELECT id, companyName, status FROM leads;

-- Bad (all columns)
SELECT * FROM leads;
```

---

## Backup & Recovery

### Automated Backups
- TiDB Cloud: Daily automated backups
- Retention: 7 days
- Point-in-time recovery available

### Manual Backup
```bash
# Export entire database
mysqldump -h <host> -u <user> -p <database> > backup.sql

# Export single table
mysqldump -h <host> -u <user> -p <database> leads > leads_backup.sql
```

### Restore from Backup
```bash
# Restore entire database
mysql -h <host> -u <user> -p <database> < backup.sql

# Restore single table
mysql -h <host> -u <user> -p <database> < leads_backup.sql
```

---

## Data Privacy & Compliance

### Personal Data
- **Stored:** User email, name, login method
- **Purpose:** Authentication and account management
- **Retention:** Until account deletion

### Business Data
- **Stored:** Company names, website URLs, audit results
- **Purpose:** Lead management and sales operations
- **Retention:** Until manually deleted

### Payment Data
- **Stored:** Transaction IDs, amounts, status
- **NOT Stored:** Credit card numbers (handled by Stripe)
- **Retention:** Indefinite (for financial records)

### GDPR Compliance
- Users can request data export
- Users can request account deletion
- All personal data deleted within 30 days of request

---

## Monitoring & Alerts

### Key Metrics to Track

**Database Health:**
- Connection pool utilization
- Query execution time
- Slow query log
- Disk space usage

**Business Metrics:**
- New leads per day
- Audit completion rate
- Payment success rate
- Revenue per month

**Data Quality:**
- Leads with missing screenshots
- Audits without prestige scores
- Payments stuck in "pending"
- Jobs stuck in "failed"

### Alert Thresholds

```sql
-- Leads without audits (> 24 hours old)
SELECT COUNT(*) FROM leads 
WHERE status = 'pending' 
  AND createdAt < NOW() - INTERVAL 24 HOUR;

-- Failed pipeline jobs
SELECT COUNT(*) FROM pipeline_jobs 
WHERE stage = 'failed';

-- Pending payments (> 7 days old)
SELECT COUNT(*) FROM payments 
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL 7 DAY;
```

---

**This schema is designed for scale, performance, and maintainability.** 🚀
