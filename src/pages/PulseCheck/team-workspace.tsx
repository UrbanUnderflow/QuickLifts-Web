import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowRight, Bell, ChevronRight, ClipboardList, Copy, Loader2, Mail, Shield, Sparkles, UserRound, Users, Waves, XCircle } from 'lucide-react';
import { coachService } from '../../api/firebase/coach';
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
import { userService } from '../../api/firebase/user';
import type { User } from '../../api/firebase/user';
import { useUser, useUserLoading } from '../../hooks/useUser';

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
      baselineReady: entry.membership.athleteOnboarding?.baselinePathStatus === 'ready' || entry.membership.athleteOnboarding?.baselinePathStatus === 'complete',
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

    setMembership(myMembership);
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
  const operatingRole = membership?.operatingRole || 'admin-only';
  const focus = focusByRole[operatingRole];
  const canManageAthleteInvites = membership ? canCreateAthleteInvite(membership.role, team?.defaultInvitePolicy) : false;

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
      <div className="flex min-h-screen items-center justify-center bg-[#05070c] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  if (!currentUser || !membership || !team) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>PulseCheck Team Workspace</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <section className="rounded-[36px] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.10),_transparent_35%),#07101d] p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">PulseCheck Team Workspace</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">{team.displayName}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
                {organization?.displayName || 'Organization'} is active. Staff, athletes, and invite state now live in the same team-scoped workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/PulseCheck/post-activation?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
              >
                Manage Onboarding
              </Link>
              <Link
                href="/PulseCheck"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Open PulseCheck
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {message ? (
            <div
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'border-green-500/20 bg-green-500/[0.06] text-green-200'
                  : 'border-red-500/20 bg-red-500/[0.06] text-red-200'
              }`}
            >
              {message.text}
            </div>
          ) : null}

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
        </section>

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
