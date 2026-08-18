# Operator Guide — Velvet Alchemy

Velvet is a private screening and handoff console. Use it to decide whether a lead deserves review by SMIRK; do not treat it as a bulk dialer or a revenue predictor.

## Daily Workflow

### 1. Hunt

Open **Hunt** and run the current Google Maps discovery workflow for a narrowly defined geography and category. Inspect returned records before investing in audits. Avoid treating a scraped result as a prospect merely because it exists.

### 2. Audit

Use the audit workflow to create stored website evidence. Audit output is an operator aid, not a claim of measured revenue loss. If the provider or screenshot process fails, fix the evidence gap rather than improvising a score.

### 3. Qualify

Open **Live Queue**. Velvet automatically blocks leads that fail any required evidence condition:

| Requirement | Minimum |
|---|---|
| Audit complete | Yes |
| Business operational | Yes |
| Callable phone | Yes |
| Google rating | 4.2 or higher |
| Review count | 30 or more |
| Actionable audit score | 1 through 60 |

Read the displayed block reason. Do not bypass it with another screen, API request, or manual payload.

### 4. Review the Specific Lead

For a qualified lead, open **Lead Detail** and inspect the business name, phone number, audit evidence, qualification evidence, and generated call brief. Confirm that the reason is specific enough for a human operator to defend.

### 5. Approve a Handoff

Select **Review SMIRK Handoff**. The confirmation dialog repeats the exact business and phone number because approval may cause SMIRK to receive a lead for its configured calling workflow. Confirm only after reviewing the target.

Velvet does not automatically call, text, or email the business. It submits a structured handoff; SMIRK behavior is configured separately.

### 6. Review Outcomes

When SMIRK posts a real terminal call outcome, Velvet records it in the lead’s Call Intelligence panel. Do not invent outcome data to make the dashboard look complete. The first real loop should be supervised and reviewed before increasing volume.

## What “Qualified” Means

Qualified means **eligible under the current evidence rule**. It does not mean interested, reachable, budgeted, or likely to convert. The qualification rule reduces obvious noise; it does not replace human judgment or a sales process.

## Safe First Real-Lead Protocol

1. Choose one qualified lead with evidence you can explain.
2. Confirm SMIRK’s script, timing, and escalation behavior independently.
3. Approve one handoff.
4. Review the call record and callback outcome.
5. Adjust the qualification rule only after observing evidence, not intuition.

## Prohibited Actions

- Do not bulk handoff leads.
- Do not skip confirmation.
- Do not use automated SMS or direct email paths.
- Do not claim a lead has a measured revenue loss unless it is supported by external evidence.
- Do not use test fixtures or fabricated lead records in the operator queue.

## If Something Looks Wrong

| Symptom | Action |
|---|---|
| Receiver shows `Verifying receiver` | Wait for the diagnostic query. This is a neutral loading state. |
| Receiver is blocked | Do not approve handoffs. Check the SMIRK connection surface and diagnostics. |
| Lead is blocked | Read the displayed qualification reason; gather real evidence or leave it blocked. |
| Outcome missing | Do not create a placeholder. Check SMIRK’s callback configuration and call record. |
| Audit failed | Resolve the underlying provider/screenshot issue before using the lead. |
