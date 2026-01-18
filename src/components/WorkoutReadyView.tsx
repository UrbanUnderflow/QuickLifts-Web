import React, { useState } from 'react';
import { Clock, Dumbbell, ChevronDown, X, Play, ListOrdered, Target } from 'lucide-react';
import { Workout } from '../api/firebase/workout/types';
import { workoutService } from '../api/firebase/workout/service';
import { useRouter } from 'next/router';
import { RootState } from '../redux/store';
import { ExerciseLog } from '../api/firebase/exercise';
import { useDispatch, useSelector } from 'react-redux';
import { setCurrentWorkout, setCurrentExerciseLogs } from '../redux/workoutSlice';
import { WorkoutSummary } from '../api/firebase/workout/types';

interface WorkoutReadyViewProps {
  workout: Workout;
  exerciseLogs: ExerciseLog[];
  onClose: () => void;
  onStartWorkout?: () => void;
}

// Accent color
const accentColor = '#E0FE10';

const WorkoutReadyView: React.FC<WorkoutReadyViewProps> = ({
  workout,
  exerciseLogs,
  onClose,
  onStartWorkout,
}) => {
  const [showExercises, setShowExercises] = useState(false);
  const _router = useRouter();
  const dispatch = useDispatch();
  const userId = useSelector((state: RootState) => state.user.currentUser?.id);
  const currentWorkoutSession = useSelector((state: RootState) => state.workout.currentWorkout);

  const handleStartWorkout = async () => {
    if (onStartWorkout) {
      onStartWorkout();
    }
  };  

  const cancelWorkout = async () => {
    if (!userId || !currentWorkoutSession) {
      console.error('No user ID or current workout session found');
      return;
    }

    try {
      await workoutService.cancelWorkout(
        new Workout(currentWorkoutSession), 
        workoutService.currentWorkoutSummary ? new WorkoutSummary(workoutService.currentWorkoutSummary) : null
      );
      dispatch(setCurrentWorkout(null));
      dispatch(setCurrentExerciseLogs([]));
      console.log('Workout session canceled successfully');
    } catch (error) {
      console.error('Error canceling workout session:', error);
    }
  };

  const duration = Workout.estimatedDuration(workout.exercises);

  // Info Card Component - iOS style
  const InfoCard = ({
    icon: Icon,
    title,
    value,
    expandable = false,
    expanded = false,
    onToggle,
    children,
  }: {
    icon: React.ElementType;
    title: string;
    value: string;
    expandable?: boolean;
    expanded?: boolean;
    onToggle?: () => void;
    children?: React.ReactNode;
  }) => {
    const CardWrapper = expandable ? 'button' : 'div';
    
    return (
      <div className="bg-[#1a1d1f] rounded-2xl overflow-hidden border border-zinc-800/50">
        <CardWrapper
          onClick={expandable ? onToggle : undefined}
          className={`w-full flex items-center gap-4 p-4 ${expandable ? 'cursor-pointer' : ''}`}
        >
          {/* Icon with green background */}
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          
          {/* Text */}
          <div className="flex-1 text-left">
            <p className="text-zinc-400 text-sm">{title}</p>
            <p className="text-white font-semibold">{value}</p>
          </div>
          
          {/* Expand icon */}
          {expandable && (
            <ChevronDown 
              className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          )}
        </CardWrapper>
        
        {/* Expandable content */}
        {expandable && expanded && children && (
          <div className="border-t border-zinc-800/50 px-4 py-3 bg-zinc-900/30">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#0f1112] z-50 overflow-y-auto">
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 left-6 z-20 w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center hover:bg-zinc-700 transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Main Layout - Centered on large screens */}
      <div className="min-h-screen flex flex-col lg:flex-row">
        
        {/* Left Panel / Hero Section */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 lg:py-0">
          {/* Hero Icon */}
          <div 
            className="w-32 h-32 lg:w-40 lg:h-40 rounded-full flex items-center justify-center mb-8"
            style={{ backgroundColor: accentColor }}
          >
            <Dumbbell className="w-16 h-16 lg:w-20 lg:h-20 text-black" strokeWidth={2.5} />
          </div>
          
          {/* Headline */}
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-white text-center mb-4 max-w-md">
            Get ready to start your workout!
          </h1>
          
          {/* Subtitle */}
          <p className="text-zinc-400 text-center text-base lg:text-lg max-w-sm">
            Once you hit start, your workout will begin. Get ready to crush it! 💪
          </p>
        </div>

        {/* Right Panel / Info Cards */}
        <div className="lg:w-[480px] xl:w-[520px] lg:border-l lg:border-zinc-800/50 flex flex-col">
          {/* Scrollable content area */}
          <div className="flex-1 px-6 pb-32 lg:pb-6 lg:pt-20 lg:overflow-y-auto">
            <div className="space-y-3 max-w-md mx-auto lg:max-w-none">
              {/* Workout Name Card */}
              <InfoCard
                icon={Dumbbell}
                title="Workout"
                value={workout.title}
              />

              {/* Duration Card */}
              <InfoCard
                icon={Clock}
                title="Estimated Duration"
                value={`${duration} min`}
              />

              {/* Exercises Card - Expandable */}
              <InfoCard
                icon={ListOrdered}
                title="Exercises"
                value={`${exerciseLogs.length} exercises`}
                expandable
                expanded={showExercises}
                onToggle={() => setShowExercises(!showExercises)}
              >
                <div className="space-y-3">
                  {exerciseLogs.map((log, index) => {
                    const exercise = log.exercise;
                    let displayInfo = "";
                    
                    if (exercise?.category?.details?.screenTime) {
                      const screenTime = exercise.category.details.screenTime;
                      displayInfo = `${screenTime} sec`;
                    } else {
                      displayInfo = `${exercise.sets || 3} sets • ${exercise.reps || 12} reps`;
                    }
                                      
                    return (
                      <div key={log.id} className="flex items-center gap-3">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium"
                          style={{ 
                            backgroundColor: `${accentColor}15`,
                            color: accentColor
                          }}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{exercise.name}</p>
                          <p className="text-zinc-500 text-xs">{displayInfo}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </InfoCard>

              {/* Focus/Zone Card */}
              <InfoCard
                icon={Target}
                title="Focus"
                value={workout.zone || 'Full Body'}
              />
            </div>
          </div>

          {/* Desktop: Action buttons in right panel */}
          <div className="hidden lg:block p-6 border-t border-zinc-800/50 bg-[#0f1112]">
            <button 
              onClick={handleStartWorkout}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: accentColor, color: '#0a0a0b' }}
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Workout</span>
            </button>
            <button 
              onClick={cancelWorkout}
              className="w-full text-zinc-400 py-3 font-medium text-sm hover:text-white transition-colors mt-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: Fixed bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0f1112] via-[#0f1112]/95 to-transparent lg:hidden">
        <button 
          onClick={handleStartWorkout}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-base transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: accentColor, color: '#0a0a0b' }}
        >
          <Play className="w-5 h-5 fill-current" />
          <span>Start Workout</span>
        </button>
        <button 
          onClick={cancelWorkout}
          className="w-full text-zinc-400 py-3 font-medium text-sm hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default WorkoutReadyView;
