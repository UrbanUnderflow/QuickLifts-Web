import React from 'react';

interface StatCardProps {
  icon?: React.ReactNode; // React element for icon
  value: string | number;
  label: string;
  colorClass?: string; // Tailwind text color class e.g., 'text-primaryGreen'
}

/**
 * Generic small metric card (value + label + optional icon).
 * Tailwind‑styled for dark background.  Uses minimal fixed width so it
 * can be placed inside horizontally scrolling container.
 */
const StatCard: React.FC<StatCardProps> = ({ icon, value, label, colorClass = 'text-white' }) => {
  console.log('[StatCard] render', { label, value });
  return (
    <div className="w-32 p-4 bg-zinc-800 rounded-lg flex flex-col items-center space-y-2">
      {icon && <div className="w-8 h-8 flex items-center justify-center">{icon}</div>}
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-sm text-gray-400 text-center">{label}</div>
    </div>
  );
};

export default StatCard; 