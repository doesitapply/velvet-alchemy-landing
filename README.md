# Velvet Alchemy

**An autonomous, multi-agent revenue system designed to identify, audit, and close high-net-worth leads in the luxury market.**

Velvet Alchemy operates as a "revenue instrument" that converts URLs into contracts through automated lead acquisition, visual auditing, asset generation, and outreach. The system is built with a safety-first approach, ensuring compliance and preventing abuse while maximizing conversion efficiency.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Agents](#core-agents)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [License](#license)

---

## Overview

Velvet Alchemy is a fully autonomous revenue generation system that targets high-net-worth clients in the luxury market. The system operates through a series of specialized AI agents, each responsible for a specific stage of the lead-to-contract pipeline.

### What It Does

1. **Captures leads** by taking screenshots of target websites
2. **Audits visual quality** using GPT-4o Vision to identify design debt and calculate prestige scores
3. **Generates marketing assets** (social posts, web banners) tailored to each lead's brand DNA
4. **Drafts personalized outreach emails** using AI-powered copywriting
5. **Sends emails via Gmail** with human approval workflow
6. **Orchestrates the entire pipeline** with automated background jobs and retry logic

### Design Philosophy

Velvet Alchemy is built on three core principles:

- **Revenue Obsession**: Every component must contribute directly to closing deals
- **Safety First**: The Governor agent prevents spam, abuse, and compliance violations
- **Human-in-the-Loop**: Critical actions (email sending) require human approval
- **Full Transparency**: All operations are logged and visible in real-time dashboards

---

## System Architecture

Velvet Alchemy follows a **multi-agent architecture** where each agent is a specialized service with a single responsibility. Agents communicate through a shared database and are orchestrated by The Orchestrator.

```
┌─────────────────────────────────────────────────────────────┐
│                      Command Center                          │
│         (Unified Dashboard & Control Interface)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     The Orchestrator                         │
│         (Pipeline Automation & Job Management)               │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  The Curator  │────▶│ The Visionary │────▶│  The Charmer  │
│  (Lead Audit) │     │ (Asset Gen)   │     │  (Outreach)   │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              │
                              ▼
                    ┌───────────────┐
                    │ The Governor  │
                    │ (Safety Layer)│
                    └───────────────┘
```

---

## Core Agents

### The Curator

**Purpose**: Lead acquisition and visual quality auditing

**Capabilities**:
- Captures full-page screenshots using Playwright
- Uploads screenshots to S3 (Cloudflare R2)
- Analyzes visual debt using GPT-4o Vision
- Calculates prestige scores (0-100) based on design quality
- Stores structured audit data (typography, color, layout, imagery issues)

**Key Files**:
- `server/screenshot.ts` - Screenshot capture logic
- `server/visualAudit.ts` - LLM-powered visual analysis
- `server/db.ts` - Lead and audit database operations

---

### The Visionary

**Purpose**: Automated marketing asset generation

**Capabilities**:
- Extracts "Business DNA" from visual audits (brand colors, typography, style)
- Generates 3 social media posts + 1 web banner per lead
- Uses Manus image generation API for high-fidelity output
- Stores generated assets in S3 with metadata

**Key Files**:
- `server/visionary.ts` - Asset generation service
- `server/routers.ts` - tRPC procedures for asset workflows

---

### The Charmer

**Purpose**: AI-powered outreach email generation and delivery

**Capabilities**:
- Generates personalized email copy using LLM
- Creates campaigns and outreach drafts
- Implements approval workflow (draft → pending → approved → sent)
- Sends emails via Gmail MCP integration
- Tracks email status (sent, opened, clicked, replied)

**Key Files**:
- `server/charmer.ts` - Outreach generation logic
- `server/charmerRouter.ts` - tRPC procedures for campaign management
- `server/gmailClient.ts` - Gmail MCP wrapper

---

### The Governor

**Purpose**: Safety, compliance, and rate limiting

**Capabilities**:
- Rate limiting (10 requests/hour per user for lead creation)
- Domain reputation checks (blocks unsafe/blacklisted domains)
- Kill-switch controls (global and per-user)
- Audit logging for all critical operations
- Admin dashboard for monitoring and controls

**Key Files**:
- `server/governor.ts` - Safety enforcement logic
- `server/governorRouter.ts` - tRPC procedures for admin controls
- `client/src/pages/Governor.tsx` - Admin dashboard UI

---

### The Orchestrator

**Purpose**: Automated pipeline execution and job management

**Capabilities**:
- Chains Curator → Visionary → Charmer workflows
- Background job system with status tracking
- Error handling and automatic retry logic (max 3 attempts)
- Real-time progress updates via tRPC subscriptions
- Admin dashboard for pipeline monitoring

**Key Files**:
- `server/orchestrator.ts` - Pipeline orchestration service
- `server/orchestratorRouter.ts` - tRPC procedures for job management
- `client/src/pages/Orchestrator.tsx` - Pipeline monitoring UI

---

## Key Features

### Command Center

A unified dashboard at `/command-center` that consolidates all workflows into a single control interface. Each workflow is displayed as a card with:

- Clear description and purpose
- Launch button to trigger execution
- Real-time progress tracking with percentage bars
- Status indicators (idle/running/completed/failed)
- Quick links to detailed views

### Real-Time Updates

All dashboards use tRPC subscriptions to provide live updates as pipelines execute. No page refresh required.

### Database-Backed Persistence

All leads, audits, assets, campaigns, and jobs are stored in a MySQL database (Supabase) with full ACID guarantees.

### S3 Storage

Screenshots and generated assets are stored in Cloudflare R2 (S3-compatible) for scalability and durability.

### Gmail Integration

Email sending is handled via Gmail MCP integration, providing reliable delivery and tracking.

---

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+
- MySQL database (or Supabase)
- Cloudflare R2 bucket (or S3-compatible storage)
- Gmail account with MCP access
- Manus API key (for image generation)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd velvet-alchemy-landing

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

Required environment variables are documented in `.env.example`. Key variables include:

- `DATABASE_URL` - MySQL connection string
- `JWT_SECRET` - Session signing secret
- `BUILT_IN_FORGE_API_KEY` - Manus API key for image generation
- `OAUTH_SERVER_URL` - Manus OAuth server URL
- Gmail MCP credentials (configured via Manus MCP integration)

### First Steps

1. Navigate to `http://localhost:3000`
2. Sign in via Manus OAuth
3. Visit `/command-center` to access the unified dashboard
4. Create your first lead using "Manual Lead Creation" workflow
5. Monitor progress in real-time as the pipeline executes

---

## Technology Stack

### Frontend

- **React 19** - UI framework
- **Next.js 15** (App Router) - React framework
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - Component library
- **React Three Fiber** - 3D visualization (Gravity Well)
- **tRPC** - Type-safe API client

### Backend

- **Node.js** - Runtime environment
- **Express 4** - HTTP server
- **tRPC 11** - Type-safe API layer
- **Drizzle ORM** - Database toolkit
- **Playwright** - Browser automation for screenshots
- **Superjson** - Type-preserving serialization

### Database & Storage

- **MySQL** (via Supabase) - Relational database
- **Cloudflare R2** - S3-compatible object storage

### AI Services

- **GPT-4o Vision** - Visual audit analysis
- **Manus Image API** - Marketing asset generation
- **LLM** (via Manus) - Outreach copy generation

### External Integrations

- **Gmail MCP** - Email sending and tracking
- **Manus OAuth** - Authentication

---

## Project Structure

```
velvet-alchemy-landing/
├── client/                    # Frontend application
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # Utilities and tRPC client
│   │   ├── App.tsx           # Routes and layout
│   │   └── main.tsx          # Entry point
├── server/                    # Backend application
│   ├── _core/                # Framework plumbing
│   ├── routers.ts            # tRPC procedures
│   ├── db.ts                 # Database operations
│   ├── screenshot.ts         # Screenshot capture
│   ├── visualAudit.ts        # Visual debt analysis
│   ├── visionary.ts          # Asset generation
│   ├── charmer.ts            # Outreach generation
│   ├── orchestrator.ts       # Pipeline orchestration
│   ├── governor.ts           # Safety enforcement
│   └── storage.ts            # S3 operations
├── drizzle/                   # Database schema and migrations
│   └── schema.ts             # Table definitions
├── shared/                    # Shared types and constants
├── docs/                      # Documentation
│   ├── USER_GUIDE.md         # Step-by-step tutorials
│   ├── ARCHITECTURE.md       # Technical deep-dive
│   ├── DEPLOYMENT.md         # Production deployment
│   ├── TROUBLESHOOTING.md    # Common issues
│   └── API_REFERENCE.md      # tRPC procedures
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

---

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[User Guide](docs/USER_GUIDE.md)** - Step-by-step tutorials for each workflow
- **[Architecture](docs/ARCHITECTURE.md)** - Technical deep-dive on system design
- **[Deployment](docs/DEPLOYMENT.md)** - Production deployment checklist
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[API Reference](docs/API_REFERENCE.md)** - Complete tRPC procedure documentation

---

## License

Proprietary and confidential. All rights reserved.

---

**Built with Manus AI** - The autonomous revenue instrument for luxury market domination.
