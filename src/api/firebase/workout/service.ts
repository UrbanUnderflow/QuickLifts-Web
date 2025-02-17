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
  writeBatch
} from 'firebase/firestore';

import { db } from '../config';
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
import { Workout, WorkoutSummary, BodyZone, IntroVideo, RepsAndWeightLog, WorkoutRating } from '../workout/types';
import { WorkoutStatus, SweatlistCollection } from './types';
import { format } from 'date-fns'; 
import { convertTimestamp, serverTimestamp } from '../../../utils/timestamp'; // Adjust the import path
import { convertFirestoreTimestamp } from '../../../utils/formatDate';
import { Challenge, ChallengeStatus, UserChallenge } from '../../../api/firebase/workout/types';

import { store } from '../../../redux/store';
import { setCurrentWorkout, setCurrentExerciseLogs, resetWorkoutState, setWorkoutSummary } from '../../../redux/workoutSlice';


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
            duration: detail.category?.details?.duration ?? 60,
            bpm: detail.category?.details?.bpm ?? 140,
            calories: detail.category?.details?.calories ?? 0,
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

    // Create exercise reference
    const exerciseRef: ExerciseReference = {
      exercise: exerciseInstanceClass,
      groupId: detail.groupId || 0
    };
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
      userService.currentUser?.id || 'anonymous'
    );

    const log = new ExerciseLog({
      id: exerciseLogId,
      workoutId: workId,
      userId: userService.currentUser?.id || 'anonymous',
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
    author: userService.currentUser?.id || 'PulseAI',
    createdAt: new Date(),
    updatedAt: new Date(),
    zone: Workout.determineWorkoutZone(exerciseReferences) || 'full' as BodyZone
  });

  return { workout: newWorkout, exerciseLogs };

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
    if (!userService.currentUser?.id) throw new Error('No user signed in');
    
    const workoutRef = doc(db, 'users', userService.currentUser.id, 'MyCreatedWorkouts', workoutId);
    await updateDoc(workoutRef, {
      author: authorId
    });
   }

async updateWorkout(workout: Workout): Promise<void> {
  if (!userService.currentUser?.id) {
    throw new Error('No user is signed in');
  }

  try {
    const workoutRef = doc(db, 'users', userService.currentUser.id, 'MyCreatedWorkouts', workout.id);
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
          console.log("This is the mapped exercise: " + fullExercise);

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
    const currentUser = userService.currentUser;
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
    const currentUser = userService.currentUser;
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
              introVideos: (data.challenge.introVideos || []).map((v: any) => 
                new IntroVideo({
                  id: v.id,
                  userId: v.userId,
                  videoUrl: v.videoUrl
                })
              )
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
              introVideos: (data.challenge.introVideos || []).map((v: any) => 
                new IntroVideo({
                  id: v.id,
                  userId: v.userId,
                  videoUrl: v.videoUrl
                })
              )
            })
          : undefined,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
      };
    });

    // console.log('All user challenges after processing:', JSON.stringify(userChallenges, null, 2));

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
      return new SweatlistCollection({
        id: docSnap.id,
        ...docSnap.data()
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
      const currentUser = userService.currentUser;
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
                introVideos: (data.challenge.introVideos || []).map((v: any) => 
                  new IntroVideo({
                    id: v.id,
                    userId: v.userId,
                    videoUrl: v.videoUrl
                  })
                )
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
    const currentUser = userService.currentUser;
    if (!currentUser?.id) {
      throw new Error('No user is signed in');
    }

    // Reference to the user-challenge collection
    const userChallengesRef = collection(db, 'user-challenge');

    // Query challenges where userId matches the current user's ID
    const q = query(userChallengesRef, where('userId', '==', currentUser.id));

    try {
      const snapshot = await getDocs(q);

      // Map documents to an array of Challenge objects
      return snapshot.docs.map((doc: DocumentData) => new UserChallenge({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('Error fetching user challenges:', error);
      throw new Error('Failed to fetch user challenges');
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
  if (!userService.currentUser?.id || !workout) {
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
  if (!userService.currentUser?.id || !workoutId) {
    throw new Error("User not authenticated.");
  }
  const userId = userService.currentUser.id;
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
    if (!workoutSummaryId || !userService.currentUser?.id) {
      return;
    }
    
    try {
      const summaryRef = doc(db, "users", userService.currentUser.id, "workoutSummary", workoutSummaryId);
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
    if (!userService.currentUser?.id) {
        throw new Error('No user is signed in');
    }

    try {
        const challengeRef = doc(db, 'user-challenge', challenge.id);
        const challengeData = {
            ...challenge,
            updatedAt: new Date()
        };

        await setDoc(challengeRef, challengeData, { merge: true });
        console.log('User challenge updated successfully');
    } catch (error) {
        console.error('Error updating user challenge:', error);
        throw error;
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
  }): Promise<Workout | null> {
    if (!userId) throw new Error('No user ID provided');

    try {
      console.log('Incoming logs:', logs.map(log => ({
        name: log.exercise.name,
        category: log.exercise.category,
        originalType: log.exercise.category?.type
      })));

      const currentDate = new Date();
      
      const cleanWorkout = new Workout({
        ...workout,
        roundWorkoutId: `${workout.id}-${currentDate.getTime()}`,
        workoutStatus: WorkoutStatus.QueuedUp,
        createdAt: currentDate,
        updatedAt: currentDate,
        startTime: currentDate,
        logs: []
      });

      const workoutSessionRef = doc(collection(db, 'users', userId, 'workoutSessions'));
      await setDoc(workoutSessionRef, cleanWorkout.toDictionary());

      const logsRef = collection(workoutSessionRef, 'logs');
      const logBatch = writeBatch(db);

      logs.forEach((log, index) => {
        const logDocRef = doc(logsRef, `${log.id}-${currentDate.getTime()}`);
        
        console.log(`Processing log ${index}:`, {
          name: log.exercise.name,
          originalCategory: log.exercise.category,
          originalType: log.exercise.category?.type
        });

        // Preserve the category structure
        const exerciseWithCategory = {
          ...log.exercise.toDictionary(),
          category: log.exercise.category?.type === 'weight-training' 
            ? {
                type: 'weight-training',
                details: {
                  sets: log.exercise.category.details?.sets || 3,
                  reps: log.exercise.category.details?.reps || ['12'],
                  weight: log.exercise.category.details?.weight || 0,
                  screenTime: log.exercise.category.details?.screenTime || 0,
                  selectedVideo: log.exercise.category.details?.selectedVideo || null
                }
              }
            : {
                type: 'cardio',
                details: {
                  duration: log.exercise.category?.details?.duration || 60,
                  bpm: log.exercise.category?.details?.bpm || 140,
                  calories: log.exercise.category?.details?.calories || 0,
                  screenTime: log.exercise.category?.details?.screenTime || 0,
                  selectedVideo: log.exercise.category?.details?.selectedVideo || null
                }
              }
        };

        console.log(`Saving exercise with category:`, exerciseWithCategory.category);

        logBatch.set(logDocRef, {
          id: logDocRef.id,
          workoutId: workoutSessionRef.id,
          exercise: exerciseWithCategory,
          order: index,
          createdAt: currentDate.getTime(),
          updatedAt: currentDate.getTime(),
          logSubmitted: false,
          isCompleted: false
        });
      }); 

      await logBatch.commit();
      
      return cleanWorkout;
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
    challengeId
  }: {
    username: string;
    challengeId: string;
  }): Promise<void> {
    // 1) Make sure we have a signed-in user
    const currentUser = userService.currentUser;
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

    const challenge = challengeSnap.data();

    // 4) Build new user-challenge document
    const userChallengeId = `${challengeId}-${userId}-${Date.now()}`;
    const userChallengeData = {
      id: userChallengeId,
      challenge: challenge,
      challengeId,
      userId,
      fcmToken: userData.fcmToken || '',
      profileImage: userData.profileImage || {},
      progress: 0,
      completedWorkouts: [],
      isCompleted: false,
      uid: userId,
      location: userData.location || null,
      city: '',
      country: '',
      timezone: '',
      username,
      joinDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
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
  }
}

export const workoutService = new WorkoutService();