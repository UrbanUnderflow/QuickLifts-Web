import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gauge, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import { DurationMode, PressureType, SessionType, TaxonomySkill } from '../../api/firebase/mentaltraining/taxonomy';
import type { SimBuildArtifact, SimModule } from '../../api/firebase/mentaltraining/types';
import { useInputIntegrity } from './useInputIntegrity';

interface EnduranceLockGameProps {
  exercise: SimModule;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
  onComplete: () => void;
  previewMode?: boolean;
}

type GameStage = 'intro' | 'active' | 'summary';

interface EnduranceCue {
  index: number;
  blockIndex: number;
  phaseTag: 'baseline' | 'middle' | 'finish';
  pressureTag: 'neutral' | 'pressure';
  cadenceMs: number;
  windowMs: number;
  prompt: string;
}

interface EnduranceResponse {
  cueIndex: number;
  blockIndex: number;
  phaseTag: 'baseline' | 'middle' | 'finish';
  pressureTag: 'neutral' | 'pressure';
  correct: boolean;
  latencyMs: number;
  response: 'tap' | 'timeout' | 'early';
}

const BLOCK_LABELS = ['Baseline', 'Settle', 'Load', 'Finish'];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function parseCueCount(targetSessionStructure?: string, durationMinutes?: number) {
  const match = targetSessionStructure?.match(/(\d+)/);
  if (match) return Math.max(24, Number(match[1]));
  return Math.max(24, (durationMinutes ?? 6) * 12);
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

function buildEnduranceCues(buildArtifact: SimBuildArtifact): EnduranceCue[] {
  const durationMinutes = Number(buildArtifact.sessionModel.durationMinutes ?? 6);
  const total = parseCueCount(buildArtifact.sessionModel.targetSessionStructure, durationMinutes);
  const blockCount = Math.max(4, Math.min(6, Math.round(total / 10)));
  const perBlock = Math.max(6, Math.ceil(total / blockCount));

  return Array.from({ length: total }, (_, index) => {
    const blockIndex = Math.min(blockCount - 1, Math.floor(index / perBlock));
    const progress = index / Math.max(1, total - 1);
    const cadenceMs = Math.max(780, 1320 - Math.round(progress * 260));
    const windowMs = Math.max(300, 520 - Math.round(progress * 130));
    const phaseTag = blockIndex === 0 ? 'baseline' : blockIndex >= blockCount - 1 ? 'finish' : 'middle';
    const pressureTag = phaseTag === 'finish' ? 'pressure' : 'neutral';

    return {
      index,
      blockIndex,
      phaseTag,
      pressureTag,
      cadenceMs,
      windowMs,
      prompt: phaseTag === 'finish'
        ? 'Hold form in the finish phase.'
        : phaseTag === 'middle'
          ? 'Keep the same clean rhythm under load.'
          : 'Lock the baseline cadence before fatigue builds.',
    };
  });
}

export const EnduranceLockGame: React.FC<EnduranceLockGameProps> = ({
  exercise,
  isPaused,
  onPause,
  onResume,
  onClose,
  onComplete,
  previewMode = false,
}) => {
  const currentUser = useUser();
  const buildArtifact = exercise.buildArtifact as SimBuildArtifact;
  const cues = useMemo(() => buildEnduranceCues(buildArtifact), [buildArtifact]);
  const durationMinutes = Number(buildArtifact.sessionModel.durationMinutes ?? 6);

  const [stage, setStage] = useState<GameStage>('intro');
  const [cueIndex, setCueIndex] = useState(0);
  const [responses, setResponses] = useState<EnduranceResponse[]>([]);
  const [cueActive, setCueActive] = useState(false);
  const [cueWindowMs, setCueWindowMs] = useState(420);
  const [pulseScale, setPulseScale] = useState(1);
  const [statusLabel, setStatusLabel] = useState('Tap on the pulse and keep the rhythm clean.');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [summaryDetail, setSummaryDetail] = useState('');

  const cueStartRef = useRef<number>(0);
  const cueResolvedRef = useRef(false);
  const recordedRef = useRef(false);
  const sessionStartedAtRef = useRef(Date.now());
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeWindowRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentCue = cues[cueIndex] ?? null;
  const {
    warningActive,
    warningMessage,
    registerInputAttempt,
    resetSession: resetInputSession,
    finalizeRound,
    spamDetected,
    spamFlags,
    spamRounds,
  } = useInputIntegrity({
    blockedMessage: 'Too fast. Stay with the cadence instead of spamming taps.',
  });

  const clearTimers = useCallback(() => {
    if (cueTimerRef.current) {
      clearTimeout(cueTimerRef.current);
      cueTimerRef.current = null;
    }
    if (closeWindowRef.current) {
      clearTimeout(closeWindowRef.current);
      closeWindowRef.current = null;
    }
    setCueActive(false);
    setPulseScale(1);
  }, []);

  const playPulse = useCallback((phaseTag: EnduranceCue['phaseTag']) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    const BrowserAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!BrowserAudioContext) return;
    const context = audioContextRef.current ?? new BrowserAudioContext();
    audioContextRef.current = context;
    if (context.state === 'suspended') {
      context.resume().catch(() => undefined);
    }
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = phaseTag === 'finish' ? 'square' : 'sine';
    oscillator.frequency.setValueAtTime(phaseTag === 'finish' ? 360 : 520, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  }, [soundEnabled]);

  const finishSession = useCallback(async (finalResponses: EnduranceResponse[]) => {
    const blockCount = Math.max(...finalResponses.map((response) => response.blockIndex), 0) + 1;
    const blockAccuracies = Array.from({ length: blockCount }, (_, index) => {
      const blockResponses = finalResponses.filter((response) => response.blockIndex === index);
      return blockResponses.filter((response) => response.correct).length / Math.max(1, blockResponses.length);
    });
    const baselinePerformance = blockAccuracies[0] ?? 1;
    const secondHalf = blockAccuracies.slice(Math.max(1, Math.floor(blockAccuracies.length / 2)));
    const finishPerformance = blockAccuracies[blockAccuracies.length - 1] ?? baselinePerformance;
    const degradationSlope = Number(((baselinePerformance - finishPerformance) / Math.max(1, secondHalf.length)).toFixed(3));
    const degradationOnset = blockAccuracies.findIndex((value, index) => index > 0 && value < baselinePerformance * 0.9);
    const finalPhaseBreakdowns = finalResponses.filter((response) => response.phaseTag === 'finish' && !response.correct).length;
    const avgLatency = finalResponses.reduce((sum, response) => sum + response.latencyMs, 0) / Math.max(1, finalResponses.length);
    const normalizedScore = clampScore(
      Math.round(finishPerformance * 100) - Math.round(finalPhaseBreakdowns * 2) - (spamDetected ? 25 : 0)
    );

    if (!previewMode && currentUser?.id && !recordedRef.current) {
      recordedRef.current = true;
      simSessionService.recordSession({
        userId: currentUser.id,
        simId: buildArtifact.variantId,
        simName: buildArtifact.variantName,
        legacyExerciseId: exercise.id,
        sessionType: buildArtifact.sessionModel.archetype === 'trial' ? SessionType.Reassessment : SessionType.PressureExposure,
        durationMode: getDurationMode(durationMinutes),
        durationSeconds: Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000)),
        coreMetricName: 'degradation_slope',
        coreMetricValue: degradationSlope,
        supportingMetrics: {
          baseline_performance: Number(baselinePerformance.toFixed(3)),
          degradation_onset: degradationOnset >= 0 ? degradationOnset + 1 : 0,
          final_phase_challenge: Number(finishPerformance.toFixed(3)),
          average_latency_ms: Math.round(avgLatency),
          block_1_accuracy: Number((blockAccuracies[0] ?? 0).toFixed(3)),
          block_2_accuracy: Number((blockAccuracies[1] ?? 0).toFixed(3)),
          block_3_accuracy: Number((blockAccuracies[2] ?? 0).toFixed(3)),
          block_4_accuracy: Number((blockAccuracies[3] ?? 0).toFixed(3)),
          rapid_input_flags: spamFlags,
          rapid_input_rounds: spamRounds,
          flagged_for_spam: spamDetected ? 1 : 0,
        },
        normalizedScore,
        targetSkills: [TaxonomySkill.SustainedAttention, TaxonomySkill.PressureStability],
        pressureTypes: [PressureType.Fatigue, PressureType.Time],
        createdAt: Date.now(),
      }).catch((error) => {
        console.error('Failed to record Endurance Lock session:', error);
      });
    }

    setSummaryDetail(
      `Baseline ${(baselinePerformance * 100).toFixed(0)}% · Finish ${(finishPerformance * 100).toFixed(0)}% · Degradation Slope ${degradationSlope.toFixed(3)} · Onset ${degradationOnset >= 0 ? `Block ${degradationOnset + 1}` : 'Stable'}${spamDetected ? ' · Session flagged for rapid input' : ''}`
    );
    setStage('summary');
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, previewMode, spamDetected, spamFlags, spamRounds]);

  const advanceAfterResponse = useCallback((nextResponses: EnduranceResponse[]) => {
    clearTimers();
    if (cueIndex >= cues.length - 1) {
      finishSession(nextResponses);
      return;
    }
    const nextIndex = cueIndex + 1;
    const upcoming = cues[nextIndex];
    setCueIndex(nextIndex);
    setStatusLabel(upcoming.phaseTag === 'finish'
      ? 'Fatigue and stakes are up. Keep the same clean timing.'
      : upcoming.phaseTag === 'middle'
        ? 'Load is building. Stay precise.'
        : 'Anchor the rhythm and keep it clean.');
    cueTimerRef.current = setTimeout(() => {
      if (isPaused) return;
      cueResolvedRef.current = false;
      cueStartRef.current = Date.now();
      setCueWindowMs(upcoming.windowMs);
      setCueActive(true);
      setPulseScale(1.28);
      playPulse(upcoming.phaseTag);
      closeWindowRef.current = setTimeout(() => {
        if (cueResolvedRef.current) return;
        cueResolvedRef.current = true;
        const timeoutResponse: EnduranceResponse = {
          cueIndex: upcoming.index,
          blockIndex: upcoming.blockIndex,
          phaseTag: upcoming.phaseTag,
          pressureTag: upcoming.pressureTag,
          correct: false,
          latencyMs: upcoming.windowMs,
          response: 'timeout',
        };
        const timeoutResponses = [...nextResponses, timeoutResponse];
        setResponses(timeoutResponses);
        setStatusLabel(upcoming.phaseTag === 'finish' ? 'Finish-phase miss logged. Recover the cadence immediately.' : 'Miss logged. Re-anchor the rhythm.');
        advanceAfterResponse(timeoutResponses);
      }, upcoming.windowMs);
    }, Math.max(280, upcoming.cadenceMs - upcoming.windowMs));
  }, [clearTimers, cueIndex, cues, finishSession, isPaused, playPulse]);

  const handleTap = useCallback(() => {
    if (stage !== 'active' || !currentCue) return;
    if (!registerInputAttempt()) {
      setStatusLabel('Rapid input blocked. Stay with the cadence.');
      return;
    }
    if (!cueActive) {
      setStatusLabel('Too early. Wait for the pulse window.');
      return;
    }
    if (cueResolvedRef.current) return;
    cueResolvedRef.current = true;
    finalizeRound();
    const latencyMs = Math.max(150, Date.now() - cueStartRef.current);
    const correct = latencyMs <= currentCue.windowMs;
    const nextResponse: EnduranceResponse = {
      cueIndex: currentCue.index,
      blockIndex: currentCue.blockIndex,
      phaseTag: currentCue.phaseTag,
      pressureTag: currentCue.pressureTag,
      correct,
      latencyMs,
      response: correct ? 'tap' : 'early',
    };
    const nextResponses = [...responses, nextResponse];
    setResponses(nextResponses);
    setStatusLabel(correct
      ? currentCue.phaseTag === 'finish'
        ? 'Clean finish-phase hold.'
        : 'Clean execution held.'
      : 'Out-of-window tap. Stay on the cadence.');
    advanceAfterResponse(nextResponses);
  }, [advanceAfterResponse, cueActive, currentCue, finalizeRound, registerInputAttempt, responses, stage]);

  const startSession = useCallback(() => {
    recordedRef.current = false;
    sessionStartedAtRef.current = Date.now();
    setResponses([]);
    setCueIndex(0);
    setSummaryDetail('');
    setStatusLabel('Anchor the cadence. The load will build.');
    resetInputSession();
    setStage('active');
  }, [resetInputSession]);

  useEffect(() => {
    if (stage !== 'active' || !currentCue || isPaused) return undefined;
    if (cueActive || cueTimerRef.current || closeWindowRef.current) return undefined;
    cueTimerRef.current = setTimeout(() => {
      cueResolvedRef.current = false;
      cueStartRef.current = Date.now();
      setCueWindowMs(currentCue.windowMs);
      setCueActive(true);
      setPulseScale(1.28);
      playPulse(currentCue.phaseTag);
      closeWindowRef.current = setTimeout(() => {
        if (cueResolvedRef.current) return;
        cueResolvedRef.current = true;
        const timeoutResponse: EnduranceResponse = {
          cueIndex: currentCue.index,
          blockIndex: currentCue.blockIndex,
          phaseTag: currentCue.phaseTag,
          pressureTag: currentCue.pressureTag,
          correct: false,
          latencyMs: currentCue.windowMs,
          response: 'timeout',
        };
        const nextResponses = [...responses, timeoutResponse];
        setResponses(nextResponses);
        setStatusLabel(currentCue.phaseTag === 'finish' ? 'Finish-phase miss logged. Recover the cadence immediately.' : 'Miss logged. Re-anchor the rhythm.');
        advanceAfterResponse(nextResponses);
      }, currentCue.windowMs);
    }, 500);

    return undefined;
  }, [advanceAfterResponse, cueActive, currentCue, isPaused, playPulse, responses, stage]);

  useEffect(() => {
    if (!cueActive) {
      setPulseScale(1);
      return undefined;
    }
    const reset = setTimeout(() => setPulseScale(1), 260);
    return () => clearTimeout(reset);
  }, [cueActive]);

  useEffect(() => {
    if (!isPaused) return undefined;
    clearTimers();
    return undefined;
  }, [clearTimers, isPaused]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
    };
  }, [clearTimers]);

  const blockCount = Math.max(...cues.map((cue) => cue.blockIndex), 0) + 1;
  const blockAccuracy = Array.from({ length: blockCount }, (_, index) => {
    const blockResponses = responses.filter((response) => response.blockIndex === index);
    return blockResponses.filter((response) => response.correct).length / Math.max(1, blockResponses.length || 1);
  });
  const progress = cues.length > 0 ? ((cueIndex + (cueActive ? 0.5 : 0)) / cues.length) * 100 : 0;

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#05070d] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.16),transparent_58%)]" />
      <button onClick={onClose} className="absolute left-6 top-6 z-20 w-12 h-12 rounded-full border border-white/10 bg-white/6 flex items-center justify-center hover:bg-white/10 transition-colors">
        <X className="w-5 h-5 text-white/80" />
      </button>
      <button
        onClick={() => setSoundEnabled((value) => !value)}
        className="absolute right-6 top-6 z-20 w-12 h-12 rounded-full border border-white/10 bg-white/6 flex items-center justify-center hover:bg-white/10 transition-colors"
      >
        {soundEnabled ? <Volume2 className="w-5 h-5 text-white/80" /> : <VolumeX className="w-5 h-5 text-white/80" />}
      </button>

      <AnimatePresence mode="wait">
        {stage === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full max-w-3xl px-6"
          >
            <div className="rounded-[28px] border border-cyan-500/20 bg-cyan-500/8 backdrop-blur-xl p-8 md:p-10">
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/65">Endurance Lock</p>
              <h2 className="text-4xl font-semibold mt-3">{buildArtifact.variantName}</h2>
              <p className="mt-4 text-lg text-white/70 max-w-2xl">
                Hold the same clean execution as the session lengthens, the window tightens, and finish-phase pressure rises.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Target Structure</p>
                  <p className="mt-2 text-2xl font-semibold">{buildArtifact.sessionModel.targetSessionStructure}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Metric</p>
                  <p className="mt-2 text-2xl font-semibold">Degradation Slope</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Goal</p>
                  <p className="mt-2 text-2xl font-semibold">Finish Clean</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-8">
                <button
                  onClick={startSession}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Begin Endurance Run
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {stage === 'active' && currentCue && (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl px-6"
          >
            <div className="rounded-[30px] border border-white/10 bg-black/35 backdrop-blur-xl p-8 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/45">Block {currentCue.blockIndex + 1} · {BLOCK_LABELS[currentCue.blockIndex] ?? 'Load'}</p>
                  <h3 className="text-3xl font-semibold mt-2">{currentCue.phaseTag === 'finish' ? 'Finish-Phase Control' : 'Clean Execution Under Load'}</h3>
                  <p className="text-white/60 mt-2">{currentCue.prompt}</p>
                </div>
                <button
                  onClick={isPaused ? onResume : onPause}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Cadence</p>
                  <p className="mt-2 text-2xl font-semibold">{currentCue.cadenceMs}ms</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Window</p>
                  <p className="mt-2 text-2xl font-semibold">{cueWindowMs}ms</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">Phase</p>
                  <p className="mt-2 text-2xl font-semibold">{currentCue.phaseTag === 'finish' ? 'Finish' : currentCue.phaseTag === 'middle' ? 'Load' : 'Baseline'}</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-cyan-500/15 bg-cyan-500/8 min-h-[320px] flex flex-col items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/60">Maintain Form</p>
                  <p className="text-white/60 mt-3">{statusLabel}</p>
                </div>

                {warningActive && (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {warningMessage}
                  </div>
                )}

                <motion.button
                  onClick={handleTap}
                  animate={{ scale: pulseScale, opacity: cueActive ? 1 : 0.88 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="relative w-44 h-44 rounded-full flex items-center justify-center"
                >
                  <div className="absolute inset-0 rounded-full bg-cyan-400/12 blur-2xl" />
                  <div className={`absolute inset-0 rounded-full border-2 ${cueActive ? 'border-cyan-300/90' : 'border-white/15'}`} />
                  <div className={`w-28 h-28 rounded-full flex items-center justify-center ${cueActive ? 'bg-cyan-400 text-black' : 'bg-white/10 text-white/70'}`}>
                    <Gauge className="w-9 h-9" />
                  </div>
                </motion.button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: blockCount }, (_, index) => {
                    const state = index < currentCue.blockIndex ? 'done' : index === currentCue.blockIndex ? 'current' : 'upcoming';
                    return (
                      <div
                        key={index}
                        className={`w-14 h-2 rounded-full ${state === 'done' ? 'bg-cyan-400' : state === 'current' ? 'bg-cyan-200' : 'bg-white/10'}`}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {blockAccuracy.map((accuracy, index) => (
                    <div key={index} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">{BLOCK_LABELS[index] ?? `Block ${index + 1}`}</p>
                      <p className="mt-1 text-lg font-semibold">{Math.round(accuracy * 100)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {stage === 'summary' && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full max-w-3xl px-6"
          >
            <div className="rounded-[28px] border border-cyan-500/20 bg-cyan-500/8 backdrop-blur-xl p-8 md:p-10 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/65">Session Summary</p>
                <h2 className="text-4xl font-semibold mt-3">{buildArtifact.variantName}</h2>
                <p className="mt-4 text-lg text-white/70">{summaryDetail}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Responses</p>
                  <p className="mt-2 text-2xl font-semibold">{responses.filter((response) => response.correct).length}/{responses.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Finish Accuracy</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {Math.round(
                      (responses.filter((response) => response.phaseTag === 'finish' && response.correct).length / Math.max(1, responses.filter((response) => response.phaseTag === 'finish').length)) * 100
                    )}%
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Preview Mode</p>
                  <p className="mt-2 text-2xl font-semibold">{previewMode ? 'On' : 'Live'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 md:col-span-3">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Input Integrity</p>
                  <p className="mt-2 text-2xl font-semibold">{spamDetected ? 'Flagged' : 'Clean'}</p>
                  <p className="mt-1 text-sm text-white/60">
                    {spamFlags} rapid-input flag{spamFlags === 1 ? '' : 's'} across {spamRounds} round{spamRounds === 1 ? '' : 's'}.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onComplete}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
                >
                  Finish Session
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
