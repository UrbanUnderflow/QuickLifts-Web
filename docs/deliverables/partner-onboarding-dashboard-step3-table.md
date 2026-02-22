# Partner Onboarding Dashboard – Step 3 Table & Time-to-First-Round

**Step 3 Goal**  
Implement a `PartnerOnboardingTable` component (inline or in `web/components/PartnerOnboardingTable.tsx`) that renders a table with:

- Columns for:
  - Partner name
  - Type
  - Onboarding stage
  - `invitedAt`
  - `firstRoundCreatedAt`
  - Computed **Time to First Round (days)**
- Time to First Round calculated as the difference between `firstRoundCreatedAt` and `invitedAt` in days.

---

## Implementation Summary

**File:** `web/components/partners/PartnerOnboardingTable.tsx`

```tsx
import React from "react";
import type { PartnerType } from "../../../src/types/Partner";

export interface PartnerRow {
  id: string;
  name: string;
  type: PartnerType;
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt: Date | null;
}

interface PartnerOnboardingTableProps {
  partners: PartnerRow[];
}

function computeTimeToFirstRoundDays(row: PartnerRow): number | null {
  if (!row.firstRoundCreatedAt) return null;
  const msDiff = row.firstRoundCreatedAt.getTime() - row.invitedAt.getTime();
  if (msDiff <= 0) return 0;
  return msDiff / (1000 * 60 * 60 * 24);
}

export const PartnerOnboardingTable: React.FC<PartnerOnboardingTableProps> = ({
  partners,
}) => {
  if (partners.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        No partners found. Once partners are onboarded into the
        <code> partners </code>
        collection, they will appear here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
              Partner
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
              Type
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
              Onboarding Stage
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
              Invited At
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
              First Round Created At
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
              Time to First Round (days)
            </th>
          </tr>
        </thead>
        <tbody>
          {partners.map((row) => {
            const invitedLabel = row.invitedAt.toLocaleString();
            const firstRoundLabel = row.firstRoundCreatedAt
              ? row.firstRoundCreatedAt.toLocaleString()
              : "—";
            const timeToFirstRound = computeTimeToFirstRoundDays(row);
            const timeLabel =
              timeToFirstRound != null ? timeToFirstRound.toFixed(1) : "—";

            return (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 border-b font-medium text-gray-900">
                  {row.name}
                </td>
                <td className="px-3 py-2 border-b capitalize">{row.type}</td>
                <td className="px-3 py-2 border-b">{row.onboardingStage}</td>
                <td className="px-3 py-2 border-b whitespace-nowrap">
                  {invitedLabel}
                </td>
                <td className="px-3 py-2 border-b whitespace-nowrap">
                  {firstRoundLabel}
                </td>
                <td className="px-3 py-2 border-b text-right">{timeLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

This implementation:

- Defines `PartnerRow` with the fields required by Step 2 and Step 3.
- Computes **Time to First Round (days)** via `computeTimeToFirstRoundDays`:
  - Returns `null` when `firstRoundCreatedAt` is `null` → rendered as `"—"`.
  - Returns `0` when the difference is negative or zero.
  - Otherwise returns the day difference as a floating-point number.
- Renders all required columns in the table.

The table is wired into the dashboard page via:

**File:** `web/app/partners/dashboard.tsx`

```tsx
import {
  PartnerOnboardingTable,
  type PartnerRow,
} from "../../components/partners/PartnerOnboardingTable";

// ...inside PartnerOnboardingDashboardPageInner...

{!isLoading && !error && filteredPartners.length > 0 && (
  <div className="space-y-3 text-sm text-gray-800">
    {/* summary + filter UI */}
    <PartnerOnboardingTable partners={filteredPartners} />
  </div>
)}
```

---

## Agent-run static check (2026-02-22)

To re-validate the Step 3 implementation against the live code, run:

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
sed -n '1,200p' web/components/partners/PartnerOnboardingTable.tsx
```

Confirm that:

1. `PartnerRow` includes: `id`, `name`, `type`, `onboardingStage`, `invitedAt`, `firstRoundCreatedAt`.
2. `computeTimeToFirstRoundDays`:
   - Returns `null` when `firstRoundCreatedAt` is missing.
   - Uses `firstRoundCreatedAt.getTime() - invitedAt.getTime()` and divides by `1000 * 60 * 60 * 24`.
   - Clamps negative or zero differences to `0`.
3. The JSX table header includes the six required columns.
4. The body renders one row per `partners` entry and uses `computeTimeToFirstRoundDays` to render the **Time to First Round (days)** column (with `toFixed(1)` or `"—"`).

If any of these conditions fail after future edits, Step 3 should be revisited.

---

## Manual QA Scenarios (Logical)

These scenarios are also covered more concretely in the Step 6 runtime runbook, but can be reasoned about purely from this component:

1. **Partner with no `firstRoundCreatedAt`**
   - Input: `invitedAt = new Date("2026-01-01")`, `firstRoundCreatedAt = null`.
   - Expected: `Time to First Round (days)` column renders `"—"`.

2. **Partner with future `firstRoundCreatedAt` (data anomaly)**
   - Input: `invitedAt = 2026-01-10`, `firstRoundCreatedAt = 2026-01-05`.
   - `msDiff <= 0` → computed days is `0`.
   - Expected: `"0.0"` in table.

3. **Normal partner with 3-day delay**
   - Input: `invitedAt = 2026-01-01`, `firstRoundCreatedAt = 2026-01-04`.
   - Expected: `Time to First Round (days) ≈ "3.0"`.

These scenarios ensure the component behaves correctly before it is exercised in a running app.
