# DEVELOPER HANDOFF GUIDE 👨‍💻

**Last Updated:** January 26, 2026 at 4:24 AM PST  
**Version:** 1.0.0  
**Status:** Production Ready

---

## Quick Start (5 Minutes)

### Prerequisites
- Node.js 22+ installed
- pnpm installed (`npm install -g pnpm`)
- Git installed
- Code editor (VS Code recommended)

### Setup
```bash
# 1. Clone the repository
git clone <your-repo-url>
cd velvet-alchemy-landing

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
# Copy .env.example to .env and fill in:
# - DATABASE_URL (MySQL/TiDB connection string)
# - STRIPE_SECRET_KEY (from Stripe dashboard)
# - STRIPE_PUBLISHABLE_KEY (from Stripe dashboard)
# - AWS credentials for S3

# 4. Push database schema
pnpm db:push

# 5. Start development server
pnpm dev

# 6. Open browser to http://localhost:3000
```

---

## Project Structure

```
velvet-alchemy-landing/
├── client/                  # Frontend React app
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts (theme, auth)
│   │   ├── lib/            # Utilities (tRPC client)
│   │   ├── App.tsx         # Main app + routing
│   │   └── main.tsx        # Entry point
│   ├── public/             # Static assets
│   └── index.html          # HTML template
├── server/                  # Backend Express + tRPC
│   ├── _core/              # Framework code (don't touch)
│   ├── lib/                # Business logic services
│   ├── *Router.ts          # tRPC API endpoints
│   ├── db.ts               # Database helpers
│   ├── storage.ts          # S3 helpers
│   └── webhooks.ts         # Stripe webhook handler
├── drizzle/                 # Database schema & migrations
│   ├── schema.ts           # Table definitions
│   └── migrations/         # SQL migration files
├── shared/                  # Code shared between client/server
│   ├── types.ts            # TypeScript types
│   └── const.ts            # Constants
├── docs/                    # Documentation
│   ├── THE_MONEY_MANUAL.md
│   ├── OPERATOR_TRAINING_GUIDE.md
│   ├── SYSTEM_ARCHITECTURE.md
│   └── DEVELOPER_HANDOFF.md (this file)
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite build config
└── drizzle.config.ts        # Database config
```

---

## Key Technologies

### Frontend Stack
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Wouter** - Lightweight routing
- **shadcn/ui** - Component library
- **tRPC** - Type-safe API client
- **TanStack Query** - Data fetching/caching

### Backend Stack
- **Express 4** - Web server
- **tRPC 11** - API layer
- **Drizzle ORM** - Database queries
- **MySQL/TiDB** - Database
- **Stripe** - Payment processing
- **AWS S3** - File storage
- **Playwright** - Browser automation

### AI Services
- **GPT-4o Vision** - Website analysis
- **GPT-4o** - Website generation
- **Manus AI** - Image generation

---

## Database Schema Quick Reference

### Core Tables

**leads** - Business prospects
- `id`, `userId`, `companyName`, `websiteUrl`
- `status`: pending → audited → contacted → closed → paid
- `prestigeScore` (0-100), `priorityScore` (0-100)
- `detailedReport` (JSON string with audit data)

**audits** - AI analysis results
- `id`, `leadId`, `summary`, `prestigeScore`
- `visualDebtData` (JSON string)

**payments** - Stripe transactions
- `id`, `lead_id`, `stripe_checkout_session_id`
- `amount` (cents), `status`, `package_type`

**assets** - Generated images
- `id`, `leadId`, `type`, `url`, `s3Key`

**pipeline_jobs** - Audit progress tracking
- `id`, `leadId`, `stage`, `progressPercentage`

**users** - Authentication
- `id`, `openId`, `name`, `email`, `role`

---

## API Endpoints (tRPC)

### Scraper Router (`server/scraperRouter.ts`)
```typescript
scraper.scrapeBusinesses({ query, location, maxResults })
  → Returns: Lead[]

scraper.getLeads({ status?, limit? })
  → Returns: Lead[]
```

### Orchestrator Router (`server/orchestratorRouter.ts`)
```typescript
orchestrator.executePipeline({ leadId })
  → Returns: { jobId, status }
  → Triggers: screenshot → audit → enrichment

orchestrator.batchAudit({ leadIds })
  → Returns: Job[]
  → Processes up to 5 leads sequentially

orchestrator.getJobStatus({ jobId })
  → Returns: { stage, progressPercentage, errorMessage }
```

### Payment Router (`server/paymentRouter.ts`)
```typescript
payment.createCheckoutSession({ leadId, packageType })
  → Returns: { checkoutUrl, sessionId }
  → Creates Stripe checkout session

payment.getPaymentsByLead({ leadId })
  → Returns: Payment[]

payment.getAllPayments()
  → Returns: Payment[] with lead details
```

### Website Generator Router (`server/websiteGeneratorRouter.ts`)
```typescript
websiteGenerator.generate({ leadId })
  → Returns: { html, css, js }
  → Uses GPT-4o to generate complete website

websiteGenerator.saveCustomizations({ leadId, customizations })
  → Returns: { success }
  → Updates website files with user changes

websiteGenerator.downloadZip({ leadId })
  → Returns: { filename, buffer }
  → Creates ZIP file for download
```

### Email Router (`server/emailRouter.ts`)
```typescript
email.generateOutreach({ leadId })
  → Returns: { to, subject, body }
  → Creates personalized email with audit findings
```

---

## Common Development Tasks

### Adding a New Page

1. **Create page component:**
```typescript
// client/src/pages/MyNewPage.tsx
import { useAuth } from "@/_core/hooks/useAuth";
import AppHeader from "@/components/AppHeader";

export default function MyNewPage() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-8">
        <h1 className="text-4xl font-serif italic">My New Page</h1>
      </main>
    </div>
  );
}
```

2. **Add route:**
```typescript
// client/src/App.tsx
import MyNewPage from "./pages/MyNewPage";

function Router() {
  return (
    <Switch>
      {/* ... existing routes ... */}
      <Route path="/my-new-page" component={MyNewPage} />
    </Switch>
  );
}
```

3. **Add navigation link:**
```typescript
// client/src/components/AppHeader.tsx
const navGroups = {
  main: [
    // ... existing items ...
    { path: "/my-new-page", label: "My Page", icon: Star },
  ],
};
```

### Adding a New API Endpoint

1. **Create router file:**
```typescript
// server/myFeatureRouter.ts
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";

export const myFeatureRouter = router({
  getData: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const [result] = await db.execute(
        `SELECT * FROM my_table WHERE id = ${input.id}`
      ) as any;
      return result[0];
    }),
    
  createData: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      await db.execute(
        `INSERT INTO my_table (name, userId) VALUES ('${input.name}', ${ctx.user.id})`
      );
      return { success: true };
    }),
});
```

2. **Register router:**
```typescript
// server/routers.ts
import { myFeatureRouter } from "./myFeatureRouter";

export const appRouter = router({
  // ... existing routers ...
  myFeature: myFeatureRouter,
});
```

3. **Call from frontend:**
```typescript
// client/src/pages/MyPage.tsx
import { trpc } from "@/lib/trpc";

export default function MyPage() {
  const { data, isLoading } = trpc.myFeature.getData.useQuery({ id: 1 });
  const createMutation = trpc.myFeature.createData.useMutation();
  
  const handleCreate = () => {
    createMutation.mutate({ name: "Test" });
  };
  
  return <div>{data?.name}</div>;
}
```

### Adding a Database Table

1. **Update schema:**
```typescript
// drizzle/schema.ts
export const myTable = mysqlTable("my_table", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MyTable = typeof myTable.$inferSelect;
export type InsertMyTable = typeof myTable.$inferInsert;
```

2. **Generate migration:**
```bash
pnpm db:push
```

3. **Verify in database:**
```bash
# Use Management UI → Database panel
# Or connect via MySQL client
```

### Styling Components

Use Tailwind CSS classes:
```tsx
<div className="flex items-center gap-4 p-6 bg-card rounded-lg border border-border">
  <h2 className="text-2xl font-serif italic text-gold">Title</h2>
  <Button variant="outline" size="lg" className="border-gold text-gold">
    Click Me
  </Button>
</div>
```

Common patterns:
- **Spacing:** `p-4`, `m-4`, `gap-4`, `space-y-4`
- **Layout:** `flex`, `grid`, `grid-cols-3`, `items-center`
- **Colors:** `bg-background`, `text-foreground`, `border-border`
- **Typography:** `text-xl`, `font-serif`, `italic`, `font-bold`
- **Effects:** `hover:bg-muted`, `transition-all`, `shadow-lg`

### Working with tRPC

**Query (fetch data):**
```typescript
const { data, isLoading, error, refetch } = trpc.leads.getById.useQuery(
  { id: leadId },
  { enabled: !!leadId } // Only run if leadId exists
);
```

**Mutation (modify data):**
```typescript
const mutation = trpc.leads.update.useMutation({
  onSuccess: () => {
    toast.success("Updated!");
    refetch(); // Refresh data
  },
  onError: (error) => {
    toast.error(error.message);
  },
});

// Trigger mutation
mutation.mutate({ id: 1, name: "New Name" });
```

**Invalidate cache:**
```typescript
const utils = trpc.useUtils();
utils.leads.getById.invalidate({ id: 1 }); // Refetch specific query
utils.leads.invalidate(); // Refetch all lead queries
```

---

## Environment Variables Reference

### Required for Development

```bash
# Database (get from TiDB Cloud or local MySQL)
DATABASE_URL="mysql://user:password@host:port/database"

# Stripe (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..." # From webhook settings

# AWS S3 (get from AWS IAM)
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
S3_BUCKET_NAME="velvet-alchemy-assets"
```

### Auto-Injected by Manus Platform

```bash
# These are automatically set in production
BUILT_IN_FORGE_API_KEY="..."
BUILT_IN_FORGE_API_URL="..."
VITE_FRONTEND_FORGE_API_KEY="..."
VITE_FRONTEND_FORGE_API_URL="..."
OAUTH_SERVER_URL="..."
VITE_OAUTH_PORTAL_URL="..."
VITE_APP_ID="..."
JWT_SECRET="..."
OWNER_OPEN_ID="..."
OWNER_NAME="..."
```

---

## Testing

### Run Tests
```bash
pnpm test                          # Run all tests
pnpm test server/payment.test.ts   # Run specific test file
pnpm test --watch                  # Watch mode
```

### Writing Tests

```typescript
// server/myFeature.test.ts
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("My Feature", () => {
  it("should return data", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, name: "Test", role: "user" },
      req: {} as any,
      res: {} as any,
    });
    
    const result = await caller.myFeature.getData({ id: 1 });
    expect(result).toBeDefined();
  });
});
```

### Manual Testing Checklist

- [ ] Scrape leads from Google Maps
- [ ] Pre-screen leads (priority scoring)
- [ ] Run full audit on lead
- [ ] View detailed report in drawer
- [ ] Generate website with AI
- [ ] Customize website colors/content
- [ ] Download ZIP file
- [ ] Create Stripe checkout session
- [ ] Complete test payment (card: 4242 4242 4242 4242)
- [ ] Verify webhook updates payment status
- [ ] Check Revenue Dashboard shows payment

---

## Debugging

### Frontend Debugging

**React DevTools:**
- Install browser extension
- Inspect component props/state
- View component tree

**Console Logging:**
```typescript
console.log("Lead data:", data);
console.error("Error:", error);
```

**Network Tab:**
- Check tRPC requests to `/api/trpc`
- Verify request/response payloads
- Check for 401/403/500 errors

### Backend Debugging

**Server Logs:**
```bash
# Dev server shows logs in terminal
[SCRAPER] Found 47 businesses
[AUDIT] Starting audit for lead 123
[ERROR] Database connection failed
```

**Database Queries:**
```typescript
// Add logging to see SQL
const [result] = await db.execute(`SELECT * FROM leads WHERE id = ${id}`);
console.log("Query result:", result);
```

**Stripe Webhook Debugging:**
```bash
# Use Stripe CLI to forward webhooks locally
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Common Issues

**Issue:** "Database connection failed"
- Check DATABASE_URL is correct
- Verify database is running
- Check network connectivity

**Issue:** "Stripe initialization failed"
- Verify STRIPE_SECRET_KEY is set
- Check key starts with `sk_test_` or `sk_live_`

**Issue:** "Screenshot capture failed"
- Run `npx playwright install chromium`
- Check browser path: `/home/ubuntu/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`

**Issue:** "S3 upload failed"
- Verify AWS credentials
- Check bucket exists and has correct permissions
- Ensure bucket region matches AWS_REGION

---

## Deployment

### Manus Platform (Recommended)

1. **Save checkpoint:**
```bash
# In Management UI, click "Save Checkpoint"
# Or use webdev_save_checkpoint tool
```

2. **Publish:**
```bash
# Click "Publish" button in Management UI
# Deploys to production with custom domain support
```

3. **Configure webhooks:**
```bash
# In Stripe Dashboard:
# 1. Go to Developers → Webhooks
# 2. Add endpoint: https://your-domain.com/api/webhooks/stripe
# 3. Select events: checkout.session.completed, checkout.session.expired
# 4. Copy webhook secret to STRIPE_WEBHOOK_SECRET
```

### Manual Deployment (Alternative)

1. **Build:**
```bash
pnpm build
# Outputs to dist/
```

2. **Deploy to VPS:**
```bash
# Copy dist/ to server
# Set environment variables
# Run: node dist/index.js
# Use PM2 or systemd for process management
```

3. **Set up reverse proxy:**
```nginx
# nginx config
server {
  listen 80;
  server_name your-domain.com;
  
  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

---

## Code Style Guidelines

### TypeScript
- Use `const` over `let`
- Prefer async/await over promises
- Use type inference when obvious
- Explicit types for function parameters/returns

### React
- Functional components only
- Use hooks (useState, useEffect, etc.)
- Extract reusable logic to custom hooks
- Keep components under 200 lines

### Naming Conventions
- **Files:** PascalCase for components, camelCase for utilities
- **Components:** PascalCase (e.g., `LeadDetail.tsx`)
- **Functions:** camelCase (e.g., `generateWebsite`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_LEADS`)
- **Database tables:** snake_case (e.g., `pipeline_jobs`)

### File Organization
- One component per file
- Group related files in folders
- Keep business logic in `server/lib/`
- Keep UI components in `client/src/components/`

---

## Performance Tips

### Frontend
- Use `React.memo()` for expensive components
- Lazy load routes with `React.lazy()`
- Debounce search inputs
- Use tRPC query caching

### Backend
- Use database indexes on frequently queried columns
- Implement pagination for large datasets
- Cache expensive API calls
- Use connection pooling

### Database
```sql
-- Add indexes for common queries
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_userId ON leads(userId);
CREATE INDEX idx_payments_lead_id ON payments(lead_id);
```

---

## Security Best Practices

### Authentication
- Never expose JWT_SECRET
- Use HTTP-only cookies for sessions
- Implement rate limiting on auth endpoints

### API Security
- Validate all inputs with Zod
- Use protectedProcedure for authenticated endpoints
- Sanitize user inputs before database queries

### Payment Security
- Never store credit card data
- Verify Stripe webhook signatures
- Use HTTPS in production
- Log all payment events

### Data Protection
- Use environment variables for secrets
- Set S3 bucket to private
- Encrypt sensitive data at rest
- Implement CORS properly

---

## Troubleshooting Guide

### Dev Server Won't Start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process using port
kill -9 <PID>

# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Database Migration Fails

```bash
# Check connection
mysql -h <host> -u <user> -p <database>

# Reset migrations (WARNING: drops all data)
pnpm db:drop
pnpm db:push

# Manual SQL fix
# Use Management UI → Database → Execute SQL
```

### TypeScript Errors

```bash
# Restart TypeScript server in VS Code
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# Check tsconfig.json is correct
# Verify all dependencies are installed
pnpm install
```

### Build Fails

```bash
# Clear cache
rm -rf dist/ .vite/

# Rebuild
pnpm build

# Check for TypeScript errors
pnpm tsc --noEmit
```

---

## Useful Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Build for production
pnpm preview                # Preview production build
pnpm test                   # Run tests
pnpm format                 # Format code with Prettier

# Database
pnpm db:push                # Push schema changes
pnpm db:studio              # Open Drizzle Studio (GUI)

# Debugging
pnpm tsc --noEmit           # Check TypeScript errors
pnpm lint                   # Run ESLint (if configured)

# Dependencies
pnpm add <package>          # Add dependency
pnpm add -D <package>       # Add dev dependency
pnpm update                 # Update all dependencies
```

---

## Resources

### Documentation
- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [tRPC Docs](https://trpc.io/docs)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Stripe API](https://stripe.com/docs/api)

### Tools
- [VS Code](https://code.visualstudio.com/) - Code editor
- [Postman](https://www.postman.com/) - API testing
- [Stripe CLI](https://stripe.com/docs/stripe-cli) - Webhook testing
- [TablePlus](https://tableplus.com/) - Database GUI

### Community
- [tRPC Discord](https://trpc.io/discord)
- [React Discord](https://discord.gg/react)
- [Tailwind Discord](https://discord.gg/tailwindcss)

---

## Next Steps

1. **Read the other docs:**
   - `THE_MONEY_MANUAL.md` - Understand the business model
   - `OPERATOR_TRAINING_GUIDE.md` - Learn the user workflow
   - `SYSTEM_ARCHITECTURE.md` - Deep dive into architecture

2. **Set up your environment:**
   - Install dependencies
   - Configure environment variables
   - Run the app locally

3. **Make a small change:**
   - Add a new button to a page
   - Create a simple API endpoint
   - Test the change

4. **Explore the codebase:**
   - Read through key files
   - Understand the data flow
   - Trace a feature end-to-end

5. **Build something new:**
   - Add a feature from the roadmap
   - Fix a bug
   - Improve performance

---

**Welcome to the team! Let's build something awesome.** 🚀
