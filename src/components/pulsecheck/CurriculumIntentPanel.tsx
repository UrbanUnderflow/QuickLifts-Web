import React from 'react';
import { CheckCircle2, Info, Route, Target } from 'lucide-react';
import type { PulseCheckDailyAssignment } from '../../api/firebase/mentaltraining/types';

const humanizeAssignmentLabel = (value?: string | null) => {
  if (!value) return 'Nora task';
  return value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const assignmentActionLabel = (assignment: PulseCheckDailyAssignment) => {
  if (assignment.actionType === 'defer') return 'Pause for today';
  if (assignment.protocolLabel) return assignment.protocolLabel;
  if (assignment.simName) return assignment.simName;
  if (assignment.simSpecId) return humanizeAssignmentLabel(assignment.simSpecId);
  if (assignment.legacyExerciseId) return humanizeAssignmentLabel(assignment.legacyExerciseId);
  if (assignment.sessionType) return humanizeAssignmentLabel(assignment.sessionType);
  if (assignment.actionType === 'lighter_sim') return 'Lighter sim';
  if (assignment.actionType === 'protocol') return 'Protocol';
  return 'Simulation';
};

const assignmentKindLabel = (assignment: PulseCheckDailyAssignment) => {
  if (assignment.actionType === 'protocol' || assignment.protocolId || assignment.protocolLabel) return 'Protocol';
  if (assignment.actionType === 'simulation' || assignment.simSpecId || assignment.simName) return 'Simulation';
  return 'Task';
};

export interface CurriculumIntentPanelProps {
  assignment: PulseCheckDailyAssignment | null;
  pairedAssignments?: PulseCheckDailyAssignment[];
  compact?: boolean;
  variant?: 'full' | 'summary';
  showFallback?: boolean;
  className?: string;
  title?: string;
  surfaceLabel?: string;
}

type DisplayIntent = {
  badgeLabel: string;
  focusName: string;
  whyThisToday: string;
  sequenceLabel: string;
  progressLabel: string;
  progressionCriteria: string;
  reassessmentLabel: string;
  nextLikelyStep: string;
};

const assignmentSourceLabel = (assignment: PulseCheckDailyAssignment) => {
  if (assignment.assignedBy === 'curriculum-engine') return 'Assigned by curriculum';
  if (assignment.assignedBy === 'coach-override') return 'Coach-directed assignment';
  return 'Intentional assignment';
};

const fallbackFocusLabel = (assignment: PulseCheckDailyAssignment) => {
  if (assignment.curriculumIntent?.focusName) return assignment.curriculumIntent.focusName;
  if (assignment.simFamilyLabel) return assignment.simFamilyLabel;
  if (assignment.protocolClass) return humanizeAssignmentLabel(assignment.protocolClass);
  if (assignment.protocolResponseFamily) return humanizeAssignmentLabel(assignment.protocolResponseFamily);
  if (assignment.readinessBand) return `${assignment.readinessBand} readiness`;
  return assignmentKindLabel(assignment);
};

const fallbackSequenceLabel = (assignment: PulseCheckDailyAssignment) => {
  if (assignment.phaseProgress?.currentPhaseLabel) {
    return assignment.phaseProgress.currentPhaseLabel;
  }

  if (assignment.trainingPlanStepLabel) {
    return `Step ${assignment.trainingPlanStepLabel}`;
  }

  if (assignment.trainingPlanStepIndex != null) {
    return `Step ${assignment.trainingPlanStepIndex + 1}`;
  }

  if (assignment.trainingPlanId) return 'Active plan rep';
  return 'Today\'s rep';
};

const buildFallbackIntent = (assignment: PulseCheckDailyAssignment): DisplayIntent => {
  const actionLabel = assignmentActionLabel(assignment);
  const kindLabel = assignmentKindLabel(assignment).toLowerCase();
  const sourceLabel = assignmentSourceLabel(assignment);
  const planContext = assignment.trainingPlanId
    ? 'your active plan, readiness signal, and recent training history'
    : 'your readiness signal and recent training history';
  const repeatContext = 'If this looks familiar, that repeat is allowed by design when the same focus still needs reps.';

  return {
    badgeLabel: sourceLabel,
    focusName: fallbackFocusLabel(assignment),
    sequenceLabel: fallbackSequenceLabel(assignment),
    whyThisToday: assignment.rationale
      ? `${assignment.rationale} ${repeatContext}`
      : `Nora assigned ${actionLabel} from ${planContext}. ${repeatContext}`,
    progressLabel: assignment.trainingPlanId
      ? 'This rep is tied to an active plan in the Training Room.'
      : 'This rep is tied to today\'s Nora assignment.',
    progressionCriteria: assignment.trainingPlanId
      ? 'Complete this rep and Nora uses the result to decide whether to repeat, progress, or adjust the plan step.'
      : `Complete this ${kindLabel}; Nora reassesses after the session and again at the next daily check-in before changing the assignment.`,
    reassessmentLabel: 'Nora reassesses after completion and at the next daily check-in',
    nextLikelyStep: assignment.trainingPlanId
      ? 'The next Training Room step stays attached to this plan unless your result or a coach changes it.'
      : 'Nora will either repeat this focus, pair it with a reset, or move you to the next best rep.',
  };
};

const withPeriod = (value: string) => (value.trim().endsWith('.') ? value.trim() : `${value.trim()}.`);

const CurriculumIntentPanel: React.FC<CurriculumIntentPanelProps> = ({
  assignment,
  pairedAssignments = [],
  compact = false,
  variant = 'full',
  showFallback = false,
  className = '',
  title,
  surfaceLabel,
}) => {
  const storedIntent = assignment?.curriculumIntent;
  if (!assignment || (!storedIntent && !showFallback)) return null;

  const intent: DisplayIntent = storedIntent || buildFallbackIntent(assignment);
  const hasStoredIntent = Boolean(storedIntent);

  const uniqueAssignments = pairedAssignments
    .filter((candidate) => candidate.id)
    .reduce<PulseCheckDailyAssignment[]>((accumulator, candidate) => {
      if (!accumulator.some((entry) => entry.id === candidate.id)) {
        accumulator.push(candidate);
      }
      return accumulator;
    }, []);
  const showPair = uniqueAssignments.length > 1;

  if (variant === 'summary') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E0FE10]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {surfaceLabel || (hasStoredIntent ? 'Assigned by curriculum' : assignmentSourceLabel(assignment))}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            {intent.sequenceLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            {intent.focusName}
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            <Info className="h-3.5 w-3.5 text-[#E0FE10]" />
            {title || 'Why this is assigned'}
          </div>
          <h3 className="mt-2 text-xl font-semibold text-white">
            {hasStoredIntent ? 'Assigned by curriculum, not random' : 'Assigned intentionally from today\'s signals'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{intent.whyThisToday}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="border-l border-[#93C5FD]/30 pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">How long</p>
            <p className="mt-1 text-sm leading-6 text-zinc-300">{intent.progressionCriteria}</p>
          </div>
          <div className="border-l border-[#C084FC]/30 pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">When you move on</p>
            <p className="mt-1 text-sm leading-6 text-zinc-300">{intent.nextLikelyStep}</p>
          </div>
        </div>

        <p className="text-xs leading-5 text-zinc-500">
          {withPeriod(intent.progressLabel)} {withPeriod(intent.reassessmentLabel)}
        </p>
      </div>
    );
  }

  return (
    <div className={`mt-5 border-t border-white/10 pt-5 ${compact ? 'space-y-4' : 'space-y-5'} ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E0FE10]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {intent.badgeLabel}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
          {intent.sequenceLabel}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
          {intent.focusName}
        </span>
      </div>

      {showPair ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {uniqueAssignments.map((candidate) => (
            <div key={candidate.id} className="border-l border-white/10 pl-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                {assignmentKindLabel(candidate)}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {assignmentActionLabel(candidate)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            <Info className="h-3.5 w-3.5 text-[#E0FE10]" />
            Why this today
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{intent.whyThisToday}</p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            <Target className="h-3.5 w-3.5 text-[#93C5FD]" />
            How you move on
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{intent.progressionCriteria}</p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            <Route className="h-3.5 w-3.5 text-[#C084FC]" />
            What is next
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{intent.nextLikelyStep}</p>
        </div>
      </div>

      <p className="text-xs leading-5 text-zinc-500">
        {intent.progressLabel}. {intent.reassessmentLabel}
      </p>
    </div>
  );
};

export default CurriculumIntentPanel;
