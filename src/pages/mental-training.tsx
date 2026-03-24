/**
 * Mental Training Page (Athlete View)
 *
 * Shared runtime surface for athlete mental training:
 * Today -> Active Plans -> Recent Results
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Wind,
  Eye,
  Target,
  Star,
  CheckCircle,
  ChevronRight,
  Calendar,
  Award,
  Clock3,
  Layers,
  BookOpen,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import SideNav from '../components/Navigation/SideNav';
import { useUser } from '../hooks/useUser';
import {
  dailyTaskTrainingPlanReadModelService,
  assignmentOrchestratorService,
  simModuleLibraryService,
  completionService,
  athleteProgressService,
  type SimModule,
  type SimCompletion,
  type MentalTrainingStreak,
  type AthleteMentalProgress,
  type ExerciseCategory,
  PulseCheckDailyAssignmentStatus,
} from '../api/firebase/mentaltraining';
import type { AthleteWorkReadModel } from '../api/firebase/mentaltraining/dailyTaskTrainingPlanReadModelService';
import { ExerciseCard, ExercisePlayer, MentalProgressCard, exerciseRequiresWriting } from '../components/mentaltraining';
import type { ProfileSnapshotMilestone } from '../api/firebase/mentaltraining/taxonomy';

type SharedPlanEntry = AthleteWorkReadModel['activePlans'][number];

function humanizeLabel(value?: string | null): string {
  if (!value) return 'Nora task';
  return value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDateTime(value?: number | null): string {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString();
}

function formatDate(value?: number | null): string {
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleDateString();
}

function getDailyTaskStatusLabel(status?: PulseCheckDailyAssignmentStatus): string {
  switch (status) {
    case PulseCheckDailyAssignmentStatus.Assigned:
      return 'Assigned';
    case PulseCheckDailyAssignmentStatus.Viewed:
      return 'Viewed';
    case PulseCheckDailyAssignmentStatus.Started:
      return 'Started';
    case PulseCheckDailyAssignmentStatus.Paused:
      return 'Paused';
    case PulseCheckDailyAssignmentStatus.Completed:
      return 'Completed';
    case PulseCheckDailyAssignmentStatus.Overridden:
      return 'Coach overridden';
    case PulseCheckDailyAssignmentStatus.Deferred:
      return 'Deferred';
    case PulseCheckDailyAssignmentStatus.Superseded:
      return 'Superseded';
    case PulseCheckDailyAssignmentStatus.Expired:
      return 'Expired';
    default:
      return 'Assigned';
  }
}

function getDailyTaskTone(status?: PulseCheckDailyAssignmentStatus): string {
  switch (status) {
    case PulseCheckDailyAssignmentStatus.Completed:
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
    case PulseCheckDailyAssignmentStatus.Started:
      return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200';
    case PulseCheckDailyAssignmentStatus.Paused:
      return 'border-amber-500/20 bg-amber-500/10 text-amber-100';
    case PulseCheckDailyAssignmentStatus.Overridden:
      return 'border-amber-500/20 bg-amber-500/10 text-amber-100';
    case PulseCheckDailyAssignmentStatus.Deferred:
      return 'border-rose-500/20 bg-rose-500/10 text-rose-200';
    case PulseCheckDailyAssignmentStatus.Superseded:
      return 'border-zinc-700 bg-zinc-800/80 text-zinc-300';
    case PulseCheckDailyAssignmentStatus.Expired:
      return 'border-zinc-700 bg-zinc-800/80 text-zinc-300';
    default:
      return 'border-[#E0FE10]/25 bg-[#E0FE10]/10 text-[#E0FE10]';
  }
}

function getPlanTypeLabel(planType: SharedPlanEntry['plan']['planType']): string {
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

function getPlanTone(status?: SharedPlanEntry['plan']['status']): string {
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

function getPlanCurrentStep(plan: SharedPlanEntry['plan']) {
  if (!plan.steps.length) return null;

  const index =
    typeof plan.currentStepIndex === 'number'
      ? plan.currentStepIndex
      : typeof plan.nextDueStepIndex === 'number'
        ? plan.nextDueStepIndex
        : typeof plan.lastCompletedStepIndex === 'number'
          ? plan.lastCompletedStepIndex + 1
          : 0;

  return plan.steps.find((step) => step.stepIndex === index) || plan.steps[Math.max(0, Math.min(index, plan.steps.length - 1))] || null;
}

function getPlanProgressLabel(plan: SharedPlanEntry['plan']): string {
  if (plan.progressMode === 'open_ended') {
    return `${plan.completedCount} completed`;
  }

  if (typeof plan.targetCount === 'number' && plan.targetCount > 0) {
    return `${plan.completedCount} of ${plan.targetCount}`;
  }

  return `${plan.completedCount} completed`;
}

function getTaskTitle(task: AthleteWorkReadModel['todayTask']): string {
  if (!task) return 'Nora task';
  return humanizeLabel(task.protocolLabel || task.simSpecId || task.legacyExerciseId || task.actionType);
}

function isLaunchableTask(status?: PulseCheckDailyAssignmentStatus): boolean {
  return ![
    PulseCheckDailyAssignmentStatus.Completed,
    PulseCheckDailyAssignmentStatus.Deferred,
    PulseCheckDailyAssignmentStatus.Superseded,
    PulseCheckDailyAssignmentStatus.Overridden,
    PulseCheckDailyAssignmentStatus.Expired,
  ].includes(status || PulseCheckDailyAssignmentStatus.Assigned);
}

const MentalTrainingPage: React.FC = () => {
  const currentUser = useUser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sharedSurface, setSharedSurface] = useState<AthleteWorkReadModel | null>(null);
  const [exercises, setExercises] = useState<SimModule[]>([]);
  const [streak, setStreak] = useState<MentalTrainingStreak | null>(null);
  const [averageReadiness, setAverageReadiness] = useState<{ average: number; trend: 'up' | 'down' | 'stable' } | undefined>();
  const [athleteProgress, setAthleteProgress] = useState<AthleteMentalProgress | null>(null);
  const [latestSessionCompletion, setLatestSessionCompletion] = useState<SimCompletion | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<SimModule | null>(null);
  const [selectedDailyAssignmentId, setSelectedDailyAssignmentId] = useState<string | undefined>();
  const [selectedProfileSnapshotMilestone, setSelectedProfileSnapshotMilestone] = useState<Extract<ProfileSnapshotMilestone, 'midpoint' | 'endpoint' | 'retention'> | undefined>();

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.id) return;

      setLoading(true);
      try {
        const [surface, progressData, exerciseData, athleteProfile] = await Promise.all([
          dailyTaskTrainingPlanReadModelService.loadForAthlete(currentUser.id).catch((error) => {
            console.error('Failed to load shared mental-training surface:', error);
            return null;
          }),
          completionService.getProgressSummary(currentUser.id),
          simModuleLibraryService.getAll(),
          athleteProgressService.syncTaxonomyProfile(currentUser.id).catch(() => athleteProgressService.get(currentUser.id)),
        ]);

        setSharedSurface(surface);
        setExercises(exerciseData);
        setStreak(progressData.streak);
        setAverageReadiness(progressData.averageReadiness);
        setLatestSessionCompletion(progressData.recentCompletions[0] || null);
        setAthleteProgress(athleteProfile || null);
      } catch (error) {
        console.error('Failed to load mental training data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser?.id]);

  useEffect(() => {
    const loadDailyAssignmentLaunch = async () => {
      if (!currentUser?.id || !router.isReady) return;

      const dailyAssignmentId = typeof router.query.dailyAssignmentId === 'string' ? router.query.dailyAssignmentId : '';
      if (!dailyAssignmentId) return;

      try {
        const resolved = await assignmentOrchestratorService.resolveExercise(dailyAssignmentId);
        if (!resolved) return;

        const { assignment, exercise } = resolved;
        if (
          assignment.status === PulseCheckDailyAssignmentStatus.Deferred
          || assignment.status === PulseCheckDailyAssignmentStatus.Overridden
          || assignment.status === PulseCheckDailyAssignmentStatus.Superseded
          || assignment.status === PulseCheckDailyAssignmentStatus.Completed
        ) {
          return;
        }

        await assignmentOrchestratorService.markStarted(dailyAssignmentId);
        setSelectedExercise(exercise);
        setSelectedDailyAssignmentId(dailyAssignmentId);
      } catch (error) {
        console.error('Failed to launch Nora daily assignment:', error);
      } finally {
        router.replace('/mental-training', undefined, { shallow: true }).catch(() => undefined);
      }
    };

    loadDailyAssignmentLaunch();
  }, [currentUser?.id, router, router.isReady, router.query.dailyAssignmentId]);

  const launchExercise = async (
    exercise: SimModule,
    dailyAssignmentId?: string,
    profileSnapshotMilestone?: Extract<ProfileSnapshotMilestone, 'midpoint' | 'endpoint' | 'retention'>
  ) => {
    if (exerciseRequiresWriting(exercise)) {
      localStorage.setItem('pulsecheck_active_exercise', JSON.stringify(exercise));
      const dailyParam = dailyAssignmentId ? `&dailyAssignmentId=${encodeURIComponent(dailyAssignmentId)}` : '';
      router.push(`/PulseCheck?exercise=${encodeURIComponent(JSON.stringify(exercise))}${dailyParam}`);
      return;
    }

    if (dailyAssignmentId) {
      assignmentOrchestratorService.markStarted(dailyAssignmentId).catch((error) => {
        console.error('Failed to mark daily assignment started:', error);
      });
    }

    setSelectedExercise(exercise);
    setSelectedDailyAssignmentId(dailyAssignmentId);
    setSelectedProfileSnapshotMilestone(profileSnapshotMilestone);
  };

  const handleStartInChat = (exercise: SimModule) => {
    localStorage.setItem('pulsecheck_active_exercise', JSON.stringify(exercise));
    router.push(`/PulseCheck?exercise=${encodeURIComponent(JSON.stringify(exercise))}`);
  };

  const handleExerciseComplete = async (data: {
    durationSeconds: number;
    preExerciseMood?: number;
    postExerciseMood?: number;
    difficultyRating?: number;
    helpfulnessRating?: number;
    notes?: string;
  }) => {
    if (!selectedExercise || !currentUser?.id) return;

    try {
      const recordedCompletion = await completionService.recordCompletion({
        userId: currentUser.id,
        exerciseId: selectedExercise.id,
        exerciseName: selectedExercise.name,
        exerciseCategory: selectedExercise.category,
        dailyAssignmentId: selectedDailyAssignmentId,
        ...data,
      });

      const [freshSurface, newStreak, freshProgress] = await Promise.all([
        dailyTaskTrainingPlanReadModelService.loadForAthlete(currentUser.id).catch(() => sharedSurface),
        completionService.getStreak(currentUser.id),
        athleteProgressService.get(currentUser.id).catch(() => athleteProgress),
      ]);

      setSharedSurface(freshSurface || sharedSurface);
      setStreak(newStreak);
      setLatestSessionCompletion(recordedCompletion);
      setAthleteProgress(freshProgress || null);
    } catch (error) {
      console.error('Failed to record completion:', error);
    }

    setSelectedExercise(null);
    setSelectedDailyAssignmentId(undefined);
    setSelectedProfileSnapshotMilestone(undefined);
  };

  const todaysTask = sharedSurface?.todayTask || null;
  const activePlans = sharedSurface?.activePlans || [];
  const recentResults = sharedSurface?.recentResults || [];
  const libraryExercises = exercises.slice(0, 8);

  const openTodayTask = async () => {
    if (!todaysTask) return;

    const resolved = await assignmentOrchestratorService.resolveExercise(todaysTask.id);
    if (!resolved) return;

    if (!isLaunchableTask(todaysTask.status)) {
      setSelectedExercise(resolved.exercise);
      setSelectedDailyAssignmentId(todaysTask.id);
      return;
    }

    await launchExercise(resolved.exercise, todaysTask.id);
  };

  const currentPrimaryPlan = activePlans.find((entry) => entry.plan.isPrimary) || activePlans[0] || null;

  if (loading && !sharedSurface && !currentUser?.id) {
    return (
      <div className="min-h-screen bg-[#0d0d0f]">
        <SideNav />
        <Head><title>Mental Training | Nora</title></Head>
        <div className="lg:pl-64 min-h-screen flex items-center justify-center">
          <div className="text-zinc-400">Loading your mental training...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f]">
      <SideNav />
      <Head><title>Mental Training | Nora</title></Head>

      <main className="lg:pl-64 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
              <Brain className="w-8 h-8 text-[#E0FE10]" />
              Mental Training
            </h1>
            <p className="text-zinc-400">
              Today, active plans, and recent results
            </p>
          </div>

          {streak && (
            <div className="mb-8">
              <MentalProgressCard
                streak={streak}
                averageReadiness={averageReadiness}
                taxonomyProfile={athleteProgress?.taxonomyProfile}
                activeProgram={athleteProgress?.activeProgram}
                compact
              />
            </div>
          )}

          {latestSessionCompletion?.sessionSummary && (
            <div className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-500/15 p-2.5">
                  <CheckCircle className="h-5 w-5 text-emerald-300" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    Latest Session Update
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {latestSessionCompletion.sessionSummary.athleteHeadline}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-200">
                    {latestSessionCompletion.sessionSummary.athleteBody}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      Completed {latestSessionCompletion.sessionSummary.completedActionLabel}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      Next up {latestSessionCompletion.sessionSummary.nextActionLabel}
                    </span>
                    {latestSessionCompletion.sessionSummary.targetSkills.slice(0, 2).map((skill) => (
                      <span key={skill} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <section className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Today</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Your current Nora task</h2>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
                <Clock3 className="h-3.5 w-3.5 text-[#E0FE10]" />
                {sharedSurface?.sourceDate || 'Today'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              {todaysTask ? (
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getDailyTaskTone(todaysTask.status)}`}>
                        {getDailyTaskStatusLabel(todaysTask.status)}
                      </span>
                      {todaysTask.trainingPlanIsPrimary ? (
                        <span className="rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#E0FE10]">
                          Primary plan
                        </span>
                      ) : null}
                      {todaysTask.phaseProgress?.currentPhaseLabel ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                          {todaysTask.phaseProgress.currentPhaseLabel}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-4 text-2xl font-semibold text-white">
                      {getTaskTitle(todaysTask)}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      {todaysTask.rationale}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
                      {todaysTask.trainingPlanId ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                          Plan {todaysTask.trainingPlanId}
                        </span>
                      ) : null}
                      {todaysTask.trainingPlanStepLabel ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                          Step {todaysTask.trainingPlanStepLabel}
                        </span>
                      ) : null}
                      {todaysTask.durationSeconds ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                          {Math.max(1, Math.round(todaysTask.durationSeconds / 60))} min
                        </span>
                      ) : null}
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                        {sharedSurface?.timezone || 'Athlete local time'}
                      </span>
                    </div>
                  </div>

                  <div className="w-full lg:max-w-xs">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Launch</p>
                      <p className="mt-2 text-sm text-zinc-300">
                        Open the same daily assignment that Home and Nora use.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          void openTodayTask();
                        }}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-4 py-3 text-sm font-semibold text-[#E0FE10] transition hover:border-[#E0FE10]/40 hover:bg-[#E0FE10]/15"
                      >
                        <Sparkles className="h-4 w-4" />
                        {isLaunchableTask(todaysTask.status) ? 'Start today’s task' : 'Review today’s task'}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <p className="mt-3 text-xs text-zinc-500">
                        {todaysTask.startedAt ? `Started ${formatDateTime(todaysTask.startedAt)}` : 'Not started yet'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">
                        {sharedSurface?.todayState === 'between_programs' ? 'Between programs' : 'No task yet'}
                      </span>
                      {currentPrimaryPlan ? (
                        <span className="rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#E0FE10]">
                          Active plan present
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-white">
                      {sharedSurface?.todayState === 'between_programs'
                        ? "You're between programs right now."
                        : 'Nora is lining up your next rep.'}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      {sharedSurface?.todayState === 'between_programs'
                        ? 'Your last program has finished, and the next active plan has not materialized yet.'
                        : 'When Nora authors a new task, it will appear here first and stay aligned with Home and chat.'}
                    </p>
                  </div>
                  <div className="w-full lg:max-w-xs rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">
                      {currentPrimaryPlan ? currentPrimaryPlan.plan.title : 'Waiting for the next plan'}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">
                      {currentPrimaryPlan ? currentPrimaryPlan.plan.goal : 'No active plan is attached right now.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="mt-10 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Active Plans</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">What Nora is building over time</h2>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
                <Layers className="h-3.5 w-3.5 text-[#E0FE10]" />
                {activePlans.length} active
              </div>
            </div>

            {activePlans.length > 0 ? (
              <div className="grid gap-4">
                {activePlans.map((entry) => {
                  const plan = entry.plan;
                  const currentStep = getPlanCurrentStep(plan);
                  const launchTarget = todaysTask?.trainingPlanId === plan.id ? todaysTask.id : null;

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getPlanTone(plan.status)}`}>
                              {plan.isPrimary ? 'Primary plan' : 'Secondary plan'}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                              {getPlanTypeLabel(plan.planType)}
                            </span>
                            {plan.progressMode ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                                {plan.progressMode === 'days' ? 'Daily cadence' : 'Session progression'}
                              </span>
                            ) : null}
                          </div>

                          <h3 className="mt-4 text-xl font-semibold text-white">
                            {plan.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-zinc-300">
                            {plan.goal}
                          </p>

                          <div className="mt-4 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                              <p className="uppercase tracking-[0.18em] text-zinc-500">Current step</p>
                              <p className="mt-1 font-medium text-white">
                                {currentStep?.stepLabel || 'No active step yet'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                              <p className="uppercase tracking-[0.18em] text-zinc-500">Progress</p>
                              <p className="mt-1 font-medium text-white">
                                {getPlanProgressLabel(plan)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
                            {plan.nextDueStepIndex != null ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                Next due step {plan.nextDueStepIndex}
                              </span>
                            ) : null}
                            {plan.latestResultSummary ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                                {plan.latestResultSummary}
                              </span>
                            ) : null}
                            {plan.inventoryFallbackReason ? (
                              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-100">
                                Inventory fallback
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="w-full lg:max-w-xs">
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Surface link</p>
                            <p className="mt-2 text-sm text-zinc-300">
                              {launchTarget
                                ? 'Launch the same task from this plan.'
                                : 'This plan is active, but its next due task is not on deck yet.'}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                if (!launchTarget) return;
                                void openTodayTask();
                              }}
                              disabled={!launchTarget}
                              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition"
                              style={{
                                borderColor: launchTarget ? 'rgba(224,254,16,0.20)' : 'rgba(255,255,255,0.08)',
                                background: launchTarget ? 'rgba(224,254,16,0.10)' : 'rgba(255,255,255,0.03)',
                                color: launchTarget ? '#E0FE10' : '#a1a1aa',
                              }}
                            >
                              {launchTarget ? 'Open today’s task' : 'Waiting'}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-300">
                No active plans are attached yet.
              </div>
            )}
          </section>

          <section className="mt-10 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Recent Results</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">What the last reps changed</h2>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
                <Clock3 className="h-3.5 w-3.5 text-[#E0FE10]" />
                {recentResults.length} recent
              </div>
            </div>

            {recentResults.length > 0 ? (
              <div className="grid gap-3">
                {recentResults.map((result) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${getDailyTaskTone(result.status)}`}>
                            {getDailyTaskStatusLabel(result.status)}
                          </span>
                          {result.trainingPlanId ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                              Plan {result.trainingPlanId}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">
                          {getTaskTitle(result)}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">
                          {result.completionSummary?.noraTakeaway || result.rationale || 'Completed result'}
                        </p>
                      </div>

                      <div className="text-xs text-zinc-400">
                        <p>{formatDateTime(result.completedAt || result.updatedAt)}</p>
                        {result.completionSummary?.primaryMetric ? (
                          <p className="mt-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-zinc-300">
                            {result.completionSummary.primaryMetric.label}: {result.completionSummary.primaryMetric.value}
                            {result.completionSummary.primaryMetric.unit ? ` ${result.completionSummary.primaryMetric.unit}` : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-300">
                No recent results yet.
              </div>
            )}
          </section>

          <section className="mt-10 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Library</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Browse exercises if you want a self-start</h2>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300">
                <BookOpen className="h-3.5 w-3.5 text-[#E0FE10]" />
                {libraryExercises.length} visible
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {libraryExercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  onClick={() => {
                    void launchExercise(exercise);
                  }}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      <AnimatePresence>
        {selectedExercise && (
          <ExercisePlayer
            exercise={selectedExercise}
            dailyAssignmentId={selectedDailyAssignmentId}
            profileSnapshotMilestone={selectedProfileSnapshotMilestone}
            onComplete={handleExerciseComplete}
            onClose={() => {
              setSelectedExercise(null);
              setSelectedDailyAssignmentId(undefined);
              setSelectedProfileSnapshotMilestone(undefined);
            }}
            onStartInChat={handleStartInChat}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MentalTrainingPage;
