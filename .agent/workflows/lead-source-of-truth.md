---
description: Required gate for lead, prospect, and partnership claims before publishing any deliverable
---

# Lead Source-of-Truth Gate

Use this runbook whenever a task touches lead intelligence, prospects, partnerships, or collaboration status.

## Canonical File

`docs/partnership/lead-source-of-truth.md`

This file is the only canonical source for lead status claims.

## Required Steps

### 1. Read the canonical file first

Load `docs/partnership/lead-source-of-truth.md` before drafting any lead-related deliverable.

### 2. Check every lead claim

For each claim (interest level, readiness, blocker, action item, status), verify the matching `LEAD-####` and `EVID-####` entries exist.

### 3. Add citations in the deliverable

Append citations inline:

`[SOT: LEAD-####, EVID-####]`

### 4. Handle missing evidence safely

If no evidence exists:

- Write `Unverified` instead of asserting the claim as fact.
- Add a new evidence row in `docs/partnership/lead-source-of-truth.md` before publishing.

### 5. Final pre-publish gate

Before commit/push:

1. Confirm every lead/prospect assertion has an `[SOT: ...]` citation.
2. Confirm cited IDs exist in `docs/partnership/lead-source-of-truth.md`.
3. If any citation is missing or invalid, do not mark the task complete.
