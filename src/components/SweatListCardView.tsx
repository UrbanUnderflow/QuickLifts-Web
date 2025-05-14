import React from 'react';
import { ExerciseLog } from '../api/firebase/exercise/types';
import { Clock } from 'lucide-react';

interface SweatListCardViewProps {
  key: string;
  log: ExerciseLog;
  gifUrls?: string[]; // Added gifUrls as an optional prop
}

const SweatListCardView: React.FC<SweatListCardViewProps> = ({ log }) => {
  const videoUrl = log.exercise?.videos && log.exercise.videos.length > 0
    ? log.exercise.videos[log.exercise.currentVideoPosition || 0]?.videoURL
    : undefined;

  // Add detailed logging of the incoming log object
  console.log("Incoming Exercise Log:", JSON.stringify({
    name: log.exercise?.name,
    category: log.exercise?.category,
    details: log.exercise?.category?.details,
    type: log.exercise?.category?.type,
    fullCategory: log.exercise?.category
  }, null, 2));

  const calculateScreenTime = (log: ExerciseLog) => {
    const screenTime = log.exercise?.category?.details?.screenTime;
    console.log("Raw screenTime calculation:", JSON.stringify({
      exerciseName: log.exercise?.name,
      screenTime,
      categoryType: log.exercise?.category?.type,
      fullDetails: log.exercise?.category?.details
    }, null, 2));
    
    if (screenTime && screenTime > 0) {
      const minutes = Math.floor(screenTime / 60);
      const seconds = screenTime % 60;
      const formattedTime = seconds > 0 ? 
        `${minutes}:${seconds.toString().padStart(2, '0')}` : 
        `${minutes}:00`;
      
      console.log("Formatted screen time:", formattedTime);
      return formattedTime;
    }
    
    if (log.exercise?.category?.type === 'cardio') {
      return `${log.exercise.category.details?.duration || 60}:00`;
    }
    return '8:00';
  };

  const screenTime = calculateScreenTime(log);
  console.log('Calculated Screen Time:', screenTime);

  return (
    <div className="flex bg-black-800 bg-opacity-50 rounded-lg h-24 mb-4 overflow-hidden">
      {log.exercise?.videos?.length && videoUrl ? (
        <div className="relative w-24 h-24 overflow-hidden">
          <video
            src={videoUrl}
            className="object-cover w-full h-full"
            muted
            autoPlay
            loop
          />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/60 to-transparent" />
        </div>
      ) : (
        <div className="w-24 h-24 bg-gray-600 flex items-center justify-center">
          <span className="text-white text-xs">No video</span>
        </div>
      )}
      
      <div className="flex flex-col justify-center ml-4 flex-grow">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">
            {log.exercise?.name || 'Unknown Exercise'}
          </h3>
          {screenTime && screenTime !== '8:00' && (
            <Clock className="w-4 h-4 text-white" />
          )} 
        </div>
        
        <div className="flex items-center gap-4 mt-1">
          {screenTime && screenTime !== '8:00' ? (
            // Show screen time if it exists
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#E0FE10]" />
              <span className="text-sm text-[#E0FE10]">
                {screenTime}
              </span>
            </div>
          ) : (
            // Show sets and reps if no screen time
            <>
              {log.exercise?.category?.type === 'weight-training' && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#E0FE10]">
                      {log.exercise?.category?.details?.sets || 3} sets
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#E0FE10]">
                      {log.exercise?.category?.details?.reps?.[0] || "12"} reps
                    </span>
                  </div>
                </div>
              )}
              {log.exercise?.category?.type === 'cardio' && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#E0FE10]" />
                  <span className="text-sm text-[#E0FE10]">
                    {log.exercise?.category?.details?.duration || 0} seconds
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SweatListCardView;