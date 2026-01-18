/**
 * Completion Service
 * 
 * Tracks exercise completions, manages streaks, and calculates progress.
 */

import { db } from '../config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  ExerciseCompletion,
  MentalTrainingStreak,
  MentalCheckIn,
  CheckInType,
  ExerciseCategory,
  Achievement,
  completionFromFirestore,
  completionToFirestore,
  streakFromFirestore,
  streakToFirestore,
  checkInFromFirestore,
  checkInToFirestore,
} from './types';
import { assignmentService } from './assignmentService';

const COMPLETIONS_ROOT = 'mental-exercise-completions';
const STREAKS_COLLECTION = 'mental-training-streaks';
const CHECKINS_ROOT = 'mental-check-ins';

// ============================================================================
// COMPLETION SERVICE
// ============================================================================

export const completionService = {
  /**
   * Record an exercise completion
   */
  async recordCompletion({
    userId,
    exerciseId,
    exerciseName,
    exerciseCategory,
    assignmentId,
    durationSeconds,
    preExerciseMood,
    postExerciseMood,
    difficultyRating,
    helpfulnessRating,
    notes,
    context,
  }: {
    userId: string;
    exerciseId: string;
    exerciseName: string;
    exerciseCategory: ExerciseCategory;
    assignmentId?: string;
    durationSeconds: number;
    preExerciseMood?: number;
    postExerciseMood?: number;
    difficultyRating?: number;
    helpfulnessRating?: number;
    notes?: string;
    context?: 'morning' | 'pre-workout' | 'post-workout' | 'evening' | 'competition';
  }): Promise<string> {
    const now = Date.now();
    
    const completion: Omit<ExerciseCompletion, 'id'> = {
      userId,
      exerciseId,
      exerciseName,
      exerciseCategory,
      assignmentId,
      completedAt: now,
      durationSeconds,
      preExerciseMood,
      postExerciseMood,
      difficultyRating,
      helpfulnessRating,
      notes,
      context,
      createdAt: now,
    };

    // Save the completion
    const completionsRef = collection(db, COMPLETIONS_ROOT, userId, 'completions');
    const docRef = await addDoc(completionsRef, completionToFirestore(completion as ExerciseCompletion));

    // Mark assignment as completed if applicable
    if (assignmentId) {
      await assignmentService.markCompleted(assignmentId);
    }

    // Update streak
    await this.updateStreak(userId, exerciseCategory, durationSeconds);

    // Check for achievements
    await this.checkAndAwardAchievements(userId);

    return docRef.id;
  },

  /**
   * Get all completions for a user
   */
  async getCompletions(userId: string, limitCount?: number): Promise<ExerciseCompletion[]> {
    let q = query(
      collection(db, COMPLETIONS_ROOT, userId, 'completions'),
      orderBy('completedAt', 'desc')
    );
    
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    const snap = await getDocs(q);
    return snap.docs.map(d => completionFromFirestore(d.id, d.data()));
  },

  /**
   * Get completions for a specific date range
   */
  async getCompletionsInRange(
    userId: string,
    startDate: number,
    endDate: number
  ): Promise<ExerciseCompletion[]> {
    const q = query(
      collection(db, COMPLETIONS_ROOT, userId, 'completions'),
      where('completedAt', '>=', startDate),
      where('completedAt', '<=', endDate),
      orderBy('completedAt', 'desc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => completionFromFirestore(d.id, d.data()));
  },

  /**
   * Get completions by category
   */
  async getCompletionsByCategory(
    userId: string,
    category: ExerciseCategory
  ): Promise<ExerciseCompletion[]> {
    const q = query(
      collection(db, COMPLETIONS_ROOT, userId, 'completions'),
      where('exerciseCategory', '==', category),
      orderBy('completedAt', 'desc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => completionFromFirestore(d.id, d.data()));
  },

  /**
   * Get today's completions
   */
  async getTodaysCompletions(userId: string): Promise<ExerciseCompletion[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    return this.getCompletionsInRange(userId, todayStart, todayEnd);
  },

  /**
   * Listen to completions in real-time
   */
  listenToCompletions(
    userId: string,
    callback: (completions: ExerciseCompletion[]) => void,
    limitCount = 20
  ): Unsubscribe {
    const q = query(
      collection(db, COMPLETIONS_ROOT, userId, 'completions'),
      orderBy('completedAt', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(q, (snap) => {
      const completions = snap.docs.map(d => completionFromFirestore(d.id, d.data()));
      callback(completions);
    });
  },

  // =========================================================================
  // STREAK MANAGEMENT
  // =========================================================================

  /**
   * Get user's streak data
   */
  async getStreak(userId: string): Promise<MentalTrainingStreak> {
    const docRef = doc(db, STREAKS_COLLECTION, userId);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) {
      // Return default streak data
      return {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: '',
        totalExercisesCompleted: 0,
        totalMinutesTrained: 0,
        categoryCompletions: {},
        achievements: [],
        weeklyCompletions: 0,
        weeklyMinutes: 0,
        updatedAt: Date.now(),
      };
    }
    
    return streakFromFirestore(userId, snap.data());
  },

  /**
   * Update streak after exercise completion
   */
  async updateStreak(
    userId: string,
    category: ExerciseCategory,
    durationSeconds: number
  ): Promise<MentalTrainingStreak> {
    const streak = await this.getStreak(userId);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const durationMinutes = Math.round(durationSeconds / 60);

    // Check if this is a new day
    const isNewDay = streak.lastActivityDate !== today;
    const wasYesterday = this.isYesterday(streak.lastActivityDate, today);

    // Update streak
    if (isNewDay) {
      if (wasYesterday) {
        // Continue streak
        streak.currentStreak += 1;
      } else if (streak.lastActivityDate === '') {
        // First activity ever
        streak.currentStreak = 1;
      } else {
        // Streak broken, start new
        streak.currentStreak = 1;
      }
    }
    // If same day, don't increment streak

    // Update longest streak
    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);

    // Update totals
    streak.lastActivityDate = today;
    streak.totalExercisesCompleted += 1;
    streak.totalMinutesTrained += durationMinutes;

    // Update category completions
    streak.categoryCompletions[category] = (streak.categoryCompletions[category] || 0) + 1;

    // Update weekly stats
    streak.weeklyCompletions += 1;
    streak.weeklyMinutes += durationMinutes;

    streak.updatedAt = Date.now();

    // Save updated streak
    const docRef = doc(db, STREAKS_COLLECTION, userId);
    await setDoc(docRef, streakToFirestore(streak));

    return streak;
  },

  /**
   * Check if a date is yesterday relative to another date
   */
  isYesterday(dateStr: string, todayStr: string): boolean {
    if (!dateStr) return false;
    
    const date = new Date(dateStr);
    const today = new Date(todayStr);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    return date.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0];
  },

  /**
   * Listen to streak updates in real-time
   */
  listenToStreak(
    userId: string,
    callback: (streak: MentalTrainingStreak) => void
  ): Unsubscribe {
    const docRef = doc(db, STREAKS_COLLECTION, userId);
    
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        callback(streakFromFirestore(userId, snap.data()));
      } else {
        callback({
          userId,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: '',
          totalExercisesCompleted: 0,
          totalMinutesTrained: 0,
          categoryCompletions: {},
          achievements: [],
          weeklyCompletions: 0,
          weeklyMinutes: 0,
          updatedAt: Date.now(),
        });
      }
    });
  },

  /**
   * Reset weekly stats (should be called by a scheduled function)
   */
  async resetWeeklyStats(userId: string): Promise<void> {
    const docRef = doc(db, STREAKS_COLLECTION, userId);
    await updateDoc(docRef, {
      weeklyCompletions: 0,
      weeklyMinutes: 0,
      updatedAt: Date.now(),
    });
  },

  // =========================================================================
  // ACHIEVEMENTS
  // =========================================================================

  /**
   * Check and award achievements
   */
  async checkAndAwardAchievements(userId: string): Promise<Achievement[]> {
    const streak = await this.getStreak(userId);
    const newAchievements: Achievement[] = [];
    const existingIds = new Set(streak.achievements.map(a => a.id));

    // Check each achievement condition
    for (const [id, check] of Object.entries(ACHIEVEMENT_CHECKS)) {
      if (!existingIds.has(id) && check.condition(streak)) {
        const achievement: Achievement = {
          id,
          name: check.name,
          description: check.description,
          iconName: check.iconName,
          unlockedAt: Date.now(),
          category: check.category,
        };
        newAchievements.push(achievement);
        streak.achievements.push(achievement);
      }
    }

    // Save if new achievements were earned
    if (newAchievements.length > 0) {
      const docRef = doc(db, STREAKS_COLLECTION, userId);
      await updateDoc(docRef, {
        achievements: streak.achievements,
        updatedAt: Date.now(),
      });
    }

    return newAchievements;
  },

  // =========================================================================
  // CHECK-INS
  // =========================================================================

  /**
   * Record a mental check-in
   */
  async recordCheckIn({
    userId,
    type,
    readinessScore,
    moodWord,
    energyLevel,
    stressLevel,
    sleepQuality,
    notes,
  }: {
    userId: string;
    type: CheckInType;
    readinessScore: number;
    moodWord?: string;
    energyLevel?: number;
    stressLevel?: number;
    sleepQuality?: number;
    notes?: string;
  }): Promise<string> {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    const checkIn: Omit<MentalCheckIn, 'id'> = {
      userId,
      type,
      readinessScore,
      moodWord,
      energyLevel,
      stressLevel,
      sleepQuality,
      notes,
      createdAt: now,
      date: today,
    };

    const checkInsRef = collection(db, CHECKINS_ROOT, userId, 'check-ins');
    const docRef = await addDoc(checkInsRef, checkInToFirestore(checkIn as MentalCheckIn));

    return docRef.id;
  },

  /**
   * Get check-ins for a user
   */
  async getCheckIns(userId: string, limitCount?: number): Promise<MentalCheckIn[]> {
    let q = query(
      collection(db, CHECKINS_ROOT, userId, 'check-ins'),
      orderBy('createdAt', 'desc')
    );
    
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    const snap = await getDocs(q);
    return snap.docs.map(d => checkInFromFirestore(d.id, d.data()));
  },

  /**
   * Get today's check-ins
   */
  async getTodaysCheckIns(userId: string): Promise<MentalCheckIn[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const q = query(
      collection(db, CHECKINS_ROOT, userId, 'check-ins'),
      where('date', '==', today)
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => checkInFromFirestore(d.id, d.data()));
  },

  /**
   * Get average readiness score for a date range
   */
  async getAverageReadiness(
    userId: string,
    days: number = 7
  ): Promise<{ average: number; trend: 'up' | 'down' | 'stable' }> {
    const checkIns = await this.getCheckIns(userId, days * 2);
    
    if (checkIns.length === 0) {
      return { average: 0, trend: 'stable' };
    }

    // Calculate current period average
    const recentCheckIns = checkIns.slice(0, Math.min(days, checkIns.length));
    const recentSum = recentCheckIns.reduce((sum, c) => sum + c.readinessScore, 0);
    const average = recentSum / recentCheckIns.length;

    // Calculate previous period average for trend
    const previousCheckIns = checkIns.slice(days, days * 2);
    if (previousCheckIns.length === 0) {
      return { average: Math.round(average * 10) / 10, trend: 'stable' };
    }

    const previousSum = previousCheckIns.reduce((sum, c) => sum + c.readinessScore, 0);
    const previousAverage = previousSum / previousCheckIns.length;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    const diff = average - previousAverage;
    if (diff > 0.3) trend = 'up';
    else if (diff < -0.3) trend = 'down';

    return { average: Math.round(average * 10) / 10, trend };
  },

  /**
   * Listen to today's check-ins in real-time
   */
  listenToTodaysCheckIns(
    userId: string,
    callback: (checkIns: MentalCheckIn[]) => void
  ): Unsubscribe {
    const today = new Date().toISOString().split('T')[0];
    
    const q = query(
      collection(db, CHECKINS_ROOT, userId, 'check-ins'),
      where('date', '==', today)
    );

    return onSnapshot(q, (snap) => {
      const checkIns = snap.docs.map(d => checkInFromFirestore(d.id, d.data()));
      callback(checkIns);
    });
  },

  // =========================================================================
  // PROGRESS SUMMARY
  // =========================================================================

  /**
   * Get a complete progress summary for a user
   */
  async getProgressSummary(userId: string): Promise<{
    streak: MentalTrainingStreak;
    todaysCompletions: ExerciseCompletion[];
    todaysCheckIns: MentalCheckIn[];
    recentCompletions: ExerciseCompletion[];
    averageReadiness: { average: number; trend: 'up' | 'down' | 'stable' };
  }> {
    const [streak, todaysCompletions, todaysCheckIns, recentCompletions, averageReadiness] = 
      await Promise.all([
        this.getStreak(userId),
        this.getTodaysCompletions(userId),
        this.getTodaysCheckIns(userId),
        this.getCompletions(userId, 10),
        this.getAverageReadiness(userId, 7),
      ]);

    return {
      streak,
      todaysCompletions,
      todaysCheckIns,
      recentCompletions,
      averageReadiness,
    };
  },
};

// ============================================================================
// ACHIEVEMENT DEFINITIONS
// ============================================================================

interface AchievementCheck {
  name: string;
  description: string;
  iconName: string;
  category?: ExerciseCategory;
  condition: (streak: MentalTrainingStreak) => boolean;
}

const ACHIEVEMENT_CHECKS: Record<string, AchievementCheck> = {
  // Streak achievements
  'streak-7': {
    name: 'Week Warrior',
    description: '7-day mental training streak',
    iconName: 'flame',
    condition: (s) => s.currentStreak >= 7,
  },
  'streak-21': {
    name: 'Habit Former',
    description: '21-day mental training streak',
    iconName: 'flame',
    condition: (s) => s.currentStreak >= 21,
  },
  'streak-60': {
    name: 'Mental Athlete',
    description: '60-day mental training streak',
    iconName: 'flame',
    condition: (s) => s.currentStreak >= 60,
  },
  'streak-90': {
    name: 'Mental Master',
    description: '90-day mental training streak',
    iconName: 'crown',
    condition: (s) => s.currentStreak >= 90,
  },

  // Completion achievements
  'completions-10': {
    name: 'Getting Started',
    description: 'Completed 10 mental exercises',
    iconName: 'check-circle',
    condition: (s) => s.totalExercisesCompleted >= 10,
  },
  'completions-50': {
    name: 'Building Momentum',
    description: 'Completed 50 mental exercises',
    iconName: 'trending-up',
    condition: (s) => s.totalExercisesCompleted >= 50,
  },
  'completions-100': {
    name: 'Century Club',
    description: 'Completed 100 mental exercises',
    iconName: 'award',
    condition: (s) => s.totalExercisesCompleted >= 100,
  },

  // Category achievements
  'breathing-30': {
    name: 'Breath Master',
    description: 'Completed 30 breathing exercises',
    iconName: 'wind',
    category: ExerciseCategory.Breathing,
    condition: (s) => (s.categoryCompletions[ExerciseCategory.Breathing] || 0) >= 30,
  },
  'visualization-20': {
    name: 'Visualization Pro',
    description: 'Completed 20 visualization exercises',
    iconName: 'eye',
    category: ExerciseCategory.Visualization,
    condition: (s) => (s.categoryCompletions[ExerciseCategory.Visualization] || 0) >= 20,
  },
  'focus-20': {
    name: 'Focus Ninja',
    description: 'Completed 20 focus exercises',
    iconName: 'crosshair',
    category: ExerciseCategory.Focus,
    condition: (s) => (s.categoryCompletions[ExerciseCategory.Focus] || 0) >= 20,
  },
  'mindset-15': {
    name: 'Mindset Shifter',
    description: 'Completed 15 mindset exercises',
    iconName: 'refresh-cw',
    category: ExerciseCategory.Mindset,
    condition: (s) => (s.categoryCompletions[ExerciseCategory.Mindset] || 0) >= 15,
  },
  'confidence-15': {
    name: 'Confidence Builder',
    description: 'Completed 15 confidence exercises',
    iconName: 'star',
    category: ExerciseCategory.Confidence,
    condition: (s) => (s.categoryCompletions[ExerciseCategory.Confidence] || 0) >= 15,
  },

  // Time achievements
  'time-60': {
    name: 'Hour of Power',
    description: 'Trained for 60+ minutes total',
    iconName: 'clock',
    condition: (s) => s.totalMinutesTrained >= 60,
  },
  'time-300': {
    name: 'Five Hour Commitment',
    description: 'Trained for 5+ hours total',
    iconName: 'clock',
    condition: (s) => s.totalMinutesTrained >= 300,
  },
  'time-600': {
    name: 'Ten Hour Dedication',
    description: 'Trained for 10+ hours total',
    iconName: 'award',
    condition: (s) => s.totalMinutesTrained >= 600,
  },
};
