import React, { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Briefcase,
  Building2,
  ChevronLeft,
  Compass,
  DollarSign,
  Globe,
  HeartPulse,
  Mail,
  Phone,
  Rocket,
  Shield,
  Sparkles,
  Target,
  Users,
  Waves,
  Zap,
} from 'lucide-react';

const TOTAL_STEPS = 11;

const STEP_META: Record<number, { section: string; label: string }> = {
  0: { section: 'Intro', label: 'Pulse Intelligence Labs' },
  1: { section: 'Company', label: 'Two Products, One Company' },
  2: { section: 'Product', label: 'Fit With Pulse' },
  3: { section: 'Product', label: 'Pulse Check' },
  4: { section: 'Platform', label: 'Why They Fit Together' },
  5: { section: 'Proof', label: 'Partners' },
  6: { section: 'Proof', label: 'Brands We Have Worked With' },
  7: { section: 'Founder', label: 'Founder Story' },
  8: { section: 'Team', label: 'Who Is Building This' },
  9: { section: 'Scale', label: 'Path to $100M' },
  10: { section: 'Raise', label: 'The Ask' },
  11: { section: 'Close', label: 'Let’s Build' },
};

const linkedIn = {
  tremaine: 'https://linkedin.com/in/tremainegrant',
  marques: 'https://www.linkedin.com/in/marqueszak/',
  valerie: 'https://linkedin.com/in/speakhappiness-keynotespeaker',
  deray: 'https://www.linkedin.com/in/deray-mckesson-14523113',
  bobby: 'https://www.linkedin.com/search/results/all/?keywords=Bobby%20Nweke',
  lola: 'https://www.linkedin.com/search/results/all/?keywords=Lola%20Oluwaladun',
  erik: 'https://www.linkedin.com/search/results/all/?keywords=Erik%20Edwards%20Cooley',
} as const;

const PARTNER_CHIPS = [
  { name: 'LAUNCH', sublabel: 'Backed by Jason Calacanis' },
  { name: 'Cooley', sublabel: 'Legal partner' },
  { name: 'AuntEdna', sublabel: 'Clinical intelligence adjacency' },
  { name: 'AWS Startups', sublabel: 'Infra + startup support' },
  { name: 'Techstars', sublabel: 'Founder ecosystem' },
];

const BRAND_TILES = [
  { name: 'SoulCycle', type: 'image', src: '/soulcycle.png' as const, note: 'Community and brand activation experience' },
  { name: 'Rumbl', type: 'text', note: 'Fitness brand collaboration and market validation' },
];

const FOUNDER_STORY = [
  {
    title: 'Athlete-first lens',
    body: 'Former D1 Track and Field athlete at Florida State and longtime trainer. The company starts with lived experience in performance, consistency, and community.',
    icon: Target,
  },
  {
    title: 'Clinical research rigor',
    body: 'Years in clinical research through IQVIA and Clinical Inc working alongside organizations including Pfizer, Eli Lilly, Medpace, and Dexcom.',
    icon: Shield,
  },
  {
    title: 'AI product builder',
    body: 'More than 20 years of software engineering brought into fitness, recovery, and cognitive performance systems that can scale beyond a single coach or clinic.',
    icon: Brain,
  },
];

const PRODUCT_COLUMNS = [
  {
    title: 'Fit With Pulse',
    eyebrow: 'Community operating system',
    blurb: 'Turns fitness communities into living products with structured runs, challenges, check-ins, accountability loops, and partner-led growth.',
    bullets: ['Creators, clubs, studios, and brands', 'Challenge seasons, rituals, and retention', 'Designed for belonging, progress, and repeat participation'],
    accent: '#E0FE10',
    icon: Users,
  },
  {
    title: 'Pulse Check',
    eyebrow: 'Intelligence layer',
    blurb: 'Tracks how people are doing, spots patterns early, and gives teams a way to support performance, wellbeing, and intervention before things break down.',
    bullets: ['Daily check-ins and readiness signals', 'Pattern detection and operating insights', 'Care, coach, and team workflows'],
    accent: '#38BDF8',
    icon: Brain,
  },
];

const REVENUE_MILESTONES = [
  { revenue: '$1M', detail: '250 operators', height: '15%' },
  { revenue: '$10M', detail: '2,500 operators', height: '35%' },
  { revenue: '$50M', detail: '12,500 operators', height: '62%' },
  { revenue: '$100M', detail: '25,000 operators', height: '100%' },
];

const transition = { duration: 0.45, ease: 'easeOut' } as const;

const PulseMark: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 75 75" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M37.085 0C57.5663 0 74.1699 16.6036 74.1699 37.085C74.1699 57.5664 57.5664 74.1699 37.085 74.1699C16.6037 74.1697 0 57.5662 0 37.085C0 16.6037 16.6038 0.000187122 37.085 0ZM33.3516 21.6367C32.3704 21.6369 31.5045 22.2571 31.1816 23.1689L31.125 23.3555L28.1982 34.5283H22.0967C20.8254 34.5285 19.795 35.5588 19.7949 36.8301C19.7951 38.1012 20.8255 39.1317 22.0967 39.1318H29.9756C31.0221 39.1317 31.9368 38.4254 32.2021 37.4131L33.3516 33.0234L37.8779 50.3047C38.1432 51.317 39.058 52.0243 40.1045 52.0244C41.1511 52.0244 42.0657 51.3171 42.3311 50.3047L45.2578 39.1318H52.4844C53.7556 39.1318 54.7859 38.1013 54.7861 36.8301C54.7861 35.5588 53.7557 34.5284 52.4844 34.5283H43.4805C42.4995 34.5286 41.6344 35.149 41.3115 36.0605L41.2539 36.2471L40.1045 40.6357L35.5791 23.3555C35.3139 22.3428 34.3983 21.6367 33.3516 21.6367Z" fill="#E0FE10" />
  </svg>
);

const SceneFrame: React.FC<{
  children: React.ReactNode;
  className?: string;
  accent?: string;
}> = ({ children, className = '', accent = '#E0FE10' }) => (
  <div className={`relative h-full overflow-hidden bg-[#08090c] ${className}`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(224,254,16,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_30%),linear-gradient(135deg,#06070a_0%,#0b0d12_55%,#090b10_100%)]" />
    <div className="absolute -left-24 top-20 h-72 w-72 rounded-full blur-3xl" style={{ background: `${accent}16` }} />
    <div className="absolute right-0 top-0 h-full w-full opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
    <div className="absolute inset-0 opacity-[0.02] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
    <div className="relative z-10 flex h-full items-center justify-center px-6 py-12 md:px-10">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </div>
  </div>
);

const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
}> = ({ children, className = '', accentColor = '#E0FE10' }) => (
  <div className={`relative ${className}`}>
    <div
      className="absolute -inset-[1px] rounded-[28px] blur-xl opacity-40"
      style={{ background: `linear-gradient(135deg, ${accentColor}40, transparent 60%)` }}
    />
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900/45 backdrop-blur-xl">
      <div
        className="absolute left-0 right-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
      {children}
    </div>
  </div>
);

const SlideKicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-300">
    <Sparkles className="h-3.5 w-3.5 text-[#E0FE10]" />
    <span>{children}</span>
  </div>
);

const SceneCover = () => (
  <SceneFrame accent="#E0FE10">
    <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E0FE10]/30 bg-[#E0FE10]/10">
            <PulseMark className="h-9 w-9" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-zinc-400">Pulse Intelligence Labs</p>
            <p className="text-sm text-zinc-500">Company presentation deck</p>
          </div>
        </div>
        <h1 className="max-w-4xl text-5xl font-black leading-[0.95] text-white md:text-7xl">
          We build the systems that help people <span className="text-[#E0FE10]">move</span>, <span className="text-[#38BDF8]">recover</span>, and <span className="text-[#F472B6]">stay in rhythm</span>.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-300 md:text-2xl">
          Fit With Pulse creates the shared experience. Pulse Check creates the intelligence layer. Together they make community performance measurable, actionable, and scalable.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <div className="rounded-full border border-[#E0FE10]/30 bg-[#E0FE10]/10 px-4 py-2 text-sm font-semibold text-[#E0FE10]">Fit With Pulse</div>
          <div className="rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-300">Pulse Check</div>
          <div className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-2 text-sm font-semibold text-fuchsia-300">Pulse Intelligence Labs</div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, delay: 0.1 }}
        className="grid gap-4"
      >
        {PRODUCT_COLUMNS.map((product) => {
          const Icon = product.icon;
          return (
            <GlassCard key={product.title} accentColor={product.accent}>
              <div className="p-6 md:p-7">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">{product.eyebrow}</p>
                    <h3 className="mt-2 text-2xl font-bold text-white">{product.title}</h3>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${product.accent}1f` }}>
                    <Icon className="h-6 w-6" style={{ color: product.accent }} />
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-zinc-300">{product.blurb}</p>
              </div>
            </GlassCard>
          );
        })}
      </motion.div>
    </div>
  </SceneFrame>
);

const SceneCompany = () => (
  <SceneFrame accent="#38BDF8">
    <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <SlideKicker>Two Products, One Company</SlideKicker>
      <h2 className="max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
        Pulse Intelligence Labs is building a <span className="text-[#E0FE10]">behavior company</span>, not just an app company.
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-zinc-300 md:text-xl">
        We help organizations create repeatable movement rituals and understand what is happening inside those rituals. One layer drives participation. One layer interprets the human signal.
      </p>
    </motion.div>

    <div className="mt-10 grid gap-5 lg:grid-cols-3">
      <GlassCard className="lg:col-span-1" accentColor="#E0FE10">
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E0FE10]/15">
            <Users className="h-6 w-6 text-[#E0FE10]" />
          </div>
          <h3 className="text-xl font-bold text-white">Community software</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Fit With Pulse helps creators, clubs, studios, and brands run challenges, events, and accountability systems that people want to come back to.
          </p>
        </div>
      </GlassCard>

      <GlassCard className="lg:col-span-1" accentColor="#38BDF8">
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15">
            <HeartPulse className="h-6 w-6 text-sky-300" />
          </div>
          <h3 className="text-xl font-bold text-white">Performance intelligence</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Pulse Check gives teams a structured way to monitor readiness, detect patterns, and support people earlier, with a path into clinical escalation when needed.
          </p>
        </div>
      </GlassCard>

      <GlassCard className="lg:col-span-1" accentColor="#F472B6">
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-400/15">
            <Building2 className="h-6 w-6 text-fuchsia-300" />
          </div>
          <h3 className="text-xl font-bold text-white">One holding story</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Pulse Intelligence Labs is the umbrella narrative for the company, where consumer, partner, and intelligence products all compound rather than compete.
          </p>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const SceneFitWithPulse = () => (
  <SceneFrame accent="#E0FE10">
    <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={transition}>
        <SlideKicker>Fit With Pulse</SlideKicker>
        <h2 className="text-4xl font-black leading-tight text-white md:text-6xl">
          The operating system for <span className="text-[#E0FE10]">fitness communities</span>.
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-300">
          Fit With Pulse turns a creator, studio, run club, or brand from a content surface into a structured season. Members know what to do, who they are doing it with, and whether they are still in motion.
        </p>
        <div className="mt-8 space-y-4">
          {[
            'Challenge blocks, recurring rituals, and shared accountability',
            'Designed for brands, coaches, creators, and community-led operators',
            'Best-in-class for retention because the story continues after the post',
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#E0FE10]" />
              <p className="text-zinc-200">{item}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ ...transition, delay: 0.1 }}>
        <GlassCard accentColor="#E0FE10">
          <div className="p-6 md:p-8">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[#E0FE10]/20 bg-[#E0FE10]/8 p-5">
                <Compass className="mb-4 h-6 w-6 text-[#E0FE10]" />
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-400">Use cases</p>
                <p className="mt-2 text-lg font-bold text-white">Run clubs, programs, seasonal challenges, brand communities</p>
              </div>
              <div className="rounded-2xl border border-sky-400/20 bg-sky-400/8 p-5">
                <Globe className="mb-4 h-6 w-6 text-sky-300" />
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-400">Why it works</p>
                <p className="mt-2 text-lg font-bold text-white">Belonging plus consistency creates stronger repeat usage than pure content.</p>
              </div>
              <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/8 p-5 md:col-span-2">
                <BarChart3 className="mb-4 h-6 w-6 text-fuchsia-300" />
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-400">What partners buy</p>
                <p className="mt-2 text-lg font-bold text-white">A system for growth, activation, accountability, and community measurement in one place.</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  </SceneFrame>
);

const ScenePulseCheck = () => (
  <SceneFrame accent="#38BDF8">
    <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={transition}>
        <GlassCard accentColor="#38BDF8">
          <div className="p-6 md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/15">
                <Brain className="h-6 w-6 text-sky-300" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Pulse Check</p>
                <p className="text-xl font-bold text-white">Performance, readiness, and care intelligence</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { title: 'Daily signal capture', body: 'Structured check-ins turn vague wellbeing into a trackable operating surface for teams.' },
                { title: 'Pattern recognition', body: 'The system detects when someone is deviating from baseline before the human layer would normally notice.' },
                { title: 'Escalation pathways', body: 'Pulse Check can support coaching workflows and connect into clinical escalation paths such as AuntEdna when risk moves beyond performance support.' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-bold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-300">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ ...transition, delay: 0.08 }}>
        <SlideKicker>Pulse Check</SlideKicker>
        <h2 className="text-4xl font-black leading-tight text-white md:text-6xl">
          Intelligence for when the surface story is not enough.
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-300">
          Pulse Check sits closer to the athlete, patient, or member’s state. It helps coaches, teams, and care-forward organizations understand readiness, stress, and warning signals in a way that is structured enough to act on.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { label: 'Coaches', value: 'See pattern shifts early' },
            { label: 'Teams', value: 'Run support with consistency' },
            { label: 'Care orgs', value: 'Bridge into escalation pathways' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
              <p className="mt-2 text-lg font-bold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  </SceneFrame>
);

const SceneFlywheel = () => (
  <SceneFrame accent="#F472B6">
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <SlideKicker>Why They Fit Together</SlideKicker>
      <h2 className="max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
        Fit With Pulse drives <span className="text-[#E0FE10]">participation</span>. Pulse Check drives <span className="text-[#38BDF8]">understanding</span>.
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-zinc-300">
        One product makes the ritual real. The other makes the human signal legible. This is the company story: behavior plus intelligence.
      </p>
    </motion.div>

    <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
      <GlassCard accentColor="#E0FE10">
        <div className="p-6">
          <Users className="mb-4 h-7 w-7 text-[#E0FE10]" />
          <h3 className="text-2xl font-bold text-white">Fit With Pulse</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Captures engagement, rituals, streaks, social accountability, and community momentum.
          </p>
        </div>
      </GlassCard>

      <div className="hidden items-center justify-center lg:flex">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <ArrowRight className="h-8 w-8 text-zinc-300" />
        </div>
      </div>

      <GlassCard accentColor="#38BDF8">
        <div className="p-6">
          <Brain className="mb-4 h-7 w-7 text-sky-300" />
          <h3 className="text-2xl font-bold text-white">Pulse Check</h3>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Interprets readiness, pattern drift, psychological state, and support needs behind the participation data.
          </p>
        </div>
      </GlassCard>
    </div>

    <div className="mt-6">
      <GlassCard accentColor="#F472B6">
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Shared graph</p>
            <p className="mt-2 text-xl font-bold text-white">People, rituals, signals</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Business value</p>
            <p className="mt-2 text-xl font-bold text-white">Retention, care, insight, and defensibility</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Company story</p>
            <p className="mt-2 text-xl font-bold text-white">Pulse Intelligence Labs holds the whole stack together</p>
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const ScenePartners = () => (
  <SceneFrame accent="#E0FE10">
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <SlideKicker>Partners</SlideKicker>
      <h2 className="max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
        Credibility around the company already exists across the <span className="text-[#E0FE10]">startup</span>, <span className="text-[#38BDF8]">legal</span>, and <span className="text-[#F472B6]">clinical</span> ecosystem.
      </h2>
    </motion.div>

    <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <GlassCard accentColor="#E0FE10">
        <div className="p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">Ecosystem partners</p>
          <div className="mt-6 flex flex-wrap items-center gap-6 md:gap-10">
            <img src="/Launch.png" alt="Launch" className="h-10 w-auto object-contain opacity-90" />
            <img src="/cooley-logo.png" alt="Cooley" className="h-10 w-auto object-contain opacity-90" />
            <img src="/awsstartups.png" alt="AWS Startups" className="h-10 w-auto object-contain opacity-90" />
            <img src="/techstars.png" alt="Techstars" className="h-10 w-auto object-contain opacity-90" />
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-zinc-300">
            LAUNCH and Jason Calacanis signal founder-market backing. Cooley supports company formation and legal readiness. AuntEdna expands the clinical adjacency story around Pulse Check and escalation infrastructure.
          </p>
        </div>
      </GlassCard>

      <div className="grid gap-4">
        {PARTNER_CHIPS.map((partner, index) => (
          <GlassCard key={partner.name} accentColor={index % 2 === 0 ? '#E0FE10' : '#38BDF8'}>
            <div className="p-5">
              <p className="text-xl font-bold text-white">{partner.name}</p>
              <p className="mt-1 text-sm text-zinc-400">{partner.sublabel}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  </SceneFrame>
);

const SceneBrands = () => (
  <SceneFrame accent="#38BDF8">
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <SlideKicker>Brands We Have Worked With</SlideKicker>
      <h2 className="max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
        We already know how to build with brands that carry <span className="text-[#E0FE10]">energy</span>, <span className="text-[#38BDF8]">community</span>, and <span className="text-[#F472B6]">taste</span>.
      </h2>
    </motion.div>

    <div className="mt-10 grid gap-5 md:grid-cols-2">
      {BRAND_TILES.map((brand, index) => (
        <GlassCard key={brand.name} accentColor={index === 0 ? '#E0FE10' : '#F472B6'}>
          <div className="flex h-full flex-col justify-between p-6 md:p-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Brand proof</p>
              <div className="mt-6 flex h-24 items-center justify-center rounded-3xl border border-white/10 bg-black/20">
                {brand.type === 'image' ? (
                  <img src={brand.src} alt={brand.name} className="max-h-12 w-auto object-contain" />
                ) : (
                  <span className="text-4xl font-black uppercase tracking-[0.3em] text-white">{brand.name}</span>
                )}
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-2xl font-bold text-white">{brand.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{brand.note}</p>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  </SceneFrame>
);

const SceneFounderStory = () => (
  <SceneFrame accent="#F472B6">
    <div className="grid items-center gap-8 lg:grid-cols-[0.85fr_1.15fr]">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={transition}>
        <GlassCard accentColor="#F472B6">
          <div className="p-6 md:p-8">
            <div className="mx-auto max-w-sm">
              <div className="overflow-hidden rounded-[28px] border border-white/10">
                <img src="/TremaineFounder.jpg" alt="Tremaine Grant" className="h-[420px] w-full object-cover" />
              </div>
              <div className="mt-5 text-center">
                <h3 className="text-2xl font-bold text-white">Tremaine Grant</h3>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#F472B6]">Founder & CEO</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ ...transition, delay: 0.08 }}>
        <SlideKicker>Founder Story</SlideKicker>
        <h2 className="max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
          The founder story sits at the intersection of <span className="text-[#E0FE10]">performance</span>, <span className="text-[#38BDF8]">evidence</span>, and <span className="text-[#F472B6]">software</span>.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-zinc-300">
          Tremaine Grant is the Founder and CEO of Pulse Intelligence Labs, where he builds AI systems at the intersection of human performance, fitness, and cognitive science. The through-line is simple: bring scientific rigor and systems thinking into products people can actually use in the real world.
        </p>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {FOUNDER_STORY.map((item, index) => {
            const Icon = item.icon;
            const accent = index === 0 ? '#E0FE10' : index === 1 ? '#38BDF8' : '#F472B6';
            return (
              <GlassCard key={item.title} accentColor={accent}>
                <div className="p-5">
                  <Icon className="mb-4 h-6 w-6" style={{ color: accent }} />
                  <h3 className="text-lg font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.body}</p>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </motion.div>
    </div>
  </SceneFrame>
);

const SceneTeam = () => (
  <SceneFrame accent="#E0FE10">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <div className="mb-10 text-center">
        <SlideKicker>Strong Team</SlideKicker>
        <h2 className="text-4xl font-black text-white md:text-6xl">
          Who&apos;s building <span className="text-[#E0FE10] italic">Pulse</span>?
        </h2>
      </div>

      <div>
        <div className="mb-8 flex flex-wrap justify-center gap-10 md:gap-16">
          <a href={linkedIn.tremaine} target="_blank" rel="noopener noreferrer" className="w-36 text-center group md:w-44">
            <div className="relative mb-3">
              <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-3 border-[#E0FE10] ring-4 ring-[#E0FE10]/20 ring-offset-2 ring-offset-black md:h-28 md:w-28">
                <img src="/TremaineFounder.jpg" alt="Tremaine Grant" className="h-full w-full object-cover" />
              </div>
            </div>
            <h4 className="text-base font-bold text-white transition-colors group-hover:text-[#E0FE10] md:text-lg">Tremaine Grant</h4>
            <p className="mb-2 text-sm font-medium text-[#E0FE10]">CEO &amp; Founder</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <span className="rounded bg-blue-600/30 px-2 py-0.5 text-[10px] font-semibold text-blue-300">D1 Athlete</span>
              <span className="rounded bg-emerald-600/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Biotech</span>
              <span className="rounded bg-orange-600/30 px-2 py-0.5 text-[10px] font-semibold text-orange-300">Engineer</span>
            </div>
          </a>

          <a href={linkedIn.bobby} target="_blank" rel="noopener noreferrer" className="w-36 text-center group md:w-44">
            <div className="relative mb-3">
              <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-3 border-[#E0FE10] ring-4 ring-[#E0FE10]/20 ring-offset-2 ring-offset-black md:h-28 md:w-28">
                <img src="/bobbyAdvisor.jpg" alt="Bobby Nweke" className="h-full w-full object-cover" />
              </div>
            </div>
            <h4 className="text-base font-bold text-white transition-colors group-hover:text-[#E0FE10] md:text-lg">Bobby Nweke</h4>
            <p className="mb-2 text-sm font-medium text-[#E0FE10]">Chief of Staff</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <span className="rounded bg-red-600/30 px-2 py-0.5 text-[10px] font-bold text-red-300">TED</span>
              <span className="rounded bg-[#A51C30]/30 px-2 py-0.5 text-[10px] font-semibold text-red-200">Harvard</span>
              <span className="rounded bg-red-700/30 px-2 py-0.5 text-[10px] font-semibold text-red-200">TFA</span>
            </div>
          </a>

          <a href={linkedIn.lola} target="_blank" rel="noopener noreferrer" className="w-36 text-center group md:w-44">
            <div className="relative mb-3">
              <div className="mx-auto h-24 w-24 overflow-hidden rounded-full border-3 border-[#E0FE10] ring-4 ring-[#E0FE10]/20 ring-offset-2 ring-offset-black md:h-28 md:w-28">
                <img src="/lola.jpg" alt="Lola Oluwaladun" className="h-full w-full object-cover" />
              </div>
            </div>
            <h4 className="text-base font-bold text-white transition-colors group-hover:text-[#E0FE10] md:text-lg">Lola Oluwaladun</h4>
            <p className="mb-2 text-sm font-medium text-[#E0FE10]">Design Lead</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <span className="rounded bg-purple-600/30 px-2 py-0.5 text-[10px] font-semibold text-purple-300">Figma</span>
              <span className="rounded bg-pink-600/30 px-2 py-0.5 text-[10px] font-semibold text-pink-300">UX/UI</span>
              <span className="rounded bg-fuchsia-600/30 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-300">Branding</span>
            </div>
          </a>
        </div>

        <div className="my-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
          <span className="text-sm font-medium uppercase tracking-wider text-zinc-400">Advisors</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-600 to-transparent" />
        </div>

        <div className="flex flex-wrap justify-center gap-6 md:gap-12">
          <a href={linkedIn.marques} target="_blank" rel="noopener noreferrer" className="w-24 text-center group md:w-28">
            <div className="mx-auto mb-2 h-16 w-16 overflow-hidden rounded-full border-2 border-zinc-600 md:h-20 md:w-20">
              <img src="/zak.jpg" alt="Marques Zak" className="h-full w-full object-cover" />
            </div>
            <h4 className="text-sm font-semibold text-white transition-colors group-hover:text-[#E0FE10]">Marques Zak</h4>
            <p className="text-xs text-zinc-400">CMO @ ACC</p>
          </a>

          <a href={linkedIn.valerie} target="_blank" rel="noopener noreferrer" className="w-24 text-center group md:w-28">
            <div className="mx-auto mb-2 h-16 w-16 overflow-hidden rounded-full border-2 border-zinc-600 md:h-20 md:w-20">
              <img src="/Val.jpg" alt="Valerie Alexander" className="h-full w-full object-cover" />
            </div>
            <h4 className="text-sm font-semibold text-white transition-colors group-hover:text-[#E0FE10]">Valerie Alexander</h4>
            <p className="text-xs text-zinc-400">Fortune 500 Consultant</p>
          </a>

          <a href={linkedIn.deray} target="_blank" rel="noopener noreferrer" className="w-24 text-center group md:w-28">
            <div className="mx-auto mb-2 h-16 w-16 overflow-hidden rounded-full border-2 border-zinc-600 md:h-20 md:w-20">
              <img src="/Deray.png" alt="DeRay Mckesson" className="h-full w-full object-cover" />
            </div>
            <h4 className="text-sm font-semibold text-white transition-colors group-hover:text-[#E0FE10]">DeRay Mckesson</h4>
            <p className="text-xs text-zinc-400">Campaign Zero</p>
          </a>

          <a href={linkedIn.erik} target="_blank" rel="noopener noreferrer" className="w-24 text-center group md:w-28">
            <div className="mx-auto mb-2 h-16 w-16 overflow-hidden rounded-full border-2 border-zinc-600 md:h-20 md:w-20">
              <img src="/ErikEdwards.png" alt="Erik Edwards" className="h-full w-full object-cover" />
            </div>
            <h4 className="text-sm font-semibold text-white transition-colors group-hover:text-[#E0FE10]">Erik Edwards</h4>
            <p className="text-xs text-zinc-400">Partner @ Cooley</p>
          </a>
        </div>
      </div>
    </motion.div>
  </SceneFrame>
);

const ScenePathTo100M = () => (
  <SceneFrame accent="#E0FE10">
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <SlideKicker>Path to $100M</SlideKicker>
      <h2 className="text-4xl font-black text-white md:text-6xl">
        25,000 active operators = <span className="text-[#E0FE10]">$100M</span> ARR.
      </h2>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-zinc-300">
        Our path is not one giant category bet. It is a layered business across creators, communities, teams, and intelligence-driven organizations that all need repeat behavior systems.
      </p>
    </motion.div>

    <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <GlassCard accentColor="#E0FE10">
        <div className="p-6 md:p-8">
          <div className="mb-8 flex h-64 items-end justify-between gap-4">
            {REVENUE_MILESTONES.map((milestone, index) => (
              <div key={milestone.revenue} className="flex flex-1 flex-col items-center">
                <div
                  className={`w-full rounded-t-xl ${index === REVENUE_MILESTONES.length - 1 ? 'bg-[#E0FE10]' : 'bg-[#E0FE10]/20'}`}
                  style={{ height: milestone.height }}
                />
                <div className={`mt-4 w-full rounded-xl border p-3 text-center ${index === REVENUE_MILESTONES.length - 1 ? 'border-[#E0FE10] bg-[#E0FE10]/10' : 'border-zinc-800 bg-zinc-950/80'}`}>
                  <p className="font-bold text-[#E0FE10]">{milestone.revenue}</p>
                  <p className="text-xs text-zinc-400">{milestone.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4">
        <GlassCard accentColor="#38BDF8">
          <div className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Revenue mix</p>
            <p className="mt-2 text-xl font-bold text-white">Fit With Pulse subscriptions, partner platform revenue, and Pulse Check intelligence contracts.</p>
          </div>
        </GlassCard>
        <GlassCard accentColor="#F472B6">
          <div className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Go-to-market</p>
            <p className="mt-2 text-xl font-bold text-white">Start with communities that already have energy and give them better infrastructure.</p>
          </div>
        </GlassCard>
        <GlassCard accentColor="#E0FE10">
          <div className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Why now</p>
            <p className="mt-2 text-xl font-bold text-white">AI lowers the cost of interpretation while community-led distribution lowers the cost of acquisition.</p>
          </div>
        </GlassCard>
      </div>
    </div>
  </SceneFrame>
);

const SceneRaise = () => (
  <SceneFrame accent="#38BDF8">
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <SlideKicker>The Raise</SlideKicker>
      <h2 className="text-4xl font-black text-white md:text-6xl">
        Raising <span className="text-[#E0FE10]">$1M</span> to scale both the community layer and the intelligence layer.
      </h2>
    </motion.div>

    <div className="mt-10 grid gap-5 md:grid-cols-2">
      <GlassCard accentColor="#38BDF8">
        <div className="p-6 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Use of funds</p>
          <div className="mt-6 space-y-4">
            {[
              { icon: Briefcase, title: 'Product and engineering', body: 'Ship both Fit With Pulse and Pulse Check with speed and quality.' },
              { icon: Brain, title: 'Intelligence infrastructure', body: 'Harden signal capture, patterning systems, and care-forward workflows.' },
              { icon: Users, title: 'Go-to-market and partner success', body: 'Turn early pilots and community wins into a repeatable distribution engine.' },
              { icon: Rocket, title: 'Brand and market expansion', body: 'Double down on the partnerships and categories that already show pull.' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-400/15">
                    <Icon className="h-5 w-5 text-sky-300" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{item.title}</p>
                    <p className="mt-1 text-sm text-zinc-300">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>

      <GlassCard accentColor="#E0FE10">
        <div className="flex h-full flex-col items-center justify-center p-6 text-center md:p-8">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#E0FE10]/12">
            <DollarSign className="h-10 w-10 text-[#E0FE10]" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Outcome</p>
          <p className="mt-3 text-6xl font-black text-[#E0FE10]">25K</p>
          <p className="mt-2 text-2xl font-bold text-white">operators on the platform</p>
          <div className="mt-6 rounded-2xl border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-5 py-4">
            <p className="text-sm text-zinc-200">
              Enough distribution and product surface area to make the path to <span className="font-bold text-[#E0FE10]">$100M ARR</span> real.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const SceneClose = () => (
  <SceneFrame accent="#E0FE10">
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={transition} className="mx-auto max-w-4xl text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-[#E0FE10]/30 bg-[#E0FE10]/10">
          <PulseMark className="h-12 w-12" />
        </div>
      </div>
      <SlideKicker>Let’s Build</SlideKicker>
      <h2 className="text-4xl font-black leading-tight text-white md:text-6xl">
        Pulse Intelligence Labs is building the company behind how communities <span className="text-[#E0FE10]">move</span> and how teams <span className="text-[#38BDF8]">understand</span> what that movement means.
      </h2>
      <p className="mt-6 text-lg leading-relaxed text-zinc-300 md:text-xl">
        Fit With Pulse gives people a place to show up together. Pulse Check gives organizations a way to respond with intelligence. We think that combination becomes foundational.
      </p>

      <GlassCard className="mx-auto mt-10 max-w-xl" accentColor="#E0FE10">
        <div className="p-6 md:p-8">
          <h3 className="text-2xl font-bold text-white">Tremaine Grant</h3>
          <p className="mt-1 text-sm uppercase tracking-[0.24em] text-zinc-500">Founder & CEO</p>
          <div className="mt-6 space-y-4 text-left">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-[#E0FE10]" />
              <a href="mailto:tre@fitwithpulse.ai" className="text-zinc-200 transition-colors hover:text-[#E0FE10]">tre@fitwithpulse.ai</a>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-[#E0FE10]" />
              <a href="tel:+19545484221" className="text-zinc-200 transition-colors hover:text-[#E0FE10]">(954) 548-4221</a>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-[#E0FE10]" />
              <a href="https://fitwithpulse.ai" target="_blank" rel="noopener noreferrer" className="text-zinc-200 transition-colors hover:text-[#E0FE10]">fitwithpulse.ai</a>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  </SceneFrame>
);

const PulseIntelligenceLabsDeck: React.FC = () => {
  const [step, setStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const advance = useCallback(() => {
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }, []);

  const goBack = useCallback(() => {
    setStep((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
      const backKeys = ['ArrowLeft', 'ArrowUp', 'PageUp'];
      if (nextKeys.includes(e.key)) {
        e.preventDefault();
        advance();
      }
      if (backKeys.includes(e.key)) {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [advance, goBack]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const meta = STEP_META[step] || STEP_META[0];

  const renderScene = () => {
    switch (step) {
      case 0:
        return <SceneCover />;
      case 1:
        return <SceneCompany />;
      case 2:
        return <SceneFitWithPulse />;
      case 3:
        return <ScenePulseCheck />;
      case 4:
        return <SceneFlywheel />;
      case 5:
        return <ScenePartners />;
      case 6:
        return <SceneBrands />;
      case 7:
        return <SceneFounderStory />;
      case 8:
        return <SceneTeam />;
      case 9:
        return <ScenePathTo100M />;
      case 10:
        return <SceneRaise />;
      case 11:
        return <SceneClose />;
      default:
        return <SceneCover />;
    }
  };

  return (
    <>
      <Head>
        <title>Pulse Intelligence Labs — Deck</title>
        <meta
          name="description"
          content="Interactive company presentation for Pulse Intelligence Labs, covering Fit With Pulse, Pulse Check, partners, team, founder story, and the path to $100M."
        />
      </Head>

      <div
        ref={containerRef}
        tabIndex={0}
        onClick={advance}
        className="fixed inset-0 flex cursor-pointer select-none flex-col overflow-hidden bg-[#07080b] outline-none"
      >
        <div className="absolute left-0 right-0 top-0 z-30 h-1.5 bg-zinc-800">
          <motion.div
            className="h-full bg-gradient-to-r from-[#E0FE10] via-[#38BDF8] to-[#F472B6]"
            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <div className="absolute left-6 top-5 z-30 hidden items-center gap-3 md:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <PulseMark className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-500">Pulse Intelligence Labs</p>
            <p className="text-xs text-zinc-400">Interactive deck</p>
          </div>
        </div>

        <div className="absolute right-6 top-4 z-30 flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            {meta.section} - {meta.label}
          </span>
          {step > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goBack();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-800/70 transition-colors hover:bg-zinc-700/70"
            >
              <ChevronLeft className="h-4 w-4 text-zinc-300" />
            </button>
          )}
        </div>

        <div className="absolute bottom-5 left-6 z-30 flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
          <span>{step + 1}</span>
          <div className="h-px w-10 bg-zinc-700" />
          <span>{TOTAL_STEPS + 1}</span>
        </div>

        <main className="relative z-10 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="h-full"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={transition}
            >
              {renderScene()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
};

export default PulseIntelligenceLabsDeck;
