import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Briefcase,
  Building2,
  GraduationCap,
  Layers3,
  Mic2,
  Rocket,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';

const TOTAL_SLIDES = 12;

const SLIDE_META = [
  { label: 'Opening', eyebrow: 'Slide 1' },
  { label: 'Pulse Intelligence Labs', eyebrow: 'Slide 2' },
  { label: 'Fit With Pulse', eyebrow: 'Slide 3' },
  { label: 'Pulse Check', eyebrow: 'Slide 4' },
  { label: 'Q1 Momentum', eyebrow: 'Slide 5' },
  { label: 'AuntEdna', eyebrow: 'Slide 6' },
  { label: 'Partnerships', eyebrow: 'Slide 7' },
  { label: '30firstDay', eyebrow: 'Slide 8' },
  { label: 'Founder Brand', eyebrow: 'Slide 9' },
  { label: 'Quarter Focus', eyebrow: 'Slide 10' },
  { label: 'Priorities', eyebrow: 'Slide 11' },
  { label: 'Fundraising', eyebrow: 'Slide 12' },
] as const;

const transition = { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const };

const AUNT_EDNA_UNLOCKS = [
  {
    title: 'Clinical adjacency',
    body: 'Pulse Check now has a credible answer for what happens when a signal moves beyond performance coaching.',
  },
  {
    title: 'Escalation path',
    body: 'The story is no longer just detection. It becomes detection, routing, and real human follow-through.',
  },
  {
    title: 'Enterprise credibility',
    body: 'AuntEdna makes the team, school, and organization conversation sharper because care infrastructure is visible.',
  },
  {
    title: 'Stronger company story',
    body: 'It widens the narrative from a training app to a company building the stack around human performance and health intelligence.',
  },
] as const;

const PARTNERSHIP_MOMENTUM = [
  {
    title: 'Wunna Run',
    detail: 'Community activation proof and a live operator story inside the Pulse ecosystem.',
    accent: '#E0FE10',
  },
  {
    title: 'Gabby Thomas',
    detail: 'Elite performance adjacency and credibility inside the athlete-performance conversation.',
    accent: '#F59E0B',
  },
  {
    title: 'Clark Atlanta University',
    detail: 'Pilot kicked off and giving us real institutional proof in the university lane.',
    accent: '#38BDF8',
  },
  {
    title: 'UMES',
    detail: 'Pilot in motion and expanding the university pipeline behind Pulse Check.',
    accent: '#A78BFA',
  },
  {
    title: 'Polar',
    detail: 'A meaningful technical and ecosystem partnership lane for the performance stack.',
    accent: '#FB7185',
  },
  {
    title: '30firstDay',
    detail: 'Opening a partnership lane that spills directly into brand, content, and founder visibility.',
    accent: '#E0FE10',
  },
] as const;

const FOUNDER_MEDIA = {
  podcasts: ['Media Machine Podcast', 'Gary Fowler Podcast', 'This Week in Startups'],
  competitive: ['Won competition', 'Chulawear potential sponsor', 'Nationals next', 'Pro card journey', 'Olympia narrative building'],
  stages: ['Afrotech', 'Essence Festival panels in pipeline'],
} as const;

const THIS_QUARTER = [
  {
    title: 'Land one major partner already in motion',
    body: 'This quarter is about converting motion into one major signed win that materially changes the company narrative.',
    icon: Rocket,
    accent: '#E0FE10',
  },
  {
    title: '30firstDay x apparel x talent',
    body: 'Drive the 30firstDay lane toward a significant apparel partnership with one meaningful talent attachment.',
    icon: Briefcase,
    accent: '#F59E0B',
  },
  {
    title: 'Improve content strategy',
    body: 'Tighten founder visibility, company storytelling, and repeatable content output so momentum compounds in public.',
    icon: Mic2,
    accent: '#38BDF8',
  },
  {
    title: 'Research-backed university partner',
    body: 'Find a university that wants to participate in published research, with Bobby working the Harvard lane.',
    icon: GraduationCap,
    accent: '#8B5CF6',
  },
] as const;

const FUNDRAISE_STEPS = [
  {
    title: 'Create the environment first',
    body: 'We are not rushing the intro. We are setting the stage so the investor story feels earned.',
  },
  {
    title: 'Land a significant partner',
    body: 'A major partner win should precede the outreach so the conversation starts from traction, not aspiration.',
  },
  {
    title: 'Tighten the signal around the company',
    body: 'Partnership proof, founder visibility, and sharper content make the company easier to believe in at first glance.',
  },
  {
    title: 'Then ask LAUNCH for the intro',
    body: 'Once the partner lands, we will request the Alexis Ohanian intro through LAUNCH in the right environment.',
  },
] as const;

const SceneFrame: React.FC<{
  children: React.ReactNode;
  accent?: string;
  className?: string;
}> = ({ children, accent = '#E0FE10', className = '' }) => (
  <motion.div
    className={`relative h-full w-full overflow-hidden bg-[#07090d] ${className}`}
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -24 }}
    transition={transition}
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(224,254,16,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.08),transparent_28%),linear-gradient(135deg,#06080b_0%,#0a0d12_60%,#080a0f_100%)]" />
    <div className="absolute -left-20 top-16 h-72 w-72 rounded-full blur-3xl" style={{ background: `${accent}18` }} />
    <div className="absolute right-[-6%] top-[18%] h-64 w-64 rounded-full bg-white/[0.04] blur-3xl" />
    <div
      className="absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
      }}
    />
    <div className="relative z-10 flex h-full items-center px-8 py-10 md:px-14 md:py-12">
      <div className="w-full">{children}</div>
    </div>
  </motion.div>
);

const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
}> = ({ children, className = '', accentColor = '#E0FE10' }) => (
  <div className={`relative ${className}`}>
    <div
      className="pointer-events-none absolute -inset-[1px] rounded-[28px] opacity-45 blur-xl"
      style={{ background: `linear-gradient(135deg, ${accentColor}40, transparent 60%)` }}
    />
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900/45 backdrop-blur-xl">
      <div
        className="absolute left-0 right-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
      <div className="relative">{children}</div>
    </div>
  </div>
);

const SlideKicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-300">
    <Sparkles className="h-3.5 w-3.5 text-[#E0FE10]" />
    <span>{children}</span>
  </div>
);

const Chip: React.FC<{
  children: React.ReactNode;
  accent?: string;
}> = ({ children, accent = '#E0FE10' }) => (
  <span
    className="rounded-full border px-3 py-1.5 text-sm font-medium text-zinc-100"
    style={{ borderColor: `${accent}40`, background: `${accent}12` }}
  >
    {children}
  </span>
);

const MissionBand: React.FC = () => (
  <GlassCard accentColor="#8B5CF6">
    <div className="p-6 md:p-7">
      <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">New mission</div>
      <div className="mt-3 text-2xl font-black leading-tight text-white md:text-3xl">
        Use deep technology, AI, and advanced techniques to improve human performance.
      </div>
    </div>
  </GlassCard>
);

const SectionBridgeScene: React.FC<{
  kicker: string;
  indexLabel: string;
  title: string;
  subtitle: string;
  chips: readonly string[];
  accent?: string;
}> = ({ kicker, indexLabel, title, subtitle, chips, accent = '#E0FE10' }) => (
  <SceneFrame accent={accent}>
    <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.42em] text-zinc-500">{kicker}</div>
        <div className="mt-4 text-7xl font-black leading-none text-white md:text-[7rem]">{indexLabel}</div>
      </div>

      <div>
        <SlideKicker>{kicker}</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.95] text-white md:text-7xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-xl leading-relaxed text-zinc-300 md:text-2xl">{subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {chips.map((chip, index) => (
            <motion.div
              key={chip}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index }}
            >
              <Chip accent={accent}>{chip}</Chip>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </SceneFrame>
);

const SceneCover: React.FC = () => (
  <SceneFrame accent="#E0FE10">
    <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <SlideKicker>Advisory Board Meeting</SlideKicker>
        <div className="mt-5 text-sm font-semibold uppercase tracking-[0.34em] text-zinc-500">April 2026</div>
        <h1 className="mt-4 text-5xl font-black leading-[0.94] text-white md:text-7xl">
          Pulse Intelligence Labs, Inc.
        </h1>
        <p className="mt-5 max-w-3xl text-2xl font-semibold leading-relaxed text-[#E0FE10] md:text-3xl">
          The Human Performance Company.
        </p>
      </div>

      <div className="grid gap-4">
        <GlassCard accentColor="#E0FE10">
          <div className="p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Company shift</div>
            <div className="mt-3 text-3xl font-black leading-tight text-white">
              From Pulse to a portfolio under Pulse Intelligence Labs.
            </div>
          </div>
        </GlassCard>

        <GlassCard accentColor="#38BDF8">
          <div className="p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Focus</div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Chip accent="#38BDF8">The Shift</Chip>
              <Chip accent="#38BDF8">Q1 Momentum</Chip>
              <Chip accent="#38BDF8">This Quarter</Chip>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  </SceneFrame>
);

const ScenePulseIntelligenceLabs: React.FC = () => (
  <SceneFrame accent="#8B5CF6">
    <div className="grid items-center gap-8 lg:grid-cols-[1.04fr_0.96fr]">
      <div>
        <SlideKicker>The Shift</SlideKicker>
        <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-500">Umbrella company</div>
        <h1 className="mt-4 text-5xl font-black leading-[0.94] text-white md:text-7xl">
          Pulse Intelligence Labs, Inc.
        </h1>
        <p className="mt-4 text-2xl font-semibold leading-tight text-[#8B5CF6] md:text-4xl">
          The Human Performance Company.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Chip accent="#8B5CF6">Umbrella company</Chip>
          <Chip accent="#8B5CF6">Deep technology + AI</Chip>
          <Chip accent="#8B5CF6">Health intelligence</Chip>
          <Chip accent="#8B5CF6">Human performance</Chip>
        </div>
      </div>

      <div className="grid gap-4">
        <GlassCard accentColor="#8B5CF6">
          <div className="p-6 md:p-7">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/12 text-purple-300">
              <Building2 className="h-8 w-8" />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">What changes</div>
            <div className="mt-3 text-3xl font-black leading-tight text-white">
              Company story first.
              <br />
              Products beneath it.
            </div>
          </div>
        </GlassCard>
        <MissionBand />
      </div>
    </div>
  </SceneFrame>
);

const SceneFitWithPulse: React.FC = () => (
  <SceneFrame accent="#E0FE10">
    <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
      <div>
        <SlideKicker>Fit With Pulse</SlideKicker>
        <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-500">Consumer + community product</div>
        <h1 className="mt-4 text-5xl font-black leading-[0.94] text-white md:text-7xl">
          Fit With Pulse
        </h1>
        <p className="mt-4 max-w-3xl text-2xl font-semibold leading-tight text-[#E0FE10] md:text-4xl">
          The clearer consumer brand.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Chip accent="#E0FE10">Creators</Chip>
          <Chip accent="#E0FE10">Brands</Chip>
          <Chip accent="#E0FE10">Communities</Chip>
          <Chip accent="#E0FE10">Participation layer</Chip>
        </div>
      </div>

      <GlassCard accentColor="#E0FE10">
        <div className="p-6 md:p-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E0FE10]/12">
              <img src="/pulse-logo-green.svg" alt="Fit With Pulse" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Brand move</div>
              <div className="mt-2 text-3xl font-black text-white">Pulse now reads as Fit With Pulse.</div>
            </div>
          </div>
          <div className="grid gap-3">
            {['Legacy Pulse clarified', 'Community product', 'Lifestyle + participation'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-lg font-medium text-zinc-100">
                {item}
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const ScenePulseCheckProduct: React.FC = () => (
  <SceneFrame accent="#38BDF8">
    <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
      <div>
        <SlideKicker>Pulse Check</SlideKicker>
        <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-500">Mental performance product</div>
        <h1 className="mt-4 text-5xl font-black leading-[0.94] text-white md:text-7xl">
          Pulse Check
        </h1>
        <p className="mt-4 max-w-3xl text-2xl font-semibold leading-tight text-sky-300 md:text-4xl">
          Training cognition under pressure.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Chip accent="#38BDF8">Simulation</Chip>
          <Chip accent="#38BDF8">Pressure</Chip>
          <Chip accent="#38BDF8">Regulation</Chip>
          <Chip accent="#38BDF8">Performance</Chip>
        </div>
      </div>

      <GlassCard accentColor="#38BDF8">
        <div className="p-6 md:p-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-400/12">
              <img src="/pulsecheck-logo.svg" alt="Pulse Check" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">New product</div>
              <div className="mt-2 text-3xl font-black text-white">A distinct performance lane inside the portfolio.</div>
            </div>
          </div>
          <div className="grid gap-3">
            {['Mental performance', 'Performance under stress', 'New product entering the portfolio'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-lg font-medium text-zinc-100">
                {item}
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const SceneAuntEdna: React.FC = () => (
  <SceneFrame accent="#FB7185">
    <div className="grid items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
      <div>
        <SlideKicker>AuntEdna</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.95] text-white md:text-6xl">
          AuntEdna is our strongest clinical adjacency story.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-300 md:text-xl">
          This relationship makes Pulse Check more believable at the organizational level because we can now tell a fuller story around signal detection, routing, and care continuity.
        </p>

        <div className="mt-7 rounded-[28px] border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between gap-4">
            {[
              { label: 'Pulse Check', accent: '#38BDF8', icon: Brain },
              { label: 'Signal Layer', accent: '#8B5CF6', icon: Layers3 },
              { label: 'AuntEdna', accent: '#FB7185', icon: Shield },
            ].map((node, index, all) => {
              const Icon = node.icon;
              return (
                <React.Fragment key={node.label}>
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10"
                      style={{ background: `${node.accent}14`, color: node.accent }}
                    >
                      <Icon className="h-8 w-8" />
                    </div>
                    <div className="text-center text-sm font-semibold text-white">{node.label}</div>
                  </div>
                  {index < all.length - 1 ? (
                    <div className="hidden h-px flex-1 bg-gradient-to-r from-white/10 via-white/30 to-white/10 lg:block" />
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {AUNT_EDNA_UNLOCKS.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index }}
          >
            <GlassCard accentColor="#FB7185">
              <div className="p-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Why it matters</div>
                <h3 className="mt-3 text-2xl font-black text-white">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-zinc-300">{item.body}</p>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  </SceneFrame>
);

const ScenePartnerships: React.FC = () => (
  <SceneFrame accent="#38BDF8">
    <div className="grid h-full min-h-0 content-center gap-6">
      <div>
        <SlideKicker>Q1 Partnerships</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.95] text-white md:text-6xl">
          The partnership map got denser.
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <GlassCard accentColor="#E0FE10">
          <div className="p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Patriots</div>
                <h2 className="mt-3 text-4xl font-black text-white">Still very alive.</h2>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0FE10]/12 text-[#E0FE10]">
                <Target className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Chip accent="#E0FE10">3 former Patriots players</Chip>
              <Chip accent="#E0FE10">1 current player</Chip>
              <Chip accent="#E0FE10">1 Patriots donor</Chip>
              <Chip accent="#E0FE10">Re-engage after the draft</Chip>
            </div>

            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-300">
              The Patriots lane remains strategically important. The next step is deliberate re-engagement once the draft passes and timing improves.
            </p>
          </div>
        </GlassCard>

        <div className="grid gap-4 md:grid-cols-2">
          {PARTNERSHIP_MOMENTUM.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * index }}
            >
              <GlassCard accentColor={item.accent}>
                <div className="p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Momentum</div>
                  <h3 className="mt-2 text-2xl font-black text-white">{item.title}</h3>
                  <p className="mt-3 text-base leading-7 text-zinc-300">{item.detail}</p>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </SceneFrame>
);

const Scene30FirstDay: React.FC = () => (
  <SceneFrame accent="#F4F1EA">
    <img
      src="/30firstday-hero-deck.png"
      alt="30firstDay roster hero"
      className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.24] grayscale contrast-[1.05] brightness-[0.7]"
    />
    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,8,0.88)_0%,rgba(8,8,8,0.62)_38%,rgba(8,8,8,0.58)_100%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.2)_0%,rgba(10,10,10,0.24)_24%,rgba(10,10,10,0.62)_100%)]" />

    <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
      <div>
        <SlideKicker>30firstDay</SlideKicker>
        <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/55">Management company</div>
        <h1 className="mt-4 max-w-4xl text-5xl font-black leading-[0.94] text-white md:text-7xl">
          30firstDay brings real talent and brand leverage.
        </h1>
        <p className="mt-5 max-w-3xl text-xl font-semibold leading-relaxed text-[#F4F1EA] md:text-2xl">
          A management company with a roster strong enough to matter in culture and in partnership conversations.
        </p>

        <div className="mt-7 flex flex-wrap gap-2.5">
          <Chip accent="#F4F1EA">Day-to-day management</Chip>
          <Chip accent="#F4F1EA">Business development</Chip>
          <Chip accent="#F4F1EA">Brand / talent partnerships</Chip>
        </div>
      </div>

      <div className="grid gap-4">
        <GlassCard accentColor="#F4F1EA">
          <div className="p-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
              <Users className="h-7 w-7" />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/55">Notable roster</div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Chip accent="#F4F1EA">Lori Harvey</Chip>
              <Chip accent="#F4F1EA">Ryan Destiny</Chip>
              <Chip accent="#F4F1EA">Tyga</Chip>
            </div>
          </div>
        </GlassCard>

        <GlassCard accentColor="#E0FE10">
          <div className="p-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0FE10]/12 text-[#E0FE10]">
              <Briefcase className="h-7 w-7" />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Pitched goals for this quarter</div>
            <div className="mt-4 grid gap-3">
              {[
                'Acquire a significant apparel brand partnership',
                'Attach talent to represent the Fit With Pulse brand',
                'Increase founder visibility through high-quality content strategy and speaking engagements',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-xl font-semibold leading-tight text-white">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  </SceneFrame>
);

const SceneFounderBrand: React.FC = () => (
  <SceneFrame accent="#F59E0B">
    <div className="grid items-center gap-8 lg:grid-cols-[0.78fr_1.22fr]">
      <GlassCard accentColor="#F59E0B">
        <div className="p-5">
          <div className="overflow-hidden rounded-[24px] border border-white/10">
            <img src="/TremaineFounder.jpg" alt="Tremaine Grant" className="h-[420px] w-full object-cover object-top" />
          </div>
          <div className="mt-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Founder visibility</div>
            <div className="mt-3 text-3xl font-black leading-tight text-white">30firstDay is opening a founder-brand lane for the company.</div>
          </div>
        </div>
      </GlassCard>

      <div>
        <SlideKicker>Founder Branding & Media</SlideKicker>
        <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] text-white md:text-6xl">
          Founder visibility is becoming a growth lever.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-zinc-300 md:text-xl">
          The goal is not vanity. It is strategic distribution: more signal, more credibility, more repetition around the founder and the company narrative.
        </p>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <GlassCard accentColor="#38BDF8">
            <div className="p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/12 text-sky-300">
                <Mic2 className="h-6 w-6" />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Podcasts</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {FOUNDER_MEDIA.podcasts.map((item) => (
                  <Chip key={item} accent="#38BDF8">
                    {item}
                  </Chip>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard accentColor="#F59E0B">
            <div className="p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-300">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Competitive stack</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {FOUNDER_MEDIA.competitive.map((item) => (
                  <Chip key={item} accent="#F59E0B">
                    {item}
                  </Chip>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard accentColor="#8B5CF6">
            <div className="p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-400/12 text-purple-300">
                <Users className="h-6 w-6" />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Stage pipeline</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {FOUNDER_MEDIA.stages.map((item) => (
                  <Chip key={item} accent="#8B5CF6">
                    {item}
                  </Chip>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  </SceneFrame>
);

const ScenePriorities: React.FC = () => (
  <SceneFrame accent="#E0FE10">
    <div className="grid h-full min-h-0 content-center gap-6">
      <div>
        <SlideKicker>This Quarter</SlideKicker>
        <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.95] text-white md:text-6xl">
          This quarter is about converting motion into one or two undeniable outcomes.
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {THIS_QUARTER.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index }}
            >
              <GlassCard accentColor={item.accent}>
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: `${item.accent}14`, color: item.accent }}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Priority</div>
                      <h3 className="mt-2 text-3xl font-black leading-tight text-white">{item.title}</h3>
                      <p className="mt-3 text-base leading-7 text-zinc-300">{item.body}</p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  </SceneFrame>
);

const SceneFundraising: React.FC = () => (
  <SceneFrame accent="#8B5CF6">
    <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
      <div>
        <SlideKicker>Fundraising</SlideKicker>
        <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] text-white md:text-6xl">
          Build the trail before the intro.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-zinc-300 md:text-xl">
          We are intentionally creating the right environment before asking LAUNCH for the Alexis Ohanian intro. Timing matters more than activity here.
        </p>

        <div className="mt-8 grid gap-4">
          {FUNDRAISE_STEPS.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * index }}
            >
              <GlassCard accentColor="#8B5CF6">
                <div className="flex items-start gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">{item.title}</h3>
                    <p className="mt-2 text-base leading-7 text-zinc-300">{item.body}</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid gap-5">
        <GlassCard accentColor="#E0FE10">
          <div className="p-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0FE10]/12 text-[#E0FE10]">
              <Rocket className="h-7 w-7" />
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Desired setup</div>
            <div className="mt-3 text-4xl font-black leading-tight text-white">
              Significant partner first.
              <br />
              Intro second.
            </div>
          </div>
        </GlassCard>

        <GlassCard accentColor="#38BDF8">
          <div className="p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">What the story should say</div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Chip accent="#38BDF8">The company is sharpening</Chip>
              <Chip accent="#38BDF8">Partnerships are converting</Chip>
              <Chip accent="#38BDF8">Founder signal is rising</Chip>
              <Chip accent="#38BDF8">This is the right moment to lean in</Chip>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  </SceneFrame>
);

const AdvisoryBoardPage: React.FC = () => {
  const [slide, setSlide] = useState(0);

  const goNext = useCallback(() => setSlide((current) => Math.min(current + 1, TOTAL_SLIDES - 1)), []);
  const goBack = useCallback(() => setSlide((current) => Math.max(current - 1, 0)), []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', ' '];
      const backKeys = ['ArrowLeft', 'ArrowUp', 'PageUp'];

      if (nextKeys.includes(event.key)) {
        event.preventDefault();
        goNext();
      }

      if (backKeys.includes(event.key)) {
        event.preventDefault();
        goBack();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [goBack, goNext]);

  const scene = useMemo(() => {
    if (slide === 0) return <SceneCover />;
    if (slide === 1) return <ScenePulseIntelligenceLabs />;
    if (slide === 2) return <SceneFitWithPulse />;
    if (slide === 3) return <ScenePulseCheckProduct />;
    if (slide === 4) {
      return (
        <SectionBridgeScene
          kicker="Q1 Momentum"
          indexLabel="01"
          title="Q1 was about proving market gravity."
          subtitle="The strongest evidence this quarter came through partnerships, pilot motion, and a sharper founder-brand signal."
          chips={[
            'AuntEdna',
            'Patriots',
            'Clark Atlanta pilot',
            'UMES pilot',
            'Polar',
            '30firstDay',
          ]}
          accent="#38BDF8"
        />
      );
    }
    if (slide === 5) return <SceneAuntEdna />;
    if (slide === 6) return <ScenePartnerships />;
    if (slide === 7) return <Scene30FirstDay />;
    if (slide === 8) return <SceneFounderBrand />;
    if (slide === 9) {
      return (
        <SectionBridgeScene
          kicker="Quarter Focus"
          indexLabel="02"
          title="This quarter is about conversion."
          subtitle="We need to turn the existing motion into one major partner, stronger public signal, and a cleaner fundraising setup."
          chips={[
            'Land one flagship partner',
            'Improve content strategy',
            'Research-ready university lane',
            'Prepare the fundraising environment',
          ]}
          accent="#E0FE10"
        />
      );
    }
    if (slide === 10) return <ScenePriorities />;
    return <SceneFundraising />;
  }, [slide]);

  return (
    <>
      <Head>
        <title>Advisory Board | Pulse Intelligence Labs</title>
        <meta
          name="description"
          content="Advisory board presentation covering the Pulse Intelligence Labs positioning shift, Q1 momentum, and Q2 priorities."
        />
      </Head>

      <div className="h-screen overflow-hidden bg-[#05070b] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10%] top-[-12%] h-[38rem] w-[38rem] rounded-full bg-[#E0FE10]/7 blur-3xl" />
          <div className="absolute right-[-8%] top-[12%] h-[30rem] w-[30rem] rounded-full bg-sky-500/8 blur-3xl" />
          <div className="absolute bottom-[-10%] left-[24%] h-[28rem] w-[28rem] rounded-full bg-purple-500/8 blur-3xl" />
        </div>

        <div className="relative z-10 flex h-full w-full flex-col">
          <main className="relative min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait">{scene}</AnimatePresence>
          </main>

          <footer className="mx-4 mb-4 mt-2 flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-black/25 px-5 py-4 backdrop-blur-xl md:mx-6">
            <button
              type="button"
              onClick={goBack}
              disabled={slide === 0}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="hidden items-center gap-2 md:flex">
              {SLIDE_META.map((item, index) => (
                <div
                  key={item.label}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    slide === index ? 'w-12 bg-[#E0FE10]' : 'w-2.5 bg-white/20'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={goNext}
              disabled={slide === TOTAL_SLIDES - 1}
              className="inline-flex items-center gap-2 rounded-full bg-[#E0FE10] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#d1ef15] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          </footer>
        </div>
      </div>
    </>
  );
};

export default AdvisoryBoardPage;
