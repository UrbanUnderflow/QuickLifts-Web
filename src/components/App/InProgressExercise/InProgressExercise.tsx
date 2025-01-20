import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ExerciseLog, Exercise } from '../../../api/firebase/exercise/types';

interface InProgressExerciseProps {
  exercises: ExerciseLog[];
  currentExerciseIndex: number;
  onComplete: () => void; // callback from parent to go to next exercise
  onClose: () => void;    // callback to close the workout
}

const getScreenTime = (exercise: Exercise | undefined): number => {
  return exercise?.category?.details?.screenTime ?? 60; // Default to 60 seconds if undefined
};

const InProgressExercise: React.FC<InProgressExerciseProps> = ({
  exercises,
  currentExerciseIndex,
  onComplete,
  onClose,
}) => {
  if (!exercises || exercises.length === 0 || currentExerciseIndex >= exercises.length) {
    console.error('Invalid exercises data or currentExerciseIndex');
    return (
      <div className="fixed inset-0 bg-zinc-900 flex items-center justify-center">
        <p className="text-white">No exercises available</p>
        <button onClick={onClose} className="mt-4 bg-[#E0FE10] text-black px-4 py-2 rounded">
          Close Workout
        </button>
      </div>
    );
  }

  // The current exercise user is doing
  const currentExercise = exercises[currentExerciseIndex].exercise;

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(() =>
    getScreenTime(currentExercise)
  );
  const [isPaused, setIsPaused] = useState(false);

  // Whenever the current exercise changes, reset the timer
  useEffect(() => {
    setTimeRemaining(getScreenTime(currentExercise));
  }, [currentExercise]);

  // Countdown effect
  useEffect(() => {
    // If time is up, tell the parent to move on
    if (timeRemaining <= 0) {
      onComplete();
      return; // Stop further logic in this effect
    }
    // If paused, do nothing
    if (isPaused) return;

    // Otherwise, decrement each second
    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);

    // Cleanup
    return () => clearInterval(timer);
  }, [timeRemaining, isPaused, onComplete]);

  // Return whichever video we want displayed
  const getCurrentVideoUrl = (): string => {
    const { videos, currentVideoPosition } = currentExercise || {};
    return videos?.[currentVideoPosition ?? 0]?.videoURL || '';
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
        />

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

        {/* Exercise Navigation Bubbles */}
        <div className="absolute bottom-8 left-0 right-0">
          <div className="flex justify-center gap-2 px-4 overflow-x-auto">
          {exercises.map((exerciseLog, idx) => (
              <div
                key={exerciseLog.id || idx}
                className={`relative w-10 h-10 rounded-full overflow-hidden border-2 
                  ${
                    idx === currentExerciseIndex
                      ? 'border-[#E0FE10]'
                      : idx < currentExerciseIndex
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
                  />
                )}
              </div>
            ))}
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