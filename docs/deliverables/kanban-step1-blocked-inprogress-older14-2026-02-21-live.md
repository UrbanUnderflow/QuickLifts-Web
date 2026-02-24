# Kanban Step 1 – BLOCKED / IN_PROGRESS Older Than 14 Days (Live Listing)

**Audit date:** 2026-02-21  
**Board file:** `project/kanban/board.md`  
**Cutoff date (14 days before audit):** 2026-02-07

## Filter

List all tickets where:

- `STATUS` is `BLOCKED` or `IN_PROGRESS` / `in-progress`, **and**
- `UPDATED_AT` < `2026-02-07`.

## Result Summary

- `STATUS: BLOCKED` tickets older than 14 days: **0**
- `STATUS: IN_PROGRESS` / `in-progress` tickets older than 14 days: **0**
- Combined `matchCount`: **0**

Live JSON SOT:

```json
{
  "auditDate": "2026-02-21",
  "boardFile": "project/kanban/board.md",
  "cutoffDays": 14,
  "cutoffDate": "2026-02-07",
  "criteria": {
    "status": ["BLOCKED", "IN_PROGRESS", "in-progress"],
    "updatedAtOlderThanDays": 14
  },
  "matchCount": 0,
  "matches": []
}
```

## Ticket Listing

No tickets satisfy:

> `STATUS` ∈ {`BLOCKED`, `IN_PROGRESS`, `in-progress`} **and** `UPDATED_AT` < `2026-02-07`.

The list of such tickets is therefore **empty** for this audit.
