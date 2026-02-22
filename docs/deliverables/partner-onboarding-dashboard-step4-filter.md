# Partner Onboarding Dashboard – Step 4 Type Filter Verification

**Step 4 Goal**  
Add a partner type filter control (select bound to React state) in `web/app/partners/dashboard.tsx` that filters the partners array by `type` (`'brand' | 'gym' | 'runClub'`) before passing it to `PartnerOnboardingTable`.

## Implementation Summary

**File:** `web/app/partners/dashboard.tsx`

```ts
import type { PartnerFirestoreData, PartnerType } from "../../../src/types/Partner";
// ...

function PartnerOnboardingDashboardPageInner() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<PartnerType | "all">("all");

  // Firestore load (see step 2 doc) ...

  const filteredPartners = useMemo(
    () =>
      typeFilter === "all"
        ? partners
        : partners.filter((p) => p.type === typeFilter),
    [partners, typeFilter]
  );
```

UI wiring:

```tsx
{!isLoading && !error && filteredPartners.length > 0 && (
  <div className="space-y-3 text-sm text-gray-800">
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <p>
        Showing <span className="font-semibold">{filteredPartners.length}</span>{" "}
        partners
        {typeFilter !== "all" && (
          <>
            {" "}for type <span className="font-semibold">{typeFilter}</span>
          </>
        )}
        .
      </p>
      <div className="flex items-center gap-2 text-sm">
        <label
          htmlFor="partner-type-filter"
          className="text-gray-700 font-medium"
        >
          Filter by type:
        </label>
        <select
          id="partner-type-filter"
          className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
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
      </div>
    </div>

    <PartnerOnboardingTable partners={filteredPartners} />
  </div>
)}
```

## Verification Checklist

- [x] Filter state is stored as `typeFilter: PartnerType | "all"` with default `"all"`.
- [x] `filteredPartners` is derived from `partners` using `Array.prototype.filter` when `typeFilter !== "all"` and passed into `PartnerOnboardingTable`.
- [x] The select control offers exactly the expected options:
  - `All`
  - `Brand`
  - `Gym`
  - `Run Club`
- [x] Changing the select updates `typeFilter` and therefore `filteredPartners`.
- [x] UI messaging reflects the current filter (shows count + type when not `all`).

## Manual QA Scenarios

With at least three partners in Firestore (one per type: `brand`, `gym`, `runClub`):

1. **Initial load**
   - Ensure `/partners/dashboard` loads without error as an admin.
   - Confirm the table shows all partners and the summary reads e.g. `Showing 3 partners.`

2. **Brand filter**
   - Change filter to **Brand**.
   - Table should show only `type === "brand"` partners.
   - Summary text should read `Showing 1 partners for type brand.` (count depends on data).

3. **Gym filter**
   - Change filter to **Gym**.
   - Table rows should all have `type === "gym"`.

4. **Run Club filter**
   - Change filter to **Run Club**.
   - Table rows should all have `type === "runClub"`.

5. **Back to All**
   - Change filter back to **All**.
   - Table shows all partners again; summary no longer includes `for type ...` suffix.

Once these scenarios pass, Step 4 (type-based filtering before table rendering) can be treated as verified.

## Agent-run static check (2026-02-22)

As an additional non-runtime sanity check, the implementation above was validated directly from the source file:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
sed -n '80,180p' web/app/partners/dashboard.tsx
```

The output confirms that:

- `typeFilter` is declared as `PartnerType | "all"` and initialized to `"all"`.
- `filteredPartners` is the only array passed into `PartnerOnboardingTable`.
- The `<select>` control options match the `PartnerType` union (`brand`, `gym`, `runClub`) plus the `all` sentinel.

This ties the doc to the live code so future changes can be re-checked with the same command.
