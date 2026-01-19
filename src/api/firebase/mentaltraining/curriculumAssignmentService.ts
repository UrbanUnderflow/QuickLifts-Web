/**
 * Curriculum Assignment Service
 * 
 * Manages 14-day curriculum-based exercise assignments with daily completion tracking.
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
  addDoc,
} from 'firebase/firestore';
import {
  CurriculumAssignment,
  CurriculumAssignmentStatus,
  DailyCompletion,
  MentalExercise,
  MentalPathway,
  AssignmentSource,
  curriculumAssignmentFromFirestore,
  curriculumAssignmentToFirestore,
  dailyCompletionFromFirestore,
  dailyCompletionToFirestore,
} from './types';
import { exerciseLibraryService } from './exerciseLibraryService';

const COLLECTION = 'mental-curriculum-assignments';
const DAILY_COMPLETIONS_SUBCOLLECTION = 'daily-completions';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDateString(timestamp?: number): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getDayNumber(startDate: number, currentDate?: number): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const current = currentDate ? new Date(currentDate) : new Date();
  current.setHours(0, 0, 0, 0);
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

// ============================================================================
// SERVICE
// ============================================================================

export const curriculumAssignmentService = {
  /**
   * Create a new curriculum assignment
   */
  async create({
    athleteId,
    coachId,
    exerciseId,
    recommendationId,
    durationDays = 14,
    frequency = 1,
    coachNote,
    reminderEnabled = true,
    reminderTimes = ['08:00', '20:00'],
    pathway = MentalPathway.Foundation,
    pathwayStep = 1,
  }: {
    athleteId: string;
    coachId: string;
    exerciseId: string;
    recommendationId?: string;
    durationDays?: number;
    frequency?: number;
    coachNote?: string;
    reminderEnabled?: boolean;
    reminderTimes?: string[];
    pathway?: MentalPathway;
    pathwayStep?: number;
  }): Promise<CurriculumAssignment> {
    // Get the exercise details
    const exercise = await exerciseLibraryService.getById(exerciseId);
    if (!exercise) {
      throw new Error(`Exercise not found: ${exerciseId}`);
    }

    const now = Date.now();
    const startDate = now;
    const endDate = now + durationDays * 24 * 60 * 60 * 1000;

    const assignment: Omit<CurriculumAssignment, 'id'> = {
      athleteId,
      coachId,
      exerciseId,
      exercise,
      recommendationId,
      source: AssignmentSource.Coach,
      durationDays,
      frequency,
      startDate,
      endDate,
      completedDays: 0,
      targetDays: durationDays,
      completionRate: 0,
      currentDayNumber: 1,
      status: CurriculumAssignmentStatus.Active,
      masteryAchieved: false,
      extendedCount: 0,
      coachNote,
      reminderEnabled,
      reminderTimes,
      pathway,
      pathwayStep,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(
      collection(db, COLLECTION),
      curriculumAssignmentToFirestore(assignment as CurriculumAssignment)
    );

    return { ...assignment, id: docRef.id } as CurriculumAssignment;
  },

  /**
   * Get a single assignment by ID
   */
  async getById(id: string): Promise<CurriculumAssignment | null> {
    const docRef = doc(db, COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return curriculumAssignmentFromFirestore(snap.id, snap.data());
  },

  /**
   * Get active assignment for an athlete
   */
  async getActiveForAthlete(athleteId: string): Promise<CurriculumAssignment | null> {
    const q = query(
      collection(db, COLLECTION),
      where('athleteId', '==', athleteId),
      where('status', 'in', [CurriculumAssignmentStatus.Active, CurriculumAssignmentStatus.Extended])
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return curriculumAssignmentFromFirestore(snap.docs[0].id, snap.docs[0].data());
  },

  /**
   * Get all assignments for an athlete
   */
  async getAllForAthlete(athleteId: string): Promise<CurriculumAssignment[]> {
    const q = query(
      collection(db, COLLECTION),
      where('athleteId', '==', athleteId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => curriculumAssignmentFromFirestore(d.id, d.data()));
  },

  /**
   * Get all active assignments for a coach's athletes
   */
  async getActiveForCoach(coachId: string): Promise<CurriculumAssignment[]> {
    const q = query(
      collection(db, COLLECTION),
      where('coachId', '==', coachId),
      where('status', 'in', [CurriculumAssignmentStatus.Active, CurriculumAssignmentStatus.Extended]),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => curriculumAssignmentFromFirestore(d.id, d.data()));
  },

  /**
   * Record a daily completion
   */
  async recordDailyCompletion(
    assignmentId: string,
    durationSeconds: number,
    postMood?: number
  ): Promise<DailyCompletion> {
    const assignment = await this.getById(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    const now = Date.now();
    const dateString = getDateString(now);
    const dailyDocRef = doc(db, COLLECTION, assignmentId, DAILY_COMPLETIONS_SUBCOLLECTION, dateString);

    // Get existing daily completion or create new
    const dailySnap = await getDoc(dailyDocRef);
    let dailyCompletion: DailyCompletion;

    if (dailySnap.exists()) {
      const existing = dailyCompletionFromFirestore(dailySnap.id, dailySnap.data());
      dailyCompletion = {
        ...existing,
        completionCount: existing.completionCount + 1,
        completed: existing.completionCount + 1 >= existing.targetCount,
        completions: [
          ...existing.completions,
          { completedAt: now, durationSeconds, postMood },
        ],
        updatedAt: now,
      };
    } else {
      dailyCompletion = {
        id: dateString,
        date: dateString,
        completed: 1 >= assignment.frequency,
        completionCount: 1,
        targetCount: assignment.frequency,
        completions: [{ completedAt: now, durationSeconds, postMood }],
        createdAt: now,
        updatedAt: now,
      };
    }

    await setDoc(dailyDocRef, dailyCompletionToFirestore(dailyCompletion));

    // Update assignment progress
    await this.updateProgress(assignmentId);

    return dailyCompletion;
  },

  /**
   * Get daily completions for an assignment
   */
  async getDailyCompletions(assignmentId: string): Promise<DailyCompletion[]> {
    const q = query(
      collection(db, COLLECTION, assignmentId, DAILY_COMPLETIONS_SUBCOLLECTION),
      orderBy('date', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => dailyCompletionFromFirestore(d.id, d.data()));
  },

  /**
   * Get today's completion status
   */
  async getTodayCompletion(assignmentId: string): Promise<DailyCompletion | null> {
    const dateString = getDateString();
    const dailyDocRef = doc(db, COLLECTION, assignmentId, DAILY_COMPLETIONS_SUBCOLLECTION, dateString);
    const snap = await getDoc(dailyDocRef);
    if (!snap.exists()) return null;
    return dailyCompletionFromFirestore(snap.id, snap.data());
  },

  /**
   * Update assignment progress based on daily completions
   */
  async updateProgress(assignmentId: string): Promise<CurriculumAssignment> {
    const assignment = await this.getById(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    const dailyCompletions = await this.getDailyCompletions(assignmentId);
    const completedDays = dailyCompletions.filter(dc => dc.completed).length;
    const currentDayNumber = getDayNumber(assignment.startDate);
    // Calculate completion rate based on total target days (not days elapsed)
    // This matches iOS calculation: completedDays / targetDays
    const completionRate = assignment.targetDays > 0 
      ? Math.round((completedDays / assignment.targetDays) * 100)
      : 0;

    const now = Date.now();
    const updateData: Partial<CurriculumAssignment> = {
      completedDays,
      currentDayNumber,
      completionRate,
      updatedAt: now,
    };

    await updateDoc(doc(db, COLLECTION, assignmentId), updateData);

    return { ...assignment, ...updateData };
  },

  /**
   * Check mastery and handle completion/extension
   * Should be called at day 14 (and day 21 if extended)
   */
  async checkMastery(assignmentId: string): Promise<{
    masteryAchieved: boolean;
    extended: boolean;
    completionRate: number;
  }> {
    const assignment = await this.getById(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    // Recalculate progress
    const updated = await this.updateProgress(assignmentId);
    const { completionRate, completedDays, targetDays } = updated;

    const now = Date.now();

    // Mastery: 80% or higher completion
    if (completionRate >= 80) {
      await updateDoc(doc(db, COLLECTION, assignmentId), {
        status: CurriculumAssignmentStatus.Completed,
        masteryAchieved: true,
        updatedAt: now,
      });
      return { masteryAchieved: true, extended: false, completionRate };
    }

    // Below 80%: Extend by 7 days (up to 2 extensions)
    if (updated.extendedCount < 2 && completionRate >= 60) {
      const newEndDate = updated.endDate + 7 * 24 * 60 * 60 * 1000;
      await updateDoc(doc(db, COLLECTION, assignmentId), {
        status: CurriculumAssignmentStatus.Extended,
        endDate: newEndDate,
        targetDays: targetDays + 7,
        extendedCount: updated.extendedCount + 1,
        updatedAt: now,
      });
      return { masteryAchieved: false, extended: true, completionRate };
    }

    // Too low or max extensions: Complete without mastery
    await updateDoc(doc(db, COLLECTION, assignmentId), {
      status: CurriculumAssignmentStatus.Completed,
      masteryAchieved: false,
      updatedAt: now,
    });
    return { masteryAchieved: false, extended: false, completionRate };
  },

  /**
   * Pause an assignment
   */
  async pause(assignmentId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, assignmentId), {
      status: CurriculumAssignmentStatus.Paused,
      updatedAt: Date.now(),
    });
  },

  /**
   * Resume a paused assignment
   */
  async resume(assignmentId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, assignmentId), {
      status: CurriculumAssignmentStatus.Active,
      updatedAt: Date.now(),
    });
  },

  /**
   * Delete an assignment
   */
  async delete(assignmentId: string): Promise<void> {
    // Delete daily completions subcollection first
    const dailyCompletions = await this.getDailyCompletions(assignmentId);
    for (const dc of dailyCompletions) {
      await deleteDoc(doc(db, COLLECTION, assignmentId, DAILY_COMPLETIONS_SUBCOLLECTION, dc.id));
    }
    // Delete the assignment
    await deleteDoc(doc(db, COLLECTION, assignmentId));
  },

  /**
   * Listen to active assignment for an athlete (real-time)
   */
  listenToActiveForAthlete(
    athleteId: string,
    callback: (assignment: CurriculumAssignment | null) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION),
      where('athleteId', '==', athleteId),
      where('status', 'in', [CurriculumAssignmentStatus.Active, CurriculumAssignmentStatus.Extended])
    );

    return onSnapshot(q, (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      const assignment = curriculumAssignmentFromFirestore(snap.docs[0].id, snap.docs[0].data());
      callback(assignment);
    });
  },

  /**
   * Get assignments needing mastery check (past end date)
   */
  async getAssignmentsNeedingMasteryCheck(): Promise<CurriculumAssignment[]> {
    const now = Date.now();
    const q = query(
      collection(db, COLLECTION),
      where('status', 'in', [CurriculumAssignmentStatus.Active, CurriculumAssignmentStatus.Extended]),
      where('endDate', '<=', now)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => curriculumAssignmentFromFirestore(d.id, d.data()));
  },

  /**
   * Get assignment stats for an athlete
   */
  async getStatsForAthlete(athleteId: string): Promise<{
    totalAssignments: number;
    completedWithMastery: number;
    completedWithoutMastery: number;
    active: number;
    averageCompletionRate: number;
  }> {
    const assignments = await this.getAllForAthlete(athleteId);
    
    const completedWithMastery = assignments.filter(
      a => a.status === CurriculumAssignmentStatus.Completed && a.masteryAchieved
    ).length;
    
    const completedWithoutMastery = assignments.filter(
      a => a.status === CurriculumAssignmentStatus.Completed && !a.masteryAchieved
    ).length;
    
    const active = assignments.filter(
      a => a.status === CurriculumAssignmentStatus.Active || a.status === CurriculumAssignmentStatus.Extended
    ).length;
    
    const completedAssignments = assignments.filter(
      a => a.status === CurriculumAssignmentStatus.Completed
    );
    
    const averageCompletionRate = completedAssignments.length > 0
      ? Math.round(completedAssignments.reduce((sum, a) => sum + a.completionRate, 0) / completedAssignments.length)
      : 0;

    return {
      totalAssignments: assignments.length,
      completedWithMastery,
      completedWithoutMastery,
      active,
      averageCompletionRate,
    };
  },
};
