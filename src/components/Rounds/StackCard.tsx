import React, { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronRight, Clock, User, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Workout, WorkoutSummary } from '../../api/firebase/workout/types';
import { GifImageViewer } from '../../components/GifImageViewer';
import { UserChallenge } from '../../api/firebase/workout/types';

interface CommonCardProps {
  selectedOrder?: number;
  maxOrder?: number;
  showArrows?: boolean;
  showCalendar?: boolean;
  workoutDate?: Date;
  backgroundColor?: string;
  isComplete?: boolean;
  // New props for completion logic
  challengeStartDate?: Date;
  currentDayIndex?: number;
  userChallenge?: UserChallenge;
  allWorkoutSummaries?: WorkoutSummary[];
  index?: number;
  challengeHasStarted?: boolean;  // Add this line
  onPrimaryAction: () => void;
  onCalendarTap?: (date: Date) => void;
  onUpdateOrder?: (newOrder: number) => void;
}

// Calendar Cell Component
const CalendarCell = ({ month, day, weekday }: { month: string; day: string; weekday: string }) => (
  <div className="flex flex-col items-center bg-zinc-800 rounded p-2 text-xs">
    <span className="text-gray-400">{month}</span>
    <span className="text-white font-bold text-lg">{day}</span>
    <span className="text-gray-400">{weekday}</span>
  </div>
);

// Stat View Component
const StatView = ({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) => (
  <div className="flex items-center gap-1 text-gray-400">
    {icon}
    <span className="text-sm">
      {value} {label}
    </span>
  </div>
);

// Navigation Arrows Component
const NavigationArrows = ({
  selectedOrder,
  maxOrder,
  workoutDate,
  showCalendar,
  onUpdateOrder,
  onCalendarTap
}: {
  selectedOrder: number;
  maxOrder: number;
  workoutDate?: Date;
  showCalendar: boolean;
  onUpdateOrder: (newOrder: number) => void;
  onCalendarTap?: (date: Date) => void;
}) => (
  <div className="flex flex-col justify-between py-2 px-4 bg-zinc-800">
    <button
      onClick={() => onUpdateOrder(selectedOrder - 1)}
      disabled={selectedOrder <= 0}
      className={`p-2 ${selectedOrder > 0 ? 'text-green-500 hover:text-green-400' : 'text-gray-600'}`}
    >
      <ChevronUp size={16} />
    </button>

    {showCalendar && workoutDate && (
      <button
        onClick={() => onCalendarTap?.(workoutDate)}
        className="my-2"
      >
        <CalendarCell
          month={format(workoutDate, 'MMM').toUpperCase()}
          day={format(workoutDate, 'd')}
          weekday={format(workoutDate, 'EEE').toUpperCase()}
        />
      </button>
    )}

    <button
      onClick={() => onUpdateOrder(selectedOrder + 1)}
      disabled={selectedOrder >= maxOrder - 1}
      className={`p-2 ${selectedOrder < maxOrder - 1 ? 'text-green-500 hover:text-green-400' : 'text-gray-600'}`}
    >
      <ChevronDown size={16} />
    </button>
  </div>
);

const didUserCompleteWorkoutFromLogs = (
  workout: Workout,
  date: Date,
  allWorkoutSummaries?: WorkoutSummary[]
): boolean => {
  if (!allWorkoutSummaries?.length) return false;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Filter summaries for the given day
  const sameDaySummaries = allWorkoutSummaries.filter(summary => {
    if (!summary.completedAt) return false;
    const completedAt = new Date(summary.completedAt);
    return completedAt >= startOfDay && completedAt < endOfDay;
  });

  // Get workout exercise IDs
  const workoutExerciseIds = workout.exercises.map(ex => ex.exercise.id);

  // Check each summary
  return sameDaySummaries.some(summary => {
    if (!summary.completedAt) return false;
    
    const completedExerciseIds = summary.exercisesCompleted.map(ex => ex.exercise.id);
    const hasOverlappingExercises = workoutExerciseIds.some(id => 
      completedExerciseIds.includes(id)
    );
    
    if (hasOverlappingExercises) {
      const logHour = new Date(summary.completedAt).getHours();
      return logHour >= 6; // Only count completions after 6 AM
    }
    return false;
  });
};

interface CompletedWorkout {
  workoutId: string;
  completedAt: Date;
}

// Saved Sweatlist Card Component
export const StackCard: React.FC<{
  workout: Workout;
  gifUrls: string[];
  isChallengeEnabled?: boolean;
  challengeHasStarted?: boolean; 
} & CommonCardProps> = ({
  workout,
  gifUrls,
  selectedOrder,
  maxOrder,
  showArrows,
  showCalendar,
  workoutDate,
  backgroundColor = 'bg-zinc-800',
  isComplete: initialIsComplete = false,
  isChallengeEnabled = false,
  challengeStartDate,
  challengeHasStarted,
  currentDayIndex,
  userChallenge,
  allWorkoutSummaries,
  index,
  onPrimaryAction,
  onCalendarTap,
  onUpdateOrder
}) => {
  const [isComplete, setIsComplete] = useState(initialIsComplete);

  // Refresh completion status
  useEffect(() => {
    console.log("stack in grid: ", workout);
  
    if (!challengeStartDate || !isChallengeEnabled) {
      console.log('❌ No challenge date or challenge not enabled');
      setIsComplete(initialIsComplete);
      return;
    }
  
    if (workoutDate && workoutDate > new Date()) {
      console.log('⏳ Future date detected, marking incomplete:', workoutDate);
      setIsComplete(false);
      return;
    }
  
    // Check userChallenge completions
    const isMarkedComplete = userChallenge?.completedWorkouts?.some(
      completedWorkout => {
        console.log('Comparing:', {
          completedWorkoutId: completedWorkout.workoutId,
          currentWorkoutId: workout.id,
          matches: completedWorkout.workoutId === workout.id
        });
        return completedWorkout.workoutId === workout.id;
      }
    );
    
    console.log('🏆 Completion from userChallenge:', {
      isMarkedComplete,
      completedWorkouts: userChallenge?.completedWorkouts
    });
  
    // Check logs
    const completedViaLogs = workoutDate ? 
      didUserCompleteWorkoutFromLogs(workout, workoutDate, allWorkoutSummaries) : 
      false;
    console.log('📝 Completion from logs:', {
      completedViaLogs,
      summariesCount: allWorkoutSummaries?.length || 0
    });
  
    const finalCompletionStatus = isMarkedComplete || completedViaLogs;
    console.log('✅ Final completion status:', finalCompletionStatus);
  
    setIsComplete(finalCompletionStatus);
  }, [workout, challengeStartDate, userChallenge, allWorkoutSummaries, workoutDate]);

  const isToday = (index: number | undefined, startDate: Date | undefined) => {
   
    if (index === undefined || !startDate) {
      return false;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
    return index === diffDays;
  };

  const arrowProps = {
    selectedOrder: selectedOrder!,
    maxOrder: maxOrder!,
    workoutDate,
    showCalendar: !!showCalendar,
    onUpdateOrder: onUpdateOrder!,
    onCalendarTap: onCalendarTap,
  };

  return (
    <div 
      onClick={onPrimaryAction}
      className={`
        relative overflow-hidden rounded-xl border border-zinc-800/50 hover:border-zinc-700/50 transition-all
        ${backgroundColor}
        ${index !== undefined && index < (currentDayIndex || 0) || isComplete ? 'opacity-70' : 'opacity-100'}
        ${isToday(index, challengeStartDate) && challengeHasStarted ? 'ring-2 ring-[#E0FE10]' : ''}
      `}
    >
      <div className="flex">
        {showArrows && selectedOrder !== undefined && maxOrder !== undefined && onUpdateOrder && (
          <div className="border-r border-zinc-800/50">
            <NavigationArrows {...arrowProps} />
          </div>
        )}

        <div className="flex-1 p-6">
          {/* Title & Stats */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">{workout.title}</h3>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#E0FE10]" />
                  <span className="text-zinc-400">{workout.exercises.length} moves</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#E0FE10]" />
                  <span className="text-zinc-400">
                    {`${Workout.estimatedDuration(workout.logs || [])} ${
                      Workout.estimatedDuration(workout.logs || []) === 1 ? 'min' : 'mins'
                    }`}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {isChallengeEnabled && (
                <CheckCircle 
                  className={isComplete ? 'text-[#E0FE10]' : 'text-zinc-700'} 
                  size={20} 
                />
              )}
              <ChevronRight className="text-zinc-600" size={20} />
            </div>
          </div>

          {/* Exercise Previews */}
          <div className="flex gap-3 mb-6">
            {gifUrls.slice(0, 3).map((gifUrl, index) => (
              <div 
                key={`${workout.id}-gif-${index}`}
                className="relative w-24 h-24 rounded-lg overflow-hidden bg-zinc-900/50"
              >
                <GifImageViewer
                gifUrl={gifUrl}
                alt={`Exercise ${index + 1}`}
                className="w-full h-full object-cover"
                variant="rounded"
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
              </div>
            ))}
          </div>

          {/* Zone Tag */}
          <div>
            <span className="px-3 py-1.5 bg-[#E0FE10]/10 text-[#E0FE10] rounded-full text-sm font-medium">
              {workout.zone}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RestDayCard: React.FC<CommonCardProps> = ({
  selectedOrder,
  maxOrder,
  showArrows,
  showCalendar,
  workoutDate,
  backgroundColor = 'bg-zinc-800',
  isComplete: initialIsComplete = false,
  challengeStartDate,
  challengeHasStarted,
  currentDayIndex,
  index,
  onPrimaryAction,
  onCalendarTap,
  onUpdateOrder
}) => {
  const [isComplete, setIsComplete] = useState(initialIsComplete);

  // Refresh completion status for rest days
  useEffect(() => {
    if (!challengeStartDate || !workoutDate) {
      setIsComplete(initialIsComplete);
      return;
    }

    // Rest days are complete if the date has passed
    setIsComplete(workoutDate <= new Date());
  }, [workoutDate, challengeStartDate, initialIsComplete]);

  const isToday = (index: number | undefined, startDate: Date | undefined) => {
    if (index === undefined || !startDate) {
      return false;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
    return index === diffDays;
  };

  const debugClassName = `
    rounded-lg overflow-hidden cursor-pointer ${backgroundColor}
    ${index !== undefined && index < (currentDayIndex || 0) || isComplete ? 'opacity-70' : 'opacity-100'}
    ${isToday(index, challengeStartDate) && challengeHasStarted ? 'ring-2 ring-green-500' : ''}
  `;

  return (
    <div 
      onClick={onPrimaryAction}
      className={debugClassName}
    >
      <div className="flex">
        {showArrows && selectedOrder !== undefined && maxOrder !== undefined && onUpdateOrder && (
          <NavigationArrows
            selectedOrder={selectedOrder}
            maxOrder={maxOrder}
            workoutDate={workoutDate}
            showCalendar={!!showCalendar}
            onUpdateOrder={onUpdateOrder}
            onCalendarTap={onCalendarTap}
          />
        )}

        <div className="flex-1 p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Rest Day</h3>
              <p className="text-gray-400 text-sm">
                Take a moment to recover and come back stronger.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="px-3 py-1 bg-green-500 bg-opacity-20 text-green-500 rounded-full text-sm">
              Recovery
            </span>

            <CheckCircle 
              className={isComplete ? 'text-green-500' : 'text-gray-600'} 
              size={20}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default {
  StackCard,
  RestDayCard
};