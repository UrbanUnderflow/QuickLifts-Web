import React, { useEffect, useState } from 'react';
import { X, Play, Pause, CheckCircle2, Dumbbell, Timer, Repeat } from 'lucide-react';
import { ExerciseLog } from '../../../api/firebase/exercise/types';
import Modal from '../../../components/Modal';

interface InProgressExerciseProps {
  exercises: ExerciseLog[];
  currentExerciseLogs: ExerciseLog[];
  currentExerciseIndex: number;
  onComplete: () => void;
  onClose: () => void;
  onExerciseSelect: (index: number) => void;
}

// Chromatic Glass color palette
const accentColor = '#E0FE10';

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
      <div className="fixed inset-0 bg-[#0a0a0b] flex flex-col items-center justify-center p-6">
        <p className="text-white text-lg mb-4">No exercises available</p>
        <button 
          onClick={onClose} 
          className="px-6 py-3 rounded-xl font-medium"
          style={{ backgroundColor: accentColor, color: '#0a0a0b' }}
        >
          Close Workout
        </button>
      </div>
    );
  }

  if (currentExerciseIndex < 0 || currentExerciseIndex >= exercises.length) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0b] flex flex-col items-center justify-center p-6">
        <p className="text-white text-lg mb-4">Invalid exercise selection</p>
        <button 
          onClick={onClose} 
          className="px-6 py-3 rounded-xl font-medium"
          style={{ backgroundColor: accentColor, color: '#0a0a0b' }}
        >
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
      <div className="fixed inset-0 bg-[#0a0a0b] flex flex-col items-center justify-center p-6">
        <p className="text-white text-lg mb-4">Exercise data is missing</p>
        <button 
          onClick={onClose} 
          className="px-6 py-3 rounded-xl font-medium"
          style={{ backgroundColor: accentColor, color: '#0a0a0b' }}
        >
          Close Workout
        </button>
      </div>
    );
  }

  // Timer state management
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
    setCurrentScreenTime(newScreenTime);
    setTimeRemaining(newScreenTime);
    setIsPaused(false);
    setIsCompleting(false);
  }, [currentExercise, currentExerciseIndex]);

  // Timer effect
  useEffect(() => {
    if (isPaused || isCompleting) return;

    if (currentScreenTime <= 0) {
      setIsPaused(true);
      return;
    }

    if (timeRemaining <= 0) {
      setIsPaused(true);
      return;
    }

    const timerId = setInterval(() => {
      setTimeRemaining((prev: number) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeRemaining, isPaused, isCompleting, currentScreenTime]);

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

  // Get exercise info helper
  const getExerciseInfo = (exerciseLog: ExerciseLog) => {
    const exercise = exerciseLog.exercise;
    const screenTime = exercise?.category?.details?.screenTime;
    
    if (screenTime && screenTime > 0) {
      const mins = Math.floor(screenTime / 60);
      const secs = screenTime % 60;
      return { type: 'timed', value: mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s` };
    }
    
    const sets = exercise?.category?.details?.sets || exercise?.sets || 3;
    const reps = exercise?.category?.details?.reps?.[0] || exercise?.reps || 12;
    return { type: 'reps', sets, reps };
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Exercise Card Component
  const ExerciseCard = ({ exerciseLog, index, isActive, isCompleted }: {
    exerciseLog: ExerciseLog;
    index: number;
    isActive: boolean;
    isCompleted: boolean;
  }) => {
    const info = getExerciseInfo(exerciseLog);
    const gifUrl = exerciseLog.exercise?.videos?.[0]?.gifURL;
    
    return (
      <button
        onClick={() => onExerciseSelect(index)}
        className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
          isActive 
            ? 'bg-[#1a1d1f] border border-[#E0FE10]/40' 
            : 'bg-[#141617] border border-transparent hover:border-zinc-700/50'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Thumbnail */}
          <div className={`relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ${
            isActive ? 'ring-2 ring-[#E0FE10]/50' : ''
          }`}>
            {isCompleted ? (
              <div 
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: accentColor }}
              >
                <CheckCircle2 className="w-6 h-6 text-black" />
              </div>
            ) : gifUrl ? (
              <img
                src={gifUrl}
                alt={exerciseLog.exercise?.name || 'Exercise'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-zinc-600" />
              </div>
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm truncate ${isActive ? 'text-white' : 'text-zinc-300'}`}>
              {exerciseLog.exercise?.name || 'Exercise'}
            </p>
            
            {/* Sets/Reps or Time */}
            <div className="flex items-center gap-2 mt-1">
              {isCompleted ? (
                <span className="text-xs font-medium" style={{ color: accentColor }}>Completed</span>
              ) : info.type === 'timed' ? (
                <div className="flex items-center gap-1">
                  <Timer className="w-3 h-3 text-zinc-500" />
                  <span className="text-xs text-zinc-500">{info.value}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span 
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    {info.sets} sets
                  </span>
                  <span 
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    <Repeat className="w-2.5 h-2.5" />
                    {info.reps} reps
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0b] z-50">
      <div className="h-full flex flex-col lg:flex-row">
        
        {/* Left Panel - Video Section */}
        <div className="relative flex-1 lg:h-full bg-black">
          {/* Close Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Video Container */}
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-full h-full lg:max-w-[800px] lg:max-h-[90vh] lg:rounded-2xl overflow-hidden">
              <video
                src={getCurrentVideoUrl()}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />

              {/* Video Overlay - Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <div className="p-6 lg:p-8">
                  {/* Exercise Name */}
                  <h2 className="text-white text-2xl lg:text-3xl font-bold mb-4">
                    {currentExercise?.name || 'Exercise'}
                  </h2>

                  {/* Stats Row */}
                  <div className="flex items-center justify-between">
                    {/* Timer */}
                    <div className="flex items-center gap-4">
                      <div>
                        <span 
                          className="text-3xl lg:text-4xl font-bold"
                          style={{ color: accentColor }}
                        >
                          {formatTime(timeRemaining)}
                        </span>
                        <p className="text-zinc-400 text-sm">remaining</p>
                      </div>

                      {/* Pause/Play Button */}
                      {currentScreenTime > 0 && (
                        <button 
                          onClick={() => setIsPaused(!isPaused)}
                          className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105"
                          style={{ 
                            backgroundColor: `${accentColor}20`,
                            border: `1px solid ${accentColor}40`
                          }}
                        >
                          {isPaused ? (
                            <Play className="w-5 h-5 ml-0.5" style={{ color: accentColor }} fill={accentColor} />
                          ) : (
                            <Pause className="w-5 h-5" style={{ color: accentColor }} fill={accentColor} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Progress Counter */}
                    <div className="text-right">
                      <span 
                        className="text-2xl lg:text-3xl font-bold"
                        style={{ color: accentColor }}
                      >
                        {currentExerciseIndex + 1}/{currentExerciseLogs.length}
                      </span>
                      <p className="text-zinc-400 text-sm">exercises</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: Exercise info, bubbles and Complete button */}
          <div className="lg:hidden absolute bottom-0 left-0 right-0 pb-6 pt-32 bg-gradient-to-t from-black via-black/95 to-transparent">
            {/* Current Exercise Info */}
            <div className="px-4 mb-4 text-center">
              <h3 className="text-white text-lg font-semibold mb-2">
                {currentExercise?.name || 'Exercise'}
              </h3>
              {/* Sets/Reps Display */}
              {(() => {
                const info = getExerciseInfo(currentExerciseLog);
                if (info.type === 'timed') {
                  return (
                    <div className="flex items-center justify-center gap-2">
                      <span 
                        className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5"
                        style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                      >
                        <Timer className="w-3 h-3" />
                        {info.value}
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center justify-center gap-2">
                    <span 
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                    >
                      {info.sets} sets
                    </span>
                    <span 
                      className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                    >
                      <Repeat className="w-3 h-3" />
                      {info.reps} reps
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Exercise Bubbles */}
            <div className="px-4 mb-4 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 w-fit mx-auto">
                {currentExerciseLogs.map((exerciseLog, idx) => {
                  const isActive = idx === currentExerciseIndex;
                  const isCompleted = exerciseLog.logSubmitted;
                  const gifUrl = exerciseLog.exercise?.videos?.[0]?.gifURL;
                  
                  return (
                    <button
                      key={exerciseLog.id || idx}
                      onClick={() => onExerciseSelect(idx)}
                      className={`flex-shrink-0 w-12 h-12 rounded-full overflow-hidden transition-all ${
                        isActive 
                          ? 'ring-2 ring-offset-2 ring-offset-black' 
                          : ''
                      }`}
                      style={isActive ? { '--tw-ring-color': accentColor } as React.CSSProperties : {}}
                    >
                      {isCompleted ? (
                        <div 
                          className="w-full h-full flex items-center justify-center"
                          style={{ backgroundColor: accentColor }}
                        >
                          <CheckCircle2 className="w-5 h-5 text-black" />
                        </div>
                      ) : gifUrl ? (
                        <img
                          src={gifUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <span className="text-zinc-400 text-xs font-medium">
                            {exerciseLog.exercise?.name?.charAt(0) || 'E'}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Complete Button - Mobile */}
            <div className="px-4">
              <button
                onClick={onComplete}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: accentColor, color: '#0a0a0b' }}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Complete Move</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Progress List (Desktop Only) */}
        <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] flex-col bg-[#0f1112] border-l border-zinc-800/50">
          {/* Header */}
          <div className="p-6 border-b border-zinc-800/50">
            <h2 className="text-xl font-bold text-white">Workout Progress</h2>
            <p className="text-zinc-500 text-sm mt-1">
              {currentExerciseLogs.filter(l => l.logSubmitted).length} of {currentExerciseLogs.length} completed
            </p>
          </div>

          {/* Exercise List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {currentExerciseLogs.map((exerciseLog, idx) => (
              <ExerciseCard
                key={exerciseLog.id || idx}
                exerciseLog={exerciseLog}
                index={idx}
                isActive={idx === currentExerciseIndex}
                isCompleted={exerciseLog.logSubmitted}
              />
            ))}
          </div>

          {/* Complete Button - Desktop */}
          <div className="p-6 border-t border-zinc-800/50">
            <button
              onClick={onComplete}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: accentColor, color: '#0a0a0b' }}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Complete Move</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
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
