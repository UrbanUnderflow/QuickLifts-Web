import type { GetStaticProps, NextPage } from 'next';
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, Activity, Apple as AppleIcon, Brain, Droplet } from 'lucide-react';

const META_TITLE = 'Pulse Intelligence Labs — The Human Performance Company';
const META_DESCRIPTION =
  'Pulse Intelligence Labs is an AI lab building the human performance stack — training, nutrition, mindset, and daily ritual — for athletes, coaches, and the people behind them.';
const META_URL = 'https://pulseintelligencelabs.com';

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
  { name: 'Fit With Pulse', icon: '/pulseIcon.png', dot: 'bg-[#E0FE10]' },
  { name: 'Macra', icon: '/macra-icon.png', dot: 'bg-[#3B82F6]' },
  { name: 'Pulse Check', icon: '/pulseCheckIcon.png', dot: 'bg-[#A05EF8]' },
  { name: 'Pulse Ritual', icon: '', dot: 'bg-[#5EEAD4]' },
];

const PILLogoMark: React.FC = () => (
  <div className="flex items-center gap-2.5">
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className="absolute inset-0 rounded-full bg-white animate-ping opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
    </span>
    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">
      Pulse Intelligence Labs
    </span>
  </div>
);

const PILPage: NextPage = () => {
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
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[860px]">
          <div className="absolute left-1/2 top-[-220px] h-[820px] w-[1280px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#E0FE10]/12 via-[#A05EF8]/14 to-[#5EEAD4]/12 blur-[120px]" />
          <div className="absolute left-1/2 top-[-120px] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#3B82F6]/10 via-transparent to-[#A05EF8]/12 blur-[100px]" />
        </div>

        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-7">
          <PILLogoMark />
          <div className="hidden items-center gap-7 text-sm text-zinc-400 sm:flex">
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

        <section className="relative mx-auto max-w-6xl px-6 pt-24 pb-32 sm:pt-36 sm:pb-44">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur-sm mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E0FE10]" />
              An AI lab for human performance
            </span>
            <h1 className="text-[clamp(2.75rem,7.5vw,5.75rem)] font-semibold tracking-tight leading-[0.98]">
              The Human{' '}
              <span className="bg-gradient-to-r from-[#E0FE10] via-[#A05EF8] to-[#5EEAD4] bg-clip-text text-transparent">
                Performance
              </span>{' '}
              Company.
            </h1>
            <p className="mt-8 max-w-2xl text-lg sm:text-xl text-zinc-300 leading-relaxed">
              We build AI for the people who show up — athletes, coaches, and the staff behind them.
              Four products covering training, nutrition, mindset, and ritual, all under one roof.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/apps"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors"
              >
                Explore the apps
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a
                href="https://fitwithpulse.ai/pulseintelligencelabs"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors backdrop-blur-sm"
              >
                Inside the lab
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mt-24 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4"
          >
            {APP_TILES.map((tile) => (
              <Link
                key={tile.name}
                href="/apps"
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm hover:bg-white/[0.06] transition-colors"
              >
                <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                  {tile.icon ? (
                    <img src={tile.icon} alt={tile.name} className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                      <span className={`h-2.5 w-2.5 rounded-full ${tile.dot}`} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{tile.name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {tile.name === 'Pulse Ritual' ? 'Coming soon' : 'Available'}
                  </p>
                </div>
              </Link>
            ))}
          </motion.div>
        </section>

        <section className="relative border-t border-white/5 bg-black/30">
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
      url: META_URL,
      type: 'website',
      siteName: 'Pulse Intelligence Labs',
    },
  },
});

export default PILPage;
