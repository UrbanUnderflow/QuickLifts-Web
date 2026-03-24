import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { pulseCheckProvisioningService } from '../../api/firebase/pulsecheckProvisioning/service';
import type {
  PulseCheckOrganization,
  PulseCheckPilot,
  PulseCheckRequiredConsentDocument,
  PulseCheckResearchConsentStatus,
  PulseCheckTeam,
  PulseCheckTeamMembership,
} from '../../api/firebase/pulsecheckProvisioning/types';
import { userService } from '../../api/firebase/user';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { renderHtmlToPdf } from '../../utils/pdf';

const CONSENT_VERSION = 'pulsecheck-product-consent-v1';
const RESEARCH_CONSENT_VERSION = 'pulsecheck-research-consent-v1';
const BASELINE_PATHWAY_ID = 'pulsecheck-core-baseline-v1';
const MEMBERSHIP_RETRY_ATTEMPTS = 6;
const MEMBERSHIP_RETRY_DELAY_MS = 500;

const normalizeParagraphs = (value: string) =>
  value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const previewAgreementBody = (value: string) => {
  const firstParagraph = normalizeParagraphs(value)[0] || '';
  if (firstParagraph.length <= 140) {
    return firstParagraph;
  }
  return `${firstParagraph.slice(0, 137).trimEnd()}...`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const slugifyFilename = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'pulsecheck-agreement';

const buildAgreementPdfHtml = (input: {
  consent: PulseCheckRequiredConsentDocument;
  teamName?: string;
  organizationName?: string;
}) => {
  const paragraphs = normalizeParagraphs(input.consent.body)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#1f2937;font:400 15px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(paragraph)}</p>`
    )
    .join('');

  const contextLine = [input.teamName, input.organizationName].filter(Boolean).join(' • ');

  return `
    <div style="padding:48px 52px;background:#ffffff;color:#111827;">
      <div style="margin-bottom:28px;">
        <div style="font:700 11px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;margin-bottom:12px;">
          PulseCheck Agreement
        </div>
        <h1 style="margin:0 0 10px;font:800 30px/1.1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
          ${escapeHtml(input.consent.title)}
        </h1>
        ${
          contextLine
            ? `<p style="margin:0;color:#4b5563;font:500 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(contextLine)}</p>`
            : ''
        }
      </div>
      <div style="border-top:1px solid #e5e7eb;padding-top:24px;">
        ${paragraphs}
      </div>
      <div style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:16px;color:#6b7280;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        Saved from PulseCheck so you can keep a copy for your records.
      </div>
    </div>
  `;
};

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
  const [completedConsentIds, setCompletedConsentIds] = useState<string[]>([]);
  const [researchConsentStatus, setResearchConsentStatus] = useState<PulseCheckResearchConsentStatus>('not-required');
  const [activeConsent, setActiveConsent] = useState<PulseCheckRequiredConsentDocument | null>(null);
  const [downloadingConsentId, setDownloadingConsentId] = useState<string | null>(null);
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
        const requiredConsentIds = new Set((nextMembership?.athleteOnboarding?.requiredConsents || []).map((consent) => consent.id));
        setCompletedConsentIds(
          (nextMembership?.athleteOnboarding?.completedConsentIds || []).filter((consentId) => requiredConsentIds.has(consentId))
        );
        setResearchConsentStatus(
          (nextMembership?.athleteOnboarding?.researchConsentStatus as PulseCheckResearchConsentStatus | undefined)
            || (nextPilot?.studyMode === 'research' ? 'pending' : 'not-required')
        );
        setProgressHydrated(true);
      } catch (error) {
        console.error('[PulseCheck athlete onboarding] Failed to load context:', error);
        if (active) setMessage({ type: 'error', text: 'We could not load your team access right now.' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [currentUser?.id, currentUserLoading, organizationId, teamId]);

  const requiresResearchConsent = pilot?.studyMode === 'research';
  const hasPilotEnrollment = Boolean(membership?.athleteOnboarding?.targetPilotId);
  const requiredConsents = membership?.athleteOnboarding?.requiredConsents || [];
  const requiredConsentsComplete = requiredConsents.every((consent) => completedConsentIds.includes(consent.id));

  useEffect(() => {
    if (!progressHydrated || !membership || saving || membership.onboardingStatus === 'complete') return;

    const trimmedName = displayName.trim();
    const researchChoiceMade = !requiresResearchConsent || researchConsentStatus === 'accepted' || researchConsentStatus === 'declined';
    const entryOnboardingStep = !trimmedName
      ? 'name'
      : !consentAccepted || !requiredConsentsComplete
        ? 'consent'
        : !researchChoiceMade
          ? 'research-consent'
          : 'starting-point';

    const timeout = window.setTimeout(() => {
      pulseCheckProvisioningService.saveAthleteOnboardingProgress({
        teamMembershipId: membership.id,
        entryOnboardingStep,
        entryOnboardingName: trimmedName,
        productConsentAccepted: consentAccepted,
        completedConsentIds,
        researchConsentStatus: requiresResearchConsent ? researchConsentStatus : undefined,
      }).catch((error) => {
        console.error('[PulseCheck athlete onboarding] Failed to sync onboarding progress:', error);
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    completedConsentIds,
    consentAccepted,
    displayName,
    membership,
    progressHydrated,
    requiredConsentsComplete,
    requiresResearchConsent,
    researchConsentStatus,
    saving,
  ]);

  const toggleCompletedConsent = (consentId: string) => {
    setCompletedConsentIds((currentIds) =>
      currentIds.includes(consentId)
        ? currentIds.filter((id) => id !== consentId)
        : [...currentIds, consentId]
    );
  };

  const handleDownloadConsentPdf = async (consent: PulseCheckRequiredConsentDocument) => {
    try {
      setDownloadingConsentId(consent.id);
      const pdfBlob = await renderHtmlToPdf(
        buildAgreementPdfHtml({
          consent,
          teamName: team?.displayName,
          organizationName: organization?.displayName,
        })
      );
      const downloadUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${slugifyFilename(consent.title)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('[PulseCheck athlete onboarding] Failed to download agreement PDF:', error);
      setMessage({ type: 'error', text: 'We could not download that agreement right now.' });
    } finally {
      setDownloadingConsentId(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !membership) return;
    if (!displayName.trim()) { setMessage({ type: 'error', text: 'Tell us what name you would like us to use.' }); return; }
    if (!consentAccepted) { setMessage({ type: 'error', text: 'Please agree before continuing.' }); return; }
    if (!requiredConsentsComplete) {
      setMessage({ type: 'error', text: 'Read each agreement and check the boxes before you continue.' });
      return;
    }
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
        completedConsentIds,
        researchConsentStatus: requiresResearchConsent ? researchConsentStatus : 'not-required',
        researchConsentVersion:
          requiresResearchConsent && (researchConsentStatus === 'accepted' || researchConsentStatus === 'declined')
            ? RESEARCH_CONSENT_VERSION
            : '',
      });
      setMessage({ type: 'success', text: 'You are set. Your team access is ready.' });
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
          <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Getting You Ready</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">We are still attaching your team access</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Your invite was accepted, but your team access has not loaded yet. Give it another moment and refresh if this page does not update on its own.
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
                  Your Coach Invited You
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="text-3xl font-bold tracking-tight text-white"
                >
                  Join{' '}
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
                  This takes a few minutes. Confirm your name, read the agreements attached to your team, and keep going.
                  {organization?.displayName ? ` Your access is being set up inside ${organization.displayName}.` : ''}
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
                    . We will keep that group attached to your training after you finish here.
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
                  ? `Your team is part of ${pilot?.name || 'a research program'}. You can still use PulseCheck if you say no to research. We just need your choice before you continue.`
                  : hasPilotEnrollment
                    ? 'Your team access is already attached. Read the agreements below, say yes to anything required, and keep going.'
                    : 'Read through this, make your choices, and you will be ready to start with your team.'}
              </motion.div>

              {/* Step indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-3 pt-2"
              >
                {['Name', 'Agreements', ...(requiresResearchConsent ? ['Research'] : []), 'Ready'].map((step, i, steps) => (
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
                  <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">What Should We Call You?</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all duration-300 focus:border-[#E0FE10]/50 focus:bg-[#E0FE10]/[0.04] placeholder:text-zinc-600 backdrop-blur-sm"
                    style={{ boxShadow: 'none' }}
                    onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(224,254,16,0.12)'; }}
                    onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
                    placeholder="Your name"
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
                    Before we set anything up, we need your okay to get PulseCheck ready for your team.
                  </p>
                  <GlowCheckbox
                    checked={consentAccepted}
                    onChange={setConsentAccepted}
                    label="I agree to get started with PulseCheck for my team."
                  />
                </SectionCard>

                <SectionCard
                  icon={<FileText className="h-4 w-4 text-[#84DFC1]" />}
                  title="Required Agreements"
                  accentColor="#84DFC1"
                  delay={0.48}
                >
                  <p className="text-sm leading-7 text-zinc-400 mb-4">
                    Read these before you continue. We need your yes on each one before you can use this program.
                  </p>

                  <div className="space-y-3">
                    {requiredConsents.length > 0 ? requiredConsents.map((consent) => {
                      const isAccepted = completedConsentIds.includes(consent.id);
                      return (
                        <div
                          key={consent.id}
                          className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 backdrop-blur-sm"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-white">{consent.title}</p>
                              <p className="mt-2 text-sm leading-7 text-zinc-400">
                                {previewAgreementBody(consent.body)}
                              </p>
                            </div>
                            {isAccepted ? (
                              <div className="rounded-full border border-[#E0FE10]/30 bg-[#E0FE10]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E0FE10]">
                                Agreed
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <button
                              type="button"
                              onClick={() => setActiveConsent(consent)}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                            >
                              <FileText className="h-4 w-4" />
                              Read agreement
                            </button>

                            <GlowCheckbox
                              checked={isAccepted}
                              onChange={() => toggleCompletedConsent(consent.id)}
                              label="I have read this and I agree."
                            />
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-7 text-zinc-400">
                        There are no extra agreements for this team right now.
                      </div>
                    )}
                  </div>
                </SectionCard>

                {requiresResearchConsent ? (
                  <SectionCard
                    icon={<CheckCircle2 className="h-4 w-4 text-[#8B5CF6]" />}
                    title="Research Choice"
                    accentColor="#8B5CF6"
                    delay={0.5}
                  >
                    <p className="text-sm leading-7 text-zinc-400 mb-4">
                      {pilot?.name || 'This program'} includes a research option. You can keep using PulseCheck either way. We just need your answer before you continue.
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
                        I want my activity included in the research study.
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
                        I want to use PulseCheck, but I do not want my activity included in the study.
                      </button>
                    </div>
                  </SectionCard>
                ) : null}

                {/* Baseline Path */}
                <SectionCard
                  icon={<Sparkles className="h-4 w-4 text-[#3B82F6]" />}
                  title="What Happens Next"
                  accentColor="#3B82F6"
                  delay={0.55}
                >
                  <p className="text-sm leading-7 text-zinc-400">
                    After this, you will be ready for your first read. It helps Nora understand where you are right now before your team starts building from there.
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
                  <span className="relative">{saving ? 'Saving…' : 'Continue'}</span>
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

      <AnimatePresence>
        {activeConsent ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-md"
            onClick={() => setActiveConsent(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#090d14]/95 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/10 px-6 py-5 sm:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Agreement</p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{activeConsent.title}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                      Take your time here. You can download a PDF if you want a copy for your records.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveConsent(null)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
                    aria-label="Close agreement"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-7">
                <div className="space-y-4">
                  {normalizeParagraphs(activeConsent.body).map((paragraph, index) => (
                    <p key={`${activeConsent.id}-${index}`} className="text-sm leading-8 text-zinc-300">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <button
                  type="button"
                  onClick={() => handleDownloadConsentPdf(activeConsent)}
                  disabled={downloadingConsentId === activeConsent.id}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadingConsentId === activeConsent.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="h-4 w-4" />
                  )}
                  <span>{downloadingConsentId === activeConsent.id ? 'Preparing PDF…' : 'Download PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveConsent(null)}
                  className="inline-flex items-center justify-center rounded-2xl bg-[#E0FE10] px-5 py-3 text-sm font-semibold text-black transition hover:shadow-[0_0_24px_rgba(224,254,16,0.35)]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
