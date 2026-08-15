import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import {
  DurationMode,
  type ProfileSnapshotMilestone,
  PressureType,
  SessionType,
  TaxonomySkill,
} from '../../api/firebase/mentaltraining/taxonomy';
import type { SimBuildArtifact, SimModule } from '../../api/firebase/mentaltraining/types';
import {
  buildSequenceShiftRounds,
  calculateSequenceShiftMeasurement,
  type SequenceShiftMeasurement,
  type SequenceShiftResponseContract,
  type SequenceSide,
} from './simulationFamilyMeasurement';

interface SequenceShiftGameProps {
  exercise: SimModule;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
  onComplete: () => void;
  profileSnapshotMilestone?: Extract<ProfileSnapshotMilestone, 'midpoint' | 'endpoint' | 'retention'>;
  previewMode?: boolean;
  skipIntro?: boolean;
  initialSoundEnabled?: boolean;
}

type GameStage = 'intro' | 'ready' | 'cue' | 'response' | 'feedback' | 'summary';

function parseTrialCount(targetSessionStructure?: string) {
  const match = targetSessionStructure?.match(/(\d+)/);
  return Math.max(48, match ? Number(match[1]) : 48);
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

export const SequenceShiftGame: React.FC<SequenceShiftGameProps> = ({
  exercise,
  isPaused,
  onPause,
  onResume,
  onClose,
  onComplete,
  profileSnapshotMilestone,
  previewMode = false,
  skipIntro = false,
  initialSoundEnabled = true,
}) => {
  const currentUser = useUser();
  const buildArtifact = exercise.buildArtifact as SimBuildArtifact;
  const durationMinutes = Number(buildArtifact.sessionModel.durationMinutes ?? 4);
  const rounds = useMemo(
    () => buildSequenceShiftRounds(parseTrialCount(buildArtifact.sessionModel.targetSessionStructure)),
    [buildArtifact.sessionModel.targetSessionStructure]
  );
  const [stage, setStage] = useState<GameStage>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [, setResponses] = useState<SequenceShiftResponseContract[]>([]);
  const [feedback, setFeedback] = useState('');
  const [measurement, setMeasurement] = useState<SequenceShiftMeasurement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);

  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const responsesRef = useRef<SequenceShiftResponseContract[]>([]);
  const responseStartedAtRef = useRef(0);
  const roundResolvedRef = useRef(false);
  const pausedRoundRef = useRef(false);
  const recordedRef = useRef(false);
  const sessionStartedAtRef = useRef(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentRound = rounds[roundIndex] ?? null;
  const progress = rounds.length ? (roundIndex / rounds.length) * 100 : 0;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((callback: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      timersRef.current = timersRef.current.filter((candidate) => candidate !== timer);
      callback();
    }, delayMs);
    timersRef.current.push(timer);
  }, []);

  const playCue = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    const BrowserAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!BrowserAudioContext) return;
    const context = audioContextRef.current ?? new BrowserAudioContext();
    audioContextRef.current = context;
    if (context.state === 'suspended') context.resume().catch(() => undefined);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.055, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
  }, [soundEnabled]);

  const recordSession = useCallback((result: SequenceShiftMeasurement, finalResponses: SequenceShiftResponseContract[]) => {
    if (previewMode || !currentUser?.id || recordedRef.current) return;
    recordedRef.current = true;
    simSessionService.recordSession({
      userId: currentUser.id,
      simId: buildArtifact.variantId,
      simName: buildArtifact.variantName,
      legacyExerciseId: exercise.id,
      sessionType: SessionType.TrainingRep,
      durationMode: getDurationMode(durationMinutes),
      durationSeconds: Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000)),
      coreMetricName: 'switch_rt_cost_ms',
      coreMetricValue: result.switchRtCostMs ?? 0,
      supportingMetrics: {
        switch_rt_available: result.switchRtCostMs === null ? 0 : 1,
        switch_accuracy_cost: result.switchAccuracyCost ?? 0,
        repeat_accuracy: result.repeatAccuracy ?? 0,
        switch_accuracy: result.switchAccuracy ?? 0,
        perseverative_error_rate: result.perseverativeErrorRate ?? 0,
        timeout_rate: result.timeoutRate ?? 0,
        premature_response_rate: result.prematureResponseRate ?? 0,
        valid_repeat_rt_count: result.validRepeatRtCount,
        valid_switch_rt_count: result.validSwitchRtCount,
        scored_trial_count: finalResponses.filter((response) => !response.isPractice).length,
      },
      normalizedScore: Math.round((result.switchAccuracy ?? 0) * 100),
      targetSkills: [TaxonomySkill.AttentionalShifting],
      pressureTypes: [PressureType.Uncertainty, PressureType.Time],
      profileSnapshotMilestone,
      createdAt: Date.now(),
    }).catch((error) => console.error('Failed to record Sequence Shift session:', error));
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, previewMode, profileSnapshotMilestone]);

  const finishSession = useCallback((finalResponses: SequenceShiftResponseContract[]) => {
    clearTimers();
    const result = calculateSequenceShiftMeasurement(finalResponses);
    setMeasurement(result);
    recordSession(result, finalResponses);
    setStage('summary');
  }, [clearTimers, recordSession]);

  const advance = useCallback((index: number, nextResponses: SequenceShiftResponseContract[]) => {
    schedule(() => {
      if (index >= rounds.length - 1) finishSession(nextResponses);
      else {
        setRoundIndex(index + 1);
        setStage('ready');
      }
    }, rounds[index]?.isPractice ? 850 : 280);
  }, [finishSession, rounds, schedule]);

  const beginRound = useCallback((index: number) => {
    clearTimers();
    const round = rounds[index];
    if (!round) return;
    roundResolvedRef.current = false;
    setFeedback('');
    setStage('ready');
    schedule(() => {
      playCue();
      setStage('cue');
      schedule(() => {
        responseStartedAtRef.current = Date.now();
        setStage('response');
        schedule(() => {
          if (roundResolvedRef.current) return;
          roundResolvedRef.current = true;
          const response: SequenceShiftResponseContract = {
            ...round,
            responseSide: null,
            correct: false,
            responseLatencyMs: null,
            outcome: 'timeout',
          };
          const nextResponses = [...responsesRef.current, response];
          responsesRef.current = nextResponses;
          setResponses(nextResponses);
          setFeedback(round.isPractice ? 'The response window closed.' : 'Trial recorded.');
          setStage('feedback');
          advance(index, nextResponses);
        }, round.responseWindowMs);
      }, round.cueStimulusIntervalMs);
    }, 500);
  }, [advance, clearTimers, playCue, rounds, schedule]);

  const handleChoice = useCallback((side: SequenceSide) => {
    if (stage !== 'response' || !currentRound || roundResolvedRef.current || isPaused) return;
    roundResolvedRef.current = true;
    clearTimers();
    const latencyMs = Date.now() - responseStartedAtRef.current;
    const correct = side === currentRound.correctSide && latencyMs >= 150;
    const response: SequenceShiftResponseContract = {
      ...currentRound,
      responseSide: side,
      correct,
      responseLatencyMs: latencyMs,
      outcome: latencyMs < 150 ? 'premature' : 'response',
    };
    const nextResponses = [...responsesRef.current, response];
    responsesRef.current = nextResponses;
    setResponses(nextResponses);
    setFeedback(currentRound.isPractice
      ? correct ? 'Classification matched the active rule.' : 'Use the rule shown above the pair.'
      : 'Trial recorded.');
    setStage('feedback');
    advance(roundIndex, nextResponses);
  }, [advance, clearTimers, currentRound, isPaused, roundIndex, stage]);

  const startSession = useCallback(() => {
    clearTimers();
    responsesRef.current = [];
    setResponses([]);
    setMeasurement(null);
    setRoundIndex(0);
    recordedRef.current = false;
    sessionStartedAtRef.current = Date.now();
    beginRound(0);
  }, [beginRound, clearTimers]);

  useEffect(() => {
    if (skipIntro && stage === 'intro') startSession();
  }, [skipIntro, stage, startSession]);

  useEffect(() => {
    if (isPaused) {
      if (stage === 'ready' || stage === 'cue' || stage === 'response') {
        clearTimers();
        pausedRoundRef.current = true;
        setStage('ready');
      }
      return;
    }
    if (pausedRoundRef.current) {
      pausedRoundRef.current = false;
      beginRound(roundIndex);
    }
  }, [beginRound, clearTimers, isPaused, roundIndex, stage]);

  useEffect(() => {
    if (stage === 'ready' && !isPaused && roundIndex > 0 && !timersRef.current.length) beginRound(roundIndex);
  }, [beginRound, isPaused, roundIndex, stage]);

  useEffect(() => () => {
    clearTimers();
    audioContextRef.current?.close().catch(() => undefined);
  }, [clearTimers]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 overflow-hidden bg-[#0a0810] text-white">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5">
        <button aria-label="Close" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"><X className="h-5 w-5" /></button>
        <div className="flex gap-2">
          <button aria-label={soundEnabled ? 'Mute' : 'Unmute'} onClick={() => setSoundEnabled((value) => !value)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5">{soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</button>
          {stage !== 'intro' && stage !== 'summary' && <button aria-label={isPaused ? 'Resume' : 'Pause'} onClick={isPaused ? onResume : onPause} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5">{isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</button>}
        </div>
      </header>

      <main className="flex h-full items-center justify-center px-5 pb-8 pt-24">
        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <motion.section key="intro" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-7">
              <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-300">Sequence Shift</p><h1 className="mt-3 text-4xl font-semibold">Change the rule, keep the keys</h1><p className="mt-4 max-w-xl text-lg leading-relaxed text-white/65">Each pair contains a letter and a number. Follow the rule shown above it. The same two response keys work for both rules.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-white/10 bg-white/[0.04] p-5"><p className="text-xs uppercase tracking-wider text-white/40">Left key</p><p className="mt-2 text-xl font-semibold">Vowel or odd</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-5"><p className="text-xs uppercase tracking-wider text-white/40">Right key</p><p className="mt-2 text-xl font-semibold">Consonant or even</p></div>
              </div>
              <p className="text-sm text-white/45">The first six trials teach both rules. Scored trials balance rule repeats and rule switches with the same response window.</p>
              <button onClick={startSession} className="inline-flex items-center gap-2 bg-[#E0FE10] px-5 py-3 font-semibold text-black"><Play className="h-4 w-4" />Start practice</button>
            </motion.section>
          )}

          {(stage === 'ready' || stage === 'cue' || stage === 'response' || stage === 'feedback') && currentRound && (
            <motion.section key={`${roundIndex}-${stage}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-2xl">
              <div className="mb-7 flex justify-between text-sm text-white/45"><span>{currentRound.isPractice ? `Practice ${roundIndex + 1} of 6` : `Trial ${roundIndex - 5} of ${rounds.length - 6}`}</span><span>{currentRound.isPractice ? 'Practice' : 'Scored'}</span></div>
              <div className="mb-8 h-1 bg-white/10"><div className="h-full bg-violet-400 transition-all" style={{ width: `${progress}%` }} /></div>
              <div className="flex min-h-[360px] flex-col items-center justify-center border border-white/10 bg-white/[0.035] p-7">
                {stage === 'ready' && <p className="text-lg text-white/45">Get ready</p>}
                {stage === 'cue' && <p className="text-sm font-semibold uppercase tracking-[0.32em] text-violet-300">Use the {currentRound.rule}</p>}
                {stage === 'response' && <div className="text-center"><p className="text-sm font-semibold uppercase tracking-[0.32em] text-violet-300">Use the {currentRound.rule}</p><div className="mt-8 flex items-center justify-center gap-7 text-7xl font-semibold"><span>{currentRound.letter}</span><span className="text-white/20">·</span><span>{currentRound.number}</span></div></div>}
                {stage === 'feedback' && <p className="text-xl text-white/70">{feedback}</p>}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <button onClick={() => handleChoice('left')} disabled={stage !== 'response' || isPaused} className="h-24 border border-white/12 bg-white/[0.05] px-3 disabled:opacity-30"><span className="block text-lg font-semibold">Vowel / Odd</span><span className="mt-1 block text-xs text-white/40">Left</span></button>
                <button onClick={() => handleChoice('right')} disabled={stage !== 'response' || isPaused} className="h-24 border border-white/12 bg-white/[0.05] px-3 disabled:opacity-30"><span className="block text-lg font-semibold">Consonant / Even</span><span className="mt-1 block text-xs text-white/40">Right</span></button>
              </div>
            </motion.section>
          )}

          {stage === 'summary' && measurement && (
            <motion.section key="summary" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6">
              <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-300">Session summary</p><h2 className="mt-3 text-3xl font-semibold">Rule switching recorded</h2><p className="mt-3 text-white/60">The difference below describes this cued task. It is not a general working-memory or game-readiness score.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Switch response-time difference</p><p className="mt-2 text-2xl font-semibold">{measurement.switchRtCostMs === null ? 'Unavailable' : `${measurement.switchRtCostMs} ms`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Accuracy cost</p><p className="mt-2 text-2xl font-semibold">{measurement.switchAccuracyCost === null ? 'Unavailable' : `${Math.round(measurement.switchAccuracyCost * 100)}%`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Repeat accuracy</p><p className="mt-2 text-2xl font-semibold">{measurement.repeatAccuracy === null ? 'Unavailable' : `${Math.round(measurement.repeatAccuracy * 100)}%`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Switch accuracy</p><p className="mt-2 text-2xl font-semibold">{measurement.switchAccuracy === null ? 'Unavailable' : `${Math.round(measurement.switchAccuracy * 100)}%`}</p></div>
              </div>
              <button onClick={onComplete} className="bg-[#E0FE10] px-5 py-3 font-semibold text-black">Finish</button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
};

export default SequenceShiftGame;
