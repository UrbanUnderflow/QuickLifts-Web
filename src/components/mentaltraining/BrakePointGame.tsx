import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, ShieldAlert, TimerReset, Volume2, VolumeX, X } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import { DurationMode, type ProfileSnapshotMilestone, PressureType, SessionType, TaxonomySkill } from '../../api/firebase/mentaltraining/taxonomy';
import type { SimBuildArtifact, SimModule } from '../../api/firebase/mentaltraining/types';
import { useInputIntegrity } from './useInputIntegrity';

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

type RoundStage = 'intro' | 'ready' | 'response' | 'feedback' | 'summary';
type BrakeCueType = 'go' | 'obvious' | 'fakeout' | 'late_reveal';

interface BrakeRound {
  id: string;
  cueType: BrakeCueType;
  signalLabel: string;
  instruction: string;
  correctAction: 'commit' | 'brake';
  pressureTag: 'neutral' | 'pressure';
  laneShift: 'center' | 'left' | 'right';
}

interface BrakeResponse {
  roundId: string;
  cueType: BrakeCueType;
  correctAction: 'commit' | 'brake';
  response: 'commit' | 'brake' | 'timeout';
  correct: boolean;
  latencyMs: number;
}

const GO_LABELS = ['GREEN', 'CLEAR', 'GO', 'OPEN'];
const NO_GO_LABELS: Record<Exclude<BrakeCueType, 'go'>, string[]> = {
  obvious: ['RED', 'STOP', 'BRAKE'],
  fakeout: ['HOLD', 'FAKE', 'CHECK'],
  late_reveal: ['LATE STOP', 'BRAKE NOW', 'ABORT'],
};

function parseRoundCount(targetSessionStructure?: string, durationMinutes?: number) {
  const match = targetSessionStructure?.match(/(\d+)/);
  if (match) return Math.max(18, Number(match[1]));
  return Math.max(20, (durationMinutes ?? 5) * 12);
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function inferCueType(index: number, archetype: string) {
  if (archetype === 'decoy_discrimination') {
    return index % 4 === 0 ? 'late_reveal' : index % 2 === 0 ? 'fakeout' : 'go';
  }
  if (archetype === 'sport_context') {
    return index % 5 === 0 ? 'late_reveal' : index % 3 === 0 ? 'obvious' : 'go';
  }
  if (archetype === 'fatigue_load') {
    return index % 4 === 0 ? 'obvious' : index % 6 === 0 ? 'late_reveal' : 'go';
  }
  return index % 4 === 0 ? 'fakeout' : index % 5 === 0 ? 'obvious' : 'go';
}

function buildBrakeRounds(buildArtifact: SimBuildArtifact): BrakeRound[] {
  const total = parseRoundCount(buildArtifact.sessionModel.targetSessionStructure, buildArtifact.sessionModel.durationMinutes);
  const archetype = String(buildArtifact.sessionModel.archetype ?? 'baseline');

  return Array.from({ length: total }, (_, index) => {
    const cueType = inferCueType(index, archetype) as BrakeCueType;
    const correctAction = cueType === 'go' ? 'commit' : 'brake';
    const pressureTag = index > Math.floor(total * 0.55) ? 'pressure' : 'neutral';
    const laneShift = index % 3 === 0 ? 'left' : index % 2 === 0 ? 'right' : 'center';
    const labelPool = cueType === 'go' ? GO_LABELS : NO_GO_LABELS[cueType];
    const signalLabel = labelPool[index % labelPool.length];
    const instruction = cueType === 'go'
      ? 'Go cue: tap Commit.'
      : cueType === 'late_reveal'
        ? 'Late stop or abort cue: tap Brake.'
        : cueType === 'fakeout'
          ? 'Fake, hold, or check cue: tap Brake.'
          : 'Stop, red, or brake cue: tap Brake.';

    return {
      id: `brake-round-${index + 1}`,
      cueType,
      signalLabel,
      instruction,
      correctAction,
      pressureTag,
      laneShift,
    };
  });
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
  const rounds = useMemo(() => buildBrakeRounds(buildArtifact), [buildArtifact]);
  const durationMinutes = buildArtifact.sessionModel.durationMinutes as number;
  const targetRoundStructure = buildArtifact.sessionModel.targetSessionStructure as string;
  const stageDurations = useMemo(() => ({ ready: 1200, response: 1600, feedback: 800 }), []);

  const [stage, setStage] = useState<RoundStage>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [responses, setResponses] = useState<BrakeResponse[]>([]);
  const [feedback, setFeedback] = useState<{ title: string; detail: string; success: boolean } | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);
  const {
    warningActive,
    warningMessage,
    registerInputAttempt,
    resetSession,
    finalizeRound,
    spamDetected,
    spamFlags,
    spamRounds,
  } = useInputIntegrity();

  const audioContextRef = useRef<AudioContext | null>(null);
  const stageEndsAtRef = useRef<number | null>(null);
  const stageRemainingRef = useRef<number>(0);
  const stageStartRef = useRef<number>(Date.now());
  const roundResolvedRef = useRef(false);
  const sessionStartedAtRef = useRef<number>(Date.now());
  const recordedRef = useRef(false);

  const currentRound = rounds[roundIndex] ?? null;

  const beginStage = useCallback((nextStage: Exclude<RoundStage, 'intro' | 'summary'>, durationMs: number | null) => {
    setStage(nextStage);
    stageStartRef.current = Date.now();
    if (durationMs === null) {
      stageEndsAtRef.current = null;
      stageRemainingRef.current = 0;
      setRemainingMs(null);
      return;
    }
    stageEndsAtRef.current = Date.now() + durationMs;
    stageRemainingRef.current = durationMs;
    setRemainingMs(durationMs);
  }, []);

  const playCue = useCallback((cueType: BrakeCueType) => {
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
    const base = cueType === 'go' ? 420 : cueType === 'late_reveal' ? 210 : 280;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = cueType === 'go' ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(base, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (cueType === 'late_reveal' ? 0.22 : 0.14));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + (cueType === 'late_reveal' ? 0.24 : 0.16));
  }, [soundEnabled]);

  const finishSession = useCallback(async (finalResponses: BrakeResponse[]) => {
    const total = Math.max(1, finalResponses.length);
    const correctCount = finalResponses.filter((response) => response.correct).length;
    const brakeTrials = finalResponses.filter((response) => response.correctAction === 'brake');
    const goTrials = finalResponses.filter((response) => response.correctAction === 'commit');
    const successfulBrakes = brakeTrials.filter((response) => response.correct && response.response === 'brake');
    const falseAlarms = brakeTrials.filter((response) => response.response === 'commit').length;
    const overInhibition = goTrials.filter((response) => response.response !== 'commit' || !response.correct).length;
    const avgStopLatency = successfulBrakes.length
      ? Math.round(successfulBrakes.reduce((sum, response) => sum + response.latencyMs, 0) / successfulBrakes.length)
      : stageDurations.response;
    const avgGoLatency = goTrials.length
      ? Math.round(goTrials.reduce((sum, response) => sum + response.latencyMs, 0) / goTrials.length)
      : stageDurations.response;
    const normalizedScore = clampScore(Math.round((correctCount / total) * 100) - Math.round(((falseAlarms + overInhibition) / total) * 20));

    if (!previewMode && currentUser?.id && !recordedRef.current) {
      recordedRef.current = true;
      simSessionService.recordSession({
        userId: currentUser.id,
        simId: buildArtifact.variantId,
        simName: buildArtifact.variantName,
        legacyExerciseId: exercise.id,
        sessionType: buildArtifact.sessionModel.archetype === 'trial' ? SessionType.Reassessment : SessionType.TrainingRep,
        durationMode: getDurationMode(durationMinutes),
        durationSeconds: Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000)),
        coreMetricName: 'stop_latency',
        coreMetricValue: avgStopLatency,
        supportingMetrics: {
          false_alarm_rate: Number((falseAlarms / Math.max(1, brakeTrials.length)).toFixed(3)),
          over_inhibition: Number((overInhibition / Math.max(1, goTrials.length)).toFixed(3)),
          go_rt_balance: Math.max(0, avgGoLatency - avgStopLatency),
          successful_brakes: successfulBrakes.length,
          rapid_input_flags: spamFlags,
          rapid_input_rounds: spamRounds,
          flagged_for_spam: spamDetected ? 1 : 0,
        },
        normalizedScore: spamDetected ? Math.max(0, normalizedScore - 25) : normalizedScore,
        targetSkills: [TaxonomySkill.ResponseInhibition, TaxonomySkill.PressureStability],
        pressureTypes: [PressureType.Time, PressureType.Uncertainty],
        profileSnapshotMilestone,
        createdAt: Date.now(),
      }).catch((error) => {
        console.error('Failed to record Brake Point session:', error);
      });
    }

    setFeedback({
      title: `${correctCount}/${finalResponses.length} correct choices`,
      detail: `Stop Latency ${avgStopLatency}ms · False Alarm ${Math.round((falseAlarms / Math.max(1, brakeTrials.length)) * 100)}% · Over-Inhibition ${Math.round((overInhibition / Math.max(1, goTrials.length)) * 100)}%${spamDetected ? ' · Session flagged for rapid input' : ''}`,
      success: normalizedScore >= 70 && !spamDetected,
    });
    setStage('summary');
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, previewMode, spamDetected, spamFlags, spamRounds, stageDurations.response]);

  const resolveRound = useCallback((response: 'commit' | 'brake' | null) => {
    if (!currentRound || roundResolvedRef.current) return;
    roundResolvedRef.current = true;
    const latencyMs = Math.max(150, Date.now() - stageStartRef.current);
    const nextResponse: BrakeResponse = {
      roundId: currentRound.id,
      cueType: currentRound.cueType,
      correctAction: currentRound.correctAction,
      response: response ?? 'timeout',
      correct: response === currentRound.correctAction,
      latencyMs,
    };
    finalizeRound();
    const nextResponses = [...responses, nextResponse];
    setResponses(nextResponses);
    setFeedback({
      title: nextResponse.correct ? (currentRound.correctAction === 'brake' ? 'Brake Held' : 'Commit Landed') : response === null ? 'Window Missed' : 'Wrong Button',
      detail: nextResponse.correct
        ? currentRound.correctAction === 'brake'
          ? 'Correct. Stop and fake cues are Brake cues.'
          : 'Correct. Go cues are Commit cues.'
        : response === null
          ? 'The response window closed before a committed action.'
          : response === 'commit'
            ? 'That cue needed Brake, not Commit.'
            : 'That cue needed Commit, not Brake.',
      success: nextResponse.correct,
    });
    beginStage('feedback', stageDurations.feedback);

    if (roundIndex >= rounds.length - 1) {
      window.setTimeout(() => finishSession(nextResponses), stageDurations.feedback);
      return;
    }

    window.setTimeout(() => {
      setRoundIndex((current) => current + 1);
      roundResolvedRef.current = false;
      setFeedback(null);
      beginStage('ready', stageDurations.ready);
    }, stageDurations.feedback);
  }, [beginStage, currentRound, finalizeRound, finishSession, responses, roundIndex, rounds.length, stageDurations.feedback, stageDurations.ready]);

  const handleActionSelect = useCallback((action: 'commit' | 'brake') => {
    if (stage !== 'response') return;
    if (!registerInputAttempt({ blockedMessage: 'Too fast. Read the lane before committing or braking again.' })) {
      return;
    }
    resolveRound(action);
  }, [registerInputAttempt, resolveRound, stage]);

  useEffect(() => {
    if (stage !== 'ready' && stage !== 'response' && stage !== 'feedback') {
      return undefined;
    }
    if (isPaused) {
      if (stageEndsAtRef.current) {
        stageRemainingRef.current = Math.max(0, stageEndsAtRef.current - Date.now());
      }
      stageEndsAtRef.current = null;
      return undefined;
    }
    if (!stageEndsAtRef.current && remainingMs !== null) {
      stageEndsAtRef.current = Date.now() + stageRemainingRef.current;
    }
    const tick = window.setInterval(() => {
      if (!stageEndsAtRef.current) return;
      const remaining = Math.max(0, stageEndsAtRef.current - Date.now());
      setRemainingMs(remaining);
      if (remaining > 0) return;
      window.clearInterval(tick);
      stageEndsAtRef.current = null;
      if (stage === 'ready') {
        beginStage('response', stageDurations.response);
        if (currentRound) playCue(currentRound.cueType);
        return;
      }
      if (stage === 'response') {
        resolveRound(null);
      }
    }, 100);
    return () => window.clearInterval(tick);
  }, [beginStage, currentRound, isPaused, playCue, remainingMs, resolveRound, stage, stageDurations.feedback, stageDurations.ready, stageDurations.response]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
    };
  }, []);

  const startSession = useCallback(() => {
    sessionStartedAtRef.current = Date.now();
    recordedRef.current = false;
    resetSession();
    setRoundIndex(0);
    setResponses([]);
    setFeedback(null);
    roundResolvedRef.current = false;
    beginStage('ready', stageDurations.ready);
  }, [beginStage, resetSession, stageDurations.ready]);

  useEffect(() => {
    if (!skipIntro || stage !== 'intro') return;
    startSession();
  }, [skipIntro, stage, startSession]);

  const progressPercent = ((roundIndex + (stage === 'summary' ? 1 : 0)) / rounds.length) * 100;
  const correctPct = responses.length ? Math.round((responses.filter((response) => response.correct).length / responses.length) * 100) : 100;
  const laneOffset = currentRound?.laneShift === 'left' ? '-14%' : currentRound?.laneShift === 'right' ? '14%' : '0%';
  const isBrakeCue = currentRound?.correctAction === 'brake';
  const cueToneClass = isBrakeCue ? 'from-emerald-500/25 to-green-500/10 border-emerald-400/25' : 'from-[#E0FE10]/20 to-lime-500/10 border-[#E0FE10]/25';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#09090b] overflow-hidden text-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.14),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_30%)]" />

      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5">
        <button onClick={onClose} className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-white/70" />
        </button>
        <div className="flex items-center gap-1.5">
          {rounds.map((round, index) => (
            <div
              key={round.id}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${index < roundIndex ? 'bg-[#E0FE10]' : index === roundIndex ? 'bg-emerald-400' : 'bg-white/15'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled((current) => !current)}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-white/70" /> : <VolumeX className="w-5 h-5 text-white/70" />}
          </button>
          {stage !== 'intro' && stage !== 'summary' && (
            <button
              onClick={isPaused ? onResume : onPause}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 h-full flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-black/35 backdrop-blur-xl p-8 space-y-6"
            >
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Brake Point</p>
                <h1 className="text-4xl font-black">{buildArtifact.variantName}</h1>
                <p className="text-white/60 max-w-2xl">Cue words decide the button: Commit for GO, GREEN, CLEAR, or OPEN; Brake for STOP, RED, BRAKE, HOLD, FAKE, CHECK, BRAKE NOW, or ABORT.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Structure</p>
                  <p className="text-lg font-semibold mt-2">{targetRoundStructure}</p>
                  <p className="text-xs text-white/45 mt-1">{durationMinutes} minute module</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Core Metric</p>
                  <p className="text-lg font-semibold mt-2">Stop Latency</p>
                  <p className="text-xs text-white/45 mt-1">How fast you tap Brake on stop/fake cues</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Pressure</p>
                  <p className="text-lg font-semibold mt-2">{String(buildArtifact.sessionModel.archetype).replace(/_/g, ' ')}</p>
                  <p className="text-xs text-white/45 mt-1">Stop and fake cues punish early Commit taps</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-white/35">How it works</p>
                <p className="text-white/75">Each round shows one cue word. Tap Commit for GO, GREEN, CLEAR, or OPEN. Tap Brake for STOP, RED, BRAKE, HOLD, FAKE, CHECK, BRAKE NOW, or ABORT. One tap decides the round.</p>
              </div>
              <button
                onClick={startSession}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#E0FE10] text-black font-semibold"
              >
                <Play className="w-4 h-4" />
                Start Brake Point
              </button>
            </motion.div>
          )}

          {(stage === 'ready' || stage === 'response' || stage === 'feedback') && currentRound && (
            <motion.div
              key={`round-${currentRound.id}-${stage}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              className="w-full max-w-5xl rounded-[32px] border border-white/10 bg-black/35 backdrop-blur-xl p-8 space-y-6"
            >
              <div className="flex items-center justify-between gap-4 text-sm text-white/55">
                <div>
                  Round {roundIndex + 1} / {rounds.length}
                  <span className="ml-3 uppercase tracking-[0.25em] text-[11px] text-emerald-300">{currentRound.cueType.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Clean rate {correctPct}%</span>
                  {remainingMs !== null && <span>{(remainingMs / 1000).toFixed(1)}s</span>}
                </div>
              </div>

              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-400"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[0.44fr_0.56fr] gap-6">
                <div className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-6 space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Brake Cue</p>
                    <motion.div
                      animate={stage === 'response' ? { x: laneOffset, scale: currentRound.pressureTag === 'pressure' ? [1, 1.02, 1] : 1 } : { x: 0, scale: 1 }}
                      transition={{ duration: 0.55, repeat: stage === 'response' && currentRound.pressureTag === 'pressure' ? Infinity : 0, repeatType: 'mirror' }}
                      className={`mt-3 rounded-3xl border bg-gradient-to-br px-6 py-8 text-center ${cueToneClass}`}
                    >
                      <p className="text-4xl font-black tracking-[0.18em]">{currentRound.signalLabel}</p>
                    </motion.div>
                  </div>
                  <div className="space-y-2 text-sm text-white/65">
                    <p>{stage === 'ready' ? 'Wait for the cue word, then choose one button.' : currentRound.instruction}</p>
                    <p>{currentRound.correctAction === 'commit' ? 'GO, GREEN, CLEAR, OPEN = Commit.' : 'STOP, RED, BRAKE, HOLD, FAKE, CHECK, BRAKE NOW, ABORT = Brake.'}</p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 space-y-5 relative overflow-hidden">
                  {currentRound.pressureTag === 'pressure' && stage === 'response' && (
                    <div className="absolute top-4 right-4 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      pressure active
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Action Field</p>
                    <h3 className="text-2xl font-semibold mt-2">
                      {stage === 'ready' ? 'Get ready.' : stage === 'response' ? 'Choose the matching button.' : feedback?.title}
                    </h3>
                    <p className="text-sm text-white/55 mt-2">
                      {stage === 'feedback'
                        ? feedback?.detail
                        : currentRound.correctAction === 'commit'
                          ? 'This cue is a Commit cue.'
                          : 'This cue is a Brake cue.'}
                    </p>
                  </div>

                  {stage === 'ready' ? (
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center text-white/55">
                      Signal window opens automatically.
                    </div>
                  ) : stage === 'response' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <motion.button
                        onClick={() => handleActionSelect('commit')}
                        whileHover={{ scale: isPaused ? 1 : 1.02 }}
                        whileTap={{ scale: isPaused ? 1 : 0.98 }}
                        disabled={isPaused}
                        className={`rounded-3xl border px-5 py-8 text-left transition-colors border-[#E0FE10]/30 bg-[#E0FE10]/10 ${isPaused ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#E0FE10]/15'}`}
                      >
                        <p className="text-2xl font-black tracking-[0.14em]">COMMIT</p>
                        <p className="text-xs text-white/45 mt-3 uppercase tracking-[0.25em]">Go cue</p>
                      </motion.button>
                      <motion.button
                        onClick={() => handleActionSelect('brake')}
                        whileHover={{ scale: isPaused ? 1 : 1.02 }}
                        whileTap={{ scale: isPaused ? 1 : 0.98 }}
                        disabled={isPaused}
                        className={`rounded-3xl border px-5 py-8 text-left transition-colors border-emerald-400/30 bg-emerald-400/10 ${isPaused ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-400/15'}`}
                      >
                        <p className="text-2xl font-black tracking-[0.14em]">BRAKE</p>
                        <p className="text-xs text-white/45 mt-3 uppercase tracking-[0.25em]">Stop or fake cue</p>
                      </motion.button>
                    </div>
                  ) : (
                    <div className={`rounded-3xl border px-6 py-8 ${feedback?.success ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
                      <p className="text-lg font-semibold">{feedback?.title}</p>
                      <p className="text-sm text-white/60 mt-2">{feedback?.detail}</p>
                    </div>
                  )}
                  {warningActive && (
                    <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-sm font-medium text-orange-200">
                      {warningMessage}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {stage === 'summary' && feedback && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-black/35 backdrop-blur-xl p-8 space-y-6"
            >
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
                <div className="flex items-center gap-3">
                  <TimerReset className="w-6 h-6 text-emerald-300" />
                  <div>
                    <p className="text-sm text-emerald-200">Brake Point complete</p>
                    <h4 className="text-2xl font-semibold text-white mt-1">{feedback.title}</h4>
                  </div>
                </div>
                <p className="text-sm text-white/70 mt-4">{feedback.detail}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Core Metric</p>
                  <p className="text-lg font-semibold mt-2">Stop Latency</p>
                  <p className="text-sm text-white/65 mt-1">Derived from successful Brake taps on stop/fake cues.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">False Alarms</p>
                  <p className="text-lg font-semibold mt-2">{responses.filter((response) => response.correctAction === 'brake' && response.response === 'commit').length}</p>
                  <p className="text-sm text-white/65 mt-1">Commit taps on Brake cues.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Over-Inhibition</p>
                  <p className="text-lg font-semibold mt-2">{responses.filter((response) => response.correctAction === 'commit' && response.response !== 'commit').length}</p>
                  <p className="text-sm text-white/65 mt-1">Brake taps on Commit cues, or freezing.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:col-span-3">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Input Integrity</p>
                  <p className="text-lg font-semibold mt-2">{spamDetected ? `${spamFlags} rapid-input flags across ${spamRounds} round(s)` : 'No rapid-input flags detected'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                  {responses.filter((response) => response.correct).length}/{responses.length} total signals were handled cleanly.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                  {responses.filter((response) => response.cueType === 'late_reveal').length} late-reveal cues were logged for pressure-sensitive inhibition.
                </div>
              </div>

              <button
                onClick={onComplete}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#E0FE10] text-black font-semibold"
              >
                <ShieldAlert className="w-4 h-4" />
                Finish Brake Point
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default BrakePointGame;
