// components/InProgressCard.tsx
import React from 'react';
import { Workout } from '../../../api/firebase/workout';
import { Play, X } from 'lucide-react';

interface StatViewProps {
  icon: React.ReactNode;
  value: string;
  label: string;
}

const StatView: React.FC<StatViewProps> = ({ icon, value, label }) => (
  <div className="flex items-center gap-2 text-zinc-400">
    {icon}
    <div className="flex items-baseline gap-1">
      <span className="text-sm font-medium">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  </div>
);

// For InProgressCard
interface InProgressCardProps {
    workout: Workout;
    onResume: () => void | Promise<void>;  // Update to allow both sync and async
    onCancel: () => void | Promise<void>;
  }

const InProgressCard: React.FC<InProgressCardProps> = ({
  workout,
  onResume,
  onCancel,
}) => {
  return (
    <div className="bg-zinc-900 rounded-xl overflow-hidden">
      {/* Top section with title and stats */}
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <h3 className="text-white font-bold">
              {workout.title}
            </h3>
            
            {/* Stats row */}
            <div className="flex gap-4 items-center">
              <StatView
                icon={<span className="text-lg">🏃</span>}
                value={workout.logs?.length.toString() || "0"}
                label="moves"
              />
              <StatView
                icon={<span className="text-lg">⏰</span>}
                value={workout.duration.toString()}
                label="min"
              />
              <span className="px-3 py-1.5 text-xs bg-[#E0FE10]/20 text-[#E0FE10] rounded-full">
                {workout.zone}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* GIFs section */}
      <div className="px-4 py-2 flex gap-2">
        {workout.logs?.slice(0, 3).map((log, index) => (
          <div 
            key={index}
            className="w-[70px] h-[80px] rounded-xl overflow-hidden bg-zinc-800"
          >
            <img
              src={log.exercise.videos?.[0]?.gifURL || '/placeholder-exercise.gif'}
              alt={log.exercise.name}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* Bottom action buttons */}
      <div className="p-4 flex gap-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-500 font-medium text-sm"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          onClick={onResume}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E0FE10]/20 text-[#E0FE10] font-medium text-sm"
        >
          <Play size={16} />
          Resume
        </button>
      </div>
    </div>
  );
};

export default InProgressCard;