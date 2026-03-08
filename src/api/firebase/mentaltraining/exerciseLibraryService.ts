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
import { getSimSpec, getSimSpecByLegacyExerciseId } from './taxonomy';

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

const SEEDED_EXERCISES: MentalExercise[] = [
  // -------------------------------------------------------------------------
  // BREATHING EXERCISES
  // -------------------------------------------------------------------------
  {
    id: 'breathing-box',
    name: 'Box Breathing',
    description: 'A 4-phase breathing pattern used by Navy SEALs and elite athletes to calm the nervous system and sharpen focus. Equal inhale, hold, exhale, and hold phases create a rhythmic cycle that overrides the body\'s fight-or-flight response within minutes.',
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
    origin: 'Developed and used by U.S. Navy SEALs during BUD/S training and combat operations. Former Navy SEAL Commander Mark Divine popularized the technique, crediting it as a core tool for maintaining composure under extreme pressure. Now standard practice across Special Operations, FBI Hostage Rescue Teams, and elite athletic programs.',
    neuroscience: 'The equal-phase breathing pattern stimulates the vagus nerve, directly activating the parasympathetic nervous system and lowering cortisol levels within 90 seconds. The breath-hold phases increase CO₂ tolerance, which reduces the brain\'s panic threshold. fMRI studies show Box Breathing decreases amygdala reactivity (the brain\'s fear center) while increasing prefrontal cortex activity — the region responsible for decision-making under pressure.',
    overview: {
      when: 'Pre-competition, between sets, or during acute stress',
      focus: 'Calming the nervous system and sharpening mental clarity',
      timeScale: '4 minutes (6 cycles)',
      skill: 'Autonomic nervous system regulation',
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
    name: 'Physiological Sigh',
    description: 'The fastest known way to reduce stress in real-time. A double inhale followed by a long exhale mimics the body\'s natural calming reflex — the same involuntary pattern your body uses during deep sleep to reset blood oxygen levels.',
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
    description: 'A powerful relaxation technique with a 4-7-8 pattern. The extended exhale and prolonged hold phases activate the body\'s deepest relaxation response — often called a "natural tranquilizer for the nervous system."',
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
    origin: 'Developed by Dr. Andrew Weil, integrative medicine pioneer at the University of Arizona, based on pranayama — the ancient yogic discipline of breath regulation practiced for over 3,000 years. Used by military personnel for sleep optimization and by professional athletes for post-competition wind-down and sleep quality improvement.',
    neuroscience: 'The 4-7-8 ratio creates an exhale-dominant breathing cycle that shifts the autonomic nervous system from sympathetic (fight-or-flight) to parasympathetic (rest-and-digest). The 7-second hold increases CO₂ in the bloodstream, which paradoxically relaxes smooth muscle tissue throughout the body. Research shows this pattern reduces norepinephrine levels (the brain\'s alertness chemical) within 4 cycles, making it one of the most effective non-pharmaceutical sleep aids available.',
    overview: {
      when: 'Evening wind-down, post-competition, or when sleep is critical',
      focus: 'Deep relaxation and sleep preparation',
      timeScale: '5 minutes (4 cycles)',
      skill: 'Parasympathetic activation for recovery',
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
    description: 'Short, powerful inhale-dominant breaths designed to increase energy, arousal, and readiness before competition. The opposite of calming breathwork — this activates your system when you need to come alive.',
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
    origin: 'Derived from Wim Hof Method breathing and Tummo (inner fire) meditation practiced by Tibetan monks. Wim Hof — known as "The Iceman" — used this technique to climb Mount Everest in shorts and run a marathon in the Arctic barefoot. Adapted by military special operations units and combat athletes for pre-engagement arousal control.',
    neuroscience: 'Inhale-dominant breathing deliberately activates the sympathetic nervous system, increasing adrenaline and norepinephrine release. The short, forceful exhales prevent over-oxygenation while driving up heart rate and core body temperature. Research published in PNAS (2014) demonstrated that practitioners of this technique could voluntarily influence their innate immune response and adrenaline levels — something previously thought impossible by modern medicine.',
    overview: {
      when: 'Pre-competition when energy is low, before heavy lifts, or when you feel flat',
      focus: 'Increasing energy, arousal, and competitive fire',
      timeScale: '2 minutes (15 cycles)',
      skill: 'Voluntary arousal activation',
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
    description: 'Post-competition or post-workout breathing designed to accelerate your body\'s return to baseline. Systematically clears residual adrenaline and cortisol so your recovery window begins immediately.',
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
    description: 'A detailed mental rehearsal of an upcoming competition from arrival to completion. You experience the entire event before it happens — the venue, the energy, the crowd, and your flawless execution — building familiarity that eliminates surprise on game day.',
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
    description: 'Mental rehearsal of a specific skill performed perfectly. Each mental rep reinforces correct neural pathways, overwrites bad muscle memory, and builds the kind of deep confidence that comes from repetition — even when your body is resting.',
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
    origin: 'Core technique in Soviet-era sports psychology programs that dominated Olympic competition for decades. Soviet researchers discovered that athletes who spent 75% of their time on mental rehearsal and 25% on physical training outperformed those who trained only physically. Now a foundational practice for NFL quarterbacks (Tom Brady, Peyton Manning), NBA shooters, and Olympic gymnasts worldwide.',
    neuroscience: 'Mental repetition strengthens the same synaptic connections as physical repetition through a process called Hebbian learning ("neurons that fire together, wire together"). A landmark study in the Journal of Neurophysiology found that mental practice alone produced a 22% increase in muscle strength, compared to 30% for physical practice — meaning mental reps are roughly 73% as effective as real ones. For injured athletes, mental rehearsal prevents neural pathway degradation and can maintain up to 50% of skill proficiency during recovery.',
    overview: {
      when: 'Before training, after mistakes, or during injury recovery',
      focus: 'Reinforcing perfect technique through mental repetition',
      timeScale: '5 minutes (5-10 mental reps)',
      skill: 'Neural pathway reinforcement',
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
    description: 'A mental compilation of your greatest performances and achievements. Instead of hoping you\'ll perform well, you replay concrete evidence that you already have — building unshakable confidence grounded in fact, not wishful thinking.',
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
    origin: 'Used extensively by sports psychologists working with U.S. Olympic teams and Cirque du Soleil performers. Dr. Michael Gervais — performance psychologist for the Seattle Seahawks and Red Bull Stratos (Felix Baumgartner\'s space jump) — credits the Highlight Reel as one of the most reliable confidence-building tools in elite sport. LeBron James and Kobe Bryant were known to mentally replay their best moments before high-stakes games.',
    neuroscience: 'Reliving peak performances triggers the release of dopamine and serotonin — the same neurochemicals produced during the original experience. This creates a positive feedback loop: the brain associates your identity with success rather than anxiety. Research from the University of Chicago shows that vivid recall of past successes activates the ventromedial prefrontal cortex, which is directly responsible for self-concept and belief formation. Over time, this literally rewires your brain\'s default narrative about who you are as a competitor.',
    overview: {
      when: 'Before competition, after setbacks, or when confidence is low',
      focus: 'Replaying proof of your capability to build unshakable belief',
      timeScale: '5 minutes (5 peak moments)',
      skill: 'Evidence-based confidence building',
      analogy: 'Like watching your own game-winning highlight reel before stepping onto the field',
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
    description: 'Mental rehearsal of how you\'ll respond when things go wrong. Like a vaccine for stress — you give your brain controlled doses of adversity in a safe environment so when real adversity hits on game day, the neural pathways are already built and your response is automatic.',
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
    origin: 'Rooted in Zen Buddhist meditation (Zazen) practiced for over 2,500 years, and adapted by U.S. Army sniper training programs where single-point focus is the difference between mission success and failure. Modern sports psychologists at the U.S. Olympic Training Center use this as the foundational exercise for all attention training.',
    neuroscience: 'Single-point focus training strengthens the dorsolateral prefrontal cortex (DLPFC) — the brain\'s attention control center. Research from the University of Wisconsin shows that consistent focus practice increases cortical thickness in attention-related brain regions within 8 weeks. Each time you notice your mind wandering and redirect it back, you perform one "rep" of attention training — literally building the neural muscle that controls concentration during competition.',
    overview: {
      when: 'Daily practice, or as a warm-up before training',
      focus: 'Training your mind to stay locked on one thing without wandering',
      timeScale: '3 minutes',
      skill: 'Foundational attention control',
      analogy: 'Like doing bicep curls for your brain — each redirect is one rep of focus',
    },
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
    origin: 'Used by Olympic gold medalist skier Lindsey Vonn, who would repeat "attack" before every run. Military close-quarters battle (CQB) teams use cue words to instantly coordinate state-shifts during operations. Performance psychologist Dr. Jim Afremow popularized the technique in "The Champion\'s Mind," documenting its use across NFL, NBA, and MLB programs.',
    neuroscience: 'Cue words work through classical conditioning (Pavlovian association). By repeatedly pairing a word with a desired physiological and psychological state, the brain creates a conditioned shortcut. Over time, the cue word alone triggers the associated neural cascade — releasing specific neurotransmitter cocktails (dopamine for confidence, norepinephrine for alertness, serotonin for calm) within milliseconds. Research shows that anchored cue words become more powerful with each repetition, eventually requiring no conscious effort to trigger the desired state.',
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
    origin: 'Adapted from the Body Scan meditation technique developed by Dr. Jon Kabat-Zinn at the University of Massachusetts Medical School as part of Mindfulness-Based Stress Reduction (MBSR). Used by the U.S. Marine Corps Mindfulness-Based Mind Fitness Training (MMFT) program, and by NFL teams including the Seattle Seahawks under coach Pete Carroll\'s mindfulness-based performance culture.',
    neuroscience: 'Body scanning activates the insular cortex — the brain region responsible for interoception (internal body awareness). Athletes with higher interoceptive accuracy demonstrate superior reaction times, better injury prevention, and more refined movement quality. Research published in Frontiers in Human Neuroscience shows that regular body scan practice increases grey matter density in the insula, leading to heightened proprioception — the ability to sense exactly where your body is in space, which is critical for athletic performance.',
    overview: {
      when: 'Pre-competition warm-up, before technical work, or before sleep',
      focus: 'Scanning your body to release hidden tension and sharpen awareness',
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
    origin: 'Coined by Billie Jean King, who famously said "Pressure is a privilege." Refined by Dr. Michael Gervais (Seattle Seahawks, Red Bull) and sports psychologist Dr. Jim Loehr, who used pressure reframing with 16 world #1-ranked tennis players. The U.S. Army\'s Comprehensive Soldier Fitness (CSF) program integrated this technique into pre-deployment resilience training for 1.1 million soldiers.',
    neuroscience: 'Cognitive reframing activates the ventrolateral prefrontal cortex, which modulates the amygdala\'s threat response. When you consciously reinterpret pressure as privilege, fMRI studies show a measurable reduction in amygdala activation and a corresponding increase in reward-center (nucleus accumbens) activity. Your body\'s physiological stress response — elevated heart rate, adrenaline release — remains identical, but the brain interprets it as excitement rather than threat, fundamentally changing performance outcomes.',
    overview: {
      when: 'When pressure feels overwhelming or before high-stakes moments',
      focus: 'Transforming the perception of pressure from threat to opportunity',
      timeScale: '5 minutes (journaling exercise)',
      skill: 'Cognitive reappraisal of stress',
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
    origin: 'Based on groundbreaking research by Harvard Business School professor Alison Wood Brooks, published in the Journal of Experimental Psychology (2014). The study proved that saying "I am excited" before a high-pressure task significantly improved performance compared to saying "I am calm" or saying nothing. NBA player Steph Curry and tennis champion Rafael Nadal are known practitioners of this reframing technique.',
    neuroscience: 'Anxiety and excitement produce neurologically identical physiological responses — elevated heart rate, increased cortisol, heightened arousal. The only difference is cognitive appraisal. Brooks\' research showed that reappraising anxiety as excitement ("excitation transfer") is far easier than trying to calm down because it doesn\'t require shifting arousal levels — only the brain\'s interpretation. This leverages the concept of "cognitive reappraisal," which engages the prefrontal cortex to relabel the amygdala\'s signal from "danger" to "opportunity."',
    overview: {
      when: 'When you feel butterflies, racing heart, or pre-game jitters',
      focus: 'Relabeling anxiety symptoms as excitement and fuel',
      timeScale: '3 minutes (instant reframe)',
      skill: 'Arousal reinterpretation',
      analogy: 'Same engine, different gear — anxiety and excitement are the same fuel, just channeled differently',
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
    origin: 'Central to Nick Saban\'s "The Process" philosophy that produced 7 national championships at Alabama. Also a cornerstone of Phil Jackson\'s coaching with the Chicago Bulls and LA Lakers, and used by U.S. Special Operations to keep operators focused on execution rather than mission outcome during high-stakes operations.',
    neuroscience: 'Outcome focus activates the brain\'s default mode network (DMN) — the system responsible for self-referential thinking, rumination, and worry. Process focus deactivates the DMN and engages the task-positive network (TPN), which controls present-moment execution and motor coordination. Research from the University of Chicago on "choking under pressure" shows that athletes who focus on process cues reduce working memory interference by up to 60%, freeing cognitive resources for actual performance execution.',
    overview: {
      when: 'When you catch yourself worrying about results instead of executing',
      focus: 'Redirecting attention from outcomes you can\'t control to actions you can',
      timeScale: '5 minutes (journaling + cue creation)',
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
    origin: 'Based on research by Harvard social psychologist Amy Cuddy, whose TED Talk on body language became the second most-viewed TED Talk in history. While the testosterone/cortisol claims from the original study were debated, subsequent research (published in Psychological Science, 2017) confirmed that expansive postures do increase subjective feelings of power and risk tolerance. Used by Wall Street traders, trial lawyers, and combat athletes before high-stakes performances.',
    neuroscience: 'Expansive postures activate the brain\'s postural feedback loop — the body sends "dominance" signals to the brain via proprioceptive neurons, which the brain interprets as genuine confidence. This is an example of embodied cognition: the body influences the mind just as the mind influences the body. While the hormonal claims remain debated, replicated studies confirm that power posing increases subjective feelings of confidence, pain tolerance, and willingness to take action — all critical for competitive performance.',
    overview: {
      when: 'In the locker room, hallway, or bathroom before competing',
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
  // THE KILL SWITCH (FOCUS - MENTAL RECOVERY TRAINING)
  // -------------------------------------------------------------------------
  {
    id: 'focus-3-second-reset',
    name: 'The Kill Switch',
    description: 'Mental recovery training — how fast can you recover after something goes wrong? Simulates disruption, measures your recovery time, and tracks improvement over sessions. The single most important mental skill in competitive athletics.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Beginner,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'kill_switch',
        duration: 180,
        progressionLevel: 1,
        instructions: ['Train your mental recovery speed through disruption-recovery cycles'],
      },
    },
    benefits: [
      'Faster mental recovery from mistakes',
      'Disruption resilience under pressure',
      'Consistency in high-stakes moments',
      'Measurable improvement over time',
    ],
    bestFor: ['mistake recovery', 'pre-competition', 'in-season training', 'pressure performance'],
    origin: 'Grounded in Attentional Control Theory (Eysenck & Calvo, 1992; Eysenck et al., 2007) and cognitive flexibility research. Military Special Operations units train disruption-recovery cycles to build automatic reset responses under fire. Professional athletes like Navy SEAL-trained MMA fighters and Formula 1 drivers use similar rapid-recovery drills to maintain performance after errors.',
    neuroscience: 'The Kill Switch targets the prefrontal cortex\'s ability to reassert executive control after the amygdala hijacks attention during a disruption. Each round trains the brain to shorten the "attentional blink" — the cognitive gap between disruption and refocused execution. Research shows this gap is trainable and can be reduced by 40-60% with consistent practice, leading to measurably faster recovery from mistakes during competition.',
    overview: {
      when: 'Regular training sessions, pre-competition preparation',
      focus: 'How fast you bounce back after something breaks your concentration',
      timeScale: '2-4 minutes (5-7 rounds)',
      skill: 'Disruption recovery speed',
      analogy: 'Like training a circuit breaker — when the system overloads, how fast can you flip the switch and restore full power?',
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
    description: 'Train selective attention by locking onto the live signal while visual and audio clutter compete for your focus.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'distraction',
        duration: 180,
        progressionLevel: 2,
        instructions: ['Filter noise, ignore decoys, and hold the right cue under clutter.'],
      },
    },
    benefits: [
      'Improves cue filtering under clutter',
      'Builds tolerance for audio and visual distraction',
      'Sharpens selective attention under time pressure',
    ],
    bestFor: ['crowd noise', 'visual clutter', 'distraction control', 'recognition speed'],
    origin: 'Built from attention-systems research and sport concentration training used to help athletes ignore bait, clutter, and crowd noise.',
    neuroscience: 'Noise Gate targets the attentional selection network by forcing the brain to preserve task-relevant information while suppressing distractors. Repeated reps should reduce the performance cost of irrelevant cues.',
    overview: {
      when: 'Before noisy competition environments or when athletes are losing the right cue to clutter',
      focus: 'Selective attention under distraction',
      timeScale: '2-4 minutes',
      skill: 'Holding the live signal while noise rises',
      analogy: 'Like tuning a radio until only the station you need comes through clearly',
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
    description: 'Train impulse control by cancelling the wrong move fast enough to avoid compounding the mistake.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'cue_word',
        duration: 150,
        progressionLevel: 2,
        instructions: ['Read go / no-go conflict quickly and brake before the false move completes.'],
      },
    },
    benefits: [
      'Reduces impulsive errors',
      'Improves cancellation speed',
      'Builds cleaner response inhibition under pressure',
    ],
    bestFor: ['fake-outs', 'false starts', 'impulsive decisions', 'decision control'],
    origin: 'Grounded in executive-function research on inhibitory control and adapted for pressure-heavy sport decisions.',
    neuroscience: 'Brake Point targets inhibitory control by training rapid suppression of prepotent responses before error cascades can form.',
    overview: {
      when: 'When athletes are overcommitting, biting on fakes, or false-starting',
      focus: 'Stopping the wrong action fast',
      timeScale: '2-3 minutes',
      skill: 'Response inhibition',
      analogy: 'Like hitting the brakes before a skid turns into a crash',
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
    description: 'Compress the decision window and force the athlete to choose the real cue before the opportunity disappears.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Intermediate,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 165,
        progressionLevel: 2,
        instructions: ['Pick the live signal, reject decoys, and decide before the window closes.'],
      },
    },
    benefits: [
      'Improves read-and-react speed',
      'Sharpens cue discrimination',
      'Reduces decoy susceptibility',
    ],
    bestFor: ['tight reads', 'recognition speed', 'ambiguous cues', 'decision clarity'],
    origin: 'Inspired by perceptual-cognitive training work on cue discrimination and fast decision-making.',
    neuroscience: 'Signal Window forces faster cue selection under ambiguity, strengthening the link between selective attention and decisive action.',
    overview: {
      when: 'For athletes who know what to do but do not read it fast enough',
      focus: 'Correct reads under tight time pressure',
      timeScale: '2-3 minutes',
      skill: 'Cue discrimination',
      analogy: 'Like catching the green light before it turns red',
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
    description: 'Force quick adaptation when rules or priorities change mid-rep so the athlete can re-stabilize without freezing.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Advanced,
    durationMinutes: 3,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'distraction',
        duration: 180,
        progressionLevel: 3,
        instructions: ['Hold the sequence, update the rule, and keep executing after the switch.'],
      },
    },
    benefits: [
      'Improves working-memory updating',
      'Builds faster re-stabilization after rule changes',
      'Strengthens mental flexibility',
    ],
    bestFor: ['audibles', 'assignment changes', 'install work', 'rule switching'],
    origin: 'Grounded in executive-function research on updating and attentional shifting.',
    neuroscience: 'Sequence Shift recruits working-memory updating and attentional shifting so athletes can preserve structure even when instructions change mid-flow.',
    overview: {
      when: 'When athletes struggle after audibles, changed assignments, or late instructions',
      focus: 'Maintaining execution through rule change',
      timeScale: '3 minutes',
      skill: 'Working-memory updating',
      analogy: 'Like changing lanes at speed without losing control of the car',
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
    description: 'Extended focus rep designed to expose late-session lapses, variance, and fatigue-driven decision decay.',
    category: ExerciseCategory.Focus,
    difficulty: ExerciseDifficulty.Advanced,
    durationMinutes: 6,
    exerciseConfig: {
      type: 'focus',
      config: {
        type: 'single_point',
        duration: 360,
        progressionLevel: 4,
        instructions: ['Stay locked in as time-on-task accumulates and the rep gets mentally heavier.'],
      },
    },
    benefits: [
      'Reveals fatigability',
      'Measures late-session sharpness',
      'Builds sustained attention under accumulating load',
    ],
    bestFor: ['late-game focus', 'fatigability', 'consistency', 'extended reps'],
    origin: 'Built from concentration training and mental-fatigue literature on time-on-task breakdown.',
    neuroscience: 'Endurance Lock turns duration into the stressor. It measures how quickly performance decays as cognitive load accumulates.',
    overview: {
      when: 'Periodic stress tests and high-value reassessment days',
      focus: 'Degradation slope over time',
      timeScale: '5-8 minutes',
      skill: 'Sustained attention under fatigue',
      analogy: 'Like checking whether your mechanics still hold in the fourth quarter',
    },
    iconName: 'timer-reset',
    isActive: true,
    sortOrder: 28,
    ...taxonomyFields('focus-endurance-lock'),
    createdAt: now,
    updatedAt: now,
  },
];
