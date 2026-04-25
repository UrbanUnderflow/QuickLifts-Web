import React, { useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import {
  getDefaultPulseCheckSports,
  type PulseCheckSportConfigurationEntry,
} from '../api/firebase/pulsecheckSportConfig';
import {
  COACH_REPORT_DEMO_EXAMPLES,
  CoachReportDemoExample,
  getSportColor,
} from '../api/firebase/pulsecheckSportReportDemos';

// Public directory listing every per-sport coach-report demo. The /coach-report-demo
// route is also public, so this page just makes the full set of stakeholder demos
// discoverable in one place. Each card links to /coach-report-demo/{sportId}.
//
// Whitelisted in AuthWrapper so stakeholders can browse without an account.

interface DirectoryCard {
  sport: PulseCheckSportConfigurationEntry;
  demo: CoachReportDemoExample | undefined;
  accent: string;
  accentSoft: string;
  hasFullDemo: boolean;
  isThinEvidence: boolean;
}

const buildCards = (): DirectoryCard[] => {
  const sports = getDefaultPulseCheckSports();
  return sports
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((sport) => {
      const demo = COACH_REPORT_DEMO_EXAMPLES[sport.id];
      const colors = getSportColor(sport.id);
      const dimensionState = demo?.dimensionState;
      const isThinEvidence = Boolean(
        dimensionState
          && dimensionState.focus === 'thin_evidence'
          && dimensionState.composure === 'thin_evidence'
          && dimensionState.decisioning === 'thin_evidence',
      );
      const hasFullDemo = Boolean(
        demo
          && demo.topLine?.whatChanged
          && demo.topLine.whatChanged.trim().length > 0,
      );
      return {
        sport,
        demo,
        accent: colors.primary,
        accentSoft: colors.soft,
        hasFullDemo,
        isThinEvidence,
      };
    });
};

const SportsIntelligenceDemoReportsPage: React.FC = () => {
  const cards = useMemo(buildCards, []);
  const totalSports = cards.length;
  const totalFullDemos = cards.filter((card) => card.hasFullDemo && !card.isThinEvidence).length;

  return (
    <>
      <Head>
        <title>Sports Intelligence Demo Reports — Pulse</title>
        <meta
          name="description"
          content="Per-sport coach-report demos for the Pulse Sports Intelligence layer. Same engine, sport-specific blend — review what a weekly read looks like for every configured sport."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div
        className="min-h-screen text-zinc-100"
        style={{
          background: `
            radial-gradient(ellipse 90% 50% at 50% -10%, rgba(167, 139, 250, 0.18) 0%, transparent 55%),
            radial-gradient(ellipse 40% 60% at 0% 25%, rgba(34, 197, 94, 0.10) 0%, transparent 60%),
            radial-gradient(ellipse 40% 60% at 100% 35%, rgba(96, 165, 250, 0.10) 0%, transparent 60%),
            linear-gradient(180deg, #070912 0%, #050709 100%)
          `,
        }}
      >
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-12 sm:px-8 sm:pt-16">
          <header className="border-b border-zinc-800/60 pb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-violet-300">
              Pulse Sports Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Sports Intelligence Demo Reports
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Coach-facing demo reports for every sport configured in the Sports Intelligence layer.
              Same engine, sport-specific blend — each report shows how the system reads a week of
              biometrics, sims, check-ins, training, nutrition, and schedule context for that sport
              and turns it into a thoughtful note from an assistant coach.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <span className="rounded-full border border-zinc-800 bg-black/30 px-3 py-1">
                {totalSports} sports configured
              </span>
              <span className="rounded-full border border-zinc-800 bg-black/30 px-3 py-1">
                {totalFullDemos} full coach-voice demos
              </span>
              <span className="rounded-full border border-zinc-800 bg-black/30 px-3 py-1">
                Universal model — no school-specific deployment
              </span>
            </div>
          </header>

          <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const synthesis = card.demo?.teamSynthesis;
              const opponent = card.demo?.meta?.opponentOrEvent;
              const competitionDate = card.demo?.meta?.competitionDate;

              return (
                <Link
                  key={card.sport.id}
                  href={`/coach-report-demo/${card.sport.id}`}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#0b0f1a] transition hover:border-zinc-600 hover:bg-[#0d1320]"
                  style={{
                    boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02), 0 1px 0 0 rgba(255,255,255,0.03)`,
                  }}
                >
                  <div
                    className="h-[3px] w-full"
                    style={{
                      background: `linear-gradient(90deg, ${card.accent} 0%, ${card.accent}66 60%, transparent 100%)`,
                    }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-32"
                    style={{
                      background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${card.accent}1F 0%, transparent 70%)`,
                    }}
                  />

                  <div className="relative flex flex-1 flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
                          style={{
                            background: card.accentSoft,
                            boxShadow: `inset 0 0 0 1px ${card.accent}40`,
                          }}
                        >
                          {card.sport.emoji}
                        </span>
                        <div className="min-w-0">
                          <p
                            className="text-[10px] font-medium uppercase tracking-[0.22em]"
                            style={{ color: card.accent }}
                          >
                            Sport
                          </p>
                          <h2 className="mt-0.5 truncate text-base font-semibold text-zinc-100">
                            {card.sport.name}
                          </h2>
                        </div>
                      </div>
                      {card.isThinEvidence && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700/80 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                          <Lock className="h-3 w-3" />
                          Baselining
                        </span>
                      )}
                    </div>

                    {(opponent || competitionDate) && (
                      <div className="rounded-lg border border-zinc-800/80 bg-black/25 px-3 py-2 text-xs text-zinc-400">
                        {opponent && <div className="text-zinc-200">{opponent}</div>}
                        {competitionDate && (
                          <div className="mt-0.5 text-[11px] text-zinc-500">{competitionDate}</div>
                        )}
                      </div>
                    )}

                    {synthesis ? (
                      <p className="text-sm leading-relaxed text-zinc-300 line-clamp-4">
                        {synthesis}
                      </p>
                    ) : (
                      <p className="text-sm italic text-zinc-500">
                        Demo report not yet written for this sport.
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between border-t border-zinc-800/60 pt-3">
                      <span className="text-xs text-zinc-500">/coach-report-demo/{card.sport.id}</span>
                      <span
                        className="inline-flex items-center gap-1 text-sm font-medium transition group-hover:gap-2"
                        style={{ color: card.accent }}
                      >
                        View report
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>

          <footer className="mt-16 border-t border-zinc-800/60 pt-8 text-xs text-zinc-500">
            <p>
              Each report is a hand-crafted week of fixtures designed to exercise the report
              generator&rsquo;s gates: top-line three-fill, named-athlete watchlist, action specificity,
              dimension-state team read, and look-for / if-then game-day note. Athlete names, opponents,
              and venues in these demos are fictional &mdash; the system reads as universal across schools,
              institutions, pro teams, and independent athletes.
            </p>
            <p className="mt-3">
              The underlying configuration lives at{' '}
              <code className="rounded bg-black/40 px-1 py-0.5 text-zinc-300">
                src/api/firebase/pulsecheckSportConfig.ts
              </code>{' '}
              with per-sport <code className="rounded bg-black/40 px-1 py-0.5 text-zinc-300">reportPolicy</code>{' '}
              and <code className="rounded bg-black/40 px-1 py-0.5 text-zinc-300">loadModel</code> and is
              reviewable via the admin Sports Intelligence Layer page.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
};

export default SportsIntelligenceDemoReportsPage;
