# Partner Onboarding Dashboard — Step 4: Partner Type Filter Verification

This document provides a concrete, repeatable way to **verify** that the partner type filter control on `/partners/dashboard` behaves correctly end-to-end.

## 1. Code-Level Verification (Node Script)

You can validate the **filter semantics** without running the app or hitting Firestore using the dev sanity script.

### 1.1. Run the script

From the project root:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
node web/lib/partners/dev-check-filterPartnersByType.js
```

### 1.2. Expected output

The script prints the IDs of partners returned for each filter option:

```text
All: [ '1', '2', '3' ]
Brand: [ '1' ]
Gym: [ '2' ]
Run Club: [ '3' ]
```

If the output matches, the **core filter logic** defined in `web/lib/partners/filterPartnersByType.ts` is correct:

- `filter = 'all'` → returns all partners
- `filter = 'brand'` → only partners where `type === 'brand'`
- `filter = 'gym'` → only partners where `type === 'gym'`
- `filter = 'runClub'` → only partners where `type === 'runClub'`

This covers the logic layer.

## 2. Runtime UI Verification (Dashboard Page)

These steps verify that the **React state + UI wiring** in `web/app/partners/dashboard.tsx` correctly applies the filter before passing data into `PartnerOnboardingTable`.

### 2.1. Prerequisites

- Dev server running (fast mode is fine):

  ```bash
  cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
  npm run dev:fast
  ```

- You are logged in as an **admin** (so `withAdminAuth` and `AdminRouteGuard` let you through).
- Firestore `partners` collection seeded with at least one doc for each type:
  - One `brand`
  - One `gym`
  - One `runClub`

(You can reuse or adapt the seeding script from `partner-onboarding-dashboard-step6-runtime-verification.md`.)

### 2.2. Navigate to the dashboard

1. In the browser, open:

   ```text
   http://localhost:3000/partners/dashboard
   ```

2. Confirm you see the **"Partner Onboarding Dashboard"** title and no auth errors.

### 2.3. Validate filter control behavior

1. Locate the **"Filter by type"** control at the top-right of the table section.
2. Confirm the options in the `<select>` are exactly:
   - `All`
   - `Brand`
   - `Gym`
   - `Run Club`

3. With `All` selected:
   - The summary text reads:
     > `Showing N partners.`
   - The table shows **all seeded partners** (Brand + Gym + Run Club rows all visible).

4. Switch the select to **Brand**:
   - Summary text updates to:
     > `Showing 1 partners for type brand.`
     (or a matching count if you have more than one brand partner.)
   - The table only shows partners where `type === 'brand'`.
   - No gym or runClub rows are visible.

5. Switch the select to **Gym**:
   - Summary text updates to `... for type gym.`
   - Only `type === 'gym'` rows are visible.

6. Switch the select to **Run Club**:
   - Summary text updates to `... for type runClub.`
   - Only `type === 'runClub'` rows are visible.

7. Switch back to **All**:
   - Summary text no longer includes the `for type ...` suffix.
   - All partner rows (across all types) reappear.

### 2.4. Edge-case sanity checks

1. **Single-type dataset**: If you temporarily seed partners of only one type (e.g., only `gym`), then:
   - `All` and `Gym` filters show the same number of rows.
   - `Brand` and `Run Club` filters show **zero** rows, and the table renders the "no data" state.

2. **No partners**: If the `partners` collection is empty:
   - The filter control still renders.
   - All filter options are selectable without errors.
   - The table consistently shows the "no partners" message / empty state regardless of the filter.

## 3. What This Verifies

By following this runbook, you’ve validated that:

1. The **pure filter logic** in `filterPartnersByType` behaves exactly as expected (verified via Node script).
2. The **dashboard state + UI wiring**:
   - Binds the select’s value to `typeFilter`.
   - Uses `filterPartnersByType(partners, typeFilter)` to derive `filteredPartners`.
   - Passes `filteredPartners` (not the raw `partners` array) into `PartnerOnboardingTable`.
   - Updates the summary text and table rows in response to user interaction.

Once this file’s steps are followed and the expected behavior is observed, **Step 4 (partner type filter) can be considered fully verified**, not just implemented.