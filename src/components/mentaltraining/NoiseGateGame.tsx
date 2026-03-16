import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import { DurationMode, type ProfileSnapshotMilestone, PressureType, SessionType, TaxonomySkill } from '../../api/firebase/mentaltraining/taxonomy';
import type { SimBuildArtifact, SimModule } from '../../api/firebase/mentaltraining/types';
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
}

type RoundStage = 'intro' | 'prime' | 'noise' | 'feedback' | 'summary';
type NoiseChannel = 'baseline' | 'visual' | 'audio' | 'combined';

interface NoiseRound {
  id: string;
  targetLabel: string;
  options: string[];
  correctOption: string;
  channel: NoiseChannel;
  tags: string[];
  audioCue?: string;
  visualPattern?: string;
}

interface NoiseResponse {
  roundId: string;
  channel: NoiseChannel;
  correct: boolean;
  response: string;
  latencyMs: number;
  falseAlarm: boolean;
  timedOut: boolean;
}

const TARGET_LABELS = ['ALPHA', 'ORBIT', 'PULSE', 'VECTOR'];
const AUDIO_CUES = ['Crowd Surge', 'Commentary Burst', 'Whistle Blast', 'Buzzer Shock'];
const VISUAL_PATTERNS = ['scatter', 'flash', 'scramble', 'peripheral'];

function parseRoundCount(targetSessionStructure?: string, durationMinutes?: number) {
  const match = targetSessionStructure?.match(/(\d+)/);
  if (match) return Math.max(12, Number(match[1]));
  return Math.max(16, (durationMinutes ?? 5) * 10);
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function buildNoiseRounds(buildArtifact: SimBuildArtifact): NoiseRound[] {
  const total = parseRoundCount(buildArtifact.sessionModel.targetSessionStructure, buildArtifact.sessionModel.durationMinutes);
  const archetype = buildArtifact.sessionModel.archetype as string;
  const baselineCount = Math.max(4, Math.floor(total * 0.25));
  const noiseChannel: NoiseChannel = archetype === 'visual_channel'
    ? 'visual'
    : archetype === 'audio_channel'
      ? 'audio'
      : archetype === 'combined_channel'
        ? 'combined'
        : 'visual';

  return Array.from({ length: total }, (_, index) => {
    const targetLabel = TARGET_LABELS[index % TARGET_LABELS.length];
    const distractors = TARGET_LABELS.filter((label) => label !== targetLabel);
    const options = [targetLabel, ...distractors.slice(0, 2)];
    const shuffled = options.sort(() => Math.random() - 0.5);
    const channel = index < baselineCount ? 'baseline' : noiseChannel;
    return {
      id: `noise-round-${index + 1}`,
      targetLabel,
      options: shuffled,
      correctOption: targetLabel,
      channel,
      tags: [
        channel,
        channel === 'baseline' ? 'baseline_phase' : 'noise_phase',
        channel === 'combined' ? 'overlap' : 'single_channel',
      ],
      audioCue: channel === 'audio' || channel === 'combined' ? AUDIO_CUES[index % AUDIO_CUES.length] : undefined,
      visualPattern: channel === 'visual' || channel === 'combined' ? VISUAL_PATTERNS[index % VISUAL_PATTERNS.length] : undefined,
    };
  });
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
}) => {
  const currentUser = useUser();
  const buildArtifact = exercise.buildArtifact as SimBuildArtifact;
  const rounds = useMemo(() => buildNoiseRounds(buildArtifact), [buildArtifact]);
  const durationMinutes = buildArtifact.sessionModel.durationMinutes as number;
  const targetRoundStructure = buildArtifact.sessionModel.targetSessionStructure as string;
  const stageDurations = useMemo(() => ({ prime: 1400, noise: 2400, feedback: 900 }), []);
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
  const [soundEnabled, setSoundEnabled] = useState(true);
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
        console.error('Failed to play hosted Noise Gate audio cue:', error);
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
    const baselineResponses = finalResponses.filter((response) => response.channel === 'baseline');
    const noiseResponses = finalResponses.filter((response) => response.channel !== 'baseline');
    const baselineAccuracy = baselineResponses.filter((response) => response.correct).length / Math.max(1, baselineResponses.length);
    const noiseAccuracy = noiseResponses.filter((response) => response.correct).length / Math.max(1, noiseResponses.length);
    const baselineLatency = baselineResponses.reduce((sum, response) => sum + response.latencyMs, 0) / Math.max(1, baselineResponses.length);
    const noiseLatency = noiseResponses.reduce((sum, response) => sum + response.latencyMs, 0) / Math.max(1, noiseResponses.length);
    const distractorCost = Number((baselineAccuracy - noiseAccuracy).toFixed(3));
    const falseAlarmRate = Number((noiseResponses.filter((response) => response.falseAlarm).length / Math.max(1, noiseResponses.length)).toFixed(3));
    const channelVulnerability = Number((noiseResponses.filter((response) => !response.correct).length / Math.max(1, noiseResponses.length)).toFixed(3));
    const rtShift = Math.round(noiseLatency - baselineLatency);
    const normalizedScore = clampScore(Math.round(noiseAccuracy * 100));

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
        coreMetricValue: distractorCost,
        supportingMetrics: {
          rt_shift: rtShift,
          false_alarm_rate: falseAlarmRate,
          channel_vulnerability: channelVulnerability,
          baseline_accuracy: Number(baselineAccuracy.toFixed(3)),
          noise_accuracy: Number(noiseAccuracy.toFixed(3)),
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
      title: `${Math.round(noiseAccuracy * 100)}% clean under noise`,
      detail: `Distractor Cost ${distractorCost.toFixed(3)} · RT Shift ${rtShift}ms · False Alarm ${Math.round(falseAlarmRate * 100)}%${spamDetected ? ' · Session flagged for rapid input' : ''}`,
      success: noiseAccuracy >= 0.7 && !spamDetected,
    });
    setStage('summary');
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, previewMode, pressureTypes, spamDetected, spamFlags, spamRounds]);

  const resolveRound = useCallback((responseLabel: string | null) => {
    if (!currentRound || noiseResolvedRef.current) return;
    noiseResolvedRef.current = true;
    const now = Date.now();
    const latencyMs = Math.max(150, now - stageStartRef.current);
    const timedOut = responseLabel === null;
    const correct = responseLabel === currentRound.correctOption;
    const nextResponse: NoiseResponse = {
      roundId: currentRound.id,
      channel: currentRound.channel,
      response: responseLabel ?? 'Timed Out',
      latencyMs,
      correct,
      falseAlarm: Boolean(responseLabel && responseLabel !== currentRound.correctOption),
      timedOut,
    };
    finalizeRound();
    const nextResponses = [...responses, nextResponse];
    setResponses(nextResponses);
    setFeedback({
      title: correct ? 'Clean Hold' : timedOut ? 'Missed Target' : 'Distractor Chase',
      detail: correct
        ? `${currentRound.targetLabel} stayed live under ${currentRound.channel === 'baseline' ? 'baseline' : currentRound.channel} pressure.`
        : timedOut
          ? 'No commitment landed before the noise window closed.'
          : `${responseLabel} pulled attention off the live cue.`,
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
      beginStage('prime', stageDurations.prime);
    }, stageDurations.feedback);
  }, [beginStage, currentRound, finalizeRound, finishSession, responses, roundIndex, rounds.length, stageDurations.feedback, stageDurations.prime]);

  const handleOptionSelect = useCallback((option: string) => {
    if (stage !== 'noise') return;
    if (!registerInputAttempt({ blockedMessage: 'Too fast. Hold the live cue before committing again.' })) {
      return;
    }
    resolveRound(option);
  }, [registerInputAttempt, resolveRound, stage]);

  useEffect(() => {
    if (stage !== 'prime' && stage !== 'noise' && stage !== 'feedback') {
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
      if (stage === 'prime') {
        beginStage('noise', stageDurations.noise);
        if (currentRound?.audioCue && (currentRound.channel === 'audio' || currentRound.channel === 'combined')) {
          playAudioCue(currentRound.audioCue);
        }
        return;
      }
      if (stage === 'noise') {
        resolveRound(null);
      }
    }, 100);
    return () => window.clearInterval(tick);
  }, [beginStage, currentRound, isPaused, playAudioCue, remainingMs, resolveRound, stage, stageDurations.noise, stageDurations.prime]);

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
    beginStage('prime', stageDurations.prime);
  }, [beginStage, resetSession, stageDurations.prime]);

  const noiseRounds = responses.filter((response) => response.channel !== 'baseline');
  const noiseAccuracy = noiseRounds.filter((response) => response.correct).length / Math.max(1, noiseRounds.length);
  const progressPercent = ((roundIndex + (stage === 'summary' ? 1 : 0)) / rounds.length) * 100;

  const visualNoiseActive = currentRound?.channel === 'visual' || currentRound?.channel === 'combined';
  const audioNoiseActive = currentRound?.channel === 'audio' || currentRound?.channel === 'combined';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#09090b] overflow-hidden text-white"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.12),transparent_32%)]" />
      <AnimatePresence>
        {visualNoiseActive && stage === 'noise' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            {Array.from({ length: 18 }).map((_, index) => (
              <motion.div
                key={`clutter-${index}`}
                initial={{ opacity: 0.12 }}
                animate={{ opacity: [0.08, 0.24, 0.1], x: [0, Math.random() * 18 - 9, 0], y: [0, Math.random() * 18 - 9, 0] }}
                transition={{ duration: 0.8 + (index % 4) * 0.15, repeat: Infinity, repeatType: 'mirror' }}
                className="absolute rounded-2xl border border-amber-400/10 bg-amber-400/5"
                style={{
                  width: `${80 + (index % 3) * 24}px`,
                  height: `${48 + (index % 4) * 16}px`,
                  left: `${5 + ((index * 11) % 85)}%`,
                  top: `${8 + ((index * 7) % 78)}%`,
                  transform: `rotate(${index * 17}deg)`,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

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
                  <p className="text-lg font-semibold mt-2">Distractor Cost</p>
                  <p className="text-xs text-white/45 mt-1">Baseline accuracy minus noise accuracy</p>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Channel</p>
                  <p className="text-lg font-semibold mt-2">{String(buildArtifact.sessionModel.archetype).replace(/_/g, ' ')}</p>
                  <p className="text-xs text-white/45 mt-1">Live cue stays constant while distractors rise</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-white/35">How it works</p>
                <p className="text-white/75">Memorize the live cue, then keep selecting it once clutter or sound pressure comes in. Baseline rounds establish clean tracking first. Noise rounds measure how much the distractors degrade your read.</p>
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

          {(stage === 'prime' || stage === 'noise' || stage === 'feedback') && currentRound && (
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
                  <span className="ml-3 uppercase tracking-[0.25em] text-[11px] text-amber-300">{currentRound.channel === 'baseline' ? 'baseline' : `${currentRound.channel} noise`}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Noise accuracy {Math.round(noiseAccuracy * 100)}%</span>
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
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Live Cue</p>
                    <div className="mt-3 rounded-3xl border border-[#E0FE10]/30 bg-[#E0FE10]/10 px-6 py-8 text-center">
                      <p className="text-4xl font-black tracking-[0.2em] text-[#E0FE10]">{currentRound.targetLabel}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-white/65">
                    <p>{stage === 'prime' ? 'Lock in on this cue before the noise phase starts.' : 'Keep this cue live once the distractors hit.'}</p>
                    <p>{currentRound.channel === 'baseline' ? 'Baseline round: no heavy distractors, just establish the clean read.' : currentRound.audioCue ? `${currentRound.audioCue} is active.` : 'Visual clutter is active.'}</p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 space-y-5 relative overflow-hidden">
                  {audioNoiseActive && currentRound.audioCue && stage === 'noise' && (
                    <div className="absolute top-4 right-4 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                      {currentRound.audioCue}
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Decision Field</p>
                    <h3 className="text-2xl font-semibold mt-2">
                      {stage === 'prime' ? 'Memorize the live cue.' : stage === 'noise' ? 'Select the live cue under noise.' : feedback?.title}
                    </h3>
                    <p className="text-sm text-white/55 mt-2">
                      {stage === 'feedback'
                        ? feedback?.detail
                        : currentRound.channel === 'baseline'
                          ? 'Establish the clean cue read before distractors appear.'
                          : 'Ignore the distractors and commit to the original target.'}
                    </p>
                  </div>

                  {stage === 'prime' ? (
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center text-white/55">
                      Noise phase will begin automatically.
                    </div>
                  ) : stage === 'noise' ? (
                    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 transition-all ${visualNoiseActive ? 'rotate-[0.6deg]' : ''}`}>
                      {currentRound.options.map((option, index) => (
                        <motion.button
                          key={`${currentRound.id}-${option}`}
                          onClick={() => handleOptionSelect(option)}
                          whileHover={{ scale: isPaused ? 1 : 1.02 }}
                          whileTap={{ scale: isPaused ? 1 : 0.98 }}
                          disabled={isPaused}
                          animate={visualNoiseActive ? { y: [0, index % 2 === 0 ? -4 : 5, 0], x: [0, index === 1 ? -5 : 4, 0] } : undefined}
                          transition={visualNoiseActive ? { duration: 0.8 + index * 0.08, repeat: Infinity, repeatType: 'mirror' } : undefined}
                          className={`rounded-3xl border px-5 py-8 text-left transition-colors ${option === currentRound.correctOption ? 'border-[#E0FE10]/30 bg-[#E0FE10]/10' : 'border-white/10 bg-white/[0.04]'} ${isPaused ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/[0.08]'}`}
                        >
                          <p className="text-2xl font-black tracking-[0.16em]">{option}</p>
                          <p className="text-xs text-white/45 mt-3 uppercase tracking-[0.25em]">
                            {option === currentRound.correctOption ? 'Live cue' : 'Distractor'}
                          </p>
                        </motion.button>
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
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Noise Accuracy</p>
                  <p className="text-2xl font-semibold mt-2">{Math.round(noiseAccuracy * 100)}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Completed Rounds</p>
                  <p className="text-2xl font-semibold mt-2">{responses.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Channel Mix</p>
                  <p className="text-2xl font-semibold mt-2">{buildArtifact.sessionModel.archetype}</p>
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
