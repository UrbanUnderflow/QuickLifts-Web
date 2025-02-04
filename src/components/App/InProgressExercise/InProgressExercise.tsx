import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ExerciseLog, Exercise } from '../../../api/firebase/exercise/types';

interface InProgressExerciseProps {
  exercises: ExerciseLog[];
  currentExerciseLogs: ExerciseLog[];
  currentExerciseIndex: number;
  onComplete: () => void; // callback from parent to go to next exercise
  onClose: () => void;    // callback to close the workout
  onExerciseSelect: (index: number) => void; // Add this
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
  onExerciseSelect,
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
  const currentExerciseLog = currentExerciseLogs[currentExerciseIndex];
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

  // At the top of the component, after validations:
  console.log('Exercise Logs Debug:', currentExerciseLogs.map(log => ({
    exerciseName: log.exercise?.name,
    isCompleted: log.isCompleted,
    logSubmitted: log.logSubmitted,
    exercise: log.exercise
  })));

  // Timer state management
  const screenTime = getScreenTime(currentExercise);
  const [timeRemaining, setTimeRemaining] = useState(screenTime);
  const [isPaused, setIsPaused] = useState(false);

  // Reset timer when exercise changes
  useEffect(() => {
    setTimeRemaining(getScreenTime(currentExercise));
  }, [currentExercise]);

  // Countdown logic
  useEffect(() => {
    // Only run timer if there's actually a screen time set
    if (screenTime <= 0) return;
  
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
  }, [timeRemaining, isPaused, onComplete, screenTime]);

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
      <div className="relative flex h-full">
        <div className="w-full lg:w-2/3 relative bg-black">
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="w-[700px] h-[900px] relative rounded-2xl overflow-hidden">
              <video
                src={getCurrentVideoUrl()}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                onError={(e) => console.error('Video error:', e)}
              />
   
              {/* Desktop Controls */}
              <div className="hidden lg:block absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent">
                <div className="p-8">
                  <h2 className="text-white text-3xl font-bold mb-4">
                    {currentExercise?.name || 'Exercise'}
                  </h2>
   
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <span className="text-[#E0FE10] text-lg font-bold">
                        {Math.floor((screenTime - timeRemaining) / 60)}m
                      </span>
                      <p className="text-zinc-400 text-sm">elapsed</p>
                    </div>
   
                    {screenTime > 0 && (
                      <button 
                        onClick={() => setIsPaused(!isPaused)}
                        className="bg-black/30 hover:bg-black/50 p-4 rounded-xl border border-[#E0FE10]/20 backdrop-blur-sm transition-all duration-200 group"
                      >
                        {isPaused ? (
                          <svg className="w-6 h-6 text-[#E0FE10] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-[#E0FE10] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    )}
   
                    <div className="text-center">
                      <span className="text-[#E0FE10] text-lg font-bold">
                        {currentExerciseIndex + 1}/{currentExerciseLogs.length}
                      </span>
                      <p className="text-zinc-400 text-sm">exercises</p>
                    </div>
                  </div>
                </div>
              </div>
   
              {/* Mobile Controls */}
              <div className="lg:hidden absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 to-transparent">
                <div className="p-4 flex items-center justify-between">
                  <div className="text-center">
                    <span className="text-[#E0FE10] text-lg font-bold">
                      {Math.floor((screenTime - timeRemaining) / 60)}m
                    </span>
                    <p className="text-zinc-400 text-xs">elapsed</p>
                  </div>
   
                  {screenTime > 0 && (
                    <button 
                      onClick={() => setIsPaused(!isPaused)}
                      className="bg-black/30 hover:bg-black/50 p-3 rounded-xl border border-[#E0FE10]/20 backdrop-blur-sm"
                    >
                      {/* Same SVGs as desktop */}
                    </button>
                  )}
   
                  <div className="text-center">
                    <span className="text-[#E0FE10] text-lg font-bold">
                      {currentExerciseIndex + 1}/{currentExerciseLogs.length}
                    </span>
                    <p className="text-zinc-400 text-xs">exercises</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
   
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
          >
            <X className="text-white" size={20} />
          </button>
        </div>
   
        {/* Right side panel */}
        <div className="hidden lg:flex lg:w-1/3 p-6">
          <div className="w-full bg-black/50 rounded-2xl p-6 flex flex-col">
            <h2 className="text-white text-2xl font-bold mb-6">Workout Progress</h2>
            <div className="flex-1 overflow-y-auto pr-2">
              {currentExerciseLogs.map((exerciseLog, idx) => (
                <div 
                  key={exerciseLog.id || idx}
                  onClick={() => onExerciseSelect(idx)}
                  className={`mb-4 p-4 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors ${
                    idx === currentExerciseIndex 
                      ? 'bg-[#E0FE10]/10 border border-[#E0FE10]' 
                      : 'bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full overflow-hidden border-2 
                      ${idx === currentExerciseIndex 
                        ? 'border-[#E0FE10]' 
                        : idx < currentExerciseIndex 
                        ? 'border-zinc-600' 
                        : 'border-zinc-400'
                      }`}
                    >
                      {exerciseLog.logSubmitted ? (
                        <div className="bg-[#E0FE10] w-full h-full flex items-center justify-center">
                          <span className="text-black">✓</span>
                        </div>
                      ) : (
                        <img
                          src={exerciseLog.exercise?.videos?.[0]?.gifURL || '/placeholder-exercise.gif'}
                          alt={exerciseLog.exercise?.name || 'Exercise'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-exercise.gif';
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{exerciseLog.exercise?.name}</p>
                      <p className="text-zinc-400 text-sm">
                        {exerciseLog.logSubmitted ? 'Completed' : 'Pending'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={onComplete}
              className="w-full bg-[#E0FE10] text-black px-8 py-3 rounded-full font-medium hover:bg-[#E0FE10]/90 transition-colors mt-4"
            >
              Complete Move
            </button>
          </div>
        </div>
   
        {/* Mobile bubbles and button */}
        <div className="lg:hidden absolute bottom-0 left-0 right-0 flex flex-col items-center py-10 space-y-4 z-20">
          <h2 className="text-white text-2xl font-bold mb-2">
            {currentExercise?.name || ''}
          </h2>
          <div className="px-4 overflow-x-auto">
            <div className="flex gap-2 w-fit">
              {currentExerciseLogs.map((exerciseLog, idx) => (
                <div
                  key={exerciseLog.id || idx}
                  onClick={() => onExerciseSelect(idx)}
                  className={`flex-shrink-0 relative w-10 h-10 rounded-full overflow-hidden border-2 
                    ${idx === currentExerciseIndex 
                      ? 'border-[#E0FE10]'
                      : idx < currentExerciseIndex
                      ? 'border-zinc-600'
                      : 'border-zinc-400'
                    }`}
                >
                  {exerciseLog.logSubmitted ? (
                    <div className="bg-[#E0FE10] w-full h-full flex items-center justify-center">
                      <span className="text-black">✓</span>
                    </div>
                  ) : (
                    <img
                      src={exerciseLog.exercise?.videos?.[0]?.gifURL || '/placeholder-exercise.gif'}
                      alt={exerciseLog.exercise?.name || 'Exercise'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-exercise.gif';
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onComplete}
            className="bg-[#E0FE10] text-black px-8 py-3 rounded-full font-medium hover:bg-[#E0FE10]/90 transition-colors"
          >
            Complete Move
          </button>
        </div>
      </div>
    </div>
   );
};

export default InProgressExercise;