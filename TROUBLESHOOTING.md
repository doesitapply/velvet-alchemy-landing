# Velvet Alchemy - Troubleshooting Guide

**For:** When things go wrong (and they will)  
**Purpose:** Fix common problems without calling your uncle

---

## Technical Issues

### "The Business Scraper isn't finding any businesses"

**Symptoms:**
- Click "Scrape Businesses" → Nothing happens
- Or: "0 businesses found"

**Causes & Fixes:**

**1. Invalid location format**
- ❌ Wrong: "Reno"
- ✅ Right: "Reno, NV" or "Reno, Nevada"

**2. Too specific search term**
- ❌ Wrong: "Italian restaurants with outdoor seating"
- ✅ Right: "Italian restaurants" or just "restaurants"

**3. Google Maps rate limit**
- **Cause:** You scraped too many businesses too fast
- **Fix:** Wait 1 hour, then try again
- **Prevention:** Don't scrape more than 100 businesses per hour

**4. Website is down**
- **Check:** Can you access the Command Center?
- **Fix:** Refresh the page (Ctrl+R or Cmd+R)
- **Still broken?** Contact your uncle

---

### "The Orchestrator audits are stuck at 0%"

**Symptoms:**
- Click "Run Pipeline" → Progress bar doesn't move
- Or: Stays at "0% - Initializing..." for more than 5 minutes

**Causes & Fixes:**

**1. No internet connection**
- **Check:** Can you load Google.com?
- **Fix:** Check your WiFi

**2. The AI service is down**
- **Check:** Look for error message in red text
- **Fix:** Wait 10 minutes, try again
- **Still broken?** Contact your uncle

**3. The lead has no website**
- **Cause:** Some businesses don't have websites
- **Fix:** This is normal. The audit will skip them automatically.

**4. The website is password-protected**
- **Cause:** Some sites require login to view
- **Fix:** Skip these leads. You can't audit them.

---

### "The Charmer won't send emails"

**Symptoms:**
- Click "Send Email" → Nothing happens
- Or: "Email failed to send" error

**Causes & Fixes:**

**1. No email address for the lead**
- **Check:** Does the lead have an email in the database?
- **Fix:** Manually find their email (check their website's Contact page)
- **Add it:** Click "Edit Lead" → Add email → Save

**2. Email service is not configured**
- **Cause:** Your uncle needs to set up SMTP
- **Fix:** Contact your uncle
- **Workaround:** Copy the AI-generated email and send it manually from Gmail

**3. You hit the daily email limit**
- **Cause:** Most email services limit you to 50-100 emails per day
- **Fix:** Wait until tomorrow
- **Prevention:** Don't send more than 50 emails per day

---

### "The website is loading super slow"

**Symptoms:**
- Pages take 10+ seconds to load
- Buttons don't respond immediately

**Causes & Fixes:**

**1. Slow internet**
- **Check:** Run a speed test at fast.com
- **Fix:** Move closer to your WiFi router

**2. Too many browser tabs open**
- **Fix:** Close unused tabs
- **Recommended:** Keep only 5-10 tabs open

**3. The server is overloaded**
- **Cause:** Too many audits running at once
- **Fix:** Wait for current audits to finish before starting new ones

---

## Business/Sales Issues

### "No one is responding to my emails"

**Symptoms:**
- Sent 20 emails → 0 responses after 5 days

**Causes & Fixes:**

**1. You're targeting the wrong score range**
- **Check:** What scores are you emailing?
- **Fix:** Only email leads with scores 40-70
- **Why:** Under 40 = too broke. Over 70 = don't need you.

**2. Your emails sound like spam**
- **Check:** Are you personalizing the emails?
- **Fix:** Add a personal touch:
  - "I noticed you just celebrated your 10th anniversary"
  - "I saw you have great reviews on Yelp"
  - "Your menu looks amazing"

**3. You're emailing the wrong person**
- **Check:** Are you emailing "info@restaurant.com"?
- **Fix:** Find the owner's personal email
- **How:** Check the website's "About" page or LinkedIn

**4. Your subject line is boring**
- ❌ Bad: "Website Audit Results"
- ✅ Good: "[Restaurant Name] - Your website is losing you $2k/month"

**5. You're not following up**
- **Fix:** Send a follow-up email after 3 days
- **Template:** "Just checking if you saw my email from Tuesday..."

---

### "They want to see examples of my work"

**Symptoms:**
- Prospect says: "Do you have a portfolio?"
- Or: "Can I see examples of websites you've built?"

**Fixes:**

**1. Show them THEIR marketing assets**
- **What to say:** "I generated these mockups specifically for YOUR business. This is what I'd build for you."
- **Show:** The AI-generated assets from their audit

**2. Use the "beta pricing" angle**
- **What to say:** "I'm just launching this service, so I'm offering a discounted rate of $3,000 instead of my usual $5,000. You'd be one of my first clients, which is why I can offer this price."

**3. Offer a money-back guarantee**
- **What to say:** "If you're not happy with the first mockup, I'll refund your deposit. No questions asked."

**4. Show them competitor examples**
- **Find:** 3-5 modern restaurant websites (Google "best restaurant websites 2024")
- **Say:** "Here's the style I'm thinking for your site..."

---

### "They think $5,000 is too expensive"

**Symptoms:**
- Prospect says: "That's way out of our budget"
- Or: "Can you do it for $2,000?"

**Fixes:**

**1. Show them the ROI**
- **Ask:** "How many customers do you get from your website per month?"
- **Then:** "If we can increase that by just 20%, how much extra revenue is that?"
- **Math:** 10 extra customers/month × $50 average check = $500/month = $6,000/year
- **Close:** "So this pays for itself in less than a year."

**2. Offer a payment plan**
- **Option 1:** 3 payments of $1,667
- **Option 2:** $2,500 upfront, $1,250 after mockup, $1,250 after delivery

**3. Offer a smaller package**
- **"Lite" Package:** $3,000
  - Mobile-responsive design
  - Fast loading speed
  - Contact form
  - (Skip the fancy stuff)

**4. Walk away**
- **What to say:** "I understand. Let me know if your budget changes."
- **Why:** Don't discount below $3,000. You'll resent the work.

---

### "They want unlimited revisions"

**Symptoms:**
- Prospect says: "I want to make sure I can change anything I don't like"
- Or: "Can we keep tweaking it until it's perfect?"

**Fixes:**

**1. Set clear boundaries upfront**
- **What to say:** "You get 2 rounds of revisions included. After that, it's $500 per additional round."
- **Why:** Unlimited revisions = you'll never finish

**2. Define what counts as a "revision"**
- **Included:** Color changes, text edits, image swaps
- **Not included:** Complete redesigns, new pages, new features

**3. Get approval in writing**
- **After mockup:** "Please reply to this email with 'Approved' so I can move to final development."
- **Why:** Prevents them from saying "I never approved this" later

---

### "They're ghosting me after the sales call"

**Symptoms:**
- Had a great call → Sent proposal → No response for 5 days

**Fixes:**

**1. Follow up after 2 days**
- **Email:** "Hi [Name], just following up on the proposal I sent Tuesday. Do you have any questions?"

**2. Follow up after 5 days with a deadline**
- **Email:** "Hi [Name], I have availability to start your project this week, but my schedule fills up fast. Can you let me know by Friday if you'd like to move forward?"

**3. Call them**
- **When:** After 7 days of no response
- **What to say:** "Hi, I sent you a proposal last week and wanted to make sure you received it. Do you have 2 minutes to chat?"

**4. Send a "breakup email"**
- **When:** After 10 days of no response
- **Template:** "Hi [Name], I haven't heard back so I'm assuming this isn't a priority right now. I'll close out your file. Feel free to reach out if things change!"
- **Why:** This often gets a response ("Wait, don't close my file!")

---

## Data/Quality Issues

### "The Prestige Scores seem wrong"

**Symptoms:**
- A beautiful website scores 45
- An ugly website scores 85

**Causes & Fixes:**

**1. The AI is analyzing the wrong page**
- **Cause:** Some websites have a "splash page" or "coming soon" page
- **Fix:** Manually check the website. If it's actually good, skip this lead.

**2. The website is mobile-only**
- **Cause:** Some modern sites look bad on desktop but great on mobile
- **Fix:** Check the site on your phone. If it's good, skip this lead.

**3. The AI is having a bad day**
- **Cause:** AI isn't perfect
- **Fix:** Use your own judgment. If the site looks good to you, skip it.

---

### "I'm getting duplicate leads"

**Symptoms:**
- Same restaurant appears twice in the database

**Causes & Fixes:**

**1. You scraped the same city twice**
- **Fix:** Before scraping, check if you already scraped that city
- **Prevention:** Keep a list of cities you've already scraped

**2. The restaurant has multiple locations**
- **Cause:** Chain restaurants appear once per location
- **Fix:** This is normal. Each location is a separate lead.

**3. Database glitch**
- **Fix:** Manually delete the duplicate (click "Delete Lead" button)

---

### "The AI-generated emails are too generic"

**Symptoms:**
- Every email says the same thing
- Emails don't mention specific problems

**Causes & Fixes:**

**1. The audit didn't find specific issues**
- **Cause:** The website is actually pretty good (score over 70)
- **Fix:** Skip this lead. They don't need you.

**2. You need to customize the email**
- **Fix:** Add 1-2 sentences of personalization:
  - "I noticed you just opened a new location"
  - "I saw your Yelp reviews mention slow service - a better online reservation system could help"

---

## Payment/Money Issues

### "The customer paid but I don't see it in Stripe"

**Symptoms:**
- Customer says they paid
- Stripe dashboard shows $0

**Causes & Fixes:**

**1. Payment is pending**
- **Check:** Stripe → Payments → Filter by "Pending"
- **Fix:** Wait 1-2 business days for it to clear

**2. They paid the wrong invoice**
- **Check:** Did you send multiple invoices?
- **Fix:** Log in to Stripe, search for their email, see which invoice they paid

**3. They used a different payment method**
- **Check:** Did they Venmo you? PayPal? Zelle?
- **Fix:** Check those accounts

**4. They're lying**
- **Fix:** Ask for a screenshot of the payment confirmation
- **If they can't provide it:** "I don't see the payment yet. Can you try again?"

---

### "Stripe is asking for tax information"

**Symptoms:**
- Stripe says "Complete your tax information to continue"

**Fixes:**

**1. You need to fill out a W-9 (if you're in the US)**
- **Where:** Stripe Dashboard → Settings → Tax Information
- **What you need:** Your Social Security Number or EIN
- **Why:** IRS requires this for anyone making over $600/year

**2. Contact your uncle**
- **If you're under 18:** Your uncle might need to set this up for you
- **If you're over 18:** You can do it yourself

---

## "I'm Not Making Any Money" Issues

### "I've been doing this for 2 weeks and haven't closed a deal"

**Diagnosis:**

**Check your numbers:**
- How many businesses have you scraped? ___
- How many audits have you run? ___
- How many emails have you sent? ___
- How many responses have you gotten? ___
- How many sales calls have you done? ___

**If you've scraped less than 50 businesses:**
- **Problem:** Not enough leads in the pipeline
- **Fix:** Scrape 100 businesses this week

**If you've sent less than 20 emails:**
- **Problem:** Not enough outreach
- **Fix:** Send 10 emails per day for the next week

**If you've gotten 0 responses:**
- **Problem:** Your emails suck or you're targeting the wrong leads
- **Fix:** 
  1. Only email leads with scores 40-70
  2. Personalize every email
  3. Follow up after 3 days

**If you've done 5+ sales calls but no one is buying:**
- **Problem:** Your pitch sucks
- **Fix:** 
  1. Record your next sales call
  2. Watch it back
  3. Ask yourself: "Would I buy from me?"
  4. Practice the script from the user guide

---

### "I closed a deal but the client is being difficult"

**Symptoms:**
- They want unlimited revisions
- They're not responding to your mockups
- They're asking for features you didn't quote

**Fixes:**

**1. Re-read the proposal you sent them**
- **Check:** What did you actually promise?
- **If they're asking for more:** "That wasn't included in the original scope. I can add it for an additional $500."

**2. Set a deadline**
- **Email:** "I need your feedback on the mockup by Friday so I can stay on schedule. If I don't hear back, I'll assume you're happy with it and move to final development."

**3. Offer a refund and walk away**
- **When:** If they're being abusive or unreasonable
- **What to say:** "I don't think we're a good fit. I'm happy to refund your deposit."
- **Why:** Life's too short to work with assholes

---

## Emergency Contacts

### If the website is completely broken:
- **Contact:** [Your Uncle's Name]
- **Email:** [Email]
- **Phone:** [Phone]
- **When to call:** If you can't log in, or the site shows an error page

### If you need sales/business help:
- **Watch:** "The Futur" on YouTube (Chris Do teaches sales for creatives)
- **Read:** "The Mom Test" by Rob Fitzpatrick (how to talk to customers)

### If you need technical help building websites:
- **Use:** Manus AI (what you're using now)
- **Or:** Hire someone on Upwork ($500-1,000)

### If you're feeling overwhelmed:
- **Remember:** You're learning a new skill. It's supposed to be hard at first.
- **Take a break:** Go for a walk. Come back in an hour.
- **Ask for help:** Your uncle built this for you. He wants you to succeed.

---

## Prevention Checklist

### Before you scrape businesses:
- [ ] Check if you've already scraped this city
- [ ] Make sure location is formatted correctly ("City, State")
- [ ] Keep search term simple ("restaurants", not "Italian restaurants with outdoor seating")

### Before you run audits:
- [ ] Make sure you have at least 10 leads to audit (don't waste time on 1-2)
- [ ] Check that leads have valid website URLs
- [ ] Don't run more than 50 audits at once (it's slow)

### Before you send emails:
- [ ] Check Prestige Score is 40-70
- [ ] Personalize the email (add 1-2 sentences)
- [ ] Double-check the recipient's name is spelled correctly
- [ ] Don't send more than 50 emails per day

### Before you do a sales call:
- [ ] Review the audit report
- [ ] Practice your pitch out loud
- [ ] Have the proposal ready to send immediately after
- [ ] Set a timer for 15 minutes (don't go over)

### Before you start building a website:
- [ ] Get 50% deposit paid
- [ ] Get approval on the mockup in writing
- [ ] Set clear expectations on revisions (2 rounds included)
- [ ] Give them a delivery date and stick to it

---

## When to Give Up on a Lead

### Skip leads that:
1. **Have a Prestige Score under 40** (too broke)
2. **Have a Prestige Score over 70** (don't need you)
3. **Don't have a website** (can't audit what doesn't exist)
4. **Have a password-protected website** (can't audit it)
5. **Are chains** (they have corporate web teams)
6. **Don't respond after 3 follow-ups** (they're not interested)

### Your time is valuable. Focus on leads that are:
- **Scores 40-70**
- **Independent businesses** (not chains)
- **Responsive** (reply within 3 days)
- **Polite** (not rude or demanding)

---

## Final Reminder

**Most problems fix themselves if you:**
1. Refresh the page
2. Wait 10 minutes
3. Try again

**If that doesn't work:**
1. Read this guide
2. Google the error message
3. Contact your uncle

**You've got this.**
