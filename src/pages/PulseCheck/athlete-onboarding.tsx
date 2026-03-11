import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CheckCircle2, ChevronRight, ClipboardCheck, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type { PulseCheckOrganization, PulseCheckTeam, PulseCheckTeamMembership } from '../../api/firebase/pulsecheckProvisioning/types';
import { userService } from '../../api/firebase/user';
import { useUser, useUserLoading } from '../../hooks/useUser';

const CONSENT_VERSION = 'pulsecheck-product-consent-v1';
const BASELINE_PATHWAY_ID = 'pulsecheck-core-baseline-v1';

export default function PulseCheckAthleteOnboardingPage() {
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
  const [displayName, setDisplayName] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

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
        const nextMembership = memberships.find((entry) => entry.teamId === teamId && entry.role === 'athlete') || null;
        const [nextOrganization, nextTeam] = await Promise.all([
          organizationId ? pulseCheckProvisioningService.getOrganization(organizationId) : Promise.resolve(null),
          pulseCheckProvisioningService.getTeam(teamId),
        ]);

        if (!active) return;
        setMembership(nextMembership);
        setOrganization(nextOrganization);
        setTeam(nextTeam);
        setDisplayName(currentUser.displayName || '');
        setConsentAccepted(Boolean(nextMembership?.athleteOnboarding?.productConsentAccepted));
      } catch (error) {
        console.error('[PulseCheck athlete onboarding] Failed to load context:', error);
        if (active) setMessage({ type: 'error', text: 'Failed to load athlete onboarding.' });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser?.id, currentUserLoading, organizationId, teamId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !membership) return;
    if (!displayName.trim()) {
      setMessage({ type: 'error', text: 'Name is required.' });
      return;
    }
    if (!consentAccepted) {
      setMessage({ type: 'error', text: 'You must accept product consent to continue.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await userService.updateUser(currentUser.id, {
        ...currentUser.toDictionary(),
        displayName: displayName.trim(),
        updatedAt: new Date(),
      });
      const refreshedUser = await userService.fetchUserFromFirestore(currentUser.id);
      userService.nonUICurrentUser = refreshedUser;

      await pulseCheckProvisioningService.completeAthleteOnboarding({
        teamMembershipId: membership.id,
        consentVersion: CONSENT_VERSION,
        baselinePathwayId: BASELINE_PATHWAY_ID,
      });

      setMessage({ type: 'success', text: 'Athlete onboarding complete. Your baseline path is ready.' });
      router.push(`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`);
    } catch (error) {
      console.error('[PulseCheck athlete onboarding] Failed to save onboarding:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save onboarding.' });
    } finally {
      setSaving(false);
    }
  };

  if (currentUserLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070c] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (!currentUser || !membership || membership.role !== 'athlete') {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      <Head>
        <title>PulseCheck Athlete Onboarding</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 md:px-6">
        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-[32px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.12),_transparent_42%),#09111e] p-8 shadow-2xl">
            <div className="space-y-5">
              <div className="inline-flex rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3">
                <ShieldCheck className="h-6 w-6 text-emerald-200" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Athlete Onboarding</p>
                <h1 className="mt-2 text-3xl font-semibold">Enter {team?.displayName || 'your team'}</h1>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  This step captures product consent and places you into the initial PulseCheck baseline path for {organization?.displayName || 'your organization'}.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
                Research-mode branching comes later when pilots are introduced. For now this lane is product consent plus baseline readiness.
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
              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Your Name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300"
                />
              </label>

              <div className="rounded-[28px] border border-zinc-800 bg-black/20 p-5">
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="h-5 w-5 text-emerald-300" />
                  <div className="text-base font-semibold text-white">Product Consent</div>
                </div>
                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  By continuing, you agree to use PulseCheck as a product participant for your team. This onboarding step does not place you into research participation.
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-800 px-4 py-4 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(event) => setConsentAccepted(event.target.checked)}
                    className="mt-1"
                  />
                  <span>I accept PulseCheck product onboarding and consent to entering the team baseline path.</span>
                </label>
              </div>

              <div className="rounded-[28px] border border-zinc-800 bg-black/20 p-5">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-emerald-300" />
                  <div className="text-base font-semibold text-white">Baseline Path</div>
                </div>
                <p className="mt-4 text-sm leading-7 text-zinc-300">
                  Your first-release baseline path is <span className="font-medium text-white">PulseCheck Core Baseline</span>. That means your account is marked ready for baseline-oriented mental-performance entry once you complete consent.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? 'Completing...' : 'Complete Athlete Onboarding'}
              </button>
              <Link
                href={`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
              >
                Back to Team
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
