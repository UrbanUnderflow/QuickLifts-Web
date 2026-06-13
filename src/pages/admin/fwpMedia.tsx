import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Download, X } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

// FWP Media — the canonical home for every generated Fit With Pulse mock /
// screenshot concept produced for the consumer-app spinout. Mirrors the
// FitClub media library. Stored under /public/fwp-media so they survive and
// stay shareable for screenshots, decks, and the App Store listing.

interface MediaItem {
  src: string;
  title: string;
  caption: string;
  group: 'App Store' | 'The App' | 'Movers & Progress';
}

const MEDIA: MediaItem[] = [
  {
    src: '/fwp-media/00-app-store-press-play.png',
    title: 'App Store — Press play',
    caption: 'Hero App Store creative. “Press play. We built the rest.” — lime mark, Today screen peeking in.',
    group: 'App Store',
  },
  {
    src: '/fwp-media/01-today-home.png',
    title: 'Today — home',
    caption: 'Readiness headline, the AI-handed “Start today’s workout” CTA, Featuring Movers, focus chips, Move of the Day.',
    group: 'The App',
  },
  {
    src: '/fwp-media/02-recovery-heat-map.png',
    title: 'Recovery heat map',
    caption: '“What to work today.” Anatomical front/back figure tinted by recovery — freshest muscles win the day.',
    group: 'The App',
  },
  {
    src: '/fwp-media/03-workout-preview-built-for-you.png',
    title: 'Workout preview — Built for you',
    caption: 'The BUILT FOR YOU score card, per-dimension breakdown, Mover-credited moves, 3-strike vote buttons.',
    group: 'The App',
  },
  {
    src: '/fwp-media/04-immersive-player.png',
    title: 'Immersive player',
    caption: 'Video-backdrop active session — move counter with Mover, set dots, lime prescription, Done/Skip.',
    group: 'The App',
  },
  {
    src: '/fwp-media/05-progress-rank.png',
    title: 'Progress — Pulse rank',
    caption: 'Weekly goal ring + streak, the Pulse rank XP card (Warrior → Champion), training balance bars.',
    group: 'Movers & Progress',
  },
  {
    src: '/fwp-media/06-find-movers.png',
    title: 'Find Movers',
    caption: 'People-first search — follow Movers and add them to your Rotation so their moves get favored.',
    group: 'Movers & Progress',
  },
  {
    src: '/fwp-media/07-me-profile.png',
    title: 'Me profile',
    caption: 'Avatar + rank, Followers / In Rotation / Workouts, Stats·Activity·Creator tabs, Health Snapshot hero.',
    group: 'Movers & Progress',
  },
];

const GROUPS: MediaItem['group'][] = ['App Store', 'The App', 'Movers & Progress'];

const FwpMediaPage: React.FC = () => {
  const [active, setActive] = useState<MediaItem | null>(null);

  return (
    <AdminRouteGuard>
      <Head>
        <title>FWP Media — Admin</title>
      </Head>

      <div className="min-h-screen bg-[#0A0A0B] text-white">
        {/* Header */}
        <div className="border-b border-white/10 bg-[#111113]">
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
                  FIT WITH PULSE · MEDIA LIBRARY
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  Every mock we&apos;ve made.
                </h1>
                <p className="mt-3 max-w-xl text-gray-400">
                  Generated Fit With Pulse screen concepts and App Store creative — stored for
                  screenshot content, decks, and the App Store listing. {MEDIA.length} assets.
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
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#161618] shadow-xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-[#E0FE10]/40">
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
                  href={active.src.replace('/fwp-media/', '/fwp-media/full/')}
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

export default FwpMediaPage;
