import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ExerciseLog, Exercise } from '../../../api/firebase/exercise/types';

interface InProgressExerciseProps {
  exercises: ExerciseLog[];
  currentExerciseLogs: ExerciseLog[];
  currentExerciseIndex: number;
  onComplete: () => void; // callback from parent to go to next exercise
  onClose: () => void;    // callback to close the workout
}

const getScreenTime = (exercise: Exercise | undefined): number => {
  return exercise?.category?.details?.screenTime ?? 60; // Default to 60 seconds if undefined
};

const InProgressExercise: React.FC<InProgressExerciseProps> = ({
  exercises,
  currentExerciseLogs,
  currentExerciseIndex,
  onComplete,
  onClose,
}) => {
  // Comprehensive initial validation
  if (!exercises || exercises.length === 0) {
    console.error('No exercises provided');
    return (
      <div className="fixed inset-0 bg-zinc-900 flex items-center justify-center">
        <p className="text-white">No exercises available</p>
        <button 
          onClick={onClose} 
          className="mt-4 bg-[#E0FE10] text-black px-4 py-2 rounded"
        >
          Close Workout
        </button>
      </div>
    );
  }

  if (currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
    console.error('Invalid exercise index', { 
      currentExerciseIndex, 
      exercisesLength: exercises.length 
    });
    return (
      <div className="fixed inset-0 bg-zinc-900 flex items-center justify-center">
        <p className="text-white">Invalid exercise selection</p>
        <button 
          onClick={onClose} 
          className="mt-4 bg-[#E0FE10] text-black px-4 py-2 rounded"
        >
          Close Workout
        </button>
      </div>
    );
  }

  // Current exercise log and exercise
  const currentExerciseLog = exercises[currentExerciseIndex];
  const currentExercise = currentExerciseLog?.exercise;

  // Validate current exercise
  if (!currentExercise) {
    console.error('No exercise found at current index', { 
      currentExerciseIndex,
      exerciseLog: currentExerciseLog 
    });
    return (
      <div className="fixed inset-0 bg-zinc-900 flex items-center justify-center">
        <p className="text-white">Exercise data is missing</p>
        <button 
          onClick={onClose} 
          className="mt-4 bg-[#E0FE10] text-black px-4 py-2 rounded"
        >
          Close Workout
        </button>
      </div>
    );
  }

  // Timer state management
  const [timeRemaining, setTimeRemaining] = useState(() =>
    getScreenTime(currentExercise)
  );
  const [isPaused, setIsPaused] = useState(false);

  // Reset timer when exercise changes
  useEffect(() => {
    setTimeRemaining(getScreenTime(currentExercise));
  }, [currentExercise]);

  // Countdown logic
  useEffect(() => {
    // If time is up, move to next exercise
    if (timeRemaining <= 0) {
      onComplete();
      return;
    }

    // Pause check
    if (isPaused) return;

    // Countdown timer
    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);

    // Cleanup
    return () => clearInterval(timer);
  }, [timeRemaining, isPaused, onComplete]);

  // Video URL retrieval with comprehensive error handling
  const getCurrentVideoUrl = (): string => {
    // Detailed logging of exercise and video information
    console.log('Current Exercise Details:', {
      name: currentExercise?.name,
      videos: currentExercise?.videos,
      currentVideoPosition: currentExercise?.currentVideoPosition
    });

    // Comprehensive video retrieval
    const videos = currentExercise?.videos || [];
    
    if (videos.length === 0) {
      console.warn(`No videos found for exercise: ${currentExercise?.name}`);
      return '';
    }

    // Safe video position selection
    const videoPosition = Math.min(
      currentExercise?.currentVideoPosition ?? 0, 
      videos.length - 1
    );

    const videoUrl = videos[videoPosition]?.videoURL || '';
    
    if (!videoUrl) {
      console.warn(`No video URL for exercise ${currentExercise?.name}`);
    }

    return videoUrl;
  };

  return (
    <div className="fixed inset-0 bg-zinc-900 flex flex-col">
      {/* Video Section */}
      <div className="relative flex-1">
        <video
          src={getCurrentVideoUrl()}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          onError={(e) => {
            console.error('Video error:', e);
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"></div>

        {/* Timer Overlay */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 rounded-full px-6 py-2 flex items-center gap-4">
          {/* Pause/Play Toggle */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="text-white"
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>

          {/* Timer Display */}
          <span className="text-white font-mono text-2xl">
            {Math.floor(timeRemaining / 60)}:
            {(timeRemaining % 60).toString().padStart(2, '0')}
          </span>
        </div>

        {/* Exercise Name Section */}
        <div className="absolute bottom-24 left-0 right-0 px-4 z-10">
          <h2 className="text-white text-4xl font-bold">
            {currentExercise?.name || 'Exercise'}
          </h2>
        </div>

        {/* Exercise Navigation Bubbles */}
        <div className="absolute bottom-8 left-0 right-0 z-10">
          <div className="px-4 overflow-x-auto">
            <div className="flex gap-2 w-fit">
              {currentExerciseLogs.map((exerciseLog, idx) => (
                <div
                  key={exerciseLog.id || idx}
                  className={`flex-shrink-0 relative w-10 h-10 rounded-full overflow-hidden border-2 
                    ${
                      idx === currentExerciseIndex
                        ? 'border-[#E0FE10]'
                        : exerciseLog.isCompleted
                        ? 'border-zinc-600'
                        : 'border-zinc-400'
                    }`}
                >
                  {exerciseLog.isCompleted ? (
                    <div className="bg-[#E0FE10] w-full h-full flex items-center justify-center">
                      <span className="text-black">✓</span>
                    </div>
                  ) : (
                    <img
                      src={exerciseLog.exercise?.videos?.[0]?.gifURL || '/placeholder-exercise.gif'}
                      alt={exerciseLog.exercise?.name || 'Exercise'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error(`Error loading GIF for exercise ${idx}:`, e);
                        (e.target as HTMLImageElement).src = '/placeholder-exercise.gif';
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Close (X) Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
        >
          <X className="text-white" size={20} />
        </button>
      </div>
    </div>
  );
};

export default InProgressExercise;