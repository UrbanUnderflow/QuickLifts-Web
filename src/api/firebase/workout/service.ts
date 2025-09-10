// src/api/firebase/workout/service.ts
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy, 
  DocumentData,
  QueryDocumentSnapshot,
  collection as fsCollection,
  setDoc,
  deleteDoc,
  writeBatch,
  arrayUnion,
  FieldValue,
  Timestamp
} from 'firebase/firestore';

import { db, storage } from '../config';
import { userService } from '../user';
import { 
  ExerciseLog, 
  ExerciseCategory, 
  Exercise, 
  BodyPart, 
  ExerciseVideo, 
  ExerciseAuthor, 
  ExerciseVideoVisibility, 
  ExerciseDetail, 
  ExerciseReference } from '../exercise/types';
import { exerciseService } from '../exercise/service';
import { ProfileImage, User } from '../user/types'
import { Workout, WorkoutSummary, BodyZone, IntroVideo, RepsAndWeightLog, WorkoutRating, WorkoutSession } from '../workout/types';
import { WorkoutStatus, SweatlistCollection, SweatlistIdentifiers } from './types';
import { format } from 'date-fns'; 
import { convertTimestamp, serverTimestamp } from '../../../utils/timestamp'; // Adjust the import path
import { convertFirestoreTimestamp } from '../../../utils/formatDate';
import { Challenge, ChallengeStatus, UserChallenge } from '../../../api/firebase/workout/types';

import { store } from '../../../redux/store';
import { setCurrentWorkout, setCurrentExerciseLogs, resetWorkoutState, setWorkoutSummary } from '../../../redux/workoutSlice';
import { dateToUnixTimestamp } from '../../../utils/formatDate';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';


interface FirestoreError {
  code: string;
  message: string;
  name: string;
  stack?: string;
}

class WorkoutService {

// Replace getters/setters to use Redux
  get currentWorkout(): Workout | null {
    const workoutData = store.getState().workout.currentWorkout;
    return workoutData ? new Workout(workoutData) : null;
  }

  set currentWorkout(workout: Workout | null) {
    store.dispatch(setCurrentWorkout(workout));
  }

  get currentWorkoutLogs(): ExerciseLog[] {
    const logsData = store.getState().workout.currentExerciseLogs;
    return logsData.map(log => new ExerciseLog(log));
  }

  set currentWorkoutLogs(logs: ExerciseLog[]) {
    store.dispatch(setCurrentExerciseLogs(logs));
  }

  get currentWorkoutSummary(): WorkoutSummary | null {
    const summaryData = store.getState().workout.workoutSummary;
    return summaryData ? new WorkoutSummary(summaryData) : null;
  }

  set currentWorkoutSummary(workoutSummary: WorkoutSummary) {
    store.dispatch(setWorkoutSummary(workoutSummary));
  }

   generateId(): string {
    return doc(collection(db, 'workouts')).id;
  }

  async fetchWorkoutSummary(
    userId: string,
    workoutId: string,
    summaryId: string
  ): Promise<WorkoutSummary | null> {
    try {
      console.log('Fetching workout summary:', { userId, workoutId, summaryId });
      
      // Assuming summaries are stored in a 'workoutSummaries' collection
      const summaryRef = doc(db, 'users', userId, 'workoutSummary', summaryId);
      const summaryDoc = await getDoc(summaryRef);
  
      if (!summaryDoc.exists()) {
        console.log('Summary document not found');
        return null;
      }
  
      const summaryData = summaryDoc.data();
      console.log('Found summary data:', summaryData);
  
      return new WorkoutSummary(summaryData);
    } catch (error) {
      console.error('Error fetching workout summary:', error);
      return null;
    }
  }

    // Update the formatWorkoutAndInitializeLogs function
  async formatWorkoutAndInitializeLogs(
      exerciseDetails: ExerciseDetail[],
      workoutAuthor?: string
    ): Promise<{ workout: Workout; exerciseLogs: ExerciseLog[] }> {
      const workId = this.generateId(); // Use this.generateId() since it's a class method
      const exerciseReferences: ExerciseReference[] = [];
      const exerciseLogs: ExerciseLog[] = [];

      console.log("Exercise details passed in:", exerciseDetails);

  // Ensure exercise details are valid before processing
  const validExerciseDetails = exerciseDetails.filter(detail => detail?.exercise && detail.exercise.id);

  validExerciseDetails.forEach((detail, index) => {
    if (detail.exercise.id == null) { return }

    console.log("Detail being used:", detail);
    // Create the category first
    const category = {
      type: detail.category?.type === 'weight-training' 
        ? 'weight-training'
        : 'cardio',
      details: detail.category?.type === 'weight-training' 
        ? {
            sets: detail.category?.details?.sets ?? 3,
            reps: detail.category?.details?.reps ?? ['12'],
            weight: detail.category?.details?.weight ?? 0,
            screenTime: detail.category?.details?.screenTime ?? 0,
            selectedVideo: detail.category?.details?.selectedVideo ?? null
          }
        : {
            duration: (detail.category?.details as any)?.duration ?? 60,
            bpm: (detail.category?.details as any)?.bpm ?? 140,
            calories: (detail.category?.details as any)?.calories ?? 0,
            screenTime: detail.category?.details?.screenTime ?? 0,
            selectedVideo: detail.category?.details?.selectedVideo ?? null
          }
    };

    console.log("Category being used:", category); // Debug log

    // Create exercise instance with our new category
    const exerciseInstance = {
      ...detail.exercise,
      category: category.type === 'weight-training' 
          ? ExerciseCategory.weightTraining({
              sets: category.details?.sets ?? 3,
              reps: category.details?.reps ?? ['12'],
              weight: category.details?.weight ?? 0,
              screenTime: category.details?.screenTime ?? 0,
              selectedVideo: category.details?.selectedVideo ?? null
            })
          : ExerciseCategory.cardio({
              duration: category.details?.duration ?? 60,
              bpm: category.details?.bpm ?? 140,
              calories: category.details?.calories ?? 0,
              screenTime: category.details?.screenTime ?? 0,
              selectedVideo: category.details?.selectedVideo ?? null
            })
    };

    console.log("Exercise instance being used:", exerciseInstance);

    var exerciseInstanceClass = new Exercise(exerciseInstance);

    console.log("Exercise instance Object being used:", exerciseInstanceClass);

    // Create exercise reference using the constructor
    const exerciseRef = new ExerciseReference({
      exercise: exerciseInstanceClass,
      groupId: detail.groupId || 0
      // isCompleted will be defaulted to false by the ExerciseReference constructor
    });
    exerciseReferences.push(exerciseRef);

    // Create logs using the same category details
    const sets = category.details?.sets ?? 3;
    const reps = category.details?.reps ?? ['12'];
    const weight = category.details?.weight ?? 0;

    // Create logs for each set with validated data
    const setsLogs = Array.from({ length: sets }, () => 
      new RepsAndWeightLog({
        reps: parseInt(reps[0] || '12', 10),
        weight: weight || 0
      })
    );

    // Create exercise log with validated data
    const exerciseLogId = exerciseService.generateExerciseLogID(
      workId,
      userService.nonUICurrentUser?.id || 'anonymous'
    );

    const log = new ExerciseLog({
      id: exerciseLogId,
      workoutId: workId,
      userId: userService.nonUICurrentUser?.id || 'anonymous',
      exercise: exerciseInstance,
      logs: setsLogs,
      feedback: '',
      note: detail.notes || '',
      isSplit: detail.isSplit || false,
      logSubmitted: false,
      logIsEditing: false,
      isCompleted: false,
      order: index + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date()
    });
    
    exerciseLogs.push(log);
  });

  // Create workout with validated data
  const newWorkout = new Workout({
    id: workId,
    roundWorkoutId: '',
    exercises: exerciseReferences,
    logs: exerciseLogs,
    title: '',
    description: '',
    duration: 0,
    workoutRating: 'none' as WorkoutRating,
    useAuthorContent: false,
    isCompleted: false,
    workoutStatus: 'archived' as WorkoutStatus,
    author: userService.nonUICurrentUser?.id || 'PulseAI',
    createdAt: new Date(),
    updatedAt: new Date(),
    zone: Workout.determineWorkoutZone(exerciseReferences) || 'full' as BodyZone
  });

  return { workout: newWorkout, exerciseLogs };

}

// Add this function to your WorkoutService class

/**
 * Fetches random trending stack workouts with their videos.
 * Adapts the iOS implementation for web.
 * @returns {Promise<Workout[]>} Array of workout objects with videos
 */
async fetchRandomTrendingStacks(): Promise<Workout[]> {
  try {
    // First, let's get all available stacks from the 'stacks' collection
    const stacksRef = collection(db, 'stacks');
    const snapshot = await getDocs(stacksRef);

    if (snapshot.empty) {
      console.log('No stacks found.');
      return [];
    }

    // Get all documents and shuffle them
    const documents = snapshot.docs;
    const shuffledDocs = [...documents].sort(() => 0.5 - Math.random());
    
    // Take up to 10 random stacks
    const randomStacks = shuffledDocs.slice(0, 10).map(doc => {
      return new Workout({
        id: doc.id,
        ...doc.data()
      });
    });

    // Fetch videos for each workout
    const workoutsWithVideos = await Promise.all(
      randomStacks.map(async (workout) => {
        try {
          return await this.fetchVideosForWorkout(workout);
        } catch (error) {
          console.error(`Error fetching videos for workout ${workout.id}:`, error);
          return workout; // Return the workout without videos if there's an error
        }
      })
    );

    return workoutsWithVideos;
  } catch (error) {
    console.error('Error fetching random trending stacks:', error);
    throw error;
  }
}

/**
 * Fetches active rounds/challenges that are currently live.
 * Adapts the iOS implementation for web.
 * @returns {Promise<SweatlistCollection[]>} Array of live round collections
 */
async fetchLiveRounds(): Promise<SweatlistCollection[]> {
  try {
    const now = new Date();
    
    // Create a query for published challenges that are currently active
    const collectionsRef = collection(db, 'sweatlist-collection');
    const q = query(
      collectionsRef,
      where('challenge.status', '==', 'published'),
      where('challenge.endDate', '>', now),
      where('challenge.startDate', '<', now),
      orderBy('challenge.startDate', 'desc')
    );

    const snapshot = await getDocs(q);
    
    // Filter and map the collections
    const collections = snapshot.docs
      .map(doc => {
        return new SweatlistCollection({
          id: doc.id,
          ...doc.data()
        });
      })
      .filter(collection => {
        // Check if ownerId is not empty and cohortAuthor is not nil
        const cohortAuthor = collection.challenge?.cohortAuthor;
        return cohortAuthor && 
               Array.isArray(collection.ownerId) && 
               collection.ownerId.length > 0 && 
               collection.ownerId.some(id => collection.challenge?.cohortAuthor.includes(id));
      });
    
    // Limit to 10 collections
    return collections.slice(0, 10);
    
  } catch (error) {
    console.error('Error fetching live rounds:', error);
    return [];
  }
}

/**
 * Fetches videos for a workout's exercises
 * @param {Workout} workout - The workout to fetch videos for
 * @returns {Promise<Workout>} - The workout with videos added to its exercises
 */
private async fetchVideosForWorkout(workout: Workout): Promise<Workout> {
  // Get all exercises with videos
  const exercisesWithVideos = await this.fetchAndMapExercisesWithVideos();
  
  // Map the exercises in the workout to include videos
  const updatedExercises = workout.exercises.map(exerciseRef => {
    const exerciseName = exerciseRef.exercise?.name?.toLowerCase().trim();
    const matchingExercise = exercisesWithVideos.find(
      ex => ex.name.toLowerCase().trim() === exerciseName
    );
    
    if (matchingExercise) {
      return {
        ...exerciseRef,
        exercise: new Exercise({
          ...exerciseRef.exercise,
          videos: matchingExercise.videos || []
        })
      };
    }
    
    return exerciseRef;
  });
  
  // Create a new workout with the updated exercises
  return new Workout({
    ...workout,
    exercises: updatedExercises
  });
}

// You may need to add a fallback method if 'stacks' collection doesn't exist:
async fetchRandomTrendingStacksFallback(): Promise<Workout[]> {
  try {
    // If 'stacks' collection doesn't exist, we can fetch from user workouts as fallback
    if (!userService.nonUICurrentUser?.id) {
      return [];
    }
    
    const workouts = await this.getAllSweatlists(userService.nonUICurrentUser.id);
    
    // Shuffle and take up to 10
    const shuffledWorkouts = [...workouts].sort(() => 0.5 - Math.random()).slice(0, 10);
    
    return shuffledWorkouts;
  } catch (error) {
    console.error('Error in fetchRandomTrendingStacksFallback:', error);
    return [];
  }
}

  async getUserById(userId: string): Promise<User> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
  
      return new User(userDoc.id, {
        id: userDoc.id,
        ...userDoc.data() 
      });
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  // In WorkoutService
  async revertAuthorFormat(workoutId: string, authorId: string) {
    if (!userService.nonUICurrentUser?.id) throw new Error('No user signed in');
    
    const workoutRef = doc(db, 'users', userService.nonUICurrentUser.id, 'MyCreatedWorkouts', workoutId);
    await updateDoc(workoutRef, {
      author: authorId
    });
   }

async updateWorkout(workout: Workout): Promise<void> {
  if (!userService.nonUICurrentUser?.id) {
    throw new Error('No user is signed in');
  }

  try {
    const workoutRef = doc(db, 'users', userService.nonUICurrentUser.id, 'MyCreatedWorkouts', workout.id);
    await setDoc(workoutRef, workout.toDictionary(), { merge: true });

    // Update logs if they exist
    if (workout.logs && workout.logs.length > 0) {
      const batch = writeBatch(db);
      const logsRef = collection(workoutRef, 'logs');

      workout.logs.forEach(log => {
        const logRef = doc(logsRef, log.id);
        batch.set(logRef, log.toDictionary(), { merge: true });
      });

      await batch.commit();
    }
  } catch (error) {
    console.error('Error updating workout:', error);
    throw error;
  }
}

  /**
   * Fetch the user's current workout (either QueuedUp or InProgress).
   */
  async fetchCurrentWorkout(userId: string): Promise<Workout | null> {
    const session = await this.fetchCurrentWorkoutSession(userId);
    return session.workout;
  }

  async getAllSweatlists(userId: string): Promise<Workout[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }
  
    // Reference to the user's workout collection
    const workoutsRef = collection(db, 'users', userId, 'MyCreatedWorkouts');
  
    try {
      // Fetch exercises with videos
      const exercisesWithVideos = await this.fetchAndMapExercisesWithVideos();
  
      // Query to fetch all workouts
      const workoutsSnapshot = await getDocs(workoutsRef);
      const workouts: Workout[] = [];
  
      // Process each workout document
      for (const workoutDoc of workoutsSnapshot.docs) {
        const workoutData = workoutDoc.data();
        const workoutId = workoutDoc.id;
  
        // Map the exercises in the workout to the full exercise objects with videos
        const mappedExercises = (workoutData.exercises || []).map((exerciseRef: any) => {
          const fullExercise = exercisesWithVideos.find(ex => ex.name === exerciseRef.exercise.name);

          return {
            ...exerciseRef,
            exercise: fullExercise || exerciseRef
          };
        });

  
        // Parse workout data into the desired structure
        const workout = new Workout({
          id: workoutData.id || '',
          roundWorkoutId: workoutData.roundWorkoutId || '',
          collectionId: workoutData.collectionId,
          exercises: mappedExercises,
          challenge: workoutData.challenge,
          logs: [],
          title: workoutData.title || '',
          description: workoutData.description || '',
          duration: workoutData.duration || 0,
          workoutRating: workoutData.workoutRating,
          useAuthorContent: workoutData.useAuthorContent || false,
          isCompleted: workoutData.isCompleted || false,
          workoutStatus: workoutData.workoutStatus || 'notStarted',
          startTime: workoutData.startTime ? new Date(workoutData.startTime) : undefined,
          order: workoutData.order,
          author: workoutData.author || userId,
          createdAt: workoutData.createdAt ? new Date(workoutData.createdAt) : new Date(),
          updatedAt: workoutData.updatedAt ? new Date(workoutData.updatedAt) : new Date(),
          zone: workoutData.zone || 'FULL_BODY',
        });        
  
        // Fetch and process logs
        const logsRef = collection(db, 'users', userId, 'MyCreatedWorkouts', workoutId, 'logs');
        const logsSnapshot = await getDocs(logsRef);
        workout.logs = logsSnapshot.docs.map((logDoc) => ({
          ...logDoc.data(),
          id: logDoc.id,
        })) as ExerciseLog[];
  
        workouts.push(workout);
      }
  
      return workouts;
    } catch (error) {
      const firestoreError = error as FirestoreError;
      console.error('Error fetching sweatlists:', firestoreError.message);
      throw new Error('Failed to fetch sweatlists');
    }
  }

  async getUserChallengesByChallengeId(challengeId: string): Promise<{ userChallenges: UserChallenge[]; error?: string }> {
    const userChallengesRef = collection(db, 'user-challenge');
    const q = query(userChallengesRef, where('challengeId', '==', challengeId));
    try {
      const snapshot = await getDocs(q);
      const userChallenges: UserChallenge[] = snapshot.docs.map((doc: DocumentData) => {
        const data = doc.data();
        return new UserChallenge(data);
      });
      if (userChallenges.length > 0) {
        return { userChallenges };
      } else {
        return { userChallenges: [], error: 'No user challenges found for this challenge.' };
      }
    } catch (error) {
      console.error('Error fetching user challenges by challengeId:', error);
      return { userChallenges: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Fetches workout summaries for a specific date.
   * @param date - The date for which workout summaries are being fetched.
   * @returns A promise resolving to an array of workout summaries.
   * @throws If no user is signed in or if the Firestore query fails.
   */
  async fetchWorkoutSummaries(date: Date): Promise<WorkoutSummary[]> {
    const currentUser = userService.nonUICurrentUser;
    if (!currentUser?.id) {
      throw new Error('No user is signed in');
    }

    // Format the date to match the format in Firestore ('MM-dd-yyyy')
    const formattedDate = format(date, 'MM-dd-yyyy');

    // Reference to the user's workoutSummaries subcollection
    const summariesRef = collection(db, 'users', currentUser.id, 'workoutSummaries');

    // Create a query to filter documents by the specified date
    const q = query(summariesRef, where('date', '==', formattedDate));

    try {
      const snapshot = await getDocs(q);

      // Map the documents to an array of WorkoutSummary objects
      return snapshot.docs.map((doc: DocumentData): WorkoutSummary => ({
        id: doc.id,
        ...doc.data(),
      }));
      
    } catch (error) {
      const firestoreError = error as FirestoreError;
      console.error('Error fetching workout summaries:', firestoreError.message);
      throw new Error(firestoreError.message);
    }
  }

  async fetchAllWorkoutSummaries(): Promise<WorkoutSummary[]> {
    const currentUser = userService.nonUICurrentUser;
    if (!currentUser?.id) {
      throw new Error('No user is signed in');
    }
  
    // Reference to the user's workoutSummaries subcollection
    const summariesRef = collection(db, 'users', currentUser.id, 'workoutSummary');
  
    // Query to retrieve all workout summaries, sorted by `createdAt` in ascending order
    const q = query(summariesRef, orderBy('createdAt', 'asc')); // Adjust field name based on your schema
  
    try {
      const snapshot = await getDocs(q);
  
      // Map the documents to an array of WorkoutSummary objects
      return snapshot.docs.map((doc: DocumentData): WorkoutSummary => ({
        id: doc.id,
        ...doc.data(),
      }));
      
    } catch (error) {
      const firestoreError = error as FirestoreError;
      console.error('Error fetching all workout summaries:', firestoreError.message);
      throw new Error(firestoreError.message);
    }
  }


  /**
 * Fetch user challenges by userId.
 * @param userId The ID of the user to fetch challenges for.
 * @returns A promise resolving to an array of user challenges.
 * @throws If the Firestore query fails.
 */
async fetchUserChallengesByUserId(userId: string): Promise<UserChallenge[]> {
  const userChallengesRef = collection(db, 'user-challenge');
  const q = query(userChallengesRef, where('userId', '==', userId));

  try {
    // console.log(`Fetching challenges for user ID: ${userId}`);

    const snapshot = await getDocs(q);

    // console.log(`Total challenges fetched: ${snapshot.docs.length}`);

    const userChallenges = snapshot.docs.map((doc: DocumentData) => {
      const data = doc.data();
      // console.log(`Processing challenge with ID: ${doc.id}`, data);

      return {
        id: doc.id,
        ...data,
        challenge: data.challenge
          ? new Challenge({
              id: data.challenge.id,
              title: data.challenge.title,
              subtitle: data.challenge.subtitle,
              participants: data.challenge.participants || [],
              status: data.challenge.status as ChallengeStatus,
              startDate: data.challenge.startDate ? new Date(data.challenge.startDate) : new Date(),
              endDate: data.challenge.endDate ? new Date(data.challenge.endDate) : new Date(),
              createdAt: data.challenge.createdAt ? new Date(data.challenge.createdAt) : new Date(),
              updatedAt: data.challenge.updatedAt ? new Date(data.challenge.updatedAt) : new Date(),
              introVideos: data.challenge.introVideos || [],
              ownerId: data.challenge.ownerId || []
            })
          : undefined,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
      };
    });

    // console.log('All challenges after processing:', JSON.stringify(userChallenges, null, 2));

    return userChallenges;
  } catch (error) {
    console.error('Error fetching user challenges by userId:', error);
    throw error;
  }
}

async fetchCollectionWithSweatLists(collectionId: string): Promise<{ collection: any, sweatLists: Workout[] }> {
  try {
    // Fetch the collection
    const collection = await this.getCollectionById(collectionId);

    // Fetch sweat lists (workouts)
    const sweatLists: Workout[] = [];
    
    // Assuming collection has sweatlistIds with author and workout IDs
    for (const sweatlistIdentifier of collection.sweatlistIds || []) {
      try {
        const [workout] = await this.fetchSavedWorkout(
          sweatlistIdentifier.sweatlistAuthorId, 
          sweatlistIdentifier.id
        );
        
        if (workout) {
          sweatLists.push(workout);
        }
      } catch (error) {
        console.error(`Error fetching workout ${sweatlistIdentifier.id}:`, error);
      }
    }

    return { collection, sweatLists };
  } catch (error) {
    console.error('Error fetching collection with sweat lists:', error);
    throw error;
  }
}

async fetchSavedWorkout(userId: string, workoutId: string): Promise<[Workout | null, ExerciseLog[] | null]> {
  try {
    const workoutRef = doc(db, 'users', userId, 'MyCreatedWorkouts', workoutId);
    const workoutSnap = await getDoc(workoutRef);
    
    if (!workoutSnap.exists()) {
      return [null, null];
    }

    const workoutData = workoutSnap.data();
    console.log("1. Raw workout data from DB:", JSON.stringify({
      exercises: workoutData.exercises?.map((ex: any) => ({
        name: ex.exercise.name,
        category: ex.exercise.category
      }))
    }, null, 2));

    const exercisesWithVideos = await this.fetchAndMapExercisesWithVideos();

    // Map the exercises while preserving original data
    const mappedExercises = (workoutData.exercises || []).map((exerciseRef: any) => {
      // Find matching exercise just for its videos
      const exerciseNameLower = exerciseRef.exercise?.name?.toLowerCase().trim();
      const matchingExercise = exercisesWithVideos.find(
        ex => ex.name.toLowerCase().trim() === exerciseNameLower
      );

      // Create new Exercise using original data but add videos from matching exercise
      return {
        ...exerciseRef,
        exercise: new Exercise({
          ...exerciseRef.exercise,
          videos: matchingExercise?.videos || [],
          // Explicitly preserve the original category
          category: exerciseRef.exercise.category
        })
      };
    });

    workoutData.exercises = mappedExercises;
    const workout = new Workout({
      id: workoutId,
      ...workoutData
    });

   
    // Similarly for logs, preserve original exercise data
    const logsRef = collection(workoutRef, 'logs');
    const logsSnapshot = await getDocs(logsRef);

   
    const logs: ExerciseLog[] = logsSnapshot.docs.map(logDoc => {
      const logData = logDoc.data();
      const matchingExercise = exercisesWithVideos.find(ex => ex.name === logData.exercise.name);
      
      console.log("Raw logData:", logData, null, 2);
      var exerciseWithVideo = new Exercise({
        ...logData.exercise,
        videos: matchingExercise?.videos || []
      })

      console.log("Exercise with video:", exerciseWithVideo, null, 2);

      var exLog = new ExerciseLog({
        id: logDoc.id,
        workoutId: workoutId,
        userId: userId,
        exercise: exerciseWithVideo,
        logs: logData.logs || [],
        feedback: logData.feedback || '',
        note: logData.note || '',
        recommendedWeight: logData.recommendedWeight || 'calculating...',
        isSplit: logData.isSplit || false,
        isBodyWeight: logData.isBodyWeight || false,
        logSubmitted: logData.logSubmitted || false,
        logIsEditing: logData.logIsEditing || false,
        isCompleted: logData.isCompleted || false,
        order: logData.order || null,
        completedAt: convertFirestoreTimestamp(logData.completedAt),
        createdAt: convertFirestoreTimestamp(logData.createdAt),
        updatedAt: convertFirestoreTimestamp(logData.updatedAt)
      });

      console.log("Exercise log:", exLog, null, 2);
      
      return exLog
    });


    workout.logs = logs;
    return [workout, logs];
  } catch (error) {
    console.error('Error fetching saved workout:', error);
    throw error;
  }
}

/**
 * Fetch user challenges by challengeId.
 * @param challengeId The ID of the challenge to fetch associated user challenges for.
 * @returns A promise resolving to an array of user challenges.
 * @throws If the Firestore query fails.
 */
async fetchUserChallengesByChallengeId(challengeId: string): Promise<UserChallenge[]> {
  const userChallengesRef = collection(db, 'user-challenge');
  const q = query(userChallengesRef, where('challengeId', '==', challengeId));

  try {
    // console.log(`Fetching user challenges for challenge ID: ${challengeId}`);

    const snapshot = await getDocs(q);

    // console.log(`Total user challenges fetched: ${snapshot.docs.length}`);

    const userChallenges = snapshot.docs.map((doc: DocumentData) => {
      const data = doc.data();
      // console.log(`Processing user challenge with ID: ${doc.id}`, data);

      // --- Instantiate UserChallenge here --- 
      return new UserChallenge({ 
        id: doc.id,
        ...data 
      });
      // --- End Instantiation ---
    });

    console.log('All user challenges after processing:', JSON.stringify(userChallenges, null, 2));

    return userChallenges;
  } catch (error) {
    console.error('Error fetching user challenges by challengeId:', error);
    throw error;
  }
}

async getCollectionById(id: string): Promise<SweatlistCollection> {
  console.log("Fetching collection with id:", id);
  try {
    const docRef = doc(db, "sweatlist-collection", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const collectionData = docSnap.data();
      const currentSweatlistIdsData = collectionData.sweatlistIds || [];
      // Instantiate SweatlistIdentifiers from the raw data
      const currentSweatlistIds: SweatlistIdentifiers[] = currentSweatlistIdsData.map((data: any) => new SweatlistIdentifiers(data));
      console.log('Current sweatlistIds (instantiated):', currentSweatlistIds);

      return new SweatlistCollection({
        id: docSnap.id,
        ...collectionData
      });
    } else {
      throw new Error("Collection not found");
    }
  } catch (error) {
    console.error("Error getting collection by ID:", error);
    throw error;
  }
}

// In WorkoutService class
async getCollectionsByIds(collectionIds: string[]): Promise<SweatlistCollection[]> {
  try {
    // Use Promise.all to fetch all collections in parallel
    const collections = await Promise.all(
      collectionIds.map(async (id) => {
        try {
          const docRef = doc(db, "sweatlist-collection", id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            return new SweatlistCollection({
              id: docSnap.id,
              ...docSnap.data()
            });
          }
          return null;
        } catch (error) {
          console.error(`Error fetching collection ${id}:`, error);
          return null;
        }
      })
    );

    // Filter out any null values from failed fetches
    return collections.filter((collection): collection is SweatlistCollection => collection !== null);
  } catch (error) {
    console.error("Error fetching collections:", error);
    throw error;
  }
}

  
async fetchCollections(userId: string): Promise<SweatlistCollection[]> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const collectionsRef = fsCollection(db, "sweatlist-collection");

    // Query for records where ownerId is an array that contains the userId.
    const qArray = query(collectionsRef, where("ownerId", "array-contains", userId));
    const snapshotArray = await getDocs(qArray);
    const collectionsFromArray: SweatlistCollection[] = snapshotArray.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = { id: doc.id, ...doc.data() };
      return new SweatlistCollection(data);
    });

    console.log("The array collections", collectionsFromArray);

    // Query for records where ownerId is a string equal to the userId.
    const qString = query(collectionsRef, where("ownerId", "==", userId));
    const snapshotString = await getDocs(qString);
    const collectionsFromString: SweatlistCollection[] = snapshotString.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = { id: doc.id, ...doc.data() };
      return new SweatlistCollection(data);
    });

    console.log("The string collections", collectionsFromString);


    // Combine both arrays and remove duplicates (if any) based on the collection id.
    const combined = [...collectionsFromArray, ...collectionsFromString];
    const uniqueCollections = new Map<string, SweatlistCollection>();
    combined.forEach(collection => {
      uniqueCollections.set(collection.id, collection);
    });

    return Array.from(uniqueCollections.values());
  } catch (error) {
    console.error("Error fetching sweatlists:", error);
    throw error;
  }
}



    /**
   * Fetch user challenges by userId and filter for active challenges.
   * @returns A promise resolving to an array of active challenges.
   * @throws If no user is signed in or if the Firestore query fails.
   */
    async fetchActiveChallenges(): Promise<UserChallenge[]> {
      const currentUser = userService.nonUICurrentUser;
      if (!currentUser?.id) {
        throw new Error('No user is signed in');
      }
    
      const userChallengesRef = collection(db, 'user-challenge');
      const q = query(userChallengesRef, where('userId', '==', currentUser.id));
    
      try {
        // console.log(`Fetching challenges for user ID: ${currentUser.id}`);
    
        const snapshot = await getDocs(q);
    
        // console.log(`Total challenges fetched: ${snapshot.docs.length}`);
    
        const allChallenges = snapshot.docs.map((doc: DocumentData) => {
          const data = doc.data();
          // console.log(`Processing challenge with ID: ${doc.id}`, data);
          
          // Use the Challenge constructor to parse the challenge data
          // console.log("date before format: " + convertFirestoreTimestamp(data.challenge.startDate));

          const challenge = data.challenge
            ? new Challenge({
                id: data.challenge.id,
                title: data.challenge.title,
                subtitle: data.challenge.subtitle,
                participants: data.challenge.participants || [],
                status: data.challenge.status as ChallengeStatus,
                startDate: convertFirestoreTimestamp(data.challenge.startDate),
                endDate: convertFirestoreTimestamp(data.challenge.endDate),
                createdAt: convertFirestoreTimestamp(data.challenge.createdAt),
                updatedAt: convertFirestoreTimestamp(data.challenge.updatedAt),
                introVideos: data.challenge.introVideos || [],
                ownerId: data.challenge.ownerId || []
              })
            : undefined;

          return {
            id: doc.id,
            ...data,
            challenge,
            createdAt: convertFirestoreTimestamp(data.createdAt),
            updatedAt: convertFirestoreTimestamp(data.updatedAt),
          };
        });
    
        // console.log('All challenges after processing:', JSON.stringify(allChallenges, null, 2));
    
        // Filter for active challenges (endDate > current date)
        const activeChallenges = allChallenges.filter(userChallenge => {
          const endDate = userChallenge.challenge?.endDate;
    
          // console.log(
          //   `Evaluating challenge ID: ${userChallenge.id}, End Date: ${endDate}, Current Date: ${new Date()}`
          // );
    
          return endDate && endDate > new Date();
        });
    
        // console.log(`Total active challenges: ${activeChallenges.length}`, activeChallenges);
    
        return activeChallenges;
      } catch (error) {
        console.error('Error fetching active challenges:', error);
        throw error;
      }
    }
    

  /**
   * Fetch user challenges by userId.
   * @returns A promise resolving to an array of challenges.
   * @throws If no user is signed in or if the Firestore query fails.
   */
  async fetchUserChallenges(): Promise<UserChallenge[]> {
    const currentUser = userService.nonUICurrentUser;
    if (!currentUser?.id) {
      throw new Error('No user is signed in');
    }

    console.log('🔍 [fetchUserChallenges] Starting fetch for user:', currentUser.id);

    // Reference to the user-challenge collection
    const userChallengesRef = collection(db, 'user-challenge');

    // Query challenges where userId matches the current user's ID
    const q = query(userChallengesRef, where('userId', '==', currentUser.id));

    try {
      const snapshot = await getDocs(q);
      console.log('📊 [fetchUserChallenges] Raw documents found:', snapshot.docs.length);

      // Map documents to an array of Challenge objects
      const userChallenges = snapshot.docs.map((doc: DocumentData) => {
        const rawData = doc.data();
        console.log('📋 [fetchUserChallenges] Processing document:', doc.id, {
          challengeId: rawData.challengeId,
          hasChallenge: !!rawData.challenge,
          challengeEndDate: rawData.challenge?.endDate,
          challengeEndDateType: typeof rawData.challenge?.endDate,
          isCompleted: rawData.isCompleted,
          username: rawData.username
        });

        const userChallenge = new UserChallenge({
          id: doc.id,
          ...rawData,
        });

        console.log('✅ [fetchUserChallenges] Created UserChallenge:', {
          id: userChallenge.id,
          challengeId: userChallenge.challengeId,
          hasChallenge: !!userChallenge.challenge,
          challengeTitle: userChallenge.challenge?.title,
          challengeEndDate: userChallenge.challenge?.endDate,
          challengeEndDateType: typeof userChallenge.challenge?.endDate,
          isCompleted: userChallenge.isCompleted
        });

        return userChallenge;
      });

      console.log('🎯 [fetchUserChallenges] Returning', userChallenges.length, 'user challenges');
      return userChallenges;
    } catch (error) {
      console.error('Error fetching user challenges:', error);
      throw new Error('Failed to fetch user challenges');
    }
  }
  
  /**
   * Fetch all user challenges from the database, ordered by creation date
   * @returns A promise resolving to an array of all user challenges
   * @throws If the Firestore query fails
   */
  async fetchAllUserChallenges(): Promise<UserChallenge[]> {
    try {
      // Reference to the user-challenge collection
      const userChallengesRef = collection(db, 'user-challenge');
      
      // Query all challenges ordered by creation date (newest first)
      const q = query(userChallengesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      console.log(`Loaded ${snapshot.docs.length} user challenges`);
      
      // Process and map documents to an array of UserChallenge objects
      const userChallenges = snapshot.docs.map((doc: DocumentData) => {
        try {
          const data = doc.data();
          
          // Pre-process challenge dates if they exist
          if (data.challenge) {
            // Ensure the dates are properly converted
            if (data.challenge.startDate) {
              data.challenge.startDate = convertFirestoreTimestamp(data.challenge.startDate);
            }
            if (data.challenge.endDate) {
              data.challenge.endDate = convertFirestoreTimestamp(data.challenge.endDate);
            }
            if (data.challenge.createdAt) {
              data.challenge.createdAt = convertFirestoreTimestamp(data.challenge.createdAt);
            }
            if (data.challenge.updatedAt) {
              data.challenge.updatedAt = convertFirestoreTimestamp(data.challenge.updatedAt);
            }
          }
          
          return new UserChallenge({
            id: doc.id,
            ...data
          });
        } catch (err) {
          console.error(`Error processing user challenge document ${doc.id}:`, err);
          return null; // Skip documents that fail to process
        }
      }).filter(Boolean); // Remove null entries
      
      return userChallenges as UserChallenge[];
    } catch (error) {
      console.error('Error fetching all user challenges:', error);
      throw new Error('Failed to fetch all user challenges');
    }
  }
  
  //update the workout summary,
  async updateWorkoutSummary({
    userId,
    workoutId,
    summary
  }: {
    userId: string,
    workoutId: string,
    summary: WorkoutSummary
  }): Promise<void> {
    if (!userId) {
      throw new Error('No user ID provided');
    }
  
    try {
      const summaryRef = doc(db, 'users', userId, 'workoutSummary', summary.id);

      // Update the updatedAt timestamp
      summary.updatedAt = new Date();

      // Use the toDictionary method to convert to Firestore format
      const summaryData = summary.toDictionary();

      console.log('Updating workout summary:', {
        path: `users/${userId}/workoutSummary/${summary.id}`,
        data: summaryData
      });

      await setDoc(summaryRef, summaryData, { merge: true });
      console.log('Workout summary document updated successfully');
    } catch (error) {
      console.error('Error updating workout summary:', error);
      throw error;
    }
  }

  async updateWorkoutLogs({
    userId,
    workoutId, 
    logs
  }: {
    userId: string,
    workoutId: string, 
    logs: ExerciseLog[]
  }): Promise<void> {
    try {
      const workoutRef = doc(db, 'users', userId, 'workoutSessions', workoutId);
      const logsRef = collection(workoutRef, 'logs');
      const batch = writeBatch(db);
      
      logs.forEach(log => {
        const logDocRef = doc(logsRef, log.id);
        batch.update(logDocRef, {
          ...log.toDictionary()
        });
      });
  
      await batch.commit();
    } catch (error) {
      console.error('Error updating workout logs:', error);
      throw error;
    }
  }

  // The cancelWorkout method – it deletes the workout session and summary (if any),
// cleans up the local state, and logs the cancellation.
async cancelWorkout(workout: Workout | null, workoutSummary: WorkoutSummary | null): Promise<void> {
  if (!userService.nonUICurrentUser?.id || !workout) {
    throw new Error("User not authenticated.");
  }

  try {    
    await this.deleteWorkoutSession(workout.id);
    if (workoutSummary) {
      await this.deleteWorkoutSummary(workoutSummary.id);
    }
    
    this.cleanUpWorkoutInProgress();
    console.log("Workout canceled and cleaned up successfully.");
  } catch (error) {
    console.error("Error canceling workout:", error);
    throw error;
  }
}
  
// Deletes a workout session document and all its subcollection "logs"
async deleteWorkoutSession(workoutId: string | null): Promise<void> {
  if (!userService.nonUICurrentUser?.id || !workoutId) {
    throw new Error("User not authenticated.");
  }
  const userId = userService.nonUICurrentUser.id;
  const workoutRef = doc(db, "users", userId, "workoutSessions", workoutId);
  
  try {
    // Delete all logs in the subcollection
    const logsRef = collection(workoutRef, "logs");
    const logsSnapshot = await getDocs(logsRef);
    const batch = writeBatch(db);
    
    logsSnapshot.docs.forEach((logDoc) => {
      batch.delete(logDoc.ref);
    });
    
    // Delete the main workout document
    batch.delete(workoutRef);
    
    await batch.commit();
    console.log("Workout session and logs deleted successfully.");
  } catch (error) {
    console.error("Error deleting workout session:", error);
    throw error;
  }
}

  // Deletes the workout summary document.
  async deleteWorkoutSummary(workoutSummaryId: string): Promise<void> {
    if (!workoutSummaryId || !userService.nonUICurrentUser?.id) {
      return;
    }
    
    try {
      const summaryRef = doc(db, "users", userService.nonUICurrentUser.id, "workoutSummary", workoutSummaryId);
      await deleteDoc(summaryRef);
      console.log("Workout summary deleted successfully.");
    } catch (error) {
      console.error("Error deleting workout summary:", error);
      throw error;
    }
  }

  // Clean up local storage and in-memory workout state.
    cleanUpWorkoutInProgress(): void {
      store.dispatch(resetWorkoutState());
    }
      
  
  /**
   * Fetch the workout session from Firestore, returning { workout, logs }.
   * Checks first for a QueuedUp session, then for InProgress.
   */
  async fetchCurrentWorkoutSession(userId: string): Promise<{
    workout: Workout | null;
    logs: ExerciseLog[] | null;
   }> {
    if (!userId) throw new Error('No user ID provided');
   
    const exerciseSnapshot = await getDocs(collection(db, 'exercises'));
    const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
   
    const exerciseVideos = videoSnapshot.docs.map((doc) => 
      new ExerciseVideo({
        id: doc.id,
        ...doc.data()
      })
    );
   
    const exercisesWithVideos = exerciseSnapshot.docs.map(doc => {
      const exercise = new Exercise({
        id: doc.id,
        ...doc.data()
      });
   
      const matchingVideos = exerciseVideos.filter(
        (video) => video.exercise.toLowerCase() === exercise.name.toLowerCase()
      );
   
      return new Exercise({
        ...exercise,
        videos: matchingVideos
      });
    });
   
    const workoutSessionsRef = collection(db, 'users', userId, 'workoutSessions');
   
    let q = query(workoutSessionsRef, where('status', '==', WorkoutStatus.QueuedUp));
    let snap = await getDocs(q);
   
    if (!snap.empty) {
      return this.processWorkoutSessionDocument(snap.docs[0], exercisesWithVideos);
    }
   
    q = query(workoutSessionsRef, where('status', '==', WorkoutStatus.InProgress));
    snap = await getDocs(q);
   
    if (!snap.empty) {
      return this.processWorkoutSessionDocument(snap.docs[0], exercisesWithVideos);
    }
   
    return { workout: null, logs: null };
   }

  private async fetchAndMapExercisesWithVideos(): Promise<Exercise[]> {
    try {
      // console.log('Starting fetchAndMapExercisesWithVideos');
  
      // 1. Fetch all exercises 
      const exerciseSnapshot = await getDocs(collection(db, 'exercises'));
      const exercises = exerciseSnapshot.docs.map((doc) => 
        new Exercise({
          id: doc.id,
          ...doc.data()
        })
      );
      // console.log(`Fetched ${exercises.length} exercises`);
  
      // 2. Fetch all videos
      const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
      const exerciseVideos = videoSnapshot.docs.map((doc) => 
        new ExerciseVideo({
          id: doc.id,
          ...doc.data()
        })
      );
      // console.log(`Fetched ${exerciseVideos.length} exercise videos`);
  
      // 3. Map videos to exercises
      const exercisesWithVideos = exercises.map(exercise => {
        const matchingVideos = exerciseVideos.filter(
          (video) => video.exercise.toLowerCase() === exercise.name.toLowerCase()
        );
       
        return new Exercise({
          ...exercise,
          videos: matchingVideos
        });
       });
  
      // console.log('Finished mapping exercises with videos');
      // console.log(`Total exercises with videos: ${exercisesWithVideos.length}`);
        
      return exercisesWithVideos;
    } catch (error) {
      console.error('Error fetching and mapping exercises with videos:', error);
      throw error;
    }
  }

  /**
   * Helper to build the Workout object + any logs from the snapshot.
   */
  async fetchAllWorkoutSessions(userId: string): Promise<{
    workout: Workout | null;
    logs: ExerciseLog[] | null;
   }[]> {
    if (!userId) {
      throw new Error('No user ID provided');
    }
   
    try {
      const exerciseSnapshot = await getDocs(collection(db, 'exercises'));
      const exercises = exerciseSnapshot.docs.map((doc) => 
        new Exercise({
          id: doc.id,
          ...doc.data()
        })
      );
  
      const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
      const exerciseVideos = videoSnapshot.docs.map((doc) => 
        new ExerciseVideo({
          id: doc.id,
          ...doc.data()
        })
      );
   
      const exercisesWithVideos = exercises.map(exercise => {
        const matchingVideos = exerciseVideos.filter(
          (video) => video.exercise.toLowerCase() === exercise.name.toLowerCase()
        );
   
        return new Exercise({
          ...exercise,
          videos: matchingVideos
        });
      });
   
      const workoutSessionsRef = collection(db, 'users', userId, 'workoutSessions');
      const snap = await getDocs(workoutSessionsRef);
   
      if (snap.empty) {
        console.log('No workout sessions found for user');
        return [];
      }
   
      const sessions = await Promise.all(
        snap.docs.map(async (doc) => {
          const sessionData = await this.processWorkoutSessionDocument(
            doc, 
            exercisesWithVideos
          );
          
          if (sessionData.logs) {
            sessionData.logs.sort((a, b) => {
              const orderA = a.order ?? 0;
              const orderB = b.order ?? 0;
              return orderA - orderB;
            });
          }
   
          return sessionData;
        })
      );
   
      return sessions;
    } catch (error) {
      console.error('Error fetching workout sessions:', error);
      throw error;
    }
   }

   // Add the updateUserChallenge method
  async updateUserChallenge(challenge: UserChallenge): Promise<void> {
    if (!userService.nonUICurrentUser?.id) {
        throw new Error('No user is signed in');
    }

    // Add safeguard check for ID
    if (!challenge.id) {
      console.error('Error updating user challenge: Provided UserChallenge has no ID.', challenge);
      throw new Error('Cannot update UserChallenge without a valid ID.');
    }

    try {
        const challengeRef = doc(db, 'user-challenge', challenge.id);
        console.log("[updateUserChallenge] Challenge to update:", challenge);
        
        // --- Convert UserChallenge instance to a plain object --- 
        // Assuming UserChallenge has a toDictionary method that handles nested objects
        const challengeData = challenge.toDictionary(); 
        console.log("[updateUserChallenge] Challenge data:", challengeData);

        // --- Add/overwrite the update timestamp using Unix timestamp ---
        challengeData.updatedAt = dateToUnixTimestamp(new Date());
        
        // Optional debugging log
        // console.log("[updateUserChallenge] Data being sent to setDoc:", challengeData);

        // --- Detailed Log Before Save ---
        console.log("[updateUserChallenge] Type of challengeData.challenge:", typeof challengeData.challenge);
        if (challengeData.challenge && challengeData.challenge.constructor) {
            console.log("[updateUserChallenge] Constructor name of challengeData.challenge:", challengeData.challenge.constructor.name);
        } else if (challengeData.challenge === null) {
            console.log("[updateUserChallenge] challengeData.challenge is null.");
        } else {
            console.log("[updateUserChallenge] challengeData.challenge has no constructor or is undefined/primitive.");
        }
        // Also log stringified version to see the structure Firestore likely gets
        try {
            console.log("[updateUserChallenge] Full challengeData object (stringified):", JSON.stringify(challengeData, null, 2)); 
        } catch (stringifyError) {
            console.error("[updateUserChallenge] Error stringifying challengeData:", stringifyError);
            console.log("[updateUserChallenge] challengeData object (raw):", challengeData); // Log raw object if stringify fails
        }
        // --- End Detailed Log ---

        await setDoc(challengeRef, challengeData, { merge: true });
        console.log('User challenge updated successfully');
    } catch (error) {
        console.error('Error updating user challenge:', error);
        // Consider logging the data that caused the error
        // console.error('Data that caused error:', challengeData)
        throw error; // Re-throw original error
    }
  }

  async updateCollection(collection: SweatlistCollection): Promise<SweatlistCollection> {
    try {
      const collRef = fsCollection(db, "sweatlist-collection");
  
      // If collection.id is empty, generate a new doc ID and assign it.
      if (!collection.id || collection.id.trim() === "") {
        const newDocRef = doc(collRef);
        collection.id = newDocRef.id;
      }
  
      // Ensure the challenge id matches the collection id.
      if (collection.challenge) {
        collection.challenge.id = collection.id;
      }
  
      // Update the updatedAt field.
      collection.updatedAt = new Date();
  
      // Save the collection to Firestore.
      await setDoc(doc(collRef, collection.id), collection.toDictionary());
      console.log("Collection updated successfully");
      return collection;
    } catch (error) {
      console.error("Error updating collection document:", error);
      throw new Error("Error while updating the collection");
    }
  }
  
  private async processWorkoutSessionDocument(
    workoutDoc: QueryDocumentSnapshot<DocumentData>,
    exercisesWithVideos: Exercise[]
  ): Promise<{ workout: Workout; logs: ExerciseLog[] }> {
    const data = workoutDoc.data();

    // Map exercises with their full data and videos
    const mappedExercises = (data.exercises || []).map((exerciseRef: any) => {
      // Find matching exercise just for its videos
      const exerciseNameLower = exerciseRef.exercise?.name?.toLowerCase().trim();
      const matchingExercise = exercisesWithVideos.find(
        ex => ex.name.toLowerCase().trim() === exerciseNameLower
      );

      // Create new Exercise using original data but add videos from matching exercise
      return {
        ...exerciseRef,
        exercise: new Exercise({
          ...exerciseRef.exercise,
          videos: matchingExercise?.videos || [],
          // Explicitly preserve the original category
          category: exerciseRef.exercise.category
        })
      };
    });
  

    // Create the workout with mapped exercises
    const workout = new Workout({
      id: workoutDoc.id,
      roundWorkoutId: data.roundWorkoutId || '',
      exercises: mappedExercises,
      title: data.title || '',
      description: data.description || '',
      duration: data.duration || 0,
      useAuthorContent: data.useAuthorContent || false,
      isCompleted: data.isCompleted || false,
      workoutStatus: data.workoutStatus || WorkoutStatus.Archived,
      author: data.author || '',
      createdAt: convertFirestoreTimestamp(data.createdAt),
      updatedAt: convertFirestoreTimestamp(data.updatedAt),
      startTime: convertFirestoreTimestamp(data.startTime),
      collectionId: data.collectionId,
      challenge: data.challenge,
      logs: (data.logs || []).map((logData: any) => {
        // Map logs with full exercises
        const exerciseNameLower = logData.exercise?.name?.toLowerCase().trim();
        const fullExercise = exercisesWithVideos.find(
          ex => ex.name.toLowerCase().trim() === exerciseNameLower
        );
  
        return {
          ...logData,
          exercise: fullExercise || logData.exercise
        };
      }),
      workoutRating: data.workoutRating,
      order: data.order,
      zone: data.zone || BodyZone.FullBody
    });
  
    // Fetch logs from subcollection
    const logsRef = collection(workoutDoc.ref, 'logs');
    const logsSnapshot = await getDocs(logsRef);
    
    const logs: ExerciseLog[] = logsSnapshot.docs.map(logDoc => {
      const logData = logDoc.data();
      
      // Find the corresponding mapped exercise that we already processed
      const matchingMappedExercise = mappedExercises.find(
        (ex: ExerciseReference) => ex.exercise.name.toLowerCase().trim() === logData.exercise?.name?.toLowerCase().trim()
      );

      const preparedLogData = {
        ...logData,
        id: logDoc.id,
        workoutId: workout.id,
        // Use the exercise from our mapped exercises which already has the correct category and videos
        exercise: matchingMappedExercise?.exercise || logData.exercise,
        createdAt: convertFirestoreTimestamp(logData.createdAt),
        updatedAt: convertFirestoreTimestamp(logData.updatedAt)
      };

      return new ExerciseLog(preparedLogData);
    });
  
    return { workout, logs };
  }

  async saveWorkoutSession({
    userId,
    workout,
    logs
  }: {
    userId: string,
    workout: Workout,
    logs: ExerciseLog[]
  }): Promise<{ workout: Workout | null; logs: ExerciseLog[] }> {
    if (!userId) throw new Error('No user ID provided');

    try {
      // *** START: Cleanup existing QueuedUp sessions ***
      const sessionsRef = collection(db, 'users', userId, 'workoutSessions');
      const q = query(sessionsRef, where('workoutStatus', '==', WorkoutStatus.QueuedUp));
      const queuedSnapshot = await getDocs(q);

      if (!queuedSnapshot.empty) {
        console.log(`[WorkoutService] Found ${queuedSnapshot.size} existing QueuedUp session(s) for user ${userId}. Cleaning up...`);
        const deleteBatch = writeBatch(db);
        
        // Use Promise.all to handle asynchronous log fetching for all sessions
        await Promise.all(queuedSnapshot.docs.map(async (sessionDoc) => {
          // Delete logs subcollection first
          const logsToDeleteRef = collection(sessionDoc.ref, 'logs');
          const logsToDeleteSnapshot = await getDocs(logsToDeleteRef);
          logsToDeleteSnapshot.forEach(logDoc => {
            deleteBatch.delete(logDoc.ref);
          });
          // Then delete the session doc itself
          deleteBatch.delete(sessionDoc.ref);
        }));

        await deleteBatch.commit();
        console.log(`[WorkoutService] Finished cleaning up existing QueuedUp sessions.`);
      } else {
        console.log(`[WorkoutService] No existing QueuedUp sessions found for user ${userId}.`);
      }
      // *** END: Cleanup existing QueuedUp sessions ***

      console.log('Incoming logs:', logs.map(log => ({
        name: log.exercise.name,
        category: log.exercise.category,
        originalType: log.exercise.category?.type
      })));

      const currentDate = new Date();
      
      const cleanWorkout = new Workout({
        ...workout,
        // Generate a NEW ID for the session document itself
        id: doc(sessionsRef).id, // Generate ID here
        roundWorkoutId: `${workout.id}-${currentDate.getTime()}`,
        workoutStatus: WorkoutStatus.QueuedUp,
        createdAt: currentDate,
        updatedAt: currentDate,
        startTime: currentDate,
        logs: [] // Logs stored in subcollection
      });

      // Use the generated ID for the document reference
      const workoutSessionRef = doc(db, 'users', userId, 'workoutSessions', cleanWorkout.id);
      await setDoc(workoutSessionRef, cleanWorkout.toDictionary());

      const logsRef = collection(workoutSessionRef, 'logs');
      const logBatch = writeBatch(db);
      const updatedLogsWithNewIds: ExerciseLog[] = []; // Array to hold logs with updated IDs

      logs.forEach((log, index) => {
        // Generate a unique ID for the log document within the subcollection
        const logDocRef = doc(logsRef);
        const newLogId = logDocRef.id; // Use Firestore generated ID
        
        // Update the log instance's ID
        const updatedLog = new ExerciseLog({ ...log, id: newLogId });
        updatedLogsWithNewIds.push(updatedLog);

        console.log(`Processing log ${index} (New ID: ${newLogId}):`, {
          name: updatedLog.exercise.name,
          originalCategory: updatedLog.exercise.category,
          originalType: updatedLog.exercise.category?.type
        });

        logBatch.set(logDocRef, {
          ...updatedLog.toDictionary(),
          workoutId: cleanWorkout.id, // Use the new workout session ID
          order: index,
          logSubmitted: false,
          isCompleted: false
        });
      }); 

      await logBatch.commit();
      
      // Return the workout AND the logs with their new Firestore document IDs
      return { workout: cleanWorkout, logs: updatedLogsWithNewIds }; 
    } catch (error) {
      console.error('Error saving workout session:', error);
      throw error;
    }
  }

  /**
   * Example "join challenge" method using the client SDK (no admin privileges).
   * This creates a doc in `user-challenge` with the userId, challengeId, etc.
   */
  async joinChallenge({
    username,
    challengeId,
    sharedBy
  }: {
    username: string;
    challengeId: string;
    sharedBy?: string;
  }): Promise<any> {
    // 1) Make sure we have a signed-in user
    const currentUser = userService.nonUICurrentUser;
    if (!currentUser) {
      throw new Error('No user is signed in');
    }

    // 2) Find the user doc by username
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('username', '==', username));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      throw new Error('User not found');
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    // 3) Check if the challenge doc exists
    const challengeRef = doc(db, 'sweatlist-collection', challengeId);
    const challengeSnap = await getDoc(challengeRef);

    if (!challengeSnap.exists()) {
      throw new Error('Challenge not found');
    }

    const challengeData = challengeSnap.data();

    // Current time as Date objects to be used in our app logic
    const now = new Date();
    
    // 4) Build new user-challenge document
    const userChallengeId = `${challengeId}-${userId}-${Date.now()}`;
    
    // Store the challenge data exactly as it is in Firestore - no conversion needed!
    // This preserves the exact Unix timestamps from the original challenge
    const challengeForStorage = challengeData;
    
    const userChallengeData = {
      id: userChallengeId,
      challenge: challengeForStorage,
      challengeId,
      userId,
      fcmToken: userData.fcmToken || '',
      profileImage: userData.profileImage || {},
      progress: 0,
      completedWorkouts: [],
      referralChain: {
        originalHostId: sharedBy || '',
        sharedBy: sharedBy || ''
      },
      isCompleted: false,
      uid: userId,
      location: userData.location || null,
      city: '',
      country: '',
      timezone: '',
      username,
      // Store dates as Unix timestamps (seconds since epoch) for consistency with iOS
      joinDate: dateToUnixTimestamp(now),
      createdAt: dateToUnixTimestamp(now),
      updatedAt: dateToUnixTimestamp(now),
      pulsePoints: {
        baseCompletion: 0,
        firstCompletion: 0,
        streakBonus: 0,
        checkInBonus: 0,
        effortRating: 0,
        chatParticipation: 0,
        locationCheckin: 0,
        contentEngagement: 0,
        encouragementSent: 0,
        encouragementReceived: 0
      },
      currentStreak: 0,
      encouragedUsers: [],
      encouragedByUsers: [],
      checkIns: []
    };

    // 5) Store user-challenge doc
    await setDoc(doc(db, 'user-challenge', userChallengeId), userChallengeData);
    
    // Return the created data for logging/debugging purposes
    return userChallengeData;
  }

  async fetchUserChallengeById(id: string): Promise<UserChallenge | null> {
    try {
      const docRef = doc(db, 'user-challenge', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      return new UserChallenge({
        id: docSnap.id,
        ...docSnap.data()
      });
    } catch (error) {
      console.error('Error fetching user challenge by ID:', error);
      return null;
    }
  }

  /**
   * Deletes a user challenge by ID
   * @param id The ID of the user challenge to delete
   * @returns A promise resolving to a success flag and message
   */
  async deleteUserChallenge(id: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!id) {
        return {
          success: false,
          message: "Invalid user challenge ID"
        };
      }

      // First fetch to ensure it exists
      const challengeRef = doc(db, 'user-challenge', id);
      const challengeSnap = await getDoc(challengeRef);
      
      if (!challengeSnap.exists()) {
        return {
          success: false,
          message: "User challenge not found"
        };
      }
      
      // Delete the document
      await deleteDoc(challengeRef);
      
      return {
        success: true,
        message: "User challenge successfully deleted"
      };
    } catch (error) {
      console.error('Error deleting user challenge:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        message: `Failed to delete: ${errorMessage}`
      };
    }
  }

  private get nonUICurrentUser(): User | null {
    return userService.nonUICurrentUser;
  }

  /**
   * Fetches all SweatlistCollections that contain a challenge object.
   * Intended for admin purposes.
   * @returns {Promise<SweatlistCollection[]>} Array of collections with challenges.
   */
  async fetchAllAdminCollections(): Promise<SweatlistCollection[]> {
    try {
      const collectionsRef = collection(db, 'sweatlist-collection');
      
      // Query for documents where the 'challenge' field exists and is not null.
      // Firestore doesn't directly support "exists", but we can query for a known subfield
      // or filter out nulls later. A simpler approach is to fetch all and filter client-side if needed,
      // or query for a mandatory field within challenge like 'status'.
      // Let's query for challenge.status exists indirectly by ordering by it and filtering non-null later
      // Or simply fetch all collections and filter.
      // Let's fetch all and filter for simplicity and robustness against missing optional fields.

      // Fetch all documents in the collection
      const snapshot = await getDocs(query(collectionsRef, orderBy('createdAt', 'desc'))); // Order by creation

      const collections = snapshot.docs
        .map(doc => {
          try {
            const data = doc.data();
            // Only include if the challenge object exists and is not empty/null
            if (data.challenge && typeof data.challenge === 'object' && Object.keys(data.challenge).length > 0) {
              return new SweatlistCollection({
                id: doc.id,
                ...data
              });
            } 
            return null;
          } catch(mapError) {
            console.error(`Error mapping SweatlistCollection with id ${doc.id}:`, mapError);
            return null;
          }
        })
        .filter((collection): collection is SweatlistCollection => collection !== null); // Filter out nulls

      console.log(`Fetched ${collections.length} collections with challenges for admin view.`);
      return collections;

    } catch (error) {
      console.error('Error fetching all admin collections:', error);
      return []; // Return empty array on error
    }
  }

  // --- Share Link Generation --- 
  async generateShareableRoundLink(collectionData: SweatlistCollection, currentUser: User): Promise<string | null> {
    if (!currentUser || !collectionData || !collectionData.id) {
      console.error("Missing user or collection data for link generation.");
      return null;
    }

    const collectionId = collectionData.id;
    const userId = currentUser.id;
    // Use first owner as default host ID if no specific referral logic yet
    const hostId = collectionData.ownerId?.[0] || userId; 

    const isPaid = collectionData.challenge?.pricingInfo?.isEnabled ?? false;

    // --- Construct Base Fallback URL --- (Used for both paid and free links)
    const fallbackBaseURL = `https://fitwithpulse.ai/round-invitation/${collectionId}`;
    const fallbackParams = new URLSearchParams({
      id: hostId,
      sharedBy: userId
    });
    const fallbackURLString = `${fallbackBaseURL}?${fallbackParams.toString()}`;

    // --- Paid Round: Return Direct Web Fallback --- 
    if (isPaid) {
      console.log("Round is paid. Generating direct web fallback link.");
      return fallbackURLString;
    }

    // --- Free Round: Generate AppsFlyer OneLink --- 
    console.log("Round is free. Generating AppsFlyer OneLink.");
    try {
      const oneLinkSubdomain = "fitwithpulse.onelink.me"; // Your OneLink subdomain
      const oneLinkID = "yffD"; // Your OneLink Template ID
      const oneLinkBaseURL = `https://${oneLinkSubdomain}/${oneLinkID}`;
      
      // URL-encode the fallback URL for the af_r parameter value
      const encodedFallbackURL = encodeURIComponent(fallbackURLString);

      // Define parameters
      const params = new URLSearchParams({
        pid: "user_share", // Media Source
        c: "round_share", // Campaign
        af_referrer_customer_id: userId, // Referrer ID
        // --- Custom Deep Link Params --- 
        deep_link_value: "round", 
        roundId: collectionId,
        id: hostId, // Original Host ID
        sharedBy: userId, // User who shared
        // --- Fallback Redirect --- 
        af_r: encodedFallbackURL
      });

      // --- Social Preview (Open Graph) Params --- 
      const challengeTitle = collectionData.challenge?.title || collectionData.title || 'Pulse Challenge';
      const startDate = collectionData.challenge?.startDate ? new Date(collectionData.challenge.startDate).toLocaleDateString() : '';
      const endDate = collectionData.challenge?.endDate ? new Date(collectionData.challenge.endDate).toLocaleDateString() : '';
      const dateRange = startDate && endDate ? `${startDate} - ${endDate}` : 'Check it out!';
      const previewTitle = challengeTitle;
      const previewDescription = `Join me in this fitness challenge on Pulse! 🏋️‍♂️ ${dateRange}`;
      const previewImageURL = "https://fitwithpulse.ai/round-preview.png"; // Use your actual preview image URL

      params.set("af_og_title", previewTitle);
      params.set("af_og_description", previewDescription);
      params.set("af_og_image", previewImageURL);

      const finalURL = `${oneLinkBaseURL}?${params.toString()}`;
      console.log("Generated AppsFlyer OneLink: ", finalURL);
      return finalURL;

    } catch (error) {
      console.error("Error generating AppsFlyer OneLink:", error);
      console.log("Falling back to simple web URL due to OneLink generation error.")
      // Fallback to the simpler web URL if OneLink generation fails
      return fallbackURLString; 
    }
  }
  // --- End Share Link Generation ---

  // --- Remove Sweatlist from Collection --- 
  /**
   * Removes a specific sweatlist (stack) from a sweatlist collection (round).
   * @param collectionId The ID of the SweatlistCollection document.
   * @param sweatlistId The ID of the sweatlist to remove from the 'sweatlistIds' array.
   */
  async removeStackFromRound(collectionId: string, sweatlistId: string): Promise<void> {
    if (!collectionId || !sweatlistId) {
      throw new Error('Collection ID and Sweatlist ID are required.');
    }

    const collectionRef = doc(db, 'sweatlist-collection', collectionId);

    try {
      console.log(`Attempting to remove sweatlist ${sweatlistId} from collection ${collectionId}`);
      
      // Get the current document data
      const docSnap = await getDoc(collectionRef);

      if (!docSnap.exists()) {
        throw new Error(`Sweatlist Collection with ID ${collectionId} not found.`);
      }

      const collectionData = docSnap.data();
      const currentSweatlistIdsData = collectionData.sweatlistIds || [];
      // Instantiate SweatlistIdentifiers from the raw data
      const currentSweatlistIds: SweatlistIdentifiers[] = currentSweatlistIdsData.map((data: any) => new SweatlistIdentifiers(data));
      console.log('Current sweatlistIds (instantiated):', currentSweatlistIds);

      // Filter out the sweatlist to be removed
      const updatedSweatlistIds = currentSweatlistIds.filter(sweatlist => sweatlist.id !== sweatlistId);
      console.log('Updated sweatlistIds:', updatedSweatlistIds);

      if (updatedSweatlistIds.length === currentSweatlistIds.length) {
        console.warn(`Sweatlist with ID ${sweatlistId} not found within the collection ${collectionId}. No update performed.`);
        // Optionally throw an error or just return if you consider this an issue
        // throw new Error(`Sweatlist with ID ${sweatlistId} not found within the collection.`);
        return; 
      }

      // Update the document with the filtered array
      await updateDoc(collectionRef, {
        sweatlistIds: updatedSweatlistIds.map(sl => sl.toDictionary()), // Ensure objects are plain for Firestore
        updatedAt: serverTimestamp() // Update the timestamp
      });

      console.log(`Successfully removed sweatlist ${sweatlistId} from collection ${collectionId}`);

    } catch (error) {
      console.error(`Error removing sweatlist ${sweatlistId} from collection ${collectionId}:`, error);
      // Re-throw the error to be caught by the calling function
      throw error;
    }
  }
  // --- End Remove Sweatlist --- 

  // --- Clear All Sweatlists from Collection --- 
  /**
   * Removes ALL sweatlists (stacks) from a sweatlist collection (round) by setting sweatlistIds to [].
   * @param collectionId The ID of the SweatlistCollection document.
   */
  async clearAllStacksFromRound(collectionId: string): Promise<void> {
    if (!collectionId) {
      throw new Error('Collection ID is required.');
    }

    const collectionRef = doc(db, 'sweatlist-collection', collectionId);

    try {
      console.log(`Attempting to clear all sweatlists and workoutIdList from collection ${collectionId}`);
      
      // Check if the document exists before updating
      const docSnap = await getDoc(collectionRef);
      if (!docSnap.exists()) {
        throw new Error(`Sweatlist Collection with ID ${collectionId} not found.`);
      }

      // Log current state before clearing
      const currentData = docSnap.data();
      console.log(`🔍 Current sweatlistIds count: ${currentData.sweatlistIds?.length || 0}`);
      console.log(`🔍 Current workoutIdList count: ${currentData.workoutIdList?.length || 0}`);

      // Update the document, setting both sweatlistIds and workoutIdList to empty arrays
      await updateDoc(collectionRef, {
        sweatlistIds: [], // Set to empty array
        workoutIdList: [], // Also clear workoutIdList
        updatedAt: serverTimestamp() // Update the timestamp
      });

      console.log(`✅ Successfully cleared both sweatlistIds and workoutIdList from collection ${collectionId}`);

    } catch (error) {
      console.error(`Error clearing sweatlists from collection ${collectionId}:`, error);
      // Re-throw the error to be caught by the calling function
      throw error;
    }
  }
  // --- End Clear All Sweatlists ---

  // --- Update Challenge Status --- 
  /**
   * Updates the status of the challenge nested within a SweatlistCollection.
   * @param collectionId The ID of the SweatlistCollection document.
   * @param newStatus The new status to set for the challenge.
   */
  async updateChallengeStatus(collectionId: string, newStatus: ChallengeStatus): Promise<void> {
    if (!collectionId || !newStatus) {
      throw new Error('Collection ID and new status are required.');
    }

    // Validate the status value if necessary (ensure it's one of the allowed ChallengeStatus enum values)
    const validStatuses = Object.values(ChallengeStatus);
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid challenge status provided: ${newStatus}`);
    }

    const collectionRef = doc(db, 'sweatlist-collection', collectionId);

    try {
      console.log(`Attempting to update challenge status to '${newStatus}' for collection ${collectionId}`);

      // Check if the document exists before updating
      const docSnap = await getDoc(collectionRef);
      if (!docSnap.exists()) {
        throw new Error(`Sweatlist Collection with ID ${collectionId} not found.`);
      }

      // Prepare the update data using dot notation for nested field
      const updateData = {
        'challenge.status': newStatus,
        'challenge.updatedAt': serverTimestamp(), // Update the challenge's timestamp
        'updatedAt': serverTimestamp() // Also update the collection's timestamp
      };

      await updateDoc(collectionRef, updateData);

      console.log(`Successfully updated challenge status to '${newStatus}' for collection ${collectionId}`);

    } catch (error) {
      console.error(`Error updating challenge status for collection ${collectionId}:`, error);
      throw error; // Re-throw
    }
  }
  // --- End Update Challenge Status ---

  // --- Batch Update User Challenge Status --- 
  /**
   * Updates the status within the nested challenge object for all UserChallenge
   * documents associated with a given challenge ID.
   *
   * @param challengeId The ID of the main challenge (equivalent to collectionId).
   * @param newStatus The new status to set.
   */
  async updateStatusForAllUserChallenges(challengeId: string, newStatus: ChallengeStatus): Promise<void> {
    if (!challengeId || !newStatus) {
      throw new Error('Challenge ID and new status are required for batch update.');
    }

    const userChallengesRef = collection(db, 'user-challenge');
    const q = query(userChallengesRef, where('challengeId', '==', challengeId));

    console.log(`Starting batch update for user challenges status to '${newStatus}' for challenge ID: ${challengeId}`);

    try {
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log(`No user challenges found for challenge ID ${challengeId}. No batch update needed.`);
        return; // Nothing to update
      }

      const batch = writeBatch(db);
      const nowTimestamp = serverTimestamp(); // Use server timestamp for consistency

      snapshot.forEach(doc => {
        console.log(` - Adding update for user-challenge: ${doc.id}`);
        batch.update(doc.ref, {
          'challenge.status': newStatus,
          'challenge.updatedAt': nowTimestamp, // Update nested challenge timestamp
          'updatedAt': nowTimestamp // Also update user-challenge timestamp
        });
      });

      await batch.commit();
      console.log(`Successfully committed batch update for ${snapshot.size} user challenges.`);

    } catch (error) {
      console.error(`Error during batch update of user challenges for challenge ID ${challengeId}:`, error);
      throw error; // Re-throw
    }
  }
  // --- End Batch Update User Challenge Status ---

  // --- Bulk Update Challenge Type (Migration) ---
  /**
   * Bulk updates all challenges to set challengeType to 'workout' for migration purposes
   * This is used for migrating existing challenges to the new challenge type system
   * 
   * @param challengeType The challenge type to set (defaults to 'workout')
   * @returns Promise resolving to the number of challenges updated
   */
  async bulkUpdateChallengeType(challengeType: string = 'workout'): Promise<{ updated: number, errors: string[] }> {
    try {
      console.log(`Starting bulk update to set challengeType to '${challengeType}' for all challenges`);
      
      // Fetch all collections
      const collectionsRef = collection(db, 'sweatlist-collection');
      const snapshot = await getDocs(collectionsRef);
      
      if (snapshot.empty) {
        console.log('No challenges found to update.');
        return { updated: 0, errors: [] };
      }

      const batch = writeBatch(db);
      const nowTimestamp = serverTimestamp();
      let updateCount = 0;
      const errors: string[] = [];

      snapshot.forEach(doc => {
        try {
          const data = doc.data();
          
          // Only update if challenge exists and doesn't already have challengeType
          if (data.challenge && !data.challenge.challengeType) {
            console.log(`Adding challengeType update for challenge: ${doc.id}`);
            
            batch.update(doc.ref, {
              'challenge.challengeType': challengeType,
              'challenge.dailyStepGoal': 10000, // Default value
              'challenge.totalStepGoal': 0, // Default value
              'challenge.allowedMissedDays': 0, // Default value
              'challenge.updatedAt': nowTimestamp,
              'updatedAt': nowTimestamp
            });
            
            updateCount++;
          } else if (data.challenge && data.challenge.challengeType) {
            console.log(`Challenge ${doc.id} already has challengeType: ${data.challenge.challengeType}`);
          } else {
            console.log(`Challenge ${doc.id} has no challenge object, skipping`);
          }
        } catch (error) {
          const errorMsg = `Error processing challenge ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        console.log(`Successfully updated challengeType for ${updateCount} challenges`);
      } else {
        console.log('No challenges needed updating');
      }

      return { updated: updateCount, errors };

    } catch (error) {
      const errorMsg = `Error during bulk challengeType update: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }
  // --- End Bulk Update Challenge Type ---

  /**
   * Creates a test workout session for a specific user
   * This is used exclusively for testing workout start notifications in the admin panel
   * 
   * @param userId The ID of the user to create the test session for
   * @param sessionData The workout session data to use
   * @returns The ID of the created session
   */
  async createTestWorkoutSession(userId: string, sessionData: any): Promise<string> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Generate a unique ID for the workout session
      const sessionId = doc(collection(db, 'workout-sessions')).id;
      
      // Prepare the data with the status that will trigger the notification
      const testData = {
        ...sessionData,
        id: sessionId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Create a session doc in both the user's subcollection and the root collection
      // 1. First in user's subcollection
      const userSessionRef = doc(db, 'users', userId, 'workoutSessions', sessionId);
      await setDoc(userSessionRef, testData);
      
      // 2. Also create in the root collection (this normally happens via Cloud Function)
      // But we'll do it directly to ensure it's available immediately
      const rootSessionRef = doc(db, 'workout-sessions', sessionId);
      await setDoc(rootSessionRef, {
        ...testData,
        userId // Make sure userId is included in the root collection
      });

      console.log(`Created test workout session with ID ${sessionId} for user ${userId}`);
      return sessionId;
    } catch (error) {
      console.error('Error creating test workout session:', error);
      throw error;
    }
  }

  /**
   * Deletes a test workout session
   * This is used to clean up after testing workout start notifications
   * 
   * @param userId The ID of the user who owns the session
   * @param sessionId The ID of the session to delete
   */
  async deleteTestWorkoutSession(userId: string, sessionId: string): Promise<void> {
    try {
      if (!userId || !sessionId) {
        throw new Error('User ID and Session ID are required');
      }

      const userSessionRef = doc(db, 'users', userId, 'workoutSessions', sessionId);
      const logsRef = collection(userSessionRef, 'logs');

      // Delete all logs in the subcollection
      const logsSnapshot = await getDocs(logsRef);
      const batch = writeBatch(db);
      logsSnapshot.docs.forEach((logDoc) => {
        batch.delete(logDoc.ref);
      });
      await batch.commit(); // Commit deletion of logs first

      // Then delete the main session document from user's subcollection
      await deleteDoc(userSessionRef);
      
      // And delete from root collection if it exists there
      const rootSessionRef = doc(db, 'workout-sessions', sessionId);
      const rootSessionSnap = await getDoc(rootSessionRef);
      if (rootSessionSnap.exists()) {
        await deleteDoc(rootSessionRef);
      }

      console.log(`Deleted test workout session ${sessionId} for user ${userId}`);
    } catch (error) {
      console.error('Error deleting test workout session:', error);
      throw error;
    }
  }

  /**
   * Creates a full test workout session including its exercise logs.
   * @param userId The ID of the user (participant).
   * @param workoutTemplate The Workout object to use as a template.
   * @param templateLogs The array of ExerciseLog objects from the template.
   * @param challengeId The ID of the challenge this test session is associated with (optional).
   * @param sweatlistId The ID of the sweatlist (workout template) this session is based on (optional).
   * @returns The ID of the created session and the created ExerciseLog objects.
   */
  async createFullTestWorkoutSession(
    userId: string,
    workoutTemplate: Workout,
    templateLogs: ExerciseLog[],
    challengeId: string | null,
    sweatlistId: string | null
  ): Promise<{ sessionId: string; createdLogObjects: ExerciseLog[] }> {
    if (!userId) throw new Error('User ID is required for creating a test session.');
    if (!workoutTemplate) throw new Error('Workout template is required.');

    const sessionsRef = collection(db, 'users', userId, 'workoutSessions');
    const newSessionId = doc(sessionsRef).id; // Generate ID for the new session

    const now = new Date();

    const sessionData = new WorkoutSession({
      id: newSessionId,
      userId: userId, // WorkoutSession needs userId
      workoutTemplateId: workoutTemplate.id, // Link to the Workout template
      challengeId: challengeId, // Pass the specific challengeId for this session
      roundWorkoutId: `${workoutTemplate.id}-${now.getTime()}`,
      title: workoutTemplate.title || 'Test Simulation Workout',
      description: workoutTemplate.description, // Optional, can be from template
      author: workoutTemplate.author, // Ensure this is passed
      // Exercises are typically not directly on the session document if logs reference a template.
      // Logs will be created in the subcollection.
      workoutStatus: WorkoutStatus.InProgress,
      startTime: now,
      createdAt: now,
      updatedAt: now,
    });

    // Log the relevant parts of sessionData (which is now a WorkoutSession instance)
    console.log('[WorkoutService createFullTestWorkoutSession] Session data being written (WorkoutSession instance):', JSON.stringify({ id: sessionData.id, userId: sessionData.userId, workoutTemplateId: sessionData.workoutTemplateId, challengeId: sessionData.challengeId, workoutStatus: sessionData.workoutStatus, author: sessionData.author, title: sessionData.title }, null, 2)); // DEBUG LOG

    const workoutSessionRef = doc(db, 'users', userId, 'workoutSessions', newSessionId);
    await setDoc(workoutSessionRef, sessionData.toDictionary());

    // Also create in root `workout-sessions` for consistency if your functions expect it
    const rootSessionRef = doc(db, 'workout-sessions', newSessionId);
    await setDoc(rootSessionRef, { ...sessionData.toDictionary(), userId });


    const logsSubcollectionRef = collection(workoutSessionRef, 'logs');
    const createdLogObjects: ExerciseLog[] = [];
    const logBatch = writeBatch(db);

    for (let i = 0; i < templateLogs.length; i++) {
      const templateLog = templateLogs[i];
      const newLogDocRef = doc(logsSubcollectionRef); // Auto-generate ID for each log
      
      const newLog = new ExerciseLog({
        ...templateLog, // Spread fields from template log
        id: newLogDocRef.id, // Assign new Firestore-generated ID
        workoutId: newSessionId, // Link to the new session
        userId: userId, // Participant's ID
        logSubmitted: false,
        isCompleted: false,
        completedAt: null, // Not completed yet
        createdAt: now,
        updatedAt: now,
        order: templateLog.order !== undefined && templateLog.order !== null ? templateLog.order : i, // Ensure order
      });
      
      logBatch.set(newLogDocRef, newLog.toDictionary());
      createdLogObjects.push(newLog);
    }

    await logBatch.commit();

    console.log(`Created full test workout session ${newSessionId} for user ${userId} with ${createdLogObjects.length} logs.`);
    return { sessionId: newSessionId, createdLogObjects };
  }

  /**
   * Simulates updating an exercise log, e.g., marking it as complete.
   * @param userId The ID of the user.
   * @param sessionId The ID of the workout session.
   * @param logId The ID of the exercise log to update.
   * @param updates A partial ExerciseLog object with fields to update.
   */
  async simulateUpdateExerciseLog(
    userId: string,
    sessionId: string,
    logId: string,
    updates: Partial<ExerciseLog> // Allow updating specific fields
  ): Promise<void> {
    if (!userId || !sessionId || !logId) {
      throw new Error('User ID, Session ID, and Log ID are required.');
    }
    const logRef = doc(db, 'users', userId, 'workoutSessions', sessionId, 'logs', logId);
    
    // Ensure dates are converted correctly if present in updates
    const firestoreUpdates: any = { ...updates };
    if (updates.completedAt) {
      firestoreUpdates.completedAt = dateToUnixTimestamp(updates.completedAt as Date);
    }
    if (updates.updatedAt) {
      firestoreUpdates.updatedAt = dateToUnixTimestamp(updates.updatedAt as Date);
    }
     if (updates.createdAt && !(updates.createdAt instanceof Date)) {
      // This case should ideally not happen if updates.createdAt is always a Date
      firestoreUpdates.createdAt = dateToUnixTimestamp(new Date(updates.createdAt as any));
    } else if (updates.createdAt) {
       firestoreUpdates.createdAt = dateToUnixTimestamp(updates.createdAt as Date);
    }


    // We don't want to update the exercise object itself, only log properties
    if (firestoreUpdates.exercise) {
      delete firestoreUpdates.exercise;
    }
    // We don't want to update the logs array (RepsAndWeightLog) itself, only log properties
    if (firestoreUpdates.logs) {
        delete firestoreUpdates.logs;
    }


    await updateDoc(logRef, firestoreUpdates);
    console.log(`Simulated update for log ${logId} in session ${sessionId}.`);
  }

  /**
   * Simulates updating a workout session, e.g., marking it as complete.
   * @param userId The ID of the user.
   * @param sessionId The ID of the workout session to update.
   * @param updates A partial Workout object with fields to update.
   */
  async simulateUpdateWorkoutSession(
    userId: string,
    sessionId: string,
    updates: Partial<WorkoutSession> // Changed from Partial<Workout> to Partial<WorkoutSession>
  ): Promise<void> {
    if (!userId || !sessionId) {
      throw new Error('User ID and Session ID are required.');
    }
    const sessionRef = doc(db, 'users', userId, 'workoutSessions', sessionId);
    
    const firestoreUpdates: any = { ...updates };
    // Convert dates if they are present
    if (updates.startTime) {
      firestoreUpdates.startTime = dateToUnixTimestamp(updates.startTime as Date);
    }
    // endTime is not a standard property of WorkoutSession, but if used, ensure it's handled.
    // If endTime comes from a custom part of 'updates', it might need specific handling.
    // For now, assuming if it exists in 'updates', it should be converted.
    if ((updates as any).endTime) { 
      firestoreUpdates.endTime = dateToUnixTimestamp((updates as any).endTime as Date);
    }
    if (updates.updatedAt) {
      firestoreUpdates.updatedAt = dateToUnixTimestamp(updates.updatedAt as Date);
    }
    if (updates.createdAt && !(updates.createdAt instanceof Date)) {
        firestoreUpdates.createdAt = dateToUnixTimestamp(new Date(updates.createdAt as any));
    } else if (updates.createdAt) {
        firestoreUpdates.createdAt = dateToUnixTimestamp(updates.createdAt as Date);
    }


    // Avoid overwriting entire nested objects if only partial updates are intended
    // For simplicity here, we assume direct field updates are fine.
    // If 'exercises' or 'logs' (the subcollection placeholder on Workout model) are in updates, remove them
    // as they are handled differently or are part of the template.
    if (firestoreUpdates.exercises) delete firestoreUpdates.exercises;
    if (firestoreUpdates.logs) delete firestoreUpdates.logs;


    await updateDoc(sessionRef, firestoreUpdates);

    // Also update the root collection document if it exists
     const rootSessionRef = doc(db, 'workout-sessions', sessionId);
     const rootSessionSnap = await getDoc(rootSessionRef);
     if (rootSessionSnap.exists()) {
       await updateDoc(rootSessionRef, firestoreUpdates);
     }

    console.log(`Simulated update for workout session ${sessionId}.`);
  }

  /**
   * Fetches the details of a specific workout (stack) from the 'stacks' collection.
   * @param stackId The ID of the workout/stack to fetch.
   * @returns A Promise resolving to the Workout object or null if not found.
   */
  async fetchStackWorkoutDetails(stackId: string): Promise<Workout | null> {
    if (!stackId) {
      console.error('fetchStackWorkoutDetails: stackId is required');
      return null;
    }
    try {
      const stackDocRef = doc(db, 'stacks', stackId);
      const stackDocSnap = await getDoc(stackDocRef);

      if (!stackDocSnap.exists()) {
        console.warn(`fetchStackWorkoutDetails: No stack found with ID ${stackId}`);
        return null;
      }

      const stackData = stackDocSnap.data();
      
      // Construct a base Workout object
      let workout = new Workout({
        id: stackDocSnap.id,
        ...stackData,
      });

      // Enrich exercises with videos
      // This assumes fetchVideosForWorkout can correctly populate videos based on exercise names
      // and that workout.exercises are already in ExerciseReference format or compatible
      workout = await this.fetchVideosForWorkout(workout);

      return workout;

    } catch (error) {
      console.error(`Error fetching stack workout details for ID ${stackId}:`, error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

}

export const workoutService = new WorkoutService();