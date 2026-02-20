import React from "react";

export type TimeSeriesPoint = {
  label: string; // e.g., date string like yyyy-MM-dd
  value: number; // typically 0.0–1.0 for percentages
};

export type TimeSeriesChartProps = {
  data: TimeSeriesPoint[];
  height?: number;
};

/**
 * TimeSeriesChart
 *
 * Lightweight, dependency-free time series chart for the web app. This is
 * intentionally simple: a series of vertical bars scaled to the max value in
 * the dataset. It is sufficient for partner retention visualization without
 * pulling in a heavy charting library.
 */
export function TimeSeriesChart({ data, height = 120 }: TimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-xs text-gray-500">No data available for this period.</div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 0.0001);

  return (
    <div className="w-full flex items-end gap-1" style={{ height }}>
      {data.map((point) => {
        const barHeight = (point.value / maxValue) * 100;
        return (
          <div
            key={point.label}
            className="flex-1 flex flex-col items-center justify-end"
          >
            <div
              className="w-full rounded-t bg-blue-500"
              style={{ height: `${barHeight}%` }}
              aria-hidden="true"
            />
            <span className="mt-1 block text-[10px] text-gray-500 truncate max-w-full">
              {point.label.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default TimeSeriesChart;

