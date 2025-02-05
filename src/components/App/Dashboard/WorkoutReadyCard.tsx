// components/WorkoutReadyCard.tsx
import React from 'react';
import { Workout } from '../../../api/firebase/workout/types';
import { Play, X, Clock, Dumbbell } from 'lucide-react';

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

// For WorkoutReadyCard
export interface WorkoutReadyCardProps {
    workout: Workout;
    onStart: () => Promise<void>;   // Update to allow both sync and async
    onCancel: () => void
}

const WorkoutReadyCard: React.FC<WorkoutReadyCardProps> = ({ workout, onStart, onCancel }) => {
  return (
    <div className="bg-zinc-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-[#E0FE10] text-sm font-medium">Ready to start</div>
              <h3 className="text-white font-bold text-xl">
                {workout.title}
              </h3>
            </div>
            
            {/* Stats row */}
            <div className="flex gap-4 items-center">
              <StatView
                icon={<Dumbbell className="w-4 h-4 text-zinc-400" />}
                value={workout.logs?.length.toString() || "0"}
                label="exercises"
              />
              <StatView
                icon={<Clock className="w-4 h-4 text-zinc-400" />}
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

      {/* Preview section */}
      <div className="px-4 py-2 flex gap-2">
        {workout.logs?.slice(0, 3).map((log, index) => (
          <div 
            key={index}
            className="w-[70px] h-[80px] rounded-xl overflow-hidden bg-zinc-800 relative group"
          >
            <img
              src={log.exercise.videos?.[0]?.gifURL || '/placeholder-exercise.gif'}
              alt={log.exercise.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-xs text-white text-center px-2">
                {log.exercise.name}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="p-4 flex gap-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-500 font-medium text-sm hover:bg-red-500/30 transition-colors"
        >
          <X size={16} />
          Cancel
        </button>

        <button
          onClick={onStart}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#E0FE10] text-black font-medium text-sm hover:bg-[#E0FE10]/90 transition-colors"
        >
          <Play size={16} />
          Start Workout
        </button>
      </div>
    </div>
  );
};

export default WorkoutReadyCard;