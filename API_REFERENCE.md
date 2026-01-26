# API REFERENCE 📡

**Last Updated:** January 26, 2026 at 4:26 AM PST  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Overview

Velvet Alchemy uses **tRPC** for type-safe API communication between frontend and backend. All endpoints are automatically typed, validated, and documented through TypeScript.

**Base URL:** `/api/trpc`  
**Protocol:** HTTP/JSON with batch support  
**Authentication:** JWT session cookies (HTTP-only)

---

## Authentication

### Session Management

All protected endpoints require authentication via session cookie:

```typescript
// Automatic in browser (cookies sent with every request)
const { data } = trpc.leads.getAll.useQuery();
```

### Login Flow

```typescript
// Redirect to OAuth login
window.location.href = getLoginUrl();

// After OAuth callback, session cookie is set automatically
// User is redirected back to app
```

### Logout

```typescript
const { logout } = useAuth();
logout(); // Clears session cookie and redirects to login
```

---

## API Routers

### 1. Scraper Router

**Purpose:** Google Maps lead scraping and lead management.

#### `scraper.scrapeBusinesses`

Scrape businesses from Google Maps.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  query: string;        // Business type (e.g., "plumbers")
  location: string;     // City/state (e.g., "Austin, TX")
  maxResults: number;   // Max leads to scrape (1-100)
}
```

**Output:**
```typescript
{
  leads: Array<{
    id: number;
    companyName: string;
    websiteUrl: string;
    status: 'pending';
    createdAt: Date;
  }>;
  count: number;
}
```

**Example:**
```typescript
const scrapeMutation = trpc.scraper.scrapeBusinesses.useMutation();

scrapeMutation.mutate({
  query: "plumbers",
  location: "Austin, TX",
  maxResults: 50
});
```

#### `scraper.getLeads`

Get all leads for current user with optional filtering.

**Type:** Query  
**Auth:** Required

**Input:**
```typescript
{
  status?: 'pending' | 'audited' | 'contacted' | 'closed' | 'paid';
  limit?: number;
  offset?: number;
}
```

**Output:**
```typescript
Array<{
  id: number;
  companyName: string;
  websiteUrl: string;
  screenshotUrl?: string;
  status: string;
  prestigeScore?: number;
  priorityScore?: number;
  hasAssets: boolean;
  hasOutreach: boolean;
  createdAt: Date;
}>
```

**Example:**
```typescript
const { data: leads } = trpc.scraper.getLeads.useQuery({
  status: 'audited',
  limit: 50
});
```

#### `scraper.getLeadById`

Get single lead with full details.

**Type:** Query  
**Auth:** Required

**Input:**
```typescript
{
  id: number;
}
```

**Output:**
```typescript
{
  id: number;
  companyName: string;
  websiteUrl: string;
  screenshotUrl?: string;
  status: string;
  prestigeScore?: number;
  priorityScore?: number;
  detailedReport?: string; // JSON string
  hasAssets: boolean;
  hasOutreach: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

**Example:**
```typescript
const { data: lead } = trpc.scraper.getLeadById.useQuery({ id: 1 });
```

---

### 2. Orchestrator Router

**Purpose:** Multi-stage audit pipeline execution.

#### `orchestrator.executePipeline`

Execute full audit pipeline for a lead.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
}
```

**Output:**
```typescript
{
  jobId: number;
  status: 'started';
  message: string;
}
```

**Pipeline Stages:**
1. **Screenshot** - Capture website screenshot
2. **Audit** - AI analysis with GPT-4o Vision
3. **Enrichment** - Technical leak detection
4. **Complete** - Update lead status

**Example:**
```typescript
const executeMutation = trpc.orchestrator.executePipeline.useMutation();

executeMutation.mutate({ leadId: 1 });
```

#### `orchestrator.batchAudit`

Execute pipeline for multiple leads sequentially.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  leadIds: number[];
}
```

**Output:**
```typescript
{
  jobs: Array<{
    leadId: number;
    jobId: number;
    status: 'started' | 'failed';
  }>;
  message: string;
}
```

**Example:**
```typescript
const batchMutation = trpc.orchestrator.batchAudit.useMutation();

batchMutation.mutate({ leadIds: [1, 2, 3, 4, 5] });
```

#### `orchestrator.getJobStatus`

Get current status of pipeline job.

**Type:** Query  
**Auth:** Required

**Input:**
```typescript
{
  jobId: number;
}
```

**Output:**
```typescript
{
  id: number;
  leadId: number;
  stage: 'screenshot' | 'audit' | 'assets' | 'complete' | 'failed';
  progressPercentage: number; // 0-100
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Example:**
```typescript
const { data: job } = trpc.orchestrator.getJobStatus.useQuery({ jobId: 1 });
```

---

### 3. Payment Router

**Purpose:** Stripe payment processing and tracking.

#### `payment.createCheckoutSession`

Create Stripe checkout session for a lead.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
  packageType: 'basic' | 'standard' | 'premium';
}
```

**Output:**
```typescript
{
  checkoutUrl: string;
  sessionId: string;
}
```

**Package Pricing:**
- `basic`: $3,000
- `standard`: $5,000
- `premium`: $8,000

**Example:**
```typescript
const createInvoice = trpc.payment.createCheckoutSession.useMutation();

createInvoice.mutate({
  leadId: 1,
  packageType: 'standard'
}, {
  onSuccess: (data) => {
    navigator.clipboard.writeText(data.checkoutUrl);
    window.open(data.checkoutUrl, '_blank');
  }
});
```

#### `payment.getPaymentsByLead`

Get all payment attempts for a lead.

**Type:** Query  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
}
```

**Output:**
```typescript
Array<{
  id: number;
  lead_id: number;
  amount: number; // in cents
  status: 'pending' | 'completed' | 'expired' | 'refunded';
  package_type: 'basic' | 'standard' | 'premium';
  payment_link: string;
  paid_at?: Date;
  created_at: Date;
}>
```

**Example:**
```typescript
const { data: payments } = trpc.payment.getPaymentsByLead.useQuery({ leadId: 1 });
```

#### `payment.getAllPayments`

Get all payments for current user with lead details.

**Type:** Query  
**Auth:** Required

**Input:** None

**Output:**
```typescript
Array<{
  id: number;
  lead_id: number;
  companyName: string;
  websiteUrl: string;
  amount: number; // in cents
  status: 'pending' | 'completed' | 'expired' | 'refunded';
  package_type: 'basic' | 'standard' | 'premium';
  paid_at?: Date;
  created_at: Date;
}>
```

**Example:**
```typescript
const { data: allPayments } = trpc.payment.getAllPayments.useQuery();
```

---

### 4. Website Generator Router

**Purpose:** AI-powered website generation and customization.

#### `websiteGenerator.generate`

Generate complete website for a lead.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
}
```

**Output:**
```typescript
{
  html: string;
  css: string;
  js: string;
  preview: string; // Base64 encoded preview image
}
```

**Example:**
```typescript
const generateMutation = trpc.websiteGenerator.generate.useMutation();

generateMutation.mutate({ leadId: 1 });
```

#### `websiteGenerator.saveCustomizations`

Save user customizations to generated website.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
  customizations: {
    primaryColor?: string;
    secondaryColor?: string;
    companyName?: string;
    tagline?: string;
    ctaText?: string;
    phoneNumber?: string;
    email?: string;
  };
}
```

**Output:**
```typescript
{
  success: boolean;
  message: string;
}
```

**Example:**
```typescript
const saveMutation = trpc.websiteGenerator.saveCustomizations.useMutation();

saveMutation.mutate({
  leadId: 1,
  customizations: {
    primaryColor: '#FF6B35',
    ctaText: 'Get Free Quote'
  }
});
```

#### `websiteGenerator.downloadZip`

Download website as ZIP file.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
}
```

**Output:**
```typescript
{
  filename: string;
  buffer: Buffer; // Binary ZIP data
}
```

**Example:**
```typescript
const downloadMutation = trpc.websiteGenerator.downloadZip.useMutation();

downloadMutation.mutate({ leadId: 1 }, {
  onSuccess: (data) => {
    const blob = new Blob([data.buffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.filename;
    a.click();
  }
});
```

---

### 5. Email Router

**Purpose:** AI-generated outreach email creation.

#### `email.generateOutreach`

Generate personalized outreach email with audit findings.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
}
```

**Output:**
```typescript
{
  to: string; // Extracted from website
  subject: string;
  body: string; // HTML formatted
  plainText: string; // Plain text version
}
```

**Example:**
```typescript
const generateEmail = trpc.email.generateOutreach.useMutation();

generateEmail.mutate({ leadId: 1 });
```

#### `email.sendOutreach`

Send outreach email via Gmail MCP.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
  to: string;
  subject: string;
  body: string;
}
```

**Output:**
```typescript
{
  success: boolean;
  messageId?: string;
  error?: string;
}
```

**Example:**
```typescript
const sendEmail = trpc.email.sendOutreach.useMutation();

sendEmail.mutate({
  leadId: 1,
  to: 'owner@business.com',
  subject: 'Your website is costing you $19,200/year',
  body: '<html>...</html>'
});
```

---

### 6. Prescreener Router

**Purpose:** Lead pre-screening and prioritization.

#### `prescreener.screenLead`

Run technical pre-screening checks on a lead.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
}
```

**Output:**
```typescript
{
  priorityScore: number; // 0-100
  checks: {
    hasSSL: boolean;
    isMobileFriendly: boolean;
    loadTime: number; // milliseconds
    hasContactForm: boolean;
    hasPhoneNumber: boolean;
  };
  recommendation: 'high' | 'medium' | 'low';
}
```

**Example:**
```typescript
const screenMutation = trpc.prescreener.screenLead.useMutation();

screenMutation.mutate({ leadId: 1 });
```

---

### 7. Visionary Router

**Purpose:** AI image generation for marketing assets.

#### `visionary.generateAssets`

Generate marketing images for a lead.

**Type:** Mutation  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
  types: Array<'hero_header' | 'social_post' | 'web_banner'>;
}
```

**Output:**
```typescript
{
  assets: Array<{
    type: string;
    url: string;
    s3Key: string;
  }>;
}
```

**Example:**
```typescript
const generateAssets = trpc.visionary.generateAssets.useMutation();

generateAssets.mutate({
  leadId: 1,
  types: ['hero_header', 'social_post']
});
```

---

### 8. Charmer Router

**Purpose:** Outreach management and tracking.

#### `charmer.getOutreachHistory`

Get email outreach history for a lead.

**Type:** Query  
**Auth:** Required

**Input:**
```typescript
{
  leadId: number;
}
```

**Output:**
```typescript
Array<{
  id: number;
  subject: string;
  body: string;
  sentAt?: Date;
  status: 'draft' | 'sent' | 'failed';
  errorMessage?: string;
}>
```

**Example:**
```typescript
const { data: history } = trpc.charmer.getOutreachHistory.useQuery({ leadId: 1 });
```

---

## Error Handling

### Error Types

**Authentication Errors:**
```typescript
{
  code: 'UNAUTHORIZED',
  message: 'Please login (10001)'
}
```

**Validation Errors:**
```typescript
{
  code: 'BAD_REQUEST',
  message: 'Invalid input: leadId must be a positive integer'
}
```

**Not Found Errors:**
```typescript
{
  code: 'NOT_FOUND',
  message: 'Lead not found'
}
```

**Server Errors:**
```typescript
{
  code: 'INTERNAL_SERVER_ERROR',
  message: 'An unexpected error occurred'
}
```

### Error Handling Example

```typescript
const mutation = trpc.leads.update.useMutation({
  onError: (error) => {
    if (error.data?.code === 'UNAUTHORIZED') {
      // Redirect to login
      window.location.href = getLoginUrl();
    } else if (error.data?.code === 'NOT_FOUND') {
      toast.error('Lead not found');
    } else {
      toast.error(error.message);
    }
  }
});
```

---

## Rate Limiting

### Limits

- **Scraper:** 10 requests/minute per user
- **Orchestrator:** 5 concurrent audits per user
- **Website Generator:** 3 requests/minute per user
- **Email:** 10 requests/minute per user

### Rate Limit Response

```typescript
{
  code: 'TOO_MANY_REQUESTS',
  message: 'Rate limit exceeded. Please try again in 60 seconds.'
}
```

---

## Webhooks

### Stripe Webhook

**Endpoint:** `POST /api/webhooks/stripe`  
**Auth:** Stripe signature verification

**Events Handled:**
- `checkout.session.completed` - Payment successful
- `checkout.session.expired` - Checkout expired

**Payload:**
```json
{
  "id": "evt_...",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_...",
      "payment_intent": "pi_...",
      "amount_total": 500000,
      "metadata": {
        "leadId": "1",
        "userId": "1"
      }
    }
  }
}
```

**Response:**
```json
{
  "verified": true
}
```

---

## Testing

### Test Card Numbers

**Successful Payment:**
```
Card: 4242 4242 4242 4242
Exp: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits
```

**Declined Payment:**
```
Card: 4000 0000 0000 0002
```

### Test Webhook Events

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test event
stripe trigger checkout.session.completed
```

---

## Performance

### Caching

tRPC queries are automatically cached by TanStack Query:

```typescript
// Cached for 5 minutes
const { data } = trpc.leads.getAll.useQuery(undefined, {
  staleTime: 5 * 60 * 1000
});
```

### Invalidation

```typescript
const utils = trpc.useUtils();

// Invalidate specific query
utils.leads.getById.invalidate({ id: 1 });

// Invalidate all lead queries
utils.leads.invalidate();
```

### Optimistic Updates

```typescript
const mutation = trpc.leads.update.useMutation({
  onMutate: async (newData) => {
    // Cancel outgoing queries
    await utils.leads.getById.cancel({ id: newData.id });
    
    // Snapshot current data
    const previous = utils.leads.getById.getData({ id: newData.id });
    
    // Optimistically update
    utils.leads.getById.setData({ id: newData.id }, newData);
    
    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    utils.leads.getById.setData({ id: newData.id }, context.previous);
  },
  onSettled: () => {
    // Refetch after mutation
    utils.leads.getById.invalidate({ id: newData.id });
  }
});
```

---

## Best Practices

### 1. Use Queries for Reads

```typescript
// ✅ Good
const { data } = trpc.leads.getAll.useQuery();

// ❌ Bad
const mutation = trpc.leads.getAll.useMutation();
```

### 2. Use Mutations for Writes

```typescript
// ✅ Good
const mutation = trpc.leads.create.useMutation();

// ❌ Bad
const { data } = trpc.leads.create.useQuery();
```

### 3. Handle Loading States

```typescript
const { data, isLoading, error } = trpc.leads.getAll.useQuery();

if (isLoading) return <Spinner />;
if (error) return <Error message={error.message} />;
return <LeadList leads={data} />;
```

### 4. Invalidate After Mutations

```typescript
const mutation = trpc.leads.update.useMutation({
  onSuccess: () => {
    utils.leads.getAll.invalidate();
  }
});
```

### 5. Use Optimistic Updates for UX

```typescript
// For instant feedback on actions like:
// - Toggling checkboxes
// - Updating text fields
// - Deleting items
const mutation = trpc.leads.delete.useMutation({
  onMutate: async (id) => {
    // Remove from list immediately
    utils.leads.getAll.setData((old) => 
      old.filter(lead => lead.id !== id)
    );
  }
});
```

---

## Migration Guide

### From REST to tRPC

**Before (REST):**
```typescript
const response = await fetch('/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ companyName: 'Acme' })
});
const data = await response.json();
```

**After (tRPC):**
```typescript
const mutation = trpc.leads.create.useMutation();
mutation.mutate({ companyName: 'Acme' });
```

**Benefits:**
- ✅ Type safety (no manual types)
- ✅ Auto-completion in IDE
- ✅ Automatic validation
- ✅ Built-in caching
- ✅ Error handling

---

## Support

### Common Issues

**Issue:** "tRPC client not initialized"
- **Solution:** Ensure `<trpc.Provider>` wraps your app

**Issue:** "Query not refetching"
- **Solution:** Call `invalidate()` after mutations

**Issue:** "Type errors in mutations"
- **Solution:** Check input schema matches backend

**Issue:** "Unauthorized errors"
- **Solution:** Verify session cookie is set (check DevTools)

---

**Complete API documentation. Happy coding!** 🚀
