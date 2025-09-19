import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ExerciseLog, Exercise } from '../../../api/firebase/exercise/types';
import Modal from '../../../components/Modal';

interface InProgressExerciseProps {
  exercises: ExerciseLog[];
  currentExerciseLogs: ExerciseLog[];
  currentExerciseIndex: number;
  onComplete: () => void;
  onClose: () => void;
  onExerciseSelect: (index: number) => void;
}

const InProgressExercise: React.FC<InProgressExerciseProps> = ({
  exercises,
  currentExerciseLogs,
  currentExerciseIndex,
  onComplete,
  onClose,
  onExerciseSelect,
}) => {
  // Initial validation
  if (!exercises || exercises.length === 0) {
    return (
      <div className="fixed inset-0 bg-zinc-900 flex items-center justify-center">
        <p className="text-white">No exercises available</p>
        <button onClick={onClose} className="mt-4 bg-[#E0FE10] text-black px-4 py-2 rounded">
          Close Workout
        </button>
      </div>
    );
  }

  if (currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
    return (
      <div className="fixed inset-0 bg-zinc-900 flex items-center justify-center">
        <p className="text-white">Invalid exercise selection</p>
        <button onClick={onClose} className="mt-4 bg-[#E0FE10] text-black px-4 py-2 rounded">
          Close Workout
        </button>
      </div>
    );
  }

  // Current exercise data
  const currentExerciseLog = currentExerciseLogs[currentExerciseIndex];
  const currentExercise = currentExerciseLog?.exercise;

  if (!currentExercise) {
    return (
      <div className="fixed inset-0 bg-zinc-900 flex items-center justify-center">
        <p className="text-white">Exercise data is missing</p>
        <button onClick={onClose} className="mt-4 bg-[#E0FE10] text-black px-4 py-2 rounded">
          Close Workout
        </button>
      </div>
    );
  }

  // Timer state management with useState callbacks to ensure proper initialization
  const [isPaused, setIsPaused] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentScreenTime, setCurrentScreenTime] = useState(() => {
    return currentExercise?.category?.details?.screenTime ?? 60;
  });
  const [timeRemaining, setTimeRemaining] = useState(() => {
    return currentExercise?.category?.details?.screenTime ?? 60;
  });
  const [isCompleting, setIsCompleting] = useState(false);

  // Reset timer and completion guard when exercise changes
  useEffect(() => {
    const screenTimeValue = currentExercise?.category?.details?.screenTime;
    const newScreenTime = screenTimeValue ?? 60;
    console.log(`[InProgressExercise Effect] Exercise index changed to ${currentExerciseIndex}. Read screenTime value: ${screenTimeValue}. Using: ${newScreenTime}`);
    console.log('[InProgressExercise Effect] Current exercise object:', currentExercise);
    setCurrentScreenTime(newScreenTime);
    setTimeRemaining(newScreenTime);
    setIsPaused(false);
    setIsCompleting(false);
  }, [currentExercise, currentExerciseIndex]);

  // Timer effect
  useEffect(() => {
    console.log("Timer state:", {
      timeRemaining,
      isPaused,
      isCompleting,
      screenTime: currentScreenTime,
      exercise: currentExercise.name
    });

    if (isPaused || isCompleting) return;

    // If screenTime is 0 or less, just pause the timer (don't auto-complete)
    if (currentScreenTime <= 0) {
      console.log(`[InProgressExercise Timer Effect] screenTime is ${currentScreenTime}, pausing timer.`);
      setIsPaused(true);
      return;
    }

    // If time has run out, just pause the timer (don't auto-complete)
    if (timeRemaining <= 0) {
      console.log('[InProgressExercise Timer Effect] Time reached 0, pausing timer. User must manually complete.');
      setIsPaused(true);
      return;
    }

    // Otherwise, decrement the timer
    const timerId = setInterval(() => {
      setTimeRemaining((prev: number) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeRemaining, isPaused, isCompleting, currentScreenTime, onComplete, currentExercise.name]);

  // Video URL handling
  const getCurrentVideoUrl = (): string => {
    const videos = currentExercise?.videos || [];
    if (videos.length === 0) return '';
    
    const videoPosition = Math.min(
      currentExercise?.currentVideoPosition ?? 0, 
      videos.length - 1
    );
    return videos[videoPosition]?.videoURL || '';
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
                      {/* Simple countdown timer */}
                      <div className="text-center">
                        <span className="text-[#E0FE10] text-3xl font-bold">
                          {timeRemaining}
                        </span>
                        <p className="text-zinc-400 text-sm">seconds</p>
                      </div>

                      {currentScreenTime > 0 && (
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
                    {/* Simple countdown timer */}
                    <div className="text-center">
                      <span className="text-[#E0FE10] text-2xl font-bold">
                        {timeRemaining}
                      </span>
                      <p className="text-zinc-400 text-xs">seconds</p>
                    </div>

                    {currentScreenTime > 0 && (
                      <button 
                        onClick={() => setIsPaused(!isPaused)}
                        className="bg-black/30 hover:bg-black/50 p-3 rounded-xl border border-[#E0FE10]/20 backdrop-blur-sm"
                      >
                        {isPaused ? (
                          <svg className="w-6 h-6 text-[#E0FE10]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-[#E0FE10]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
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
            onClick={() => setIsModalOpen(true)}  // Changed from onClose
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
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
                  onClick={() => {
                    console.log(`[InProgressExercise SideList] Clicked item index: ${idx}`);
                    onExerciseSelect(idx);
                  }}
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
                        exerciseLog.exercise?.videos?.[0]?.gifURL ? (
                          <img
                            src={exerciseLog.exercise.videos[0].gifURL}
                            alt={exerciseLog.exercise?.name || 'Exercise'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // If image fails, render placeholder div instead (handled by parent logic now)
                              (e.target as HTMLImageElement).style.display = 'none'; 
                              // Optionally add a class to the parent div to show placeholder
                            }}
                          />
                        ) : (
                          // Render placeholder if no gifURL
                          <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                            <span className="text-white font-medium text-lg">
                              {exerciseLog.exercise?.name?.charAt(0).toUpperCase() || 'E'}
                            </span>
                          </div>
                        )
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
                    exerciseLog.exercise?.videos?.[0]?.gifURL ? (
                      <img
                        src={exerciseLog.exercise.videos[0].gifURL}
                        alt={exerciseLog.exercise?.name || 'Exercise'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            // If image fails, render placeholder div instead (handled by parent logic now)
                            (e.target as HTMLImageElement).style.display = 'none'; 
                            // Optionally add a class to the parent div to show placeholder
                        }}
                      />
                    ) : (
                       // Render placeholder if no gifURL
                       <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                            {exerciseLog.exercise?.name?.charAt(0).toUpperCase() || 'E'}
                        </span>
                       </div>
                    )
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cancel Workout"
        message="Are you sure you want to cancel this workout? All progress will be lost."
        primaryButtonText="Yes, Cancel Workout"
        secondaryButtonText="No, Continue"
        onPrimaryAction={() => {
          onClose();
          setIsModalOpen(false);
        }}
        onSecondaryAction={() => setIsModalOpen(false)}
        theme="dark"
      />
    </div>
   );
};

export default InProgressExercise;