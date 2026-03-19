import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gauge, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import {
  resolveEnduranceLockRuntimeProfile,
  type EnduranceLockFlavor,
  type EnduranceLockPhaseTag,
  type EnduranceLockPressureTag,
  type EnduranceLockRuntimeProfile,
} from '../../api/firebase/mentaltraining/enduranceLockProfiles';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import { DurationMode, type ProfileSnapshotMilestone, PressureType, SessionType, TaxonomySkill } from '../../api/firebase/mentaltraining/taxonomy';
import type { SimBuildArtifact, SimModule } from '../../api/firebase/mentaltraining/types';
import { useInputIntegrity } from './useInputIntegrity';

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

type GameStage = 'intro' | 'active' | 'summary';

interface EnduranceCue {
  index: number;
  blockIndex: number;
  blockLabel: string;
  phaseTag: EnduranceLockPhaseTag;
  pressureTag: EnduranceLockPressureTag;
  cadenceMs: number;
  windowMs: number;
  prompt: string;
  profileFlavor: EnduranceLockFlavor;
  profileId: string;
  scheduleVersion: string;
  visualDensityTier: 'low' | 'medium' | 'high';
  peripheralLoadTier: 'low' | 'medium' | 'high';
  contrastProfile: 'normal_contrast' | 'reduced_contrast' | 'glare_wash';
  activeModifiers: string[];
  scoreWeight: number;
  errorPenaltyWeight: number;
}

interface EnduranceResponse {
  cueIndex: number;
  blockIndex: number;
  phaseTag: EnduranceLockPhaseTag;
  pressureTag: EnduranceLockPressureTag;
  correct: boolean;
  latencyMs: number;
  response: 'tap' | 'timeout' | 'early';
}

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

function getEndurancePressureTypes(runtimeProfile: EnduranceLockRuntimeProfile): PressureType[] {
  if (runtimeProfile.flavor === 'visual_channel') {
    return [PressureType.Fatigue, PressureType.Visual];
  }
  if (runtimeProfile.profileId === 'error_consequence_v1') {
    return [PressureType.Fatigue, PressureType.Evaluative];
  }
  return [PressureType.Fatigue, PressureType.Time];
}

function getStageStatusLabel(cue: EnduranceCue) {
  if (cue.profileFlavor === 'late_pressure') {
    if (cue.profileId === 'score_weight_v1' && cue.phaseTag === 'finish') {
      return 'Final blocks count more now. Keep execution clean.';
    }
    if (cue.profileId === 'error_consequence_v1' && cue.phaseTag === 'finish') {
      return 'Late misses sting here. Lock in and stay exact.';
    }
    return cue.phaseTag === 'finish'
      ? 'Cadence compresses late. Keep control under pressure.'
      : cue.phaseTag === 'middle'
        ? 'Load is building. Stay precise.'
        : 'Anchor the rhythm and keep it clean.';
  }
  if (cue.profileFlavor === 'visual_channel') {
    if (cue.phaseTag === 'finish') {
      return cue.profileId === 'peripheral_bait_v1'
        ? 'Ignore the edge competition and keep the center target.'
        : cue.profileId === 'contrast_decay_v1'
          ? 'Low-salience finish block. Do not oversearch.'
          : 'High clutter finish block. Hold the same target rule.';
    }
    return cue.phaseTag === 'middle'
      ? 'Visual load is rising. Keep the same task, not the noise.'
      : 'Clean-reference baseline. Hold the target.';
  }
  return cue.phaseTag === 'finish'
    ? 'Fatigue and stakes are up. Keep the same clean timing.'
    : cue.phaseTag === 'middle'
      ? 'Load is building. Stay precise.'
      : 'Anchor the rhythm and keep it clean.';
}

function buildEnduranceCues(buildArtifact: SimBuildArtifact, runtimeProfile: EnduranceLockRuntimeProfile): EnduranceCue[] {
  const durationMinutes = Number(buildArtifact.sessionModel.durationMinutes ?? 6);
  const total = parseCueCount(buildArtifact.sessionModel.targetSessionStructure, durationMinutes);
  const blockCount = runtimeProfile.blockPlans.length;
  const perBlock = Math.max(6, Math.ceil(total / blockCount));

  return Array.from({ length: total }, (_, index) => {
    const blockIndex = Math.min(blockCount - 1, Math.floor(index / perBlock));
    const blockPlan = runtimeProfile.blockPlans[blockIndex];

    return {
      index,
      blockIndex,
      blockLabel: blockPlan.blockLabel,
      phaseTag: blockPlan.phaseTag,
      pressureTag: blockPlan.pressureTag,
      cadenceMs: blockPlan.cadenceMs,
      windowMs: blockPlan.windowMs,
      prompt: blockPlan.prompt,
      profileFlavor: runtimeProfile.flavor,
      profileId: runtimeProfile.profileId,
      scheduleVersion: runtimeProfile.scheduleVersion,
      visualDensityTier: blockPlan.visualDensityTier,
      peripheralLoadTier: blockPlan.peripheralLoadTier,
      contrastProfile: blockPlan.contrastProfile,
      activeModifiers: blockPlan.activeModifiers,
      scoreWeight: blockPlan.scoreWeight,
      errorPenaltyWeight: blockPlan.errorPenaltyWeight,
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
  profileSnapshotMilestone,
  previewMode = false,
  skipIntro = false,
  initialSoundEnabled = true,
}) => {
  const currentUser = useUser();
  const buildArtifact = exercise.buildArtifact as SimBuildArtifact;
  const runtimeProfile = useMemo(() => resolveEnduranceLockRuntimeProfile({
    archetype: buildArtifact.sessionModel.archetype as string | undefined,
    variantName: buildArtifact.variantName,
    runtimeConfig: exercise.runtimeConfig ?? null,
    stimulusModel: buildArtifact.stimulusModel ?? null,
  }), [buildArtifact.sessionModel.archetype, buildArtifact.stimulusModel, buildArtifact.variantName, exercise.runtimeConfig]);
  const cues = useMemo(() => buildEnduranceCues(buildArtifact, runtimeProfile), [buildArtifact, runtimeProfile]);
  const durationMinutes = Number(buildArtifact.sessionModel.durationMinutes ?? 6);

  const [stage, setStage] = useState<GameStage>('intro');
  const [cueIndex, setCueIndex] = useState(0);
  const [responses, setResponses] = useState<EnduranceResponse[]>([]);
  const [cueActive, setCueActive] = useState(false);
  const [cueWindowMs, setCueWindowMs] = useState(420);
  const [pulseScale, setPulseScale] = useState(1);
  const [statusLabel, setStatusLabel] = useState('Tap on the pulse and keep the rhythm clean.');
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);
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
  } = useInputIntegrity();

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

  const playPulse = useCallback((cue: EnduranceCue) => {
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
    oscillator.type = cue.profileFlavor === 'late_pressure' && cue.phaseTag === 'finish'
      ? 'square'
      : cue.profileFlavor === 'visual_channel'
        ? 'triangle'
        : 'sine';
    const frequency = cue.profileFlavor === 'late_pressure' && cue.profileId === 'clock_compression_v1'
      ? (cue.phaseTag === 'finish' ? 300 : 520)
      : cue.profileFlavor === 'late_pressure' && cue.profileId === 'error_consequence_v1'
        ? (cue.phaseTag === 'finish' ? 240 : 500)
        : cue.profileFlavor === 'visual_channel'
          ? (cue.phaseTag === 'finish' ? 470 : 560)
          : cue.phaseTag === 'finish'
            ? 360
            : 520;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  }, [soundEnabled]);

  const finishSession = useCallback(async (finalResponses: EnduranceResponse[]) => {
    const blockCount = runtimeProfile.blockPlans.length;
    const blockAccuracies = Array.from({ length: blockCount }, (_, index) => {
      const blockResponses = finalResponses.filter((response) => response.blockIndex === index);
      return blockResponses.filter((response) => response.correct).length / Math.max(1, blockResponses.length);
    });
    const baselineBlocks = blockAccuracies.slice(0, 2);
    const finishBlocks = blockAccuracies.slice(4, 6);
    const baselinePerformance = baselineBlocks.reduce((sum, value) => sum + value, 0) / Math.max(1, baselineBlocks.length);
    const finishPerformance = finishBlocks.reduce((sum, value) => sum + value, 0) / Math.max(1, finishBlocks.length);
    const degradationSlope = Number(((baselinePerformance - finishPerformance) / Math.max(1, finishBlocks.length + 1)).toFixed(3));
    const degradationOnset = blockAccuracies.findIndex((value, index) => index > 0 && value < baselinePerformance * 0.9);
    const finalPhaseBreakdowns = finalResponses.filter((response) => response.phaseTag === 'finish' && !response.correct).length;
    const avgLatency = finalResponses.reduce((sum, response) => sum + response.latencyMs, 0) / Math.max(1, finalResponses.length);
    const weightedCorrect = finalResponses.reduce((sum, response) => {
      const cue = cues[response.cueIndex];
      return sum + (response.correct ? cue?.scoreWeight ?? 1 : 0);
    }, 0);
    const weightedTotal = finalResponses.reduce((sum, response) => sum + (cues[response.cueIndex]?.scoreWeight ?? 1), 0);
    const weightedAccuracy = weightedCorrect / Math.max(1, weightedTotal);
    const finishPenalty = finalResponses
      .filter((response) => response.phaseTag === 'finish' && !response.correct)
      .reduce((sum, response) => sum + ((cues[response.cueIndex]?.errorPenaltyWeight ?? 1) * 2), 0);
    const normalizedScore = clampScore(
      Math.round(weightedAccuracy * 100) - finishPenalty - (spamDetected ? 25 : 0)
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
          block_5_accuracy: Number((blockAccuracies[4] ?? 0).toFixed(3)),
          block_6_accuracy: Number((blockAccuracies[5] ?? 0).toFixed(3)),
          rapid_input_flags: spamFlags,
          rapid_input_rounds: spamRounds,
          flagged_for_spam: spamDetected ? 1 : 0,
        },
        normalizedScore,
        targetSkills: [TaxonomySkill.SustainedAttention, TaxonomySkill.PressureStability],
        pressureTypes: getEndurancePressureTypes(runtimeProfile),
        profileSnapshotMilestone,
        createdAt: Date.now(),
      }).catch((error) => {
        console.error('Failed to record Endurance Lock session:', error);
      });
    }

    setSummaryDetail(
      `${runtimeProfile.summaryLabel} · Baseline ${(baselinePerformance * 100).toFixed(0)}% · Finish ${(finishPerformance * 100).toFixed(0)}% · Degradation Slope ${degradationSlope.toFixed(3)} · Onset ${degradationOnset >= 0 ? `Block ${degradationOnset + 1}` : 'Stable'}${spamDetected ? ' · Session flagged for rapid input' : ''}`
    );
    setStage('summary');
  }, [buildArtifact, cues, currentUser?.id, durationMinutes, exercise.id, previewMode, runtimeProfile, spamDetected, spamFlags, spamRounds]);

  const advanceAfterResponse = useCallback((nextResponses: EnduranceResponse[]) => {
    clearTimers();
    if (cueIndex >= cues.length - 1) {
      finishSession(nextResponses);
      return;
    }
    const nextIndex = cueIndex + 1;
    const upcoming = cues[nextIndex];
    setCueIndex(nextIndex);
    setStatusLabel(getStageStatusLabel(upcoming));
    cueTimerRef.current = setTimeout(() => {
      if (isPaused) return;
      cueResolvedRef.current = false;
      cueStartRef.current = Date.now();
      setCueWindowMs(upcoming.windowMs);
      setCueActive(true);
      setPulseScale(1.28);
      playPulse(upcoming);
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
    if (!registerInputAttempt({ blockedMessage: 'Too fast. Stay with the cadence instead of spamming taps.' })) {
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
    setStatusLabel(runtimeProfile.introLabel);
    resetInputSession();
    setStage('active');
  }, [resetInputSession, runtimeProfile.introLabel]);

  useEffect(() => {
    if (!skipIntro || stage !== 'intro') return;
    startSession();
  }, [skipIntro, stage, startSession]);

  useEffect(() => {
    if (stage !== 'active' || !currentCue || isPaused) return undefined;
    if (cueActive || cueTimerRef.current || closeWindowRef.current) return undefined;
    cueTimerRef.current = setTimeout(() => {
      cueResolvedRef.current = false;
      cueStartRef.current = Date.now();
      setCueWindowMs(currentCue.windowMs);
      setCueActive(true);
      setPulseScale(1.28);
      playPulse(currentCue);
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
  const accentColor = runtimeProfile.flavor === 'visual_channel'
    ? '#84cc16'
    : runtimeProfile.flavor === 'late_pressure'
      ? '#f97316'
      : '#22d3ee';
  const accentSoft = runtimeProfile.flavor === 'visual_channel'
    ? 'rgba(132, 204, 22, 0.14)'
    : runtimeProfile.flavor === 'late_pressure'
      ? 'rgba(249, 115, 22, 0.14)'
      : 'rgba(34, 211, 238, 0.14)';
  const activeFieldStyle = currentCue?.profileFlavor === 'visual_channel'
    ? {
        background: currentCue.contrastProfile === 'glare_wash'
          ? 'linear-gradient(180deg, rgba(18, 24, 14, 0.96), rgba(10, 14, 8, 0.98))'
          : 'linear-gradient(180deg, rgba(12, 24, 10, 0.96), rgba(7, 14, 6, 0.98))',
      }
    : currentCue?.profileFlavor === 'late_pressure'
      ? {
          background: currentCue.phaseTag === 'finish'
            ? 'linear-gradient(180deg, rgba(35, 12, 5, 0.96), rgba(20, 8, 4, 0.98))'
            : 'linear-gradient(180deg, rgba(15, 16, 20, 0.96), rgba(8, 9, 13, 0.98))',
        }
      : undefined;
  const clutterParticleCount = currentCue?.visualDensityTier === 'high'
    ? 22
    : currentCue?.visualDensityTier === 'medium'
      ? 12
      : 4;
  const clutterParticles = currentCue
    ? Array.from({ length: clutterParticleCount }, (_, index) => ({
        id: `${currentCue.blockIndex}-${currentCue.profileId}-clutter-${index}`,
        size: 8 + ((index * 7) % 18),
        left: 6 + ((index * 17) % 84),
        top: 8 + ((index * 29) % 76),
        opacity: currentCue.visualDensityTier === 'high' ? 0.28 : currentCue.visualDensityTier === 'medium' ? 0.18 : 0.1,
      }))
    : [];
  const peripheralBaitCount = currentCue?.peripheralLoadTier === 'high'
    ? 8
    : currentCue?.peripheralLoadTier === 'medium'
      ? 4
      : 0;
  const peripheralBaits = currentCue
    ? Array.from({ length: peripheralBaitCount }, (_, index) => ({
        id: `${currentCue.blockIndex}-${currentCue.profileId}-edge-${index}`,
        size: 14 + ((index % 3) * 4),
        left: index % 2 === 0 ? 4 + ((index * 11) % 18) : 78 + ((index * 7) % 16),
        top: 8 + ((index * 13) % 74),
        duration: 1.1 + (index % 3) * 0.3,
      }))
    : [];
  const cueButtonStyle = currentCue?.contrastProfile === 'glare_wash'
    ? { opacity: cueActive ? 0.86 : 0.74, filter: 'brightness(1.05) saturate(0.72)' }
    : currentCue?.contrastProfile === 'reduced_contrast'
      ? { opacity: cueActive ? 0.9 : 0.78, filter: 'brightness(0.92) saturate(0.8)' }
      : undefined;
  const blockPhaseTitle = currentCue?.profileFlavor === 'visual_channel'
    ? (currentCue.phaseTag === 'finish' ? 'Visual Endurance Under Interference' : 'Visual Focus Under Load')
    : currentCue?.phaseTag === 'finish'
      ? 'Finish-Phase Control'
      : 'Clean Execution Under Load';

  return (
    <div
      className={`w-full h-full flex items-center justify-center text-white relative overflow-hidden ${
        previewMode ? 'bg-transparent' : 'bg-[#05070d]'
      }`}
    >
      {!previewMode && (
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at center, ${accentSoft}, transparent 58%)` }}
        />
      )}
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
            <div
              className="rounded-[28px] backdrop-blur-xl p-8 md:p-10"
              style={{ border: `1px solid ${accentColor}33`, background: accentSoft }}
            >
              <p className="text-xs uppercase tracking-[0.35em]" style={{ color: accentColor }}>Endurance Lock</p>
              <h2 className="text-4xl font-semibold mt-3">{buildArtifact.variantName}</h2>
              <p className="mt-4 text-lg text-white/70 max-w-2xl">
                {runtimeProfile.introLabel}
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
                  <p className="mt-2 text-2xl font-semibold">{runtimeProfile.flavor === 'visual_channel' ? 'Ignore The Noise' : 'Finish Clean'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-8">
                <button
                  onClick={startSession}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-black font-semibold transition-colors"
                  style={{ background: accentColor }}
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
                  <p className="text-xs uppercase tracking-[0.3em] text-white/45">Block {currentCue.blockIndex + 1} · {currentCue.blockLabel}</p>
                  <h3 className="text-3xl font-semibold mt-2">{blockPhaseTitle}</h3>
                  <p className="text-white/60 mt-2">{currentCue.prompt}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="px-3 py-1 rounded-full border text-[10px] font-bold tracking-[0.22em] uppercase" style={{ borderColor: `${accentColor}55`, color: accentColor }}>
                      {currentCue.profileId.replace(/_/g, ' ')}
                    </span>
                    {currentCue.profileFlavor === 'visual_channel' && (
                      <>
                        <span className="px-3 py-1 rounded-full border border-white/10 text-[10px] tracking-[0.18em] uppercase text-white/65">
                          Density {currentCue.visualDensityTier}
                        </span>
                        <span className="px-3 py-1 rounded-full border border-white/10 text-[10px] tracking-[0.18em] uppercase text-white/65">
                          Peripheral {currentCue.peripheralLoadTier}
                        </span>
                        <span className="px-3 py-1 rounded-full border border-white/10 text-[10px] tracking-[0.18em] uppercase text-white/65">
                          {currentCue.contrastProfile.replace(/_/g, ' ')}
                        </span>
                      </>
                    )}
                    {currentCue.profileFlavor === 'late_pressure' && currentCue.scoreWeight > 1 && (
                      <span className="px-3 py-1 rounded-full border border-white/10 text-[10px] tracking-[0.18em] uppercase text-white/65">
                        Finish blocks weighted x{currentCue.scoreWeight}
                      </span>
                    )}
                  </div>
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

              <div
                className="relative overflow-hidden rounded-[28px] min-h-[320px] flex flex-col items-center justify-center gap-6"
                style={{
                  border: `1px solid ${accentColor}26`,
                  ...activeFieldStyle,
                }}
              >
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {currentCue.profileFlavor === 'visual_channel' && clutterParticles.map((particle) => (
                    <div
                      key={particle.id}
                      className="absolute rounded-full bg-white/80"
                      style={{
                        width: particle.size,
                        height: particle.size,
                        left: `${particle.left}%`,
                        top: `${particle.top}%`,
                        opacity: particle.opacity,
                        filter: 'blur(1px)',
                      }}
                    />
                  ))}
                  {currentCue.profileFlavor === 'visual_channel' && peripheralBaits.map((bait) => (
                    <motion.div
                      key={bait.id}
                      className="absolute rounded-full border border-lime-300/60 bg-lime-300/15"
                      animate={{ scale: [1, 1.22, 1], opacity: [0.32, 0.72, 0.32] }}
                      transition={{ duration: bait.duration, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        width: bait.size,
                        height: bait.size,
                        left: `${bait.left}%`,
                        top: `${bait.top}%`,
                      }}
                    />
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.35em]" style={{ color: accentColor }}>Maintain Form</p>
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
                  style={cueButtonStyle}
                >
                  <div className="absolute inset-0 rounded-full blur-2xl" style={{ background: accentSoft }} />
                  <div
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: cueActive ? `${accentColor}` : 'rgba(255,255,255,0.15)' }}
                  />
                  <div
                    className="w-28 h-28 rounded-full flex items-center justify-center"
                    style={{
                      background: cueActive ? accentColor : 'rgba(255,255,255,0.08)',
                      color: cueActive ? '#05070d' : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    <Gauge className="w-9 h-9" />
                  </div>
                </motion.button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: blockCount }, (_, index) => {
                    const state = index < currentCue.blockIndex ? 'done' : index === currentCue.blockIndex ? 'current' : 'upcoming';
                    return (
                      <div
                        key={index}
                        className="w-14 h-2 rounded-full"
                        style={{ background: state === 'done' ? accentColor : state === 'current' ? `${accentColor}bb` : 'rgba(255,255,255,0.1)' }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, progress)}%`, background: accentColor }} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {blockAccuracy.map((accuracy, index) => (
                    <div key={index} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">{runtimeProfile.blockPlans[index]?.blockLabel ?? `Block ${index + 1}`}</p>
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
            <div
              className="rounded-[28px] backdrop-blur-xl p-8 md:p-10 space-y-6"
              style={{ border: `1px solid ${accentColor}33`, background: accentSoft }}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.35em]" style={{ color: accentColor }}>Session Summary</p>
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
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-black font-semibold transition-colors"
                  style={{ background: accentColor }}
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
