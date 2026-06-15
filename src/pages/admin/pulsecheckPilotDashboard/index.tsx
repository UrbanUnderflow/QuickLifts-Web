import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Activity,
  ArrowRight,
  Building2,
  Eye,
  Filter,
  FlaskConical,
  Layers3,
  Mail,
  MonitorPlay,
  Phone,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  LogOut,
  UserCircle2,
  Users2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import AdminRouteGuard from '../../../components/auth/AdminRouteGuard';
import SignInModal from '../../../components/SignInModal';
import { LocalFirebaseModeButton } from '../../../components/admin/pilot-dashboard/LocalFirebaseModeButton';
import NoraMetricHelpButton from '../../../components/admin/pilot-dashboard/NoraMetricHelpButton';
import type { PilotDashboardMetricExplanationKey } from '../../../components/admin/pilot-dashboard/noraMetricCatalog';
import { auth } from '../../../api/firebase/config';
import { pulseCheckPilotDashboardService } from '../../../api/firebase/pulsecheckPilotDashboard/service';
import { pulseCheckProvisioningService } from '../../../api/firebase/pulsecheckProvisioning/service';
import type {
  PilotDashboardAthleteRosterEntry,
  PilotDashboardAthleteTeamContext,
  PilotDashboardDirectoryEntry,
} from '../../../api/firebase/pulsecheckPilotDashboard/types';
import type { PulseCheckInviteLink } from '../../../api/firebase/pulsecheckProvisioning/types';
import {
  buildAthleteInviteEmailDraft,
  renderAthleteInviteEmail,
} from '../../../lib/emails/pulsecheckAthleteInviteEmail';
import { useUser, useUserLoading } from '../../../hooks/useUser';

const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const formatAverage = (value: number) => value.toFixed(1);
const getPilotCountLabel = (count: number) => `${count} pilot${count === 1 ? '' : 's'}`;

type StudyModeValue = PilotDashboardDirectoryEntry['pilot']['studyMode'];
type MetricTone = 'teal' | 'emerald' | 'amber' | 'blue' | 'violet';
type InviteToastTone = 'success' | 'error' | 'info';

interface AdminInviteEmailDraft {
  contextKey: string;
  token: string;
  activationUrl: string;
  recipientName: string;
  recipientEmail: string;
  organizationId: string;
  teamId: string;
  organizationName: string;
  teamName: string;
  pilotName?: string;
  cohortId?: string;
  cohortName?: string;
  subject: string;
  introText: string;
  detailText: string;
  buttonLabel: string;
}

const studyModeOptions: Array<{ value: '' | StudyModeValue; label: string }> = [
  { value: '', label: 'All study modes' },
  { value: 'research', label: 'Research' },
  { value: 'pilot', label: 'Pilot' },
  { value: 'operational', label: 'Operational' },
];

const getStudyModeMeta = (studyMode: StudyModeValue) => {
  switch (studyMode) {
    case 'research':
      return {
        label: 'Research',
        badgeClassName: 'border-violet-400/25 bg-violet-400/10 text-violet-200',
        dotClassName: 'bg-violet-300',
        legendCountClassName: 'text-violet-200',
      };
    case 'pilot':
      return {
        label: 'Pilot',
        badgeClassName: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
        dotClassName: 'bg-emerald-300',
        legendCountClassName: 'text-emerald-200',
      };
    case 'operational':
      return {
        label: 'Operational',
        badgeClassName: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
        dotClassName: 'bg-sky-300',
        legendCountClassName: 'text-sky-200',
      };
    default:
      return {
        label: studyMode,
        badgeClassName: 'border-white/15 bg-white/10 text-white/80',
        dotClassName: 'bg-white/60',
        legendCountClassName: 'text-white/80',
      };
  }
};

const getMetricValueClassName = (value: number, tone: MetricTone) => {
  if (value <= 0) {
    return 'text-white/30';
  }

  switch (tone) {
    case 'emerald':
      return 'text-emerald-200';
    case 'amber':
      return 'text-amber-200';
    case 'blue':
      return 'text-sky-200';
    case 'violet':
      return 'text-violet-200';
    case 'teal':
    default:
      return 'text-[#7cefd6]';
  }
};

const getAthleteInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

const getEnrollmentChipClassName = (status: PilotDashboardAthleteRosterEntry['enrollmentStatus']) => {
  switch (status) {
    case 'active':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
    case 'pending':
      return 'border-amber-400/25 bg-amber-400/10 text-amber-200';
    default:
      return 'border-white/15 bg-white/[0.04] text-white/55';
  }
};

const getEnrollmentChipLabel = (status: PilotDashboardAthleteRosterEntry['enrollmentStatus']) => {
  switch (status) {
    case 'active':
      return 'Enrolled';
    case 'pending':
      return 'Pending';
    default:
      return 'Team only';
  }
};

const getConsentChipClassName = (status: PilotDashboardAthleteTeamContext['consentStatus']) => {
  switch (status) {
    case 'complete':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
    case 'pending':
      return 'border-amber-400/25 bg-amber-400/10 text-amber-200';
    default:
      return 'border-white/15 bg-white/[0.04] text-white/50';
  }
};

const getConsentChipLabel = (status: PilotDashboardAthleteTeamContext['consentStatus']) => {
  switch (status) {
    case 'complete':
      return 'Consent done';
    case 'pending':
      return 'Consent pending';
    default:
      return 'Consent unknown';
  }
};

const hasAssignedIntake = (context: Pick<PilotDashboardAthleteTeamContext, 'intakeQuestionCount'>) =>
  context.intakeQuestionCount > 0;

const getIntakeChipClassName = (context: Pick<PilotDashboardAthleteTeamContext, 'intakeCompleted' | 'intakeQuestionCount'>) => {
  if (!hasAssignedIntake(context)) {
    return 'border-white/15 bg-white/[0.04] text-white/45';
  }
  if (context.intakeCompleted) {
    return 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100';
  }
  return 'border-amber-400/25 bg-amber-400/10 text-amber-100';
};

const getIntakeChipLabel = (context: Pick<PilotDashboardAthleteTeamContext, 'intakeCompleted' | 'intakeQuestionCount'>) => {
  if (!hasAssignedIntake(context)) return 'No intake assigned';
  if (context.intakeCompleted) return 'Intake done';
  return 'Intake pending';
};

const getTeamCountLabel = (count: number) => `${count} team${count === 1 ? '' : 's'}`;

const getTeamContextSubline = (context: PilotDashboardAthleteTeamContext) =>
  [context.organizationName, context.pilotName, context.cohortName].filter(Boolean).join(' - ') ||
  'No pilot enrollment';

const getAthleteTeamContexts = (athlete: PilotDashboardAthleteRosterEntry): PilotDashboardAthleteTeamContext[] => {
  if (athlete.teamContexts?.length) return athlete.teamContexts;

  return [
    {
      key: athlete.teamId || athlete.athleteUserId,
      teamId: athlete.teamId,
      teamName: athlete.teamName,
      organizationId: athlete.organizationId,
      organizationName: athlete.organizationName,
      pilotId: athlete.pilotId,
      pilotName: athlete.pilotName,
      cohortId: undefined,
      cohortName: athlete.cohortName,
      enrollmentStatus: athlete.enrollmentStatus,
      consentStatus: 'unknown',
      onboardingStatus: athlete.onboardingStatus,
      intakeCompleted: athlete.intakeCompleted,
      intakeQuestionCount: athlete.intakeQuestionCount || 0,
      intakeRequiredQuestionCount: athlete.intakeRequiredQuestionCount || 0,
      phone: athlete.phone,
      role: athlete.role,
      intake: athlete.intake,
    },
  ];
};

const PulseCheckPilotDashboardIndexPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const currentUserLoading = useUserLoading();
  const [entries, setEntries] = useState<PilotDashboardDirectoryEntry[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [studyMode, setStudyMode] = useState<'' | StudyModeValue>('');
  const [pilotSearchQuery, setPilotSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState('Active Pilots');
  const [athletes, setAthletes] = useState<PilotDashboardAthleteRosterEntry[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(true);
  const [athletesError, setAthletesError] = useState<string | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [inviteEmailDraft, setInviteEmailDraft] = useState<AdminInviteEmailDraft | null>(null);
  const [preparingInviteKey, setPreparingInviteKey] = useState<string | null>(null);
  const [sendingInviteKey, setSendingInviteKey] = useState<string | null>(null);
  const [inviteToast, setInviteToast] = useState<{ type: InviteToastTone; text: string } | null>(null);
  const [showDashboardSignIn, setShowDashboardSignIn] = useState(false);
  const loadRequestIdRef = useRef(0);
  const athletesRequestIdRef = useRef(0);
  const currentAccountEmail = currentUser?.email || auth.currentUser?.email || '';
  const canLoadLiveDashboardData = !currentUserLoading && Boolean(currentAccountEmail);

  const load = async (mode: 'initial' | 'refresh' = 'initial') => {
    const requestId = ++loadRequestIdRef.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      setDemoModeEnabled(pulseCheckPilotDashboardService.isDemoModeEnabled());
      const nextEntries = await pulseCheckPilotDashboardService.listActivePilotDirectory();
      if (requestId !== loadRequestIdRef.current) return;
      setEntries(nextEntries);
    } catch (loadError: any) {
      if (requestId !== loadRequestIdRef.current) return;
      setError(loadError?.message || 'Failed to load active pilots.');
    } finally {
      if (requestId !== loadRequestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!pulseCheckPilotDashboardService.isDemoModeEnabled() && !canLoadLiveDashboardData) {
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoadLiveDashboardData, currentAccountEmail]);

  const loadAthletes = async () => {
    const requestId = ++athletesRequestIdRef.current;
    setAthletesLoading(true);
    setAthletesError(null);
    try {
      const nextAthletes = await pulseCheckPilotDashboardService.getPilotDashboardAthletes({
        organizationId: organizationId || undefined,
        teamId: teamId || undefined,
        studyMode: studyMode || undefined,
      });
      if (requestId !== athletesRequestIdRef.current) return;
      setAthletes(nextAthletes);
    } catch (athletesLoadError: any) {
      if (requestId !== athletesRequestIdRef.current) return;
      setAthletesError(athletesLoadError?.message || 'Failed to load athletes.');
    } finally {
      if (requestId !== athletesRequestIdRef.current) return;
      setAthletesLoading(false);
    }
  };

  useEffect(() => {
    if (!pulseCheckPilotDashboardService.isDemoModeEnabled() && !canLoadLiveDashboardData) {
      setAthletesLoading(false);
      return;
    }
    void loadAthletes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, teamId, studyMode, demoModeEnabled, canLoadLiveDashboardData, currentAccountEmail]);

  useEffect(() => {
    setInviteEmailDraft(null);
    setInviteToast(null);
    setPreparingInviteKey(null);
    setSendingInviteKey(null);
  }, [selectedAthleteId]);

  const toggleDemoMode = () => {
    const nextValue = !pulseCheckPilotDashboardService.isDemoModeEnabled();
    pulseCheckPilotDashboardService.setDemoModeEnabled(nextValue);
    if (nextValue) {
      pulseCheckPilotDashboardService.resetDemoModeData();
    }
    setOrganizationId('');
    setTeamId('');
    setStudyMode('');
    setPilotSearchQuery('');
    void load('refresh');
  };

  const resetDemoModeData = () => {
    pulseCheckPilotDashboardService.resetDemoModeData();
    void load('refresh');
  };

  const organizations = useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter((entry) => !studyMode || entry.pilot.studyMode === studyMode)
            .map((entry) => [entry.organization.id, entry.organization])
        ).values()
      ).sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [entries, studyMode]
  );

  const teams = useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter((entry) => !studyMode || entry.pilot.studyMode === studyMode)
            .filter((entry) => !organizationId || entry.organization.id === organizationId)
            .map((entry) => [entry.team.id, entry.team])
        ).values()
      ).sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [entries, organizationId, studyMode]
  );

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (organizationId && entry.organization.id !== organizationId) return false;
        if (teamId && entry.team.id !== teamId) return false;
        if (studyMode && entry.pilot.studyMode !== studyMode) return false;
        if (pilotSearchQuery.trim()) {
          const normalizedQuery = pilotSearchQuery.trim().toLowerCase();
          const searchableText = [
            entry.pilot.name,
            entry.pilot.id,
            entry.pilot.studyMode,
            entry.team.displayName,
            entry.team.id,
            entry.organization.displayName,
            entry.organization.id,
            ...entry.cohorts.map((cohort) => cohort.name),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!searchableText.includes(normalizedQuery)) return false;
        }
        return true;
      }),
    [entries, organizationId, pilotSearchQuery, studyMode, teamId]
  );

  const summary = useMemo(
    () => ({
      activePilots: filteredEntries.length,
      activeAthletes: filteredEntries.reduce((sum, entry) => sum + entry.activeEnrollmentCount, 0),
      hypothesisCount: filteredEntries.reduce((sum, entry) => sum + entry.hypothesisCount, 0),
      unsupportedHypotheses: filteredEntries.reduce((sum, entry) => sum + entry.unsupportedHypothesisCount, 0),
      promisingHypotheses: filteredEntries.reduce((sum, entry) => sum + entry.promisingHypothesisCount, 0),
      highConfidenceHypotheses: filteredEntries.reduce((sum, entry) => sum + entry.highConfidenceHypothesisCount, 0),
      avgEngineCoverageRate:
        filteredEntries.length > 0
          ? filteredEntries.reduce((sum, entry) => sum + entry.engineCoverageRate, 0) / filteredEntries.length
          : 0,
      avgStablePatternRate:
        filteredEntries.length > 0
          ? filteredEntries.reduce((sum, entry) => sum + entry.stablePatternRate, 0) / filteredEntries.length
          : 0,
      avgEvidenceRecordsPerAthlete:
        filteredEntries.length > 0
          ? filteredEntries.reduce((sum, entry) => sum + entry.avgEvidenceRecordsPerActiveAthlete, 0) /
            filteredEntries.length
          : 0,
      avgProjectionsPerAthlete:
        filteredEntries.length > 0
          ? filteredEntries.reduce((sum, entry) => sum + entry.avgRecommendationProjectionsPerActiveAthlete, 0) /
            filteredEntries.length
          : 0,
    }),
    [filteredEntries]
  );

  const filteredAthletes = useMemo(() => {
    const normalizedQuery = pilotSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return athletes;
    return athletes.filter((athlete) => {
      const searchableText = [
        athlete.displayName,
        athlete.email,
        athlete.teamName,
        athlete.organizationName,
        athlete.pilotName,
        athlete.cohortName,
        athlete.phone,
        ...getAthleteTeamContexts(athlete).flatMap((context) => [
          context.teamName,
          context.organizationName,
          context.pilotName,
          context.cohortName,
        ]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [athletes, pilotSearchQuery]);

  const selectedAthlete = useMemo(
    () => filteredAthletes.find((athlete) => athlete.athleteUserId === selectedAthleteId) || null,
    [filteredAthletes, selectedAthleteId]
  );
  const selectedAthleteTeamContexts = selectedAthlete ? getAthleteTeamContexts(selectedAthlete) : [];
  const inviteEmailPreview = useMemo(
    () =>
      inviteEmailDraft
        ? renderAthleteInviteEmail({
            recipientName: inviteEmailDraft.recipientName,
            organizationName: inviteEmailDraft.organizationName,
            teamName: inviteEmailDraft.teamName,
            pilotName: inviteEmailDraft.pilotName,
            activationUrl: inviteEmailDraft.activationUrl,
            inviteSource: 'admin',
            subjectOverride: inviteEmailDraft.subject,
            introText: inviteEmailDraft.introText,
            detailText: inviteEmailDraft.detailText,
            buttonLabel: inviteEmailDraft.buttonLabel,
          })
        : null,
    [inviteEmailDraft]
  );

  const showInviteToast = (type: InviteToastTone, text: string) => {
    setInviteToast({ type, text });
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setInviteToast(null), 5000);
    }
  };

  const resolveInviteLinkForContext = async (
    athlete: PilotDashboardAthleteRosterEntry,
    context: PilotDashboardAthleteTeamContext
  ): Promise<PulseCheckInviteLink> => {
    const recipientEmail = normalizeEmail(athlete.email);
    if (!recipientEmail) {
      throw new Error('This athlete does not have an email on file.');
    }

    const adminUser = auth.currentUser;
    const inviteId = await pulseCheckProvisioningService.createTeamAccessInviteLink({
      organizationId: context.organizationId || athlete.organizationId,
      teamId: context.teamId,
      teamMembershipRole: 'athlete',
      redemptionMode: 'single-use',
      revokeExistingMatchingLinks: false,
      pilotId: context.pilotId,
      cohortId: context.cohortId,
      pilotName: context.pilotName,
      cohortName: context.cohortName,
      targetEmail: recipientEmail,
      recipientName: athlete.displayName,
      createdByUserId: adminUser?.uid || 'pulsecheck-admin',
      createdByEmail: adminUser?.email || '',
      createdByName: adminUser?.displayName || 'PulseCheck Admin',
      notifyCoachOnAccept: false,
    });

    const links = await pulseCheckProvisioningService.listTeamInviteLinks(context.teamId);
    const normalizedPilotId = context.pilotId || '';
    const normalizedCohortId = context.cohortId || '';
    const link =
      links.find((candidate) => candidate.id === inviteId || candidate.token === inviteId) ||
      links.find(
        (candidate) =>
          candidate.inviteType === 'team-access' &&
          candidate.teamMembershipRole === 'athlete' &&
          candidate.status === 'active' &&
          normalizeEmail(candidate.targetEmail) === recipientEmail &&
          (candidate.pilotId || '') === normalizedPilotId &&
          (candidate.cohortId || '') === normalizedCohortId
      );

    if (!link?.activationUrl) {
      throw new Error('Could not resolve an active invite link for this athlete.');
    }

    return link;
  };

  const buildAdminInviteDraft = (
    athlete: PilotDashboardAthleteRosterEntry,
    context: PilotDashboardAthleteTeamContext,
    link: PulseCheckInviteLink
  ): AdminInviteEmailDraft => {
    const defaults = buildAthleteInviteEmailDraft({
      recipientName: athlete.displayName,
      organizationName: context.organizationName || athlete.organizationName,
      teamName: context.teamName || athlete.teamName,
      pilotName: context.pilotName || athlete.pilotName,
      inviteSource: 'admin',
    });

    return {
      contextKey: context.key,
      token: link.token,
      activationUrl: link.activationUrl,
      recipientName: athlete.displayName,
      recipientEmail: normalizeEmail(athlete.email),
      organizationId: context.organizationId || athlete.organizationId,
      teamId: context.teamId,
      organizationName: context.organizationName || athlete.organizationName,
      teamName: context.teamName || athlete.teamName,
      pilotName: context.pilotName || athlete.pilotName,
      cohortId: context.cohortId,
      cohortName: context.cohortName || athlete.cohortName,
      subject: defaults.subject,
      introText: defaults.introText,
      detailText: defaults.detailText,
      buttonLabel: defaults.buttonLabel,
    };
  };

  const prepareInviteEmailPreview = async (
    athlete: PilotDashboardAthleteRosterEntry,
    context: PilotDashboardAthleteTeamContext
  ) => {
    if (!athlete.email) {
      showInviteToast('error', 'This athlete does not have an email on file.');
      return;
    }

    setPreparingInviteKey(context.key);
    try {
      if (demoModeEnabled) {
        const defaults = buildAthleteInviteEmailDraft({
          recipientName: athlete.displayName,
          organizationName: context.organizationName || athlete.organizationName,
          teamName: context.teamName || athlete.teamName,
          pilotName: context.pilotName || athlete.pilotName,
          inviteSource: 'admin',
        });
        setInviteEmailDraft({
          contextKey: context.key,
          token: 'demo-preview-token',
          activationUrl: 'https://fitwithpulse.ai/PulseCheck/team-invite/demo-preview-token',
          recipientName: athlete.displayName,
          recipientEmail: normalizeEmail(athlete.email),
          organizationId: context.organizationId || athlete.organizationId,
          teamId: context.teamId,
          organizationName: context.organizationName || athlete.organizationName,
          teamName: context.teamName || athlete.teamName,
          pilotName: context.pilotName || athlete.pilotName,
          cohortId: context.cohortId,
          cohortName: context.cohortName || athlete.cohortName,
          subject: defaults.subject,
          introText: defaults.introText,
          detailText: defaults.detailText,
          buttonLabel: defaults.buttonLabel,
        });
        return;
      }

      const link = await resolveInviteLinkForContext(athlete, context);
      setInviteEmailDraft(buildAdminInviteDraft(athlete, context, link));
    } catch (error: any) {
      showInviteToast('error', error?.message || 'Could not prepare the invite email preview.');
    } finally {
      setPreparingInviteKey(null);
    }
  };

  const sendAdminInviteEmail = async (draft: AdminInviteEmailDraft) => {
    if (!draft.recipientEmail) {
      showInviteToast('error', 'This athlete does not have an email on file.');
      return;
    }

    if (demoModeEnabled) {
      showInviteToast('success', `Demo invite email prepared for ${draft.recipientEmail}.`);
      setInviteEmailDraft(null);
      return;
    }

    const adminUser = auth.currentUser;
    setSendingInviteKey(draft.contextKey);
    try {
      const response = await fetch('/.netlify/functions/send-pulsecheck-athlete-invite-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: draft.recipientEmail,
          activationUrl: draft.activationUrl,
          recipientName: draft.recipientName,
          organizationName: draft.organizationName,
          teamName: draft.teamName,
          pilotName: draft.pilotName,
          inviteSource: 'admin',
          subjectOverride: draft.subject,
          introText: draft.introText,
          detailText: draft.detailText,
          buttonLabel: draft.buttonLabel,
        }),
      });
      const result = await response.json().catch(() => ({ success: false }));
      const emailSent = response.ok && result?.success === true;

      await pulseCheckProvisioningService.recordAdminActivationEmailResult({
        token: draft.token,
        success: emailSent,
        messageId: result?.messageId,
        sentByUserId: adminUser?.uid || 'pulsecheck-admin',
        sentByEmail: adminUser?.email || '',
        targetEmail: draft.recipientEmail,
        organizationId: draft.organizationId,
        teamId: draft.teamId,
        errorMessage: emailSent ? '' : String(result?.error || 'Send failed'),
      });

      if (!emailSent) {
        throw new Error(String(result?.error || 'The email service did not confirm delivery.'));
      }

      showInviteToast('success', `Invite email sent to ${draft.recipientEmail}.`);
      setInviteEmailDraft(null);
      void loadAthletes();
    } catch (error: any) {
      showInviteToast('error', error?.message || 'Could not send the invite email.');
    } finally {
      setSendingInviteKey(null);
    }
  };

  const sendDefaultAdminInviteEmail = async (
    athlete: PilotDashboardAthleteRosterEntry,
    context: PilotDashboardAthleteTeamContext
  ) => {
    if (!athlete.email) {
      showInviteToast('error', 'This athlete does not have an email on file.');
      return;
    }

    setSendingInviteKey(context.key);
    try {
      if (demoModeEnabled) {
        showInviteToast('success', `Demo invite email prepared for ${athlete.email}.`);
        setSendingInviteKey(null);
        return;
      }

      const link = await resolveInviteLinkForContext(athlete, context);
      await sendAdminInviteEmail(buildAdminInviteDraft(athlete, context, link));
    } catch (error: any) {
      showInviteToast('error', error?.message || 'Could not send the invite email.');
      setSendingInviteKey(null);
    }
  };

  const operationalWatchListSummary = useMemo(
    () =>
      filteredEntries.reduce(
        (accumulator, entry) => {
          const watchListSummary = entry.operationalWatchListSummary;
          if (!watchListSummary) return accumulator;
          accumulator.pilotsWithWatchList += watchListSummary.stateCount > 0 ? 1 : 0;
          accumulator.stateCount += watchListSummary.stateCount;
          accumulator.requestedCount += watchListSummary.requestedCount;
          accumulator.activeCount += watchListSummary.activeCount;
          accumulator.suppressSurveysCount += watchListSummary.suppressSurveysCount;
          accumulator.suppressAssignmentsCount += watchListSummary.suppressAssignmentsCount;
          accumulator.suppressNudgesCount += watchListSummary.suppressNudgesCount;
          accumulator.excludeFromAdherenceCount += watchListSummary.excludeFromAdherenceCount;
          accumulator.manualHoldCount += watchListSummary.manualHoldCount;
          return accumulator;
        },
        {
          pilotsWithWatchList: 0,
          stateCount: 0,
          requestedCount: 0,
          activeCount: 0,
          suppressSurveysCount: 0,
          suppressAssignmentsCount: 0,
          suppressNudgesCount: 0,
          excludeFromAdherenceCount: 0,
          manualHoldCount: 0,
        }
      ),
    [filteredEntries]
  );

  const visibleOrganizationCount = useMemo(
    () => new Set(filteredEntries.map((entry) => entry.organization.id)).size,
    [filteredEntries]
  );

  const visibleTeamCount = useMemo(() => new Set(filteredEntries.map((entry) => entry.team.id)).size, [filteredEntries]);

  const organizationDirectoryRows = useMemo(() => {
    const rows = new Map<
      string,
      {
        organization: PilotDashboardDirectoryEntry['organization'];
        teamIds: Set<string>;
        studyModes: Set<StudyModeValue>;
        pilotCount: number;
        activeAthletes: number;
        hypothesisCount: number;
        unsupportedHypothesisCount: number;
        avgCoverageTotal: number;
        avgStableRateTotal: number;
      }
    >();

    filteredEntries.forEach((entry) => {
      const current =
        rows.get(entry.organization.id) || {
          organization: entry.organization,
          teamIds: new Set<string>(),
          studyModes: new Set<StudyModeValue>(),
          pilotCount: 0,
          activeAthletes: 0,
          hypothesisCount: 0,
          unsupportedHypothesisCount: 0,
          avgCoverageTotal: 0,
          avgStableRateTotal: 0,
        };

      current.teamIds.add(entry.team.id);
      current.studyModes.add(entry.pilot.studyMode);
      current.pilotCount += 1;
      current.activeAthletes += entry.activeEnrollmentCount;
      current.hypothesisCount += entry.hypothesisCount;
      current.unsupportedHypothesisCount += entry.unsupportedHypothesisCount;
      current.avgCoverageTotal += entry.engineCoverageRate;
      current.avgStableRateTotal += entry.stablePatternRate;
      rows.set(entry.organization.id, current);
    });

    return Array.from(rows.values())
      .map((row) => ({
        ...row,
        teamCount: row.teamIds.size,
        studyModeList: Array.from(row.studyModes),
        avgCoverageRate: row.pilotCount > 0 ? row.avgCoverageTotal / row.pilotCount : 0,
        avgStablePatternRate: row.pilotCount > 0 ? row.avgStableRateTotal / row.pilotCount : 0,
      }))
      .sort((left, right) => left.organization.displayName.localeCompare(right.organization.displayName));
  }, [filteredEntries]);

  const teamDirectoryRows = useMemo(() => {
    const rows = new Map<
      string,
      {
        team: PilotDashboardDirectoryEntry['team'];
        organization: PilotDashboardDirectoryEntry['organization'];
        studyModes: Set<StudyModeValue>;
        pilotCount: number;
        activeAthletes: number;
        activeCohorts: number;
        hypothesisCount: number;
        unsupportedHypothesisCount: number;
        avgCoverageTotal: number;
        avgStableRateTotal: number;
      }
    >();

    filteredEntries.forEach((entry) => {
      const current =
        rows.get(entry.team.id) || {
          team: entry.team,
          organization: entry.organization,
          studyModes: new Set<StudyModeValue>(),
          pilotCount: 0,
          activeAthletes: 0,
          activeCohorts: 0,
          hypothesisCount: 0,
          unsupportedHypothesisCount: 0,
          avgCoverageTotal: 0,
          avgStableRateTotal: 0,
        };

      current.studyModes.add(entry.pilot.studyMode);
      current.pilotCount += 1;
      current.activeAthletes += entry.activeEnrollmentCount;
      current.activeCohorts += entry.activeCohortCount || entry.cohorts.length;
      current.hypothesisCount += entry.hypothesisCount;
      current.unsupportedHypothesisCount += entry.unsupportedHypothesisCount;
      current.avgCoverageTotal += entry.engineCoverageRate;
      current.avgStableRateTotal += entry.stablePatternRate;
      rows.set(entry.team.id, current);
    });

    return Array.from(rows.values())
      .map((row) => ({
        ...row,
        studyModeList: Array.from(row.studyModes),
        avgCoverageRate: row.pilotCount > 0 ? row.avgCoverageTotal / row.pilotCount : 0,
        avgStablePatternRate: row.pilotCount > 0 ? row.avgStableRateTotal / row.pilotCount : 0,
      }))
      .sort(
        (left, right) =>
          left.organization.displayName.localeCompare(right.organization.displayName) ||
          left.team.displayName.localeCompare(right.team.displayName)
      );
  }, [filteredEntries]);

  const studyModeCounts = useMemo(
    () =>
      filteredEntries.reduce(
        (accumulator, entry) => {
          accumulator[entry.pilot.studyMode] += 1;
          return accumulator;
        },
        { research: 0, pilot: 0, operational: 0 }
      ),
    [filteredEntries]
  );

  const primarySummaryCards: Array<{
    label: string;
    value: string;
    icon: LucideIcon;
    iconClassName: string;
    shellClassName: string;
    metricKey: PilotDashboardMetricExplanationKey;
    tone: MetricTone;
    numericValue: number;
    testId?: string;
  }> = [
    {
      label: 'Active Pilots',
      value: String(summary.activePilots),
      icon: FlaskConical,
      iconClassName: 'text-[#00d4aa]',
      shellClassName: 'border-[#00d4aa]/20 bg-[#00d4aa]/10',
      metricKey: 'active-pilots',
      tone: 'teal',
      numericValue: summary.activePilots,
    },
    {
      label: 'Active Athletes',
      value: String(summary.activeAthletes),
      icon: Users2,
      iconClassName: 'text-emerald-200',
      shellClassName: 'border-emerald-400/20 bg-emerald-400/10',
      metricKey: 'active-pilot-athletes',
      tone: 'emerald',
      numericValue: summary.activeAthletes,
    },
    {
      label: 'Unsupported Hyp.',
      value: String(summary.unsupportedHypotheses),
      icon: Activity,
      iconClassName: 'text-amber-200',
      shellClassName: 'border-amber-400/20 bg-amber-400/10',
      metricKey: 'unsupported-hypotheses',
      tone: 'amber',
      numericValue: summary.unsupportedHypotheses,
    },
    {
      label: 'Coverage',
      value: formatPercent(summary.avgEngineCoverageRate),
      icon: Layers3,
      iconClassName: 'text-sky-200',
      shellClassName: 'border-sky-400/20 bg-sky-400/10',
      metricKey: 'coverage',
      tone: 'blue',
      numericValue: summary.avgEngineCoverageRate,
    },
    {
      label: 'Stable Rate',
      value: formatPercent(summary.avgStablePatternRate),
      icon: Users2,
      iconClassName: 'text-violet-200',
      shellClassName: 'border-violet-400/20 bg-violet-400/10',
      metricKey: 'stable-rate',
      tone: 'violet',
      numericValue: summary.avgStablePatternRate,
      testId: 'pilot-dashboard-metric-help-stable-rate',
    },
  ];

  const secondarySummaryCards: Array<{
    label: string;
    value: string;
    metricKey: PilotDashboardMetricExplanationKey;
    tone: MetricTone;
    numericValue: number;
  }> = [
    {
      label: 'Avg Evidence',
      value: formatAverage(summary.avgEvidenceRecordsPerAthlete),
      metricKey: 'avg-evidence',
      tone: 'violet',
      numericValue: summary.avgEvidenceRecordsPerAthlete,
    },
    {
      label: 'Promising Hypotheses',
      value: String(summary.promisingHypotheses),
      metricKey: 'promising-hypotheses',
      tone: 'teal',
      numericValue: summary.promisingHypotheses,
    },
    {
      label: 'High Confidence Hypotheses',
      value: String(summary.highConfidenceHypotheses),
      metricKey: 'high-confidence-hypotheses',
      tone: 'emerald',
      numericValue: summary.highConfidenceHypotheses,
    },
    {
      label: 'Avg Projections / Athlete',
      value: formatAverage(summary.avgProjectionsPerAthlete),
      metricKey: 'avg-projections-per-athlete',
      tone: 'blue',
      numericValue: summary.avgProjectionsPerAthlete,
    },
  ];

  const watchListCards = [
    { label: 'Pilots with watch list', value: operationalWatchListSummary.pilotsWithWatchList, flagged: false },
    { label: 'Active states', value: operationalWatchListSummary.activeCount, flagged: operationalWatchListSummary.activeCount > 0 },
    {
      label: 'Review queued states',
      value: operationalWatchListSummary.requestedCount,
      flagged: operationalWatchListSummary.requestedCount > 0,
    },
    {
      label: 'Survey suppressions',
      value: operationalWatchListSummary.suppressSurveysCount,
      flagged: operationalWatchListSummary.suppressSurveysCount > 0,
    },
    {
      label: 'Assignment suppressions',
      value: operationalWatchListSummary.suppressAssignmentsCount,
      flagged: operationalWatchListSummary.suppressAssignmentsCount > 0,
    },
    {
      label: 'Nudge suppressions',
      value: operationalWatchListSummary.suppressNudgesCount,
      flagged: operationalWatchListSummary.suppressNudgesCount > 0,
    },
    {
      label: 'Adherence exclusions',
      value: operationalWatchListSummary.excludeFromAdherenceCount,
      flagged: operationalWatchListSummary.excludeFromAdherenceCount > 0,
    },
    {
      label: 'Manual holds',
      value: operationalWatchListSummary.manualHoldCount,
      flagged: operationalWatchListSummary.manualHoldCount > 0,
    },
  ];

  const handleSidebarNavigation = (item: {
    label: string;
    destination: { type: 'section'; id: string };
  }) => {
    setActiveSidebarItem(item.label);

    if (typeof document === 'undefined') return;
    const nextSection = document.getElementById(item.destination.id);
    if (!nextSection) return;

    nextSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${item.destination.id}`);
    }
  };

  const sidebarSections: Array<{
    label: string;
    items: Array<{
      label: string;
      value: number;
      icon: LucideIcon;
      destination: { type: 'section'; id: string };
    }>;
  }> = [
    {
      label: 'Monitoring',
      items: [
        { label: 'Active Pilots', value: summary.activePilots, icon: Activity, destination: { type: 'section', id: 'pilot-directory' } },
        { label: 'Athletes', value: filteredAthletes.length, icon: Users2, destination: { type: 'section', id: 'athletes-directory' } },
        { label: 'Hypotheses', value: summary.hypothesisCount, icon: Layers3, destination: { type: 'section', id: 'aggregate-summary' } },
        { label: 'Watch List', value: operationalWatchListSummary.stateCount, icon: ShieldAlert, destination: { type: 'section', id: 'watch-list-summary' } },
      ],
    },
    {
      label: 'Directory',
      items: [
        {
          label: 'Organizations',
          value: visibleOrganizationCount,
          icon: Building2,
          destination: { type: 'section', id: 'organizations-directory' },
        },
        {
          label: 'Teams',
          value: visibleTeamCount,
          icon: FlaskConical,
          destination: { type: 'section', id: 'teams-directory' },
        },
      ],
    },
  ];

  const areFiltersActive = Boolean(organizationId || teamId || studyMode || pilotSearchQuery.trim());
  const pilotCountText = loading ? 'Loading pilots...' : error ? 'Directory unavailable' : getPilotCountLabel(filteredEntries.length);
  const accountEmail = currentAccountEmail;
  const accountName =
    currentUser?.displayName ||
    currentUser?.username ||
    auth.currentUser?.displayName ||
    accountEmail ||
    'Not signed in';
  const accountInitials = getAthleteInitials(accountName || accountEmail || 'Admin');
  const dashboardLoginPath = '/admin/pulsecheckPilotDashboard?signin=1';

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.signin === '1') {
      setShowDashboardSignIn(true);
    }
  }, [router.isReady, router.query.signin]);

  const closeDashboardLogin = () => {
    setShowDashboardSignIn(false);
    if (router.query.signin) {
      void router.replace('/admin/pulsecheckPilotDashboard', undefined, { shallow: true });
    }
  };

  const openDashboardLogin = () => {
    setShowDashboardSignIn(true);
    void router.replace(dashboardLoginPath, undefined, { shallow: true });
  };

  const switchDashboardAccount = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('[PilotDashboard] sign out failed', error);
    } finally {
      setShowDashboardSignIn(true);
      void router.replace(dashboardLoginPath, undefined, { shallow: true });
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Pilot Dashboard</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Fraunces:opsz,wght@9..144,300..700&display=swap"
          rel="stylesheet"
        />
          <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800,900&display=swap" />
      </Head>

      <div className="pilot-dashboard-theme pilot-font-body min-h-screen text-white">
        <div className="pilot-ambient-layer" aria-hidden="true">
          <div className="pilot-ambient-orb pilot-ambient-orb-teal" />
          <div className="pilot-ambient-orb pilot-ambient-orb-blue" />
          <div className="pilot-ambient-orb pilot-ambient-orb-amber" />
        </div>

        <div className="relative z-10">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(7,9,15,0.82)] backdrop-blur-2xl">
            <div className="flex h-14 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-4">
                <a href="/admin" className="pilot-font-display flex items-center gap-2 text-sm font-bold tracking-[-0.03em] text-white">
                  <span className="pilot-logo-dot" />
                  PulseCheck
                </a>
                <div className="hidden h-5 w-px bg-white/10 sm:block" />
                <span className="pilot-font-display hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35 sm:block">
                  Admin
                </span>
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[11px] text-white/65">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[10px] font-bold text-[#9cf4e2]">
                    {accountEmail ? accountInitials : <UserCircle2 className="h-3.5 w-3.5" />}
                  </span>
                  <span className="hidden min-w-0 leading-tight sm:block">
                    <span className="block max-w-[180px] truncate text-white/80">{accountName}</span>
                    <span className="block max-w-[180px] truncate text-[9px] text-white/35">
                      {accountEmail || 'No account session'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={accountEmail ? switchDashboardAccount : openDashboardLogin}
                    className="ml-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    {accountEmail ? <LogOut className="h-3 w-3" /> : <UserCircle2 className="h-3 w-3" />}
                    {accountEmail ? 'Switch account' : 'Log in'}
                  </button>
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/60 sm:inline-flex">
                  <span className={`h-2 w-2 rounded-full ${demoModeEnabled ? 'bg-amber-300' : 'bg-[#00d4aa]'}`} />
                  {demoModeEnabled ? 'Demo dataset' : 'Live dataset'}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/70">
                  <span className="pilot-font-mono">{pilotCountText}</span>
                </div>
              </div>
            </div>
          </header>

          <div className="grid min-h-[calc(100vh-56px)] lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="hidden border-r border-white/10 lg:flex lg:flex-col">
              <div className="sticky top-14 flex h-[calc(100vh-56px)] flex-col px-0 py-6">
                {sidebarSections.map((section) => (
                  <div key={section.label} className="mb-6">
                    <div className="px-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/25">
                      {section.label}
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => handleSidebarNavigation(item)}
                            aria-current={activeSidebarItem === item.label ? 'page' : undefined}
                            className={`relative flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm transition ${
                              activeSidebarItem === item.label
                                ? 'bg-white/[0.04] text-white'
                                : 'text-white/55 hover:bg-white/[0.03] hover:text-white/80'
                            }`}
                          >
                            {activeSidebarItem === item.label ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-[#00d4aa]" /> : null}
                            <Icon className={`h-4 w-4 shrink-0 ${activeSidebarItem === item.label ? 'text-[#00d4aa]' : 'text-white/35'}`} />
                            <span>{item.label}</span>
                            <span className="pilot-font-mono ml-auto rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/70">
                              {item.value}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="mt-auto border-t border-white/10 px-5 pt-5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/25">Pilot Status</div>
                  <div className="mt-3 space-y-2.5">
                    {(['research', 'pilot', 'operational'] as StudyModeValue[]).map((mode) => {
                      const meta = getStudyModeMeta(mode);
                      return (
                        <div key={mode} className="flex items-center gap-3 text-sm">
                          <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClassName}`} />
                          <span className="text-white/50">{meta.label}</span>
                          <span className={`pilot-font-mono ml-auto text-[11px] ${meta.legendCountClassName}`}>
                            {studyModeCounts[mode]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </aside>

            <main className="min-w-0">
              <section className="pilot-slide-up border-b border-white/10 px-4 py-8 sm:px-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-3xl">
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#00d4aa]">
                      PulseCheck Admin
                    </div>
                    <h1 className="pilot-font-display text-3xl font-bold tracking-[-0.04em] text-white sm:text-[2.2rem]">
                      Active Pilot Dashboard
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55 sm:text-[15px]">
                      Pilot-native directory for active PulseCheck pilots. Review pilot-scoped athletes, engine health,
                      findings, and manual hypothesis tracking inside the active enrollment boundary.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 xl:justify-end">
                    <LocalFirebaseModeButton />

                    {demoModeEnabled ? (
                      <button
                        type="button"
                        onClick={resetDemoModeData}
                        data-testid="pilot-dashboard-demo-reset"
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-400/15"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Reset Demo Data
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={toggleDemoMode}
                      data-testid="pilot-dashboard-demo-toggle"
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                        demoModeEnabled
                          ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15'
                          : 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15'
                      }`}
                    >
                      <MonitorPlay className="h-4 w-4" />
                      {demoModeEnabled ? 'Exit Demo Mode' : 'Switch To Demo Mode'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void load('refresh')}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                      {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>
                </div>

                {demoModeEnabled ? (
                  <div
                    data-testid="pilot-dashboard-demo-banner"
                    className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
                  >
                    Demo mode is on. This dashboard is using mock pilots, mock athletes, mock hypotheses, and mock AI
                    research briefs stored locally in your browser so you can demo and QA safely.
                  </div>
                ) : null}
              </section>

              <section id="aggregate-summary" className="pilot-slide-up scroll-mt-24 border-b border-white/10 px-4 py-6 sm:px-8" style={{ animationDelay: '60ms' }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                  Aggregate - all active pilots
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-5">
                  {primarySummaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.label} className="pilot-glass-card rounded-[22px] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">{card.label}</div>
                            <div className={`pilot-font-mono mt-4 text-[2rem] leading-none ${getMetricValueClassName(card.numericValue, card.tone)}`}>
                              {card.value}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-3">
                            <NoraMetricHelpButton
                              metricKey={card.metricKey}
                              className="border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#7cefd6] hover:bg-white/[0.08]"
                              testId={card.testId}
                            />
                            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${card.shellClassName}`}>
                              <Icon className={`h-4 w-4 ${card.iconClassName}`} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                  {secondarySummaryCards.map((card) => (
                    <div key={card.label} className="pilot-glass-card rounded-[20px] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 pr-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                          {card.label}
                        </div>
                        <NoraMetricHelpButton
                          metricKey={card.metricKey}
                          className="border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#7cefd6] hover:bg-white/[0.08]"
                        />
                      </div>
                      <div className={`pilot-font-mono mt-4 text-[2rem] leading-none ${getMetricValueClassName(card.numericValue, card.tone)}`}>
                        {card.value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section id="watch-list-summary" className="pilot-slide-up scroll-mt-24 border-b border-white/10 px-4 py-5 sm:px-8" style={{ animationDelay: '100ms' }}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10">
                      <ShieldAlert className="h-5 w-5 text-rose-200" />
                    </div>
                    <div>
                      <div className="pilot-font-display text-base font-semibold text-white">Operational Watch List</div>
                      <div className="mt-1 text-sm text-white/40">Directory-level restriction summary</div>
                    </div>
                  </div>

                  <div className="max-w-xl rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm leading-6 text-white/45">
                    Escalations remain separate from operational restriction state. Requests are review-only until applied.
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                  {watchListCards.map((card) => (
                    <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{card.label}</div>
                      <div className={`pilot-font-mono mt-3 text-2xl leading-none ${card.flagged ? 'text-rose-200' : 'text-white'}`}>
                        {card.value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section
                className="pilot-slide-up sticky top-14 z-30 border-b border-white/10 bg-[rgba(7,9,15,0.88)] px-4 py-3 backdrop-blur-2xl sm:px-8"
                style={{ animationDelay: '140ms' }}
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                  <div className="flex items-center gap-2 text-white/35">
                    <Filter className="h-4 w-4 shrink-0" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Filters</span>
                  </div>

                  <div className="grid flex-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                      <input
                        value={pilotSearchQuery}
                        onChange={(event) => setPilotSearchQuery(event.target.value)}
                        placeholder="Search pilots, teams, organizations, cohorts..."
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-11 pr-4 text-sm text-white/80 outline-none transition placeholder:text-white/25 hover:border-white/15 hover:text-white focus:border-[#00d4aa]/35"
                      />
                    </label>

                    <select
                      value={organizationId}
                      onChange={(event) => {
                        setOrganizationId(event.target.value);
                        setTeamId('');
                      }}
                      className="pilot-select rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 outline-none transition hover:border-white/15 hover:text-white focus:border-[#00d4aa]/35"
                    >
                      <option value="">All organizations</option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.displayName}
                        </option>
                      ))}
                    </select>

                    <select
                      value={teamId}
                      onChange={(event) => setTeamId(event.target.value)}
                      className="pilot-select rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 outline-none transition hover:border-white/15 hover:text-white focus:border-[#00d4aa]/35"
                    >
                      <option value="">All teams</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.displayName}
                        </option>
                      ))}
                    </select>

                    <select
                      value={studyMode}
                      onChange={(event) => setStudyMode(event.target.value as '' | StudyModeValue)}
                      className="pilot-select rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 outline-none transition hover:border-white/15 hover:text-white focus:border-[#00d4aa]/35"
                    >
                      {studyModeOptions.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 xl:ml-auto xl:justify-end">
                    {areFiltersActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOrganizationId('');
                          setTeamId('');
                          setStudyMode('');
                          setPilotSearchQuery('');
                        }}
                        className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        Clear filters
                      </button>
                    ) : null}
                    <span className="pilot-font-mono text-xs text-white/45">{pilotCountText}</span>
                  </div>
                </div>
              </section>

              <section id="organizations-directory" className="pilot-slide-up scroll-mt-24 border-b border-white/10 px-4 py-6 sm:px-8 sm:py-8" style={{ animationDelay: '120ms' }}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                      Organizations - monitoring directory
                    </div>
                  </div>
                  <span className="pilot-font-mono text-xs text-white/45">
                    {loading ? 'Loading...' : `${organizationDirectoryRows.length} organization${organizationDirectoryRows.length === 1 ? '' : 's'}`}
                  </span>
                </div>

                <div className="mt-4">
                  {loading ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
                      Loading organizations...
                    </div>
                  ) : error ? (
                    <div className="rounded-[24px] border border-rose-400/25 bg-rose-400/10 p-6 text-sm text-rose-100">
                      {error}
                    </div>
                  ) : organizationDirectoryRows.length === 0 ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
                      No organizations match the current filters.
                    </div>
                  ) : (
                    <div className="grid gap-3 xl:grid-cols-2">
                      {organizationDirectoryRows.map((row) => (
                        <div
                          key={row.organization.id}
                          className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
                                <Building2 className="h-4 w-4 text-cyan-100" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">{row.organization.displayName}</div>
                                <div className="mt-1 text-xs text-white/42">
                                  {row.teamCount} team{row.teamCount === 1 ? '' : 's'} - {row.pilotCount} active pilot{row.pilotCount === 1 ? '' : 's'}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {row.studyModeList.map((mode) => {
                                    const meta = getStudyModeMeta(mode);
                                    return (
                                      <span
                                        key={mode}
                                        className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${meta.badgeClassName}`}
                                      >
                                        {meta.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="grid shrink-0 grid-cols-2 gap-2 text-right">
                              <div>
                                <div className="pilot-font-mono text-lg leading-none text-white">{row.activeAthletes}</div>
                                <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">Athletes</div>
                              </div>
                              <div>
                                <div className="pilot-font-mono text-lg leading-none text-white">{row.hypothesisCount}</div>
                                <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">Hyp.</div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2">
                              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">Coverage</div>
                              <div className="pilot-font-mono mt-2 text-sm text-[#7cefd6]">{formatPercent(row.avgCoverageRate)}</div>
                            </div>
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2">
                              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">Stable rate</div>
                              <div className="pilot-font-mono mt-2 text-sm text-emerald-200">{formatPercent(row.avgStablePatternRate)}</div>
                            </div>
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2">
                              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">Unsupported</div>
                              <div className="pilot-font-mono mt-2 text-sm text-amber-200">{row.unsupportedHypothesisCount}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section id="teams-directory" className="pilot-slide-up scroll-mt-24 border-b border-white/10 px-4 py-6 sm:px-8 sm:py-8" style={{ animationDelay: '120ms' }}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                      Teams - monitoring directory
                    </div>
                  </div>
                  <span className="pilot-font-mono text-xs text-white/45">
                    {loading ? 'Loading...' : `${teamDirectoryRows.length} team${teamDirectoryRows.length === 1 ? '' : 's'}`}
                  </span>
                </div>

                <div className="mt-4">
                  {loading ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
                      Loading teams...
                    </div>
                  ) : error ? (
                    <div className="rounded-[24px] border border-rose-400/25 bg-rose-400/10 p-6 text-sm text-rose-100">
                      {error}
                    </div>
                  ) : teamDirectoryRows.length === 0 ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
                      No teams match the current filters.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02]">
                      <div className="divide-y divide-white/[0.06]">
                        {teamDirectoryRows.map((row) => (
                          <div key={row.team.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                                <FlaskConical className="h-4 w-4 text-emerald-100" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">{row.team.displayName}</div>
                                <div className="mt-1 truncate text-xs text-white/42">{row.organization.displayName}</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {row.studyModeList.map((mode) => {
                                    const meta = getStudyModeMeta(mode);
                                    return (
                                      <span
                                        key={mode}
                                        className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${meta.badgeClassName}`}
                                      >
                                        {meta.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {[
                                { label: 'Pilots', value: row.pilotCount },
                                { label: 'Athletes', value: row.activeAthletes },
                                { label: 'Cohorts', value: row.activeCohorts },
                                { label: 'Hyp.', value: row.hypothesisCount },
                              ].map((metric) => (
                                <div key={metric.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2">
                                  <div className="pilot-font-mono text-sm text-white">{metric.value}</div>
                                  <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">{metric.label}</div>
                                </div>
                              ))}
                            </div>

                            <div className="grid grid-cols-3 gap-2 lg:w-72">
                              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-right">
                                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">Coverage</div>
                                <div className="pilot-font-mono mt-2 text-sm text-[#7cefd6]">{formatPercent(row.avgCoverageRate)}</div>
                              </div>
                              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-right">
                                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">Stable</div>
                                <div className="pilot-font-mono mt-2 text-sm text-emerald-200">{formatPercent(row.avgStablePatternRate)}</div>
                              </div>
                              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-right">
                                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/28">Unsupported</div>
                                <div className="pilot-font-mono mt-2 text-sm text-amber-200">{row.unsupportedHypothesisCount}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section id="athletes-directory" className="pilot-slide-up scroll-mt-24 border-b border-white/10 px-4 py-6 sm:px-8 sm:py-8" style={{ animationDelay: '120ms' }}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                      Athletes - in-scope roster
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                      Every athlete on an in-scope team, including team-only members without an active pilot enrollment.
                      Open an athlete to review roster info and PulseCheck intake answers.
                    </p>
                  </div>
                  <span className="pilot-font-mono rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
                    {athletesLoading ? 'Loading...' : `${filteredAthletes.length} athlete${filteredAthletes.length === 1 ? '' : 's'}`}
                  </span>
                </div>

                <div className="mt-5">
                  {athletesLoading ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-8 text-sm text-white/50">
                      Loading athletes...
                    </div>
                  ) : athletesError ? (
                    <div className="rounded-[24px] border border-rose-400/25 bg-rose-400/10 p-8">
                      <div className="text-sm text-rose-100">{athletesError}</div>
                      <button
                        type="button"
                        onClick={() => void loadAthletes()}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300/20 bg-black/20 px-4 py-2 text-sm text-rose-100 transition hover:bg-black/30"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Try again
                      </button>
                    </div>
                  ) : filteredAthletes.length === 0 ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-8">
                      <div className="pilot-font-display text-lg font-semibold text-white">No athletes in scope</div>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">
                        Athletes appear here once they join an in-scope team. Adjust the organization, team, or study mode
                        filters to widen the roster.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.02]">
                      <div className="divide-y divide-white/[0.06]">
                        {filteredAthletes.map((athlete) => {
                          const teamContexts = getAthleteTeamContexts(athlete);

                          return (
                            <button
                              key={athlete.athleteUserId}
                              type="button"
                              onClick={() => setSelectedAthleteId(athlete.athleteUserId)}
                              className="flex w-full items-start gap-4 px-4 py-3.5 text-left transition hover:bg-white/[0.04] sm:px-5"
                            >
                              {athlete.profileImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={athlete.profileImageUrl}
                                  alt=""
                                  className="mt-1 h-10 w-10 shrink-0 rounded-full border border-white/10 object-cover"
                                />
                              ) : (
                                <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-xs font-semibold text-cyan-100">
                                  {getAthleteInitials(athlete.displayName)}
                                </span>
                              )}

                              <div className="min-w-0 flex-1 pt-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-medium text-white">{athlete.displayName}</span>
                                </div>
                                <div className="mt-0.5 truncate text-xs text-white/45">
                                  {athlete.email || 'No email on file'}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5 sm:hidden">
                                  {teamContexts.slice(0, 2).map((context) => (
                                    <span
                                      key={context.key}
                                      className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/65"
                                    >
                                      {context.teamName || 'Unassigned team'}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="hidden min-w-0 flex-[1.6] sm:block">
                                <div className="space-y-1.5">
                                  {teamContexts.map((context) => (
                                    <div
                                      key={context.key}
                                      className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2"
                                    >
                                      <div className="flex min-w-0 items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-medium text-white/75">
                                            {context.teamName || 'Unassigned team'}
                                          </div>
                                          <div className="mt-0.5 truncate text-xs text-white/40">
                                            {getTeamContextSubline(context)}
                                          </div>
                                        </div>
                                        <span
                                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${getEnrollmentChipClassName(
                                            context.enrollmentStatus
                                          )}`}
                                        >
                                          {getEnrollmentChipLabel(context.enrollmentStatus)}
                                        </span>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        <span
                                          className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${getConsentChipClassName(
                                            context.consentStatus
                                          )}`}
                                        >
                                          {getConsentChipLabel(context.consentStatus)}
                                        </span>
                                        <span
                                          className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${getIntakeChipClassName(
                                            context
                                          )}`}
                                        >
                                          {getIntakeChipLabel(context)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2 pt-2">
                                <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55 sm:inline-flex">
                                  {getTeamCountLabel(teamContexts.length)}
                                </span>
                                <ArrowRight className="h-4 w-4 text-white/30" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section id="pilot-directory" className="scroll-mt-24 px-4 py-6 sm:px-8 sm:py-8">
                {loading ? (
                  <div className="pilot-fade-in rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-sm text-white/50">
                    Loading active pilots...
                  </div>
                ) : error ? (
                  <div className="pilot-fade-in rounded-[28px] border border-rose-400/25 bg-rose-400/10 p-8">
                    <div className="text-sm text-rose-100">{error}</div>
                    <button
                      type="button"
                      onClick={() => void load('refresh')}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300/20 bg-black/20 px-4 py-2 text-sm text-rose-100 transition hover:bg-black/30"
                    >
                      <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                      Try again
                    </button>
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="pilot-fade-in rounded-[28px] border border-white/10 bg-white/[0.03] p-8">
                    <div className="pilot-font-display text-xl font-semibold text-white">No active pilots match the current filters</div>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">
                      Adjust the search, organization, team, or study mode filters to bring pilots back into scope.
                    </p>
                    {areFiltersActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOrganizationId('');
                          setTeamId('');
                          setStudyMode('');
                          setPilotSearchQuery('');
                        }}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        Clear filters
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {filteredEntries.map((entry, index) => {
                      const studyModeMeta = getStudyModeMeta(entry.pilot.studyMode);
                      const pilotMetrics: Array<{
                        label: string;
                        value: string;
                        metricKey: PilotDashboardMetricExplanationKey;
                        tone: MetricTone;
                        numericValue: number;
                      }> = [
                        {
                          label: 'Active Athletes',
                          value: String(entry.activeEnrollmentCount),
                          metricKey: 'active-pilot-athletes',
                          tone: 'teal',
                          numericValue: entry.activeEnrollmentCount,
                        },
                        {
                          label: 'Cohorts',
                          value: String(entry.activeCohortCount || entry.cohorts.length),
                          metricKey: 'active-cohorts',
                          tone: 'blue',
                          numericValue: entry.activeCohortCount || entry.cohorts.length,
                        },
                        {
                          label: 'Hypotheses',
                          value: String(entry.hypothesisCount),
                          metricKey: 'hypotheses',
                          tone: 'violet',
                          numericValue: entry.hypothesisCount,
                        },
                        {
                          label: 'Not Supported',
                          value: String(entry.unsupportedHypothesisCount),
                          metricKey: 'not-supported',
                          tone: 'amber',
                          numericValue: entry.unsupportedHypothesisCount,
                        },
                        {
                          label: 'Coverage',
                          value: formatPercent(entry.engineCoverageRate),
                          metricKey: 'coverage',
                          tone: 'teal',
                          numericValue: entry.engineCoverageRate,
                        },
                        {
                          label: 'Stable Rate',
                          value: formatPercent(entry.stablePatternRate),
                          metricKey: 'stable-rate',
                          tone: 'emerald',
                          numericValue: entry.stablePatternRate,
                        },
                        {
                          label: 'Avg Evidence',
                          value: formatAverage(entry.avgEvidenceRecordsPerActiveAthlete),
                          metricKey: 'avg-evidence',
                          tone: 'blue',
                          numericValue: entry.avgEvidenceRecordsPerActiveAthlete,
                        },
                        {
                          label: 'Avg Projections',
                          value: formatAverage(entry.avgRecommendationProjectionsPerActiveAthlete),
                          metricKey: 'avg-projections-per-athlete',
                          tone: 'violet',
                          numericValue: entry.avgRecommendationProjectionsPerActiveAthlete,
                        },
                      ];

                      return (
                        <div
                          key={entry.pilot.id}
                          className="pilot-fade-in group overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-200 hover:border-white/20 hover:bg-white/[0.05]"
                          style={{ animationDelay: `${160 + index * 60}ms` }}
                        >
                          <div className="border-b border-white/10 px-5 py-5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">
                              {entry.organization.displayName}
                            </div>
                            <div className="mt-2 flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <a
                                  href={`/admin/pulsecheckPilotDashboard/${encodeURIComponent(entry.pilot.id)}`}
                                  className="pilot-font-display block text-xl font-bold tracking-[-0.03em] text-white transition hover:text-[#9cf4e2]"
                                >
                                  {entry.pilot.name}
                                </a>
                                <div className="mt-1 text-sm text-white/40">{entry.team.displayName}</div>
                              </div>

                              <span
                                className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${studyModeMeta.badgeClassName}`}
                              >
                                {studyModeMeta.label}
                              </span>
                            </div>
                          </div>

                          <div className="overflow-hidden rounded-none">
                            <div className="grid grid-cols-2 gap-px bg-white/10">
                              {pilotMetrics.map((metric) => (
                                <div key={metric.label} className="bg-[rgba(9,12,19,0.92)] px-4 py-3.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 pr-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">
                                      {metric.label}
                                    </div>
                                    <NoraMetricHelpButton
                                      metricKey={metric.metricKey}
                                      className="border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#7cefd6] hover:bg-white/[0.08]"
                                    />
                                  </div>
                                  <div className={`pilot-font-mono mt-3 text-[1.45rem] leading-none ${getMetricValueClassName(metric.numericValue, metric.tone)}`}>
                                    {metric.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-white/[0.02] px-5 py-3.5 text-sm">
                            <div className="flex items-center gap-2 text-white/40">
                              <Building2 className="h-4 w-4" />
                              <span>
                                {entry.operationalWatchListSummary?.stateCount
                                  ? `${entry.operationalWatchListSummary.stateCount} watch-list state${
                                      entry.operationalWatchListSummary.stateCount === 1 ? '' : 's'
                                    }`
                                  : 'Pilot-native dashboard'}
                              </span>
                            </div>

                            <a
                              href={`/admin/pulsecheckPilotDashboard/${encodeURIComponent(entry.pilot.id)}`}
                              className="inline-flex items-center gap-2 font-medium text-[#7cefd6] transition group-hover:gap-3 hover:text-white"
                            >
                              Open pilot
                              <ArrowRight className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </main>
          </div>
        </div>

        {selectedAthlete ? (
          <div className="fixed inset-0 z-50 flex justify-end">
            <button
              type="button"
              aria-label="Close athlete detail"
              onClick={() => setSelectedAthleteId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <div className="pilot-drawer relative ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[rgba(9,12,19,0.98)] shadow-[0_0_80px_rgba(0,0,0,0.6)]">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[rgba(9,12,19,0.98)] px-5 py-4 backdrop-blur-xl">
                <div className="flex min-w-0 items-center gap-3">
                  {selectedAthlete.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedAthlete.profileImageUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-sm font-semibold text-cyan-100">
                      {getAthleteInitials(selectedAthlete.displayName)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate pilot-font-display text-base font-bold tracking-[-0.02em] text-white">
                      {selectedAthlete.displayName}
                    </div>
                    <div className="truncate text-xs text-white/45">{selectedAthlete.email || 'No email on file'}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAthleteId(null)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] p-1.5 text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-5 px-5 py-5">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">Team contexts</div>
                    <span className="pilot-font-mono text-xs text-white/45">{getTeamCountLabel(selectedAthleteTeamContexts.length)}</span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {selectedAthleteTeamContexts.map((context) => (
                      <div key={context.key} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">
                              {context.teamName || 'Unassigned team'}
                            </div>
                            <div className="mt-1 truncate text-xs text-white/42">
                              {getTeamContextSubline(context)}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${getEnrollmentChipClassName(
                              context.enrollmentStatus
                            )}`}
                          >
                            {getEnrollmentChipLabel(context.enrollmentStatus)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${getConsentChipClassName(
                              context.consentStatus
                            )}`}
                          >
                            {getConsentChipLabel(context.consentStatus)}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${getIntakeChipClassName(
                              context
                            )}`}
                          >
                            {getIntakeChipLabel(context)}
                          </span>
                        </div>

                        <dl className="mt-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-white/35">Organization</dt>
                            <dd className="max-w-[60%] truncate text-right text-white/70">{context.organizationName || '—'}</dd>
                          </div>
                          {context.onboardingStatus ? (
                            <div className="flex items-center justify-between gap-4">
                              <dt className="text-white/35">Onboarding</dt>
                              <dd className="text-right text-white/70">{context.onboardingStatus}</dd>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-white/35">Phone</dt>
                            <dd className="flex min-w-0 items-center gap-1.5 text-right text-white/70">
                              {context.phone ? (
                                <>
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-white/35" />
                                  <span className="pilot-font-mono truncate">{context.phone}</span>
                                </>
                              ) : (
                                <span className="text-white/35">Not provided</span>
                              )}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => void prepareInviteEmailPreview(selectedAthlete, context)}
                            disabled={!selectedAthlete.email || preparingInviteKey === context.key || sendingInviteKey === context.key}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {preparingInviteKey === context.key ? 'Preparing...' : 'Preview email'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void sendDefaultAdminInviteEmail(selectedAthlete, context)}
                            disabled={!selectedAthlete.email || preparingInviteKey === context.key || sendingInviteKey === context.key}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d9ff00]/25 bg-[#d9ff00]/10 px-3 py-2 text-xs font-semibold text-[#ecff70] transition hover:bg-[#d9ff00]/15 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {sendingInviteKey === context.key ? 'Sending...' : 'Send email'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {inviteToast ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      inviteToast.type === 'success'
                        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                        : inviteToast.type === 'error'
                          ? 'border-rose-400/25 bg-rose-400/10 text-rose-100'
                          : 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100'
                    }`}
                  >
                    {inviteToast.text}
                  </div>
                ) : null}

                {inviteEmailDraft ? (
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
                          <Mail className="h-3.5 w-3.5" />
                          Invite email preview
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          To {inviteEmailDraft.recipientEmail} - {inviteEmailDraft.teamName || 'Team invite'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInviteEmailDraft(null)}
                        className="rounded-full border border-white/10 bg-white/[0.04] p-1.5 text-white/50 transition hover:bg-white/[0.08] hover:text-white"
                        aria-label="Close invite email preview"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Subject</span>
                        <input
                          value={inviteEmailDraft.subject}
                          onChange={(event) =>
                            setInviteEmailDraft((current) =>
                              current ? { ...current, subject: event.target.value } : current
                            )
                          }
                          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/45"
                        />
                      </label>

                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Intro</span>
                        <textarea
                          value={inviteEmailDraft.introText}
                          onChange={(event) =>
                            setInviteEmailDraft((current) =>
                              current ? { ...current, introText: event.target.value } : current
                            )
                          }
                          rows={3}
                          className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm leading-5 text-white outline-none transition focus:border-cyan-300/45"
                        />
                      </label>

                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Detail</span>
                        <textarea
                          value={inviteEmailDraft.detailText}
                          onChange={(event) =>
                            setInviteEmailDraft((current) =>
                              current ? { ...current, detailText: event.target.value } : current
                            )
                          }
                          rows={3}
                          className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm leading-5 text-white outline-none transition focus:border-cyan-300/45"
                        />
                      </label>

                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Button text</span>
                        <input
                          value={inviteEmailDraft.buttonLabel}
                          onChange={(event) =>
                            setInviteEmailDraft((current) =>
                              current ? { ...current, buttonLabel: event.target.value } : current
                            )
                          }
                          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/45"
                        />
                      </label>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white">
                      <iframe
                        title="Invite email preview"
                        srcDoc={inviteEmailPreview?.html || ''}
                        className="h-[420px] w-full bg-white"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setInviteEmailDraft(null)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendAdminInviteEmail(inviteEmailDraft)}
                        disabled={sendingInviteKey === inviteEmailDraft.contextKey}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#d9ff00]/25 bg-[#d9ff00] px-3 py-2 text-xs font-bold text-black transition hover:bg-[#e6ff3f] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sendingInviteKey === inviteEmailDraft.contextKey ? 'Sending...' : 'Send invite email'}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                      PulseCheck intake answers
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    {selectedAthleteTeamContexts.map((context) => (
                      <div key={`${context.key}:intake`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white/85">
                              {context.teamName || 'Unassigned team'}
                            </div>
                            <div className="mt-1 truncate text-xs text-white/38">{context.organizationName || '—'}</div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${getIntakeChipClassName(
                              context
                            )}`}
                          >
                            {getIntakeChipLabel(context)}
                          </span>
                        </div>

                        {!hasAssignedIntake(context) ? (
                          <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/10 px-3 py-3 text-sm text-white/45">
                            No athlete intake assigned for this team.
                          </div>
                        ) : !context.intakeCompleted && context.intake.length === 0 ? (
                          <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/10 px-3 py-3 text-sm text-white/45">
                            Athlete intake is assigned but has not been submitted yet.
                          </div>
                        ) : context.intake.length === 0 ? (
                          <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/10 px-3 py-3 text-sm text-white/45">
                            No intake answers on record.
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2.5">
                            {context.intake.map((answer) => (
                              <div
                                key={answer.questionId}
                                className="rounded-xl border border-white/[0.07] bg-black/10 px-3 py-3"
                              >
                                <div className="text-xs font-medium text-white/55">{answer.questionText}</div>
                                <div className="mt-1.5 text-sm leading-6 text-white/90">
                                  {answer.answer ? answer.answer : <span className="text-white/35">No answer</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <style jsx global>{`
          .pilot-drawer {
            animation: pilotDrawerIn 0.28s ease forwards;
          }

          @keyframes pilotDrawerIn {
            from {
              transform: translateX(24px);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>

        <style jsx global>{`
          .pilot-dashboard-theme {
            background: #07090f;
          }

          .pilot-font-display {
            font-family: 'Switzer', sans-serif;
          }

          .pilot-font-body {
            font-family: 'Switzer', sans-serif;
          }

          .pilot-font-mono {
            font-family: 'DM Mono', monospace;
          }

          .pilot-ambient-layer {
            position: fixed;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
            z-index: 0;
          }

          .pilot-ambient-orb {
            position: absolute;
            border-radius: 9999px;
            filter: blur(120px);
            opacity: 0.9;
            animation: pilotFloat 18s ease-in-out infinite;
          }

          .pilot-ambient-orb-teal {
            top: -16rem;
            right: -10rem;
            height: 50rem;
            width: 50rem;
            background: radial-gradient(circle, rgba(0, 212, 170, 0.12) 0%, rgba(0, 212, 170, 0.02) 45%, transparent 72%);
          }

          .pilot-ambient-orb-blue {
            bottom: -12rem;
            left: -8rem;
            height: 38rem;
            width: 38rem;
            background: radial-gradient(circle, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.02) 45%, transparent 72%);
            animation-delay: -6s;
          }

          .pilot-ambient-orb-amber {
            top: 36%;
            left: 28%;
            height: 28rem;
            width: 28rem;
            background: radial-gradient(circle, rgba(245, 166, 35, 0.08) 0%, rgba(245, 166, 35, 0.015) 45%, transparent 72%);
            animation-delay: -10s;
          }

          .pilot-logo-dot {
            height: 0.5rem;
            width: 0.5rem;
            border-radius: 9999px;
            background: #00d4aa;
            box-shadow: 0 0 12px rgba(0, 212, 170, 0.55);
            animation: pilotPulse 2.8s ease-in-out infinite;
          }

          .pilot-glass-card {
            background: rgba(255, 255, 255, 0.032);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(20px);
          }

          .pilot-select {
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='rgba(255,255,255,0.28)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
            background-position: right 0.9rem center;
            background-repeat: no-repeat;
            padding-right: 2.5rem;
          }

          .pilot-slide-up {
            opacity: 0;
            animation: pilotSlideUp 0.45s ease forwards;
          }

          .pilot-fade-in {
            opacity: 0;
            animation: pilotFadeIn 0.45s ease forwards;
          }

          @keyframes pilotPulse {
            0%,
            100% {
              box-shadow: 0 0 12px rgba(0, 212, 170, 0.55);
            }
            50% {
              box-shadow: 0 0 24px rgba(0, 212, 170, 0.9);
            }
          }

          @keyframes pilotFloat {
            0%,
            100% {
              transform: translate3d(0, 0, 0) scale(1);
            }
            50% {
              transform: translate3d(0, 18px, 0) scale(1.04);
            }
          }

          @keyframes pilotSlideUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes pilotFadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}</style>
      </div>

      <SignInModal
        isVisible={showDashboardSignIn}
        closable
        onClose={closeDashboardLogin}
        onSignInSuccess={closeDashboardLogin}
        onSignInError={(error) => {
          console.error('[PilotDashboard] sign in failed', error);
        }}
        onSignUpSuccess={closeDashboardLogin}
        onSignUpError={(error) => {
          console.error('[PilotDashboard] sign up failed', error);
        }}
        onQuizComplete={closeDashboardLogin}
        onQuizSkipped={closeDashboardLogin}
        onRegistrationComplete={closeDashboardLogin}
      />
    </AdminRouteGuard>
  );
};

export default PulseCheckPilotDashboardIndexPage;
