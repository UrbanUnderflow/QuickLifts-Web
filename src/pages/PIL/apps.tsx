import type { GetStaticProps, NextPage } from 'next';
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Apple, ArrowUpRight, Play, Sparkles } from 'lucide-react';

type AppEntry = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  hue: {
    ring: string;
    glow: string;
    badge: string;
    text: string;
  };
  iosUrl?: string;
  androidUrl?: string;
  webUrl?: string;
  status: 'available' | 'coming-soon';
};

const APPS: AppEntry[] = [
  {
    id: 'fit-with-pulse',
    name: 'Fit With Pulse',
    tagline: 'Train with your people.',
    description:
      'Build routines, join clubs, and train alongside the community that pushes you. Coached by Nora — your in-app AI training partner.',
    icon: '/pulseIcon.png',
    hue: {
      ring: 'ring-[#E0FE10]/40',
      glow: 'from-[#E0FE10]/30 via-[#E0FE10]/10 to-transparent',
      badge: 'bg-[#E0FE10] text-black',
      text: 'text-[#E0FE10]',
    },
    iosUrl: 'https://apps.apple.com/us/app/fit-with-pulse/id6451497729',
    androidUrl: 'https://play.google.com/store/apps/details?id=ai.fitwithpulse.pulse',
    webUrl: 'https://fitwithpulse.ai',
    status: 'available',
  },
  {
    id: 'macra',
    name: 'Macra',
    tagline: 'Scan any food. Get your macros instantly.',
    description:
      'Snap a meal, a label, or a fridge. Macra returns a complete macro breakdown in seconds and builds your daily plan around your exact targets.',
    icon: '/macra-icon.png',
    hue: {
      ring: 'ring-[#6A9AFA]/40',
      glow: 'from-[#3B82F6]/30 via-[#6A9AFA]/10 to-transparent',
      badge: 'bg-[#3B82F6] text-white',
      text: 'text-[#6A9AFA]',
    },
    iosUrl: 'https://apps.apple.com/us/app/macra-ai-calorie/id6463771067',
    webUrl: 'https://eatwithmacra.ai',
    status: 'available',
  },
  {
    id: 'pulse-check',
    name: 'Pulse Check',
    tagline: 'Mindset coaching for athletes.',
    description:
      'A daily two-minute check-in that turns how you feel into how you perform. Designed for athletes, coaches, and the people behind them.',
    icon: '/pulseCheckIcon.png',
    hue: {
      ring: 'ring-[#A05EF8]/40',
      glow: 'from-[#A05EF8]/30 via-[#8B5CF6]/10 to-transparent',
      badge: 'bg-[#A05EF8] text-white',
      text: 'text-[#A05EF8]',
    },
    iosUrl: 'https://apps.apple.com/us/app/pulsecheck-mindset-coaching/id6747253393',
    status: 'available',
  },
  {
    id: 'pulse-ritual',
    name: 'Pulse Ritual',
    tagline: 'Water your body, mind, and spirit.',
    description:
      'The daily watering layer for human performance. Three small drops a day — watch yourself grow.',
    icon: '',
    hue: {
      ring: 'ring-[#5EEAD4]/40',
      glow: 'from-[#5EEAD4]/30 via-[#10B981]/10 to-transparent',
      badge: 'bg-[#5EEAD4] text-black',
      text: 'text-[#5EEAD4]',
    },
    status: 'coming-soon',
  },
];

const META_TITLE = 'The Pulse Apps — Pulse Intelligence Labs';
const META_DESCRIPTION =
  'The Pulse Intelligence Labs app suite — Fit With Pulse, Macra, Pulse Check, and Pulse Ritual. Performance, nutrition, mindset, and daily ritual, all in one place.';
const META_URL = 'https://pulseintelligencelabs.com/apps';

const RitualGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 100 100"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="ritualGrad" cx="50%" cy="40%" r="55%">
        <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.95" />
        <stop offset="60%" stopColor="#5EEAD4" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="36" fill="url(#ritualGrad)" />
    <circle cx="50" cy="50" r="22" stroke="#5EEAD4" strokeOpacity="0.6" strokeWidth="1.2" />
    <circle cx="50" cy="50" r="30" stroke="#5EEAD4" strokeOpacity="0.35" strokeWidth="1" />
    <circle cx="50" cy="50" r="6" fill="#ECFEFF" />
  </svg>
);

const AppCard: React.FC<{ app: AppEntry; index: number }> = ({ app, index }) => {
  const isComingSoon = app.status === 'coming-soon';

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 backdrop-blur-sm"
    >
      <div
        className={`pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-gradient-to-br ${app.hue.glow} blur-3xl opacity-80 transition-opacity duration-500 group-hover:opacity-100`}
      />

      <div className="relative flex flex-col gap-8 p-8 sm:p-10 md:flex-row md:items-center md:gap-12">
        <div className="flex-shrink-0">
          <div className={`relative h-28 w-28 sm:h-32 sm:w-32 rounded-[28%] overflow-hidden ring-1 ${app.hue.ring} shadow-2xl shadow-black/40`}>
            {app.icon ? (
              <img
                src={app.icon}
                alt={`${app.name} app icon`}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center">
                <RitualGlyph className="h-24 w-24 sm:h-28 sm:w-28" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              {app.name}
            </h2>
            {isComingSoon ? (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${app.hue.badge}`}>
                <Sparkles className="h-3.5 w-3.5" />
                Coming soon
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
                <span className={`h-1.5 w-1.5 rounded-full ${app.hue.badge.split(' ')[0]}`} />
                Available now
              </span>
            )}
          </div>

          <p className={`text-base sm:text-lg font-medium ${app.hue.text} mb-3`}>
            {app.tagline}
          </p>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            {app.description}
          </p>

          {!isComingSoon && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {app.iosUrl && (
                <a
                  href={app.iosUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2.5 text-sm font-semibold hover:bg-zinc-200 transition-colors"
                >
                  <Apple className="h-4 w-4" />
                  App Store
                </a>
              )}
              {app.androidUrl && (
                <a
                  href={app.androidUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 text-white px-4 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Google Play
                </a>
              )}
              {app.webUrl && (
                <a
                  href={app.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Visit site
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          {isComingSoon && (
            <div className="mt-6">
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-400">
                Launching later this year
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
};

const AppsPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>{META_TITLE}</title>
        <meta name="description" content={META_DESCRIPTION} />
        <meta property="og:title" content={META_TITLE} />
        <meta property="og:description" content={META_DESCRIPTION} />
        <meta property="og:url" content={META_URL} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white selection:bg-white/20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[680px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#E0FE10]/10 via-[#A05EF8]/10 to-[#3B82F6]/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pt-24 pb-32 sm:pt-32 sm:pb-40">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mb-20 sm:mb-24"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
            >
              Pulse Intelligence Labs
            </Link>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.02]">
              The Pulse{' '}
              <span className="bg-gradient-to-r from-[#E0FE10] via-[#A05EF8] to-[#5EEAD4] bg-clip-text text-transparent">
                apps.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg sm:text-xl text-zinc-400 leading-relaxed">
              Four products. One mission — make daily performance simple, social, and shared. Download the suite below.
            </p>
          </motion.div>

          <div className="space-y-6">
            {APPS.map((app, index) => (
              <AppCard key={app.id} app={app} index={index} />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-24 border-t border-white/5 pt-10 text-center"
          >
            <p className="text-sm text-zinc-500">
              Built by{' '}
              <Link href="/" className="text-zinc-300 hover:text-white transition-colors">
                Pulse Intelligence Labs
              </Link>
              .
            </p>
          </motion.div>
        </div>
      </main>
    </>
  );
};

export const getStaticProps: GetStaticProps = async () => ({
  props: {
    ogMeta: {
      title: META_TITLE,
      description: META_DESCRIPTION,
      url: META_URL,
      type: 'website',
      siteName: 'Pulse Intelligence Labs',
    },
  },
});

export default AppsPage;
