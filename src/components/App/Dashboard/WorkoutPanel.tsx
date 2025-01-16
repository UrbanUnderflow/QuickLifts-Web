import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Workout, WorkoutStatus } from '../../../api/firebase/workout/types';
import { Challenge } from '../../../types/Challenge';
import WorkoutTypeSelector from '../../../components/App/Dashboard/WorkoutTypeSelector';
import classNames from 'classnames'; // Install classnames for conditional classes

interface WorkoutPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

type Tab = 'today' | 'rounds';

const WorkoutPanel: React.FC<WorkoutPanelProps> = ({ isVisible, onClose }) => {
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [selectedTab, setSelectedTab] = useState<Tab>('today');
  const [showWorkoutTypeSelector, setShowWorkoutTypeSelector] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]); // Assuming you have recent workouts data

  useEffect(() => {
    if (isVisible) {
      fetchWorkoutData();
      fetchActiveChallenges();
      fetchRecentWorkouts();
    }
  }, [isVisible]);

  const fetchWorkoutData = async () => {
    setLoading(true);
    try {
      // Replace with your actual data fetching logic
      const workout: Workout | null = await fetchCurrentWorkout();
      setCurrentWorkout(workout);
    } catch (error) {
      console.error('Error fetching workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveChallenges = async () => {
    try {
      // Replace with your actual data fetching logic
      const challenges: Challenge[] = await fetchChallenges();
      setActiveChallenges(challenges);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  };

  const fetchRecentWorkouts = async () => {
    try {
      // Replace with your actual data fetching logic
      const workouts: Workout[] = await fetchRecentWorkoutsData();
      setRecentWorkouts(workouts);
    } catch (error) {
      console.error('Error fetching recent workouts:', error);
    }
  };

  // Placeholder functions for data fetching
  const fetchCurrentWorkout = async (): Promise<Workout | null> => {
    // Implement your actual fetch logic here
    return null; // Example
  };

  const fetchChallenges = async (): Promise<Challenge[]> => {
    // Implement your actual fetch logic here
    return []; // Example
  };

  const fetchRecentWorkoutsData = async (): Promise<Workout[]> => {
    // Implement your actual fetch logic here
    return []; // Example
  };

  const handleGenerateWorkout = () => {
    setShowWorkoutTypeSelector(true);
  };

  const handleCreateWorkout = (selectedParts: string[]) => {
    console.log('Creating workout with parts:', selectedParts);
    setShowWorkoutTypeSelector(false);
    // TODO: Implement workout generation logic
  };

  const handleStartWorkout = async () => {
    if (!currentWorkout) return;
    try {
      await fetchWorkoutData();
      // Implement workout start logic
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  const handleCancelWorkout = () => {
    // Implement workout cancellation logic
    console.log('Workout canceled');
  };

  // Tab Bar Component
  const renderTabBar = () => (
    <div className="flex bg-black/10">
      <button
        onClick={() => setSelectedTab('today')}
        className={classNames(
          'flex-1 py-3 text-center',
          selectedTab === 'today' ? 'border-b-2 border-black font-bold' : ''
        )}
      >
        Today
      </button>
      <button
        onClick={() => setSelectedTab('rounds')}
        className={classNames(
          'flex-1 py-3 text-center',
          selectedTab === 'rounds' ? 'border-b-2 border-black font-bold' : ''
        )}
      >
        Rounds
      </button>
    </div>
  );

  // Today Tab Content
  const renderTodayTab = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-black">Loading...</div>
        </div>
      );
    }

    if (!currentWorkout) {
      return (
        <div className="flex flex-col p-8 bg-[#E0FE10] rounded-lg">
          <h3 className="text-2xl font-bold text-black mb-4">
            You don't have your workout for today yet.
          </h3>
          <button
            onClick={handleGenerateWorkout}
            className="mt-2 flex items-center text-lg font-medium text-black"
          >
            Get a workout
            <svg className="ml-2 w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14m-7-7l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {activeChallenges.length > 0 && (
            <div className="mt-auto pt-8">
              <div className="bg-black/10 rounded-full py-3 px-6 inline-flex items-center gap-2">
                <span className="text-black">Swipe to see</span>
                <span className="font-bold text-black">{activeChallenges.length} Active Rounds</span>
                <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 5l7 7-7 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Workout In Progress View
    return (
      <div className="flex flex-col p-6 bg-[#E0FE10] rounded-lg">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-black">Workout In Progress</h2>
        </div>
        <div className="rounded-lg bg-black text-white p-4 flex flex-col gap-4">
          <h3 className="font-bold">{currentWorkout.title || 'My Workout'}</h3>
          <div className="flex gap-4">
            <button
              onClick={handleStartWorkout}
              className="px-4 py-2 rounded-md bg-green-200 text-black"
            >
              Resume
            </button>
            <button
              onClick={handleCancelWorkout}
              className="px-4 py-2 rounded-md bg-red-200 text-black"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Rounds Tab Content
  const renderRoundsTab = () => {
    return (
      <div className="p-6 bg-[#E0FE10] rounded-lg">
        <h2 className="text-xl font-bold text-black mb-4">Active Rounds</h2>
        {activeChallenges.length === 0 ? (
          <p className="text-black">No active rounds</p>
        ) : (
          <div className="space-y-4">
            {activeChallenges.map((challenge) => (
              <div
                key={challenge.id}
                className="my-2 p-4 rounded-lg bg-black text-white flex flex-col"
              >
                <h3 className="font-bold">{challenge.title}</h3>
                {/* Add additional challenge details here */}
                <p className="text-sm">Duration: {challenge.durationInDays} days</p>
                <p className="text-sm">Participants: {challenge.participants.length}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Recent Workouts Section
  const renderRecentWorkouts = () => {
    if (recentWorkouts.length === 0) return null;

    return (
      <div className="p-6 bg-[#E0FE10] rounded-lg mt-4">
        <h2 className="text-xl font-bold text-black mb-4">Recent Workouts</h2>
        <div className="space-y-4">
          {recentWorkouts.slice(0, 3).map((workout) => (
            <button
              key={workout.id}
              onClick={() => openWorkoutSummary(workout)}
              className="w-full p-4 bg-black rounded-lg text-white flex justify-between items-center hover:bg-black/80 transition"
            >
              <div>
                <h3 className="font-bold">{workout.title}</h3>
                <p className="text-sm">
                  {/* {formatDate(workout.completedAt)} · {workout.duration} min */}
                </p>
              </div>
              {/* <span className="font-bold">Score: {workout.score}</span> */}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Helper Functions
  const formatDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };

  const openWorkoutSummary = (workout: Workout) => {
    // Implement workout summary modal/navigation
    console.log('Open summary for workout:', workout);
  };

  // Main Render
  if (!isVisible) return null;

  return (
    <>
      {isVisible && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#E0FE10] overflow-hidden">
          {/* Close Button */}
          <button onClick={onClose} className="self-end m-4">
            <X size={24} className="text-black" />
          </button>

          {/* Tab Bar */}
          {renderTabBar()}

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {showWorkoutTypeSelector ? (
              <WorkoutTypeSelector
                onClose={() => setShowWorkoutTypeSelector(false)}
                onCreateWorkout={handleCreateWorkout}
              />
            ) : (
              <>
                {selectedTab === 'today' && renderTodayTab()}
                {selectedTab === 'rounds' && renderRoundsTab()}
                {/* Recent Workouts can be displayed in the Today tab or separately as needed */}
                {selectedTab === 'today' && renderRecentWorkouts()}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default WorkoutPanel;
