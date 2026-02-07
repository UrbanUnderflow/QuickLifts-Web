import React, { useEffect, useState } from 'react';
import { Calendar, ChevronDown, Users, Clock, Flag, Share2, Map as MapIcon, Flame, Target, TrendingUp } from 'lucide-react';
import { SweatlistCollection, SweatlistIdentifiers } from '../../api/firebase/workout/types';
import {
  ChallengeStatus,
  UserChallenge,
  Challenge,
  ChallengeType,
  RunRoundTypeInfo,
  RunLeaderboardMetricInfo
} from '../../api/firebase/workout/types';
import { StackCard, RestDayCard } from '../../components/Rounds/StackCard';
import { Workout, WorkoutStatus, BodyZone } from '../../api/firebase/workout/types';
import { Exercise, ExerciseReference } from '../../api/firebase/exercise/types';
import ParticipantsSection from '../../components/Rounds/ParticipantsSection';
import RunRoundLeaderboard from '../../components/Rounds/RunRoundLeaderboard';
import RoundChatView from '../../components/Rounds/RoundChatView';
import { GroupMessage, MessageMediaType } from '../../api/firebase/chat/types';
import { workoutService } from '../../api/firebase/workout/service';
import { userService, User } from '../../api/firebase/user';
import { useRouter } from 'next/router';
import { RootState } from '../../redux/store';
import { useSelector, useDispatch } from 'react-redux';
import { showLoader, hideLoader } from '../../redux/loadingSlice';
import { collection as firestoreCollection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { ExerciseVideo } from '../../api/firebase/exercise/types';

import { ChatService } from '../../api/firebase/chat/service';
import { ChallengeWaitingRoomView, ChallengeWaitingRoomViewModel } from '../../components/Rounds/ChallengeWaitingRoomView'
import { showToast } from '../../redux/toastSlice';

const ChallengeDetailView = () => {
  const router = useRouter();
  const { id } = router.query;
  const dispatch = useDispatch();

  const [collection, setCollection] = useState<SweatlistCollection | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[] | null>(null);
  const [showWaitingRoomAsOwner, setShowWaitingRoomAsOwner] = useState(false);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatExpanded, setChatExpanded] = useState(true);

  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [hosts, setHosts] = useState<User[]>([]);

  const { currentUser } = useSelector((state: RootState) => state.user);

  // 2. Fetch the host users using the collection.ownerId once the collection is loaded:
  useEffect(() => {
    if (collection && collection.ownerId && collection.ownerId.length > 0) {
      userService.getUsersByIds(collection.ownerId)
        .then(setHosts)
        .catch(err => console.error("Error fetching hosts:", err));
    }
  }, [collection]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (collection?.challenge?.id) {
        try {
          const messages = await ChatService.getInstance().fetchChallengeMessages(collection.challenge.id);
          setMessages(messages);
          calculateUnread(messages);
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      }
    };

    fetchMessages();
    const unsubscribe = setupRealtimeUpdates();
    return () => unsubscribe();
  }, [collection?.challenge?.id]);

  useEffect(() => {
    if (collection?.challenge?.id && currentUser) {
      const unreadMessages = messages.filter(msg => !msg.readBy[currentUser.id]);
      if (unreadMessages.length > 0) {
        ChatService.getInstance().markMessagesAsRead(
          collection.challenge.id,
          currentUser.id,
          unreadMessages.map(msg => msg.id)
        );
      }
    }
  }, [messages, collection?.challenge?.id, currentUser]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      console.log('[ChallengeDetailView] Starting fetchData for id:', id);
      dispatch(showLoader({ message: 'Loading Round Details...' }));

      try {
        // First try to fetch the collection directly with the ID
        let collectionData = await workoutService.getCollectionById(id as string);
        console.log('[ChallengeDetailView] Fetched collectionData attempt 1:', collectionData);

        // If that fails, try to fetch the user challenge and then get the collection
        if (!collectionData) {
          const userChallenge = await workoutService.fetchUserChallengeById(id as string);
          console.log('[ChallengeDetailView] Fetched userChallenge:', userChallenge);
          if (userChallenge && userChallenge.challengeId) {
            collectionData = await workoutService.getCollectionById(userChallenge.challengeId);
            console.log('[ChallengeDetailView] Fetched collectionData attempt 2:', collectionData);
          }
        }

        console.log("[ChallengeDetailView] Final collection data:", { ...collectionData });
        if (!collectionData || !collectionData.challenge) {
          console.error('[ChallengeDetailView] Invalid challenge data received');
          throw new Error('Invalid challenge data received');
        }

        setCollection(collectionData);

        // Wrap fetchWorkouts in its own try...catch
        try {
          console.log('[ChallengeDetailView] Attempting to call fetchWorkouts');
          await fetchWorkouts(collectionData);
          console.log('[ChallengeDetailView] Successfully completed fetchWorkouts');
        } catch (fetchWorkoutsError) {
          console.error('[ChallengeDetailView] Error during fetchWorkouts:', fetchWorkoutsError);
          setError('Failed to load workout details.'); // Set specific error
          // Optionally re-throw or handle differently if needed
        }

        // Wrap fetchUserChallenge in its own try...catch
        if (collectionData.challenge.id) {
          try {
            console.log('[ChallengeDetailView] Attempting to call fetchUserChallenge for challengeId:', collectionData.challenge.id);
            await fetchUserChallenge(collectionData.challenge.id);
            console.log('[ChallengeDetailView] Successfully completed fetchUserChallenge');
          } catch (fetchUserChallengeError) {
            console.error('[ChallengeDetailView] Error during fetchUserChallenge:', fetchUserChallengeError);
            setError('Failed to load participant details.'); // Set specific error
            // Optionally re-throw or handle differently if needed
          }
        }
      } catch (err) {
        console.error('[ChallengeDetailView] Error in fetchData:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        console.log('[ChallengeDetailView] Fetch complete, hiding loader');
        dispatch(hideLoader());
      }
    };

    if (router.isReady && id) {
      fetchData();
    }
    return () => {
      dispatch(hideLoader());
    };
  }, [id, router.isReady, dispatch]);

  const setupRealtimeUpdates = () => {
    return ChatService.getInstance().subscribeToMessages(collection?.challenge?.id || '', (newMessages) => {
      setMessages(newMessages);
      calculateUnread(newMessages);
    });
  };

  const calculateUnread = (messages: GroupMessage[]) => {
    const count = messages.filter(msg =>
      !msg.readBy[currentUser?.id || '']
    ).length;
    setUnreadCount(count);
  };

  const fetchUserChallenge = async (challengeId: string) => {
    if (!challengeId) return;

    setParticipantsLoading(true);
    const maxRetries = 3;
    let retries = 0;
    console.log(`[ChallengeDetailView] fetchUserChallenge starting for challengeId: ${challengeId}`); // Log start

    const tryFetch = async (): Promise<void> => {
      try {
        const userChallenges = await workoutService.fetchUserChallengesByChallengeId(challengeId);
        setUserChallenges(userChallenges);
      } catch (error) {
        console.error(`Error fetching user challenge (attempt ${retries + 1}):`, error);
        if (retries < maxRetries) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          await tryFetch();
        } else {
          console.error('Max retries reached. Failed to fetch user challenge.');
          setError('Failed to load participants. Please try refreshing the page.');
        }
      } finally {
        setParticipantsLoading(false);
      }
    };

    await tryFetch();
    console.log(`[ChallengeDetailView] fetchUserChallenge finished for challengeId: ${challengeId}`); // Log end
  };

  const fetchWorkouts = async (collectionData: SweatlistCollection) => {
    console.log('[ChallengeDetailView] fetchWorkouts optimized starting with video mapping');
    if (!collectionData || !collectionData.sweatlistIds || collectionData.sweatlistIds.length === 0) {
      setWorkouts([]);
      console.log('[ChallengeDetailView] No sweatlist IDs found.');
      return;
    }

    // --- Step 2: Fetch all exercise videos --- 
    let allExerciseVideos: ExerciseVideo[] = [];
    try {
      const videoSnapshot = await getDocs(firestoreCollection(db, 'exerciseVideos'));
      allExerciseVideos = videoSnapshot.docs.map(doc => new ExerciseVideo({ id: doc.id, ...doc.data() }));
      console.log(`[ChallengeDetailView] Fetched ${allExerciseVideos.length} exercise videos.`);
    } catch (videoError) {
      console.error('[ChallengeDetailView] Error fetching exercise videos:', videoError);
      // Decide how to proceed - maybe show workouts without videos or show error
      setError('Failed to load exercise video data.');
    }
    // ----------------------------------------

    const workoutIdsToFetch: string[] = [];
    const restDayPlaceholders: { index: number; idInfo: SweatlistIdentifiers }[] = [];

    // 1. Separate IDs and identify rest days
    collectionData.sweatlistIds.forEach((idInfo, index) => {
      const name = idInfo.sweatlistName || (idInfo as any).id;
      const id = idInfo.id;
      if (name === "Rest" || id === "rest") {
        restDayPlaceholders.push({ index, idInfo });
      } else if (id && id !== "rest") {
        workoutIdsToFetch.push(id);
      }
    });

    // 3. Batch IDs and Fetch Workouts from 'stacks'
    const MAX_IN_QUERY_SIZE = 30;
    const fetchedDocsData: any[] = [];
    for (let i = 0; i < workoutIdsToFetch.length; i += MAX_IN_QUERY_SIZE) {
      const chunkOfIds = workoutIdsToFetch.slice(i, i + MAX_IN_QUERY_SIZE);
      if (chunkOfIds.length > 0) {
        try {
          const stacksCollectionRef = firestoreCollection(db, 'stacks');
          const q = query(stacksCollectionRef, where(documentId(), 'in', chunkOfIds));
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(doc => fetchedDocsData.push({ id: doc.id, ...doc.data() }));
        } catch (batchError) {
          console.error(`[ChallengeDetailView] Error fetching workout batch:`, batchError);
          setError(`Failed to fetch some workouts.`);
        }
      }
    }

    // 4. Instantiate Initial Workouts
    const fetchedWorkoutsMap: Map<string, Workout> = new Map();
    fetchedDocsData.forEach(data => {
      try {
        const workoutInstance = new Workout(data);
        fetchedWorkoutsMap.set(data.id, workoutInstance);
      } catch (instantiationError) {
        console.error(`[ChallengeDetailView] Error instantiating workout ${data.id}:`, instantiationError);
      }
    });

    // --- Step 5: Map Videos to Exercises in each Fetched Workout --- 
    fetchedWorkoutsMap.forEach(workoutInstance => {
      if (workoutInstance.exercises && Array.isArray(workoutInstance.exercises)) {
        workoutInstance.exercises = workoutInstance.exercises.map(exerciseRef => {
          if (!exerciseRef || !exerciseRef.exercise) return exerciseRef; // Skip if structure is wrong

          const currentExercise = exerciseRef.exercise;
          const exerciseNameLower = currentExercise.name?.toLowerCase().trim();

          const matchingVideos = allExerciseVideos.filter(
            video => video.exercise?.toLowerCase().trim() === exerciseNameLower
          );

          // Create a *new* Exercise instance including the videos
          const exerciseWithVideos = new Exercise({
            ...currentExercise, // Spread original data
            videos: matchingVideos // Add the filtered videos
          });

          // Return a new ExerciseReference with the updated Exercise instance
          return new ExerciseReference({
            ...exerciseRef, // Keep original groupId etc.
            exercise: exerciseWithVideos
          });
        });
      }
    });
    console.log(`[ChallengeDetailView] Completed mapping videos to ${fetchedWorkoutsMap.size} workouts.`);
    // -------------------------------------------------------------

    // 6 & 7. Combine Fetched (with videos), Rest Days, Handle Missing
    const finalWorkouts: Workout[] = collectionData.sweatlistIds.map((idInfo, index) => {
      const name = idInfo.sweatlistName || (idInfo as any).id;
      const id = idInfo.id;

      if (name === "Rest" || id === "rest") {
        // Create rest workout placeholder
        return new Workout({
          id: "rest", roundWorkoutId: `rest-${index}`,
          title: "Rest Day", description: "Recovery day",
          author: idInfo.sweatlistAuthorId || currentUser?.id || '',
          exercises: [], logs: [], duration: 0, useAuthorContent: true, isCompleted: false,
          workoutStatus: WorkoutStatus.QueuedUp, createdAt: new Date(), updatedAt: new Date(),
          zone: BodyZone.FullBody, order: index
        });
      } else if (id && fetchedWorkoutsMap.has(id)) {
        // Get the workout instance (which now has videos mapped)
        const workoutWithVideos = fetchedWorkoutsMap.get(id)!;
        // Ensure order is preserved/added correctly
        const workoutDataForConstructor = { ...workoutWithVideos, order: index };
        return new Workout(workoutDataForConstructor);
      } else {
        console.warn(`[ChallengeDetailView] Workout data not found for ID: ${id}. Rendering placeholder.`);
        return new Workout({
          id: id || `missing-${index}`, title: "Workout Not Found", order: index,
          author: idInfo.sweatlistAuthorId || currentUser?.id || '',
          exercises: [], logs: [], duration: 0, useAuthorContent: false, isCompleted: false,
          workoutStatus: WorkoutStatus.Archived, createdAt: new Date(), updatedAt: new Date(),
          zone: BodyZone.FullBody
        });
      }
    }).filter((w): w is Workout => w !== null);

    // 8. Update State
    setWorkouts(finalWorkouts);
    console.log('[ChallengeDetailView] fetchWorkouts optimized finished with video mapping');
  };

  const formatDate = (date: Date | string | number): string => {
    // If it's a timestamp (number), convert to milliseconds if needed
    const dateObj = typeof date === 'number'
      ? new Date(date * 1000) // Convert seconds to milliseconds
      : new Date(date);

    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateProgress = (): number => {
    if (!collection?.challenge?.startDate || !collection?.challenge?.endDate) return 0;

    const start = new Date(collection.challenge.startDate);
    const end = new Date(collection.challenge.endDate);
    const now = new Date();
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();

    return Math.min(Math.max(elapsed / totalDuration, 0), 1);
  };

  // And update the daysInfo calculation too
  // Then use it for daysInfo calculation
  const calculateDays = () => {
    if (!collection?.challenge?.startDate || !collection?.challenge?.endDate) return null;

    const start = new Date(collection.challenge.startDate);
    const end = new Date(collection.challenge.endDate);
    const now = new Date();

    if (now < start) {
      const days = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { type: 'until-start', days };
    } else if (now < end) {
      const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { type: 'remaining', days };
    } else {
      return { type: 'ended', days: 0 };
    }
  };

  const toggleChatExpansion = () => {
    setChatExpanded(!chatExpanded);
  };

  const handleSwapOrder = async (workout: Workout, newOrder: number) => {
    // Implement workout reordering logic
    try {
      // Update order in backend
      // await workoutService.updateWorkoutOrder(workout.id, newOrder);
      // Refetch workouts to show updated order
      if (collection) {
        await fetchWorkouts(collection);
      }
    } catch (error) {
      console.error('Failed to update workout order:', error);
    }
  };

  const handleCalendarTap = async (workout: Workout, date: Date) => {
    // Implement calendar scheduling logic
    try {
      // await workoutService.scheduleWorkout(workout.id, date);
      // Optionally refresh data
    } catch (error) {
      console.error('Failed to schedule workout:', error);
    }
  };

  const handleSendMessage = async (message: string, image?: File) => {
    if (!collection?.challenge?.id || !currentUser) return;

    try {
      let mediaUrl: string | null = null;
      if (image) {
        mediaUrl = await ChatService.getInstance().uploadMedia(image);
        if (!mediaUrl) {
          console.error('Failed to upload image');
          return; // Or handle this case as appropriate for your app
        }
      }

      const messageData: Omit<GroupMessage, 'id'> = {
        sender: currentUser.toShortUser(),
        content: message,
        timestamp: new Date(),
        readBy: {},
        mediaURL: mediaUrl,
        mediaType: image ? MessageMediaType.Image : MessageMediaType.None,
        checkinId: null,
        gymName: null
      };

      await ChatService.getInstance().sendMessage(collection.challenge.id, messageData);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // --- Share Handler (Updated with full logic) ---
  const handleShare = async () => {
    if (!currentUser) {
      dispatch(showToast({ message: "Please log in or sign up to share!", type: 'warning' }));
      return;
    }
    if (!collection) {
      dispatch(showToast({ message: "Cannot generate share link: Challenge data not loaded.", type: 'error' }));
      return;
    }

    // Find the current user's challenge data from the state array
    const currentUserChallenge = userChallenges?.find(uc => uc.userId === currentUser.id);
    console.log('[ChallengeDetailView] currentUserChallenge', currentUserChallenge);

    if (!currentUserChallenge) {
      // Only warn if userChallenge data isn't loaded, still allow link generation
      console.warn("UserChallenge data not available for awarding share points. Proceeding with link generation only.");
      // No toast needed here, just proceed to link generation
    } else {
      // Log the current bonus status before checking
      console.log("[Share Points] Current hasReceivedShareBonus:", currentUserChallenge.hasReceivedShareBonus);
    }

    let awardedPoints = false;

    // --- Award points logic ---
    if (currentUserChallenge && !currentUserChallenge.hasReceivedShareBonus) {
      try {
        console.log("Attempting to award first share bonus points...");
        // Deep copy for immutability
        const updatedChallengeData = JSON.parse(JSON.stringify(currentUserChallenge.toDictionary()));

        // --- Explicitly set the ID ---
        if (currentUserChallenge.id && !updatedChallengeData.id) {
          updatedChallengeData.id = currentUserChallenge.id;
          console.log(`[Share Points] Copied ID from original userChallenge: ${updatedChallengeData.id}`);
        } else if (!currentUserChallenge.id) {
          console.error("[Share Points] Original userChallenge object is missing its ID!");
          throw new Error("Original user challenge data is missing ID."); // Throw to prevent update attempt
        } else if (updatedChallengeData.id !== currentUserChallenge.id) {
          console.warn("[Share Points] Mismatch between original ID and ID after JSON processing. Using original.");
          updatedChallengeData.id = currentUserChallenge.id;
        }
        // -----------------------------

        // Update the necessary fields
        updatedChallengeData.hasReceivedShareBonus = true;
        updatedChallengeData.pulsePoints = updatedChallengeData.pulsePoints || {};
        updatedChallengeData.pulsePoints.shareBonus = (updatedChallengeData.pulsePoints.shareBonus || 0) + 25;

        // Create instance for the service call
        const challengeToUpdate = new UserChallenge(updatedChallengeData);

        // --- ID Check ---
        if (!challengeToUpdate || !challengeToUpdate.id) {
          console.error("[Share Points] Error: Invalid UserChallenge ID before update.", challengeToUpdate);
          dispatch(showToast({ message: "Could not award points: Internal error (missing ID).", type: 'error' }));
        } else {
          // --- Update in Firestore ---
          await workoutService.updateUserChallenge(challengeToUpdate);

          // --- Update local state array immutably --- 
          setUserChallenges(prevChallenges =>
            prevChallenges
              ? prevChallenges.map(p =>
                p.id === challengeToUpdate.id ? challengeToUpdate : p
              )
              : null // Keep it null if it was null
          );
          console.log("[Share Points] Updated userChallenges state with points.");

          awardedPoints = true;
          console.log("Successfully awarded share bonus points and updated state.");
          dispatch(showToast({ message: "+25 points for sharing! Keep it up!", type: 'award' }));
        }

      } catch (error: any) {
        console.error("Error awarding share bonus points:", error);
        dispatch(showToast({ message: `Couldn't award points: ${error.message || 'Unknown error'}`, type: 'error' }));
      }
    }
    // --- End award points logic ---

    let generatedUrl: string | null = null; // Declare outside the try block

    try {
      // Ensure currentUser is not null and create a User instance
      if (!currentUser) {
        console.error("Cannot generate share link: currentUser is null.");
        dispatch(showToast({ message: "Could not generate share link: User data missing.", type: 'error' }));
        return; // Exit if currentUser is null
      }
      const userInstance = new User(currentUser.id, currentUser); // Create User instance

      // Generate the link using the service with the User instance
      generatedUrl = await workoutService.generateShareableRoundLink(collection, userInstance);

      if (generatedUrl) {
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(generatedUrl);

          // Show success feedback (if points weren't already awarded)
          if (!awardedPoints) {
            dispatch(showToast({ message: "Link copied to clipboard! Ready to paste.", type: 'success' }));
          }
        } catch (clipboardError) {
          console.error('Clipboard write failed:', clipboardError);
          const manualCopyMsg = `Please copy this link manually:\n\n${generatedUrl}`;
          if (clipboardError instanceof DOMException && clipboardError.name === 'NotAllowedError') {
            dispatch(showToast({ message: `Copy failed (permission denied). ${manualCopyMsg}`, type: 'warning', duration: 6000 }));
          } else {
            dispatch(showToast({ message: `Copy failed. ${manualCopyMsg}`, type: 'warning', duration: 6000 }));
          }
        }

      } else {
        // Handle case where link generation failed
        console.error('Share link generation returned null.');
        dispatch(showToast({ message: "Could not generate the share link.", type: 'error' }));
      }
    } catch (error: any) {
      // This catch block now primarily handles errors from generateShareableRoundLink
      console.error('Error during share process (link gen/copy):', error);
      dispatch(showToast({ message: `Could not generate/copy share link: ${error.message || 'Unknown error'}`, type: 'error' }));
    }
  };
  // --- End Share Handler ---

  // Helper function to generate roundWorkoutId consistent with iOS implementation
  const generateRoundWorkoutId = (workoutId: string, index: number, isRestDay: boolean = false): string => {
    const isCohort = collection?.challenge?.id !== collection?.challenge?.originalId;
    const cohortId = collection?.id;

    if (isRestDay) {
      // Rest day format from iOS code
      return isCohort ? `rest-${cohortId}-${index}` : `rest-${index}`;
    } else {
      // Regular workout format from iOS code
      return isCohort ? `${workoutId}-${cohortId}-${index}` : `${workoutId}-${index}`;
    }
  };

  // Helper function to safely get user challenge
  const getUserChallenge = () => {
    return userChallenges && currentUser?.id
      ? userChallenges.find(uc => uc.userId === currentUser.id)
      : undefined;
  };

  // Helper to check if this is a run round
  const isRunRound = (): boolean => {
    return collection?.challenge?.challengeType === ChallengeType.Run && !!collection?.runRoundConfig;
  };

  // Helper functions for progress card stats
  const getCompletedStacksCount = (): number => {
    const userChallenge = getUserChallenge();
    if (!userChallenge) return 0;

    return userChallenge.completedWorkouts?.length || 0;
  };

  const getMissedStacksCount = (): number => {
    if (!collection?.challenge?.startDate || !workouts.length) return 0;

    const userChallenge = getUserChallenge();
    if (!userChallenge) return 0;

    const startDate = new Date(collection.challenge.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    // Days since start (excluding today)
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSinceStart <= 0) return 0;

    // Check workouts that should have been completed by now (excluding rest days)
    let missedCount = 0;
    for (let i = 0; i < Math.min(daysSinceStart, workouts.length); i++) {
      const workout = workouts[i];
      if (workout.title.toLowerCase() === 'rest') continue;

      const expectedId = generateRoundWorkoutId(workout.id, i);
      const isCompleted = userChallenge.completedWorkouts?.some(cw => cw.workoutId === expectedId) ?? false;

      if (!isCompleted) missedCount++;
    }

    return missedCount;
  };

  const computeCurrentStreak = (): number => {
    const userChallenge = getUserChallenge();
    // Use workouts array directly, ensure challenge dates are valid
    if (!userChallenge || !collection?.challenge?.startDate || !collection?.challenge?.endDate || !workouts.length) return 0;

    try {
      const startDate = new Date(collection.challenge.startDate);
      startDate.setHours(0, 0, 0, 0); // Normalize start date

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today's date

      const endDate = new Date(collection.challenge.endDate);
      endDate.setHours(0, 0, 0, 0); // Normalize end date

      let streak = 0;
      const totalWorkoutDays = workouts.length;

      // Determine the index to start checking from (today or end date)
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const startIndex = Math.min(daysSinceStart, totalWorkoutDays - 1); // Ensure index is within bounds and non-negative

      // Loop backwards from today's (or max) index
      for (let i = Math.max(0, startIndex); i >= 0; i--) {
        const workout = workouts[i]; // Get workout/rest day from the main array
        if (!workout) continue; // Safety check

        const isRestDay = workout.id === "rest"; // Check if it's a rest day placeholder

        if (isRestDay) {
          // Rest days count towards the streak
          streak++;
        } else {
          // It's a regular workout
          const expectedId = generateRoundWorkoutId(workout.id, i, false); // Generate ID for workout

          // Check if it's completed
          const isCompleted = userChallenge.completedWorkouts?.some(
            cw => cw.workoutId === expectedId
          ) ?? false;

          if (isCompleted) {
            streak++;
          } else {
            // Break at the first non-completed non-rest day
            break;
          }
        }
      }

      return streak;
    } catch (error) {
      console.error("Error computing current streak:", error);
      return 0;
    }
  };

  const computeLongestStreak = (): number => {
    const userChallenge = getUserChallenge();
    if (!userChallenge || !workouts.length) return 0;

    let currentStreak = 0;
    let longestStreak = 0;

    for (let i = 0; i < workouts.length; i++) {
      const workout = workouts[i];
      const expectedId = generateRoundWorkoutId(workout.id, i);

      // Rest days or completed workouts maintain streak
      const isRestDay = workout.title.toLowerCase() === 'rest';
      const isCompleted = userChallenge.completedWorkouts?.some(cw => cw.workoutId === expectedId) ?? false;

      if (isRestDay || isCompleted) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return longestStreak;
  };

  const getRankInLeaderboard = (): number => {
    if (!userChallenges || userChallenges.length === 0) return 0;

    const userChallenge = getUserChallenge();
    if (!userChallenge) return 0;

    // Sort users by points in descending order
    const sortedUsers = [...userChallenges].sort((a, b) =>
      (b.pulsePoints?.totalPoints || 0) - (a.pulsePoints?.totalPoints || 0)
    );

    // Find the index of the current user
    return sortedUsers.findIndex(uc => uc.userId === currentUser?.id) + 1;
  };

  const getMotivationalMessage = (completedCount: number): string => {
    if (completedCount === 0) {
      return "Ready to start your journey! Let's crush this round together! 💪";
    } else if (completedCount === 1) {
      return "Great start! Keep the momentum going! 🎯";
    } else if (completedCount <= 3) {
      return "You're building a strong foundation! Keep pushing! 🔥";
    } else if (completedCount <= 6) {
      return "You're on fire! Amazing dedication! 🚀";
    } else if (completedCount <= 10) {
      return "Incredible commitment! You're crushing this round! ⭐";
    } else {
      return "You're unstoppable! Phenomenal work! 🏆";
    }
  };

  // Create a function to render the stat blocks
  const renderStatBlock = (icon: string, iconColor: string, value: string, label: string) => {
    return (
      <div className="flex flex-col items-center">
        <div className={`flex items-center justify-center mb-1`}>
          <i className={`${icon} text-${iconColor} text-xl`}></i>
        </div>
        <div className="text-white font-bold text-lg">{value}</div>
        <div className="text-zinc-400 text-xs">{label}</div>
      </div>
    );
  };

  if (error) {
    return <div className="flex items-center justify-center min-h-screen text-red-500">Error: {error}</div>;
  }

  if (!collection) {
    return <div className="flex items-center justify-center min-h-screen">Challenge not found or invalid.</div>;
  }

  const daysInfo = calculateDays();
  const progress = calculateProgress();
  const isOwner = !!collection && !!currentUser && collection.ownerId.includes(currentUser.id);
  const challengeHasStarted = collection?.challenge?.startDate
    ? new Date() >= new Date(collection.challenge.startDate)
    : false;
  const shouldShowWaitingRoomForNonOwner =
    collection &&
    currentUser &&
    !isOwner &&
    (collection.challenge?.status === ChallengeStatus.Draft || !challengeHasStarted);

  console.log('[ChallengeDetailView] shouldShowWaitingRoomForNonOwner result:', shouldShowWaitingRoomForNonOwner);
  console.log('[ChallengeDetailView] showWaitingRoomAsOwner:', showWaitingRoomAsOwner);

  if (shouldShowWaitingRoomForNonOwner || (isOwner && showWaitingRoomAsOwner)) {
    // Create a minimal waiting room view model:
    const waitingRoomVM: ChallengeWaitingRoomViewModel = {
      challenge: collection?.challenge || null,
      challengeDetailViewModel: { collection: collection! },
      fetchChatMessages: () => {
        if (collection?.challenge?.id) {
          ChatService.getInstance()
            .fetchChallengeMessages(collection.challenge.id)
            .then(() => { })
            .catch((err: any) => console.error('Error fetching messages in VM:', err));
        } else {
          console.warn('Cannot fetch messages, challenge ID is missing.');
        }
      },
      joinChallenge: (challenge: Challenge, completion: (uc: UserChallenge | null) => void) => {
        if (!currentUser) {
          console.error("Cannot join challenge, user not logged in.");
          completion(null);
          return;
        }
        workoutService.joinChallenge({ username: currentUser.username, challengeId: challenge.id })
          .then(() => {
            completion(null);
          })
          .catch((err: any) => {
            console.error('Error joining challenge:', err);
            completion(null);
          });
      },
    };

    return (
      <ChallengeWaitingRoomView
        viewModel={waitingRoomVM}
        initialParticipants={userChallenges || []}
        isOwner={isOwner}
        setShowWaitingRoomAsOwner={setShowWaitingRoomAsOwner}
      />
    );
  }

  console.log('[ChallengeDetailView] Rendering Main Challenge View');
  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="h-48 bg-gradient-to-b from-zinc-800 to-zinc-900" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-24">
          {/* Header Section */}
          <div className="mt-4 text-white">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold">{collection?.challenge?.title}</h1>
                <p className="text-zinc-400 mt-1">{collection?.challenge?.subtitle}</p>
                {isOwner && (
                  <button
                    onClick={() => setShowWaitingRoomAsOwner(!showWaitingRoomAsOwner)}
                    className="mt-2 px-3 py-1 bg-[#E0FE10] text-black text-sm font-semibold rounded hover:bg-opacity-80 transition-colors"
                  >
                    {showWaitingRoomAsOwner ? 'View Owner Dashboard' : 'View Waiting Room'}
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <ChevronDown className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Date Range Cards */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-zinc-400 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Starts</span>
                </div>
                <div className="text-lg font-semibold">
                  {collection?.challenge?.startDate ? formatDate(collection.challenge.startDate) : 'TBD'}
                </div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="flex items-center space-x-2 text-zinc-400 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Ends</span>
                </div>
                <div className="text-lg font-semibold">
                  {collection?.challenge?.endDate ? formatDate(collection.challenge.endDate) : 'TBD'}
                </div>
              </div>
            </div>

            {hosts.length > 0 && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold text-white">Hosted by</h2>
                <div className="flex space-x-4 mt-2 overflow-x-auto">
                  {hosts.map((host) => (
                    <div key={host.id} className="flex flex-col items-center">
                      <img
                        src={host.profileImage.profileImageURL}
                        alt={host.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <span className="text-sm text-gray-300">@{host.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress Card */}
            <div className="mt-6 bg-zinc-800 rounded-xl overflow-hidden">
              {/* Header section with user profile and title */}
              <div className="flex items-center p-4 pb-2">
                {/* User profile image */}
                {currentUser?.profileImage?.profileImageURL ? (
                  <img
                    src={currentUser.profileImage.profileImageURL}
                    alt={currentUser.username || 'User'}
                    className="w-10 h-10 rounded-full border-2 border-[#E0FE10]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#E0FE10]/30 flex items-center justify-center">
                    <span className="text-[#E0FE10] font-bold text-lg">
                      {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}

                <div className="ml-4">
                  <h3 className="text-white font-semibold">Your Progress</h3>
                  <p className="text-zinc-400 text-sm">
                    {daysInfo?.type === 'until-start'
                      ? `${daysInfo.days} Days Until Start`
                      : daysInfo?.type === 'remaining'
                        ? `${daysInfo.days} Days Left`
                        : 'Challenge Ended'}
                  </p>
                </div>

                <div className="ml-auto">
                  <button className="text-[#E0FE10] hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Progress indicators section */}
              <div className="flex p-4 pt-2 pb-6">
                {/* Progress Circular Chart */}
                <div className="relative w-24 h-24 flex-shrink-0">
                  {/* Background circle */}
                  <div className="absolute inset-0 rounded-full border-4 border-zinc-700"></div>

                  {/* Progress arc - using conic-gradient */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(#E0FE10 0% ${Math.round(calculateProgress() * 100)}%, transparent ${Math.round(calculateProgress() * 100)}% 100%)`,
                      borderRadius: '50%',
                      border: '4px solid #E0FE10',
                      clipPath: 'circle(50% at center)'
                    }}
                  ></div>

                  {/* Inner content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[#E0FE10] text-xl font-bold">{Math.round(calculateProgress() * 100)}%</span>
                    <span className="text-zinc-400 text-xs">Complete</span>
                  </div>
                </div>

                {/* Stats section */}
                <div className="ml-6 flex flex-col justify-center">
                  {/* Progress counter - different for Run vs Lift rounds */}
                  {isRunRound() ? (
                    <div className="flex items-center mb-2">
                      <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z" />
                      </svg>
                      <span className="ml-2 text-white font-semibold">{getCompletedStacksCount()}</span>
                      <span className="ml-1 text-zinc-400">Runs</span>
                    </div>
                  ) : (
                    <div className="flex items-center mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="ml-2 text-white font-semibold">{getCompletedStacksCount()}/{workouts.length}</span>
                      <span className="ml-1 text-zinc-400">Stacks</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats rows */}
              {getUserChallenge() && (
                <>
                  <div className="border-t border-zinc-700"></div>
                  <div className="grid grid-cols-3 divide-x divide-zinc-700">
                    {/* Points */}
                    <div className="p-3 text-center">
                      <div className="flex justify-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10]" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-white font-bold">
                        {getUserChallenge()?.pulsePoints?.totalPoints || 0}
                      </div>
                      <div className="text-zinc-400 text-xs">Points</div>
                    </div>

                    {/* Current Streak */}
                    <div className="p-3 text-center">
                      <div className="flex justify-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-white font-bold">{computeCurrentStreak()}</div>
                      <div className="text-zinc-400 text-xs">Day Streak</div>
                    </div>

                    {/* Longest Streak */}
                    <div className="p-3 text-center">
                      <div className="flex justify-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-14a3 3 0 00-3 3v2H7a1 1 0 000 2h1v1a1 1 0 01-1 1 1 1 0 100 2h6a1 1 0 100-2H9.83c.11-.313.17-.65.17-1v-1h1a1 1 0 100-2h-1V7a1 1 0 112 0 1 1 0 102 0 3 3 0 00-3-3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-white font-bold">{computeLongestStreak()}</div>
                      <div className="text-zinc-400 text-xs">Longest</div>
                    </div>
                  </div>

                  {/* Second row with additional stats */}
                  <div className="border-t border-zinc-700"></div>
                  <div className="grid grid-cols-3 divide-x divide-zinc-700">
                    {/* Rank */}
                    <div className="p-3 text-center">
                      <div className="flex justify-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v6a1 1 0 102 0V7zm-3 2a1 1 0 10-2 0v4a1 1 0 102 0V9zm-3 3a1 1 0 10-2 0v1a1 1 0 102 0v-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-white font-bold">#{getRankInLeaderboard()}</div>
                      <div className="text-zinc-400 text-xs">Rank</div>
                    </div>

                    {/* Completed count */}
                    <div className="p-3 text-center">
                      <div className="flex justify-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-white font-bold">{getCompletedStacksCount()}</div>
                      <div className="text-zinc-400 text-xs">Completed</div>
                    </div>

                    {/* Missed stacks */}
                    <div className="p-3 text-center">
                      <div className="flex justify-center mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-white font-bold">{getMissedStacksCount()}</div>
                      <div className="text-zinc-400 text-xs">Missed</div>
                    </div>
                  </div>

                  {/* Motivational message */}
                  <div className="p-4">
                    <div className="bg-[#E0FE10]/10 rounded p-3 text-center text-white text-sm">
                      {getMotivationalMessage(getCompletedStacksCount())}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Share Section - New */}
            <div className="mt-6 px-2"> {/* Adjusted margin */}
              <button
                onClick={handleShare}
                className="w-full flex items-center space-x-3 p-4 rounded-lg bg-[#DFFD10]/10 border border-[#DFFD10]/50 hover:bg-[#DFFD10]/20 transition-colors"
              >
                <Share2 className="h-5 w-5 text-[#DFFD10]" />
                <div className="text-left">
                  <p className="font-semibold text-[#DFFD10]">Invite Friends to Join</p>
                  <p className="text-sm text-gray-300">Share your link & earn +25 points per join! </p>
                </div>
              </button>
            </div>

            {/* Participants/Leaderboard Section */}
            {isRunRound() && collection?.runRoundConfig ? (
              <RunRoundLeaderboard
                challengeId={collection.challenge?.id || collection.id}
                startDate={collection.challenge?.startDate || null}
                endDate={collection.challenge?.endDate || null}
                runRoundConfig={collection.runRoundConfig}
                participants={userChallenges || []}
                currentUserId={currentUser?.id}
                onParticipantClick={(userId: string, username: string) => {
                  router.push(`/profile/${username}`);
                }}
              />
            ) : (
              <ParticipantsSection
                participants={userChallenges || []}
                onParticipantClick={(participant: UserChallenge) => {
                  router.push(`/profile/${participant.username}`);
                }}
              />
            )}

            {/* Chat Section */}
            {collection && (
              <div className="mt-8">
                {chatExpanded ? (
                  <RoundChatView
                    participants={collection.challenge?.participants || []}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    currentUser={currentUser ? new User(currentUser.id, currentUser) : null}
                    onCollapse={toggleChatExpansion}
                  />
                ) : (
                  <></>
                )}
              </div>
            )}

            {/* Run Round Info Section (for Run rounds only) */}
            {isRunRound() && collection?.runRoundConfig && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#3B82F6' }}>
                      <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z" />
                    </svg>
                    Run Round Details
                  </h2>
                </div>

                {/* Run Round Type Info */}
                <div className="bg-zinc-800 rounded-xl p-6 mb-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${RunRoundTypeInfo[collection.runRoundConfig.roundType]?.colors[0] || '#3B82F6'}, ${RunRoundTypeInfo[collection.runRoundConfig.roundType]?.colors[1] || '#2563EB'})`
                      }}
                    >
                      <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {RunRoundTypeInfo[collection.runRoundConfig.roundType]?.displayName || 'Run Round'}
                      </h3>
                      <p className="text-zinc-400 text-sm">
                        {RunRoundTypeInfo[collection.runRoundConfig.roundType]?.description}
                      </p>
                    </div>
                  </div>

                  {/* Run Round Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-700/50 rounded-lg p-3">
                      <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Leaderboard</div>
                      <div className="text-white font-semibold">
                        {RunLeaderboardMetricInfo[collection.runRoundConfig.leaderboardMetric]?.displayName}
                      </div>
                    </div>
                    <div className="bg-zinc-700/50 rounded-lg p-3">
                      <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Treadmill Runs</div>
                      <div className="text-white font-semibold">
                        {collection.runRoundConfig.allowTreadmill ? 'Allowed' : 'Not Allowed'}
                      </div>
                    </div>
                    {collection.runRoundConfig.targetGoal && (
                      <div className="bg-zinc-700/50 rounded-lg p-3">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Group Goal</div>
                        <div className="text-white font-semibold">
                          {collection.runRoundConfig.targetGoal} miles
                        </div>
                      </div>
                    )}
                    {collection.runRoundConfig.minimumRunForStreak && (
                      <div className="bg-zinc-700/50 rounded-lg p-3">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Min for Streak</div>
                        <div className="text-white font-semibold">
                          {collection.runRoundConfig.minimumRunForStreak} miles
                        </div>
                      </div>
                    )}
                    {collection.runRoundConfig.raceDistanceMiles && (
                      <div className="bg-zinc-700/50 rounded-lg p-3 col-span-2">
                        <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Race Distance</div>
                        <div className="text-white font-semibold">
                          {collection.runRoundConfig.raceDistanceMiles} miles
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Log a Run CTA */}
                <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold">Ready to Run?</h4>
                      <p className="text-zinc-400 text-sm">Complete a run to earn points in this round</p>
                    </div>
                    <button
                      onClick={() => router.push('/run')}
                      className="px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Log a Run
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stacks Section (for non-Run rounds) */}
            {!isRunRound() && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Stacks in this Round ({collection?.sweatlistIds.length})</h2>
                </div>

                <div className="space-y-4 pb-[100px]">
                  {collection?.sweatlistIds.map((sweatlistId, index) => {
                    const workoutDate = collection?.challenge?.startDate
                      ? new Date(new Date(collection.challenge.startDate).getTime() + (index * 24 * 60 * 60 * 1000))
                      : new Date();

                    const currentDayIndex = collection?.challenge?.startDate ? (() => {
                      const startDate = new Date(collection.challenge.startDate);
                      startDate.setHours(0, 0, 0, 0);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const diffTime = Math.abs(today.getTime() - startDate.getTime());
                      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    })() : 0;

                    // Calculate isToday for highlighting
                    const isToday = index === currentDayIndex;
                    const shouldHighlight = challengeHasStarted && isToday;

                    // Check if this is a rest day
                    if (sweatlistId.sweatlistName === "Rest") {
                      // For rest days, they're complete if the date is in the past
                      const isRestDayComplete = workoutDate < new Date();

                      // Generate rest day id
                      const restDayRoundWorkoutId = generateRoundWorkoutId("rest", index, true);
                      console.log(`[RestDay Debug] Generated roundWorkoutId: ${restDayRoundWorkoutId}`);

                      // Get the user challenge for the current user
                      const userChallenge = getUserChallenge();

                      // Check if this rest day is marked as complete in userChallenge
                      const isRestDayMarkedComplete = userChallenge?.completedWorkouts?.some(
                        completed => {
                          const isMatch = completed.workoutId === restDayRoundWorkoutId;
                          console.log(`[RestDay Debug] Comparing: ${completed.workoutId} vs ${restDayRoundWorkoutId} => ${isMatch}`);
                          return isMatch;
                        }
                      ) || false;

                      // Rest days can be complete based on time or if explicitly marked
                      const finalRestDayComplete = isRestDayComplete || isRestDayMarkedComplete;
                      console.log(`[RestDay Debug] Final completion: ${finalRestDayComplete} (time: ${isRestDayComplete}, marked: ${isRestDayMarkedComplete})`);

                      return (
                        <RestDayCard
                          key={`rest-${index}`}
                          selectedOrder={index}
                          maxOrder={collection.sweatlistIds.length}
                          showArrows={editMode}
                          showCalendar={true}
                          workoutDate={workoutDate}
                          isComplete={finalRestDayComplete}
                          challengeStartDate={collection?.challenge?.startDate}
                          challengeHasStarted={challengeHasStarted}
                          currentDayIndex={currentDayIndex}
                          index={index}
                          highlightBorder={shouldHighlight}
                          onPrimaryAction={() => console.log('Rest day clicked')}
                          onCalendarTap={(date) => console.log('Rest day calendar tapped:', date)}
                          onUpdateOrder={(newOrder) => handleSwapOrder(
                            new Workout({ id: sweatlistId.id, title: "Rest" }),
                            newOrder
                          )}
                        />
                      );
                    }

                    // Find the corresponding workout for non-rest days
                    const workout = workouts.find(w => w.id === sweatlistId.id);
                    if (!workout) return null;

                    // Get the userChallenge for the current user
                    const userChallenge = getUserChallenge();

                    // Add detailed logging
                    console.log(`[Workout Completion Debug] Workout: ${workout.title} (ID: ${workout.id})`);
                    console.log(`[Workout Completion Debug] Round Workout ID: ${workout.roundWorkoutId}`);
                    console.log(`[Workout Completion Debug] UserChallenge found:`, !!userChallenge);
                    console.log(`[Workout Completion Debug] CompletedWorkouts:`, userChallenge?.completedWorkouts);

                    // Set the roundWorkoutId if it's missing
                    if (!workout.roundWorkoutId) {
                      workout.roundWorkoutId = generateRoundWorkoutId(workout.id, index);
                      console.log(`[Workout Completion Debug] Generated roundWorkoutId: ${workout.roundWorkoutId}`);
                    }

                    console.log(`[Workout Completion Debug] Using roundWorkoutId: ${workout.roundWorkoutId}`);

                    // Check if this workout is completed according to userChallenge
                    const isWorkoutComplete = userChallenge?.completedWorkouts?.some(
                      completed => {
                        const isMatch = completed.workoutId === workout.roundWorkoutId;
                        console.log(`[Workout Completion Debug] Comparing: ${completed.workoutId} vs ${workout.roundWorkoutId} => ${isMatch}`);
                        return isMatch;
                      }
                    ) || false;

                    console.log(`[Workout Completion Debug] Final completion status for ${workout.title}: ${isWorkoutComplete}`);

                    // Add more detailed logging to inspect the entire workout object
                    console.log(`[Workout Completion Debug] Full Workout object:`, workout);
                    console.log(`[Workout Completion Debug] Full userChallenge:`, userChallenge);

                    return (
                      <StackCard
                        key={workout.id}
                        workout={workout}
                        gifUrls={workout.exercises?.map(ex => ex.exercise?.videos?.[0]?.gifURL || '') || []}
                        selectedOrder={index}
                        maxOrder={collection.sweatlistIds.length}
                        showArrows={editMode}
                        showCalendar={true}
                        workoutDate={workoutDate}
                        isComplete={isWorkoutComplete}
                        isChallengeEnabled={true}
                        challengeStartDate={collection?.challenge?.startDate}
                        challengeHasStarted={challengeHasStarted}
                        currentDayIndex={currentDayIndex}
                        userChallenge={userChallenge}
                        allWorkoutSummaries={[]} // Would be great to fetch these for completion check
                        index={index}
                        highlightBorder={shouldHighlight}
                        onPrimaryAction={async () => {
                          try {
                            const user = await userService.getUserById(workout.author);
                            router.push(`/workout/${user.username}/${workout.id}`);
                          } catch (error) {
                            console.error('Error getting user:', error);
                          }
                        }}
                        onCalendarTap={(date) => handleCalendarTap(workout, date)}
                        onUpdateOrder={(newOrder) => handleSwapOrder(workout, newOrder)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeDetailView;