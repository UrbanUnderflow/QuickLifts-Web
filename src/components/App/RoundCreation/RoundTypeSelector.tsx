import React from 'react';
import { X, ChevronRight, Dumbbell, Flame } from 'lucide-react';
import { RoundType, RoundTypeInfo } from '../../../api/firebase/workout/types';

interface RoundTypeSelectorProps {
  onClose: () => void;
  onSelectType: (roundType: RoundType) => void;
}

// Custom icons for each round type
const RoundTypeIcons: Record<RoundType, React.ReactNode> = {
  [RoundType.Lift]: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
    </svg>
  ),
  [RoundType.Run]: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
    </svg>
  ),
  [RoundType.Stretch]: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 3c0 .55.45 1 1 1h3c2.21 0 4 1.79 4 4v3h-3l4 4 4-4h-3V8c0-3.31-2.69-6-6-6H7c-.55 0-1 .45-1 1z"/>
      <path d="M18 21c0-.55-.45-1-1-1h-3c-2.21 0-4-1.79-4-4v-3h3l-4-4-4 4h3v3c0 3.31 2.69 6 6 6h3c.55 0 1-.45 1-1z"/>
    </svg>
  ),
  [RoundType.FatBurn]: (
    <Flame className="w-8 h-8" />
  )
};

const RoundTypeSelector: React.FC<RoundTypeSelectorProps> = ({ onClose, onSelectType }) => {
  const handleTypeSelect = (roundType: RoundType) => {
    const info = RoundTypeInfo[roundType];
    if (!info.isAvailable) {
      // Could show a toast here for coming soon
      return;
    }
    onSelectType(roundType);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 sm:px-6">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-zinc-900 min-h-screen sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="p-6 pb-2">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          >
            <X className="text-white" size={20} />
          </button>

          <div className="mt-6 mb-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              Create a Round
            </h1>
            <p className="mt-2 text-zinc-400 text-base sm:text-lg">
              What type of round do you want to create?
            </p>
          </div>
        </div>

        {/* Round Type Cards */}
        <div className="flex-1 p-6 pt-4 overflow-y-auto">
          <div className="space-y-4">
            {Object.values(RoundType).map((roundType) => {
              const info = RoundTypeInfo[roundType];
              const isAvailable = info.isAvailable;
              
              return (
                <button
                  key={roundType}
                  onClick={() => handleTypeSelect(roundType)}
                  disabled={!isAvailable}
                  className={`
                    w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all
                    ${isAvailable 
                      ? 'bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer' 
                      : 'bg-zinc-800/30 cursor-not-allowed opacity-60'
                    }
                  `}
                  style={{
                    borderWidth: 1,
                    borderColor: isAvailable ? `${info.color}30` : 'transparent'
                  }}
                >
                  {/* Icon */}
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ 
                      backgroundColor: `${info.color}20`,
                      color: isAvailable ? info.color : '#6B7280'
                    }}
                  >
                    {RoundTypeIcons[roundType]}
                  </div>

                  {/* Text Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-lg ${isAvailable ? 'text-white' : 'text-zinc-500'}`}>
                        {info.displayName}
                      </span>
                      {!isAvailable && (
                        <span 
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{ 
                            backgroundColor: `${info.color}20`,
                            color: info.color
                          }}
                        >
                          Soon
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${isAvailable ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {info.description}
                    </p>
                  </div>

                  {/* Arrow */}
                  {isAvailable && (
                    <ChevronRight className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundTypeSelector;
