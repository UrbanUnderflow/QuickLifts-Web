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
  highlightBorder?: boolean; // Added prop for highlighting
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

  // Check each summary for matching roundWorkoutId
  return sameDaySummaries.some(summary => {
    if (!summary.completedAt) return false;
    
    // Match by roundWorkoutId, which is the unique identifier in the challenge context
    const matches = summary.roundWorkoutId === workout.roundWorkoutId;
    
    if (matches) {
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
  highlightBorder,
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
    if (workout.title === "Testing Screen") {
      console.log("stack in grid: ", workout);
    }
  
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
  
    // Check userChallenge completions - Updated to match iOS implementation using roundWorkoutId
    const isMarkedComplete = userChallenge?.completedWorkouts?.some(
      completedWorkout => {
        console.log('Comparing:', {
          completedWorkoutId: completedWorkout.workoutId,
          currentWorkoutId: workout.roundWorkoutId,
          matches: completedWorkout.workoutId === workout.roundWorkoutId
        });
        return completedWorkout.workoutId === workout.roundWorkoutId;
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

  // *** FIX: Calculate estimated duration correctly ***
  const estimatedDuration = Workout.estimatedDuration(workout.logs || []);

  return (
    <div 
      onClick={onPrimaryAction}
      className={`
        relative overflow-hidden rounded-xl border hover:border-zinc-700/50 transition-all cursor-pointer group 
        ${highlightBorder ? 'border-2 border-[#E0FE10]' : 'border-zinc-800/50'}
        ${(index ?? -1) < (currentDayIndex ?? -1) || isComplete ? 'opacity-70' : 'opacity-100'}
      `}
    >
      <div className={`flex ${backgroundColor}`}>
        {/* Left Column (Arrows/Calendar) */} 
        {(showArrows || showCalendar) && (
          <div className="flex flex-col justify-between py-2 px-4 bg-zinc-800/50">
            {showArrows && (
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateOrder?.(selectedOrder! - 1); }}
                disabled={selectedOrder! <= 0}
                className={`p-1 rounded-full ${selectedOrder! > 0 ? 'text-[#E0FE10] hover:bg-zinc-700' : 'text-gray-600 cursor-not-allowed'}`}
              >
                <ChevronUp size={16} />
              </button>
            )}
            
            {showCalendar && workoutDate && (
              <button
                onClick={(e) => { e.stopPropagation(); onCalendarTap?.(workoutDate); }}
                className="my-2"
              >
                <CalendarCell
                  month={format(workoutDate, 'MMM').toUpperCase()}
                  day={format(workoutDate, 'd')}
                  weekday={format(workoutDate, 'EEE').toUpperCase()}
                />
              </button>
            )}

            {!showCalendar && <div className="h-full min-h-[50px]"></div>} {/* Spacer if no calendar */}

            {showArrows && (
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateOrder?.(selectedOrder! + 1); }}
                disabled={selectedOrder! >= maxOrder! - 1}
                className={`p-1 rounded-full ${selectedOrder! < maxOrder! - 1 ? 'text-[#E0FE10] hover:bg-zinc-700' : 'text-gray-600 cursor-not-allowed'}`}
              >
                <ChevronDown size={16} />
              </button>
            )}
          </div>
        )}

        {/* Right Column (Content) */} 
        <div className="flex-grow flex flex-col">
          {/* Top Section */} 
          <div className="flex justify-between items-start p-4 pb-0">
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1 line-clamp-2">{workout.title}</h3>
              {/* Stats */} 
              <div className="flex items-center gap-3 text-xs text-gray-400">
                 {/* *** FIX: Use calculated duration and correct static method call *** */}
                <StatView 
                  icon={<Clock size={12} />} 
                  value={estimatedDuration < 1 ? "<1" : `${estimatedDuration}`} 
                  label="min" 
                />
                {/* Add other stats if needed */}
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-600 group-hover:translate-x-1 transition-transform" />
          </div>

          {/* GIF Section */} 
          <div className="flex gap-2 p-4 pt-2 overflow-hidden">
            {gifUrls.filter(url => url).slice(0, 3).map((url, idx) => (
              <div 
                key={idx} 
                className="w-1/3 aspect-[3/4] rounded-xl overflow-hidden relative"
              >
                {/* Glassmorphic card */}
                <div className="absolute inset-0 bg-zinc-800/60 backdrop-blur-sm" />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                
                {/* Border overlay */}
                <div className="absolute inset-0 rounded-xl border border-white/10" />
                
                {/* Shadow */}
                <div className="absolute inset-0 shadow-lg" />
                
                {/* Image */}
                <GifImageViewer 
                  gifUrl={url} 
                  alt={`Exercise preview ${idx + 1}`}
                  className="z-0 rounded-xl"
                />
              </div>
            ))}
          </div>

          {/* Bottom Section */} 
          <div className="flex justify-between items-center p-4 pt-0 mt-auto">
            <span className="text-xs font-medium px-2 py-0.5 bg-[#E0FE10]/10 text-[#E0FE10] rounded">
              {workout.zone}
            </span>
            {isChallengeEnabled && (
              <CheckCircle size={18} className={`${isComplete ? 'text-[#E0FE10]' : 'text-gray-700'}`} />
            )}
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
  highlightBorder,
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
      className={`
        relative overflow-hidden rounded-xl border hover:border-zinc-700/50 transition-all cursor-pointer group 
        ${highlightBorder ? 'border-2 border-[#E0FE10]' : 'border-zinc-800/50'}
        ${(index ?? -1) < (currentDayIndex ?? -1) || isComplete ? 'opacity-70' : 'opacity-100'}
      `}
    >
      <div className={`flex ${backgroundColor}`}>
        {/* Left Column (Arrows/Calendar) */} 
        {(showArrows || showCalendar) && (
           <div className="flex flex-col justify-between py-2 px-4 bg-zinc-800/50">
            {showArrows && (
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateOrder?.(selectedOrder! - 1); }}
                disabled={selectedOrder! <= 0}
                className={`p-1 rounded-full ${selectedOrder! > 0 ? 'text-[#E0FE10] hover:bg-zinc-700' : 'text-gray-600 cursor-not-allowed'}`}
              >
                <ChevronUp size={16} />
              </button>
            )}
            
            {showCalendar && workoutDate && (
              <button
                onClick={(e) => { e.stopPropagation(); onCalendarTap?.(workoutDate); }}
                className="my-2"
              >
                <CalendarCell
                  month={format(workoutDate, 'MMM').toUpperCase()}
                  day={format(workoutDate, 'd')}
                  weekday={format(workoutDate, 'EEE').toUpperCase()}
                />
              </button>
            )}
             {!showCalendar && <div className="h-full min-h-[50px]"></div>} {/* Spacer if no calendar */}

            {showArrows && (
              <button
                onClick={(e) => { e.stopPropagation(); onUpdateOrder?.(selectedOrder! + 1); }}
                disabled={selectedOrder! >= maxOrder! - 1}
                className={`p-1 rounded-full ${selectedOrder! < maxOrder! - 1 ? 'text-[#E0FE10] hover:bg-zinc-700' : 'text-gray-600 cursor-not-allowed'}`}
              >
                <ChevronDown size={16} />
              </button>
            )}
          </div>
        )}
        {/* Right Column (Content) */} 
        <div className="flex-grow flex flex-col p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">Rest Day</h3>
              <p className="text-sm text-gray-400">Take a moment to recover and come back stronger.</p>
            </div>
            <ChevronRight size={20} className="text-gray-600 group-hover:translate-x-1 transition-transform" />
          </div>
          {/* Bottom Section */} 
           <div className="flex justify-between items-center mt-4 pt-2">
            <span className="text-xs font-medium px-2 py-0.5 bg-[#E0FE10]/10 text-[#E0FE10] rounded">
              Recovery
            </span>
            <CheckCircle size={18} className={`${isComplete ? 'text-[#E0FE10]' : 'text-gray-700'}`} />
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