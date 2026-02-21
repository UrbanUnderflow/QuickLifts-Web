# Kanban Step 1 – List of BLOCKED/IN_PROGRESS Tickets Older Than 14 Days (2026-02-21)

**Step 1 requirement:**

> Open the canonical kanban board file `project/kanban/board.md` (or `project/kanban/board.json` if that is the active source) and list all tickets with `STATUS: BLOCKED` or `STATUS: IN_PROGRESS` where the `UPDATED_AT` timestamp is older than 14 days.

## Parameters

- **Board file:** `project/kanban/board.md`
- **Audit date:** 2026-02-21
- **Stale cutoff:** `UPDATED_AT < 2026-02-07` (14 days before audit date)

## Scan for `STATUS: BLOCKED`

Command:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
grep -ni "STATUS: BLOCKED" project/kanban/board.md || echo "NO_BLOCKED_FOUND"
```

Output:

```text
NO_BLOCKED_FOUND
```

Result:

- There are **no** `STATUS: BLOCKED` tickets in the canonical board, so none can be older than 14 days.

## Scan for `STATUS: IN_PROGRESS` and check `UPDATED_AT`

Relevant blocks from `project/kanban/board.md` (trimmed to the fields we need):

```text
STATUS: in-progress
PROJECT: General
ASSIGNEE: Nora
CREATED_AT: 2026-02-13
UPDATED_AT: 2026-02-19

STATUS: in-progress
PROJECT: General
ASSIGNEE: Scout
CREATED_AT: 2026-02-16
UPDATED_AT: 2026-02-19

STATUS: in-progress
PROJECT:
ASSIGNEE: Sage
CREATED_AT: 2026-02-19
UPDATED_AT: 2026-02-19

STATUS: in-progress
PROJECT: General
ASSIGNEE: Solara
CREATED_AT: 2026-02-16
UPDATED_AT: 2026-02-16
```

Comparison against cutoff:

- Cutoff date for "older than 14 days" is **2026-02-07**.
- All `UPDATED_AT` values above are **later** than 2026-02-07:
  - 2026-02-16
  - 2026-02-19

Therefore, none of the in-progress tickets qualify as "older than 14 days" for this step.

## Step 1 – Final List

Tickets with:

- `STATUS: BLOCKED` **or** `STATUS: IN_PROGRESS`, **and**
- `UPDATED_AT` older than 14 days (`< 2026-02-07`)

**Resulting list:**

> **None.** There are **no tickets** on `project/kanban/board.md` that meet the criteria as of 2026-02-21.

This file is the explicit Step 1 deliverable: the requested list is empty, and the reasoning is recorded for future audits.
