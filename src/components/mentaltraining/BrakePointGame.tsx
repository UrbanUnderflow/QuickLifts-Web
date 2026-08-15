import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
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
  buildBrakePointRounds,
  calculateBrakePointMeasurement,
  nextBrakePointStopSignalDelay,
  type BrakeDirection,
  type BrakePointMeasurement,
  type BrakePointResponseContract,
} from './simulationFamilyMeasurement';

interface BrakePointGameProps {
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

type GameStage = 'intro' | 'ready' | 'go' | 'feedback' | 'summary';

function parseTrialCount(targetSessionStructure?: string) {
  const match = targetSessionStructure?.match(/(\d+)/);
  return Math.max(64, match ? Number(match[1]) : 64);
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

export const BrakePointGame: React.FC<BrakePointGameProps> = ({
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
    () => buildBrakePointRounds(parseTrialCount(buildArtifact.sessionModel.targetSessionStructure)),
    [buildArtifact.sessionModel.targetSessionStructure]
  );

  const [stage, setStage] = useState<GameStage>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [responses, setResponses] = useState<BrakePointResponseContract[]>([]);
  const [stopSignalVisible, setStopSignalVisible] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [measurement, setMeasurement] = useState<BrakePointMeasurement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);

  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const responsesRef = useRef<BrakePointResponseContract[]>([]);
  const responseStartedAtRef = useRef(0);
  const activeStopSignalDelayRef = useRef<number | null>(null);
  const stopSignalDelayRef = useRef(250);
  const roundResolvedRef = useRef(false);
  const roundGenerationRef = useRef(0);
  const recordedRef = useRef(false);
  const pausedRoundRef = useRef(false);
  const sessionStartedAtRef = useRef(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentRound = rounds[roundIndex] ?? null;
  const scoredResponses = responses.filter((response) => !response.isPractice);
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

  const playStopSignal = useCallback(() => {
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
    oscillator.frequency.value = 190;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  }, [soundEnabled]);

  const recordSession = useCallback((result: BrakePointMeasurement, finalResponses: BrakePointResponseContract[]) => {
    if (previewMode || !currentUser?.id || recordedRef.current) return;
    recordedRef.current = true;
    const scored = finalResponses.filter((response) => !response.isPractice);
    const correctOutcomes = scored.filter((response) => (
      response.trialKind === 'go'
        ? response.outcome === 'response' && response.responseDirection === response.direction
        : response.outcome === 'withheld'
    )).length;
    simSessionService.recordSession({
      userId: currentUser.id,
      simId: buildArtifact.variantId,
      simName: buildArtifact.variantName,
      legacyExerciseId: exercise.id,
      sessionType: SessionType.TrainingRep,
      durationMode: getDurationMode(durationMinutes),
      durationSeconds: Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000)),
      coreMetricName: 'stop_success_rate',
      coreMetricValue: result.stopSuccessRate ?? 0,
      supportingMetrics: {
        provisional_ssrt_ms: result.provisionalSsrtMs ?? 0,
        ssrt_estimate_available: result.estimateAvailable ? 1 : 0,
        go_accuracy: result.goAccuracy ?? 0,
        correct_go_rt_ms: result.correctGoRtMs ?? 0,
        go_omission_rate: result.goOmissionRate ?? 0,
        stop_success_rate: result.stopSuccessRate ?? 0,
        mean_stop_signal_delay_ms: result.meanStopSignalDelayMs ?? 0,
        go_choice_error_rate: result.goChoiceErrorRate ?? 0,
        failed_stop_rt_ms: result.failedStopRtMs ?? 0,
        race_model_check_passed: result.raceModelCheckPassed ? 1 : 0,
        premature_response_rate: result.prematureResponseRate ?? 0,
        valid_go_trials: result.validGoTrials,
        valid_stop_trials: result.validStopTrials,
      },
      normalizedScore: clampScore(Math.round((correctOutcomes / Math.max(1, scored.length)) * 100)),
      targetSkills: [TaxonomySkill.ResponseInhibition],
      pressureTypes: [PressureType.Time, PressureType.Uncertainty],
      profileSnapshotMilestone,
      createdAt: Date.now(),
    }).catch((error) => console.error('Failed to record Brake Point session:', error));
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, previewMode, profileSnapshotMilestone]);

  const finishSession = useCallback((finalResponses: BrakePointResponseContract[]) => {
    roundGenerationRef.current += 1;
    clearTimers();
    const result = calculateBrakePointMeasurement(finalResponses);
    setMeasurement(result);
    recordSession(result, finalResponses);
    setStage('summary');
  }, [clearTimers, recordSession]);

  const beginRound = useCallback((index: number) => {
    clearTimers();
    const generation = ++roundGenerationRef.current;
    const round = rounds[index];
    if (!round) return;
    roundResolvedRef.current = false;
    setStopSignalVisible(false);
    setFeedback('');
    setStage('ready');
    schedule(() => {
      if (generation !== roundGenerationRef.current) return;
      responseStartedAtRef.current = Date.now();
      activeStopSignalDelayRef.current = round.trialKind === 'stop' ? stopSignalDelayRef.current : null;
      setStage('go');
      if (round.trialKind === 'stop') {
        schedule(() => {
          if (generation !== roundGenerationRef.current || roundResolvedRef.current) return;
          setStopSignalVisible(true);
          playStopSignal();
        }, stopSignalDelayRef.current);
      }
      schedule(() => {
        if (generation !== roundGenerationRef.current || roundResolvedRef.current) return;
        roundResolvedRef.current = true;
        const response: BrakePointResponseContract = {
          ...round,
          responseDirection: null,
          responseLatencyMs: null,
          stopSignalDelayMs: activeStopSignalDelayRef.current,
          outcome: round.trialKind === 'stop' ? 'withheld' : 'timeout',
        };
        const nextResponses = [...responsesRef.current, response];
        responsesRef.current = nextResponses;
        setResponses(nextResponses);
        if (!round.isPractice && round.trialKind === 'stop') {
          stopSignalDelayRef.current = nextBrakePointStopSignalDelay(stopSignalDelayRef.current, 'withheld');
        }
        setFeedback(round.isPractice
          ? round.trialKind === 'stop' ? 'You did not tap after STOP appeared.' : 'No response was recorded.'
          : 'Trial recorded.');
        setStage('feedback');
        schedule(() => {
          if (generation !== roundGenerationRef.current) return;
          if (index >= rounds.length - 1) finishSession(nextResponses);
          else {
            setRoundIndex(index + 1);
            beginRound(index + 1);
          }
        }, round.isPractice ? 800 : 260);
      }, round.responseWindowMs);
    }, 500 + Math.floor(Math.random() * 350));
  }, [clearTimers, finishSession, playStopSignal, rounds, schedule]);

  const handleDirection = useCallback((direction: BrakeDirection) => {
    if (stage !== 'go' || !currentRound || roundResolvedRef.current || isPaused) return;
    roundResolvedRef.current = true;
    const generation = roundGenerationRef.current;
    clearTimers();
    const latencyMs = Date.now() - responseStartedAtRef.current;
    const response: BrakePointResponseContract = {
      ...currentRound,
      responseDirection: direction,
      responseLatencyMs: latencyMs,
      stopSignalDelayMs: activeStopSignalDelayRef.current,
      outcome: latencyMs < 150 ? 'premature' : 'response',
    };
    const nextResponses = [...responsesRef.current, response];
    responsesRef.current = nextResponses;
    setResponses(nextResponses);
    const correctGo = currentRound.trialKind === 'go' && direction === currentRound.direction && latencyMs >= 150;
    if (!currentRound.isPractice && currentRound.trialKind === 'stop') {
      stopSignalDelayRef.current = nextBrakePointStopSignalDelay(stopSignalDelayRef.current, 'responded');
    }
    setFeedback(currentRound.isPractice
      ? currentRound.trialKind === 'stop'
        ? 'When STOP appears, do not tap.'
        : correctGo ? 'Direction matched.' : 'Match the arrow direction.'
      : 'Trial recorded.');
    setStage('feedback');
    schedule(() => {
      if (generation !== roundGenerationRef.current) return;
      if (roundIndex >= rounds.length - 1) finishSession(nextResponses);
      else {
        setRoundIndex(roundIndex + 1);
        beginRound(roundIndex + 1);
      }
    }, currentRound.isPractice ? 800 : 260);
  }, [beginRound, clearTimers, currentRound, finishSession, isPaused, roundIndex, rounds.length, schedule, stage]);

  const startSession = useCallback(() => {
    clearTimers();
    recordedRef.current = false;
    sessionStartedAtRef.current = Date.now();
    responsesRef.current = [];
    setResponses([]);
    setMeasurement(null);
    setRoundIndex(0);
    stopSignalDelayRef.current = 250;
    beginRound(0);
  }, [beginRound, clearTimers]);

  useEffect(() => {
    if (skipIntro && stage === 'intro') startSession();
  }, [skipIntro, stage, startSession]);

  useEffect(() => {
    if (isPaused) {
      if (stage === 'ready' || stage === 'go') {
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

  useEffect(() => () => {
    roundGenerationRef.current += 1;
    clearTimers();
    audioContextRef.current?.close().catch(() => undefined);
  }, [clearTimers]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 overflow-hidden bg-[#07090d] text-white">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-5">
        <button aria-label="Close" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"><X className="h-5 w-5" /></button>
        <div className="flex items-center gap-2">
          <button aria-label={soundEnabled ? 'Mute' : 'Unmute'} onClick={() => setSoundEnabled((value) => !value)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5">
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          {stage !== 'intro' && stage !== 'summary' && (
            <button aria-label={isPaused ? 'Resume' : 'Pause'} onClick={isPaused ? onResume : onPause} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5">
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </button>
          )}
        </div>
      </header>

      <main className="relative flex h-full items-center justify-center px-5 pb-8 pt-24">
        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <motion.section key="intro" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-2xl space-y-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Brake Point</p>
                <h1 className="mt-3 text-4xl font-semibold">Stop after you start</h1>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/65">Tap left or right to match each arrow. On some trials, a red STOP appears after the arrow starts. When it appears, do not tap.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="border border-white/10 bg-white/[0.04] p-4"><ArrowLeft className="mx-auto h-7 w-7" /><p className="mt-2 text-sm text-white/65">Left arrow</p></div>
                <div className="border border-red-400/30 bg-red-500/10 p-4"><span className="text-lg font-bold text-red-300">STOP</span><p className="mt-2 text-sm text-white/65">Do not tap</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><ArrowRight className="mx-auto h-7 w-7" /><p className="mt-2 text-sm text-white/65">Right arrow</p></div>
              </div>
              <p className="text-sm text-white/45">The first four trials are practice. This standard session reports arrow accuracy and how often you do not tap after STOP. A longer research session is required before a stop-time estimate is shown.</p>
              <button onClick={startSession} className="inline-flex items-center gap-2 bg-[#E0FE10] px-5 py-3 font-semibold text-black"><Play className="h-4 w-4" />Start practice</button>
            </motion.section>
          )}

          {(stage === 'ready' || stage === 'go' || stage === 'feedback') && currentRound && (
            <motion.section key={`${roundIndex}-${stage}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl">
              <div className="mb-8 flex items-center justify-between text-sm text-white/45">
                <span>{currentRound.isPractice ? `Practice ${roundIndex + 1} of 4` : `Trial ${roundIndex - 3} of ${rounds.length - 4}`}</span>
                <span>{currentRound.isPractice ? 'Practice' : 'Scored'}</span>
              </div>
              <div className="mb-10 h-1 overflow-hidden bg-white/10"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div>
              <div className="flex min-h-[360px] flex-col items-center justify-center border border-white/10 bg-white/[0.035] p-8">
                {stage === 'ready' && <p className="text-lg text-white/45">Get ready</p>}
                {stage === 'go' && (
                  <div className="relative grid h-52 w-52 place-items-center">
                    <span className="text-[8rem] font-light leading-none">{currentRound.direction === 'left' ? '←' : '→'}</span>
                    {stopSignalVisible && (
                      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute inset-0 grid place-items-center border-4 border-red-400 bg-[#190b0d]/95 text-3xl font-bold text-red-300">STOP</motion.div>
                    )}
                  </div>
                )}
                {stage === 'feedback' && <p className="text-xl text-white/70">{feedback}</p>}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <button aria-label="Respond left" onClick={() => handleDirection('left')} disabled={stage !== 'go' || isPaused} className="grid h-24 place-items-center border border-white/12 bg-white/[0.05] disabled:opacity-30"><ArrowLeft className="h-9 w-9" /></button>
                <button aria-label="Respond right" onClick={() => handleDirection('right')} disabled={stage !== 'go' || isPaused} className="grid h-24 place-items-center border border-white/12 bg-white/[0.05] disabled:opacity-30"><ArrowRight className="h-9 w-9" /></button>
              </div>
            </motion.section>
          )}

          {stage === 'summary' && measurement && (
            <motion.section key="summary" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Session summary</p>
                <h2 className="mt-3 text-3xl font-semibold">Stopping task recorded</h2>
                <p className="mt-3 text-white/60">These results describe only how you responded to arrows and STOP in this session. They do not describe how you act in competition.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Go accuracy</p><p className="mt-2 text-2xl font-semibold">{measurement.goAccuracy === null ? 'Unavailable' : `${Math.round(measurement.goAccuracy * 100)}%`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Stop success</p><p className="mt-2 text-2xl font-semibold">{measurement.stopSuccessRate === null ? 'Unavailable' : `${Math.round(measurement.stopSuccessRate * 100)}%`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Correct go response time</p><p className="mt-2 text-2xl font-semibold">{measurement.correctGoRtMs === null ? 'Unavailable' : `${measurement.correctGoRtMs} ms`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Stop-time estimate</p><p className="mt-2 text-2xl font-semibold">{measurement.estimateAvailable ? `${measurement.provisionalSsrtMs}ms` : 'Unavailable'}</p></div>
              </div>
              {!measurement.estimateAvailable && <p className="border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">{measurement.estimateUnavailableReason}</p>}
              <button onClick={onComplete} className="bg-[#E0FE10] px-5 py-3 font-semibold text-black">Finish</button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
};

export default BrakePointGame;
