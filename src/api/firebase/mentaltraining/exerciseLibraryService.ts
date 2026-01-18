/**
 * Exercise Library Service
 * 
 * Manages the mental exercise library including CRUD operations
 * and provides seeded exercise templates.
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
  writeBatch,
} from 'firebase/firestore';
import {
  MentalExercise,
  ExerciseCategory,
  ExerciseDifficulty,
  BreathingPattern,
  exerciseFromFirestore,
  exerciseToFirestore,
} from './types';

const COLLECTION = 'mental-exercises';

// ============================================================================
// SERVICE
// ============================================================================

export const exerciseLibraryService = {
  /**
   * Get all active exercises
   */
  async getAll(): Promise<MentalExercise[]> {
    const q = query(
      collection(db, COLLECTION),
      where('isActive', '==', true),
      orderBy('sortOrder', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
  },

  /**
   * Get exercises by category
   */
  async getByCategory(category: ExerciseCategory): Promise<MentalExercise[]> {
    const q = query(
      collection(db, COLLECTION),
      where('category', '==', category),
      where('isActive', '==', true),
      orderBy('sortOrder', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
  },

  /**
   * Get a single exercise by ID
   */
  async getById(id: string): Promise<MentalExercise | null> {
    const docRef = doc(db, COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return exerciseFromFirestore(snap.id, snap.data());
  },

  /**
   * Get exercises best for a specific use case
   */
  async getBestFor(useCase: string): Promise<MentalExercise[]> {
    const q = query(
      collection(db, COLLECTION),
      where('bestFor', 'array-contains', useCase),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
  },

  /**
   * Create or update an exercise
   */
  async save(exercise: MentalExercise): Promise<void> {
    const docRef = doc(db, COLLECTION, exercise.id);
    await setDoc(docRef, exerciseToFirestore(exercise), { merge: true });
  },

  /**
   * Soft delete an exercise (set isActive to false)
   */
  async deactivate(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, { isActive: false, updatedAt: Date.now() });
  },

  /**
   * Hard delete an exercise
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  },

  /**
   * Seed the exercise library with default exercises
   */
  async seedExercises(): Promise<{ created: number; skipped: number }> {
    const existing = await this.getAll();
    const existingIds = new Set(existing.map(e => e.id));
    
    const batch = writeBatch(db);
    let created = 0;
    let skipped = 0;

    for (const exercise of SEEDED_EXERCISES) {
      if (existingIds.has(exercise.id)) {
        skipped++;
        continue;
      }
      const docRef = doc(db, COLLECTION, exercise.id);
      batch.set(docRef, exerciseToFirestore(exercise));
      created++;
    }

    if (created > 0) {
      await batch.commit();
    }

    return { created, skipped };
  },

  /**
   * Get quick exercises (under 5 minutes)
   */
  async getQuickExercises(): Promise<MentalExercise[]> {
    const all = await this.getAll();
    return all.filter(e => e.durationMinutes <= 5);
  },

  /**
   * Get exercises by difficulty
   */
  async getByDifficulty(difficulty: ExerciseDifficulty): Promise<MentalExercise[]> {
    const q = query(
      collection(db, COLLECTION),
      where('difficulty', '==', difficulty),
      where('isActive', '==', true),
      orderBy('sortOrder', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
  },
};

// ============================================================================
// SEEDED EXERCISES
// ============================================================================

const now = Date.now();

const SEEDED_EXERCISES: MentalExercise[] = [
  // -------------------------------------------------------------------------
  // BREATHING EXERCISES
  // -------------------------------------------------------------------------
  {
    id: 'breathing-box',
    name: 'Box Breathing',
    description: 'A 4-phase breathing pattern used by Navy SEALs and elite athletes to calm the nervous system and sharpen focus. Equal inhale, hold, exhale, and hold phases.',
    category: ExerciseCategory.Breathing,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 4,
    exerciseConfig: {
      type: 'breathing',
      config: {
        pattern: BreathingPattern.BoxBreathing,
        phases: [
          { name: 'inhale', duration: 4, instruction: 'Breathe in slowly through your nose' },
          { name: 'hold', duration: 4, instruction: 'Hold your breath gently' },
          { name: 'exhale', duration: 4, instruction: 'Exhale slowly through your mouth' },
          { name: 'holdEmpty', duration: 4, instruction: 'Hold empty' },
        ],
        cycles: 6,
        totalDuration: 240,
      },
    },
    benefits: [
      'Reduces stress and anxiety',
      'Improves focus and concentration',
      'Activates parasympathetic nervous system',
      'Can be done anywhere',
    ],
    bestFor: ['pre-competition', 'anxiety', 'between sets', 'anger management'],
    iconName: 'square',
    isActive: true,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'breathing-physiological-sigh',
    name: 'Physiological Sigh',
    description: 'The fastest known way to reduce stress in real-time. A double inhale followed by a long exhale mimics the body\'s natural calming reflex.',
    category: ExerciseCategory.Breathing,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 2,
    exerciseConfig: {
      type: 'breathing',
      config: {
        pattern: BreathingPattern.PhysiologicalSigh,
        phases: [
          { name: 'inhale', duration: 3, instruction: 'Take a normal inhale through your nose' },
          { name: 'inhale', duration: 1, instruction: 'Take a second short "sip" of air' },
          { name: 'exhale', duration: 7, instruction: 'Slowly exhale through your mouth' },
        ],
        cycles: 5,
        totalDuration: 120,
      },
    },
    benefits: [
      'Fastest stress relief technique',
      'Works in 1-3 breaths',
      'Backed by Stanford neuroscience research',
      'Perfect for acute anxiety',
    ],
    bestFor: ['immediate stress relief', 'panic', 'right before competing', 'racing heart'],
    iconName: 'wind',
    isActive: true,
    sortOrder: 2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'breathing-478',
    name: '4-7-8 Relaxation Breathing',
    description: 'A powerful relaxation technique with a 4-7-8 pattern. The extended exhale and hold activate deep relaxation.',
    category: ExerciseCategory.Breathing,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'breathing',
      config: {
        pattern: BreathingPattern.FourSevenEight,
        phases: [
          { name: 'inhale', duration: 4, instruction: 'Breathe in through your nose' },
          { name: 'hold', duration: 7, instruction: 'Hold your breath' },
          { name: 'exhale', duration: 8, instruction: 'Exhale completely through your mouth' },
        ],
        cycles: 4,
        totalDuration: 300,
      },
    },
    benefits: [
      'Deep relaxation',
      'Helps with sleep',
      'Reduces anxiety',
      'Calms racing thoughts',
    ],
    bestFor: ['evening wind-down', 'sleep prep', 'deep relaxation', 'post-competition'],
    iconName: 'moon',
    isActive: true,
    sortOrder: 3,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'breathing-activation',
    name: 'Activation Breathing',
    description: 'Short, powerful breaths to increase energy and arousal before competition. Use when you need to get amped up.',
    category: ExerciseCategory.Breathing,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 2,
    exerciseConfig: {
      type: 'breathing',
      config: {
        pattern: BreathingPattern.ArousalControl,
        phases: [
          { name: 'inhale', duration: 4, instruction: 'Deep breath in through nose' },
          { name: 'exhale', duration: 2, instruction: 'Sharp exhale through nose' },
        ],
        cycles: 15,
        totalDuration: 120,
      },
    },
    benefits: [
      'Increases energy and alertness',
      'Activates sympathetic nervous system',
      'Gets you "amped up"',
      'Good for heavy lifts',
    ],
    bestFor: ['feeling flat', 'pre-heavy lift', 'activation', 'need energy'],
    iconName: 'zap',
    isActive: true,
    sortOrder: 4,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'breathing-recovery',
    name: 'Recovery Breathing',
    description: 'Post-competition or post-workout breathing to accelerate return to baseline. Helps clear adrenaline and cortisol.',
    category: ExerciseCategory.Breathing,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'breathing',
      config: {
        pattern: BreathingPattern.Recovery,
        phases: [
          { name: 'inhale', duration: 4, instruction: 'Gentle inhale through nose' },
          { name: 'exhale', duration: 7, instruction: 'Slow exhale through mouth' },
        ],
        cycles: 10,
        totalDuration: 300,
      },
    },
    benefits: [
      'Accelerates recovery',
      'Clears stress hormones',
      'Returns body to baseline',
      'Helps process performance',
    ],
    bestFor: ['post-competition', 'post-workout', 'recovery', 'coming down'],
    iconName: 'heart',
    isActive: true,
    sortOrder: 5,
    createdAt: now,
    updatedAt: now,
  },

  // -------------------------------------------------------------------------
  // VISUALIZATION EXERCISES
  // -------------------------------------------------------------------------
  {
    id: 'viz-competition-walkthrough',
    name: 'Competition Walkthrough',
    description: 'A detailed mental rehearsal of an upcoming competition from arrival to completion. Experience the event before it happens.',
    category: ExerciseCategory.Visualization,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 10,
    exerciseConfig: {
      type: 'visualization',
      config: {
        prompts: [
          'Close your eyes and take three deep breaths to center yourself.',
          'See yourself arriving at the venue. Notice the parking lot, the entrance, the energy.',
          'Walk into the competition area. See the equipment, the floor, the lighting.',
          'Feel the temperature. Hear the sounds around you.',
          'Move to your warm-up area. Begin your routine. Feel your body loosening up.',
          'Notice your confidence building with each movement.',
          'See yourself stepping up to compete. Feel the equipment in your hands.',
          'Execute your performance perfectly. See every detail of your technique.',
          'Feel the satisfaction of successful execution.',
          'See yourself responding with composure regardless of outcome.',
        ],
        imageryType: 'competition',
        duration: 600,
      },
    },
    benefits: [
      'Reduces novelty and anxiety',
      'Builds neural pathways',
      'Increases familiarity with venue',
      'Improves confidence',
    ],
    bestFor: ['competition prep', '3-7 days out', 'new venue', 'big events'],
    iconName: 'eye',
    isActive: true,
    sortOrder: 10,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'viz-perfect-execution',
    name: 'Perfect Execution Replay',
    description: 'Mental rehearsal of a specific skill performed perfectly. Reinforce correct technique and build confidence.',
    category: ExerciseCategory.Visualization,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'visualization',
      config: {
        prompts: [
          'Close your eyes and take three calming breaths.',
          'Choose one specific skill you want to perfect.',
          'See yourself in the starting position.',
          'Execute the movement at real-time speed in your mind.',
          'Feel every part - the tension, the release, the timing.',
          'See the successful result.',
          'Feel the satisfaction of perfect execution.',
          'Reset and repeat 5-10 times.',
        ],
        imageryType: 'execution',
        duration: 300,
      },
    },
    benefits: [
      'Reinforces technique',
      'Builds muscle memory',
      'Overwrites bad reps',
      'Maintains skills during injury',
    ],
    bestFor: ['before training', 'after mistakes', 'injury rehab', 'skill refinement'],
    iconName: 'target',
    isActive: true,
    sortOrder: 11,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'viz-highlight-reel',
    name: 'Highlight Reel',
    description: 'A mental compilation of your greatest performances and achievements. Build confidence on evidence of your capability.',
    category: ExerciseCategory.Visualization,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'visualization',
      config: {
        prompts: [
          'Close your eyes and take three calming breaths.',
          'Think of 5 of your best performance moments.',
          'Replay the first moment vividly - see, hear, feel everything.',
          'Linger on the feeling of success for 30 seconds.',
          'Move to the next moment. Same vivid detail.',
          'Connect all the moments: "This is who I am. This is what I\'m capable of."',
          'Open your eyes carrying that feeling of capability.',
        ],
        imageryType: 'highlight',
        duration: 300,
      },
    },
    benefits: [
      'Builds confidence',
      'Reminds you of capability',
      'Evidence-based self-belief',
      'Counters self-doubt',
    ],
    bestFor: ['low confidence', 'before competition', 'after setbacks', 'injury recovery'],
    iconName: 'star',
    isActive: true,
    sortOrder: 12,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'viz-adversity-response',
    name: 'Adversity Response Imagery',
    description: 'Mental rehearsal of how you\'ll respond when things go wrong. Prepare for challenges before they happen.',
    category: ExerciseCategory.Visualization,
    difficulty: ExerciseDifficulty.Advanced,
    durationMinutes: 8,
    exerciseConfig: {
      type: 'visualization',
      config: {
        prompts: [
          'Close your eyes. Think of 3 things that could go wrong in competition.',
          'For each scenario, visualize: The problem occurring...',
          'Your initial reaction - notice it, don\'t fight it.',
          'Your centering breath.',
          'Your positive self-talk response.',
          'Your refocused attention.',
          'Your successful recovery.',
          'Always end with successful performance despite adversity.',
        ],
        imageryType: 'adversity',
        duration: 480,
      },
    },
    benefits: [
      'Prepares for "what ifs"',
      'Builds resilience',
      'Reduces anxiety about failure',
      'Creates recovery plans',
    ],
    bestFor: ['competition prep', 'anxiety about what ifs', 'after setbacks', 'building resilience'],
    iconName: 'shield',
    isActive: true,
    sortOrder: 13,
    createdAt: now,
    updatedAt: now,
  },

  // -------------------------------------------------------------------------
  // FOCUS EXERCISES
  // -------------------------------------------------------------------------
  {
    id: 'focus-single-point',
    name: 'Single-Point Focus',
    description: 'The most fundamental focus exercise. Train your mind to stay on one thing without wandering.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 180,
        progressionLevel: 1,
        instructions: [
          'Choose a focal point - a spot on the wall, a small object, or a point on your equipment.',
          'Focus ONLY on that point.',
          'Notice its color, texture, shape. Don\'t analyze, just observe.',
          'When your mind wanders (it will), gently return.',
          'Count how many times you have to return - that\'s your focus fitness score.',
        ],
      },
    },
    benefits: [
      'Fundamental focus training',
      'Builds attention control',
      'Simple to do anywhere',
      'Measurable progress',
    ],
    bestFor: ['focus training', 'attention problems', 'beginners', 'daily practice'],
    iconName: 'crosshair',
    isActive: true,
    sortOrder: 20,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'focus-cue-word',
    name: 'Cue Word Anchoring',
    description: 'Create a mental shortcut - a single word that instantly triggers a desired mental state. Your reset button.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'cue_word',
        duration: 300,
        progressionLevel: 2,
        instructions: [
          'Choose the state you need most: Calm, Confident, Focused, Aggressive, or Relaxed.',
          'Select a word that resonates: "Strong", "Flow", "Ready", "Trust", "Now", "Let go".',
          'Use breathing to get into the desired state.',
          'At the peak of that feeling, say your word (out loud or internally).',
          'Repeat 10-15 times to anchor the word to the state.',
          'In competition, say your cue word to trigger the state.',
        ],
      },
    },
    benefits: [
      'Instant state change',
      'Works like a reset button',
      'Portable - works anywhere',
      'Gets stronger with practice',
    ],
    bestFor: ['pre-competition', 'between attempts', 'recovering from mistakes', 'state management'],
    iconName: 'key',
    isActive: true,
    sortOrder: 21,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'focus-body-scan',
    name: 'Body Scan Awareness',
    description: 'A systematic mental scan of your body to notice tension, increase awareness, and release unnecessary tightness.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'body_scan',
        duration: 300,
        progressionLevel: 1,
        instructions: [
          'Stand, sit, or lie comfortably. Close your eyes.',
          'Start at the top of your head.',
          'Slowly scan down: Forehead, eyes, jaw, neck, shoulders...',
          'Arms, hands, chest, core...',
          'Hips, legs, feet.',
          'Notice any tension without judgment.',
          'Breathe into tight areas and release.',
        ],
      },
    },
    benefits: [
      'Increases body awareness',
      'Releases unnecessary tension',
      'Calms the mind',
      'Good warm-up for performance',
    ],
    bestFor: ['pre-competition', 'before technical work', 'rest periods', 'sleep prep'],
    iconName: 'user',
    isActive: true,
    sortOrder: 22,
    createdAt: now,
    updatedAt: now,
  },

  // -------------------------------------------------------------------------
  // MINDSET EXERCISES
  // -------------------------------------------------------------------------
  {
    id: 'mindset-pressure-privilege',
    name: 'Pressure to Privilege Reframe',
    description: 'Transform pressure from threat to opportunity. Pressure means you\'re doing something that matters.',
    category: ExerciseCategory.Mindset,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'mindset',
      config: {
        type: 'reframe',
        prompts: [
          'Write down the pressure thoughts you have before competition.',
          'For each thought, create a privilege-based alternative:',
          '"I can\'t mess this up" → "This matters. That\'s exciting."',
          '"Everyone is counting on me" → "I get to perform for people I care about."',
          '"What if I fail?" → "What if I rise to this moment?"',
          'Practice the switch when pressure thoughts arise.',
          'Remember: Pressure is proof you\'ve earned this opportunity.',
        ],
        journalRequired: true,
      },
    },
    benefits: [
      'Changes relationship with pressure',
      'Reduces anxiety',
      'Builds excitement instead of fear',
      'Works for any high-stakes situation',
    ],
    bestFor: ['competition anxiety', 'high-stakes moments', 'fear of failure', 'overthinking'],
    iconName: 'gift',
    isActive: true,
    sortOrder: 30,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mindset-nerves-excitement',
    name: 'Nerves to Excitement Reframe',
    description: 'Anxiety and excitement have identical physical symptoms. Learn to interpret those sensations as excitement.',
    category: ExerciseCategory.Mindset,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'mindset',
      config: {
        type: 'reframe',
        prompts: [
          'Notice the symptoms: Racing heart, butterflies, sweaty palms.',
          'Instead of "I\'m so nervous", say "I\'m so excited".',
          'Instead of "My heart is racing because I\'m scared", say "My heart is racing because I\'m ready".',
          'Embrace the arousal: "This feeling means I\'m about to do something that matters."',
          'Channel the energy into movement - dynamic warm-up, shaking out limbs.',
          'Script: "These butterflies aren\'t fear. They\'re fuel. I\'m not nervous - I\'m READY."',
        ],
        journalRequired: false,
      },
    },
    benefits: [
      'Backed by Harvard research',
      'Simple but powerful technique',
      'Works immediately',
      'Changes your experience of nerves',
    ],
    bestFor: ['pre-competition nerves', 'physical anxiety symptoms', 'butterflies', 'racing heart'],
    iconName: 'sparkles',
    isActive: true,
    sortOrder: 31,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mindset-process-focus',
    name: 'Process Over Outcome',
    description: 'Train your mind to focus on controllable execution rather than uncontrollable results.',
    category: ExerciseCategory.Mindset,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'mindset',
      config: {
        type: 'process_focus',
        prompts: [
          'Define your process goals: What actions give you the best chance of success?',
          'Create 1-3 word process cues: "Tight core", "Quick feet", "Smooth release".',
          'When outcome thoughts arise, acknowledge and redirect:',
          '"I notice I\'m thinking about winning. That\'s not in my control right now."',
          '"What IS in my control is [process cue]."',
          'Post-performance: Judge yourself on process execution, not just results.',
        ],
        journalRequired: true,
      },
    },
    benefits: [
      'Reduces anxiety about results',
      'Keeps focus on controllables',
      'Improves execution',
      'Better relationship with outcomes',
    ],
    bestFor: ['outcome anxiety', 'results focus', 'choking', 'performance evaluation'],
    iconName: 'list',
    isActive: true,
    sortOrder: 32,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mindset-growth',
    name: 'Growth Mindset Self-Talk',
    description: 'Transform fixed mindset self-talk into growth mindset. Change "I can\'t" to "I\'m learning".',
    category: ExerciseCategory.Mindset,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'mindset',
      config: {
        type: 'growth_mindset',
        prompts: [
          'Catch fixed language: "always", "never", "can\'t", "not good at".',
          'Add "yet": "I can\'t do this" → "I can\'t do this YET".',
          'Focus on trajectory: "I\'m better at this than I was 6 months ago."',
          'Embrace struggle: "This is hard because I\'m getting better."',
          'Reframe failure: "I failed" → "I learned".',
          'Practice daily: Notice and reframe at least one fixed statement.',
        ],
        journalRequired: true,
      },
    },
    benefits: [
      'Changes relationship with failure',
      'Builds resilience',
      'Increases persistence',
      'Opens up possibility',
    ],
    bestFor: ['fixed mindset', 'fear of failure', 'self-limiting beliefs', 'after setbacks'],
    iconName: 'trending-up',
    isActive: true,
    sortOrder: 33,
    createdAt: now,
    updatedAt: now,
  },

  // -------------------------------------------------------------------------
  // CONFIDENCE EXERCISES
  // -------------------------------------------------------------------------
  {
    id: 'confidence-evidence-journal',
    name: 'Evidence Journal',
    description: 'Build confidence on facts, not feelings. Daily practice of recording proof that you are prepared and capable.',
    category: ExerciseCategory.Confidence,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'confidence',
      config: {
        type: 'evidence_journal',
        prompts: [
          'Answer one or more of these prompts:',
          '"What did I do today that proves I\'m getting better?"',
          '"What\'s one thing I did well in training?"',
          '"What\'s one challenge I overcame recently?"',
          '"What would my coach say I\'m doing well?"',
          'Before competition, review your journal. Read the proof you\'ve put in the work.',
        ],
        duration: 180,
      },
    },
    benefits: [
      'Confidence built on evidence',
      'Counters self-doubt with facts',
      'Creates a record of progress',
      'Stable confidence source',
    ],
    bestFor: ['daily practice', 'low confidence', 'pre-competition', 'imposter syndrome'],
    iconName: 'book',
    isActive: true,
    sortOrder: 40,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'confidence-power-pose',
    name: 'Power Posing',
    description: 'Use physical posture to influence mental state. Expansive postures increase testosterone and decrease cortisol.',
    category: ExerciseCategory.Confidence,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 2,
    exerciseConfig: {
      type: 'confidence',
      config: {
        type: 'power_pose',
        prompts: [
          'Find a private space (bathroom, hallway).',
          'Choose a power pose:',
          'The Victory: Arms raised in V above head, chin lifted.',
          'The Superhero: Feet apart, hands on hips, chest out.',
          'The Spread: Seated, lean back, arms spread wide.',
          'Hold for 2 minutes. Breathe deeply.',
          'Notice the shift in how you feel.',
        ],
        duration: 120,
      },
    },
    benefits: [
      'Quick confidence boost',
      'Changes body chemistry',
      'Works before any high-stakes moment',
      'Research-backed technique',
    ],
    bestFor: ['pre-competition', 'before presentations', 'after setbacks', 'need quick boost'],
    iconName: 'award',
    isActive: true,
    sortOrder: 41,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'confidence-affirmations',
    name: 'Sport-Specific Affirmations',
    description: 'Personal statements of capability based on real evidence. Not generic positivity - specific, evidence-based belief.',
    category: ExerciseCategory.Confidence,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'confidence',
      config: {
        type: 'affirmations',
        prompts: [
          'Write 3-5 personal affirmations. Rules:',
          'First person ("I am", "I can", "I will")',
          'Present tense',
          'Specific to your sport',
          'Based on real evidence',
          'Examples: "I have put in the work. I am prepared."',
          '"My technique is dialed in."',
          '"I perform best when it matters most."',
          'Repeat with conviction during morning routine and before competition.',
        ],
        duration: 180,
      },
    },
    benefits: [
      'Builds self-belief',
      'Evidence-based confidence',
      'Portable - can do anywhere',
      'Gets stronger with repetition',
    ],
    bestFor: ['morning routine', 'pre-competition', 'daily practice', 'building belief'],
    iconName: 'mic',
    isActive: true,
    sortOrder: 42,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'confidence-inventory',
    name: 'Confidence Inventory',
    description: 'A structured assessment of all the reasons you should believe in yourself. Creates a comprehensive case for confidence.',
    category: ExerciseCategory.Confidence,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 10,
    exerciseConfig: {
      type: 'confidence',
      config: {
        type: 'inventory',
        prompts: [
          'PHYSICAL PREPARATION: Training sessions completed, key workouts, benchmarks hit.',
          'TECHNICAL PREPARATION: Strongest skills, improvements this cycle, coach feedback.',
          'MENTAL PREPARATION: Mental training completed, pressure situations practiced, adversity overcome.',
          'EXPERIENCE: Similar competitions, lessons learned, best performances.',
          'SUPPORT: People who believe in you, resources, training partners.',
          'Write one paragraph summarizing why you deserve to be confident.',
        ],
        duration: 600,
      },
    },
    benefits: [
      'Comprehensive confidence review',
      'Great for competition prep',
      'Creates lasting reference',
      'Evidence-based belief',
    ],
    bestFor: ['competition prep', 'major events', 'confidence review', 'self-doubt'],
    iconName: 'clipboard',
    isActive: true,
    sortOrder: 43,
    createdAt: now,
    updatedAt: now,
  },
];
