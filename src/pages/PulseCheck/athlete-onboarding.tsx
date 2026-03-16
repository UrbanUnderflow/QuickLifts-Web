import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type {
  PulseCheckOrganization,
  PulseCheckPilot,
  PulseCheckResearchConsentStatus,
  PulseCheckTeam,
  PulseCheckTeamMembership,
} from '../../api/firebase/pulsecheckProvisioning/types';
import { userService } from '../../api/firebase/user';
import { useUser, useUserLoading } from '../../hooks/useUser';

const CONSENT_VERSION = 'pulsecheck-product-consent-v1';
const RESEARCH_CONSENT_VERSION = 'pulsecheck-research-consent-v1';
const BASELINE_PATHWAY_ID = 'pulsecheck-core-baseline-v1';
const MEMBERSHIP_RETRY_ATTEMPTS = 6;
const MEMBERSHIP_RETRY_DELAY_MS = 500;

// ─── Floating Orb ────────────────────────────────────────────────────────────
const FloatingOrb: React.FC<{
  color: string;
  size: string;
  position: React.CSSProperties;
  delay?: number;
}> = ({ color, size, position, delay = 0 }) => (
  <motion.div
    className={`absolute ${size} rounded-full blur-3xl pointer-events-none`}
    style={{ backgroundColor: color, ...position }}
    animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.45, 0.25] }}
    transition={{ duration: 9, repeat: Infinity, delay, ease: 'easeInOut' }}
  />
);

// ─── Glass Card ───────────────────────────────────────────────────────────────
const GlassCard: React.FC<{
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
  delay?: number;
}> = ({ children, accentColor = '#E0FE10', className = '', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    className={`relative group ${className}`}
  >
    {/* Chromatic glow on hover */}
    <div
      className="absolute -inset-1 rounded-[28px] blur-xl opacity-0 group-hover:opacity-30 transition-all duration-700 pointer-events-none"
      style={{ background: `linear-gradient(135deg, ${accentColor}50, transparent 60%)` }}
    />
    {/* Glass surface */}
    <div className="relative rounded-[28px] overflow-hidden backdrop-blur-xl bg-zinc-900/40 border border-white/10">
      {/* Chromatic top reflection */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}70, transparent)` }}
      />
      {/* Inner highlight */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />
      {children}
    </div>
  </motion.div>
);

// ─── Glowing Checkbox ─────────────────────────────────────────────────────────
const GlowCheckbox: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-300 hover:border-[#E0FE10]/30 hover:bg-[#E0FE10]/[0.03] transition-all duration-300">
    <div className="relative mt-0.5 flex-shrink-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div
        className={`pointer-events-none w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
          checked
            ? 'border-[#E0FE10] bg-[#E0FE10]'
            : 'border-zinc-600 bg-transparent'
        }`}
        style={checked ? { boxShadow: '0 0 12px rgba(224,254,16,0.5)' } : {}}
      >
        {checked && (
          <motion.svg
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="w-3 h-3 text-black"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        )}
      </div>
      {checked && (
        <div className="pointer-events-none absolute inset-0 rounded-md blur-md bg-[#E0FE10] opacity-30 -z-10" />
      )}
    </div>
    <span>{label}</span>
  </label>
);

// ─── Section Card (inside form) ───────────────────────────────────────────────
const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  accentColor?: string;
  children: React.ReactNode;
  delay?: number;
}> = ({ icon, title, accentColor = '#E0FE10', children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    className="rounded-[20px] border border-white/8 bg-black/20 p-5 backdrop-blur-sm"
    style={{ borderColor: `${accentColor}15` }}
  >
    <div className="flex items-center gap-3 mb-4">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}
      >
        {icon}
      </div>
      <span className="text-base font-semibold text-white">{title}</span>
    </div>
    {children}
  </motion.div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PulseCheckAthleteOnboardingPage() {
  const router = useRouter();
  const currentUser = useUser();
  const currentUserLoading = useUserLoading();
  const organizationId = typeof router.query.organizationId === 'string' ? router.query.organizationId : '';
  const teamId = typeof router.query.teamId === 'string' ? router.query.teamId : '';

  const [membership, setMembership] = useState<PulseCheckTeamMembership | null>(null);
  const [organization, setOrganization] = useState<PulseCheckOrganization | null>(null);
  const [pilot, setPilot] = useState<PulseCheckPilot | null>(null);
  const [team, setTeam] = useState<PulseCheckTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [researchConsentStatus, setResearchConsentStatus] = useState<PulseCheckResearchConsentStatus>('not-required');
  const [progressHydrated, setProgressHydrated] = useState(false);

  useEffect(() => {
    if (currentUserLoading) return;
    if (!currentUser?.id || !teamId) { setLoading(false); return; }

    let active = true;
    (async () => {
      try {
        let nextMembership: PulseCheckTeamMembership | null = null;
        let nextOrganization: PulseCheckOrganization | null = null;
        let nextTeam: PulseCheckTeam | null = null;
        let nextPilot: PulseCheckPilot | null = null;

        for (let attempt = 0; attempt < MEMBERSHIP_RETRY_ATTEMPTS; attempt += 1) {
          const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(currentUser.id);
          nextMembership = memberships.find((entry) => entry.teamId === teamId && entry.role === 'athlete') || null;
          const targetPilotId = nextMembership?.athleteOnboarding?.targetPilotId || '';
          [nextOrganization, nextTeam, nextPilot] = await Promise.all([
            organizationId ? pulseCheckProvisioningService.getOrganization(organizationId) : Promise.resolve(null),
            pulseCheckProvisioningService.getTeam(teamId),
            targetPilotId ? pulseCheckProvisioningService.getPilot(targetPilotId) : Promise.resolve(null),
          ]);

          if (nextMembership || attempt === MEMBERSHIP_RETRY_ATTEMPTS - 1) {
            break;
          }

          await new Promise((resolve) => {
            window.setTimeout(resolve, MEMBERSHIP_RETRY_DELAY_MS);
          });
        }

        if (!active) return;
        setMembership(nextMembership);
        setOrganization(nextOrganization);
        setPilot(nextPilot);
        setTeam(nextTeam);
        setDisplayName(
          nextMembership?.athleteOnboarding?.entryOnboardingName
            || currentUser.displayName
            || ''
        );
        setConsentAccepted(Boolean(nextMembership?.athleteOnboarding?.productConsentAccepted));
        setResearchConsentStatus(
          (nextMembership?.athleteOnboarding?.researchConsentStatus as PulseCheckResearchConsentStatus | undefined)
            || (nextPilot?.studyMode === 'research' ? 'pending' : 'not-required')
        );
        setProgressHydrated(true);
      } catch (error) {
        console.error('[PulseCheck athlete onboarding] Failed to load context:', error);
        if (active) setMessage({ type: 'error', text: 'Failed to load athlete onboarding.' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [currentUser?.id, currentUserLoading, organizationId, teamId]);

  const requiresResearchConsent = pilot?.studyMode === 'research';
  const hasPilotEnrollment = Boolean(membership?.athleteOnboarding?.targetPilotId);

  useEffect(() => {
    if (!progressHydrated || !membership || saving || membership.onboardingStatus === 'complete') return;

    const trimmedName = displayName.trim();
    const researchChoiceMade = !requiresResearchConsent || researchConsentStatus === 'accepted' || researchConsentStatus === 'declined';
    const entryOnboardingStep = !trimmedName
      ? 'name'
      : !consentAccepted
        ? 'consent'
        : researchChoiceMade
          ? 'starting-point'
          : 'consent';

    const timeout = window.setTimeout(() => {
      pulseCheckProvisioningService.saveAthleteOnboardingProgress({
        teamMembershipId: membership.id,
        entryOnboardingStep,
        entryOnboardingName: trimmedName,
        productConsentAccepted: consentAccepted,
        researchConsentStatus: requiresResearchConsent ? researchConsentStatus : undefined,
      }).catch((error) => {
        console.error('[PulseCheck athlete onboarding] Failed to sync onboarding progress:', error);
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [consentAccepted, displayName, membership, progressHydrated, requiresResearchConsent, researchConsentStatus, saving]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !membership) return;
    if (!displayName.trim()) { setMessage({ type: 'error', text: 'Tell us what name you would like us to use.' }); return; }
    if (!consentAccepted) { setMessage({ type: 'error', text: 'Please agree before continuing.' }); return; }
    if (requiresResearchConsent && researchConsentStatus !== 'accepted' && researchConsentStatus !== 'declined') {
      setMessage({ type: 'error', text: 'Choose whether you want to participate in the research portion before continuing.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await userService.updateUser(currentUser.id, {
        ...currentUser.toDictionary(),
        displayName: displayName.trim(),
        preferredName: displayName.trim(),
        pulseCheckOnboardingComplete: true,
        updatedAt: new Date(),
      });
      const refreshedUser = await userService.fetchUserFromFirestore(currentUser.id);
      userService.nonUICurrentUser = refreshedUser;
      await pulseCheckProvisioningService.completeAthleteOnboarding({
        teamMembershipId: membership.id,
        consentVersion: CONSENT_VERSION,
        baselinePathwayId: BASELINE_PATHWAY_ID,
        researchConsentStatus: requiresResearchConsent ? researchConsentStatus : 'not-required',
        researchConsentVersion:
          requiresResearchConsent && (researchConsentStatus === 'accepted' || researchConsentStatus === 'declined')
            ? RESEARCH_CONSENT_VERSION
            : '',
      });
      setMessage({ type: 'success', text: 'Athlete onboarding complete. Your starting baseline is ready.' });
      router.push(`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`);
    } catch (error) {
      console.error('[PulseCheck athlete onboarding] Failed to save onboarding:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'We could not finish setup right now.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (currentUserLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070c]">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#E0FE10]/20 blur-2xl" />
          <Loader2 className="relative h-8 w-8 animate-spin text-[#E0FE10]" />
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  if (!membership || membership.role !== 'athlete') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070c] px-4 text-white">
        <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-zinc-900/60 p-8 text-center backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Athlete Onboarding</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">We are still attaching your team access</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Your invite was accepted, but the athlete membership has not loaded yet. Give it another moment and refresh if this page
            does not update on its own.
          </p>
          {message ? (
            <p className={`mt-4 text-sm ${message.type === 'error' ? 'text-red-300' : 'text-[#E0FE10]'}`}>
              {message.text}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const hasCohort = Boolean(membership?.athleteOnboarding?.targetCohortId);

  return (
    <div
      className="min-h-screen text-white overflow-hidden"
      style={{ background: '#05070c' }}
    >
      <Head>
        <title>Join Your Team | PulseCheck</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      {/* ── Animated background ───────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        <FloatingOrb color="#E0FE10" size="w-[500px] h-[500px]" position={{ top: '-8%', left: '-8%' }} delay={0} />
        <FloatingOrb color="#3B82F6" size="w-[400px] h-[400px]" position={{ top: '30%', right: '-6%' }} delay={3} />
        <FloatingOrb color="#8B5CF6" size="w-[350px] h-[350px]" position={{ bottom: '5%', left: '15%' }} delay={6} />
        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=")`,
          }}
        />
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-12 md:px-6">
        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">

          {/* ── Left Panel: Context ──────────────────────────────────────── */}
          <GlassCard accentColor="#E0FE10" delay={0.1}>
            <div className="p-8 space-y-6">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.25, type: 'spring', stiffness: 300 }}
                className="relative inline-flex"
              >
                <div className="absolute inset-0 rounded-2xl bg-[#E0FE10] blur-xl opacity-20" />
                <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(224,254,16,0.12)', border: '1px solid rgba(224,254,16,0.30)' }}>
                  <ShieldCheck className="h-6 w-6 text-[#E0FE10]" />
                </div>
              </motion.div>

              {/* Heading */}
              <div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xs uppercase tracking-[0.22em] text-zinc-500 mb-2"
                >
                  Athlete Onboarding
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="text-3xl font-bold tracking-tight text-white"
                >
                  Enter{' '}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: 'linear-gradient(90deg, #E0FE10, #84DFC1)' }}
                  >
                    {team?.displayName || 'your team'}
                  </span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                className="mt-3 text-sm leading-7 text-zinc-400"
              >
                You are joining {team?.displayName || 'your team'}. This step confirms your name, gets your consent,
                and gets your starting point ready so PulseCheck can personalize what comes next
                {organization?.displayName ? ` for ${organization.displayName}` : ''}.
                </motion.p>
              </div>

              {/* Cohort badge */}
              <AnimatePresence>
                {hasCohort && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.07] p-4 text-sm leading-7 text-zinc-300"
                  >
                    You are joining{' '}
                    <span className="font-medium text-white">
                      {membership?.athleteOnboarding?.targetCohortName || 'a cohort'}
                    </span>
                    {membership?.athleteOnboarding?.targetPilotName && (
                      <> inside <span className="font-medium text-white">{membership.athleteOnboarding.targetPilotName}</span></>
                    )}
                    . We will keep that group attached to your training as you finish setup.
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Info note */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-zinc-400 leading-relaxed"
              >
                {requiresResearchConsent
                  ? `Your invite is attached to ${pilot?.name || 'a research pilot'}. You can still use PulseCheck even if you decline research participation, but we need your choice before continuing.`
                  : hasPilotEnrollment
                    ? 'Your invite already includes a pilot or cohort assignment. For now, just finish setup and we will take you to your starting baseline.'
                    : 'Right now, we are just getting you set up so you can begin with a clear starting point.'}
              </motion.div>

              {/* Step indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-3 pt-2"
              >
                {['Name', 'Consent', ...(requiresResearchConsent ? ['Research'] : []), 'Starting Point'].map((step, i, steps) => (
                  <React.Fragment key={step}>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: 'rgba(224,254,16,0.15)',
                          border: '1px solid rgba(224,254,16,0.4)',
                          color: '#E0FE10',
                        }}
                      >
                        {i + 1}
                      </div>
                      <span className="text-xs text-zinc-500">{step}</span>
                    </div>
                    {i < steps.length - 1 && <div className="flex-1 h-[1px] bg-zinc-800" />}
                  </React.Fragment>
                ))}
              </motion.div>
            </div>
          </GlassCard>

          {/* ── Right Panel: Form ────────────────────────────────────────── */}
          <GlassCard accentColor="#3B82F6" delay={0.2}>
            <form onSubmit={handleSubmit} className="p-8">
              {/* Error / Success Banner */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${
                      message.type === 'success'
                        ? 'border-[#E0FE10]/20 bg-[#E0FE10]/[0.06] text-[#E0FE10]'
                        : 'border-red-500/20 bg-red-500/[0.06] text-red-300'
                    }`}
                  >
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-5">
                {/* Name field */}
                <motion.label
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="block space-y-2"
                >
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Your Name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all duration-300 focus:border-[#E0FE10]/50 focus:bg-[#E0FE10]/[0.04] placeholder:text-zinc-600 backdrop-blur-sm"
                    style={{ boxShadow: 'none' }}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(224,254,16,0.12)'; }}
                    onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
                    placeholder="Enter your name"
                  />
                </motion.label>

                {/* Product Consent */}
                <SectionCard
                  icon={<ClipboardCheck className="h-4 w-4 text-[#E0FE10]" />}
                  title="Before You Begin"
                  accentColor="#E0FE10"
                  delay={0.45}
                >
                  <p className="text-sm leading-7 text-zinc-400 mb-4">
                    Before we personalize anything, we need your permission to set up PulseCheck for your team.
                    This step is just for getting started with the product.
                  </p>
                  <GlowCheckbox
                    checked={consentAccepted}
                    onChange={setConsentAccepted}
                    label="I agree to get started with PulseCheck for my team."
                  />
                </SectionCard>

                {requiresResearchConsent ? (
                  <SectionCard
                    icon={<CheckCircle2 className="h-4 w-4 text-[#8B5CF6]" />}
                    title="Research Participation"
                    accentColor="#8B5CF6"
                    delay={0.5}
                  >
                    <p className="text-sm leading-7 text-zinc-400 mb-4">
                      {pilot?.name || 'This pilot'} is configured as a research study. You can continue using PulseCheck either way, but we
                      need to record whether you want your activity included in the research dataset.
                    </p>
                    <div className="grid gap-3">
                      <button
                        type="button"
                        onClick={() => setResearchConsentStatus('accepted')}
                        className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${
                          researchConsentStatus === 'accepted'
                            ? 'border-[#8B5CF6]/50 bg-[#8B5CF6]/[0.12] text-white'
                            : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-[#8B5CF6]/30'
                        }`}
                      >
                        I agree to participate in the research portion of this pilot.
                      </button>
                      <button
                        type="button"
                        onClick={() => setResearchConsentStatus('declined')}
                        className={`rounded-2xl border px-4 py-4 text-left text-sm transition ${
                          researchConsentStatus === 'declined'
                            ? 'border-white/20 bg-white/[0.08] text-white'
                            : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/20'
                        }`}
                      >
                        I want product access, but I do not want to participate in the research dataset.
                      </button>
                    </div>
                  </SectionCard>
                ) : null}

                {/* Baseline Path */}
                <SectionCard
                  icon={<Sparkles className="h-4 w-4 text-[#3B82F6]" />}
                  title="Your Starting Point"
                  accentColor="#3B82F6"
                  delay={0.55}
                >
                  <p className="text-sm leading-7 text-zinc-400">
                    After this, you will be ready for{' '}
                    <span
                      className="font-semibold bg-clip-text text-transparent"
                      style={{ backgroundImage: 'linear-gradient(90deg, #E0FE10, #84DFC1)' }}
                    >
                      PulseCheck Core Baseline
                    </span>
                    . It gives us a starting point so Nora and your team can personalize your training from here.
                  </p>
                </SectionCard>
              </div>

              {/* Actions */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="mt-6 flex flex-col gap-3 sm:flex-row"
              >
                {/* Primary CTA */}
                <button
                  type="submit"
                  disabled={saving}
                  className="group relative inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-black transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden"
                  style={{ background: '#E0FE10' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(224,254,16,0.4)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                >
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all duration-300" />
                  {saving
                    ? <Loader2 className="relative h-4 w-4 animate-spin" />
                    : <CheckCircle2 className="relative h-4 w-4" />
                  }
                  <span className="relative">{saving ? 'Completing…' : 'Complete Athlete Onboarding'}</span>
                </button>

                {/* Secondary */}
                <Link
                  href={`/PulseCheck/team-workspace?organizationId=${encodeURIComponent(organizationId)}&teamId=${encodeURIComponent(teamId)}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-300 transition-all duration-300 hover:border-white/20 hover:text-white hover:bg-white/[0.06] backdrop-blur-sm"
                >
                  Back to Team
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </form>
          </GlassCard>

        </section>
      </main>
    </div>
  );
}
