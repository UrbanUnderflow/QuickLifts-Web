import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bell, Check, CheckCircle2, ChevronRight, Copy, Loader2, Mail, Shield, Sparkles, UserRound, Users, Waypoints } from 'lucide-react';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import { PULSECHECK_INTAKE_FORM_VERSION } from '../../api/firebase/pulsecheckProvisioning/types';
import type {
  PulseCheckInviteLink,
  PulseCheckNotificationPreferences,
  PulseCheckOrganization,
  PulseCheckTeam,
  PulseCheckTeamMembership,
  PulseCheckTeamMembershipRole,
  StaffPermission,
} from '../../api/firebase/pulsecheckProvisioning/types';
import { deriveMembershipAccessFromCapabilities } from '../../api/firebase/pulsecheckProvisioning/staffCapabilities';
import { STAFF_PERMISSIONS } from '../../lib/staffPermissions';
import { userService } from '../../api/firebase/user';
import { useUser, useUserLoading } from '../../hooks/useUser';


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

// Normalize loosely-typed phone input into E.164 (e.g. +13015551234).
// Defaults bare 10-digit input to US (+1). Returns '' if it can't be normalized.
const normalizePhoneToE164 = (raw: string): string => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (hasPlus) {
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : '';
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return '';
};

const isValidE164 = (value: string): boolean => /^\+\d{10,15}$/.test(value);

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

// Build a throwaway invite link for the screen demo. Nothing is persisted — this
// just mirrors the shape of a real created link so the UI (toast, link card, copy,
// cleared form, "add another") behaves exactly as it would in production.
const makeDemoInvite = (params: {
  teamMembershipRole: PulseCheckTeamMembershipRole;
  targetEmail: string;
  recipientName?: string;
  invitedTitle?: string;
}): PulseCheckInviteLink => {
  const token = `demo-${Math.random().toString(36).slice(2, 10)}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fitwithpulse.ai';
  return {
    id: token,
    inviteType: 'team-access',
    status: 'active',
    redemptionMode: 'single-use',
    organizationId: 'demo-organization',
    teamId: 'demo-team',
    teamMembershipRole: params.teamMembershipRole,
    invitedTitle: params.invitedTitle || undefined,
    recipientName: params.recipientName || undefined,
    targetEmail: params.targetEmail,
    token,
    activationUrl: `${origin}/PulseCheck/team-invite/${token}`,
    createdAt: null,
    updatedAt: null,
  };
};

const WIZARD_STEPS = ['Your profile', 'Invite staff', "You're set"];

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
  // Screen Demo mode (see /admin/screenDemo): bypass auth + real saves so the
  // onboarding can be walked end-to-end. Strictly gated — real flow untouched.
  const isDemo = router.query.demo === '1';
  const demoTeamName = typeof router.query.teamName === 'string' ? router.query.teamName : 'Your team';

  const [membership, setMembership] = useState<PulseCheckTeamMembership | null>(null);
  const [organization, setOrganization] = useState<PulseCheckOrganization | null>(null);
  const [team, setTeam] = useState<PulseCheckTeam | null>(null);
  const [inviteLinks, setInviteLinks] = useState<PulseCheckInviteLink[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [creatingAdultInvite, setCreatingAdultInvite] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [step, setStep] = useState(1);

  const [profileForm, setProfileForm] = useState({
    displayName: '',
    title: '',
    phone: '',
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
    staffCapabilities: ['coaching'] as StaffPermission[],
  });
  const [staffPhotoFile, setStaffPhotoFile] = useState<File | null>(null);
  const [staffPhotoPreview, setStaffPhotoPreview] = useState('');

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
    if (!isDemo) return;
    setProfileForm((current) => ({
      ...current,
      displayName: current.displayName || 'Tre',
      title: current.title || 'Head Coach',
    }));
  }, [isDemo]);

  useEffect(() => {
    if (!membership) return;
    setProfileForm((current) => ({
      ...current,
      title: membership.title || current.title,
      phone: membership.phone || current.phone,
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
  const notificationSummary = useMemo(() => {
    const prefs = profileForm.notificationPreferences;
    const enabled = [
      prefs.email && 'Email',
      prefs.sms && 'SMS',
      prefs.push && 'Push',
      prefs.weeklyDigest && 'Weekly digest',
    ].filter(Boolean);
    return enabled.length ? enabled.join(' · ') : 'Off';
  }, [profileForm.notificationPreferences]);

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
    if (isDemo) {
      setMessage(null);
      setStep(2);
      return;
    }
    if (!currentUser || !membership || !organization || !team) return;

    const displayName = profileForm.displayName.trim();
    const title = profileForm.title.trim();
    if (!displayName || !title) {
      setMessage({ type: 'error', text: 'Name and title are required before continuing.' });
      return;
    }

    // SMS escalation alerts require a phone number we can actually text.
    const smsEnabled = profileForm.notificationPreferences.sms;
    const normalizedPhone = normalizePhoneToE164(profileForm.phone);
    if (smsEnabled) {
      if (!profileForm.phone.trim()) {
        setMessage({ type: 'error', text: 'Add a mobile number to receive SMS escalation alerts, or turn the toggle off.' });
        return;
      }
      if (!isValidE164(normalizedPhone)) {
        setMessage({ type: 'error', text: 'That phone number doesn’t look valid. Use a mobile number like (301) 555-1234.' });
        return;
      }
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
        notificationPreferences: profileForm.notificationPreferences,
        phone: smsEnabled ? normalizedPhone : '',
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

    const recipientName = adultInviteForm.recipientName.trim();
    if (!recipientName) {
      setMessage({ type: 'error', text: "Add the staff member's name first." });
      return;
    }
    const targetEmail = adultInviteForm.targetEmail.trim().toLowerCase();
    const derived = deriveMembershipAccessFromCapabilities(adultInviteForm.staffCapabilities);

    // Screen demo: simulate creation with a dummy link, no persistence.
    if (isDemo) {
      setCreatingAdultInvite(true);
      setMessage(null);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const demoInvite = makeDemoInvite({
        teamMembershipRole: derived.teamMembershipRole,
        targetEmail,
        recipientName,
        invitedTitle: adultInviteForm.invitedTitle.trim(),
      });
      setInviteLinks((current) => [demoInvite, ...current]);
      setAdultInviteForm({ recipientName: '', targetEmail: '', invitedTitle: '', staffCapabilities: ['coaching'] });
      setStaffPhotoFile(null);
      setStaffPhotoPreview('');
      setMessage({ type: 'success', text: 'Demo invite link created — add another, or continue. Nothing is saved.' });
      setCreatingAdultInvite(false);
      return;
    }

    if (!currentUser || !organization || !team) return;

    setCreatingAdultInvite(true);
    setMessage(null);

    try {
      let prefilledProfileImageUrl = '';
      if (staffPhotoFile) {
        try {
          const { firebaseStorageService, UploadImageType } = await import('../../api/firebase/storage/service');
          const upload = await firebaseStorageService.uploadImage(staffPhotoFile, UploadImageType.Profile);
          prefilledProfileImageUrl = upload.downloadURL;
        } catch (uploadError) {
          console.error('[PulseCheck post-activation] staff photo upload failed', uploadError);
        }
      }

      const inviteId = await pulseCheckProvisioningService.createTeamAccessInviteLink({
        organizationId: organization.id,
        teamId: team.id,
        teamMembershipRole: derived.teamMembershipRole,
        staffCapabilities: adultInviteForm.staffCapabilities,
        targetEmail: targetEmail || undefined,
        recipientName,
        invitedTitle: adultInviteForm.invitedTitle.trim(),
        prefilledProfileImageUrl,
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
        staffCapabilities: ['coaching'],
      });
      setStaffPhotoFile(null);
      setStaffPhotoPreview('');
      setMessage({ type: 'success', text: 'Adult onboarding link created and copied.' });
    } catch (error) {
      console.error('[PulseCheck post-activation] Failed to create adult invite:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create adult invite.' });
    } finally {
      setCreatingAdultInvite(false);
    }
  };

  if (!isDemo && (currentUserLoading || initializing)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white" style={{ background: PC.pageBg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: PC.purpleSoft }} />
      </div>
    );
  }

  if (!isDemo && !currentUser) {
    return null;
  }

  if (!isDemo && (!membership || membership.role !== 'team-admin')) {
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

      {isDemo ? (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2.5 text-center text-xs font-medium tracking-normal" style={{ background: 'rgba(124,58,237,0.12)', color: PC.purpleSoft, borderBottom: '1px solid rgba(124,58,237,0.22)' }}>
          <Sparkles className="h-3.5 w-3.5" />
          Screen demo — nothing is saved. Advance through each step to reach the dashboard.
        </div>
      ) : null}

      <div className="pointer-events-none absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.20) 0%, transparent 70%)' }} />

      <main className="relative mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-10">
        {/* Brand + progress header */}
        <div className="mb-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <img src="/pulsecheck-logo.svg" alt="PulseCheck" width={36} height={36} className="rounded-[10px]" />
            <span className="text-base font-bold tracking-tight" style={{ fontFamily: 'Switzer, sans-serif' }}>PulseCheck</span>
          </div>
          <div>
            <p className="text-sm font-medium tracking-tight" style={{ color: PC.purpleSoft }}>Let's set up {team?.displayName || (isDemo ? demoTeamName : 'your team')}</p>
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
                          {(profileForm.displayName || currentUser?.displayName || currentUser?.username || 'U').charAt(0).toUpperCase()}
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
                          setProfileImagePreview(file ? URL.createObjectURL(file) : currentUser?.profileImage?.profileImageURL || '');
                        }}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-xs tracking-normal text-zinc-500">Name</span>
                        <input
                          value={profileForm.displayName}
                          onChange={(event) => setProfileForm((current) => ({ ...current, displayName: event.target.value }))}
                          className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                          placeholder="Tremaine Grant"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-xs tracking-normal text-zinc-500">Title</span>
                        <input
                          value={profileForm.title}
                          onChange={(event) => setProfileForm((current) => ({ ...current, title: event.target.value }))}
                          className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                          placeholder="Athletic Director"
                        />
                      </label>
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

                  {profileForm.notificationPreferences.sms ? (
                    <div className="mt-4 rounded-2xl border border-cyan-300/40 bg-cyan-400/[0.06] p-4">
                      <label className="space-y-2 block">
                        <span className="text-xs tracking-normal text-zinc-300">
                          Mobile number for SMS alerts <span className="text-cyan-300">*</span>
                        </span>
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={profileForm.phone}
                          onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                          className="w-full rounded-2xl border border-zinc-700 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                          placeholder="(301) 555-1234"
                        />
                      </label>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">
                        We’ll only text you for urgent, time-sensitive escalations. Message &amp; data rates may apply. Reply STOP at any time to opt out.
                      </p>
                    </div>
                  ) : null}
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
                    {/* Optional photo + Name (required) + Title (optional) */}
                    <div className="flex items-center gap-4">
                      <label className="relative flex h-16 w-16 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-black/20 transition hover:border-amber-300">
                        {staffPhotoPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={staffPhotoPreview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <UserRound className="h-6 w-6 text-zinc-600" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            setStaffPhotoFile(file);
                            setStaffPhotoPreview(file ? URL.createObjectURL(file) : '');
                          }}
                        />
                      </label>
                      <div className="grid flex-1 gap-3 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-xs tracking-normal text-zinc-500">Name (required)</span>
                          <input
                            value={adultInviteForm.recipientName}
                            onChange={(event) => setAdultInviteForm((current) => ({ ...current, recipientName: event.target.value }))}
                            className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300"
                            placeholder="Jordan Ellis"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs tracking-normal text-zinc-500">Title (optional)</span>
                          <input
                            value={adultInviteForm.invitedTitle}
                            onChange={(event) => setAdultInviteForm((current) => ({ ...current, invitedTitle: event.target.value }))}
                            className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300"
                            placeholder="Associate Head Coach"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Permissions — same capability model as the dashboard staff invite */}
                    <div className="space-y-2">
                      <span className="text-xs tracking-normal text-zinc-500">Permissions</span>
                      <div className="grid gap-2">
                        {STAFF_PERMISSIONS.map((permission) => {
                          const on = adultInviteForm.staffCapabilities.includes(permission.key);
                          const Icon = permission.icon;
                          return (
                            <button
                              key={permission.key}
                              type="button"
                              onClick={() =>
                                setAdultInviteForm((current) => ({
                                  ...current,
                                  staffCapabilities: current.staffCapabilities.includes(permission.key)
                                    ? current.staffCapabilities.filter((capability) => capability !== permission.key)
                                    : [...current.staffCapabilities, permission.key],
                                }))
                              }
                              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                                on ? 'border-amber-300/50 bg-amber-300/10' : 'border-zinc-800 bg-black/20 hover:border-zinc-700'
                              }`}
                            >
                              <span
                                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                                  on ? 'border-amber-300 bg-amber-300 text-black' : 'border-zinc-600'
                                }`}
                              >
                                {on && <Check className="h-3.5 w-3.5" />}
                              </span>
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                                  <Icon className="h-3.5 w-3.5 text-amber-300/80" />
                                  {permission.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-zinc-500">{permission.blurb}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label className="space-y-2">
                      <span className="text-xs tracking-normal text-zinc-500">Email (optional)</span>
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
                    disabled={creatingAdultInvite || !adultInviteForm.recipientName.trim()}
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
                              <div className="mt-1 text-xs tracking-normal text-zinc-500">
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
                <div className="rounded-[30px] border p-8" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
                  <div className="text-center">
                    <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(124,58,237,0.16)' }}>
                      <CheckCircle2 className="h-8 w-8" style={{ color: PC.purpleSoft }} />
                    </div>
                    <h2 className="mt-5 text-3xl font-bold text-white" style={{ fontFamily: 'Switzer, sans-serif' }}>
                      You're all set, Coach 🎉
                    </h2>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-zinc-300">
                      {team?.displayName || (isDemo ? demoTeamName : 'Your team')} is live. Next, we'll walk you through your
                      dashboard — where you'll invite athletes, add more staff, and keep an eye on readiness.
                    </p>
                  </div>

                  {/* Profile confirmation */}
                  <div className="mx-auto mt-7 max-w-xl rounded-2xl border p-5" style={{ borderColor: PC.cardBorder, background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-zinc-700 bg-zinc-900">
                        {profileImagePreview ? (
                          <img src={profileImagePreview} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-2xl font-semibold text-zinc-500">
                            {(profileForm.displayName || 'C').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-white">{profileForm.displayName || 'Coach'}</div>
                        {profileForm.title ? <div className="text-sm text-zinc-400">{profileForm.title}</div> : null}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border p-4" style={{ borderColor: PC.cardBorder }}>
                        <Users className="h-4 w-4" style={{ color: PC.purpleSoft }} />
                        <div className="mt-2 text-2xl font-bold text-white">{adultInviteLinks.length}</div>
                        <div className="mt-1 text-xs tracking-normal text-zinc-500">Staff invited</div>
                      </div>
                      <div className="rounded-xl border p-4" style={{ borderColor: PC.cardBorder }}>
                        <Sparkles className="h-4 w-4" style={{ color: PC.purpleSoft }} />
                        <div className="mt-2 text-sm font-medium leading-6 text-white">{notificationSummary}</div>
                        <div className="mt-1 text-xs tracking-normal text-zinc-500">Notifications</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-7 flex items-center justify-center">
                    <Link
                      href={
                        isDemo
                          ? '/coach/dashboard/demo'
                          : `/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: PC.purple }}
                    >
                      {isDemo ? 'Confirm & open the coach dashboard' : 'Confirm & open my workspace'}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
        </section>
      </main>
    </div>
  );
}
