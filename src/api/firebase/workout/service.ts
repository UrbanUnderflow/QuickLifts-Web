// src/api/firebase/workout/service.ts
import { ExerciseLog } from '../exercise/types';
import { Workout } from '../workout/types';
import { WorkoutStatus } from './types';
import {
  collection,
  query,
  where,
  getDocs,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../config';
import { userService } from '../user';

class WorkoutService {
  private currentWorkout: Workout | null = null;

  async fetchCurrentWorkout(): Promise<Workout | null> {
    const session = await this.fetchCurrentWorkoutSession();
    return session.workout;
  }

  async fetchCurrentWorkoutSession(): Promise<{
    workout: Workout | null;
    logs: ExerciseLog[] | null;
  }> {
    const currentUser = userService.currentUser;
    if (!currentUser?.id) {
      throw new Error('No user is signed in');
    }

    const workoutSessionsRef = collection(db, 'users', currentUser.id, 'workoutSessions');

    // First check for queued workouts
    let q = query(workoutSessionsRef, where('status', '==', WorkoutStatus.QueuedUp));
    let snap = await getDocs(q);

    if (!snap.empty) {
      return this.processWorkoutSessionDocument(snap.docs[0]);
    }

    // Then check for in-progress workouts
    q = query(workoutSessionsRef, where('status', '==', WorkoutStatus.InProgress));
    snap = await getDocs(q);

    if (!snap.empty) {
      return this.processWorkoutSessionDocument(snap.docs[0]);
    }

    return { workout: null, logs: null };
  }

  private async processWorkoutSessionDocument(
    workoutDoc: QueryDocumentSnapshot<DocumentData>
  ): Promise<{ workout: Workout; logs: ExerciseLog[] }> {
    const data = workoutDoc.data();
    const workout: Workout = {
      id: workoutDoc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate()
    } as Workout;

    const logs: ExerciseLog[] = [];
    return { workout, logs };
  }
}

export const workoutService = new WorkoutService();