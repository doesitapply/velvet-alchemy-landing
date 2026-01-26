# VELVET ALCHEMY - Revenue Instrument 💰

**Last Updated:** January 26, 2026 at 4:27 AM PST  
**Version:** 2.1.0  
**Status:** Production Ready (Payment Integration Complete)

---

## What Is This?

**Velvet Alchemy** is an automated revenue generation system that finds local businesses with outdated websites, proves they're losing money, generates replacement websites with AI, and collects $3k-$8k per deal through Stripe.

**Think of it as:** A money-printing vending machine for website redesigns.

**Current Status:** 49 leads loaded, payment processing live, ready to generate revenue.

---

## Quick Start

### For Operators (Non-Technical)
1. Read **[THE_MONEY_MANUAL.md](./THE_MONEY_MANUAL.md)** - Understand how this makes money
2. Read **[OPERATOR_TRAINING_GUIDE.md](./OPERATOR_TRAINING_GUIDE.md)** - Learn how to use the system
3. Login to the dashboard
4. Start generating revenue

### For Developers
1. Read **[DEVELOPER_HANDOFF.md](./DEVELOPER_HANDOFF.md)** - Setup instructions
2. Run `pnpm install && pnpm dev`
3. Read **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)** - Understand the codebase
4. Start building

---

## Documentation Index

### Business Documentation

**[📖 THE_MONEY_MANUAL.md](./THE_MONEY_MANUAL.md)**  
Complete guide on how this system generates revenue. Covers business model, pricing, sales psychology, and realistic income projections.

**[👩‍💼 OPERATOR_TRAINING_GUIDE.md](./OPERATOR_TRAINING_GUIDE.md)**  
Step-by-step playbook for non-technical operators. Learn how to scrape leads, run audits, generate websites, and collect payments.

### Technical Documentation

**[🏗️ SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)**  
Complete technical architecture including tech stack, data flow, deployment, and scaling considerations.

**[👨‍💻 DEVELOPER_HANDOFF.md](./DEVELOPER_HANDOFF.md)**  
Developer onboarding guide with setup instructions, code examples, common tasks, and troubleshooting.

**[🗄️ DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)**  
Complete database schema with table definitions, relationships, sample queries, and optimization tips.

**[📡 API_REFERENCE.md](./API_REFERENCE.md)**  
Full API documentation for all tRPC endpoints with input/output schemas and usage examples.

---

## System Overview

### What It Does

1. **Scrapes leads** from Google Maps (plumbers, dentists, lawyers, etc.)
2. **Analyzes websites** with GPT-4o Vision to calculate revenue loss
3. **Generates replacement websites** with AI in 2-3 minutes
4. **Sends invoices** via Stripe ($3k-$8k per deal)
5. **Tracks revenue** in real-time dashboard

### Key Features

✅ **Automated Lead Generation** - Google Maps scraper finds 50+ businesses in 30 seconds  
✅ **AI-Powered Audits** - GPT-4o Vision analyzes design quality and calculates revenue loss  
✅ **Website Generation** - Complete HTML/CSS/JS websites generated in minutes  
✅ **Payment Processing** - Stripe integration with automatic status updates  
✅ **Revenue Dashboard** - Track total income, conversion rates, and deal pipeline  
✅ **Email Outreach** - AI-generated personalized emails with audit findings  
✅ **Asset Generation** - Marketing images for social media and web banners  

### Current Stats

- **49 leads** loaded and ready to audit
- **Payment system** fully integrated and tested
- **Revenue tracking** dashboard live
- **$0 → $25k potential** with current lead pipeline

---

## Technology Stack

### Frontend
- React 19 + TypeScript
- Tailwind CSS 4
- tRPC (type-safe API)
- shadcn/ui components

### Backend
- Node.js 22 + Express
- tRPC API layer
- Drizzle ORM
- MySQL/TiDB database

### AI Services
- GPT-4o Vision (website analysis)
- GPT-4o (website generation)
- Manus AI (image generation)

### External Services
- Stripe (payment processing)
- AWS S3 (file storage)
- Google Maps API (lead scraping)
- Playwright (screenshot capture)

---

## Project Structure

```
velvet-alchemy-landing/
├── THE_MONEY_MANUAL.md            # Business guide
├── OPERATOR_TRAINING_GUIDE.md     # User manual
├── SYSTEM_ARCHITECTURE.md         # Technical architecture
├── DEVELOPER_HANDOFF.md           # Developer guide
├── DATABASE_SCHEMA.md             # Database documentation
├── API_REFERENCE.md               # API documentation
├── client/                         # Frontend React app
│   ├── src/
│   │   ├── pages/                 # Page components
│   │   ├── components/            # Reusable UI
│   │   └── lib/                   # Utilities
│   └── public/                    # Static assets
├── server/                         # Backend Express + tRPC
│   ├── *Router.ts                 # API endpoints
│   ├── lib/                       # Business logic
│   └── _core/                     # Framework code
├── drizzle/                        # Database
│   ├── schema.ts                  # Table definitions
│   └── migrations/                # SQL migrations
└── shared/                         # Shared code
```

---

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm
- MySQL database (or TiDB Cloud)
- Stripe account
- AWS S3 bucket

### Installation

```bash
# 1. Clone repository
git clone <repo-url>
cd velvet-alchemy-landing

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
# Copy .env.example to .env and fill in:
# - DATABASE_URL
# - STRIPE_SECRET_KEY
# - STRIPE_PUBLISHABLE_KEY
# - AWS credentials

# 4. Push database schema
pnpm db:push

# 5. Start development server
pnpm dev

# 6. Open http://localhost:3000
```

### First Steps

1. **Login** - Use OAuth to authenticate
2. **Scrape leads** - Go to /scraper, enter "plumbers Austin TX"
3. **Run audit** - Click "START AUDIT" on any lead
4. **Generate website** - Click "Generate Website" after audit
5. **Send invoice** - Click "Send Invoice ($5k)" to create payment link
6. **Track revenue** - Go to /revenue to see dashboard

---

## Key Workflows

### Lead Generation Workflow
```
1. Go to /scraper
2. Enter query (e.g., "plumbers") and location (e.g., "Austin, TX")
3. Click "SCRAPE LEADS"
4. Wait 30 seconds
5. View 50+ leads in /leads
```

### Audit Workflow
```
1. Go to /leads
2. Click on any lead
3. Click "START AUDIT"
4. Wait 2-3 minutes
5. View detailed report with revenue loss calculations
```

### Website Generation Workflow
```
1. Open audited lead
2. Click "Generate Website"
3. Wait 2-3 minutes
4. Customize colors/content in modal
5. Click "Download ZIP"
6. Deliver to client
```

### Payment Workflow
```
1. Open lead detail page
2. Click "Send Invoice ($5k)"
3. Payment link auto-copies to clipboard
4. Send link to client via email/text
5. Client pays with credit card
6. Webhook updates status to "paid"
7. Revenue Dashboard shows new payment
```

---

## Revenue Model

### Package Pricing
- **Basic:** $3,000 (single-page website)
- **Standard:** $5,000 (multi-page website) ← Most popular
- **Premium:** $8,000 (full website + blog + analytics)

### Income Projections

**Conservative (10% close rate):**
- 49 leads → 5 deals → $25,000

**Realistic (15% close rate):**
- 200 leads/month → 30 deals → $150,000/month

**Ambitious (20% close rate):**
- 500 leads/month → 100 deals → $500,000/month

### Cost Structure
- **Production cost:** $0 (AI generates everything)
- **Stripe fees:** 2.9% + $0.30 per transaction
- **Net margin:** ~97%

---

## Current Status

### ✅ Completed Features
- [x] Google Maps lead scraping
- [x] Lead pre-screening (priority scoring)
- [x] AI website auditing (GPT-4o Vision)
- [x] Revenue loss calculations
- [x] Technical leak detection
- [x] AI website generation
- [x] Website customization UI
- [x] ZIP file download
- [x] Stripe payment integration
- [x] Webhook handler for payment status
- [x] Revenue Dashboard
- [x] Email outreach generation
- [x] Marketing asset generation

### 🚧 In Progress
- [ ] Automated email sequences
- [ ] Multi-user support (team accounts)
- [ ] CRM integration

### 📋 Roadmap
- [ ] Mobile app for operators
- [ ] White-label version for agencies
- [ ] Automated follow-up system
- [ ] Custom branding for generated websites

---

## Testing

### Run Tests
```bash
pnpm test                    # Run all tests
pnpm test payment.test.ts    # Run specific test
```

### Manual Testing

**Test Payment Flow:**
1. Create checkout session
2. Use test card: 4242 4242 4242 4242
3. Complete payment
4. Verify webhook updates status
5. Check Revenue Dashboard

**Test Audit Flow:**
1. Scrape test lead
2. Run full audit
3. Verify prestige score calculated
4. Check detailed report JSON

---

## Deployment

### Manus Platform (Recommended)

1. **Save checkpoint:**
   - Click "Save Checkpoint" in Management UI
   - Or use `webdev_save_checkpoint` tool

2. **Publish:**
   - Click "Publish" button in Management UI
   - Deploys to production with custom domain

3. **Configure Stripe webhook:**
   - Go to Stripe Dashboard → Webhooks
   - Add endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Select events: `checkout.session.completed`, `checkout.session.expired`
   - Copy webhook secret to environment variables

### Manual Deployment

```bash
# Build for production
pnpm build

# Deploy dist/ folder to VPS
# Set environment variables
# Run: node dist/index.js
```

---

## Environment Variables

### Required
```bash
DATABASE_URL="mysql://..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
S3_BUCKET_NAME="..."
```

### Auto-Injected (Manus Platform)
```bash
BUILT_IN_FORGE_API_KEY="..."
OAUTH_SERVER_URL="..."
JWT_SECRET="..."
```

---

## Support & Resources

### Documentation
- **Business:** THE_MONEY_MANUAL.md, OPERATOR_TRAINING_GUIDE.md
- **Technical:** SYSTEM_ARCHITECTURE.md, DEVELOPER_HANDOFF.md
- **Reference:** DATABASE_SCHEMA.md, API_REFERENCE.md

### External Resources
- [tRPC Docs](https://trpc.io/docs)
- [Stripe API](https://stripe.com/docs/api)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Common Issues

**Dev server won't start:**
```bash
lsof -i :3000
kill -9 <PID>
pnpm dev
```

**Database connection failed:**
- Check DATABASE_URL is correct
- Verify database is running

**Stripe initialization failed:**
- Verify STRIPE_SECRET_KEY is set
- Check key starts with `sk_test_` or `sk_live_`

---

## Contributing

### Code Style
- TypeScript strict mode
- Prettier for formatting
- ESLint for linting
- Conventional commits

### Pull Request Process
1. Create feature branch
2. Make changes
3. Write tests
4. Update documentation
5. Submit PR

---

## License

Proprietary - All rights reserved

---

## Contact

For questions, issues, or feature requests, contact the project owner.

---

## Changelog

### v2.1.0 (2026-01-26)
- ✅ Added Stripe payment integration
- ✅ Added Revenue Dashboard
- ✅ Added webhook handler for payment status
- ✅ Added payment tracking in database
- ✅ Updated all documentation with timestamps

### v2.0.0 (2026-01-20)
- ✅ Complete system rebuild with tRPC
- ✅ AI website generation
- ✅ Batch audit processing
- ✅ Email outreach generation

### v1.0.0 (2026-01-15)
- ✅ Initial release
- ✅ Google Maps scraping
- ✅ AI website auditing
- ✅ Lead management

---

**Ready to print money? Read THE_MONEY_MANUAL.md and get started.** 💰🚀
