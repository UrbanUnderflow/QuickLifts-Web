import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Pause, Play, ScanSearch, Timer, Volume2, VolumeX, X } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import { DurationMode, type ProfileSnapshotMilestone, PressureType, SessionType, TaxonomySkill } from '../../api/firebase/mentaltraining/taxonomy';
import type { SimBuildArtifact, SimModule } from '../../api/firebase/mentaltraining/types';
import { useInputIntegrity } from './useInputIntegrity';

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

type RoundStage = 'intro' | 'ready' | 'response' | 'feedback' | 'summary';
type SignalCueType = 'standard' | 'late_window' | 'ambiguous' | 'sport_context';

interface SignalRound {
  id: string;
  cueType: SignalCueType;
  prompt: string;
  subPrompt: string;
  scenarioTag: string;
  options: string[];
  correctOption: string;
  plausibleWrong: string;
  pressureTag: 'neutral' | 'pressure';
  windowMs: number;
}

interface SignalResponse {
  roundId: string;
  cueType: SignalCueType;
  response: string | 'timeout';
  correct: boolean;
  latencyMs: number;
  windowMs: number;
  plausibleWrong: string;
  pressureTag: 'neutral' | 'pressure';
}

const GENERIC_SCENARIOS = [
  { prompt: 'Pick the live cue before the display closes.', subPrompt: 'The first commitment is final.', tag: 'standard_read' },
  { prompt: 'Read the correct signal under narrowing time.', subPrompt: 'Late commitment will cost the round.', tag: 'shrinking_window' },
  { prompt: 'Ignore the plausible decoy and commit cleanly.', subPrompt: 'Wrong-but-plausible reads are tracked separately.', tag: 'plausible_wrong' },
];

const SPORT_SCENARIOS = [
  { prompt: 'Shot clock is collapsing. Read the clean window now.', subPrompt: 'End-of-clock pressure is active.', tag: 'late_clock' },
  { prompt: 'Formation shifts late. Commit to the right cue before it closes.', subPrompt: 'Scenario framing is sport-native, but the read rule stays stable.', tag: 'formation_read' },
  { prompt: 'The passing lane opens and closes fast. Take the clean read.', subPrompt: 'Your first commitment is final.', tag: 'phase_of_play' },
];

const OPTION_SETS = [
  ['Strong-Side Read', 'Weak-Side Decoy', 'Neutral Hold'],
  ['Primary Cue', 'Plausible Wrong', 'Late Bail'],
  ['Live Lane', 'Look-Off Decoy', 'Static Miss'],
  ['Correct Window', 'Early Guess', 'Late Panic'],
];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function parseRoundCount(targetSessionStructure?: string, durationMinutes?: number) {
  const match = targetSessionStructure?.match(/(\d+)/);
  if (match) return Math.max(16, Number(match[1]));
  return Math.max(18, (durationMinutes ?? 5) * 12);
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

function inferCueType(index: number, archetype: string): SignalCueType {
  if (archetype === 'sport_context') {
    return index % 3 === 0 ? 'late_window' : 'sport_context';
  }
  if (archetype === 'baseline' && /rapid/i.test(archetype)) {
    return index % 4 === 0 ? 'late_window' : 'standard';
  }
  if (archetype === 'trial') {
    return index % 3 === 0 ? 'ambiguous' : 'late_window';
  }
  return index % 5 === 0 ? 'ambiguous' : index % 3 === 0 ? 'late_window' : 'standard';
}

function buildSignalRounds(buildArtifact: SimBuildArtifact): SignalRound[] {
  const total = parseRoundCount(buildArtifact.sessionModel.targetSessionStructure, buildArtifact.sessionModel.durationMinutes);
  const archetype = String(buildArtifact.sessionModel.archetype ?? 'baseline');

  return Array.from({ length: total }, (_, index) => {
    const cueType = inferCueType(index, archetype);
    const scenarioPool = archetype === 'sport_context' ? SPORT_SCENARIOS : GENERIC_SCENARIOS;
    const scenario = scenarioPool[index % scenarioPool.length];
    const options = OPTION_SETS[index % OPTION_SETS.length];
    const correctOption = options[0];
    const plausibleWrong = options[1];
    const pressureTag = index >= Math.floor(total * 0.55) ? 'pressure' : 'neutral';
    const baseWindow = archetype === 'sport_context' ? 1400 : 1700;
    const windowMs = Math.max(650, baseWindow - (index * 35) - (cueType === 'late_window' ? 220 : cueType === 'ambiguous' ? 120 : 0));

    return {
      id: `signal-round-${index + 1}`,
      cueType,
      prompt: cueType === 'late_window' ? 'The read window is collapsing. Commit now.' : scenario.prompt,
      subPrompt: cueType === 'ambiguous'
        ? 'A plausible-wrong cue is active. Commit only if you see the clean read.'
        : scenario.subPrompt,
      scenarioTag: scenario.tag,
      options,
      correctOption,
      plausibleWrong,
      pressureTag,
      windowMs,
    };
  });
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
  const rounds = useMemo(() => buildSignalRounds(buildArtifact), [buildArtifact]);
  const durationMinutes = buildArtifact.sessionModel.durationMinutes as number;
  const targetRoundStructure = buildArtifact.sessionModel.targetSessionStructure as string;

  const [stage, setStage] = useState<RoundStage>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [responses, setResponses] = useState<SignalResponse[]>([]);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ title: string; detail: string; success: boolean } | null>(null);
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
  const stageRemainingRef = useRef(0);
  const stageStartRef = useRef(Date.now());
  const roundResolvedRef = useRef(false);
  const recordedRef = useRef(false);
  const sessionStartedAtRef = useRef(Date.now());

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

  const playCue = useCallback((cueType: SignalCueType) => {
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
    oscillator.type = cueType === 'ambiguous' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(cueType === 'late_window' ? 760 : cueType === 'sport_context' ? 620 : 520, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }, [soundEnabled]);

  const finishSession = useCallback(async (finalResponses: SignalResponse[]) => {
    const total = Math.max(1, finalResponses.length);
    const correct = finalResponses.filter((response) => response.correct).length;
    const avgLatency = finalResponses.reduce((sum, response) => sum + response.latencyMs, 0) / total;
    const averageWindow = finalResponses.reduce((sum, response) => sum + response.windowMs, 0) / total;
    const plausibleWrongErrors = finalResponses.filter((response) => !response.correct && response.response === response.plausibleWrong).length;
    const lateWindowRounds = finalResponses.filter((response) => response.cueType === 'late_window').length;
    const lateWindowCorrect = finalResponses.filter((response) => response.cueType === 'late_window' && response.correct).length;
    const windowUtilization = averageWindow > 0 ? avgLatency / averageWindow : 0;
    const normalizedScore = clampScore(Math.round((correct / total) * 100) - Math.round(windowUtilization * 18));
    const coreMetricValue = Number((((correct / total) * (1 - Math.min(0.85, windowUtilization * 0.7)))).toFixed(3));

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
        coreMetricName: 'correct_read_under_time_pressure',
        coreMetricValue,
        supportingMetrics: {
          decision_latency: Math.round(avgLatency),
          decoy_susceptibility: Number((plausibleWrongErrors / total).toFixed(3)),
          window_utilization: Number(windowUtilization.toFixed(3)),
          late_window_accuracy: Number((lateWindowCorrect / Math.max(1, lateWindowRounds)).toFixed(3)),
          rapid_input_flags: spamFlags,
          rapid_input_rounds: spamRounds,
          flagged_for_spam: spamDetected ? 1 : 0,
        },
        normalizedScore: spamDetected ? Math.max(0, normalizedScore - 25) : normalizedScore,
        targetSkills: [TaxonomySkill.CueDiscrimination, TaxonomySkill.PressureStability],
        pressureTypes: [PressureType.Time, PressureType.Uncertainty],
        profileSnapshotMilestone,
        createdAt: Date.now(),
      }).catch((error) => {
        console.error('Failed to record Signal Window session:', error);
      });
    }

    setFeedback({
      title: `${correct}/${finalResponses.length} clean reads`,
      detail: `Decision Latency ${Math.round(avgLatency)}ms · Decoy Susceptibility ${Math.round((plausibleWrongErrors / total) * 100)}% · Window Utilization ${Math.round(windowUtilization * 100)}%${spamDetected ? ' · Session flagged for rapid input' : ''}`,
      success: normalizedScore >= 70 && !spamDetected,
    });
    setStage('summary');
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, previewMode, spamDetected, spamFlags, spamRounds]);

  const resolveRound = useCallback((response: string | null) => {
    if (!currentRound || roundResolvedRef.current) return;
    roundResolvedRef.current = true;
    const latencyMs = Math.max(150, Date.now() - stageStartRef.current);
    const nextResponse: SignalResponse = {
      roundId: currentRound.id,
      cueType: currentRound.cueType,
      response: response ?? 'timeout',
      correct: response === currentRound.correctOption,
      latencyMs,
      windowMs: currentRound.windowMs,
      plausibleWrong: currentRound.plausibleWrong,
      pressureTag: currentRound.pressureTag,
    };
    finalizeRound();
    const nextResponses = [...responses, nextResponse];
    setResponses(nextResponses);
    setFeedback({
      title: nextResponse.correct ? 'Clean Read' : response === null ? 'Window Closed' : response === currentRound.plausibleWrong ? 'Decoy Grabbed' : 'Wrong Read',
      detail: nextResponse.correct
        ? 'You committed to the correct cue inside the active window.'
        : response === null
          ? 'The decision window closed before a committed response.'
          : response === currentRound.plausibleWrong
            ? 'You selected the plausible-wrong cue instead of the live read.'
            : 'The committed read did not match the active cue.',
      success: nextResponse.correct,
    });
    beginStage('feedback', 900);

    if (roundIndex >= rounds.length - 1) {
      window.setTimeout(() => finishSession(nextResponses), 900);
      return;
    }

    window.setTimeout(() => {
      setRoundIndex((current) => current + 1);
      roundResolvedRef.current = false;
      setFeedback(null);
      beginStage('ready', 1100);
    }, 900);
  }, [beginStage, currentRound, finalizeRound, finishSession, responses, roundIndex, rounds.length]);

  const handleOptionSelect = useCallback((option: string) => {
    if (stage !== 'response') return;
    if (!registerInputAttempt({ blockedMessage: 'Too fast. Let the cue resolve before committing another read.' })) {
      return;
    }
    resolveRound(option);
  }, [registerInputAttempt, resolveRound, stage]);

  useEffect(() => {
    if (stage !== 'ready' && stage !== 'response' && stage !== 'feedback') return undefined;
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
        if (currentRound) playCue(currentRound.cueType);
        beginStage('response', currentRound?.windowMs ?? 1500);
        return;
      }
      if (stage === 'response') {
        resolveRound(null);
      }
    }, 80);
    return () => window.clearInterval(tick);
  }, [beginStage, currentRound, isPaused, playCue, remainingMs, resolveRound, stage]);

  useEffect(() => () => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const startSession = useCallback(() => {
    sessionStartedAtRef.current = Date.now();
    recordedRef.current = false;
    resetSession();
    setRoundIndex(0);
    setResponses([]);
    setFeedback(null);
    roundResolvedRef.current = false;
    beginStage('ready', 1100);
  }, [beginStage, resetSession]);

  useEffect(() => {
    if (!skipIntro || stage !== 'intro') return;
    startSession();
  }, [skipIntro, stage, startSession]);

  const progressPercent = ((roundIndex + (stage === 'summary' ? 1 : 0)) / rounds.length) * 100;
  const correctPct = responses.length ? Math.round((responses.filter((response) => response.correct).length / responses.length) * 100) : 100;
  const archetypeLabel = String(buildArtifact.sessionModel.archetype ?? 'baseline').replace(/_/g, ' ');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-[#050816] overflow-hidden text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_28%),radial-gradient(circle_at_center,rgba(14,165,233,0.12),transparent_38%)]" />
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5">
        <button onClick={onClose} className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-white/70" />
        </button>
        <div className="flex items-center gap-1.5">
          {rounds.map((round, index) => (
            <div key={round.id} className={`w-2.5 h-2.5 rounded-full transition-colors ${index < roundIndex ? 'bg-cyan-400' : index === roundIndex ? 'bg-blue-300' : 'bg-white/15'}`} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSoundEnabled((current) => !current)} className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
            {soundEnabled ? <Volume2 className="w-5 h-5 text-white/70" /> : <VolumeX className="w-5 h-5 text-white/70" />}
          </button>
          {stage !== 'intro' && stage !== 'summary' && (
            <button onClick={isPaused ? onResume : onPause} className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 h-full flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {stage === 'intro' && (
            <motion.div key="intro" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-black/35 backdrop-blur-xl p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Signal Window</p>
                <h1 className="text-4xl font-black">{buildArtifact.variantName}</h1>
                <p className="text-white/60 max-w-2xl">{buildArtifact.feedbackModel.athleteLabels.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Structure</p>
                  <p className="text-lg font-semibold mt-2">{targetRoundStructure}</p>
                  <p className="text-xs text-white/45 mt-1">{durationMinutes} minute module</p>
                </div>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Core Metric</p>
                  <p className="text-lg font-semibold mt-2">Correct Read Under Time Pressure</p>
                  <p className="text-xs text-white/45 mt-1">Accuracy weighted by decision latency</p>
                </div>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Pressure</p>
                  <p className="text-lg font-semibold mt-2 capitalize">{archetypeLabel}</p>
                  <p className="text-xs text-white/45 mt-1">Late reads and plausible-wrong decoys punish hesitation</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-white/35">How it works</p>
                <p className="text-white/75">A cue appears for a limited window. You get one committed read per round, and the first commitment is final. Late, hesitant, or plausible-wrong choices are all measured separately.</p>
              </div>
              <button onClick={startSession} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#E0FE10] text-black font-semibold">
                <Play className="w-4 h-4" />
                Start Signal Window
              </button>
            </motion.div>
          )}

          {(stage === 'ready' || stage === 'response' || stage === 'feedback') && currentRound && (
            <motion.div key={`round-${currentRound.id}-${stage}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} className="w-full max-w-5xl rounded-[32px] border border-white/10 bg-black/35 backdrop-blur-xl p-8 space-y-6">
              <div className="flex items-center justify-between gap-4 text-sm text-white/55">
                <div>
                  Round {roundIndex + 1} / {rounds.length}
                  <span className="ml-3 uppercase tracking-[0.25em] text-[11px] text-cyan-300">{currentRound.cueType.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Clean rate {correctPct}%</span>
                  {remainingMs !== null && <span>{(remainingMs / 1000).toFixed(1)}s</span>}
                </div>
              </div>

              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div className="h-full bg-cyan-400" animate={{ width: `${progressPercent}%` }} transition={{ duration: 0.3 }} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[0.45fr_0.55fr] gap-6">
                <div className="rounded-[28px] border border-cyan-500/20 bg-cyan-500/10 p-6 space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Read Window</p>
                    <div className="mt-3 rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/20 to-blue-500/10 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-3xl font-black tracking-[0.08em]">{currentRound.scenarioTag.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-white/60 mt-2">{currentRound.subPrompt}</p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-4 py-3 text-center min-w-[96px]">
                          <Timer className="w-4 h-4 text-cyan-300 mx-auto mb-1" />
                          <p className="text-lg font-semibold">{(currentRound.windowMs / 1000).toFixed(1)}s</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-white/65">
                    <p>{stage === 'ready' ? 'Load the display. The cue window opens automatically.' : currentRound.prompt}</p>
                    <p>{currentRound.pressureTag === 'pressure' ? 'Pressure is active. Commit early enough to beat the closing window.' : 'Keep the read clean. One commitment only.'}</p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 space-y-5 relative overflow-hidden">
                  {currentRound.pressureTag === 'pressure' && stage === 'response' && (
                    <div className="absolute top-4 right-4 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                      window collapsing
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Decision Field</p>
                    <h3 className="text-2xl font-semibold mt-2">
                      {stage === 'ready' ? 'Scan the display.' : stage === 'response' ? 'Commit to the correct read before the window closes.' : feedback?.title}
                    </h3>
                    <p className="text-sm text-white/55 mt-2">
                      {stage === 'feedback'
                        ? feedback?.detail
                        : 'The plausible-wrong read is designed to feel tempting. The first response is final.'}
                    </p>
                  </div>

                  {stage === 'ready' ? (
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center text-white/55">
                      Cue field is loading.
                    </div>
                  ) : stage === 'response' ? (
                    <div className="grid grid-cols-1 gap-4">
                      {currentRound.options.map((option) => (
                        <motion.button
                          key={option}
                          onClick={() => handleOptionSelect(option)}
                          whileHover={{ scale: isPaused ? 1 : 1.01 }}
                          whileTap={{ scale: isPaused ? 1 : 0.99 }}
                          disabled={isPaused}
                          className={`rounded-3xl border px-5 py-5 text-left transition-colors ${option === currentRound.plausibleWrong ? 'border-amber-400/20 bg-amber-400/5' : 'border-cyan-400/20 bg-cyan-400/8'} ${isPaused ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/[0.06]'}`}
                        >
                          <div className="flex items-start gap-3">
                            <Eye className="w-5 h-5 mt-0.5 text-cyan-300" />
                            <div>
                              <p className="text-xl font-semibold">{option}</p>
                              <p className="text-xs text-white/45 mt-2">{option === currentRound.plausibleWrong ? 'Plausible wrong read. Tempting but incorrect.' : option === currentRound.correctOption ? 'Live cue if the display supports it.' : 'Neutral miss or late bailout.'}</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <div className={`rounded-3xl border px-6 py-8 ${feedback?.success ? 'border-cyan-500/25 bg-cyan-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
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
            <motion.div key="summary" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-black/35 backdrop-blur-xl p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Session Summary</p>
                <h2 className="text-3xl font-black">{feedback.title}</h2>
                <p className="text-white/60">{feedback.detail}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Accuracy</p>
                  <p className="text-2xl font-semibold mt-2">{responses.length ? Math.round((responses.filter((response) => response.correct).length / responses.length) * 100) : 0}%</p>
                </div>
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Decision Latency</p>
                  <p className="text-2xl font-semibold mt-2">{responses.length ? Math.round(responses.reduce((sum, response) => sum + response.latencyMs, 0) / responses.length) : 0}ms</p>
                </div>
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Decoy Susceptibility</p>
                  <p className="text-2xl font-semibold mt-2">{responses.length ? Math.round((responses.filter((response) => !response.correct && response.response === response.plausibleWrong).length / responses.length) * 100) : 0}%</p>
                </div>
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 md:col-span-3">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Input Integrity</p>
                  <p className="text-2xl font-semibold mt-2">{spamDetected ? `${spamFlags} rapid-input flags across ${spamRounds} round(s)` : 'No rapid-input flags detected'}</p>
                </div>
              </div>
              <button onClick={onComplete} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#E0FE10] text-black font-semibold">
                <ScanSearch className="w-4 h-4" />
                Finish Signal Window
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SignalWindowGame;
