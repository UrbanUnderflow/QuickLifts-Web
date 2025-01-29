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
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';

import { db } from '../config';
import { userService } from '../user';
import { ExerciseLog, ExerciseCategory, Exercise, BodyPart, ExerciseVideo, ExerciseAuthor, ExerciseVideoVisibility } from '../exercise/types';
import {ProfileImage} from '../user/types'
import { Workout, WorkoutSummary, BodyZone, IntroVideo } from '../workout/types';
import { WorkoutStatus, SweatlistCollection } from './types';
import { format } from 'date-fns'; 
import { convertTimestamp, serverTimestamp } from '../../../utils/timestamp'; // Adjust the import path
import { convertFirestoreTimestamp } from '../../../utils/formatDate';
import { Challenge, ChallengeStatus, UserChallenge } from '../../../api/firebase/workout/types';

interface FirestoreError {
  code: string;
  message: string;
  name: string;
  stack?: string;
}

class WorkoutService {
  private _currentWorkout: Workout | null = null;
  private _currentWorkoutLogs: ExerciseLog[] = [];

  // Getter for current workout
  get currentWorkout(): Workout | null {
    return this._currentWorkout;
  }

  // Setter for current workout
  set currentWorkout(workout: Workout | null) {
    this._currentWorkout = workout;
  }

  // Getter for current workout logs
  get currentWorkoutLogs(): ExerciseLog[] {
    return this._currentWorkoutLogs;
  }

  // Setter for current workout logs
  set currentWorkoutLogs(logs: ExerciseLog[]) {
    this._currentWorkoutLogs = logs;
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
      return snapshot.docs.map((doc: DocumentData) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutSummary[];
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
      return snapshot.docs.map((doc: DocumentData) => ({
        id: doc.id,
        ...doc.data(),
      })) as WorkoutSummary[];
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

// Optional helper methods for parsing if needed
private parseWorkoutData(data: DocumentData): Workout {
  return new Workout({
    id: data.id || '',
    roundWorkoutId: data.roundWorkoutId || '',
    collectionId: data.collectionId || [],
    exercises: data.exercises || [],
    challenge: data.challenge 
      ? new Challenge({
          id: data.challenge.id,
          title: data.challenge.title,
          subtitle: data.challenge.subtitle,
          participants: data.challenge.participants || [],
          status: data.challenge.status as ChallengeStatus,
          startDate: data.challenge.startDate instanceof Date 
            ? data.challenge.startDate 
            : (data.challenge.startDate ? new Date(data.challenge.startDate) : new Date()),
          endDate: data.challenge.endDate instanceof Date 
            ? data.challenge.endDate 
            : (data.challenge.endDate ? new Date(data.challenge.endDate) : new Date()),
          createdAt: data.challenge.createdAt instanceof Date 
            ? data.challenge.createdAt 
            : (data.challenge.createdAt ? new Date(data.challenge.createdAt) : new Date()),
          updatedAt: data.challenge.updatedAt instanceof Date 
            ? data.challenge.updatedAt 
            : (data.challenge.updatedAt ? new Date(data.challenge.updatedAt) : new Date()),
            introVideos: (data.challenge.introVideos || []).map((v: any) => 
              new IntroVideo({
                id: v.id,
                userId: v.userId,
                videoUrl: v.videoUrl
              })
            )
        })
      : undefined,
    logs: data.logs || [],
    title: data.title || '',
    description: data.description || '',
    duration: data.duration || 0,
    workoutRating: data.workoutRating,
    useAuthorContent: data.useAuthorContent || false,
    isCompleted: data.isCompleted || false,
    workoutStatus: data.workoutStatus || WorkoutStatus.QueuedUp,
    startTime: data.startTime instanceof Date 
      ? data.startTime 
      : (data.startTime ? new Date(data.startTime) : undefined),
    order: data.order || 0,
    author: data.author || '',
    createdAt: data.createdAt instanceof Date 
      ? data.createdAt 
      : (typeof data.createdAt?.toDate === 'function' 
        ? data.createdAt.toDate() 
        : (data.createdAt ? new Date(data.createdAt) : new Date())),
    updatedAt: data.updatedAt instanceof Date 
      ? data.updatedAt 
      : (typeof data.updatedAt?.toDate === 'function' 
        ? data.updatedAt.toDate() 
        : (data.updatedAt ? new Date(data.updatedAt) : new Date())),
    zone: data.zone || BodyZone.FullBody,
    estimatedDuration: () => data.duration || 0,
    determineWorkoutZone: () => data.zone || BodyZone.FullBody,
    toDictionary: () => ({}) // Placeholder, implement as needed
  } as Workout);
}

private createDefaultExercise(): Exercise {
  return {
    id: '',
    name: '',
    category: {
      type: 'weightTraining',
      details: {
        reps: '',
        sets: 0,
        weight: 0,
        screenTime: 0,
        selectedVideo: this.parseExerciseVideo({}) // Use existing method to create a default video
      }
    },
    primaryBodyParts: [],
    secondaryBodyParts: [],
    tags: [],
    description: '',
    visibility: 'live', // Default to 'limited'
    steps: [],
    videos: [],
    currentVideoPosition: 0,
    reps: '',
    sets: 0,
    weight: 0,
    author: {
      userId: '',
      username: ''
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

private parseExerciseLogData(data: DocumentData): ExerciseLog {
  return {
    id: data.id || '',
    workoutId: data.workoutId || '',
    userId: data.userId || '',
    exercise: data.exercise 
      ? this.parseExercise(data.exercise) 
      : this.createDefaultExercise(),
    logs: (data.log || []).map((logEntry: any) => ({
      reps: parseInt(logEntry.reps || '0'),
      weight: parseFloat(logEntry.weight || '0'),
      leftReps: parseInt(logEntry.leftReps || '0'),
      leftWeight: parseFloat(logEntry.leftWeight || '0'),
      isSplit: logEntry.isSplit || false,
      isBodyWeight: logEntry.isBodyWeight || false,
      isCompleted: logEntry.isCompleted || false,
      duration: parseInt(logEntry.duration || '0'),
      calories: parseInt(logEntry.calories || '0'),
      bpm: parseInt(logEntry.bpm || '0')
    })),
    feedback: data.feedback || '',
    note: data.note || '',
    recommendedWeight: data.recommendedWeight,
    isSplit: data.isSplit || false,
    isBodyWeight: data.isBodyWeight || false,
    logSubmitted: data.logSubmitted || false,
    logIsEditing: data.logIsEditing || false,
    isCompleted: data.isCompleted || false,
    createdAt: data.createdAt instanceof Date 
      ? data.createdAt 
      : (typeof data.createdAt?.toDate === 'function' 
        ? data.createdAt.toDate() 
        : (data.createdAt ? new Date(data.createdAt) : new Date())),
    updatedAt: data.updatedAt instanceof Date 
      ? data.updatedAt 
      : (typeof data.updatedAt?.toDate === 'function' 
        ? data.updatedAt.toDate() 
        : (data.updatedAt ? new Date(data.updatedAt) : new Date()))
  };
}

// You'll also need to implement parseExercise similar to the original implementation
private parseExercise(fields: any): Exercise {
  return {
    id: fields.id?.stringValue || fields.id || '',
    name: fields.name?.stringValue || fields.name || '',
    category: this.parseExerciseCategory(fields.category?.mapValue?.fields || fields.category || {}),
    primaryBodyParts: this.parseBodyParts(fields.primaryBodyParts),
    secondaryBodyParts: this.parseBodyParts(fields.secondaryBodyParts),
    tags: (fields.tags?.arrayValue?.values || fields.tags || []).map((tag: any) => tag.stringValue || tag),
    description: fields.description?.stringValue || fields.description || '',
    visibility: (fields.visibility?.arrayValue?.values || fields.visibility || []).map((v: any) => v.stringValue || v),
    steps: (fields.steps?.arrayValue?.values || fields.steps || []).map((step: any) => step.stringValue || step),
    videos: this.parseVideos(fields.videos),
    currentVideoPosition: parseInt(fields.currentVideoPosition?.integerValue || fields.currentVideoPosition || '0'),
    reps: fields.reps?.stringValue || fields.reps || '',
    sets: parseInt(fields.sets?.integerValue || fields.sets || '0'),
    weight: parseFloat(fields.weight?.doubleValue || fields.weight || '0'),
    
    author: this.parseExerciseAuthor(fields.author?.mapValue?.fields || fields.author || {}),
    createdAt: new Date(parseFloat(fields.createdAt?.doubleValue || fields.createdAt || '0') * 1000),
    updatedAt: new Date(parseFloat(fields.updatedAt?.doubleValue || fields.updatedAt || '0') * 1000)
  };
}

// You'll need to implement these helper methods as well
private parseExerciseCategory(fields: any): ExerciseCategory {
  // Implementation similar to the original service
  const categoryId = fields.id?.stringValue || fields.id || '';
  if (categoryId === 'cardio') {
    return {
      type: 'cardio',
      details: {
        duration: parseInt(fields.duration?.integerValue || fields.duration || '0'),
        bpm: parseInt(fields.bpm?.integerValue || fields.bpm || '0'),
        calories: parseInt(fields.calories?.integerValue || fields.calories || '0'),
        screenTime: parseInt(fields.screenTime?.integerValue || fields.screenTime || '0'),
        selectedVideo: this.parseExerciseVideo(fields.selectedVideo?.mapValue?.fields || fields.selectedVideo)  
      }
    };
  } else {
    return {
      type: 'weightTraining',
      details: {
        reps: fields.reps?.stringValue || fields.reps || '',
        sets: parseInt(fields.sets?.integerValue || fields.sets || '0'),
        weight: parseFloat(fields.weight?.doubleValue || fields.weight || '0'),
        screenTime: parseInt(fields.screenTime?.integerValue || fields.screenTime || '0'),
        selectedVideo: this.parseExerciseVideo(fields.selectedVideo?.mapValue?.fields || fields.selectedVideo)
      }
    };
  }
}

private parseBodyParts(bodyPartsField: any): BodyPart[] {
  const bodyPartsArray = bodyPartsField?.arrayValue?.values || bodyPartsField || [];
  return bodyPartsArray.map((part: any) => part.stringValue || part);
}

private parseVideos(videosField: any): ExerciseVideo[] {
  const videosArray = videosField?.arrayValue?.values || videosField || [];
  return videosArray.map((videoData: any) => 
    this.parseExerciseVideo(videoData.mapValue?.fields || videoData)
  );
}

private parseExerciseVideo(fields: any): ExerciseVideo {
  return {
    id: fields.id?.stringValue || fields.id || '',
    exerciseId: fields.exerciseId?.stringValue || fields.exerciseId || '',
    username: fields.username?.stringValue || fields.username || '',
    userId: fields.userId?.stringValue || fields.userId || '',
    videoURL: fields.videoURL?.stringValue || fields.videoURL || '',
    fileName: fields.fileName?.stringValue || fields.fileName || '',
    exercise: fields.exercise?.stringValue || fields.exercise || '',
    profileImage: this.parseProfileImage(fields.profileImage?.mapValue?.fields || fields.profileImage || {}),
    caption: fields.caption?.stringValue || fields.caption || '',
    gifURL: fields.gifURL?.stringValue || fields.gifURL || '',
    thumbnail: fields.thumbnail?.stringValue || fields.thumbnail || '',
    visibility: fields.visibility?.stringValue || fields.visibility || 'open',
    totalAccountsReached: parseInt(fields.totalAccountsReached?.integerValue || fields.totalAccountsReached || '0'),
    totalAccountLikes: parseInt(fields.totalAccountLikes?.integerValue || fields.totalAccountLikes || '0'),
    totalAccountBookmarked: parseInt(fields.totalAccountBookmarked?.integerValue || fields.totalAccountBookmarked || '0'),
    totalAccountUsage: parseInt(fields.totalAccountUsage?.integerValue || fields.totalAccountUsage || '0'),
    isApproved: fields.isApproved?.booleanValue || fields.isApproved || false,
    liked: fields.liked?.booleanValue || fields.liked,
    bookmarked: fields.bookmarked?.booleanValue || fields.bookmarked,
    createdAt: new Date(parseFloat(fields.createdAt?.doubleValue || fields.createdAt || '0') * 1000),
    updatedAt: new Date(parseFloat(fields.updatedAt?.doubleValue || fields.updatedAt || '0') * 1000)
  };
}

private parseProfileImage(fields: any): ProfileImage {
  return {
    profileImageURL: fields.profileImageURL?.stringValue || fields.profileImageURL || '',
    imageOffsetWidth: parseFloat(fields.imageOffsetWidth?.doubleValue || fields.imageOffsetWidth || '0'),
    imageOffsetHeight: parseFloat(fields.imageOffsetHeight?.doubleValue || fields.imageOffsetHeight || '0')
  };
}

private parseExerciseAuthor(fields: any): ExerciseAuthor {
  return {
    userId: fields.userId?.stringValue || fields.userId || '',
    username: fields.username?.stringValue || fields.username || ''
  };
}

async fetchSavedWorkout(userId: string, workoutId: string): Promise<[Workout | null, ExerciseLog[] | null]> {
  try {
    // Fetch the workout document
    const workoutRef = doc(db, 'users', userId, 'MyCreatedWorkouts', workoutId);
    const workoutSnap = await getDoc(workoutRef);

    if (!workoutSnap.exists()) {
      return [null, null];
    }

    // Get exercises with videos mapped
    const exercisesWithVideos = await this.fetchAndMapExercisesWithVideos();
    const workoutData = workoutSnap.data();

    // Map the exercises in the workout to the full exercise objects with videos
    const mappedExercises = (workoutData.exercises || []).map((exerciseRef: any) => {
      const fullExercise = exercisesWithVideos.find(ex => ex.name === exerciseRef.exercise.name);
      return {
        ...exerciseRef,
        exercise: fullExercise || exerciseRef.exercise
      };
    });

    workoutData.exercises = mappedExercises;
    const workout = this.parseWorkoutData(workoutData);

    // Fetch logs
    const logsRef = collection(workoutRef, 'logs');
    const logsSnapshot = await getDocs(logsRef);

    const logs: ExerciseLog[] = logsSnapshot.docs.map(logDoc => {
      const logData = logDoc.data();
      const fullExercise = exercisesWithVideos.find(ex => ex.name === logData.exercise.name);
      
      return {
        id: logDoc.id,
        workoutId: workoutId,
        userId: userId,
        exercise: fullExercise || logData.exercise,
        logs: logData.log || [],
        feedback: logData.feedback || '',
        note: logData.note || '',
        recommendedWeight: logData.recommendedWeight,
        isSplit: logData.isSplit || false,
        isBodyWeight: logData.isBodyWeight || false,
        logSubmitted: logData.logSubmitted || false,
        logIsEditing: logData.logIsEditing || false,
        isCompleted: logData.isCompleted || false,
        createdAt: convertFirestoreTimestamp(logData.createdAt),
        updatedAt: convertFirestoreTimestamp(logData.updatedAt)
      };
    });

    workout.logs = logs;
    return [workout, logs];
  } catch (error) {
    console.error('Error fetching saved workout:', error);
    return [null, null];
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
      return snapshot.docs.map((doc: DocumentData) => ({
        id: doc.id,
        ...doc.data(),
      })) as UserChallenge[];
    } catch (error) {
      console.error('Error fetching user challenges:', error);
      throw new Error('Failed to fetch user challenges');
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
      // Update logs in Firestore
      const workoutRef = doc(db, 'users', userId, 'workoutSessions', workoutId);
      
      // Update logs subcollection
      const logsRef = collection(workoutRef, 'logs');
      
      // Batch write to update logs
      const batch = writeBatch(db);
      
      logs.forEach(log => {
        const logDocRef = doc(logsRef, log.id);
        batch.update(logDocRef, {
          isCompleted: log.isCompleted,
          logs: log.logs,
          updatedAt: serverTimestamp()
        });
      });
  
      await batch.commit();
    } catch (error) {
      console.error('Error updating workout logs:', error);
      throw error;
    }
  }
  
  
  /**
   * Fetch the workout session from Firestore, returning { workout, logs }.
   * Checks first for a QueuedUp session, then for InProgress.
   */
  async fetchCurrentWorkoutSession(userId: string): Promise<{
    workout: Workout | null;
    logs: ExerciseLog[] | null;
  }> {
    if (!userId) {
      throw new Error('No user ID provided');
    }
  
    // 1. Fetch all exercises with their videos
    const exerciseSnapshot = await getDocs(collection(db, 'exercises'));
    const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
  
    // Map videos to exercises
    const exerciseVideos: ExerciseVideo[] = videoSnapshot.docs.map((doc) => 
      ExerciseVideo.fromFirebase({
        id: doc.id,
        ...doc.data()
      })
    );
  
    const exercisesWithVideos = exerciseSnapshot.docs.map(doc => {
      const exercise = Exercise.fromFirebase({
        id: doc.id,
        ...doc.data()
      });
  
      // Attach videos to exercise
      const matchingVideos = exerciseVideos.filter(
        (video) => video.exercise.toLowerCase() === exercise.name.toLowerCase()
      );
  
      return {
        ...exercise,
        videos: matchingVideos
      };
    });
  
    // Reference to user's workoutSessions
    const workoutSessionsRef = collection(db, 'users', userId, 'workoutSessions');
  
    // 1) Check for QueuedUp
    let q = query(workoutSessionsRef, where('status', '==', WorkoutStatus.QueuedUp));
    let snap = await getDocs(q);
  
    if (!snap.empty) {
      return this.processWorkoutSessionDocument(snap.docs[0], exercisesWithVideos);
    }
  
    // 2) Check for InProgress
    q = query(workoutSessionsRef, where('status', '==', WorkoutStatus.InProgress));
    snap = await getDocs(q);
  
    if (!snap.empty) {
      return this.processWorkoutSessionDocument(snap.docs[0], exercisesWithVideos);
    }
  
    // None found
    return { workout: null, logs: null };
  }

  async cancelWorkoutSession(userId: string, workoutId: string): Promise<void> {
    try {
      // 1. Delete all logs in the logs subcollection
      const logsRef = collection(db, 'users', userId, 'workoutSessions', workoutId, 'logs');
      const logsSnapshot = await getDocs(logsRef);
      const logBatch = writeBatch(db);
  
      if (!logsSnapshot.empty) {
        logsSnapshot.docs.forEach((logDoc) => {
          logBatch.delete(logDoc.ref);
        });
        await logBatch.commit();
      }
  
      // 2. Delete the workout session document
      const workoutSessionRef = doc(db, 'users', userId, 'workoutSessions', workoutId);
      await deleteDoc(workoutSessionRef);
    } catch (error) {
      console.error('Error canceling workout session:', error);
      throw error;
    }
  }

  private async fetchAndMapExercisesWithVideos(): Promise<Exercise[]> {
    try {
      // console.log('Starting fetchAndMapExercisesWithVideos');
  
      // 1. Fetch all exercises 
      const exerciseSnapshot = await getDocs(collection(db, 'exercises'));
      const exercises = exerciseSnapshot.docs.map((doc) => 
        Exercise.fromFirebase({
          id: doc.id,
          ...doc.data()
        })
      );
      // console.log(`Fetched ${exercises.length} exercises`);
  
      // 2. Fetch all videos
      const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
      const exerciseVideos = videoSnapshot.docs.map((doc) => 
        ExerciseVideo.fromFirebase({
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
    
        return {
          ...exercise,
          videos: matchingVideos
        };
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
      // 1. Fetch all exercises 
      const exerciseSnapshot = await getDocs(collection(db, 'exercises'));
      const exercises = exerciseSnapshot.docs.map((doc) => 
        Exercise.fromFirebase({
          id: doc.id,
          ...doc.data()
        })
      );
  
      // 2. Fetch all videos
      const videoSnapshot = await getDocs(collection(db, 'exerciseVideos'));
      const exerciseVideos = videoSnapshot.docs.map((doc) => 
        ExerciseVideo.fromFirebase({
          id: doc.id,
          ...doc.data()
        })
      );
  
      // 3. Map videos to exercises
      const exercisesWithVideos = exercises.map(exercise => {
        const matchingVideos = exerciseVideos.filter(
          (video) => video.exercise.toLowerCase() === exercise.name.toLowerCase()
        );
  
        return {
          ...exercise,
          videos: matchingVideos
        };
      });
  
      // 4. Fetch workout sessions
      const workoutSessionsRef = collection(db, 'users', userId, 'workoutSessions');
      const snap = await getDocs(workoutSessionsRef);
  
      if (snap.empty) {
        console.log('No workout sessions found for user');
        return [];
      }
  
      // 5. Process each workout session
      const sessions = await Promise.all(
        snap.docs.map(async (doc) => {
          const sessionData = await this.processWorkoutSessionDocument(
            doc, 
            exercisesWithVideos
          );
          
          // Sort the logs by the 'order' property, if available
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
  
      // console.log(`Found ${sessions.length} workout sessions`);
      return sessions;
    } catch (error) {
      console.error('Error fetching workout sessions:', error);
      throw error;
    }
  }
  
  private async processWorkoutSessionDocument(
    workoutDoc: QueryDocumentSnapshot<DocumentData>,
    exercisesWithVideos: Exercise[]
  ): Promise<{ workout: Workout; logs: ExerciseLog[] }> {
    const data = workoutDoc.data();
  
    // Map exercises with their full data and videos
    const mappedExercises = (data.exercises || []).map((exerciseRef: any) => {
      // Find the full exercise with videos
      const exerciseNameLower = exerciseRef.exercise?.name?.toLowerCase().trim();
      const fullExercise = exercisesWithVideos.find(
        ex => ex.name.toLowerCase().trim() === exerciseNameLower
      );
  
      // If full exercise found, return it, otherwise use the original
      return {
        ...exerciseRef,
        exercise: fullExercise || exerciseRef.exercise
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
  
    console.log("The Workout ID is: " + workout.id);
    // Fetch logs from subcollection
    const logsRef = collection(workoutDoc.ref, 'logs');
    const logsSnapshot = await getDocs(logsRef);
    
    const logs: ExerciseLog[] = logsSnapshot.docs.map(logDoc => {
      const logData = logDoc.data();
      
      // Find the full exercise with videos
      const exerciseNameLower = logData.exercise?.name?.toLowerCase().trim();
      const fullExercise = exercisesWithVideos.find(
        ex => ex.name.toLowerCase().trim() === exerciseNameLower
      );
  
      // Prepare log data with full exercise
      const preparedLogData = {
        ...logData,
        id: logDoc.id,
        workoutId: workout.id,
        exercise: fullExercise || logData.exercise,
        createdAt: convertFirestoreTimestamp(logData.createdAt),
        updatedAt: convertFirestoreTimestamp(logData.updatedAt)
      };
  
      // Use the ExerciseLog constructor to ensure proper mapping
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
      await setDoc(workoutSessionRef, cleanWorkout);
   
      const logsRef = collection(workoutSessionRef, 'logs');
      const logBatch = writeBatch(db);
   
      logs.forEach((log, index) => {
        const logDocRef = doc(logsRef, `${log.id}-${currentDate.getTime()}`);
        logBatch.set(logDocRef, {
          id: logDocRef.id,
          workoutId: workoutSessionRef.id,
          exercise: {
            id: log.exercise.id,
            name: log.exercise.name,
            category: log.exercise.category,
            videos: log.exercise.videos || []
          },
          order: index,
          createdAt: currentDate,
          updatedAt: currentDate,
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