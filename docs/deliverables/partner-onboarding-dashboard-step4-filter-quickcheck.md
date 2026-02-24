# Partner Onboarding Dashboard — Step 4: Filter Quickcheck

This is a minimal, fast checklist to verify the **partner type filter control** on `/partners/dashboard` works end-to-end.

## 1. Preconditions

- Dev server running:

  ```bash
  cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
  npm run dev:fast
  ```

- You are logged in as an **admin**.
- `partners` collection has at least one doc of each type:
  - `type = 'brand'`
  - `type = 'gym'`
  - `type = 'runClub'`

(Use the Step 6 seeding script to set this up.)

## 2. Open the dashboard

Visit:

```text
http://localhost:3000/partners/dashboard
```

Confirm you see the **Partner Records** section and the table.

## 3. Filter behavior

Locate the **Filter by type** `<select>` above the table.

For each option, check:

1. **All**
   - Summary text: `Showing 3 partners.` (or `Showing N partners.` if you have more).
   - Table shows **all** seeded rows (Brand, Gym, Run Club).

2. **Brand**
   - Summary text contains: `for type brand`.
   - Table shows **only** partners where `type === 'brand'`.

3. **Gym**
   - Summary text contains: `for type gym`.
   - Table shows **only** partners where `type === 'gym'`.

4. **Run Club**
   - Summary text contains: `for type runClub`.
   - Table shows **only** partners where `type === 'runClub'`.

5. **Back to All**
   - Summary text drops the `for type ...` suffix.
   - All partner rows reappear.

## 4. Coupling with chart

- While switching between filter options, observe the **"Average Time to First Round by Partner Type"** section:
  - Lane averages and bar lengths should change when the filter changes, because the page uses `computeLaneAverages(filteredPartners, lanes)`.

If all of the above hold, Step 4 (filter control + its effect on downstream data) is working correctly in a real runtime environment.