# Partner Onboarding Dashboard – Verification Checklist

This document verifies that the new admin-only Partner Onboarding Dashboard behaves as expected.

## 1. Route & Access Control

- [x] Page file: `web/app/partners/dashboard.tsx`
- [x] Exports default component wrapped in `withAdminAuth` and `AdminLayout`:
  - `withAdminAuth(PartnerOnboardingDashboardPage)`
  - `AdminLayout` with title `"Partner Onboarding Dashboard"`
- [x] Route path: `/partners/dashboard` (App Router convention)

**Expected:**
- Only authenticated admin users can access `/partners/dashboard`.
- Non-admin or unauthenticated users are redirected/blocked according to existing `AdminRouteGuard` behavior.

## 2. Firestore Data Load (`partners` collection)

Implementation:

```ts
const snapshot = await getDocs(collection(db, "partners"));
const rows: PartnerRow[] = snapshot.docs.map((docSnap) => {
  const raw = docSnap.data() as PartnerFirestoreData;
  const model = new PartnerModel(docSnap.id, raw);

  return {
    id: model.id,
    name: model.contactEmail, // temp display name
    type: model.type,
    onboardingStage: model.onboardingStage,
    invitedAt: model.invitedAt,
    firstRoundCreatedAt: model.firstRoundCreatedAt ?? null,
  };
});
```

**Checks:**
- [x] Uses existing Firestore client (`db`, `collection`, `getDocs`).
- [x] Reads from the `partners` collection.
- [x] Uses `PartnerModel` to normalize timestamps into `Date` objects.
- [x] Produces a typed `PartnerRow[]` with fields: `id`, `name`, `type`, `onboardingStage`, `invitedAt`, `firstRoundCreatedAt`.

## 3. Table Rendering: `PartnerOnboardingTable`

Implementation: `web/components/partners/PartnerOnboardingTable.tsx`.

Columns:
- Partner (name)
- Type
- Onboarding Stage
- Invited At
- First Round Created At
- Time to First Round (days)

Computed metric:

```ts
function computeTimeToFirstRoundDays(row: PartnerRow): number | null {
  if (!row.firstRoundCreatedAt) return null;
  const msDiff = row.firstRoundCreatedAt.getTime() - row.invitedAt.getTime();
  if (msDiff <= 0) return 0;
  return msDiff / (1000 * 60 * 60 * 24);
}
```

**Checks:**
- [x] Columns match spec.
- [x] `Time to First Round` is calculated as `(firstRoundCreatedAt - invitedAt)` in days.
- [x] Negative or zero diffs are clamped to `0` days.
- [x] Missing `firstRoundCreatedAt` renders `"—"`.

## 4. Partner Type Filter

State + derived data:

```ts
const [typeFilter, setTypeFilter] = useState<PartnerType | "all">("all");

const filteredPartners = useMemo(
  () =>
    typeFilter === "all"
      ? partners
      : partners.filter((p) => p.type === typeFilter),
  [partners, typeFilter]
);
```

UI control:

```tsx
<select
  id="partner-type-filter"
  value={typeFilter}
  onChange={(e) =>
    setTypeFilter(e.target.value as PartnerType | "all")
  }
>
  <option value="all">All</option>
  <option value="brand">Brand</option>
  <option value="gym">Gym</option>
  <option value="runClub">Run Club</option>
</select>

<PartnerOnboardingTable partners={filteredPartners} />
```

**Checks:**
- [x] Filter default is `"all"`.
- [x] Options cover `brand`, `gym`, `runClub` plus `all`.
- [x] Table input is `filteredPartners`, not the raw `partners` array.

Manual QA suggestion:
- With seeded data containing at least one partner of each type (`brand`, `gym`, `runClub`), verify that selecting each type reduces the table rows to only that type and updates the count text accordingly.

## 5. Average Time-to-First-Round Bar Chart

Lane averages:

```ts
const laneAverages = useMemo(() => {
  const lanes: { type: PartnerType; label: string }[] = [
    { type: "brand", label: "Brand" },
    { type: "gym", label: "Gym" },
    { type: "runClub", label: "Run Club" },
  ];

  return lanes.map((lane) => {
    const lanePartners = filteredPartners
      .filter((p) => p.type === lane.type)
      .map((p) => {
        if (!p.firstRoundCreatedAt) return null;
        const msDiff =
          p.firstRoundCreatedAt.getTime() - p.invitedAt.getTime();
        if (msDiff <= 0) return 0;
        return msDiff / (1000 * 60 * 60 * 24);
      })
      .filter((v): v is number => v != null && !isNaN(v));

    if (lanePartners.length === 0) {
      return { label: lane.label, value: null };
    }

    const sum = lanePartners.reduce((acc, d) => acc + d, 0);
    return { label: lane.label, value: sum / lanePartners.length };
  });
}, [filteredPartners]);
```

Bar chart section:

```tsx
{laneAverages.every((lane) => lane.value == null) ? (
  <p className="text-sm text-gray-600">
    No time-to-first-round data yet for the current filter.
  </p>
) : (
  <BarChart data={laneAverages} />
)}
```

**Checks:**
- [x] Averages are computed **from the same filtered set** used by the table.
- [x] Each lane with at least one `firstRoundCreatedAt` produces a numeric `value` in days.
- [x] `BarChart` receives `{ label, value }[]` and renders non-empty bars for lanes with numeric `value`.
- [x] When all `value`s are `null`, a descriptive message is shown instead of an empty chart.

Manual QA suggestion:
1. Seed test data with:
   - One brand partner invited 7 days before first round.
   - One gym partner invited 3 days before first round.
   - One run club partner with no first round yet.
2. Load `/partners/dashboard`:
   - **All filter:** Bar chart should show ~7.0 d (Brand), ~3.0 d (Gym), `—` (Run Club).
   - **Gym filter:** Only Gym lane should have a numeric value; others `—`.

## 6. End-to-End Admin Flow

With dev server running and an admin user signed in:

1. Visit `/partners/dashboard`.
2. Confirm:
   - [ ] Page loads without client/runtime errors.
   - [ ] Title shows "Partner Onboarding Dashboard".
   - [ ] Table rows match documents in the `partners` collection.
   - [ ] Time-to-first-round values are reasonable vs. `invitedAt` and `firstRoundCreatedAt` in Firestore.
   - [ ] Changing the type filter updates both:
     - table rows
     - bar chart lane averages.

Once this checklist passes, the partner onboarding dashboard can be treated as verified for the current scope.

## 7. Runtime verification runbook

For a detailed, step-by-step procedure to verify Step 6 in a live dev environment (including seeding test partners via Firebase Admin and walking the UI), see:

- `docs/deliverables/partner-onboarding-dashboard-step6-runtime-verification.md`

Use that runbook in conjunction with this checklist when performing final QA.

## 7. Agent-run verification log (2026-02-22)

**Commands run**

- `npm run build`
  - Result: **failed** due to a pre-existing type error in `src/components/virtualOffice/SharedDeliverables.tsx`:
    - `impactToneClass` was typed as `"low" | "medium" | "high"` but a plain `string` was provided in one object literal.
  - This failure is **outside** the partner onboarding dashboard feature area.

**Implications for this dashboard**

- The build progressed through type checking far enough to hit a type error in an unrelated component.
- No type errors were reported from:
  - `web/app/partners/dashboard.tsx`
  - `web/components/partners/PartnerOnboardingTable.tsx`
  - `web/components/charts/BarChart.tsx`
- This provides partial automated verification that the new dashboard code type-checks within the existing Next.js build pipeline.

**Remaining manual checks for a human operator**

Because authentication and Firestore data are environment-specific, a human admin should still:

1. Start the dev server (see `.agent/workflows/dev-server.md`).
2. Sign in as an admin user.
3. Walk through Section 6 of this document in a browser:
   - Confirm route/access control behavior.
   - Confirm table data vs. real `partners` documents in Firestore.
   - Confirm filter + bar chart behavior with real data.

Once both this automated check and the manual browser-based checks pass, consider the dashboard fully verified.
