/**
 * Coach Mental Training Page
 * 
 * Dashboard for coaches to manage mental training for their athletes.
 * - View connected athletes and their mental training progress
 * - Assign exercises to individuals or groups
 * - Track assignment completion rates
 * - Review and action Nora's recommendations
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import {
  Brain,
  Users,
  Plus,
  Search,
  Clock,
  CheckCircle,
  Wind,
  Eye,
  Target,
  Star,
  Flame,
  Sparkles,
  RefreshCw,
  Lock,
  TrendingUp,
  ScanLine,
  FileBarChart2,
} from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { auth, db } from '../../api/firebase/config';
import { coachService } from '../../api/firebase/coach';
import { CoachModel } from '../../types/Coach';
import {
  simModuleLibraryService,
  assignmentService,
  assignmentOrchestratorService,
  completionService,
  curriculumAssignmentService,
  athleteProgressService,
  recommendationService,
  SimModule,
  SimAssignment,
  ExerciseCategory,
  AssignmentStatus,
  MentalTrainingStreak,
  MentalRecommendation,
  CurriculumAssignment,
  AthleteMentalProgress,
  ExerciseCompletion,
  PulseCheckDailyAssignment,
  PulseCheckDailyAssignmentStatus,
  visionProTrialService,
  VISION_PRO_CURRICULUM_ASSIGNMENTS_COLLECTION,
  VISION_PRO_LEGACY_ASSIGNMENTS_COLLECTION,
} from '../../api/firebase/mentaltraining';
import type { VisionProTrialSession } from '../../api/firebase/mentaltraining/visionProTrialService';
import CoachLayout from '../../components/CoachLayout';
import Head from 'next/head';
import {
  ExerciseCard,
  AssignExerciseModal,
  ExercisePlayer,
  RecommendationCard,
  CurriculumProgressCard,
} from '../../components/mentaltraining';
import { TrialType } from '../../api/firebase/mentaltraining/taxonomy';

interface AthleteWithProgress {
  id: string;
  displayName?: string;
  username?: string;
  email?: string;
  profileImageURL?: string;
  streak?: MentalTrainingStreak;
  pendingAssignments: number;
  completedThisWeek: number;
  mentalProgress?: AthleteMentalProgress;
  curriculumAssignment?: CurriculumAssignment;
  latestSessionCompletion?: ExerciseCompletion;
}

type TabType = 'recommendations' | 'athletes' | 'exercises' | 'assignments';

function humanizeTaxonomyLabel(value: string): string {
  return value.split('_').join(' ');
}

function humanizeRuntimeLabel(value?: string | null): string {
  if (!value) return 'Nora task';
  return value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function athleteNeedsBaseline(athlete: AthleteWithProgress): boolean {
  return athlete.mentalProgress?.assessmentNeeded !== false;
}

function getTransferReadinessLabel(value?: string | null): string {
  switch (value) {
    case 'strong_transfer':
      return 'Strong transfer';
    case 'emerging_transfer':
      return 'Emerging transfer';
    case 'needs_transfer_work':
      return 'Needs transfer work';
    default:
      return 'Awaiting baseline';
  }
}

function getTransferReadinessTone(value?: string | null): string {
  switch (value) {
    case 'strong_transfer':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'emerging_transfer':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case 'needs_transfer_work':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    default:
      return 'border-zinc-700 bg-zinc-800/80 text-zinc-300';
  }
}

function getDailyAssignmentStatusLabel(status: PulseCheckDailyAssignmentStatus): string {
  switch (status) {
    case PulseCheckDailyAssignmentStatus.Assigned:
      return 'Assigned';
    case PulseCheckDailyAssignmentStatus.Viewed:
      return 'Viewed';
    case PulseCheckDailyAssignmentStatus.Started:
      return 'Started';
    case PulseCheckDailyAssignmentStatus.Completed:
      return 'Completed';
    case PulseCheckDailyAssignmentStatus.Overridden:
      return 'Coach overridden';
    case PulseCheckDailyAssignmentStatus.Deferred:
      return 'Deferred';
    case PulseCheckDailyAssignmentStatus.Superseded:
      return 'Superseded';
    default:
      return 'Assigned';
  }
}

function getDailyAssignmentStatusTone(status: PulseCheckDailyAssignmentStatus): string {
  switch (status) {
    case PulseCheckDailyAssignmentStatus.Assigned:
      return 'border-[#E0FE10]/30 bg-[#E0FE10]/10 text-[#E0FE10]';
    case PulseCheckDailyAssignmentStatus.Viewed:
      return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
    case PulseCheckDailyAssignmentStatus.Started:
      return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    case PulseCheckDailyAssignmentStatus.Completed:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    case PulseCheckDailyAssignmentStatus.Overridden:
      return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
    case PulseCheckDailyAssignmentStatus.Deferred:
      return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
    case PulseCheckDailyAssignmentStatus.Superseded:
      return 'border-zinc-700 bg-zinc-800/80 text-zinc-300';
    default:
      return 'border-zinc-700 bg-zinc-800/80 text-zinc-300';
  }
}

function getDailyAssignmentActionLabel(assignment: PulseCheckDailyAssignment): string {
  if (assignment.actionType === 'defer') {
    return 'Defer';
  }

  if (assignment.simSpecId) {
    return humanizeRuntimeLabel(assignment.simSpecId);
  }

  if (assignment.legacyExerciseId) {
    return humanizeRuntimeLabel(assignment.legacyExerciseId);
  }

  if (assignment.sessionType) {
    return humanizeRuntimeLabel(assignment.sessionType);
  }

  return assignment.actionType === 'lighter_sim' ? 'Lighter sim' : 'Sim';
}

const CoachMentalTraining: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();

  const [coachProfile, setCoachProfile] = useState<CoachModel | null>(null);
  const [athletes, setAthletes] = useState<AthleteWithProgress[]>([]);
  const [exercises, setExercises] = useState<SimModule[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<SimAssignment[]>([]);
  const [recentVisionProSessions, setRecentVisionProSessions] = useState<VisionProTrialSession[]>([]);

  // Curriculum state
  const [recommendations, setRecommendations] = useState<MentalRecommendation[]>([]);
  const [curriculumAssignments, setCurriculumAssignments] = useState<CurriculumAssignment[]>([]);
  const [noraDailyAssignments, setNoraDailyAssignments] = useState<PulseCheckDailyAssignment[]>([]);
  const [generatingRecommendations, setGeneratingRecommendations] = useState(false);
  const [actioningRecommendation, setActioningRecommendation] = useState<string | null>(null);
  const [actioningDailyAssignment, setActioningDailyAssignment] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<TabType>('recommendations');
  const [playingExercise, setPlayingExercise] = useState<SimModule | null>(null);
  const [queueingVisionProKey, setQueueingVisionProKey] = useState<string | null>(null);
  const autoGeneratedRecsRef = useRef(false);
  const assignmentsTabTopRef = useRef<HTMLDivElement | null>(null);

  // Simple local toast (coach pages don't consistently use a shared toast layer)
  const [toast, setToast] = useState<{
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((t: { message: string; actionLabel?: string; onAction?: () => void }) => {
    setToast(t);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  const assignedAthleteIds = new Set<string>([
    ...curriculumAssignments.map(a => a.athleteId),
    ...athletes.filter(a => !!a.curriculumAssignment).map(a => a.id),
  ]);

  const visibleRecommendations = recommendations.filter(r => !assignedAthleteIds.has(r.athleteId));

  const refreshNoraDailyAssignments = useCallback(async (coachId: string) => {
    const assignments = await assignmentOrchestratorService.listRecentForCoach(coachId, 24);
    setNoraDailyAssignments(assignments);
  }, []);

  useEffect(() => {
    if (!router.isReady) return;

    const tab = router.query.tab;
    if (tab === 'recommendations' || tab === 'athletes' || tab === 'exercises' || tab === 'assignments') {
      setActiveTab(tab);
    }
  }, [router.isReady, router.query.tab]);

  // Load coach profile and data
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.id) return;

      setLoading(true);
      try {
        // Get coach profile
        const profile = await coachService.getCoachProfile(currentUser.id);
        setCoachProfile(profile);

        if (profile) {
          // Get connected athletes
          const connectedAthletes = await coachService.getConnectedAthletes(profile.id);

          // Load progress for each athlete including curriculum data
          const athletesWithProgress: AthleteWithProgress[] = await Promise.all(
            connectedAthletes.map(async (athlete: any) => {
              try {
                const athleteId = athlete.id || athlete.userId;
                const [streak, assignments, mentalProgress, curriculumAssignment, latestSessionCompletion] = await Promise.all([
                  completionService.getStreak(athleteId),
                  assignmentService.getForAthleteByCoach(athleteId, profile.id),
                  athleteProgressService.get(athleteId),
                  curriculumAssignmentService.getActiveForAthlete(athleteId),
                  completionService.getLatestCompletion(athleteId),
                ]);

                const pending = assignments.filter(
                  a => a.status === AssignmentStatus.Pending || a.status === AssignmentStatus.InProgress
                ).length;

                const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const completedThisWeek = assignments.filter(
                  a => a.status === AssignmentStatus.Completed && a.completedAt && a.completedAt > weekAgo
                ).length;

                return {
                  id: athleteId,
                  displayName: athlete.displayName,
                  username: athlete.username,
                  email: athlete.email,
                  profileImageURL: athlete.profileImage?.profileImageURL || athlete.profileImageURL,
                  streak,
                  pendingAssignments: pending,
                  completedThisWeek,
                  mentalProgress: mentalProgress || undefined,
                  curriculumAssignment: curriculumAssignment || undefined,
                  latestSessionCompletion: latestSessionCompletion || undefined,
                };
              } catch {
                return {
                  id: athlete.id || athlete.userId,
                  displayName: athlete.displayName,
                  username: athlete.username,
                  email: athlete.email,
                  profileImageURL: athlete.profileImage?.profileImageURL || athlete.profileImageURL,
                  pendingAssignments: 0,
                  completedThisWeek: 0,
                };
              }
            })
          );

          setAthletes(athletesWithProgress);

          const [assignments, recs, currAssignments, visionProSessionSnap, dailyAssignments] = await Promise.all([
            assignmentService.getByCoach(profile.id),
            recommendationService.getPendingForCoach(profile.id),
            curriculumAssignmentService.getActiveForCoach(profile.id),
            getDocs(
              query(
                collection(db, 'vision-pro-trial-sessions'),
                where('createdByUserId', '==', profile.id),
                limit(20)
              )
            ),
            assignmentOrchestratorService.listRecentForCoach(profile.id, 24),
          ]);

          setRecentAssignments(assignments.slice(0, 20));
          setRecommendations(recs);
          setCurriculumAssignments(currAssignments);
          setNoraDailyAssignments(dailyAssignments);
          setRecentVisionProSessions(
            visionProSessionSnap.docs
              .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as VisionProTrialSession))
              .sort((left, right) => (right.completedAt || right.createdAt || 0) - (left.completedAt || left.createdAt || 0))
              .slice(0, 12)
          );
        }

        // Load exercise library
        const exerciseData = await simModuleLibraryService.getAll();
        setExercises(exerciseData);

      } catch (err) {
        console.error('Failed to load coach data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser?.id]);

  // Listen to recommendations in real-time
  useEffect(() => {
    if (!coachProfile?.id) return;

    const unsubscribe = recommendationService.listenToPendingForCoach(
      coachProfile.id,
      (recs) => setRecommendations(recs)
    );

    return () => unsubscribe();
  }, [coachProfile?.id]);

  // Generate recommendations for eligible athletes + prune stale ones
  // `showResultToast` should be true only for explicit user-triggered updates (button click).
  const handleGenerateRecommendations = useCallback(async (showResultToast: boolean = false) => {
    if (!coachProfile?.id || athletes.length === 0) return;

    setGeneratingRecommendations(true);
    try {
      // Refresh assignments first (source of truth), then prune stale recs for already-assigned athletes.
      const freshAssignments = await curriculumAssignmentService.getActiveForCoach(coachProfile.id);
      setCurriculumAssignments(freshAssignments);
      const freshAssignedIds = new Set(freshAssignments.map(a => a.athleteId));

      const staleRecs = recommendations.filter(r => freshAssignedIds.has(r.athleteId));
      if (staleRecs.length > 0) {
        // Optimistic UI: remove immediately; realtime listener will confirm.
        setRecommendations(prev => prev.filter(r => !freshAssignedIds.has(r.athleteId)));
        await Promise.all(
          staleRecs.map(r =>
            recommendationService.dismiss(
              r.id,
              'Auto-dismissed: athlete already has an active assignment.'
            )
          )
        );
      }

      // Only generate for athletes who do NOT already have an active curriculum assignment
      // and do NOT already have a pending recommendation.
      const pendingByAthlete = new Set(recommendations.map(r => r.athleteId));
      const assignedByAthlete = new Set(freshAssignments.map(a => a.athleteId));
      const athleteIds = athletes
        .filter(a => !a.curriculumAssignment && !assignedByAthlete.has(a.id))
        .filter(a => !pendingByAthlete.has(a.id))
        .map(a => a.id);

      if (athleteIds.length === 0) {
        console.log('No athletes eligible for new recommendations (already assigned or already pending).');
        if (showResultToast) {
          showToast({ message: 'No new recommendations right now.' });
        }
        return;
      }

      const newRecs = await recommendationService.generateForAllAthletes(coachProfile.id, athleteIds);
      // Real-time listener will update the state
      console.log(`Generated ${newRecs.length} new recommendations`);
      if (showResultToast) {
        if (newRecs.length > 0) {
          showToast({ message: `New recommendations to consider (${newRecs.length}).` });
        } else {
          showToast({ message: 'No new recommendations right now.' });
        }
      }
    } catch (err) {
      console.error('Failed to generate recommendations:', err);
      if (showResultToast) {
        showToast({ message: 'Failed to update recommendations. Check console for details.' });
      }
    } finally {
      setGeneratingRecommendations(false);
    }
  }, [coachProfile?.id, athletes, recommendations, curriculumAssignments, showToast]);

  // Auto-generate recommendations when the tab is opened (no extra button press)
  useEffect(() => {
    if (activeTab !== 'recommendations') return;
    if (!coachProfile?.id) return;
    if (generatingRecommendations) return;
    if (autoGeneratedRecsRef.current) return;
    if (athletes.length === 0) return;

    // If we already have recs, don't auto-generate (but mark as done for this session).
    if (recommendations.length > 0) {
      autoGeneratedRecsRef.current = true;
      return;
    }

    autoGeneratedRecsRef.current = true;
    handleGenerateRecommendations(false);
  }, [activeTab, coachProfile?.id, athletes.length, recommendations.length, generatingRecommendations, handleGenerateRecommendations]);

  // Handle accepting a recommendation
  const handleAcceptRecommendation = useCallback(async (recommendationId: string) => {
    const recommendation = recommendations.find(r => r.id === recommendationId);
    if (!recommendation || !coachProfile?.id) return;

    setActioningRecommendation(recommendationId);
    try {
      const athlete = athletes.find(a => a.id === recommendation.athleteId);
      const athleteName = athlete?.displayName || athlete?.username || 'athlete';

      // Create curriculum assignment from recommendation
      const createdAssignment = await curriculumAssignmentService.create({
        athleteId: recommendation.athleteId,
        coachId: coachProfile.id,
        exerciseId: recommendation.exerciseId,
        recommendationId: recommendation.id,
        pathway: recommendation.pathway,
        pathwayStep: recommendation.pathwayStep,
      });

      // Mark recommendation as accepted
      await recommendationService.accept(recommendationId);
      // Optimistic UI: remove the accepted recommendation immediately
      setRecommendations(prev => prev.filter(r => r.id !== recommendationId));

      // Update athlete's active assignment
      await athleteProgressService.setActiveAssignment(
        recommendation.athleteId,
        createdAssignment.id,
        createdAssignment.exercise?.name || recommendation.exercise?.name || 'Exercise'
      );

      // Reload curriculum assignments
      const currAssignments = await curriculumAssignmentService.getActiveForCoach(coachProfile.id);
      setCurriculumAssignments(currAssignments);

      // Update local athlete state so Refresh won't think this athlete is eligible again
      setAthletes(prev =>
        prev.map(a => (a.id === createdAssignment.athleteId ? { ...a, curriculumAssignment: createdAssignment } : a))
      );

      // Feedback: toast + optional action to jump to assignments tab
      const exerciseName =
        createdAssignment.exercise?.name || recommendation.exercise?.name || 'exercise';
      showToast({
        message: `Assigned ${exerciseName} to ${athleteName}.`,
        actionLabel: 'Switch to Assignments',
        onAction: () => {
          setActiveTab('assignments');
          // scroll after tab render
          window.setTimeout(() => {
            assignmentsTabTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        },
      });
    } catch (err) {
      console.error('Failed to accept recommendation:', err);
      showToast({
        message: 'Failed to assign. Check console for details.',
      });
    } finally {
      setActioningRecommendation(null);
    }
  }, [recommendations, coachProfile?.id, athletes, showToast]);

  // When viewing the Assignments tab, refresh active curriculum assignments (so the tab never looks stale)
  useEffect(() => {
    if (activeTab !== 'assignments') return;
    if (!coachProfile?.id) return;
    Promise.all([
      curriculumAssignmentService.getActiveForCoach(coachProfile.id),
      assignmentOrchestratorService.listRecentForCoach(coachProfile.id, 24),
    ])
      .then(([currAssignments, dailyAssignments]) => {
        setCurriculumAssignments(currAssignments);
        setNoraDailyAssignments(dailyAssignments);
      })
      .catch((err) => console.error('Failed to refresh coach assignments:', err));
  }, [activeTab, coachProfile?.id]);

  // Handle modifying a recommendation
  const handleModifyRecommendation = useCallback(async (recommendationId: string) => {
    const recommendation = recommendations.find(r => r.id === recommendationId);
    if (!recommendation) return;

    // Open assign modal with the recommendation's exercise pre-selected
    setSelectedAthleteId(recommendation.athleteId);
    setShowAssignModal(true);
  }, [recommendations]);

  // Handle dismissing a recommendation
  const handleDismissRecommendation = useCallback(async (recommendationId: string, reason: string) => {
    setActioningRecommendation(recommendationId);
    try {
      await recommendationService.dismiss(recommendationId, reason);
    } catch (err) {
      console.error('Failed to dismiss recommendation:', err);
    } finally {
      setActioningRecommendation(null);
    }
  }, []);

  // Filter athletes
  const filteredAthletes = athletes.filter(
    a =>
    (a.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Stats
  const totalAthletes = athletes.length;
  const totalPending = athletes.reduce((sum, a) => sum + a.pendingAssignments, 0);
  const totalCompletedThisWeek = athletes.reduce((sum, a) => sum + a.completedThisWeek, 0);
  const activeStreaks = athletes.filter(a => a.streak && a.streak.currentStreak > 0).length;
  const pendingRecommendations = visibleRecommendations.length;
  const activeCurriculumAssignments = curriculumAssignments.length;
  const activeDailyAssignments = noraDailyAssignments.filter((assignment) =>
    assignment.status === PulseCheckDailyAssignmentStatus.Assigned ||
    assignment.status === PulseCheckDailyAssignmentStatus.Viewed ||
    assignment.status === PulseCheckDailyAssignmentStatus.Started
  ).length;
  const profiledAthletes = athletes.filter(a => a.mentalProgress?.taxonomyProfile);
  const averagePulseCheckScore =
    profiledAthletes.length > 0
      ? Math.round(
          profiledAthletes.reduce(
            (sum, athlete) => sum + (athlete.mentalProgress?.taxonomyProfile?.overallScore ?? 0),
            0
          ) / profiledAthletes.length
        )
      : null;
  const lowReadinessCount = profiledAthletes.filter(
    a => (a.mentalProgress?.taxonomyProfile?.modifierScores.readiness ?? 100) < 50
  ).length;
  const recentSessionUpdates = [...athletes]
    .filter((athlete) => athlete.latestSessionCompletion?.sessionSummary)
    .sort(
      (left, right) =>
        (right.latestSessionCompletion?.completedAt || 0) - (left.latestSessionCompletion?.completedAt || 0)
    )
    .slice(0, 6);

  const handleAssignToAthlete = (athleteId: string) => {
    const athlete = athletes.find((entry) => entry.id === athleteId);
    if (athlete && athleteNeedsBaseline(athlete)) {
      showToast({
        message: `${athlete.displayName || athlete.username || 'This athlete'} still needs baseline tasks before standard sim assignment.`,
      });
      return;
    }

    setSelectedAthleteId(athleteId);
    setShowAssignModal(true);
  };

  const handleAssignToAll = () => {
    setSelectedAthleteId(undefined);
    setShowAssignModal(true);
  };

  const openManualAssignmentForAthlete = useCallback((athleteId: string) => {
    setSelectedAthleteId(athleteId);
    setShowAssignModal(true);
  }, []);

  const handleOverrideDailyAssignment = useCallback(async (assignmentId: string) => {
    if (!currentUser?.id || !coachProfile?.id) return;

    const assignment = noraDailyAssignments.find((entry) => entry.id === assignmentId);
    if (!assignment) return;

    setActioningDailyAssignment(assignmentId);
    try {
      await assignmentOrchestratorService.overrideAssignment({
        id: assignmentId,
        overriddenBy: currentUser.id,
        reason: 'Coach manually overrode Nora auto-assignment.',
      });

      await refreshNoraDailyAssignments(coachProfile.id);
      showToast({
        message: 'Nora task marked overridden for today.',
        actionLabel: 'Replace Now',
        onAction: () => openManualAssignmentForAthlete(assignment.athleteId),
      });
    } catch (error) {
      console.error('Failed to override Nora daily assignment:', error);
      showToast({ message: 'Failed to override Nora task. Check console for details.' });
    } finally {
      setActioningDailyAssignment(null);
    }
  }, [currentUser?.id, coachProfile?.id, noraDailyAssignments, refreshNoraDailyAssignments, showToast, openManualAssignmentForAthlete]);

  const handleDeferDailyAssignment = useCallback(async (assignmentId: string) => {
    if (!currentUser?.id || !coachProfile?.id) return;

    setActioningDailyAssignment(assignmentId);
    try {
      await assignmentOrchestratorService.deferAssignment({
        id: assignmentId,
        overriddenBy: currentUser.id,
        reason: 'Coach deferred today\'s Nora auto-assignment.',
      });

      await refreshNoraDailyAssignments(coachProfile.id);
      showToast({ message: 'Today\'s Nora task was deferred.' });
    } catch (error) {
      console.error('Failed to defer Nora daily assignment:', error);
      showToast({ message: 'Failed to defer Nora task. Check console for details.' });
    } finally {
      setActioningDailyAssignment(null);
    }
  }, [currentUser?.id, coachProfile?.id, refreshNoraDailyAssignments, showToast]);

  const handleQueueVisionPro = useCallback(async ({
    assignmentId,
    assignmentCollection,
    athleteUserId,
    athleteName,
    simId,
    simName,
    profileSnapshotMilestone,
  }: {
    assignmentId: string;
    assignmentCollection: typeof VISION_PRO_CURRICULUM_ASSIGNMENTS_COLLECTION | typeof VISION_PRO_LEGACY_ASSIGNMENTS_COLLECTION;
    athleteUserId: string;
    athleteName: string;
    simId?: string;
    simName?: string;
    profileSnapshotMilestone?: SimAssignment['profileSnapshotMilestone'];
  }) => {
    if (!coachProfile?.id) return;

    if (!auth.currentUser) {
      showToast({ message: 'Sign in again before queueing a Vision Pro trial.' });
      return;
    }

    const queueKey = `${assignmentCollection}:${assignmentId}`;
    setQueueingVisionProKey(queueKey);

    try {
      const session = await visionProTrialService.createSession({
        assignmentId,
        assignmentCollection,
        athleteUserId,
        simId,
        simName,
        createdByName: currentUser?.displayName || currentUser?.username || 'Coach',
        trialType: profileSnapshotMilestone ? TrialType.ImmersiveTransfer : undefined,
        profileSnapshotMilestone,
      });

      showToast({
        message: `Queued ${session.simName} on Vision Pro for ${athleteName}.`,
        actionLabel: 'View Assignments',
        onAction: () => {
          setActiveTab('assignments');
          window.setTimeout(() => {
            assignmentsTabTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        },
      });
    } catch (error) {
      console.error('Failed to queue Vision Pro trial:', error);
      showToast({
        message: error instanceof Error
          ? error.message
          : 'Failed to queue Vision Pro trial. Check console for details.',
      });
    } finally {
      setQueueingVisionProKey(null);
    }
  }, [coachProfile?.id, currentUser?.displayName, currentUser?.username, showToast]);

  const getCategoryIcon = (category: ExerciseCategory) => {
    switch (category) {
      case ExerciseCategory.Breathing: return <Wind className="w-4 h-4" />;
      case ExerciseCategory.Visualization: return <Eye className="w-4 h-4" />;
      case ExerciseCategory.Focus: return <Target className="w-4 h-4" />;
      case ExerciseCategory.Mindset: return <Brain className="w-4 h-4" />;
      case ExerciseCategory.Confidence: return <Star className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: AssignmentStatus) => {
    switch (status) {
      case AssignmentStatus.Completed: return 'text-green-400 bg-green-500/10';
      case AssignmentStatus.InProgress: return 'text-blue-400 bg-blue-500/10';
      case AssignmentStatus.Pending: return 'text-yellow-400 bg-yellow-500/10';
      case AssignmentStatus.Skipped: return 'text-zinc-400 bg-zinc-500/10';
      case AssignmentStatus.Expired: return 'text-red-400 bg-red-500/10';
      default: return 'text-zinc-400 bg-zinc-500/10';
    }
  };

  if (loading) {
    return (
      <CoachLayout>
        <Head><title>Mental Training | Coach Dashboard</title></Head>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-zinc-400">Loading mental training dashboard...</div>
        </div>
      </CoachLayout>
    );
  }

  return (
    <CoachLayout>
      <Head><title>Mental Training | Coach Dashboard</title></Head>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Brain className="w-8 h-8 text-[#E0FE10]" />
              Mental Training
            </h1>
            <p className="text-zinc-400 mt-1">
              Coach measurable execution under pressure with Nora
            </p>
          </div>

          <button
            onClick={handleAssignToAll}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] transition-colors"
          >
            <Plus className="w-5 h-5" />
            Assign Sim Module
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-zinc-400">Athletes</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalAthletes}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-5 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-zinc-400">Pending</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalPending}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-5 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-sm text-zinc-400">Completed This Week</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalCompletedThisWeek}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-5 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
          >
            <div className="flex items-center gap-3 mb-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-zinc-400">Active Streaks</span>
            </div>
            <p className="text-3xl font-bold text-white">{activeStreaks}</p>
          </motion.div>
        </div>

        {(averagePulseCheckScore !== null || lowReadinessCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="p-5 rounded-xl bg-[#E0FE10]/10 border border-[#E0FE10]/20">
              <p className="text-sm text-[#E0FE10] mb-2">Roster Pulse Check Score</p>
              <p className="text-3xl font-bold text-white">{averagePulseCheckScore ?? '--'}</p>
              <p className="text-sm text-zinc-400 mt-1">
                Average overall score across athletes with a taxonomy profile
              </p>
            </div>
            <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300 mb-2">Low Readiness Watchlist</p>
              <p className="text-3xl font-bold text-white">{lowReadinessCount}</p>
              <p className="text-sm text-zinc-400 mt-1">
                Athletes currently trending below 50 readiness
              </p>
            </div>
          </div>
        )}

        {recentSessionUpdates.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <FileBarChart2 className="h-5 w-5 text-emerald-300" />
              <h2 className="text-lg font-semibold text-white">Recent Athlete Session Updates</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {recentSessionUpdates.map((athlete) => {
                const completion = athlete.latestSessionCompletion;
                const summary = completion?.sessionSummary;
                if (!completion || !summary) return null;

                return (
                  <div key={athlete.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {athlete.displayName || athlete.username || 'Athlete'}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-300">
                          {summary.coachHeadline}
                        </p>
                      </div>
                      <div className="text-right text-xs text-zinc-400">
                        {new Date(completion.completedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-zinc-200">
                      {summary.coachBody}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                        Completed {summary.completedActionLabel}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                        Next {summary.nextActionLabel}
                      </span>
                      {summary.targetSkills.slice(0, 2).map((skill) => (
                        <span key={skill} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-zinc-700/50 pb-2 overflow-x-auto">
          {([
            { id: 'recommendations' as const, label: 'Nora Recommendations', badge: pendingRecommendations },
            { id: 'athletes' as const, label: 'Athletes', badge: 0 },
            { id: 'exercises' as const, label: 'Sim Modules', badge: 0 },
            { id: 'assignments' as const, label: 'Assignments', badge: activeCurriculumAssignments + activeDailyAssignments },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
                  ? 'bg-[#E0FE10] text-black'
                  : 'text-zinc-400 hover:bg-zinc-800'
                }`}
            >
              <span className="flex items-center gap-2">
                {tab.id === 'recommendations' && <Sparkles className="w-4 h-4" />}
                {tab.label}
                {tab.badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.id
                      ? 'bg-black/20 text-black'
                      : 'bg-[#E0FE10] text-black'
                    }`}>
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'recommendations' && (
          <div>
            {/* Header with generate button */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#E0FE10]" />
                  Nora&apos;s Recommendations
                </h2>
                <p className="text-zinc-400 mt-1">
                  AI-powered sim recommendations based on each athlete&apos;s progress and needs
                </p>
              </div>
              <button
                onClick={() => handleGenerateRecommendations(true)}
                disabled={generatingRecommendations || athletes.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 text-white font-medium hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${generatingRecommendations ? 'animate-spin' : ''}`} />
                {generatingRecommendations ? 'Updating...' : 'Update Recommendations'}
              </button>
            </div>

            {/* Recommendations List */}
            {visibleRecommendations.length === 0 ? (
              <div className="text-center py-16">
                <Sparkles className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
                <p className="text-zinc-400 mb-2">No pending recommendations</p>
                <p className="text-zinc-500 text-sm mb-6">
                  Click &quot;Update Recommendations&quot; to get personalized exercise recommendations for your athletes
                </p>
                <button
                  onClick={() => handleGenerateRecommendations(true)}
                  disabled={generatingRecommendations || athletes.length === 0}
                  className="px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] transition-colors disabled:opacity-50"
                >
                  Update Recommendations
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AnimatePresence>
                  {visibleRecommendations.map((rec) => {
                    const athlete = athletes.find(a => a.id === rec.athleteId);
                    return (
                      <RecommendationCard
                        key={rec.id}
                        recommendation={rec}
                        athleteName={athlete?.displayName || athlete?.username || 'Unknown Athlete'}
                        onAccept={handleAcceptRecommendation}
                        onModify={handleModifyRecommendation}
                        onDismiss={handleDismissRecommendation}
                        loading={actioningRecommendation === rec.id}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* Active Curriculum Assignments Section */}
            {curriculumAssignments.length > 0 && (
              <div className="mt-10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Active 14-Day Assignments ({curriculumAssignments.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {curriculumAssignments.map((assignment) => {
                    const athlete = athletes.find(a => a.id === assignment.athleteId);
                    return (
                      <CurriculumProgressCard
                        key={assignment.id}
                        assignment={assignment}
                        athleteProgress={athlete?.mentalProgress}
                        athleteName={athlete?.displayName || athlete?.username || 'Unknown Athlete'}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'athletes' && (
          <div>
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search athletes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-[#E0FE10] focus:outline-none"
              />
            </div>

            {/* Athletes List */}
            {filteredAthletes.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">
                {athletes.length === 0 ? 'No athletes connected yet' : 'No athletes match your search'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAthletes.map((athlete) => (
                  <motion.div
                    key={athlete.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                  >
                    {/* Avatar */}
                    {athlete.profileImageURL ? (
                      <img
                        src={athlete.profileImageURL}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
                        <span className="text-white font-medium text-lg">
                          {(athlete.displayName || athlete.username || 'A')[0].toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        {athlete.displayName || athlete.username || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-sm">
                        {athleteNeedsBaseline(athlete) && (
                          <span className="flex items-center gap-1 text-amber-300">
                            <Lock className="w-4 h-4" />
                            baseline required
                          </span>
                        )}
                        {athlete.streak && athlete.streak.currentStreak > 0 && (
                          <span className="flex items-center gap-1 text-orange-400">
                            <Flame className="w-4 h-4" />
                            {athlete.streak.currentStreak} day streak
                          </span>
                        )}
                        {athlete.pendingAssignments > 0 && (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Clock className="w-4 h-4" />
                            {athlete.pendingAssignments} pending
                          </span>
                        )}
                        {athlete.completedThisWeek > 0 && (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            {athlete.completedThisWeek} this week
                          </span>
                        )}
                      </div>

                      {athlete.mentalProgress?.taxonomyProfile && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-1 rounded-full bg-[#E0FE10]/10 text-[#E0FE10]">
                            Score {Math.round(athlete.mentalProgress.taxonomyProfile.overallScore)}
                          </span>
                          <span className="px-2 py-1 rounded-full bg-zinc-700 text-zinc-200 capitalize">
                            Bottleneck {humanizeTaxonomyLabel(athlete.mentalProgress.taxonomyProfile.weakestSkills[0] || 'calibrating')}
                          </span>
                          {athlete.mentalProgress.activeProgram && (
                            <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-300 capitalize">
                              Next {humanizeTaxonomyLabel(athlete.mentalProgress.activeProgram.recommendedSimId)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => handleAssignToAthlete(athlete.id)}
                      disabled={athleteNeedsBaseline(athlete)}
                      className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black font-medium hover:bg-[#c8e40e] transition-colors disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                    >
                      {athleteNeedsBaseline(athlete) ? 'Baseline Locked' : 'Assign'}
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'exercises' && (
          <div>
            <p className="text-zinc-400 mb-6">
              Browse the sim module library and assign modules to your athletes.
            </p>

            {exercises.length === 0 ? (
              <div className="text-center py-16">
                <Brain className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
                <p className="text-zinc-400 mb-6">
                  Sim module library is empty. Seed the default modules to get started.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const result = await simModuleLibraryService.seedExercises();
                      alert(`Seeded ${result.created} sim modules! (${result.skipped} already existed)`);
                      // Reload exercises
                      const exerciseData = await simModuleLibraryService.getAll();
                      setExercises(exerciseData);
                    } catch (err) {
                      console.error('Failed to seed exercises:', err);
                      alert('Failed to seed sim modules. Check console for details.');
                    }
                  }}
                  className="px-6 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] transition-colors"
                >
                  Seed Sim Module Library
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {exercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    showAssignButton
                    showPlayButton
                    onPlay={() => setPlayingExercise(exercise)}
                    onAssign={() => {
                      setSelectedAthleteId(undefined);
                      setShowAssignModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div>
            <div ref={assignmentsTabTopRef} />

            <p className="text-zinc-400 mb-6">
              Nora daily auto-assignments, active curriculum cycles, and recent legacy assignments.
            </p>

            <div className="mb-10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#E0FE10]" />
                Nora Daily Auto-Assignments ({noraDailyAssignments.length})
              </h3>

              {noraDailyAssignments.length === 0 ? (
                <div className="text-center py-10 rounded-xl bg-zinc-800/30 border border-zinc-700/50 text-zinc-400">
                  Nora has not auto-assigned any daily tasks for this coach yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {noraDailyAssignments.map((assignment) => {
                    const athlete = athletes.find((entry) => entry.id === assignment.athleteId);
                    const isActionable =
                      assignment.status === PulseCheckDailyAssignmentStatus.Assigned ||
                      assignment.status === PulseCheckDailyAssignmentStatus.Viewed;
                    const isBusy = actioningDailyAssignment === assignment.id;

                    return (
                      <div
                        key={assignment.id}
                        className="rounded-2xl border border-zinc-700/50 bg-zinc-900/70 p-5 space-y-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">Daily Nora Task</div>
                            <div className="mt-2 text-lg font-semibold text-white">
                              {athlete?.displayName || athlete?.username || 'Unknown Athlete'}
                            </div>
                            <div className="text-sm text-zinc-400 capitalize">
                              {getDailyAssignmentActionLabel(assignment)}
                            </div>
                          </div>
                          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getDailyAssignmentStatusTone(assignment.status)}`}>
                            {getDailyAssignmentStatusLabel(assignment.status)}
                          </div>
                        </div>

                        <div className="text-sm leading-6 text-zinc-300">
                          {assignment.rationale || 'Nora generated this task from the latest check-in and profile state.'}
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-zinc-300">
                            {assignment.sourceDate}
                          </span>
                          {assignment.readinessBand && (
                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-zinc-300 capitalize">
                              {assignment.readinessBand} readiness
                            </span>
                          )}
                          {assignment.sessionType && (
                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-zinc-300 capitalize">
                              {humanizeRuntimeLabel(assignment.sessionType)}
                            </span>
                          )}
                          {assignment.coachNotifiedAt && (
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                              Coach push sent
                            </span>
                          )}
                        </div>

                        {isActionable ? (
                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={() => handleOverrideDailyAssignment(assignment.id)}
                              disabled={isBusy}
                              className="px-4 py-2 rounded-xl bg-amber-500/15 text-amber-200 border border-amber-500/20 font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isBusy ? 'Saving...' : 'Override'}
                            </button>
                            <button
                              onClick={() => handleDeferDailyAssignment(assignment.id)}
                              disabled={isBusy}
                              className="px-4 py-2 rounded-xl bg-zinc-800 text-white border border-zinc-700 font-medium hover:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isBusy ? 'Saving...' : 'Defer Today'}
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm text-zinc-500">
                            {assignment.status === PulseCheckDailyAssignmentStatus.Overridden && 'Coach override is now the source of truth for today.'}
                            {assignment.status === PulseCheckDailyAssignmentStatus.Deferred && 'Today\'s Nora task is paused until a coach or later cycle creates the next step.'}
                            {assignment.status === PulseCheckDailyAssignmentStatus.Started && 'The athlete has already started this task, so Nora will not replace it automatically.'}
                            {assignment.status === PulseCheckDailyAssignmentStatus.Completed && 'This task is already complete.'}
                            {assignment.status === PulseCheckDailyAssignmentStatus.Superseded && 'A newer daily task replaced this assignment.'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mb-10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileBarChart2 className="w-5 h-5 text-cyan-300" />
                Recent Vision Pro Transfer Reports ({recentVisionProSessions.length})
              </h3>

              {recentVisionProSessions.length === 0 ? (
                <div className="text-center py-10 rounded-xl bg-zinc-800/30 border border-zinc-700/50 text-zinc-400">
                  No Vision Pro sessions have been completed by this coach yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {recentVisionProSessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-2xl border border-zinc-700/50 bg-zinc-900/70 p-5 space-y-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">Vision Pro Session</div>
                          <div className="mt-2 text-lg font-semibold text-white">
                            {session.athleteDisplayName || session.athleteUserId}
                          </div>
                          <div className="text-sm text-zinc-400">{session.simName}</div>
                        </div>
                        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getTransferReadinessTone(session.reportSummary?.transferReadiness)}`}>
                          {getTransferReadinessLabel(session.reportSummary?.transferReadiness)}
                        </div>
                      </div>

                      <div className="text-sm text-zinc-300">
                        {session.reportSummary?.coachHeadline || 'Coach-facing Vision Pro summary will appear here after the session is scored.'}
                      </div>

                      {session.reportSummary?.coachBody ? (
                        <div className="text-sm leading-6 text-zinc-400">{session.reportSummary.coachBody}</div>
                      ) : null}

                      {session.reportSummary?.familyCards?.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {session.reportSummary.familyCards.map((card, index) => (
                            <div key={`${session.id}-${card.family || index}`} className="rounded-xl border border-white/8 bg-black/20 p-3">
                              <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">{card.label || card.family || 'Family'}</div>
                              <div className="mt-2 text-sm font-semibold text-white">{card.trialName || 'Vision Pro trial'}</div>
                              <div className="mt-1 text-xs text-zinc-400">{card.metricName || 'Core metric'}</div>
                              <div className="mt-3 text-xs text-zinc-400">
                                Gap: {typeof card.transferGap === 'number' ? card.transferGap.toFixed(2) : 'n/a'} • {card.interpretation || 'awaiting_baseline'}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                        <span>Status: {session.status}</span>
                        <span>Outcome: {session.sessionOutcome || 'n/a'}</span>
                        <span>{new Date(session.completedAt || session.createdAt || Date.now()).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Curriculum Assignments */}
            <div className="mb-10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Active 14-Day Assignments ({curriculumAssignments.length})
              </h3>

              {curriculumAssignments.length === 0 ? (
                <div className="text-center py-10 rounded-xl bg-zinc-800/30 border border-zinc-700/50">
                  <p className="text-zinc-400 mb-2">No active curriculum assignments yet.</p>
                  <p className="text-zinc-500 text-sm mb-5">
                    Assign from the Nora Recommendations tab, or use “Assign Sim Module” to manually assign.
                  </p>
                  <button
                    onClick={() => setActiveTab('recommendations')}
                    className="px-5 py-2.5 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#c8e40e] transition-colors"
                  >
                    Go to Nora Recommendations
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {curriculumAssignments.map((assignment) => {
                    const athlete = athletes.find(a => a.id === assignment.athleteId);
                    const queueKey = `${VISION_PRO_CURRICULUM_ASSIGNMENTS_COLLECTION}:${assignment.id}`;
                    return (
                      <div key={assignment.id} className="space-y-3">
                        <CurriculumProgressCard
                          assignment={assignment}
                          athleteProgress={athlete?.mentalProgress}
                          athleteName={athlete?.displayName || athlete?.username || 'Unknown Athlete'}
                        />
                        <button
                          onClick={() => handleQueueVisionPro({
                            assignmentId: assignment.id,
                            assignmentCollection: VISION_PRO_CURRICULUM_ASSIGNMENTS_COLLECTION,
                            athleteUserId: assignment.athleteId,
                            athleteName: athlete?.displayName || athlete?.username || 'Unknown Athlete',
                            simId: assignment.simSpecId || assignment.exercise?.simSpecId || assignment.exerciseId,
                            simName: assignment.exercise?.name,
                          })}
                          disabled={queueingVisionProKey === queueKey}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-medium hover:border-[#E0FE10]/40 hover:text-[#E0FE10] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ScanLine className="w-4 h-4" />
                          {queueingVisionProKey === queueKey ? 'Queueing…' : 'Queue on Vision Pro'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legacy Assignments (older system) */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Recent Legacy Assignments
              </h3>

              {recentAssignments.length === 0 ? (
                <div className="text-center py-10 rounded-xl bg-zinc-800/30 border border-zinc-700/50 text-zinc-400">
                  No legacy assignments yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentAssignments.map((assignment) => {
                    const athlete = athletes.find(a => a.id === assignment.athleteUserId);
                    const queueKey = `${VISION_PRO_LEGACY_ASSIGNMENTS_COLLECTION}:${assignment.id}`;
                    return (
                      <div
                        key={assignment.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50"
                      >
                        {/* Exercise icon */}
                        <div className="p-2.5 rounded-xl bg-zinc-700/50">
                          {assignment.exercise && getCategoryIcon(assignment.exercise.category)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white">
                            {assignment.exercise?.name || 'Unknown Exercise'}
                          </p>
                          <p className="text-sm text-zinc-400">
                            Assigned to {athlete?.displayName || athlete?.username || 'Unknown'}
                          </p>
                        </div>

                        {/* Status */}
                        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(assignment.status)}`}>
                          {assignment.status.replace('_', ' ')}
                        </span>

                        {/* Date */}
                        <span className="text-sm text-zinc-500">
                          {new Date(assignment.createdAt).toLocaleDateString()}
                        </span>

                        <button
                          onClick={() => handleQueueVisionPro({
                            assignmentId: assignment.id,
                            assignmentCollection: VISION_PRO_LEGACY_ASSIGNMENTS_COLLECTION,
                            athleteUserId: assignment.athleteUserId,
                            athleteName: athlete?.displayName || athlete?.username || 'Unknown Athlete',
                            simId: assignment.exercise?.simSpecId || assignment.exerciseId,
                            simName: assignment.exercise?.name,
                            profileSnapshotMilestone: assignment.profileSnapshotMilestone,
                          })}
                          disabled={queueingVisionProKey === queueKey}
                          className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm font-medium hover:border-[#E0FE10]/40 hover:text-[#E0FE10] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ScanLine className="w-4 h-4" />
                          {queueingVisionProKey === queueKey ? 'Queueing…' : 'Queue on Vision Pro'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      <AssignExerciseModal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedAthleteId(undefined);
        }}
        athletes={athletes.map((athlete) => ({
          ...athlete,
          assignmentLocked: athleteNeedsBaseline(athlete),
          assignmentLockReason: athleteNeedsBaseline(athlete)
            ? 'Baseline tasks must finish before standard sim assignment.'
            : undefined,
        }))}
        coachId={coachProfile?.id || currentUser?.id || ''}
        coachName={currentUser?.displayName || currentUser?.username}
        preSelectedAthleteId={selectedAthleteId}
        onAssignmentComplete={() => {
          // Reload assignments
          if (coachProfile) {
            assignmentService.getByCoach(coachProfile.id).then(a => setRecentAssignments(a.slice(0, 20)));
            refreshNoraDailyAssignments(coachProfile.id).catch((err) =>
              console.error('Failed to refresh Nora daily assignments after manual assign:', err)
            );
          }
        }}
      />

      {/* Exercise Player (Preview Mode) */}
      {playingExercise && (
        <ExercisePlayer
          exercise={playingExercise}
          previewMode
          onClose={() => setPlayingExercise(null)}
          onComplete={(data) => {
            console.log('Exercise preview completed:', data);
            setPlayingExercise(null);
          }}
          onStartInChat={(exercise) => {
            // For coaches previewing, redirect to PulseCheck chat with exercise
            localStorage.setItem('pulsecheck_active_exercise', JSON.stringify(exercise));
            router.push(`/PulseCheck?exercise=${encodeURIComponent(JSON.stringify(exercise))}`);
          }}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 right-6 z-[100] max-w-sm"
          >
            <div className="rounded-2xl bg-zinc-900/90 border border-white/10 backdrop-blur-xl px-4 py-3 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E0FE10]/15 border border-[#E0FE10]/20 flex items-center justify-center mt-0.5">
                  <CheckCircle className="w-4 h-4 text-[#E0FE10]" />
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{toast.message}</div>
                  {toast.actionLabel && toast.onAction && (
                    <button
                      onClick={() => {
                        toast.onAction?.();
                        setToast(null);
                      }}
                      className="mt-2 text-sm font-semibold text-[#E0FE10] hover:text-[#c8e40e] transition-colors"
                    >
                      {toast.actionLabel}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setToast(null)}
                  className="text-zinc-400 hover:text-white transition-colors"
                  aria-label="Dismiss"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CoachLayout>
  );
};

export default CoachMentalTraining;
