import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowUpRight, MonitorPlay, Sparkles } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

// Canonical PulseCheck brand tokens (see public/pulsecheck-design-system.html).
const PC = {
  pageBg: '#070711',
  deepBg: '#0B0B1C',
  purple: '#7C3AED',
  purpleSoft: '#a78bfa',
  cardBg: 'rgba(255,255,255,0.045)',
  cardBorder: 'rgba(255,255,255,0.10)',
};

const displayFont: React.CSSProperties = { fontFamily: 'Switzer, sans-serif' };
const serifAccent: React.CSSProperties = { fontFamily: 'Fraunces, serif', fontStyle: 'italic' };

type ScreenDemoStep = { label: string; detail: string };

type ScreenDemo = {
  id: string;
  surface: string;
  title: string;
  description: string;
  /** Where the demo opens. Demo mode bypasses auth so you can click straight through. */
  launchUrl: string;
  /** The ordered surfaces this walkthrough chains through. */
  steps: ScreenDemoStep[];
  status: 'live' | 'soon';
};

// Registry of testable UI walkthroughs. Add new entry points here — each one is a
// self-contained demo that bypasses auth/backend so anyone can preview the real
// screens end-to-end (the web analog of the Macra / Pulse Ritual ScreenDemoView).
const SCREEN_DEMOS: ScreenDemo[] = [
  {
    id: 'coach-onboarding',
    surface: 'Coach onboarding → dashboard',
    title: 'Full coach onboarding sequence',
    description:
      'Exactly what a coach experiences after clicking their activation email link: the "You’re invited" welcome → profile, staff & athlete setup → the dashboard. Leave the sign-in fields empty and press continue — auth is bypassed so you can walk the whole flow end-to-end.',
    launchUrl: '/PulseCheck/admin-activation/f5382b83-caba-4b23-9305-47ffc4036eea?devFirebase=1&demo=1',
    steps: [
      { label: 'Activation', detail: 'The "You’re invited" welcome — press continue with empty fields to skip auth.' },
      { label: 'Set up', detail: 'Profile, staff invites, athlete invites — advance without saving anything real.' },
      { label: 'Dashboard', detail: 'Land on the coach dashboard with mock athletes, as in the walkthrough.' },
    ],
    status: 'live',
  },
  {
    id: 'coach-dashboard',
    surface: 'Coach dashboard',
    title: 'Coach Dashboard (demo)',
    description:
      'The clean PulseCheck sidebar dashboard with mock data and no auth — for design review of the layout and flows.',
    launchUrl: '/coach/dashboard/demo',
    steps: [
      { label: 'Navigate', detail: 'Home, Athlete Alerts, Team Roster, Train Nora, Schedule, Reports.' },
      { label: 'Mock data', detail: 'Athletes, alerts, and reports are mock — nothing writes to Firebase.' },
    ],
    status: 'live',
  },
];

const ScreenDemoPage: React.FC = () => {
  return (
    <AdminRouteGuard>
      <Head>
        <title>Screen Demo | PulseCheck Admin</title>
        <meta name="robots" content="noindex,nofollow" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700,800,900&display=swap" />
      </Head>

      <div className="relative min-h-screen overflow-hidden text-white" style={{ background: PC.pageBg, fontFamily: 'Switzer, sans-serif' }}>
        <div className="pointer-events-none absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />

        <main className="relative mx-auto w-full max-w-5xl px-4 py-12 md:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(124,58,237,0.14)' }}>
              <MonitorPlay className="h-5 w-5" style={{ color: PC.purpleSoft }} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: PC.purpleSoft }}>
              PulseCheck Admin
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl" style={displayFont}>
            Screen <span style={{ ...serifAccent, color: PC.purpleSoft, fontWeight: 500 }}>Demo</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
            Preview real PulseCheck UI flows end-to-end without a real account or data. Each demo bypasses
            login and backend writes so you can walk the exact screens a coach, athlete, or admin would see.
          </p>

          <div className="mt-10 grid gap-5">
            {SCREEN_DEMOS.map((demo) => (
              <article
                key={demo.id}
                className="rounded-[24px] border p-6 shadow-2xl md:p-7"
                style={{ background: PC.deepBg, borderColor: PC.cardBorder }}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: PC.purpleSoft }}>
                      {demo.surface}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight text-white" style={displayFont}>
                      {demo.title}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{demo.description}</p>
                  </div>

                  {demo.status === 'live' ? (
                    <Link
                      href={demo.launchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex flex-none items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                      style={{ background: PC.purple }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Launch demo
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex flex-none items-center rounded-2xl border px-5 py-3 text-sm font-semibold text-zinc-400" style={{ borderColor: PC.cardBorder }}>
                      Coming soon
                    </span>
                  )}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {demo.steps.map((step, index) => (
                    <div key={step.label} className="rounded-2xl border p-4" style={{ borderColor: PC.cardBorder, background: 'rgba(255,255,255,0.025)' }}>
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: 'rgba(124,58,237,0.16)', color: PC.purpleSoft }}>
                          {index + 1}
                        </span>
                        <span className="text-sm font-semibold text-white">{step.label}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </AdminRouteGuard>
  );
};

export default ScreenDemoPage;
