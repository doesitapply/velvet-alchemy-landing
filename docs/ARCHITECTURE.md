# Velvet Alchemy Architecture

This document provides a comprehensive technical deep-dive into the Velvet Alchemy system architecture, including agent design, database schema, API structure, and integration patterns.

---

## Table of Contents

- [System Overview](#system-overview)
- [Multi-Agent Architecture](#multi-agent-architecture)
- [Database Schema](#database-schema)
- [API Layer (tRPC)](#api-layer-trpc)
- [Storage Architecture](#storage-architecture)
- [Authentication & Authorization](#authentication--authorization)
- [Background Job System](#background-job-system)
- [External Integrations](#external-integrations)
- [Error Handling & Resilience](#error-handling--resilience)
- [Performance Considerations](#performance-considerations)
- [Security Architecture](#security-architecture)

---

## System Overview

Velvet Alchemy is built as a **monolithic application with microservice-inspired agent architecture**. The system uses a single codebase and database but organizes functionality into specialized agents that operate independently while sharing data through a common persistence layer.

### Core Design Principles

**Separation of Concerns**: Each agent has a single, well-defined responsibility. The Curator handles lead acquisition and auditing, The Visionary handles asset generation, The Charmer handles outreach, and The Governor handles safety enforcement.

**Event-Driven Orchestration**: The Orchestrator coordinates agents through a background job system that tracks pipeline execution state in the database. Agents do not directly call each other; instead, they read and write to shared database tables.

**Safety First**: The Governor acts as a middleware layer that enforces rate limits, domain reputation checks, and kill-switch controls before any critical operation. All operations are logged for compliance and debugging.

**Type Safety**: The system uses TypeScript end-to-end with tRPC for type-safe API communication. Database types are generated from Drizzle ORM schemas, ensuring consistency between database and application code.

### Technology Stack

The system is built on a modern TypeScript stack:

- **Frontend**: React 19, Next.js 15, Tailwind CSS 4, shadcn/ui
- **Backend**: Node.js, Express 4, tRPC 11
- **Database**: MySQL (via Supabase) with Drizzle ORM
- **Storage**: Cloudflare R2 (S3-compatible)
- **AI Services**: GPT-4o Vision, Manus Image API, LLM
- **External Integrations**: Gmail MCP, Manus OAuth

---

## Multi-Agent Architecture

Velvet Alchemy implements a **multi-agent system** where each agent is a specialized service with a single responsibility. Agents communicate through a shared database and are orchestrated by The Orchestrator.

### Agent Communication Pattern

Agents follow a **read-write pattern** for communication:

1. **Agent A** writes data to a shared database table
2. **Agent B** reads data from the table when triggered
3. **Agent B** processes the data and writes results to another table
4. **Agent C** reads the results and continues the pipeline

This pattern provides several benefits:

- **Decoupling**: Agents do not need to know about each other's implementation
- **Auditability**: All data flows are persisted and can be inspected
- **Resilience**: If an agent fails, the data remains in the database for retry
- **Scalability**: Agents can be scaled independently (future enhancement)

### The Curator

**Responsibility**: Lead acquisition and visual quality auditing

**Input**: Company name, website URL

**Output**: Lead record, screenshot (S3), visual audit, prestige score

**Key Functions**:

```typescript
// Screenshot capture using Playwright
async function captureScreenshot(url: string): Promise<{
  success: boolean;
  buffer?: Buffer;
  error?: string;
}>;

// Visual debt analysis using GPT-4o Vision
async function analyzeVisualDebt(
  screenshotUrl: string,
  websiteUrl: string,
  companyName: string
): Promise<{
  summary: string;
  prestigeScore: number;
  typography: VisualDebtCategory;
  colorScheme: VisualDebtCategory;
  layout: VisualDebtCategory;
  imagery: VisualDebtCategory;
}>;
```

**Database Tables**:
- `leads` - Lead records with company info and screenshot URL
- `audits` - Visual audit results with prestige score

**External Dependencies**:
- Playwright for browser automation
- GPT-4o Vision for visual analysis
- Cloudflare R2 for screenshot storage

---

### The Visionary

**Responsibility**: Automated marketing asset generation

**Input**: Lead ID (requires existing audit)

**Output**: 3 social posts + 1 web banner (stored in S3)

**Key Functions**:

```typescript
// Extract brand DNA from visual audit
function extractBusinessDNA(visualDebt: VisualDebt): {
  primaryColor: string;
  secondaryColor: string;
  typography: string;
  style: string;
  tone: string;
};

// Generate assets using Manus Image API
async function generateAssetsForLead(
  leadId: number,
  companyName: string,
  websiteUrl: string,
  visualDebt: VisualDebt
): Promise<{
  assets: Asset[];
  errors: string[];
}>;
```

**Database Tables**:
- `assets` - Generated asset records with S3 URLs and metadata

**External Dependencies**:
- Manus Image API for asset generation
- Cloudflare R2 for asset storage

**Asset Generation Strategy**:

The Visionary uses a two-step process:

1. **Business DNA Extraction**: Analyzes the visual audit to extract brand colors, typography, style, and tone
2. **Prompt Engineering**: Constructs detailed prompts for the image generation API based on the Business DNA

Each asset type has a specific prompt template:

- **Social Posts**: Square format (1080x1080), brand-aligned, professional tone
- **Web Banner**: Wide format (1200x628), high-impact, conversion-focused

---

### The Charmer

**Responsibility**: AI-powered outreach email generation and delivery

**Input**: Lead ID, recipient email, recipient name

**Output**: Campaign record, outreach draft, email sent via Gmail

**Key Functions**:

```typescript
// Generate personalized email copy
async function generateOutreachCopy(
  companyName: string,
  websiteUrl: string,
  prestigeScore: number,
  visualDebt: VisualDebt,
  recipientName: string
): Promise<{
  subject: string;
  body: string;
}>;

// Send email via Gmail MCP
async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}>;
```

**Database Tables**:
- `campaigns` - Campaign records with status tracking
- `outreach_drafts` - Email drafts with approval workflow

**External Dependencies**:
- LLM for email copy generation
- Gmail MCP for email delivery

**Approval Workflow**:

The Charmer implements a state machine for draft approval:

```
draft → pending_approval → approved → sent
                        ↓
                    rejected
```

Only approved drafts can be sent. Rejected drafts remain in the database for audit purposes.

---

### The Governor

**Responsibility**: Safety, compliance, and rate limiting

**Input**: User ID, action type, resource

**Output**: Allow/deny decision, audit log entry

**Key Functions**:

```typescript
// Check rate limits
async function checkRateLimit(
  userId: number,
  action: string
): Promise<void>; // Throws error if limit exceeded

// Check domain reputation
async function checkDomainReputation(
  url: string
): Promise<boolean>;

// Check kill-switch status
async function checkKillSwitch(
  userId: number
): Promise<void>; // Throws error if active

// Log audit entry
async function logAudit(entry: {
  userId: number;
  action: string;
  resource: string;
  resourceId?: number;
  details: string;
  status: 'success' | 'failure' | 'blocked';
}): Promise<void>;
```

**Database Tables**:
- `rate_limits` - Rate limit tracking per user per action
- `system_config` - Kill-switch and global settings
- `audit_log` - Compliance and debugging logs

**Rate Limiting Strategy**:

The Governor uses a **sliding window** algorithm:

1. Check if a rate limit record exists for the user + action
2. If the window has expired, create a new record
3. If the window is active and count < limit, increment count
4. If the window is active and count >= limit, throw error

Default rate limits:
- `lead_create`: 10 requests per hour
- `asset_generate`: 20 requests per hour
- `email_send`: 50 requests per day

**Kill-Switch Architecture**:

The Governor supports two types of kill-switches:

- **Global Kill-Switch**: Disables all operations for all users (emergency shutdown)
- **Per-User Kill-Switch**: Disables operations for a specific user (abuse prevention)

Kill-switches are stored in the `system_config` table with keys `kill_switch_global` and `kill_switch_user_{userId}`.

---

### The Orchestrator

**Responsibility**: Automated pipeline execution and job management

**Input**: Lead ID (or company name + URL for new leads)

**Output**: Pipeline job record with status tracking

**Key Functions**:

```typescript
// Execute full pipeline
async function executePipeline(
  leadId: number
): Promise<{
  jobId: number;
  status: string;
}>;

// Retry failed job
async function retryJob(
  jobId: number
): Promise<void>;
```

**Database Tables**:
- `pipeline_jobs` - Job records with status, stage, and error tracking

**Pipeline Stages**:

The Orchestrator executes three stages in sequence:

1. **Stage 1: Screenshot + Audit** (The Curator)
   - Captures screenshot
   - Uploads to S3
   - Runs visual audit
   - Calculates prestige score

2. **Stage 2: Asset Generation** (The Visionary)
   - Extracts Business DNA
   - Generates 3 social posts + 1 web banner
   - Uploads assets to S3

3. **Stage 3: Outreach Draft** (The Charmer)
   - Generates personalized email copy
   - Creates campaign and draft records
   - Sets status to "pending_approval"

**Error Handling**:

The Orchestrator implements automatic retry logic:

- **Transient Errors**: Automatically retried (network timeouts, API rate limits)
- **Permanent Errors**: Marked as failed after 3 attempts (invalid URLs, blocked domains)
- **Retry Delay**: 5 seconds between attempts

Job status is updated in real-time and can be monitored via the Orchestrator dashboard.

---

## Database Schema

Velvet Alchemy uses a **relational database** (MySQL via Supabase) with Drizzle ORM for type-safe queries.

### Entity Relationship Diagram

```
users
  ├─→ leads (1:N)
  │     ├─→ audits (1:1)
  │     ├─→ assets (1:N)
  │     ├─→ campaigns (1:N)
  │     │     └─→ outreach_drafts (1:N)
  │     └─→ pipeline_jobs (1:1)
  ├─→ rate_limits (1:N)
  └─→ audit_log (1:N)

waitlist (independent)
system_config (independent)
```

### Core Tables

#### `users`

Stores user account information and authentication data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment primary key |
| `openId` | VARCHAR(64) | Manus OAuth identifier (unique) |
| `name` | TEXT | User's full name |
| `email` | VARCHAR(320) | User's email address |
| `loginMethod` | VARCHAR(64) | OAuth provider (e.g., "google") |
| `role` | ENUM | User role: "user" or "admin" |
| `createdAt` | TIMESTAMP | Account creation timestamp |
| `updatedAt` | TIMESTAMP | Last update timestamp |
| `lastSignedIn` | TIMESTAMP | Last login timestamp |

#### `leads`

Stores lead records with company information and screenshot URLs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment primary key |
| `userId` | INT (FK) | Owner of this lead |
| `companyName` | VARCHAR(255) | Target company name |
| `websiteUrl` | VARCHAR(512) | Company website URL |
| `screenshotUrl` | VARCHAR(512) | S3 URL of screenshot |
| `screenshotKey` | VARCHAR(512) | S3 key for deletion |
| `status` | ENUM | Lead status: "pending", "audited", "contacted", "closed" |
| `createdAt` | TIMESTAMP | Lead creation timestamp |
| `updatedAt` | TIMESTAMP | Last update timestamp |

#### `audits`

Stores visual audit results with prestige scores and structured findings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment primary key |
| `leadId` | INT (FK) | Associated lead ID |
| `summary` | TEXT | Human-readable audit summary |
| `prestigeScore` | INT | Design quality score (0-100) |
| `visualDebtData` | TEXT | JSON string with structured findings |
| `createdAt` | TIMESTAMP | Audit creation timestamp |
| `updatedAt` | TIMESTAMP | Last update timestamp |

**Visual Debt Data Structure**:

```json
{
  "summary": "Overall assessment...",
  "prestigeScore": 75,
  "typography": {
    "score": 8,
    "issues": ["Inconsistent font sizes", "Poor hierarchy"],
    "recommendations": ["Use a type scale", "Establish clear hierarchy"]
  },
  "colorScheme": {
    "score": 6,
    "issues": ["Low contrast", "Too many colors"],
    "recommendations": ["Increase contrast ratios", "Limit palette to 3-5 colors"]
  },
  "layout": {
    "score": 7,
    "issues": ["Cramped spacing", "Misaligned elements"],
    "recommendations": ["Increase whitespace", "Use a grid system"]
  },
  "imagery": {
    "score": 9,
    "issues": ["Low resolution logo"],
    "recommendations": ["Use vector graphics for logos"]
  }
}
```

#### `assets`

Stores generated marketing assets with S3 URLs and metadata.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment primary key |
| `leadId` | INT (FK) | Associated lead ID |
| `type` | ENUM | Asset type: "hero_header", "social_post", "web_banner" |
| `url` | VARCHAR(512) | S3 URL of asset |
| `s3Key` | VARCHAR(512) | S3 key for deletion |
| `metadata` | TEXT | JSON string with generation details |
| `createdAt` | TIMESTAMP | Asset creation timestamp |

#### `campaigns`

Stores outreach campaign records with status tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment primary key |
| `leadId` | INT (FK) | Associated lead ID |
| `userId` | INT (FK) | Campaign owner |
| `name` | VARCHAR(255) | Campaign name |
| `status` | ENUM | Campaign status: "draft", "pending_approval", "approved", "sent", "failed" |
| `sentAt` | TIMESTAMP | Email sent timestamp |
| `openedAt` | TIMESTAMP | First email open timestamp |
| `clickedAt` | TIMESTAMP | First link click timestamp |
| `repliedAt` | TIMESTAMP | First reply timestamp |
| `createdAt` | TIMESTAMP | Campaign creation timestamp |
| `updatedAt` | TIMESTAMP | Last update timestamp |

#### `outreach_drafts`

Stores email drafts with approval workflow.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment primary key |
| `campaignId` | INT (FK) | Associated campaign ID |
| `subject` | VARCHAR(255) | Email subject line |
| `body` | TEXT | Email body copy |
| `recipientEmail` | VARCHAR(320) | Recipient email address |
| `recipientName` | VARCHAR(255) | Recipient full name |
| `status` | ENUM | Draft status: "draft", "pending_approval", "approved", "rejected", "sent" |
| `rejectionReason` | TEXT | Reason for rejection (if rejected) |
| `approvedBy` | INT (FK) | User ID of approver |
| `approvedAt` | TIMESTAMP | Approval timestamp |
| `sentAt` | TIMESTAMP | Email sent timestamp |
| `gmailMessageId` | VARCHAR(255) | Gmail message ID (for tracking) |
| `createdAt` | TIMESTAMP | Draft creation timestamp |
| `updatedAt` | TIMESTAMP | Last update timestamp |

#### `pipeline_jobs`

Stores pipeline job records with status and error tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment primary key |
| `leadId` | INT (FK) | Associated lead ID (cascade delete) |
| `status` | ENUM | Job status: "pending", "running", "completed", "failed" |
| `currentStage` | VARCHAR(50) | Current pipeline stage |
| `stagesCompleted` | TEXT | JSON array of completed stages |
| `errorMessage` | TEXT | Error details (if failed) |
| `retryCount` | INT | Number of retry attempts |
| `createdAt` | TIMESTAMP | Job creation timestamp |
| `updatedAt` | TIMESTAMP | Last update timestamp |
| `completedAt` | TIMESTAMP | Job completion timestamp |

#### `rate_limits`

Stores rate limit tracking per user per action.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment primary key |
| `userId` | INT (FK) | User ID |
| `action` | VARCHAR(64) | Action type (e.g., "lead_create") |
| `count` | INT | Request count in current window |
| `windowStart` | TIMESTAMP | Rate limit window start |
| `windowEnd` | TIMESTAMP | Rate limit window end |
| `createdAt` | TIMESTAMP | Record creation timestamp |
| `updatedAt` | TIMESTAMP | Last update timestamp |

#### `audit_log`

Stores compliance and debugging logs for all critical operations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Auto-increment primary key |
| `userId` | INT (FK) | User ID (nullable for system operations) |
| `action` | VARCHAR(64) | Action type (e.g., "lead_create") |
| `resource` | VARCHAR(64) | Resource type (e.g., "leads") |
| `resourceId` | INT | Resource ID (if applicable) |
| `details` | TEXT | Human-readable details |
| `ipAddress` | VARCHAR(45) | Client IP address |
| `userAgent` | TEXT | Client user agent |
| `status` | ENUM | Operation status: "success", "failure", "blocked" |
| `createdAt` | TIMESTAMP | Log entry timestamp |

---

## API Layer (tRPC)

Velvet Alchemy uses **tRPC** for type-safe API communication between frontend and backend. All API procedures are defined in `server/routers.ts` and organized by domain.

### tRPC Architecture

tRPC provides several benefits over traditional REST APIs:

- **End-to-End Type Safety**: Types flow from backend to frontend automatically
- **No Code Generation**: Types are inferred at compile time
- **Automatic Serialization**: Superjson handles complex types (Date, BigInt, etc.)
- **Batching**: Multiple requests are batched into a single HTTP call

### Router Structure

The application router is organized into sub-routers by domain:

```typescript
export const appRouter = router({
  system: systemRouter,        // System utilities (notifications, etc.)
  auth: authRouter,             // Authentication (login, logout)
  waitlist: waitlistRouter,     // Waitlist management
  leads: leadsRouter,           // Lead CRUD operations
  visionary: visionaryRouter,   // Asset generation
  charmer: charmerRouter,       // Outreach management
  governor: governorRouter,     // Safety controls
  orchestrator: orchestratorRouter, // Pipeline jobs
});
```

### Procedure Types

tRPC supports two procedure types:

- **Query**: Read-only operations (GET semantics)
- **Mutation**: Write operations (POST/PUT/DELETE semantics)

### Authentication Middleware

tRPC procedures can be public or protected:

```typescript
// Public procedure (no authentication required)
publicProcedure
  .input(z.object({ email: z.string().email() }))
  .mutation(async ({ input }) => {
    // Implementation
  });

// Protected procedure (requires authentication)
protectedProcedure
  .input(z.object({ leadId: z.number() }))
  .query(async ({ ctx, input }) => {
    // ctx.user is available and type-safe
    const lead = await getLeadById(input.leadId);
    return lead;
  });
```

### Input Validation

All inputs are validated using Zod schemas:

```typescript
leads.create: protectedProcedure
  .input(z.object({
    companyName: z.string().min(1),
    websiteUrl: z.string().url(),
  }))
  .mutation(async ({ ctx, input }) => {
    // input is type-safe and validated
  });
```

### Error Handling

tRPC errors are automatically serialized and typed:

```typescript
throw new TRPCError({
  code: 'BAD_REQUEST',
  message: 'Domain flagged as unsafe',
});
```

Frontend receives typed errors:

```typescript
const mutation = trpc.leads.create.useMutation({
  onError: (error) => {
    // error.message is type-safe
    toast.error(error.message);
  },
});
```

---

## Storage Architecture

Velvet Alchemy uses **Cloudflare R2** (S3-compatible) for object storage. All screenshots and generated assets are stored in R2 with public read access.

### Storage Strategy

The system follows a **database + S3** pattern:

- **Database**: Stores metadata (URL, key, dimensions, mime type)
- **S3**: Stores actual file bytes

This approach provides several benefits:

- **Scalability**: S3 handles large files and high throughput
- **Cost Efficiency**: Database storage is expensive; S3 is cheap
- **Query Performance**: Database queries remain fast (no BLOB columns)
- **CDN Integration**: S3 URLs can be served via CDN for global distribution

### File Naming Convention

All files use a consistent naming pattern to prevent enumeration:

```
{userId}-{category}/{filename}-{randomSuffix}.{ext}
```

Example:
```
123-leads/acme-corp-screenshot-x7k2p9.png
123-assets/acme-corp-social-1-a4b8c2.png
```

### Upload Flow

1. **Generate unique file key** with random suffix
2. **Upload file to S3** using `storagePut()`
3. **Store metadata in database** with S3 URL and key
4. **Return URL to client** for display

### Download Flow

1. **Query database** for file metadata
2. **Return S3 URL** to client
3. **Client fetches file** directly from S3 (no proxy)

### Deletion Flow

1. **Query database** for file key
2. **Delete file from S3** using `storageDelete()`
3. **Delete metadata from database**

---

## Authentication & Authorization

Velvet Alchemy uses **Manus OAuth** for authentication and **role-based access control (RBAC)** for authorization.

### OAuth Flow

1. **User clicks "Login"** on the homepage
2. **Redirect to Manus OAuth portal** with client ID and redirect URI
3. **User authenticates** with Manus (Google, GitHub, etc.)
4. **OAuth callback** returns authorization code
5. **Backend exchanges code for access token** and user info
6. **Session cookie is set** with JWT containing user ID and role
7. **User is redirected** to the application

### Session Management

Sessions are stored in **HTTP-only cookies** with the following properties:

- **Name**: `manus_session`
- **HttpOnly**: `true` (prevents XSS attacks)
- **Secure**: `true` (HTTPS only in production)
- **SameSite**: `Lax` (CSRF protection)
- **MaxAge**: 7 days

Session cookies contain a **JWT** signed with `JWT_SECRET`:

```json
{
  "userId": 123,
  "openId": "abc123",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Role-Based Access Control

The system supports two roles:

- **User**: Can create leads, generate assets, approve drafts
- **Admin**: All user permissions + Governor controls + system configuration

Roles are enforced at two levels:

1. **Backend**: tRPC procedures check `ctx.user.role`
2. **Frontend**: UI conditionally renders admin-only features

### Authorization Patterns

**Protected Procedure**:
```typescript
protectedProcedure
  .input(z.object({ leadId: z.number() }))
  .query(async ({ ctx, input }) => {
    // ctx.user is guaranteed to exist
    const lead = await getLeadById(input.leadId);
    
    // Check ownership
    if (lead.userId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    
    return lead;
  });
```

**Admin-Only Procedure**:
```typescript
protectedProcedure
  .use(({ ctx, next }) => {
    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    return next({ ctx });
  })
  .mutation(async ({ ctx, input }) => {
    // Only admins can reach this code
  });
```

---

## Background Job System

The Orchestrator implements a **background job system** for pipeline execution. Jobs are stored in the `pipeline_jobs` table and processed asynchronously.

### Job Lifecycle

```
pending → running → completed
                  ↓
                failed → (retry) → running
```

### Job Processing

Jobs are processed using a **polling pattern**:

1. **Query database** for pending jobs
2. **Update status** to "running"
3. **Execute pipeline stages** sequentially
4. **Update status** to "completed" or "failed"
5. **Repeat** every 5 seconds

### Retry Logic

Failed jobs are automatically retried up to 3 times:

1. **Job fails** with error message
2. **Increment retry count** in database
3. **Wait 5 seconds** before retry
4. **Reset status** to "pending"
5. **Job is picked up** by next polling cycle

If retry count exceeds 3, the job is marked as permanently failed.

### Concurrency Control

The system uses **optimistic locking** to prevent race conditions:

```typescript
// Update job status only if still pending
await db.update(pipelineJobs)
  .set({ status: 'running' })
  .where(
    and(
      eq(pipelineJobs.id, jobId),
      eq(pipelineJobs.status, 'pending')
    )
  );
```

This ensures only one worker processes each job.

---

## External Integrations

Velvet Alchemy integrates with several external services:

### GPT-4o Vision (via Manus)

**Purpose**: Visual debt analysis

**API**: `invokeLLM()` with image URL

**Input**: Screenshot URL, company name, website URL

**Output**: Structured visual audit with prestige score

**Rate Limits**: Handled by Manus API

### Manus Image API

**Purpose**: Marketing asset generation

**API**: `generateImage()` with prompt and dimensions

**Input**: Text prompt, image dimensions, style parameters

**Output**: Generated image URL

**Rate Limits**: Handled by Manus API

### Gmail MCP

**Purpose**: Email sending and tracking

**API**: `manus-mcp-cli tool call gmail.send_email`

**Input**: Recipient, subject, body

**Output**: Gmail message ID

**Authentication**: OAuth via Manus MCP integration

### Manus OAuth

**Purpose**: User authentication

**API**: OAuth 2.0 authorization code flow

**Input**: Client ID, redirect URI

**Output**: Access token, user info

**Session**: JWT stored in HTTP-only cookie

---

## Error Handling & Resilience

Velvet Alchemy implements comprehensive error handling at multiple levels:

### Application-Level Errors

All errors are caught and logged:

```typescript
try {
  await captureScreenshot(url);
} catch (error) {
  await logAudit({
    userId: ctx.user.id,
    action: 'screenshot_capture',
    resource: 'leads',
    details: `Error: ${error.message}`,
    status: 'failure',
  });
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Failed to capture screenshot',
  });
}
```

### Database Errors

Database errors are automatically retried by Drizzle ORM:

- **Connection errors**: Retry with exponential backoff
- **Deadlocks**: Retry transaction
- **Constraint violations**: Throw typed error

### External Service Errors

External service errors are handled with retries and fallbacks:

- **Network timeouts**: Retry up to 3 times
- **Rate limits**: Wait and retry
- **Service unavailable**: Mark job as failed for manual retry

### Frontend Error Boundaries

React error boundaries catch rendering errors:

```typescript
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

---

## Performance Considerations

### Database Indexing

All foreign keys and frequently queried columns are indexed:

- `leads.userId` - Index for user-specific queries
- `audits.leadId` - Index for lead-audit joins
- `assets.leadId` - Index for lead-asset joins
- `campaigns.leadId` - Index for lead-campaign joins
- `pipeline_jobs.leadId` - Index for lead-job joins

### Query Optimization

All queries use Drizzle ORM with type-safe query builders:

```typescript
// Efficient join query
const leadsWithAudits = await db
  .select()
  .from(leads)
  .leftJoin(audits, eq(leads.id, audits.leadId))
  .where(eq(leads.userId, userId));
```

### Caching Strategy

The system uses **stale-while-revalidate** caching:

- **tRPC queries**: Cached on client with 5-minute TTL
- **S3 URLs**: Cached with 1-year TTL (immutable)
- **Database queries**: No caching (always fresh)

### Asset Optimization

All generated assets are optimized for web delivery:

- **Images**: PNG format, compressed
- **Dimensions**: Optimized for target platform (1080x1080 for social, 1200x628 for web)
- **File size**: Target < 500KB per asset

---

## Security Architecture

### Input Validation

All user inputs are validated using Zod schemas:

```typescript
z.object({
  companyName: z.string().min(1).max(255),
  websiteUrl: z.string().url(),
})
```

### SQL Injection Prevention

Drizzle ORM uses parameterized queries:

```typescript
// Safe from SQL injection
await db.select().from(leads).where(eq(leads.id, leadId));
```

### XSS Prevention

React automatically escapes all rendered content. For HTML rendering, use `dangerouslySetInnerHTML` only with sanitized content.

### CSRF Protection

Session cookies use `SameSite: Lax` to prevent CSRF attacks.

### Rate Limiting

The Governor enforces rate limits to prevent abuse:

- **Lead creation**: 10 per hour
- **Asset generation**: 20 per hour
- **Email sending**: 50 per day

### Domain Reputation

The Governor checks domain reputation before processing:

- **Blacklist check**: Blocks known malicious domains
- **DNS validation**: Ensures domain resolves
- **SSL check**: Verifies HTTPS availability

### Audit Logging

All critical operations are logged for compliance:

- **User actions**: Lead creation, email sending
- **System actions**: Rate limit enforcement, kill-switch activation
- **Errors**: Failed operations, blocked requests

---

**For API documentation, see [API_REFERENCE.md](API_REFERENCE.md).**
