# Partner Onboarding Dashboard — Step 2 Firestore Quickcheck

Goal: Fast, concrete confirmation that the **dashboard is actually loading real `partners` documents** via the existing Firestore client and mapping them into the expected `PartnerRow[]` shape.

## 1. Preconditions

- Dev server running:

  ```bash
  cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
  npm run dev:fast
  ```

- You are logged in as an **admin**.
- The `partners` collection in Firestore contains at least one document with:
  - `contactEmail`
  - `type` (e.g. `brand`, `gym`, or `runClub`)
  - `onboardingStage`
  - `invitedAt`
  - optional `firstRoundCreatedAt`

## 2. Navigate to the dashboard

1. In a browser, open:

   ```text
   http://localhost:3000/partners/dashboard
   ```

2. Confirm:
   - You see the page title **"Partner Onboarding Dashboard"**.
   - No auth/permission error is shown.

## 3. Confirm Firestore is being hit

1. Open the browser devtools **Network** tab.
2. Filter requests by **`/firestore`** or by the project hostname used for Firestore.
3. Reload `/partners/dashboard`.
4. Confirm you see Firestore client traffic corresponding to reads against the **`partners`** collection.

This proves the page is not using any stubbed or hardcoded data.

## 4. Confirm mapped data shape in the UI

Using the table rendered by `PartnerOnboardingTable`:

For each visible row:

- `Partner` column -> matches `contactEmail` in the corresponding `partners` document.
- `Type` column -> matches `type` (`brand`/`gym`/`runClub`).
- `Onboarding Stage` column -> matches `onboardingStage`.
- `Invited At` column -> human-readable representation of `invitedAt`.
- `First Round Created At` column -> human-readable `firstRoundCreatedAt` or `—` when missing.

If these all line up with Firestore, then the mapping via `mapPartnersSnapshot` is producing the correct `PartnerRow` shape:

```ts
{
  id: string;
  name: string;                  // from contactEmail
  type: PartnerType;             // 'brand' | 'gym' | 'runClub'
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt: Date | null;
}
```

## 5. Optional: Console log the mapped rows (local dev only)

If you want a one-time deeper check while developing:

1. Temporarily add this log inside `PartnerOnboardingDashboardPageInner` **after** `setPartners(rows);` in the `loadPartners` function:

   ```ts
   console.log("[PartnerOnboardingDashboard] mapped partners", rows);
   ```

2. Reload `/partners/dashboard`.
3. Inspect the browser console output and confirm each object has exactly the fields:

   - `id`
   - `name`
   - `type`
   - `onboardingStage`
   - `invitedAt` (Date)
   - `firstRoundCreatedAt` (Date or null)

4. Remove the temporary `console.log` once confirmed to avoid noisy logs.

---

If all of the above checks pass, Step 2 is **not just implemented but verified**:

- The dashboard is calling `getDocs(collection(db, "partners"))` using the shared Firestore client.
- The response is being mapped through `mapPartnersSnapshot` into a typed `PartnerRow[]`.
- The UI reflects real Firestore data, proving that the wiring from Firestore -> mapping -> React state -> table is functioning end-to-end.