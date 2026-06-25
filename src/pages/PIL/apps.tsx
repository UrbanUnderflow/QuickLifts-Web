import type { GetStaticProps, NextPage } from 'next';
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, Play, Sparkles } from 'lucide-react';
import RitualEarlyAccessForm from '../../components/ritual/RitualEarlyAccessForm';

const AppleLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 50 50"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M 44.527344 34.75 C 43.449219 37.144531 42.929688 38.214844 41.542969 40.328125 C 39.601563 43.28125 36.863281 46.96875 33.480469 46.992188 C 30.46875 47.019531 29.691406 45.027344 25.601563 45.0625 C 21.515625 45.082031 20.664063 47.03125 17.648438 47 C 14.261719 46.96875 11.671875 43.648438 9.730469 40.699219 C 4.300781 32.429688 3.726563 22.734375 7.082031 17.578125 C 9.457031 13.921875 13.210938 11.773438 16.738281 11.773438 C 20.332031 11.773438 22.589844 13.746094 25.558594 13.746094 C 28.441406 13.746094 30.195313 11.769531 34.351563 11.769531 C 37.492188 11.769531 40.8125 13.480469 43.1875 16.433594 C 35.421875 20.691406 36.683594 31.78125 44.527344 34.75 Z M 31.195313 8.46875 C 32.707031 6.527344 33.855469 3.789063 33.4375 1 C 30.972656 1.167969 28.089844 2.742188 26.40625 4.78125 C 24.878906 6.640625 23.613281 9.398438 24.105469 12.066406 C 26.796875 12.152344 29.582031 10.546875 31.195313 8.46875 Z" />
  </svg>
);

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
  landingUrl?: string;
  status: 'available' | 'coming-soon';
};

const APPS: AppEntry[] = [
  {
    id: 'fit-with-pulse',
    name: 'Fit With Pulse',
    tagline: 'Train with your people.',
    description:
      'Build routines, join clubs, and train alongside the community that pushes you. Coached by Nora — your in-app AI training partner.',
    icon: '/fwp-app-icon.jpg',
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
    name: 'PulseCheck',
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
    webUrl: 'https://pulsecheckmind.ai',
    status: 'available',
  },
  {
    id: 'pulse-ritual',
    name: 'Pulse Ritual',
    tagline: 'Water your body, mind, and spirit.',
    description:
      'The daily watering layer for human performance. Three small drops a day — watch yourself grow.',
    icon: '/pulse-ritual-icon.png',
    hue: {
      ring: 'ring-[#5EEAD4]/40',
      glow: 'from-[#5EEAD4]/30 via-[#10B981]/10 to-transparent',
      badge: 'bg-[#5EEAD4] text-black',
      text: 'text-[#5EEAD4]',
    },
    landingUrl: '/Ritual',
    status: 'coming-soon',
  },
];

const META_TITLE = 'The Pulse Apps — Pulse Intelligence Labs';
const META_DESCRIPTION =
  'The Pulse Intelligence Labs app suite — Fit With Pulse, Macra, PulseCheck, and Pulse Ritual. Performance, nutrition, mindset, and daily ritual, all in one place.';
const META_URL = 'https://pulseintelligencelabs.com/apps';
const META_OG_IMAGE = 'https://pulseintelligencelabs.com/pil-og.png';

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
                  <AppleLogo className="h-4 w-4" />
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
            <div className="mt-6 max-w-2xl space-y-4">
              <RitualEarlyAccessForm source="pil-apps-card" compact />
              {app.landingUrl && (
                <Link
                  href={app.landingUrl}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
                >
                  Open Ritual page
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
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
        <meta property="og:image" content={META_OG_IMAGE} key="og:image" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={META_OG_IMAGE} key="twitter:image" />
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
      image: META_OG_IMAGE,
      url: META_URL,
      type: 'website',
      siteName: 'Pulse Intelligence Labs',
    },
  },
});

export default AppsPage;
