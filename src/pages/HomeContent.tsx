import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import SideNav from '../components/Navigation/SideNav';
import Discover from '../../src/components/App/RootScreens/Discover';
import Search from '../../src/components/App/RootScreens/Search';
import Create from '../../src/components/App/RootScreens/Create';
import Message from '../../src/components/App/RootScreens/Message';
import Profile from '../../src/components/App/RootScreens/Profile';
import WorkoutReadyView from "../components/WorkoutReadyView";
import InProgressExercise from '../components/App/InProgressExercise/InProgressExercise';
import { SelectedRootTabs } from '../types/DashboardTypes';
import { RootState } from '../redux/store';
import { ExerciseLog } from '../api/firebase/exercise/types';
import { Workout, WorkoutStatus, WorkoutSummary, RepsAndWeightLog } from '../api/firebase/workout/types';
import { workoutService } from '../api/firebase/workout/service';
// import UserMenu from '../components/UserMenu'; 
import { workoutSessionService } from '../api/firebase/workoutSession/service';
import { useRouter } from 'next/router';
import { User } from '../api/firebase/user/types';
import { useCurrentWorkout, useCurrentExerciseLogs } from '../hooks/useWorkout';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../api/firebase/config';
import { dateToUnixTimestamp } from '../utils/formatDate';

import { setCurrentWorkout, setCurrentExerciseLogs, setWorkoutSummary } from '../redux/workoutSlice';
import SmartAppBanner from '../components/SmartAppBanner';

interface HomeContentProps {
  onAbout?: () => void;
}

const HomeContent: React.FC<HomeContentProps> = ({ onAbout }) => {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<SelectedRootTabs>(SelectedRootTabs.Discover);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);

  const { currentUser } = useSelector((state: RootState) => state.user);
  const userId = currentUser?.id;
  const currentWorkoutSession = useCurrentWorkout();
  const currentExerciseLogs = useCurrentExerciseLogs();
  const workoutSummary = useSelector((state: RootState) => state.workout.workoutSummary); // Add this

  const dispatch = useDispatch();

  // *** START: New useEffect for Log Listener ***
  useEffect(() => {
    console.log('[HomeContent Log Listener Effect] Running effect...');
    if (!userId || !currentWorkoutSession?.id) {
      console.log('[HomeContent Log Listener Effect] No userId or workoutId, skipping listener setup.');
      // Ensure logs are cleared if there's no active workout ID
      if (!currentWorkoutSession?.id) {
        dispatch(setCurrentExerciseLogs([]));
      }
      return () => {}; // Return empty cleanup function
    }

    const workoutId = currentWorkoutSession.id;
    console.log(`[HomeContent Log Listener Effect] Setting up listener for userId: ${userId}, workoutId: ${workoutId}`);

    const logsRef = collection(db, 'users', userId, 'workoutSessions', workoutId, 'logs');
    // Optional: Order logs if needed, e.g., by a specific field like 'order' or 'createdAt'
    // const q = query(logsRef, orderBy('order', 'asc')); // Example ordering

    const unsubscribe = onSnapshot(logsRef, // Use logsRef directly if no specific order needed, otherwise use 'q'
      (querySnapshot) => {
        console.log(`[HomeContent Log Listener Effect] Snapshot received. ${querySnapshot.docs.length} logs found.`);
        const updatedLogs = querySnapshot.docs.map(docSnap => {
          // *** FIX: Instantiate ExerciseLog and use toDictionary for serialization ***
          const logInstance = new ExerciseLog({ id: docSnap.id, ...docSnap.data() });
          // The ExerciseLog constructor should use convertFirestoreTimestamp.
          // The toDictionary method should return a plain object with serializable dates.
          return logInstance.toDictionary(); 
        });
        
        // Optional local sorting can still be applied if needed after conversion
        // updatedLogs.sort((a, b) => (a.order || 0) - (b.order || 0));

        console.log('[HomeContent Log Listener Effect] Dispatching updated logs (serialized):', updatedLogs);
        dispatch(setCurrentExerciseLogs(updatedLogs));
      },
      (error) => {
        console.error('[HomeContent Log Listener Effect] Error listening to logs:', error);
        // Optionally dispatch an error state or clear logs
        dispatch(setCurrentExerciseLogs([]));
      }
    );

    // Cleanup function
    return () => {
      console.log(`[HomeContent Log Listener Effect] Cleaning up listener for workoutId: ${workoutId}`);
      unsubscribe();
    };

  }, [userId, currentWorkoutSession?.id, dispatch]); // Dependencies: rerun if userId or workoutId changes
  // *** END: New useEffect for Log Listener ***

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
    const _startWorkout = (workout: Workout, logs: ExerciseLog[]) => {
      dispatch(setCurrentWorkout(workout.toDictionary()));
      dispatch(setCurrentExerciseLogs(logs.map(log => log.toDictionary())));
    };
  
    // Function to begin the workout (move from ready to in-progress)
    const beginWorkout = async () => {
      if (currentWorkoutSession && userId) {
        const workoutId = currentWorkoutSession.id;
        console.log(`[HomeContent beginWorkout] Starting workout. User: ${userId}, Session: ${workoutId}`);
        
        const updatedWorkoutDataForRedux = {
          ...currentWorkoutSession, // Spread the existing data from hook/redux
          workoutStatus: WorkoutStatus.InProgress,
          startTime: new Date(), // Update startTime for Redux state
          updatedAt: new Date() // Update updatedAt for Redux state
        };
        
        // Optimistically update Redux state
        dispatch(setCurrentWorkout(new Workout(updatedWorkoutDataForRedux).toDictionary()));
        
        try {
          // Update Firestore document
          const workoutSessionRef = doc(db, 'users', userId, 'workoutSessions', workoutId);
          await updateDoc(workoutSessionRef, {
            workoutStatus: WorkoutStatus.InProgress,
            startTime: dateToUnixTimestamp(updatedWorkoutDataForRedux.startTime), // Use consistent timestamp fn
            updatedAt: dateToUnixTimestamp(updatedWorkoutDataForRedux.updatedAt)  // Use consistent timestamp fn
          });
          console.log(`[HomeContent beginWorkout] Firestore document updated for session ${workoutId}`);
        } catch (error) {
          console.error(`[HomeContent beginWorkout] Error updating Firestore for session ${workoutId}:`, error);
          // Optionally revert Redux state or show an error message
        }
      } else {
        console.error('[HomeContent beginWorkout] Cannot begin workout: Missing workout session or userId.');
      }
    };
  
    // Add useEffect to log Redux state changes
    useEffect(() => {
      console.log('[HomeContent Effect] Redux currentExerciseLogs changed:', currentExerciseLogs);
    }, [currentExerciseLogs]);

    const completeExercise = useCallback(async () => {
      console.log('[HomeContent completeExercise] Starting...'); 
      if (!currentWorkoutSession || !currentExerciseLogs.length || !userId) {
        console.error('[HomeContent completeExercise] No active workout, logs, or userId');
        return;
      }
    
      try {
        const currentLogIndex = currentExerciseIndex; // Use state value at time of call
        const updatedLogs = [...currentExerciseLogs];
        
        if (currentLogIndex < 0 || currentLogIndex >= updatedLogs.length) {
          console.error('[HomeContent completeExercise] Invalid currentExerciseIndex:', currentLogIndex);
          return;
        }

        // Create a new ExerciseLog instance for the update
        updatedLogs[currentLogIndex] = new ExerciseLog({
          ...updatedLogs[currentLogIndex], // Spread existing plain object data
          logSubmitted: true,
          completedAt: new Date(),
          updatedAt: new Date()
        });
    
        // Update workout logs in Firebase - Use the new instance's toDictionary()
        await workoutService.updateWorkoutLogs({
          userId,
          workoutId: currentWorkoutSession.id,
          logs: [updatedLogs[currentLogIndex]] // Send only the updated log for efficiency
        });
    
        // Create a new WorkoutSummary instance for the update
        const updatedSummary = new WorkoutSummary({
          id: currentWorkoutSession.id, // Use workout ID as summary ID for consistency?
          workoutId: currentWorkoutSession.id,
          userId,
          exercises: updatedLogs.map(log => log), // Use the array of instances
          bodyParts: currentWorkoutSession.fetchPrimaryBodyParts ? currentWorkoutSession.fetchPrimaryBodyParts() : [], // Ensure method exists
          secondaryBodyParts: currentWorkoutSession.fetchSecondaryBodyParts ? currentWorkoutSession.fetchSecondaryBodyParts() : [], // Ensure method exists
          workoutTitle: currentWorkoutSession.title,
          exercisesCompleted: updatedLogs.filter(log => log.logSubmitted),
          isCompleted: false, // This will be set later in completeWorkout
          startTime: currentWorkoutSession.startTime || new Date(),
          createdAt: currentWorkoutSession.createdAt || new Date(),
          updatedAt: new Date()
        });
    
        // Dispatch updated summary (converted to plain object)
        dispatch(setWorkoutSummary(updatedSummary.toDictionary()));
    
        // Update Redux state with serialized logs
        dispatch(setCurrentExerciseLogs(updatedLogs.map(log => log.toDictionary())));
    
        // Find next incomplete exercise
        const nextIndex = updatedLogs.findIndex((log, index) => index > currentLogIndex && !log.logSubmitted);
        console.log(`[HomeContent completeExercise] nextIndex found: ${nextIndex}`);
        
        console.log(`[HomeContent completeExercise] Setting timeout to advance index...`);
        setTimeout(() => {
          console.log(`[HomeContent completeExercise] Timeout fired. nextIndex: ${nextIndex}`);
          if (nextIndex !== -1) {
            console.log(`[HomeContent completeExercise] Moving to next exercise index: ${nextIndex}`);
            setCurrentExerciseIndex(nextIndex);
          } else {
            console.log('[HomeContent completeExercise] No more exercises, calling completeWorkout...');
            completeWorkout(); // Call the separate completeWorkout function
          }
        }, 100); // Short delay for state updates
    
      } catch (error) {
        console.error('[HomeContent completeExercise] Error submitting exercise:', error);
      }
      console.log('[HomeContent completeExercise] Finished.'); 
    // Dependencies for useCallback
    }, [userId, currentWorkoutSession, currentExerciseLogs, currentExerciseIndex, dispatch]); 
  
    const _performBodyWeightSubmission = (updatedLogs: ExerciseLog[]) => {
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
  
  const _showZeroWeightConfirmationModal = (
    onConfirm: () => void, 
    onCancel: () => void
  ) => {
    // Implement modal logic
    // This could use a modal library or custom modal component
    const _modalProps = {
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
const completeWorkout = useCallback(async () => {
  console.log('[HomeContent completeWorkout] Starting...');
  try {
    if (!currentWorkoutSession || !currentUser) {
      console.error('[HomeContent completeWorkout] Missing required data for workout completion');
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
      console.log('[HomeContent completeWorkout] Workout complete, navigating to summary...');
      dispatch(setWorkoutSummary(result.workoutSummary));
      dispatch(setCurrentWorkout(null));
      dispatch(setCurrentExerciseLogs([]));
      setCurrentExerciseIndex(0);

      router.push(`/workout/${currentUser?.username}/${currentWorkoutSession.id}/${result.workoutSummary.id}`);

    }

  } catch (error) {
    console.error('Error completing workout:', error);
  }
  console.log('[HomeContent completeWorkout] Finished.');
}, [currentWorkoutSession, currentUser, dispatch, router]);

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
        console.log('🚫 [handleCancelWorkout] Starting workout cancellation...');
        const summary = workoutSummary ? new WorkoutSummary(workoutSummary) : null;
        await workoutService.cancelWorkout(currentWorkoutSession, summary);
        setCurrentExerciseIndex(0);
        console.log('🚫 [handleCancelWorkout] Workout cancelled successfully, navigating to home...');
        
        // Navigate back to home page after successful cancellation
        router.push('/');
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
        // Add this log before returning the component
        const logDataForInspection = currentExerciseLogs?.[currentExerciseIndex];
        console.log(
          `[HomeContent renderWorkoutView] Inspecting data for index ${currentExerciseIndex}:`,
          {
            logExists: !!logDataForInspection,
            exerciseName: logDataForInspection?.exercise?.name,
            screenTime: logDataForInspection?.exercise?.category?.details?.screenTime,
            fullLog: logDataForInspection // Log the full plain object from Redux
          }
        );
        return (
          <InProgressExercise
            exercises={currentExerciseLogs || []}
            currentExerciseLogs={currentExerciseLogs || []}
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

  // Main render logic
  return (
    <div className="min-h-screen bg-zinc-900">
      {currentWorkoutSession ? (
        renderWorkoutView()
      ) : (
        <>
          {/* Smart App Banner - Top variant for iOS users */}
          <SmartAppBanner variant="top" />
          
          {/* Side/Bottom Navigation */}
          <SideNav selectedTab={selectedTab} onTabChange={setSelectedTab} onAbout={onAbout} />
          
          {/* Main Content - Add top padding when banner is visible on iOS */}
          <div className="md:ml-20 lg:ml-64 pb-16 md:pb-0">
            {renderContent()}
          </div>

        </>
      )}
    </div>
  );
};

export default HomeContent;