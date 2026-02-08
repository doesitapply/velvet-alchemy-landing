# Autonomous Sales System Architecture

**Goal:** Fully automated email sales pipeline from cold lead to closed deal, with human oversight only for critical decisions.

---

## System Overview

```
Lead Scraping → Audit → Outreach Generation → [CALIBRATION PHASE] → Auto-Send → Reply Monitoring → Intent Classification → Auto-Response → Follow-Ups → Deal Closed
```

**Human-in-the-Loop Checkpoints:**
1. First 5 emails (calibration phase) - manual approval required
2. Visual asset approval before demos
3. Final contract sign-off

---

## Database Schema

### `email_threads`
Tracks full conversation history with each lead.

```sql
CREATE TABLE email_threads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  lead_id INT NOT NULL,
  gmail_thread_id VARCHAR(255) UNIQUE,
  subject VARCHAR(500),
  status ENUM('active', 'closed_won', 'closed_lost', 'paused'),
  last_message_at DATETIME,
  last_sender ENUM('us', 'them'),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

### `email_messages`
Individual emails within threads.

```sql
CREATE TABLE email_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  thread_id INT NOT NULL,
  gmail_message_id VARCHAR(255) UNIQUE,
  sender ENUM('us', 'them'),
  subject VARCHAR(500),
  body_text TEXT,
  body_html TEXT,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES email_threads(id)
);
```

### `intent_classifications`
AI-detected intent from lead replies.

```sql
CREATE TABLE intent_classifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_id INT NOT NULL,
  intent ENUM('interested', 'objection', 'not_now', 'spam', 'unsubscribe'),
  confidence FLOAT, -- 0.0 to 1.0
  reasoning TEXT, -- AI explanation
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES email_messages(id)
);
```

### `auto_responses`
AI-generated responses pending approval or auto-send.

```sql
CREATE TABLE auto_responses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  thread_id INT NOT NULL,
  in_reply_to_message_id INT NOT NULL,
  subject VARCHAR(500),
  body_text TEXT,
  body_html TEXT,
  status ENUM('pending_approval', 'approved', 'sent', 'rejected'),
  auto_send_at DATETIME, -- NULL if requires approval
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES email_threads(id),
  FOREIGN KEY (in_reply_to_message_id) REFERENCES email_messages(id)
);
```

### `follow_up_sequences`
Pre-defined follow-up email templates.

```sql
CREATE TABLE follow_up_sequences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255),
  day_offset INT, -- Days after initial email (3, 7, 14)
  subject_template TEXT,
  body_template TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `scheduled_follow_ups`
Scheduled follow-up emails for specific leads.

```sql
CREATE TABLE scheduled_follow_ups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  thread_id INT NOT NULL,
  sequence_id INT NOT NULL,
  scheduled_for DATETIME,
  status ENUM('pending', 'sent', 'cancelled'),
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES email_threads(id),
  FOREIGN KEY (sequence_id) REFERENCES follow_up_sequences(id)
);
```

---

## Phase 1: Auto-Send System

**Calibration Threshold:** First 5 approved emails train the AI voice.

**Logic:**
1. Check `voice_profiles.calibration_count`
2. If `< 5`: Require manual approval (existing behavior)
3. If `>= 5`: Auto-send immediately after generation

**Implementation:**
- Update `outreachRouter.generateOutreach` to check calibration count
- If calibrated, set `email_queue.status = 'sent'` and call `gmailClient.sendEmail()` immediately
- Increment `voice_profiles.emails_sent_count`

---

## Phase 2: Gmail Reply Monitoring

**Polling Frequency:** Every 5 minutes (cron job)

**Process:**
1. Fetch all `email_threads` with `status = 'active'`
2. For each thread, call `gmail.threads.get(gmail_thread_id)`
3. Check for new messages since `last_message_at`
4. If new message from lead:
   - Insert into `email_messages` (sender='them')
   - Update `email_threads.last_message_at` and `last_sender='them'`
   - Trigger intent classification

**Gmail API:**
```typescript
const thread = await gmailClient.getThread(gmail_thread_id);
const newMessages = thread.messages.filter(msg => 
  new Date(msg.internalDate) > last_message_at &&
  msg.from !== ourEmail
);
```

---

## Phase 3: Intent Classification

**AI Prompt:**
```
Analyze this email reply and classify the sender's intent:

Email: {body_text}

Classify as ONE of:
- interested: Wants to learn more, book demo, or buy
- objection: Has concerns (price, timing, trust)
- not_now: Interested but not ready (follow up later)
- spam: Auto-reply, out-of-office, or irrelevant
- unsubscribe: Wants to stop receiving emails

Return JSON:
{
  "intent": "interested",
  "confidence": 0.95,
  "reasoning": "They asked about pricing and availability"
}
```

**Implementation:**
- Call `invokeAI()` with structured JSON output
- Insert result into `intent_classifications`
- Trigger auto-response generation based on intent

---

## Phase 4: Auto-Response Generation

**Response Strategy by Intent:**

| Intent | Action | Auto-Send? |
|--------|--------|------------|
| `interested` | Generate demo booking email | ✅ Yes (after calibration) |
| `objection` | Address specific concern | ⚠️ Requires approval |
| `not_now` | Schedule follow-up in 30 days | ✅ Yes |
| `spam` | No action | ❌ No |
| `unsubscribe` | Mark thread as `closed_lost`, stop all emails | ✅ Yes (confirmation) |

**AI Prompt (for `interested`):**
```
The lead replied with interest. Generate a response in the user's voice that:
1. Thanks them for their interest
2. Proposes 2-3 demo time slots (next 3 business days)
3. Mentions the pricing tier that matches their business size
4. Keeps the sarcastic, approachable tone

Lead's reply: {body_text}
User's voice profile: {voice_profile}
```

**Implementation:**
- Generate response via `invokeAI()`
- Insert into `auto_responses`
- If calibrated + intent=interested: Set `auto_send_at = NOW()` and send immediately
- If requires approval: Set `status = 'pending_approval'` and notify user

---

## Phase 5: Follow-Up Sequences

**Default Sequences:**

### Day 3 Follow-Up (No Reply)
```
Subject: Quick follow-up on {business_name}'s website

Hey {first_name},

Just circling back on the audit I sent over. Did you get a chance to check it out?

I know you're busy running the business, so I'll keep this short: your website is costing you money right now. The audit breaks down exactly how much and what to fix.

Want me to walk you through it? Takes 10 minutes.

- Cameron
```

### Day 7 Follow-Up (Still No Reply)
```
Subject: Last call for {business_name}

{first_name},

This is my last email—I promise I won't bug you after this.

Your website has [specific issue from audit]. That's turning away customers who are ready to buy.

If you want to fix it, reply with "yes" and I'll send you a proposal. If not, no worries—I'll move on.

- Cameron
```

### Day 14 Follow-Up (Breakup Email)
```
Subject: I'm out

{first_name},

I'm closing your file. If you ever want to fix that [specific issue], you know where to find me.

Good luck with the business.

- Cameron
```

**Scheduling Logic:**
1. When initial outreach is sent, schedule all 3 follow-ups
2. Insert into `scheduled_follow_ups` with `status='pending'`
3. Cron job checks every hour for `scheduled_for <= NOW()`
4. Before sending, check if lead replied (if yes, cancel all follow-ups)
5. Send follow-up and update `status='sent'`

---

## Phase 6: Monitoring Dashboard

**UI Components:**

### Conversation List
- Show all `email_threads` with status, last message, intent
- Filter by status (active/closed_won/closed_lost)
- Click to view full thread

### Thread Detail View
- Full conversation history (our emails + their replies)
- Intent classification for each reply
- Auto-responses (pending/sent)
- Scheduled follow-ups
- Manual override buttons (pause, close, send custom email)

### Auto-Actions Log
- Real-time feed of autonomous actions
- "AI sent follow-up to {business_name}"
- "Detected 'interested' intent from {business_name}"
- "Scheduled demo with {business_name}"

---

## Cron Jobs

### Reply Monitor (Every 5 minutes)
```typescript
async function monitorReplies() {
  const activeThreads = await db.getActiveThreads();
  for (const thread of activeThreads) {
    const newMessages = await gmailClient.checkForReplies(thread.gmail_thread_id, thread.last_message_at);
    if (newMessages.length > 0) {
      await processNewReplies(thread, newMessages);
    }
  }
}
```

### Follow-Up Sender (Every hour)
```typescript
async function sendScheduledFollowUps() {
  const dueFollowUps = await db.getFollowUpsDue();
  for (const followUp of dueFollowUps) {
    const thread = await db.getThread(followUp.thread_id);
    if (thread.last_sender === 'them') {
      // Lead replied, cancel follow-up
      await db.cancelFollowUp(followUp.id);
      continue;
    }
    await sendFollowUpEmail(followUp);
  }
}
```

---

## Safety Mechanisms

1. **Rate Limiting:** Max 50 emails/day to avoid spam filters
2. **Unsubscribe Detection:** Stop all emails if lead says "unsubscribe", "stop", "remove"
3. **Bounce Detection:** Mark thread as `closed_lost` if email bounces
4. **Manual Override:** User can pause/stop any thread at any time
5. **Audit Log:** All autonomous actions logged for review

---

## Success Metrics

- **Calibration Phase:** 5 approved emails (manual)
- **Auto-Send Rate:** 95%+ of emails sent without approval after calibration
- **Reply Rate:** Track % of leads who reply
- **Intent Accuracy:** Manual review of 10% of intent classifications
- **Conversion Rate:** % of leads who book demos / buy
- **Revenue per Lead:** Track from initial contact to payment

---

## Implementation Timeline

- **Phase 1 (Auto-Send):** 30 minutes
- **Phase 2 (Reply Monitoring):** 45 minutes
- **Phase 3 (Intent Classification):** 30 minutes
- **Phase 4 (Auto-Responses):** 45 minutes
- **Phase 5 (Follow-Ups):** 45 minutes
- **Phase 6 (Dashboard):** 60 minutes

**Total:** ~4 hours

---

## Next Steps

1. Create database tables
2. Build auto-send logic
3. Implement Gmail polling
4. Build intent classifier
5. Create auto-response generator
6. Schedule follow-up sequences
7. Build monitoring dashboard
8. Test end-to-end with real leads
