/**
 * Exercise Player Component
 * 
 * A universal exercise player that handles different exercise types:
 * - Breathing exercises with animated visuals
 * - Visualization with prompts
 * - Focus exercises with timers
 * - Mindset exercises with journal prompts
 * - Confidence exercises with guided steps
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Pause,
  SkipForward,
  CheckCircle,
  Wind,
  Eye,
  Target,
  Brain,
  Star,
  ChevronRight,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { speakStep, stopNarration, VoiceChoice } from '../../utils/tts';
import {
  MentalExercise,
  ExerciseCategory,
  BreathingPhase,
  ExerciseCompletion,
} from '../../api/firebase/mentaltraining/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Determines if an exercise requires user writing/journaling
 * These exercises should redirect to Nora chat for interactive completion
 */
export function exerciseRequiresWriting(exercise: MentalExercise): boolean {
  const { exerciseConfig } = exercise;
  
  // Mindset exercises with journalRequired flag
  if (exerciseConfig.type === 'mindset') {
    const config = exerciseConfig.config;
    if (config.journalRequired) return true;
    // Reframe and growth_mindset types benefit from writing
    if (config.type === 'reframe' || config.type === 'growth_mindset') return true;
  }
  
  // Confidence exercises that require journaling
  if (exerciseConfig.type === 'confidence') {
    const config = exerciseConfig.config;
    // These types require actual user writing
    if (config.type === 'evidence_journal' || config.type === 'inventory' || config.type === 'affirmations') {
      return true;
    }
  }
  
  return false;
}

interface ExercisePlayerProps {
  exercise: MentalExercise;
  onComplete: (data: {
    durationSeconds: number;
    preExerciseMood?: number;
    postExerciseMood?: number;
    difficultyRating?: number;
    helpfulnessRating?: number;
    notes?: string;
  }) => void;
  onClose: () => void;
  assignmentId?: string;
  /** Called when a writing exercise should be started in Nora chat */
  onStartInChat?: (exercise: MentalExercise) => void;
}

type PlayerState = 'intro' | 'pre-mood' | 'active' | 'post-mood' | 'complete';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ExercisePlayer: React.FC<ExercisePlayerProps> = ({
  exercise,
  onComplete,
  onClose,
  assignmentId,
  onStartInChat,
}) => {
  // Check if this exercise requires writing - show different flow
  const requiresWriting = exerciseRequiresWriting(exercise);
  const [state, setState] = useState<PlayerState>('intro');
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [preExerciseMood, setPreExerciseMood] = useState<number | undefined>();
  const [postExerciseMood, setPostExerciseMood] = useState<number | undefined>();
  const [helpfulnessRating, setHelpfulnessRating] = useState<number | undefined>();
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Voice selection is admin-configured globally (see /admin/ai-voice).

  // Start timer when active
  useEffect(() => {
    if (state === 'active' && !isPaused) {
      startTimeRef.current = Date.now() - elapsedSeconds * 1000;
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state, isPaused]);

  const handleStart = () => {
    setState('pre-mood');
  };

  const handlePreMoodSelect = (mood: number) => {
    setPreExerciseMood(mood);
    setState('active');
  };

  const handleExerciseComplete = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    stopNarration();
    setState('post-mood');
  };

  const handlePostMoodSelect = (mood: number) => {
    setPostExerciseMood(mood);
    setState('complete');
  };

  const handleFinalComplete = (rating: number) => {
    setHelpfulnessRating(rating);
    onComplete({
      durationSeconds: elapsedSeconds,
      preExerciseMood,
      postExerciseMood,
      helpfulnessRating: rating,
    });
  };

  const getCategoryIcon = () => {
    switch (exercise.category) {
      case ExerciseCategory.Breathing:
        return <Wind className="w-8 h-8" />;
      case ExerciseCategory.Visualization:
        return <Eye className="w-8 h-8" />;
      case ExerciseCategory.Focus:
        return <Target className="w-8 h-8" />;
      case ExerciseCategory.Mindset:
        return <Brain className="w-8 h-8" />;
      case ExerciseCategory.Confidence:
        return <Star className="w-8 h-8" />;
      default:
        return <Brain className="w-8 h-8" />;
    }
  };

  const getCategoryColor = () => {
    switch (exercise.category) {
      case ExerciseCategory.Breathing:
        return 'from-cyan-500 to-blue-600';
      case ExerciseCategory.Visualization:
        return 'from-purple-500 to-indigo-600';
      case ExerciseCategory.Focus:
        return 'from-amber-500 to-orange-600';
      case ExerciseCategory.Mindset:
        return 'from-emerald-500 to-green-600';
      case ExerciseCategory.Confidence:
        return 'from-yellow-500 to-amber-600';
      default:
        return 'from-zinc-500 to-zinc-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl"
    >
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br ${getCategoryColor()} rounded-full blur-[120px] opacity-20`} />
        <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-br ${getCategoryColor()} rounded-full blur-[120px] opacity-20`} />
      </div>

      {/* Close button */}
      <button
        onClick={() => {
          stopNarration();
          onClose();
        }}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
      >
        <X className="w-6 h-6 text-white/70" />
      </button>

      {/* Sound toggle */}
      <button
        onClick={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          if (!next) stopNarration();
        }}
        className="absolute top-6 left-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
      >
        {soundEnabled ? (
          <Volume2 className="w-6 h-6 text-white/70" />
        ) : (
          <VolumeX className="w-6 h-6 text-white/70" />
        )}
      </button>

      {/* Voice selection is controlled by admins */}

      {/* Content */}
      <div className="relative w-full max-w-2xl mx-4">
        <AnimatePresence mode="wait">
          {state === 'intro' && (
            <IntroScreen
              key="intro"
              exercise={exercise}
              categoryIcon={getCategoryIcon()}
              categoryColor={getCategoryColor()}
              onStart={handleStart}
            />
          )}

          {state === 'pre-mood' && (
            <MoodSelector
              key="pre-mood"
              title="Before we begin..."
              subtitle="How are you feeling right now?"
              onSelect={handlePreMoodSelect}
            />
          )}

          {state === 'active' && (
            <ActiveExercise
              key="active"
              exercise={exercise}
              isPaused={isPaused}
              elapsedSeconds={elapsedSeconds}
              categoryColor={getCategoryColor()}
              onPause={() => setIsPaused(true)}
              onResume={() => setIsPaused(false)}
              onComplete={handleExerciseComplete}
              soundEnabled={soundEnabled}
              requiresWriting={requiresWriting}
              onStartInChat={onStartInChat}
            />
          )}

          {state === 'post-mood' && (
            <MoodSelector
              key="post-mood"
              title="Exercise complete!"
              subtitle="How do you feel now?"
              onSelect={handlePostMoodSelect}
            />
          )}

          {state === 'complete' && (
            <CompletionScreen
              key="complete"
              exercise={exercise}
              elapsedSeconds={elapsedSeconds}
              preExerciseMood={preExerciseMood}
              postExerciseMood={postExerciseMood}
              categoryColor={getCategoryColor()}
              onRate={handleFinalComplete}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ============================================================================
// INTRO SCREEN
// ============================================================================

interface IntroScreenProps {
  exercise: MentalExercise;
  categoryIcon: React.ReactNode;
  categoryColor: string;
  onStart: () => void;
}

const IntroScreen: React.FC<IntroScreenProps> = ({
  exercise,
  categoryIcon,
  categoryColor,
  onStart,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="text-center"
  >
    {/* Icon */}
    <motion.div
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', delay: 0.1 }}
      className={`mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br ${categoryColor} flex items-center justify-center mb-8`}
    >
      <div className="text-white">{categoryIcon}</div>
    </motion.div>

    {/* Title */}
    <h1 className="text-3xl font-bold text-white mb-4">{exercise.name}</h1>
    
    {/* Description */}
    <p className="text-lg text-white/70 mb-8 max-w-md mx-auto">
      {exercise.description}
    </p>

    {/* Duration */}
    <div className="flex items-center justify-center gap-6 mb-10 text-white/60">
      <span>{exercise.durationMinutes} min</span>
      <span>•</span>
      <span className="capitalize">{exercise.difficulty}</span>
    </div>

    {/* Benefits */}
    <div className="flex flex-wrap justify-center gap-2 mb-10">
      {exercise.benefits.slice(0, 3).map((benefit, i) => (
        <span
          key={i}
          className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm"
        >
          {benefit}
        </span>
      ))}
    </div>

    {/* Start button */}
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onStart}
      className={`px-10 py-4 rounded-2xl bg-gradient-to-r ${categoryColor} text-white font-semibold text-lg shadow-lg`}
    >
      Begin Exercise
    </motion.button>
  </motion.div>
);

// ============================================================================
// MOOD SELECTOR
// ============================================================================

interface MoodSelectorProps {
  title: string;
  subtitle: string;
  onSelect: (mood: number) => void;
}

const MoodSelector: React.FC<MoodSelectorProps> = ({ title, subtitle, onSelect }) => {
  const moods = [
    { value: 1, emoji: '😰', label: 'Stressed' },
    { value: 2, emoji: '😔', label: 'Low' },
    { value: 3, emoji: '😐', label: 'Neutral' },
    { value: 4, emoji: '😊', label: 'Good' },
    { value: 5, emoji: '🔥', label: 'Great' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center"
    >
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-white/60 mb-10">{subtitle}</p>

      <div className="flex justify-center gap-4">
        {moods.map((mood) => (
          <motion.button
            key={mood.value}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(mood.value)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="text-4xl">{mood.emoji}</span>
            <span className="text-sm text-white/60">{mood.label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

// ============================================================================
// ACTIVE EXERCISE
// ============================================================================

interface ActiveExerciseProps {
  exercise: MentalExercise;
  isPaused: boolean;
  elapsedSeconds: number;
  categoryColor: string;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  soundEnabled: boolean;
  requiresWriting?: boolean;
  onStartInChat?: (exercise: MentalExercise) => void;
}

const ActiveExercise: React.FC<ActiveExerciseProps> = ({
  exercise,
  isPaused,
  elapsedSeconds,
  categoryColor,
  onPause,
  onResume,
  onComplete,
  soundEnabled,
  requiresWriting,
  onStartInChat,
}) => {
  if (exercise.exerciseConfig.type === 'breathing') {
    return (
      <BreathingExercise
        config={exercise.exerciseConfig.config}
        isPaused={isPaused}
        categoryColor={categoryColor}
        onPause={onPause}
        onResume={onResume}
        onComplete={onComplete}
        soundEnabled={soundEnabled}
      />
    );
  }

  if (exercise.exerciseConfig.type === 'focus') {
    return (
      <FocusExercise
        config={exercise.exerciseConfig.config}
        isPaused={isPaused}
        elapsedSeconds={elapsedSeconds}
        categoryColor={categoryColor}
        onPause={onPause}
        onResume={onResume}
        onComplete={onComplete}
      />
    );
  }

  // Generic prompt-based exercise for visualization, mindset, confidence
  return (
    <PromptExercise
      exercise={exercise}
      isPaused={isPaused}
      elapsedSeconds={elapsedSeconds}
      categoryColor={categoryColor}
      onPause={onPause}
      onResume={onResume}
      onComplete={onComplete}
      soundEnabled={soundEnabled}
      requiresWriting={requiresWriting}
      onStartInChat={onStartInChat}
    />
  );
};

// ============================================================================
// FOCUS EXERCISE (game-like module)
// ============================================================================

type FocusPhase = 'instructions' | 'cueWord' | 'getReady' | 'practice';

// Only these focus exercise types should have the cue word selection phase
const CUE_WORD_EXERCISE_TYPES = ['cue_word', 'cue_word_anchoring', 'anchoring'];

interface FocusExerciseProps {
  config: any;
  isPaused: boolean;
  elapsedSeconds: number;
  categoryColor: string;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
}

const FocusExercise: React.FC<FocusExerciseProps> = ({
  config,
  isPaused,
  elapsedSeconds,
  categoryColor,
  onPause,
  onResume,
  onComplete,
}) => {
  const DEBUG_FOCUS = false; // Set to true to enable debug logging
  const debugIdRef = useRef(`focus-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`);

  const practiceDuration = typeof config?.duration === 'number' ? config.duration : 60; // Practice duration in seconds
  const instructions: string[] = Array.isArray(config?.instructions) ? config.instructions.filter(Boolean) : [];
  
  const [phase, setPhase] = useState<FocusPhase>('instructions');
  const [step, setStep] = useState(0);
  const [cueWord, setCueWord] = useState('');
  const [getReadyCountdown, setGetReadyCountdown] = useState(3);
  const [practiceElapsed, setPracticeElapsed] = useState(0);
  const [currentRep, setCurrentRep] = useState(1);
  const narrationRunIdRef = useRef(0);
  const practiceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const getReadyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const practiceStartedRef = useRef(false);
  
  // Store onComplete in ref to avoid dependency issues
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const safeTotalSteps = Math.max(1, instructions.length);
  const currentInstruction = instructions[step] || 'Keep your attention on the target.';
  const mode = config?.type || 'single_point';
  
  // Determine if this exercise type uses cue word anchoring
  const usesCueWord = CUE_WORD_EXERCISE_TYPES.includes(mode);
  
  // Rep-based practice: each rep is ~15 seconds of focus
  const repDuration = 15;
  const totalReps = Math.max(1, Math.ceil(practiceDuration / repDuration));
  const practiceRemaining = Math.max(0, practiceDuration - practiceElapsed);

  // Debug: Mount/unmount logging
  useEffect(() => {
    if (!DEBUG_FOCUS) return;
    console.log(`[FocusExercise:${debugIdRef.current}] MOUNT`, {
      phase,
      isPaused,
      practiceDuration,
      config,
    });
    return () => {
      console.log(`[FocusExercise:${debugIdRef.current}] UNMOUNT`, {
        phase,
        practiceElapsed,
        hadTimer: !!practiceTimerRef.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug: Log phase changes
  useEffect(() => {
    if (!DEBUG_FOCUS) return;
    console.log(`[FocusExercise:${debugIdRef.current}] PHASE CHANGED`, {
      phase,
      isPaused,
      practiceElapsed,
      practiceTimerRef: !!practiceTimerRef.current,
    });
  }, [phase]);

  // Debug: Log isPaused changes
  useEffect(() => {
    if (!DEBUG_FOCUS) return;
    console.log(`[FocusExercise:${debugIdRef.current}] isPaused CHANGED`, {
      isPaused,
      phase,
      practiceElapsed,
      practiceTimerRef: !!practiceTimerRef.current,
    });
  }, [isPaused]);

  // Practice timer - only runs when in practice phase
  useEffect(() => {
    if (DEBUG_FOCUS) {
      console.log(`[FocusExercise:${debugIdRef.current}] Practice Timer Effect RUNNING`, {
        phase,
        isPaused,
        practiceElapsed,
        practiceTimerRef: !!practiceTimerRef.current,
        practiceDuration,
      });
    }

    // Clear timer when not in practice or paused
    if (phase !== 'practice' || isPaused) {
      if (practiceTimerRef.current) {
        if (DEBUG_FOCUS) {
          console.log(`[FocusExercise:${debugIdRef.current}] CLEARING timer (not practice or paused)`, {
            phase,
            isPaused,
          });
        }
        clearInterval(practiceTimerRef.current);
        practiceTimerRef.current = null;
      }
      return;
    }

    // Don't create multiple timers
    if (practiceTimerRef.current) {
      if (DEBUG_FOCUS) {
        console.log(`[FocusExercise:${debugIdRef.current}] Timer already exists, skipping creation`);
      }
      return;
    }

    if (DEBUG_FOCUS) {
      console.log(`[FocusExercise:${debugIdRef.current}] CREATING NEW TIMER`, {
        phase,
        isPaused,
        practiceElapsed,
        practiceDuration,
      });
    }

    practiceStartedRef.current = true;
    practiceTimerRef.current = setInterval(() => {
      setPracticeElapsed((prev) => {
        const next = prev + 1;
        if (DEBUG_FOCUS) {
          console.log(`[FocusExercise:${debugIdRef.current}] TICK`, {
            prev,
            next,
            practiceDuration,
            willComplete: next >= practiceDuration,
          });
        }
        // Complete when practice is done
        if (next >= practiceDuration) {
          if (practiceTimerRef.current) {
            if (DEBUG_FOCUS) {
              console.log(`[FocusExercise:${debugIdRef.current}] COMPLETING - clearing timer`);
            }
            clearInterval(practiceTimerRef.current);
            practiceTimerRef.current = null;
          }
          setTimeout(() => onCompleteRef.current(), 100);
        }
        return next;
      });
    }, 1000);

    if (DEBUG_FOCUS) {
      console.log(`[FocusExercise:${debugIdRef.current}] Timer CREATED`, {
        timerRef: !!practiceTimerRef.current,
      });
      
      // Sanity check: if we don't see a tick within 1.5s, something is wrong
      const sanityTimer = setTimeout(() => {
        console.log(`[FocusExercise:${debugIdRef.current}] SANITY CHECK (1.5s)`, {
          timerStillExists: !!practiceTimerRef.current,
          practiceElapsed,
          phase,
          isPaused,
          visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
        });
      }, 1500);

      return () => {
        clearTimeout(sanityTimer);
        if (practiceTimerRef.current) {
          console.log(`[FocusExercise:${debugIdRef.current}] CLEANUP - clearing timer`);
          clearInterval(practiceTimerRef.current);
          practiceTimerRef.current = null;
        }
      };
    }

    return () => {
      if (practiceTimerRef.current) {
        if (DEBUG_FOCUS) {
          console.log(`[FocusExercise:${debugIdRef.current}] CLEANUP - clearing timer`);
        }
        clearInterval(practiceTimerRef.current);
        practiceTimerRef.current = null;
      }
    };
  }, [phase, isPaused, practiceDuration]);

  // Update rep based on elapsed time
  useEffect(() => {
    const newRep = Math.min(totalReps, Math.floor(practiceElapsed / repDuration) + 1);
    if (newRep !== currentRep) {
      if (DEBUG_FOCUS) {
        console.log(`[FocusExercise:${debugIdRef.current}] REP CHANGED`, {
          from: currentRep,
          to: newRep,
          practiceElapsed,
        });
      }
      setCurrentRep(newRep);
    }
  }, [practiceElapsed, repDuration, totalReps, currentRep]);

  // Get ready countdown
  useEffect(() => {
    if (DEBUG_FOCUS) {
      console.log(`[FocusExercise:${debugIdRef.current}] GetReady Effect RUNNING`, {
        phase,
        getReadyCountdown,
        hasTimer: !!getReadyTimerRef.current,
      });
    }

    if (phase !== 'getReady') {
      if (getReadyTimerRef.current) {
        if (DEBUG_FOCUS) {
          console.log(`[FocusExercise:${debugIdRef.current}] GetReady CLEARING timer (not in getReady phase)`);
        }
        clearInterval(getReadyTimerRef.current);
        getReadyTimerRef.current = null;
      }
      return;
    }

    if (getReadyTimerRef.current) {
      if (DEBUG_FOCUS) {
        console.log(`[FocusExercise:${debugIdRef.current}] GetReady timer already exists, skipping`);
      }
      return;
    }

    if (DEBUG_FOCUS) {
      console.log(`[FocusExercise:${debugIdRef.current}] GetReady CREATING TIMER`);
    }

    getReadyTimerRef.current = setInterval(() => {
      setGetReadyCountdown((prev) => {
        if (DEBUG_FOCUS) {
          console.log(`[FocusExercise:${debugIdRef.current}] GetReady TICK`, {
            prev,
            next: prev - 1,
            willTransition: prev <= 1,
          });
        }
        if (prev <= 1) {
          if (getReadyTimerRef.current) {
            if (DEBUG_FOCUS) {
              console.log(`[FocusExercise:${debugIdRef.current}] GetReady TRANSITIONING to practice phase`);
            }
            clearInterval(getReadyTimerRef.current);
            getReadyTimerRef.current = null;
          }
          setPhase('practice');
          return 3;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (getReadyTimerRef.current) {
        if (DEBUG_FOCUS) {
          console.log(`[FocusExercise:${debugIdRef.current}] GetReady CLEANUP`);
        }
        clearInterval(getReadyTimerRef.current);
        getReadyTimerRef.current = null;
      }
    };
  }, [phase]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNextStep = () => {
    stopNarration();
    if (step < safeTotalSteps - 1) {
      setStep((prev) => prev + 1);
    } else {
      // Move to next phase - cue word selection only for anchoring exercises
      if (usesCueWord) {
        setPhase('cueWord');
      } else {
        // Skip cue word selection and go directly to practice
        setPhase('getReady');
      }
    }
  };

  const handleCueWordSubmit = () => {
    if (cueWord.trim()) {
      setPhase('getReady');
    }
  };

  // Get practice guidance - returns title, instruction, and technique tip for each rep
  const getPracticeGuidance = () => {
    const word = cueWord.toUpperCase();
    const isLastRep = currentRep >= totalReps;
    const isSecondToLastRep = currentRep === totalReps - 1;
    const isDistraction = mode === 'distraction';
    
    // Different guidance for CUE WORD exercises vs REGULAR focus exercises
    if (usesCueWord) {
      // ========== CUE WORD ANCHORING EXERCISE ==========
      if (currentRep === 1) {
        return {
          title: 'BUILD THE STATE',
          instruction: 'Soften your gaze on the dot. Let your breathing slow naturally. Feel tension leaving your body.',
          technique: 'This is the foundation—notice how calm focus feels in your body.'
        };
      }
      if (currentRep === 2) {
        return {
          title: 'DEEPEN THE FOCUS',
          instruction: `Your attention is narrowing. The world outside the dot is fading. You're entering your zone.`,
          technique: `When you feel truly locked in, silently say "${word}" in your mind.`
        };
      }
      if (currentRep === 3) {
        return {
          title: 'ANCHOR THE STATE',
          instruction: `This focused feeling + your word "${word}" are becoming connected. Say "${word}" each time you exhale.`,
          technique: `You're creating a neural link: "${word}" = this exact state of focus.`
        };
      }
      if (currentRep === 4) {
        return {
          title: 'STRENGTHEN THE ANCHOR',
          instruction: `Keep repeating "${word}" silently. Each repetition makes the anchor stronger.`,
          technique: `In competition, just thinking "${word}" will instantly trigger this state.`
        };
      }
      
      if (isLastRep) {
        return {
          title: 'EXERCISE COMPLETE',
          instruction: `You now own this state. "${word}" is your mental key. Use it anytime you need laser focus.`,
          technique: `Your anchor is set. In competition, just think "${word}" to trigger this state instantly.`
        };
      }
      
      if (isSecondToLastRep) {
        return {
          title: 'FINAL STRETCH',
          instruction: `One more rep after this. Keep your focus soft but steady. "${word}" is becoming automatic.`,
          technique: 'You\'re building a permanent mental tool you can use for life.'
        };
      }
      
      const sustainPhase = currentRep - 4;
      const sustainMessages = [
        {
          title: 'SUSTAIN THE FOCUS',
          instruction: `Stay present with the dot. Each breath deepens your connection to "${word}".`,
          technique: 'The longer you hold this state, the stronger your anchor becomes.'
        },
        {
          title: 'REINFORCE THE LINK',
          instruction: `Silently repeat "${word}" on each exhale. Feel the word pulling you into focus.`,
          technique: 'You\'re rewiring your brain to associate this word with peak concentration.'
        },
        {
          title: 'DEEPEN THE ANCHOR',
          instruction: `If your mind wanders, gently return to the dot and whisper "${word}" internally.`,
          technique: 'Elite athletes use this exact technique before every performance.'
        },
        {
          title: 'LOCK IT IN',
          instruction: `Notice how effortlessly "${word}" brings you back to center. That\'s the anchor working.`,
          technique: 'This is becoming automatic. Trust the process.'
        },
        {
          title: 'BUILD MENTAL MUSCLE',
          instruction: `Each rep strengthens the neural pathway. "${word}" is becoming a reflex.`,
          technique: 'Like physical training, mental training requires repetition.'
        },
        {
          title: 'MAINTAIN THE STATE',
          instruction: `Stay locked on the dot. Let "${word}" pulse silently in the background of your mind.`,
          technique: 'You\'re building a skill that will serve you in competition.'
        },
      ];
      
      const messageIndex = (sustainPhase - 1) % sustainMessages.length;
      return sustainMessages[messageIndex];
    } else {
      // ========== REGULAR FOCUS EXERCISES (Single-Point, Distraction, etc.) ==========
      if (currentRep === 1) {
        return {
          title: 'SETTLE IN',
          instruction: isDistraction 
            ? 'Find the target with soft eyes. Let it be the center of your world.'
            : 'Soften your gaze on the dot. Let your breathing slow naturally.',
          technique: 'This is the foundation—allow yourself to settle into stillness.'
        };
      }
      if (currentRep === 2) {
        return {
          title: 'NARROW YOUR FOCUS',
          instruction: isDistraction
            ? 'The target may move, but your attention stays locked. Track it smoothly.'
            : 'Your peripheral awareness is fading. Only the dot exists.',
          technique: 'Let distractions pass through without grabbing your attention.'
        };
      }
      if (currentRep === 3) {
        return {
          title: 'ENTER THE ZONE',
          instruction: isDistraction
            ? 'You and the target are connected. Anticipate its movement.'
            : 'Feel yourself entering a state of flow. Nothing else matters.',
          technique: 'This calm alertness is the zone athletes talk about.'
        };
      }
      if (currentRep === 4) {
        return {
          title: 'DEEPEN THE STATE',
          instruction: 'Your focus is becoming effortless. Stay with this feeling.',
          technique: 'Notice how natural sustained attention can feel.'
        };
      }
      
      if (isLastRep) {
        return {
          title: 'EXERCISE COMPLETE',
          instruction: 'Excellent work. Your focus ability is strengthening with each session.',
          technique: 'This mental clarity is available to you anytime you practice.'
        };
      }
      
      if (isSecondToLastRep) {
        return {
          title: 'FINAL STRETCH',
          instruction: 'One more rep. Maintain your focus through to the end.',
          technique: 'Finishing strong builds mental discipline.'
        };
      }
      
      const sustainPhase = currentRep - 4;
      const focusMessages = [
        {
          title: 'SUSTAIN YOUR ATTENTION',
          instruction: isDistraction 
            ? 'Keep tracking the target. Your eyes and mind move together.'
            : 'Hold your gaze steady. Let thoughts pass like clouds.',
          technique: 'Each moment of sustained focus builds neural pathways.'
        },
        {
          title: 'BUILD ENDURANCE',
          instruction: 'Your attention muscle is getting stronger. Stay present.',
          technique: 'Mental endurance transfers directly to sport performance.'
        },
        {
          title: 'STAY PRESENT',
          instruction: isDistraction
            ? 'Don\'t anticipate where it will go—just follow where it is.'
            : 'Right here, right now. The dot is your only concern.',
          technique: 'Present-moment focus is a superpower in competition.'
        },
        {
          title: 'MAINTAIN FLOW',
          instruction: 'You\'re in a groove now. Trust the process and keep going.',
          technique: 'This flow state becomes more accessible with practice.'
        },
        {
          title: 'SHARPEN YOUR EDGE',
          instruction: isDistraction
            ? 'Notice how you can track movement without tension. Easy focus.'
            : 'Can you focus even more intently? Find your edge.',
          technique: 'Elite focus is about quality, not just duration.'
        },
        {
          title: 'REINFORCE THE SKILL',
          instruction: 'Every rep is training your brain. This focus is becoming automatic.',
          technique: 'What you practice becomes who you are in competition.'
        }
      ];
      
      const focusIndex = (sustainPhase - 1) % focusMessages.length;
      return focusMessages[focusIndex];
    }
  };

  // "Something moving" for all focus modes
  const shouldMove = !isPaused && phase !== 'getReady' && phase !== 'cueWord';
  const moveTransition = { duration: 6, repeat: Infinity, ease: 'easeInOut' as const };

  const movingDotAnimate =
    mode === 'distraction'
      ? { x: [0, 120, -80, 140, 0], y: [0, -90, 110, 40, 0] }
      : { x: [0, 10, -8, 6, 0], y: [0, -6, 8, -4, 0], scale: [1, 1.08, 1] };

  // Cue Word Phase
  if (phase === 'cueWord') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="text-center max-w-md mx-auto"
      >
        <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${categoryColor} flex items-center justify-center mb-6`}>
          <Target className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">Choose Your Anchor Word</h2>
        
        {/* Explanation box */}
        <div className={`mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 text-left`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white/80 font-semibold text-sm">🧠 How Anchoring Works</span>
          </div>
          <p className="text-white/60 text-sm leading-relaxed">
            Elite athletes use "anchoring" to trigger peak mental states on demand. You'll build 
            a state of deep focus, then connect it to a cue word. Later, just saying this word 
            will instantly bring back the focused state.
          </p>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={cueWord}
            onChange={(e) => setCueWord(e.target.value.slice(0, 20))}
            placeholder="e.g., FOCUS, LOCKED, ZONE"
            className="w-full px-6 py-4 rounded-2xl bg-white/10 border border-white/20 text-white text-center text-xl font-semibold placeholder-white/40 focus:outline-none focus:border-white/40 uppercase tracking-wider"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && cueWord.trim()) {
                handleCueWordSubmit();
              }
            }}
          />
          <p className="text-white/40 text-xs mt-2">Pick something short and powerful</p>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-8">
          {['FOCUS', 'LOCKED', 'ZONE', 'READY', 'POWER', 'CALM', 'NOW', 'GO'].map((word) => (
            <button
              key={word}
              onClick={() => setCueWord(word)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                cueWord === word 
                  ? `bg-gradient-to-r ${categoryColor} text-white` 
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {word}
            </button>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCueWordSubmit}
          disabled={!cueWord.trim()}
          className={`flex items-center justify-center gap-2 w-full px-6 py-4 rounded-xl font-semibold transition-opacity ${
            cueWord.trim() 
              ? `bg-gradient-to-r ${categoryColor} text-white` 
              : 'bg-white/10 text-white/40 cursor-not-allowed'
          }`}
        >
          Continue with "{cueWord.toUpperCase() || '...'}"
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </motion.div>
    );
  }

  // Get Ready Phase
  if (phase === 'getReady') {
    const isDistraction = mode === 'distraction';
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="text-center"
      >
        {/* Show cue word badge only for anchoring exercises */}
        {usesCueWord && cueWord && (
          <div className="mb-4">
            <span className={`inline-block px-4 py-2 rounded-full bg-gradient-to-r ${categoryColor} text-white font-bold text-lg mb-4`}>
              {cueWord.toUpperCase()}
            </span>
          </div>
        )}

        <div className="mb-8">
          {usesCueWord ? (
            <>
              <p className="text-white/60 text-lg mb-2">Get ready to anchor your focus</p>
              <p className="text-white/40 text-sm">You'll learn to trigger this state with your cue word</p>
            </>
          ) : (
            <>
              <p className="text-white/60 text-lg mb-2">
                {isDistraction ? 'Get ready to track the target' : 'Get ready to focus'}
              </p>
              <p className="text-white/40 text-sm">
                {isDistraction 
                  ? 'Follow the moving dot with soft, steady attention'
                  : 'Keep your attention centered on the dot'}
              </p>
            </>
          )}
        </div>

        <motion.div
          key={getReadyCountdown}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          className={`w-32 h-32 mx-auto rounded-full bg-gradient-to-br ${categoryColor} flex items-center justify-center mb-8`}
        >
          <span className="text-6xl font-bold text-white">{getReadyCountdown}</span>
        </motion.div>

        <p className="text-white/80">
          {totalReps} rep{totalReps > 1 ? 's' : ''} • {formatTime(practiceDuration)} total
        </p>
      </motion.div>
    );
  }

  // Practice Phase
  if (phase === 'practice') {
    const repProgress = ((practiceElapsed % repDuration) / repDuration) * 100;
    const guidance = getPracticeGuidance();
    const repSecondsRemaining = repDuration - (practiceElapsed % repDuration);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="text-center"
      >
        {/* Top status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col items-start">
            <span className={`text-xs font-bold tracking-wide`} style={{ color: categoryColor.includes('orange') ? '#f97316' : categoryColor.includes('yellow') ? '#eab308' : '#fff' }}>
              {guidance.title}
            </span>
            <span className="text-white/60 text-xs">
              Rep {currentRep} of {totalReps}
            </span>
          </div>
          
          {usesCueWord && cueWord && (
            <span className={`px-3 py-1 rounded-full bg-gradient-to-r ${categoryColor} text-white font-bold text-xs`}>
              {cueWord.toUpperCase()}
            </span>
          )}
          
          <div className="flex flex-col items-end">
            <span className="text-white text-2xl font-bold font-mono">{repSecondsRemaining}s</span>
            <span className="text-white/40 text-xs">this rep</span>
          </div>
        </div>

        {/* Rep progress bar (thick) */}
        <div className="h-2.5 bg-white/10 rounded-full mb-2 overflow-hidden">
          <motion.div
            animate={{ width: `${repProgress}%` }}
            transition={{ duration: 0.3, ease: 'linear' }}
            className={`h-full bg-gradient-to-r ${categoryColor}`}
          />
        </div>

        {/* Overall progress (thin) */}
        <div className="h-1 bg-white/5 rounded-full mb-6 overflow-hidden">
          <motion.div
            animate={{ width: `${(practiceElapsed / practiceDuration) * 100}%` }}
            className="h-full bg-white/40"
          />
        </div>

        {/* Focus "game" area */}
        <div className="relative mx-auto w-full max-w-xl h-[240px] rounded-3xl bg-white/5 border border-white/10 overflow-hidden mb-4">
          {/* Soft glow */}
          <div className={`absolute -top-24 -left-24 w-72 h-72 bg-gradient-to-br ${categoryColor} opacity-15 blur-[80px]`} />
          <div className={`absolute -bottom-24 -right-24 w-72 h-72 bg-gradient-to-br ${categoryColor} opacity-15 blur-[80px]`} />

          {/* Target / dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={shouldMove ? movingDotAnimate : { x: 0, y: 0, scale: 1 }}
              transition={moveTransition}
              className="relative"
            >
              {/* Outer rings */}
              <motion.div
                animate={shouldMove ? { scale: [1, 1.35, 1], opacity: [0.4, 0.12, 0.4] } : { scale: 1, opacity: 0.25 }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                className={`absolute -inset-10 rounded-full bg-gradient-to-br ${categoryColor} blur-xl`}
              />
              <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_0_8px_rgba(255,255,255,0.06)]" />
            </motion.div>
          </div>
        </div>

        {/* Guidance card - separate from the focus area */}
        <div className="px-5 py-4 rounded-2xl bg-black/40 border border-white/10 mb-6 text-left">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <p className="text-white text-sm leading-relaxed mb-2">
                {guidance.instruction}
              </p>
              <div className="border-t border-white/10 pt-2">
                <p className={`text-xs font-medium`} style={{ color: categoryColor.includes('orange') ? '#f97316' : categoryColor.includes('yellow') ? '#eab308' : '#fff' }}>
                  {guidance.technique}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
          {mode === 'distraction' && (
            <p className="text-white/50 text-xs mt-2 italic">
              Track the moving target with soft, steady attention.
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isPaused ? onResume : onPause}
            className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            {isPaused ? <Play className="w-6 h-6 text-white" /> : <Pause className="w-6 h-6 text-white" />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (practiceTimerRef.current) {
                clearInterval(practiceTimerRef.current);
                practiceTimerRef.current = null;
              }
              onComplete();
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r ${categoryColor} text-white font-semibold`}
          >
            Finish Early
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // Instructions Phase (default)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center"
    >
      {/* Top status */}
      <div className="flex items-center justify-between mb-8 text-white/60 text-sm">
        <span>
          Step {step + 1} of {safeTotalSteps}
        </span>
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">Instructions</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 rounded-full mb-10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${((step + 1) / safeTotalSteps) * 100}%` }}
          className={`h-full bg-gradient-to-r ${categoryColor}`}
        />
      </div>

      {/* Focus "game" area */}
      <div className="relative mx-auto w-full max-w-xl h-[320px] rounded-3xl bg-white/5 border border-white/10 overflow-hidden mb-10">
        {/* Soft glow */}
        <div className={`absolute -top-24 -left-24 w-72 h-72 bg-gradient-to-br ${categoryColor} opacity-15 blur-[80px]`} />
        <div className={`absolute -bottom-24 -right-24 w-72 h-72 bg-gradient-to-br ${categoryColor} opacity-15 blur-[80px]`} />

        {/* Target / dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={shouldMove ? movingDotAnimate : { x: 0, y: 0, scale: 1 }}
            transition={moveTransition}
            className="relative"
          >
            {/* Outer rings */}
            <motion.div
              animate={shouldMove ? { scale: [1, 1.35, 1], opacity: [0.4, 0.12, 0.4] } : { scale: 1, opacity: 0.25 }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute -inset-10 rounded-full bg-gradient-to-br ${categoryColor} blur-xl`}
            />
            <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_0_8px_rgba(255,255,255,0.06)]" />
          </motion.div>
        </div>

        {/* Instruction */}
        <div className="absolute bottom-5 left-5 right-5">
          <div className="px-4 py-3 rounded-2xl bg-black/35 border border-white/10 backdrop-blur-xl">
            <p className="text-white text-sm leading-snug">{currentInstruction}</p>
            {mode === 'distraction' && (
              <p className="text-white/60 text-xs mt-1">
                Distraction mode: keep your eyes on the moving target. If your mind wanders, gently return.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Auto-read instruction + advance when narration ends */}
      <AutoNarrator
        enabled={!isPaused}
        text={currentInstruction}
        onDone={() => {
          if (instructions.length <= 1) {
            // Skip cue word for non-anchoring exercises
            setPhase(usesCueWord ? 'cueWord' : 'getReady');
            return;
          }
          if (step < safeTotalSteps - 1) {
            setStep((prev) => prev + 1);
          } else {
            // Skip cue word for non-anchoring exercises
            setPhase(usesCueWord ? 'cueWord' : 'getReady');
          }
        }}
        runIdRef={narrationRunIdRef}
        voiceChoice={null}
      />

      {/* Controls */}
      <div className="flex justify-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={isPaused ? onResume : onPause}
          className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          {isPaused ? <Play className="w-6 h-6 text-white" /> : <Pause className="w-6 h-6 text-white" />}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleNextStep}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r ${categoryColor} text-white font-semibold`}
        >
          {step < safeTotalSteps - 1 ? 'Next' : 'Choose Cue Word'}
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
};

// ============================================================================
// BREATHING EXERCISE
// ============================================================================

interface BreathingExerciseProps {
  config: any;
  isPaused: boolean;
  categoryColor: string;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  soundEnabled: boolean;
}

const BreathingExercise: React.FC<BreathingExerciseProps> = ({
  config,
  isPaused,
  categoryColor,
  onPause,
  onResume,
  onComplete,
  soundEnabled,
}) => {
  const DEBUG_BREATHING = true;
  // Stable-ish id per mount to correlate logs (not cryptographically random)
  const debugIdRef = useRef(`breath-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`);

  // IMPORTANT: onComplete identity changes every render in parent (it’s an inline function),
  // which was causing this component’s timer effect to teardown/restart every second.
  // We store it in a ref to keep the interval stable.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Use refs for values that need to be accessed in interval without causing re-renders
  const phaseIndexRef = useRef(0);
  const cycleRef = useRef(1);
  const countdownRef = useRef(config.phases[0]?.duration || 4);
  const completedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // State for UI rendering only
  const [displayState, setDisplayState] = useState({
    phaseIndex: 0,
    cycle: 1,
    countdown: config.phases[0]?.duration || 4,
  });

  const currentPhase = config.phases[displayState.phaseIndex];
  const totalCycles = config.cycles || 6;

  useEffect(() => {
    if (!DEBUG_BREATHING) return;
    console.log(`[BreathingExercise:${debugIdRef.current}] MOUNT`, {
      visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
      phases: config?.phases?.map((p: any) => ({ name: p?.name, duration: p?.duration, instruction: p?.instruction })),
      cycles: config?.cycles,
      initial: {
        phaseIndexRef: phaseIndexRef.current,
        cycleRef: cycleRef.current,
        countdownRef: countdownRef.current,
        displayState,
        isPaused,
        completed: completedRef.current,
      },
    });
    return () => {
      console.log(`[BreathingExercise:${debugIdRef.current}] UNMOUNT`, {
        phaseIndexRef: phaseIndexRef.current,
        cycleRef: cycleRef.current,
        countdownRef: countdownRef.current,
        displayState,
        isPaused,
        completed: completedRef.current,
        hadInterval: !!intervalRef.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!DEBUG_BREATHING) return;
    console.log(`[BreathingExercise:${debugIdRef.current}] isPaused changed`, { isPaused });
  }, [isPaused]);

  useEffect(() => {
    if (!DEBUG_BREATHING) return;
    console.log(`[BreathingExercise:${debugIdRef.current}] displayState`, displayState);
  }, [displayState]);

  // Main timer effect
  useEffect(() => {
    if (isPaused || completedRef.current) {
      if (intervalRef.current) {
        if (DEBUG_BREATHING) {
          console.log(`[BreathingExercise:${debugIdRef.current}] STOP interval (paused/completed)`, {
            isPaused,
            completed: completedRef.current,
            phaseIndexRef: phaseIndexRef.current,
            cycleRef: cycleRef.current,
            countdownRef: countdownRef.current,
          });
        }
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current) {
      if (DEBUG_BREATHING) {
        console.log(`[BreathingExercise:${debugIdRef.current}] interval already running; skipping start`, {
          phaseIndexRef: phaseIndexRef.current,
          cycleRef: cycleRef.current,
          countdownRef: countdownRef.current,
        });
      }
      return;
    }

    if (DEBUG_BREATHING) {
      console.log(`[BreathingExercise:${debugIdRef.current}] START interval`, {
        visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
        now: Date.now(),
        phaseIndexRef: phaseIndexRef.current,
        cycleRef: cycleRef.current,
        countdownRef: countdownRef.current,
        totalCycles,
      });
    }

    intervalRef.current = setInterval(() => {
      if (DEBUG_BREATHING) {
        console.log(`[BreathingExercise:${debugIdRef.current}] TICK (before)`, {
          t: Date.now(),
          visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
          phaseIndexRef: phaseIndexRef.current,
          cycleRef: cycleRef.current,
          countdownRef: countdownRef.current,
          currentPhase: config?.phases?.[phaseIndexRef.current]?.name,
        });
      }

      // Decrement countdown
      countdownRef.current -= 1;

      if (countdownRef.current <= 0) {
        // Move to next phase
        const nextIndex = phaseIndexRef.current + 1;

        if (nextIndex >= config.phases.length) {
          // End of cycle - check if we're done
          if (cycleRef.current >= totalCycles) {
            // Exercise complete!
            completedRef.current = true;
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            if (DEBUG_BREATHING) {
              console.log(`[BreathingExercise:${debugIdRef.current}] COMPLETE`, {
                t: Date.now(),
                finalCycle: cycleRef.current,
                finalPhaseIndex: phaseIndexRef.current,
              });
            }
            onCompleteRef.current();
            return;
          }
          // Start new cycle
          cycleRef.current += 1;
          phaseIndexRef.current = 0;
          countdownRef.current = config.phases[0]?.duration || 4;
          if (DEBUG_BREATHING) {
            console.log(`[BreathingExercise:${debugIdRef.current}] NEW CYCLE`, {
              t: Date.now(),
              cycle: cycleRef.current,
              phaseIndex: phaseIndexRef.current,
              countdown: countdownRef.current,
              phase: config?.phases?.[0]?.name,
            });
          }
        } else {
          // Move to next phase in current cycle
          phaseIndexRef.current = nextIndex;
          countdownRef.current = config.phases[nextIndex]?.duration || 4;
          if (DEBUG_BREATHING) {
            console.log(`[BreathingExercise:${debugIdRef.current}] NEXT PHASE`, {
              t: Date.now(),
              cycle: cycleRef.current,
              phaseIndex: phaseIndexRef.current,
              countdown: countdownRef.current,
              phase: config?.phases?.[phaseIndexRef.current]?.name,
            });
          }
        }
      }

      // Update display state
      setDisplayState({
        phaseIndex: phaseIndexRef.current,
        cycle: cycleRef.current,
        countdown: countdownRef.current,
      });

      if (DEBUG_BREATHING) {
        console.log(`[BreathingExercise:${debugIdRef.current}] TICK (after)`, {
          t: Date.now(),
          phaseIndexRef: phaseIndexRef.current,
          cycleRef: cycleRef.current,
          countdownRef: countdownRef.current,
          currentPhase: config?.phases?.[phaseIndexRef.current]?.name,
        });
      }
    }, 1000);

    if (DEBUG_BREATHING) {
      // Sanity check: if we don't see a tick within ~1.3s, something is wrong.
      const sanity = setTimeout(() => {
        console.log(`[BreathingExercise:${debugIdRef.current}] SANITY (1.3s after start)`, {
          intervalStillPresent: !!intervalRef.current,
          isPaused,
          completed: completedRef.current,
          phaseIndexRef: phaseIndexRef.current,
          cycleRef: cycleRef.current,
          countdownRef: countdownRef.current,
          visibility: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
        });
      }, 1300);
      // Clear sanity timeout on cleanup
      // eslint-disable-next-line consistent-return
      return () => {
        clearTimeout(sanity);
        if (intervalRef.current) {
          console.log(`[BreathingExercise:${debugIdRef.current}] CLEANUP interval`, {
            t: Date.now(),
            phaseIndexRef: phaseIndexRef.current,
            cycleRef: cycleRef.current,
            countdownRef: countdownRef.current,
          });
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        } else {
          console.log(`[BreathingExercise:${debugIdRef.current}] CLEANUP (no interval)`, { t: Date.now() });
        }
      };
    }

    return () => {
      if (intervalRef.current) {
        if (DEBUG_BREATHING) {
          console.log(`[BreathingExercise:${debugIdRef.current}] CLEANUP interval`, {
            t: Date.now(),
            phaseIndexRef: phaseIndexRef.current,
            cycleRef: cycleRef.current,
            countdownRef: countdownRef.current,
          });
        }
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPaused, config.phases, totalCycles]);

  // Calculate breath scale based on current phase
  const getBreathScale = () => {
    if (currentPhase?.name === 'inhale') return 1.4;
    if (currentPhase?.name === 'exhale') return 0.8;
    if (currentPhase?.name === 'hold') return 1.4; // Stay expanded
    if (currentPhase?.name === 'holdEmpty') return 0.8; // Stay contracted
    return 1;
  };

  const breathScale = getBreathScale();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center"
    >
      {/* Cycle indicator */}
      <div className="flex justify-center gap-2 mb-8">
        {Array.from({ length: totalCycles }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${
              i < displayState.cycle ? `bg-gradient-to-r ${categoryColor}` : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Breathing circle */}
      <div className="relative w-72 h-72 mx-auto mb-8">
        {/* Outer glow */}
        <motion.div
          animate={{ scale: breathScale }}
          transition={{ duration: currentPhase?.duration || 4, ease: 'easeInOut' }}
          className={`absolute inset-0 rounded-full bg-gradient-to-br ${categoryColor} opacity-20 blur-xl`}
        />
        
        {/* Main circle */}
        <motion.div
          animate={{ scale: breathScale }}
          transition={{ duration: currentPhase?.duration || 4, ease: 'easeInOut' }}
          className={`absolute inset-4 rounded-full bg-gradient-to-br ${categoryColor} opacity-40`}
        />
        
        {/* Inner circle with countdown */}
        <motion.div
          animate={{ scale: breathScale }}
          transition={{ duration: currentPhase?.duration || 4, ease: 'easeInOut' }}
          className={`absolute inset-12 rounded-full bg-gradient-to-br ${categoryColor} flex items-center justify-center`}
        >
          <span className="text-6xl font-bold text-white">{displayState.countdown}</span>
        </motion.div>
      </div>

      {/* Instruction */}
      <h2 className="text-2xl font-semibold text-white mb-2">
        {currentPhase?.instruction || 'Breathe'}
      </h2>
      <p className="text-white/60 mb-8">
        Cycle {displayState.cycle} of {totalCycles}
      </p>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={isPaused ? onResume : onPause}
          className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          {isPaused ? (
            <Play className="w-6 h-6 text-white" />
          ) : (
            <Pause className="w-6 h-6 text-white" />
          )}
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onComplete}
          className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <SkipForward className="w-6 h-6 text-white" />
        </motion.button>
      </div>
    </motion.div>
  );
};

// ============================================================================
// PROMPT EXERCISE
// ============================================================================

interface PromptExerciseProps {
  exercise: MentalExercise;
  isPaused: boolean;
  elapsedSeconds: number;
  categoryColor: string;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
  soundEnabled?: boolean;
  requiresWriting?: boolean;
  onStartInChat?: (exercise: MentalExercise) => void;
}

const PromptExercise: React.FC<PromptExerciseProps> = ({
  exercise,
  isPaused,
  elapsedSeconds,
  categoryColor,
  onPause,
  onResume,
  onComplete,
  soundEnabled = true,
  requiresWriting = false,
  onStartInChat,
}) => {
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [hasFinishedAllPrompts, setHasFinishedAllPrompts] = useState(false);
  const narrationRunIdRef = useRef(0);
  
  const config = exercise.exerciseConfig.config as any;
  const prompts = Array.isArray(config?.prompts) ? config.prompts.filter(Boolean) : [];
  const safeTotalPrompts = Math.max(1, prompts.length);
  const currentPrompt = prompts[currentPromptIndex];
  const isLastPrompt = prompts.length === 0 ? true : currentPromptIndex >= prompts.length - 1;
  const targetDuration = typeof config?.duration === 'number' ? config.duration : undefined;
  const remaining = targetDuration != null ? Math.max(0, targetDuration - elapsedSeconds) : undefined;

  const handleNext = () => {
    if (isLastPrompt) {
      // For writing exercises, redirect to chat instead of completing
      if (requiresWriting && onStartInChat) {
        onStartInChat(exercise);
      } else {
        onComplete();
      }
    } else {
      setCurrentPromptIndex((prev) => prev + 1);
    }
  };
  
  // Determine button text based on exercise type
  const getButtonText = () => {
    if (!isLastPrompt) return 'Next';
    if (requiresWriting) return 'Start Exercise';
    return 'Complete';
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="text-center"
    >
      {/* Progress */}
      <div className="flex items-center justify-between mb-8">
        <span className="text-white/60 text-sm">
          Step {Math.min(currentPromptIndex + 1, safeTotalPrompts)} of {safeTotalPrompts}
        </span>
        <span className="text-white/60 text-sm font-mono">
          {remaining != null ? formatTime(remaining) : formatTime(elapsedSeconds)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 rounded-full mb-10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(Math.min(currentPromptIndex + 1, safeTotalPrompts) / safeTotalPrompts) * 100}%` }}
          className={`h-full bg-gradient-to-r ${categoryColor}`}
        />
      </div>

      {/* Prompt */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPromptIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="min-h-[200px] flex items-center justify-center"
        >
          <p className="text-xl text-white leading-relaxed max-w-lg">
            {currentPrompt || 'Stay with this for a moment. When you’re ready, tap Complete.'}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Auto-advance narration: read each step, then advance when finished */}
      <AutoNarrator
        enabled={soundEnabled && !isPaused}
        text={currentPrompt || 'Stay with this for a moment. When you’re ready, tap Complete.'}
        onDone={() => {
          if (hasFinishedAllPrompts) return;
          if (!isLastPrompt) {
            setCurrentPromptIndex((prev) => prev + 1);
            return;
          }
          // last prompt finished reading → keep running until timer ends (if duration provided)
          setHasFinishedAllPrompts(true);
        }}
        runIdRef={narrationRunIdRef}
        voiceChoice={null}
      />

      {/* After all prompts are read, silently continue until timer ends (if duration exists) */}
      {hasFinishedAllPrompts && targetDuration != null && remaining === 0 && (
        <AutoCompleteOnce onComplete={onComplete} />
      )}

      {/* Controls */}
      <div className="flex justify-center gap-4 mt-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={isPaused ? onResume : onPause}
          className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          {isPaused ? (
            <Play className="w-6 h-6 text-white" />
          ) : (
            <Pause className="w-6 h-6 text-white" />
          )}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            stopNarration();
            handleNext();
          }}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r ${categoryColor} text-white font-semibold`}
        >
          {getButtonText()}
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
};

const AutoCompleteOnce: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  }, [onComplete]);
  return null;
};

const AutoNarrator: React.FC<{
  enabled: boolean;
  text: string;
  onDone: () => void;
  runIdRef: React.MutableRefObject<number>;
  voiceChoice?: VoiceChoice | null;
}> = ({ enabled, text, onDone, runIdRef, voiceChoice = null }) => {
  useEffect(() => {
    if (!enabled) return;
    const runId = (runIdRef.current += 1);
    // cancel any previous narration before starting new
    stopNarration();
    speakStep(text, {
      onEnd: () => {
        // ignore stale runs
        if (runIdRef.current !== runId) return;
        onDone();
      },
      onError: () => {
        // If TTS fails, don't block the flow — still advance
        if (runIdRef.current !== runId) return;
        onDone();
      },
    }, voiceChoice ?? null);
    return () => {
      // if text changes/unmounts, stop current narration
      if (runIdRef.current === runId) stopNarration();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, text, voiceChoice]);
  return null;
};

// ============================================================================
// COMPLETION SCREEN
// ============================================================================

interface CompletionScreenProps {
  exercise: MentalExercise;
  elapsedSeconds: number;
  preExerciseMood?: number;
  postExerciseMood?: number;
  categoryColor: string;
  onRate: (rating: number) => void;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({
  exercise,
  elapsedSeconds,
  preExerciseMood,
  postExerciseMood,
  categoryColor,
  onRate,
}) => {
  const moodImproved = postExerciseMood && preExerciseMood && postExerciseMood > preExerciseMood;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="text-center"
    >
      {/* Success icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.1 }}
        className={`mx-auto w-20 h-20 rounded-full bg-gradient-to-br ${categoryColor} flex items-center justify-center mb-6`}
      >
        <CheckCircle className="w-10 h-10 text-white" />
      </motion.div>

      <h2 className="text-2xl font-bold text-white mb-2">Well Done!</h2>
      <p className="text-white/60 mb-6">
        You completed {exercise.name}
      </p>

      {/* Stats */}
      <div className="flex justify-center gap-8 mb-8">
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{formatTime(elapsedSeconds)}</div>
          <div className="text-sm text-white/60">Duration</div>
        </div>
        
        {moodImproved && (
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">+{postExerciseMood! - preExerciseMood!}</div>
            <div className="text-sm text-white/60">Mood Change</div>
          </div>
        )}
      </div>

      {/* Rating prompt */}
      <p className="text-white/80 mb-4">How helpful was this exercise?</p>
      
      <div className="flex justify-center gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((rating) => (
          <motion.button
            key={rating}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onRate(rating)}
            className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition-colors"
          >
            {rating}
          </motion.button>
        ))}
      </div>

      <p className="text-sm text-white/40">1 = Not helpful, 5 = Very helpful</p>
    </motion.div>
  );
};

export default ExercisePlayer;
