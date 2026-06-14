import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Download, X } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

// PulseCheck Media — the canonical home for every generated PulseCheck mock /
// screenshot concept. Mirrors the FWP and FitClub media libraries. Stored under
// /public/pulsecheck-media so they survive and stay shareable for screenshots,
// decks, and the App Store listing. Full-res downloads are 1284x2778 (App Store
// 6.5" display size) so they upload without the "wrong dimensions" error.

interface MediaItem {
  src: string;
  title: string;
  caption: string;
  group: 'App Store' | 'Daily & Biometrics' | 'Nora & Training';
}

const MEDIA: MediaItem[] = [
  {
    src: '/pulsecheck-media/00-app-store-meet-nora.png',
    title: 'App Store — Meet Nora',
    caption: 'Hero App Store creative. “Check in. Nora takes it from here.” — purple mark, daily check-in peeking in.',
    group: 'App Store',
  },
  {
    src: '/pulsecheck-media/01-today-checkin.png',
    title: 'Today — daily check-in',
    caption: 'Live heart rate (via Polar), Nora’s private readiness check-in (Drained → Locked), today’s rep, streak.',
    group: 'Daily & Biometrics',
  },
  {
    src: '/pulsecheck-media/03-sports-intel.png',
    title: 'Sports Intel',
    caption: 'Best data across every device in one read — live HR hero, Nora readiness %, per-metric “via device” tags.',
    group: 'Daily & Biometrics',
  },
  {
    src: '/pulsecheck-media/04-connect-wearable.png',
    title: 'Connect a wearable',
    caption: 'Polar (signature, connected), Apple Watch, Fitbit Air, Oura — “give Nora the full picture.”',
    group: 'Daily & Biometrics',
  },
  {
    src: '/pulsecheck-media/02-nora-chat.png',
    title: 'Nora chat',
    caption: 'Conversation with Nora, mental-notes bar, biometric-aware coaching, voice + send. The Nora orb.',
    group: 'Nora & Training',
  },
  {
    src: '/pulsecheck-media/06-nora-inbox.png',
    title: 'Nora inbox',
    caption: 'Check-ins and follow-ups grouped by day — reply dots, logged mental notes, morning check-ins.',
    group: 'Nora & Training',
  },
  {
    src: '/pulsecheck-media/05-training.png',
    title: 'Training',
    caption: 'Streak + reps + level, today’s session, coach plan progress (“Stay calm under pressure”), recent results.',
    group: 'Nora & Training',
  },
  {
    src: '/pulsecheck-media/07-profile-private.png',
    title: 'Profile — private by default',
    caption: 'Athlete profile, “Private by default” privacy hero, connected devices, settings & coach/team.',
    group: 'Nora & Training',
  },
];

const GROUPS: MediaItem['group'][] = ['App Store', 'Daily & Biometrics', 'Nora & Training'];

const PulseCheckMediaPage: React.FC = () => {
  const [active, setActive] = useState<MediaItem | null>(null);

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Media — Admin</title>
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
                <p className="font-mono text-xs font-bold uppercase tracking-[0.28em] text-[#8B5CF6]">
                  PULSECHECK · MEDIA LIBRARY
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  Every mock we&apos;ve made.
                </h1>
                <p className="mt-3 max-w-xl text-gray-400">
                  Generated PulseCheck screen concepts and App Store creative — the daily check-in,
                  Sports Intel, Nora, wearables, and training. Browse, lightbox, and download for
                  screenshots, decks, and the App Store listing. {MEDIA.length} assets.
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
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#161618] shadow-xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-[#8B5CF6]/40">
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
                  href={active.src.replace('/pulsecheck-media/', '/pulsecheck-media/full/')}
                  download
                  className="inline-flex items-center gap-2 rounded-full bg-[#8B5CF6] px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
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

export default PulseCheckMediaPage;
