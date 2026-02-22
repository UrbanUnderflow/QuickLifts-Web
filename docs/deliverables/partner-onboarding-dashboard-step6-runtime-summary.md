# Partner Onboarding Dashboard — Step 6 Runtime Summary

Step 6 requirement:

> Verify that navigating to `/partners/dashboard` as an admin loads `web/app/partners/dashboard.tsx`, that the table displays real records from the `partners` collection with correct time-to-first-round values, that changing the type filter updates the table and averages, and that the bar chart shows non-empty values for any lane with data.

## What must be true in a real dev environment

When Step 6 is complete, all of the following should be true **in a running app**:

1. **Route + auth + layout**
   - `/partners/dashboard` loads only for admin users.
   - The page uses the admin shell (`AdminLayout`).
   - The visible page header is `Partner Onboarding Dashboard`.

2. **Table content**
   - Each row corresponds to a real document in the `partners` Firestore collection.
   - Columns match Firestore fields:
     - Partner → `contactEmail` (current display name).
     - Type → `type` (`brand` / `gym` / `runClub`).
     - Onboarding Stage → `onboardingStage`.
     - Invited At → `invitedAt` timestamp.
     - First Round Created At → `firstRoundCreatedAt` timestamp or `—` when missing.
   - "Time to First Round (days)" matches `firstRoundCreatedAt - invitedAt` in days, with:
     - `—` when there is no first round.
     - `0.0` when `firstRoundCreatedAt <= invitedAt`.

3. **Type filter behavior**
   - Changing the filter (`All`, `Brand`, `Gym`, `Run Club`):
     - Updates the summary text (`Showing N partners` with `for type …` when not `all`).
     - Restricts the table rows to only partners of the selected type.
     - Changes the input data for lane averages (chart is based on `filteredPartners`).

4. **Bar chart behavior**
   - For filters where at least one partner has a first round:
     - The bar chart renders with per-lane averages (days).
   - For filters where **no** partners have a first round (e.g. only Run Clubs with no rounds):
     - The chart is replaced by the message:

       > `No time-to-first-round data yet for the current filter. Once partners create their first round, lane-level averages will appear here.`

## Where to find the detailed runbook

For a step-by-step operator checklist (including seeding test data), use:

- `docs/deliverables/partner-onboarding-dashboard-step6-runtime-verification.md`
- `docs/deliverables/partner-onboarding-dashboard-step6-ops-checklist.md`

These documents describe exactly how to:

- Start the dev server.
- Seed three deterministic partners (Brand, Gym, Run Club) into Firestore.
- Walk through `/partners/dashboard` and confirm that the behavior matches the expectations listed above.

## Optional: record actual verification

You can use this section to log the most recent manual verification:

- **Date:**
- **Environment:** (e.g. local dev, staging)
- **Verifier:**
- **Result:** ✅ Passed / ❌ Issues found
- **Notes:**
  - 
