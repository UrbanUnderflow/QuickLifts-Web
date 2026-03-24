import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BadgeInfo,
  CheckCircle2,
  Clock3,
  Eye,
  RefreshCw,
  Target,
  X,
} from 'lucide-react';
import {
  athleteProgressService,
  dailyTaskTrainingPlanReadModelService,
  profileSnapshotService,
  stateSnapshotService,
  trainingPlanAuthoringService,
  type AthleteMentalProgress,
  type PulseCheckPlanStep,
  type PulseCheckStateSnapshot,
  type PulseCheckTrainingPlan,
} from '../../api/firebase/mentaltraining';
import type {
  AthleteWorkPlanEntry,
  AthleteWorkReadModel,
} from '../../api/firebase/mentaltraining/dailyTaskTrainingPlanReadModelService';

export interface CoachPrimaryPlanReviewAthlete {
  id: string;
  displayName?: string;
  username?: string;
  email?: string;
  profileImageURL?: string;
}

export interface CoachPrimaryPlanAuthoringResult {
  action: 'noop' | 'authored' | 'superseded';
  plan: PulseCheckTrainingPlan | null;
  supersededPlan: PulseCheckTrainingPlan | null;
  reason: string;
}

interface CoachPrimaryPlanReviewModalProps {
  isOpen: boolean;
  athlete: CoachPrimaryPlanReviewAthlete | null;
  coachId: string;
  coachName?: string;
  onClose: () => void;
  onPlanChanged?: (result: CoachPrimaryPlanAuthoringResult) => void;
}

interface ReviewState {
  readModel: AthleteWorkReadModel;
  progress: AthleteMentalProgress | null;
  snapshot: PulseCheckStateSnapshot | null;
  profileSnapshotId: string | null;
}

function formatDateTime(value?: number | null): string {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

function humanizeLabel(value?: string | null): string {
  if (!value) return 'Unknown';
  return value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function getPlanStatusTone(status?: PulseCheckTrainingPlan['status']): string {
  switch (status) {
    case 'active':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
    case 'paused':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-100';
    case 'completed':
      return 'border-blue-500/20 bg-blue-500/10 text-blue-200';
    case 'superseded':
      return 'border-zinc-700 bg-zinc-800/80 text-zinc-300';
    default:
      return 'border-zinc-700 bg-zinc-800/80 text-zinc-300';
  }
}

function getStepStatusTone(status?: PulseCheckPlanStep['stepStatus']): string {
  switch (status) {
    case 'active_today':
      return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200';
    case 'completed':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
    case 'overridden':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-100';
    case 'deferred':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-200';
    case 'skipped':
      return 'border-zinc-700 bg-zinc-800/80 text-zinc-300';
    case 'superseded':
      return 'border-zinc-700 bg-zinc-800/80 text-zinc-300';
    default:
      return 'border-zinc-700 bg-zinc-800/80 text-zinc-300';
  }
}

function getPlanTypeLabel(planType?: PulseCheckTrainingPlan['planType']): string {
  switch (planType) {
    case 'sim_focused':
      return 'Sim-focused';
    case 'protocol_focused':
      return 'Protocol-focused';
    case 'mixed':
      return 'Mixed';
    case 'assessment':
      return 'Assessment';
    default:
      return 'Plan';
  }
}

function getProgressLabel(plan: PulseCheckTrainingPlan): string {
  if (plan.progressMode === 'open_ended') {
    return `${plan.completedCount} completed`;
  }

  if (typeof plan.targetCount === 'number' && plan.targetCount > 0) {
    return `${plan.completedCount} of ${plan.targetCount}`;
  }

  return `${plan.completedCount} completed`;
}

function getCurrentStep(plan: PulseCheckTrainingPlan): PulseCheckPlanStep | null {
  if (!plan.steps.length) return null;

  const candidateIndex =
    typeof plan.currentStepIndex === 'number'
      ? plan.currentStepIndex
      : typeof plan.nextDueStepIndex === 'number'
        ? plan.nextDueStepIndex
        : typeof plan.lastCompletedStepIndex === 'number'
          ? Math.min(plan.lastCompletedStepIndex + 1, plan.steps.length - 1)
          : 0;

  return plan.steps[Math.max(0, Math.min(candidateIndex, plan.steps.length - 1))] || null;
}

function getProgressFill(plan: PulseCheckTrainingPlan): number {
  if (plan.progressMode === 'open_ended') {
    return Math.min(100, Math.max(8, plan.completedCount * 12));
  }

  if (!plan.targetCount || plan.targetCount <= 0) return 0;
  return Math.min(100, Math.round((plan.completedCount / plan.targetCount) * 100));
}

export const CoachPrimaryPlanReviewModal: React.FC<CoachPrimaryPlanReviewModalProps> = ({
  isOpen,
  athlete,
  coachId,
  coachName,
  onClose,
  onPlanChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [result, setResult] = useState<CoachPrimaryPlanAuthoringResult | null>(null);

  const primaryEntry = useMemo(() => {
    return reviewState?.readModel.activePlans.find((entry: AthleteWorkPlanEntry) => entry.plan.isPrimary) || null;
  }, [reviewState]);

  const secondaryPlans = useMemo(() => {
    return reviewState?.readModel.activePlans.filter((entry: AthleteWorkPlanEntry) => !entry.plan.isPrimary) || [];
  }, [reviewState]);

  const loadReviewState = useCallback(async () => {
    if (!athlete) return;

    setLoading(true);
    setLoadingError(null);

    try {
      const [readModel, progress] = await Promise.all([
        dailyTaskTrainingPlanReadModelService.loadForAthlete(athlete.id),
        athleteProgressService.get(athlete.id),
      ]);

      const snapshot = readModel.todayTask?.sourceStateSnapshotId
        ? await stateSnapshotService.getById(readModel.todayTask.sourceStateSnapshotId)
        : await stateSnapshotService.getForAthleteOnDate(athlete.id, readModel.sourceDate);

      const baselineSnapshot = progress?.baselineAssessment
        ? await profileSnapshotService.getCanonical(athlete.id, 'baseline')
        : null;

      setReviewState({
        readModel,
        progress,
        snapshot,
        profileSnapshotId: baselineSnapshot?.snapshotKey || progress?.profileVersion || null,
      });
    } catch (error) {
      console.error('[CoachPrimaryPlanReviewModal] Failed to load review state:', error);
      setLoadingError('Unable to load the current primary plan right now.');
      setReviewState(null);
    } finally {
      setLoading(false);
    }
  }, [athlete]);

  useEffect(() => {
    if (!isOpen || !athlete) {
      setConfirmPhrase('');
      setResult(null);
      setLoadingError(null);
      setReviewState(null);
      setSubmitting(false);
      return;
    }

    setConfirmPhrase('');
    setResult(null);
    loadReviewState();
  }, [athlete, isOpen, loadReviewState]);

  const handleAuthorPrimaryPlan = useCallback(async () => {
    if (!athlete || !reviewState || confirmPhrase.trim().toUpperCase() !== 'REBUILD') {
      return;
    }

    setSubmitting(true);
    setLoadingError(null);

    try {
      const authorResult = await trainingPlanAuthoringService.authorCoachPrimaryPlan({
        athleteId: athlete.id,
        coachId,
        profile: reviewState.progress?.taxonomyProfile || null,
        hasBaselineAssessment: Boolean(reviewState.progress?.baselineAssessment),
        activeProgram: reviewState.progress?.activeProgram || null,
        snapshot: reviewState.snapshot,
        sourceDate: reviewState.readModel.sourceDate,
        timezone: reviewState.readModel.timezone,
        sourceStateSnapshotId: reviewState.snapshot?.id || reviewState.readModel.todayTask?.sourceStateSnapshotId || null,
        sourceProfileSnapshotId: reviewState.profileSnapshotId,
        now: Date.now(),
      });

      const nextResult: CoachPrimaryPlanAuthoringResult = {
        action: authorResult.action,
        plan: authorResult.plan,
        supersededPlan: authorResult.supersededPlan,
        reason: authorResult.reason,
      };

      setResult(nextResult);
      onPlanChanged?.(nextResult);
      await loadReviewState();
    } catch (error) {
      console.error('[CoachPrimaryPlanReviewModal] Failed to author coach primary plan:', error);
      setLoadingError('Failed to author the replacement plan. Check the console for details.');
    } finally {
      setSubmitting(false);
    }
  }, [athlete, coachId, confirmPhrase, loadReviewState, onPlanChanged, reviewState]);

  if (!athlete) return null;

  const currentPlan = primaryEntry?.plan || null;
  const currentStep = currentPlan ? getCurrentStep(currentPlan) : null;
  const primaryPlans = reviewState?.readModel.activePlans.filter((entry: AthleteWorkPlanEntry) => entry.plan.isPrimary) || [];
  const hasMultiplePrimaryPlans = primaryPlans.length > 1;
  const confirmationMatches = confirmPhrase.trim().toUpperCase() === 'REBUILD';
  const actionLabel = currentPlan ? 'Replace primary plan' : 'Author primary plan';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Coach primary plan review</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {athlete.displayName || athlete.username || athlete.email || 'Athlete'}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Inspect the current primary plan, then confirm a coach-authored replacement if needed.
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close review modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-84px)] overflow-y-auto px-6 py-6">
              {loading ? (
                <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-zinc-400">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading current plan...
                </div>
              ) : loadingError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-rose-100">
                  {loadingError}
                </div>
              ) : (
                <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-3 py-1 text-xs font-semibold text-[#E0FE10]">
                          Primary plan snapshot
                        </span>
                        {reviewState?.readModel.todayState && (
                          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300">
                            Today: {humanizeLabel(reviewState.readModel.todayState)}
                          </span>
                        )}
                        {hasMultiplePrimaryPlans && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Multiple primary plans found
                          </span>
                        )}
                      </div>

                      {currentPlan ? (
                        <div className="mt-4 space-y-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-2xl font-semibold text-white">{currentPlan.title}</h3>
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPlanStatusTone(currentPlan.status)}`}>
                                  {humanizeLabel(currentPlan.status)}
                                </span>
                                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-zinc-300">
                                  {getPlanTypeLabel(currentPlan.planType)}
                                </span>
                              </div>
                              <p className="text-sm leading-6 text-zinc-300">{currentPlan.goal}</p>
                            </div>

                            <div className="min-w-[180px] rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Progress</div>
                              <div className="mt-1 text-2xl font-semibold text-white">{getProgressLabel(currentPlan)}</div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className="h-full rounded-full bg-[#E0FE10]"
                                  style={{ width: `${getProgressFill(currentPlan)}%` }}
                                />
                              </div>
                              <div className="mt-2 text-xs text-zinc-500">
                                {currentPlan.progressMode === 'open_ended'
                                  ? 'Open-ended progression'
                                  : currentPlan.targetCount
                                    ? `Target count: ${currentPlan.targetCount}`
                                    : 'Session-based progression'}
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Current step</div>
                              {currentStep ? (
                                <div className="mt-3 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-lg font-semibold text-white">
                                      {currentStep.stepLabel}
                                    </div>
                                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStepStatusTone(currentStep.stepStatus)}`}>
                                      {humanizeLabel(currentStep.stepStatus)}
                                    </span>
                                  </div>
                                  <div className="text-sm text-zinc-300">
                                    {humanizeLabel(currentStep.actionType)} {currentStep.executionPattern ? `• ${humanizeLabel(currentStep.executionPattern)}` : ''}
                                  </div>
                                  <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                      Step {typeof currentPlan.currentStepIndex === 'number' ? currentPlan.currentStepIndex + 1 : currentStep.stepIndex + 1}
                                    </span>
                                    {currentStep.linkedDailyTaskSourceDate && (
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                        {currentStep.linkedDailyTaskSourceDate}
                                      </span>
                                    )}
                                    {typeof currentStep.plannedDurationSeconds === 'number' && (
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                        {Math.round(currentStep.plannedDurationSeconds / 60)} min planned
                                      </span>
                                    )}
                                  </div>
                                  {currentStep.resultSummary?.noraTakeaway && (
                                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                                      {currentStep.resultSummary.noraTakeaway}
                                    </div>
                                  )}
                                  {currentStep.resultSummary?.primaryMetric && (
                                    <div className="text-sm text-zinc-300">
                                      Primary metric: <span className="text-white">{currentStep.resultSummary.primaryMetric.label}</span>{' '}
                                      {currentStep.resultSummary.primaryMetric.value}
                                      {currentStep.resultSummary.primaryMetric.unit ? ` ${currentStep.resultSummary.primaryMetric.unit}` : ''}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-3 text-sm text-zinc-500">
                                  No step is currently attached to this plan.
                                </div>
                              )}
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Provenance</div>
                              <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                                {[
                                  ['Assigned by', currentPlan.assignedBy],
                                  ['Coach id', currentPlan.coachId],
                                  ['Source date', currentPlan.sourceDate],
                                  ['Timezone', currentPlan.timezone],
                                  ['State snapshot', currentPlan.sourceStateSnapshotId],
                                  ['Profile snapshot', reviewState?.profileSnapshotId],
                                  ['Program prescription', currentPlan.sourceProgramPrescriptionId],
                                  ['Daily task', currentPlan.sourceDailyTaskId],
                                  ['Primary plan id', currentPlan.primaryPlanId],
                                  ['Authoring trigger', currentPlan.authoringTrigger],
                                ].map(([label, value]) =>
                                  value ? (
                                    <div key={label} className="flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-white/5 px-3 py-2">
                                      <span className="text-zinc-500">{label}</span>
                                      <span className="text-right text-zinc-200">{humanizeLabel(String(value))}</span>
                                    </div>
                                  ) : null
                                )}
                                {currentPlan.latestResultSummary && (
                                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
                                    {currentPlan.latestResultSummary}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-zinc-400">
                                  <Clock3 className="h-4 w-4" />
                                  Created {formatDateTime(currentPlan.createdAt)} • Updated {formatDateTime(currentPlan.updatedAt)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {secondaryPlans.length > 0 && (
                            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                                Secondary active plans ({secondaryPlans.length})
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {secondaryPlans.slice(0, 4).map((entry) => (
                                  <div key={entry.plan.id} className="rounded-xl border border-white/8 bg-white/5 px-3 py-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="font-medium text-white">{entry.plan.title}</div>
                                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-zinc-300">
                                        {getPlanTypeLabel(entry.plan.planType)}
                                      </span>
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-400">{entry.plan.goal}</div>
                                    <div className="mt-2 text-xs text-zinc-500">
                                      {getProgressLabel(entry.plan)} • {humanizeLabel(entry.plan.progressMode)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-8 text-zinc-300">
                          <div className="flex items-center gap-2 text-amber-200">
                            <BadgeInfo className="h-4 w-4" />
                            No active primary plan is currently attached to this athlete.
                          </div>
                          <p className="mt-2 text-sm text-zinc-400">
                            This is a good time to author the first primary plan or rebuild one after a state change.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Eye className="h-4 w-4 text-[#E0FE10]" />
                        What Nora will use
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">State snapshot</div>
                          <div className="mt-1 text-sm text-zinc-200">
                            {reviewState?.snapshot ? reviewState.snapshot.overallReadiness : 'No state snapshot available'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Profile context</div>
                          <div className="mt-1 text-sm text-zinc-200">
                            {reviewState?.progress?.taxonomyProfile
                              ? `Profile version ${reviewState.progress.profileVersion || 'n/a'}`
                              : 'No taxonomy profile yet'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Active program</div>
                          <div className="mt-1 text-sm text-zinc-200">
                            {reviewState?.progress?.activeProgram
                              ? humanizeLabel(reviewState.progress.activeProgram.recommendedSimId)
                              : 'None'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Read model date</div>
                          <div className="mt-1 text-sm text-zinc-200">
                            {reviewState?.readModel.sourceDate} • {reviewState?.readModel.timezone}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-[#E0FE10]/20 bg-[#E0FE10]/10 p-5">
                      <div className="text-xs uppercase tracking-[0.22em] text-[#E0FE10]">Coach confirmation</div>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        Confirm the replacement
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        {currentPlan
                          ? 'This will author a coach replacement and supersede the current primary plan if the runtime produces a new plan.'
                          : 'This will author the first coach primary plan for this athlete using the current state context.'}
                      </p>

                      <div className="mt-4 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Type to confirm</div>
                        <input
                          value={confirmPhrase}
                          onChange={(event) => setConfirmPhrase(event.target.value)}
                          placeholder="REBUILD"
                          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder-zinc-500 outline-none transition-colors focus:border-[#E0FE10]"
                        />
                        <div className="mt-2 text-xs text-zinc-500">
                          Enter <span className="font-semibold text-zinc-200">REBUILD</span> to unlock the action.
                        </div>
                      </div>

                      <button
                        onClick={handleAuthorPrimaryPlan}
                        disabled={!confirmationMatches || submitting}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 font-semibold text-black transition-colors hover:bg-[#c8e40e] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Rebuilding...
                          </>
                        ) : (
                          <>
                            <Target className="h-4 w-4" />
                            {actionLabel}
                          </>
                        )}
                      </button>

                      <div className="mt-3 text-xs text-zinc-500">
                        Coach: {coachName || coachId}
                      </div>
                    </div>

                    {result && (
                      <div className="rounded-2xl border border-white/8 bg-white/5 p-5">
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          Result
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300">
                            Action: {result.action}
                          </span>
                          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-300">
                            {result.plan ? `Plan ${result.plan.id}` : 'No new plan'}
                          </span>
                          {result.supersededPlan && (
                            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                              Superseded {result.supersededPlan.id}
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-zinc-300">{result.reason}</p>

                        {result.plan && (
                          <div className="mt-4 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Replacement plan</div>
                            <div className="mt-2 text-base font-semibold text-white">{result.plan.title}</div>
                            <div className="mt-1 text-sm text-zinc-400">{result.plan.goal}</div>
                            <div className="mt-2 text-xs text-zinc-500">
                              {getPlanTypeLabel(result.plan.planType)} • {result.plan.isPrimary ? 'Primary' : 'Secondary'} • {formatDateTime(result.plan.updatedAt)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/8 bg-black/20 p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Safety note</div>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">
                        This UI only authorizes a coach replacement through the existing training-plan authoring service.
                        It does not modify the athlete&apos;s current daily execution record directly.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CoachPrimaryPlanReviewModal;
