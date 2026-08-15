import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleDot, Pause, Play, X } from 'lucide-react';
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
  buildEnduranceLockRounds,
  calculateEnduranceLockMeasurement,
  type EnduranceLockMeasurement,
  type EnduranceLockResponseContract,
} from './simulationFamilyMeasurement';

interface EnduranceLockGameProps {
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

type GameStage = 'intro' | 'waiting' | 'cue' | 'feedback' | 'summary';

function parseTrialCount(targetSessionStructure?: string, durationMinutes = 4) {
  const match = targetSessionStructure?.match(/(\d+)/);
  return Math.max(36, match ? Number(match[1]) : durationMinutes * 12);
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

export const EnduranceLockGame: React.FC<EnduranceLockGameProps> = ({
  exercise,
  isPaused,
  onPause,
  onResume,
  onClose,
  onComplete,
  profileSnapshotMilestone,
  previewMode = false,
  skipIntro = false,
}) => {
  const currentUser = useUser();
  const buildArtifact = exercise.buildArtifact as SimBuildArtifact;
  const durationMinutes = Number(buildArtifact.sessionModel.durationMinutes ?? 4);
  const rounds = useMemo(
    () => buildEnduranceLockRounds(parseTrialCount(buildArtifact.sessionModel.targetSessionStructure, durationMinutes)),
    [buildArtifact.sessionModel.targetSessionStructure, durationMinutes]
  );
  const [stage, setStage] = useState<GameStage>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [, setResponses] = useState<EnduranceLockResponseContract[]>([]);
  const [feedback, setFeedback] = useState('');
  const [measurement, setMeasurement] = useState<EnduranceLockMeasurement | null>(null);

  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const responsesRef = useRef<EnduranceLockResponseContract[]>([]);
  const cueStartedAtRef = useRef(0);
  const roundResolvedRef = useRef(false);
  const pausedRoundRef = useRef(false);
  const recordedRef = useRef(false);
  const sessionStartedAtRef = useRef(Date.now());
  const scoredStartedAtRef = useRef(Date.now());

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

  const recordSession = useCallback((result: EnduranceLockMeasurement, finalResponses: EnduranceLockResponseContract[]) => {
    if (previewMode || !currentUser?.id || recordedRef.current) return;
    recordedRef.current = true;
    simSessionService.recordSession({
      userId: currentUser.id,
      simId: buildArtifact.variantId,
      simName: buildArtifact.variantName,
      legacyExerciseId: exercise.id,
      sessionType: SessionType.Probe,
      durationMode: getDurationMode(durationMinutes),
      durationSeconds: Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000)),
      coreMetricName: 'correct_rt_slope_ms_per_min',
      coreMetricValue: result.correctRtSlopeMsPerMin ?? 0,
      supportingMetrics: {
        slope_estimate_available: result.estimateAvailable ? 1 : 0,
        median_correct_rt_ms: result.medianCorrectRtMs ?? 0,
        rt_variability_ms: result.rtVariabilityMs ?? 0,
        lapse_rate: result.lapseRate ?? 0,
        false_start_rate: result.falseStartRate ?? 0,
        timeout_rate: result.timeoutRate ?? 0,
        valid_response_count: result.validResponseCount,
        block_1_valid_trials: result.blockValidTrialCounts[0] ?? 0,
        block_2_valid_trials: result.blockValidTrialCounts[1] ?? 0,
        block_3_valid_trials: result.blockValidTrialCounts[2] ?? 0,
        block_4_valid_trials: result.blockValidTrialCounts[3] ?? 0,
        block_5_valid_trials: result.blockValidTrialCounts[4] ?? 0,
        block_6_valid_trials: result.blockValidTrialCounts[5] ?? 0,
        scored_trial_count: finalResponses.filter((response) => !response.isPractice).length,
      },
      normalizedScore: Math.round((result.validResponseCount / Math.max(1, finalResponses.filter((response) => !response.isPractice).length)) * 100),
      targetSkills: [TaxonomySkill.SustainedAttention],
      pressureTypes: [PressureType.Time],
      profileSnapshotMilestone,
      createdAt: Date.now(),
    }).catch((error) => console.error('Failed to record Endurance Lock session:', error));
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, previewMode, profileSnapshotMilestone]);

  const finishSession = useCallback((finalResponses: EnduranceLockResponseContract[]) => {
    clearTimers();
    const result = calculateEnduranceLockMeasurement(finalResponses);
    setMeasurement(result);
    recordSession(result, finalResponses);
    setStage('summary');
  }, [clearTimers, recordSession]);

  const advance = useCallback((index: number, nextResponses: EnduranceLockResponseContract[]) => {
    schedule(() => {
      if (index >= rounds.length - 1) finishSession(nextResponses);
      else {
        const nextIndex = index + 1;
        if (rounds[nextIndex] && !rounds[nextIndex].isPractice && rounds[index]?.isPractice) {
          scoredStartedAtRef.current = Date.now();
        }
        setRoundIndex(nextIndex);
        setStage('waiting');
      }
    }, rounds[index]?.isPractice ? 700 : 220);
  }, [finishSession, rounds, schedule]);

  const resolve = useCallback((outcome: EnduranceLockResponseContract['outcome'], latencyMs: number | null) => {
    if (!currentRound || roundResolvedRef.current) return;
    roundResolvedRef.current = true;
    clearTimers();
    const response: EnduranceLockResponseContract = {
      ...currentRound,
      onsetMs: Math.max(0, cueStartedAtRef.current - scoredStartedAtRef.current),
      responseLatencyMs: latencyMs,
      outcome,
    };
    const nextResponses = [...responsesRef.current, response];
    responsesRef.current = nextResponses;
    setResponses(nextResponses);
    setFeedback(currentRound.isPractice
      ? outcome === 'response' ? 'Tap recorded after the center circle lit up.' : outcome === 'false_start' ? 'Wait until the center circle lights up.' : 'The response window closed.'
      : 'Trial recorded.');
    setStage('feedback');
    advance(roundIndex, nextResponses);
  }, [advance, clearTimers, currentRound, roundIndex]);

  const beginRound = useCallback((index: number) => {
    clearTimers();
    const round = rounds[index];
    if (!round) return;
    roundResolvedRef.current = false;
    cueStartedAtRef.current = 0;
    setFeedback('');
    setStage('waiting');
    schedule(() => {
      if (roundResolvedRef.current) return;
      cueStartedAtRef.current = Date.now();
      setStage('cue');
      schedule(() => {
        if (!roundResolvedRef.current) resolve('timeout', null);
      }, round.responseWindowMs);
    }, round.foreperiodMs);
  }, [clearTimers, resolve, rounds, schedule]);

  const handleTap = useCallback(() => {
    if (isPaused || !currentRound || roundResolvedRef.current) return;
    if (stage === 'waiting') {
      resolve('false_start', null);
      return;
    }
    if (stage === 'cue') {
      resolve('response', Date.now() - cueStartedAtRef.current);
    }
  }, [currentRound, isPaused, resolve, stage]);

  const startSession = useCallback(() => {
    clearTimers();
    responsesRef.current = [];
    setResponses([]);
    setMeasurement(null);
    setRoundIndex(0);
    recordedRef.current = false;
    sessionStartedAtRef.current = Date.now();
    scoredStartedAtRef.current = Date.now();
    beginRound(0);
  }, [beginRound, clearTimers]);

  useEffect(() => {
    if (skipIntro && stage === 'intro') startSession();
  }, [skipIntro, stage, startSession]);

  useEffect(() => {
    if (isPaused) {
      if (stage === 'waiting' || stage === 'cue') {
        clearTimers();
        pausedRoundRef.current = true;
        setStage('waiting');
      }
      return;
    }
    if (pausedRoundRef.current) {
      pausedRoundRef.current = false;
      beginRound(roundIndex);
    }
  }, [beginRound, clearTimers, isPaused, roundIndex, stage]);

  useEffect(() => {
    if (stage === 'waiting' && !isPaused && roundIndex > 0 && !timersRef.current.length) beginRound(roundIndex);
  }, [beginRound, isPaused, roundIndex, stage]);

  useEffect(() => () => {
    clearTimers();
  }, [clearTimers]);

  const currentBlock = currentRound?.isPractice ? null : currentRound?.blockIndex ?? null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 overflow-hidden bg-[#070b0e] text-white">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5">
        <button aria-label="Close" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"><X className="h-5 w-5" /></button>
        {stage !== 'intro' && stage !== 'summary' && <button aria-label={isPaused ? 'Resume' : 'Pause'} onClick={isPaused ? onResume : onPause} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5">{isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</button>}
      </header>

      <main className="flex h-full items-center justify-center px-5 pb-8 pt-24">
        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <motion.section key="intro" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-7">
              <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">Endurance Lock</p><h1 className="mt-3 text-4xl font-semibold">Use the same rule from start to finish</h1><p className="mt-4 max-w-xl text-lg leading-relaxed text-white/65">Wait for the center circle to light up, then tap it once. The waiting time changes unpredictably, but the circle and time allowed to respond stay the same throughout the session.</p></div>
              <div className="flex items-center gap-4 border border-white/10 bg-white/[0.035] p-5"><CircleDot className="h-12 w-12 text-orange-300" /><div><p className="font-semibold">Circle lights up</p><p className="mt-1 text-sm text-white/45">Tap after it lights up. Early taps are recorded separately.</p></div></div>
              <p className="text-sm text-white/45">The first four trials are practice. The summary describes sustained-attention performance during this session and does not identify why performance changed.</p>
              <button onClick={startSession} className="inline-flex items-center gap-2 bg-[#E0FE10] px-5 py-3 font-semibold text-black"><Play className="h-4 w-4" />Start practice</button>
            </motion.section>
          )}

          {(stage === 'waiting' || stage === 'cue' || stage === 'feedback') && currentRound && (
            <motion.section key={`${roundIndex}-${stage}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-2xl">
              <div className="mb-7 flex justify-between text-sm text-white/45"><span>{currentRound.isPractice ? `Practice ${roundIndex + 1} of 4` : `Trial ${roundIndex - 3} of ${rounds.length - 4}`}</span><span>{currentRound.isPractice ? 'Practice' : `Block ${(currentBlock ?? 0) + 1} of 6`}</span></div>
              <div className="mb-8 h-1 bg-white/10"><div className="h-full bg-orange-400 transition-all" style={{ width: `${progress}%` }} /></div>
              <button aria-label={stage === 'cue' ? 'Tap the lit center circle' : stage === 'waiting' ? 'Wait for the center circle to light up' : 'Trial feedback'} onClick={handleTap} disabled={stage === 'feedback' || isPaused} className="flex min-h-[430px] w-full flex-col items-center justify-center border border-white/10 bg-white/[0.035] p-7 disabled:cursor-default">
                {stage === 'waiting' && <div className="text-center"><div className="mx-auto h-36 w-36 rounded-full border border-white/10 bg-white/[0.025]" /><p className="mt-7 text-lg text-white/45">Wait for the circle to light up</p></div>}
                {stage === 'cue' && <motion.div initial={{ scale: 0.65, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid h-44 w-44 place-items-center rounded-full border-4 border-orange-300 bg-orange-300/20 shadow-[0_0_60px_rgba(253,186,116,0.25)]"><CircleDot className="h-16 w-16 text-orange-200" /></motion.div>}
                {stage === 'feedback' && <p className="text-xl text-white/70">{feedback}</p>}
              </button>
              {currentBlock !== null && <div className="mt-5 grid grid-cols-6 gap-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className={`h-2 ${index <= currentBlock ? 'bg-orange-400' : 'bg-white/10'}`} />)}</div>}
            </motion.section>
          )}

          {stage === 'summary' && measurement && (
            <motion.section key="summary" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6">
              <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">Session summary</p><h2 className="mt-3 text-3xl font-semibold">Sustained-attention run recorded</h2><p className="mt-3 text-white/60">A positive response-time trend means responses became slower over this session. Sleep, fatigue, motivation, interruption, and device input are among the possible explanations; this task does not determine the cause.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Response-time change</p><p className="mt-2 text-2xl font-semibold">{measurement.estimateAvailable ? `${measurement.correctRtSlopeMsPerMin} ms/min` : 'Unavailable'}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Median response time</p><p className="mt-2 text-2xl font-semibold">{measurement.medianCorrectRtMs === null ? 'Unavailable' : `${measurement.medianCorrectRtMs} ms`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Responses at or above 500 ms</p><p className="mt-2 text-2xl font-semibold">{measurement.lapseRate === null ? 'Unavailable' : `${Math.round(measurement.lapseRate * 100)}%`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Early taps</p><p className="mt-2 text-2xl font-semibold">{measurement.falseStartRate === null ? 'Unavailable' : `${Math.round(measurement.falseStartRate * 100)}%`}</p></div>
              </div>
              <button onClick={onComplete} className="bg-[#E0FE10] px-5 py-3 font-semibold text-black">Finish</button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
};

export default EnduranceLockGame;
