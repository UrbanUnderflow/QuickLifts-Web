import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Pause, Play, Shuffle, Volume2, VolumeX, X } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import { DurationMode, type ProfileSnapshotMilestone, PressureType, SessionType, TaxonomySkill } from '../../api/firebase/mentaltraining/taxonomy';
import type { SimBuildArtifact, SimModule } from '../../api/firebase/mentaltraining/types';
import { useInputIntegrity } from './useInputIntegrity';

interface SequenceShiftGameProps {
  exercise: SimModule;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
  onComplete: () => void;
  profileSnapshotMilestone?: Extract<ProfileSnapshotMilestone, 'midpoint' | 'endpoint' | 'retention'>;
  previewMode?: boolean;
}

type RoundStage = 'intro' | 'ready' | 'response' | 'feedback' | 'summary';
type ShiftType = 'signaled' | 'unsignaled' | 'late_audible';
type RuleType = 'color' | 'shape' | 'count';
type StimulusColor = 'Red' | 'Blue' | 'Green';
type StimulusShape = 'Circle' | 'Triangle' | 'Square';

interface RuleSet {
  type: RuleType;
  label: string;
  description: string;
}

interface SequenceRound {
  id: string;
  blockIndex: number;
  roundInBlock: number;
  shiftType: ShiftType;
  phaseTag: 'steady_state' | 'post_shift';
  currentRule: RuleSet;
  previousRule: RuleSet | null;
  pressureTag: 'neutral' | 'pressure';
  stimulus: {
    color: StimulusColor;
    shape: StimulusShape;
    count: number;
  };
  options: string[];
  correctOption: string;
  oldRuleOption: string | null;
  instruction: string;
}

interface SequenceResponse {
  roundId: string;
  blockIndex: number;
  phaseTag: 'steady_state' | 'post_shift';
  shiftType: ShiftType;
  response: string | 'timeout';
  correct: boolean;
  latencyMs: number;
  oldRuleIntrusion: boolean;
}

const RULE_LIBRARY: RuleSet[] = [
  { type: 'color', label: 'Match Color', description: 'Respond to the stimulus color, not the shape.' },
  { type: 'shape', label: 'Match Shape', description: 'Respond to the stimulus shape, not the color.' },
  { type: 'count', label: 'Match Count', description: 'Respond to the number of items shown.' },
];

const COLOR_OPTIONS: StimulusColor[] = ['Red', 'Blue', 'Green'];
const SHAPE_OPTIONS: StimulusShape[] = ['Circle', 'Triangle', 'Square'];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function parseRoundCount(targetSessionStructure?: string, durationMinutes?: number) {
  const match = targetSessionStructure?.match(/(\d+)/);
  if (match) return Math.max(18, Number(match[1]));
  return Math.max(20, (durationMinutes ?? 5) * 10);
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

function pickRule(index: number, previous?: RuleSet | null) {
  const pool = RULE_LIBRARY.filter((rule) => rule.type !== previous?.type);
  return pool[index % pool.length];
}

function buildStimulus(index: number) {
  return {
    color: COLOR_OPTIONS[index % COLOR_OPTIONS.length],
    shape: SHAPE_OPTIONS[(index + 1) % SHAPE_OPTIONS.length],
    count: (index % 3) + 1,
  };
}

function resolveRuleOption(rule: RuleSet, stimulus: SequenceRound['stimulus']) {
  switch (rule.type) {
    case 'color':
      return stimulus.color;
    case 'shape':
      return stimulus.shape;
    case 'count':
      return `${stimulus.count}`;
    default:
      return stimulus.color;
  }
}

function buildOptions(correct: string, oldRuleOption: string | null, currentRule: RuleSet) {
  const pool = currentRule.type === 'shape'
    ? SHAPE_OPTIONS.map(String)
    : currentRule.type === 'count'
      ? ['1', '2', '3']
      : COLOR_OPTIONS.map(String);
  const next = new Set<string>([correct]);
  if (oldRuleOption) next.add(oldRuleOption);
  pool.forEach((item) => {
    if (next.size < 3) next.add(item);
  });
  while (next.size < 3) {
    next.add(`Option ${next.size + 1}`);
  }
  return Array.from(next).slice(0, 3);
}

function buildSequenceRounds(buildArtifact: SimBuildArtifact): SequenceRound[] {
  const totalRounds = parseRoundCount(buildArtifact.sessionModel.targetSessionStructure, buildArtifact.sessionModel.durationMinutes);
  const blocks = Math.max(4, Math.min(6, Math.round(totalRounds / 5)));
  const roundsPerBlock = Math.max(4, Math.round(totalRounds / blocks));
  const archetype = String(buildArtifact.sessionModel.archetype ?? 'baseline');
  const rounds: SequenceRound[] = [];
  let currentRule = RULE_LIBRARY[0];
  let previousRule: RuleSet | null = null;

  for (let blockIndex = 0; blockIndex < blocks; blockIndex += 1) {
    const shiftType: ShiftType = archetype === 'sport_context'
      ? blockIndex % 2 === 0 ? 'late_audible' : 'signaled'
      : archetype === 'trial'
        ? blockIndex % 2 === 0 ? 'unsignaled' : 'signaled'
        : blockIndex % 3 === 0 ? 'signaled' : blockIndex % 2 === 0 ? 'unsignaled' : 'late_audible';

    previousRule = currentRule;
    currentRule = pickRule(blockIndex + 1, previousRule);

    for (let roundInBlock = 0; roundInBlock < roundsPerBlock; roundInBlock += 1) {
      const phaseTag = roundInBlock < 2 ? 'post_shift' : 'steady_state';
      const stimulus = buildStimulus((blockIndex * roundsPerBlock) + roundInBlock);
      const ruleForRound = phaseTag === 'post_shift' ? currentRule : currentRule;
      const oldRuleOption = previousRule ? resolveRuleOption(previousRule, stimulus) : null;
      const correctOption = resolveRuleOption(ruleForRound, stimulus);
      const options = buildOptions(correctOption, phaseTag === 'post_shift' ? oldRuleOption : null, ruleForRound);

      rounds.push({
        id: `sequence-round-${blockIndex + 1}-${roundInBlock + 1}`,
        blockIndex,
        roundInBlock,
        shiftType,
        phaseTag,
        currentRule: ruleForRound,
        previousRule: phaseTag === 'post_shift' ? previousRule : currentRule,
        pressureTag: blockIndex >= Math.floor(blocks * 0.6) ? 'pressure' : 'neutral',
        stimulus,
        options,
        correctOption,
        oldRuleOption: phaseTag === 'post_shift' ? oldRuleOption : null,
        instruction: phaseTag === 'post_shift'
          ? `Rule just changed. Update to ${ruleForRound.label.toLowerCase()} immediately.`
          : `Hold ${ruleForRound.label.toLowerCase()} until the next shift.`,
      });
    }
  }

  return rounds.slice(0, totalRounds);
}

export const SequenceShiftGame: React.FC<SequenceShiftGameProps> = ({
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
  const rounds = useMemo(() => buildSequenceRounds(buildArtifact), [buildArtifact]);
  const durationMinutes = buildArtifact.sessionModel.durationMinutes as number;
  const targetRoundStructure = buildArtifact.sessionModel.targetSessionStructure as string;

  const [stage, setStage] = useState<RoundStage>('intro');
  const [roundIndex, setRoundIndex] = useState(0);
  const [responses, setResponses] = useState<SequenceResponse[]>([]);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ title: string; detail: string; success: boolean } | null>(null);
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

  const playShiftCue = useCallback((shiftType: ShiftType) => {
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
    oscillator.type = shiftType === 'late_audible' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(shiftType === 'unsignaled' ? 430 : shiftType === 'late_audible' ? 760 : 620, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }, [soundEnabled]);

  const finishSession = useCallback(async (finalResponses: SequenceResponse[]) => {
    const total = Math.max(1, finalResponses.length);
    const correct = finalResponses.filter((response) => response.correct).length;
    const postShift = finalResponses.filter((response) => response.phaseTag === 'post_shift');
    const postShiftCorrect = postShift.filter((response) => response.correct).length;
    const preShift = finalResponses.filter((response) => response.phaseTag === 'steady_state');
    const preShiftAverage = preShift.length
      ? preShift.reduce((sum, response) => sum + response.latencyMs, 0) / preShift.length
      : 0;
    const firstPostShift = postShift[0];
    const switchCost = firstPostShift ? Math.max(0, firstPostShift.latencyMs - preShiftAverage) : 0;
    const oldRuleIntrusions = postShift.filter((response) => response.oldRuleIntrusion).length;
    const normalizedScore = clampScore(Math.round((correct / total) * 100) - Math.round((oldRuleIntrusions / Math.max(1, postShift.length)) * 18));
    const coreMetricValue = Number((postShiftCorrect / Math.max(1, postShift.length)).toFixed(3));

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
        coreMetricName: 'update_accuracy_after_rule_change',
        coreMetricValue,
        supportingMetrics: {
          switch_cost: Math.round(switchCost),
          old_rule_intrusion_rate: Number((oldRuleIntrusions / Math.max(1, postShift.length)).toFixed(3)),
          post_shift_accuracy: coreMetricValue,
          rapid_input_flags: spamFlags,
          rapid_input_rounds: spamRounds,
          flagged_for_spam: spamDetected ? 1 : 0,
        },
        normalizedScore: spamDetected ? Math.max(0, normalizedScore - 25) : normalizedScore,
        targetSkills: [TaxonomySkill.WorkingMemoryUpdating, TaxonomySkill.PressureStability],
        pressureTypes: [PressureType.Uncertainty, PressureType.Time],
        profileSnapshotMilestone,
        createdAt: Date.now(),
      }).catch((error) => {
        console.error('Failed to record Sequence Shift session:', error);
      });
    }

    setFeedback({
      title: `${postShiftCorrect}/${postShift.length || 0} clean updates`,
      detail: `Switch Cost ${Math.round(switchCost)}ms · Old-Rule Intrusion ${Math.round((oldRuleIntrusions / Math.max(1, postShift.length)) * 100)}% · Post-Shift Accuracy ${Math.round(coreMetricValue * 100)}%${spamDetected ? ' · Session flagged for rapid input' : ''}`,
      success: normalizedScore >= 70 && !spamDetected,
    });
    setStage('summary');
  }, [buildArtifact, currentUser?.id, durationMinutes, exercise.id, previewMode, spamDetected, spamFlags, spamRounds]);

  const resolveRound = useCallback((response: string | null) => {
    if (!currentRound || roundResolvedRef.current) return;
    roundResolvedRef.current = true;
    const latencyMs = Math.max(150, Date.now() - stageStartRef.current);
    const nextResponse: SequenceResponse = {
      roundId: currentRound.id,
      blockIndex: currentRound.blockIndex,
      phaseTag: currentRound.phaseTag,
      shiftType: currentRound.shiftType,
      response: response ?? 'timeout',
      correct: response === currentRound.correctOption,
      latencyMs,
      oldRuleIntrusion: Boolean(currentRound.oldRuleOption && response === currentRound.oldRuleOption && response !== currentRound.correctOption),
    };
    finalizeRound();
    const nextResponses = [...responses, nextResponse];
    setResponses(nextResponses);
    setFeedback({
      title: nextResponse.correct ? 'Update Landed' : response === null ? 'Window Missed' : nextResponse.oldRuleIntrusion ? 'Old Rule Intrusion' : 'Novel Error',
      detail: nextResponse.correct
        ? 'You abandoned the old rule and committed to the new one cleanly.'
        : response === null
          ? 'The response window closed before a committed update.'
          : nextResponse.oldRuleIntrusion
            ? 'You stayed with the old rule after the shift.'
            : 'Your response missed the active rule but was not an old-rule intrusion.',
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
      beginStage('ready', 1200);
    }, 900);
  }, [beginStage, currentRound, finalizeRound, finishSession, responses, roundIndex, rounds.length]);

  const handleOptionSelect = useCallback((option: string) => {
    if (stage !== 'response') return;
    if (!registerInputAttempt({ blockedMessage: 'Too fast. Update the rule once, not by spamming inputs.' })) {
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
        if (currentRound) playShiftCue(currentRound.shiftType);
        beginStage('response', currentRound?.phaseTag === 'post_shift' ? 1700 : 2100);
        return;
      }
      if (stage === 'response') {
        resolveRound(null);
      }
    }, 80);
    return () => window.clearInterval(tick);
  }, [beginStage, currentRound, isPaused, playShiftCue, remainingMs, resolveRound, stage]);

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
    beginStage('ready', 1200);
  }, [beginStage, resetSession]);

  const progressPercent = ((roundIndex + (stage === 'summary' ? 1 : 0)) / rounds.length) * 100;
  const correctPct = responses.length ? Math.round((responses.filter((response) => response.correct).length / responses.length) * 100) : 100;
  const archetypeLabel = String(buildArtifact.sessionModel.archetype ?? 'baseline').replace(/_/g, ' ');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-[#090510] overflow-hidden text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(167,139,250,0.22),transparent_28%),radial-gradient(circle_at_center,rgba(139,92,246,0.12),transparent_40%)]" />
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5">
        <button onClick={onClose} className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-white/70" />
        </button>
        <div className="flex items-center gap-1.5">
          {rounds.map((round, index) => (
            <div key={round.id} className={`w-2.5 h-2.5 rounded-full transition-colors ${index < roundIndex ? 'bg-violet-300' : index === roundIndex ? 'bg-fuchsia-300' : 'bg-white/15'}`} />
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
                <p className="text-xs uppercase tracking-[0.35em] text-white/40">Sequence Shift</p>
                <h1 className="text-4xl font-black">{buildArtifact.variantName}</h1>
                <p className="text-white/60 max-w-2xl">{buildArtifact.feedbackModel.athleteLabels.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Structure</p>
                  <p className="text-lg font-semibold mt-2">{targetRoundStructure}</p>
                  <p className="text-xs text-white/45 mt-1">{durationMinutes} minute module</p>
                </div>
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Core Metric</p>
                  <p className="text-lg font-semibold mt-2">Update Accuracy After Rule Change</p>
                  <p className="text-xs text-white/45 mt-1">First post-shift accuracy with switch cost tracking</p>
                </div>
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Pressure</p>
                  <p className="text-lg font-semibold mt-2 capitalize">{archetypeLabel}</p>
                  <p className="text-xs text-white/45 mt-1">Old-rule carryover punishes delayed updating</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-white/35">How it works</p>
                <p className="text-white/75">An active rule stays stable long enough to become sticky. Then the rule changes. Your job is to abandon the old pattern, detect the shift, and commit to the new rule before the update window closes.</p>
              </div>
              <button onClick={startSession} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#E0FE10] text-black font-semibold">
                <Play className="w-4 h-4" />
                Start Sequence Shift
              </button>
            </motion.div>
          )}

          {(stage === 'ready' || stage === 'response' || stage === 'feedback') && currentRound && (
            <motion.div key={`round-${currentRound.id}-${stage}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} className="w-full max-w-5xl rounded-[32px] border border-white/10 bg-black/35 backdrop-blur-xl p-8 space-y-6">
              <div className="flex items-center justify-between gap-4 text-sm text-white/55">
                <div>
                  Block {currentRound.blockIndex + 1} · Round {roundIndex + 1} / {rounds.length}
                  <span className="ml-3 uppercase tracking-[0.25em] text-[11px] text-violet-300">{currentRound.phaseTag.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Clean rate {correctPct}%</span>
                  {remainingMs !== null && <span>{(remainingMs / 1000).toFixed(1)}s</span>}
                </div>
              </div>

              <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div className="h-full bg-violet-400" animate={{ width: `${progressPercent}%` }} transition={{ duration: 0.3 }} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[0.45fr_0.55fr] gap-6">
                <div className="rounded-[28px] border border-violet-500/20 bg-violet-500/10 p-6 space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Active Rule</p>
                    <div className="mt-3 rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-400/20 to-fuchsia-500/10 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-3xl font-black tracking-[0.06em]">{currentRound.currentRule.label}</p>
                          <p className="text-sm text-white/60 mt-2">{currentRound.currentRule.description}</p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-black/20 px-4 py-3 text-center min-w-[110px]">
                          <Shuffle className="w-4 h-4 text-violet-300 mx-auto mb-1" />
                          <p className="text-xs uppercase tracking-[0.2em] text-white/50">{currentRound.shiftType.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/40">Stimulus</p>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Color</p>
                        <p className="text-lg font-semibold mt-2">{currentRound.stimulus.color}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Shape</p>
                        <p className="text-lg font-semibold mt-2">{currentRound.stimulus.shape}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Count</p>
                        <p className="text-lg font-semibold mt-2">{currentRound.stimulus.count}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-white/65">
                    <p>{stage === 'ready' ? 'Load the active rule. The shift/update window opens automatically.' : currentRound.instruction}</p>
                    {currentRound.phaseTag === 'post_shift' && currentRound.previousRule && (
                      <p>Previous rule: <span className="text-white font-medium">{currentRound.previousRule.label}</span>. Do not carry it over.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 space-y-5 relative overflow-hidden">
                  {currentRound.pressureTag === 'pressure' && stage === 'response' && (
                    <div className="absolute top-4 right-4 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-300">
                      pressure active
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">Update Field</p>
                    <h3 className="text-2xl font-semibold mt-2">
                      {stage === 'ready' ? 'Hold the active rule.' : stage === 'response' ? 'Commit to the updated rule before hesitation wins.' : feedback?.title}
                    </h3>
                    <p className="text-sm text-white/55 mt-2">
                      {stage === 'feedback'
                        ? feedback?.detail
                        : currentRound.phaseTag === 'post_shift'
                          ? 'The first post-shift choice determines whether you updated cleanly or carried the old rule forward.'
                          : 'Stay fluent with the active rule until the shift arrives.'}
                    </p>
                  </div>

                  {stage === 'ready' ? (
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-8 text-center text-white/55">
                      Rule card loading.
                    </div>
                  ) : stage === 'response' ? (
                    <div className="grid grid-cols-1 gap-4">
                      {currentRound.options.map((option) => {
                        const isOldRuleOption = option === currentRound.oldRuleOption && option !== currentRound.correctOption;
                        return (
                          <motion.button
                            key={option}
                            onClick={() => handleOptionSelect(option)}
                            whileHover={{ scale: isPaused ? 1 : 1.01 }}
                            whileTap={{ scale: isPaused ? 1 : 0.99 }}
                            disabled={isPaused}
                            className={`rounded-3xl border px-5 py-5 text-left transition-colors ${isOldRuleOption ? 'border-amber-400/20 bg-amber-400/5' : 'border-violet-400/20 bg-violet-400/8'} ${isPaused ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/[0.06]'}`}
                          >
                            <div className="flex items-start gap-3">
                              <Brain className="w-5 h-5 mt-0.5 text-violet-300" />
                              <div>
                                <p className="text-xl font-semibold">{option}</p>
                                <p className="text-xs text-white/45 mt-2">
                                  {isOldRuleOption
                                    ? 'This matches the old rule. Choosing it counts as an intrusion.'
                                    : option === currentRound.correctOption
                                      ? 'This matches the active rule.'
                                      : 'This is a novel error if selected.'}
                                </p>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`rounded-3xl border px-6 py-8 ${feedback?.success ? 'border-violet-500/25 bg-violet-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
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
                <p className="text-xs uppercase tracking-[0.35em] text-violet-300">Session Summary</p>
                <h2 className="text-3xl font-black">{feedback.title}</h2>
                <p className="text-white/60">{feedback.detail}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Post-Shift Accuracy</p>
                  <p className="text-2xl font-semibold mt-2">{responses.filter((response) => response.phaseTag === 'post_shift').length ? Math.round((responses.filter((response) => response.phaseTag === 'post_shift' && response.correct).length / responses.filter((response) => response.phaseTag === 'post_shift').length) * 100) : 0}%</p>
                </div>
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Switch Cost</p>
                  <p className="text-2xl font-semibold mt-2">
                    {responses.filter((response) => response.phaseTag === 'steady_state').length && responses.find((response) => response.phaseTag === 'post_shift')
                      ? Math.max(
                        0,
                        Math.round(
                          (responses.find((response) => response.phaseTag === 'post_shift')?.latencyMs ?? 0)
                          - (responses.filter((response) => response.phaseTag === 'steady_state').reduce((sum, response) => sum + response.latencyMs, 0) / responses.filter((response) => response.phaseTag === 'steady_state').length)
                        )
                      )
                      : 0}ms
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Old-Rule Intrusion</p>
                  <p className="text-2xl font-semibold mt-2">{responses.length ? Math.round((responses.filter((response) => response.oldRuleIntrusion).length / responses.length) * 100) : 0}%</p>
                </div>
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 md:col-span-3">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Input Integrity</p>
                  <p className="text-2xl font-semibold mt-2">{spamDetected ? `${spamFlags} rapid-input flags across ${spamRounds} round(s)` : 'No rapid-input flags detected'}</p>
                </div>
              </div>
              <button onClick={onComplete} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#E0FE10] text-black font-semibold">
                <Shuffle className="w-4 h-4" />
                Finish Sequence Shift
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SequenceShiftGame;
