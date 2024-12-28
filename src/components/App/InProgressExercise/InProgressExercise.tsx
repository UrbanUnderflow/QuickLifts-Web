import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ExerciseLog, Exercise } from '../../../api/firebase/exercise/types';

interface InProgressExerciseProps {
  exercises: ExerciseLog[];
  currentExerciseIndex: number;
  onComplete: () => void; // callback from parent to go to next exercise
  onClose: () => void;    // callback to close the workout
}

const getScreenTime = (exercise: Exercise): number => {
  // Return the screenTime if present, otherwise default to 0
  return exercise.category.details?.screenTime ?? 0;
};

const InProgressExercise: React.FC<InProgressExerciseProps> = ({
  exercises,
  currentExerciseIndex,
  onComplete,
  onClose,
}) => {
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
    const { videos, currentVideoPosition } = currentExercise;
    return videos[currentVideoPosition]?.videoURL || '';
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
                key={exerciseLog.id}
                className={`relative w-10 h-10 rounded-full overflow-hidden border-2 
                  ${
                    idx === currentExerciseIndex
                      ? 'border-[#E0FE10]'           // current exercise
                      : idx < currentExerciseIndex
                      ? 'border-zinc-600'           // past exercises
                      : 'border-zinc-400'           // future exercises
                  }`}
              >
                {exerciseLog.isCompleted ? (
                  <div className="bg-[#E0FE10] w-full h-full flex items-center justify-center">
                    <span className="text-black">✓</span>
                  </div>
                ) : (
                  <img
                    src={exerciseLog.exercise.videos[0]?.gifURL}
                    alt={exerciseLog.exercise.name}
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