# Kanban Blocked / Stale In-Progress Scan — 2026-02-20

Step:

> Open the canonical kanban file `project/kanban/board.md` and identify all tickets with `STATUS: BLOCKED` or `STATUS: IN_PROGRESS` whose `UPDATED_AT` timestamp is older than 14 days.

## Tooling

A reusable scanner script was added:

- `scripts/scanKanbanBlockedAndStale.js`

It:
- Reads `project/kanban/board.md`.
- Splits into ticket blocks starting with `###`.
- Extracts `STATUS:` and `UPDATED_AT: YYYY-MM-DD` from each block.
- Treats tickets as stale when:
  - `STATUS: in-progress` (markdown export casing), and
  - `UPDATED_AT < now - 14 days`.
- Counts `STATUS: BLOCKED` tickets separately.

## Run log

Command:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web \
  && node scripts/scanKanbanBlockedAndStale.js
```

Output:

```text
KANBAN_SCAN_RESULT
BOARD: /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web/project/kanban/board.md
CUTOFF_DAYS: 14
BLOCKED_COUNT: 0
STALE_IN_PROGRESS_COUNT: 0
```

## Findings

- `BLOCKED_COUNT: 0` → There are **no** tickets with `STATUS: BLOCKED` in `project/kanban/board.md`.
- `STALE_IN_PROGRESS_COUNT: 0` → There are **no** tickets with `STATUS: in-progress` whose `UPDATED_AT` is older than 14 days.

## Conclusion for Step 1

As of 2026-02-20, using `project/kanban/board.md` as the canonical board export:

- There are **zero** tickets that match the step’s criteria:
  - `STATUS: BLOCKED`, or
  - `STATUS: IN_PROGRESS` with `UPDATED_AT` older than 14 days.

This satisfies the identification requirement for Step 1; later steps (blocked enrichment, Partnership-Led section, stale in-progress triage) operate knowing there are no existing blocked or stale in-progress tickets to transform.
