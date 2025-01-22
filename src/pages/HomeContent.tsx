import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import BottomNav from '../components/App/BottomNav';
import Discover from '../../src/components/App/RootScreens/Discover';
import Search from '../../src/components/App/RootScreens/Search';
import Create from '../../src/components/App/RootScreens/Create';
import Message from '../../src/components/App/RootScreens/Message';
import Profile from '../../src/components/App/RootScreens/Profile';
import WorkoutReadyView from "../components/WorkoutReadyView";
import InProgressExercise from '../components/App/InProgressExercise/InProgressExercise';
import { SelectedRootTabs } from '../types/DashboardTypes';
import { RootState } from '../redux/store';
import WorkoutPanel from '../components/App/Dashboard/WorkoutPanel';
import { ExerciseLog } from '../api/firebase/exercise/types';
import { Workout, WorkoutStatus } from '../api/firebase/workout/types';
import { workoutService } from '../api/firebase/workout/service';
import UserMenu from '../components/UserMenu'; 

import { setCurrentWorkout, setCurrentExerciseLogs } from '../redux/workoutSlice';


  const HomeContent = () => {
    const [selectedTab, setSelectedTab] = useState<SelectedRootTabs>(SelectedRootTabs.Discover);
  const [isWorkoutPanelOpen, setIsWorkoutPanelOpen] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  const { currentUser } = useSelector((state: RootState) => state.user);
  const userId = currentUser?.id;
  const currentWorkoutSession = useSelector((state: RootState) => state.workout.currentWorkout);
  const currentExerciseLogs = useSelector((state: RootState) => state.workout.currentExerciseLogs);

  const dispatch = useDispatch();

  useEffect(() => {
    if (userId) {
      const fetchWorkoutSessions = async () => {
        try {
          const sessions = await workoutService.fetchAllWorkoutSessions(userId);
          const queuedUpSessions = sessions.filter(session =>
            session.workout?.workoutStatus === WorkoutStatus.QueuedUp
          );
          const inProgressSessions = sessions.filter(session =>
            session.workout?.workoutStatus === WorkoutStatus.InProgress
          );

          if (inProgressSessions.length > 0) {
            const currentSession = inProgressSessions[0];
            dispatch(setCurrentWorkout(currentSession.workout));
            dispatch(setCurrentExerciseLogs(currentSession.logs || []));
          } else if (queuedUpSessions.length > 0) {
            const currentSession = queuedUpSessions[0];
            dispatch(setCurrentWorkout(currentSession.workout));
            dispatch(setCurrentExerciseLogs(currentSession.logs || []));
          } else {
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
  
    // Function to complete an exercise
    const completeExercise = async () => {
      // Validate inputs
      if (!currentWorkoutSession || !currentExerciseLogs.length) {
        console.error('No active workout or logs');
        return;
      }
    
      // Determine if the current exercise is a bodyweight exercise
      const currentExercise = currentExerciseLogs[currentExerciseIndex]?.exercise;
      const isBodyWeight = currentExerciseLogs[currentExerciseIndex]?.isBodyWeight;
    
      // Mark the current exercise as completed
      const updatedLogs = [...currentExerciseLogs];
      updatedLogs[currentExerciseIndex] = {
        ...updatedLogs[currentExerciseIndex],
        isCompleted: true
      };
    
      console.log('Exercise completed:', currentExercise?.name);
    
      try {
        // Update logs in the current workout
        if (currentWorkoutSession && userId) {
          await workoutService.updateWorkoutLogs({
            userId,
            workoutId: currentWorkoutSession.id,
            logs: updatedLogs
          });
        }
    
        // Handle bodyweight exercises
        if (isBodyWeight) {
          await performBodyWeightSubmission(updatedLogs);
        } else {
          await performExerciseSubmission(updatedLogs);
        }
    
        // Move to the next exercise
        if (currentExerciseIndex < updatedLogs.length - 1) {
          setCurrentExerciseIndex(prev => prev + 1);
        } else {
          // Complete the entire workout
          await completeWorkout();
        }
      } catch (error) {
        console.error('Error submitting exercise:', error);
        // Handle error (show toast, etc.)
      }
    };
  
    const performBodyWeightSubmission = (updatedLogs: ExerciseLog[]) => {
      // Similar to Swift version, but simplified for React
      const updatedLogsWithBodyWeight = updatedLogs.map(log => ({
        ...log,
        logs: log.logs.map(logItem => ({
          ...logItem,
          weight: 0.0,
          isBodyWeight: true,
          reps: logItem.reps || 0  // Ensure reps are set
        }))
      }));
  
      return performExerciseSubmission(updatedLogsWithBodyWeight);
    };
  
    const performExerciseSubmission = async (updatedLogs: ExerciseLog[]) => {
      try {
        // Update logs in the current workout
        if (currentWorkoutSession) {
          if (userId) {
            console.log('Updating workout logs in the database');
            await workoutService.updateWorkoutLogs({
              userId: userId,
              workoutId: currentWorkoutSession.id,
              logs: updatedLogs
            });
          }
        }
  
        // Update Redux state
        dispatch(setCurrentExerciseLogs(updatedLogs));
        console.log('Updated currentExerciseLogs in Redux');
  
        // Move to next exercise or complete workout
        if (currentExerciseIndex < updatedLogs.length - 1) {
          setCurrentExerciseIndex(prev => prev + 1);
          console.log('Moving to next exercise');
        } else {
          // Complete the entire workout
          await completeWorkout();
        }
      } catch (error) {
        console.error('Error submitting exercise:', error);
        // Handle error (show toast, etc.)
      }
    };
  
  const showZeroWeightConfirmationModal = (
    onConfirm: () => void, 
    onCancel: () => void
  ) => {
    // Implement modal logic
    // This could use a modal library or custom modal component
    const modalProps = {
      isOpen: true,
      title: "Zero Weight Detected",
      message: "You haven't added any weight lifted to this exercise. Without this, your analytics won't include detailed tracking for this exercise, but you'll still see it marked as completed. Do you want to proceed?",
      onConfirm: () => {
        onConfirm();
        // Close modal
      },
      onCancel: () => {
        onCancel();
        // Close modal
      }
    };
  
    // Dispatch modal state or use modal library
    // dispatch(showModal(modalProps));
  };
  
  const completeWorkout = async () => {
    try {
      // Update workout status to completed
      if (currentWorkoutSession) {
        // await workoutService.completeWorkout(currentWorkoutSession.id);
      }
  
      // Reset workout state
      // resetWorkout();
    } catch (error) {
      console.error('Error completing workout:', error);
    }
  };

  // Function to reset workout
  const resetWorkout = () => {
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
            exercises={currentWorkoutSession.logs || []}
            currentExerciseLogs={currentExerciseLogs}
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

  // Main render logic
  return (
    <div className="min-h-screen bg-zinc-900">
      {currentWorkoutSession ? (
        renderWorkoutView()
      ) : (
        <>
          {/* Top Navigation */}
          <nav className="px-4 py-4 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-10 flex justify-between items-center">
            <div className="flex items-center">
              <img src="/pulse-logo-white.svg" alt="Pulse" className="h-8" />
            </div>
            <div className="flex items-center space-x-4">
              <button
                className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg"
                onClick={() => setIsWorkoutPanelOpen(true)}
              >
                Start Workout
              </button>
              <UserMenu />
            </div>
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