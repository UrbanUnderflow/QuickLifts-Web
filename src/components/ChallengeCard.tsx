import { StarIcon, EllipsisVerticalIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';


// components/ChallengeCard.tsx
export interface ChallengeCardProps {
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    isPublished: boolean;
    onSelect: () => void;
    onSettings?: () => void;
  }

export const ChallengeCard: React.FC<ChallengeCardProps> = ({
    title,
    description,
    startDate,
    endDate,
    isPublished,
    onSelect,
    onSettings
  }) => {
    return (
      <button 
        onClick={onSelect}
        className="w-full bg-gradient-to-br from-zinc-900 to-zinc-900/95 rounded-2xl p-4"
      >
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/15 rounded-full">
            <StarIcon className="w-7 h-7 text-white" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold">{title}</h3>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                isPublished ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'
              }`}>
                {isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
            <p className="text-white/70 text-sm line-clamp-2">{description}</p>
          </div>
  
          {onSettings && (
            <button onClick={(e) => { e.stopPropagation(); onSettings(); }}>
              <EllipsisVerticalIcon className="w-5 h-5 text-white/70" />
            </button>
          )}
        </div>
  
        <div className="mt-4 grid grid-cols-2 gap-5">
          <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-3">
            <CalendarDaysIcon className="w-4 h-4 text-white" />
            <div>
              <p className="text-xs text-white/50">Starts</p>
              <p className="text-sm text-white">
                {startDate.toLocaleDateString()}
              </p>
            </div>
          </div>
  
          <div className="flex items-center gap-3 bg-zinc-800 rounded-xl p-3">
            <CalendarDaysIcon className="w-4 h-4 text-white" />
            <div>
              <p className="text-xs text-white/50">Ends</p>
              <p className="text-sm text-white">
                {endDate.toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </button>
    );
  };