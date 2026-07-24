import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Maximize2, PackageOpen, X } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

interface MediaItem {
  src: string;
  title: string;
  caption: string;
  group: 'App Store 6.5"' | 'Daily & Biometrics' | 'Nora & Training' | 'Recovery & Safety';
  appStoreReady?: boolean;
}

const MEDIA: MediaItem[] = [
  {
    src: '/pulsecheck-media/appstore-01-daily-skills.png',
    title: '01 · Daily skills',
    caption: 'The athlete opens PulseCheck and receives three clear mental skills to train today.',
    group: 'App Store 6.5"',
    appStoreReady: true,
  },
  {
    src: '/pulsecheck-media/appstore-02-training-system.png',
    title: '02 · Training system',
    caption: 'The athlete sees the assigned rep, why it was selected, and where it fits in the program.',
    group: 'App Store 6.5"',
    appStoreReady: true,
  },
  {
    src: '/pulsecheck-media/appstore-03-box-breathing.png',
    title: '03 · Box breathing',
    caption: 'A live guided breathing rep shows how mental skills become something the athlete can practice.',
    group: 'App Store 6.5"',
    appStoreReady: true,
  },
  {
    src: '/pulsecheck-media/appstore-04-nora-coaching.png',
    title: '04 · Nora coaching',
    caption: 'Nora helps the athlete understand what happened and leave the conversation with a clear plan.',
    group: 'App Store 6.5"',
    appStoreReady: true,
  },
  {
    src: '/pulsecheck-media/appstore-05-program.png',
    title: '05 · Program',
    caption: 'The athlete can see what they built, the block they are training, and what opens next.',
    group: 'App Store 6.5"',
    appStoreReady: true,
  },
  {
    src: '/pulsecheck-media/appstore-06-support-system.png',
    title: '06 · Support system',
    caption: 'Nora, coaches, and follow-up conversations stay organized in one clear place.',
    group: 'App Store 6.5"',
    appStoreReady: true,
  },
  {
    src: '/pulsecheck-media/00-app-store-meet-nora.png',
    title: 'Concept · Meet Nora',
    caption: 'Earlier App Store concept featuring Nora and the daily check-in.',
    group: 'Nora & Training',
  },
  {
    src: '/pulsecheck-media/01-today-checkin.png',
    title: 'Today · daily check-in',
    caption: 'Live heart rate (via Polar), Nora’s private readiness check-in (Drained → Locked), today’s rep, streak.',
    group: 'Daily & Biometrics',
  },
  {
    src: '/pulsecheck-media/03-sports-intel.png',
    title: 'Sports Intel',
    caption: 'Best data across every device in one read, with live heart rate, Nora readiness, and device source labels.',
    group: 'Daily & Biometrics',
  },
  {
    src: '/pulsecheck-media/04-connect-wearable.png',
    title: 'Connect a wearable',
    caption: 'Polar, Apple Watch, Fitbit, and Oura help give Nora a fuller picture.',
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
    caption: 'Check-ins and follow-ups grouped by day with reply dots, mental notes, and morning check-ins.',
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
    title: 'Profile · private by default',
    caption: 'Athlete profile, “Private by default” privacy hero, connected devices, settings & coach/team.',
    group: 'Nora & Training',
  },
  {
    src: '/pulsecheck-media/08-box-breathing.png',
    title: 'Box breathing',
    caption: 'Guided regulation rep with breathing cadence, stress trend, and Nora context.',
    group: 'Recovery & Safety',
  },
  {
    src: '/pulsecheck-media/09-critical-signal.png',
    title: 'Critical signal',
    caption: 'Critical signal review with safety routing, escalation context, and coach visibility boundaries.',
    group: 'Recovery & Safety',
  },
  {
    src: '/pulsecheck-media/10-welfare-check.png',
    title: 'Welfare check',
    caption: 'Follow-up welfare check screen for support staff handoff and athlete care continuity.',
    group: 'Recovery & Safety',
  },
];

const GROUPS: MediaItem['group'][] = [
  'App Store 6.5"',
  'Daily & Biometrics',
  'Nora & Training',
  'Recovery & Safety',
];

const PulseCheckMediaPage: React.FC = () => {
  const [active, setActive] = useState<MediaItem | null>(null);
  const appStoreItems = MEDIA.filter((item) => item.appStoreReady);

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Media | Admin</title>
      </Head>

      <div className="min-h-screen bg-[#0A0A0B] text-white">
        <div className="border-b border-white/10 bg-[#111113]">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <Link
              href="/admin"
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-white"
            >
              <ArrowLeft size={16} /> Back to Admin
            </Link>
            <div className="flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-end">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.28em] text-[#A875FF]">
                  PULSECHECK · MEDIA LIBRARY
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  App Store media, ready to use.
                </h1>
                <p className="mt-3 max-w-xl text-gray-400">
                  A polished six-screen product story built from the real PulseCheck app. Open any
                  image to review it, then download the full-resolution PNG for App Store Connect.
                </p>
              </div>
              <a
                href="/pulsecheck-media/PulseCheck-App-Store-6.5-Screenshots.zip"
                download
                className="inline-flex items-center gap-2 rounded-full bg-[#D8FF3E] px-6 py-3 text-sm font-black text-[#090A0D] transition-transform hover:scale-[1.03]"
              >
                <PackageOpen size={17} />
                Download complete set
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-10">
          <section className="mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Final screenshots', `${appStoreItems.length}`],
              ['Apple-ready size', '1284 × 2778'],
              ['File format', 'PNG'],
              ['Display target', 'iPhone 6.5"'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">{label}</p>
                <p className="mt-2 text-xl font-black text-white">{value}</p>
              </div>
            ))}
          </section>

          {GROUPS.map((group) => {
            const items = MEDIA.filter((m) => m.group === group);
            if (!items.length) return null;
            return (
              <section key={group} className="mb-14">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <h2 className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-gray-500">
                    {group} · {items.length}
                  </h2>
                  {group === 'App Store 6.5"' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#52E4CD]/25 bg-[#52E4CD]/10 px-3 py-1 text-xs font-bold text-[#72EBD8]">
                      <Check size={13} />
                      Accepted dimensions
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((item) => (
                    <button
                      key={item.src}
                      onClick={() => setActive(item)}
                      className="group text-left"
                    >
                      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#161618] shadow-xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-[#A875FF]/50">
                        <img
                          src={item.src}
                          alt={item.title}
                          loading="lazy"
                          className="aspect-[9/19] w-full object-cover object-top"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-14 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="text-xs font-bold text-white">Open preview</span>
                          <Maximize2 size={15} className="text-white" />
                        </div>
                      </div>
                      <div className="mt-3 flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-white">{item.title}</h3>
                        {item.appStoreReady && (
                          <span className="shrink-0 rounded-full bg-[#52E4CD]/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#72EBD8]">
                            Ready
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-snug text-gray-500">{item.caption}</p>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {active && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
            onClick={() => setActive(null)}
          >
            <button
              aria-label="Close preview"
              className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              onClick={() => setActive(null)}
            >
              <X size={20} />
            </button>
            <div className="flex max-h-full flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={active.src}
                alt={active.title}
                className="max-h-[78vh] rounded-[28px] border border-white/10 shadow-2xl"
              />
              <div className="mt-5 flex max-w-2xl flex-col items-center gap-4 sm:flex-row">
                <div className="text-center">
                  <div className="text-base font-bold text-white">{active.title}</div>
                  <div className="mt-1 text-sm text-gray-400">{active.caption}</div>
                  {active.appStoreReady && (
                    <div className="mt-2 text-xs font-bold text-[#72EBD8]">
                      Full download · 1284 × 2778 PNG
                    </div>
                  )}
                </div>
                <a
                  href={active.src.replace('/pulsecheck-media/', '/pulsecheck-media/full/')}
                  download
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#A875FF] px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
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
