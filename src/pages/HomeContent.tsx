import React, { useEffect, useState, useRef } from 'react';
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
import { Workout, WorkoutStatus, WorkoutSummary, RepsAndWeightLog } from '../api/firebase/workout/types';
import { workoutService } from '../api/firebase/workout/service';
import UserMenu from '../components/UserMenu'; 
import { workoutSessionService } from '../api/firebase/workoutSession/service';
import { useRouter } from 'next/router';
import { User } from '../api/firebase/user/types';
import { useCurrentWorkout, useCurrentExerciseLogs } from '../hooks/useWorkout';

import { setCurrentWorkout, setCurrentExerciseLogs, setWorkoutSummary } from '../redux/workoutSlice';

const HomeContent = () => {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<SelectedRootTabs>(SelectedRootTabs.Discover);
  const [isWorkoutPanelOpen, setIsWorkoutPanelOpen] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  const { currentUser } = useSelector((state: RootState) => state.user);
  const userId = currentUser?.id;
  const currentWorkoutSession = useCurrentWorkout();
  const currentExerciseLogs = useCurrentExerciseLogs();
  const workoutSummary = useSelector((state: RootState) => state.workout.workoutSummary); // Add this

  const dispatch = useDispatch();

  // useEffect(() => {
  //   console.log(`[HomeContent useEffect] Running effect. userId: ${userId}`);
  //   if (userId) {
  //     console.log("[HomeContent useEffect] userId exists, fetching workout sessions...");
  //     const fetchWorkoutSessions = async () => {
  //       try {
  //         const sessions = await workoutService.fetchAllWorkoutSessions(userId);
  //         const queuedUpSessions = sessions.filter(session =>
  //           session.workout?.workoutStatus === WorkoutStatus.QueuedUp
  //         );
  //
  //         console.log("QueuedUp Sessions", queuedUpSessions);
  //         
  //         const inProgressSessions = sessions.filter(session =>
  //           session.workout?.workoutStatus === WorkoutStatus.InProgress
  //         );
  //
  //
  //         if (inProgressSessions.length > 0) {
  //           const currentSession = inProgressSessions[0];
  //           if (currentSession.workout) {
  //             const nextExerciseIndex = currentSession.logs?.findIndex(log => !log.logSubmitted) ?? 0;
  //
  //             dispatch(setCurrentWorkout(currentSession.workout.toDictionary()));
  //             dispatch(setCurrentExerciseLogs(
  //               (currentSession.logs || []).map(log => log.toDictionary())
  //             ));
  //             setCurrentExerciseIndex(nextExerciseIndex >= 0 ? nextExerciseIndex : 0);
  //           }
  //         } else if (queuedUpSessions.length > 0) {
  //           const currentSession = queuedUpSessions[0];
  //           if (currentSession.workout) {
  //             dispatch(setCurrentWorkout(currentSession.workout.toDictionary()));
  //             dispatch(setCurrentExerciseLogs(
  //               (currentSession.logs || []).map(log => log.toDictionary())
  //             ));
  //           }
  //         } else {
  //           dispatch(setCurrentWorkout(null));
  //           dispatch(setCurrentExerciseLogs([]));
  //         }
  //       } catch (error) {
  //         console.error('Error fetching workout sessions:', error);
  //       }
  //     };
  //
  //     fetchWorkoutSessions();
  //   }
  // }, [userId, dispatch]);
  
    // Function to start a workout
    const startWorkout = (workout: Workout, logs: ExerciseLog[]) => {
      dispatch(setCurrentWorkout(workout.toDictionary()));
      dispatch(setCurrentExerciseLogs(logs.map(log => log.toDictionary())));
    };
  
    // Function to begin the workout (move from ready to in-progress)
    const beginWorkout = () => {
      if (currentWorkoutSession) {
        const updatedWorkout = new Workout({
          ...currentWorkoutSession,
          workoutStatus: WorkoutStatus.InProgress
        });
        dispatch(setCurrentWorkout(updatedWorkout.toDictionary()));
      }
    };
  
    const completeExercise = async () => {
      if (!currentWorkoutSession || !currentExerciseLogs.length) {
        console.error('No active workout or logs');
        return;
      }
    
      try {
        const currentExercise = currentExerciseLogs[currentExerciseIndex]?.exercise;
        const isBodyWeight = currentExerciseLogs[currentExerciseIndex]?.isBodyWeight;
    
        // Create updated logs array
        const updatedLogs = [...currentExerciseLogs];
        updatedLogs[currentExerciseIndex] = new ExerciseLog({
          ...updatedLogs[currentExerciseIndex],
          logSubmitted: true,
          completedAt: new Date(),
          updatedAt: new Date()
        });
    
        // Update workout logs in Firebase
        if (currentWorkoutSession && userId) {
          await workoutService.updateWorkoutLogs({
            userId,
            workoutId: currentWorkoutSession.id,
            logs: updatedLogs
          });
    
          // Update workout summary
          const updatedSummary = new WorkoutSummary({
            id: currentWorkoutSession.id,
            workoutId: currentWorkoutSession.id,
            userId,
            exercises: updatedLogs.map(log => log.toDictionary()),
            bodyParts: currentWorkoutSession.fetchPrimaryBodyParts(),
            secondaryBodyParts: currentWorkoutSession.fetchSecondaryBodyParts(),
            workoutTitle: currentWorkoutSession.title,
            exercisesCompleted: updatedLogs
              .filter(log => log.logSubmitted)
              .map(log => log.toDictionary()),
            isCompleted: false,
            startTime: currentWorkoutSession.startTime || new Date(),
            createdAt: currentWorkoutSession.createdAt || new Date(),
            updatedAt: new Date()
          });
    
          dispatch(setWorkoutSummary(updatedSummary.toDictionary()));
        }
    
        // Handle bodyweight vs regular exercise submission
        if (isBodyWeight) {
          await performBodyWeightSubmission(updatedLogs);
        } else {
          await performExerciseSubmission(updatedLogs);
        }
    
        // Update Redux state with serialized logs
        dispatch(setCurrentExerciseLogs(updatedLogs.map(log => log.toDictionary())));
    
        // Find next incomplete exercise
        const nextIndex = updatedLogs.findIndex(log => !log.logSubmitted);
        
        setTimeout(() => {
          if (nextIndex !== -1) {
            setCurrentExerciseIndex(nextIndex);
          } else {
            completeWorkout();
          }
        }, 100);
    
      } catch (error) {
        console.error('Error submitting exercise:', error);
      }
    };
  
    const performBodyWeightSubmission = (updatedLogs: ExerciseLog[]) => {
      const updatedLogsWithBodyWeight = updatedLogs.map(log => new ExerciseLog({
        ...log,
        logs: log.logs.map(logItem => new RepsAndWeightLog({
          ...logItem,
          weight: 0.0,
          isBodyWeight: true,
          reps: logItem.reps || 0
        }))
      }));
      
      return performExerciseSubmission(updatedLogsWithBodyWeight);
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
  

// In HomeContent component:
const completeWorkout = async () => {
  try {
    if (!currentWorkoutSession || !currentUser) {
      console.error('Missing required data for workout completion');
      return;
    }

    const startTime = currentWorkoutSession.startTime || new Date();
    const endTime = new Date();

    let userChallenge = null;
    
    if (currentWorkoutSession.collectionId) {
      try {
        // Get all collections this workout belongs to
        const collections = await workoutService.getCollectionsByIds(currentWorkoutSession.collectionId);
        
        // Find the first collection where this workout is in the sweatlist and has a challenge
        for (const collection of collections) {
          const isWorkoutInSweatlist = collection.sweatlistIds.some(
            sweatlist => sweatlist.id === currentWorkoutSession.id
          );

          if (isWorkoutInSweatlist && collection.challenge?.id) {
            const userChallenges = await workoutService.fetchUserChallengesByChallengeId(collection.challenge.id);
            if (userChallenges.length > 0) {
              userChallenge = userChallenges[0];
              break; // Found a valid challenge, can stop searching
            }
          }
        }
      } catch (error) {
        console.error('Error fetching collections or user challenges:', error);
      }
    }

    const userObj = currentUser ? new User(currentUser.id, currentUser) : null;
    if (!userObj) {
      console.error('No user found for workout completion');
      return;
    }

    const result = await workoutSessionService.endWorkout(
      userObj,
      currentWorkoutSession,
      userChallenge || null,
      startTime,
      endTime
    );

    if (result.status === WorkoutStatus.Complete && result.workoutSummary) {
      dispatch(setWorkoutSummary(result.workoutSummary));
      dispatch(setCurrentWorkout(null));
      dispatch(setCurrentExerciseLogs([]));
      setCurrentExerciseIndex(0);

      router.push(`/workout/${currentUser?.username}/${currentWorkoutSession.id}/${result.workoutSummary.id}`);

    }

  } catch (error) {
    console.error('Error completing workout:', error);
  }
};

// Update performExerciseSubmission to track completed exercises
const performExerciseSubmission = async (updatedLogs: ExerciseLog[]) => {
  try {
    if (currentWorkoutSession && userId) {
      await workoutService.updateWorkoutLogs({
        userId,
        workoutId: currentWorkoutSession.id,
        logs: updatedLogs
      });

      // Update WorkoutSessionService's completed exercises
      workoutSessionService.completedExercises = updatedLogs;

      // Update Redux state with serialized logs
      dispatch(setCurrentExerciseLogs(updatedLogs.map(log => log.toDictionary())));

      if (currentExerciseIndex < updatedLogs.length - 1) {
        setCurrentExerciseIndex(prev => prev + 1);
      } else {
        await completeWorkout();
      }
    }
  } catch (error) {
    console.error('Error submitting exercise:', error);
  }
};

  // Function to reset workout
  const handleCancelWorkout = async () => {
    if (currentWorkoutSession && userId) {
      try {
        const summary = workoutSummary ? new WorkoutSummary(workoutSummary) : null;
        await workoutService.cancelWorkout(currentWorkoutSession, summary);
        setCurrentExerciseIndex(0);
      } catch (error) {
        console.error('Error canceling workout:', error);
      }
    }
  };

  // Render workout views based on status
  const renderWorkoutView = () => {
    if (!currentWorkoutSession) return null;

    switch (currentWorkoutSession.workoutStatus) {
      case WorkoutStatus.QueuedUp:
        return (
          <WorkoutReadyView 
            workout={currentWorkoutSession}
            exerciseLogs={currentExerciseLogs}
            onClose={handleCancelWorkout}
            onStartWorkout={beginWorkout}
          />
        );
      case WorkoutStatus.InProgress:
        return (
          <InProgressExercise
            exercises={currentExerciseLogs || []}
            currentExerciseLogs={currentExerciseLogs}
            currentExerciseIndex={currentExerciseIndex}
            onComplete={completeExercise}
            onClose={handleCancelWorkout}
            onExerciseSelect={setCurrentExerciseIndex}
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
      {/* {currentWorkoutSession ? (
        renderWorkoutView()
      ) : ( */} 
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
-      {/* )} */}
    </div>
  );
};

export default HomeContent;