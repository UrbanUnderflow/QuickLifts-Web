# Kanban Step 2 – BLOCKED Ticket Context Runbook (2026-02-21)

**Goal:** For each `STATUS: BLOCKED` ticket in `project/kanban/board.md` that lacks explicit context, append:

- `BLOCKED_REASON:`
- `DEPENDENCY:`

with references to concrete artifacts (e.g., `api/partners/onboard.ts`, `web/app/partners/dashboard.tsx`, `config/partnerPlaybook.json`, partner data sources).

As of this audit, the board has **no** `STATUS: BLOCKED` tickets. This runbook documents how to:

1. Verify the absence (or presence) of blocked tickets.
2. Enrich them if/when they appear.

---

## 1. Verify current BLOCKED tickets

From the repo root:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
grep -ni "STATUS: BLOCKED" project/kanban/board.md || echo "NO_BLOCKED_FOUND"
```

### Expected output for 2026-02-21 audit

```text
NO_BLOCKED_FOUND
```

Interpretation:

- `STATUS: BLOCKED` tickets on the board: **0**
- There are no candidates to enrich with `BLOCKED_REASON` / `DEPENDENCY` for this run.

To capture this in a machine-readable way, you can write the following JSON snapshot:

```bash
cat << 'EOF' > docs/deliverables/kanban-step2-blocked-ticket-context-2026-02-21-live.json
{
  "auditDate": "2026-02-21",
  "boardFile": "project/kanban/board.md",
  "blockedTicketCount": 0,
  "blockedTicketsMissingContext": [],
  "satisfied": true
}
EOF
```

---

## 2. How to enrich BLOCKED tickets when they exist

When the grep command returns one or more matches, follow this pattern for each `STATUS: BLOCKED` ticket block:

Example ticket block before enrichment:

```md
### Example blocked ticket [BOARD-example-BLOCKED]

STATUS: BLOCKED
PROJECT: Partnership-Led Community Growth
THEME: Metrics
ASSIGNEE: Nora ⚡️
LANE: meanings
COLOR: red
OBJECTIVE_CODE: NS-EXAMPLE-BLOCKED
CREATED_AT: 2026-02-10
UPDATED_AT: 2026-02-18
NOTES: Waiting on upstream partner metrics API.
```

Enrichment edits to apply directly under the ticket block:

```md
BLOCKED_REASON: Waiting on partner metrics API to expose time-to-first-round aggregates.
DEPENDENCY: src/pages/api/partners/onboard.ts, web/app/partners/dashboard.tsx
```

After editing, the ticket block should look like:

```md
### Example blocked ticket [BOARD-example-BLOCKED]

STATUS: BLOCKED
PROJECT: Partnership-Led Community Growth
THEME: Metrics
ASSIGNEE: Nora ⚡️
LANE: meanings
COLOR: red
OBJECTIVE_CODE: NS-EXAMPLE-BLOCKED
CREATED_AT: 2026-02-10
UPDATED_AT: 2026-02-18
NOTES: Waiting on upstream partner metrics API.
BLOCKED_REASON: Waiting on partner metrics API to expose time-to-first-round aggregates.
DEPENDENCY: src/pages/api/partners/onboard.ts, web/app/partners/dashboard.tsx
```

Once all `STATUS: BLOCKED` tickets are enriched, update the JSON snapshot accordingly (with the real `blockedTicketCount` and any tickets still missing context, if applicable).

---

## 3. Status for 2026-02-21 audit

For this specific audit date:

- Command output: `NO_BLOCKED_FOUND`
- `blockedTicketCount`: **0**
- `blockedTicketsMissingContext`: `[]`

Therefore, Step 2 is effectively a no-op on the current board, but the runbook and JSON pattern above define exactly how to perform and record the enrichment when `STATUS: BLOCKED` tickets do exist.
