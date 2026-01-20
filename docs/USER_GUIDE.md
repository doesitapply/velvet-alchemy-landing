# Velvet Alchemy User Guide

This guide provides step-by-step instructions for using Velvet Alchemy's autonomous revenue system. Whether you are creating your first lead or monitoring a full pipeline execution, this document will walk you through each workflow.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Command Center Overview](#command-center-overview)
- [Workflow 1: Manual Lead Creation](#workflow-1-manual-lead-creation)
- [Workflow 2: Full Pipeline Automation](#workflow-2-full-pipeline-automation)
- [Workflow 3: Asset Generation Only](#workflow-3-asset-generation-only)
- [Workflow 4: Outreach Draft Generation](#workflow-4-outreach-draft-generation)
- [Workflow 5: System Health Check](#workflow-5-system-health-check)
- [Managing Leads](#managing-leads)
- [Approving Outreach Drafts](#approving-outreach-drafts)
- [Monitoring Pipeline Jobs](#monitoring-pipeline-jobs)
- [Best Practices](#best-practices)

---

## Getting Started

### Accessing the System

After logging in via Manus OAuth, you will land on the Velvet Alchemy homepage. The system provides several entry points:

- **Command Center** (`/command-center`) - Unified dashboard for all workflows
- **Dashboard** (`/dashboard`) - Lead management and overview
- **Governor** (`/governor`) - System health and safety controls
- **Charmer** (`/charmer`) - Outreach draft approval queue
- **Orchestrator** (`/orchestrator`) - Pipeline job monitoring

The **Command Center** is the recommended starting point for most operations.

### User Roles and Permissions

Velvet Alchemy uses role-based access control:

- **Admin**: Full access to all workflows, Governor controls, and system configuration
- **User**: Access to lead creation, asset generation, and outreach workflows (no Governor access)

Your role is determined during account creation and can be modified by an administrator through the database.

---

## Command Center Overview

The Command Center (`/command-center`) is the primary control interface for Velvet Alchemy. It consolidates all workflows into a single dashboard with real-time status tracking.

### Dashboard Layout

The Command Center is organized into workflow cards, each representing a specific operation:

| Workflow | Purpose | Typical Use Case |
|----------|---------|------------------|
| Manual Lead Creation | Create a single lead with screenshot and audit | Testing new target companies |
| Full Pipeline Automation | Execute the complete pipeline (Curator → Visionary → Charmer) | Automated lead processing |
| Asset Generation Only | Generate marketing assets for an existing lead | Refreshing creative materials |
| Outreach Draft Generation | Create personalized email copy for a lead | Manual outreach campaigns |
| System Health Check | Verify Governor status and rate limits | Troubleshooting and monitoring |

Each workflow card displays:

- **Description**: What the workflow does
- **Purpose**: Why you would use it
- **Launch Button**: Trigger execution
- **Progress Bar**: Real-time completion percentage
- **Status Indicator**: Current state (idle, running, completed, failed)

### Quick Links

The Quick Links section provides navigation to detailed views:

- **View All Leads** - Navigate to the Dashboard
- **Approve Drafts** - Navigate to the Charmer approval queue
- **Pipeline Monitor** - Navigate to the Orchestrator job list
- **System Health** - Navigate to the Governor dashboard

---

## Workflow 1: Manual Lead Creation

**Purpose**: Create a single lead with screenshot capture and visual audit analysis.

### Step-by-Step Instructions

1. **Navigate to Command Center** (`/command-center`)

2. **Locate the "Manual Lead Creation" card** in the workflows section

3. **Click the "Create Lead" button** to open the input dialog

4. **Enter lead information**:
   - **Company Name**: The name of the target company (e.g., "Luxury Watches Inc.")
   - **Website URL**: The full URL of the company's website (e.g., "https://example.com")

5. **Click "Submit"** to trigger the workflow

6. **Monitor progress** in real-time:
   - The progress bar will update as the workflow executes
   - Status will change from "idle" → "running" → "completed"
   - Typical execution time: 15-30 seconds

7. **View results**:
   - Once completed, navigate to the Dashboard to see the new lead
   - Click on the lead to view the screenshot, visual audit, and prestige score

### What Happens Behind the Scenes

When you create a lead, the system performs the following operations:

1. **Governor Check**: Verifies rate limits and kill-switch status
2. **Domain Reputation**: Checks if the domain is safe and not blacklisted
3. **Screenshot Capture**: Uses Playwright to capture a full-page screenshot
4. **S3 Upload**: Stores the screenshot in Cloudflare R2
5. **Visual Audit**: Analyzes the screenshot using GPT-4o Vision
6. **Prestige Score**: Calculates a 0-100 score based on design quality
7. **Database Storage**: Saves the lead and audit records

### Expected Output

After successful execution, you will have:

- A new lead record in the database
- A high-resolution screenshot stored in S3
- A structured visual audit with findings in these categories:
  - Typography issues
  - Color scheme problems
  - Layout and spacing concerns
  - Imagery quality assessment
- A prestige score (0-100) indicating overall design quality

### Troubleshooting

**Error: "Rate limit exceeded"**
- You have created more than 10 leads in the past hour
- Wait until the rate limit window resets (check Governor dashboard)

**Error: "Domain flagged as unsafe"**
- The target domain is on a blacklist or has a poor reputation
- Verify the URL is correct and the domain is legitimate

**Error: "Failed to capture screenshot"**
- The website may be blocking automated browsers
- The website may be down or unreachable
- Try a different URL or contact support

---

## Workflow 2: Full Pipeline Automation

**Purpose**: Execute the complete pipeline from lead creation through outreach draft generation.

### Step-by-Step Instructions

1. **Navigate to Command Center** (`/command-center`)

2. **Locate the "Full Pipeline Automation" card**

3. **Click the "Execute Pipeline" button** to open the input dialog

4. **Enter lead information**:
   - **Company Name**: Target company name
   - **Website URL**: Full website URL

5. **Click "Submit"** to trigger the automated pipeline

6. **Monitor progress** in real-time:
   - The progress bar shows overall completion percentage
   - Status updates reflect the current stage:
     - "Running Stage 1: Screenshot + Audit"
     - "Running Stage 2: Asset Generation"
     - "Running Stage 3: Outreach Draft"
   - Typical execution time: 2-4 minutes

7. **View results**:
   - Navigate to the Dashboard to see the new lead
   - Click on the lead to view all generated outputs:
     - Screenshot and visual audit
     - 3 social media posts + 1 web banner
     - Personalized outreach email draft

### Pipeline Stages

The Full Pipeline Automation executes three stages in sequence:

| Stage | Agent | Output | Duration |
|-------|-------|--------|----------|
| 1 | The Curator | Screenshot + Visual Audit | 15-30 sec |
| 2 | The Visionary | 3 Social Posts + 1 Web Banner | 60-90 sec |
| 3 | The Charmer | Personalized Email Draft | 20-40 sec |

Each stage depends on the output of the previous stage. If any stage fails, the pipeline will retry up to 3 times before marking the job as failed.

### Error Handling and Retries

The Orchestrator implements automatic retry logic:

- **Transient Errors**: Automatically retried (network timeouts, API rate limits)
- **Permanent Errors**: Marked as failed after 3 attempts (invalid URLs, blocked domains)
- **Retry Delay**: 5 seconds between attempts

You can monitor retry attempts in the Orchestrator dashboard (`/orchestrator`).

### Expected Output

After successful pipeline execution, you will have:

- A complete lead record with all data populated
- A visual audit with prestige score
- 4 marketing assets (3 social posts + 1 banner) stored in S3
- A personalized outreach email draft ready for approval

### Troubleshooting

**Pipeline stuck in "running" state**
- Check the Orchestrator dashboard for detailed status
- Review error messages in the job details
- Verify all external services (S3, Gmail MCP) are accessible

**Stage 2 fails with "Asset generation timeout"**
- The Manus image API may be experiencing high load
- Retry the pipeline manually from the Orchestrator dashboard

**Stage 3 fails with "No audit data available"**
- Stage 1 may have completed with errors
- Verify the lead has a valid audit record in the database

---

## Workflow 3: Asset Generation Only

**Purpose**: Generate marketing assets (social posts, web banners) for an existing lead.

### Step-by-Step Instructions

1. **Navigate to Command Center** (`/command-center`)

2. **Locate the "Asset Generation Only" card**

3. **Click the "Generate Assets" button** to open the lead selector

4. **Select a lead** from the dropdown:
   - Only leads with completed visual audits are shown
   - The dropdown displays company name and prestige score

5. **Click "Generate"** to trigger asset creation

6. **Monitor progress**:
   - Progress bar shows completion percentage
   - Typical execution time: 60-90 seconds

7. **View results**:
   - Navigate to the lead detail page
   - Scroll to the "Generated Assets" section
   - All 4 assets will be displayed with download links

### Asset Types

The Visionary generates four distinct asset types:

| Asset Type | Dimensions | Purpose | Style |
|------------|------------|---------|-------|
| Social Post 1 | 1080x1080 | Instagram/LinkedIn | Brand-aligned, professional |
| Social Post 2 | 1080x1080 | Instagram/LinkedIn | Variant with different messaging |
| Social Post 3 | 1080x1080 | Instagram/LinkedIn | Variant with different visual style |
| Web Banner | 1200x628 | Website header/hero | High-impact, conversion-focused |

All assets are generated based on the lead's "Business DNA" extracted from the visual audit, ensuring brand consistency.

### Expected Output

After successful execution, you will have:

- 4 high-resolution marketing assets stored in S3
- Asset metadata (prompt, dimensions, generation timestamp) in the database
- Direct download links for each asset

### Troubleshooting

**Error: "Lead must have an audit before generating assets"**
- The selected lead does not have a completed visual audit
- Run the Manual Lead Creation workflow first to generate an audit

**Error: "Asset generation failed"**
- The Manus image API may be unavailable
- Check the error message for specific details
- Retry the workflow after a few minutes

---

## Workflow 4: Outreach Draft Generation

**Purpose**: Create a personalized outreach email for an existing lead.

### Step-by-Step Instructions

1. **Navigate to Command Center** (`/command-center`)

2. **Locate the "Outreach Draft Generation" card**

3. **Click the "Generate Draft" button** to open the lead selector

4. **Select a lead** from the dropdown

5. **Enter recipient information**:
   - **Recipient Email**: Target contact's email address
   - **Recipient Name**: Target contact's full name (optional)

6. **Click "Generate"** to create the draft

7. **Monitor progress**:
   - Progress bar shows completion percentage
   - Typical execution time: 20-40 seconds

8. **Review and approve**:
   - Navigate to the Charmer dashboard (`/charmer`)
   - Review the generated email copy
   - Approve or reject the draft

### Email Generation Strategy

The Charmer uses a sophisticated prompt strategy to generate high-converting outreach emails:

- **Personalization**: References the lead's visual audit findings and prestige score
- **Value Proposition**: Highlights specific design improvements that could increase conversions
- **Social Proof**: Mentions relevant case studies or success metrics
- **Call-to-Action**: Clear next step (schedule a call, request a proposal)

### Expected Output

After successful execution, you will have:

- A new campaign record in the database
- An outreach draft with subject line and body copy
- The draft will appear in the Charmer approval queue with status "pending_approval"

### Troubleshooting

**Error: "No audit data available"**
- The selected lead does not have a completed visual audit
- Run the Manual Lead Creation workflow first

**Draft quality is poor**
- Review the visual audit data to ensure it contains sufficient detail
- Regenerate the draft with a different recipient name/email
- Manually edit the draft in the Charmer dashboard before sending

---

## Workflow 5: System Health Check

**Purpose**: Verify Governor status, rate limits, and system configuration.

### Step-by-Step Instructions

1. **Navigate to Command Center** (`/command-center`)

2. **Locate the "System Health Check" card**

3. **Click the "Check Health" button** to run diagnostics

4. **Review results**:
   - Kill-switch status (global and per-user)
   - Rate limit usage (requests remaining in current window)
   - Audit log summary (recent operations)
   - Domain blacklist status

5. **Take action if needed**:
   - If rate limits are exhausted, wait for the window to reset
   - If kill-switch is active, contact an administrator
   - Review audit logs for suspicious activity

### Health Check Metrics

The Governor dashboard displays the following metrics:

| Metric | Description | Healthy Range |
|--------|-------------|---------------|
| Global Kill-Switch | System-wide operation lock | OFF |
| User Kill-Switch | Per-user operation lock | OFF |
| Rate Limit Usage | Requests used in current window | < 10/hour |
| Failed Requests | Recent failed operations | < 5% |
| Blocked Domains | Domains on blacklist | Varies |

### Expected Output

After running the health check, you will see:

- Current system status (operational, degraded, offline)
- Rate limit usage for your account
- Recent audit log entries
- Any active kill-switches or restrictions

### Troubleshooting

**Kill-switch is active**
- Contact an administrator to disable the kill-switch
- Review audit logs to understand why it was activated

**Rate limits are exhausted**
- Wait for the rate limit window to reset (1 hour)
- Contact an administrator to increase your rate limit quota

---

## Managing Leads

### Viewing All Leads

Navigate to the Dashboard (`/dashboard`) to see a list of all leads you have created. The dashboard displays:

- Company name
- Website URL
- Prestige score (color-coded: red < 50, yellow 50-75, green > 75)
- Status (pending, audited, contacted, closed)
- Creation timestamp

Click on any lead to view detailed information.

### Lead Detail Page

The lead detail page (`/leads/[id]`) displays:

- **Screenshot**: Full-page capture of the website
- **Visual Audit**: Structured findings with prestige score
- **Generated Assets**: Social posts and web banners (if generated)
- **Outreach Drafts**: Email copy and campaign status (if generated)

From this page, you can:

- Generate assets (if not already generated)
- Create an outreach draft
- Download the screenshot
- View audit details in JSON format

### Updating Lead Status

Lead status is automatically updated as the pipeline progresses:

- **Pending**: Lead created, audit in progress
- **Audited**: Visual audit completed
- **Contacted**: Outreach email sent
- **Closed**: Deal closed or lead disqualified

You can manually update the status from the lead detail page (admin only).

---

## Approving Outreach Drafts

### Accessing the Approval Queue

Navigate to the Charmer dashboard (`/charmer`) to see all outreach drafts pending approval.

### Reviewing a Draft

Each draft card displays:

- **Lead Information**: Company name and prestige score
- **Recipient**: Email address and name
- **Subject Line**: Email subject
- **Body Preview**: First 200 characters of the email body

Click "View Full Draft" to see the complete email copy.

### Approval Actions

For each draft, you can:

- **Approve**: Mark the draft as approved and ready to send
- **Reject**: Mark the draft as rejected (provide a reason)
- **Edit**: Manually edit the subject or body before approving

### Sending Approved Drafts

Once a draft is approved, it will appear in the "Approved Drafts" section. To send:

1. Click the "Send Email" button
2. Confirm the action in the dialog
3. The system will send the email via Gmail MCP
4. The draft status will update to "sent"

### Tracking Email Performance

After sending, the draft card will display:

- **Sent At**: Timestamp of email delivery
- **Opened At**: Timestamp of first open (if tracked)
- **Clicked At**: Timestamp of first link click (if tracked)
- **Replied At**: Timestamp of first reply (if detected)

---

## Monitoring Pipeline Jobs

### Accessing the Pipeline Monitor

Navigate to the Orchestrator dashboard (`/orchestrator`) to see all pipeline jobs.

### Job List View

The job list displays:

- **Lead Information**: Company name and website URL
- **Status**: Pending, running, completed, failed
- **Current Stage**: Which agent is currently executing
- **Progress**: Percentage completion
- **Retry Count**: Number of retry attempts
- **Created At**: Job creation timestamp

### Job Detail View

Click on any job to see detailed information:

- **Stages Completed**: List of successfully completed stages
- **Current Stage**: Active stage with progress updates
- **Error Messages**: Detailed error information (if failed)
- **Retry History**: Timestamps and outcomes of retry attempts

### Manual Interventions

From the job detail page, you can:

- **Retry Failed Job**: Manually trigger a retry (admin only)
- **Cancel Running Job**: Stop a job in progress (admin only)
- **View Lead Details**: Navigate to the associated lead

---

## Best Practices

### Lead Creation

- **Verify URLs**: Always double-check website URLs before submitting
- **Target High-Value Leads**: Focus on companies with strong brand presence
- **Monitor Prestige Scores**: Leads with scores < 50 may require different messaging
- **Batch Processing**: Use the Full Pipeline Automation for efficiency

### Asset Generation

- **Review Business DNA**: Check the visual audit to ensure accurate brand extraction
- **Regenerate if Needed**: Don't hesitate to regenerate assets if quality is poor
- **Download Originals**: Always download high-resolution versions for archival

### Outreach Drafts

- **Personalize Further**: Use the generated draft as a starting point, not the final version
- **A/B Test Subject Lines**: Try multiple subject line variants for the same lead
- **Track Performance**: Monitor open and click rates to optimize future campaigns
- **Follow Up**: Set reminders to follow up if no response within 7 days

### System Health

- **Check Daily**: Run the System Health Check at least once per day
- **Monitor Rate Limits**: Avoid hitting rate limits by spacing out lead creation
- **Review Audit Logs**: Check for suspicious activity or errors
- **Report Issues**: Contact support immediately if kill-switches are activated

---

**Need Help?** Refer to the [Troubleshooting Guide](TROUBLESHOOTING.md) for common issues and solutions, or contact support at support@manus.im.
