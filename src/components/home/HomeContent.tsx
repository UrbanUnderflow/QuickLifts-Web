import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import SideNav from '../Navigation/SideNav';
import Discover from '../App/RootScreens/Discover';
import Search from '../App/RootScreens/Search';
import Create from '../App/RootScreens/Create';
import Message from '../App/RootScreens/Message';
import Profile from '../App/RootScreens/Profile';
import WorkoutReadyView from '../WorkoutReadyView';
import InProgressExercise from '../App/InProgressExercise/InProgressExercise';
import SmartAppBanner from '../SmartAppBanner';
import { SelectedRootTabs } from '../../types/DashboardTypes';
import { RootState } from '../../redux/store';
import { ExerciseLog } from '../../api/firebase/exercise/types';
import {
  Workout,
  WorkoutStatus,
  WorkoutSummary,
  RepsAndWeightLog,
} from '../../api/firebase/workout/types';
import { workoutService } from '../../api/firebase/workout/service';
import { workoutSessionService } from '../../api/firebase/workoutSession/service';
import { User } from '../../api/firebase/user/types';
import { useCurrentWorkout, useCurrentExerciseLogs } from '../../hooks/useWorkout';
import { db } from '../../api/firebase/config';
import { dateToUnixTimestamp } from '../../utils/formatDate';
import {
  setCurrentWorkout,
  setCurrentExerciseLogs,
  setWorkoutSummary,
} from '../../redux/workoutSlice';

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
  const workoutSummary = useSelector((state: RootState) => state.workout.workoutSummary);

  const dispatch = useDispatch();

  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query?.tab;
    const tab = Array.isArray(raw) ? raw[0] : raw;
    if (!tab) return;

    const normalized = String(tab).toLowerCase();
    switch (normalized) {
      case 'discover':
      case 'home':
        setSelectedTab(SelectedRootTabs.Discover);
        break;
      case 'search':
        setSelectedTab(SelectedRootTabs.Search);
        break;
      case 'create':
        setSelectedTab(SelectedRootTabs.Create);
        break;
      case 'messages':
        setSelectedTab(SelectedRootTabs.Messages);
        break;
      case 'profile':
        setSelectedTab(SelectedRootTabs.Profile);
        break;
      default:
        break;
    }
  }, [router.isReady, router.query?.tab]);

  useEffect(() => {
    console.log('[HomeContent Log Listener Effect] Running effect...');
    if (!userId || !currentWorkoutSession?.id) {
      console.log('[HomeContent Log Listener Effect] No userId or workoutId, skipping listener setup.');
      if (!currentWorkoutSession?.id) {
        dispatch(setCurrentExerciseLogs([]));
      }
      return () => {};
    }

    const workoutId = currentWorkoutSession.id;
    console.log(`[HomeContent Log Listener Effect] Setting up listener for userId: ${userId}, workoutId: ${workoutId}`);

    const logsRef = collection(db, 'users', userId, 'workoutSessions', workoutId, 'logs');
    const unsubscribe = onSnapshot(
      logsRef,
      (querySnapshot) => {
        console.log(`[HomeContent Log Listener Effect] Snapshot received. ${querySnapshot.docs.length} logs found.`);
        const updatedLogs = querySnapshot.docs.map((docSnap) => {
          const logInstance = new ExerciseLog({ id: docSnap.id, ...docSnap.data() });
          return logInstance.toDictionary();
        });

        console.log('[HomeContent Log Listener Effect] Dispatching updated logs (serialized):', updatedLogs);
        dispatch(setCurrentExerciseLogs(updatedLogs));
      },
      (error) => {
        console.error('[HomeContent Log Listener Effect] Error listening to logs:', error);
        dispatch(setCurrentExerciseLogs([]));
      }
    );

    return () => {
      console.log(`[HomeContent Log Listener Effect] Cleaning up listener for workoutId: ${workoutId}`);
      unsubscribe();
    };
  }, [userId, currentWorkoutSession?.id, dispatch]);

  const _startWorkout = (workout: Workout, logs: ExerciseLog[]) => {
    dispatch(setCurrentWorkout(workout.toDictionary()));
    dispatch(setCurrentExerciseLogs(logs.map((log) => log.toDictionary())));
  };

  const beginWorkout = async () => {
    if (currentWorkoutSession && userId) {
      const workoutId = currentWorkoutSession.id;
      console.log(`[HomeContent beginWorkout] Starting workout. User: ${userId}, Session: ${workoutId}`);

      const updatedWorkoutDataForRedux = {
        ...currentWorkoutSession,
        workoutStatus: WorkoutStatus.InProgress,
        startTime: new Date(),
        updatedAt: new Date(),
      };

      dispatch(setCurrentWorkout(new Workout(updatedWorkoutDataForRedux).toDictionary()));

      try {
        const workoutSessionRef = doc(db, 'users', userId, 'workoutSessions', workoutId);
        await updateDoc(workoutSessionRef, {
          workoutStatus: WorkoutStatus.InProgress,
          startTime: dateToUnixTimestamp(updatedWorkoutDataForRedux.startTime),
          updatedAt: dateToUnixTimestamp(updatedWorkoutDataForRedux.updatedAt),
        });
        console.log(`[HomeContent beginWorkout] Firestore document updated for session ${workoutId}`);
      } catch (error) {
        console.error(`[HomeContent beginWorkout] Error updating Firestore for session ${workoutId}:`, error);
      }
    } else {
      console.error('[HomeContent beginWorkout] Cannot begin workout: Missing workout session or userId.');
    }
  };

  useEffect(() => {
    console.log('[HomeContent Effect] Redux currentExerciseLogs changed:', currentExerciseLogs);
  }, [currentExerciseLogs]);

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
          const collections = await workoutService.getCollectionsByIds(currentWorkoutSession.collectionId);

          for (const collection of collections) {
            const isWorkoutInSweatlist = collection.sweatlistIds.some(
              (sweatlist) => sweatlist.id === currentWorkoutSession.id
            );

            if (isWorkoutInSweatlist && collection.challenge?.id) {
              const userChallenges = await workoutService.fetchUserChallengesByChallengeId(collection.challenge.id);
              if (userChallenges.length > 0) {
                userChallenge = userChallenges[0];
                break;
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

  const completeExercise = useCallback(async () => {
    console.log('[HomeContent completeExercise] Starting...');
    if (!currentWorkoutSession || !currentExerciseLogs.length || !userId) {
      console.error('[HomeContent completeExercise] No active workout, logs, or userId');
      return;
    }

    try {
      const currentLogIndex = currentExerciseIndex;
      const updatedLogs = [...currentExerciseLogs];

      if (currentLogIndex < 0 || currentLogIndex >= updatedLogs.length) {
        console.error('[HomeContent completeExercise] Invalid currentExerciseIndex:', currentLogIndex);
        return;
      }

      updatedLogs[currentLogIndex] = new ExerciseLog({
        ...updatedLogs[currentLogIndex],
        logSubmitted: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      await workoutService.updateWorkoutLogs({
        userId,
        workoutId: currentWorkoutSession.id,
        logs: [updatedLogs[currentLogIndex]],
      });

      const updatedSummary = new WorkoutSummary({
        id: currentWorkoutSession.id,
        workoutId: currentWorkoutSession.id,
        userId,
        exercises: updatedLogs.map((log) => log),
        bodyParts: currentWorkoutSession.fetchPrimaryBodyParts ? currentWorkoutSession.fetchPrimaryBodyParts() : [],
        secondaryBodyParts: currentWorkoutSession.fetchSecondaryBodyParts ? currentWorkoutSession.fetchSecondaryBodyParts() : [],
        workoutTitle: currentWorkoutSession.title,
        exercisesCompleted: updatedLogs.filter((log) => log.logSubmitted),
        isCompleted: false,
        startTime: currentWorkoutSession.startTime || new Date(),
        createdAt: currentWorkoutSession.createdAt || new Date(),
        updatedAt: new Date(),
      });

      dispatch(setWorkoutSummary(updatedSummary.toDictionary()));
      dispatch(setCurrentExerciseLogs(updatedLogs.map((log) => log.toDictionary())));

      const nextIndex = updatedLogs.findIndex((log, index) => index > currentLogIndex && !log.logSubmitted);
      console.log(`[HomeContent completeExercise] nextIndex found: ${nextIndex}`);

      console.log('[HomeContent completeExercise] Setting timeout to advance index...');
      setTimeout(() => {
        console.log(`[HomeContent completeExercise] Timeout fired. nextIndex: ${nextIndex}`);
        if (nextIndex !== -1) {
          console.log(`[HomeContent completeExercise] Moving to next exercise index: ${nextIndex}`);
          setCurrentExerciseIndex(nextIndex);
        } else {
          console.log('[HomeContent completeExercise] No more exercises, calling completeWorkout...');
          completeWorkout();
        }
      }, 100);
    } catch (error) {
      console.error('[HomeContent completeExercise] Error submitting exercise:', error);
    }
    console.log('[HomeContent completeExercise] Finished.');
  }, [userId, currentWorkoutSession, currentExerciseLogs, currentExerciseIndex, dispatch, completeWorkout]);

  const _performBodyWeightSubmission = (updatedLogs: ExerciseLog[]) => {
    const updatedLogsWithBodyWeight = updatedLogs.map(
      (log) =>
        new ExerciseLog({
          ...log,
          logs: log.logs.map(
            (logItem) =>
              new RepsAndWeightLog({
                ...logItem,
                weight: 0,
                isBodyWeight: true,
                reps: logItem.reps || 0,
              })
          ),
        })
    );

    return performExerciseSubmission(updatedLogsWithBodyWeight);
  };

  const _showZeroWeightConfirmationModal = (onConfirm: () => void, onCancel: () => void) => {
    const _modalProps = {
      isOpen: true,
      title: 'Zero Weight Detected',
      message:
        "You haven't added any weight lifted to this exercise. Without this, your analytics won't include detailed tracking for this exercise, but you'll still see it marked as completed. Do you want to proceed?",
      onConfirm: () => {
        onConfirm();
      },
      onCancel: () => {
        onCancel();
      },
    };
  };

  const performExerciseSubmission = async (updatedLogs: ExerciseLog[]) => {
    try {
      if (currentWorkoutSession && userId) {
        await workoutService.updateWorkoutLogs({
          userId,
          workoutId: currentWorkoutSession.id,
          logs: updatedLogs,
        });

        workoutSessionService.completedExercises = updatedLogs;
        dispatch(setCurrentExerciseLogs(updatedLogs.map((log) => log.toDictionary())));

        if (currentExerciseIndex < updatedLogs.length - 1) {
          setCurrentExerciseIndex((prev) => prev + 1);
        } else {
          await completeWorkout();
        }
      }
    } catch (error) {
      console.error('Error submitting exercise:', error);
    }
  };

  const handleCancelWorkout = async () => {
    if (currentWorkoutSession && userId) {
      try {
        console.log('🚫 [handleCancelWorkout] Starting workout cancellation...');
        const summary = workoutSummary ? new WorkoutSummary(workoutSummary) : null;
        await workoutService.cancelWorkout(currentWorkoutSession, summary);
        setCurrentExerciseIndex(0);
        console.log('🚫 [handleCancelWorkout] Workout cancelled successfully');

        if (router.pathname !== '/') {
          router.push('/');
        }
      } catch (error) {
        console.error('Error canceling workout:', error);
      }
    }
  };

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
      case WorkoutStatus.InProgress: {
        const logDataForInspection = currentExerciseLogs?.[currentExerciseIndex];
        console.log(`[HomeContent renderWorkoutView] Inspecting data for index ${currentExerciseIndex}:`, {
          logExists: !!logDataForInspection,
          exerciseName: logDataForInspection?.exercise?.name,
          screenTime: logDataForInspection?.exercise?.category?.details?.screenTime,
          fullLog: logDataForInspection,
        });
        return (
          <InProgressExercise
            exercises={currentExerciseLogs || []}
            currentExerciseLogs={currentExerciseLogs || []}
            currentExerciseIndex={currentExerciseIndex}
            onComplete={completeExercise}
            onClose={handleCancelWorkout}
            onExerciseSelect={setCurrentExerciseIndex}
            workoutExercises={currentWorkoutSession?.exercises || []}
          />
        );
      }
      default:
        return null;
    }
  };

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

  return (
    <div className="min-h-screen bg-zinc-900">
      {currentWorkoutSession ? (
        renderWorkoutView()
      ) : (
        <>
          <SmartAppBanner variant="top" />
          <SideNav selectedTab={selectedTab} onTabChange={setSelectedTab} onAbout={onAbout} />
          <div className="md:ml-20 lg:ml-64 pb-16 md:pb-0">{renderContent()}</div>
        </>
      )}
    </div>
  );
};

export default HomeContent;
