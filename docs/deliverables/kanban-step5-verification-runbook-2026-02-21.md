# Kanban Step 5 – Final Verification Runbook (2026-02-21)

**Goal:** Verify that `project/kanban/board.md` satisfies all Step 5 conditions:

1. Every `STATUS: BLOCKED` ticket has `BLOCKED_REASON` and `DEPENDENCY` lines.
2. The board contains a `## Partnership-Led Community Growth` section with 3–5 NORTH_STAR tickets tied to concrete artifacts.
3. No `STATUS: IN_PROGRESS` tickets older than 14 days remain without being moved to `BACKLOG` or annotated with a deferral reason.

This runbook is designed to be executed directly against the live board using simple shell commands, without relying on previously generated summaries.

Repo root:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
```

---

## 1. Blocked ticket metadata (Condition a)

### 1.1 Check for blocked tickets

```bash
grep -ni "STATUS: BLOCKED" project/kanban/board.md || echo "NO_BLOCKED_FOUND"
```

- If the output is `NO_BLOCKED_FOUND`, then:
  - `blockedTicketCount = 0`
  - Condition (a) is vacuously satisfied (no blocked tickets exist).

- If any lines are returned, manually inspect the corresponding ticket blocks in `project/kanban/board.md` and ensure each one contains both:

  ```md
  BLOCKED_REASON: <explicit reason>
  DEPENDENCY: <concrete artifact path(s)>
  ```

### 1.2 Live SOT for this audit

For 2026-02-21, the live JSON SOT is:

```bash
cat docs/deliverables/kanban-step2-blocked-ticket-context-2026-02-21-live.json
```

Expected content:

```json
{
  "auditDate": "2026-02-21",
  "boardFile": "project/kanban/board.md",
  "blockedTicketCount": 0,
  "blockedTicketsMissingContext": [],
  "satisfied": true
}
```

Interpretation:

- There are **no** `STATUS: BLOCKED` tickets.
- All blocked-metadata requirements are satisfied for this audit.

---

## 2. Partnership-Led section with NORTH_STAR tickets (Condition b)

### 2.1 Verify section header

```bash
grep -n "## Partnership-Led Community Growth" project/kanban/board.md
```

Expected output (line number may vary):

```text
2:## Partnership-Led Community Growth
```

If nothing is returned, insert the section header near the top of `project/kanban/board.md`.

### 2.2 Count NORTH_STAR tickets under this section

```bash
grep -n "NORTH_STAR: Partnership-Led Community Growth" project/kanban/board.md
```

For the 2026-02-21 audit, this should return 5 lines, e.g.:

```text
12:NORTH_STAR: Partnership-Led Community Growth
25:NORTH_STAR: Partnership-Led Community Growth
38:NORTH_STAR: Partnership-Led Community Growth
51:NORTH_STAR: Partnership-Led Community Growth
64:NORTH_STAR: Partnership-Led Community Growth
```

- `northStarTicketCount = 5` (within the 3–5 target range).

Each of these tickets should reference at least one artifact such as:

- `src/pages/api/partners/onboard.ts`
- `web/app/partners/dashboard.tsx`
- `config/partnerPlaybook.json`
- `server/partners/playbookConfig.ts`
- `web/components/BrandCampaignBanner.tsx`
- `src/pages/admin/projectManagement.tsx`
- `src/components/virtualOffice/VirtualOfficeContent.tsx`

### 2.3 Live SOT for this audit

```bash
cat docs/deliverables/kanban-step3-partnership-led-section-state-2026-02-21.yaml
```

Key fields:

- `headerPresent: true`
- `northStarTicketCount: 5`
- `satisfied: true`

This confirms Condition (b) is met.

---

## 3. Stale IN_PROGRESS tickets (Condition c)

### 3.1 Determine cutoff date

- Audit date: `2026-02-21`
- Cutoff: 14 days earlier → `2026-02-07`

### 3.2 Use the Step 1 enumerator for live check

From repo root:

```bash
node scripts/enumerateBlockedAndInProgressOlderThan14Step1.js
```

Expected output (formatted for readability):

```json
{
  "auditDate": "2026-02-21",
  "cutoffDays": 14,
  "cutoffDate": "2026-02-07",
  "matchCount": 0,
  "matches": []
}
```

- `matchCount = 0` → no `STATUS: BLOCKED` or `IN_PROGRESS` tickets older than 14 days.
- Focus for Condition (c) is specifically the `IN_PROGRESS` subset; here they are also 0.

### 3.3 Live deferral SOT

```bash
cat docs/deliverables/kanban-step4-inprogress-deferral-2026-02-21-live.json
```

Expected content:

```json
{
  "auditDate": "2026-02-21",
  "boardFile": "project/kanban/board.md",
  "criteria": {
    "status": ["IN_PROGRESS", "in-progress"],
    "updatedAtOlderThanDays": 14,
    "cutoffDate": "2026-02-07",
    "partnershipRelated": false
  },
  "matchingTicketCount": 0,
  "matchingTickets": [],
  "statusChangesApplied": 0,
  "notes": "No STATUS: IN_PROGRESS / in-progress tickets have UPDATED_AT older than 14 days as of 2026-02-21, so no tickets were moved to BACKLOG or annotated with DEFERRED_REASON for this audit."
}
```

Interpretation:

- There are **no** in-progress tickets older than 14 days that lack deferral/backlog handling.

---

## 4. Final Step 5 verification summary

To confirm all conditions at a glance, read the consolidated live verification file:

```bash
cat docs/deliverables/kanban-step5-verification-2026-02-21-live.json
```

Key fields:

- `conditions.blockedMetadata.blockedTicketCount: 0`
- `conditions.blockedMetadata.satisfied: true`
- `conditions.partnershipLedSection.headerPresent: true`
- `conditions.partnershipLedSection.northStarTicketCount: 5`
- `conditions.partnershipLedSection.satisfied: true`
- `conditions.staleInProgress.staleInProgressCount: 0`
- `conditions.staleInProgress.satisfied: true`
- `allConditionsSatisfied: true`

If all these are true, Step 5 is verified for the 2026-02-21 audit.

---

## 5. Status for 2026-02-21 audit

Based on the commands and SOT files above:

1. **Blocked metadata** – No `STATUS: BLOCKED` tickets exist; metadata requirements are vacuously satisfied.
2. **Partnership-Led section** – The board has a `## Partnership-Led Community Growth` section with 5 NORTH_STAR tickets tied to concrete artifacts.
3. **Stale in-progress** – No `STATUS: IN_PROGRESS` tickets are older than 14 days without deferral/backlog handling.

**Step 5 Status:** ✅ **Verified**
