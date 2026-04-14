import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Briefcase,
  Building2,
  FileText,
  GraduationCap,
  Layers3,
  Link2,
  Mail,
  Mic2,
  PenTool,
  Rocket,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';

const TOTAL_SLIDES = 17;

const SLIDE_META = [
  { label: 'Opening', eyebrow: 'Slide 1' },
  { label: 'Equity Grants', eyebrow: 'Slide 2' },
  { label: 'Pulse Intelligence Labs', eyebrow: 'Slide 3' },
  { label: 'Why Now', eyebrow: 'Slide 4' },
  { label: 'Fit With Pulse', eyebrow: 'Slide 5' },
  { label: 'Pulse Check', eyebrow: 'Slide 6' },
  { label: 'Q1 Momentum', eyebrow: 'Slide 7' },
  { label: 'AuntEdna', eyebrow: 'Slide 8' },
  { label: 'Partnerships', eyebrow: 'Slide 9' },
  { label: 'New Categories', eyebrow: 'Slide 10' },
  { label: 'Creator Clubs', eyebrow: 'Slide 11' },
  { label: '30firstDay', eyebrow: 'Slide 12' },
  { label: 'Founder Brand', eyebrow: 'Slide 13' },
  { label: 'Quarter Focus', eyebrow: 'Slide 14' },
  { label: 'Priorities', eyebrow: 'Slide 15' },
  { label: 'Fundraising', eyebrow: 'Slide 16' },
  { label: 'Q2 Summary', eyebrow: 'Slide 17' },
] as const;

const transition = { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const };

const EQUITY_GRANT_STEPS = [
  {
    title: 'Receive the grant email.',
    accent: '#38BDF8',
    icon: Mail,
    chips: ['CEO e-sign', 'Grantee e-sign'],
  },
  {
    title: 'Review the documents.',
    accent: '#E0FE10',
    icon: FileText,
    chips: ['Grant docs'],
  },
  {
    title: 'Sign.',
    accent: '#8B5CF6',
    icon: PenTool,
    chips: ['Complete the grant'],
  },
] as const;

const AI_LAB_OUTCOMES = [
  {
    title: 'AI agents expand our surface area far beyond our headcount.',
    accent: '#8B5CF6',
    icon: Layers3,
  },
  {
    title: 'Continuous R&D is already producing immediate product outcomes.',
    accent: '#38BDF8',
    icon: Brain,
  },
  {
    title: 'Pulse Check, white papers, and publishable research all come from the same engine.',
    accent: '#E0FE10',
    icon: FileText,
  },
] as const;

const AI_LAB_AGENTS = [
  {
    title: 'Antigravity',
    role: 'Strategy + architecture',
    duty: 'Product strategy, system architecture, and cross-agent review.',
    accent: '#A78BFA',
    icon: Building2,
  },
  {
    title: 'Nora',
    role: 'System ops',
    duty: 'Orchestration, telemetry, and the operating nerve center.',
    accent: '#38BDF8',
    icon: Layers3,
  },
  {
    title: 'Scout',
    role: 'Discovery',
    duty: 'Creator research, fit analysis, and qualified outbound.',
    accent: '#F59E0B',
    icon: Target,
  },
  {
    title: 'Sage',
    role: 'Health intelligence',
    duty: 'Field research, insight packaging, and white-paper signal.',
    accent: '#34D399',
    icon: GraduationCap,
  },
  {
    title: 'Solara',
    role: 'Brand voice',
    duty: 'Messaging systems, tone guardrails, and outward narrative.',
    accent: '#FB7185',
    icon: Sparkles,
  },
] as const;

const AUNT_EDNA_UNLOCKS = [
  {
    title: 'Beyond performance coaching.',
  },
  {
    title: 'Detection becomes routing and follow-through.',
  },
  {
    title: 'Visible care infrastructure for teams, schools, and orgs.',
  },
  {
    title: 'A bigger human performance company story.',
  },
] as const;

const PARTNERSHIP_MOMENTUM = [
  {
    title: 'Wunna Run',
    detail: 'Community operator proof.',
    accent: '#E0FE10',
  },
  {
    title: 'Gabby Thomas',
    detail: 'Elite-performance credibility.',
    accent: '#F59E0B',
  },
  {
    title: 'Clark Atlanta University',
    detail: 'Pilot kicked off.',
    accent: '#38BDF8',
  },
  {
    title: 'UMES',
    detail: 'Pilot in motion.',
    accent: '#A78BFA',
  },
  {
    title: 'Polar',
    detail: 'Technical partnership lane.',
    accent: '#FB7185',
  },
  {
    title: '30firstDay',
    detail: 'Brand and founder visibility.',
    accent: '#E0FE10',
  },
] as const;

const CREATOR_CLUBS = [
  {
    title: 'The Pact',
    tag: 'Signature club',
    detail: 'Our clearest creator-club signal inside the ecosystem.',
    chips: ['Signature club', 'Value testing', 'Scale signal'],
    accent: '#E0FE10',
    image: '/advisory-clubs/the-pact.jpg',
  },
  {
    title: "Jaidus's Stretch Club",
    tag: 'Active test club',
    detail: 'Helping us learn where mobility-focused community programming hits.',
    chips: ['Benefit clarity', 'Format fit', 'Iteration'],
    accent: '#38BDF8',
    image: '/advisory-clubs/stretch-club.jpg',
  },
  {
    title: 'Fitness With Benefits',
    tag: 'Active test club',
    detail: 'Giving us live readouts on member value and partner readiness.',
    chips: ['Retention', 'Experience', 'Readiness'],
    accent: '#FB7185',
    image: '/advisory-clubs/fitness-with-benefits.jpg',
  },
] as const;

const NEW_CATEGORIES = [
  {
    title: 'Run',
    detail: 'Cardio and endurance',
    accent: '#3B82F6',
    image: '/advisory-categories/run.png',
  },
  {
    title: 'Bike',
    detail: 'Cycling and output',
    accent: '#06B6D4',
    image: '/advisory-categories/bike.png',
  },
  {
    title: 'Lift',
    detail: 'Strength and power',
    accent: '#E0FE10',
    image: '/advisory-categories/lift.png',
  },
  {
    title: 'Stretch',
    detail: 'Mobility and recovery',
    accent: '#8B5CF6',
    image: '/advisory-categories/stretch.png',
  },
  {
    title: 'Fat Burn',
    detail: 'High-intensity conditioning',
    accent: '#EF4444',
    image: '/advisory-categories/fat-burn.png',
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

const Q2_SUMMARY = [
  { title: 'Land one flagship partner.', accent: '#E0FE10' },
  { title: 'Turn 30firstDay into apparel + talent.', accent: '#F59E0B' },
  { title: 'Grow founder visibility through content.', accent: '#38BDF8' },
  { title: 'Lock a research-ready university lane.', accent: '#8B5CF6' },
  { title: 'Set up the Alexis intro environment.', accent: '#FB7185' },
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
          Pulse Intelligence Labs, Inc. <span className="whitespace-nowrap text-[#E0FE10]">(PIL)</span>
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

const SceneEquityGrants: React.FC = () => (
  <SceneFrame accent="#38BDF8">
    <div className="grid h-full min-h-0 content-center gap-7">
      <div className="grid items-end gap-6 lg:grid-cols-[0.98fr_1.02fr]">
        <div>
          <SlideKicker>Equity Grants</SlideKicker>
          <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.95] text-white md:text-6xl">
            Equity grants happen in three steps.
          </h1>
        </div>

        <GlassCard accentColor="#38BDF8">
          <div className="p-6 md:p-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Later</div>
            <div className="mt-3 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-400/12 text-sky-300">
                <Link2 className="h-7 w-7" />
              </div>
              <div className="text-3xl font-black leading-tight text-white md:text-4xl">
                We send a vesting link later for tracking.
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {EQUITY_GRANT_STEPS.map((step, index) => {
          const Icon = step.icon;

          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index }}
            >
              <GlassCard accentColor={step.accent} className="h-full">
                <div className="flex h-full min-h-[18rem] flex-col justify-between p-6 md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-6xl font-black leading-none text-white/14">{index + 1}</div>
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: `${step.accent}14`, color: step.accent }}
                    >
                      <Icon className="h-8 w-8" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-4xl font-black leading-[1.02] text-white">{step.title}</h3>
                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {step.chips.map((chip) => (
                        <Chip key={chip} accent={step.accent}>
                          {chip}
                        </Chip>
                      ))}
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

const SceneWhyAiLab: React.FC = () => (
  <SceneFrame accent="#8B5CF6">
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="grid items-end gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <div>
          <SlideKicker>Why the shift now</SlideKicker>
          <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.94] text-white md:text-6xl">
            AI agents let a small team cover much greater surface area.
          </h1>
          <p className="mt-4 max-w-4xl text-2xl font-semibold leading-tight text-[#A78BFA] md:text-4xl">
            That makes the move to an AI lab more credible and more ambitious.
          </p>
        </div>

        <GlassCard accentColor="#8B5CF6">
          <div className="p-6 md:p-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Why this matters</div>
            <div className="mt-4 text-3xl font-black leading-tight text-white md:text-4xl">
              We can now build, research, write, and operate in parallel.
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Chip accent="#8B5CF6">AI agents</Chip>
              <Chip accent="#38BDF8">Continuous R&amp;D</Chip>
              <Chip accent="#E0FE10">Immediate outcomes</Chip>
              <Chip accent="#FB7185">Research lane</Chip>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.84fr_1.16fr]">
        <div className="grid gap-4">
          {AI_LAB_OUTCOMES.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * index }}
              >
                <GlassCard accentColor={item.accent}>
                  <div className="flex items-start gap-4 p-6 md:p-7">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: `${item.accent}14`, color: item.accent }}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-3xl font-black leading-[1.04] text-white md:text-[2rem]">
                      {item.title}
                    </h3>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        <GlassCard accentColor="#38BDF8" className="h-full">
          <div className="p-6 md:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Agent system</div>
                <div className="mt-3 text-3xl font-black leading-tight text-white md:text-4xl">
                  The lab already has specialized operators.
                </div>
              </div>
              <div className="hidden h-16 w-16 items-center justify-center rounded-2xl bg-sky-400/12 text-sky-300 md:flex">
                <Brain className="h-8 w-8" />
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {AI_LAB_AGENTS.map((agent, index) => {
                const Icon = agent.icon;

                return (
                  <motion.div
                    key={agent.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                    className={index === AI_LAB_AGENTS.length - 1 ? 'md:col-span-2' : ''}
                  >
                    <div
                      className="h-full rounded-[24px] border p-4"
                      style={{ borderColor: `${agent.accent}35`, background: `${agent.accent}10` }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                          style={{ background: `${agent.accent}16`, color: agent.accent }}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-[11px] font-semibold uppercase tracking-[0.3em]"
                            style={{ color: agent.accent }}
                          >
                            {agent.role}
                          </div>
                          <h3 className="mt-1 text-2xl font-black text-white">{agent.title}</h3>
                          <div className="mt-2 text-lg font-semibold leading-tight text-zinc-200">
                            {agent.duty}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </GlassCard>
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

const SceneNewCategories: React.FC = () => (
  <SceneFrame accent="#E0FE10">
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="grid items-end gap-5 lg:grid-cols-[0.96fr_1.04fr]">
        <div>
          <SlideKicker>Training Categories</SlideKicker>
          <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.95] text-white md:text-6xl">
            Q1 expanded us across five training categories.
          </h1>
        </div>

        <GlassCard accentColor="#E0FE10">
          <div className="p-5 md:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">What it means</div>
            <div className="mt-3 text-2xl font-black leading-tight text-white md:text-3xl">
              More consumer entry points.
              <br />
              More live demand signals.
            </div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Chip accent="#E0FE10">Top-of-funnel expansion</Chip>
              <Chip accent="#E0FE10">More demand signals</Chip>
              <Chip accent="#E0FE10">Broader consumer surface</Chip>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {NEW_CATEGORIES.map((category, index) => {
          return (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 * index }}
            >
              <GlassCard accentColor={category.accent} className="h-full">
                <div className="relative h-[23rem] overflow-hidden">
                  <img
                    src={category.image}
                    alt={category.title}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(180deg, ${category.accent}18 0%, rgba(7,9,13,0.14) 28%, rgba(7,9,13,0.92) 100%)`,
                    }}
                  />
                  <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: category.accent }} />

                  <div className="relative flex h-full flex-col justify-end p-5">
                    <div className="rounded-[24px] border border-white/10 bg-black/35 p-4 backdrop-blur-md">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: category.accent }}>
                        Training category
                      </div>
                      <h3 className="mt-2 text-3xl font-black text-white">{category.title}</h3>
                      <p className="mt-2 text-base leading-relaxed text-zinc-300">{category.detail}</p>
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

const SceneAuntEdna: React.FC = () => (
  <SceneFrame accent="#FB7185">
    <div className="grid items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
      <div>
        <SlideKicker>AuntEdna</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.95] text-white md:text-6xl">
          AuntEdna gives Pulse Check a credible path from signal to care.
        </h1>

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
                <h3 className="text-3xl font-black leading-tight text-white md:text-[2rem]">{item.title}</h3>
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

            <div className="mt-5 grid gap-3">
              <div className="text-3xl font-black leading-tight text-zinc-100 md:text-4xl">
                3 former players. 1 current. 1 donor.
              </div>
              <div className="text-3xl font-black leading-tight text-[#E0FE10] md:text-4xl">
                Re-engage after the draft.
              </div>
            </div>
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
                <div className="p-5 md:p-6">
                  <h3 className="text-2xl font-black leading-tight text-white md:text-3xl">{item.title}</h3>
                  <div className="mt-3 text-2xl font-black leading-tight text-zinc-300 md:text-[2rem]">
                    {item.detail}
                  </div>
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

const SceneCreatorClubs: React.FC = () => (
  <SceneFrame accent="#E0FE10">
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="grid items-end gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <div>
          <SlideKicker>Creator Clubs</SlideKicker>
          <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.95] text-white md:text-6xl">
            Creator clubs are our proving ground.
          </h1>
          <p className="mt-5 max-w-3xl text-xl leading-relaxed text-zinc-300 md:text-2xl">
            We are using these clubs to test value, understand benefits, and find what to improve before bigger partners come in.
          </p>
        </div>

        <GlassCard accentColor="#E0FE10">
          <div className="p-6 md:p-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">What we are learning</div>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Chip accent="#E0FE10">Value</Chip>
              <Chip accent="#E0FE10">Benefits</Chip>
              <Chip accent="#E0FE10">Improvement areas</Chip>
              <Chip accent="#E0FE10">Bigger partner readiness</Chip>
            </div>
            <div className="mt-5 text-2xl font-black leading-tight text-white md:text-3xl">
              Small club environments are helping us sharpen the product and the operating model before scale.
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {CREATOR_CLUBS.map((club, index) => {
          return (
            <motion.div
              key={club.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index }}
            >
              <GlassCard accentColor={club.accent}>
                <div className="overflow-hidden">
                  <div className="relative h-56">
                    <img src={club.image} alt={club.title} className="absolute inset-0 h-full w-full object-cover object-center" />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(180deg, rgba(5,7,11,0.08) 0%, rgba(5,7,11,0.16) 32%, rgba(5,7,11,0.88) 100%)`,
                      }}
                    />
                    <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: club.accent }} />

                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: club.accent }}>
                        {club.tag}
                      </div>
                      <h3 className="mt-2 text-3xl font-black leading-tight text-white">{club.title}</h3>
                    </div>
                  </div>

                  <div className="p-6 md:p-7">
                    <p className="text-lg leading-relaxed text-zinc-300">{club.detail}</p>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {club.chips.map((chip) => (
                        <Chip key={chip} accent={club.accent}>
                          {chip}
                        </Chip>
                      ))}
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

const SceneQ2Summary: React.FC = () => (
  <SceneFrame accent="#E0FE10">
    <div className="grid h-full min-h-0 content-center gap-8">
      <div>
        <SlideKicker>Q2 Summary</SlideKicker>
        <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.95] text-white md:text-7xl">
          Q2 in plain terms.
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Q2_SUMMARY.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 * index }}
          >
            <GlassCard accentColor={item.accent} className="h-full">
              <div className="flex min-h-[16rem] items-end p-6 md:p-7">
                <h3 className="text-3xl font-black leading-[1.02] text-white md:text-4xl">
                  {item.title}
                </h3>
              </div>
            </GlassCard>
          </motion.div>
        ))}
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
    if (slide === 1) return <SceneEquityGrants />;
    if (slide === 2) return <ScenePulseIntelligenceLabs />;
    if (slide === 3) return <SceneWhyAiLab />;
    if (slide === 4) return <SceneFitWithPulse />;
    if (slide === 5) return <ScenePulseCheckProduct />;
    if (slide === 6) {
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
    if (slide === 7) return <SceneAuntEdna />;
    if (slide === 8) return <ScenePartnerships />;
    if (slide === 9) return <SceneNewCategories />;
    if (slide === 10) return <SceneCreatorClubs />;
    if (slide === 11) return <Scene30FirstDay />;
    if (slide === 12) return <SceneFounderBrand />;
    if (slide === 13) {
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
    if (slide === 14) return <ScenePriorities />;
    if (slide === 15) return <SceneFundraising />;
    return <SceneQ2Summary />;
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
