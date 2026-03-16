import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Pause, Play, Timer, Target, BarChart3 } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { simSessionService } from '../../api/firebase/mentaltraining/simSessionService';
import {
  DurationMode,
  type ProfileSnapshotMilestone,
  PressureType,
  SessionType,
  TaxonomySkill,
} from '../../api/firebase/mentaltraining/taxonomy';
import type { SimModule, SimBuildArtifact } from '../../api/firebase/mentaltraining/types';
import { ResetGame } from './ResetGame';
import { NoiseGateGame } from './NoiseGateGame';
import { BrakePointGame } from './BrakePointGame';
import { SignalWindowGame } from './SignalWindowGame';
import { SequenceShiftGame } from './SequenceShiftGame';
import { EnduranceLockGame } from './EnduranceLockGame';

interface SimRuntimePlayerProps {
  exercise: SimModule;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onClose: () => void;
  onComplete: () => void;
  profileSnapshotMilestone?: Extract<ProfileSnapshotMilestone, 'midpoint' | 'endpoint' | 'retention'>;
  previewMode?: boolean;
}

interface RuntimeRound {
  id: string;
  prompt: string;
  subPrompt: string;
  options: string[];
  correctOption: string;
  tags: string[];
}

interface RuntimeResponse {
  roundId: string;
  response: string;
  latencyMs: number;
  correct: boolean;
  tags: string[];
}

interface RuntimeAdapter {
  initialize: (artifact: SimBuildArtifact) => RuntimeRound[];
  score: (artifact: SimBuildArtifact, responses: RuntimeResponse[]) => {
    coreMetricValue: number;
    normalizedScore: number;
    supportingMetrics: Record<string, number>;
  };
  summarize: (artifact: SimBuildArtifact, responses: RuntimeResponse[]) => string[];
  telemetrySchema: (artifact: SimBuildArtifact) => { targetSkills: TaxonomySkill[]; pressureTypes: PressureType[] };
}

const ENGINE_THEME: Record<SimBuildArtifact['engineKey'], {
  accent: string;
  glow: string;
  panel: string;
  badge: string;
}> = {
  reset: { accent: '#ef4444', glow: 'from-red-500/20 to-orange-500/10', panel: 'border-red-500/20 bg-red-500/8', badge: 'RESET LOOP' },
  noise_gate: { accent: '#f59e0b', glow: 'from-amber-500/20 to-orange-500/10', panel: 'border-amber-500/20 bg-amber-500/8', badge: 'FILTER UNDER NOISE' },
  brake_point: { accent: '#22c55e', glow: 'from-emerald-500/20 to-green-500/10', panel: 'border-emerald-500/20 bg-emerald-500/8', badge: 'INHIBIT THE WRONG ACTION' },
  signal_window: { accent: '#3b82f6', glow: 'from-blue-500/20 to-cyan-500/10', panel: 'border-blue-500/20 bg-blue-500/8', badge: 'COMMIT INSIDE THE WINDOW' },
  sequence_shift: { accent: '#8b5cf6', glow: 'from-violet-500/20 to-fuchsia-500/10', panel: 'border-violet-500/20 bg-violet-500/8', badge: 'RULE UPDATE' },
  endurance_lock: { accent: '#06b6d4', glow: 'from-cyan-500/20 to-sky-500/10', panel: 'border-cyan-500/20 bg-cyan-500/8', badge: 'HOLD FORM LATE' },
};

function parseRoundCount(targetSessionStructure?: string, durationMinutes?: number) {
  const match = targetSessionStructure?.match(/(\d+)/);
  if (match) return Math.max(6, Number(match[1]));
  return Math.max(8, (durationMinutes ?? 5) * 8);
}

function createBinaryRounds(
  count: number,
  promptFactory: (index: number) => Pick<RuntimeRound, 'prompt' | 'subPrompt' | 'tags'>,
  goLabel: string,
  holdLabel: string,
  bias: 'go' | 'hold' = 'go'
): RuntimeRound[] {
  return Array.from({ length: count }, (_, index) => {
    const prompt = promptFactory(index);
    const correctOption = index % (bias === 'go' ? 3 : 2) === 0 ? holdLabel : goLabel;
    return {
      id: `round-${index + 1}`,
      prompt: prompt.prompt,
      subPrompt: prompt.subPrompt,
      options: [goLabel, holdLabel],
      correctOption,
      tags: prompt.tags,
    };
  });
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function buildDefaultAdapter(engineKey: SimBuildArtifact['engineKey']): RuntimeAdapter {
  const telemetryLookup: Record<SimBuildArtifact['engineKey'], { targetSkills: TaxonomySkill[]; pressureTypes: PressureType[] }> = {
    reset: {
      targetSkills: [TaxonomySkill.ErrorRecoverySpeed, TaxonomySkill.AttentionalShifting, TaxonomySkill.PressureStability],
      pressureTypes: [PressureType.Visual, PressureType.Evaluative, PressureType.CompoundingError],
    },
    noise_gate: {
      targetSkills: [TaxonomySkill.SelectiveAttention, TaxonomySkill.CueDiscrimination],
      pressureTypes: [PressureType.Audio, PressureType.Visual],
    },
    brake_point: {
      targetSkills: [TaxonomySkill.ResponseInhibition, TaxonomySkill.PressureStability],
      pressureTypes: [PressureType.Time, PressureType.Uncertainty],
    },
    signal_window: {
      targetSkills: [TaxonomySkill.CueDiscrimination, TaxonomySkill.PressureStability],
      pressureTypes: [PressureType.Time, PressureType.Uncertainty],
    },
    sequence_shift: {
      targetSkills: [TaxonomySkill.WorkingMemoryUpdating, TaxonomySkill.PressureStability],
      pressureTypes: [PressureType.Uncertainty, PressureType.Time],
    },
    endurance_lock: {
      targetSkills: [TaxonomySkill.SustainedAttention, TaxonomySkill.PressureStability],
      pressureTypes: [PressureType.Fatigue, PressureType.Time],
    },
  };

  const adapters: Record<Exclude<SimBuildArtifact['engineKey'], 'reset'>, RuntimeAdapter> = {
    noise_gate: {
      initialize: (artifact) => createBinaryRounds(
        parseRoundCount(artifact.sessionModel.targetSessionStructure, artifact.sessionModel.durationMinutes),
        (index) => ({
          prompt: index % 3 === 0 ? 'Ignore the distractor and keep the live target.' : 'Hold the target cue under noise.',
          subPrompt: index % 4 === 0 ? 'Commentary and crowd rise together.' : 'Keep your read on the primary signal.',
          tags: [index % 2 === 0 ? 'audio' : 'visual', index % 3 === 0 ? 'overlap' : 'single_channel'],
        }),
        'Track Live Cue',
        'Chase Distractor',
      ),
      score: (artifact, responses) => {
        const total = Math.max(1, responses.length);
        const accuracy = responses.filter((response) => response.correct).length / total;
        const avgLatency = responses.reduce((sum, response) => sum + response.latencyMs, 0) / total;
        const falseAlarms = responses.filter((response) => response.response === 'Chase Distractor').length;
        const distractorCost = Number((1 - accuracy).toFixed(3));
        return {
          coreMetricValue: distractorCost,
          normalizedScore: clampScore(Math.round(accuracy * 100)),
          supportingMetrics: {
            rt_shift: Math.round(avgLatency),
            false_alarm_rate: Number((falseAlarms / total).toFixed(3)),
            channel_vulnerability: Number((responses.filter((response) => response.tags.includes('overlap') && !response.correct).length / total).toFixed(3)),
          },
        };
      },
      summarize: (_artifact, responses) => {
        const misses = responses.filter((response) => !response.correct).length;
        return [
          `${responses.length - misses}/${responses.length} clean cue holds under noise.`,
          `${responses.filter((response) => response.tags.includes('overlap')).length} layered-noise rounds were logged for channel breakdowns.`,
        ];
      },
      telemetrySchema: () => telemetryLookup.noise_gate,
    },
    brake_point: {
      initialize: (artifact) => createBinaryRounds(
        parseRoundCount(artifact.sessionModel.targetSessionStructure, artifact.sessionModel.durationMinutes),
        (index) => ({
          prompt: index % 3 === 0 ? 'Stop when the fakeout cue appears.' : 'Commit only if the lane stays green.',
          subPrompt: index % 4 === 0 ? 'Late reveal pressure is active.' : 'Brake cleanly on the wrong action.',
          tags: [index % 3 === 0 ? 'late_reveal' : index % 2 === 0 ? 'fakeout' : 'obvious'],
        }),
        'Go',
        'Brake',
      ),
      score: (_artifact, responses) => {
        const total = Math.max(1, responses.length);
        const avgLatency = responses.reduce((sum, response) => sum + response.latencyMs, 0) / total;
        const falseAlarms = responses.filter((response) => !response.correct && response.response === 'Go').length;
        const overInhibition = responses.filter((response) => !response.correct && response.response === 'Brake').length;
        return {
          coreMetricValue: Math.round(avgLatency),
          normalizedScore: clampScore(100 - Math.round(((falseAlarms + overInhibition) / total) * 100)),
          supportingMetrics: {
            false_alarm_rate: Number((falseAlarms / total).toFixed(3)),
            over_inhibition: Number((overInhibition / total).toFixed(3)),
            go_rt_balance: Math.round(avgLatency),
          },
        };
      },
      summarize: (_artifact, responses) => [
        `${responses.filter((response) => response.correct).length}/${responses.length} stop decisions stayed clean.`,
        `${responses.filter((response) => response.tags.includes('late_reveal')).length} late-reveal lures were logged.`,
      ],
      telemetrySchema: () => telemetryLookup.brake_point,
    },
    signal_window: {
      initialize: (artifact) => createBinaryRounds(
        parseRoundCount(artifact.sessionModel.targetSessionStructure, artifact.sessionModel.durationMinutes),
        (index) => ({
          prompt: index % 3 === 0 ? 'Commit before the late-clock window closes.' : 'Read the signal and commit cleanly.',
          subPrompt: index % 4 === 0 ? 'The cue window is shrinking.' : 'First commitment is final.',
          tags: [index % 3 === 0 ? 'late_window' : 'standard_window', index % 2 === 0 ? 'plausible_wrong' : 'neutral'],
        }),
        'Correct Read',
        'Wrong Read',
      ),
      score: (_artifact, responses) => {
        const total = Math.max(1, responses.length);
        const correct = responses.filter((response) => response.correct).length;
        const avgLatency = responses.reduce((sum, response) => sum + response.latencyMs, 0) / total;
        return {
          coreMetricValue: Number((correct / total).toFixed(3)),
          normalizedScore: clampScore(Math.round((correct / total) * 100)),
          supportingMetrics: {
            decision_latency: Math.round(avgLatency),
            decoy_susceptibility: Number((responses.filter((response) => response.tags.includes('plausible_wrong') && !response.correct).length / total).toFixed(3)),
            window_utilization: Number((responses.filter((response) => response.tags.includes('late_window')).length / total).toFixed(3)),
          },
        };
      },
      summarize: (_artifact, responses) => [
        `${responses.filter((response) => response.correct).length}/${responses.length} first commitments stayed correct.`,
        `${responses.filter((response) => response.tags.includes('late_window')).length} late-window decisions were tagged for review.`,
      ],
      telemetrySchema: () => telemetryLookup.signal_window,
    },
    sequence_shift: {
      initialize: (artifact) => createBinaryRounds(
        parseRoundCount(artifact.sessionModel.targetSessionStructure, artifact.sessionModel.durationMinutes),
        (index) => ({
          prompt: index % 3 === 0 ? 'The rule just changed. Update immediately.' : 'Stay with the active rule until the shift.',
          subPrompt: index % 4 === 0 ? 'Old-rule carryover is part of this block.' : 'First correct response after shift matters.',
          tags: [index % 3 === 0 ? 'post_shift' : 'steady_state', index % 2 === 0 ? 'old_rule' : 'novel_error'],
        }),
        'Updated Rule',
        'Old Rule',
      ),
      score: (_artifact, responses) => {
        const total = Math.max(1, responses.length);
        const correct = responses.filter((response) => response.correct).length;
        const avgLatency = responses.reduce((sum, response) => sum + response.latencyMs, 0) / total;
        const oldRuleIntrusions = responses.filter((response) => response.response === 'Old Rule').length;
        return {
          coreMetricValue: Number((correct / total).toFixed(3)),
          normalizedScore: clampScore(Math.round((correct / total) * 100)),
          supportingMetrics: {
            switch_cost: Math.round(avgLatency),
            old_rule_intrusion_rate: Number((oldRuleIntrusions / total).toFixed(3)),
            post_shift_accuracy: Number((responses.filter((response) => response.tags.includes('post_shift') && response.correct).length / Math.max(1, responses.filter((response) => response.tags.includes('post_shift')).length)).toFixed(3)),
          },
        };
      },
      summarize: (_artifact, responses) => [
        `${responses.filter((response) => response.correct).length}/${responses.length} rule updates landed correctly.`,
        `${responses.filter((response) => response.response === 'Old Rule').length} old-rule intrusions were captured.`,
      ],
      telemetrySchema: () => telemetryLookup.sequence_shift,
    },
    endurance_lock: {
      initialize: (artifact) => createBinaryRounds(
        parseRoundCount(artifact.sessionModel.targetSessionStructure, artifact.sessionModel.durationMinutes),
        (index) => ({
          prompt: index > Math.floor(parseRoundCount(artifact.sessionModel.targetSessionStructure, artifact.sessionModel.durationMinutes) * 0.66)
            ? 'Maintain clean execution in the finish phase.'
            : 'Hold steady execution through fatigue buildup.',
          subPrompt: index % 4 === 0 ? 'Late-session stakes are rising.' : 'Track the same task without drift.',
          tags: [index > Math.floor(parseRoundCount(artifact.sessionModel.targetSessionStructure, artifact.sessionModel.durationMinutes) * 0.66) ? 'final_phase' : index > Math.floor(parseRoundCount(artifact.sessionModel.targetSessionStructure, artifact.sessionModel.durationMinutes) * 0.33) ? 'mid_block' : 'baseline_block'],
        }),
        'Clean Execution',
        'Break Form',
      ),
      score: (_artifact, responses) => {
        const baseline = responses.filter((response) => response.tags.includes('baseline_block'));
        const finalPhase = responses.filter((response) => response.tags.includes('final_phase'));
        const baselineAccuracy = baseline.filter((response) => response.correct).length / Math.max(1, baseline.length);
        const finalAccuracy = finalPhase.filter((response) => response.correct).length / Math.max(1, finalPhase.length);
        const degradationSlope = Number((baselineAccuracy - finalAccuracy).toFixed(3));
        return {
          coreMetricValue: degradationSlope,
          normalizedScore: clampScore(Math.round(finalAccuracy * 100)),
          supportingMetrics: {
            baseline_performance: Number(baselineAccuracy.toFixed(3)),
            degradation_onset: responses.findIndex((response) => !response.correct) + 1,
            final_phase_challenge: Number(finalAccuracy.toFixed(3)),
          },
        };
      },
      summarize: (_artifact, responses) => [
        `${responses.filter((response) => response.tags.includes('final_phase') && response.correct).length}/${responses.filter((response) => response.tags.includes('final_phase')).length || 0} finish-phase responses stayed clean.`,
        `${responses.filter((response) => response.tags.includes('baseline_block')).length} baseline rounds anchor the degradation curve.`,
      ],
      telemetrySchema: () => telemetryLookup.endurance_lock,
    },
  };

  return adapters[engineKey as Exclude<SimBuildArtifact['engineKey'], 'reset'>];
}

function getDurationMode(durationMinutes: number) {
  if (durationMinutes <= 3) return DurationMode.QuickProbe;
  if (durationMinutes <= 8) return DurationMode.StandardRep;
  return DurationMode.ExtendedStressTest;
}

function getSessionType(buildArtifact: SimBuildArtifact) {
  if (buildArtifact.sessionModel.archetype === 'trial') return SessionType.Reassessment;
  if (buildArtifact.engineKey === 'endurance_lock') return SessionType.PressureExposure;
  return SessionType.TrainingRep;
}

export const SimRuntimePlayer: React.FC<SimRuntimePlayerProps> = ({
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
  const buildArtifact = exercise.buildArtifact;
  const [runtimePhase, setRuntimePhase] = useState<'intro' | 'active' | 'summary'>('intro');
  const [rounds, setRounds] = useState<RuntimeRound[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [responses, setResponses] = useState<RuntimeResponse[]>([]);
  const [roundStartMs, setRoundStartMs] = useState<number>(Date.now());
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    if (!buildArtifact || buildArtifact.engineKey === 'reset') {
      return undefined;
    }
    const adapter = buildDefaultAdapter(buildArtifact.engineKey);
    const initializedRounds = adapter.initialize(buildArtifact);
    setRounds(initializedRounds);
    setRoundIndex(0);
    setResponses([]);
    setRuntimePhase('intro');
    setRoundStartMs(Date.now());
    setRecorded(false);
    return undefined;
  }, [buildArtifact]);

  useEffect(() => {
    if (!buildArtifact || buildArtifact.engineKey === 'reset' || runtimePhase !== 'summary' || recorded || !currentUser?.id || previewMode) {
      return undefined;
    }
    const adapter = buildDefaultAdapter(buildArtifact.engineKey);
    const score = adapter.score(buildArtifact, responses);
    const telemetry = adapter.telemetrySchema(buildArtifact);
    simSessionService.recordSession({
      userId: currentUser.id,
      simId: buildArtifact.variantId,
      simName: buildArtifact.variantName,
      legacyExerciseId: exercise.id,
      sessionType: getSessionType(buildArtifact),
      durationMode: getDurationMode(buildArtifact.sessionModel.durationMinutes),
      durationSeconds: Math.round((responses.reduce((sum, response) => sum + response.latencyMs, 0) / 1000) + buildArtifact.sessionModel.durationSeconds),
      coreMetricName: String(buildArtifact.scoringModel.coreMetricName),
      coreMetricValue: score.coreMetricValue,
      supportingMetrics: score.supportingMetrics,
      normalizedScore: score.normalizedScore,
      targetSkills: telemetry.targetSkills,
      pressureTypes: telemetry.pressureTypes,
      profileSnapshotMilestone,
      createdAt: Date.now(),
    }).catch((error) => {
      console.error('Failed to record sim runtime session:', error);
    });
    setRecorded(true);
    return undefined;
  }, [buildArtifact, currentUser?.id, exercise.id, previewMode, recorded, responses, runtimePhase]);

  const adapter = useMemo(
    () => (buildArtifact && buildArtifact.engineKey !== 'reset' ? buildDefaultAdapter(buildArtifact.engineKey) : null),
    [buildArtifact]
  );
  const engineTheme = buildArtifact ? ENGINE_THEME[buildArtifact.engineKey] : ENGINE_THEME.noise_gate;

  const score = useMemo(
    () => (buildArtifact && adapter ? adapter.score(buildArtifact, responses) : null),
    [adapter, buildArtifact, responses]
  );

  if (!buildArtifact) {
    return null;
  }

  if (buildArtifact.engineKey === 'reset') {
    return (
        <ResetGame
          exercise={exercise}
          profileSnapshotMilestone={profileSnapshotMilestone}
          onClose={onClose}
          onComplete={() => onComplete()}
          previewMode={previewMode}
      />
    );
  }

  if (buildArtifact.engineKey === 'noise_gate') {
    return (
        <NoiseGateGame
          exercise={exercise}
          profileSnapshotMilestone={profileSnapshotMilestone}
          isPaused={isPaused}
        onPause={onPause}
        onResume={onResume}
        onClose={onClose}
        onComplete={onComplete}
        previewMode={previewMode}
      />
    );
  }

  if (buildArtifact.engineKey === 'brake_point') {
    return (
        <BrakePointGame
          exercise={exercise}
          profileSnapshotMilestone={profileSnapshotMilestone}
          isPaused={isPaused}
        onPause={onPause}
        onResume={onResume}
        onClose={onClose}
        onComplete={onComplete}
        previewMode={previewMode}
      />
    );
  }

  if (buildArtifact.engineKey === 'signal_window') {
    return (
        <SignalWindowGame
          exercise={exercise}
          profileSnapshotMilestone={profileSnapshotMilestone}
          isPaused={isPaused}
        onPause={onPause}
        onResume={onResume}
        onClose={onClose}
        onComplete={onComplete}
        previewMode={previewMode}
      />
    );
  }

  if (buildArtifact.engineKey === 'sequence_shift') {
    return (
        <SequenceShiftGame
          exercise={exercise}
          profileSnapshotMilestone={profileSnapshotMilestone}
          isPaused={isPaused}
        onPause={onPause}
        onResume={onResume}
        onClose={onClose}
        onComplete={onComplete}
        previewMode={previewMode}
      />
    );
  }

  if (buildArtifact.engineKey === 'endurance_lock') {
    return (
        <EnduranceLockGame
          exercise={exercise}
          profileSnapshotMilestone={profileSnapshotMilestone}
          isPaused={isPaused}
        onPause={onPause}
        onResume={onResume}
        onClose={onClose}
        onComplete={onComplete}
        previewMode={previewMode}
      />
    );
  }

  const currentRound = rounds[roundIndex];
  const summaryLines = adapter ? adapter.summarize(buildArtifact, responses) : [];

  const handleAdvance = (responseLabel: string) => {
    if (!currentRound || !adapter) return;
    const latencyMs = Math.max(150, Date.now() - roundStartMs);
    const nextResponses = [
      ...responses,
      {
        roundId: currentRound.id,
        response: responseLabel,
        latencyMs,
        correct: responseLabel === currentRound.correctOption,
        tags: currentRound.tags,
      },
    ];
    setResponses(nextResponses);
    if (roundIndex >= rounds.length - 1) {
      setRuntimePhase('summary');
      return;
    }
    setRoundIndex((current) => current + 1);
    setRoundStartMs(Date.now());
  };

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-black/35 backdrop-blur-xl p-6 md:p-8 text-white space-y-6 relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${engineTheme.glow} opacity-80 pointer-events-none`} />
        <div className="flex items-center justify-between gap-4">
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">Compiled Runtime</p>
            <h3 className="text-2xl font-semibold">{buildArtifact.variantName}</h3>
            <p className="text-sm text-white/55 mt-1">{buildArtifact.family} · {String(buildArtifact.engineKey).replace('_', ' ')}</p>
            <div
              className={`inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full border ${engineTheme.panel}`}
              style={{ color: engineTheme.accent }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: engineTheme.accent }} />
              <span className="text-[10px] font-bold tracking-[0.25em] uppercase">{engineTheme.badge}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={isPaused ? onResume : onPause}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-sm"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {runtimePhase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`rounded-2xl border p-4 ${engineTheme.panel}`}>
                  <div className="flex items-center gap-2 text-sm text-white/60"><Timer className="w-4 h-4" /> Session</div>
                  <p className="text-lg font-semibold mt-2">{buildArtifact.sessionModel.durationMinutes} min</p>
                  <p className="text-xs text-white/45 mt-1">{buildArtifact.sessionModel.targetSessionStructure}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${engineTheme.panel}`}>
                  <div className="flex items-center gap-2 text-sm text-white/60"><Target className="w-4 h-4" /> Core Metric</div>
                  <p className="text-lg font-semibold mt-2">{String(buildArtifact.scoringModel.coreMetricName).replace(/_/g, ' ')}</p>
                  <p className="text-xs text-white/45 mt-1">{buildArtifact.feedbackModel.feedbackMode} feedback</p>
                </div>
                <div className={`rounded-2xl border p-4 ${engineTheme.panel}`}>
                  <div className="flex items-center gap-2 text-sm text-white/60"><BarChart3 className="w-4 h-4" /> Build</div>
                  <p className="text-lg font-semibold mt-2">{buildArtifact.engineVersion}</p>
                  <p className="text-xs text-white/45 mt-1">{buildArtifact.sourceFingerprint}</p>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${engineTheme.panel}`}>
                <p className="text-sm leading-relaxed" style={{ color: `${engineTheme.accent}` }}>
                  {buildArtifact.feedbackModel.athleteLabels.description || 'This compiled module runs from the registry build artifact and records family-specific telemetry when completed.'}
                </p>
              </div>

              <button
                onClick={() => {
                  setRuntimePhase('active');
                  setRoundStartMs(Date.now());
                }}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#E0FE10] text-black font-semibold"
              >
                <Play className="w-4 h-4" />
                Start Built Module
              </button>
            </motion.div>
          )}

          {runtimePhase === 'active' && currentRound && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-between text-sm text-white/50">
                <span>Round {roundIndex + 1} / {rounds.length}</span>
                <span>{currentRound.tags.join(' · ')}</span>
              </div>
              <div className={`rounded-3xl border p-8 space-y-3 ${engineTheme.panel}`}>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Live Prompt</p>
                <h4 className="text-2xl font-semibold leading-tight">{currentRound.prompt}</h4>
                <p className="text-sm text-white/55">{currentRound.subPrompt}</p>
              </div>
              {isPaused ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                  Runtime paused. Resume to continue this round.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentRound.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleAdvance(option)}
                      className={`rounded-2xl border px-4 py-4 text-left transition-colors ${engineTheme.panel} hover:bg-white/[0.08]`}
                    >
                      <p className="font-semibold">{option}</p>
                      <p className="text-xs text-white/45 mt-1">Commit this response for the current round.</p>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {runtimePhase === 'summary' && score && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                  <div>
                    <p className="text-sm text-emerald-200">Built module complete</p>
                    <h4 className="text-2xl font-semibold text-white mt-1">{Math.round(score.normalizedScore)} overall score</h4>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/45">Core Metric</p>
                    <p className="text-lg font-semibold mt-2">{String(buildArtifact.scoringModel.coreMetricName).replace(/_/g, ' ')}</p>
                    <p className="text-sm text-white/65 mt-1">{score.coreMetricValue}</p>
                  </div>
                  {Object.entries(score.supportingMetrics).slice(0, 2).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.25em] text-white/45">{key.replace(/_/g, ' ')}</p>
                      <p className="text-lg font-semibold mt-2">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {summaryLines.map((line) => (
                  <div key={line} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
                    {line}
                  </div>
                ))}
              </div>

              <button
                onClick={onComplete}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#E0FE10] text-black font-semibold"
              >
                <CheckCircle2 className="w-4 h-4" />
                Finish Module
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SimRuntimePlayer;
