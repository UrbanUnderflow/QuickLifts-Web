# Kanban Blocked / Stale In-Progress Scan (Firestore) — 2026-02-20

This file documents Step 1 of the task:

> "Open the shared kanban file and identify all ticket blocks with `STATUS: BLOCKED` or `STATUS: IN_PROGRESS` and an `UPDATED_AT` older than 14 days."

## Canonical board source

In this codebase, the operational kanban board is not stored as `project/kanban/board.md` or `project/kanban/board.json` (both paths are missing). The true source of truth is the Firestore collection:

- Collection: `kanbanTasks`
- Used by: `src/api/firebase/kanban/service.ts` and the admin `projectManagement` UI

Accordingly, this scan treats **Firestore `kanbanTasks`** as the shared kanban board.

## Method

On 2026-02-20, the script `scripts/auditKanbanPartnershipNorthStar.js` was run from the project root:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web \
  && node scripts/auditKanbanPartnershipNorthStar.js
```

The script:

- Reads all documents from `kanbanTasks`.
- Derives a "blocked-like" flag from `notes` containing `BLOCKED:` (until a formal blocked field is added).
- Treats any task with `status === 'in-progress'` and `updatedAt < now - 14 days` as **stale in-progress**.

## Findings (as of run time)

Command output excerpt:

```text
📊 Totals: 745 tasks, 0 blocked-like, 0 stale in-progress (>14 days).

✅ No blocked-like tasks (based on notes containing "BLOCKED:").

✅ No stale in-progress tasks older than 14 days.
```

Interpretation:

- **STATUS: BLOCKED** — there is no dedicated `status: 'blocked'` state in `kanbanTasks`; ad-hoc `BLOCKED:` markers in `notes` were used as a proxy, and **none** were found.
- **STATUS: IN_PROGRESS with UPDATED_AT older than 14 days** — among all `kanbanTasks` with `status === 'in-progress'`, **none** had `updatedAt` older than 14 days at the time of the scan.

## Conclusion for Step 1

Using Firestore `kanbanTasks` as the shared board:

- There are **no** tickets currently considered blocked by the `BLOCKED:`-in-notes heuristic.
- There are **no** tickets with `status === 'in-progress'` whose `updatedAt` is older than 14 days.

If/when a markdown board file is introduced at `project/kanban/board.md`, this scan can be mirrored at the file level. For now, the Firestore-backed board is clean with respect to the criteria in Step 1.
