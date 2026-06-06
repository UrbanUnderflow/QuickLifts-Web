import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bell, CheckCircle2, ChevronRight, Copy, Loader2, Mail, Shield, Sparkles, UserRound, Users, Waves, Waypoints } from 'lucide-react';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import { PULSECHECK_INTAKE_FORM_VERSION } from '../../api/firebase/pulsecheckProvisioning/types';
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

// Canonical PulseCheck brand tokens (see public/pulsecheck-design-system.html).
const PC = {
  pageBg: '#070711',
  deepBg: '#0B0B1C',
  purple: '#7C3AED',
  purpleSoft: '#a78bfa',
  cardBorder: 'rgba(255,255,255,0.10)',
};

const WIZARD_STEPS = ['Your profile', 'Invite staff', 'Invite athletes', "You're set"];

const Stepper = ({ current }: { current: number }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
    {WIZARD_STEPS.map((label, index) => {
      const stepNumber = index + 1;
      const done = stepNumber < current;
      const active = stepNumber === current;
      return (
        <React.Fragment key={label}>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition"
              style={{
                background: active || done ? PC.purple : 'rgba(255,255,255,0.06)',
                color: active || done ? '#fff' : '#71717a',
              }}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : stepNumber}
            </span>
            <span className="text-xs font-semibold" style={{ color: active ? '#fff' : done ? PC.purpleSoft : '#71717a' }}>
              {label}
            </span>
          </div>
          {stepNumber < WIZARD_STEPS.length ? <span className="h-px w-5 bg-white/10" /> : null}
        </React.Fragment>
      );
    })}
  </div>
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
  const [step, setStep] = useState(1);

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
  const [coachIntakeAnswers, setCoachIntakeAnswers] = useState<Record<string, string | number | string[]>>({});

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
    setCoachIntakeAnswers(membership.coachIntakeResponses || {});
  }, [membership]);

  const coachIntakeQuestions = team?.intake?.coach?.questions || [];
  const coachIntakeFormVersion = team?.intake?.coach?.version || PULSECHECK_INTAKE_FORM_VERSION;
  const isCoachIntakeAnswerEmpty = (value: string | number | string[] | undefined) =>
    value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  const coachIntakeComplete = coachIntakeQuestions
    .filter((question) => question.required)
    .every((question) => !isCoachIntakeAnswerEmpty(coachIntakeAnswers[question.id]));
  const setCoachIntakeAnswer = (questionId: string, value: string | number | string[]) => {
    setCoachIntakeAnswers((current) => ({ ...current, [questionId]: value }));
  };

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
    if (!coachIntakeComplete) {
      setMessage({ type: 'error', text: 'Please answer the required intake questions before continuing.' });
      return;
    }

    setSavingProfile(true);
    setMessage(null);

    try {
      let profileImageUrl = currentUser.profileImage?.profileImageURL || '';
      if (profileImageFile) {
        const { firebaseStorageService, UploadImageType } = await import('../../api/firebase/storage/service');
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
        ...(coachIntakeQuestions.length > 0
          ? { intakeResponses: coachIntakeAnswers, intakeFormVersion: coachIntakeFormVersion }
          : {}),
      });

      const refreshedUser = await userService.fetchUserFromFirestore(currentUser.id);
      userService.nonUICurrentUser = refreshedUser;
      await refreshContext();
      setProfileImageFile(null);
      setMessage({ type: 'success', text: 'Profile saved — nice. Let’s bring your team in.' });
      setStep(2);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <div className="flex min-h-screen items-center justify-center text-white" style={{ background: PC.pageBg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: PC.purpleSoft }} />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  if (!membership || membership.role !== 'team-admin') {
    return (
      <div className="min-h-screen px-4 py-16 text-white" style={{ background: PC.pageBg }}>
        <div className="mx-auto max-w-3xl rounded-[32px] border p-10 text-center shadow-2xl" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
          <Shield className="mx-auto h-10 w-10" style={{ color: PC.purpleSoft }} />
          <h1 className="mt-6 text-3xl font-bold">This setup is just for team admins</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            Your account is active — this page is only for the coach setting up the team. Head to your workspace to get going.
          </p>
          <Link
            href={`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
            className="mt-8 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: PC.purple }}
          >
            Go to my workspace
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white" style={{ background: PC.pageBg, fontFamily: 'Switzer, sans-serif' }}>
      <Head>
        <title>Set up your PulseCheck team</title>
        <meta name="robots" content="noindex,nofollow" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&display=swap"
          rel="stylesheet"
        />
          <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800,900&display=swap" />
      </Head>

      <div className="pointer-events-none absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.20) 0%, transparent 70%)' }} />

      <main className="relative mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-10">
        {/* Brand + progress header */}
        <div className="mb-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <img src="/pulsecheck-logo.svg" alt="PulseCheck" width={36} height={36} className="rounded-[10px]" />
            <span className="text-base font-bold tracking-tight" style={{ fontFamily: 'Switzer, sans-serif' }}>PulseCheck</span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: PC.purpleSoft }}>Let's set up {team?.displayName || 'your team'}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl" style={{ fontFamily: 'Switzer, sans-serif' }}>
              A few quick steps and you're live
            </h1>
          </div>
          <Stepper current={step} />
          {message ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200'
                  : 'border-red-500/20 bg-red-500/[0.06] text-red-200'
              }`}
            >
              {message.text}
            </div>
          ) : null}
        </div>

        <section>
          <div className="grid gap-6">
              {step === 1 && (
              <form onSubmit={handleSaveProfile} className="rounded-[30px] border p-6" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
                <div className="flex items-center gap-3">
                  <UserRound className="h-5 w-5" style={{ color: PC.purpleSoft }} />
                  <div>
                    <div className="text-lg font-semibold text-white">Tell us about you</div>
                    <div className="text-sm text-zinc-400">Your name, photo, and how you'll use PulseCheck with your team.</div>
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

                {coachIntakeQuestions.length > 0 ? (
                  <div className="mt-6 rounded-2xl border border-zinc-800 bg-[#0b1730] p-5">
                    <div className="text-base font-semibold text-white">A Few Questions</div>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      A quick read so we can tailor PulseCheck to your team. Takes a minute.
                    </p>
                    <div className="mt-4 space-y-5">
                      {coachIntakeQuestions.map((question) => {
                        const answer = coachIntakeAnswers[question.id];
                        return (
                          <div key={question.id} className="space-y-2">
                            <span className="block text-sm text-zinc-300">
                              {question.question}
                              {question.required ? <span className="text-cyan-300"> *</span> : null}
                            </span>
                            {question.type === 'text' ? (
                              <textarea
                                value={typeof answer === 'string' ? answer : ''}
                                onChange={(e) => setCoachIntakeAnswer(question.id, e.target.value)}
                                rows={2}
                                className="w-full rounded-xl border border-zinc-700 bg-[#06101f] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50 placeholder:text-zinc-600"
                                placeholder="Your answer"
                              />
                            ) : null}
                            {question.type === 'number' ? (
                              <input
                                type="number"
                                value={typeof answer === 'number' ? answer : typeof answer === 'string' ? answer : ''}
                                min={question.minValue}
                                max={question.maxValue}
                                onChange={(e) => setCoachIntakeAnswer(question.id, e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-40 rounded-xl border border-zinc-700 bg-[#06101f] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                                placeholder={question.minValue !== undefined && question.maxValue !== undefined ? `${question.minValue}–${question.maxValue}` : 'Number'}
                              />
                            ) : null}
                            {question.type === 'yes_no' ? (
                              <div className="flex gap-3">
                                {['Yes', 'No'].map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setCoachIntakeAnswer(question.id, opt)}
                                    className={`rounded-xl border px-5 py-2 text-sm transition ${
                                      answer === opt
                                        ? 'border-cyan-400/50 bg-cyan-400/10 text-white'
                                        : 'border-zinc-700 bg-[#06101f] text-zinc-300 hover:border-zinc-500'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {question.type === 'multiple_choice' ? (
                              <div className="grid gap-2">
                                {(question.options || []).map((opt) => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setCoachIntakeAnswer(question.id, opt.text)}
                                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                                      answer === opt.text
                                        ? 'border-cyan-400/50 bg-cyan-400/10 text-white'
                                        : 'border-zinc-700 bg-[#06101f] text-zinc-300 hover:border-zinc-500'
                                    }`}
                                  >
                                    {opt.text}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    style={{ background: PC.purple }}
                  >
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {savingProfile ? 'Saving…' : 'Save & continue'}
                  </button>
                </div>
              </form>
              )}

              {step === 2 && (
                <form onSubmit={handleCreateAdultInvite} className="rounded-[30px] border p-6" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5" style={{ color: PC.purpleSoft }} />
                    <div>
                      <div className="text-lg font-semibold text-white">Bring your staff in</div>
                      <div className="text-sm text-zinc-400">Invite the coaches and staff who'll help run the team. Optional — you can do this anytime.</div>
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
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-5">
                    <button type="button" onClick={() => setStep(1)} className="text-sm font-semibold text-zinc-400 transition hover:text-white">
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(3);
                        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: PC.purple }}
                    >
                      {adultInviteLinks.length > 0 ? 'Continue' : 'Skip for now'}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}

              {step === 3 && (
                <form onSubmit={handleCreateAthleteInvite} className="rounded-[30px] border p-6" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
                  <div className="flex items-center gap-3">
                    <Waves className="h-5 w-5" style={{ color: PC.purpleSoft }} />
                    <div>
                      <div className="text-lg font-semibold text-white">Invite your athletes</div>
                      <div className="text-sm text-zinc-400">Send athletes their link now, or come back to this anytime from your workspace.</div>
                    </div>
                  </div>

                  {!canInviteAthletes ? (
                    <div className="mt-5 rounded-2xl border px-4 py-4 text-sm leading-7 text-zinc-300" style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.06)' }}>
                      Save your profile first — that opens up athlete invites.
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
                              <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
                                {invite.cohortName ? `Cohort Invite · ${invite.cohortName}` : 'Team Athlete Invite'}
                              </div>
                              {invite.pilotName ? <div className="mt-1 text-xs text-zinc-500">Pilot: {invite.pilotName}</div> : null}
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
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-5">
                    <button type="button" onClick={() => setStep(2)} className="text-sm font-semibold text-zinc-400 transition hover:text-white">
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(4);
                        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: PC.purple }}
                    >
                      {athleteInviteLinks.length > 0 ? 'Finish setup' : 'Skip for now'}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}

              {step === 4 && (
                <div className="rounded-[30px] border p-8 text-center" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
                  <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(124,58,237,0.16)' }}>
                    <CheckCircle2 className="h-8 w-8" style={{ color: PC.purpleSoft }} />
                  </div>
                  <h2 className="mt-5 text-3xl font-bold text-white" style={{ fontFamily: 'Switzer, sans-serif' }}>
                    You're all set, Coach 🎉
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-zinc-300">
                    {team?.displayName || 'Your team'} is live. As your athletes join, you'll see their readiness and mental-performance
                    signals right in your workspace.
                  </p>

                  <div className="mx-auto mt-6 grid max-w-xl gap-3 text-left sm:grid-cols-3">
                    {[
                      { icon: Users, label: 'Staff invited', value: adultInviteLinks.length },
                      { icon: Waves, label: 'Athletes invited', value: athleteInviteLinks.length },
                      { icon: Sparkles, label: 'Profile', value: setupSaved ? 'Ready' : '—' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-2xl border p-4" style={{ borderColor: PC.cardBorder, background: 'rgba(255,255,255,0.03)' }}>
                        <stat.icon className="h-4 w-4" style={{ color: PC.purpleSoft }} />
                        <div className="mt-3 text-2xl font-bold text-white">{stat.value}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-500">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link
                      href={`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: PC.purple }}
                    >
                      Open my workspace
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                    {athleteInviteLinks.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30"
                        style={{ borderColor: PC.cardBorder }}
                      >
                        Invite athletes first
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
        </section>
      </main>
    </div>
  );
}
