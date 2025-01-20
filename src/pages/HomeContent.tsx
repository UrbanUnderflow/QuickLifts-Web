import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
import { onAuthStateChanged, getAuth, signOut } from 'firebase/auth';
import { userService } from '../api/firebase/user';
import { RootState } from '../redux/store';
import WorkoutPanel from '../components/App/Dashboard/WorkoutPanel';
import { ExerciseLog, Exercise } from '../api/firebase/exercise/types';
import { Workout, WorkoutStatus } from '../api/firebase/workout/types';
import { workoutService } from '../api/firebase/workout/service';
import { setUser, setLoading } from '../redux/userSlice';

import { setCurrentWorkout, setCurrentExerciseLogs } from '../redux/workoutSlice';

  // Monitor auth changes
  export const useAuth = () => {
    const dispatch = useDispatch();
    const auth = getAuth();
  
    useEffect(() => {
      console.log('useAuth effect running');
      dispatch(setLoading(true));
  
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log('Auth state changed. User:', firebaseUser ? firebaseUser.uid : 'null');
        if (firebaseUser) {
          try {
            const firestoreUser = await userService.fetchUserFromFirestore(firebaseUser.uid);
            console.log('Firestore user fetched:', firestoreUser);
            dispatch(setUser(firestoreUser));
            userService.currentUser = firestoreUser;
          } catch (error) {
            console.error('Error fetching user data:', error);
            dispatch(setUser(null));
          }
        } else {
          console.log('No Firebase user, setting user to null');
          dispatch(setUser(null));
          userService.currentUser = null;
        }
        dispatch(setLoading(false));
      });
  
      return () => unsubscribe();
    }, [dispatch]);
  };

const HomeContent = () => {
  // Track which root tab is selected
  const [selectedTab, setSelectedTab] = useState<SelectedRootTabs>(SelectedRootTabs.Discover);
  const [isWorkoutPanelOpen, setIsWorkoutPanelOpen] = useState(false);

  // Control whether to show the sign-in modal
  const [isSignInModalVisible, setIsSignInModalVisible] = useState(true);

  // New states for workout flow
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  
  const { currentUser, loading } = useSelector((state: RootState) => state.user);
  const userId = useSelector((state: RootState) => state.user.currentUser?.id);
  const currentWorkoutSession = useSelector((state: RootState) => state.workout.currentWorkout);
  const currentExerciseLogs = useSelector((state: RootState) => state.workout.currentExerciseLogs);
  


  const dispatch = useDispatch();


  //Do authentication
  useAuth(); 

  useEffect(() => {
    console.log('HomeContent effect. CurrentUser:', currentUser, 'Loading:', loading);
  }, [currentUser, loading]);

  useEffect(() => {
    if (userId) {
      const fetchWorkoutSessions = async () => {
        try {
          console.log('Fetching workout sessions...');
          const sessions = await workoutService.fetchAllWorkoutSessions(userId);
          console.log('Workout sessions fetched:', sessions);
  
          const queuedUpSessions = sessions.filter(session => 
            session.workout?.workoutStatus === WorkoutStatus.QueuedUp
          );
  
          const inProgressSessions = sessions.filter(session => 
            session.workout?.workoutStatus === WorkoutStatus.InProgress
          );
  
          console.log('QueuedUp sessions:', queuedUpSessions);
          console.log('InProgress sessions:', inProgressSessions);
  
          if (inProgressSessions.length > 0) {
            const currentSession = inProgressSessions[0]; // Prioritize InProgress
            console.log('Current workout session (InProgress) found:', currentSession);
            dispatch(setCurrentWorkout(currentSession.workout));
            dispatch(setCurrentExerciseLogs(currentSession.logs || []));
          } else if (queuedUpSessions.length > 0) {
            const currentSession = queuedUpSessions[0];
            console.log('Current workout session (QueuedUp) found:', currentSession);
            dispatch(setCurrentWorkout(currentSession.workout));
            dispatch(setCurrentExerciseLogs(currentSession.logs || []));
          } else {
            console.log('No current workout session found');
            dispatch(setCurrentWorkout(null));
            dispatch(setCurrentExerciseLogs([]));
          }
        } catch (error) {
          console.error('Error fetching workout sessions:', error);
        }
      };
  
      fetchWorkoutSessions();
    }
  }, [userId, dispatch]);

  // Function to start a workout
  const startWorkout = (workout: Workout, logs: ExerciseLog[]) => {
    dispatch(setCurrentWorkout(workout));
    dispatch(setCurrentExerciseLogs(logs));
  };  

  // Function to begin the workout (move from ready to in-progress)
  const beginWorkout = () => {
    if (currentWorkoutSession) {
      dispatch(setCurrentWorkout({
        ...currentWorkoutSession,
        workoutStatus: WorkoutStatus.InProgress
      }));
    }
  };

  const handleSignOut = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      // Handle successful sign out (e.g., redirect to home page)
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Function to complete an exercise
  const completeExercise = () => {
    const dispatch = useDispatch();
    const currentExerciseLogs = useSelector((state: RootState) => state.workout.currentExerciseLogs);
    
    const updatedLogs = [...currentExerciseLogs];
    updatedLogs[currentExerciseIndex] = {
      ...updatedLogs[currentExerciseIndex],
      isCompleted: true
    };
  
    dispatch(setCurrentExerciseLogs(updatedLogs));
  
    // Move to next exercise or complete workout
    if (currentExerciseIndex < updatedLogs.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
    } else {
      // Optional: reset or navigate
      resetWorkout();
    }
  };

  // Function to reset workout
  const resetWorkout = () => {
    const dispatch = useDispatch();
    dispatch(setCurrentWorkout(null));
    dispatch(setCurrentExerciseLogs([]));
    setCurrentExerciseIndex(0);
  };

  // Render workout views based on status
  const renderWorkoutView = () => {
    if (!currentWorkoutSession) return null;
  
    switch (currentWorkoutSession.workoutStatus) {
      case WorkoutStatus.QueuedUp:
        return (
          <WorkoutReadyView 
            workout={currentWorkoutSession}
            onClose={resetWorkout}
            onStartWorkout={beginWorkout}
          />
        );
      case WorkoutStatus.InProgress:
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
      if (userId) {
        // Save workout session and get logs
        const savedWorkout = await workoutService.saveWorkoutSession({
          userId,
          workout,
          logs: workout.logs || []
        });

        if (savedWorkout) {
          startWorkout(savedWorkout, savedWorkout.logs || []);
          setIsWorkoutPanelOpen(false);
        }
      }
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  //Added loading state
  if (loading) {
    return <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
    </div>;
  }

  // If user is not signed in, show the SignInModal
  if (!currentUser) {
    return (
      <SignInModal
        isVisible={isSignInModalVisible}
        onClose={() => setIsSignInModalVisible(false)}
        onSignInSuccess={(user) => {
          console.log('Sign-in successful:', user);
          setIsSignInModalVisible(false);
        }}
        onSignInError={(error) => {
          console.error('Sign-in error:', error);
          alert('Sign-in failed. Please try again.');
        }}
        onSignUpSuccess={(user) => {
          console.log('Sign-up successful:', user);
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
      {currentWorkoutSession ? (
        renderWorkoutView()
      ) : (
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