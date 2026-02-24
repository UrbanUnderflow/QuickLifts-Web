# Kanban Step 1 – Live Enumeration Runbook (2026-02-21)

**Goal:** Enumerate all tickets in `project/kanban/board.md` where:

- `STATUS` is `BLOCKED` or `IN_PROGRESS` / `in-progress`, **and**
- `UPDATED_AT` is older than 14 days as of **2026-02-21** (cutoff: **2026-02-07**).

This runbook uses a dedicated script that parses the current `board.md` directly.

---

## 1. Run the Step 1 enumerator

From the repo root:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
node scripts/enumerateBlockedAndInProgressOlderThan14Step1.js \
  > docs/deliverables/kanban-step1-blocked-inprogress-older14-2026-02-21-live.json
```

- This reads `project/kanban/board.md`.
- It identifies tickets whose `STATUS` is `BLOCKED`, `IN_PROGRESS`, or `in-progress`.
- It parses `UPDATED_AT` as `YYYY-MM-DD` and checks if it is **older than** 2026-02-07.
- It writes a JSON result file to:
  - `docs/deliverables/kanban-step1-blocked-inprogress-older14-2026-02-21-live.json`

### Expected shape of the JSON output

```json
{
  "auditDate": "2026-02-21",
  "cutoffDays": 14,
  "cutoffDate": "2026-02-07",
  "matchCount": 0,
  "matches": []
}
```

If `matchCount` is `0` and `matches` is an empty array, Step 1 confirms that **no** tickets satisfy the filter (no blocked or in-progress tickets older than 14 days).

If `matchCount` is greater than `0`, each entry in `matches` will include:

```json
{
  "title": "<ticket title>",
  "status": "<STATUS value>",
  "assignee": "<ASSIGNEE value>",
  "updated_at": "YYYY-MM-DD",
  "cutoffDate": "2026-02-07"
}
```

These records are the canonical enumeration for Step 1 and should be reviewed and remediated in subsequent steps.

---

## 2. Interpretation for the 2026-02-21 audit

Based on existing script-backed artifacts (JSON/CSV/MD) and the known board state, we expect `matchCount` to be `0` for this audit date.

However, this runbook makes the Step 1 enumeration **re-runnable and verifiable** directly against the live `project/kanban/board.md` without relying solely on previously generated files.
