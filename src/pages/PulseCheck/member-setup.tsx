import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bell, CheckCircle2, ChevronRight, Loader2, UserRound } from 'lucide-react';
import { firebaseStorageService, UploadImageType } from '../../api/firebase/storage/service';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type { PulseCheckNotificationPreferences, PulseCheckOrganization, PulseCheckTeam, PulseCheckTeamMembership } from '../../api/firebase/pulsecheckProvisioning/types';
import { userService } from '../../api/firebase/user';
import { useUser, useUserLoading } from '../../hooks/useUser';

const defaultPreferences: PulseCheckNotificationPreferences = {
  email: true,
  sms: false,
  push: true,
  weeklyDigest: true,
};

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
      router.push(`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`);
    } catch (error) {
      console.error('[PulseCheck member setup] Failed to save setup:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save your setup.' });
    } finally {
      setSaving(false);
    }
  };

  if (currentUserLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070c] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
      </div>
    );
  }

  if (!currentUser || !membership || membership.role === 'athlete' || membership.role === 'team-admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>PulseCheck Member Setup</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 md:px-6">
        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[32px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.12),_transparent_42%),#09111e] p-8 shadow-2xl">
            <div className="space-y-5">
              <div className="inline-flex rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3">
                <UserRound className="h-6 w-6 text-cyan-200" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Member Setup</p>
                <h1 className="mt-2 text-3xl font-semibold">{team?.displayName || 'PulseCheck Team'}</h1>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  Confirm your identity, title, and notification posture before entering the team workspace for {organization?.displayName || 'your organization'}.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
                Your assigned role is <span className="font-medium text-white">{membership.role}</span>. Roster scope and athlete visibility are controlled by the team admin.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[32px] border border-zinc-800 bg-[#090f1c] p-8 shadow-2xl">
            {message ? (
              <div
                className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                  message.type === 'success'
                    ? 'border-green-500/20 bg-green-500/[0.06] text-green-200'
                    : 'border-red-500/20 bg-red-500/[0.06] text-red-200'
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <div className="space-y-5">
              <div className="rounded-[28px] border border-zinc-800 bg-black/20 p-5">
                <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[24px] border border-zinc-700 bg-zinc-900">
                  {profileImagePreview ? (
                    <img src={profileImagePreview} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-4xl font-semibold text-zinc-500">
                      {(form.displayName || currentUser.displayName || currentUser.username || 'U').charAt(0).toUpperCase()}
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

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Name</span>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                  className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                  placeholder="Assistant Coach"
                />
              </label>

              <div className="rounded-[28px] border border-zinc-800 bg-black/20 p-5">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-cyan-300" />
                  <div className="text-base font-semibold text-white">Notification Preferences</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {([
                    ['email', 'Email updates'],
                    ['sms', 'SMS alerts'],
                    ['push', 'Push notifications'],
                    ['weeklyDigest', 'Weekly digest'],
                  ] as Array<[keyof PulseCheckNotificationPreferences, string]>).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleToggle(key)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        form.notificationPreferences[key]
                          ? 'border-cyan-300/50 bg-cyan-400/[0.08] text-white'
                          : 'border-zinc-800 bg-black/20 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Complete Member Setup'}
              </button>
              <Link
                href={`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
              >
                Skip for Now
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
