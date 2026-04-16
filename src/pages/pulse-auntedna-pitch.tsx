import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Mail,
  PhoneCall,
  Shield,
  Sparkles,
  Wind,
  XCircle,
  Zap,
} from 'lucide-react';

const TOTAL_SLIDES = 10;

const SLIDE_META = [
  { label: 'Title', eyebrow: 'Slide 1' },
  { label: 'Problem', eyebrow: 'Slide 2' },
  { label: 'Solution', eyebrow: 'Slide 3' },
  { label: 'How It Works', eyebrow: 'Slide 4' },
  { label: 'Why We Win', eyebrow: 'Slide 5' },
  { label: 'Market', eyebrow: 'Slide 6' },
  { label: 'Go-To-Market', eyebrow: 'Slide 7' },
  { label: 'Team', eyebrow: 'Slide 8' },
  { label: 'AI Edge', eyebrow: 'Slide 9' },
  { label: 'Summary', eyebrow: 'Slide 10' },
] as const;

const transition = { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const };

const COLORS = {
  lime: '#E0FE10',
  sky: '#38BDF8',
  purple: '#8B5CF6',
  pink: '#F472B6',
  red: '#FB7185',
  amber: '#F59E0B',
} as const;

const PROBLEM_STATS = [
  {
    value: '4x',
    label: 'crisis risk',
    detail: 'Student-athletes are more likely to experience a mental health crisis.',
    accent: COLORS.red,
  },
  {
    value: '60%',
    label: 'pre-competition anxiety',
    detail: 'Athletes report elevated anxiety leading into competition.',
    accent: COLORS.sky,
  },
  {
    value: '10%',
    label: 'coach visibility',
    detail: 'Only a small fraction say something before the moment breaks down.',
    accent: COLORS.lime,
  },
] as const;

const SOLUTION_PILLARS = [
  {
    title: 'Detect',
    detail: 'Pulse Check finds the performance signal early.',
    accent: COLORS.sky,
    icon: Brain,
  },
  {
    title: 'Regulate',
    detail: 'In-chat intervention helps the athlete settle in real time.',
    accent: COLORS.lime,
    icon: Wind,
  },
  {
    title: 'Route',
    detail: 'AuntEdna becomes the clinical destination when escalation is needed.',
    accent: COLORS.red,
    icon: Shield,
  },
] as const;

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Athlete check-in',
    detail: 'Conversation + biometrics create the signal.',
    accent: COLORS.sky,
  },
  {
    title: 'Signal layer',
    detail: 'AI classifies severity and next best action.',
    accent: COLORS.purple,
  },
  {
    title: 'In-the-moment support',
    detail: 'Pulse Check serves a regulation protocol inside the moment.',
    accent: COLORS.lime,
  },
  {
    title: 'Clinical handoff',
    detail: 'AuntEdna receives the routed case and response path.',
    accent: COLORS.red,
  },
] as const;

const COMPETITOR_CARDS = [
  {
    name: 'WHOOP',
    category: 'Performance wearable',
    detail: 'Recovery, strain, and biometrics.',
    accent: COLORS.sky,
    icon: Zap,
  },
  {
    name: 'Calm',
    category: 'Mindfulness app',
    detail: 'Breathwork, meditation, and calm.',
    accent: COLORS.purple,
    icon: Wind,
  },
  {
    name: 'Spring Health',
    category: 'Clinical response',
    detail: 'Care navigation and provider matching.',
    accent: COLORS.pink,
    icon: Shield,
  },
  {
    name: '988',
    category: 'Crisis line',
    detail: 'Immediate crisis counseling.',
    accent: COLORS.red,
    icon: PhoneCall,
  },
] as const;

const COMPETITIVE_ROWS = [
  {
    feature: 'Biometric performance signal',
    whoop: true,
    calm: false,
    spring: false,
    lifeline: false,
    pulse: true,
  },
  {
    feature: 'In-the-moment regulation',
    whoop: false,
    calm: true,
    spring: false,
    lifeline: false,
    pulse: true,
  },
  {
    feature: 'Clinical care navigation',
    whoop: false,
    calm: false,
    spring: true,
    lifeline: false,
    pulse: true,
  },
  {
    feature: 'Crisis escalation path',
    whoop: false,
    calm: false,
    spring: false,
    lifeline: true,
    pulse: true,
  },
  {
    feature: 'Athlete + team workflow',
    whoop: false,
    calm: false,
    spring: false,
    lifeline: false,
    pulse: true,
  },
  {
    feature: 'One athlete record across the stack',
    whoop: false,
    calm: false,
    spring: false,
    lifeline: false,
    pulse: true,
  },
] as const;

const MARKET_CARDS = [
  {
    label: 'TAM',
    value: '$1.26B',
    detail: 'U.S. athlete mental performance + support software modeled on high school and NCAA participation.',
    accent: COLORS.lime,
  },
  {
    label: 'SAM',
    value: '$180M',
    detail: 'Initial focus: colleges, universities, prep schools, academies, and performance programs.',
    accent: COLORS.sky,
  },
  {
    label: 'SOM',
    value: '$10.8M',
    detail: 'First 100 organizations at roughly 75,000 athletes under annual contracts.',
    accent: COLORS.purple,
  },
] as const;

const GTM_LANES = [
  {
    title: 'Start with pilots',
    detail: 'University and team pilots prove workflow fit and create case studies.',
    chips: ['Clark Atlanta pilot', 'UMES in motion', 'Live product demos'],
    accent: COLORS.sky,
  },
  {
    title: 'Sell to organizations',
    detail: 'Annual organization contracts with per-athlete pricing and implementation support.',
    chips: ['Athletic departments', 'Performance staff', 'Student support teams'],
    accent: COLORS.lime,
  },
  {
    title: 'Expand through trust',
    detail: 'Clinical adjacency and research credibility widen the path into larger programs.',
    chips: ['AuntEdna partnership', 'Research lane', 'Team referrals'],
    accent: COLORS.red,
  },
] as const;

const TEAM_MEMBERS = [
  {
    name: 'Tremaine Grant',
    role: 'Founder & CEO',
    imageSrc: '/TremaineFounder.jpg',
    accent: COLORS.lime,
    org: 'Pulse Intelligence Labs',
    badges: ['D1 Athlete', 'Biotech', 'Engineer'],
  },
  {
    name: 'Bobby Nweke',
    role: 'Chief of Staff',
    imageSrc: '/bobbyAdvisor.jpg',
    accent: COLORS.sky,
    org: 'Pulse Intelligence Labs',
    badges: ['TED', 'Harvard', 'TFA'],
  },
  {
    name: 'Dr. Tracey',
    role: 'Clinical Partner',
    imageSrc: '/dr-tracey.png',
    accent: COLORS.pink,
    org: 'AuntEdna',
    badges: ['Clinical care', 'Escalation path', 'Provider workflow'],
  },
  {
    name: 'Jelanna',
    role: 'AuntEdna Team Contact',
    imageSrc: '/jelanna.jpg',
    accent: COLORS.red,
    org: 'AuntEdna',
    badges: ['Operations', 'Care coordination', 'Pilot support'],
  },
] as const;

const AI_CAPABILITY_CARDS = [
  {
    title: 'Personal baseline',
    detail: 'The read starts from what is normal for that athlete.',
    accent: COLORS.sky,
    icon: Brain,
  },
  {
    title: 'Sport lens',
    detail: 'Basketball pressure is not football fatigue or sprint nerves.',
    accent: COLORS.purple,
    icon: Zap,
  },
  {
    title: 'Signal fusion',
    detail: 'Biometrics, language, and timing are read together.',
    accent: COLORS.lime,
    icon: Sparkles,
  },
  {
    title: 'Adaptive response',
    detail: 'Intervention, escalation, and urgency change by athlete.',
    accent: COLORS.red,
    icon: Shield,
  },
] as const;

const SUMMARY_POINTS = [
  'We address the gap between performance pressure and clinical response.',
  'We intervene before the athlete becomes a crisis-only story.',
  'We combine AI signal detection with a real clinical destination.',
] as const;

const SceneFrame: React.FC<{
  children: React.ReactNode;
  accent?: string;
  className?: string;
}> = ({ children, accent = COLORS.lime, className = '' }) => (
  <motion.div
    className={`relative h-full w-full overflow-y-auto overflow-x-hidden bg-[#07090d] md:overflow-hidden ${className}`}
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
    <div className="relative z-10 flex min-h-full px-6 py-8 md:h-full md:px-14 md:py-12">
      <div className="my-auto w-full">{children}</div>
    </div>
  </motion.div>
);

const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
}> = ({ children, className = '', accentColor = COLORS.lime }) => (
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
}> = ({ children, accent = COLORS.lime }) => (
  <span
    className="rounded-full border px-3 py-1.5 text-sm font-medium text-zinc-100"
    style={{ borderColor: `${accent}40`, background: `${accent}12` }}
  >
    {children}
  </span>
);

const AuntEdnaWordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={className}>
    <div className="text-[11px] uppercase tracking-[0.32em] text-zinc-500">Clinical intelligence</div>
    <div className="mt-2 text-3xl font-black text-white md:text-5xl">
      aunt
      <span
        style={{
          background: 'linear-gradient(135deg, #F472B6, #FB7185, #FBBF24)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        EDNA
      </span>
      <span className="text-white/35">.ai</span>
    </div>
  </div>
);

const PulseCheckWordmark: React.FC<{ className?: string; compact?: boolean }> = ({
  className = '',
  compact = false,
}) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <img
      src="/pulsecheck-logo.svg"
      alt="Pulse Check"
      className={compact ? 'h-12 w-auto' : 'h-16 w-auto md:h-20'}
    />
    <div>
      <div className={`${compact ? 'text-[10px]' : 'text-[11px]'} uppercase tracking-[0.32em] text-zinc-500`}>
        Mental performance
      </div>
      <div className={`${compact ? 'text-3xl' : 'text-4xl md:text-5xl'} mt-1 font-black text-white`}>
        Pulse <span className="text-[#8B5CF6]">Check</span>
      </div>
    </div>
  </div>
);

const ContactCard: React.FC<(typeof TEAM_MEMBERS)[number]> = ({ name, role, imageSrc, accent, org, badges }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <div className="flex items-center gap-4">
      <div
        className="h-18 w-18 overflow-hidden rounded-2xl border md:h-20 md:w-20"
        style={{ borderColor: `${accent}55`, background: `linear-gradient(135deg, ${accent}22, rgba(255,255,255,0.05))` }}
      >
        <img src={imageSrc} alt={name} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xl font-semibold text-white md:text-2xl">{name}</div>
        <div className="text-base text-zinc-400">{role}</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.28em]" style={{ color: accent }}>
          {org}
        </div>
      </div>
    </div>

    <div className="mt-5 flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={`${name}-${badge}`}
          className="rounded px-2.5 py-1 text-xs font-semibold"
          style={{ background: `${accent}1e`, color: accent }}
        >
          {badge}
        </span>
      ))}
    </div>
  </div>
);

const AnimatedDataStream: React.FC<{ delay?: number; duration?: number; color?: string }> = ({
  delay = 0,
  duration = 2.5,
  color = COLORS.lime,
}) => (
  <motion.div
    className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
    style={{ backgroundColor: color, boxShadow: `0 0 14px ${color}90`, left: 0 }}
    initial={{ left: '0%', opacity: 0, scale: 0.5 }}
    animate={{ left: '100%', opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.5] }}
    transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.5 }}
  />
);

const SignalToCareFlow: React.FC = () => {
  const streams = [
    { delay: 0, color: COLORS.lime, duration: 2.8 },
    { delay: 0.7, color: '#10b981', duration: 3.1 },
    { delay: 1.4, color: '#ef4444', duration: 2.6 },
    { delay: 2.1, color: COLORS.amber, duration: 3.3 },
    { delay: 2.8, color: COLORS.purple, duration: 2.9 },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[118px_1fr_144px_1fr_118px] lg:items-center">
      {[
        {
          title: 'Pulse',
          subtitle: 'Check',
          accent: COLORS.lime,
          icon: Brain,
          label: 'Athlete check-in',
          shape: 'rounded-[28px]',
          size: 'h-[118px] w-[118px]',
        },
        {
          title: 'Signal',
          subtitle: 'Layer',
          accent: COLORS.purple,
          icon: Zap,
          label: 'AI classification',
          shape: 'rounded-full',
          size: 'h-[144px] w-[144px]',
        },
        {
          title: 'Aunt',
          subtitle: 'Edna',
          accent: COLORS.red,
          icon: Shield,
          label: 'Clinical platform',
          shape: 'rounded-[28px]',
          size: 'h-[118px] w-[118px]',
        },
      ].map((node, index) => {
        const Icon = node.icon;

        if (index === 1) {
          return (
            <React.Fragment key={node.title}>
              <div className="relative hidden h-16 overflow-visible lg:block">
                <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-[#E0FE10]/40 via-[#E0FE10]/20 to-zinc-700/60" />
                {streams.slice(0, 3).map((stream, streamIndex) => (
                  <AnimatedDataStream
                    key={`flow-left-${stream.color}-${streamIndex}`}
                    delay={stream.delay}
                    duration={stream.duration}
                    color={stream.color}
                  />
                ))}
              </div>

              <div className="flex shrink-0 flex-col items-center gap-3">
                <div className="relative">
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.18, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.36) 0%, transparent 70%)', filter: 'blur(18px)' }}
                  />
                  <div
                    className={`relative flex ${node.size} flex-col items-center justify-center gap-2 ${node.shape} border-2 border-purple-500/40 bg-zinc-900/90 backdrop-blur-xl`}
                    style={{ boxShadow: '0 0 34px rgba(139,92,246,0.2), inset 0 0 22px rgba(139,92,246,0.05)' }}
                  >
                    <Icon className="h-8 w-8 text-purple-400" />
                    <div className="text-xs font-bold uppercase tracking-[0.32em] text-purple-300">{node.title}</div>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{node.subtitle}</div>
                    <motion.div
                      className="absolute inset-1 rounded-full border border-purple-500/20"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                </div>
                <div className="text-center text-[11px] uppercase tracking-[0.28em] text-zinc-600">{node.label}</div>
              </div>

              <div className="relative hidden h-16 overflow-visible lg:block">
                <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-purple-500/40 via-red-500/30 to-red-500/60" />
                {streams.slice(2).map((stream, streamIndex) => (
                  <AnimatedDataStream
                    key={`flow-right-${stream.color}-${streamIndex}`}
                    delay={stream.delay}
                    duration={stream.duration}
                    color={stream.color}
                  />
                ))}
              </div>
            </React.Fragment>
          );
        }

        return (
          <div key={node.title} className="flex shrink-0 flex-col items-center gap-3">
            <div className="relative">
              <motion.div
                className={`absolute inset-0 ${node.shape}`}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
                style={{ background: `radial-gradient(circle, ${node.accent}40 0%, transparent 70%)`, filter: 'blur(14px)' }}
              />
              <div
                className={`relative flex ${node.size} flex-col items-center justify-center gap-2 ${node.shape} border bg-zinc-900/80 backdrop-blur-xl`}
                style={{ borderColor: `${node.accent}55`, boxShadow: `0 0 20px ${node.accent}22` }}
              >
                <Icon className="h-8 w-8" style={{ color: node.accent }} />
                <div className="text-xs font-bold uppercase tracking-[0.32em]" style={{ color: node.accent }}>
                  {node.title}
                </div>
                <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{node.subtitle}</div>
              </div>
            </div>
            <div className="text-center text-[11px] uppercase tracking-[0.28em] text-zinc-600">{node.label}</div>
          </div>
        );
      })}
    </div>
  );
};

const SceneTitle: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="grid items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
      <div>
        <SlideKicker>Pitch deck</SlideKicker>
        <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
          Pulse Intelligence Labs, Inc. • Atlanta, GA • fitwithpulse.ai
        </div>
        <h1 className="mt-4 text-5xl font-black leading-[0.94] text-white md:text-7xl">
          Pulse Check <span className="text-[#8B5CF6]">x</span> AuntEdna
        </h1>
        <p className="mt-4 max-w-4xl text-2xl font-semibold leading-tight text-[#E0FE10] md:text-4xl">
          The signal-to-care platform for athlete mental performance.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Chip accent={COLORS.sky}>AI</Chip>
          <Chip accent={COLORS.purple}>Digital Health</Chip>
          <Chip accent={COLORS.red}>Sports Performance</Chip>
        </div>
      </div>

      <div className="grid gap-4">
        <GlassCard accentColor={COLORS.purple}>
          <div className="p-6 md:p-7">
            <AuntEdnaWordmark />
            <div className="mt-5 border-t border-white/10 pt-5">
              <PulseCheckWordmark compact />
            </div>
          </div>
        </GlassCard>

        <GlassCard accentColor={COLORS.lime}>
          <div className="p-6 md:p-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Tracks</div>
            <div className="mt-3 text-3xl font-black leading-tight text-white">
              One technology.
              <br />
              One athlete journey.
            </div>
            <div className="mt-5 text-lg leading-relaxed text-zinc-300">
              Detect the pressure signal. Regulate in the moment. Route to real care when needed.
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  </SceneFrame>
);

const SceneProblem: React.FC = () => (
  <SceneFrame accent={COLORS.red}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-5xl">
        <SlideKicker>The problem</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          Performance pressure gets seen too late.
        </h1>
        <p className="mt-4 max-w-4xl text-2xl font-semibold leading-tight text-[#FB7185] md:text-4xl">
          The signal usually shows up before the support system does.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PROBLEM_STATS.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index }}
          >
            <GlassCard accentColor={stat.accent} className="h-full">
              <div className="flex min-h-[16rem] flex-col justify-between p-6 md:p-7">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: stat.accent }}>
                  {stat.label}
                </div>
                <div className="text-6xl font-black text-white md:text-7xl">{stat.value}</div>
                <div className="text-xl font-semibold leading-tight text-zinc-200 md:text-2xl">
                  {stat.detail}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  </SceneFrame>
);

const SceneSolution: React.FC = () => (
  <SceneFrame accent={COLORS.sky}>
    <div className="grid items-center gap-8 lg:grid-cols-[0.98fr_1.02fr]">
      <div>
        <SlideKicker>The solution</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          We turn athlete pressure signals into action.
        </h1>
        <p className="mt-4 max-w-4xl text-2xl font-semibold leading-tight text-sky-300 md:text-4xl">
          Better than surveys, calmer than crisis-only response, and connected to real care.
        </p>
      </div>

      <div className="grid gap-4">
        {SOLUTION_PILLARS.map((pillar, index) => {
          const Icon = pillar.icon;
          return (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * index }}
            >
              <GlassCard accentColor={pillar.accent}>
                <div className="flex items-start gap-4 p-6 md:p-7">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: `${pillar.accent}14`, color: pillar.accent }}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white md:text-4xl">{pillar.title}</div>
                    <div className="mt-2 text-xl font-semibold leading-tight text-zinc-200 md:text-2xl">
                      {pillar.detail}
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

const SceneHowItWorks: React.FC = () => (
  <SceneFrame accent={COLORS.purple}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-5xl">
        <SlideKicker>How it works</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          A simple signal-to-care workflow.
        </h1>
      </div>

      <GlassCard accentColor={COLORS.purple}>
        <div className="p-6 md:p-7">
          <SignalToCareFlow />
        </div>
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {HOW_IT_WORKS_STEPS.map((step, index) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index }}
          >
            <GlassCard accentColor={step.accent} className="h-full">
              <div className="flex min-h-[12rem] flex-col justify-between p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: step.accent }}>
                  Step {index + 1}
                </div>
                <div className="text-3xl font-black leading-tight text-white">{step.title}</div>
                <div className="text-lg leading-snug text-zinc-300">{step.detail}</div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  </SceneFrame>
);

const ComparisonCell: React.FC<{ positive: boolean; accent?: string }> = ({ positive, accent = COLORS.lime }) => (
  <div className="flex justify-center">
    {positive ? (
      <CheckCircle2 className="h-6 w-6" style={{ color: accent }} />
    ) : (
      <XCircle className="h-6 w-6 text-zinc-600" />
    )}
  </div>
);

const SceneUniqueness: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-6xl">
        <SlideKicker>Uniqueness / superiority</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          WHOOP meets Calm, then extends into Spring Health and 988.
        </h1>
        <div className="mt-4 text-xl font-medium text-zinc-300 md:text-2xl">
          Four fragmented systems become one end-to-end athlete workflow.
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.08fr]">
        <GlassCard accentColor={COLORS.sky}>
          <div className="p-5 md:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Fragmented today</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {COMPETITOR_CARDS.map((card, index) => {
                const Icon = card.icon;

                return (
                  <motion.div
                    key={card.name}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 * index }}
                    className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ background: `${card.accent}16`, color: card.accent }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: card.accent }}>
                      {card.category}
                    </div>
                    <div className="mt-2 text-2xl font-black leading-tight text-white">{card.name}</div>
                    <div className="mt-3 text-lg leading-snug text-zinc-300">{card.detail}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </GlassCard>

        <GlassCard accentColor={COLORS.lime}>
          <div className="flex h-full flex-col justify-between p-6 md:p-7">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Unified here</div>
              <div className="mt-3 text-4xl font-black leading-[0.96] text-white md:text-5xl">
                Pulse Check x AuntEdna turns that stack into one system.
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Detect the signal', accent: COLORS.sky },
                { label: 'Regulate in the moment', accent: COLORS.purple },
                { label: 'Route to clinical care', accent: COLORS.pink },
                { label: 'Escalate if crisis appears', accent: COLORS.red },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[22px] border px-4 py-5"
                  style={{ borderColor: `${item.accent}35`, background: `${item.accent}12` }}
                >
                  <div className="text-2xl font-black leading-tight text-white">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Chip accent={COLORS.sky}>WHOOP-like readiness</Chip>
              <Chip accent={COLORS.purple}>Calm-like regulation</Chip>
              <Chip accent={COLORS.pink}>Spring-style routing</Chip>
              <Chip accent={COLORS.red}>988 backstop</Chip>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard accentColor={COLORS.lime}>
        <div className="overflow-x-auto p-4 md:p-6">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[1.55fr_repeat(5,1fr)] gap-3 border-b border-white/10 pb-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Capability</div>
              <div className="text-center text-sm font-semibold text-zinc-400">WHOOP</div>
              <div className="text-center text-sm font-semibold text-zinc-400">Calm</div>
              <div className="text-center text-sm font-semibold text-zinc-400">Spring Health</div>
              <div className="text-center text-sm font-semibold text-zinc-400">988</div>
              <div className="text-center text-sm font-semibold text-white">Pulse Check x AuntEdna</div>
            </div>

            <div className="mt-4 space-y-3">
              {COMPETITIVE_ROWS.map((row) => (
                <div
                  key={row.feature}
                  className="grid grid-cols-[1.55fr_repeat(5,1fr)] items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4"
                >
                  <div className="text-lg font-semibold text-white">{row.feature}</div>
                  <ComparisonCell positive={row.whoop} accent={COLORS.sky} />
                  <ComparisonCell positive={row.calm} accent={COLORS.purple} />
                  <ComparisonCell positive={row.spring} accent={COLORS.pink} />
                  <ComparisonCell positive={row.lifeline} accent={COLORS.red} />
                  <ComparisonCell positive={row.pulse} accent={COLORS.lime} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const SceneMarket: React.FC = () => (
  <SceneFrame accent={COLORS.sky}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-5xl">
        <SlideKicker>Market size & share</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          A fundable market with a focused beachhead.
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {MARKET_CARDS.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index }}
          >
            <GlassCard accentColor={card.accent} className="h-full">
              <div className="flex min-h-[18rem] flex-col justify-between p-6 md:p-7">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: card.accent }}>
                  {card.label}
                </div>
                <div className="text-6xl font-black text-white md:text-7xl">{card.value}</div>
                <div className="text-xl font-semibold leading-tight text-zinc-200">{card.detail}</div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard accentColor={COLORS.sky}>
        <div className="p-5 md:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Support evidence</div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Chip accent={COLORS.lime}>NFHS: 8,266,244 high school sports participants</Chip>
            <Chip accent={COLORS.sky}>NCAA: 520,470 student-athletes</Chip>
            <Chip accent={COLORS.purple}>Modeled with blended annual organization pricing</Chip>
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const SceneGTM: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-5xl">
        <SlideKicker>Go-to-market</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          Pilot first. Prove workflow. Convert to contracts.
        </h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {GTM_LANES.map((lane, index) => (
          <motion.div
            key={lane.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index }}
          >
            <GlassCard accentColor={lane.accent} className="h-full">
              <div className="flex min-h-[18rem] flex-col justify-between p-6 md:p-7">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: lane.accent }}>
                    Lane {index + 1}
                  </div>
                  <div className="mt-3 text-3xl font-black leading-tight text-white">{lane.title}</div>
                  <div className="mt-4 text-xl leading-snug text-zinc-300">{lane.detail}</div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {lane.chips.map((chip) => (
                    <Chip key={`${lane.title}-${chip}`} accent={lane.accent}>
                      {chip}
                    </Chip>
                  ))}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  </SceneFrame>
);

const SceneTeam: React.FC = () => (
  <SceneFrame accent={COLORS.purple}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-5xl">
        <SlideKicker>Team</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          The right mix of performance, product, and care.
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TEAM_MEMBERS.map((member, index) => (
          <motion.div
            key={member.name}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * index }}
          >
            <GlassCard accentColor={member.accent} className="h-full">
              <div className="p-4">
                <ContactCard {...member} />
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  </SceneFrame>
);

const SceneEvidence: React.FC = () => (
  <SceneFrame accent={COLORS.sky}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-6xl">
        <SlideKicker>Other</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          The AI read is unique to the athlete, the sport, and the moment.
        </h1>
        <div className="mt-4 text-xl font-medium text-zinc-300 md:text-2xl">
          Not generic wellness. A sport-aware, athlete-specific signal layer.
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.08fr]">
        <GlassCard accentColor={COLORS.sky}>
          <div className="flex h-full min-h-[22rem] flex-col justify-between p-6 md:p-7">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Why it matters</div>
              <div className="mt-3 text-4xl font-black leading-[0.96] text-white md:text-5xl">
                A sprinter, lineman, and point guard should not get the same read.
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Chip accent={COLORS.sky}>Personal baseline</Chip>
              <Chip accent={COLORS.purple}>Sport context</Chip>
              <Chip accent={COLORS.lime}>Behavior + biometrics</Chip>
              <Chip accent={COLORS.red}>Adaptive intervention</Chip>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 md:p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Sport-aware examples</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Sprinter', accent: COLORS.sky },
                  { label: 'Point guard', accent: COLORS.purple },
                  { label: 'Lineman', accent: COLORS.lime },
                  { label: 'Goalkeeper', accent: COLORS.red },
                ].map((sport) => (
                  <div
                    key={sport.label}
                    className="rounded-[20px] border px-4 py-4 text-xl font-black text-white"
                    style={{ borderColor: `${sport.accent}35`, background: `${sport.accent}12` }}
                  >
                    {sport.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-4 sm:grid-cols-2">
          {AI_CAPABILITY_CARDS.map((point, index) => {
          const Icon = point.icon;
          return (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index }}
            >
              <GlassCard accentColor={point.accent} className="h-full">
                <div className="flex min-h-[15rem] flex-col justify-between p-6 md:p-7">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: `${point.accent}14`, color: point.accent }}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="text-3xl font-black leading-tight text-white">{point.title}</div>
                  <div className="text-xl leading-snug text-zinc-300">{point.detail}</div>
                </div>
              </GlassCard>
            </motion.div>
          );
          })}
        </div>
      </div>
    </div>
  </SceneFrame>
);

const SceneSummary: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
      <div>
        <SlideKicker>Why pick us</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-7xl">
          We are building the missing link between performance tech and care.
        </h1>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Chip accent={COLORS.sky}>Pulse Check</Chip>
          <Chip accent={COLORS.red}>AuntEdna</Chip>
          <Chip accent={COLORS.purple}>Signal-to-care</Chip>
        </div>
      </div>

      <div className="grid gap-4">
        {SUMMARY_POINTS.map((point, index) => (
          <motion.div
            key={point}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 * index }}
          >
            <GlassCard accentColor={[COLORS.sky, COLORS.red, COLORS.lime][index] ?? COLORS.lime}>
              <div className="p-6 md:p-7">
                <div className="text-2xl font-black leading-tight text-white md:text-3xl">{point}</div>
              </div>
            </GlassCard>
          </motion.div>
        ))}

        <GlassCard accentColor={COLORS.lime}>
          <div className="flex items-center justify-between gap-4 p-6 md:p-7">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Contact</div>
              <div className="mt-2 text-2xl font-black text-white">tre@fitwithpulse.ai</div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0FE10]/12 text-[#E0FE10]">
              <Mail className="h-7 w-7" />
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  </SceneFrame>
);

const PulseAuntEdnaPitchPage: React.FC = () => {
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
    if (slide === 0) return <SceneTitle />;
    if (slide === 1) return <SceneProblem />;
    if (slide === 2) return <SceneSolution />;
    if (slide === 3) return <SceneHowItWorks />;
    if (slide === 4) return <SceneUniqueness />;
    if (slide === 5) return <SceneMarket />;
    if (slide === 6) return <SceneGTM />;
    if (slide === 7) return <SceneTeam />;
    if (slide === 8) return <SceneEvidence />;
    return <SceneSummary />;
  }, [slide]);

  return (
    <>
      <Head>
        <title>Pulse Check x AuntEdna Pitch | Pulse Intelligence Labs</title>
        <meta
          name="description"
          content="Pitch presentation for Pulse Check x AuntEdna, the signal-to-care platform for athlete mental performance."
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

          <footer className="sticky bottom-0 z-20 mx-4 mb-4 mt-2 flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-black/25 px-5 py-4 backdrop-blur-xl md:mx-6">
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

export default PulseAuntEdnaPitchPage;
