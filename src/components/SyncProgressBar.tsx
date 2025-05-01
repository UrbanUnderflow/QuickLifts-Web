import React from 'react';

interface SyncProgressBarProps {
  isVisible: boolean;
  statusText: string;
  progress: number; // Percentage 0-100
  processedCount: number;
  totalCount: number;
  itemLabel?: string; // e.g., "Users", "Items", "Sessions"
  error?: string | null;
}

const SyncProgressBar: React.FC<SyncProgressBarProps> = ({
  isVisible,
  statusText,
  progress,
  processedCount,
  totalCount,
  itemLabel = 'Items', // Default label
  error = null,
}) => {
  if (!isVisible) {
    return null;
  }

  const displayProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <>
      {/* Add animation styles scoped to this component or ensure they are global */}
      <style jsx>{`
        @keyframes progressAnimation {
          from { background-position: 0 0; }
          to { background-position: 50px 50px; }
        }
        .animated-progress {
          background-size: 50px 50px;
          background-image: linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.15) 25%,
            transparent 25%,
            transparent 50%,
            rgba(255, 255, 255, 0.15) 50%,
            rgba(255, 255, 255, 0.15) 75%,
            transparent 75%,
            transparent
          );
          animation: progressAnimation 1.5s linear infinite;
        }
      `}</style>

      <div className="mt-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-blue-300">{statusText}</span>
          <span className="text-xs font-medium text-[#d7ff00]">{displayProgress}%</span>
        </div>
        <div className="w-full bg-[#262a30] rounded-full h-2 mb-1 overflow-hidden"> {/* Added overflow-hidden */}
          <div
            className={`h-2 rounded-full transition-all duration-500 ease-out animated-progress ${error ? 'bg-red-600' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]'}`}
            style={{ width: `${displayProgress}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-400">
           {itemLabel}: {processedCount}/{totalCount}
        </div>
      </div>
    </>
  );
};

export default SyncProgressBar; 