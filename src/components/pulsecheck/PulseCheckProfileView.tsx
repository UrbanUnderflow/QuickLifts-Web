import React, { useEffect, useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { updateEmail } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import { auth, db } from '../../api/firebase/config';
import { getCompletedBaselineEvidence } from '../../api/firebase/pulsecheckProvisioning/athleteTaskState';
import { useUser } from '../../hooks/useUser';
import { athleteProgressService } from '../../api/firebase/mentaltraining/athleteProgressService';
import type { AthleteMentalProgress, BaselineAssessment } from '../../api/firebase/mentaltraining/types';
import { BiggestChallenge, MentalPathway } from '../../api/firebase/mentaltraining/types';
import { TaxonomyModifier, TaxonomyPillar, type TaxonomyProfile } from '../../api/firebase/mentaltraining/taxonomy';
import { signOut } from '../../api/firebase/auth/methods';
import { setUser } from '../../redux/userSlice';
import { motion } from 'framer-motion';

type UserProfileDoc = {
  email?: string;
  preferredName?: string;
  sport?: string;
  position?: string;
  seasonPhase?: string;
  primaryMentalChallenge?: string;
  mentalPerformanceGoals?: string[];
  pulseCheckOnboardingComplete?: boolean;
  dailyReflectionPreferences?: {
    enabled?: boolean;
    time?: string;
    hour?: number;
    minute?: number;
    timezone?: string;
    channel?: 'ios-push';
    taskSurface?: 'web-today';
  };
};

const formatLabel = (value?: string | null) => {
  if (!value) return 'Not set';
  return value
    .split('_')
    .join(' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatTime = (value?: string) => {
  if (!value) return 'Not scheduled';
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2026, 2, 14, hours, minutes));
};

const formatDate = (timestamp?: number) => {
  if (!timestamp) return 'Pending';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
};

const challengeLabel = (challenge?: string, baseline?: BaselineAssessment) => {
  if (challenge) return formatLabel(challenge);
  switch (baseline?.biggestChallenge) {
    case BiggestChallenge.PreCompetitionAnxiety: return 'Pre competition anxiety';
    case BiggestChallenge.FocusDuringCompetition: return 'Focus during competition';
    case BiggestChallenge.ConfidenceInAbilities: return 'Confidence in abilities';
    case BiggestChallenge.BouncingBackFromSetbacks: return 'Bouncing back from setbacks';
    case BiggestChallenge.PerformingUnderPressure: return 'Performing under pressure';
    default: return 'Challenge not set';
  }
};

const pathwayCopy = (pathway?: MentalPathway) => {
  switch (pathway) {
    case MentalPathway.Foundation: return 'Foundation';
    case MentalPathway.ArousalMastery: return 'Arousal Mastery';
    case MentalPathway.FocusMastery: return 'Focus Mastery';
    case MentalPathway.ConfidenceResilience: return 'Confidence & Resilience';
    case MentalPathway.PressurePerformance: return 'Pressure Performance';
    case MentalPathway.EliteRefinement: return 'Elite Refinement';
    default: return 'Foundation';
  }
};

const pillarMeta: Array<{ key: TaxonomyPillar; label: string; color: string; ring: string; glow: string }> = [
  { key: TaxonomyPillar.Composure, label: 'Composure', color: 'text-violet-300', ring: '#a78bfa', glow: 'rgba(167,139,250,0.15)' },
  { key: TaxonomyPillar.Focus,     label: 'Focus',     color: 'text-sky-300',    ring: '#38bdf8', glow: 'rgba(56,189,248,0.15)' },
  { key: TaxonomyPillar.Decision,  label: 'Decision',  color: 'text-emerald-300',ring: '#34d399', glow: 'rgba(52,211,153,0.15)' },
];

const modifierMeta: Array<{ key: TaxonomyModifier; label: string }> = [
  { key: TaxonomyModifier.Readiness,         label: 'Readiness' },
  { key: TaxonomyModifier.Consistency,       label: 'Consistency' },
  { key: TaxonomyModifier.Fatigability,      label: 'Fatigability' },
  { key: TaxonomyModifier.PressureSensitivity, label: 'Pressure Sensitivity' },
];

function buildProfileSummary(profile?: TaxonomyProfile | null) {
  if (!profile) return 'Baseline still needs to be captured before the profile can lock in a durable shape.';
  const strongest = profile.strongestSkills[0] ? formatLabel(profile.strongestSkills[0]) : 'signal control';
  const weakest = profile.weakestSkills[0] ? formatLabel(profile.weakestSkills[0]) : 'foundation control';
  return `Your current profile is strongest in ${strongest} and still tightening around ${weakest}.`;
}

function buildImprovementSummary(progress?: AthleteMentalProgress | null) {
  if (!progress) return 'The profile will start showing change once onboarding and baseline are complete.';
  if (progress.taxonomyProfile?.trendSummary?.length) return progress.taxonomyProfile.trendSummary[0];
  if (progress.totalAssignmentsCompleted > 0) return `You have stacked ${progress.totalAssignmentsCompleted} completed reps so far, with a ${progress.currentStreak}-day streak in motion.`;
  return 'You are still in the profile setup window, so the first durable improvement signal is still loading.';
}

function buildPressureSummary(progress?: AthleteMentalProgress | null, challenge?: string) {
  if (progress?.taxonomyProfile?.weakestSkills?.[0]) return `Under pressure, ${formatLabel(progress.taxonomyProfile.weakestSkills[0])} is the first place the profile gets noisy.`;
  if (challenge) return `The biggest current breakdown flag is ${challengeLabel(challenge)}.`;
  return 'Pressure signatures are still being established from the first valid baseline and follow-up reps.';
}

function buildNoraSummary(progress?: AthleteMentalProgress | null) {
  if (progress?.activeProgram?.rationale) return progress.activeProgram.rationale;
  if (progress?.taxonomyProfile?.weakestSkills?.[0]) return `Nora is focusing on ${formatLabel(progress.taxonomyProfile.weakestSkills[0])} because it is the clearest bottleneck in the current profile.`;
  return 'Nora is still in baseline mode, focused on building the first trustworthy profile anchor.';
}

function buildPathwaySummary(progress?: AthleteMentalProgress | null) {
  if (!progress) return 'Next up is onboarding and baseline so PulseCheck can assign the first true pathway.';
  if (!getCompletedBaselineEvidence(progress).complete) return 'You are still in the baseline setup window. Complete baseline to unlock the first profile milestone.';
  const nextStep = progress.foundationComplete ? 'your next program checkpoint' : 'foundation completion';
  return `You are in ${pathwayCopy(progress.currentPathway)}, step ${progress.pathwayStep + 1}. The next milestone is ${nextStep}.`;
}

// Animated circular progress ring
const PillarRing: React.FC<{
  score?: number;
  label: string;
  color: string;
  ring: string;
  glow: string;
}> = ({ score, label, color, ring, glow }) => {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const pct = typeof score === 'number' ? Math.min(Math.max(score, 0), 100) : 0;
  const strokeDash = (pct / 100) * circ;
  const hasScore = typeof score === 'number';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-24 h-24">
        {/* Glow backdrop */}
        <div
          className="absolute inset-0 rounded-full blur-xl"
          style={{ background: hasScore ? glow : 'transparent' }}
        />
        <svg width="96" height="96" viewBox="0 0 96 96" className="relative rotate-[-90deg]">
          {/* Track */}
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          {/* Progress */}
          {hasScore && (
            <motion.circle
              cx="48" cy="48" r={r}
              fill="none"
              stroke={ring}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ - strokeDash }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-bold ${color}`}>
            {hasScore ? Math.round(pct) : '—'}
          </span>
        </div>
      </div>
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{label}</span>
    </div>
  );
};

// Card accent colors cycle for Q&A cards
const CARD_BORDERS = [
  'border-l-violet-500/60',
  'border-l-[#E0FE10]/40',
  'border-l-sky-500/60',
  'border-l-violet-500/60',
  'border-l-[#E0FE10]/40',
  'border-l-sky-500/60',
];
const CARD_NUM_COLORS = [
  'from-violet-500/20 to-violet-500/5',
  'from-[#E0FE10]/15 to-[#E0FE10]/5',
  'from-sky-500/20 to-sky-500/5',
  'from-violet-500/20 to-violet-500/5',
  'from-[#E0FE10]/15 to-[#E0FE10]/5',
  'from-sky-500/20 to-sky-500/5',
];

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

type SettingsRowProps = {
  title: string;
  subtitle?: string;
  onClick?: () => void;
  destructive?: boolean;
  trailing?: React.ReactNode;
};

const SettingsRow: React.FC<SettingsRowProps> = ({
  title,
  subtitle,
  onClick,
  destructive = false,
  trailing,
}) => {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`w-full rounded-[22px] border px-4 py-4 text-left transition-colors ${
        destructive
          ? 'border-red-500/25 bg-red-500/[0.04] hover:bg-red-500/[0.08]'
          : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-base font-semibold ${destructive ? 'text-red-300' : 'text-white'}`}>{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
        </div>
        {trailing ? (
          trailing
        ) : onClick ? (
          <span className={`text-sm ${destructive ? 'text-red-300' : 'text-zinc-500'}`}>Open</span>
        ) : null}
      </div>
    </Wrapper>
  );
};

const PulseCheckProfileView: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const currentUser = useUser();
  const [userDoc, setUserDoc] = useState<UserProfileDoc | null>(null);
  const [progress, setProgress] = useState<AthleteMentalProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [reflectionEnabled, setReflectionEnabled] = useState(false);
  const [reflectionTime, setReflectionTime] = useState('08:00');
  const [reflectionSaving, setReflectionSaving] = useState(false);
  const [reflectionFeedback, setReflectionFeedback] = useState<string | null>(null);
  const [dbCodeName, setDbCodeName] = useState('ECHO-7');

  useEffect(() => {
    if (!currentUser?.id) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [userSnap, progressDoc] = await Promise.all([
          getDoc(doc(db, 'users', currentUser.id)),
          athleteProgressService.get(currentUser.id),
        ]);
        if (cancelled) return;
        setUserDoc((userSnap.data() as UserProfileDoc | undefined) ?? null);
        setProgress(progressDoc);
      } catch (e) {
        console.error('[PulseCheck profile] Failed to load profile context:', e);
        if (!cancelled) setError('Profile data is still loading. Try refreshing in a moment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  useEffect(() => {
    setEmailDraft(userDoc?.email || currentUser?.email || '');
  }, [currentUser?.email, userDoc?.email]);

  useEffect(() => {
    setReflectionEnabled(Boolean(userDoc?.dailyReflectionPreferences?.enabled));
    setReflectionTime(userDoc?.dailyReflectionPreferences?.time || '08:00');
  }, [userDoc?.dailyReflectionPreferences?.enabled, userDoc?.dailyReflectionPreferences?.time]);

  useEffect(() => {
    if (router.query.settings === '1') {
      setShowSettings(true);
    }
  }, [router.query.settings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isDevFirebase =
      process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true' ||
      window.localStorage.getItem('forceDevFirebase') === 'true' ||
      window.localStorage.getItem('devMode') === 'true';
    setDbCodeName(isDevFirebase ? 'NOVA-9' : 'ECHO-7');
  }, []);

  const displayName = userDoc?.preferredName || currentUser?.displayName || currentUser?.username || 'Athlete';
  const primaryChallenge = challengeLabel(
    userDoc?.primaryMentalChallenge || userDoc?.mentalPerformanceGoals?.[0],
    progress?.baselineAssessment
  );

  const closeSettings = () => {
    setShowSettings(false);
    if (router.query.settings === '1') {
      const nextQuery = { ...router.query };
      delete nextQuery.settings;
      void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }
  };

  const openSettings = () => {
    setShowSettings(true);
    if (router.query.settings !== '1') {
      void router.replace(
        { pathname: router.pathname, query: { ...router.query, section: 'profile', settings: '1' } },
        undefined,
        { shallow: true }
      );
    }
  };

  const handleEmailSave = async () => {
    if (!currentUser?.id || !auth.currentUser) {
      setEmailFeedback('Sign in again before updating your email.');
      return;
    }

    const nextEmail = emailDraft.trim().toLowerCase();
    if (!nextEmail) {
      setEmailFeedback('Enter an email address first.');
      return;
    }

    const currentEmail = (auth.currentUser.email || currentUser.email || '').trim().toLowerCase();
    if (nextEmail === currentEmail) {
      setEmailFeedback('Your email is already up to date.');
      return;
    }

    setEmailSaving(true);
    setEmailFeedback(null);

    try {
      await updateEmail(auth.currentUser, nextEmail);
      await setDoc(
        doc(db, 'users', currentUser.id),
        {
          email: nextEmail,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setUserDoc((current) => ({
        ...(current ?? {}),
        email: nextEmail,
      }));

      dispatch(setUser({
        ...currentUser.toDictionary(),
        email: nextEmail,
      }));

      setEmailFeedback('Email updated successfully.');
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      if (code === 'auth/requires-recent-login') {
        setEmailFeedback('Please sign out and sign back in before changing your email.');
      } else if (code === 'auth/email-already-in-use') {
        setEmailFeedback('That email is already attached to another account.');
      } else if (code === 'auth/invalid-email') {
        setEmailFeedback('Enter a valid email address.');
      } else {
        console.error('[PulseCheck profile] Failed to update email:', err);
        setEmailFeedback('We could not update your email right now.');
      }
    } finally {
      setEmailSaving(false);
    }
  };

  const handleDailyReflectionSave = async () => {
    if (!currentUser?.id) {
      setReflectionFeedback('Sign in again before updating reminders.');
      return;
    }

    const [hourPart, minutePart] = reflectionTime.split(':').map((part) => Number(part));
    const nextHour = Number.isFinite(hourPart) ? hourPart : 20;
    const nextMinute = Number.isFinite(minutePart) ? minutePart : 0;
    const nextPreferences = {
      enabled: reflectionEnabled,
      time: reflectionEnabled ? reflectionTime : '08:00',
      hour: reflectionEnabled ? nextHour : 8,
      minute: reflectionEnabled ? nextMinute : 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      channel: 'ios-push' as const,
      taskSurface: 'web-today' as const,
    };

    setReflectionSaving(true);
    setReflectionFeedback(null);

    try {
      await setDoc(
        doc(db, 'users', currentUser.id),
        {
          dailyReflectionPreferences: nextPreferences,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setUserDoc((current) => ({
        ...(current ?? {}),
        dailyReflectionPreferences: nextPreferences,
      }));

      setReflectionFeedback('Daily check-in reminder settings saved.');
    } catch (err) {
      console.error('[PulseCheck profile] Failed to update daily reflection settings:', err);
      setReflectionFeedback('We could not save your daily check-in reminder settings.');
    } finally {
      setReflectionSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      dispatch(setUser(null));
      closeSettings();
      void router.push('/PulseCheck/login');
    } catch (err) {
      console.error('[PulseCheck profile] Failed to sign out:', err);
    }
  };

  const sixQuestions = useMemo(() => [
    { question: 'Who am I in PulseCheck right now?', answer: `${displayName} is building a ${userDoc?.sport || 'sport-ready'} mental profile${userDoc?.seasonPhase ? ` for ${formatLabel(userDoc.seasonPhase)}` : ''}. The main challenge in focus is ${primaryChallenge}.` },
    { question: 'What does my mental performance profile currently look like?', answer: buildProfileSummary(progress?.taxonomyProfile) },
    { question: 'What is getting better?', answer: buildImprovementSummary(progress) },
    { question: 'What breaks down under pressure?', answer: buildPressureSummary(progress, userDoc?.primaryMentalChallenge || userDoc?.mentalPerformanceGoals?.[0]) },
    { question: 'What is Nora focusing on right now?', answer: buildNoraSummary(progress) },
    { question: 'Where am I in the pathway and what happens next?', answer: buildPathwaySummary(progress) },
  ], [displayName, primaryChallenge, progress, userDoc]);

  if (!currentUser) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="max-w-xl rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center text-zinc-300">
          Sign in to load your PulseCheck profile.
        </div>
      </div>
    );
  }

  const mprScore = progress?.mprScore ?? null;
  const streak = progress?.currentStreak ?? null;
  const assignments = progress?.totalAssignmentsCompleted ?? null;
  const pathway = pathwayCopy(progress?.currentPathway);
  const baselineEvidence = getCompletedBaselineEvidence(progress);

  return (
    <motion.div
      className="h-full overflow-y-auto bg-[#09090c] text-white"
      initial="hidden"
      animate="show"
      variants={stagger}
    >
      {/* ── Ambient orbs ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute top-1/2 -right-32 h-[320px] w-[320px] rounded-full bg-[#E0FE10]/6 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-20 pt-6 sm:px-6 lg:px-8">

        {/* ──────────────────────── HERO ──────────────────────── */}
        <motion.section
          variants={fadeUp}
          className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[linear-gradient(135deg,_rgba(167,139,250,0.12),_rgba(255,255,255,0.03)_40%,_rgba(224,254,16,0.06))] p-6 sm:p-8 backdrop-blur-xl"
        >
          {/* Subtle grid */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:36px_36px]" />
          {/* Top shimmer line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start justify-between gap-4 lg:flex-1">
              {/* Identity */}
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  {/* Glow ring */}
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-violet-500/50 to-[#E0FE10]/30 blur-sm" />
                  <div className="relative h-[88px] w-[88px] overflow-hidden rounded-full border border-violet-400/30 bg-zinc-900">
                    {currentUser.profileImage?.profileImageURL ? (
                      <img src={currentUser.profileImage.profileImageURL} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.3em] text-violet-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    PulseCheck Athlete
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{displayName}</h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    {userDoc?.sport ? formatLabel(userDoc.sport) : 'Sport not set'}
                    {userDoc?.position ? ` · ${formatLabel(userDoc.position)}` : ''}
                    {userDoc?.seasonPhase ? ` · ${formatLabel(userDoc.seasonPhase)}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openSettings}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black/55"
              >
                <Cog6ToothIcon className="h-5 w-5 text-[#E0FE10]" />
                Settings
              </button>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:shrink-0">
              {[
                { label: 'Pathway', value: pathway, accent: 'text-violet-300' },
                { label: 'MPR', value: mprScore !== null ? `${mprScore.toFixed(1)}/10` : '—', accent: 'text-[#E0FE10]' },
                { label: 'Assignments', value: assignments !== null ? String(assignments) : '—', accent: 'text-sky-300' },
                { label: 'Streak', value: streak !== null ? `${streak}d` : '—', accent: 'text-emerald-300' },
              ].map(({ label, value, accent }) => (
                <div key={label} className="rounded-[20px] border border-white/[0.07] bg-black/30 px-4 py-3 text-center backdrop-blur">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-zinc-500">{label}</p>
                  <p className={`mt-1.5 text-xl font-bold ${accent}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ──────────────────────── SIX QUESTIONS ──────────────────────── */}
        <motion.section variants={fadeUp}>
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">First Scroll</p>
              <h2 className="mt-1.5 text-2xl font-bold text-white">Six core profile questions</h2>
            </div>
            <p className="max-w-sm text-sm text-zinc-500 sm:text-right">
              Identity · profile shape · breakdown pattern · Nora emphasis · pathway
            </p>
          </div>

          <motion.div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" variants={stagger}>
            {sixQuestions.map((item, i) => (
              <motion.article
                key={item.question}
                variants={fadeUp}
                className={`group relative overflow-hidden rounded-[24px] border border-white/[0.07] border-l-4 ${CARD_BORDERS[i]} bg-[#0e0e13] p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-[#111118]`}
              >
                {/* Big watermark number */}
                <div className={`pointer-events-none absolute right-4 top-2 select-none bg-gradient-to-b ${CARD_NUM_COLORS[i]} bg-clip-text text-[72px] font-black leading-none text-transparent`}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600">Question {i + 1}</p>
                <h3 className="mt-3 text-[15px] font-semibold leading-snug text-white">{item.question}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.answer}</p>
              </motion.article>
            ))}
          </motion.div>
        </motion.section>

        {/* ──────────────────────── PILLARS + SIDEBAR ──────────────────────── */}
        <motion.div variants={fadeUp} className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">

          {/* Pillars + modifiers */}
          <section className="rounded-[28px] border border-white/[0.07] bg-[#0e0e13] p-5 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Mental Performance Profile</p>
                <h2 className="mt-1.5 text-xl font-bold text-white">Pillars & modifiers</h2>
              </div>
              {progress?.profileVersion && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                  {progress.profileVersion}
                </span>
              )}
            </div>

            {/* Pillar rings */}
            <div className="flex items-center justify-center gap-10 py-4">
              {pillarMeta.map((p) => (
                <PillarRing
                  key={p.key}
                  score={progress?.taxonomyProfile?.pillarScores?.[p.key]}
                  label={p.label}
                  color={p.color}
                  ring={p.ring}
                  glow={p.glow}
                />
              ))}
            </div>

            {/* Modifier rows */}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {modifierMeta.map((m) => {
                const val = progress?.taxonomyProfile?.modifierScores?.[m.key];
                const pct = typeof val === 'number' ? Math.min(Math.max(val, 0), 100) : 0;
                const hasVal = typeof val === 'number';
                return (
                  <div key={m.key} className="rounded-[18px] border border-white/[0.06] bg-black/20 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-zinc-300">{m.label}</span>
                      <span className="text-sm font-bold text-white">{hasVal ? Math.round(pct) : '—'}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-[#E0FE10]"
                        initial={{ width: 0 }}
                        animate={{ width: hasVal ? `${pct}%` : '0%' }}
                        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.5 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right panel: context + milestones */}
          <div className="flex flex-col gap-5">

            {/* Profile context */}
            <section className="rounded-[28px] border border-white/[0.07] bg-[#0e0e13] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Profile Context</p>
              <div className="mt-4 space-y-0 divide-y divide-white/[0.05]">
                {[
                  { label: 'Primary challenge', value: primaryChallenge },
                  { label: 'Daily check-in', value: userDoc?.dailyReflectionPreferences?.enabled ? `iOS push · ${formatTime(userDoc.dailyReflectionPreferences?.time)}` : 'Off' },
                  { label: 'Onboarding', value: userDoc?.pulseCheckOnboardingComplete ? 'Complete' : 'In setup' },
                  { label: 'Subscription', value: formatLabel(currentUser.subscriptionType) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm text-zinc-500">{label}</span>
                    <span className="text-right text-sm font-medium text-white">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Milestones */}
            <section className="rounded-[28px] border border-white/[0.07] bg-[#0e0e13] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Milestones</p>
              <div className="mt-4 space-y-3">
                {[
                  {
                    label: 'Baseline',
                    status: baselineEvidence.complete ? 'Captured' : 'Pending',
                    done: baselineEvidence.complete,
                    sub: baselineEvidence.completedAt
                      ? `Captured ${formatDate(baselineEvidence.completedAt)}`
                      : baselineEvidence.complete
                      ? 'Captured through the shared baseline task model.'
                      : 'Anchors the durable profile.',
                  },
                  {
                    label: 'Foundation',
                    status: progress?.foundationComplete ? 'Complete' : 'In progress',
                    done: !!progress?.foundationComplete,
                    sub: progress?.foundationComplete
                      ? 'Pathway advancement unlocked.'
                      : 'Completion unlocks the next milestone.',
                  },
                ].map(({ label, status, done, sub }) => (
                  <div key={label} className="rounded-[20px] border border-white/[0.06] bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-zinc-200">{label}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${done ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' : 'bg-zinc-800 text-zinc-400 border border-white/10'}`}>
                        {status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-500">{sub}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </motion.div>

        {/* ── Loading / error ── */}
        {(loading || error) && (
          <motion.section
            variants={fadeUp}
            className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-sm text-zinc-400"
          >
            {loading ? 'Refreshing profile context…' : error}
          </motion.section>
        )}
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close settings"
            className="absolute inset-0"
            onClick={closeSettings}
          />

          <motion.aside
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-[#0b0b11] px-5 pb-8 pt-5 shadow-2xl sm:px-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">PulseCheck</p>
                <h2 className="mt-1 text-2xl font-bold text-white">Settings</h2>
              </div>
              <button
                type="button"
                onClick={closeSettings}
                className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-zinc-300 transition-colors hover:bg-white/[0.08]"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-8 space-y-8">
              <section>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Preferences</p>
                <div className="mt-3 space-y-3">
                  <div className="rounded-[26px] border border-white/[0.07] bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-white">Daily Check-In Reminder</p>
                        <p className="mt-1 text-sm text-zinc-400">Sent from the native iOS Pulse Check app, but meant to drive you back to the web Today task.</p>
                      </div>
                      <label className="inline-flex items-center gap-3 text-sm text-zinc-300">
                        <span>Enabled</span>
                        <input
                          type="checkbox"
                          checked={reflectionEnabled}
                          onChange={(event) => setReflectionEnabled(event.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-transparent accent-[#E0FE10]"
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        type="time"
                        value={reflectionTime}
                        disabled={!reflectionEnabled}
                        onChange={(event) => setReflectionTime(event.target.value)}
                        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#E0FE10]/50 disabled:cursor-not-allowed disabled:text-zinc-600"
                      />
                      <button
                        type="button"
                        onClick={handleDailyReflectionSave}
                        disabled={reflectionSaving}
                        className="rounded-xl bg-[#E0FE10] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reflectionSaving ? 'Saving...' : 'Save check-in reminder'}
                      </button>
                    </div>

                    {reflectionFeedback ? (
                      <p className="mt-3 text-sm text-zinc-400">{reflectionFeedback}</p>
                    ) : null}
                  </div>

                  <SettingsRow
                    title="Subscription Plan"
                    subtitle={`Current: ${formatLabel(currentUser.subscriptionType)}`}
                    onClick={() => void router.push('/subscribe')}
                  />
                </div>
              </section>

              <section>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Account</p>
                <div className="mt-3 space-y-3">
                  <div className="rounded-[26px] border border-white/[0.07] bg-white/[0.03] p-4">
                    <p className="text-lg font-semibold text-white">Email</p>
                    <p className="mt-1 text-sm text-zinc-400">Update the shared account email used by PulseCheck web and iOS.</p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input
                        type="email"
                        value={emailDraft}
                        onChange={(event) => setEmailDraft(event.target.value)}
                        placeholder="you@example.com"
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[#E0FE10]/50"
                      />
                      <button
                        type="button"
                        onClick={handleEmailSave}
                        disabled={emailSaving}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {emailSaving ? 'Saving...' : 'Save email'}
                      </button>
                    </div>
                    {emailFeedback ? (
                      <p className="mt-3 text-sm text-zinc-400">{emailFeedback}</p>
                    ) : null}
                  </div>

                  <SettingsRow
                    title="Sign Out"
                    subtitle="End the current PulseCheck session."
                    onClick={() => void handleSignOut()}
                  />

                  <SettingsRow
                    title="Delete Account"
                    subtitle="Permanent action."
                    onClick={() => void router.push('/delete-account')}
                    destructive
                  />
                </div>
              </section>

              <section>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">Support</p>
                <div className="mt-3 space-y-3">
                  <SettingsRow
                    title="Privacy Policy"
                    onClick={() => void router.push('/privacyPolicy')}
                  />
                  <SettingsRow
                    title="Terms and Conditions"
                    onClick={() => void router.push('/terms')}
                  />
                  <SettingsRow
                    title="Help & Support"
                    subtitle="Contact our team."
                    onClick={() => {
                      window.location.href = 'mailto:info@fitwithpulse.ai?subject=PulseCheck%20Support';
                    }}
                  />
                </div>
              </section>
            </div>

            <div className="mt-10 border-t border-white/[0.06] pt-5 text-center">
              <p className="text-sm text-zinc-400">PulseCheck web settings</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#E0FE10]">DB: {dbCodeName}</p>
            </div>
          </motion.aside>
        </div>
      )}
    </motion.div>
  );
};

export default PulseCheckProfileView;
