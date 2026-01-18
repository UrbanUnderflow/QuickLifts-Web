/**
 * Assignment Service
 * 
 * Manages exercise assignments from coaches to athletes,
 * including recurring assignments and scheduling.
 */

import { db } from '../config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import {
  ExerciseAssignment,
  AssignmentStatus,
  AssignmentSource,
  MentalExercise,
  assignmentFromFirestore,
  assignmentToFirestore,
} from './types';
import { exerciseLibraryService } from './exerciseLibraryService';

const COLLECTION = 'mental-exercise-assignments';

// ============================================================================
// SERVICE
// ============================================================================

export const assignmentService = {
  /**
   * Create a new assignment from coach to athlete
   */
  async assignExercise({
    athleteUserId,
    exerciseId,
    coachId,
    coachName,
    reason,
    dueDate,
    scheduledTime,
    isRecurring = false,
    recurringPattern,
    recurringDays,
  }: {
    athleteUserId: string;
    exerciseId: string;
    coachId: string;
    coachName?: string;
    reason?: string;
    dueDate?: number;
    scheduledTime?: 'morning' | 'pre-workout' | 'post-workout' | 'evening';
    isRecurring?: boolean;
    recurringPattern?: 'daily' | 'weekdays' | 'custom';
    recurringDays?: number[];
  }): Promise<string> {
    // Get the exercise details
    const exercise = await exerciseLibraryService.getById(exerciseId);
    if (!exercise) {
      throw new Error(`Exercise not found: ${exerciseId}`);
    }

    const now = Date.now();
    const assignment: Omit<ExerciseAssignment, 'id'> = {
      athleteUserId,
      exerciseId,
      exercise,
      source: AssignmentSource.Coach,
      assignedBy: coachId,
      assignedByName: coachName,
      reason,
      dueDate,
      scheduledTime,
      isRecurring,
      recurringPattern,
      recurringDays,
      status: AssignmentStatus.Pending,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTION), assignmentToFirestore(assignment as ExerciseAssignment));
    return docRef.id;
  },

  /**
   * Assign exercise from Nora (AI-based recommendation)
   */
  async assignFromNora({
    athleteUserId,
    exerciseId,
    reason,
    scheduledTime,
  }: {
    athleteUserId: string;
    exerciseId: string;
    reason: string;
    scheduledTime?: 'morning' | 'pre-workout' | 'post-workout' | 'evening';
  }): Promise<string> {
    const exercise = await exerciseLibraryService.getById(exerciseId);
    if (!exercise) {
      throw new Error(`Exercise not found: ${exerciseId}`);
    }

    const now = Date.now();
    const assignment: Omit<ExerciseAssignment, 'id'> = {
      athleteUserId,
      exerciseId,
      exercise,
      source: AssignmentSource.Nora,
      assignedBy: 'nora',
      assignedByName: 'Nora',
      reason,
      scheduledTime,
      isRecurring: false,
      status: AssignmentStatus.Pending,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTION), assignmentToFirestore(assignment as ExerciseAssignment));
    return docRef.id;
  },

  /**
   * Self-assign an exercise (athlete chooses their own)
   */
  async selfAssign({
    athleteUserId,
    exerciseId,
  }: {
    athleteUserId: string;
    exerciseId: string;
  }): Promise<string> {
    const exercise = await exerciseLibraryService.getById(exerciseId);
    if (!exercise) {
      throw new Error(`Exercise not found: ${exerciseId}`);
    }

    const now = Date.now();
    const assignment: Omit<ExerciseAssignment, 'id'> = {
      athleteUserId,
      exerciseId,
      exercise,
      source: AssignmentSource.SelfSelected,
      assignedBy: athleteUserId,
      isRecurring: false,
      status: AssignmentStatus.InProgress,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, COLLECTION), assignmentToFirestore(assignment as ExerciseAssignment));
    return docRef.id;
  },

  /**
   * Get all assignments for an athlete
   */
  async getForAthlete(athleteUserId: string): Promise<ExerciseAssignment[]> {
    const q = query(
      collection(db, COLLECTION),
      where('athleteUserId', '==', athleteUserId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => assignmentFromFirestore(d.id, d.data()));
  },

  /**
   * Get pending assignments for an athlete
   */
  async getPendingForAthlete(athleteUserId: string): Promise<ExerciseAssignment[]> {
    const q = query(
      collection(db, COLLECTION),
      where('athleteUserId', '==', athleteUserId),
      where('status', 'in', [AssignmentStatus.Pending, AssignmentStatus.InProgress])
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => assignmentFromFirestore(d.id, d.data()));
  },

  /**
   * Get assignments created by a coach
   */
  async getByCoach(coachId: string): Promise<ExerciseAssignment[]> {
    const q = query(
      collection(db, COLLECTION),
      where('assignedBy', '==', coachId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => assignmentFromFirestore(d.id, d.data()));
  },

  /**
   * Get assignments for a specific athlete from a specific coach
   */
  async getForAthleteByCoach(athleteUserId: string, coachId: string): Promise<ExerciseAssignment[]> {
    const q = query(
      collection(db, COLLECTION),
      where('athleteUserId', '==', athleteUserId),
      where('assignedBy', '==', coachId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => assignmentFromFirestore(d.id, d.data()));
  },

  /**
   * Get a single assignment by ID
   */
  async getById(id: string): Promise<ExerciseAssignment | null> {
    const docRef = doc(db, COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return assignmentFromFirestore(snap.id, snap.data());
  },

  /**
   * Mark assignment as started
   */
  async markStarted(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      status: AssignmentStatus.InProgress,
      updatedAt: Date.now(),
    });
  },

  /**
   * Mark assignment as completed
   */
  async markCompleted(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      status: AssignmentStatus.Completed,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  /**
   * Mark assignment as skipped
   */
  async markSkipped(id: string, reason?: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      status: AssignmentStatus.Skipped,
      skippedAt: Date.now(),
      skippedReason: reason,
      updatedAt: Date.now(),
    });
  },

  /**
   * Delete an assignment
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  /**
   * Listen to assignments for an athlete (real-time)
   */
  listenForAthlete(
    athleteUserId: string,
    callback: (assignments: ExerciseAssignment[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION),
      where('athleteUserId', '==', athleteUserId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snap) => {
      const assignments = snap.docs.map(d => assignmentFromFirestore(d.id, d.data()));
      callback(assignments);
    });
  },

  /**
   * Listen to pending assignments for an athlete (real-time)
   */
  listenPendingForAthlete(
    athleteUserId: string,
    callback: (assignments: ExerciseAssignment[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION),
      where('athleteUserId', '==', athleteUserId),
      where('status', 'in', [AssignmentStatus.Pending, AssignmentStatus.InProgress])
    );

    return onSnapshot(q, (snap) => {
      const assignments = snap.docs.map(d => assignmentFromFirestore(d.id, d.data()));
      callback(assignments);
    });
  },

  /**
   * Get today's assignments for an athlete
   */
  async getTodaysAssignments(athleteUserId: string): Promise<ExerciseAssignment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    // Get all pending/in-progress assignments
    const pending = await this.getPendingForAthlete(athleteUserId);
    
    // Filter to those due today or without a due date
    return pending.filter(a => {
      if (!a.dueDate) return true; // No due date = always show
      return a.dueDate >= todayStart && a.dueDate < todayEnd;
    });
  },

  /**
   * Bulk assign an exercise to multiple athletes
   */
  async bulkAssign({
    athleteUserIds,
    exerciseId,
    coachId,
    coachName,
    reason,
    dueDate,
    scheduledTime,
  }: {
    athleteUserIds: string[];
    exerciseId: string;
    coachId: string;
    coachName?: string;
    reason?: string;
    dueDate?: number;
    scheduledTime?: 'morning' | 'pre-workout' | 'post-workout' | 'evening';
  }): Promise<string[]> {
    const assignmentIds: string[] = [];

    for (const athleteUserId of athleteUserIds) {
      const id = await this.assignExercise({
        athleteUserId,
        exerciseId,
        coachId,
        coachName,
        reason,
        dueDate,
        scheduledTime,
      });
      assignmentIds.push(id);
    }

    return assignmentIds;
  },

  /**
   * Get assignment stats for an athlete
   */
  async getStatsForAthlete(athleteUserId: string): Promise<{
    totalAssigned: number;
    completed: number;
    skipped: number;
    pending: number;
    completionRate: number;
  }> {
    const assignments = await this.getForAthlete(athleteUserId);
    
    const completed = assignments.filter(a => a.status === AssignmentStatus.Completed).length;
    const skipped = assignments.filter(a => a.status === AssignmentStatus.Skipped).length;
    const pending = assignments.filter(a => 
      a.status === AssignmentStatus.Pending || a.status === AssignmentStatus.InProgress
    ).length;
    
    const totalAssigned = assignments.length;
    const completionRate = totalAssigned > 0 
      ? Math.round((completed / (completed + skipped)) * 100) 
      : 0;

    return {
      totalAssigned,
      completed,
      skipped,
      pending,
      completionRate,
    };
  },
};
