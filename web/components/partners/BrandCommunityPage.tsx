"use client";

import React from "react";

export type BrandKpiStats = {
  challengeJoins?: number;
  streakWeeks?: number;
  creatorLedChallenges?: number;
  communityRetentionRate?: number; // percentage
};

export type BrandCommunityPageProps = {
  brandName: string;
  brandLogoUrl?: string;
  heroHeadline: string;
  heroSubcopy: string;
  kpis?: BrandKpiStats;
  contactCtaLabel: string;
  contactCtaHref: string;
};

export function BrandCommunityPage(props: BrandCommunityPageProps) {
  const {
    brandName,
    brandLogoUrl,
    heroHeadline,
    heroSubcopy,
    kpis,
    contactCtaLabel,
    contactCtaHref,
  } = props;

  const formattedKpis = [
    kpis?.challengeJoins != null && {
      label: "Challenge joins",
      value: kpis.challengeJoins.toLocaleString(),
      helper: "Total participants across Pulse-powered blocks",
    },
    kpis?.streakWeeks != null && {
      label: "Streak weeks",
      value: kpis.streakWeeks.toLocaleString(),
      helper: "Weeks where your community kept a shared challenge streak alive",
    },
    kpis?.creatorLedChallenges != null && {
      label: "Creator-led challenges",
      value: kpis.creatorLedChallenges.toLocaleString(),
      helper: "Blocks hosted by your athletes, ambassadors, or coaches",
    },
    kpis?.communityRetentionRate != null && {
      label: "Community retention",
      value: `${Math.round(kpis.communityRetentionRate)}%`,
      helper: "Members who stay active across multiple challenge blocks",
    },
  ].filter(Boolean) as {
    label: string;
    value: string;
    helper: string;
  }[];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 lg:px-8">
        {/* Hero */}
        <header className="mb-10 flex flex-col gap-6 border-b border-slate-800 pb-8 pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  alt={`${brandName} logo`}
                  className="h-10 w-10 rounded-md bg-slate-900 object-contain p-1 ring-1 ring-slate-700"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold uppercase tracking-wide ring-1 ring-slate-700">
                  {brandName.slice(0, 2)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pulse × Brand Communities
                </span>
                <span className="text-sm font-medium text-slate-50">
                  {brandName}
                </span>
              </div>
            </div>
          </div>

          <div className="max-w-md text-sm text-slate-300">
            <p>
              Pulse turns your existing customers and creators into an active
              challenge community that trains together inside your world, not
              ours.
            </p>
          </div>
        </header>

        {/* Main content */}
        <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
          {/* Left: story + how it works */}
          <section className="space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                {heroHeadline}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                {heroSubcopy}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                How Pulse shows up for {brandName}
              </h2>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="font-medium text-slate-50">
                    Your creators lead the blocks.
                  </span>{" "}
                  Pulse turns your athletes, ambassadors, and coaches into
                  challenge hosts — with followers joining directly from the
                  channels they already follow.
                </li>
                <li>
                  <span className="font-medium text-slate-50">
                    Your customers move together, not alone.
                  </span>{" "}
                  Instead of one-off programs, your community enters shared,
                  time-bound blocks with clear goals, visible streaks, and
                  light social pressure to keep showing up.
                </li>
                <li>
                  <span className="font-medium text-slate-50">
                    You get a community heartbeat, not just campaign reach.
                  </span>{" "}
                  Pulse tracks challenge joins, streak weeks, and creator-led
                  participation so you can see, in numbers, how alive your
                  community really is.
                </li>
              </ul>
            </div>
          </section>

          {/* Right: KPIs + CTA */}
          <aside className="space-y-4">
            {formattedKpis.length > 0 && (
              <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Community-at-work KPIs
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {formattedKpis.map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-md bg-slate-950/40 px-3 py-2"
                    >
                      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {kpi.label}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-50">
                        {kpi.value}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {kpi.helper}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-lg border border-blue-500/60 bg-gradient-to-b from-blue-500/10 via-slate-950 to-slate-950 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                Talk to Pulse about a community challenge
              </h2>
              <p className="mt-2 text-sm text-slate-100">
                Share your upcoming campaign, product drop, or season. We’ll
                map it into a Pulse challenge plan that your creators can run
                — and your team can measure.
              </p>
              <a
                href={contactCtaHref}
                className="mt-3 inline-flex items-center justify-center rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                {contactCtaLabel}
              </a>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-[11px] text-slate-400">
              <p>
                Pulse is the challenge layer that sits on top of the channels
                you already own — social, email, apps, stores — and turns passive
                followers into participants moving through shared blocks
                with your creators.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default BrandCommunityPage;
