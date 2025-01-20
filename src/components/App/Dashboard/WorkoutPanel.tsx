import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector, useDispatch } from 'react-redux';
import { X } from 'lucide-react';
import { Workout, WorkoutStatus, WorkoutSummary } from '../../../api/firebase/workout/types';
import {  
  Challenge,
  UserChallenge
 } from '../../../types/ChallengeTypes';
import WorkoutTypeSelector from '../../../components/App/Dashboard/WorkoutTypeSelector';
import classNames from 'classnames'; // Install classnames for conditional classes
import { userService } from '../../../api/firebase/user'; 
import { workoutService } from '../../../api/firebase/workout'
import { RootState } from '../../../redux/store';
import { setCurrentWorkout, setCurrentExerciseLogs } from '../../../redux/workoutSlice';


interface WorkoutPanelProps {
  isVisible: boolean;
  onClose: () => void;
  onStartWorkout?: (workout: Workout) => Promise<void>; // Add this optional prop
}

type Tab = 'today' | 'rounds';

const WorkoutPanel: React.FC<WorkoutPanelProps> = ({ 
  isVisible, 
  onClose, 
  onStartWorkout 
}) => {
  const dispatch = useDispatch();
  const currentWorkout = useSelector((state: RootState) => state.workout.currentWorkout);
  const currentExerciseLogs = useSelector((state: RootState) => state.workout.currentExerciseLogs);
  
  const [loading, setLoading] = useState(true);
  const [activeChallenges, setActiveChallenges] = useState<UserChallenge[]>([]);
  const [selectedTab, setSelectedTab] = useState<Tab>('today');
  const [showWorkoutTypeSelector, setShowWorkoutTypeSelector] = useState(false);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (isVisible) {
      console.log("We are visible!")
      fetchWorkoutData();
      fetchActiveChallenges();
      fetchRecentWorkouts();
    }
  }, [isVisible]);

  const getDaysLeft = (endDate: Date | string | undefined): number => {
    if (!endDate) return 0;
    
    const end = new Date(endDate);
    const now = new Date();
    
    // Get difference in milliseconds and convert to days
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Return 0 if negative (past end date)
    return Math.max(0, diffDays);
  };

  const fetchWorkoutData = async () => {
    setLoading(true);
    try {
      const workout = await workoutService.fetchCurrentWorkoutSession(userService.currentUser?.id || '');
      if (workout) {
        dispatch(setCurrentWorkout(workout.workout));
        dispatch(setCurrentExerciseLogs(workout.logs || []));
      }
    } catch (error) {
      console.error('Error fetching workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveChallenges = async (): Promise<void> => {
    try {
      const challenges: UserChallenge[] = await fetchChallengesForUser(); // Fetch active challenges
      setActiveChallenges(challenges); // Update the state with fetched challenges
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  };
  

  const fetchRecentWorkouts = async () => {
    try {
      const workouts: WorkoutSummary[] = await fetchRecentWorkoutsData();
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

  const fetchChallengesForUser = async (): Promise<UserChallenge[]> => {
    try {
      const activeChallenges = await workoutService.fetchActiveChallenges();
      console.log('User Challenges:', activeChallenges);
  
      // Logic to determine the active challenge, if any
      const activeChallenge = activeChallenges.length > 0 ? activeChallenges[0] : null;
  
      if (activeChallenge) {
        console.log('Active Challenge:', activeChallenge);
      } else {
        console.log('No active challenges found.');
      }
  
      // Return the fetched challenges
      return activeChallenges;
    } catch (error) {
      console.error('Error fetching user challenges:', error);
      // Return an empty array in case of error to match the return type
      return [];
    }
  };
  

  const fetchRecentWorkoutsData = async (): Promise<WorkoutSummary[]> => {
    try {
      const today = new Date();
      console.log('Fetching workouts for date:', today); // Log the date
  
      const summaries = await workoutService.fetchAllWorkoutSummaries();
      console.log('Here are the summaries:', summaries);
  
      return summaries.slice(0, 3).map(summary =>
        WorkoutSummary.fromFirebase({
          id: summary.id,
          workoutId: summary.workoutId || '',
          exercises: summary.exercises || [],
          bodyParts: summary.bodyParts || [],
          secondaryBodyParts: summary.secondaryBodyParts || [],
          workoutTitle: summary.workoutTitle || 'Untitled Workout',
          caloriesBurned: summary.caloriesBurned || 0,
          workoutRating: summary.workoutRating,
          exercisesCompleted: summary.exercisesCompleted || [],
          aiInsight: summary.aiInsight || '',
          recommendations: summary.recommendations || [],
          gifURLs: summary.gifURLs || [],
          recommendedWork: summary.recommendedWork,
          isCompleted: summary.isCompleted || false,
          createdAt: summary.createdAt,
          updatedAt: summary.updatedAt,
          completedAt: summary.completedAt,
          duration: summary.duration || '',
        })
      );
    } catch (error) {
      console.error('Error fetching recent workouts:', error);
      return [];
    }
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
      if (onStartWorkout) {
        await onStartWorkout(currentWorkout);
      }
      onClose(); // Close the panel
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

  const handleChallengeSelect = (challenge: UserChallenge) => {
    onClose(); // Close the panel first
    router.push(`/round/${challenge.challengeId}`);
  };

  // Rounds Tab Content
  const renderRoundsTab = () => {
    // Helper function to calculate progress
    const calculateProgress = (challenge: UserChallenge) => {
      if (!challenge.challenge?.startDate || !challenge.challenge?.endDate) return 0;
      
      const start = new Date(challenge.challenge.startDate);
      const end = new Date(challenge.challenge.endDate);
      const now = new Date();
  
      const totalDuration = end.getTime() - start.getTime();
      const elapsed = now.getTime() - start.getTime();
      
      return Math.min(Math.max(elapsed / totalDuration, 0), 1);
    };
  
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-black mb-4">Active Rounds</h2>
        {activeChallenges.length === 0 ? (
          <p className="text-black">No active rounds</p>
        ) : (
          <div className="space-y-4">
            {activeChallenges.map((challenge) => (
              <button
              key={challenge.id}
              onClick={() => handleChallengeSelect(challenge)}
              className="w-full text-left" // Add text-left to maintain alignment
             >
              <div
                key={challenge.id}
                className="p-4 space-y-3 bg-zinc-800 rounded-xl"
              >
                {/* Title and Days Left */}
                <div className="flex justify-between items-center">
                  <h3 className="text-white font-semibold">
                    {challenge.challenge?.title}
                  </h3>
                  <span className="text-[#E0FE10] text-sm">
                    {getDaysLeft(challenge.challenge?.endDate)}d left
                  </span>
                </div>
  
                {/* Progress Bar */}
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#E0FE10] rounded-full"
                    style={{ 
                      width: `${calculateProgress(challenge) * 100}%`
                    }}
                  />
                </div>
  
                {/* Stats Row */}
                <div className="flex justify-between text-sm text-white/70">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M15.45 22c1.95.31 3.5-1.24 3.5-3.19V5.19c0-1.95-1.55-3.5-3.5-3.19m0 20H8.55c-1.95.31-3.5-1.24-3.5-3.19V5.19c0-1.95 1.55-3.5 3.5-3.19" />
                    </svg>
                    <span>{challenge.currentStreak} day streak</span>
                  </div>
                </div>
              </div>
            </button>
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
                <h3 className="font-bold">{workout.workoutTitle}</h3>
                <p className="text-sm">
                  {formatDate(workout.createdAt)} · {workout.duration} min
                </p>
              </div>
              <span className="font-bold">Score: {workout.duration}</span>
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

  const openWorkoutSummary = (workoutSummary: WorkoutSummary) => {
    // Implement workout summary modal/navigation
    console.log('Open summary for workout:', workoutSummary);
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
