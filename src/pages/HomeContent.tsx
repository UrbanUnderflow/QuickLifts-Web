import React, { useEffect, useState } from 'react';
import BottomNav from '../components/App/BottomNav';
import Discover from '../../src/components/App/RootScreens/Discover';
import Search from '../../src/components/App/RootScreens/Search';
import Create from '../../src/components/App/RootScreens/Create';
import Message from '../../src/components/App/RootScreens/Message';
import Profile from '../../src/components/App/RootScreens/Profile';
import SignInModal from "../components/SignInModal";
import WorkoutReadyView from "../components/WorkoutReadyView";
import InProgressExercise from '../components/App/InProgressExercise/InProgressExercise';
import { SelectedRootTabs } from '../types/DashboardTypes';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../api/firebase/config'; 
import { userService } from '../api/firebase/user';
import WorkoutPanel from '../components/App/Dashboard/WorkoutPanel';
import { ExerciseLog, Exercise } from '../api/firebase/exercise/types';
import { Workout } from '../api/firebase/workout/types';
import { workoutService } from '../api/firebase/workout/service';
import Link from 'next/link';

const HomeContent = () => {
  // Track which root tab is selected
  const [selectedTab, setSelectedTab] = useState<SelectedRootTabs>(SelectedRootTabs.Discover);
  const [isWorkoutPanelOpen, setIsWorkoutPanelOpen] = useState(false);

  // Track whether user is signed in
  const [isSignedIn, setIsSignedIn] = useState(false);

  // Control whether to show the sign-in modal
  const [isSignInModalVisible, setIsSignInModalVisible] = useState(true);

  // New states for workout flow
  const [workoutStatus, setWorkoutStatus] = useState<'idle' | 'ready' | 'in-progress' | 'completed'>('idle');
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [currentExerciseLogs, setCurrentExerciseLogs] = useState<ExerciseLog[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  // Monitor auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const firestoreUser = await userService.fetchUserFromFirestore(user.uid);
          userService.currentUser = firestoreUser;
          console.log('User data fetched and set:', firestoreUser);
          setIsSignedIn(true);
          setIsSignInModalVisible(false);
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        userService.currentUser = null;
        setIsSignedIn(false);
        setIsSignInModalVisible(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Function to start a workout
  const startWorkout = (workout: Workout, logs: ExerciseLog[]) => {
    setCurrentWorkout(workout);
    setCurrentExerciseLogs(logs);
    setWorkoutStatus('ready');
  };

  // Function to begin the workout (move from ready to in-progress)
  const beginWorkout = () => {
    setWorkoutStatus('in-progress');
  };

  // Function to complete an exercise
  const completeExercise = () => {
    const updatedLogs = [...currentExerciseLogs];
    updatedLogs[currentExerciseIndex] = {
      ...updatedLogs[currentExerciseIndex],
      isCompleted: true
    };

    setCurrentExerciseLogs(updatedLogs);

    // Move to next exercise or complete workout
    if (currentExerciseIndex < currentExerciseLogs.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
    } else {
      setWorkoutStatus('completed');
      // Optional: reset or navigate
      resetWorkout();
    }
  };

  // Function to reset workout
  const resetWorkout = () => {
    setWorkoutStatus('idle');
    setCurrentWorkout(null);
    setCurrentExerciseLogs([]);
    setCurrentExerciseIndex(0);
  };

  // Render workout views based on status
  const renderWorkoutView = () => {
    switch (workoutStatus) {
      case 'ready':
        return (
          <WorkoutReadyView 
            workout={currentWorkout!}
            onClose={resetWorkout}
            onStartWorkout={beginWorkout}
          />
        );
      case 'in-progress':
        return (
          <InProgressExercise
            exercises={currentExerciseLogs}
            currentExerciseIndex={currentExerciseIndex}
            onComplete={completeExercise}
            onClose={resetWorkout}
          />
        );
      default:
        return null;
    }
  };

  // Render the selected tab's content
  const renderContent = () => {
    switch (selectedTab) {
      case SelectedRootTabs.Discover:
        return <Discover />;
      case SelectedRootTabs.Search:
        return <Search />;
      case SelectedRootTabs.Create:
        return <Create />;
      case SelectedRootTabs.Messages:
        return <Message />;
      case SelectedRootTabs.Profile:
        return <Profile />;
      default:
        return null;
    }
  };

  // Modify WorkoutPanel to use new startWorkout method
  const handleStartWorkout = async (workout: Workout) => {
    try {
      // Save workout session and get logs
      const savedWorkout = await workoutService.saveWorkoutSession({
        workout,
        logs: workout.logs || []
      });

      if (savedWorkout) {
        startWorkout(savedWorkout, savedWorkout.logs || []);
        setIsWorkoutPanelOpen(false);
      }
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  // If user is not signed in, show the SignInModal
  if (!isSignedIn) {
    return (
      <SignInModal
        isVisible={isSignInModalVisible}
        onClose={() => setIsSignInModalVisible(false)}
        onSignInSuccess={(user) => {
          console.log('Sign-in successful:', user);
          setIsSignedIn(true);
          setIsSignInModalVisible(false);
        }}
        onSignInError={(error) => {
          console.error('Sign-in error:', error);
          alert('Sign-in failed. Please try again.');
        }}
        onSignUpSuccess={(user) => {
          console.log('Sign-up successful:', user);
          setIsSignedIn(true);
          setIsSignInModalVisible(false);
        }}
        onSignUpError={(error) => {
          console.error('Sign-up error:', error);
          alert('Sign-up failed. Please try again.');
        }}
        onQuizComplete={() => {
          console.log('Quiz completed successfully');
        }}
        onQuizSkipped={() => {
          console.log('Quiz skipped');
        }}
      />
    );
  }

  // Main render logic
  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Render workout view if in workout flow */}
      {(workoutStatus === 'ready' || workoutStatus === 'in-progress') && renderWorkoutView()}

      {/* Existing layout if not in workout flow */}
      {workoutStatus === 'idle' && (
        <>
          {/* Top Navigation */}
          <nav className="px-4 py-4 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-10 flex justify-between items-center">
            <img src="/pulse-logo-white.svg" alt="Pulse" className="h-8" />
            
            <button
              className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg"
              onClick={() => setIsWorkoutPanelOpen(true)}
            >
              Start Workout
            </button>
          </nav>

          {/* Main Content */}
          <div className="w-full">
            {renderContent()}
          </div>

          {/* Bottom Navigation */}
          <BottomNav selectedTab={selectedTab} onTabChange={setSelectedTab} />

          {/* Render WorkoutPanel if needed */}
          <WorkoutPanel
            isVisible={isWorkoutPanelOpen}
            onClose={() => setIsWorkoutPanelOpen(false)}
            onStartWorkout={handleStartWorkout}
          />
        </>
      )}
    </div>
  );
};

export default HomeContent;