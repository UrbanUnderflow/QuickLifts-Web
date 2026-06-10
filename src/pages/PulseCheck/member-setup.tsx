import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bell, CheckCircle2, ChevronRight, Loader2, UserRound } from 'lucide-react';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type { PulseCheckNotificationPreferences, PulseCheckOrganization, PulseCheckTeam, PulseCheckTeamMembership } from '../../api/firebase/pulsecheckProvisioning/types';
import { userService } from '../../api/firebase/user';
import { useUser, useUserLoading } from '../../hooks/useUser';

// Canonical PulseCheck brand tokens (see public/pulsecheck-design-system.html).
const PC = {
  pageBg: '#070711',
  deepBg: '#0B0B1C',
  purple: '#7C3AED',
  purpleSoft: '#a78bfa',
  cardBorder: 'rgba(255,255,255,0.10)',
};

const defaultPreferences: PulseCheckNotificationPreferences = {
  email: true,
  sms: false,
  push: true,
  weeklyDigest: true,
};

const NOTIFICATION_OPTIONS: { key: keyof PulseCheckNotificationPreferences; label: string; description: string }[] = [
  { key: 'email', label: 'Email updates', description: 'Receive admin and onboarding activity summaries by email.' },
  { key: 'sms', label: 'SMS escalation alerts', description: 'Turn on urgent text notifications for time-sensitive operational issues.' },
  { key: 'push', label: 'Push notifications', description: 'Allow live activity prompts inside the PulseCheck experience.' },
  { key: 'weeklyDigest', label: 'Weekly digest', description: 'Receive a regular recap of onboarding progress and team readiness.' },
];

// On-brand toggle — matches the activation onboarding (post-activation.tsx).
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
      checked ? 'border-cyan-300/50 bg-cyan-400/[0.08]' : 'border-zinc-800 bg-black/20 hover:border-zinc-700'
    }`}
  >
    <div>
      <div className="text-sm font-semibold text-white">{label}</div>
      <div className="mt-1 text-sm leading-6 text-zinc-400">{description}</div>
    </div>
    <div className={`mt-1 flex h-6 w-11 items-center rounded-full p-1 transition ${checked ? 'bg-cyan-300 justify-end' : 'bg-zinc-700 justify-start'}`}>
      <div className="h-4 w-4 rounded-full bg-black" />
    </div>
  </button>
);

export default function PulseCheckMemberSetupPage() {
  const router = useRouter();
  const currentUser = useUser();
  const currentUserLoading = useUserLoading();
  const organizationId = typeof router.query.organizationId === 'string' ? router.query.organizationId : '';
  const teamId = typeof router.query.teamId === 'string' ? router.query.teamId : '';

  const [membership, setMembership] = useState<PulseCheckTeamMembership | null>(null);
  const [organization, setOrganization] = useState<PulseCheckOrganization | null>(null);
  const [team, setTeam] = useState<PulseCheckTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState('');
  const [form, setForm] = useState({
    displayName: '',
    title: '',
    notificationPreferences: defaultPreferences,
  });

  useEffect(() => {
    if (currentUserLoading) return;
    if (!currentUser?.id || !teamId) {
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(currentUser.id);
        const nextMembership = memberships.find((entry) => entry.teamId === teamId) || null;
        const [nextOrganization, nextTeam] = await Promise.all([
          organizationId ? pulseCheckProvisioningService.getOrganization(organizationId) : Promise.resolve(null),
          pulseCheckProvisioningService.getTeam(teamId),
        ]);

        if (!active) return;
        setMembership(nextMembership);
        setOrganization(nextOrganization);
        setTeam(nextTeam);
        setForm({
          displayName: currentUser.displayName || '',
          title: nextMembership?.title || '',
          notificationPreferences: nextMembership?.notificationPreferences || defaultPreferences,
        });
        setProfileImagePreview(currentUser.profileImage?.profileImageURL || '');
      } catch (error) {
        console.error('[PulseCheck member setup] Failed to load setup context:', error);
        if (active) setMessage({ type: 'error', text: 'Failed to load your member setup.' });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUserLoading, organizationId, teamId]);

  const handleToggle = (key: keyof PulseCheckNotificationPreferences) => {
    setForm((current) => ({
      ...current,
      notificationPreferences: {
        ...current.notificationPreferences,
        [key]: !current.notificationPreferences[key],
      },
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !membership) return;

    const displayName = form.displayName.trim();
    const title = form.title.trim();
    if (!displayName || !title) {
      setMessage({ type: 'error', text: 'Name and title are required.' });
      return;
    }

    setSaving(true);
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

      await pulseCheckProvisioningService.saveAdultMemberSetup({
        teamMembershipId: membership.id,
        title,
        notificationPreferences: form.notificationPreferences,
      });

      const refreshedUser = await userService.fetchUserFromFirestore(currentUser.id);
      userService.nonUICurrentUser = refreshedUser;
      setMessage({ type: 'success', text: 'Your member setup is complete.' });
      // Converged: staff land on the coach dashboard (nav gated by capabilities).
      router.push('/coach/dashboard');
    } catch (error) {
      console.error('[PulseCheck member setup] Failed to save setup:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save your setup.' });
    } finally {
      setSaving(false);
    }
  };

  if (currentUserLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white" style={{ background: PC.pageBg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: PC.purpleSoft }} />
      </div>
    );
  }

  if (!currentUser || !membership || membership.role === 'athlete' || membership.role === 'team-admin') {
    return null;
  }

  const inputClass =
    'w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300';

  return (
    <div className="relative min-h-screen overflow-hidden text-white" style={{ background: PC.pageBg, fontFamily: 'Switzer, sans-serif' }}>
      <Head>
        <title>PulseCheck Member Setup</title>
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
        {/* Brand + header */}
        <div className="mb-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <img src="/pulsecheck-logo.svg" alt="PulseCheck" width={36} height={36} className="rounded-[10px]" />
            <span className="text-base font-bold tracking-tight" style={{ fontFamily: 'Switzer, sans-serif' }}>PulseCheck</span>
          </div>
          <div>
            <p className="text-sm font-medium tracking-tight" style={{ color: PC.purpleSoft }}>Welcome to {team?.displayName || 'your team'}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl" style={{ fontFamily: 'Switzer, sans-serif' }}>
              Finish setting up your access
            </h1>
          </div>
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

        <form onSubmit={handleSubmit} className="rounded-[30px] border p-6" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
          <div className="flex items-center gap-3">
            <UserRound className="h-5 w-5" style={{ color: PC.purpleSoft }} />
            <div>
              <div className="text-lg font-semibold text-white">Tell us about you</div>
              <div className="text-sm text-zinc-400">
                Your assigned access is <span className="font-medium text-zinc-200">{membership.role}</span> — roster scope and athlete visibility are controlled by the team admin.
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-[160px_minmax(0,1fr)]">
            <div className="rounded-[28px] border border-zinc-800 bg-black/20 p-4">
              <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[24px] border border-zinc-700 bg-zinc-900">
                {profileImagePreview ? (
                  <img src={profileImagePreview} alt="Profile preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-4xl font-semibold text-zinc-500">
                    {(form.displayName || currentUser.displayName || currentUser.username || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <label className="mt-4 block cursor-pointer rounded-2xl border border-zinc-700 px-3 py-2 text-center text-sm font-medium text-white transition hover:border-[#7C3AED]">
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
              <label className="space-y-2">
                <span className="text-xs tracking-normal text-zinc-500">Name</span>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                  className={inputClass}
                  placeholder="Alex Rivera"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs tracking-normal text-zinc-500">Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className={inputClass}
                  placeholder="Assistant Coach"
                />
              </label>
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
              {NOTIFICATION_OPTIONS.map((opt) => (
                <Toggle
                  key={opt.key}
                  checked={form.notificationPreferences[opt.key]}
                  onChange={() => handleToggle(opt.key)}
                  label={opt.label}
                  description={opt.description}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: PC.purple }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Complete Member Setup'}
            </button>
            <Link
              href="/coach/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30"
              style={{ borderColor: PC.cardBorder }}
            >
              Skip for Now
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
