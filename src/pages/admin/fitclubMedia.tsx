import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Download, X } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

// FitClub Media — the canonical home for every generated FitClub mock /
// screenshot concept produced during the redesign + experience work.
// Stored under /public/fitclub-media so they survive and stay shareable.

interface MediaItem {
  src: string;
  title: string;
  caption: string;
  group: 'App Store' | 'Redesign' | 'Events & Experience';
}

const MEDIA: MediaItem[] = [
  {
    src: '/fitclub-media/00-app-store-find-your-crew.png',
    title: 'App Store — Find your crew',
    caption: 'Hero App Store creative. Sunrise run-club, white Pulse mark, member pill.',
    group: 'App Store',
  },
  {
    src: '/fitclub-media/01-splash.png',
    title: 'Splash',
    caption: 'Editorial launch screen — “Fitness is better together.”',
    group: 'Redesign',
  },
  {
    src: '/fitclub-media/02-club-home.png',
    title: 'Club home — The Pact',
    caption: 'Photography-led club home, neutral charcoal chrome, one lime moment.',
    group: 'Redesign',
  },
  {
    src: '/fitclub-media/03-training-1on1.png',
    title: '1-on-1 training room',
    caption: 'Coaching room with the adherence week strip as the centerpiece.',
    group: 'Redesign',
  },
  {
    src: '/fitclub-media/04-you-tab.png',
    title: 'You tab',
    caption: '“Show up for you.” — personal daily surface.',
    group: 'Redesign',
  },
  {
    src: '/fitclub-media/05-discover.png',
    title: 'Discover',
    caption: 'Photo-led club/Move grid, white filter chips, lime LIVE badge.',
    group: 'Redesign',
  },
  {
    src: '/fitclub-media/06-challenge-detail.png',
    title: 'Challenge detail',
    caption: 'First editorial pass at the challenge detail screen.',
    group: 'Redesign',
  },
  {
    src: '/fitclub-media/07-run-challenge.png',
    title: 'Run challenge (lime)',
    caption: 'Run challenge in the universal-lime exploration.',
    group: 'Redesign',
  },
  {
    src: '/fitclub-media/07b-run-challenge-type-accent.png',
    title: 'Run challenge (type-accent)',
    caption: 'Final direction — workout-type color owns the accent slot (run = blue).',
    group: 'Redesign',
  },
  {
    src: '/fitclub-media/08-challenge-detail-v2-ia.png',
    title: 'Challenge detail — IA v2',
    caption: 'Restructured: condensed hero, chat tile, compact schedule.',
    group: 'Redesign',
  },
  {
    src: '/fitclub-media/09-club-home-happening.png',
    title: 'Club home — Happening rail',
    caption: 'Up Next event + countdown + RSVP pile, live-now, daily drop, recap.',
    group: 'Events & Experience',
  },
  {
    src: '/fitclub-media/10-event-detail-rsvp.png',
    title: 'Event detail — RSVP',
    caption: '“I’m in”, going roster, host note, QR/geofence check-in tiles.',
    group: 'Events & Experience',
  },
  {
    src: '/fitclub-media/11-cycle-podium-ceremony.png',
    title: 'Cycle podium ceremony',
    caption: 'The afterglow moment — podium, superlatives, your finish, confetti.',
    group: 'Events & Experience',
  },
  {
    src: '/fitclub-media/12-daily-drop-recap-pushes.png',
    title: 'Daily drop + recap pushes',
    caption: 'Lockscreen morning-drop & nightly-recap notifications + in-app recap card.',
    group: 'Events & Experience',
  },
  {
    src: '/fitclub-media/13-host-megaphone.png',
    title: 'Host megaphone',
    caption: 'Pinned host announcement at the top of club home + the compose sheet.',
    group: 'Events & Experience',
  },
];

const GROUPS: MediaItem['group'][] = ['App Store', 'Redesign', 'Events & Experience'];

const FitClubMediaPage: React.FC = () => {
  const [active, setActive] = useState<MediaItem | null>(null);

  return (
    <AdminRouteGuard>
      <Head>
        <title>FitClub Media — Admin</title>
      </Head>

      <div className="min-h-screen bg-[#020408] text-white">
        {/* Header */}
        <div className="border-b border-white/10 bg-[#0a0c10]">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <Link
              href="/admin"
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-white"
            >
              <ArrowLeft size={16} /> Back to Admin
            </Link>
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.28em] text-[#E0FE10]">
                  FITCLUB · MEDIA LIBRARY
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  Every mock we&apos;ve made.
                </h1>
                <p className="mt-3 max-w-xl text-gray-400">
                  Generated FitClub screen concepts and App Store creative — stored for screenshot
                  content, decks, and the App Store listing. {MEDIA.length} assets.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Gallery */}
        <div className="mx-auto max-w-7xl px-6 py-10">
          {GROUPS.map((group) => {
            const items = MEDIA.filter((m) => m.group === group);
            if (!items.length) return null;
            return (
              <section key={group} className="mb-14">
                <h2 className="mb-6 font-mono text-xs font-bold uppercase tracking-[0.24em] text-gray-500">
                  {group} · {items.length}
                </h2>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((item) => (
                    <button
                      key={item.src}
                      onClick={() => setActive(item)}
                      className="group text-left"
                    >
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111215] shadow-xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-[#E0FE10]/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.src}
                          alt={item.title}
                          loading="lazy"
                          className="aspect-[9/19] w-full object-cover object-top"
                        />
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-white">{item.title}</h3>
                      <p className="mt-1 text-xs leading-snug text-gray-500">{item.caption}</p>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Lightbox */}
        {active && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
            onClick={() => setActive(null)}
          >
            <button
              className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              onClick={() => setActive(null)}
            >
              <X size={20} />
            </button>
            <div className="flex max-h-full flex-col items-center" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.src}
                alt={active.title}
                className="max-h-[78vh] rounded-[28px] border border-white/10 shadow-2xl"
              />
              <div className="mt-5 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-base font-bold text-white">{active.title}</div>
                  <div className="text-sm text-gray-400">{active.caption}</div>
                </div>
                <a
                  href={active.src.replace('/fitclub-media/', '/fitclub-media/full/')}
                  download
                  className="inline-flex items-center gap-2 rounded-full bg-[#E0FE10] px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-105"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={15} /> Download full-res
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
};

export default FitClubMediaPage;
