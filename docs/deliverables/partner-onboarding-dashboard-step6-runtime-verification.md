# Partner Onboarding Dashboard – Step 6 Runtime Verification

**Step 6 Goal**  
Verify, end-to-end and in a running dev environment, that:

- Navigating to `/partners/dashboard` as an admin loads `web/app/partners/dashboard.tsx`.
- The table shows real records from the `partners` collection with correct time-to-first-round values.
- Changing the type filter updates both the table and the lane averages.
- The bar chart displays non-empty values for any lane with time-to-first-round data.

This document is a concrete runbook a human (or future agent with browser tools) can follow to verify the dashboard in a real environment.

---

## 1. Prerequisites

- Project checked out at:
  - `/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web`
- Firebase Admin service account key present at:
  - `serviceAccountKey.json` in the project root (see `.agent/workflows/firebase-admin.md`).
- You have an **admin-capable account** for the dev environment (same credentials you use for the existing `/admin` pages).

> **Note:** Global `npm run build` may still be red due to unrelated issues (e.g. missing `server/partners/playbookConfig`). This runbook focuses on **runtime behavior** of the dashboard route itself.

---

## 2. Start the Dev Server

Use the fast dev workflow (documented in `.agent/workflows/dev-server.md`):

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
npm run dev:fast
```

Wait until the dev server reports that it is listening (typically on `http://localhost:8888`).

You will access the dashboard at:

- `http://localhost:8888/partners/dashboard`

---

## 3. Seed Representative `partners` Data (Firebase Admin)

To verify the table, filter, and bar chart behavior in a controlled way, seed three test partners via the Firebase Admin SDK.

From the project root, run:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web && node -e "
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const app = initializeApp({
  credential: cert(require('./serviceAccountKey.json')),
});
const db = getFirestore(app);

(async () => {
  const now = new Date();
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  // Brand partner: invited 10 days ago, first round 3 days ago → ~7.0 days
  await db.collection('partners').doc('test-brand-1').set({
    type: 'brand',
    contactEmail: 'brand-partner@example.com',
    onboardingStage: 'active',
    invitedAt: Timestamp.fromDate(daysAgo(10)),
    firstRoundCreatedAt: Timestamp.fromDate(daysAgo(3)),
  }, { merge: true });

  // Gym partner: invited 5 days ago, first round 2 days ago → ~3.0 days
  await db.collection('partners').doc('test-gym-1').set({
    type: 'gym',
    contactEmail: 'gym-partner@example.com',
    onboardingStage: 'active',
    invitedAt: Timestamp.fromDate(daysAgo(5)),
    firstRoundCreatedAt: Timestamp.fromDate(daysAgo(2)),
  }, { merge: true });

  // Run club partner: invited 4 days ago, no first round yet
  await db.collection('partners').doc('test-runclub-1').set({
    type: 'runClub',
    contactEmail: 'runclub-partner@example.com',
    onboardingStage: 'invited',
    invitedAt: Timestamp.fromDate(daysAgo(4)),
    // firstRoundCreatedAt intentionally omitted
  }, { merge: true });

  console.log('Seeded partners for dashboard verification');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
"
```

This creates three deterministic documents in the `partners` collection that match the QA scenarios used in Steps 4 and 5.

---

## 4. Log In as an Admin and Open the Dashboard

1. In your browser, navigate to your dev host (typically `http://localhost:8888`).
2. Sign in using an admin-capable account.
3. Go to:

   ```
   /partners/dashboard
   ```

   Example: `http://localhost:8888/partners/dashboard`

### Expected Route & Guard Behavior

- Page loads with the title **“Partner Onboarding Dashboard”**.
- If you are **not** authenticated / not an admin, you should see the same kind of block/redirect behavior used by other admin pages (driven by `withAdminAuth` / `AdminRouteGuard`).

If this fails, investigate `web/lib/auth/withAdminAuth.tsx` and the legacy `AdminRouteGuard`.

---

## 5. Verify Table Data vs `partners` Documents

With the seeded documents above, initial load (filter = `All`) should show **three rows**.

For each row in the table:

### 5.1 `test-brand-1`

- **Partner:** `brand-partner@example.com`
- **Type:** `brand` (may display as `Brand` via CSS/capitalization).
- **Onboarding Stage:** `active`.
- **Invited At:** Timestamp ~10 days ago (check timezone formatting; relative age is what matters).
- **First Round Created At:** Timestamp ~3 days ago.
- **Time to First Round (days):** Approximately **`7.0`** (10 days minus 3 days, rendered to 1 decimal place; small rounding differences are acceptable).

### 5.2 `test-gym-1`

- **Partner:** `gym-partner@example.com`
- **Type:** `gym`.
- **Onboarding Stage:** `active`.
- **Invited At:** ~5 days ago.
- **First Round Created At:** ~2 days ago.
- **Time to First Round (days):** Approximately **`3.0`**.

### 5.3 `test-runclub-1`

- **Partner:** `runclub-partner@example.com`
- **Type:** `runClub`.
- **Onboarding Stage:** `invited`.
- **Invited At:** ~4 days ago.
- **First Round Created At:** **`—`** (no value since `firstRoundCreatedAt` is missing).
- **Time to First Round (days):** **`—`** (the table should show `—` when `firstRoundCreatedAt` is `null`).

If any of these expectations are not met, the likely culprits are:

- Mapping from Firestore → `PartnerRow` in `web/app/partners/dashboard.tsx`.
- `PartnerModel`’s normalization of timestamp fields in `src/types/Partner.ts`.

---

## 6. Verify Type Filter Logic on the Live Page

Use the **Filter by type** select control in the header of the “Partner Records” section.

### 6.1 `All` filter

- Ensure the select is set to `All`.
- Expected:
  - Table shows 3 rows (brand, gym, run club).
  - Summary text: `Showing 3 partners.` (exact wording may vary slightly).

### 6.2 `Brand` filter

- Change the select to **Brand**.
- Expected:
  - Table shows **only** `brand-partner@example.com`.
  - Summary text includes `for type brand`.

### 6.3 `Gym` filter

- Change the select to **Gym**.
- Expected:
  - Table shows **only** `gym-partner@example.com`.

### 6.4 `Run Club` filter

- Change the select to **Run Club**.
- Expected:
  - Table shows **only** `runclub-partner@example.com`.
  - `Time to First Round (days)` for this row remains `—`.

### 6.5 Back to `All`

- Change the select back to **All**.
- Expected:
  - All three seeded partners reappear.

Any discrepancy here indicates an issue with `typeFilter` state, the `filteredPartners` memo, or the wiring into `PartnerOnboardingTable`.

---

## 7. Verify Lane-Level Averages and Bar Chart Behavior

Using the same seeded data, verify the bar chart under **“Average Time to First Round by Partner Type”**.

### 7.1 `All` filter

- With filter set to `All`:
  - **Brand lane:** value ≈ `7.0 d`.
  - **Gym lane:** value ≈ `3.0 d`.
  - **Run Club lane:** value displayed as `—` (no bar) because there is no `firstRoundCreatedAt`.

### 7.2 `Brand` filter

- With filter set to **Brand**:
  - Only Brand lane should have a visible bar, ≈ `7.0 d`.
  - Gym and Run Club lanes should show `—`.

### 7.3 `Gym` filter

- With filter set to **Gym**:
  - Only Gym lane has a visible bar, ≈ `3.0 d`.

### 7.4 `Run Club` filter

- With filter set to **Run Club**:
  - No lane has a valid time-to-first-round; all lane `value`s are `null`.
  - Expected behavior (per implementation): instead of rendering empty bars, the section should show the message:

    > `No time-to-first-round data yet for the current filter. Once partners create their first round, lane-level averages will appear here.`

Any mismatch here suggests an issue in the `laneAverages` computation or how the `BarChart` is invoked.

---

## 8. Completion Criteria

Step 6 can be considered **fully verified** when:

1. You have:
   - Started the dev server (`npm run dev:fast`).
   - Seeded the three test partners using Firebase Admin.
   - Signed in as an admin and loaded `/partners/dashboard`.
2. And you have confirmed in the browser that:
   - Route and guard behave as expected (admin-only access).
   - Table row values (including time-to-first-round) match the seeded Firestore data.
   - The type filter select updates both the table rows and the summary text.
   - The bar chart reflects the correct per-type averages for each filter state and falls back to the "No data" message when appropriate.

Once all of the above pass, the partner onboarding dashboard is verified against the current spec and is ready to be considered part of the partner onboarding playbook.
