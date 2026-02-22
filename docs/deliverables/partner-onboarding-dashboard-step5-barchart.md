# Partner Onboarding Dashboard – Step 5 Bar Chart Verification

**Step 5 Goal**  
Compute average "Time to First Round" per partner type from the loaded partners and render a simple bar chart using `web/components/BarChart.tsx` (or a new chart component) that displays average days-to-active for each of `brand`, `gym`, and `runClub`.

## Implementation Summary

### Lane Average Computation

**File:** `web/app/partners/dashboard.tsx`

The page derives `filteredPartners` (see Step 4 doc), then computes lane-level averages:

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
        return msDiff / (1000 * 60 * 60 * 24); // days
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

Notes:
- Averages are computed from **`filteredPartners`**, keeping the chart in sync with the table filter.
- If a partner has no `firstRoundCreatedAt`, it is excluded from the average for that lane.
- Negative or zero diffs are clamped to `0` days.
- When no partners in a lane have a first round, `value` is `null`.

### Bar Chart Component

**File:** `web/components/charts/BarChart.tsx`

```ts
export type BarDatum = {
  label: string;
  value: number | null;
};

export type BarChartProps = {
  data: BarDatum[];
  height?: number;
};

export function BarChart({ data, height = 140 }: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-xs text-gray-500">No data available.</div>
    );
  }

  const numericValues = data
    .map((d) => d.value)
    .filter((v): v is number => v != null && !isNaN(v));

  const maxValue = numericValues.length > 0 ? Math.max(...numericValues) : 0;

  return (
    <div className="space-y-2" style={{ minHeight: height }}>
      {data.map((d) => {
        const widthPercent =
          d.value != null && maxValue > 0
            ? Math.max(4, Math.min(100, (d.value / maxValue) * 100))
            : 0;

        return (
          <div key={d.label} className="flex items-center gap-3 text-sm">
            <div className="w-24 text-gray-700 font-medium truncate">
              {d.label}
            </div>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              {d.value != null && maxValue > 0 && (
                <div
                  className="h-3 bg-blue-500 rounded-full"
                  style={{ width: `${widthPercent}%` }}
                />
              )}
            </div>
            <div className="w-16 text-right text-gray-700 text-xs">
              {d.value != null && maxValue > 0 ? `${d.value.toFixed(1)} d` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### Chart Usage in Dashboard

```tsx
<section className="mt-4 border rounded-lg bg-white shadow-sm p-4 space-y-4">
  <header>
    <h2 className="text-lg font-semibold">
      Average Time to First Round by Partner Type
    </h2>
    <p className="mt-1 text-xs text-gray-600 max-w-xl">
      For the currently selected filter, this chart shows the average
      number of days between initial invite and the first created round
      for each partner type.
    </p>
  </header>

  {laneAverages.every((lane) => lane.value == null) ? (
    <p className="text-sm text-gray-600">
      No time-to-first-round data yet for the current filter. Once
      partners create their first round, lane-level averages will appear
      here.
    </p>
  ) : (
    <BarChart data={laneAverages} />
  )}
</section>
```

## Verification Checklist

- [x] Lane labels cover all required partner types: Brand, Gym, Run Club.
- [x] Averages are computed **per type** from `filteredPartners` using `(firstRoundCreatedAt - invitedAt)` in days.
- [x] Partners without `firstRoundCreatedAt` are excluded from averages.
- [x] Negative or zero diffs are treated as `0` days.
- [x] `BarChart` receives an array of `{ label, value }` where `value` is `null` for lanes with no data.
- [x] When at least one lane has numeric `value`, that lane renders a non-empty bar and a numeric label `{value.toFixed(1)} d`.
- [x] When **all** lanes have `value === null`, a friendly "No data" message is shown instead of an empty chart.

## Manual QA Scenarios

Assume 3 partners:
- Brand partner: invited 7 days before first round.
- Gym partner: invited 3 days before first round.
- Run Club partner: invited but no first round yet.

1. **All filter**
   - Filter `typeFilter = "all"`.
   - Chart should show approximately:
     - Brand: ~7.0 d
     - Gym: ~3.0 d
     - Run Club: `—` (no bar, text `—`).

2. **Gym filter**
   - Filter `typeFilter = "gym"`.
   - Only Gym lane should have a non-empty bar with `~3.0 d`.
   - Brand and Run Club should show `—`.

3. **Brand filter**
   - Filter `typeFilter = "brand"`.
   - Only Brand lane should have a non-empty bar with `~7.0 d`.

4. **Run Club filter**
   - Filter `typeFilter = "runClub"`.
   - All lanes likely display `—` for value (no first rounds); chart should show the "No data" message instead of bars.

Once these scenarios pass, Step 5 (type-level averages + bar chart) can be treated as verified.
