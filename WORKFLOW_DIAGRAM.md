# Velvet Alchemy - Visual Workflow

## The Money Loop (Daily Cycle)

```
┌─────────────────────────────────────────────────────────────────┐
│                    START YOUR DAY (9:00 AM)                      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: FIND LEADS (30 minutes)                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Business Scraper                                         │  │
│  │  • Enter city: "Reno, NV"                                 │  │
│  │  • Enter search: "restaurants"                            │  │
│  │  • Click "Scrape Businesses"                              │  │
│  │  • Result: 20 new leads added                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: RUN AUDITS (1 hour, mostly waiting)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Orchestrator                                             │  │
│  │  • Click "Run Pipeline"                                   │  │
│  │  • AI analyzes all 20 websites                            │  │
│  │  • Wait 10 minutes                                        │  │
│  │  • Result: 20 audits with Prestige Scores                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: FILTER QUALIFIED LEADS (10 minutes)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Review Audit Results                                     │  │
│  │  • Look for scores 40-70                                  │  │
│  │  • Skip scores under 40 (too broke)                       │  │
│  │  • Skip scores over 70 (don't need you)                   │  │
│  │  • Result: 5-10 qualified leads                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: SEND OUTREACH (1 hour)                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Charmer Dashboard                                        │  │
│  │  • Click on qualified lead                                │  │
│  │  • Review AI-generated email                              │  │
│  │  • Customize if needed                                    │  │
│  │  • Click "Send Email"                                     │  │
│  │  • Repeat for 5-10 leads                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WAIT 2-3 DAYS FOR RESPONSES                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: SALES CALLS (When they respond)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Schedule 15-minute call                                │  │
│  │  • Share screen, show audit                               │  │
│  │  • Make offer: $5,000 for redesign                        │  │
│  │  • If yes → Send Stripe invoice                           │  │
│  │  • If no → Follow up in 1 week                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: DELIVER WEBSITE (After 50% deposit paid)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Build website (use template or Manus AI)               │  │
│  │  • Send mockup for approval                               │  │
│  │  • Make revisions (max 2 rounds)                          │  │
│  │  • Deliver final website                                  │  │
│  │  • Collect remaining 50%                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    🎉 YOU MADE $5,000 🎉                         │
│                    REPEAT THE LOOP                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Prestige Score Filter

```
┌───────────────────────────────────────────────────────────────┐
│                    ALL 20 AUDITED LEADS                        │
└───────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────┐                    ┌───────────────┐
│  Score 0-39   │                    │  Score 70-100 │
│  ❌ TOO BROKE │                    │  ❌ TOO GOOD  │
│  Skip these   │                    │  Skip these   │
└───────────────┘                    └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Score 40-70  │
                    │  ✅ PERFECT   │
                    │  Target these │
                    └───────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  5-10 Leads   │
                    │  Ready to     │
                    │  Contact      │
                    └───────────────┘
```

---

## The Sales Call Flow

```
┌─────────────────────────────────────────────────────────────┐
│  OPENING (2 min)                                             │
│  "Thanks for taking time. Can I share my screen?"            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  SHOW THE PROBLEM (5 min)                                    │
│  • Show their current website screenshot                     │
│  • Show Prestige Score: "You scored 55/100"                  │
│  • Walk through top 3 issues                                 │
│  • Show AI-generated marketing assets                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  MAKE THE OFFER (3 min)                                      │
│  "I can fix all this for $5,000. Done in 2 weeks."           │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        ┌───────────────┐       ┌───────────────┐
        │  "YES"        │       │  "NO" / "MAYBE"│
        │  Send invoice │       │  Handle        │
        │  Get deposit  │       │  objection     │
        └───────────────┘       └───────────────┘
                │                       │
                │                       ▼
                │               ┌───────────────┐
                │               │  Still "NO"?  │
                │               │  Follow up in │
                │               │  1 week       │
                │               └───────────────┘
                │
                ▼
        ┌───────────────┐
        │  BUILD WEBSITE│
        │  Collect final│
        │  payment      │
        └───────────────┘
```

---

## Weekly Pipeline View

```
WEEK 1: FILL THE PIPELINE
┌─────────────────────────────────────────────────────────────┐
│  Monday-Tuesday:   Scrape 50 businesses                      │
│  Wednesday:        Run audits on all 50                      │
│  Thursday-Friday:  Send 20 outreach emails                   │
│  Result:           Pipeline full, waiting for responses      │
└─────────────────────────────────────────────────────────────┘

WEEK 2: FIRST SALES CALLS
┌─────────────────────────────────────────────────────────────┐
│  Monday-Tuesday:   Follow up on emails                       │
│  Wednesday:        Schedule 2-3 sales calls                  │
│  Thursday-Friday:  Do sales calls, send proposals            │
│  Result:           1-2 deals in negotiation                  │
└─────────────────────────────────────────────────────────────┘

WEEK 3: FIRST CLIENT
┌─────────────────────────────────────────────────────────────┐
│  Monday:           Collect deposit ($2,500)                  │
│  Tuesday-Thursday: Build website                             │
│  Friday:           Send mockup for approval                  │
│  Result:           Website in progress                       │
└─────────────────────────────────────────────────────────────┘

WEEK 4: FIRST PAYCHECK
┌─────────────────────────────────────────────────────────────┐
│  Monday-Tuesday:   Make revisions                            │
│  Wednesday:        Deliver final website                     │
│  Thursday:         Collect final payment ($2,500)            │
│  Friday:           🎉 CELEBRATE $5,000 IN THE BANK 🎉        │
└─────────────────────────────────────────────────────────────┘
```

---

## The Numbers Game

```
START WITH:
100 Businesses Scraped
        │
        ▼
    Run Audits
        │
        ▼
50 Qualified Leads (Score 40-70)
        │
        ▼
    Send Emails
        │
        ▼
5 Responses (10% response rate)
        │
        ▼
    Sales Calls
        │
        ▼
2 Deals Closed (40% close rate)
        │
        ▼
$10,000 Revenue

TIME INVESTED: 10-15 hours
PROFIT: $10,000
HOURLY RATE: $666-1,000/hour
```

---

## Dashboard Navigation Map

```
┌─────────────────────────────────────────────────────────────┐
│                    COMMAND CENTER (Home)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Stats:                                              │   │
│  │  • Total Leads: 100                                  │   │
│  │  • Audited: 50                                       │   │
│  │  • Qualified: 25                                     │   │
│  │  • Contacted: 10                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Business    │  │ Orchestrator │  │   Charmer    │     │
│  │  Scraper     │  │              │  │              │     │
│  │              │  │              │  │              │     │
│  │  Find new    │  │  Run AI      │  │  Send        │     │
│  │  leads       │  │  audits      │  │  outreach    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: What Each Button Does

### Business Scraper
- **"Scrape Businesses"** → Finds 20 new leads from Google Maps
- **"View Leads"** → Shows all scraped businesses

### Orchestrator
- **"Run Pipeline"** → Audits ALL unaudited leads
- **"Execute Pipeline"** → Audits ONE specific lead
- **"View Details"** → Shows full audit report

### Charmer
- **"Send Email"** → Sends AI-generated outreach
- **"Mark as Contacted"** → Updates lead status
- **"Schedule Call"** → Adds to your calendar

### System
- **"Stripe Dashboard"** → View payments
- **"Settings"** → Change email, password
- **"Help"** → Contact your uncle

---

## Time Blocking Template

```
MONDAY
9:00-9:30   Scrape 20 businesses (City A)
9:30-10:00  Run audits
10:00-11:00 Send 10 outreach emails
11:00-12:00 Follow up on last week's emails

TUESDAY
9:00-9:30   Scrape 20 businesses (City B)
9:30-10:00  Run audits
10:00-11:00 Send 10 outreach emails
11:00-12:00 Schedule sales calls

WEDNESDAY
9:00-10:00  Sales call #1
10:00-11:00 Sales call #2
11:00-12:00 Send proposals

THURSDAY
9:00-12:00  Build websites for paying clients

FRIDAY
9:00-10:00  Deliver websites
10:00-11:00 Collect final payments
11:00-12:00 Review week, plan next week
```

---

**Print this out and keep it next to your computer!**
