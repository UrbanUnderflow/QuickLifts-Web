/**
 * Reset
 *
 * A matched reference versus post-interruption response task. The runtime
 * rehearses a fixed reset-and-return sequence and reports only task-specific
 * observations.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Play, Volume2, VolumeX, X } from 'lucide-react';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import {
  DurationMode,
  type ProfileSnapshotMilestone,
  PressureType,
  SessionType,
  TaxonomySkill,
} from '../../api/firebase/mentaltraining/taxonomy';
import type { SimBuildArtifact, SimModule } from '../../api/firebase/mentaltraining/types';
import { useUser } from '../../hooks/useUser';
import {
  buildResetRounds,
  calculateResetMeasurement,
  type ResetDirection,
  type ResetMeasurement,
  type ResetResponseContract,
} from './simulationFamilyMeasurement';

interface ResetGameProps {
  exercise: SimModule;
  onComplete: (data: {
    durationSeconds: number;
    preExerciseMood?: number;
    postExerciseMood?: number;
    helpfulnessRating?: number;
  }) => void;
  onClose: () => void;
  profileSnapshotMilestone?: Extract<ProfileSnapshotMilestone, 'midpoint' | 'endpoint' | 'retention'>;
  previewMode?: boolean;
  skipIntro?: boolean;
  initialSoundEnabled?: boolean;
}

type GameStage = 'intro' | 'ready' | 'hold' | 'interruption' | 'reset' | 'response' | 'feedback' | 'summary';

const INTERRUPTION_LABELS = [
  'Play stopped',
  'Call changed',
  'Unexpected whistle',
  'New information',
];

function parsePairCount(targetSessionStructure?: string) {
  const match = targetSessionStructure?.match(/(\d+)/);
  if (!match) return 12;
  const requested = Number(match[1]);
  const pairCount = /trial/i.test(targetSessionStructure ?? '') ? Math.ceil(requested / 2) : requested;
  return Math.max(6, Math.min(16, pairCount));
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

function formatSignedMilliseconds(value: number | null) {
  if (value === null) return 'Unavailable';
  return `${value > 0 ? '+' : ''}${value} ms`;
}

export const ResetGame: React.FC<ResetGameProps> = ({
  exercise,
  onComplete,
  onClose,
  profileSnapshotMilestone,
  previewMode = false,
  skipIntro = false,
  initialSoundEnabled = true,
}) => {
  const currentUser = useUser();
  const buildArtifact = exercise.buildArtifact as SimBuildArtifact | undefined;
  const durationMinutes = Number(buildArtifact?.sessionModel?.durationMinutes ?? exercise.durationMinutes ?? 3);
  const rounds = useMemo(
    () => buildResetRounds(parsePairCount(buildArtifact?.sessionModel?.targetSessionStructure)),
    [buildArtifact?.sessionModel?.targetSessionStructure]
  );

  const [stage, setStage] = useState<GameStage>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [measurement, setMeasurement] = useState<ResetMeasurement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);
  const [interruptionLabel, setInterruptionLabel] = useState(INTERRUPTION_LABELS[0]);

  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const responsesRef = useRef<ResetResponseContract[]>([]);
  const responseStartedAtRef = useRef(0);
  const resetStartedAtRef = useRef(0);
  const activeResetIntervalRef = useRef<number | null>(null);
  const roundResolvedRef = useRef(false);
  const roundGenerationRef = useRef(0);
  const recordedRef = useRef(false);
  const sessionStartedAtRef = useRef(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentRound = rounds[roundIndex] ?? null;
  const scoredTrialCount = rounds.filter((round) => !round.isPractice).length;
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

  const playInterruptionCue = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    const BrowserAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!BrowserAudioContext) return;
    const context = audioContextRef.current ?? new BrowserAudioContext();
    audioContextRef.current = context;
    if (context.state === 'suspended') context.resume().catch(() => undefined);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 210;
    gain.gain.setValueAtTime(0.055, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  }, [soundEnabled]);

  const recordSession = useCallback((result: ResetMeasurement, finalResponses: ResetResponseContract[]) => {
    if (previewMode || !currentUser?.id || recordedRef.current) return;
    recordedRef.current = true;
    const scored = finalResponses.filter((response) => !response.isPractice);
    const taskAccuracy = scored.filter((response) => response.correct).length / Math.max(1, scored.length);
    simSessionService.recordSession({
      userId: currentUser.id,
      simId: buildArtifact?.variantId ?? exercise.id,
      simName: buildArtifact?.variantName ?? exercise.name,
      legacyExerciseId: exercise.id,
      sessionType: SessionType.TrainingRep,
      durationMode: getDurationMode(durationMinutes),
      durationSeconds: Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000)),
      coreMetricName: 'post_disruption_reengagement_cost_ms',
      coreMetricValue: result.postDisruptionReengagementCostMs ?? 0,
      supportingMetrics: {
        estimate_available: result.postDisruptionReengagementCostMs === null ? 0 : 1,
        matched_pair_count: result.matchedPairCount,
        reference_accuracy: result.referenceAccuracy ?? 0,
        post_disruption_accuracy: result.postDisruptionAccuracy ?? 0,
        post_disruption_accuracy_cost: result.postDisruptionAccuracyCost ?? 0,
        first_post_disruption_correct_rate: result.firstPostDisruptionCorrectRate ?? 0,
        premature_response_rate: result.prematureResponseRate ?? 0,
        timeout_rate: result.timeoutRate ?? 0,
        mean_reset_interval_ms: result.meanResetIntervalMs ?? 0,
        scored_trial_count: scored.length,
      },
      normalizedScore: Math.round(taskAccuracy * 100),
      targetSkills: [TaxonomySkill.AttentionalShifting],
      pressureTypes: [PressureType.Visual, PressureType.Uncertainty],
      profileSnapshotMilestone,
      createdAt: Date.now(),
    }).catch((error) => console.error('Failed to record Reset session:', error));
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, exercise.name, previewMode, profileSnapshotMilestone]);

  const finishSession = useCallback((finalResponses: ResetResponseContract[]) => {
    roundGenerationRef.current += 1;
    clearTimers();
    const result = calculateResetMeasurement(finalResponses);
    setMeasurement(result);
    recordSession(result, finalResponses);
    setStage('summary');
  }, [clearTimers, recordSession]);

  const advance = useCallback((index: number, nextResponses: ResetResponseContract[], generation: number) => {
    schedule(() => {
      if (generation !== roundGenerationRef.current) return;
      if (index >= rounds.length - 1) {
        finishSession(nextResponses);
      } else {
        setRoundIndex(index + 1);
        beginRoundRef.current(index + 1);
      }
    }, rounds[index]?.isPractice ? 700 : 260);
  }, [finishSession, rounds, schedule]);

  const beginRoundRef = useRef<(index: number) => void>(() => undefined);
  const beginRound = useCallback((index: number) => {
    clearTimers();
    const generation = ++roundGenerationRef.current;
    const round = rounds[index];
    if (!round) return;

    roundResolvedRef.current = false;
    activeResetIntervalRef.current = null;
    setFeedback('');
    setStage('ready');

    const showResponse = () => {
      if (generation !== roundGenerationRef.current) return;
      responseStartedAtRef.current = Date.now();
      setStage('response');
      schedule(() => {
        if (generation !== roundGenerationRef.current || roundResolvedRef.current) return;
        roundResolvedRef.current = true;
        const response: ResetResponseContract = {
          ...round,
          resetIntervalMs: activeResetIntervalRef.current,
          correct: false,
          latencyMs: null,
          outcome: 'timeout',
        };
        const nextResponses = [...responsesRef.current, response];
        responsesRef.current = nextResponses;
        setFeedback(round.isPractice ? 'The response window closed.' : 'Trial recorded.');
        setStage('feedback');
        advance(index, nextResponses, generation);
      }, round.responseWindowMs);
    };

    schedule(() => {
      if (generation !== roundGenerationRef.current) return;
      if (round.condition === 'reference') {
        setStage('hold');
        schedule(showResponse, round.preTargetDelayMs);
        return;
      }

      setInterruptionLabel(INTERRUPTION_LABELS[index % INTERRUPTION_LABELS.length]);
      setStage('interruption');
      playInterruptionCue();
      schedule(() => {
        if (generation !== roundGenerationRef.current) return;
        resetStartedAtRef.current = Date.now();
        setStage('reset');
        schedule(() => {
          if (generation !== roundGenerationRef.current) return;
          activeResetIntervalRef.current = Date.now() - resetStartedAtRef.current;
          showResponse();
        }, round.resetIntervalMs ?? 800);
      }, round.interruptionDurationMs);
    }, 550);
  }, [advance, clearTimers, playInterruptionCue, rounds, schedule]);

  beginRoundRef.current = beginRound;

  const handleDirection = useCallback((direction: ResetDirection) => {
    if (stage !== 'response' || !currentRound || roundResolvedRef.current) return;
    roundResolvedRef.current = true;
    const generation = roundGenerationRef.current;
    clearTimers();
    const latencyMs = Date.now() - responseStartedAtRef.current;
    const correct = direction === currentRound.direction && latencyMs >= 150;
    const response: ResetResponseContract = {
      ...currentRound,
      resetIntervalMs: activeResetIntervalRef.current,
      correct,
      latencyMs,
      outcome: latencyMs < 150 ? 'premature' : 'response',
    };
    const nextResponses = [...responsesRef.current, response];
    responsesRef.current = nextResponses;
    setFeedback(currentRound.isPractice
      ? correct ? 'Direction matched.' : 'Match the arrow direction.'
      : 'Trial recorded.');
    setStage('feedback');
    advance(roundIndex, nextResponses, generation);
  }, [advance, clearTimers, currentRound, roundIndex, stage]);

  const startSession = useCallback(() => {
    clearTimers();
    responsesRef.current = [];
    recordedRef.current = false;
    sessionStartedAtRef.current = Date.now();
    setMeasurement(null);
    setRoundIndex(0);
    beginRound(0);
  }, [beginRound, clearTimers]);

  useEffect(() => {
    if (skipIntro && stage === 'intro') startSession();
  }, [skipIntro, stage, startSession]);

  useEffect(() => () => {
    roundGenerationRef.current += 1;
    clearTimers();
    audioContextRef.current?.close().catch(() => undefined);
  }, [clearTimers]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 overflow-hidden bg-[#09090c] text-white">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5">
        <button aria-label="Close" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"><X className="h-5 w-5" /></button>
        <button aria-label={soundEnabled ? 'Mute' : 'Unmute'} onClick={() => setSoundEnabled((value) => !value)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5">
          {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </header>

      <main className="flex h-full items-center justify-center px-5 pb-8 pt-24">
        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <motion.section key="intro" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-300">Reset</p>
                <h1 className="mt-3 text-4xl font-semibold">Return to the same task</h1>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/65">Match each arrow with left or right. Some trials begin normally. Others add a brief interruption and a fixed reset interval before the same arrow task returns.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-white/10 bg-white/[0.04] p-5"><ArrowLeft className="h-8 w-8" /><p className="mt-3 text-sm text-white/55">Left arrow uses the left key</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-5"><ArrowRight className="h-8 w-8" /><p className="mt-3 text-sm text-white/55">Right arrow uses the right key</p></div>
              </div>
              <p className="text-sm text-white/45">Two practice trials come first. The summary compares matched correct responses and keeps accuracy separate from response time.</p>
              <button onClick={startSession} className="inline-flex items-center gap-2 bg-[#E0FE10] px-5 py-3 font-semibold text-black"><Play className="h-4 w-4" />Start practice</button>
            </motion.section>
          )}

          {(stage === 'ready' || stage === 'hold' || stage === 'interruption' || stage === 'reset' || stage === 'response' || stage === 'feedback') && currentRound && (
            <motion.section key={`${roundIndex}-${stage}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-2xl">
              <div className="mb-7 flex justify-between text-sm text-white/45">
                <span>{currentRound.isPractice ? `Practice ${roundIndex + 1} of 2` : `Trial ${roundIndex - 1} of ${scoredTrialCount}`}</span>
                <span>{currentRound.isPractice ? 'Practice' : 'Scored'}</span>
              </div>
              <div className="mb-8 h-1 bg-white/10"><div className="h-full bg-red-400 transition-all" style={{ width: `${progress}%` }} /></div>
              <div className="flex min-h-[380px] flex-col items-center justify-center border border-white/10 bg-white/[0.035] p-8">
                {stage === 'ready' && <p className="text-lg text-white/45">Get ready</p>}
                {stage === 'hold' && <div className="h-4 w-4 rounded-full bg-white/35" />}
                {stage === 'interruption' && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="border border-red-400/35 bg-red-500/10 px-8 py-7 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-300">Interruption</p>
                    <p className="mt-3 text-3xl font-semibold">{interruptionLabel}</p>
                  </motion.div>
                )}
                {stage === 'reset' && (
                  <div className="text-center">
                    <div className="mx-auto h-28 w-28 rounded-full border-2 border-cyan-300/35 bg-cyan-300/10" />
                    <p className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200">Reset interval</p>
                    <p className="mt-2 text-white/50">Pause. Reorient. Return.</p>
                  </div>
                )}
                {stage === 'response' && <span className="text-[9rem] font-light leading-none">{currentRound.direction === 'left' ? '←' : '→'}</span>}
                {stage === 'feedback' && <p className="text-xl text-white/70">{feedback}</p>}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <button aria-label="Respond left" onClick={() => handleDirection('left')} disabled={stage !== 'response'} className="grid h-24 place-items-center border border-white/12 bg-white/[0.05] disabled:opacity-30"><ArrowLeft className="h-9 w-9" /></button>
                <button aria-label="Respond right" onClick={() => handleDirection('right')} disabled={stage !== 'response'} className="grid h-24 place-items-center border border-white/12 bg-white/[0.05] disabled:opacity-30"><ArrowRight className="h-9 w-9" /></button>
              </div>
            </motion.section>
          )}

          {stage === 'summary' && measurement && (
            <motion.section key="summary" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-300">Session summary</p>
                <h2 className="mt-3 text-3xl font-semibold">Reset-and-return trials recorded</h2>
                <p className="mt-3 text-white/60">The response-time difference describes this arrow task. It does not measure emotional recovery, resilience, or competition readiness.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Post-interruption response-time difference</p><p className="mt-2 text-2xl font-semibold">{formatSignedMilliseconds(measurement.postDisruptionReengagementCostMs)}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Matched pairs</p><p className="mt-2 text-2xl font-semibold">{measurement.matchedPairCount}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Reference accuracy</p><p className="mt-2 text-2xl font-semibold">{measurement.referenceAccuracy === null ? 'Unavailable' : `${Math.round(measurement.referenceAccuracy * 100)}%`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Post-interruption accuracy</p><p className="mt-2 text-2xl font-semibold">{measurement.postDisruptionAccuracy === null ? 'Unavailable' : `${Math.round(measurement.postDisruptionAccuracy * 100)}%`}</p></div>
              </div>
              <p className="border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">A positive response-time difference means correct responses were slower after interruptions than on their matched reference trials. Faster is not automatically better.</p>
              <button onClick={() => onComplete({ durationSeconds: Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000)) })} className="bg-[#E0FE10] px-5 py-3 font-semibold text-black">Finish</button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
};

export default ResetGame;
