import React, { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Inbox,
  LogIn,
  MailPlus,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

// Self-contained Screen Demo: the full sequence a staff member walks after a
// coach invites them into PulseCheck — the activation email → accept & sign in →
// member setup → the team dashboard. Nothing here touches auth or Firebase; every
// screen mirrors the real one (the email matches send-pulsecheck-team-invite-email,
// the accept/setup steps mirror /PulseCheck/team-invite/[token] + member-setup).
// Styled to the on-brand PulseCheck activation onboarding (see post-activation.tsx):
// purple chrome, Switzer/Fraunces, shared Toggle. Registered from /admin/screenDemo.

// Canonical PulseCheck brand tokens (see public/pulsecheck-design-system.html).
const PC = {
  pageBg: '#070711',
  deepBg: '#0B0B1C',
  purple: '#7C3AED',
  purpleSoft: '#a78bfa',
  cardBorder: 'rgba(255,255,255,0.10)',
};

const displayFont: React.CSSProperties = { fontFamily: 'Switzer, sans-serif' };

// The mock invite the whole walkthrough runs on. The sender (Coach Mayo) and the
// org/team match the coach dashboard demo so the two demos feel like one world.
const DEMO = {
  senderName: 'Coach Mayo',
  recipientName: 'Alex Rivera',
  recipientFirst: 'Alex',
  targetEmail: 'alex@demo.pulsecheck',
  organizationName: 'Demo Athletics',
  teamName: 'Varsity Football',
  roleLabel: 'Coaching',
  invitedTitle: 'Assistant Coach',
  fromAddress: 'PulseCheck <tre@fitwithpulse.ai>',
};

type Step = 'email' | 'accept' | 'setup' | 'done';
type AuthMode = 'create-account' | 'sign-in';

const STEPS: { key: Step; label: string }[] = [
  { key: 'email', label: 'Activation email' },
  { key: 'accept', label: 'Accept & sign in' },
  { key: 'setup', label: 'Member setup' },
  { key: 'done', label: 'Dashboard' },
];

const NOTIFICATION_OPTIONS: { key: string; label: string; description: string }[] = [
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

const StaffOnboardingDemoPage: React.FC = () => {
  const [step, setStep] = useState<Step>('email');
  const [mode, setMode] = useState<AuthMode>('create-account');
  const [setupForm, setSetupForm] = useState({
    displayName: DEMO.recipientName,
    title: DEMO.invitedTitle,
  });
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    email: true,
    sms: false,
    push: true,
    weeklyDigest: true,
  });
  // Mirrors the admin-activation flow: when a Google/Apple sign-in returns an email
  // that differs from the invited (institutional) one, PulseCheck asks where updates
  // should go — institutional pre-selected — before continuing. Simulated here with a
  // fixed divergent social email so the routing choice always surfaces in the demo.
  const [socialChoice, setSocialChoice] = useState<{ socialEmail: string; selected: string } | null>(null);

  const activeStepIndex = useMemo(() => STEPS.findIndex((entry) => entry.key === step), [step]);

  const startDemoSocial = (provider: 'google' | 'apple') => {
    const socialEmail = provider === 'google' ? 'alex.rivera@gmail.com' : 'alex.rivera@icloud.com';
    setSocialChoice({ socialEmail, selected: DEMO.targetEmail });
  };
  const confirmSocialChoice = () => {
    setSocialChoice(null);
    setStep('setup');
  };

  const toggleNotification = (key: string) =>
    setNotifications((current) => ({ ...current, [key]: !current[key] }));

  const subject = `You're invited to join ${DEMO.teamName} on PulseCheck`;

  const inputClass =
    'w-full rounded-2xl border border-zinc-700 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-70';
  const primaryBtn =
    'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90';
  const infoCardStyle: React.CSSProperties = {
    background: 'radial-gradient(circle at top left, rgba(124,58,237,0.14), transparent 42%), #0B0B1C',
    borderColor: PC.cardBorder,
  };

  return (
    <AdminRouteGuard>
      <div className="relative min-h-screen text-white" style={{ background: PC.pageBg, fontFamily: 'Switzer, sans-serif' }}>
        <Head>
          <title>Staff onboarding demo | PulseCheck</title>
          <meta name="robots" content="noindex,nofollow" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&display=swap"
            rel="stylesheet"
          />
          <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800,900&display=swap" />
        </Head>

        {/* Demo chrome — purple banner mirrors the coach-onboarding demo. */}
        <div
          className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
          style={{ background: PC.purple }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Screen Demo — the email and sign-in are simulated. Press continue to walk the flow.
        </div>

        {/* Ambient brand glow */}
        <div className="pointer-events-none absolute -left-32 top-10 h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />

        <main className="relative mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
          {/* Brand header */}
          <div className="mb-7 flex items-center gap-3">
            <img src="/pulsecheck-logo.svg" alt="PulseCheck" width={36} height={36} className="rounded-[10px]" />
            <span className="text-base font-bold tracking-tight" style={displayFont}>PulseCheck</span>
          </div>

          {/* Stepper */}
          <ol className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            {STEPS.map((entry, index) => {
              const done = index < activeStepIndex;
              const active = index === activeStepIndex;
              return (
                <li key={entry.key} className="flex items-center gap-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{
                        background: active || done ? PC.purple : 'rgba(255,255,255,0.06)',
                        color: active || done ? '#fff' : 'rgba(255,255,255,0.45)',
                      }}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className="font-semibold" style={{ color: active ? '#fff' : done ? PC.purpleSoft : '#71717a' }}>{entry.label}</span>
                  </span>
                  {index < STEPS.length - 1 ? <ChevronRight className="h-4 w-4 text-zinc-700" /> : null}
                </li>
              );
            })}
          </ol>

          {/* STEP 1 — the activation email, as it lands in the staff member's inbox */}
          {step === 'email' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                <Inbox className="h-4 w-4" style={{ color: PC.purpleSoft }} />
                Inbox · {DEMO.targetEmail}
              </div>

              {/* Faux email-client frame around the real transactional email */}
              <div className="overflow-hidden rounded-[24px] border" style={{ borderColor: PC.cardBorder, background: PC.deepBg }}>
                <div className="space-y-1 border-b px-6 py-4" style={{ borderColor: PC.cardBorder }}>
                  <p className="text-base font-semibold text-white" style={displayFont}>{subject}</p>
                  <p className="text-xs text-zinc-500">
                    From <span className="text-zinc-300">{DEMO.fromAddress}</span> · to{' '}
                    <span className="text-zinc-300">{DEMO.targetEmail}</span>
                  </p>
                </div>

                {/* The email body — mirrors send-pulsecheck-team-invite-email.ts */}
                <div className="px-4 py-6 sm:px-8" style={{ background: '#ffffff' }}>
                  <div className="mx-auto w-full max-w-[560px] text-center">
                    <div className="mx-auto mb-6 flex items-center justify-center gap-2.5">
                      <img
                        src="/pulsecheck-logo.svg"
                        alt="PulseCheck"
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-[10px]"
                      />
                      <span
                        className="text-2xl font-extrabold tracking-tight"
                        style={{ color: '#0B0B1C', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" }}
                      >
                        PulseCheck
                      </span>
                    </div>
                    <div className="rounded-[20px] border px-5 py-8 sm:px-8" style={{ borderColor: '#e4e4e7', background: '#ffffff' }}>
                      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-[28px]" style={{ background: '#f4f4f5' }}>
                        🤝
                      </div>
                      <h1 className="m-0 text-2xl font-black leading-tight" style={{ color: '#000', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" }}>
                        You&apos;re invited to PulseCheck
                      </h1>
                      <p className="mt-2 text-base leading-relaxed" style={{ color: '#000' }}>
                        Hey {DEMO.recipientFirst}, {DEMO.senderName} invited you to join the team.
                      </p>
                      <p className="mt-3 text-sm leading-relaxed" style={{ color: '#000' }}>
                        Team: <span className="font-bold">{DEMO.teamName}</span>
                        <br />
                        Organization: <span className="font-bold">{DEMO.organizationName}</span>
                        <br />
                        Title: <span className="font-bold">{DEMO.invitedTitle}</span>
                      </p>
                      <p className="mt-4 text-[13px] leading-relaxed" style={{ color: '#52525B' }}>
                        Accept the invite and sign in with this email to get set up.
                      </p>
                      <button
                        type="button"
                        onClick={() => setStep('accept')}
                        className="mt-7 inline-block rounded-[12px] px-8 py-3.5 text-sm font-black text-white"
                        style={{ background: '#000', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" }}
                      >
                        ACCEPT INVITE
                      </button>
                      <p className="mt-6 text-xs leading-relaxed" style={{ color: '#52525B' }}>
                        If the button doesn&apos;t work, copy and paste this link into your browser:
                        <br />
                        <span className="break-all" style={{ color: '#000' }}>
                          https://fitwithpulse.ai/PulseCheck/team-invite/team-demo
                        </span>
                      </p>
                    </div>
                    <p className="mt-6 text-[11px] leading-relaxed" style={{ color: '#52525B' }}>
                      © {new Date().getFullYear()} Pulse Intelligence Labs, Inc.
                      <br />
                      You received this email because you were invited to a team on PulseCheck.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-center text-xs text-zinc-600">
                This is the exact email a coach sends from the “Invite a staff member” dialog. Tap{' '}
                <span className="text-zinc-400">Accept invite</span> to continue.
              </p>
            </div>
          ) : null}

          {/* STEP 2 — accept & sign in (mirrors /PulseCheck/team-invite/[token]) */}
          {step === 'accept' ? (
            <div>
            <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="rounded-[32px] border p-8 shadow-2xl" style={infoCardStyle}>
                <div className="space-y-5">
                  <div className="inline-flex rounded-2xl border p-3" style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.12)' }}>
                    <ShieldCheck className="h-6 w-6" style={{ color: PC.purpleSoft }} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: PC.purpleSoft }}>PulseCheck Team Invite</p>
                    <h1 className="text-3xl font-bold text-white" style={displayFont}>Join {DEMO.teamName}</h1>
                    <p className="max-w-2xl text-sm leading-7 text-zinc-300">
                      You&apos;ve been invited to join <span className="font-medium text-white">{DEMO.teamName}</span> inside{' '}
                      <span className="font-medium text-white">{DEMO.organizationName}</span>.
                    </p>
                  </div>

                  {/* Role/permissions are deliberately not shown to the invitee —
                      that detail is reserved for the admin who sent the invite. */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
                      <div className="flex items-center gap-2">
                        <MailPlus className="h-4 w-4" style={{ color: PC.purpleSoft }} />
                        <p className="text-sm font-semibold text-white">Target Email</p>
                      </div>
                      <p className="mt-3 text-sm text-zinc-300">{DEMO.targetEmail}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm leading-7 text-zinc-200">
                    Invited title: <span className="font-medium text-white">{DEMO.invitedTitle}</span>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-400">
                    <p className="font-medium text-white">What happens on redemption</p>
                    <p className="mt-2 leading-7">
                      Your team membership is created and this invite is marked redeemed. Staff land in member setup, then the
                      shared team workspace.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border p-8 shadow-2xl" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
                <div className="space-y-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: PC.purpleSoft }}>Account Required</p>
                    <h2 className="mt-2 text-3xl font-bold text-white" style={displayFont}>Create or access your Pulse account</h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-300">
                      Use the invited email, then accept the invite from this page. New staff create a sign-in; returning
                      Pulse users sign in.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setMode('create-account')}
                      className="rounded-2xl border px-4 py-3 text-left transition"
                      style={{
                        borderColor: mode === 'create-account' ? PC.purple : 'rgba(255,255,255,0.08)',
                        background: mode === 'create-account' ? 'rgba(124,58,237,0.12)' : 'rgba(0,0,0,0.2)',
                      }}
                    >
                      <div className="flex items-center gap-2 text-white">
                        <UserPlus className="h-4 w-4" />
                        <span className="text-sm font-semibold">Create Account</span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">Use this if you do not have a Pulse account yet.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('sign-in')}
                      className="rounded-2xl border px-4 py-3 text-left transition"
                      style={{
                        borderColor: mode === 'sign-in' ? PC.purple : 'rgba(255,255,255,0.08)',
                        background: mode === 'sign-in' ? 'rgba(124,58,237,0.12)' : 'rgba(0,0,0,0.2)',
                      }}
                    >
                      <div className="flex items-center gap-2 text-white">
                        <LogIn className="h-4 w-4" />
                        <span className="text-sm font-semibold">Sign In</span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">Use this if you already have an account.</p>
                    </button>
                  </div>

                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setStep('setup');
                    }}
                  >
                    <label className="block space-y-2">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Email</span>
                      <input type="email" value={DEMO.targetEmail} disabled className={inputClass} />
                    </label>

                    {mode === 'create-account' ? (
                      <>
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Username</span>
                          <input type="text" placeholder="alex_rivera" className={inputClass} />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Password</span>
                          <input type="password" placeholder="At least 6 characters" className={inputClass} />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-wide text-zinc-500">Confirm Password</span>
                          <input type="password" className={inputClass} />
                        </label>
                      </>
                    ) : (
                      <label className="block space-y-2">
                        <span className="text-xs uppercase tracking-wide text-zinc-500">Password</span>
                        <input type="password" className={inputClass} />
                      </label>
                    )}

                    <button type="submit" className={primaryBtn} style={{ background: PC.purple }}>
                      {mode === 'create-account' ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                      {mode === 'create-account' ? 'Create Account and Join' : 'Sign In and Join'}
                    </button>
                  </form>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1" style={{ background: PC.cardBorder }} />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">or</span>
                      <span className="h-px flex-1" style={{ background: PC.cardBorder }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => startDemoSocial('google')}
                      className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30"
                      style={{ borderColor: PC.cardBorder, background: 'rgba(0,0,0,0.3)' }}
                    >
                      <img src="/google-logo.svg" alt="" aria-hidden="true" className="h-5 w-5" />
                      Continue with Google
                    </button>
                    <button
                      type="button"
                      onClick={() => startDemoSocial('apple')}
                      className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30"
                      style={{ borderColor: PC.cardBorder, background: 'rgba(0,0,0,0.3)' }}
                    >
                      <img src="/apple-logo.svg" alt="" aria-hidden="true" className="h-5 w-5" />
                      Continue with Apple
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Email-routing choice after a social sign-in whose email differs from
                the invited institutional one — mirrors the admin-activation modal. */}
            {socialChoice ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(4,4,12,0.72)', backdropFilter: 'blur(6px)' }}
              >
                <div className="w-full max-w-md rounded-[24px] border p-6 shadow-2xl" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ background: 'rgba(124,58,237,0.14)', color: PC.purpleSoft }}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> One quick thing
                  </span>
                  <h2 className="mt-3 text-2xl font-bold text-white" style={displayFont}>Where should updates go?</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    You signed in with a different email than the one your organization set up. Choose where PulseCheck
                    should send reports and updates &mdash; you can change this anytime.
                  </p>

                  <div className="mt-5 space-y-2.5">
                    {[
                      { value: DEMO.targetEmail, tag: 'Institutional · recommended' },
                      { value: socialChoice.socialEmail, tag: 'Your sign-in email' },
                    ].map((opt) => {
                      const active = socialChoice.selected.trim().toLowerCase() === opt.value.trim().toLowerCase();
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSocialChoice((current) => (current ? { ...current, selected: opt.value } : current))}
                          className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition"
                          style={{
                            borderColor: active ? PC.purple : PC.cardBorder,
                            background: active ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.025)',
                          }}
                        >
                          <span
                            className="flex h-5 w-5 flex-none items-center justify-center rounded-full border"
                            style={{ borderColor: active ? PC.purple : 'rgba(255,255,255,0.3)', background: active ? PC.purple : 'transparent' }}
                          >
                            {active ? <CheckCircle2 className="h-4 w-4 text-white" /> : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-white">{opt.value}</span>
                            <span className="block text-[11px] uppercase tracking-[0.14em]" style={{ color: active ? PC.purpleSoft : 'rgba(255,255,255,0.4)' }}>
                              {opt.tag}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={confirmSocialChoice}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ background: PC.purple }}
                  >
                    <ArrowRight className="h-4 w-4" />
                    Confirm &amp; continue
                  </button>
                </div>
              </div>
            ) : null}
            </div>
          ) : null}

          {/* STEP 3 — member setup (mirrors /PulseCheck/member-setup) */}
          {step === 'setup' ? (
            <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-[32px] border p-8 shadow-2xl" style={infoCardStyle}>
                <div className="space-y-5">
                  <div className="inline-flex rounded-2xl border p-3" style={{ borderColor: 'rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.12)' }}>
                    <UserRound className="h-6 w-6" style={{ color: PC.purpleSoft }} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em]" style={{ color: PC.purpleSoft }}>Member Setup</p>
                    <h1 className="mt-2 text-3xl font-bold text-white" style={displayFont}>{DEMO.teamName}</h1>
                    <p className="mt-3 text-sm leading-7 text-zinc-300">
                      Confirm your identity, title, and notification posture before entering the team workspace for{' '}
                      {DEMO.organizationName}.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-300">
                    Your assigned access is <span className="font-medium text-white">{DEMO.roleLabel}</span>. Roster scope and
                    athlete visibility are controlled by the team admin.
                  </div>
                </div>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setStep('done');
                }}
                className="rounded-[32px] border p-8 shadow-2xl"
                style={{ background: PC.deepBg, borderColor: PC.cardBorder }}
              >
                <div className="space-y-5">
                  <div className="rounded-[28px] border border-zinc-800 bg-black/20 p-5">
                    <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[24px] border border-zinc-700 bg-zinc-900">
                      <span className="text-4xl font-semibold text-zinc-500">
                        {(setupForm.displayName || 'A').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-4 block rounded-2xl border border-zinc-700 px-3 py-2 text-center text-sm font-medium text-white">
                      Add Photo
                    </div>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Name</span>
                    <input
                      value={setupForm.displayName}
                      onChange={(event) => setSetupForm((current) => ({ ...current, displayName: event.target.value }))}
                      className={inputClass}
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Title</span>
                    <input
                      value={setupForm.title}
                      onChange={(event) => setSetupForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Assistant Coach"
                      className={inputClass}
                    />
                  </label>

                  <div className="rounded-[28px] border border-zinc-800 bg-black/20 p-5">
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
                          checked={!!notifications[opt.key]}
                          onChange={() => toggleNotification(opt.key)}
                          label={opt.label}
                          description={opt.description}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90" style={{ background: PC.purple }}>
                    <CheckCircle2 className="h-4 w-4" />
                    Complete Member Setup
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('done')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30"
                    style={{ borderColor: PC.cardBorder }}
                  >
                    Skip for Now
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {/* STEP 4 — handoff into the dashboard */}
          {step === 'done' ? (
            <div className="mx-auto max-w-2xl rounded-[32px] border p-10 text-center shadow-2xl" style={{ background: PC.deepBg, borderColor: PC.cardBorder }}>
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'rgba(124,58,237,0.16)' }}>
                <CheckCircle2 className="h-8 w-8" style={{ color: PC.purpleSoft }} />
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.22em]" style={{ color: PC.purpleSoft }}>Access Ready</p>
              <h2 className="mt-2 text-3xl font-bold text-white" style={displayFont}>
                You&apos;re in, {DEMO.recipientFirst} 🎉
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                {DEMO.organizationName} added you to{' '}
                <span className="font-medium text-white">{DEMO.teamName}</span>. Here&apos;s the dashboard you land on.
              </p>

              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/coach/dashboard/demo"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ background: PC.purple }}
                >
                  <BarChart3 className="h-4 w-4" />
                  Open the team dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30"
                  style={{ borderColor: PC.cardBorder }}
                >
                  Replay from the email
                </button>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </AdminRouteGuard>
  );
};

export default StaffOnboardingDemoPage;
