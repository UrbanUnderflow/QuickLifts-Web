import React from 'react';
import { ExerciseLog } from '../api/firebase/exercise/types';
import { Timer, Repeat, Dumbbell } from 'lucide-react';

interface SweatListCardViewProps {
  key: string;
  log: ExerciseLog;
  gifUrls?: string[];
  index?: number;
}

const SweatListCardView: React.FC<SweatListCardViewProps> = ({ log, index = 0 }) => {
  const videoUrl = log.exercise?.videos && log.exercise.videos.length > 0
    ? log.exercise.videos[log.exercise.currentVideoPosition || 0]?.videoURL
    : undefined;

  const gifUrl = log.exercise?.videos && log.exercise.videos.length > 0
    ? log.exercise.videos[log.exercise.currentVideoPosition || 0]?.gifURL
    : undefined;

  const thumbnailUrl = log.exercise?.videos && log.exercise.videos.length > 0
    ? log.exercise.videos[log.exercise.currentVideoPosition || 0]?.thumbnail
    : undefined;

  // Calculate screen time for timed exercises
  const calculateScreenTime = (log: ExerciseLog) => {
    const screenTime = log.exercise?.category?.details?.screenTime;
    
    if (screenTime && screenTime > 0) {
      const minutes = Math.floor(screenTime / 60);
      const seconds = screenTime % 60;
      return seconds > 0 
        ? `${minutes}:${seconds.toString().padStart(2, '0')}` 
        : `${minutes}:00`;
    }
    
    if (log.exercise?.category?.type === 'cardio') {
      const duration = log.exercise.category.details?.duration || 60;
      return `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;
    }
    return null;
  };

  const screenTime = calculateScreenTime(log);
  const isTimedExercise = screenTime !== null;
  const sets = log.exercise?.category?.details?.sets || log.exercise?.sets || 3;
  const reps = log.exercise?.category?.details?.reps?.[0] || log.exercise?.reps || 12;

  // Subtle accent color
  const accentColor = '#E0FE10';

  return (
    <div className="group py-4 first:pt-3 last:pb-3">
      {/* Card Content */}
      <div className="flex items-center gap-4">
        {/* Exercise Number Badge */}
        <div 
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
          style={{ 
            backgroundColor: `${accentColor}15`,
            border: `1px solid ${accentColor}25`,
            color: accentColor
          }}
        >
          {index + 1}
        </div>
        
        {/* Thumbnail Container */}
        <div className="relative w-16 h-16 lg:w-20 lg:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
          {gifUrl || videoUrl || thumbnailUrl ? (
            <>
              {gifUrl ? (
                <img
                  src={gifUrl}
                  alt={log.exercise?.name}
                  className="object-cover w-full h-full"
                />
              ) : videoUrl ? (
                <video
                  src={videoUrl}
                  className="object-cover w-full h-full"
                  muted
                  autoPlay
                  loop
                  playsInline
                />
              ) : thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={log.exercise?.name}
                  className="object-cover w-full h-full"
                />
              ) : null}
            </>
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-zinc-600" />
            </div>
          )}
        </div>
        
        {/* Exercise Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm lg:text-base truncate">
            {log.exercise?.name || 'Unknown Exercise'}
          </h3>
          
          {/* Stats Row */}
          <div className="flex items-center gap-2 mt-1.5">
            {isTimedExercise ? (
              // Timed exercise badge
              <div 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{
                  backgroundColor: `${accentColor}12`,
                  border: `1px solid ${accentColor}20`,
                  color: accentColor
                }}
              >
                <Timer className="w-3 h-3" />
                <span>{screenTime}</span>
              </div>
            ) : (
              // Sets & Reps badges
              <>
                <div 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `${accentColor}12`,
                    border: `1px solid ${accentColor}20`,
                    color: accentColor
                  }}
                >
                  <span>{sets} sets</span>
                </div>
                <div 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `${accentColor}12`,
                    border: `1px solid ${accentColor}20`,
                    color: accentColor
                  }}
                >
                  <Repeat className="w-2.5 h-2.5" />
                  <span>{reps} reps</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SweatListCardView;
