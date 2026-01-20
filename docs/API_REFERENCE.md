# Velvet Alchemy API Reference

This document provides complete documentation for all tRPC procedures available in the Velvet Alchemy API.

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Auth Router](#auth-router)
- [Waitlist Router](#waitlist-router)
- [Leads Router](#leads-router)
- [Visionary Router](#visionary-router)
- [Charmer Router](#charmer-router)
- [Governor Router](#governor-router)
- [Orchestrator Router](#orchestrator-router)
- [System Router](#system-router)

---

## Overview

Velvet Alchemy uses **tRPC** for type-safe API communication. All procedures are accessible via the `trpc` client on the frontend.

### Base URL

All API requests are sent to:

```
/api/trpc
```

### Request Format

tRPC automatically batches requests and handles serialization. On the frontend, use the generated client:

```typescript
import { trpc } from "@/lib/trpc";

// Query example
const { data, isLoading } = trpc.leads.list.useQuery();

// Mutation example
const mutation = trpc.leads.create.useMutation();
mutation.mutate({ companyName: "Acme Corp", websiteUrl: "https://acme.com" });
```

### Response Format

All responses are JSON with automatic type inference:

```typescript
{
  result: {
    data: { ... } // Typed response data
  }
}
```

Errors are returned with typed error objects:

```typescript
{
  error: {
    code: "BAD_REQUEST",
    message: "Error message"
  }
}
```

---

## Authentication

Most procedures require authentication. The system uses **session cookies** for authentication.

### Public Procedures

Public procedures can be called without authentication:

- `auth.me`
- `auth.logout`
- `waitlist.join`

### Protected Procedures

Protected procedures require a valid session cookie. If not authenticated, the client will automatically redirect to the login page.

### Admin-Only Procedures

Some procedures require admin role:

- `governor.getConfig`
- `governor.toggleKillSwitch`
- `governor.getRateLimitStats`
- `governor.getAuditLogs`

---

## Error Handling

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `BAD_REQUEST` | Invalid input or request | 400 |
| `UNAUTHORIZED` | Not authenticated | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `INTERNAL_SERVER_ERROR` | Server error | 500 |

### Error Response Format

```typescript
{
  error: {
    code: "BAD_REQUEST",
    message: "Domain flagged as unsafe",
    data: {
      // Additional error details
    }
  }
}
```

### Frontend Error Handling

```typescript
const mutation = trpc.leads.create.useMutation({
  onError: (error) => {
    if (error.data?.code === "UNAUTHORIZED") {
      // Redirect to login
      window.location.href = getLoginUrl();
    } else {
      // Show error toast
      toast.error(error.message);
    }
  },
});
```

---

## Auth Router

Authentication and session management procedures.

### `auth.me`

Get the current authenticated user.

**Type**: Query (public)

**Input**: None

**Output**:

```typescript
{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  createdAt: Date;
  lastSignedIn: Date;
} | null
```

**Example**:

```typescript
const { data: user } = trpc.auth.me.useQuery();

if (user) {
  console.log(`Logged in as ${user.name}`);
}
```

---

### `auth.logout`

Logout the current user and clear session cookie.

**Type**: Mutation (public)

**Input**: None

**Output**:

```typescript
{
  success: true;
}
```

**Example**:

```typescript
const logout = trpc.auth.logout.useMutation({
  onSuccess: () => {
    window.location.href = "/";
  },
});

logout.mutate();
```

---

## Waitlist Router

Waitlist management procedures.

### `waitlist.join`

Add an email to the waitlist.

**Type**: Mutation (public)

**Input**:

```typescript
{
  email: string; // Valid email address
  targetNiche?: string; // Optional target market/niche
}
```

**Output**:

```typescript
{
  id: number;
  email: string;
  targetNiche: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}
```

**Example**:

```typescript
const joinWaitlist = trpc.waitlist.join.useMutation();

joinWaitlist.mutate({
  email: "user@example.com",
  targetNiche: "Luxury Fashion",
});
```

**Errors**:
- `BAD_REQUEST`: Invalid email format
- `INTERNAL_SERVER_ERROR`: Database error

---

## Leads Router

Lead management and creation procedures.

### `leads.create`

Create a new lead with screenshot capture and visual audit.

**Type**: Mutation (protected)

**Input**:

```typescript
{
  companyName: string; // Minimum 1 character
  websiteUrl: string; // Valid URL
}
```

**Output**:

```typescript
{
  lead: {
    id: number;
    userId: number;
    companyName: string;
    websiteUrl: string;
    screenshotUrl: string;
    screenshotKey: string;
    status: "pending" | "audited" | "contacted" | "closed";
    createdAt: Date;
    updatedAt: Date;
  };
  audit: {
    id: number;
    leadId: number;
    summary: string;
    prestigeScore: number; // 0-100
    visualDebtData: string; // JSON string
    createdAt: Date;
    updatedAt: Date;
  };
}
```

**Example**:

```typescript
const createLead = trpc.leads.create.useMutation({
  onSuccess: (data) => {
    console.log(`Lead created with prestige score: ${data.audit.prestigeScore}`);
  },
});

createLead.mutate({
  companyName: "Luxury Watches Inc.",
  websiteUrl: "https://luxurywatches.example.com",
});
```

**Errors**:
- `BAD_REQUEST`: Invalid input, domain flagged as unsafe
- `INTERNAL_SERVER_ERROR`: Screenshot capture failed, audit failed
- Rate limit: 10 requests per hour

**Governor Checks**:
- Kill-switch status (global and per-user)
- Rate limits (10 per hour)
- Domain reputation check

---

### `leads.list`

Get all leads for the current user.

**Type**: Query (protected)

**Input**: None

**Output**:

```typescript
Array<{
  id: number;
  userId: number;
  companyName: string;
  websiteUrl: string;
  screenshotUrl: string | null;
  screenshotKey: string | null;
  status: "pending" | "audited" | "contacted" | "closed";
  createdAt: Date;
  updatedAt: Date;
}>
```

**Example**:

```typescript
const { data: leads } = trpc.leads.list.useQuery();

leads?.forEach((lead) => {
  console.log(`${lead.companyName} - ${lead.status}`);
});
```

---

### `leads.getById`

Get a single lead by ID with audit data.

**Type**: Query (protected)

**Input**:

```typescript
{
  id: number;
}
```

**Output**:

```typescript
{
  lead: {
    id: number;
    userId: number;
    companyName: string;
    websiteUrl: string;
    screenshotUrl: string | null;
    screenshotKey: string | null;
    status: "pending" | "audited" | "contacted" | "closed";
    createdAt: Date;
    updatedAt: Date;
  };
  audit: {
    id: number;
    leadId: number;
    summary: string;
    prestigeScore: number | null;
    visualDebtData: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}
```

**Example**:

```typescript
const { data } = trpc.leads.getById.useQuery({ id: 123 });

if (data) {
  console.log(`Company: ${data.lead.companyName}`);
  console.log(`Prestige Score: ${data.audit?.prestigeScore}`);
}
```

**Errors**:
- `NOT_FOUND`: Lead not found

---

## Visionary Router

Asset generation procedures.

### `visionary.generateAssets`

Generate marketing assets (3 social posts + 1 web banner) for a lead.

**Type**: Mutation (protected)

**Input**:

```typescript
{
  leadId: number;
}
```

**Output**:

```typescript
{
  assets: Array<{
    id: number;
    leadId: number;
    type: "hero_header" | "social_post" | "web_banner";
    url: string;
    s3Key: string;
    metadata: string | null; // JSON string
    createdAt: Date;
  }>;
  errors: string[];
}
```

**Example**:

```typescript
const generateAssets = trpc.visionary.generateAssets.useMutation({
  onSuccess: (data) => {
    console.log(`Generated ${data.assets.length} assets`);
    data.assets.forEach((asset) => {
      console.log(`${asset.type}: ${asset.url}`);
    });
  },
});

generateAssets.mutate({ leadId: 123 });
```

**Errors**:
- `NOT_FOUND`: Lead not found
- `BAD_REQUEST`: Lead must have an audit before generating assets
- `INTERNAL_SERVER_ERROR`: Asset generation failed

**Requirements**:
- Lead must have a completed visual audit

---

### `visionary.getAssets`

Get all assets for a lead.

**Type**: Query (protected)

**Input**:

```typescript
{
  leadId: number;
}
```

**Output**:

```typescript
Array<{
  id: number;
  leadId: number;
  type: "hero_header" | "social_post" | "web_banner";
  url: string;
  s3Key: string;
  metadata: string | null;
  createdAt: Date;
}>
```

**Example**:

```typescript
const { data: assets } = trpc.visionary.getAssets.useQuery({ leadId: 123 });

assets?.forEach((asset) => {
  console.log(`${asset.type}: ${asset.url}`);
});
```

---

## Charmer Router

Outreach email generation and management procedures.

### `charmer.generateDraft`

Generate a personalized outreach email draft for a lead.

**Type**: Mutation (protected)

**Input**:

```typescript
{
  leadId: number;
}
```

**Output**:

```typescript
{
  draftId: number;
  campaignId: number;
  subject: string;
  body: string;
}
```

**Example**:

```typescript
const generateDraft = trpc.charmer.generateDraft.useMutation({
  onSuccess: (data) => {
    console.log(`Draft created: ${data.subject}`);
  },
});

generateDraft.mutate({ leadId: 123 });
```

**Errors**:
- `NOT_FOUND`: Lead not found
- `INTERNAL_SERVER_ERROR`: Draft generation failed

---

### `charmer.listDrafts`

List all outreach drafts with optional status filtering.

**Type**: Query (protected)

**Input**:

```typescript
{
  status?: "draft" | "pending_approval" | "approved" | "rejected" | "sent";
}
```

**Output**:

```typescript
Array<{
  draft: {
    id: number;
    campaignId: number;
    subject: string;
    body: string;
    recipientEmail: string;
    recipientName: string | null;
    status: "draft" | "pending_approval" | "approved" | "rejected" | "sent";
    rejectionReason: string | null;
    approvedBy: number | null;
    approvedAt: Date | null;
    sentAt: Date | null;
    gmailMessageId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  campaign: {
    id: number;
    leadId: number;
    userId: number;
    name: string;
    status: "draft" | "pending_approval" | "approved" | "sent" | "failed";
    sentAt: Date | null;
    openedAt: Date | null;
    clickedAt: Date | null;
    repliedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  lead: {
    id: number;
    userId: number;
    companyName: string;
    websiteUrl: string;
    screenshotUrl: string | null;
    screenshotKey: string | null;
    status: "pending" | "audited" | "contacted" | "closed";
    createdAt: Date;
    updatedAt: Date;
  } | null;
}>
```

**Example**:

```typescript
// Get all pending approval drafts
const { data: drafts } = trpc.charmer.listDrafts.useQuery({
  status: "pending_approval",
});

drafts?.forEach((item) => {
  console.log(`${item.lead?.companyName}: ${item.draft.subject}`);
});
```

---

### `charmer.getDraft`

Get a single draft by ID with related campaign and lead data.

**Type**: Query (protected)

**Input**:

```typescript
{
  draftId: number;
}
```

**Output**:

```typescript
{
  draft: { /* OutreachDraft */ };
  campaign: { /* Campaign */ } | null;
  lead: { /* Lead */ } | null;
}
```

**Example**:

```typescript
const { data } = trpc.charmer.getDraft.useQuery({ draftId: 456 });

if (data) {
  console.log(`Subject: ${data.draft.subject}`);
  console.log(`Company: ${data.lead?.companyName}`);
}
```

**Errors**:
- `NOT_FOUND`: Draft not found

---

### `charmer.approveDraft`

Approve an outreach draft.

**Type**: Mutation (protected)

**Input**:

```typescript
{
  draftId: number;
}
```

**Output**:

```typescript
{
  success: true;
}
```

**Example**:

```typescript
const approveDraft = trpc.charmer.approveDraft.useMutation({
  onSuccess: () => {
    toast.success("Draft approved");
  },
});

approveDraft.mutate({ draftId: 456 });
```

---

### `charmer.rejectDraft`

Reject an outreach draft with a reason.

**Type**: Mutation (protected)

**Input**:

```typescript
{
  draftId: number;
  reason: string;
}
```

**Output**:

```typescript
{
  success: true;
}
```

**Example**:

```typescript
const rejectDraft = trpc.charmer.rejectDraft.useMutation();

rejectDraft.mutate({
  draftId: 456,
  reason: "Subject line needs improvement",
});
```

---

### `charmer.sendDraft`

Send an approved draft via Gmail.

**Type**: Mutation (protected)

**Input**:

```typescript
{
  draftId: number;
}
```

**Output**:

```typescript
{
  success: true;
  messageId: string; // Gmail message ID
}
```

**Example**:

```typescript
const sendDraft = trpc.charmer.sendDraft.useMutation({
  onSuccess: (data) => {
    console.log(`Email sent: ${data.messageId}`);
  },
});

sendDraft.mutate({ draftId: 456 });
```

**Errors**:
- `NOT_FOUND`: Draft not found
- `BAD_REQUEST`: Draft must be approved before sending
- `INTERNAL_SERVER_ERROR`: Gmail sending failed

**Requirements**:
- Draft status must be "approved"

---

## Governor Router

System health, safety controls, and audit log procedures (admin only).

### `governor.getConfig`

Get all system configuration settings.

**Type**: Query (protected, admin only)

**Input**: None

**Output**:

```typescript
Array<{
  id: number;
  key: string;
  value: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}>
```

**Example**:

```typescript
const { data: config } = trpc.governor.getConfig.useQuery();

config?.forEach((setting) => {
  console.log(`${setting.key}: ${setting.value}`);
});
```

**Errors**:
- `FORBIDDEN`: User is not admin

---

### `governor.toggleKillSwitch`

Toggle the global kill-switch on/off.

**Type**: Mutation (protected, admin only)

**Input**: None

**Output**:

```typescript
{
  enabled: boolean;
}
```

**Example**:

```typescript
const toggleKillSwitch = trpc.governor.toggleKillSwitch.useMutation({
  onSuccess: (data) => {
    console.log(`Kill-switch is now ${data.enabled ? "ON" : "OFF"}`);
  },
});

toggleKillSwitch.mutate();
```

**Errors**:
- `FORBIDDEN`: User is not admin

---

### `governor.getRateLimitStats`

Get rate limit statistics for all users.

**Type**: Query (protected, admin only)

**Input**: None

**Output**:

```typescript
Array<{
  id: number;
  userId: number;
  action: string;
  count: number;
  windowStart: Date;
  windowEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}>
```

**Example**:

```typescript
const { data: stats } = trpc.governor.getRateLimitStats.useQuery();

stats?.forEach((stat) => {
  console.log(`User ${stat.userId}: ${stat.count} ${stat.action} requests`);
});
```

**Errors**:
- `FORBIDDEN`: User is not admin

---

### `governor.getAuditLogs`

Get recent audit logs.

**Type**: Query (protected, admin only)

**Input**:

```typescript
{
  limit?: number; // Default: 20
}
```

**Output**:

```typescript
Array<{
  id: number;
  userId: number | null;
  action: string;
  resource: string | null;
  resourceId: number | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: "success" | "failure" | "blocked";
  createdAt: Date;
}>
```

**Example**:

```typescript
const { data: logs } = trpc.governor.getAuditLogs.useQuery({ limit: 50 });

logs?.forEach((log) => {
  console.log(`[${log.status}] ${log.action} by user ${log.userId}`);
});
```

**Errors**:
- `FORBIDDEN`: User is not admin

---

## Orchestrator Router

Pipeline execution and job management procedures.

### `orchestrator.executePipeline`

Execute the complete pipeline (Curator → Visionary → Charmer) for a lead.

**Type**: Mutation (protected)

**Input**:

```typescript
{
  leadId: number;
}
```

**Output**:

```typescript
{
  success: true;
  message: "Pipeline execution started";
}
```

**Example**:

```typescript
const executePipeline = trpc.orchestrator.executePipeline.useMutation({
  onSuccess: () => {
    toast.success("Pipeline started");
  },
});

executePipeline.mutate({ leadId: 123 });
```

**Errors**:
- `BAD_REQUEST`: Kill-switch is active, rate limit exceeded
- `NOT_FOUND`: Lead not found

**Governor Checks**:
- Kill-switch status
- Rate limits

**Note**: This mutation returns immediately. The pipeline executes in the background. Use `orchestrator.getJobStatus` to monitor progress.

---

### `orchestrator.getJobStatus`

Get the status of a pipeline job by job ID.

**Type**: Query (protected)

**Input**:

```typescript
{
  jobId: number;
}
```

**Output**:

```typescript
{
  id: number;
  leadId: number;
  status: "pending" | "running" | "completed" | "failed";
  currentStage: string | null;
  stagesCompleted: string | null; // JSON array
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}
```

**Example**:

```typescript
const { data: job } = trpc.orchestrator.getJobStatus.useQuery({ jobId: 789 });

if (job) {
  console.log(`Status: ${job.status}`);
  console.log(`Current Stage: ${job.currentStage}`);
  console.log(`Retry Count: ${job.retryCount}`);
}
```

---

### `orchestrator.getJobsForLead`

Get all pipeline jobs for a specific lead.

**Type**: Query (protected)

**Input**:

```typescript
{
  leadId: number;
}
```

**Output**:

```typescript
Array<{
  id: number;
  leadId: number;
  status: "pending" | "running" | "completed" | "failed";
  currentStage: string | null;
  stagesCompleted: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}>
```

**Example**:

```typescript
const { data: jobs } = trpc.orchestrator.getJobsForLead.useQuery({ leadId: 123 });

jobs?.forEach((job) => {
  console.log(`Job ${job.id}: ${job.status}`);
});
```

---

## System Router

System utilities and notifications (internal use).

### `system.notifyOwner`

Send a notification to the project owner.

**Type**: Mutation (protected)

**Input**:

```typescript
{
  title: string;
  content: string;
}
```

**Output**:

```typescript
{
  success: boolean;
}
```

**Example**:

```typescript
const notifyOwner = trpc.system.notifyOwner.useMutation();

notifyOwner.mutate({
  title: "New Lead Created",
  content: "A new lead was created for Luxury Watches Inc.",
});
```

**Note**: This procedure is primarily for internal system notifications, not end-user messaging.

---

## Rate Limits

The following rate limits are enforced by The Governor:

| Action | Limit | Window |
|--------|-------|--------|
| `lead_create` | 10 requests | 1 hour |
| `asset_generate` | 20 requests | 1 hour |
| `email_send` | 50 requests | 1 day |
| `pipeline_execute` | 10 requests | 1 hour |

Rate limits are per-user and reset at the end of each window.

---

## Pagination

Currently, the API does not implement pagination. All list queries return all results. For large datasets, consider implementing cursor-based pagination:

```typescript
// Future enhancement
leads.list: protectedProcedure
  .input(z.object({
    cursor: z.number().optional(),
    limit: z.number().default(20),
  }))
  .query(async ({ ctx, input }) => {
    // Implementation
  });
```

---

## Webhooks

Velvet Alchemy does not currently support webhooks. For real-time updates, use tRPC subscriptions:

```typescript
// Future enhancement
const { data } = trpc.orchestrator.subscribeToJob.useSubscription({ jobId: 789 });
```

---

**For usage examples, see the [User Guide](USER_GUIDE.md).**
