# Velvet Alchemy — Current Workflow Diagram

```text
┌────────────────────┐
│ Hunt               │
│ Google Maps flow   │
└─────────┬──────────┘
          │ stores a business record
          ▼
┌────────────────────┐
│ Audit              │
│ website evidence   │
└─────────┬──────────┘
          │
          ▼
┌──────────────────────────────────────────────────┐
│ Qualification Gate                                │
│ audited · operational · callable phone            │
│ rating ≥ 4.2 · reviews ≥ 30 · score 1–60          │
└─────────┬───────────────────────────────┬─────────┘
          │ passes                        │ fails
          ▼                               ▼
┌────────────────────┐          ┌────────────────────┐
│ Live Queue          │          │ Blocked            │
│ evidence + brief    │          │ explicit reason    │
└─────────┬──────────┘          └────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────┐
│ Operator Review                                   │
│ verifies exact business, phone, evidence, brief   │
└─────────┬────────────────────────────────────────┘
          │ explicit confirmation only
          ▼
┌────────────────────┐
│ Velvet → SMIRK     │
│ approved handoff   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ SMIRK              │
│ configured call    │
│ behavior            │
└─────────┬──────────┘
          │ real terminal call result
          ▼
┌────────────────────┐
│ SMIRK → Velvet     │
│ outcome:write      │
│ callback           │
└────────────────────┘
```

## Boundaries

| Boundary | Rule |
|---|---|
| Qualification | Server-side; a UI state cannot bypass it. |
| Handoff | Requires explicit operator confirmation. |
| Contact | SMIRK behavior is separate from Velvet. Velvet makes no automatic contact. |
| Outcome | Records only a real SMIRK result; no manufactured outcomes. |

The diagram describes system control flow, not a forecast of conversion, revenue, or buyer intent.
