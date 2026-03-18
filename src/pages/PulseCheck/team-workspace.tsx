import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Bell, Brain, CheckCircle2, ChevronRight, ClipboardList, Copy, Loader2, Lock, Mail, ScanLine, Shield, Sparkles, UserRound, Users, Waves, XCircle } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { coachService } from '../../api/firebase/coach';
import { resolvePulseCheckAthleteTaskState } from '../../api/firebase/pulsecheckProvisioning/athleteTaskState';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type {
  PulseCheckInviteLink,
  PulseCheckInvitePolicy,
  PulseCheckOperatingRole,
  PulseCheckOrganization,
  PulseCheckRosterVisibilityScope,
  PulseCheckTeam,
  PulseCheckTeamMembership,
  PulseCheckTeamMembershipRole,
} from '../../api/firebase/pulsecheckProvisioning/types';
import { db } from '../../api/firebase/config';
import {
  assignmentOrchestratorService,
  assignmentService,
  athleteProgressService,
  PulseCheckDailyAssignmentStatus,
} from '../../api/firebase/mentaltraining';
import type { AthleteMentalProgress, PulseCheckDailyAssignment } from '../../api/firebase/mentaltraining/types';
import { BaselineAssessmentModal } from '../../components/mentaltraining';
import { userService } from '../../api/firebase/user';
import type { User } from '../../api/firebase/user';
import { useUser, useUserLoading } from '../../hooks/useUser';

// ─── Chromatic Glass Primitives ───────────────────────────────────────────────
const FloatingOrb: React.FC<{ color: string; size: string; style: React.CSSProperties; delay?: number }> = ({ color, size, style, delay = 0 }) => (
  <motion.div
    className={`absolute ${size} rounded-full blur-3xl pointer-events-none`}
    style={{ backgroundColor: color, ...style }}
    animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.38, 0.2] }}
    transition={{ duration: 10, repeat: Infinity, delay, ease: 'easeInOut' }}
  />
);

const GlassCard: React.FC<{ children: React.ReactNode; accentColor?: string; className?: string; delay?: number; animate?: boolean }> = ({
  children, accentColor = '#E0FE10', className = '', delay = 0, animate = true,
}) => {
  const inner = (
    <div className={`relative group ${className}`}>
      <div className="absolute -inset-1 rounded-[30px] blur-xl opacity-0 group-hover:opacity-25 transition-all duration-700 pointer-events-none" style={{ background: `linear-gradient(135deg, ${accentColor}50, transparent 60%)` }} />
      <div className="relative rounded-[30px] overflow-hidden backdrop-blur-xl bg-zinc-900/40 border border-white/10">
        <div className="absolute top-0 left-0 right-0 h-[1px] opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
        {children}
      </div>
    </div>
  );
  if (!animate) return inner;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}>
      {inner}
    </motion.div>
  );
};

const InfoCard: React.FC<{ icon: React.ReactNode; title: string; accentColor?: string; children: React.ReactNode; delay?: number }> = ({
  icon, title, accentColor = '#E0FE10', children, delay = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    className="rounded-[22px] border border-white/8 bg-black/20 p-5 backdrop-blur-sm"
    style={{ borderColor: `${accentColor}18` }}
  >
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
        {icon}
      </div>
      <span className="text-base font-semibold text-white">{title}</span>
    </div>
    {children}
  </motion.div>
);

type TeamMemberView = {
  membership: PulseCheckTeamMembership;
  user: User | null;
};

type AthleteRosterEntry = {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl: string;
  onboardingStatus: string;
  workoutCount?: number;
  conversationCount?: number;
  lastActiveDate?: Date | null;
  consentReady: boolean;
  baselineReady: boolean;
  source: 'team-membership' | 'legacy-coach-bridge';
};

type VisionProTaskState = 'not-queued' | 'queued' | 'completed';

const todayDateKey = () => new Date().toISOString().split('T')[0];

const humanizeDailyTaskLabel = (assignment: PulseCheckDailyAssignment | null) => {
  if (!assignment) return null;
  if (assignment.actionType === 'defer') return 'Coach review in progress';
  if (assignment.simSpecId) return assignment.simSpecId.split('_').join(' ');
  if (assignment.protocolLabel) return assignment.protocolLabel;
  if (assignment.legacyExerciseId) return assignment.legacyExerciseId.split('_').join(' ');
  if (assignment.sessionType) return assignment.sessionType.split('_').join(' ');
  if (assignment.actionType === 'lighter_sim') return 'lighter sim';
  if (assignment.actionType === 'protocol') return 'protocol';
  return 'sim';
};

const dailyTaskStatusLabel = (status: PulseCheckDailyAssignmentStatus) => {
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
      return 'Coach adjusted';
    case PulseCheckDailyAssignmentStatus.Deferred:
      return 'Deferred';
    case PulseCheckDailyAssignmentStatus.Superseded:
      return 'Superseded';
    default:
      return 'Assigned';
  }
};

const isActiveDailyTask = (assignment: PulseCheckDailyAssignment | null) =>
  Boolean(
    assignment &&
      (
        assignment.status === PulseCheckDailyAssignmentStatus.Assigned ||
        assignment.status === PulseCheckDailyAssignmentStatus.Viewed ||
        assignment.status === PulseCheckDailyAssignmentStatus.Started
      )
  );

const applyRosterScope = (
  roster: AthleteRosterEntry[],
  membership: PulseCheckTeamMembership | null
) => {
  if (!membership) return [];

  const scope = membership.rosterVisibilityScope || (membership.role === 'athlete' ? 'none' : 'team');
  if (scope === 'none') {
    return [];
  }

  if (scope === 'assigned') {
    const allowed = new Set(membership.allowedAthleteIds || []);
    return roster.filter((athlete) => allowed.has(athlete.id));
  }

  return roster;
};

const focusByRole: Record<PulseCheckOperatingRole, { title: string; description: string; accent: string }> = {
  'admin-only': {
    title: 'Operational Control Lane',
    description: 'Keep team permissions, onboarding, and visibility boundaries clean as the container scales.',
    accent: 'from-amber-400/18 to-orange-500/10 border-amber-400/25',
  },
  'admin-plus-coach': {
    title: 'Coach-Led Team Lane',
    description: 'Coordinate admin operations while maintaining direct coaching awareness and athlete entry flow.',
    accent: 'from-cyan-400/18 to-sky-500/10 border-cyan-400/25',
  },
  'admin-plus-support-staff': {
    title: 'Support Operations Lane',
    description: 'Run staffing and athlete support posture from the performance or support side of the team.',
    accent: 'from-emerald-400/18 to-teal-500/10 border-emerald-400/25',
  },
};

const formatRole = (role: string) => {
  switch (role) {
    case 'team-admin':
      return 'Team Admin';
    case 'performance-staff':
      return 'Performance Staff';
    case 'support-staff':
      return 'Support Staff';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

const scopeLabel = (scope?: PulseCheckRosterVisibilityScope) => {
  switch (scope) {
    case 'assigned':
      return 'Assigned athletes only';
    case 'none':
      return 'No roster visibility';
    default:
      return 'Full team visibility';
  }
};

const permissionOptionsByRole = (role: PulseCheckTeamMembershipRole) => {
  switch (role) {
    case 'coach':
      return [
        { value: 'pulsecheck-coach-full-v1', label: 'Coach Full' },
        { value: 'pulsecheck-coach-limited-v1', label: 'Coach Limited' },
      ];
    case 'performance-staff':
      return [
        { value: 'pulsecheck-performance-full-v1', label: 'Performance Full' },
        { value: 'pulsecheck-performance-limited-v1', label: 'Performance Limited' },
      ];
    case 'support-staff':
      return [
        { value: 'pulsecheck-support-full-v1', label: 'Support Full' },
        { value: 'pulsecheck-support-limited-v1', label: 'Support Limited' },
      ];
    case 'clinician':
      return [{ value: 'pulsecheck-clinician-bridge-v1', label: 'Clinician Bridge' }];
    case 'team-admin':
      return [{ value: 'pulsecheck-team-admin-v1', label: 'Team Admin' }];
    default:
      return [{ value: 'pulsecheck-athlete-v1', label: 'Athlete' }];
  }
};

const invitePolicyLabel = (policy?: PulseCheckInvitePolicy) => {
  switch (policy) {
    case 'admin-and-staff':
      return 'Admin and Staff';
    case 'admin-staff-and-coaches':
      return 'Admin, Staff, and Coaches';
    default:
      return 'Admin Only';
  }
};

const canCreateAthleteInvite = (role: PulseCheckTeamMembershipRole, invitePolicy?: PulseCheckInvitePolicy) => {
  if (role === 'team-admin') return true;
  if (invitePolicy === 'admin-and-staff') {
    return role === 'performance-staff' || role === 'support-staff';
  }
  if (invitePolicy === 'admin-staff-and-coaches') {
    return role === 'performance-staff' || role === 'support-staff' || role === 'coach';
  }
  return false;
};

const buildMailto = (invite: PulseCheckInviteLink, teamName: string, organizationName: string) => {
  const subject = encodeURIComponent(`PulseCheck invite for ${teamName}`);
  const body = encodeURIComponent(
    `You’ve been invited to PulseCheck for ${organizationName} / ${teamName}.\n\nOpen your onboarding link:\n${invite.activationUrl}`
  );
  return `mailto:${invite.targetEmail || ''}?subject=${subject}&body=${body}`;
};

export default function PulseCheckTeamWorkspacePage() {
  const router = useRouter();
  const currentUser = useUser();
  const currentUserLoading = useUserLoading();
  const organizationId = typeof router.query.organizationId === 'string' ? router.query.organizationId : '';
  const teamId = typeof router.query.teamId === 'string' ? router.query.teamId : '';

  const [membership, setMembership] = useState<PulseCheckTeamMembership | null>(null);
  const [organization, setOrganization] = useState<PulseCheckOrganization | null>(null);
  const [team, setTeam] = useState<PulseCheckTeam | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberView[]>([]);
  const [athleteRoster, setAthleteRoster] = useState<AthleteRosterEntry[]>([]);
  const [inviteLinks, setInviteLinks] = useState<PulseCheckInviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingAccessFor, setSavingAccessFor] = useState<string | null>(null);
  const [savingInvitePolicy, setSavingInvitePolicy] = useState(false);
  const [creatingAthleteInvite, setCreatingAthleteInvite] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [scopeTarget, setScopeTarget] = useState<TeamMemberView | null>(null);
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [athleteProgress, setAthleteProgress] = useState<AthleteMentalProgress | null>(null);
  const [todayDailyAssignment, setTodayDailyAssignment] = useState<PulseCheckDailyAssignment | null>(null);
  const [athleteTaskLoading, setAthleteTaskLoading] = useState(false);
  const [baselineModalOpen, setBaselineModalOpen] = useState(false);
  const [pendingAssignmentCount, setPendingAssignmentCount] = useState(0);
  const [visionProTaskState, setVisionProTaskState] = useState<VisionProTaskState>('not-queued');
  const [athleteInviteForm, setAthleteInviteForm] = useState({
    recipientName: '',
    targetEmail: '',
  });

  const refreshWorkspace = async () => {
    if (!currentUser?.id || !teamId) return;

    const [memberships, nextOrganization, nextTeam, nextInviteLinks] = await Promise.all([
      pulseCheckProvisioningService.listTeamMemberships(teamId),
      organizationId ? pulseCheckProvisioningService.getOrganization(organizationId) : Promise.resolve(null),
      pulseCheckProvisioningService.getTeam(teamId),
      pulseCheckProvisioningService.listTeamInviteLinks(teamId),
    ]);

    const myMembership = memberships.find((entry) => entry.userId === currentUser.id) || null;
    const userIds = memberships.map((entry) => entry.userId).filter(Boolean);
    const users = userIds.length ? await userService.getUsersByIds(userIds) : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    const memberViews = memberships.map((entry) => ({
      membership: entry,
      user: userMap.get(entry.userId) || null,
    }));

    const athleteMembers = memberViews.filter((entry) => entry.membership.role === 'athlete');

    let roster: AthleteRosterEntry[] = athleteMembers.map((entry) => ({
      id: entry.membership.userId,
      displayName: entry.user?.displayName || entry.user?.username || entry.membership.email || 'Athlete',
      email: entry.user?.email || entry.membership.email || '',
      profileImageUrl: entry.user?.profileImage?.profileImageURL || '',
      onboardingStatus: entry.membership.onboardingStatus || 'pending',
      workoutCount: entry.user?.workoutCount || 0,
      consentReady: Boolean(entry.membership.athleteOnboarding?.productConsentAccepted),
      baselineReady: entry.membership.athleteOnboarding?.baselinePathStatus === 'complete',
      source: 'team-membership',
    }));

    // Bridge legacy coachAthletes data until the team roster is fully migrated.
    if (roster.length === 0 && currentUser.id) {
      const legacyAthletes = await coachService.getConnectedAthletes(currentUser.id);
      roster = legacyAthletes.map((athlete: any) => ({
        id: athlete.id,
        displayName: athlete.displayName || 'Athlete',
        email: athlete.email || '',
        profileImageUrl: athlete.profileImageUrl || '',
        onboardingStatus: 'legacy-connected',
        workoutCount: athlete.totalSessions || 0,
        conversationCount: athlete.conversationCount || 0,
        lastActiveDate: athlete.lastActiveDate || null,
        consentReady: false,
        baselineReady: false,
        source: 'legacy-coach-bridge',
      }));
    } else if (roster.length > 0 && currentUser.id) {
      const legacyAthletes = await coachService.getConnectedAthletes(currentUser.id);
      const legacyMap = new Map(legacyAthletes.map((athlete: any) => [athlete.id, athlete]));
      roster = roster.map((athlete) => {
        const legacy = legacyMap.get(athlete.id);
        return legacy
          ? {
              ...athlete,
              conversationCount: legacy.conversationCount || 0,
              lastActiveDate: legacy.lastActiveDate || null,
            }
          : athlete;
      });
    }

    const scopedRoster = applyRosterScope(roster, myMembership);

    let resolvedMembership = myMembership;

    if (myMembership?.role === 'athlete' && currentUser.id) {
      setAthleteTaskLoading(true);
      try {
        const [nextProgress, pendingAssignments, visionProSessions, nextDailyAssignment] = await Promise.all([
          athleteProgressService.get(currentUser.id),
          assignmentService.getPendingForAthlete(currentUser.id),
          getDocs(
            query(
              collection(db, 'vision-pro-trial-sessions'),
              where('athleteUserId', '==', currentUser.id),
              limit(8)
            )
          ),
          assignmentOrchestratorService.getForAthleteOnDate(currentUser.id, todayDateKey()),
        ]);

        const sessionStatuses = visionProSessions.docs.map((docSnap) => String(docSnap.data()?.status || ''));
        const nextVisionProTaskState: VisionProTaskState = sessionStatuses.includes('completed')
          ? 'completed'
          : sessionStatuses.some((status) => ['queued', 'claimed', 'running'].includes(status))
          ? 'queued'
          : 'not-queued';

        const taskState = resolvePulseCheckAthleteTaskState({
          athleteOnboarding: myMembership.athleteOnboarding,
          progress: nextProgress,
        });

        if (taskState.baselineStatus === 'complete' && myMembership.athleteOnboarding?.baselinePathStatus !== 'complete') {
          await pulseCheckProvisioningService.updateAthleteBaselineStatus({
            teamMembershipId: myMembership.id,
            baselinePathStatus: 'complete',
            baselinePathwayId: nextProgress?.currentPathway,
          });
          const nextAthleteOnboarding = {
            productConsentAccepted: Boolean(myMembership.athleteOnboarding?.productConsentAccepted),
            ...myMembership.athleteOnboarding,
            baselinePathStatus: 'complete' as const,
            baselinePathwayId: nextProgress?.currentPathway || myMembership.athleteOnboarding?.baselinePathwayId,
          };
          resolvedMembership = {
            ...myMembership,
            athleteOnboarding: nextAthleteOnboarding,
          };
        }

        setAthleteProgress(nextProgress);
        setTodayDailyAssignment(nextDailyAssignment);
        setPendingAssignmentCount(pendingAssignments.length);
        setVisionProTaskState(nextVisionProTaskState);
      } catch (error) {
        console.error('[PulseCheck team workspace] Failed to load athlete task state:', error);
        setAthleteProgress(null);
        setTodayDailyAssignment(null);
        setPendingAssignmentCount(0);
        setVisionProTaskState('not-queued');
      } finally {
        setAthleteTaskLoading(false);
      }
    } else {
      setAthleteProgress(null);
      setTodayDailyAssignment(null);
      setPendingAssignmentCount(0);
      setVisionProTaskState('not-queued');
      setAthleteTaskLoading(false);
    }

    setMembership(resolvedMembership);
    setOrganization(nextOrganization);
    setTeam(nextTeam);
    setTeamMembers(memberViews);
    setAthleteRoster(scopedRoster);
    setInviteLinks(nextInviteLinks);
  };

  useEffect(() => {
    if (currentUserLoading) return;
    if (!currentUser?.id || !teamId) {
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        await refreshWorkspace();
      } catch (error) {
        console.error('[PulseCheck team workspace] Failed to load workspace:', error);
        if (active) {
          setMessage({ type: 'error', text: 'Failed to load the team workspace.' });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUserLoading, organizationId, teamId]);

  const activeInviteLinks = useMemo(() => inviteLinks.filter((invite) => invite.status === 'active'), [inviteLinks]);
  const adultInviteCount = activeInviteLinks.filter((invite) => invite.teamMembershipRole && invite.teamMembershipRole !== 'athlete').length;
  const athleteInviteCount = activeInviteLinks.filter((invite) => invite.teamMembershipRole === 'athlete').length;
  const athleteInviteLinks = activeInviteLinks.filter((invite) => invite.teamMembershipRole === 'athlete');
  const adultMembers = useMemo(() => teamMembers.filter((entry) => entry.membership.role !== 'athlete'), [teamMembers]);
  const isTeamAdmin = membership?.role === 'team-admin';
  const isAthleteWorkspace = membership?.role === 'athlete';
  const operatingRole = membership?.operatingRole || 'admin-only';
  const focus = focusByRole[operatingRole];
  const canManageAthleteInvites = membership ? canCreateAthleteInvite(membership.role, team?.defaultInvitePolicy) : false;
  const athleteTaskState = resolvePulseCheckAthleteTaskState({
    athleteOnboarding: membership?.athleteOnboarding,
    progress: athleteProgress,
  });
  const consentComplete = athleteTaskState.consentComplete;
  const baselineComplete = athleteTaskState.baselineComplete;
  const baselineStarted = athleteTaskState.baselineStatus === 'started';
  const requiredTasksComplete = athleteTaskState.requiredTasksComplete;
  const showAthleteVisionProSummary = visionProTaskState === 'queued' || visionProTaskState === 'completed';
  const nextProgramName = athleteProgress?.activeProgram?.recommendedSimId
    ? athleteProgress.activeProgram.recommendedSimId.split('_').join(' ')
    : null;
  const todayTaskName = humanizeDailyTaskLabel(todayDailyAssignment);
  const todayTaskIsActive = isActiveDailyTask(todayDailyAssignment);
  const athleteCurrentAssignmentCount = requiredTasksComplete
    ? todayTaskIsActive
      ? 1
      : pendingAssignmentCount
    : 0;
  const todayTaskSubtitle = !todayDailyAssignment
    ? requiredTasksComplete
      ? athleteProgress?.activeProgram?.rationale || 'Profile-driven recommendation'
      : 'We will recommend your first training focus'
    : todayDailyAssignment.status === PulseCheckDailyAssignmentStatus.Deferred
    ? todayDailyAssignment.overrideReason || 'Your coach paused today\'s task while they adjust the plan.'
    : todayDailyAssignment.rationale || 'Built from today\'s readiness signal.';

  const handleLaunchBaseline = useCallback(async () => {
    if (!membership || !currentUser?.id) return;

    setMessage(null);
    try {
      await pulseCheckProvisioningService.updateAthleteBaselineStatus({
        teamMembershipId: membership.id,
        baselinePathStatus: baselineComplete ? 'complete' : 'started',
      });
      await refreshWorkspace();
      setBaselineModalOpen(true);
    } catch (error) {
      console.error('[PulseCheck team workspace] Failed to prepare baseline task:', error);
      setMessage({ type: 'error', text: 'Failed to launch the baseline task.' });
    }
  }, [baselineComplete, currentUser?.id, membership]);

  const athleteHeroSummary = !consentComplete
    ? `You are in the right place. We have added you to ${team?.displayName || 'your team'}. First, finish setup so we can get you ready to begin.`
    : !baselineComplete
    ? `You are in the right place. We have added you to ${team?.displayName || 'your team'}. Your next step is to complete your baseline so we can personalize your starting point.`
    : todayDailyAssignment
    ? `You are all set in ${team?.displayName || 'your team'}. Your consent and baseline are complete, and today\'s Nora task is now your source of truth.`
    : `You are all set in ${team?.displayName || 'your team'}. Your consent and baseline are complete, and you are ready for what comes next.`;

  const handleBaselineComplete = useCallback(async (progress: AthleteMentalProgress) => {
    if (!membership) return;

    setBaselineModalOpen(false);
    setAthleteProgress(progress);

    try {
      await pulseCheckProvisioningService.updateAthleteBaselineStatus({
        teamMembershipId: membership.id,
        baselinePathStatus: 'complete',
        baselinePathwayId: progress.currentPathway,
      });
      await refreshWorkspace();
      setMessage({ type: 'success', text: 'Baseline completed. Required tasks are now unlocked for training.' });
    } catch (error) {
      console.error('[PulseCheck team workspace] Failed to mark baseline complete:', error);
      setMessage({ type: 'error', text: 'Baseline finished, but the task status failed to refresh. Reload and verify the unlock state.' });
    }
  }, [membership]);

  const handleCopy = async (value: string, successText: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      console.error('[PulseCheck team workspace] Clipboard copy failed:', error);
      setMessage({ type: 'error', text: 'Failed to copy to clipboard.' });
    }
  };

  const handleScopeChange = async (target: TeamMemberView, scope: PulseCheckRosterVisibilityScope) => {
    setSavingAccessFor(target.membership.id);
    setMessage(null);
    try {
      await pulseCheckProvisioningService.updateTeamMembershipAccess({
        teamMembershipId: target.membership.id,
        rosterVisibilityScope: scope,
        allowedAthleteIds: scope === 'assigned' ? target.membership.allowedAthleteIds || [] : [],
      });
      await refreshWorkspace();
      setMessage({ type: 'success', text: 'Roster visibility updated.' });
    } catch (error) {
      console.error('[PulseCheck team workspace] Failed to update member access:', error);
      setMessage({ type: 'error', text: 'Failed to update roster visibility.' });
    } finally {
      setSavingAccessFor(null);
    }
  };

  const handlePermissionSetChange = async (target: TeamMemberView, permissionSetId: string) => {
    setSavingAccessFor(target.membership.id);
    setMessage(null);
    try {
      await pulseCheckProvisioningService.updateTeamMembershipAccess({
        teamMembershipId: target.membership.id,
        rosterVisibilityScope: target.membership.rosterVisibilityScope || 'team',
        allowedAthleteIds: target.membership.allowedAthleteIds || [],
        permissionSetId,
      });
      await refreshWorkspace();
      setMessage({ type: 'success', text: 'Member permission set updated.' });
    } catch (error) {
      console.error('[PulseCheck team workspace] Failed to update member permission set:', error);
      setMessage({ type: 'error', text: 'Failed to update permission set.' });
    } finally {
      setSavingAccessFor(null);
    }
  };

  const handleInvitePolicyChange = async (nextPolicy: PulseCheckInvitePolicy) => {
    if (!team || !isTeamAdmin) return;
    setSavingInvitePolicy(true);
    setMessage(null);
    try {
      await pulseCheckProvisioningService.updateTeamInvitePolicy(team.id, nextPolicy);
      await refreshWorkspace();
      setMessage({ type: 'success', text: 'Team invite policy updated.' });
    } catch (error) {
      console.error('[PulseCheck team workspace] Failed to update invite policy:', error);
      setMessage({ type: 'error', text: 'Failed to update team invite policy.' });
    } finally {
      setSavingInvitePolicy(false);
    }
  };

  const handleCreateAthleteInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization || !team || !currentUser) return;
    if (!canManageAthleteInvites) {
      setMessage({ type: 'error', text: 'Your current role and team invite policy do not allow athlete invites.' });
      return;
    }

    setCreatingAthleteInvite(true);
    setMessage(null);
    try {
      const inviteId = await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: organization.id,
        teamId: team.id,
        teamMembershipRole: 'athlete',
        targetEmail: athleteInviteForm.targetEmail.trim().toLowerCase(),
        recipientName: athleteInviteForm.recipientName.trim(),
        createdByUserId: currentUser.id,
        createdByEmail: currentUser.email,
      });

      await refreshWorkspace();
      const createdInvite = (await pulseCheckProvisioningService.listTeamInviteLinks(team.id)).find((invite) => invite.id === inviteId);
      if (createdInvite?.activationUrl) {
        await navigator.clipboard.writeText(createdInvite.activationUrl);
      }
      setAthleteInviteForm({ recipientName: '', targetEmail: '' });
      setMessage({ type: 'success', text: 'Athlete invite link created and copied.' });
    } catch (error) {
      console.error('[PulseCheck team workspace] Failed to create athlete invite:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create athlete invite.' });
    } finally {
      setCreatingAthleteInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingInviteId(inviteId);
    setMessage(null);
    try {
      await pulseCheckProvisioningService.revokeInviteLink(inviteId);
      await refreshWorkspace();
      setMessage({ type: 'success', text: 'Invite link revoked.' });
    } catch (error) {
      console.error('[PulseCheck team workspace] Failed to revoke invite link:', error);
      setMessage({ type: 'error', text: 'Failed to revoke invite link.' });
    } finally {
      setRevokingInviteId(null);
    }
  };

  const handleSaveAssignedAthletes = async () => {
    if (!scopeTarget) return;
    setSavingAccessFor(scopeTarget.membership.id);
    setMessage(null);
    try {
      await pulseCheckProvisioningService.updateTeamMembershipAccess({
        teamMembershipId: scopeTarget.membership.id,
        rosterVisibilityScope: 'assigned',
        allowedAthleteIds: selectedAthletes,
      });
      await refreshWorkspace();
      setScopeModalOpen(false);
      setScopeTarget(null);
      setMessage({ type: 'success', text: 'Assigned athlete scope updated.' });
    } catch (error) {
      console.error('[PulseCheck team workspace] Failed to save assigned athletes:', error);
      setMessage({ type: 'error', text: 'Failed to save athlete assignments.' });
    } finally {
      setSavingAccessFor(null);
    }
  };

  if (currentUserLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#05070c' }}>
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#E0FE10]/20 blur-2xl" />
          <Loader2 className="relative h-8 w-8 animate-spin text-[#E0FE10]" />
        </div>
      </div>
    );
  }

  if (!currentUser || !membership || !team) {
    return null;
  }

  return (
    <div className="min-h-screen text-white overflow-hidden" style={{ background: '#05070c' }}>
      <Head>
        <title>{team.displayName} | PulseCheck Workspace</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <FloatingOrb color="#E0FE10" size="w-[550px] h-[550px]" style={{ top: '-10%', left: '-8%' }} delay={0} />
        <FloatingOrb color="#3B82F6" size="w-[420px] h-[420px]" style={{ top: '25%', right: '-6%' }} delay={3} />
        <FloatingOrb color="#8B5CF6" size="w-[380px] h-[380px]" style={{ bottom: '5%', left: '20%' }} delay={6} />
        <div className="absolute inset-0 opacity-[0.018]" style={{ backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=")` }} />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10">
        {/* Hero Header */}
        <GlassCard accentColor="#3B82F6" delay={0.05}>
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  {isAthleteWorkspace ? 'You are joining' : 'PulseCheck Team Workspace'}
                </motion.p>
                <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-3 text-4xl font-bold tracking-tight">
                  <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, #ffffff, #94a3b8)' }}>
                    {team.displayName}
                  </span>
                </motion.h1>
                <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                  {isAthleteWorkspace
                    ? athleteHeroSummary
                    : `${organization?.displayName || 'Organization'} is active. Staff, athletes, and invite state now live in the same team-scoped workspace.`}
                </motion.p>
              </div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-3">
                {isAthleteWorkspace ? (
                  !consentComplete ? (
                    <Link
                      href={`/PulseCheck/post-activation?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                      className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-black transition-all hover:opacity-90"
                      style={{ background: '#E0FE10' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(224,254,16,0.35)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      Finish Setup
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : !baselineComplete ? (
                    <>
                      <button
                        type="button"
                        onClick={handleLaunchBaseline}
                        disabled={athleteTaskLoading}
                        className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-black transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ background: '#E0FE10' }}
                        onMouseEnter={(e) => { if (!athleteTaskLoading) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(224,254,16,0.35)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                      >
                        {athleteTaskLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                        {baselineStarted ? 'Resume Baseline' : 'Start Baseline'}
                      </button>
                      <Link
                        href="/PulseCheck/oura"
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-white backdrop-blur-sm"
                      >
                        Connect Oura
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/PulseCheck/oura"
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.07] hover:text-white backdrop-blur-sm"
                      >
                        Connect Oura
                      </Link>
                      <Link
                        href="/PulseCheck"
                        className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-black transition-all hover:opacity-90"
                        style={{ background: '#E0FE10' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(224,254,16,0.35)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                      >
                        Go to Today
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </>
                  )
                ) : (
                  <>
                    <Link
                      href={`/PulseCheck/post-activation?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-300 transition-all hover:border-white/20 hover:text-white hover:bg-white/[0.07] backdrop-blur-sm"
                    >
                      Manage Onboarding
                    </Link>
                    <Link
                      href="/PulseCheck"
                      className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-black transition-all hover:opacity-90"
                      style={{ background: '#E0FE10' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(224,254,16,0.35)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      Open PulseCheck
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </motion.div>
            </div>

            <AnimatePresence>
              {message ? (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                    message.type === 'success'
                      ? 'border-[#E0FE10]/20 bg-[#E0FE10]/[0.06] text-[#E0FE10]'
                      : 'border-red-500/20 bg-red-500/[0.06] text-red-300'
                  }`}
                >
                  {message.text}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </GlassCard>

          {isAthleteWorkspace ? (
            <div className="mt-8 space-y-6">
              <div className={`grid gap-6 ${showAthleteVisionProSummary ? 'xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]' : ''}`}>
                <div className="rounded-[30px] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(224,254,16,0.12),_transparent_38%),#091326] p-6">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-[#E0FE10]/25 bg-[#E0FE10]/10 p-3">
                      {requiredTasksComplete ? (
                        <CheckCircle2 className="h-6 w-6 text-[#E0FE10]" />
                      ) : (
                        <Lock className="h-6 w-6 text-[#E0FE10]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">What Happens Next</div>
                      <h2 className="mt-3 text-2xl font-semibold text-white">
                        {requiredTasksComplete ? (todayDailyAssignment ? 'Today\'s task is ready.' : 'You are ready to begin.') : 'One more step before training begins.'}
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
                        {requiredTasksComplete
                          ? todayDailyAssignment
                            ? todayTaskSubtitle
                            : 'Your consent and baseline are complete. Nora and your team can now start personalizing what comes next.'
                          : 'Before training starts, we need your baseline. It gives us a starting point so Nora and your team can personalize what comes next. A Vision Pro session may be offered later, but it is optional.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {[
                      { label: 'Required Tasks', value: requiredTasksComplete || baselineComplete ? '2 / 2' : '1 / 2', sub: 'Consent plus in-app baseline', accent: '#E0FE10' },
                      { label: 'Current Assignments', value: athleteCurrentAssignmentCount, sub: requiredTasksComplete ? 'Ready for you now' : 'These appear after your baseline', accent: '#3B82F6' },
                      { label: 'Today\'s Nora Task', value: requiredTasksComplete && todayTaskName ? todayTaskName : requiredTasksComplete && nextProgramName ? nextProgramName : 'After your baseline', sub: todayTaskSubtitle, accent: '#8B5CF6' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-[20px] border border-white/8 bg-black/25 p-4" style={{ borderColor: `${stat.accent}18` }}>
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{stat.label}</div>
                        <div className="mt-3 text-2xl font-bold capitalize" style={{ color: stat.accent !== '#E0FE10' ? '#fff' : stat.accent }}>{stat.value}</div>
                        <div className="mt-1 text-sm text-zinc-400">{stat.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {showAthleteVisionProSummary ? (
                  <div className="grid gap-4">
                    <InfoCard icon={<ScanLine className="h-4 w-4 text-[#8B5CF6]" />} title="Optional Vision Pro Session" accentColor="#8B5CF6" delay={0.5}>
                      <p className="text-sm leading-7 text-zinc-400">
                        {visionProTaskState === 'completed'
                          ? 'Your optional Vision Pro session is complete. If your team uses it, they may count it as an extra checkpoint.'
                          : 'Your team has scheduled an optional Vision Pro session for you. Complete it when prompted, but you do not need it to begin training.'}
                      </p>
                    </InfoCard>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[30px] border border-zinc-800 bg-[#091326] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Before Training Begins</div>
                    <div className="mt-2 text-2xl font-semibold text-white">Finish these to unlock your first training session.</div>
                  </div>
                  {requiredTasksComplete ? (
                    <Link
                      href={todayDailyAssignment ? '/PulseCheck?section=today' : '/PulseCheck?section=profile'}
                      className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                    >
                      {todayDailyAssignment ? 'Open Today' : 'Review Profile'}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[22px] border bg-black/25 p-5" style={{ borderColor: consentComplete ? 'rgba(224,254,16,0.2)' : 'rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Required</div>
                        <div className="mt-2 text-lg font-semibold text-white">Getting Started Consent</div>
                      </div>
                      <div className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: consentComplete ? '#E0FE10' : '#FCD34D', background: consentComplete ? 'rgba(224,254,16,0.1)' : 'rgba(252,211,77,0.1)', border: `1px solid ${consentComplete ? 'rgba(224,254,16,0.25)' : 'rgba(252,211,77,0.2)'}` }}>
                        {consentComplete ? 'Complete' : 'Pending'}
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-zinc-400">
                      You already completed this at the start of onboarding. It gives us permission to set up PulseCheck for your team.
                    </p>
                  </div>

                  <div className="rounded-[22px] border bg-black/25 p-5" style={{ borderColor: baselineComplete ? 'rgba(224,254,16,0.2)' : baselineStarted ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Required</div>
                        <div className="mt-2 text-lg font-semibold text-white">In-App Baseline</div>
                      </div>
                      <div className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: baselineComplete ? '#E0FE10' : baselineStarted ? '#3B82F6' : '#a1a1aa', background: baselineComplete ? 'rgba(224,254,16,0.1)' : baselineStarted ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.06)', border: `1px solid ${baselineComplete ? 'rgba(224,254,16,0.25)' : baselineStarted ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.1)'}` }}>
                        {baselineComplete ? 'Complete' : baselineStarted ? 'In Progress' : 'Ready'}
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-zinc-400">
                      Your baseline gives us a starting point so Nora and your team can personalize what comes next.
                    </p>
                    <button
                      type="button"
                      disabled={athleteTaskLoading || baselineComplete}
                      onClick={handleLaunchBaseline}
                      className="mt-5 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-black transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: '#E0FE10' }}
                      onMouseEnter={(e) => { if (!baselineComplete) (e.currentTarget as HTMLElement).style.boxShadow = '0 0 18px rgba(224,254,16,0.4)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                    >
                      {athleteTaskLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                      {baselineComplete ? 'Baseline complete' : baselineStarted ? 'Resume baseline' : 'Start baseline'}
                    </button>
                  </div>

                  <div className="rounded-[22px] border bg-black/25 p-5" style={{ borderColor: visionProTaskState === 'completed' ? 'rgba(224,254,16,0.2)' : visionProTaskState === 'queued' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Optional</div>
                        <div className="mt-2 text-lg font-semibold text-white">Vision Pro Session</div>
                      </div>
                      <div className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: visionProTaskState === 'completed' ? '#E0FE10' : visionProTaskState === 'queued' ? '#8B5CF6' : '#71717a', background: visionProTaskState === 'completed' ? 'rgba(224,254,16,0.1)' : visionProTaskState === 'queued' ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${visionProTaskState === 'completed' ? 'rgba(224,254,16,0.25)' : visionProTaskState === 'queued' ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                        {visionProTaskState === 'completed' ? 'Complete' : visionProTaskState === 'queued' ? 'Queued' : 'Optional'}
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-zinc-400">
                      Some teams add an optional Vision Pro session after baseline. It does not block training.
                    </p>
                  </div>
                </div>

                <div className={`mt-6 rounded-[20px] border px-5 py-4 text-sm ${ requiredTasksComplete ? 'border-[#E0FE10]/20 bg-[#E0FE10]/[0.05] text-[#E0FE10]' : 'border-amber-500/20 bg-amber-500/[0.05] text-amber-200' }`}>
                  {requiredTasksComplete
                    ? todayDailyAssignment
                      ? `Today's Nora task is ${todayTaskIsActive ? 'ready' : dailyTaskStatusLabel(todayDailyAssignment.status).toLowerCase()}: ${todayTaskName || 'Nora task'}.`
                      : pendingAssignmentCount > 0
                      ? `You are ready to begin. You currently have ${pendingAssignmentCount} assignment${pendingAssignmentCount === 1 ? '' : 's'} waiting for you.`
                      : 'You are ready to begin. Your training can now be added here.'
                    : 'Complete the steps above and we will unlock your training.'}
                </div>
              </div>
            </div>
          ) : (
          <>
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <div className={`rounded-[30px] border bg-gradient-to-br p-6 ${focus.accent}`}>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-white" />
                <div>
                  <div className="text-lg font-semibold text-white">{focus.title}</div>
                  <div className="text-sm text-zinc-300">{focus.description}</div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-[24px] border border-black/20 bg-black/15 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-300">Role</div>
                  <div className="mt-3 text-lg font-semibold text-white">{formatRole(membership.role)}</div>
                  <div className="mt-1 text-sm text-zinc-300">{membership.title || 'Title pending'}</div>
                </div>
                <div className="rounded-[24px] border border-black/20 bg-black/15 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-300">Adults</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{adultMembers.length}</div>
                  <div className="mt-1 text-sm text-zinc-300">Team-admin, coach, and support members</div>
                </div>
                <div className="rounded-[24px] border border-black/20 bg-black/15 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-300">Athletes</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{athleteRoster.length}</div>
                  <div className="mt-1 text-sm text-zinc-300">Current roster inside this team surface</div>
                </div>
                <div className="rounded-[24px] border border-black/20 bg-black/15 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-300">Active Invites</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{adultInviteCount + athleteInviteCount}</div>
                  <div className="mt-1 text-sm text-zinc-300">Adults: {adultInviteCount} · Athletes: {athleteInviteCount}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-zinc-800 bg-[#091326] p-5">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-amber-300" />
                  <div className="text-base font-semibold text-white">Migration Status</div>
                </div>
                <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-300">
                  <div>Team memberships and team-access invites are now the primary source of truth for staff and athlete access.</div>
                  <div>Legacy `coachAthletes` is only used as a temporary bridge when the new team roster is still empty or to enrich athlete stats during migration.</div>
                  <div>Per-athlete staff assignment now lives on `TeamMembership.allowedAthleteIds` instead of `coach-staff`.</div>
                  <div>Current athlete invite policy: <span className="font-medium text-white">{invitePolicyLabel(team.defaultInvitePolicy)}</span>.</div>
                </div>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-[#091326] p-5">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-amber-300" />
                  <div className="text-base font-semibold text-white">Team Invite Policy</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                  <div className="text-sm leading-7 text-zinc-300">
                    Control which roles are allowed to create athlete invite links from the team workspace.
                  </div>
                  <select
                    aria-label="Team invite policy"
                    value={team.defaultInvitePolicy}
                    disabled={!isTeamAdmin || savingInvitePolicy}
                    onChange={(event) => handleInvitePolicyChange(event.target.value as PulseCheckInvitePolicy)}
                    className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="admin-only">Admin Only</option>
                    <option value="admin-and-staff">Admin and Staff</option>
                    <option value="admin-staff-and-coaches">Admin, Staff, and Coaches</option>
                  </select>
                </div>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-[#091326] p-5">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-cyan-300" />
                  <div className="text-base font-semibold text-white">Notification Posture</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                    Email updates: {membership.notificationPreferences?.email ? 'On' : 'Off'}
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                    SMS alerts: {membership.notificationPreferences?.sms ? 'On' : 'Off'}
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                    Push: {membership.notificationPreferences?.push ? 'On' : 'Off'}
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                    Weekly digest: {membership.notificationPreferences?.weeklyDigest ? 'On' : 'Off'}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-[#091326] p-5">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-purple-300" />
                  <div className="text-base font-semibold text-white">Roster Visibility Scope</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                    Current scope: {scopeLabel(membership.rosterVisibilityScope)}
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                    Visible athletes right now: {athleteRoster.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-[30px] border border-zinc-800 bg-[#091326] p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-amber-300" />
                  <div>
                    <div className="text-lg font-semibold text-white">Staff and Adult Team Members</div>
                    <div className="text-sm text-zinc-400">Migrated from the old staff surface into team-scoped memberships.</div>
                  </div>
                </div>
                <Link
                  href={`/PulseCheck/post-activation?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-white transition hover:border-zinc-500"
                >
                  Invite Adults
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {adultMembers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-4 text-sm text-zinc-500">
                    No adult team members yet.
                  </div>
                ) : (
                  adultMembers.map((entry) => {
                    const isMe = entry.membership.userId === currentUser.id;
                    return (
                      <div key={entry.membership.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                              {entry.user?.profileImage?.profileImageURL ? (
                                <img src={entry.user.profileImage.profileImageURL} alt={entry.user.displayName || entry.user.username} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-sm font-semibold text-zinc-500">
                                  {(entry.user?.displayName || entry.user?.username || entry.membership.email || 'U').substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold text-white">
                                  {entry.user?.displayName || entry.user?.username || entry.membership.email}
                                </div>
                                {isMe ? <div className="rounded-full border border-cyan-400/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-cyan-200">You</div> : null}
                              </div>
                              <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                                {formatRole(entry.membership.role)}
                                {entry.membership.title ? ` • ${entry.membership.title}` : ''}
                              </div>
                              <div className="mt-1 text-sm text-zinc-400">
                                {entry.user?.email || entry.membership.email || 'No email'} • {entry.membership.onboardingStatus || 'pending'}
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_auto] sm:items-center">
                            <select
                              value={entry.membership.rosterVisibilityScope || 'team'}
                              disabled={!isTeamAdmin || entry.membership.role === 'team-admin' || savingAccessFor === entry.membership.id}
                              onChange={(event) => handleScopeChange(entry, event.target.value as PulseCheckRosterVisibilityScope)}
                              className="rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <option value="team">Full team visibility</option>
                              <option value="assigned">Assigned athletes only</option>
                              <option value="none">No roster visibility</option>
                            </select>
                            <button
                              type="button"
                              disabled={!isTeamAdmin || entry.membership.rosterVisibilityScope !== 'assigned'}
                              onClick={() => {
                                setScopeTarget(entry);
                                setSelectedAthletes(entry.membership.allowedAthleteIds || []);
                                setScopeModalOpen(true);
                              }}
                              className="rounded-2xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {entry.membership.allowedAthleteIds && entry.membership.allowedAthleteIds.length > 0
                                ? `Manage Assigned (${entry.membership.allowedAthleteIds.length})`
                                : 'Assign Athletes'}
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                          <div className="text-xs text-zinc-500">{scopeLabel(entry.membership.rosterVisibilityScope)}</div>
                          <select
                            value={entry.membership.permissionSetId || permissionOptionsByRole(entry.membership.role)[0]?.value || ''}
                            disabled={!isTeamAdmin || savingAccessFor === entry.membership.id || entry.membership.role === 'team-admin'}
                            onChange={(event) => handlePermissionSetChange(entry, event.target.value)}
                            className="rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {permissionOptionsByRole(entry.membership.role).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-zinc-800 bg-[#091326] p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Waves className="h-5 w-5 text-emerald-300" />
                  <div>
                    <div className="text-lg font-semibold text-white">Athlete Roster</div>
                    <div className="text-sm text-zinc-400">Team-scoped athlete list with consent and baseline readiness.</div>
                  </div>
                </div>
                <Link
                  href={`/PulseCheck/post-activation?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                  className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-4 py-2 text-xs font-semibold text-white transition hover:border-zinc-500"
                >
                  Invite Athletes
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-5 rounded-[24px] border border-zinc-800 bg-black/20 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Athlete Invite Controls</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      Team admins can always invite athletes. Staff and coaches follow the team invite policy.
                    </div>
                  </div>
                  <div className="rounded-full border border-zinc-700 px-3 py-1 text-xs uppercase tracking-[0.16em] text-zinc-400">
                    {invitePolicyLabel(team.defaultInvitePolicy)}
                  </div>
                </div>

                {canManageAthleteInvites ? (
                  <form onSubmit={handleCreateAthleteInvite} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <input
                      value={athleteInviteForm.recipientName}
                      onChange={(event) => setAthleteInviteForm((current) => ({ ...current, recipientName: event.target.value }))}
                      placeholder="Athlete name"
                      className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300"
                    />
                    <input
                      value={athleteInviteForm.targetEmail}
                      onChange={(event) => setAthleteInviteForm((current) => ({ ...current, targetEmail: event.target.value }))}
                      placeholder="athlete@school.edu"
                      className="rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300"
                    />
                    <button
                      type="submit"
                      disabled={creatingAthleteInvite}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {creatingAthleteInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                      Invite Athlete
                    </button>
                  </form>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 px-4 py-4 text-sm text-zinc-500">
                    Your role does not currently allow athlete invite creation under this team policy.
                  </div>
                )}

                {athleteInviteLinks.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {athleteInviteLinks.slice(0, 4).map((invite) => (
                      <div key={invite.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-white">{invite.recipientName || invite.targetEmail || 'Athlete invite'}</div>
                            <div className="mt-1 text-xs text-zinc-500">{invite.targetEmail || 'No email captured'}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                              {invite.cohortName ? `Cohort Invite · ${invite.cohortName}` : 'Team Athlete Invite'}
                            </div>
                            {invite.pilotName ? <div className="mt-1 text-xs text-zinc-500">Pilot: {invite.pilotName}</div> : null}
                            <div className="mt-2 break-all text-xs leading-6 text-zinc-400">{invite.activationUrl}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(invite.activationUrl, 'Athlete invite copied.')}
                              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-zinc-500"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </button>
                            {invite.targetEmail ? (
                              <a
                                href={buildMailto(invite, team.displayName, organization?.displayName || 'PulseCheck')}
                                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-zinc-500"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                Email
                              </a>
                            ) : null}
                            {isTeamAdmin ? (
                              <button
                                type="button"
                                disabled={revokingInviteId === invite.id}
                                onClick={() => handleRevokeInvite(invite.id)}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-400/25 px-3 py-2 text-xs font-semibold text-red-200 transition hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {revokingInviteId === invite.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                Revoke
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                {athleteRoster.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-4 text-sm text-zinc-500">
                    No athletes are connected to this team yet.
                  </div>
                ) : (
                  athleteRoster.map((athlete) => (
                    <div key={athlete.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                            {athlete.profileImageUrl ? (
                              <img src={athlete.profileImageUrl} alt={athlete.displayName} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-sm font-semibold text-zinc-500">{athlete.displayName.substring(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{athlete.displayName}</div>
                            <div className="mt-1 text-sm text-zinc-400">{athlete.email || 'Email not set'}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                              {athlete.source === 'team-membership' ? 'team membership' : 'legacy coach bridge'}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-4">
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-center">
                            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Consent</div>
                            <div className={`mt-2 text-sm font-semibold ${athlete.consentReady ? 'text-green-300' : 'text-amber-200'}`}>
                              {athlete.consentReady ? 'Ready' : 'Pending'}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-center">
                            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Baseline</div>
                            <div className={`mt-2 text-sm font-semibold ${athlete.baselineReady ? 'text-green-300' : 'text-zinc-300'}`}>
                              {athlete.baselineReady ? 'Ready' : 'Pending'}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-center">
                            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Workouts</div>
                            <div className="mt-2 text-sm font-semibold text-white">{athlete.workoutCount || 0}</div>
                          </div>
                          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-center">
                            <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Conversations</div>
                            <div className="mt-2 text-sm font-semibold text-white">{athlete.conversationCount || 0}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          </>
          )}

        <BaselineAssessmentModal
          isOpen={baselineModalOpen}
          onClose={() => setBaselineModalOpen(false)}
          athleteId={currentUser.id}
          athleteName={currentUser.displayName || currentUser.username || currentUser.email || 'Athlete'}
          onComplete={handleBaselineComplete}
        />

        {scopeModalOpen && scopeTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-xl rounded-[28px] border border-zinc-800 bg-[#090f1c] p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-cyan-300" />
                <div>
                  <div className="text-lg font-semibold text-white">Assign Athlete Scope</div>
                  <div className="text-sm text-zinc-400">
                    Choose which athletes {scopeTarget.user?.displayName || scopeTarget.membership.email} can see when visibility is limited.
                  </div>
                </div>
              </div>

              <div className="mt-5 max-h-[380px] space-y-3 overflow-auto rounded-2xl border border-zinc-800 bg-black/20 p-4">
                {athleteRoster.length === 0 ? (
                  <div className="text-sm text-zinc-500">No team athletes are available to assign.</div>
                ) : (
                  athleteRoster
                    .filter((athlete) => athlete.source === 'team-membership')
                    .map((athlete) => (
                      <label key={athlete.id} className="flex items-center gap-3 rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={selectedAthletes.includes(athlete.id)}
                          onChange={(event) =>
                            setSelectedAthletes((current) =>
                              event.target.checked ? [...current, athlete.id] : current.filter((value) => value !== athlete.id)
                            )
                          }
                        />
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                          {athlete.profileImageUrl ? (
                            <img src={athlete.profileImageUrl} alt={athlete.displayName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-zinc-500">{athlete.displayName.substring(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">{athlete.displayName}</div>
                          <div className="text-xs text-zinc-500">{athlete.email || 'Email not set'}</div>
                        </div>
                      </label>
                    ))
                )}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setScopeModalOpen(false);
                    setScopeTarget(null);
                  }}
                  className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingAccessFor === scopeTarget.membership.id}
                  onClick={handleSaveAssignedAthletes}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAccessFor === scopeTarget.membership.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Save Assigned Scope
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
