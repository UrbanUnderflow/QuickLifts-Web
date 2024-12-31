// src/api/firebase/workout/service.ts
import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  DocumentData,
  QueryDocumentSnapshot,
  setDoc
} from 'firebase/firestore';

import { db } from '../config';
import { userService } from '../user';
import { ExerciseLog } from '../exercise/types';
import { Workout } from '../workout/types';
import { WorkoutStatus } from './types';

class WorkoutService {
  private currentWorkout: Workout | null = null;

  /**
   * Fetch the user's current workout (either QueuedUp or InProgress).
   */
  async fetchCurrentWorkout(): Promise<Workout | null> {
    const session = await this.fetchCurrentWorkoutSession();
    return session.workout;
  }

  /**
   * Fetch the workout session from Firestore, returning { workout, logs }.
   * Checks first for a QueuedUp session, then for InProgress.
   */
  async fetchCurrentWorkoutSession(): Promise<{
    workout: Workout | null;
    logs: ExerciseLog[] | null;
  }> {
    const currentUser = userService.currentUser;
    if (!currentUser?.id) {
      throw new Error('No user is signed in');
    }

    // Reference to user's workoutSessions
    const workoutSessionsRef = collection(db, 'users', currentUser.id, 'workoutSessions');

    // 1) Check for QueuedUp
    let q = query(workoutSessionsRef, where('status', '==', WorkoutStatus.QueuedUp));
    let snap = await getDocs(q);

    if (!snap.empty) {
      return this.processWorkoutSessionDocument(snap.docs[0]);
    }

    // 2) Check for InProgress
    q = query(workoutSessionsRef, where('status', '==', WorkoutStatus.InProgress));
    snap = await getDocs(q);

    if (!snap.empty) {
      return this.processWorkoutSessionDocument(snap.docs[0]);
    }

    // None found
    return { workout: null, logs: null };
  }

  /**
   * Helper to build the Workout object + any logs from the snapshot.
   */
  private async processWorkoutSessionDocument(
    workoutDoc: QueryDocumentSnapshot<DocumentData>
  ): Promise<{ workout: Workout; logs: ExerciseLog[] }> {
    const data = workoutDoc.data();
    const workout: Workout = {
      id: workoutDoc.id,
      ...data,
      // Make sure to handle .toDate() if these fields are Firebase Timestamps
      createdAt: data.createdAt?.toDate() ?? new Date(),
      updatedAt: data.updatedAt?.toDate() ?? new Date()
    } as Workout;

    // If you have logs embedded in the same doc or in a subcollection,
    // fetch them here. For now, we return an empty array.
    const logs: ExerciseLog[] = [];

    return { workout, logs };
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