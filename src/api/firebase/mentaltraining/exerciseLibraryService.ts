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
import { SIM_MODULES_COLLECTION } from './collections';
import { getSimSpec, getSimSpecByLegacyExerciseId } from './taxonomy';
import { buildSportContentPacks } from './sportContentPacks';
import { BODY_SCAN_INSTRUCTIONS } from '../../../content/bodyScanScript';

const COLLECTION = SIM_MODULES_COLLECTION;

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function shouldFallbackToSeededLibrary(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    message.includes('requires an index')
    || message.includes('code=failed-precondition')
    || message.includes('code=unavailable')
    || message.includes('Could not reach Cloud Firestore backend')
  );
}

function getSeededExercises() {
  return SEEDED_EXERCISES
    .filter((exercise) => exercise.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function isLaunchablePublishedExercise(exercise: MentalExercise | null | undefined): exercise is MentalExercise {
  return Boolean(
    exercise
    && exercise.isActive
    && hasNonEmptyString(exercise.id)
    && hasNonEmptyString(exercise.publishedFingerprint)
    && exercise.syncStatus === 'in_sync'
    && exercise.buildArtifact
    && hasNonEmptyString(exercise.buildArtifact.sourceFingerprint)
    && hasNonEmptyString(exercise.engineKey || exercise.buildArtifact.engineKey)
    && exercise.runtimeConfig
    && typeof exercise.runtimeConfig === 'object'
    && exercise.variantSource
    && typeof exercise.variantSource.publishedAt === 'number'
    && Number.isFinite(exercise.variantSource.publishedAt)
  );
}

// ============================================================================
// SERVICE
// ============================================================================

export const simModuleLibraryService = {
  /**
   * Get all active exercises
   */
  async getAll(): Promise<MentalExercise[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
    } catch (error) {
      if (!shouldFallbackToSeededLibrary(error)) {
        throw error;
      }

      console.warn('[exerciseLibraryService] Falling back to seeded exercise library for getAll:', error);
      return getSeededExercises();
    }
  },

  /**
   * Get exercises by category
   */
  async getByCategory(category: ExerciseCategory): Promise<MentalExercise[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('category', '==', category),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
    } catch (error) {
      if (!shouldFallbackToSeededLibrary(error)) {
        throw error;
      }

      console.warn('[exerciseLibraryService] Falling back to seeded exercise library for getByCategory:', error);
      return getSeededExercises().filter((exercise) => exercise.category === category);
    }
  },

  /**
   * Get a single exercise by ID
   */
  async getById(id: string): Promise<MentalExercise | null> {
    const docRef = doc(db, COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return SEEDED_EXERCISES.find((exercise) => exercise.id === id) || null;
    }
    return exerciseFromFirestore(snap.id, snap.data());
  },

  async getBySimSpecId(simSpecId: string): Promise<MentalExercise | null> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('simSpecId', '==', simSpecId)
      );
      const snap = await getDocs(q);
      const docSnap = snap.docs
        .map((entry) => exerciseFromFirestore(entry.id, entry.data()))
        .filter((exercise) => exercise.isActive)
        .sort((left, right) => left.sortOrder - right.sortOrder)[0];
      if (!docSnap) return null;
      return docSnap;
    } catch (error) {
      if (!shouldFallbackToSeededLibrary(error)) {
        throw error;
      }

      console.warn('[exerciseLibraryService] Falling back to seeded exercise library for getBySimSpecId:', error);
      return getSeededExercises().find((exercise) => exercise.simSpecId === simSpecId) || null;
    }
  },

  async getPublishedById(id: string): Promise<MentalExercise | null> {
    const exercise = await this.getById(id);
    return isLaunchablePublishedExercise(exercise) ? exercise : null;
  },

  async getPublishedBySimSpecId(simSpecId: string): Promise<MentalExercise | null> {
    const exercise = await this.getBySimSpecId(simSpecId);
    return isLaunchablePublishedExercise(exercise) ? exercise : null;
  },

  /**
   * Get exercises best for a specific use case
   */
  async getBestFor(useCase: string): Promise<MentalExercise[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('bestFor', 'array-contains', useCase),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
    } catch (error) {
      if (!shouldFallbackToSeededLibrary(error)) {
        throw error;
      }

      console.warn('[exerciseLibraryService] Falling back to seeded exercise library for getBestFor:', error);
      return getSeededExercises().filter((exercise) => exercise.bestFor.includes(useCase));
    }
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
   * Push the SEEDED_EXERCISES content (names, descriptions, instructions,
   * prompts, configs, and sport content packs) onto EXISTING library docs. seedExercises() only
   * creates missing docs, so copy fixes in the seed never reach prod
   * without this. Merge-writes so runtime-added fields survive.
   */
  async syncSeededCopy(): Promise<{ updated: number }> {
    const batch = writeBatch(db);
    let updated = 0;
    for (const exercise of SEEDED_EXERCISES) {
      const payload = exerciseToFirestore(exercise);
      // Write BOTH collections: iOS resolves from the legacy
      // mental-exercises collection first, then sim-modules.
      batch.set(doc(db, COLLECTION, exercise.id), payload, { merge: true });
      batch.set(doc(db, 'mental-exercises', exercise.id), payload, { merge: true });
      updated++;
    }
    await batch.commit();
    return { updated };
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
    try {
      const q = query(
        collection(db, COLLECTION),
        where('difficulty', '==', difficulty),
        where('isActive', '==', true),
        orderBy('sortOrder', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => exerciseFromFirestore(d.id, d.data()));
    } catch (error) {
      if (!shouldFallbackToSeededLibrary(error)) {
        throw error;
      }

      console.warn('[exerciseLibraryService] Falling back to seeded exercise library for getByDifficulty:', error);
      return getSeededExercises().filter((exercise) => exercise.difficulty === difficulty);
    }
  },
};

export const exerciseLibraryService = simModuleLibraryService;

// ============================================================================
// SEEDED EXERCISES
// ============================================================================

const now = Date.now();

function taxonomyFields(simIdOrExerciseId: string) {
  const simSpec = getSimSpec(simIdOrExerciseId) ?? getSimSpecByLegacyExerciseId(simIdOrExerciseId);
  if (!simSpec) return {};

  return {
    simSpecId: simSpec.id,
    taxonomy: {
      primaryPillar: simSpec.primaryPillar,
      secondaryPillar: simSpec.secondaryPillar,
      targetSkills: simSpec.targetSkills,
      pressureTypes: simSpec.pressureTypes,
      coreMetric: simSpec.coreMetric,
      supportingMetrics: simSpec.supportingMetrics,
      evidenceStatus: simSpec.evidenceStatus,
      prescriptionRoles: simSpec.prescriptionRoles,
      scientificBasis: simSpec.scientificBasis,
      transferHypothesis: simSpec.transferHypothesis,
      validationPlan: simSpec.validationPlan,
    },
  };
}

const BASE_SEEDED_EXERCISES: MentalExercise[] = [
  // -------------------------------------------------------------------------
  // BREATHING EXERCISES
  // -------------------------------------------------------------------------
  {
    id: 'breathing-box',
    name: 'Box Breathing',
    description: 'Breathe in, hold, breathe out, hold. Navy SEALs and elite athletes use this square pattern to calm down and lock in. A few rounds quiet your body\'s alarm system.',
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
          { name: 'holdEmpty', duration: 4, instruction: 'Hold, lungs empty' },
        ],
        cycles: 6,
        totalDuration: 240,
      },
    },
    benefits: [
      'Reduces stress and anxiety',
      'Improves focus and concentration',
      'Flips on your body\'s calm-down system',
      'Can be done anywhere',
    ],
    bestFor: ['pre-competition', 'anxiety', 'between sets', 'anger management'],
    reflection: {
      questions: [
        { id: 'calm-level', prompt: 'How calm is your body right now?', kind: 'scale', scaleLowLabel: 'Still wired', scaleHighLabel: 'Fully calm' },
      ],
    },
    origin: 'Developed and used by U.S. Navy SEALs during BUD/S training and combat operations. Former Navy SEAL Commander Mark Divine popularized the technique, crediting it as a core tool for maintaining composure under extreme pressure. Now standard practice across Special Operations, FBI Hostage Rescue Teams, and elite athletic programs.',
    neuroscience: 'The equal-phase breathing pattern stimulates the vagus nerve, directly activating the parasympathetic nervous system and lowering cortisol levels within 90 seconds. The breath-hold phases increase CO₂ tolerance, which reduces the brain\'s panic threshold. fMRI studies show Box Breathing decreases amygdala reactivity (the brain\'s fear center) while increasing prefrontal cortex activity — the region responsible for decision-making under pressure.',
    overview: {
      when: 'Pre-competition, between sets, or during acute stress',
      focus: 'Calming the nervous system and sharpening mental clarity',
      timeScale: '4 minutes (6 cycles)',
      skill: 'Steadying your whole system on command',
      analogy: 'Like hitting the reset button on a frozen computer — it clears the system and restores control',
    },
    iconName: 'square',
    isActive: true,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'breathing-physiological-sigh',
    name: 'Double-Breath Reset',
    description: 'The fastest known way to calm down in the moment. Two breaths in, one long breath out. It copies the reset your body does on its own in deep sleep. Sport science calls it the physiological sigh.',
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
      'Backed by Stanford research',
      'Great when nerves spike fast',
    ],
    bestFor: ['immediate stress relief', 'panic', 'right before competing', 'racing heart'],
    reflection: {
      questions: [
        { id: 'calm-level', prompt: 'How calm is your body right now?', kind: 'scale', scaleLowLabel: 'Still wired', scaleHighLabel: 'Fully calm' },
      ],
    },
    origin: 'Discovered by Stanford University neuroscientist Dr. Andrew Huberman and published in Cell Reports Medicine (2023). The study was the first controlled trial to prove that a specific breathing pattern outperforms meditation for real-time stress reduction. Now adopted by U.S. Olympic training programs and professional sports teams.',
    neuroscience: 'The double inhale maximally inflates the alveoli (tiny air sacs in the lungs), which offloads CO₂ more efficiently than a single breath. The extended exhale activates the parasympathetic nervous system via the vagus nerve. In Huberman\'s clinical trial, just 5 minutes of cyclic sighing produced the greatest reduction in resting heart rate and self-reported anxiety compared to box breathing, meditation, and mindfulness — making it the most efficient stress-reduction tool ever measured in a laboratory setting.',
    overview: {
      when: 'Moments before competing, during a panic spike, or when you need instant calm',
      focus: 'Fastest possible stress override',
      timeScale: '1–3 breaths (under 30 seconds for effect)',
      skill: 'Acute stress termination',
      analogy: 'Like a fire extinguisher for anxiety — one pull and the flames go out',
    },
    iconName: 'wind',
    isActive: true,
    sortOrder: 2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'breathing-478',
    name: '4-7-8 Relaxation Breathing',
    description: 'Breathe in for 4, hold for 7, out for 8. The long hold and slow exhale switch on your body\'s deepest calm. Built for winding down.',
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
    reflection: {
      questions: [
        { id: 'calm-level', prompt: 'How calm is your body right now?', kind: 'scale', scaleLowLabel: 'Still wired', scaleHighLabel: 'Fully calm' },
      ],
    },
    origin: 'Developed by Dr. Andrew Weil, integrative medicine pioneer at the University of Arizona, based on pranayama — the ancient yogic discipline of breath regulation practiced for over 3,000 years. Used by military personnel for sleep optimization and by professional athletes for post-competition wind-down and sleep quality improvement.',
    neuroscience: 'The 4-7-8 ratio creates an exhale-dominant breathing cycle that shifts the autonomic nervous system from sympathetic (fight-or-flight) to parasympathetic (rest-and-digest). The 7-second hold increases CO₂ in the bloodstream, which paradoxically relaxes smooth muscle tissue throughout the body. Research shows this pattern reduces norepinephrine levels (the brain\'s alertness chemical) within 4 cycles, making it one of the most effective non-pharmaceutical sleep aids available.',
    overview: {
      when: 'Evening wind-down, post-competition, or when sleep is critical',
      focus: 'Deep relaxation and sleep preparation',
      timeScale: '5 minutes (4 cycles)',
      skill: 'Switching on recovery mode',
      analogy: 'Like dimming all the lights in a house before bed — each cycle turns off another system',
    },
    iconName: 'moon',
    isActive: true,
    sortOrder: 3,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'breathing-activation',
    name: 'Activation Breathing',
    description: 'Short, strong breaths that bring your energy up before you compete. The opposite of calming breathing: this wakes your whole system up when you feel flat.',
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
      'Turns your energy dial up',
      'Gets you "amped up"',
      'Good for heavy lifts',
    ],
    bestFor: ['feeling flat', 'pre-heavy lift', 'activation', 'need energy'],
    reflection: {
      questions: [
        { id: 'energy-level', prompt: 'How much energy do you have right now?', kind: 'scale', scaleLowLabel: 'Still flat', scaleHighLabel: 'Fired up' },
      ],
    },
    origin: 'Derived from Wim Hof Method breathing and Tummo (inner fire) meditation practiced by Tibetan monks. Wim Hof — known as "The Iceman" — used this technique to climb Mount Everest in shorts and run a marathon in the Arctic barefoot. Adapted by military special operations units and combat athletes for pre-engagement arousal control.',
    neuroscience: 'Inhale-dominant breathing deliberately activates the sympathetic nervous system, increasing adrenaline and norepinephrine release. The short, forceful exhales prevent over-oxygenation while driving up heart rate and core body temperature. Research published in PNAS (2014) demonstrated that practitioners of this technique could voluntarily influence their innate immune response and adrenaline levels — something previously thought impossible by modern medicine.',
    overview: {
      when: 'Pre-competition when energy is low, before heavy lifts, or when you feel flat',
      focus: 'Raising energy and competitive fire',
      timeScale: '2 minutes (15 cycles)',
      skill: 'Turning your energy up on command',
      analogy: 'Like revving an engine before a drag race — controlled power on demand',
    },
    iconName: 'zap',
    isActive: true,
    sortOrder: 4,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'breathing-recovery',
    name: 'Recovery Breathing',
    description: 'For after competition and hard training. Slow breathing helps your body shift out of high effort so recovery can begin.',
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
      'Speeds up recovery',
      'Clears leftover stress',
      'Brings your body back to steady',
      'Helps you let the performance go',
    ],
    bestFor: ['post-competition', 'post-workout', 'recovery', 'coming down'],
    reflection: {
      questions: [
        { id: 'recovery-level', prompt: 'How settled does your body feel right now?', kind: 'scale', scaleLowLabel: 'Still revved', scaleHighLabel: 'Back to steady' },
      ],
    },
    origin: 'Standard protocol in U.S. military post-mission debrief sequences and used by Formula 1 drivers after races to accelerate physiological recovery. The exhale-dominant ratio is modeled on techniques from the Russian Special Forces (Spetsnaz) Systema training system, which emphasizes breath-led recovery under operational stress.',
    neuroscience: 'The extended exhale-to-inhale ratio (nearly 2:1) rapidly downregulates the sympathetic nervous system and accelerates cortisol clearance from the bloodstream. Research from the Journal of Sports Science & Medicine shows that structured post-exercise breathing reduces heart rate recovery time by up to 30% and lowers salivary cortisol levels significantly faster than passive rest alone. This accelerates the body\'s transition from catabolic (breakdown) to anabolic (repair) states.',
    overview: {
      when: 'Immediately after competition or intense training',
      focus: 'Clearing stress hormones and accelerating recovery',
      timeScale: '5 minutes (10 cycles)',
      skill: 'Post-performance physiological reset',
      analogy: 'Like a cool-down lap after a race \u2014 bringing the engine back to idle safely',
    },
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
    description: 'Walk through your whole competition day in your head before it happens: the arrival, the warm-up, the opening action, and the finish. Mental rehearsal makes important cues more familiar.',
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
          'Run your performance perfectly. See every detail.',
          'Feel the satisfaction of successful execution.',
          'See yourself staying calm no matter how it goes.',
        ],
        imageryType: 'competition',
        duration: 600,
      },
    },
    benefits: [
      'Reduces novelty and anxiety',
      'Builds competition-day familiarity',
      'Increases familiarity with venue',
      'Improves confidence',
    ],
    bestFor: ['competition prep', '3-7 days out', 'new venue', 'big events'],
    reflection: {
      questions: [
        { id: 'image-clarity', prompt: 'How clearly could you see the scenes?', kind: 'scale', scaleLowLabel: 'Fuzzy', scaleHighLabel: 'Like a movie' },
      ],
    },
    interaction: {
      kind: 'guidedDwell',
      pickPrompt: 'Pick the three parts of competition day you want to walk through in detail.',
      pickChoices: [
        'Arriving at the venue',
        'Warming up',
        'The moments right before I compete',
        'Executing my opening action',
        'Handling a mistake',
        'Closing it out strong',
      ],
      pickCount: 3,
      dwellSeconds: 30,
      dwellPrompt: 'Build the scene around you. What do you see? What do you hear? Walk through it like you are already there.',
      closePrompt: 'You have already rehearsed this competition in your mind. The important cues will feel more familiar.',
    },
    origin: 'Used by Navy SEALs before every mission (called "dirt diving" — mentally rehearsing every phase of an operation). Fighter pilots call it "chair flying" — sitting in a chair and mentally flying an entire sortie before entering the cockpit. Michael Phelps\' coach Bob Bowman had him visualize every race nightly for years, including scenarios where things went wrong (his goggles filled with water at the 2008 Olympics — he still won gold because he had already "done it" in his mind).',
    neuroscience: 'The brain fires the exact same neural pathways during vivid visualization as during physical execution — a phenomenon called "functional equivalence." MRI studies show that mental rehearsal activates the motor cortex, premotor cortex, and supplementary motor areas at nearly identical levels to real movement. Research from the Journal of Neurophysiology found that athletes who combined physical practice with mental rehearsal showed 35% greater strength gains than those who only trained physically. Your brain literally cannot distinguish between a vividly imagined experience and a real one.',
    overview: {
      when: '3-7 days before competition, or the night before a big event',
      focus: 'Experiencing the entire event mentally before it happens',
      timeScale: '10 minutes (full guided walkthrough)',
      skill: 'Pre-competition mental rehearsal',
      analogy: 'Like a dress rehearsal before opening night — you\'ve already performed before you step on stage',
    },
    iconName: 'eye',
    isActive: true,
    sortOrder: 10,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'viz-perfect-execution',
    name: 'Perfect Execution Replay',
    description: 'Practice one skill perfectly in your head. Every perfect mental run makes the pattern stronger in your brain, replaces old mistakes, and builds real confidence, even while your body rests.',
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
          'Run the movement at performance speed in your mind.',
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
      'Replaces old mistakes',
      'Keeps skills sharp while injured',
    ],
    bestFor: ['before training', 'after mistakes', 'injury rehab', 'skill refinement'],
    reflection: {
      questions: [
        { id: 'run-quality', prompt: 'How clean were your mental runs?', kind: 'scale', scaleLowLabel: 'Choppy', scaleHighLabel: 'Perfect' },
        { id: 'breakdown-spot', prompt: 'Where did the replay break down?', kind: 'choice', choices: ['The start', 'The key moment', 'The finish', 'It didn\'t'] },
      ],
    },
    interaction: {
      kind: 'lockedReplay',
      setupPrompts: [
        'Choose one specific skill you want to improve. One movement, not a whole performance.',
        'See yourself in the starting position. Build the scene: the surface under you, the sounds around you.',
      ],
      loops: 5,
      loopSeconds: 20,
      loopPrompt: 'Run the movement in your mind at real speed. When you hit the key moment perfectly, lock it in.',
      lockCue: 'Lock It In',
      closePrompt: 'Five perfect runs, locked in. Your brain just practiced winning.',
    },
    origin: 'Core technique in Soviet-era sports psychology programs that dominated Olympic competition for decades. Soviet researchers discovered that athletes who spent 75% of their time on mental rehearsal and 25% on physical training outperformed those who trained only physically. Now a foundational practice for NFL quarterbacks (Tom Brady, Peyton Manning), NBA shooters, and Olympic gymnasts worldwide.',
    neuroscience: 'Mental repetition strengthens the same synaptic connections as physical repetition through a process called Hebbian learning ("neurons that fire together, wire together"). A landmark study in the Journal of Neurophysiology found that mental practice alone produced a 22% increase in muscle strength, compared to 30% for physical practice — meaning mental reps are roughly 73% as effective as real ones. For injured athletes, mental rehearsal prevents neural pathway degradation and can maintain up to 50% of skill proficiency during recovery.',
    overview: {
      when: 'Before training, after mistakes, or during injury recovery',
      focus: 'Reinforcing perfect technique through mental repetition',
      timeScale: '5 minutes (5-10 mental run-throughs)',
      skill: 'Locking in perfect technique',
      analogy: 'Like tracing the same pencil line over and over — each pass makes the groove deeper and more permanent',
    },
    iconName: 'target',
    isActive: true,
    sortOrder: 11,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'viz-highlight-reel',
    name: 'Highlight Reel',
    description: 'Your strongest performance moments, replayed on demand. You revisit proof from work you have already done and performances you have already delivered.',
    category: ExerciseCategory.Visualization,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'visualization',
      config: {
        prompts: [
          'Close your eyes and take three calming breaths.',
          'Think of 3 of your best performance moments.',
          'Replay the first moment vividly - see, hear, feel everything.',
          'Stay with the feeling of success for 30 seconds.',
          'Move to the next moment. Same vivid detail.',
          'Connect all the moments: "This is who I am. This is what I\'m capable of."',
          'Open your eyes and carry that feeling with you.',
        ],
        imageryType: 'highlight',
        duration: 300,
      },
    },
    benefits: [
      'Builds confidence',
      'Reminds you what you can do',
      'Belief built on proof',
      'Counters self-doubt',
    ],
    bestFor: ['low confidence', 'before competition', 'after setbacks', 'injury recovery'],
    reflection: {
      questions: [
        { id: 'confidence-level', prompt: 'How strong is your confidence right now?', kind: 'scale', scaleLowLabel: 'Shaky', scaleHighLabel: 'Unshakable' },
      ],
    },
    interaction: {
      kind: 'guidedDwell',
      pickPrompt: 'Pick three moments when you performed at your best. Choose the ones you can still picture clearly.',
      pickChoices: [
        'A competition where I performed at my best',
        'An action I finally nailed',
        'A moment I delivered under pressure',
        'A comeback after a mistake',
        'A training session where everything clicked',
        'A time I stayed steady under pressure',
      ],
      pickCount: 3,
      dwellSeconds: 25,
      dwellPrompt: 'Put yourself back inside this moment. See it. Hear it. Feel what it felt like in your body.',
      closePrompt: 'Those moments are proof. This is who you are. Carry that feeling with you today.',
    },
    origin: 'Used extensively by sports psychologists working with U.S. Olympic teams and Cirque du Soleil performers. Dr. Michael Gervais — performance psychologist for the Seattle Seahawks and Red Bull Stratos (Felix Baumgartner\'s space jump) — credits the Highlight Reel as one of the most reliable confidence-building tools in elite sport. LeBron James and Kobe Bryant were known to mentally replay their best moments before high-stakes games.',
    neuroscience: 'Reliving peak performances triggers the release of dopamine and serotonin — the same neurochemicals produced during the original experience. This creates a positive feedback loop: the brain associates your identity with success rather than anxiety. Research from the University of Chicago shows that vivid recall of past successes activates the ventromedial prefrontal cortex, which is directly responsible for self-concept and belief formation. Over time, this literally rewires your brain\'s default narrative about who you are as a competitor.',
    overview: {
      when: 'Before competition, after setbacks, or when confidence is low',
      focus: 'Replaying proof of your capability to build unshakable belief',
      timeScale: '5 minutes (3 peak moments)',
      skill: 'Evidence-based confidence building',
      analogy: 'Like reviewing your strongest performance clips before competing',
    },
    iconName: 'star',
    isActive: true,
    sortOrder: 12,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'viz-adversity-response',
    name: 'Adversity Response Imagery',
    description: 'Practice your comeback before you need it. Like a vaccine for stress: your brain gets small, safe doses of things going wrong, so when it happens for real your response is already automatic.',
    category: ExerciseCategory.Visualization,
    difficulty: ExerciseDifficulty.Advanced,
    durationMinutes: 8,
    exerciseConfig: {
      type: 'visualization',
      config: {
        prompts: [
          'Close your eyes. Think of 3 things that could go wrong in competition.',
          'See the problem happening.',
          'Notice your first reaction. Don\'t fight it.',
          'Take your reset breath.',
          'Your positive self-talk response.',
          'Bring your focus back.',
          'Your successful recovery.',
          'Always end with you finishing strong anyway.',
        ],
        imageryType: 'adversity',
        duration: 480,
      },
    },
    benefits: [
      'Prepares for "what ifs"',
      'Builds resilience',
      'Reduces anxiety about failure',
      'Gives you a comeback plan',
    ],
    bestFor: ['competition prep', 'anxiety about what ifs', 'after setbacks', 'building resilience'],
    reflection: {
      questions: [
        { id: 'readiness', prompt: 'How ready do you feel for things going wrong?', kind: 'scale', scaleLowLabel: 'Not ready', scaleHighLabel: 'Bring it on' },
      ],
    },
    interaction: {
      kind: 'choiceDrill',
      // The "what ifs" elicitation, restored as a bounded pick phase in front
      // of the rounds. A resolved scenario pack swaps pickChoices for its
      // whatIfChips; chips are taps, never narrated, never free text.
      pickPrompt: 'Before we start: pick the three that feel most real for you. These are your what ifs.',
      pickChoices: [
        'A mistake everyone sees',
        'A call that goes against me',
        'Falling behind early',
        'Getting tired late',
        'Disappointing someone who supports me',
        'A stronger opponent than expected',
      ],
      pickCount: 3,
      rounds: [
        {
          prompt: 'Early in the competition, you make a mistake everyone sees. What is your next move?',
          choices: [
            {
              text: 'Take one slow breath and reset my focus',
              isTarget: true,
              feedback: 'That is the reset. One breath, then return to the next action.',
            },
            {
              text: 'Replay the mistake to figure out what went wrong',
              feedback: 'That keeps you stuck in the mistake. Reset first, review after the competition.',
            },
            {
              text: 'Go extra hard to make up for it right away',
              feedback: 'Forcing it usually stacks a second mistake on the first. Reset, then attack.',
            },
          ],
        },
        {
          prompt: 'An official or judge makes a decision you believe is wrong. Your frustration is rising. What do you do?',
          choices: [
            {
              text: 'Breathe, drop my shoulders, return to the next action',
              isTarget: true,
              feedback: 'Decisions can go against you. A fast reset protects the attention your next action needs.',
            },
            {
              text: 'Argue so they get the next call right',
              feedback: 'The decision is done. Arguing spends focus the next action needs.',
            },
            {
              text: 'Hold onto it and think about it for the rest of the competition',
              feedback: 'Carrying it splits your attention for the rest of the competition. Let the reset clear it.',
            },
          ],
        },
        {
          prompt: 'It is late in the competition and your body is tired. You still have one important action left. What is your response?',
          choices: [
            {
              text: 'Slow my breathing and lock into just the next ten seconds',
              isTarget: true,
              feedback: 'Tired minds wander. Shrinking the moment to ten seconds keeps you sharp.',
            },
            {
              text: 'Think about how tired I am and hope it ends fast',
              feedback: 'Attention on tiredness makes it louder. Aim your focus at the next task instead.',
            },
            {
              text: 'Start imagining everything that could go wrong',
              feedback: 'Rehearsing a bad ending steals the focus this moment needs.',
            },
          ],
        },
      ],
      // Sport scenario packs (spec: sport-scenario-packs-spec.md). Resolved on
      // device from User.sport via scenarioArchetypeForSport / the Swift
      // mirror. Each pack mirrors the base beats: R1 early visible mistake,
      // R2 uncontrollable or authority moment, R3 late fatigue with the
      // outcome on the line. Unmatched sports keep the base content above.
      scenarioPacks: [
        {
          archetype: 'invasion',
          label: 'Field & court team sports',
          // Base rounds already speak this language; the pack adds chips only.
          whatIfChips: [
            'A turnover everyone sees',
            'A bad call against us',
            'Getting subbed out early',
            'Falling behind fast',
            'My matchup winning early',
            'Disappointing someone who supports me',
          ],
        },
        {
          archetype: 'net_racket',
          label: 'Net & racket sports',
          whatIfChips: [
            'A double fault on a big point',
            'A bad line call',
            'Losing a long first set',
            'Wind or conditions wrecking my rhythm',
            'An opponent who returns everything',
            'Tired legs in a third set',
          ],
          rounds: [
            {
              prompt: 'You double fault on the very first point of the match. What is your next move?',
              choices: [
                {
                  text: 'Run my between-point routine: breathe, reset, next point',
                  isTarget: true,
                  feedback: 'That is the reset. The scoreboard cannot follow you into the next point unless you carry it there.',
                },
                {
                  text: 'Rush the next serve to erase the mistake fast',
                  feedback: 'Rushing stacks a second error on the first. The routine is what makes the next serve clean.',
                },
                {
                  text: 'Start changing my whole service motion',
                  feedback: 'Mid-match rebuilds break more than they fix. Trust the motion you trained. Reset the mind, not the mechanics.',
                },
              ],
            },
            {
              prompt: 'A line call goes against you on a point you clearly won. What do you do?',
              choices: [
                {
                  text: 'Breathe out long, walk my reset ritual, play the next point',
                  isTarget: true,
                  feedback: 'Calls even out over a career, but focus spent arguing never comes back. Next point.',
                },
                {
                  text: 'Argue until they overturn it',
                  feedback: 'The call is locked. Every second spent fighting it is a second the next point loses.',
                },
                {
                  text: 'Carry it and aim for the lines to prove a point',
                  feedback: 'Anger aims at small targets badly. Clear it first, then pick smart targets.',
                },
              ],
            },
            {
              prompt: 'Third set, legs heavy, and the rallies keep getting longer. What is your response?',
              choices: [
                {
                  text: 'Slow my breathing between points and play one point at a time',
                  isTarget: true,
                  feedback: 'Tired matches are won between points. Shrink the match to the next serve.',
                },
                {
                  text: 'Go for winners early to end points fast',
                  feedback: 'Forcing winners on tired legs feeds errors. Shorten your thinking, not the rally.',
                },
                {
                  text: 'Start thinking about how much is left',
                  feedback: 'Counting what is left makes legs heavier. The only rally that exists is this one.',
                },
              ],
            },
          ],
        },
        {
          archetype: 'race',
          label: 'Races against the clock',
          whatIfChips: [
            'A slow start',
            'Someone passing me mid-race',
            'Going out too fast and paying for it',
            'Rough conditions on race day',
            'An equipment problem',
            'The hurt arriving earlier than expected',
          ],
          rounds: [
            {
              prompt: 'Your start is bad and the field gets a jump on you. What is your next move?',
              choices: [
                {
                  text: 'Settle into my race plan and trust my pacing',
                  isTarget: true,
                  feedback: 'Races are lost chasing the first hundred meters. Your plan already accounts for a bad start. Run it.',
                },
                {
                  text: 'Sprint immediately to get it all back',
                  feedback: 'Panic surges borrow energy the last third owns. A steady reel-in beats instant payback.',
                },
                {
                  text: 'Decide the race is already gone',
                  feedback: 'One bad start decides nothing. The race is long, and your response is the race.',
                },
              ],
            },
            {
              prompt: 'Mid-race, a competitor surges past you looking strong. What do you do?',
              choices: [
                {
                  text: 'Relax my shoulders, hold my rhythm, race my plan',
                  isTarget: true,
                  feedback: 'You cannot control their race, only yours. Most surges come back to you.',
                },
                {
                  text: 'Chase the surge right now',
                  feedback: 'Covering every move burns the finish you trained for. Respond on your terms, not theirs.',
                },
                {
                  text: 'Let it convince me they are just better today',
                  feedback: 'A surge is information, not a verdict. Stay in your race and make them prove it lasts.',
                },
              ],
            },
            {
              prompt: 'The hurt arrives with a third of the race still left. What is your response?',
              choices: [
                {
                  text: 'Slow one breath, relax my form, break the race into small pieces',
                  isTarget: true,
                  feedback: 'Pain shrinks when the task shrinks. Next buoy, next lap, next lamppost.',
                },
                {
                  text: 'Focus on how much it hurts and hang on',
                  feedback: 'Attention feeds whatever it aims at. Aim it at form cues, not the burn.',
                },
                {
                  text: 'Bargain with myself about easing off',
                  feedback: 'Negotiating mid-race always ends in surrender. Decide once: form, breathe, next piece.',
                },
              ],
            },
          ],
        },
        {
          archetype: 'judged',
          label: 'Judged sports',
          whatIfChips: [
            'A fall on my first event',
            'A lower score than I earned',
            'A long wait before my turn',
            'Someone hitting a huge routine right before me',
            'A shaky warmup',
            'One routine left to make it count',
          ],
          rounds: [
            {
              prompt: 'You wobble hard on your first landing and everyone sees it. What is your next move?',
              choices: [
                {
                  text: 'Exhale, reset my posture, give the next element everything',
                  isTarget: true,
                  feedback: 'One deduction is a number. The rest of the routine is still yours to win.',
                },
                {
                  text: 'Replay the wobble while I keep performing',
                  feedback: 'A routine performed in the past tense falls apart. The next element deserves your whole mind.',
                },
                {
                  text: 'Oversell everything after it to make up the points',
                  feedback: 'Forcing difficulty you did not train invites the bigger mistake. Hit what you own.',
                },
              ],
            },
            {
              prompt: 'Your score comes up lower than you know the routine deserved. What do you do?',
              choices: [
                {
                  text: 'One long breath, let it go, prepare the next event',
                  isTarget: true,
                  feedback: 'Judges score the past. You still control everything about the next routine.',
                },
                {
                  text: 'Keep arguing with the score in my head all meet',
                  feedback: 'A silent argument with a scoreboard uses the exact focus your next event needs.',
                },
                {
                  text: 'Add difficulty I have not trained to force a bigger score',
                  feedback: 'Panic upgrades break routines. Earn it back with execution, not gambles.',
                },
              ],
            },
            {
              prompt: 'Last rotation. Your body is tired and you have one routine left. What is your response?',
              choices: [
                {
                  text: 'Slow my breathing and walk through my routine one element at a time',
                  isTarget: true,
                  feedback: 'Tired bodies follow clear minds. One element at a time is how finals are hit.',
                },
                {
                  text: 'Think about everything riding on this routine',
                  feedback: 'Stakes belong to the audience. You only need the first element, then the next.',
                },
                {
                  text: 'Rush through it to get it over with',
                  feedback: 'Rushing is how tired turns into broken. Your tempo is part of your training. Keep it.',
                },
              ],
            },
          ],
        },
        {
          archetype: 'stage',
          label: 'Stage & physique sports',
          whatIfChips: [
            'A worse callout than I expected',
            'Coming in flat on show day',
            'A long backstage wait',
            'Someone shredded standing next to me',
            'Cramping mid-pose',
            'A placing that feels wrong',
          ],
          rounds: [
            {
              prompt: 'First callouts, and you are not standing where you expected to be. What is your next move?',
              choices: [
                {
                  text: 'One slow breath, shoulders back, present my best look for the rest of prejudging',
                  isTarget: true,
                  feedback: 'Callouts can move. Judges keep looking, and composure on stage is part of the look.',
                },
                {
                  text: 'Let my posing deflate while I do the math on placings',
                  feedback: 'The math steals the round you are still in. Deflated posing confirms the callout instead of challenging it.',
                },
                {
                  text: 'Overtighten everything to force a better look',
                  feedback: 'Forcing it reads as strain, and strain photographs. Breathe, set, present what you built.',
                },
              ],
            },
            {
              prompt: 'The comparisons feel off and the scorecard is out of your hands. What do you do?',
              choices: [
                {
                  text: 'Exhale, let the scorecard go, own the next pose',
                  isTarget: true,
                  feedback: 'Judges score the package in front of them. The next pose is the only part still yours.',
                },
                {
                  text: 'Argue with the placing in my head for the rest of the show',
                  feedback: 'A silent argument backstage burns the focus finals still needs.',
                },
                {
                  text: 'Decide the judges just do not like my look',
                  feedback: 'One panel is one opinion on one day. Present like the verdict is still open, because it is.',
                },
              ],
            },
            {
              prompt: 'Finals, end of a long show day. You are depleted and your pump is fading. What is your response?',
              choices: [
                {
                  text: 'Slow my breathing and run my posing routine one pose at a time',
                  isTarget: true,
                  feedback: 'Depleted is normal at finals. One pose at a time is how a long prep finishes strong.',
                },
                {
                  text: 'Rush the routine to get off stage',
                  feedback: 'Rushing wastes the months that earned this stage. Your tempo is part of the presentation.',
                },
                {
                  text: 'Focus on how drained I feel',
                  feedback: 'Everyone up there is drained. Aim your attention at the pose, not the tank.',
                },
              ],
            },
          ],
        },
        {
          archetype: 'precision',
          label: 'Precision & target sports',
          whatIfChips: [
            'A blow-up start',
            'Wind picking up',
            'A bad bounce that costs me',
            "Someone else's pace throwing me off",
            'A miss I should never miss',
            'Protecting a lead late',
          ],
          rounds: [
            {
              prompt: 'Your first hole, end, or frame goes badly wrong. What is your next move?',
              choices: [
                {
                  text: 'Full reset routine: breathe, pick my target, commit',
                  isTarget: true,
                  feedback: 'That is the reset. In a long round, one bad start is noise if you refuse to repeat it.',
                },
                {
                  text: 'Start fixing my mechanics right now',
                  feedback: 'Mid-round surgery breaks more than it fixes. Trust the training. Reset the mind.',
                },
                {
                  text: 'Press to win it all back on the next shot',
                  feedback: 'Pressing turns one mistake into three. The next shot only needs to be your normal one.',
                },
              ],
            },
            {
              prompt: 'A gust of wind, a noise, a bad bounce takes a good shot and ruins it. What do you do?',
              choices: [
                {
                  text: 'Accept it, breathe, run my routine for the next shot',
                  isTarget: true,
                  feedback: 'You control the process, never the bounce. The routine is the only thing worth protecting.',
                },
                {
                  text: 'Get angry about the unfairness of it',
                  feedback: 'The wind does not care, and the next shot does not either. Spend focus where it scores.',
                },
                {
                  text: 'Start steering shots to avoid more bad luck',
                  feedback: 'Steering is fear wearing a strategy costume. Commit fully or step off and reset.',
                },
              ],
            },
            {
              prompt: 'You are in the lead late, and your hands notice. What is your response?',
              choices: [
                {
                  text: 'Slow everything down: long exhale, routine, one target',
                  isTarget: true,
                  feedback: 'Nerves late means it matters. The routine turns shaky hands back into trained hands.',
                },
                {
                  text: 'Think about what happens if I lose it from here',
                  feedback: 'Protecting a lead is still just one shot at a time. Play to your target, not the outcome.',
                },
                {
                  text: 'Speed up to get finished before the nerves win',
                  feedback: 'Fast finishes feed the nerves. Your tempo is your anchor. Keep it.',
                },
              ],
            },
          ],
        },
        {
          archetype: 'combat',
          label: 'Combat sports',
          whatIfChips: [
            'Giving up the first score',
            'A call that goes against me',
            'An opponent stronger than expected',
            'Getting caught early',
            'My gas tank emptying',
            'A hostile crowd',
          ],
          rounds: [
            {
              prompt: 'Your opponent scores first, fast. What is your next move?',
              choices: [
                {
                  text: 'Reset breath, back to my stance, back to my game plan',
                  isTarget: true,
                  feedback: 'The first score is information, not a verdict. Your plan is built for the whole match.',
                },
                {
                  text: 'Charge in wild to take it back right now',
                  feedback: 'Wild trades are how one score becomes three. Composed pressure beats panic pressure.',
                },
                {
                  text: 'Start worrying I am outmatched',
                  feedback: 'One exchange proves nothing. Fight the match in front of you, not the story in your head.',
                },
              ],
            },
            {
              prompt: "The official's call goes against you and it feels wrong. What do you do?",
              choices: [
                {
                  text: 'Exhale, drop my shoulders, fight the next exchange',
                  isTarget: true,
                  feedback: 'Calls are gone the moment they are made. The next exchange is still fully yours.',
                },
                {
                  text: 'Protest until it changes',
                  feedback: 'The call is locked and your opponent is not waiting. Reset first.',
                },
                {
                  text: 'Fight angry to make the official regret it',
                  feedback: 'Anger telegraphs. Cold focus scores. Clear it, then attack on purpose.',
                },
              ],
            },
            {
              prompt: 'Final round. Your gas tank is low and so is theirs. What is your response?',
              choices: [
                {
                  text: 'Slow one breath and win the next exchange only',
                  isTarget: true,
                  feedback: 'Deep water rewards the calmer mind. One exchange at a time is how tired matches are won.',
                },
                {
                  text: 'Think about how exhausted I am',
                  feedback: 'They are tired too. Whoever aims attention at the task instead of the tank takes the round.',
                },
                {
                  text: 'Coast and hope the scorecards are kind',
                  feedback: 'Hope is not a strategy. Pick the next exchange and go win it.',
                },
              ],
            },
          ],
        },
        {
          archetype: 'attempt',
          label: 'Attempt sports',
          whatIfChips: [
            'Missing my opener',
            'A no-count call from the judges',
            'A long wait between attempts',
            'Someone else hitting a huge attempt',
            'Feeling flat in warmups',
            'One attempt left to make it count',
          ],
          rounds: [
            {
              prompt: 'You miss your opening attempt. What is your next move?',
              choices: [
                {
                  text: 'Reset routine, trust the plan, treat attempt two like attempt one',
                  isTarget: true,
                  feedback: 'Openers get missed at every meet that matters. The plan has room for it. The reset is the plan.',
                },
                {
                  text: 'Change my whole approach before the next attempt',
                  feedback: 'Panic edits break trained patterns. One miss means execute, not rebuild.',
                },
                {
                  text: 'Start doing the math on bombing out',
                  feedback: 'Counting disasters recruits your focus against you. One attempt exists: the next one.',
                },
              ],
            },
            {
              prompt: 'The judges give you a no-count on an attempt you thought was good. What do you do?',
              choices: [
                {
                  text: 'One long breath, let it go, lock into the next attempt',
                  isTarget: true,
                  feedback: 'The call is final and the bar does not care. Your next attempt is untouched by it.',
                },
                {
                  text: 'Argue the call in my head for the rest of the meet',
                  feedback: 'A grudge occupies the exact focus your next attempt needs. Clear it.',
                },
                {
                  text: 'Rush my next attempt while I am fired up',
                  feedback: 'Heat without routine misses. Channel it through the same setup you always run.',
                },
              ],
            },
            {
              prompt: 'Final attempt of the day and everything rides on it. What is your response?',
              choices: [
                {
                  text: 'Slow my breath, run my setup routine, commit completely',
                  isTarget: true,
                  feedback: 'The routine is rehearsed courage. Same setup, same cues, full commitment.',
                },
                {
                  text: 'Think about everything that depends on this one',
                  feedback: 'Stakes add weight the bar does not have. Your only job is the same attempt you have made a thousand times.',
                },
                {
                  text: 'Hold a little back to be safe',
                  feedback: 'Half commitment is how final attempts get missed. Decide before you step in: all of it.',
                },
              ],
            },
          ],
        },
      ],
    },
    origin: 'Derived from Stress Inoculation Training (SIT) developed by the U.S. military for Special Operations forces. Navy SEALs don\'t just visualize success before a mission — they visualize everything that could go wrong, and then visualize themselves adapting and executing anyway. The concept mirrors immunology: just as a vaccine introduces a small controlled dose of a pathogen to build immunity, stress inoculation introduces controlled mental adversity to build psychological resilience.',
    neuroscience: 'Adversity visualization activates the anterior cingulate cortex (ACC) — the brain region responsible for error detection and adaptive response. By repeatedly simulating adversity and practicing recovery, the brain builds dedicated neural circuits for rapid adaptation. Research from the Journal of Applied Sport Psychology shows that athletes who practice adversity imagery show 40% faster cognitive recovery after setbacks during competition compared to those who only visualize success. The technique also reduces amygdala hijack — the phenomenon where acute stress bypasses rational thinking.',
    overview: {
      when: 'Pre-competition preparation (days or hours before)',
      focus: 'Things might go wrong — here\'s my plan to recover and dominate',
      timeScale: '8 minutes (3 adversity scenarios)',
      skill: 'Mental preparation and resilience inoculation',
      analogy: 'Like a vaccine for stress — small controlled doses build immunity to the real thing',
    },
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
          'Lock your eyes on the glowing dot on screen - that is your focal point. In competition you will use a spot on the wall or your equipment, but today the dot is your target.',
          'Focus ONLY on that point.',
          'Notice its color, its shape, its glow. Don\'t think about it, just watch it.',
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
    reflection: {
      questions: [
        { id: 'focus-slips', prompt: 'How many times did your focus slip away?', kind: 'choice', choices: ['0 to 1', '2 to 3', '4 to 6', '7 or more'] },
        { id: 'focus-level', prompt: 'How focused did you feel overall?', kind: 'scale', scaleLowLabel: 'Scattered', scaleHighLabel: 'Locked in' },
      ],
    },
    origin: 'Rooted in Zen Buddhist meditation (Zazen) practiced for over 2,500 years, and adapted by U.S. Army sniper training programs where single-point focus is the difference between mission success and failure. Modern sports psychologists at the U.S. Olympic Training Center use this as the foundational exercise for all attention training.',
    neuroscience: 'Single-point focus training strengthens the dorsolateral prefrontal cortex (DLPFC) — the brain\'s attention control center. Research from the University of Wisconsin shows that consistent focus practice increases cortical thickness in attention-related brain regions within 8 weeks. Each time you notice your mind wandering and redirect it back, you perform one "rep" of attention training — literally building the neural muscle that controls concentration during competition.',
    overview: {
      when: 'Daily practice, or as a warm-up before training',
      focus: 'Training your mind to stay locked on one thing without wandering',
      timeScale: '3 minutes',
      skill: 'Foundational attention control',
      analogy: 'Like strength training for your brain: every redirect makes the focus muscle stronger',
    },
    iconName: 'crosshair',
    isActive: true,
    sortOrder: 20,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'focus-cue-word',
    name: 'Anchor Word',
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
          'Pick a word that feels right: "Strong", "Flow", "Ready", "Trust", "Now", "Let go".',
          'Use your breathing to build the feeling you want.',
          'At the peak of that feeling, say your word (out loud or internally).',
          'Repeat 10-15 times to anchor the word to the state.',
          'In competition, say your anchor word to trigger the state.',
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
    reflection: {
      questions: [
        { id: 'anchor-strength', prompt: 'How strongly does your word pull you into the state?', kind: 'scale', scaleLowLabel: 'Not yet', scaleHighLabel: 'Instantly' },
      ],
    },
    origin: 'Used by Olympic gold medalist skier Lindsey Vonn, who would repeat "attack" before every run. Military close-quarters battle (CQB) teams use short anchor words to instantly coordinate state-shifts during operations. Performance psychologist Dr. Jim Afremow popularized the technique in "The Champion\'s Mind," documenting its use across NFL, NBA, and MLB programs.',
    neuroscience: 'Anchor words work through classical conditioning (Pavlovian association). By repeatedly pairing a word with a desired physiological and psychological state, the brain creates a conditioned shortcut. Over time, the anchor word alone triggers the associated neural cascade — releasing specific neurotransmitter cocktails (dopamine for confidence, norepinephrine for alertness, serotonin for calm) within milliseconds. Research shows that anchored words become more powerful with each repetition, eventually requiring no conscious effort to trigger the desired state.',
    overview: {
      when: 'Pre-competition, between attempts, or after mistakes',
      focus: 'Creating an instant mental shortcut to your ideal performance state',
      timeScale: '5 minutes to train, milliseconds to deploy',
      skill: 'On-demand state management',
      analogy: 'Like programming a keyboard shortcut — one key press triggers a complex sequence instantly',
    },
    iconName: 'key',
    isActive: true,
    sortOrder: 21,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'focus-body-scan',
    name: 'Body Scan Awareness',
    description: 'A head-to-toe check that helps you notice tight muscles and deliberately relax them.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'body_scan',
        duration: 300,
        progressionLevel: 1,
        instructions: BODY_SCAN_INSTRUCTIONS,
      },
    },
    benefits: [
      'Improves your ability to notice body changes',
      'Practices releasing unnecessary muscle tension',
      'Helps you notice changes in your breathing',
      'Prepares your body for the next activity',
    ],
    bestFor: ['pre-competition', 'before technical work', 'rest periods', 'sleep prep'],
    reflection: {
      questions: [
        { id: 'tension-spot', prompt: 'Where were you holding the most tension?', kind: 'choice', choices: ['Head and jaw', 'Neck and shoulders', 'Chest and stomach', 'Hips and legs'] },
        { id: 'calm-level', prompt: 'How much muscle tension do you notice now?', kind: 'scale', scaleLowLabel: 'A lot of tension', scaleHighLabel: 'Very little tension' },
      ],
    },
    origin: 'Adapted from the Body Scan meditation technique developed by Dr. Jon Kabat-Zinn at the University of Massachusetts Medical School as part of Mindfulness-Based Stress Reduction (MBSR). Used by the U.S. Marine Corps Mindfulness-Based Mind Fitness Training (MMFT) program, and by NFL teams including the Seattle Seahawks under coach Pete Carroll\'s mindfulness-based performance culture.',
    neuroscience: 'Body scanning activates the insular cortex — the brain region responsible for interoception (internal body awareness). Athletes with higher interoceptive accuracy demonstrate superior reaction times, better injury prevention, and more refined movement quality. Research published in Frontiers in Human Neuroscience shows that regular body scan practice increases grey matter density in the insula, leading to heightened proprioception — the ability to sense exactly where your body is in space, which is critical for athletic performance.',
    overview: {
      when: 'Pre-competition warm-up, before technical work, or before sleep',
      focus: 'Checking each area of your body for tight muscles and deliberately relaxing them',
      timeScale: '5 minutes (full head-to-toe scan)',
      skill: 'Body awareness and tension release',
      analogy: 'Like running a diagnostic scan on a race car before the race — identifying and fixing issues before they cost you',
    },
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
          'Notice the pressure thoughts you have before competition.',
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
    reflection: {
      questions: [
        { id: 'belief-level', prompt: 'How much do you believe the reframe right now?', kind: 'scale', scaleLowLabel: 'Not yet', scaleHighLabel: 'Fully' },
      ],
    },
    interaction: {
      kind: 'choiceDrill',
      rounds: [
        {
          prompt: 'The thought hits: "Everyone is watching. I cannot mess this up." Pick the reframe.',
          windowSeconds: 15,
          choices: [
            {
              text: '"Everyone is watching because this moment matters. I earned it."',
              isTarget: true,
              feedback: 'That is the privilege frame. Same moment, same stakes, new meaning.',
            },
            {
              text: '"Do not think about who is watching."',
              feedback: 'Trying to block the thought keeps your attention on it. Give the moment a useful meaning instead.',
            },
            {
              text: '"If I mess up, they will all see it."',
              feedback: 'That is the threat frame talking. Flip it: they are here because this matters.',
            },
          ],
        },
        {
          prompt: '"There is so much riding on this competition." Pick the useful meaning.',
          windowSeconds: 15,
          choices: [
            {
              text: '"Big stakes mean I get to do something that counts."',
              isTarget: true,
              feedback: 'Pressure can show that the moment matters to you. Your preparation gives you a useful response.',
            },
            {
              text: '"Pretend it is just another practice."',
              feedback: 'Pretending shrinks the moment. The reframe keeps its size and changes its meaning.',
            },
            {
              text: '"I wish this mattered less."',
              feedback: 'You trained for moments that matter. Wishing them smaller wastes them.',
            },
          ],
        },
        {
          prompt: '"I have one of the hardest responsibilities today." Pick the useful meaning.',
          windowSeconds: 15,
          choices: [
            {
              text: '"I got picked because they believe I can handle it."',
              isTarget: true,
              feedback: 'A hard responsibility can be evidence that you earned trust.',
            },
            {
              text: '"Why did it have to be me?"',
              feedback: 'That question spends energy on the draw, not the job. Flip it to trust.',
            },
            {
              text: '"I hope I do not let everyone down."',
              feedback: 'Hoping only to avoid failure makes the moment smaller. Choose the responsibility you can act on.',
            },
          ],
        },
      ],
    },
    origin: 'Coined by Billie Jean King, who famously said "Pressure is a privilege." Refined by Dr. Michael Gervais (Seattle Seahawks, Red Bull) and sports psychologist Dr. Jim Loehr, who used pressure reframing with 16 world #1-ranked tennis players. The U.S. Army\'s Comprehensive Soldier Fitness (CSF) program integrated this technique into pre-deployment resilience training for 1.1 million soldiers.',
    neuroscience: 'Cognitive reframing activates the ventrolateral prefrontal cortex, which modulates the amygdala\'s threat response. When you consciously reinterpret pressure as privilege, fMRI studies show a measurable reduction in amygdala activation and a corresponding increase in reward-center (nucleus accumbens) activity. Your body\'s physiological stress response — elevated heart rate, adrenaline release — remains identical, but the brain interprets it as excitement rather than threat, fundamentally changing performance outcomes.',
    overview: {
      when: 'When pressure feels overwhelming or before high-stakes moments',
      focus: 'Transforming the perception of pressure from threat to opportunity',
      timeScale: '5 minutes (journaling exercise)',
      skill: 'Reframing pressure as opportunity',
      analogy: 'Like flipping a switch — same electricity, different light',
    },
    iconName: 'gift',
    isActive: true,
    sortOrder: 30,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mindset-nerves-excitement',
    name: 'Nerves to Excitement',
    description: 'Notice how nerves change your body, decide what to tell yourself, and practice a response you can repeat before and during competition.',
    category: ExerciseCategory.Mindset,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'mindset',
      config: {
        type: 'reframe',
        prompts: [
          'Notice the first change in your body: a faster heartbeat, different breathing, tight muscles, or faster thoughts.',
          'Tell yourself, "My body is preparing me to perform."',
          'Take one slow breath.',
          'Picture yourself moving into the position your sport requires and completing the next action.',
          'Repeat your short phrase and focus on the next action you can control.',
        ],
        journalRequired: false,
      },
    },
    benefits: [
      'Notice the first way nerves change your body',
      'Choose a short phrase to tell yourself',
      'Practice responding under pressure',
      'Remember your phrase without help',
    ],
    bestFor: ['nerves before competition', 'a faster heartbeat', 'a nervous feeling in your stomach', 'faster thoughts'],
    reflection: {
      questions: [
        { id: 'belief-level', prompt: 'How useful did your phrase feel during the practice?', kind: 'scale', scaleLowLabel: 'Not useful yet', scaleHighLabel: 'Very useful' },
      ],
    },
    interaction: {
      kind: 'nervesRehearsal',
      nervesRehearsal: {
        contentVersion: 5,
        awarenessPrompt: 'As you get ready to perform, what changes first in your body?',
        awarenessChoices: [
          'My heart beats faster',
          'My breathing changes',
          'My muscles tighten',
          'My thoughts speed up',
        ],
        awarenessFeedback: 'This is the first sign that you are feeling nervous. Noticing it early gives you time to take one slow breath, picture what you will do, and choose what to tell yourself.',
        meaningPrompt: 'You notice that you feel nervous before the performance. What should you tell yourself so you stay focused on what you need to do?',
        meaningChoices: [
          {
            text: '"My faster heartbeat and breathing mean my body is getting ready to perform."',
            isTarget: true,
            feedback: 'This answer names the body changes and brings your attention back to the performance.',
          },
          {
            text: '"I should double-check the whole plan right now."',
            feedback: 'Checking every part of your plan at once gives you more to think about. Choose the next action you can control.',
          },
          {
            text: '"I need to know how ready everyone else looks."',
            feedback: 'Watching everyone else takes your attention away from your own preparation.',
          },
        ],
        cuePrompt: 'Choose a short sentence to repeat when your heart beats faster, your breathing changes, your muscles tighten, or your thoughts speed up.',
        cueChoices: ['My heart is beating faster. I am ready.', 'I feel nervous. See and move.', 'One breath. Set and perform.'],
        setAction: 'Picture yourself moving into your starting position and completing the first action of your performance.',
        rehearsalRounds: [
          { pressureCue: 'You notice that you feel nervous as you get ready.', support: 'visible', windowSeconds: 18 },
          { pressureCue: 'The performance is close and your heartbeat gets faster.', support: 'rebuild', windowSeconds: 16 },
          { pressureCue: 'You feel nervous again during the performance.', support: 'recall', windowSeconds: 14 },
        ],
        reflectionPrompt: 'You practiced noticing the first signs of nerves, taking one slow breath, picturing yourself performing, and repeating your phrase.',
        reflectionChoices: [
          'Notice how nerves first show up in my body.',
          'Take one slow breath and picture myself performing.',
          'Repeat my phrase and focus on what I will do next.',
        ],
        closePrompt: 'Each rehearsal helps you remember the response: notice the first body change, take one slow breath, picture yourself performing, and repeat your phrase. Practice it again so the steps become easier to recall when you feel nervous.',
      },
    },
    origin: 'Psychologist Alison Wood Brooks studied what happens when people label anxious feelings as excitement before difficult tasks. In her studies, people who said they were excited often performed better than people who tried to force themselves to feel calm.',
    neuroscience: 'Nerves and excitement can both include a faster heartbeat, quicker breathing, tight muscles, and increased alertness. The words you use do not erase those body changes. Calling them preparation can help you focus on the action you have practiced.',
    overview: {
      when: 'When your heartbeat, breathing, muscles, or thoughts change before or during competition',
      focus: 'Noticing nerves and choosing a short phrase that returns your attention to the next action',
      timeScale: '3 minutes',
      skill: 'Responding to nerves with one slow breath, sport-specific visualization, and clear self-talk',
      analogy: 'A faster heartbeat can mean your body is preparing for action. You practice what to do when you notice it.',
    },
    iconName: 'sparkles',
    isActive: true,
    sortOrder: 31,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'mindset-process-focus',
    name: 'Process Over Outcome',
    description: 'Put your focus on what you can control and let go of what you can\'t. The result follows the work.',
    category: ExerciseCategory.Mindset,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 5,
    exerciseConfig: {
      type: 'mindset',
      config: {
        type: 'process_focus',
        prompts: [
          'Name your process goals: the actions that give you the best chance to succeed.',
          'Create 1-3 word process phrases: "Tight core", "Quick feet", "Smooth release".',
          'When outcome thoughts arise, acknowledge and redirect:',
          '"I notice I\'m thinking about winning. That\'s not in my control right now."',
          '"What IS in my control is [process action]."',
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
    reflection: {
      questions: [
        { id: 'outcome-pull', prompt: 'What pulls your focus to results the most?', kind: 'choice', choices: ['The current result', 'What a coach thinks', 'What other athletes think', 'My own expectations'] },
      ],
    },
    interaction: {
      kind: 'choiceDrill',
      rounds: [
        {
          prompt: 'Sort it fast: "My effort on the next action."',
          windowSeconds: 8,
          choices: [
            {
              text: 'Mine to control',
              isTarget: true,
              feedback: 'Yours, always. Effort does not depend on the current result.',
            },
            {
              text: 'Out of my control',
              feedback: 'Effort is the one thing that is always yours. Own it.',
            },
          ],
        },
        {
          prompt: 'Sort it fast: "An evaluator\'s decision."',
          windowSeconds: 8,
          choices: [
            {
              text: 'Mine to control',
              feedback: 'That decision belongs to the evaluator. Put your focus on your response.',
            },
            {
              text: 'Out of my control',
              isTarget: true,
              feedback: 'Right. The decision is already made. Your response is still yours.',
            },
          ],
        },
        {
          prompt: 'Sort it fast: "My first action after a setback."',
          windowSeconds: 8,
          choices: [
            {
              text: 'Mine to control',
              isTarget: true,
              feedback: 'Yours. The next action is where your control begins.',
            },
            {
              text: 'Out of my control',
              feedback: 'Look again. Your next action belongs to you.',
            },
          ],
        },
        {
          prompt: 'Sort it fast: "The competition conditions."',
          windowSeconds: 8,
          choices: [
            {
              text: 'Mine to control',
              feedback: 'The conditions are already here. They are not yours to control.',
            },
            {
              text: 'Out of my control',
              isTarget: true,
              feedback: 'Right. Conditions are shared. Adjusting to them is the part you own.',
            },
          ],
        },
        {
          prompt: 'Sort it fast: "How I talk to myself after a mistake."',
          windowSeconds: 8,
          choices: [
            {
              text: 'Mine to control',
              isTarget: true,
              feedback: 'Yours. Your inner voice is one of the most trainable parts of the moment.',
            },
            {
              text: 'Out of my control',
              feedback: 'It feels automatic, but self-talk is trainable. That is why this drill exists.',
            },
          ],
        },
        {
          prompt: 'Sort it fast: "The final result."',
          windowSeconds: 8,
          choices: [
            {
              text: 'Mine to control',
              feedback: 'The result comes from many actions. Give your attention to the actions you can take.',
            },
            {
              text: 'Out of my control',
              isTarget: true,
              feedback: 'Right. Give the next action your full attention and let the result form from there.',
            },
          ],
        },
      ],
    },
    origin: 'Central to Nick Saban\'s "The Process" philosophy that produced 7 national championships at Alabama. Also a cornerstone of Phil Jackson\'s coaching with the Chicago Bulls and LA Lakers, and used by U.S. Special Operations to keep operators focused on execution rather than mission outcome during high-stakes operations.',
    neuroscience: 'Outcome focus activates the brain\'s default mode network (DMN) — the system responsible for self-referential thinking, rumination, and worry. Process focus deactivates the DMN and engages the task-positive network (TPN), which controls present-moment execution and motor coordination. Research from the University of Chicago on "choking under pressure" shows that athletes who focus on process actions reduce working memory interference by up to 60%, freeing cognitive resources for actual performance execution.',
    overview: {
      when: 'When you catch yourself worrying about results instead of executing',
      focus: 'Redirecting attention from outcomes you can\'t control to actions you can',
      timeScale: '5 minutes (journaling + phrase creation)',
      skill: 'Controllable focus and anti-choking',
      analogy: 'Like a pilot who focuses on the instruments, not the destination — trust the process and the outcome takes care of itself',
    },
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
    reflection: {
      questions: [
        { id: 'growth-belief', prompt: 'How much do you believe you can get better at this?', kind: 'scale', scaleLowLabel: 'Not sure', scaleHighLabel: 'No doubt' },
      ],
    },
    interaction: {
      kind: 'choiceDrill',
      rounds: [
        {
          prompt: 'The thought: "I am just not good at reading this situation." Pick the growth response.',
          windowSeconds: 15,
          choices: [
            {
              text: '"I am still learning how to read this situation."',
              isTarget: true,
              feedback: 'One word changes the whole sentence. Yet turns a wall into a staircase.',
            },
            {
              text: '"Some athletes just have that instinct."',
              feedback: 'Instinct is built from thousands of looks. They practiced theirs. You can too.',
            },
            {
              text: '"I will avoid situations where I have to read it."',
              feedback: 'Avoiding it locks the skill at its current level. Exposure is how it grows.',
            },
          ],
        },
        {
          prompt: '"She is just naturally better than me." Pick the growth response.',
          windowSeconds: 15,
          choices: [
            {
              text: '"She is ahead of me today. Training closes gaps."',
              isTarget: true,
              feedback: 'Today is a snapshot, not a ceiling. Gaps close on purpose.',
            },
            {
              text: '"Some people are born with it."',
              feedback: 'Every highlight you envy was built one practice at a time.',
            },
            {
              text: '"There is no point competing with that."',
              feedback: 'Chasing someone better is the fastest way to improve. That is the point.',
            },
          ],
        },
        {
          prompt: '"I keep failing at this move." Pick the growth response.',
          windowSeconds: 15,
          choices: [
            {
              text: '"Every miss shows me exactly what to fix next."',
              isTarget: true,
              feedback: 'Misses are data. Athletes who read the data improve twice as fast.',
            },
            {
              text: '"I am clearly not built for this move."',
              feedback: 'Struggle is what learning feels like from the inside. It is not a verdict.',
            },
            {
              text: '"I will stop trying it when I compete."',
              feedback: 'Hiding the skill keeps it unfamiliar. Practice gives you a place to learn from the misses.',
            },
          ],
        },
      ],
    },
    origin: 'Based on Dr. Carol Dweck\'s landmark research at Stanford University, published in "Mindset: The New Psychology of Success" (2006). The growth mindset framework has been adopted by Microsoft\'s corporate culture (CEO Satya Nadella credits it as transformational), the U.S. Naval Academy\'s leadership development program, and elite sports organizations including the Golden State Warriors and Manchester United.',
    neuroscience: 'Dweck\'s research showed that people with growth mindsets have measurably different brain activity when encountering errors — their anterior cingulate cortex (ACC) shows increased activation, indicating the brain is processing errors as learning opportunities rather than threats. Over time, growth mindset practice increases neuroplasticity itself — the brain\'s ability to form new connections and rewire existing ones. Studies show that simply believing intelligence and ability are malleable (not fixed) increases dopamine release during challenging tasks, creating a self-reinforcing cycle of effort and reward.',
    overview: {
      when: 'After setbacks, when facing self-limiting beliefs, or daily practice',
      focus: 'Rewiring the inner voice from "I can\'t" to "I\'m learning"',
      timeScale: '5 minutes (daily journal + reframe)',
      skill: 'Self-talk transformation and resilience',
      analogy: 'Like updating the operating system on your brain — same hardware, better software',
    },
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
    description: 'Confidence built on facts, not feelings. Collect proof that you are prepared and getting better.',
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
          '"What would someone who supports my training say I am doing well?"',
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
    reflection: {
      questions: [
        { id: 'confidence-level', prompt: 'How solid does your confidence feel right now?', kind: 'scale', scaleLowLabel: 'Borrowed', scaleHighLabel: 'Earned' },
      ],
    },
    interaction: {
      kind: 'guidedDwell',
      pickPrompt: 'Bank three pieces of real evidence from your training and competition. Use specific facts.',
      pickChoices: [
        'A skill that used to be hard and is now easy',
        'A moment I performed under pressure',
        'Work I put in that nobody saw',
        'A weakness I have already improved',
        'A time I was trusted in an important moment',
        'A goal I set and actually hit',
      ],
      pickCount: 3,
      dwellSeconds: 20,
      dwellPrompt: 'Get specific. Picture the exact day, the exact moment this happened. That is evidence, not hype.',
      closePrompt: 'Confidence built on evidence does not crack under pressure. You just banked yours.',
    },
    origin: 'Developed by sports psychologist Dr. Jim Loehr at the Human Performance Institute, originally for world-class tennis players. Used by Olympic gold medalists, Navy SEAL candidates during Hell Week (instructors encourage maintaining a "proof journal" of small wins), and adopted by the New England Patriots\' mental performance staff.',
    neuroscience: 'Writing activates the reticular activating system (RAS) — the brain\'s relevance filter. When you physically write evidence of your capability, the RAS begins prioritizing similar positive data in future experiences, creating an upward spiral of confidence. Journaling also engages the left prefrontal cortex, which processes factual information, building confidence on logical evidence rather than emotional volatility. Studies show that athletes with evidence journals demonstrate 25% higher self-efficacy scores than those relying on verbal affirmations alone.',
    overview: {
      when: 'Daily after training, or before competition to review',
      focus: 'Building confidence on hard evidence, not hope',
      timeScale: '3 minutes daily',
      skill: 'Evidence-based self-belief',
      analogy: 'Like building a legal case for yourself — the evidence is undeniable',
    },
    iconName: 'book',
    isActive: true,
    sortOrder: 40,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'confidence-power-pose',
    name: 'Power Posing',
    description: 'Use physical posture to influence mental state. Standing big and open sends strength signals to your brain and turns down stress.',
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
    reflection: {
      questions: [
        { id: 'presence-level', prompt: 'How big do you feel right now?', kind: 'scale', scaleLowLabel: 'Small', scaleHighLabel: 'Ten feet tall' },
      ],
    },
    origin: 'Based on research by Harvard social psychologist Amy Cuddy, whose TED Talk on body language became the second most-viewed TED Talk in history. While the testosterone/cortisol claims from the original study were debated, subsequent research (published in Psychological Science, 2017) confirmed that expansive postures do increase subjective feelings of power and risk tolerance. Used by Wall Street traders, trial lawyers, and combat athletes before high-stakes performances.',
    neuroscience: 'Expansive postures activate the brain\'s postural feedback loop — the body sends "dominance" signals to the brain via proprioceptive neurons, which the brain interprets as genuine confidence. This is an example of embodied cognition: the body influences the mind just as the mind influences the body. While the hormonal claims remain debated, replicated studies confirm that power posing increases subjective feelings of confidence, pain tolerance, and willingness to take action — all critical for competitive performance.',
    overview: {
      when: 'In a private space before competing or during your daily routine',
      focus: 'Using body posture to directly influence mental state',
      timeScale: '2 minutes (one sustained pose)',
      skill: 'Embodied confidence activation',
      analogy: 'Like plugging your phone in when the battery is low — a quick charge that gets you through',
    },
    iconName: 'award',
    isActive: true,
    sortOrder: 41,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'confidence-affirmations',
    name: 'Sport-Specific Affirmations',
    description: 'Statements about you that are actually true. Not fake positivity: belief backed by the work you have done.',
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
    reflection: {
      questions: [
        { id: 'confidence-level', prompt: 'How solid does your confidence feel right now?', kind: 'scale', scaleLowLabel: 'Borrowed', scaleHighLabel: 'Earned' },
      ],
    },
    interaction: {
      kind: 'guidedDwell',
      pickPrompt: 'Build your statements. Pick the three that are true when you perform at your best.',
      pickChoices: [
        'I begin with purpose and clear attention',
        'I reset faster than anyone out there',
        'I have done the work. I am prepared',
        'Pressure sharpens me',
        'My preparation shows up when it counts',
        'I trust my training and let it fly',
      ],
      pickCount: 3,
      dwellSeconds: 15,
      dwellPrompt: 'Say it in your head like you mean it, three times, slow. Feel where it lands in your body.',
      closePrompt: 'Those statements are yours. Use them before competition or whenever your attention needs a clear direction.',
    },
    origin: 'Muhammad Ali was the most famous practitioner — "I am the greatest" was not arrogance, it was systematic self-programming. Modern sports psychology has refined this into evidence-based affirmations (grounded in real data, not generic positivity). Used by U.S. Special Operations candidates during selection, NFL pre-game routines, and by performance coach Tony Robbins with Fortune 500 CEOs and professional athletes.',
    neuroscience: 'Repetitive self-statements activate the brain\'s self-referential processing network, centered in the medial prefrontal cortex. When affirmations are specific, present-tense, and evidence-based, they bypass the brain\'s natural skepticism filter and gradually rewrite the neural narrative around self-identity. fMRI research from the University of Pennsylvania shows that self-affirmation activates the ventromedial prefrontal cortex and posterior cingulate cortex — the same regions associated with self-valuation and future-oriented thinking — effectively programming the brain to expect success.',
    overview: {
      when: 'Morning routine and immediately before competition',
      focus: 'Programming your brain with evidence-based belief statements',
      timeScale: '3 minutes (5-10 repetitions with conviction)',
      skill: 'Identity-level self-programming',
      analogy: 'Like writing code for your brain — specific, deliberate instructions that the system executes automatically',
    },
    iconName: 'mic',
    isActive: true,
    sortOrder: 42,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'confidence-inventory',
    name: 'Confidence Inventory',
    description: 'Take stock of every reason you have to believe in yourself. Build your case, piece by piece.',
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
    reflection: {
      questions: [
        { id: 'confidence-level', prompt: 'How solid does your confidence feel right now?', kind: 'scale', scaleLowLabel: 'Borrowed', scaleHighLabel: 'Earned' },
      ],
    },
    interaction: {
      kind: 'guidedDwell',
      pickPrompt: 'Take stock. Pick the three strengths you bring to every competition.',
      pickChoices: [
        'My conditioning',
        'My technique',
        'My awareness',
        'My composure',
        'My work ethic',
        'My leadership',
        'My speed and quickness',
        'My toughness',
      ],
      pickCount: 3,
      dwellSeconds: 20,
      dwellPrompt: 'Recall one specific moment this strength showed up in competition or training. Hold that picture.',
      closePrompt: 'That is your inventory. These strengths came from your work, and you can call on them again.',
    },
    origin: 'Used by Dr. Jim Loehr and the Human Performance Institute for preparing athletes for Grand Slam tennis, Olympic finals, and NFL playoffs. The systematic approach was inspired by military pre-mission checklists — just as Special Operations teams verify every piece of equipment before a mission, athletes verify every source of readiness before competition.',
    neuroscience: 'The Confidence Inventory leverages the brain\'s confirmation bias constructively. By systematically reviewing evidence across multiple domains (physical, technical, mental, experiential, social), the brain creates a comprehensive "proof network" that makes confident beliefs the path of least resistance. This multi-domain approach activates distributed neural networks rather than relying on a single source, creating a more robust and resilient confidence structure that is resistant to single-point failures (e.g., one bad practice doesn\'t collapse your entire belief system).',
    overview: {
      when: 'Competition week, or whenever self-doubt creeps in',
      focus: 'Systematically building an ironclad case for your readiness',
      timeScale: '10 minutes (comprehensive review across 5 domains)',
      skill: 'Multi-domain confidence construction',
      analogy: 'Like a pre-flight checklist \u2014 systematically verifying every system before takeoff',
    },
    iconName: 'clipboard',
    isActive: true,
    sortOrder: 43,
    createdAt: now,
    updatedAt: now,
  },

  // -------------------------------------------------------------------------
  // RESET (FOCUS - INTERRUPTION AND TASK RETURN)
  // -------------------------------------------------------------------------
  {
    id: 'focus-3-second-reset',
    name: 'Reset',
    description: 'Match left and right arrows before and after brief interruptions. Reset compares task response time and accuracy across otherwise matched trials.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'reset',
        duration: 180,
        progressionLevel: 1,
        instructions: ['Match each arrow direction; after an interruption and fixed reset interval, return to the same arrow task'],
      },
    },
    benefits: [
      'Practice returning to the same rule after an interruption',
      'Compare reference and post-interruption task responses',
      'Keep response time and accuracy visible as separate observations',
      'Repeat a consistent reset-and-return routine',
    ],
    bestFor: ['interruption practice', 'task return', 'matched-condition reassessment', 'reset routine rehearsal'],
    reflection: {
      questions: [
        { id: 'effort-level', prompt: 'How hard did that feel?', kind: 'scale', scaleLowLabel: 'Easy', scaleHighLabel: 'Maxed out' },
      ],
    },
    origin: 'Evidence-informed by experimental work on post-error behavior, attentional reorientation, and task switching. The PulseCheck task itself has not yet been externally validated, and transfer to sport behavior must be tested directly.',
    neuroscience: 'The task requires the athlete to reorient to the same simple rule after an interruption. It observes task-specific response-time and accuracy differences; it does not directly measure emotional recovery, resilience, readiness, or a particular brain process.',
    overview: {
      when: 'Regular training sessions, pre-competition preparation',
      focus: 'Returning to the same left-or-right rule after a brief interruption',
      timeScale: '2-4 minutes (matched reference and post-interruption trials)',
      skill: 'Attentional reorientation and task return',
      analogy: 'The same arrow task appears before and after an interruption so the two conditions can be compared.',
    },
    iconName: 'zap',
    isActive: true,
    sortOrder: 23,
    ...taxonomyFields('focus-3-second-reset'),
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'focus-noise-gate',
    name: 'Noise Gate',
    description: 'Find the called number while a flashing marker or crowd sound tries to pull your attention away.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'distraction',
        duration: 180,
        progressionLevel: 2,
        instructions: ['The number at the top stays visible. Find and tap that same number in the field. Ignore anything that flashes and any crowd sound.'],
      },
    },
    benefits: [
      'Practices visual search with a clear goal',
      'Adds audio and visual distractions without changing the task',
      'Tracks how accuracy and response time change when distractions appear',
    ],
    bestFor: ['crowd noise', 'visual distraction', 'goal-directed focus', 'visual search'],
    reflection: {
      questions: [
        { id: 'effort-level', prompt: 'How hard did that feel?', kind: 'scale', scaleLowLabel: 'Easy', scaleHighLabel: 'Maxed out' },
      ],
    },
    origin: 'Evidence-informed by Attentional Control Theory and visual-search inhibition training. The mobile task is a controlled attention drill, not proof of sport transfer.',
    neuroscience: 'The same visual-search task is performed with and without an attention-grabbing wrong cue. PulseCheck compares the conditions to estimate task-specific distraction effects. Reliability and sport transfer require product validation.',
    overview: {
      when: 'Before noisy competition environments or when athletes are losing the right target to clutter',
      focus: 'Finding the exact match while irrelevant cues compete for attention',
      timeScale: '2-4 minutes',
      skill: 'Goal-directed visual search under distraction',
      analogy: 'Like finding the teammate your coach called while the sideline is moving and the crowd is loud',
    },
    iconName: 'radio',
    isActive: true,
    sortOrder: 24,
    ...taxonomyFields('focus-noise-gate'),
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'decision-brake-point',
    name: 'Brake Point',
    description: 'Match each arrow with left or right. On some trials, a delayed red STOP signal means withhold the response.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 150,
        progressionLevel: 2,
        instructions: ['Match left and right arrows. If a delayed STOP signal appears, do not tap.'],
      },
    },
    benefits: [
      'Practices withholding a prepared response after a delayed stop signal',
      'Reports go accuracy and stopping behavior separately',
      'Provides a provisional stopping-time estimate only when quality checks pass',
    ],
    bestFor: ['delayed-stop practice', 'response-inhibition reassessment', 'go accuracy', 'withholding behavior'],
    reflection: {
      questions: [
        { id: 'effort-level', prompt: 'How hard did that feel?', kind: 'scale', scaleLowLabel: 'Easy', scaleHighLabel: 'Maxed out' },
      ],
    },
    origin: 'Evidence-informed by the stop-signal paradigm and independent race-model research. PulseCheck task reliability and sport transfer have not yet been established.',
    neuroscience: 'The task creates a dominant left-or-right response and occasionally introduces a delayed signal to withhold it. The resulting behavior can support a provisional task-specific stopping estimate when design assumptions pass; it does not establish trait impulsivity or sport inhibition.',
    overview: {
      when: 'A focused response-inhibition practice or reassessment session',
      focus: 'Withholding an initiated arrow response after a delayed stop signal',
      timeScale: 'About 3-5 minutes including practice',
      skill: 'Task-specific response inhibition',
      analogy: 'Most arrows require a response; a late STOP signal changes the correct action to no response.',
    },
    iconName: 'octagon-x',
    isActive: true,
    sortOrder: 25,
    ...taxonomyFields('decision-brake-point'),
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'decision-signal-window',
    name: 'Signal Window',
    description: 'Read a field of nine arrows and choose whether most point left or right. Evidence strength changes across balanced trials.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 165,
        progressionLevel: 2,
        instructions: ['Choose left or right based on the direction shown by most arrows.'],
      },
    },
    benefits: [
      'Practices a two-choice visual discrimination',
      'Compares accuracy across declared evidence levels',
      'Keeps correct-response time separate from accuracy',
    ],
    bestFor: ['visual discrimination', 'evidence-strength practice', 'decision accuracy', 'correct-response timing'],
    reflection: {
      questions: [
        { id: 'effort-level', prompt: 'How hard did that feel?', kind: 'scale', scaleLowLabel: 'Easy', scaleHighLabel: 'Maxed out' },
      ],
    },
    origin: 'Evidence-informed by psychophysical research on how sensory evidence strength relates to decision accuracy and response time. The PulseCheck task and sport transfer remain unvalidated.',
    neuroscience: 'The arrow field varies how much visual evidence supports one direction. The task observes accuracy and response time from field onset; it does not establish game-day decision quality or tactical intelligence.',
    overview: {
      when: 'A focused visual-discrimination practice or reassessment session',
      focus: 'Choosing the majority direction as visual evidence changes',
      timeScale: '2-3 minutes',
      skill: 'Task-specific perceptual discrimination',
      analogy: 'Count the direction supported by most arrows, then choose left or right.',
    },
    iconName: 'scan-eye',
    isActive: true,
    sortOrder: 26,
    ...taxonomyFields('decision-signal-window'),
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'decision-sequence-shift',
    name: 'Sequence Shift',
    description: 'Use one pair of keys to classify letters and numbers. A cue tells you which rule applies, and scored trials balance rule repeats and switches.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Advanced,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'distraction',
        duration: 180,
        progressionLevel: 3,
        instructions: ['Use the letter or number rule shown. Left means vowel or odd; right means consonant or even.'],
      },
    },
    benefits: [
      'Practices switching between two cued classification rules',
      'Compares repeat and switch response time and accuracy',
      'Separates eligible old-rule responses from other errors',
    ],
    bestFor: ['cued rule switching', 'repeat-switch comparison', 'classification practice', 'task-switching reassessment'],
    reflection: {
      questions: [
        { id: 'effort-level', prompt: 'How hard did that feel?', kind: 'scale', scaleLowLabel: 'Easy', scaleHighLabel: 'Maxed out' },
      ],
    },
    origin: 'Evidence-informed by classic cued task-switching research. This is not a working-memory-capacity test, and broad cognitive-flexibility or sport-transfer claims require validation.',
    neuroscience: 'The cue selects either a letter or number classification while response keys stay fixed. Repeat-versus-switch differences describe this task and do not establish general flexibility, readiness, or sport IQ.',
    overview: {
      when: 'A focused cued task-switching practice or reassessment session',
      focus: 'Applying a letter or number rule after a fixed cue interval',
      timeScale: '3 minutes',
      skill: 'Task-specific rule switching',
      analogy: 'The keys stay the same while the cue changes which part of the pair matters.',
    },
    iconName: 'shuffle',
    isActive: true,
    sortOrder: 27,
    ...taxonomyFields('decision-sequence-shift'),
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'focus-endurance-lock',
    name: 'Endurance Lock',
    description: 'Wait for the same visual signal and tap once when it appears. The rule and display stay constant while waiting times vary across six blocks.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Advanced,
    durationMinutes: 6,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 360,
        progressionLevel: 4,
        instructions: ['Wait for the center visual signal, then tap once. Taps before the signal are recorded separately.'],
      },
    },
    benefits: [
      'Observes response time across one constant visual task',
      'Reports variability, lapses, early taps, and timeouts separately',
      'Describes within-session change without assigning a cause',
    ],
    bestFor: ['sustained-attention practice', 'visual response timing', 'within-session variability', 'longer reassessment sessions'],
    reflection: {
      questions: [
        { id: 'effort-level', prompt: 'How hard did that feel?', kind: 'scale', scaleLowLabel: 'Easy', scaleHighLabel: 'Maxed out' },
      ],
    },
    origin: 'Evidence-informed by psychomotor-vigilance and sustained-attention research. This short mobile task cannot identify fatigue, sleep loss, motivation, or sport transfer.',
    neuroscience: 'The task records visual response time over time while the rule and display remain constant. A change can have many causes, so the result is limited to sustained-attention performance during this session.',
    overview: {
      when: 'Periodic sustained-attention practice or reassessment sessions',
      focus: 'Response-time change, variability, lapses, early taps, and timeouts',
      timeScale: '5-8 minutes',
      skill: 'Task-specific sustained attention',
      analogy: 'The visual task stays the same so performance can be described across the session.',
    },
    iconName: 'timer-reset',
    isActive: true,
    sortOrder: 28,
    ...taxonomyFields('focus-endurance-lock'),
    createdAt: now,
    updatedAt: now,
  },
];

/**
 * The sport-content contract is applied at the curriculum boundary so a new
 * seeded skill cannot silently ship without all supported sport archetypes.
 */
export const SEEDED_EXERCISES: MentalExercise[] = BASE_SEEDED_EXERCISES.map((exercise) => ({
  ...exercise,
  sportContentPacks: buildSportContentPacks(exercise),
}));
