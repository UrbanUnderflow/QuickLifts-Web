# Partner Onboarding Dashboard — Step 3: PartnerOnboardingTable Verification

Step 3 requirement:

> Implement a `PartnerOnboardingTable` component (inline or in `web/components/PartnerOnboardingTable.tsx`) that renders a table with columns for partner name, type, onboardingStage, `invitedAt`, `firstRoundCreatedAt`, and a computed "Time to First Round" value in days using the difference between `firstRoundCreatedAt` and `invitedAt`.

This doc shows **where the table implementation lives** and **how to verify its behavior**.

---

## 1. Implementation: PartnerOnboardingTable

**File:** `web/components/partners/PartnerOnboardingTable.tsx`

### 1.1. Row type

```ts
export interface PartnerRow {
  id: string;
  name: string;
  type: PartnerType;
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt: Date | null;
}
```

This matches the shape produced by `mapPartnersSnapshot` (Step 2).

### 1.2. Time-to-first-round computation

```tsx
function computeTimeToFirstRoundDays(row: PartnerRow): number | null {
  if (!row.firstRoundCreatedAt) return null;
  const msDiff = row.firstRoundCreatedAt.getTime() - row.invitedAt.getTime();
  if (msDiff <= 0) return 0;
  return msDiff / (1000 * 60 * 60 * 24);
}
```

Behavior:

- No `firstRoundCreatedAt` → `null` (displayed as `—`).
- Negative or zero difference → clamped to `0` days.
- Positive difference → raw day count (fractional), e.g. `7.0`.

### 1.3. Columns rendered

The component renders a standard HTML table with columns:

```tsx
<thead>
  <tr>
    <th>Partner</th>
    <th>Type</th>
    <th>Onboarding Stage</th>
    <th>Invited At</th>
    <th>First Round Created At</th>
    <th>Time to First Round (days)</th>
  </tr>
</thead>
```

Each row uses `computeTimeToFirstRoundDays(row)` for the last column, with `toFixed(1)` for display and a `"—"` fallback when the computed value is `null`.

The table also renders an empty/"no data" message when `partners.length === 0`.

---

## 2. How the table is used in the dashboard

**File:** `web/app/partners/dashboard.tsx`

The dashboard passes **filtered partners** into the table:

```tsx
<PartnerOnboardingTable partners={filteredPartners} />
```

`filteredPartners` is derived from the Firestore-loaded `PartnerRow[]` and the current type filter, so the table always reflects the active filter state.

---

## 3. Runtime verification checklist

These steps assume you have:

- Dev server running: `npm run dev:fast`
- Admin login working.
- The `partners` collection seeded with at least three documents (Brand, Gym, Run Club) as described in the Step 6 runbook.

### 3.1. Navigate to the dashboard

1. Open:

   ```text
   http://localhost:3000/partners/dashboard
   ```

2. Confirm the **"Partner Records"** section and table are visible (no errors).

### 3.2. Verify headers

Check that the table header row contains exactly:

- `Partner`
- `Type`
- `Onboarding Stage`
- `Invited At`
- `First Round Created At`
- `Time to First Round (days)`

### 3.3. Verify one row per seeded partner

For each seeded partner (Brand, Gym, Run Club):

1. **Partner** column
   - Shows the partner display name (currently the `contactEmail` from Firestore via `mapPartnersSnapshot`).

2. **Type** column
   - Shows `Brand`, `Gym`, or `Run Club` (case/label may be capitalized).

3. **Onboarding Stage** column
   - Matches the `onboardingStage` field in the `partners` document.

4. **Invited At** column
   - Shows a human-readable date/time consistent with `invitedAt`.

5. **First Round Created At** column
   - Brand & Gym rows: show date/times matching their `firstRoundCreatedAt` values.
   - Run Club row: shows `—` (no first round yet).

6. **Time to First Round (days)** column
   - Brand row: ≈ `7.0` days (given seeding of invited 10 days ago, first round 3 days ago).
   - Gym row: ≈ `3.0` days.
   - Run Club row: `—`.

### 3.4. Edge conditions

1. **No partners**
   - Temporarily clear the `partners` collection.
   - Reload `/partners/dashboard`.
   - Expectation: the table shows a clear "no partners" / empty state, no runtime errors.

2. **Zero/negative time difference**
   - Create a partner where `firstRoundCreatedAt` is equal to or earlier than `invitedAt`.
   - Expectation: the corresponding table row shows `0.0` in the "Time to First Round (days)" column.

---

## 4. Completion criteria for Step 3

Step 3 is fully satisfied when:

- `PartnerOnboardingTable` exists at `web/components/partners/PartnerOnboardingTable.tsx`.
- It renders the six required columns with the expected labels.
- It computes "Time to First Round" using the difference between `firstRoundCreatedAt` and `invitedAt`, with:
  - `—` when there is no first round.
  - `0.0` when `firstRoundCreatedAt <= invitedAt`.
  - A positive fractional day value otherwise.
- In a running dev environment with seeded data, the table rows line up with Firestore documents and the time-to-first-round values match the expected date differences.
