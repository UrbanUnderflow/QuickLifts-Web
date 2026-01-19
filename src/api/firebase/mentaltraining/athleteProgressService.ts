/**
 * Athlete Progress Service
 * 
 * Manages athlete mental training progress, MPR scores, and pathway tracking.
 */

import { db } from '../config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import {
  AthleteMentalProgress,
  BaselineAssessment,
  MentalPathway,
  BiggestChallenge,
  athleteProgressFromFirestore,
  athleteProgressToFirestore,
} from './types';

const COLLECTION = 'athlete-mental-progress';

// ============================================================================
// MPR CALCULATION
// ============================================================================

/**
 * Calculate initial MPR score from baseline assessment
 * Score ranges 1-10 based on assessment responses
 */
function calculateInitialMPR(assessment: BaselineAssessment): number {
  let score = 0;
  let maxScore = 0;

  // Section 1: Experience (max 2 points)
  maxScore += 2;
  switch (assessment.mentalTrainingExperience) {
    case 'consistent_6_months': score += 2; break;
    case 'worked_with_professional': score += 1.5; break;
    case 'self_tried': score += 0.5; break;
    default: score += 0;
  }

  // Section 1: Frequency (max 2 points)
  maxScore += 2;
  switch (assessment.currentPracticeFrequency) {
    case 'daily': score += 2; break;
    case 'weekly': score += 1.5; break;
    case 'occasionally_when_stressed': score += 0.5; break;
    default: score += 0;
  }

  // Section 2: Domain ratings (max 2.5 points - average of 5 domains on 1-5 scale)
  maxScore += 2.5;
  const domainAvg = (
    assessment.arousalControlRating +
    assessment.focusRating +
    assessment.confidenceRating +
    assessment.visualizationRating +
    assessment.resilienceRating
  ) / 5;
  score += (domainAvg / 5) * 2.5;

  // Section 3: Pressure response (max 2 points)
  maxScore += 2;
  switch (assessment.pressureResponse) {
    case 'rise_to_occasion': score += 2; break;
    case 'same_as_training': score += 1.5; break;
    case 'anxious_push_through': score += 0.75; break;
    default: score += 0;
  }

  // Section 3: Setback recovery (max 1.5 points)
  maxScore += 1.5;
  switch (assessment.setbackRecovery) {
    case 'let_go_immediately': score += 1.5; break;
    case 'move_on_after_time': score += 1; break;
    case 'struggle_same_day': score += 0.5; break;
    default: score += 0;
  }

  // Normalize to 1-10 scale
  const normalizedScore = (score / maxScore) * 9 + 1;
  return Math.round(normalizedScore * 10) / 10; // Round to 1 decimal
}

/**
 * Determine recommended pathway based on assessment
 */
function determinePathway(assessment: BaselineAssessment): MentalPathway {
  switch (assessment.biggestChallenge) {
    case BiggestChallenge.PreCompetitionAnxiety:
      return MentalPathway.ArousalMastery;
    case BiggestChallenge.FocusDuringCompetition:
      return MentalPathway.FocusMastery;
    case BiggestChallenge.ConfidenceInAbilities:
    case BiggestChallenge.BouncingBackFromSetbacks:
      return MentalPathway.ConfidenceResilience;
    case BiggestChallenge.PerformingUnderPressure:
      return MentalPathway.PressurePerformance;
    default:
      // Default to arousal mastery as most universally applicable
      return MentalPathway.ArousalMastery;
  }
}

// ============================================================================
// SERVICE
// ============================================================================

export const athleteProgressService = {
  /**
   * Get athlete's mental progress
   */
  async get(athleteId: string): Promise<AthleteMentalProgress | null> {
    const docRef = doc(db, COLLECTION, athleteId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return athleteProgressFromFirestore(athleteId, snap.data());
  },

  /**
   * Create or initialize athlete progress
   */
  async initialize(athleteId: string, coachId?: string): Promise<AthleteMentalProgress> {
    const existing = await this.get(athleteId);
    if (existing) return existing;

    const now = Date.now();
    const progress: AthleteMentalProgress = {
      athleteId,
      coachId,
      mprScore: 1,
      mprLastCalculated: now,
      currentPathway: MentalPathway.Foundation,
      pathwayStep: 0,
      completedPathways: [],
      foundationComplete: false,
      foundationBoxBreathingComplete: false,
      foundationCheckInsComplete: false,
      assessmentNeeded: true,
      totalExercisesMastered: 0,
      totalAssignmentsCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, COLLECTION, athleteId), athleteProgressToFirestore(progress));
    return progress;
  },

  /**
   * Save baseline assessment and calculate initial MPR
   */
  async saveBaselineAssessment(
    athleteId: string,
    assessment: Omit<BaselineAssessment, 'completedAt'>
  ): Promise<AthleteMentalProgress> {
    const now = Date.now();
    const fullAssessment: BaselineAssessment = {
      ...assessment,
      completedAt: now,
    };

    const mprScore = calculateInitialMPR(fullAssessment);
    const recommendedPathway = determinePathway(fullAssessment);

    // Get or create progress
    let progress = await this.get(athleteId);
    if (!progress) {
      progress = await this.initialize(athleteId);
    }

    const updatedProgress: AthleteMentalProgress = {
      ...progress,
      baselineAssessment: fullAssessment,
      assessmentNeeded: false,
      mprScore,
      mprLastCalculated: now,
      currentPathway: MentalPathway.Foundation, // Always start with foundation
      pathwayStep: 0,
      updatedAt: now,
    };

    await setDoc(doc(db, COLLECTION, athleteId), athleteProgressToFirestore(updatedProgress));
    return updatedProgress;
  },

  /**
   * Mark foundation exercise as complete
   */
  async markFoundationExerciseComplete(
    athleteId: string,
    exerciseType: 'box_breathing' | 'daily_checkins'
  ): Promise<AthleteMentalProgress> {
    const progress = await this.get(athleteId);
    if (!progress) {
      throw new Error(`Progress not found for athlete: ${athleteId}`);
    }

    const updates: Partial<AthleteMentalProgress> = {
      updatedAt: Date.now(),
    };

    if (exerciseType === 'box_breathing') {
      updates.foundationBoxBreathingComplete = true;
    } else {
      updates.foundationCheckInsComplete = true;
    }

    // Check if foundation is now complete
    const boxComplete = exerciseType === 'box_breathing' || progress.foundationBoxBreathingComplete;
    const checkInsComplete = exerciseType === 'daily_checkins' || progress.foundationCheckInsComplete;

    if (boxComplete && checkInsComplete) {
      updates.foundationComplete = true;
      // Move to recommended pathway from assessment
      if (progress.baselineAssessment) {
        updates.currentPathway = determinePathway(progress.baselineAssessment);
        updates.pathwayStep = 1;
      }
    }

    await updateDoc(doc(db, COLLECTION, athleteId), updates);
    return { ...progress, ...updates };
  },

  /**
   * Update progress after completing an assignment
   */
  async onAssignmentComplete(
    athleteId: string,
    masteryAchieved: boolean
  ): Promise<AthleteMentalProgress> {
    const progress = await this.get(athleteId);
    if (!progress) {
      throw new Error(`Progress not found for athlete: ${athleteId}`);
    }

    const updates: Partial<AthleteMentalProgress> = {
      totalAssignmentsCompleted: progress.totalAssignmentsCompleted + 1,
      activeAssignmentId: undefined,
      activeAssignmentExerciseName: undefined,
      updatedAt: Date.now(),
    };

    if (masteryAchieved) {
      updates.totalExercisesMastered = progress.totalExercisesMastered + 1;
      updates.pathwayStep = progress.pathwayStep + 1;
    }

    await updateDoc(doc(db, COLLECTION, athleteId), updates);
    return { ...progress, ...updates };
  },

  /**
   * Set active assignment
   */
  async setActiveAssignment(
    athleteId: string,
    assignmentId: string,
    exerciseName: string
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTION, athleteId), {
      activeAssignmentId: assignmentId,
      activeAssignmentExerciseName: exerciseName,
      updatedAt: Date.now(),
    });
  },

  /**
   * Update MPR score
   * Should be called periodically (e.g., weekly) based on:
   * - Completion rates
   * - Self-reported performance
   * - Conversation analysis
   */
  async updateMPR(
    athleteId: string,
    newScore: number
  ): Promise<AthleteMentalProgress> {
    const progress = await this.get(athleteId);
    if (!progress) {
      throw new Error(`Progress not found for athlete: ${athleteId}`);
    }

    const clampedScore = Math.max(1, Math.min(10, newScore));

    await updateDoc(doc(db, COLLECTION, athleteId), {
      mprScore: clampedScore,
      mprLastCalculated: Date.now(),
      updatedAt: Date.now(),
    });

    return { ...progress, mprScore: clampedScore };
  },

  /**
   * Update streak
   */
  async updateStreak(athleteId: string, currentStreak: number): Promise<void> {
    const progress = await this.get(athleteId);
    if (!progress) return;

    const updates: Partial<AthleteMentalProgress> = {
      currentStreak,
      updatedAt: Date.now(),
    };

    if (currentStreak > progress.longestStreak) {
      updates.longestStreak = currentStreak;
    }

    await updateDoc(doc(db, COLLECTION, athleteId), updates);
  },

  /**
   * Mark pathway as complete
   */
  async completePathway(
    athleteId: string,
    pathway: MentalPathway
  ): Promise<AthleteMentalProgress> {
    const progress = await this.get(athleteId);
    if (!progress) {
      throw new Error(`Progress not found for athlete: ${athleteId}`);
    }

    const completedPathways = [...progress.completedPathways];
    if (!completedPathways.includes(pathway)) {
      completedPathways.push(pathway);
    }

    // Determine next pathway or elite refinement
    let nextPathway = MentalPathway.EliteRefinement;
    const allPathways = [
      MentalPathway.ArousalMastery,
      MentalPathway.FocusMastery,
      MentalPathway.ConfidenceResilience,
      MentalPathway.PressurePerformance,
    ];

    for (const p of allPathways) {
      if (!completedPathways.includes(p)) {
        nextPathway = p;
        break;
      }
    }

    const updates: Partial<AthleteMentalProgress> = {
      completedPathways,
      currentPathway: nextPathway,
      pathwayStep: 1,
      updatedAt: Date.now(),
    };

    await updateDoc(doc(db, COLLECTION, athleteId), updates);
    return { ...progress, ...updates };
  },

  /**
   * Get all athletes needing assessment for a coach
   */
  async getAthletesNeedingAssessment(coachId: string): Promise<string[]> {
    const q = query(
      collection(db, COLLECTION),
      where('coachId', '==', coachId),
      where('assessmentNeeded', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.id);
  },

  /**
   * Get all progress records for a coach's athletes
   */
  async getAllForCoach(coachId: string): Promise<AthleteMentalProgress[]> {
    const q = query(
      collection(db, COLLECTION),
      where('coachId', '==', coachId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => athleteProgressFromFirestore(d.id, d.data()));
  },

  /**
   * Get pathway display name
   */
  getPathwayDisplayName(pathway: MentalPathway): string {
    switch (pathway) {
      case MentalPathway.Foundation: return 'Universal Foundation';
      case MentalPathway.ArousalMastery: return 'Arousal Mastery';
      case MentalPathway.FocusMastery: return 'Focus Mastery';
      case MentalPathway.ConfidenceResilience: return 'Confidence & Resilience';
      case MentalPathway.PressurePerformance: return 'Pressure Performance';
      case MentalPathway.EliteRefinement: return 'Elite Refinement';
      default: return pathway;
    }
  },

  /**
   * Get MPR level description
   */
  getMPRDescription(mprScore: number): { level: string; description: string } {
    if (mprScore <= 2) {
      return { level: 'Untrained', description: 'No mental skills training' };
    } else if (mprScore <= 4) {
      return { level: 'Aware', description: 'Beginning awareness' };
    } else if (mprScore <= 6) {
      return { level: 'Practicing', description: 'Active development' };
    } else if (mprScore <= 8) {
      return { level: 'Proficient', description: 'Reliable skills' };
    } else {
      return { level: 'Elite', description: 'Automatic & adaptive' };
    }
  },
};
