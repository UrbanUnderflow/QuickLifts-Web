import React from 'react';
import { ChevronUp, ChevronDown, ChevronRight, Clock, User, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Workout } from '../../api/firebase/workout/types';
import { GifImageViewer } from '../../components/GifImageViewer';

interface CommonCardProps {
  selectedOrder?: number;
  maxOrder?: number;
  showArrows?: boolean;
  showCalendar?: boolean;
  workoutDate?: Date;
  backgroundColor?: string;
  isComplete?: boolean;
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

// Saved Sweatlist Card Component
export const StackCard: React.FC<{
  workout: Workout;
  gifUrls: string[];
  isChallengeEnabled?: boolean;
} & CommonCardProps> = ({
  workout,
  gifUrls,
  selectedOrder,
  maxOrder,
  showArrows,
  showCalendar,
  workoutDate,
  backgroundColor = 'bg-zinc-800',
  isComplete = false,
  isChallengeEnabled = false,
  onPrimaryAction,
  onCalendarTap,
  onUpdateOrder
}) => {
  return (
    <div 
      onClick={onPrimaryAction}
      className={`rounded-lg overflow-hidden cursor-pointer ${backgroundColor}`}
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
              <h3 className="text-xl font-bold text-white mb-2">{workout.title}</h3>
              <div className="flex gap-4">
                <StatView
                  icon={<User size={16} />}
                  value={String(workout.exercises.length)}
                  label="moves"
                />
                <StatView
                  icon={<Clock size={16} />}
                  value={Workout.estimatedDuration(workout.exercises) < 1 ? "< 1" : String(Workout.estimatedDuration(workout.exercises))}
                  label="min"
                />
              </div>
            </div>
            <ChevronRight className="text-gray-500" size={20} />
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto">
            {gifUrls.slice(0, 3).map((gifUrl, index) => (
              <div 
                key={`${workout.id}-gif-${index}`}
                className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0"
              >
                <GifImageViewer
                  gifUrl={gifUrl}
                  alt={`Exercise ${index + 1} preview`}
                  className="w-full h-full"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <span className="px-3 py-1 bg-green-500 bg-opacity-20 text-green-500 rounded-full text-sm">
              {workout.zone}
            </span>

            {isChallengeEnabled && (
              <CheckCircle 
                className={isComplete ? 'text-green-500' : 'text-gray-600'} 
                size={20} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Rest Day Card Component
export const RestDayCard: React.FC<CommonCardProps> = ({
  selectedOrder,
  maxOrder,
  showArrows,
  showCalendar,
  workoutDate,
  backgroundColor = 'bg-zinc-800',
  isComplete = false,
  onPrimaryAction,
  onCalendarTap,
  onUpdateOrder
}) => {
  return (
    <div 
      onClick={onPrimaryAction}
      className={`rounded-lg overflow-hidden cursor-pointer ${backgroundColor}`}
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