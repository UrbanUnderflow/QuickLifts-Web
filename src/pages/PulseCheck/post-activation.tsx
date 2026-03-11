import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bell, CheckCircle2, ChevronRight, Copy, Loader2, Mail, Shield, Sparkles, UserRound, Users, Waves, Waypoints } from 'lucide-react';
import { firebaseStorageService, UploadImageType } from '../../api/firebase/storage/service';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type {
  PulseCheckInviteLink,
  PulseCheckNotificationPreferences,
  PulseCheckOperatingRole,
  PulseCheckOrganization,
  PulseCheckTeam,
  PulseCheckTeamMembership,
  PulseCheckTeamMembershipRole,
} from '../../api/firebase/pulsecheckProvisioning/types';
import { userService } from '../../api/firebase/user';
import { useUser, useUserLoading } from '../../hooks/useUser';

const operatingRoleOptions: Array<{
  value: PulseCheckOperatingRole;
  label: string;
  description: string;
  accent: string;
}> = [
  {
    value: 'admin-only',
    label: 'Admin Only',
    description: 'You coordinate setup, permissions, and staff onboarding without operating as a coach.',
    accent: 'from-amber-400/20 to-orange-500/10 border-amber-400/25',
  },
  {
    value: 'admin-plus-coach',
    label: 'Admin + Coach',
    description: 'You manage the team and also operate directly in the coaching lane.',
    accent: 'from-cyan-400/20 to-sky-500/10 border-cyan-400/25',
  },
  {
    value: 'admin-plus-support-staff',
    label: 'Admin + Support Staff',
    description: 'You manage the team and operate in performance, operations, or support workflows.',
    accent: 'from-emerald-400/20 to-teal-500/10 border-emerald-400/25',
  },
];

const adultRoleOptions: Array<{
  value: PulseCheckTeamMembershipRole;
  label: string;
}> = [
  { value: 'team-admin', label: 'Secondary Admin' },
  { value: 'coach', label: 'Coach' },
  { value: 'performance-staff', label: 'Performance Staff' },
  { value: 'support-staff', label: 'Support Staff' },
];

const formatInviteRole = (role?: PulseCheckTeamMembershipRole) => {
  switch (role) {
    case 'team-admin':
      return 'Secondary Admin';
    case 'performance-staff':
      return 'Performance Staff';
    case 'support-staff':
      return 'Support Staff';
    case 'athlete':
      return 'Athlete';
    default:
      return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Invite';
  }
};

const buildMailto = (invite: PulseCheckInviteLink, teamName: string, organizationName: string) => {
  const subject = encodeURIComponent(`PulseCheck invite for ${teamName}`);
  const body = encodeURIComponent(
    `You’ve been invited to PulseCheck for ${organizationName} / ${teamName}.\n\nOpen your onboarding link:\n${invite.activationUrl}`
  );
  return `mailto:${invite.targetEmail || ''}?subject=${subject}&body=${body}`;
};

const Toggle = ({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) => (
  <button
    type="button"
    onClick={onChange}
    className={`flex w-full items-start justify-between rounded-2xl border px-4 py-4 text-left transition ${
      checked
        ? 'border-cyan-300/50 bg-cyan-400/[0.08]'
        : 'border-zinc-800 bg-black/20 hover:border-zinc-700'
    }`}
  >
    <div>
      <div className="text-sm font-semibold text-white">{label}</div>
      <div className="mt-1 text-sm leading-6 text-zinc-400">{description}</div>
    </div>
    <div
      className={`mt-1 flex h-6 w-11 items-center rounded-full p-1 transition ${
        checked ? 'bg-cyan-300 justify-end' : 'bg-zinc-700 justify-start'
      }`}
    >
      <div className="h-4 w-4 rounded-full bg-black" />
    </div>
  </button>
);

export default function PulseCheckPostActivationPage() {
  const router = useRouter();
  const currentUser = useUser();
  const currentUserLoading = useUserLoading();
  const organizationId = typeof router.query.organizationId === 'string' ? router.query.organizationId : '';
  const teamId = typeof router.query.teamId === 'string' ? router.query.teamId : '';

  const [membership, setMembership] = useState<PulseCheckTeamMembership | null>(null);
  const [organization, setOrganization] = useState<PulseCheckOrganization | null>(null);
  const [team, setTeam] = useState<PulseCheckTeam | null>(null);
  const [inviteLinks, setInviteLinks] = useState<PulseCheckInviteLink[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [creatingAdultInvite, setCreatingAdultInvite] = useState(false);
  const [creatingAthleteInvite, setCreatingAthleteInvite] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [profileForm, setProfileForm] = useState({
    displayName: '',
    title: '',
    operatingRole: 'admin-only' as PulseCheckOperatingRole,
    notificationPreferences: {
      email: true,
      sms: false,
      push: true,
      weeklyDigest: true,
    } as PulseCheckNotificationPreferences,
  });
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState('');

  const [adultInviteForm, setAdultInviteForm] = useState({
    recipientName: '',
    targetEmail: '',
    invitedTitle: '',
    teamMembershipRole: 'coach' as PulseCheckTeamMembershipRole,
  });
  const [athleteInviteForm, setAthleteInviteForm] = useState({
    recipientName: '',
    targetEmail: '',
  });

  const refreshContext = async () => {
    if (!currentUser?.id || !teamId) return;

    const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(currentUser.id);
    const nextMembership =
      memberships.find((entry) => entry.teamId === teamId && entry.role === 'team-admin') ||
      memberships.find((entry) => entry.teamId === teamId) ||
      null;

    setMembership(nextMembership);

    const [nextOrganization, nextTeam, nextInviteLinks] = await Promise.all([
      organizationId ? pulseCheckProvisioningService.getOrganization(organizationId) : Promise.resolve(null),
      pulseCheckProvisioningService.getTeam(teamId),
      pulseCheckProvisioningService.listTeamInviteLinks(teamId),
    ]);

    setOrganization(nextOrganization);
    setTeam(nextTeam);
    setInviteLinks(nextInviteLinks);
  };

  useEffect(() => {
    if (currentUserLoading) return;
    if (!currentUser?.id || !teamId) {
      setInitializing(false);
      return;
    }

    let active = true;

    (async () => {
      try {
        await refreshContext();
      } catch (error) {
        console.error('[PulseCheck post-activation] Failed to load context:', error);
        if (active) {
          setMessage({ type: 'error', text: 'Failed to load your team setup context.' });
        }
      } finally {
        if (active) setInitializing(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUserLoading, organizationId, teamId]);

  useEffect(() => {
    if (!currentUser) return;
    setProfileForm((current) => ({
      ...current,
      displayName: currentUser.displayName || current.displayName,
    }));
    setProfileImagePreview(currentUser.profileImage?.profileImageURL || '');
  }, [currentUser]);

  useEffect(() => {
    if (!membership) return;
    setProfileForm((current) => ({
      ...current,
      title: membership.title || current.title,
      operatingRole: membership.operatingRole || current.operatingRole,
      notificationPreferences: membership.notificationPreferences || current.notificationPreferences,
    }));
  }, [membership]);

  const activeInviteLinks = useMemo(
    () => inviteLinks.filter((invite) => invite.status === 'active'),
    [inviteLinks]
  );
  const adultInviteLinks = useMemo(
    () => activeInviteLinks.filter((invite) => invite.teamMembershipRole && invite.teamMembershipRole !== 'athlete'),
    [activeInviteLinks]
  );
  const athleteInviteLinks = useMemo(
    () => activeInviteLinks.filter((invite) => invite.teamMembershipRole === 'athlete'),
    [activeInviteLinks]
  );

  const setupSaved = membership?.onboardingStatus === 'profile-complete' || membership?.onboardingStatus === 'complete';
  const canInviteAthletes = Boolean(membership?.operatingRole && membership?.title?.trim());

  const handleCopy = async (value: string, successText: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage({ type: 'success', text: successText });
    } catch (error) {
      console.error('[PulseCheck post-activation] Clipboard copy failed:', error);
      setMessage({ type: 'error', text: 'Failed to copy to clipboard.' });
    }
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !membership || !organization || !team) return;

    const displayName = profileForm.displayName.trim();
    const title = profileForm.title.trim();
    if (!displayName || !title) {
      setMessage({ type: 'error', text: 'Name and title are required before continuing.' });
      return;
    }

    setSavingProfile(true);
    setMessage(null);

    try {
      let profileImageUrl = currentUser.profileImage?.profileImageURL || '';
      if (profileImageFile) {
        const upload = await firebaseStorageService.uploadImage(profileImageFile, UploadImageType.Profile);
        profileImageUrl = upload.downloadURL;
      }

      await userService.updateUser(currentUser.id, {
        ...currentUser.toDictionary(),
        displayName,
        profileImage: {
          profileImageURL: profileImageUrl,
          imageOffsetWidth: 0,
          imageOffsetHeight: 0,
        },
        updatedAt: new Date(),
      });

      await pulseCheckProvisioningService.savePostActivationSetup({
        organizationId: organization.id,
        teamId: team.id,
        teamMembershipId: membership.id,
        displayName,
        title,
        operatingRole: profileForm.operatingRole,
        notificationPreferences: profileForm.notificationPreferences,
        profileImageUrl,
      });

      const refreshedUser = await userService.fetchUserFromFirestore(currentUser.id);
      userService.nonUICurrentUser = refreshedUser;
      await refreshContext();
      setProfileImageFile(null);
      setMessage({ type: 'success', text: 'Your post-activation setup was saved.' });
    } catch (error) {
      console.error('[PulseCheck post-activation] Failed to save profile:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save your setup.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateAdultInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !organization || !team) return;

    const targetEmail = adultInviteForm.targetEmail.trim().toLowerCase();
    if (!targetEmail) {
      setMessage({ type: 'error', text: 'Adult invites require an email address.' });
      return;
    }

    setCreatingAdultInvite(true);
    setMessage(null);

    try {
      const inviteId = await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: organization.id,
        teamId: team.id,
        teamMembershipRole: adultInviteForm.teamMembershipRole,
        targetEmail,
        recipientName: adultInviteForm.recipientName.trim(),
        invitedTitle: adultInviteForm.invitedTitle.trim(),
        createdByUserId: currentUser.id,
        createdByEmail: currentUser.email,
      });

      const updatedLinks = await pulseCheckProvisioningService.listTeamInviteLinks(team.id);
      setInviteLinks(updatedLinks);
      const createdInvite = updatedLinks.find((invite) => invite.id === inviteId);
      if (createdInvite?.activationUrl) {
        await navigator.clipboard.writeText(createdInvite.activationUrl);
      }
      setAdultInviteForm({
        recipientName: '',
        targetEmail: '',
        invitedTitle: '',
        teamMembershipRole: 'coach',
      });
      setMessage({ type: 'success', text: 'Adult onboarding link created and copied.' });
    } catch (error) {
      console.error('[PulseCheck post-activation] Failed to create adult invite:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create adult invite.' });
    } finally {
      setCreatingAdultInvite(false);
    }
  };

  const handleCreateAthleteInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !organization || !team) return;
    if (!canInviteAthletes) {
      setMessage({ type: 'error', text: 'Save your post-activation profile before sending athlete invites.' });
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

      const updatedLinks = await pulseCheckProvisioningService.listTeamInviteLinks(team.id);
      setInviteLinks(updatedLinks);
      const createdInvite = updatedLinks.find((invite) => invite.id === inviteId);
      if (createdInvite?.activationUrl) {
        await navigator.clipboard.writeText(createdInvite.activationUrl);
      }
      setAthleteInviteForm({ recipientName: '', targetEmail: '' });
      setMessage({ type: 'success', text: 'Athlete onboarding link created and copied.' });
    } catch (error) {
      console.error('[PulseCheck post-activation] Failed to create athlete invite:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create athlete invite.' });
    } finally {
      setCreatingAthleteInvite(false);
    }
  };

  if (currentUserLoading || initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070c] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  if (!membership || membership.role !== 'team-admin') {
    return (
      <div className="min-h-screen bg-[#05070c] px-4 py-16 text-white">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-zinc-800 bg-[#090f1c] p-10 text-center shadow-2xl">
          <Shield className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-6 text-3xl font-semibold">This setup lane is reserved for team admins</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            Your account is active, but this page is only for the initial team-admin handoff and profile setup.
          </p>
          <Link
            href={`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Open Team Workspace
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>PulseCheck Post-Activation Setup</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <section className="rounded-[36px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.10),_transparent_35%),#07101d] p-6 shadow-2xl md:p-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Post-Activation Setup</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight">Shape how you operate inside {team?.displayName || 'your team'}</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300">
                  Your admin access is already live. This page defines your operating identity, then hands you into adult and athlete onboarding.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Container</div>
                  <div className="mt-3 text-lg font-semibold text-white">{organization?.displayName || 'Organization'}</div>
                  <div className="mt-1 text-sm text-zinc-400">{team?.displayName || 'Team'}</div>
                </div>
                <div className="rounded-3xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Adult Links</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{adultInviteLinks.length}</div>
                  <div className="mt-1 text-sm text-zinc-400">Active secondary admin / staff / coach links</div>
                </div>
                <div className="rounded-3xl border border-zinc-800 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Athlete Links</div>
                  <div className="mt-3 text-3xl font-semibold text-white">{athleteInviteLinks.length}</div>
                  <div className="mt-1 text-sm text-zinc-400">Live athlete onboarding links</div>
                </div>
              </div>

              <div className="rounded-[28px] border border-amber-400/20 bg-amber-400/[0.06] p-5">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                  <div className="text-sm font-semibold text-white">Recommended sequence</div>
                </div>
                <div className="mt-3 grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
                  <div>1. Define your name, title, photo, notifications, and operating role.</div>
                  <div>2. Add the adults who will help run the team.</div>
                  <div>3. Start athlete onboarding once the adult lane is established.</div>
                </div>
              </div>

              {message ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    message.type === 'success'
                      ? 'border-green-500/20 bg-green-500/[0.06] text-green-200'
                      : 'border-red-500/20 bg-red-500/[0.06] text-red-200'
                  }`}
                >
                  {message.text}
                </div>
              ) : null}
            </div>

            <div className="grid gap-6">
              <form onSubmit={handleSaveProfile} className="rounded-[30px] border border-zinc-800 bg-[#091326] p-6">
                <div className="flex items-center gap-3">
                  <UserRound className="h-5 w-5 text-cyan-300" />
                  <div>
                    <div className="text-lg font-semibold text-white">1. Complete Your Profile</div>
                    <div className="text-sm text-zinc-400">Define who you are and how PulseCheck should treat your admin lane.</div>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="rounded-[28px] border border-zinc-800 bg-black/20 p-4">
                    <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[24px] border border-zinc-700 bg-zinc-900">
                      {profileImagePreview ? (
                        <img src={profileImagePreview} alt="Profile preview" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-4xl font-semibold text-zinc-500">
                          {(profileForm.displayName || currentUser.displayName || currentUser.username || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <label className="mt-4 block cursor-pointer rounded-2xl border border-zinc-700 px-3 py-2 text-center text-sm font-medium text-white transition hover:border-cyan-300">
                      Add Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          setProfileImageFile(file);
                          setProfileImagePreview(file ? URL.createObjectURL(file) : currentUser.profileImage?.profileImageURL || '');
                        }}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Name</span>
                        <input
                          value={profileForm.displayName}
                          onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))}
                          className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                          placeholder="Tremaine Grant"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Title</span>
                        <input
                          value={profileForm.title}
                          onChange={(event) => setProfileForm((current) => ({ ...current, title: event.target.value }))}
                          className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                          placeholder="Athletic Director"
                        />
                      </label>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Operating Role</div>
                      <div className="mt-3 grid gap-3">
                        {operatingRoleOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setProfileForm((current) => ({ ...current, operatingRole: option.value }))}
                            className={`rounded-[24px] border bg-gradient-to-br px-4 py-4 text-left transition ${
                              profileForm.operatingRole === option.value
                                ? `${option.accent} text-white`
                                : 'border-zinc-800 from-black/20 to-black/10 text-zinc-300 hover:border-zinc-700'
                            }`}
                          >
                            <div className="text-sm font-semibold">{option.label}</div>
                            <div className="mt-2 text-sm leading-6 text-zinc-400">{option.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-[28px] border border-zinc-800 bg-black/20 p-5">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-cyan-300" />
                    <div>
                      <div className="text-base font-semibold text-white">Notification Preferences</div>
                      <div className="text-sm text-zinc-400">Start with sane defaults for ops, staff coordination, and team activity.</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Toggle
                      checked={profileForm.notificationPreferences.email}
                      onChange={() =>
                        setProfileForm((current) => ({
                          ...current,
                          notificationPreferences: {
                            ...current.notificationPreferences,
                            email: !current.notificationPreferences.email,
                          },
                        }))
                      }
                      label="Email updates"
                      description="Receive admin and onboarding activity summaries by email."
                    />
                    <Toggle
                      checked={profileForm.notificationPreferences.sms}
                      onChange={() =>
                        setProfileForm((current) => ({
                          ...current,
                          notificationPreferences: {
                            ...current.notificationPreferences,
                            sms: !current.notificationPreferences.sms,
                          },
                        }))
                      }
                      label="SMS escalation alerts"
                      description="Turn on urgent text notifications for time-sensitive operational issues."
                    />
                    <Toggle
                      checked={profileForm.notificationPreferences.push}
                      onChange={() =>
                        setProfileForm((current) => ({
                          ...current,
                          notificationPreferences: {
                            ...current.notificationPreferences,
                            push: !current.notificationPreferences.push,
                          },
                        }))
                      }
                      label="Push notifications"
                      description="Allow live activity prompts inside the PulseCheck experience."
                    />
                    <Toggle
                      checked={profileForm.notificationPreferences.weeklyDigest}
                      onChange={() =>
                        setProfileForm((current) => ({
                          ...current,
                          notificationPreferences: {
                            ...current.notificationPreferences,
                            weeklyDigest: !current.notificationPreferences.weeklyDigest,
                          },
                        }))
                      }
                      label="Weekly digest"
                      description="Receive a regular recap of onboarding progress and team readiness."
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {savingProfile ? 'Saving Setup...' : 'Save Profile and Role'}
                  </button>
                  <Link
                    href={`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                  >
                    Preview Team Workspace
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </form>

              <div className="grid gap-6 xl:grid-cols-2">
                <form onSubmit={handleCreateAdultInvite} className="rounded-[30px] border border-zinc-800 bg-[#091326] p-6">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-amber-300" />
                    <div>
                      <div className="text-lg font-semibold text-white">2. Invite Adults</div>
                      <div className="text-sm text-zinc-400">Secondary admins, coaches, and staff should enter before athletes.</div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Role</span>
                      <select
                        value={adultInviteForm.teamMembershipRole}
                        onChange={(event) =>
                          setAdultInviteForm((current) => ({
                            ...current,
                            teamMembershipRole: event.target.value as PulseCheckTeamMembershipRole,
                          }))
                        }
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300"
                      >
                        {adultRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Name</span>
                        <input
                          value={adultInviteForm.recipientName}
                          onChange={(event) => setAdultInviteForm((current) => ({ ...current, recipientName: event.target.value }))}
                          className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300"
                          placeholder="Jordan Ellis"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Title</span>
                        <input
                          value={adultInviteForm.invitedTitle}
                          onChange={(event) => setAdultInviteForm((current) => ({ ...current, invitedTitle: event.target.value }))}
                          className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300"
                          placeholder="Associate Head Coach"
                        />
                      </label>
                    </div>

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Email</span>
                      <input
                        value={adultInviteForm.targetEmail}
                        onChange={(event) => setAdultInviteForm((current) => ({ ...current, targetEmail: event.target.value }))}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300"
                        placeholder="coach@school.edu"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={creatingAdultInvite}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingAdultInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    {creatingAdultInvite ? 'Creating Adult Link...' : 'Generate Adult Invite Link'}
                  </button>

                  <div className="mt-5 space-y-3">
                    {adultInviteLinks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-4 text-sm text-zinc-500">
                        No adult invite links created yet.
                      </div>
                    ) : (
                      adultInviteLinks.slice(0, 4).map((invite) => (
                        <div key={invite.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">
                                {invite.recipientName || invite.targetEmail || formatInviteRole(invite.teamMembershipRole)}
                              </div>
                              <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                                {formatInviteRole(invite.teamMembershipRole)}
                                {invite.invitedTitle ? ` • ${invite.invitedTitle}` : ''}
                              </div>
                            </div>
                            <div className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">Active</div>
                          </div>
                          <div className="mt-3 break-all text-xs leading-6 text-zinc-400">{invite.activationUrl}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(invite.activationUrl, 'Invite link copied.')}
                              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-zinc-500"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </button>
                            <a
                              href={invite.activationUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-zinc-500"
                            >
                              <Waypoints className="h-3.5 w-3.5" />
                              Open
                            </a>
                            <a
                              href={buildMailto(invite, team?.displayName || 'Team', organization?.displayName || 'Organization')}
                              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-zinc-500"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Draft Email
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </form>

                <form onSubmit={handleCreateAthleteInvite} className="rounded-[30px] border border-zinc-800 bg-[#091326] p-6">
                  <div className="flex items-center gap-3">
                    <Waves className="h-5 w-5 text-emerald-300" />
                    <div>
                      <div className="text-lg font-semibold text-white">3. Invite Athletes</div>
                      <div className="text-sm text-zinc-400">Open this lane after your own identity and team-adult setup are in place.</div>
                    </div>
                  </div>

                  {!canInviteAthletes ? (
                    <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-4 text-sm leading-7 text-zinc-300">
                      Save your admin profile first. That locks in your operating role and opens the athlete lane.
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-4">
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Athlete Name</span>
                      <input
                        value={athleteInviteForm.recipientName}
                        onChange={(event) => setAthleteInviteForm((current) => ({ ...current, recipientName: event.target.value }))}
                        disabled={!canInviteAthletes}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Optional"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Email</span>
                      <input
                        value={athleteInviteForm.targetEmail}
                        onChange={(event) => setAthleteInviteForm((current) => ({ ...current, targetEmail: event.target.value }))}
                        disabled={!canInviteAthletes}
                        className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Optional if you want an open team-athlete link"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={creatingAthleteInvite || !canInviteAthletes}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingAthleteInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    {creatingAthleteInvite ? 'Creating Athlete Link...' : 'Generate Athlete Invite Link'}
                  </button>

                  <div className="mt-5 space-y-3">
                    {athleteInviteLinks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-4 text-sm text-zinc-500">
                        No athlete invite links created yet.
                      </div>
                    ) : (
                      athleteInviteLinks.slice(0, 4).map((invite) => (
                        <div key={invite.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">{invite.recipientName || invite.targetEmail || 'Open Athlete Link'}</div>
                              <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">Athlete Invite</div>
                            </div>
                            <div className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">Active</div>
                          </div>
                          <div className="mt-3 break-all text-xs leading-6 text-zinc-400">{invite.activationUrl}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(invite.activationUrl, 'Athlete link copied.')}
                              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-zinc-500"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </button>
                            <a
                              href={invite.activationUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-xs font-semibold text-white transition hover:border-zinc-500"
                            >
                              <Waypoints className="h-3.5 w-3.5" />
                              Open
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </form>
              </div>

              <div className="rounded-[30px] border border-zinc-800 bg-[#091326] p-6">
                <div className="flex items-center gap-3">
                  <ChevronRight className="h-5 w-5 text-cyan-300" />
                  <div>
                    <div className="text-lg font-semibold text-white">4. Landing Routing</div>
                    <div className="text-sm text-zinc-400">Your saved operating role shapes the focus of the shared team workspace.</div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {operatingRoleOptions.map((option) => (
                    <div
                      key={option.value}
                      className={`rounded-[24px] border bg-gradient-to-br p-4 ${
                        profileForm.operatingRole === option.value
                          ? option.accent
                          : 'border-zinc-800 from-black/20 to-black/10'
                      }`}
                    >
                      <div className="text-sm font-semibold text-white">{option.label}</div>
                      <div className="mt-2 text-sm leading-6 text-zinc-400">{option.description}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-cyan-200"
                  >
                    Open My Team Workspace
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 px-4 py-3 text-sm text-zinc-400">
                    {setupSaved ? <CheckCircle2 className="h-4 w-4 text-green-300" /> : <Loader2 className="h-4 w-4 text-zinc-500" />}
                    {setupSaved ? 'Profile step complete' : 'Save your profile to lock in routing'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
