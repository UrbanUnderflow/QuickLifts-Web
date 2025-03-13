import React from 'react';

interface ProgressBarProps {
  progress: number;
  label?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label }) => {
  const percentage = Math.min(Math.round(progress * 100), 100);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-zinc-300">{percentage}%</span>
        {label && <span className="text-sm text-zinc-300">{label}</span>}
      </div>
      <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-[#E0FE10] transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;