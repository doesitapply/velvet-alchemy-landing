# System Architecture — Velvet Alchemy

Velvet is a private operator console. Its critical path is **lead evidence → qualification → explicit operator approval → SMIRK handoff → optional outcome callback**.

```text
React Operator Console
  Command Center · Live Queue · Lead Detail · Hunt · API Keys
                         │
                         ▼
                tRPC / Scoped REST
                         │
                         ▼
Express + Business Logic
  discovery · audit · qualification · handoff · outcome validation
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
          MySQL          S3          SMIRK
       leads/audits    screenshots   receiver
```

## Main Components

| Component | Responsibility |
|---|---|
| `OperatorShell` | Shared private-console navigation and receiver presentation. |
| `CommandCenter` | Operational counts, receiver diagnostics, and recent lifecycle state. |
| `SmirkQueue` | Qualified leads plus explicit block reasons. |
| `LeadDetail` | Evidence, qualification decision, call brief, confirmation, and outcome display. |
| `smirkQualification.ts` | Pure shared eligibility evaluator. |
| `smirkHandoff.ts` | Call-brief construction, receiver diagnostics, idempotent dispatch, and failure mapping. |
| `apiRouter.ts` | Scoped external access to ready leads, handoffs, outcomes, and diagnostics. |

## Control Flow

1. Discovery stores a business record.
2. Audit stores evidence.
3. Qualification is evaluated at read/handoff time using audited state, operational state, callable phone, rating, review count, and actionability score.
4. The UI presents evidence. The server independently re-evaluates it.
5. A named operator confirms the exact target.
6. Velvet submits a structured brief to SMIRK using the dedicated inbound bearer.
7. SMIRK may post a terminal outcome with a separate `outcome:write` key.

## Security Boundaries

| Boundary | Enforcement |
|---|---|
| User ownership | Protected procedures and owner-scoped mutations. |
| Qualification | Server-side rejection for UI, tRPC, and REST routes. |
| Contact approval | Explicit confirmation before handoff; no automatic SMS/email/handoff. |
| Inbound SMIRK | Dedicated bearer stored separately in Velvet and SMIRK Railway. |
| Outcome callback | Separate Velvet API key restricted to `outcome:write`. |
| Test data | Database-backed tests clean their own fixtures; known synthetic records are not operator-visible. |

## Non-Architecture Claims

This system does not contain a proven conversion model, a public SaaS layer, or an arbitrary predicate hunt engine. Those are separate future concerns and must not be implied by this architecture.
