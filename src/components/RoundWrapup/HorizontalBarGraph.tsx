import React from 'react';

interface BarData {
  label: string;
  value: number;
}

interface HorizontalBarGraphProps {
  data: BarData[]; // Already sorted or unsorted; we will sort descending by value
  barColorClass?: string; // Tailwind color for bar fill
  valueSuffix?: string; // e.g., 'reps', 'lbs'
  maxBars?: number; // Limit bars displayed
}

/**
 * Simple flex‑based horizontal bar graph (no SVG). Each bar scales based on the
 * largest value. Works well inside dark UI.
 */
const HorizontalBarGraph: React.FC<HorizontalBarGraphProps> = ({
  data,
  barColorClass = 'bg-primaryGreen',
  valueSuffix = '',
  maxBars = 6,
}) => {
  if (!data?.length) return null;
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxBars);
  const maxVal = sorted[0]?.value || 1;

  console.log('[HorizontalBarGraph] render', { data: sorted });

  return (
    <div className="space-y-3 w-full">
      {sorted.map((item, idx) => {
        const widthPct = (item.value / maxVal) * 100;
        return (
          <div key={idx} className="flex items-center space-x-3">
            <div className="w-24 text-xs text-gray-300 truncate">{item.label}</div>
            <div className="flex-1 h-3 bg-zinc-700 rounded">
              <div
                className={`h-3 rounded ${barColorClass}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <div className="w-14 text-right text-xs text-gray-400">
              {Math.round(item.value)} {valueSuffix}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HorizontalBarGraph; 