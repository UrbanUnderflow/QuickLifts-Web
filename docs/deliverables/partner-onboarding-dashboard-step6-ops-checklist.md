# Partner Onboarding Dashboard — Step 6 Ops Checklist (Runtime Verification)

This is a **hands-on operator checklist** to fully verify Step 6:

> Navigating to `/partners/dashboard` as an admin loads `web/app/partners/dashboard.tsx`, the table displays real records from the `partners` collection with correct time-to-first-round values, changing the type filter updates the table and averages, and the bar chart shows non-empty values for any lane with data.

## 1. Start dev server

From the project root:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
npm run dev:fast
```

Wait until the console shows that the dev server is listening on `localhost:3000`.

## 2. Seed Firestore test data

Use the Firebase Admin seeding script described in:

- `docs/deliverables/partner-onboarding-dashboard-step6-runtime-verification.md`

You should end up with **exactly three** `partners` documents, one per lane:

1. **Brand partner**
   - `type = 'brand'`
   - `onboardingStage` set to something like `"invited"` or `"active"`.
   - `invitedAt` = **10 days ago**
   - `firstRoundCreatedAt` = **3 days ago**
   - Expected time-to-first-round ≈ **7.0 days**

2. **Gym partner**
   - `type = 'gym'`
   - `invitedAt` = **5 days ago**
   - `firstRoundCreatedAt` = **2 days ago**
   - Expected time-to-first-round ≈ **3.0 days**

3. **Run Club partner**
   - `type = 'runClub'`
   - `invitedAt` = **4 days ago**
   - `firstRoundCreatedAt = null` (or omitted)
   - Expected time-to-first-round = **no value** (`—` in UI)

## 3. Log in as an admin

1. In a browser, go to your local app (e.g. `http://localhost:3000`).
2. Sign in with an account that has **admin privileges**.
3. Confirm you can access an existing admin page (e.g. `/admin/users`) to prove admin auth is working.

## 4. Verify route + layout

1. Navigate to:

   ```text
   http://localhost:3000/partners/dashboard
   ```

2. Confirm:
   - You are **not** redirected away or blocked by auth.
   - The page title or header reads **"Partner Onboarding Dashboard"**.
   - The layout matches other admin pages using `AdminLayout` (admin nav/shell visible).

If you see an auth error or redirect, `withAdminAuth` / `AdminRouteGuard` is not applied correctly and needs investigation before proceeding.

## 5. Verify table contents

Locate the `PartnerOnboardingTable` on the page and verify **row-by-row** against Firestore.

For each of the three seeded partners:

1. **Partner column**
   - Shows the partner display name (currently the `contactEmail` value from the `partners` document).

2. **Type column**
   - Shows `Brand`, `Gym`, or `Run Club` (case/label may be capitalized, but the underlying `type` value should match Firestore).

3. **Onboarding Stage column**
   - Matches the `onboardingStage` field from Firestore.

4. **Invited At column**
   - Shows a date/time consistent with the `invitedAt` timestamp in Firestore (10 / 5 / 4 days ago, respectively).

5. **First Round Created At column**
   - Brand: shows a date/time ≈ 3 days ago.
   - Gym: shows a date/time ≈ 2 days ago.
   - Run Club: shows `—` (no value) because `firstRoundCreatedAt` is null.

6. **Time to First Round (days) column**
   - Brand row: ≈ `7.0` days (10 days between invited and now minus 3 days between first round and now).
   - Gym row: ≈ `3.0` days.
   - Run Club row: `—` (no value) because there is no `firstRoundCreatedAt`.

## 6. Verify filter behavior + its effect on table and averages

Find the **"Filter by type"** select control above the table.

### 6.1. All

- Select **All**.
- Expectation:
  - Summary text: `Showing 3 partners.` (or `Showing N partners.` if you added more test docs).
  - Table shows all three partners.
  - Bar chart:
    - Brand ≈ `7.0 d`
    - Gym ≈ `3.0 d`
    - Run Club `—`

### 6.2. Brand

- Select **Brand**.
- Expectation:
  - Summary text: `Showing 1 partners for type brand.` (count may vary with more brand entries).
  - Table shows only the brand partner row.
  - Bar chart:
    - Brand lane still ≈ `7.0 d`.
    - Other lanes may be `null`/placeholder depending on implementation, but **no Gym or Run Club rows** appear in the table.

### 6.3. Gym

- Select **Gym**.
- Expectation:
  - Table shows only the gym partner row.
  - Bar chart shows a Gym lane ≈ `3.0 d`.

### 6.4. Run Club

- Select **Run Club**.
- Expectation:
  - Table shows only the run club partner row.
  - Because this partner has no `firstRoundCreatedAt`, **all lane averages are effectively null for this filter**.
  - The chart is replaced by the message:

    > `No time-to-first-round data yet for the current filter. Once partners create their first round, lane-level averages will appear here.`

## 7. Edge cases (optional but recommended)

1. **No partners**
   - Temporarily clear the `partners` collection.
   - Reload `/partners/dashboard`.
   - Expectation:
     - No runtime errors.
     - Filter control still renders.
     - Table shows a clear "no partners" / empty state.
     - Time-to-first-round section shows only the "No time-to-first-round data yet for the current filter" message; no bar chart.

2. **Zero or negative time-to-first-round**
   - Create a partner where `firstRoundCreatedAt` is **equal to** or **earlier than** `invitedAt`.
   - Expectation:
     - That row’s "Time to First Round (days)" shows `0.0`.

## 8. Completion Criteria

You can consider **Step 6 fully verified** when all of the following are true:

- `/partners/dashboard` is reachable as an admin and uses the admin layout.
- The table rows reflect real `partners` documents from Firestore, with correct values in all columns.
- The "Time to First Round (days)" column matches the expected date differences for your seeded test data.
- The partner type filter:
  - Changes both the summary text and which rows appear in the table.
  - Affects the lane averages (bar chart) based on the filtered set.
- The bar chart:
  - Shows non-empty values for lanes with time-to-first-round data.
  - Falls back to the "No time-to-first-round data yet" message when no lane has data for the current filter.

Once these checks are complete, the partner onboarding dashboard is not just implemented — it is **verified in a real dev environment** and ready for use in the partnership playbook.