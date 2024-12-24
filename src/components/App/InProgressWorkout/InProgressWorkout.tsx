import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ExerciseLog, Exercise } from '../../../api/firebase/exercise/types';



interface InProgressExerciseProps {
  exercises: ExerciseLog[];
  currentExerciseIndex: number;
  onComplete: () => void;
  onClose: () => void;
}

const getScreenTime = (exercise: Exercise): number => {
    switch (exercise.category.type) {
      case 'weightTraining':
        return exercise.category.details?.screenTime ?? 0;
      case 'cardio':
        return exercise.category.details?.screenTime ?? 0;
      default:
        return 0;
    }
  };

const InProgressExercise: React.FC<InProgressExerciseProps> = ({
    exercises,
    currentExerciseIndex,
    onComplete,
    onClose,
  }) => {
    const currentExercise = exercises[currentExerciseIndex].exercise;
    const [timeRemaining, setTimeRemaining] = useState<number>(
      getScreenTime(currentExercise)
    );
    const [isPaused, setIsPaused] = useState(false);
  
    // Reset timer when exercise changes
    useEffect(() => {
      setTimeRemaining(getScreenTime(currentExercise));
    }, [currentExerciseIndex, currentExercise]);
  
    useEffect(() => {
      if (timeRemaining === 0) {
        if (currentExerciseIndex < exercises.length - 1) {
          onComplete();
        }
        return;
      }
  
      if (!isPaused) {
        const timer = setInterval(() => {
          setTimeRemaining((prev) => prev - 1);
        }, 1000);
  
        return () => clearInterval(timer);
      }
    }, [timeRemaining, isPaused, currentExerciseIndex, exercises.length, onComplete]);
  
    // Get current video URL based on category
    const getCurrentVideoUrl = (): string => {
      const selectedVideo = (() => {
        switch (currentExercise.category.type) {
          case 'weightTraining':
            return currentExercise.category.details?.selectedVideo;
          case 'cardio':
            return currentExercise.category.details?.selectedVideo;
          default:
            return undefined;
        }
      })();
  
      return selectedVideo?.videoURL || 
             currentExercise.videos[currentExercise.currentVideoPosition]?.videoURL || 
             '';
    };
  
    return (
      <div className="fixed inset-0 bg-zinc-900 flex flex-col">
        {/* Video Background */}
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
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="text-white"
            >
              {isPaused ? "▶️" : "⏸️"}
            </button>
            <span className="text-white font-mono text-2xl">
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
  
          {/* Exercise Navigation Bubbles */}
          <div className="absolute bottom-8 left-0 right-0">
            <div className="flex justify-center gap-2 px-4 overflow-x-auto">
              {exercises.map((exerciseLog, index) => (
                <div
                  key={exerciseLog.id}
                  className={`relative w-10 h-10 rounded-full overflow-hidden border-2 
                    ${index === currentExerciseIndex ? 'border-[#E0FE10]' : 
                      index < currentExerciseIndex ? 'border-zinc-600' : 'border-zinc-400'}`}
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
  
          {/* Close Button */}
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