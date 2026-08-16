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
  buildSignalWindowRounds,
  calculateSignalWindowMeasurement,
  SIGNAL_WINDOW_TIMING,
  type SignalDirection,
  type SignalWindowMeasurement,
  type SignalWindowResponseContract,
} from './simulationFamilyMeasurement';

interface SignalWindowGameProps {
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

type GameStage = 'intro' | 'ready' | 'stimulus' | 'response' | 'feedback' | 'summary';

function parseTrialCount(targetSessionStructure?: string) {
  const match = targetSessionStructure?.match(/(\d+)/);
  return Math.max(24, match ? Number(match[1]) : 24);
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

export const SignalWindowGame: React.FC<SignalWindowGameProps> = ({
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
  const durationMinutes = Number(buildArtifact.sessionModel.durationMinutes ?? 3);
  const rounds = useMemo(
    () => buildSignalWindowRounds(parseTrialCount(buildArtifact.sessionModel.targetSessionStructure)),
    [buildArtifact.sessionModel.targetSessionStructure]
  );
  const [stage, setStage] = useState<GameStage>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [responses, setResponses] = useState<SignalWindowResponseContract[]>([]);
  const [feedback, setFeedback] = useState('');
  const [measurement, setMeasurement] = useState<SignalWindowMeasurement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);

  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const responsesRef = useRef<SignalWindowResponseContract[]>([]);
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

  const playSignal = useCallback(() => {
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
    gain.gain.setValueAtTime(0.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
  }, [soundEnabled]);

  const recordSession = useCallback((result: SignalWindowMeasurement, finalResponses: SignalWindowResponseContract[]) => {
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
      coreMetricName: 'decision_accuracy',
      coreMetricValue: result.decisionAccuracy ?? 0,
      supportingMetrics: {
        correct_decision_rt_ms: result.correctDecisionRtMs ?? 0,
        wrong_choice_rate: result.wrongChoiceRate ?? 0,
        timeout_rate: result.timeoutRate ?? 0,
        premature_response_rate: result.prematureResponseRate ?? 0,
        evidence_5_accuracy: result.accuracyByEvidence[5] ?? 0,
        evidence_6_accuracy: result.accuracyByEvidence[6] ?? 0,
        evidence_7_accuracy: result.accuracyByEvidence[7] ?? 0,
        scored_trial_count: finalResponses.filter((response) => !response.isPractice).length,
        signal_window_protocol_version: SIGNAL_WINDOW_TIMING.protocolVersionMetric,
      },
      normalizedScore: Math.round((result.decisionAccuracy ?? 0) * 100),
      targetSkills: [TaxonomySkill.CueDiscrimination, TaxonomySkill.SelectiveAttention],
      pressureTypes: [PressureType.Time, PressureType.Uncertainty, PressureType.Visual],
      profileSnapshotMilestone,
      createdAt: Date.now(),
    }).catch((error) => console.error('Failed to record Signal Window session:', error));
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, previewMode, profileSnapshotMilestone]);

  const finishSession = useCallback((finalResponses: SignalWindowResponseContract[]) => {
    clearTimers();
    const result = calculateSignalWindowMeasurement(finalResponses);
    setMeasurement(result);
    recordSession(result, finalResponses);
    setStage('summary');
  }, [clearTimers, recordSession]);

  const advance = useCallback((index: number, nextResponses: SignalWindowResponseContract[]) => {
    schedule(() => {
      if (index >= rounds.length - 1) finishSession(nextResponses);
      else {
        setRoundIndex(index + 1);
        setStage('ready');
      }
    }, rounds[index]?.isPractice ? SIGNAL_WINDOW_TIMING.practiceFeedbackMs : SIGNAL_WINDOW_TIMING.scoredFeedbackMs);
  }, [finishSession, rounds, schedule]);

  const beginRound = useCallback((index: number) => {
    clearTimers();
    const round = rounds[index];
    if (!round) return;
    roundResolvedRef.current = false;
    setFeedback('');
    setStage('ready');
    schedule(() => {
      playSignal();
      responseStartedAtRef.current = Date.now();
      setStage('stimulus');
      schedule(() => {
        if (roundResolvedRef.current) return;
        setStage('response');
      }, round.exposureMs);
      schedule(() => {
        if (roundResolvedRef.current) return;
        roundResolvedRef.current = true;
        const response: SignalWindowResponseContract = {
          ...round,
          responseDirection: null,
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
    }, SIGNAL_WINDOW_TIMING.readyMs);
  }, [advance, clearTimers, playSignal, rounds, schedule]);

  const handleChoice = useCallback((direction: SignalDirection) => {
    if ((stage !== 'stimulus' && stage !== 'response') || !currentRound || roundResolvedRef.current || isPaused) return;
    roundResolvedRef.current = true;
    clearTimers();
    const latencyMs = Date.now() - responseStartedAtRef.current;
    const correct = direction === currentRound.direction && latencyMs >= 150;
    const response: SignalWindowResponseContract = {
      ...currentRound,
      responseDirection: direction,
      correct,
      responseLatencyMs: latencyMs,
      outcome: latencyMs < 150 ? 'premature' : 'response',
    };
    const nextResponses = [...responsesRef.current, response];
    responsesRef.current = nextResponses;
    setResponses(nextResponses);
    setFeedback(currentRound.isPractice
      ? correct ? 'You selected the majority direction.' : 'Choose the direction shown by most arrows.'
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
      if (stage === 'ready' || stage === 'stimulus' || stage === 'response') {
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 overflow-hidden bg-[#070a11] text-white">
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
              <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Signal Window</p><h1 className="mt-3 text-4xl font-semibold">Read the majority direction</h1><p className="mt-4 max-w-xl text-lg leading-relaxed text-white/65">A field of nine arrows appears. Decide whether most arrows point left or right and choose that direction.</p></div>
              <div className="grid grid-cols-3 gap-2 border border-white/10 bg-white/[0.035] p-5">{['←', '→', '←', '←', '←', '→', '→', '←', '←'].map((arrow, index) => <div key={index} className="grid h-14 place-items-center text-3xl">{arrow}</div>)}</div>
              <p className="text-sm text-white/45">The first four trials are practice. Scored trials balance left and right answers across close and clearer majorities.</p>
              <button onClick={startSession} className="inline-flex items-center gap-2 bg-[#E0FE10] px-5 py-3 font-semibold text-black"><Play className="h-4 w-4" />Start practice</button>
            </motion.section>
          )}

          {(stage === 'ready' || stage === 'stimulus' || stage === 'response' || stage === 'feedback') && currentRound && (
            <motion.section key={`${roundIndex}-${stage}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-2xl">
              <div className="mb-7 flex justify-between text-sm text-white/45"><span>{currentRound.isPractice ? `Practice ${roundIndex + 1} of 4` : `Trial ${roundIndex - 3} of ${rounds.length - 4}`}</span><span>{currentRound.isPractice ? 'Practice' : 'Scored'}</span></div>
              <div className="mb-8 h-1 bg-white/10"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} /></div>
              <div className="flex min-h-[360px] flex-col items-center justify-center border border-white/10 bg-white/[0.035] p-7">
                {stage !== 'feedback' && <p className="mb-6 text-center text-2xl font-semibold">Which direction do most arrows point?</p>}
                {stage === 'ready' && <p className="text-lg text-white/45">Get ready. The arrows appear next.</p>}
                {stage === 'stimulus' && <div className="grid w-full max-w-sm grid-cols-3 gap-3">{currentRound.arrowDirections.map((direction, index) => <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid aspect-square place-items-center border border-cyan-300/20 bg-cyan-300/5 text-4xl">{direction === 'left' ? '←' : '→'}</motion.div>)}</div>}
                {stage === 'response' && <p className="text-lg text-white/55">Choose left or right.</p>}
                {stage === 'feedback' && <p className="text-xl text-white/70">{feedback}</p>}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <button aria-label="Choose left" onClick={() => handleChoice('left')} disabled={(stage !== 'stimulus' && stage !== 'response') || isPaused} className="grid h-24 place-items-center border border-white/12 bg-white/[0.05] disabled:opacity-30"><ArrowLeft className="h-9 w-9" /></button>
                <button aria-label="Choose right" onClick={() => handleChoice('right')} disabled={(stage !== 'stimulus' && stage !== 'response') || isPaused} className="grid h-24 place-items-center border border-white/12 bg-white/[0.05] disabled:opacity-30"><ArrowRight className="h-9 w-9" /></button>
              </div>
            </motion.section>
          )}

          {stage === 'summary' && measurement && (
            <motion.section key="summary" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6">
              <div><p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Session summary</p><h2 className="mt-3 text-3xl font-semibold">Perceptual decisions recorded</h2><p className="mt-3 text-white/60">Accuracy and correct-response time are shown separately. This task does not establish decision quality in competition.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Accuracy</p><p className="mt-2 text-2xl font-semibold">{measurement.decisionAccuracy === null ? 'Unavailable' : `${Math.round(measurement.decisionAccuracy * 100)}%`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Correct response time</p><p className="mt-2 text-2xl font-semibold">{measurement.correctDecisionRtMs === null ? 'Unavailable' : `${measurement.correctDecisionRtMs} ms`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Wrong choices</p><p className="mt-2 text-2xl font-semibold">{measurement.wrongChoiceRate === null ? 'Unavailable' : `${Math.round(measurement.wrongChoiceRate * 100)}%`}</p></div>
                <div className="border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-wider text-white/40">Timeouts</p><p className="mt-2 text-2xl font-semibold">{measurement.timeoutRate === null ? 'Unavailable' : `${Math.round(measurement.timeoutRate * 100)}%`}</p></div>
              </div>
              <button onClick={onComplete} className="bg-[#E0FE10] px-5 py-3 font-semibold text-black">Finish</button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
};

export default SignalWindowGame;
