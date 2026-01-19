/**
 * Recommendation Service
 * 
 * Rules-based recommendation engine for mental exercise assignments.
 * Follows the curriculum pathways defined in MENTAL_EXERCISE_CURRICULUM.md
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
  addDoc,
  Unsubscribe,
  onSnapshot,
} from 'firebase/firestore';
import {
  MentalRecommendation,
  MentalPathway,
  RecommendationConfidence,
  RecommendationStatus,
  MentalExercise,
  AthleteMentalProgress,
  PathwayDefinition,
  recommendationFromFirestore,
  recommendationToFirestore,
} from './types';
import { exerciseLibraryService } from './exerciseLibraryService';
import { athleteProgressService } from './athleteProgressService';
import { curriculumAssignmentService } from './curriculumAssignmentService';

const COLLECTION = 'mental-recommendations';

// ============================================================================
// PATHWAY DEFINITIONS (From Curriculum)
// ============================================================================

/**
 * Foundation exercises - everyone starts here
 */
const FOUNDATION_EXERCISES = {
  boxBreathing: 'breathing-box',
  dailyCheckIn: 'mental-checkin', // This might be a special type, not in exercise library
};

/**
 * Pathway exercise sequences
 * Each pathway has a sequence of exercises to complete
 */
const PATHWAY_SEQUENCES: Record<MentalPathway, { exerciseId: string; name: string }[]> = {
  [MentalPathway.Foundation]: [
    { exerciseId: 'breathing-box', name: 'Box Breathing' },
  ],
  [MentalPathway.ArousalMastery]: [
    { exerciseId: 'breathing-physiological-sigh', name: 'Physiological Sigh' },
    { exerciseId: 'breathing-arousal-control', name: 'Arousal Control Breathing' },
    { exerciseId: 'breathing-recovery', name: 'Recovery Breathing' },
  ],
  [MentalPathway.FocusMastery]: [
    { exerciseId: 'focus-single-point', name: 'Single-Point Focus' },
    { exerciseId: 'focus-cue-word', name: 'Cue Word Anchoring' },
    { exerciseId: 'focus-distraction', name: 'Distraction Training' },
  ],
  [MentalPathway.ConfidenceResilience]: [
    { exerciseId: 'confidence-evidence', name: 'Evidence Journal' },
    { exerciseId: 'visualization-highlight', name: 'Highlight Reel Visualization' },
    { exerciseId: 'mindset-growth', name: 'Growth Mindset Self-Talk' },
  ],
  [MentalPathway.PressurePerformance]: [
    { exerciseId: 'mindset-reframe-nerves', name: 'Nerves → Excitement Reframe' },
    { exerciseId: 'mindset-process-focus', name: 'Process Focus Training' },
    { exerciseId: 'visualization-adversity', name: 'Adversity Response Imagery' },
  ],
  [MentalPathway.EliteRefinement]: [
    // Elite athletes rotate through advanced versions
    { exerciseId: 'visualization-competition', name: 'Competition Walkthrough' },
  ],
};

/**
 * Get reasoning text for a recommendation
 */
function getRecommendationReason(
  pathway: MentalPathway,
  pathwayStep: number,
  exerciseName: string,
  isFoundation: boolean,
  previousExerciseName?: string
): string {
  if (isFoundation) {
    if (pathwayStep === 0) {
      return `Starting with the foundation: ${exerciseName} is the most fundamental breathing technique that builds the base for all other mental skills.`;
    }
    return `Continuing foundation training with ${exerciseName} to build daily mental awareness habits.`;
  }

  const pathwayName = athleteProgressService.getPathwayDisplayName(pathway);

  if (pathwayStep === 1) {
    return `Beginning ${pathwayName} pathway. ${exerciseName} is the first exercise in this progression, building the core skill.`;
  }

  if (previousExerciseName) {
    return `Progressing in ${pathwayName}. After mastering ${previousExerciseName}, ${exerciseName} builds on that foundation with more advanced techniques.`;
  }

  return `Continuing ${pathwayName} pathway at step ${pathwayStep}. ${exerciseName} is the next exercise in the sequence.`;
}

// ============================================================================
// SERVICE
// ============================================================================

export const recommendationService = {
  /**
   * Generate a recommendation for an athlete
   * Follows the curriculum rules for what to recommend next
   */
  async generateRecommendation(
    athleteId: string,
    coachId: string,
    triggerType: 'assessment_complete' | 'assignment_complete' | 'manual_request' | 'intervention' | 'competition_prep',
    previousAssignmentId?: string
  ): Promise<MentalRecommendation | null> {
    // Guardrail: if the athlete already has an active curriculum assignment, do NOT generate a new recommendation.
    // This prevents duplicate recommendations after the coach clicks Refresh.
    const activeAssignment = await curriculumAssignmentService.getActiveForAthlete(athleteId);
    if (activeAssignment) {
      return null;
    }

    // Get athlete's progress
    let progress = await athleteProgressService.get(athleteId);
    
    // Initialize if no progress exists
    if (!progress) {
      progress = await athleteProgressService.initialize(athleteId, coachId);
    }

    // Determine what to recommend
    let exerciseId: string;
    let exerciseName: string;
    let pathway: MentalPathway;
    let pathwayStep: number;
    let confidence: RecommendationConfidence;
    let isFoundation = false;
    let previousExerciseName: string | undefined;

    // Check for pending recommendations first
    const pendingRec = await this.getPendingForAthlete(athleteId, coachId);
    if (pendingRec) {
      // Already have a pending recommendation
      return pendingRec;
    }

    // Rule 1: If assessment not complete, don't recommend (they need assessment first)
    if (progress.assessmentNeeded && triggerType !== 'manual_request') {
      // For manual requests, we can still recommend foundation
      // But for auto-triggers, wait for assessment
      return null;
    }

    // Rule 2: If foundation not complete, recommend foundation exercises
    if (!progress.foundationComplete) {
      isFoundation = true;
      pathway = MentalPathway.Foundation;
      
      if (!progress.foundationBoxBreathingComplete) {
        exerciseId = FOUNDATION_EXERCISES.boxBreathing;
        exerciseName = 'Box Breathing';
        pathwayStep = 1;
        confidence = RecommendationConfidence.High;
      } else {
        // Box breathing done, but foundation not complete means we're in check-in phase
        // For now, just mark foundation as complete after box breathing
        // In a full implementation, we'd track check-ins separately
        await athleteProgressService.markFoundationExerciseComplete(athleteId, 'daily_checkins');
        progress = (await athleteProgressService.get(athleteId))!;
        
        // Now recommend first exercise of their pathway
        pathway = progress.currentPathway;
        pathwayStep = 1;
        const sequence = PATHWAY_SEQUENCES[pathway] || [];
        if (sequence.length === 0) {
          return null;
        }
        exerciseId = sequence[0].exerciseId;
        exerciseName = sequence[0].name;
        confidence = RecommendationConfidence.High;
        isFoundation = false;
      }
    } else {
      // Foundation complete, follow pathway
      pathway = progress.currentPathway;
      pathwayStep = progress.pathwayStep;
      
      const sequence = PATHWAY_SEQUENCES[pathway] || [];
      
      // Check if pathway is complete
      if (pathwayStep >= sequence.length) {
        // Move to next pathway
        await athleteProgressService.completePathway(athleteId, pathway);
        progress = (await athleteProgressService.get(athleteId))!;
        pathway = progress.currentPathway;
        pathwayStep = 1;
      }

      const stepIndex = Math.max(0, pathwayStep - 1);
      const currentExercise = sequence[stepIndex];
      
      if (!currentExercise) {
        // No more exercises in pathway
        return null;
      }

      exerciseId = currentExercise.exerciseId;
      exerciseName = currentExercise.name;

      // Get previous exercise name for reasoning
      if (stepIndex > 0) {
        previousExerciseName = sequence[stepIndex - 1].name;
      }

      // Determine confidence based on data available
      if (progress.baselineAssessment) {
        confidence = RecommendationConfidence.High;
      } else {
        confidence = RecommendationConfidence.Medium;
      }
    }

    // Verify exercise exists in library
    const exercise = await exerciseLibraryService.getById(exerciseId);
    if (!exercise) {
      console.warn(`Exercise not found in library: ${exerciseId}`);
      // Try to find by name
      const exercises = await exerciseLibraryService.getAll();
      const found = exercises.find(e => 
        e.name.toLowerCase().includes(exerciseName.toLowerCase()) ||
        e.id === exerciseId
      );
      if (found) {
        exerciseId = found.id;
        exerciseName = found.name;
      } else {
        confidence = RecommendationConfidence.Low;
      }
    }

    // Generate reason
    const reason = getRecommendationReason(
      pathway,
      pathwayStep,
      exerciseName,
      isFoundation,
      previousExerciseName
    );

    // Create recommendation
    const now = Date.now();
    const recommendation: Omit<MentalRecommendation, 'id'> = {
      athleteId,
      coachId,
      exerciseId,
      exercise: exercise || undefined,
      reason,
      confidence,
      pathway,
      pathwayStep: isFoundation ? 0 : pathwayStep,
      triggerType,
      previousAssignmentId,
      status: RecommendationStatus.Pending,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(
      collection(db, COLLECTION),
      recommendationToFirestore(recommendation as MentalRecommendation)
    );

    return { ...recommendation, id: docRef.id } as MentalRecommendation;
  },

  /**
   * Get a recommendation by ID
   */
  async getById(id: string): Promise<MentalRecommendation | null> {
    const docRef = doc(db, COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return recommendationFromFirestore(snap.id, snap.data());
  },

  /**
   * Get pending recommendation for an athlete
   */
  async getPendingForAthlete(athleteId: string, coachId: string): Promise<MentalRecommendation | null> {
    const q = query(
      collection(db, COLLECTION),
      where('athleteId', '==', athleteId),
      where('coachId', '==', coachId),
      where('status', '==', RecommendationStatus.Pending)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return recommendationFromFirestore(snap.docs[0].id, snap.docs[0].data());
  },

  /**
   * Get all pending recommendations for a coach
   */
  async getPendingForCoach(coachId: string): Promise<MentalRecommendation[]> {
    const q = query(
      collection(db, COLLECTION),
      where('coachId', '==', coachId),
      where('status', '==', RecommendationStatus.Pending),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => recommendationFromFirestore(d.id, d.data()));
  },

  /**
   * Accept a recommendation (coach approved as-is)
   */
  async accept(recommendationId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, recommendationId), {
      status: RecommendationStatus.Accepted,
      updatedAt: Date.now(),
    });
  },

  /**
   * Modify a recommendation (coach changed something)
   */
  async modify(recommendationId: string, reason: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, recommendationId), {
      status: RecommendationStatus.Modified,
      coachOverrideReason: reason,
      updatedAt: Date.now(),
    });
  },

  /**
   * Dismiss a recommendation
   */
  async dismiss(recommendationId: string, reason: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, recommendationId), {
      status: RecommendationStatus.Dismissed,
      coachOverrideReason: reason,
      updatedAt: Date.now(),
    });
  },

  /**
   * Listen to pending recommendations for a coach
   */
  listenToPendingForCoach(
    coachId: string,
    callback: (recommendations: MentalRecommendation[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION),
      where('coachId', '==', coachId),
      where('status', '==', RecommendationStatus.Pending),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snap) => {
      const recommendations = snap.docs.map(d => recommendationFromFirestore(d.id, d.data()));
      callback(recommendations);
    });
  },

  /**
   * Generate recommendations for all athletes of a coach
   * Useful for batch recommendation generation
   */
  async generateForAllAthletes(coachId: string, athleteIds: string[]): Promise<MentalRecommendation[]> {
    const recommendations: MentalRecommendation[] = [];

    for (const athleteId of athleteIds) {
      try {
        const rec = await this.generateRecommendation(
          athleteId,
          coachId,
          'manual_request'
        );
        if (rec) {
          recommendations.push(rec);
        }
      } catch (error) {
        console.error(`Failed to generate recommendation for ${athleteId}:`, error);
      }
    }

    return recommendations;
  },

  /**
   * Get pathway definitions for display
   */
  getPathwayDefinitions(): PathwayDefinition[] {
    return [
      {
        pathway: MentalPathway.Foundation,
        name: 'Universal Foundation',
        description: 'Every athlete starts here to build common baseline skills',
        exerciseSequence: [
          { step: 1, exerciseId: 'breathing-box', exerciseName: 'Box Breathing', weeksRange: '1-2', isFoundation: true, isApplication: false },
        ],
        graduationCriteria: ['Complete 12 of 14 days', 'Build habit of mental self-awareness'],
      },
      {
        pathway: MentalPathway.ArousalMastery,
        name: 'Arousal Mastery',
        description: 'For athletes whose primary challenge is anxiety or energy management',
        exerciseSequence: [
          { step: 1, exerciseId: 'breathing-physiological-sigh', exerciseName: 'Physiological Sigh', weeksRange: '5-6', isFoundation: true, isApplication: false },
          { step: 2, exerciseId: 'breathing-arousal-control', exerciseName: 'Arousal Control Breathing', weeksRange: '7-8', isFoundation: true, isApplication: true },
          { step: 3, exerciseId: 'breathing-recovery', exerciseName: 'Recovery Breathing', weeksRange: '9-10', isFoundation: false, isApplication: true },
        ],
        graduationCriteria: [
          'Can identify optimal arousal zone',
          'Has pre-competition calming routine',
          'Uses recovery breathing after all competitions',
        ],
      },
      {
        pathway: MentalPathway.FocusMastery,
        name: 'Focus Mastery',
        description: 'For athletes whose primary challenge is concentration',
        exerciseSequence: [
          { step: 1, exerciseId: 'focus-single-point', exerciseName: 'Single-Point Focus', weeksRange: '5-6', isFoundation: true, isApplication: false },
          { step: 2, exerciseId: 'focus-cue-word', exerciseName: 'Cue Word Anchoring', weeksRange: '7-8', isFoundation: true, isApplication: true },
          { step: 3, exerciseId: 'focus-distraction', exerciseName: 'Distraction Training', weeksRange: '9-10', isFoundation: false, isApplication: true },
        ],
        graduationCriteria: [
          'Has 2-3 established cue words',
          'Can focus for 3 min with distractions',
          'Uses cue words automatically in competition',
        ],
      },
      {
        pathway: MentalPathway.ConfidenceResilience,
        name: 'Confidence & Resilience',
        description: 'For athletes struggling with belief or bouncing back',
        exerciseSequence: [
          { step: 1, exerciseId: 'confidence-evidence', exerciseName: 'Evidence Journal', weeksRange: '5-6', isFoundation: true, isApplication: false },
          { step: 2, exerciseId: 'visualization-highlight', exerciseName: 'Highlight Reel Visualization', weeksRange: '7-8', isFoundation: true, isApplication: true },
          { step: 3, exerciseId: 'mindset-growth', exerciseName: 'Growth Mindset Self-Talk', weeksRange: '9-10', isFoundation: false, isApplication: true },
        ],
        graduationCriteria: [
          'Has 30+ evidence journal entries',
          'Can trigger confidence through highlight reel',
          'Demonstrates growth mindset language',
        ],
      },
      {
        pathway: MentalPathway.PressurePerformance,
        name: 'Pressure Performance',
        description: 'For athletes who underperform when it matters most',
        exerciseSequence: [
          { step: 1, exerciseId: 'mindset-reframe-nerves', exerciseName: 'Nerves → Excitement Reframe', weeksRange: '5-6', isFoundation: true, isApplication: false },
          { step: 2, exerciseId: 'mindset-process-focus', exerciseName: 'Process Focus Training', weeksRange: '7-8', isFoundation: true, isApplication: true },
          { step: 3, exerciseId: 'visualization-adversity', exerciseName: 'Adversity Response Imagery', weeksRange: '9-10', isFoundation: false, isApplication: true },
        ],
        graduationCriteria: [
          'Can reframe nerves as excitement',
          'Has clear process cues for competition',
          'Completes full comp prep for 2 events',
        ],
      },
    ];
  },
};
