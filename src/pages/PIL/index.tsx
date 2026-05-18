import type { GetStaticProps, NextPage } from 'next';
import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, Activity, Apple as AppleIcon, Brain, Droplet } from 'lucide-react';

const META_TITLE = 'Pulse Intelligence Labs — The Human Performance Company';
const META_DESCRIPTION =
  'Pulse Intelligence Labs is an AI lab building the human performance stack — training, nutrition, mindset, and daily ritual — for athletes, coaches, and the people behind them.';
const META_URL = 'https://pulseintelligencelabs.com';
const META_OG_IMAGE = 'https://pulseintelligencelabs.com/pil-og.png';

// Hero video lives at /public/pil-hero.mp4. Drop a cinematic sprinter clip
// there (1080p+, 8–20s loopable, ideally h.264 mp4 + webm transcode).
// Optional poster at /public/pil-hero-poster.jpg for the first paint.
const HERO_VIDEO_SRC = '/pil-hero.mp4';
const HERO_VIDEO_POSTER = '/pil-hero-poster.jpg';

type Pillar = {
  id: string;
  label: string;
  title: string;
  body: string;
  accent: string;
  product: string;
  Icon: React.FC<{ className?: string }>;
};

const PILLARS: Pillar[] = [
  {
    id: 'training',
    label: 'Training Intelligence',
    title: 'Routines that adapt to the people running them.',
    body: 'Fit With Pulse turns workouts into living routines — built by you, coached by Nora, and run with the community you train with every day.',
    accent: 'text-[#E0FE10]',
    product: 'Fit With Pulse',
    Icon: Activity,
  },
  {
    id: 'nutrition',
    label: 'Nutrition Intelligence',
    title: 'Every meal turned into a macro plan.',
    body: 'Macra reads any meal, label, or fridge in seconds and builds the day around your exact targets — without the spreadsheet.',
    accent: 'text-[#6A9AFA]',
    product: 'Macra',
    Icon: AppleIcon,
  },
  {
    id: 'mindset',
    label: 'Mindset Intelligence',
    title: 'How you feel, translated into how you perform.',
    body: 'Pulse Check is the two-minute daily check-in for athletes — turning state-of-mind signals into the coaching the people behind them can actually use.',
    accent: 'text-[#A05EF8]',
    product: 'Pulse Check',
    Icon: Brain,
  },
  {
    id: 'ritual',
    label: 'Ritual Intelligence',
    title: 'Three small drops a day.',
    body: 'Pulse Ritual is the daily watering layer — water your body, mind, and spirit, then watch yourself grow. Launching later this year.',
    accent: 'text-[#5EEAD4]',
    product: 'Pulse Ritual',
    Icon: Droplet,
  },
];

const APP_TILES = [
  { name: 'Fit With Pulse', icon: '/fwp-app-icon.jpg', dot: 'bg-[#E0FE10]', status: 'Available' },
  { name: 'Macra', icon: '/macra-icon.png', dot: 'bg-[#3B82F6]', status: 'Available' },
  { name: 'Pulse Check', icon: '/pulseCheckIcon.png', dot: 'bg-[#A05EF8]', status: 'Available' },
  { name: 'Pulse Ritual', icon: '', dot: 'bg-[#5EEAD4]', status: 'Coming soon' },
];

const PILLogoMark: React.FC<{ tone?: 'light' | 'dark' }> = ({ tone = 'light' }) => (
  <div className="flex items-center gap-2.5">
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className={`absolute inset-0 rounded-full ${tone === 'light' ? 'bg-white' : 'bg-black'} animate-ping opacity-60`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${tone === 'light' ? 'bg-white' : 'bg-black'}`} />
    </span>
    <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${tone === 'light' ? 'text-zinc-200' : 'text-zinc-700'}`}>
      Pulse Intelligence Labs
    </span>
  </div>
);

const PILPage: NextPage = () => {
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const [heroVideoIsPlaying, setHeroVideoIsPlaying] = useState(false);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    let isMounted = true;

    const primeVideoForMobileAutoplay = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
    };

    const tryPlay = () => {
      if (!isMounted) return;
      primeVideoForMobileAutoplay();
      const playAttempt = video.play();
      if (playAttempt) {
        playAttempt.catch(() => {
          // iOS can still pause autoplay in Low Power Mode; the next gesture retries it.
        });
      }
    };

    const handlePlaying = () => {
      if (isMounted) {
        setHeroVideoIsPlaying(true);
      }
    };

    primeVideoForMobileAutoplay();
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('loadeddata', tryPlay, { once: true });
    video.addEventListener('canplay', tryPlay, { once: true });
    tryPlay();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && video.paused) {
        tryPlay();
      }
    };

    const handleFirstGesture = () => {
      if (video.paused) {
        tryPlay();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('touchstart', handleFirstGesture, { once: true, passive: true });
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });

    return () => {
      isMounted = false;
      video.removeEventListener('loadeddata', tryPlay);
      video.removeEventListener('canplay', tryPlay);
      video.removeEventListener('playing', handlePlaying);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('pointerdown', handleFirstGesture);
    };
  }, []);

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
        <meta property="og:image:secure_url" content={META_OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={META_OG_IMAGE} key="twitter:image" />
      </Head>

      <main className="relative min-h-screen bg-black text-white selection:bg-white/20">
        {/* ───────────────────── HERO: full-bleed sprinter video ───────────────────── */}
        <section className="relative h-[100svh] min-h-[640px] w-full overflow-hidden sm:h-screen">
          {/* Background video */}
          <video
            ref={heroVideoRef}
            className={`pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-500 ${
              heroVideoIsPlaying ? 'opacity-100' : 'opacity-0'
            }`}
            autoPlay
            muted
            loop
            controls={false}
            playsInline
            preload="auto"
            poster={HERO_VIDEO_POSTER}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            tabIndex={-1}
            onContextMenu={(event) => event.preventDefault()}
            aria-hidden="true"
          >
            <source src={HERO_VIDEO_SRC} type="video/mp4" />
          </video>

          {/* Dark cinematic overlay — bottom-heavy for text legibility */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/65 via-black/30 to-black/90" />
          {/* Brand color wash — barely there, gives the video the PIL signature */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#E0FE10]/[0.06] via-transparent to-[#A05EF8]/[0.08] mix-blend-overlay" />
          {/* Vignette on edges */}
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.55)_100%)]" />

          {/* Nav over the video */}
          <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 pt-7">
            <PILLogoMark tone="light" />
            <div className="hidden items-center gap-7 text-sm text-zinc-300 sm:flex">
              <Link href="/apps" className="hover:text-white transition-colors">Apps</Link>
              <a href="https://fitwithpulse.ai/pulseintelligencelabs" className="hover:text-white transition-colors">Lab</a>
              <a href="mailto:hello@pulseintelligencelabs.com" className="hover:text-white transition-colors">Contact</a>
            </div>
            <Link
              href="/apps"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
            >
              Download apps
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </nav>

          {/* Hero content — bottom-aligned, big and confident */}
          <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-end px-6 pb-20 sm:pb-28">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-medium text-white backdrop-blur-md mb-6 sm:mb-8">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E0FE10] animate-pulse" />
                An AI lab for human performance
              </span>
              <h1 className="text-[clamp(3rem,9vw,7.5rem)] font-semibold tracking-tight leading-[0.92] max-w-5xl">
                The Human{' '}
                <span className="bg-gradient-to-r from-[#E0FE10] via-[#A05EF8] to-[#5EEAD4] bg-clip-text text-transparent">
                  Performance
                </span>{' '}
                Company.
              </h1>
              <p className="mt-7 max-w-2xl text-lg sm:text-2xl text-zinc-200 leading-relaxed drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
                We build AI for the people who show up — athletes, coaches, and the staff behind them.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/apps"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors shadow-2xl shadow-black/40"
                >
                  Explore the apps
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <a
                  href="https://fitwithpulse.ai/pulseintelligencelabs"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-md"
                >
                  Inside the lab
                </a>
              </div>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 sm:block"
          >
            <div className="flex h-10 w-6 items-start justify-center rounded-full border border-white/30 p-1.5">
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="h-1.5 w-1 rounded-full bg-white/70"
              />
            </div>
          </motion.div>
        </section>

        {/* ───────────────────── APP TILES ───────────────────── */}
        <section className="relative border-t border-white/5 bg-black">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-3">
                  The Apps
                </p>
                <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight leading-tight">
                  Four products. One stack.
                </h2>
              </div>
              <Link
                href="/apps"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
              >
                See all apps
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {APP_TILES.map((tile) => (
                <Link
                  key={tile.name}
                  href="/apps"
                  className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm hover:bg-white/[0.06] transition-colors"
                >
                  <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                    {tile.icon ? (
                      <img src={tile.icon} alt={tile.name} className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                        <span className={`h-2.5 w-2.5 rounded-full ${tile.dot}`} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{tile.name}</p>
                    <p className="truncate text-xs text-zinc-500">{tile.status}</p>
                  </div>
                </Link>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ───────────────────── THE STACK — four pillars ───────────────────── */}
        <section className="relative border-t border-white/5 bg-black/40">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mb-16 sm:mb-20"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-4">
                The Stack
              </p>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05] max-w-3xl">
                Four layers of intelligence for one human performance stack.
              </h2>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-2">
              {PILLARS.map((pillar, index) => (
                <motion.div
                  key={pillar.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.6, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm hover:bg-white/[0.05] transition-colors"
                >
                  <pillar.Icon className={`h-7 w-7 ${pillar.accent} mb-6`} />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-3">
                    {pillar.label}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-semibold text-white leading-snug mb-4">
                    {pillar.title}
                  </h3>
                  <p className="text-sm sm:text-base text-zinc-400 leading-relaxed mb-6">
                    {pillar.body}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`font-medium ${pillar.accent}`}>{pillar.product}</span>
                    <Link
                      href="/apps"
                      className="ml-auto inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                    >
                      Get the app
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────────────────── MISSION QUOTE ───────────────────── */}
        <section className="relative border-t border-white/5">
          <div className="mx-auto max-w-4xl px-6 py-28 sm:py-36 text-center">
            <motion.blockquote
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.15] text-white"
            >
              We are not in the wellness business.
              <br />
              <span className="text-zinc-400">
                We are in the business of helping humans perform.
              </span>
            </motion.blockquote>
          </div>
        </section>

        {/* ───────────────────── CTA ───────────────────── */}
        <section className="relative border-t border-white/5 bg-gradient-to-b from-zinc-950 to-black">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
            <div className="grid items-end gap-10 md:grid-cols-[1.4fr,1fr]">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05] mb-6">
                  Build with us, or just{' '}
                  <span className="bg-gradient-to-r from-[#E0FE10] to-[#5EEAD4] bg-clip-text text-transparent">
                    train with us.
                  </span>
                </h2>
                <p className="max-w-xl text-base sm:text-lg text-zinc-400 leading-relaxed">
                  Athletes, coaches, partners, investors — there's a door for you. Start with the apps,
                  or reach out directly.
                </p>
              </motion.div>

              <div className="flex flex-col gap-3 md:items-end">
                <Link
                  href="/apps"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors w-full md:w-auto"
                >
                  Get the apps
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <a
                  href="mailto:hello@pulseintelligencelabs.com"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors w-full md:w-auto"
                >
                  hello@pulseintelligencelabs.com
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────────────── FOOTER ───────────────────── */}
        <footer className="relative border-t border-white/5">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              <span className="font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Pulse Intelligence Labs
              </span>
              <span className="text-zinc-600">© {new Date().getFullYear()}</span>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/apps" className="hover:text-white transition-colors">Apps</Link>
              <a href="https://fitwithpulse.ai/pulseintelligencelabs" className="hover:text-white transition-colors">Lab</a>
              <a href="https://fitwithpulse.ai" className="hover:text-white transition-colors">Fit With Pulse</a>
              <a href="https://eatwithmacra.ai" className="hover:text-white transition-colors">Macra</a>
              <a href="https://pulsecheckmind.ai" className="hover:text-white transition-colors">Pulse Check</a>
            </div>
          </div>
        </footer>
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

export default PILPage;
