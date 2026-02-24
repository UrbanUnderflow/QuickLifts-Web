import React from "react";

export type BarDatum = {
  label: string;
  value: number | null;
};

export type BarChartProps = {
  data: BarDatum[];
  height?: number;
};

/**
 * BarChart
 *
 * Minimal, dependency-free horizontal bar chart for admin dashboards.
 * Values of `null` are rendered as empty tracks with a "—" label.
 */
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

export default BarChart;
