import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import { DurationMode, type ProfileSnapshotMilestone, PressureType, SessionType, TaxonomySkill } from '../../api/firebase/mentaltraining/taxonomy';
import type { SimBuildArtifact, SimModule } from '../../api/firebase/mentaltraining/types';
import {
  buildNoiseGateRounds,
  calculateNoiseGateMeasurement,
  type NoiseResponse,
} from './noiseGateMeasurement';
import { useInputIntegrity } from './useInputIntegrity';

interface NoiseGateGameProps {
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

type RoundStage = 'intro' | 'ready' | 'search' | 'feedback' | 'summary';
const MARKER_POSITIONS = [
  [18, 19], [50, 18], [82, 22],
  [20, 50], [52, 48], [80, 52],
  [17, 81], [49, 80], [83, 78],
] as const;

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

export const NoiseGateGame: React.FC<NoiseGateGameProps> = ({
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
  const rounds = useMemo(() => buildNoiseGateRounds({
    targetSessionStructure: buildArtifact.sessionModel.targetSessionStructure,
    durationMinutes: buildArtifact.sessionModel.durationMinutes,
    archetype: buildArtifact.sessionModel.archetype,
  }), [buildArtifact]);
  const durationMinutes = buildArtifact.sessionModel.durationMinutes as number;
  const targetRoundStructure = buildArtifact.sessionModel.targetSessionStructure as string;
  const stageDurations = useMemo(() => ({ ready: 650, search: 2800, feedback: 850 }), []);
  const pressureTypes = useMemo<PressureType[]>(() => {
    const archetype = buildArtifact.sessionModel.archetype as string;
    if (archetype === 'audio_channel') return [PressureType.Audio];
    if (archetype === 'combined_channel') return [PressureType.Audio, PressureType.Visual];
    return [PressureType.Visual];
  }, [buildArtifact]);
  const audioAssets = (buildArtifact.stimulusModel?.audioAssets ?? exercise.runtimeConfig?.audioAssets ?? {}) as Record<string, { downloadURL?: string }>;

  const [stage, setStage] = useState<RoundStage>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [responses, setResponses] = useState<NoiseResponse[]>([]);
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
  const cueAudioRef = useRef<HTMLAudioElement | null>(null);
  const stageEndsAtRef = useRef<number | null>(null);
  const stageRemainingRef = useRef<number>(0);
  const stageStartRef = useRef<number>(Date.now());
  const noiseResolvedRef = useRef(false);
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

  const getAudioCueAssetUrl = useCallback((cue: string) => {
    const normalized = cue.toLowerCase();
    if (normalized.includes('commentary')) return audioAssets.commentary_overlap?.downloadURL;
    if (normalized.includes('whistle')) return audioAssets.whistle_blast?.downloadURL;
    if (normalized.includes('buzzer')) return audioAssets.buzzer_shock?.downloadURL;
    if (normalized.includes('crowd')) return audioAssets.crowd_bed?.downloadURL ?? audioAssets.crowd_surge?.downloadURL;
    return undefined;
  }, [audioAssets]);

  const playAudioCue = useCallback((cue: string) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    const assetUrl = getAudioCueAssetUrl(cue);
    if (assetUrl) {
      try {
        if (cueAudioRef.current) {
          cueAudioRef.current.pause();
          cueAudioRef.current = null;
        }
        const audio = new Audio(assetUrl);
        audio.volume = cue.toLowerCase().includes('crowd') ? 0.5 : 0.72;
        audio.currentTime = 0;
        cueAudioRef.current = audio;
        audio.play().catch(() => undefined);
        return;
      } catch (error) {
        console.error('Failed to play hosted Noise Gate audio prompt:', error);
      }
    }
    const BrowserAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!BrowserAudioContext) return;
    const context = audioContextRef.current ?? new BrowserAudioContext();
    audioContextRef.current = context;
    if (context.state === 'suspended') {
      context.resume().catch(() => undefined);
    }
    const now = context.currentTime;
    const base = cue.toLowerCase().includes('buzzer') ? 220 : cue.toLowerCase().includes('whistle') ? 1120 : 520;
    [0, 0.14, 0.3].forEach((offset) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = cue.toLowerCase().includes('crowd') ? 'sawtooth' : 'square';
      oscillator.frequency.setValueAtTime(base, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.08, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.14);
    });
  }, [getAudioCueAssetUrl, soundEnabled]);

  const finishSession = useCallback(async (finalResponses: NoiseResponse[]) => {
    const measurement = calculateNoiseGateMeasurement(finalResponses);
    const normalizedScore = clampScore(Math.round(measurement.distractionAccuracy * 100));
    const accuracyPointChange = Math.round((measurement.distractionAccuracy - measurement.referenceAccuracy) * 100);
    const accuracyComparison = accuracyPointChange === 0
      ? 'Accuracy was the same across the matched reference and distraction rounds.'
      : accuracyPointChange > 0
        ? `Accuracy was ${accuracyPointChange} points higher in the matched distraction rounds.`
        : `Accuracy was ${Math.abs(accuracyPointChange)} points lower in the matched distraction rounds.`;
    const speedComparison = measurement.correctResponseRtShiftMs === null
      ? 'At least three matched pairs need correct responses in both conditions before response speed is compared.'
      : Math.abs(measurement.correctResponseRtShiftMs) < 10
        ? 'Correct-response speed was about the same across conditions.'
        : measurement.correctResponseRtShiftMs > 0
          ? `Correct responses were ${measurement.correctResponseRtShiftMs} ms slower in distraction rounds.`
          : `Correct responses were ${Math.abs(measurement.correctResponseRtShiftMs)} ms faster in distraction rounds.`;
    const highlightedDistractorDetail = measurement.highlightedDistractorTapRate === null
      ? ''
      : ` Highlighted-marker taps: ${Math.round(measurement.highlightedDistractorTapRate * 100)}%.`;

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
        coreMetricName: 'distractor_cost',
        coreMetricValue: measurement.accuracyCost,
        supportingMetrics: {
          correct_response_rt_shift: measurement.correctResponseRtShiftMs ?? 0,
          correct_response_rt_shift_available: measurement.correctResponseRtShiftMs === null ? 0 : 1,
          matched_correct_pair_count: measurement.matchedCorrectPairCount,
          wrong_tap_rate: measurement.wrongTapRate,
          highlighted_distractor_tap_rate: measurement.highlightedDistractorTapRate ?? 0,
          highlighted_distractor_tap_rate_available: measurement.highlightedDistractorTapRate === null ? 0 : 1,
          timeout_rate: measurement.timeoutRate,
          reference_accuracy: measurement.referenceAccuracy,
          distraction_accuracy: measurement.distractionAccuracy,
          scored_reference_rounds: measurement.scoredReferenceRounds,
          scored_distraction_rounds: measurement.scoredDistractionRounds,
          ...(measurement.activeChannel
            ? { [`${measurement.activeChannel}_distraction_accuracy`]: measurement.distractionAccuracy }
            : {}),
          rapid_input_flags: spamFlags,
          rapid_input_rounds: spamRounds,
          flagged_for_spam: spamDetected ? 1 : 0,
        },
        normalizedScore: spamDetected ? Math.max(0, normalizedScore - 25) : normalizedScore,
        targetSkills: [TaxonomySkill.SelectiveAttention, TaxonomySkill.CueDiscrimination],
        pressureTypes,
        profileSnapshotMilestone,
        createdAt: Date.now(),
      }).catch((error) => {
        console.error('Failed to record Noise Gate session:', error);
      });
    }

    setFeedback({
      title: `${measurement.correctWithDistractions} of ${measurement.scoredDistractionRounds} correct in distraction rounds`,
      detail: `${accuracyComparison} ${speedComparison} Wrong taps: ${Math.round(measurement.wrongTapRate * 100)}%. Timeouts: ${Math.round(measurement.timeoutRate * 100)}%.${highlightedDistractorDetail}${spamDetected ? ' Session flagged for rapid input.' : ''}`,
      success: !spamDetected,
    });
    setStage('summary');
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, previewMode, pressureTypes, spamDetected, spamFlags, spamRounds]);

  const resolveRound = useCallback((responseLabel: string | null) => {
    if (!currentRound || noiseResolvedRef.current) return;
    noiseResolvedRef.current = true;
    const now = Date.now();
    const latencyMs = Math.max(0, now - stageStartRef.current);
    const timedOut = responseLabel === null;
    const correct = responseLabel === currentRound.correctOption;
    const nextResponse: NoiseResponse = {
      roundId: currentRound.id,
      pairId: currentRound.pairId,
      isPractice: currentRound.isPractice,
      channel: currentRound.channel,
      response: responseLabel ?? 'Timed Out',
      latencyMs,
      correct,
      wrongTap: Boolean(responseLabel && responseLabel !== currentRound.correctOption),
      selectedHighlightedDistractor: Boolean(responseLabel && responseLabel === currentRound.distractorOption),
      hadHighlightedDistractor: Boolean(currentRound.distractorOption),
      timedOut,
    };
    finalizeRound();
    const nextResponses = [...responses, nextResponse];
    setResponses(nextResponses);
    setFeedback({
      title: correct ? 'Found It' : timedOut ? 'Time Ran Out' : 'Wrong Number',
      detail: correct
        ? `You matched ${currentRound.targetLabel}.`
        : timedOut
          ? `The matching number was ${currentRound.targetLabel}.`
          : `You tapped ${responseLabel}. The matching number was ${currentRound.targetLabel}.`,
      success: correct,
    });
    beginStage('feedback', stageDurations.feedback);
    if (roundIndex >= rounds.length - 1) {
      window.setTimeout(() => finishSession(nextResponses), stageDurations.feedback);
      return;
    }
    window.setTimeout(() => {
      setRoundIndex((current) => current + 1);
      noiseResolvedRef.current = false;
      setFeedback(null);
      beginStage('ready', stageDurations.ready);
    }, stageDurations.feedback);
  }, [beginStage, currentRound, finalizeRound, finishSession, responses, roundIndex, rounds.length, stageDurations.feedback, stageDurations.ready]);

  const handleOptionSelect = useCallback((option: string) => {
    if (stage !== 'search') return;
    if (!registerInputAttempt({ blockedMessage: 'One choice per round. Wait for the next field.' })) {
      return;
    }
    resolveRound(option);
  }, [registerInputAttempt, resolveRound, stage]);

  useEffect(() => {
    if (stage !== 'ready' && stage !== 'search' && stage !== 'feedback') {
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
        beginStage('search', stageDurations.search);
        if (currentRound?.audioCue && (currentRound.channel === 'audio' || currentRound.channel === 'combined')) {
          playAudioCue(currentRound.audioCue);
        }
        return;
      }
      if (stage === 'search') {
        resolveRound(null);
      }
    }, 100);
    return () => window.clearInterval(tick);
  }, [beginStage, currentRound, isPaused, playAudioCue, remainingMs, resolveRound, stage, stageDurations.ready, stageDurations.search]);

  useEffect(() => {
    return () => {
      if (cueAudioRef.current) {
        cueAudioRef.current.pause();
        cueAudioRef.current = null;
      }
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
    noiseResolvedRef.current = false;
    beginStage('ready', stageDurations.ready);
  }, [beginStage, resetSession, stageDurations.ready]);

  useEffect(() => {
    if (!skipIntro || stage !== 'intro') return;
    startSession();
  }, [skipIntro, stage, startSession]);

  const measurement = useMemo(() => calculateNoiseGateMeasurement(responses), [responses]);
  const progressPercent = ((roundIndex + (stage === 'summary' ? 1 : 0)) / rounds.length) * 100;

  const audioNoiseActive = currentRound?.channel === 'audio' || currentRound?.channel === 'combined';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#09090b] overflow-hidden text-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_32%)]" />
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5">
        <button onClick={onClose} className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-white/70" />
        </button>
        <div className="flex items-center gap-1.5">
          {rounds.map((round, index) => (
            <div
              key={round.id}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${index < roundIndex ? 'bg-[#E0FE10]' : index === roundIndex ? 'bg-amber-400' : 'bg-white/15'}`}
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
              aria-label={isPaused ? 'Resume' : 'Pause'}
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
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Noise Gate</p>
                <h1 className="text-4xl font-black">{buildArtifact.variantName}</h1>
                <p className="text-white/60 max-w-2xl">{buildArtifact.feedbackModel.athleteLabels.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Structure</p>
                  <p className="text-lg font-semibold mt-2">{targetRoundStructure}</p>
                  <p className="text-xs text-white/45 mt-1">{durationMinutes} minute module</p>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Core Metric</p>
                  <p className="text-lg font-semibold mt-2">Accuracy Change</p>
                  <p className="text-xs text-white/45 mt-1">Reference rounds compared with distraction rounds</p>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Channel</p>
                  <p className="text-lg font-semibold mt-2">{String(buildArtifact.sessionModel.archetype).replace(/_/g, ' ')}</p>
                  <p className="text-xs text-white/45 mt-1">The search task stays the same while distractions are added</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-white/35">How it works</p>
                <p className="text-white/75">A number stays visible at the top. Find and tap that same number in the field. You get two unscored practice rounds, then matched reference and distraction rounds in a mixed order.</p>
              </div>
              <button
                onClick={startSession}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#E0FE10] text-black font-semibold"
              >
                <Play className="w-4 h-4" />
                Start Noise Gate
              </button>
            </motion.div>
          )}

          {(stage === 'ready' || stage === 'search' || stage === 'feedback') && currentRound && (
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
                  <span className="ml-3 uppercase tracking-[0.25em] text-[11px] text-amber-300">{currentRound.isPractice ? 'practice' : currentRound.channel === 'baseline' ? 'reference' : 'distractions'}</span>
                </div>
                <div className="flex items-center gap-3">
                  {remainingMs !== null && <span>{(remainingMs / 1000).toFixed(1)}s</span>}
                </div>
              </div>

              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-amber-400"
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[0.45fr_0.55fr] gap-6">
                <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-6 space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Find This Number</p>
                    <div className="mt-3 rounded-3xl border border-[#E0FE10]/30 bg-[#E0FE10]/10 px-6 py-8 text-center">
                      <p className="text-5xl font-black tabular-nums text-[#E0FE10]">{currentRound.targetLabel}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-white/65">
                    <p>This number stays visible for the whole round.</p>
                    <p>{currentRound.isPractice ? 'This round is practice and does not count toward your result.' : currentRound.channel === 'baseline' ? 'No added distractions this round.' : currentRound.channel === 'combined' ? 'Ignore the flashing marker and the crowd sound.' : currentRound.audioCue ? 'Keep reading the field while the crowd sound plays.' : 'Ignore the flashing marker.'}</p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 space-y-5 relative overflow-hidden">
                  {audioNoiseActive && currentRound.audioCue && stage === 'search' && (
                    <div className="absolute top-4 right-4 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                      Crowd sound playing
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Search Field</p>
                    <h3 className="text-2xl font-semibold mt-2">
                      {stage === 'ready' ? 'Get ready.' : stage === 'search' ? 'Tap the matching number.' : feedback?.title}
                    </h3>
                    <p className="text-sm text-white/55 mt-2">
                      {stage === 'feedback'
                        ? feedback?.detail
                        : currentRound.channel === 'baseline'
                          ? 'Find the exact match.'
                          : 'Ignore the flashing marker and crowd sound. Tap the number shown on the left.'}
                    </p>
                  </div>

                  {stage === 'ready' ? (
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center text-white/55">
                      The field appears next.
                    </div>
                  ) : stage === 'search' ? (
                    <div className="relative aspect-[4/3] min-h-[360px] overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035]">
                      <div className="absolute inset-y-5 left-1/2 w-px bg-white/10" />
                      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
                      {currentRound.options.map((option, index) => (
                        <div
                          key={`${currentRound.id}-${option}`}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${MARKER_POSITIONS[index][0]}%`, top: `${MARKER_POSITIONS[index][1]}%` }}
                        >
                          <motion.button
                            onClick={() => handleOptionSelect(option)}
                            whileHover={{ scale: isPaused ? 1 : 1.04 }}
                            whileTap={{ scale: isPaused ? 1 : 0.96 }}
                            disabled={isPaused}
                            animate={option === currentRound.distractorOption ? { scale: [1, 1.12, 1] } : undefined}
                            transition={option === currentRound.distractorOption ? { duration: 0.7, repeat: Infinity, repeatType: 'mirror' } : undefined}
                            aria-label={`Number ${option}`}
                            className={`flex h-[68px] w-[74px] flex-col items-center justify-center rounded-[20px] border-2 transition-colors ${option === currentRound.distractorOption ? 'border-orange-400/80 bg-orange-400/25 shadow-[0_0_28px_rgba(251,146,60,0.28)]' : 'border-white/15 bg-white/[0.07] hover:bg-white/[0.12]'} ${isPaused ? 'cursor-not-allowed opacity-50' : ''}`}
                          >
                            <span className="mb-1 h-2 w-2 rounded-full bg-current opacity-60" />
                            <span className="text-2xl font-black tabular-nums">{option}</span>
                          </motion.button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`rounded-3xl border p-8 ${feedback?.success ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
                      <p className={`text-lg font-semibold ${feedback?.success ? 'text-emerald-200' : 'text-red-200'}`}>{feedback?.title}</p>
                      <p className="text-sm text-white/65 mt-2">{feedback?.detail}</p>
                    </div>
                  )}
                  {warningActive && (
                    <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-sm font-medium text-orange-200">
                      {warningMessage}
                    </div>
                  )}
                </div>
              </div>

              {isPaused && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  Module paused. Resume to continue this round without advancing the timer.
                </div>
              )}
            </motion.div>
          )}

          {stage === 'summary' && feedback && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              className="w-full max-w-4xl rounded-[32px] border border-white/10 bg-black/35 backdrop-blur-xl p-8 space-y-6"
            >
              <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Noise Gate Summary</p>
                <h2 className="text-3xl font-black mt-2">{feedback.title}</h2>
                <p className="text-white/65 mt-3">{feedback.detail}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">With Distractions</p>
                  <p className="text-2xl font-semibold mt-2">{Math.round(measurement.distractionAccuracy * 100)}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Matched Difference</p>
                  <p className="text-2xl font-semibold mt-2">{Math.abs(Math.round(measurement.accuracyCost * 100))} pts</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Scored Rounds</p>
                  <p className="text-2xl font-semibold mt-2">{measurement.scoredReferenceRounds + measurement.scoredDistractionRounds}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:col-span-3">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Input Integrity</p>
                  <p className="text-lg font-semibold mt-2">{spamDetected ? `${spamFlags} rapid-input flags across ${spamRounds} round(s)` : 'No rapid-input flags detected'}</p>
                </div>
              </div>

              <button
                onClick={onComplete}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#E0FE10] text-black font-semibold"
              >
                <BarChart3 className="w-4 h-4" />
                Finish Noise Gate
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default NoiseGateGame;
