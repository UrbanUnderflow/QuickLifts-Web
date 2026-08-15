import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Volume2, VolumeX, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import {
  getSimSpecByCoreMetric,
  getSimSpecByLegacyExerciseId,
  type ProfileSnapshotMilestone,
  type SimSpec,
} from '../../api/firebase/mentaltraining/taxonomy';
import type { SimModule, SimBuildArtifact } from '../../api/firebase/mentaltraining/types';
import { scenarioArchetypeForSport } from '../../api/firebase/mentaltraining/sportScenarioArchetypes';
import type { RootState } from '../../redux/store';
import { ResetGame } from './ResetGame';
import { NoiseGateGame } from './NoiseGateGame';
import { BrakePointGame } from './BrakePointGame';
import { SignalWindowGame } from './SignalWindowGame';
import { SequenceShiftGame } from './SequenceShiftGame';
import { EnduranceLockGame } from './EnduranceLockGame';
import { primeNarrationPlayback, speakStep, stopNarration } from '../../utils/tts';

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

const ENGINE_THEME: Record<SimBuildArtifact['engineKey'], {
  accent: string;
  glow: string;
  panel: string;
  badge: string;
}> = {
  reset: { accent: '#ef4444', glow: 'from-red-500/20 to-orange-500/10', panel: 'border-red-500/20 bg-red-500/8', badge: 'INTERRUPT AND RETURN' },
  noise_gate: { accent: '#f59e0b', glow: 'from-amber-500/20 to-orange-500/10', panel: 'border-amber-500/20 bg-amber-500/8', badge: 'VISUAL SEARCH WITH DISTRACTION' },
  brake_point: { accent: '#22c55e', glow: 'from-emerald-500/20 to-green-500/10', panel: 'border-emerald-500/20 bg-emerald-500/8', badge: 'DELAYED STOP SIGNAL' },
  signal_window: { accent: '#3b82f6', glow: 'from-blue-500/20 to-cyan-500/10', panel: 'border-blue-500/20 bg-blue-500/8', badge: 'READ THE MAJORITY' },
  sequence_shift: { accent: '#8b5cf6', glow: 'from-violet-500/20 to-fuchsia-500/10', panel: 'border-violet-500/20 bg-violet-500/8', badge: 'SWITCH THE RULE' },
  endurance_lock: { accent: '#06b6d4', glow: 'from-cyan-500/20 to-sky-500/10', panel: 'border-cyan-500/20 bg-cyan-500/8', badge: 'SAME TASK OVER TIME' },
};

function evidenceAlignedSportCue(cue: string | undefined): string | undefined {
  const normalized = cue?.trim();
  if (!normalized) return undefined;
  return normalized.toLowerCase().includes('this result describes')
    && normalized.toLowerCase().includes('require separate evidence')
    ? normalized
    : undefined;
}

export function buildSimPreflightBriefing(
  exercise: SimModule,
  buildArtifact: SimBuildArtifact,
  simSpec?: SimSpec,
  sportCue?: string,
) {
  const variantName = buildArtifact.variantName || exercise.name || 'this sim';
  const durationMinutes = buildArtifact.sessionModel?.durationMinutes ?? 5;
  const task = simSpec?.athleteTaskDescription
    ?? buildArtifact.feedbackModel.athleteLabels.description
    ?? exercise.description;
  const metric = simSpec?.athleteMetricLabel ?? 'Task performance';
  const boundary = evidenceAlignedSportCue(sportCue) ?? simSpec?.resultBoundary;
  return [
    'Nora here.',
    `This one is ${variantName}.`,
    task,
    `Your result will be labeled ${metric}.`,
    boundary,
    `You have ${durationMinutes} minutes. Start when you are ready.`,
  ].filter(Boolean).join(' ');
}

function getPreflightCueEnvelope(engineKey: SimBuildArtifact['engineKey']) {
  switch (engineKey) {
    case 'reset':
      return { base: 460, accent: 680, durationMs: 620 };
    case 'noise_gate':
      return { base: 320, accent: 540, durationMs: 700 };
    case 'brake_point':
      return { base: 280, accent: 420, durationMs: 620 };
    case 'signal_window':
      return { base: 520, accent: 780, durationMs: 620 };
    case 'sequence_shift':
      return { base: 360, accent: 620, durationMs: 660 };
    case 'endurance_lock':
      return { base: 260, accent: 500, durationMs: 760 };
    default:
      return { base: 360, accent: 540, durationMs: 650 };
  }
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
  const buildArtifact = exercise.buildArtifact;
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const [runtimePhase, setRuntimePhase] = useState<'intro' | 'active'>('intro');
  const [preflightState, setPreflightState] = useState<'intro' | 'briefing' | 'ready'>('intro');
  const [preflightSoundEnabled, setPreflightSoundEnabled] = useState(true);
  const [preflightMessage, setPreflightMessage] = useState<string>('Nora will explain the sim before you begin.');

  useEffect(() => {
    setRuntimePhase('intro');
    setPreflightState('intro');
    setPreflightMessage('Nora will explain the sim before you begin.');
  }, [buildArtifact]);

  useEffect(() => () => {
    stopNarration();
  }, []);

  const engineTheme = buildArtifact ? ENGINE_THEME[buildArtifact.engineKey] : ENGINE_THEME.noise_gate;
  const simSpec = useMemo(
    () => getSimSpecByCoreMetric(buildArtifact?.scoringModel?.coreMetricName)
      ?? getSimSpecByLegacyExerciseId(exercise.id),
    [buildArtifact?.scoringModel?.coreMetricName, exercise.id]
  );
  const athleteSport = typeof currentUser?.sport === 'string' ? currentUser.sport.trim() : '';
  const sportPack = useMemo(() => {
    const archetype = scenarioArchetypeForSport(athleteSport);
    if (archetype === 'general') return undefined;
    return exercise.sportContentPacks?.find((pack) => pack.archetype === archetype);
  }, [athleteSport, exercise.sportContentPacks]);
  const boundedSportCue = evidenceAlignedSportCue(sportPack?.applicationCue);
  const evidenceBoundary = boundedSportCue ?? simSpec?.resultBoundary;
  const taskDescription = simSpec?.athleteTaskDescription
    ?? buildArtifact?.feedbackModel.athleteLabels.description
    ?? exercise.description;
  const metricLabel = simSpec?.athleteMetricLabel ?? 'Task performance';
  const audioAssets = useMemo(
    () => ((buildArtifact?.stimulusModel?.audioAssets ?? exercise.runtimeConfig?.audioAssets ?? {}) as Record<string, { downloadURL?: string }>),
    [buildArtifact, exercise.runtimeConfig?.audioAssets]
  );
  const preflightBriefing = useMemo(
    () => (buildArtifact ? buildSimPreflightBriefing(exercise, buildArtifact, simSpec, boundedSportCue) : ''),
    [boundedSportCue, buildArtifact, exercise, simSpec]
  );
  const preflightCueUrl = useMemo(() => {
    const preferredKeys = [
      'signature_cue',
      'startle_cue',
      'crowd_surge',
      'crowd_bed',
      'commentary_overlap',
      'whistle_blast',
      'buzzer_shock',
    ];
    for (const key of preferredKeys) {
      const url = audioAssets[key]?.downloadURL;
      if (url) return url;
    }
    return Object.values(audioAssets).find((asset) => asset?.downloadURL)?.downloadURL;
  }, [audioAssets]);

  if (!buildArtifact) {
    return null;
  }

  const playPreflightCue = async () => {
    if (typeof window === 'undefined' || !preflightSoundEnabled) return;
    if (preflightCueUrl) {
      try {
        const audio = new Audio(preflightCueUrl);
        audio.volume = 0.7;
        await new Promise<void>((resolve) => {
          const finish = () => resolve();
          audio.onended = finish;
          audio.onerror = finish;
          audio.play().catch(() => finish());
          window.setTimeout(finish, 2200);
        });
        return;
      } catch (error) {
        console.warn('Failed to play hosted sim preflight audio prompt', error);
      }
    }
    const BrowserAudioContext = (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!BrowserAudioContext) return;
    const context = new BrowserAudioContext();
    const { base, accent, durationMs } = getPreflightCueEnvelope(buildArtifact.engineKey);
    const now = context.currentTime;
    [
      { frequency: base, offset: 0, gain: 0.06 },
      { frequency: accent, offset: 0.16, gain: 0.07 },
      { frequency: base * 1.12, offset: 0.34, gain: 0.05 },
    ].forEach(({ frequency, offset, gain }) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gainNode.gain.setValueAtTime(0.0001, now + offset);
      gainNode.gain.exponentialRampToValueAtTime(gain, now + offset + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.2);
    });
    await new Promise((resolve) => window.setTimeout(resolve, durationMs));
    context.close().catch(() => undefined);
  };

  const startPreflight = async () => {
    setPreflightState('briefing');
    setPreflightMessage('Nora is briefing the sim...');
    stopNarration();
    try {
      if (preflightSoundEnabled) {
        await playPreflightCue();
      }
      await primeNarrationPlayback();
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const fallback = window.setTimeout(finish, Math.min(14000, Math.max(3200, preflightBriefing.length * 55)));
        speakStep(preflightBriefing, {
          onEnd: () => {
            window.clearTimeout(fallback);
            finish();
          },
          onError: () => {
            window.clearTimeout(fallback);
            finish();
          },
        }).catch(() => {
          window.clearTimeout(fallback);
          finish();
        });
      });
    } finally {
      setPreflightState('ready');
      setPreflightMessage('Nora is done. Start when you’re ready.');
    }
  };

  if (preflightState !== 'ready' || runtimePhase !== 'active') {
    return (
      <div className="w-full h-full flex items-center justify-center text-white relative overflow-hidden bg-[#05070d]">
        <div className={`absolute inset-0 bg-gradient-to-br ${engineTheme.glow} opacity-70 pointer-events-none`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_48%)]" />
        <button onClick={onClose} className="absolute left-6 top-6 z-20 w-12 h-12 rounded-full border border-white/10 bg-white/6 flex items-center justify-center hover:bg-white/10 transition-colors">
          <X className="w-5 h-5 text-white/80" />
        </button>
        <button
          onClick={() => setPreflightSoundEnabled((value) => !value)}
          className="absolute right-6 top-6 z-20 w-12 h-12 rounded-full border border-white/10 bg-white/6 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          {preflightSoundEnabled ? <Volume2 className="w-5 h-5 text-white/80" /> : <VolumeX className="w-5 h-5 text-white/80" />}
        </button>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-3xl px-6"
        >
          <div
            className="rounded-[28px] backdrop-blur-xl p-8 md:p-10"
            style={{ border: `1px solid ${engineTheme.accent}33`, background: 'rgba(6, 10, 18, 0.58)' }}
          >
            <p className="text-xs uppercase tracking-[0.35em]" style={{ color: engineTheme.accent }}>{buildArtifact.family}</p>
            <h2 className="text-4xl font-semibold mt-3">{buildArtifact.variantName}</h2>
            <p className="mt-4 text-lg text-white/75 max-w-2xl">
              {taskDescription}
            </p>
            {boundedSportCue && athleteSport && (
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/45">Sport context: {athleteSport}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Duration</p>
                <p className="mt-2 text-2xl font-semibold">{buildArtifact.sessionModel.durationMinutes} min</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Metric</p>
                <p className="mt-2 text-2xl font-semibold">{metricLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">Structure</p>
                <p className="mt-2 text-2xl font-semibold">{buildArtifact.sessionModel.targetSessionStructure}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mt-6">
              <p className="text-xs uppercase tracking-[0.3em] text-white/35">Nora Briefing</p>
              <p className="mt-3 text-white/75 leading-relaxed">{preflightBriefing}</p>
            </div>
            {evidenceBoundary && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/35">Result boundary</p>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{evidenceBoundary}</p>
              </div>
            )}
            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={() => {
                  if (preflightState === 'intro') {
                    startPreflight().catch((error) => {
                      console.error('Failed to start sim preflight', error);
                      setPreflightState('ready');
                      setPreflightMessage('Nora could not finish the briefing. You can still start the sim.');
                    });
                    return;
                  }
                  if (preflightState === 'ready') {
                    stopNarration();
                    setRuntimePhase('active');
                  }
                }}
                disabled={preflightState === 'briefing'}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-black font-semibold transition-colors disabled:opacity-60"
                style={{ background: engineTheme.accent }}
              >
                <Play className="w-4 h-4" />
                {preflightState === 'briefing'
                  ? 'Nora is briefing...'
                  : preflightState === 'ready'
                    ? 'Begin Sim'
                    : 'Start Sim Intro'}
              </button>
              <p className="text-sm text-white/55">{preflightMessage}</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (buildArtifact.engineKey === 'reset') {
    return (
        <ResetGame
          exercise={exercise}
          profileSnapshotMilestone={profileSnapshotMilestone}
          onClose={onClose}
          onComplete={() => onComplete()}
          previewMode={previewMode}
          skipIntro
          initialSoundEnabled={preflightSoundEnabled}
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
        skipIntro
        initialSoundEnabled={preflightSoundEnabled}
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
        skipIntro
        initialSoundEnabled={preflightSoundEnabled}
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
        skipIntro
        initialSoundEnabled={preflightSoundEnabled}
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
        skipIntro
        initialSoundEnabled={preflightSoundEnabled}
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
        skipIntro
        initialSoundEnabled={preflightSoundEnabled}
      />
    );
  }

  return null;
};
