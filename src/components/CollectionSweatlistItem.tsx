import React from 'react';
import { Workout } from '../api/firebase/workout/types';

interface CollectionSweatlistItemProps {
  workout: Workout; // Expect a workout type, not sweatList
}

const CollectionSweatlistItem: React.FC<CollectionSweatlistItemProps> = ({ workout }) => {
  // Extract the first 3 exercises (or less) for display
  const displayedExercises = workout.exercises.slice(0, 3);

  return (
    <div className="mb-4">
      {/* Workout title */}
      <h3 className="text-xl font-bold text-white">{workout.title}</h3>
      
      {/* Display exercises */}
      <div className="flex space-x-2 mt-2">
        {displayedExercises.map((exerciseRef, index) => {
          const { exercise } = exerciseRef;
          const videoUrl = exercise.videos[exercise.currentVideoPosition ?? 0]?.videoURL;
          
          return (
            <div key={index} className="w-1/3 h-24 relative">
              {videoUrl ? (
                <video
                  src={videoUrl}
                  className="object-cover w-full h-full rounded-lg"
                  muted
                  autoPlay
                  loop
                />
              ) : (
                <div className="w-full h-full bg-gray-600 flex items-center justify-center rounded-lg">
                  <span className="text-white text-xs">No video</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CollectionSweatlistItem;