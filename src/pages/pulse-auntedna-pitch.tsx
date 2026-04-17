import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Brain,
  CheckCircle2,
  Globe,
  GraduationCap,
  Landmark,
  Mail,
  Medal,
  PhoneCall,
  School,
  Shield,
  Sparkles,
  Trophy,
  Wind,
  XCircle,
  Zap,
} from 'lucide-react';

const TOTAL_SLIDES = 18;

const SLIDE_META = [
  { label: 'Title', eyebrow: 'Slide 1' },
  { label: 'Meet Nakyala', eyebrow: 'Slide 2' },
  { label: 'Problem', eyebrow: 'Slide 3' },
  { label: 'Solution', eyebrow: 'Slide 4' },
  { label: 'How It Works', eyebrow: 'Slide 5' },
  { label: 'Clinical Routing', eyebrow: 'Slide 6' },
  { label: 'Welfare Check', eyebrow: 'Slide 7' },
  { label: 'Competitive Story', eyebrow: 'Slide 8' },
  { label: 'Competitive Proof', eyebrow: 'Slide 9' },
  { label: 'AI Edge', eyebrow: 'Slide 10' },
  { label: 'Building Blocks', eyebrow: 'Slide 11' },
  { label: 'Full TAM', eyebrow: 'Slide 12' },
  { label: 'Beachhead', eyebrow: 'Slide 13' },
  { label: 'Path to $100M', eyebrow: 'Slide 14' },
  { label: 'Go-To-Market', eyebrow: 'Slide 15' },
  { label: 'Team', eyebrow: 'Slide 16' },
  { label: 'Who Supports Us', eyebrow: 'Slide 17' },
  { label: 'Summary', eyebrow: 'Slide 18' },
] as const;

const transition = { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const };

const COLORS = {
  lime: '#E0FE10',
  sky: '#38BDF8',
  purple: '#8B5CF6',
  pink: '#F472B6',
  teal: '#10B981',
  orange: '#FF6B35',
  red: '#FB7185',
  amber: '#F59E0B',
} as const;

const PROBLEM_STATS = [
  {
    value: '4x',
    label: 'crisis risk',
    detail: 'more likely to face a mental health crisis.',
    accent: COLORS.red,
  },
  {
    value: '60%',
    label: 'pre-competition anxiety',
    detail: 'feel elevated anxiety before competition.',
    accent: COLORS.sky,
  },
  {
    value: '10%',
    label: 'coach visibility',
    detail: 'say something to a coach before it breaks.',
    accent: COLORS.lime,
  },
] as const;

const SOLUTION_PROOF_CHIPS = [
  {
    label: 'Better than surveys',
    title: 'Passive biometrics',
    detail: 'catch the signal before an athlete reports it.',
    accent: '#5B8DEF',
  },
  {
    label: 'Calmer than crisis-only',
    title: 'In-flow regulation',
    detail: 'intervenes before the spiral starts.',
    accent: COLORS.lime,
  },
  {
    label: 'Connected to real care',
    title: 'Clinical handoff',
    detail: 'routes to a licensed provider when needed.',
    accent: '#EC4899',
  },
] as const;

const SOLUTION_STAGES = [
  {
    number: '1',
    title: 'Detect',
    detail: 'Pulse Check finds the performance signal early.',
    tagLead: 'Passive',
    tagValue: 'Biometric',
    accent: '#5B8DEF',
    icon: Brain,
  },
  {
    number: '2',
    title: 'Regulate',
    detail: 'Nora intervenes in-chat to help the athlete settle in real time.',
    tagLead: 'In-flow',
    tagValue: 'AI Coach',
    accent: COLORS.lime,
    icon: Wind,
  },
  {
    number: '3',
    title: 'Route',
    detail: 'AuntEdna becomes the clinical destination when escalation is needed.',
    tagLead: 'Clinical',
    tagValue: 'Handoff',
    accent: '#EC4899',
    icon: Shield,
  },
] as const;

const COMPETITOR_CARDS = [
  {
    name: 'WHOOP',
    category: 'Performance wearable',
    detail: 'Recovery, strain, and biometrics.',
    accent: COLORS.orange,
    icon: Zap,
    scaleLabel: 'User base',
    scaleValue: '2.5M+ members',
    costLabel: 'Access cost',
    costValue: 'Starts at $199/yr',
  },
  {
    name: 'Calm',
    category: 'Mindfulness app',
    detail: 'Breathwork, meditation, and calm.',
    accent: COLORS.purple,
    icon: Wind,
    scaleLabel: 'User base',
    scaleValue: '180M+ downloads',
    costLabel: 'Access cost',
    costValue: '$69.99/yr',
  },
  {
    name: 'BetterHelp',
    category: 'Therapy platform',
    detail: 'Licensed therapy access and provider matching.',
    accent: COLORS.teal,
    icon: Shield,
    scaleLabel: 'People helped',
    scaleValue: '5M+ globally',
    costLabel: 'Access cost',
    costValue: '$65-$100/week',
  },
  {
    name: '988',
    category: 'Crisis line',
    detail: 'Immediate crisis counseling.',
    accent: COLORS.red,
    icon: PhoneCall,
    scaleLabel: 'Annual call volume',
    scaleValue: '1.9M calls/year',
    costLabel: 'Access cost',
    costValue: 'Free 24/7',
  },
] as const;

const COMPETITIVE_ROWS = [
  {
    feature: 'Biometric performance signal',
    whoop: 'yes',
    calm: 'no',
    clinical: 'no',
    lifeline: 'no',
    pulse: 'yes',
  },
  {
    feature: 'AI-driven mental performance coaching',
    whoop: 'no',
    calm: 'partial',
    clinical: 'no',
    lifeline: 'no',
    pulse: 'yes',
  },
  {
    feature: 'In-moment regulation',
    whoop: 'no',
    calm: 'yes',
    clinical: 'no',
    lifeline: 'no',
    pulse: 'yes',
  },
  {
    feature: 'Therapy access and clinical routing',
    whoop: 'no',
    calm: 'no',
    clinical: 'partial',
    lifeline: 'no',
    pulse: 'yes',
  },
  {
    feature: 'Crisis detection and escalation',
    whoop: 'no',
    calm: 'no',
    clinical: 'no',
    lifeline: 'yes',
    pulse: 'yes',
  },
  {
    feature: 'Athlete-specific context and language',
    whoop: 'partial',
    calm: 'no',
    clinical: 'no',
    lifeline: 'no',
    pulse: 'yes',
  },
  {
    feature: 'Unified detect → regulate → route → escalate pipeline',
    whoop: 'no',
    calm: 'no',
    clinical: 'no',
    lifeline: 'no',
    pulse: 'yes',
  },
] as const;

const BUILDING_BLOCK_TIERS = [
  {
    tier: 'Segment 1',
    name: 'D2 / D3 Schools',
    detail: 'Fastest close cycle, highest volume opportunity',
    price: '$75K',
    unit: 'avg annual contract',
    example: '~300 student-athletes per school',
    accent: '#6EE7B7',
    icon: School,
  },
  {
    tier: 'Segment 2',
    name: 'Mid-Major Universities',
    detail: 'Hampton, Clark Atlanta pipeline + 4-5 new',
    price: '$150K',
    unit: 'avg annual contract',
    example: '~500 student-athletes per school',
    accent: '#5B8DEF',
    icon: GraduationCap,
  },
  {
    tier: 'Segment 3',
    name: 'Power Four University',
    detail: 'ACC target via Marques Zak',
    price: '$400K',
    unit: 'avg annual contract',
    example: '~700 student-athletes per school',
    accent: '#A855F7',
    icon: Landmark,
  },
  {
    tier: 'Segment 4',
    name: 'Professional Team',
    detail: 'New England Patriots (3rd meeting post-draft)',
    price: '$500K',
    unit: 'avg annual contract',
    example: '~55 roster + practice squad',
    accent: '#F59E0B',
    icon: Trophy,
  },
  {
    tier: 'Segment 5',
    name: 'Federation / NGB',
    detail: 'USATF, NASCAR, or USA Gymnastics',
    price: '$750K',
    unit: 'avg annual contract',
    example: 'National team + development pipeline',
    accent: '#EF4444',
    icon: Medal,
  },
  {
    tier: 'Segment 6',
    name: 'League / International',
    detail: 'NFL, NFLPA, World Athletics',
    price: '$2–65M',
    unit: 'league-wide deal',
    example: 'Entire league or governing body',
    accent: '#EC4899',
    icon: Globe,
  },
] as const;

const FULL_TAM_MARKETS = [
  {
    title: 'Sports analytics',
    scope: 'Performance data, wearable tech, and athlete monitoring infrastructure.',
    value: '$4.79B',
    accent: COLORS.sky,
  },
  {
    title: 'Mental health apps',
    scope: 'Meditation, stress support, coaching, and digital mental wellness.',
    value: '$6.52B',
    accent: COLORS.purple,
  },
  {
    title: 'Remote patient monitoring',
    scope: 'Connected care, escalation, monitoring, and intervention systems.',
    value: '$22.03B',
    accent: COLORS.red,
  },
] as const;

const FULL_TAM_TOTAL = '$33.34B';

const BEACHHEAD_MARKET_SEGMENTS = [
  {
    title: 'D2 / D3 conversions',
    detail: '3-4 schools from the fastest-close segment.',
    value: '$225K-$300K',
    accent: '#6EE7B7',
  },
  {
    title: 'Mid-major universities',
    detail: 'Clark Atlanta, Hampton, plus 4-5 new logos.',
    value: '$900K-$1.05M',
    accent: '#5B8DEF',
  },
  {
    title: 'Power Four entry',
    detail: '1 ACC logo through Marques Zak.',
    value: '$400K',
    accent: '#A855F7',
  },
  {
    title: 'Professional team',
    detail: 'Patriots lane re-engages after the draft.',
    value: '$500K',
    accent: '#F59E0B',
  },
  {
    title: 'Federation / NGB',
    detail: 'USATF, NASCAR, or USA Gymnastics.',
    value: '$750K',
    accent: '#EF4444',
  },
] as const;

const BEACHHEAD_TOTAL = '~$3.0M';

const PATH_PHASE_ONE = [
  {
    label: 'D2 / D3',
    count: '3–4',
    detail: 'Fastest close, volume play',
    revenue: '$225–300K',
    accent: '#6EE7B7',
  },
  {
    label: 'Mid-Major',
    count: '6–7',
    detail: 'Hampton, Clark Atlanta + new',
    revenue: '$900K–$1.05M',
    accent: '#5B8DEF',
  },
  {
    label: 'Power Four',
    count: '1',
    detail: 'ACC via Marques Zak',
    revenue: '$400K',
    accent: '#A855F7',
  },
  {
    label: 'Pro Team',
    count: '1',
    detail: 'Patriots — 3rd meeting',
    revenue: '$500K',
    accent: '#F59E0B',
  },
  {
    label: 'Federation',
    count: '1',
    detail: 'USATF, NASCAR, or USA Gym',
    revenue: '$750K',
    accent: '#EF4444',
  },
] as const;

const PATH_PHASE_TWO = [
  {
    label: '+ D2 / D3',
    count: '+9',
    detail: 'Conference bundles',
    revenue: '$1.7M',
    accent: '#6EE7B7',
  },
  {
    label: '+ Power Four',
    count: '+7',
    detail: 'Expand to 7 more P4',
    revenue: '$2.8M',
    accent: '#A855F7',
  },
  {
    label: '+ Pro Teams',
    count: '+11',
    detail: 'NFL, NBA, MLS — Westbrook, Patriots refs',
    revenue: '$5.5M',
    accent: '#F59E0B',
  },
  {
    label: '+ NGBs',
    count: '+7',
    detail: 'Remaining federations',
    revenue: '$5.25M',
    accent: '#EF4444',
  },
  {
    label: 'League + Intl',
    count: '2',
    detail: 'NFL / NFLPA + World Athletics',
    revenue: '$67M',
    accent: '#EC4899',
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

const ATHLETE_SPOTLIGHT = {
  name: 'Nakyala',
  sport: 'Volleyball',
  school: 'Clark Atlanta University',
  conference: 'CIAA',
  position: 'Defensive Specialist',
  number: '#21',
  role: 'Pilot athlete spotlight',
  imageSrc: '/nakyala-cau.jpg',
  quote: 'A live university athlete is how we anchor the product story, the care story, and the commercial story.',
  quoteAttribution: 'Pulse Check × AuntEdna Pilot Thesis',
  biometrics: [
    { label: 'HRV baseline', value: '62 ms', accent: COLORS.sky },
    { label: 'Pre-match focus', value: 'High', accent: COLORS.lime },
    { label: 'Nora check-ins', value: '14 / wk', accent: COLORS.pink },
  ],
  focus: [
    { title: 'Game-day pressure', detail: 'The signal starts before a visible breakdown.', accent: COLORS.sky },
    { title: 'In-the-moment support', detail: 'Help needs to live inside the athlete flow.', accent: COLORS.lime },
    { title: 'Care if needed', detail: 'Escalation is available when the moment goes beyond coaching.', accent: COLORS.red },
  ],
} as const;

const TEAM_MEMBERS = [
  {
    name: 'Tremaine Grant',
    role: 'Founder & CEO',
    imageSrc: '/TremaineFounder.jpg',
    accent: COLORS.lime,
    org: 'Pulse Intelligence Labs',
    email: 'tre@fitwithpulse.ai',
    badges: ['D1 Athlete', 'Biotech', 'Engineer'],
  },
  {
    name: 'Bobby Nweke',
    role: 'Chief of Staff',
    imageSrc: '/bobbyAdvisor.jpg',
    accent: COLORS.sky,
    org: 'Pulse Intelligence Labs',
    email: 'bobby@fitwithpulse.ai',
    badges: ['TED', 'Harvard', 'TFA'],
  },
  {
    name: 'Dr. Tracey',
    role: 'Clinical Partner',
    imageSrc: '/dr-tracey.png',
    accent: COLORS.pink,
    org: 'AuntEdna',
    email: 'tracey@auntedna.ai',
    badges: ['Clinical care', 'Escalation path', 'Provider workflow'],
  },
  {
    name: 'Jelanna',
    role: 'AuntEdna Team Contact',
    imageSrc: '/jelanna.jpg',
    accent: COLORS.red,
    org: 'AuntEdna',
    email: 'jelanna@auntedna.ai',
    badges: ['Operations', 'Care coordination', 'Pilot support'],
  },
] as const;

const SUPPORT_NETWORK = [
  { name: 'NCAA', detail: 'College athletics ecosystem credibility', accent: COLORS.lime },
  { name: 'ACC CMO', detail: 'Conference-level sports medicine support', accent: COLORS.sky },
  { name: 'Cooley', detail: 'Legal and venture infrastructure', accent: COLORS.purple },
  { name: 'National Science Foundation', detail: 'Scientific and research validation', accent: COLORS.red },
  { name: 'AWS Startups', detail: 'Startup infrastructure and technical backing', accent: COLORS.orange },
  { name: 'Techstars', detail: 'Venture network and founder support', accent: COLORS.teal },
  { name: 'LAUNCH', detail: 'Jason Calacanis ecosystem and investor adjacency', accent: COLORS.pink },
] as const;

const SPORT_PRECISION_MAP = [
  {
    name: 'Track & Field',
    icon: '🏃',
    accent: '#00D4AA',
    glow: 'rgba(0,212,170,0.18)',
    markers: ['CNS Load Profile', 'Sprint-Specific HRV', 'Explosive Focus (8-12s)', 'Meet-Week Taper Logic', 'Block Periodization'],
  },
  {
    name: 'Swimming',
    icon: '🏊',
    accent: '#5B8DEF',
    glow: 'rgba(91,141,239,0.18)',
    markers: ['Taper-Phase Psychology', 'Monotony Tolerance', 'Race Activation Protocol', 'Internal Pace Clock', 'Meet-Day Arousal Cal.'],
  },
  {
    name: 'Golf',
    icon: '⛳',
    accent: '#F59E0B',
    glow: 'rgba(245,158,11,0.18)',
    markers: ['Sustained Attention (4h+)', 'Pre-Shot Routine Decay', 'Decision Fatigue (Holes 12-18)', 'Round-to-Round Recovery', 'Tournament Pressure Scale'],
  },
  {
    name: 'Football',
    icon: '🏈',
    accent: '#A855F7',
    glow: 'rgba(168,85,247,0.18)',
    markers: ['Contact-Load Accumulation', 'Sub-Concussive Monitoring', 'Position-Specific Demands', 'Mood-Contact Correlation', 'Practice-to-Game Ratio'],
  },
  {
    name: 'Basketball',
    icon: '🏀',
    accent: '#EF4444',
    glow: 'rgba(239,68,68,0.18)',
    markers: ['Reactive Decision Load', 'Game-Load Periodization', 'Travel Fatigue Adj.', 'Rapid Read Focus (2-6s)', 'Clutch-Pressure Profile'],
  },
] as const;

const SPORT_ORBIT_SLOTS = [
  { x: 50, y: 20 },
  { x: 77, y: 38 },
  { x: 67, y: 79 },
  { x: 33, y: 79 },
  { x: 23, y: 38 },
] as const;

const SPORT_MARKER_SLOT_MAP = [
  [
    { x: 14, y: 13 },
    { x: 31, y: 8 },
    { x: 50, y: 6 },
    { x: 69, y: 8 },
    { x: 86, y: 13 },
  ],
  [
    { x: 88, y: 18 },
    { x: 94, y: 28 },
    { x: 96, y: 40 },
    { x: 95, y: 52 },
    { x: 90, y: 62 },
  ],
  [
    { x: 90, y: 68 },
    { x: 94, y: 78 },
    { x: 95, y: 88 },
    { x: 88, y: 96 },
    { x: 78, y: 98 },
  ],
  [
    { x: 22, y: 98 },
    { x: 12, y: 96 },
    { x: 5, y: 88 },
    { x: 6, y: 78 },
    { x: 10, y: 68 },
  ],
  [
    { x: 10, y: 62 },
    { x: 5, y: 52 },
    { x: 4, y: 40 },
    { x: 6, y: 28 },
    { x: 12, y: 18 },
  ],
] as const;

const MINDMAP_PARTICLES = Array.from({ length: 42 }, (_, index) => ({
  left: `${(index * 17) % 100}%`,
  top: `${(index * 29) % 100}%`,
  size: 1 + (index % 3),
  delay: (index % 7) * 0.35,
  duration: 3 + (index % 5) * 0.55,
  opacity: 0.12 + (index % 4) * 0.05,
}));

const FINAL_IMPACT_LINES = [
  {
    title: 'See the signal earlier',
    detail: 'Pressure gets surfaced before it becomes a staff surprise.',
    accent: COLORS.sky,
  },
  {
    title: 'Stabilize inside the athlete flow',
    detail: 'The first intervention happens in the moment, not after the breakdown.',
    accent: COLORS.lime,
  },
  {
    title: 'Route to real care',
    detail: 'When it moves beyond coaching, AuntEdna becomes the clinical destination.',
    accent: COLORS.pink,
  },
] as const;

const FINAL_WEBSITES = [
  {
    name: 'Pulse Check',
    url: 'fitwithpulse.ai/pulsecheck',
    href: 'https://fitwithpulse.ai/pulsecheck',
    detail: 'Signal detection + athlete regulation',
    accent: COLORS.lime,
  },
  {
    name: 'AuntEdna',
    url: 'AuntEdna.ai',
    href: 'https://auntedna.ai',
    detail: 'Clinical destination + response path',
    accent: COLORS.pink,
  },
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
    <div className="relative z-10 flex min-h-full px-5 py-6 md:h-full md:px-10 md:py-8">
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

const WhoopWordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={className}>
    <div
      className="inline-flex rounded-2xl border px-4 py-3"
      style={{
        borderColor: `${COLORS.orange}40`,
        background: `${COLORS.orange}10`,
        boxShadow: '0 0 28px rgba(255,107,53,0.12)',
      }}
    >
      <div
        className="text-[30px] font-black uppercase leading-none tracking-[-0.12em]"
        style={{
          color: COLORS.orange,
          textShadow: '0 0 18px rgba(255,107,53,0.22)',
        }}
      >
        WHOOP
      </div>
    </div>
  </div>
);

const CalmWordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={className}>
    <div className="inline-flex rounded-2xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-4 py-3 shadow-[0_0_28px_rgba(139,92,246,0.12)]">
      <div
        className="text-[42px] leading-none"
        style={{
          fontFamily: '"Brush Script MT", "Segoe Script", "Snell Roundhand", cursive',
          background: 'linear-gradient(135deg, #6EE7F9 0%, #60A5FA 52%, #8B5CF6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Calm
      </div>
    </div>
  </div>
);

const BetterHelpWordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={className}>
    <div className="inline-flex rounded-2xl border border-[#10B981]/25 bg-[#10B981]/10 px-4 py-3 shadow-[0_0_28px_rgba(16,185,129,0.12)]">
      <div className="relative inline-flex items-end leading-none">
        <span className="text-[33px] font-black tracking-[-0.07em] text-[#FBBF24]">Better</span>
        <span className="relative ml-1 text-[33px] font-black tracking-[-0.07em] text-[#84CC16]">
          <span className="absolute -top-3 left-7 h-5 w-10 rounded-t-full bg-[#FACC15]" />
          <span className="relative">Help</span>
        </span>
      </div>
    </div>
  </div>
);

const Lifeline988Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={className}>
    <div className="inline-flex rounded-2xl border border-[#1777B7]/25 bg-[#1777B7]/10 px-4 py-3 shadow-[0_0_28px_rgba(23,119,183,0.14)]">
      <div className="flex flex-col">
        <div className="text-[60px] font-black leading-[0.85] tracking-[-0.08em] text-[#1777B7]">988</div>
        <div className="mt-2 h-[2px] w-full bg-[#1777B7]" />
        <div className="mt-3 text-[13px] font-semibold uppercase leading-tight tracking-[0.16em] text-[#1777B7]">
          Suicide &amp; Crisis
        </div>
        <div className="mt-1 text-[24px] font-black uppercase leading-none tracking-[0.08em] text-[#1777B7]">
          Lifeline
        </div>
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

const SceneTitle: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="relative -mx-6 -my-8 min-h-[calc(100vh-6.5rem)] overflow-hidden md:-mx-14 md:-my-12 md:h-[calc(100vh-9rem)]">
      <div className="absolute inset-0">
        <img
          src="/pitch-assets/cover-intensity.jpg"
          alt="Focused athlete under pressure"
          className="h-full w-full object-cover object-[74%_center] md:object-[72%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,4,6,0.9)_0%,rgba(3,4,6,0.76)_30%,rgba(3,4,6,0.58)_54%,rgba(3,4,6,0.84)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_22%,rgba(0,212,170,0.12),transparent_28%),radial-gradient(circle_at_84%_76%,rgba(200,255,0,0.1),transparent_28%),radial-gradient(circle_at_72%_18%,rgba(168,85,247,0.08),transparent_22%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.55))]" />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
        <div className="absolute left-[-12%] top-[-18%] h-[34rem] w-[34rem] rounded-full bg-[#00D4AA]/10 blur-3xl md:h-[42rem] md:w-[42rem]" />
        <motion.div
          className="absolute bottom-[-20%] right-[-10%] h-[38rem] w-[38rem] rounded-full bg-[#E0FE10]/8 blur-3xl md:h-[46rem] md:w-[46rem]"
          animate={{ x: [0, -36, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute left-[38%] top-[28%] h-[24rem] w-[24rem] rounded-full bg-[#8B5CF6]/7 blur-3xl md:h-[30rem] md:w-[30rem]"
          animate={{ x: [0, 28, 0], y: [0, -34, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[3]">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <motion.path
            d="M 0 68 C 8 66, 14 74, 22 68 S 38 54, 46 60 S 58 74, 66 64 S 80 46, 88 54 S 96 66, 100 62"
            fill="none"
            stroke="rgba(200,255,0,0.22)"
            strokeWidth="0.25"
            strokeLinecap="round"
            strokeDasharray="0 1"
            animate={{ pathLength: [0.16, 1, 0.84], opacity: [0.16, 0.4, 0.22] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.path
            d="M 0 54 C 10 56, 18 48, 30 50 S 42 62, 52 46 S 68 34, 80 46 S 92 68, 100 60"
            fill="none"
            stroke="rgba(0,212,170,0.18)"
            strokeWidth="0.2"
            strokeLinecap="round"
            strokeDasharray="0 1"
            animate={{ pathLength: [0.08, 0.92, 0.72], opacity: [0.08, 0.28, 0.14] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.path
            d="M 0 42 C 9 40, 16 48, 24 44 S 38 30, 46 38 S 60 56, 70 48 S 86 26, 100 30"
            fill="none"
            stroke="rgba(168,85,247,0.16)"
            strokeWidth="0.18"
            strokeLinecap="round"
            strokeDasharray="0 1"
            animate={{ pathLength: [0.2, 0.88, 0.6], opacity: [0.08, 0.24, 0.12] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
        {[
          { left: '16%', top: '22%', color: '#E0FE10' },
          { left: '62%', top: '36%', color: '#00D4AA' },
          { left: '83%', top: '58%', color: '#FFFFFF' },
          { left: '28%', top: '70%', color: '#8B5CF6' },
        ].map((particle, index) => (
          <motion.div
            key={`${particle.left}-${particle.top}`}
            className="absolute h-1 w-1 rounded-full"
            style={{ left: particle.left, top: particle.top, background: particle.color, boxShadow: `0 0 14px ${particle.color}` }}
            animate={{ opacity: [0.25, 1, 0.25], scale: [1, 1.6, 1] }}
            transition={{ duration: 2.8 + index * 0.55, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
        const positionClass =
          corner === 'tl'
            ? 'left-6 top-6'
            : corner === 'tr'
              ? 'right-6 top-6 scale-x-[-1]'
              : corner === 'bl'
                ? 'bottom-6 left-6 scale-y-[-1]'
                : 'bottom-6 right-6 scale-[-1]';

        return (
          <motion.div
            key={corner}
            className={`pointer-events-none absolute z-[5] h-7 w-7 ${positionClass}`}
            initial={{ opacity: 0, scale: 0.55 }}
            animate={{ opacity: 0.6, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.1 }}
          >
            <div className="absolute left-0 top-0 h-[1.5px] w-4 bg-[#E0FE10]" />
            <div className="absolute left-0 top-0 h-4 w-[1.5px] bg-[#E0FE10]" />
          </motion.div>
        );
      })}

      <div className="relative z-10 flex min-h-[calc(100vh-6.5rem)] items-center justify-center px-6 py-24 text-center md:h-[calc(100vh-9rem)] md:px-14">
        <motion.div
          className="max-w-[110rem]"
          initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.2, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="flex flex-wrap items-center justify-center gap-3 text-center leading-[0.88] md:gap-8"
            style={{ fontFamily: '"Bebas Neue", Impact, "Arial Narrow", sans-serif' }}
          >
            <span className="text-[4.8rem] tracking-[-0.05em] text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.08)] md:text-[10rem] xl:text-[11.2rem]">
              Pulse Check
            </span>
            <motion.span
              className="relative text-[3.8rem] leading-none text-[#E0FE10] md:text-[7rem] xl:text-[8rem]"
              animate={{ scale: [1, 1.06, 1], textShadow: ['0 0 20px rgba(224,254,16,0.35)', '0 0 40px rgba(224,254,16,0.65)', '0 0 20px rgba(224,254,16,0.35)'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              ×
              <span className="pointer-events-none absolute inset-[-28%] -z-10 rounded-full bg-[radial-gradient(circle,rgba(224,254,16,0.24),transparent_62%)]" />
            </motion.span>
            <span
              className="text-[4.8rem] tracking-[-0.05em] md:text-[10rem] xl:text-[11.2rem]"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #ffffff 30%, #EC4899 55%, #FF6B35 82%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AuntEdna
            </span>
          </div>

          <motion.div
            className="mx-auto mt-8 max-w-5xl text-lg leading-relaxed text-white/60 md:mt-9 md:text-[1.4rem]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.9 }}
          >
            The <span className="font-medium text-[#E0FE10]">signal-to-care platform</span> for{' '}
            <span className="font-medium text-white">elite athlete mental performance</span> and{' '}
            <span className="font-medium text-white">mental care.</span>
          </motion.div>

          <motion.div
            className="mt-7 flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium uppercase tracking-[0.26em] text-white/30 md:mt-8 md:gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.15 }}
          >
            {[
              { label: 'Detect', color: COLORS.teal },
              { label: 'Regulate', color: COLORS.lime },
              { label: 'Route', color: COLORS.purple },
              { label: 'Escalate', color: COLORS.pink },
            ].map((step, index) => (
              <React.Fragment key={step.label}>
                <div className="flex items-center gap-2">
                  <span
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ background: step.color, boxShadow: `0 0 8px ${step.color}` }}
                  />
                  <span>{step.label}</span>
                </div>
                {index < 3 ? <span className="text-white/18">→</span> : null}
              </React.Fragment>
            ))}
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-9 left-6 z-10 flex flex-col gap-2 md:left-14"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 1.35 }}
      >
        <div className="text-[9px] uppercase tracking-[0.3em] text-white/28">A co-production between</div>
        <div className="flex items-center gap-3 text-sm text-white/65 md:text-base">
          <span className="font-semibold tracking-[0.04em] text-white">Pulse Intelligence Labs</span>
          <span className="text-white/20">×</span>
          <span className="font-semibold tracking-[0.04em] text-white">AuntEdna.ai</span>
        </div>
      </motion.div>
    </div>
  </SceneFrame>
);

const SceneMeetNakyala: React.FC = () => (
  <SceneFrame accent={COLORS.purple}>
    <div className="relative flex min-h-[40rem] flex-col">
      <div className="grid flex-1 items-start gap-8 xl:grid-cols-[1.02fr_0.98fr] xl:gap-10">
        <div className="flex h-full flex-col">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#E0FE10]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E0FE10] shadow-[0_0_8px_rgba(224,254,16,0.4)]" />
              {ATHLETE_SPOTLIGHT.role}
            </div>

            <div className="mt-6 font-['Bebas_Neue'] text-[1.65rem] leading-none tracking-[0.12em] text-white/55 md:text-[1.95rem]">
              MEET
            </div>
            <h1
              className="mt-2 font-['Bebas_Neue'] text-[5.3rem] leading-[0.84] tracking-[-0.04em] md:text-[7rem] xl:text-[8.4rem]"
              style={{
                background: 'linear-gradient(135deg,#ffffff 0%,#ffffff 42%,#A855F7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 60px rgba(168,85,247,0.15)',
              }}
            >
              {ATHLETE_SPOTLIGHT.name}.
            </h1>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-medium tracking-[0.03em] text-white/65 md:text-base">
              <span className="font-semibold text-[#A855F7]">{ATHLETE_SPOTLIGHT.sport}</span>
              <span className="text-white/18">·</span>
              <span>{ATHLETE_SPOTLIGHT.position}</span>
              <span className="text-white/18">·</span>
              <span>{ATHLETE_SPOTLIGHT.number}</span>
            </div>
            <div className="mt-2 text-sm tracking-[0.02em] text-white/38 md:text-base">
              {ATHLETE_SPOTLIGHT.school} · {ATHLETE_SPOTLIGHT.conference}
            </div>

            <div className="mt-6 inline-flex items-center gap-3 self-start rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-[#E0FE10] shadow-[0_0_8px_rgba(224,254,16,0.45)] animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
                Active pilot · <span className="text-white">{ATHLETE_SPOTLIGHT.school}</span>
              </span>
            </div>
          </motion.div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {ATHLETE_SPOTLIGHT.focus.map((item, index) => (
              <motion.div
                key={item.title}
                className="relative rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-xl transition-transform duration-300 hover:-translate-y-0.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.95 + index * 0.12, ease: 'easeOut' }}
              >
                <div
                  className="absolute left-3 right-3 top-0 h-[2px] rounded-b-sm"
                  style={{ background: item.accent }}
                />
                <div className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: item.accent }}>
                  {index === 0 ? 'The signal' : index === 1 ? 'The intervention' : 'The handoff'}
                </div>
                <div className="mt-2 text-[0.95rem] font-bold leading-tight text-white">{item.title}</div>
                <div className="mt-2 text-[13px] leading-[1.4] text-zinc-400">{item.detail}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          className="relative flex h-full items-center justify-center"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.05, delay: 0.25, ease: 'easeOut' }}
        >
          <div className="relative w-full max-w-[30rem]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] border border-[#A855F7]/20 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_80px_rgba(168,85,247,0.08)]">
              <div className="absolute inset-0 opacity-35">
                <svg viewBox="0 0 100 125" className="h-full w-full">
                  <motion.path
                    d="M0 28 C 10 24, 22 34, 36 28 S 62 18, 78 26 S 90 34, 100 30"
                    fill="none"
                    stroke="rgba(168,85,247,0.18)"
                    strokeWidth="0.35"
                    strokeLinecap="round"
                    strokeDasharray="0 1"
                    animate={{ pathLength: [0.15, 1, 0.82], opacity: [0.08, 0.32, 0.12] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.path
                    d="M0 64 C 14 54, 30 72, 46 62 S 74 46, 100 56"
                    fill="none"
                    stroke="rgba(168,85,247,0.12)"
                    strokeWidth="0.4"
                    strokeLinecap="round"
                    strokeDasharray="0 1"
                    animate={{ pathLength: [0.05, 0.94, 0.68], opacity: [0.05, 0.24, 0.1] }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.path
                    d="M0 92 C 14 88, 26 102, 46 94 S 72 82, 100 88"
                    fill="none"
                    stroke="rgba(224,254,16,0.12)"
                    strokeWidth="0.32"
                    strokeLinecap="round"
                    strokeDasharray="0 1"
                    animate={{ pathLength: [0.18, 0.92, 0.74], opacity: [0.07, 0.2, 0.08] }}
                    transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </svg>
              </div>

              <div className="absolute inset-0">
                <img
                  src={ATHLETE_SPOTLIGHT.imageSrc}
                  alt={ATHLETE_SPOTLIGHT.name}
                  className="h-full w-full object-cover object-center grayscale"
                />
              </div>

              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_52%,rgba(10,10,11,0.85)_100%)]" />

              <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full border border-[#A855F7]/30 bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#A855F7] backdrop-blur-xl">
                <span>Panthers</span>
                <span className="font-['Bebas_Neue'] text-base tracking-[0.08em] text-white">{ATHLETE_SPOTLIGHT.number.replace('#', '')}</span>
              </div>

              <div className="absolute bottom-5 left-5 right-5">
                <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#A855F7]">Why she matters</div>
                <div className="mt-2 text-[0.94rem] font-medium italic leading-[1.42] text-white md:text-[0.98rem]">
                  “{ATHLETE_SPOTLIGHT.quote}”
                </div>
                <div className="mt-3 text-[10px] tracking-[0.03em] text-white/38">— {ATHLETE_SPOTLIGHT.quoteAttribution}</div>
              </div>
            </div>

            {ATHLETE_SPOTLIGHT.biometrics.map((item, index) => {
              const placement =
                index === 0
                  ? 'left-[-1.4rem] top-14'
                  : index === 1
                    ? 'right-[-1.6rem] top-[42%]'
                    : 'left-[-1.5rem] bottom-20';
              return (
                <motion.div
                  key={item.label}
                  className={`absolute ${placement} hidden rounded-xl border border-white/10 bg-black/75 px-3 py-2 backdrop-blur-xl xl:block`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: [0, -6, 0] }}
                  transition={{
                    opacity: { duration: 0.45, delay: 1.0 + index * 0.14 },
                    y: { duration: 4, delay: index * 1.3, repeat: Infinity, ease: 'easeInOut' },
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.accent, boxShadow: `0 0 6px ${item.accent}` }} />
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">{item.label}</div>
                      <div
                        className="font-['Bebas_Neue'] text-[1rem] tracking-[0.06em]"
                        style={{ color: item.accent }}
                      >
                        {item.value}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <motion.div
        className="mt-5 flex items-center gap-3 rounded-2xl border border-[#E0FE10]/10 bg-[linear-gradient(90deg,rgba(224,254,16,0.12),transparent_70%)] px-4 py-3.5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.35 }}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E0FE10] text-black">
          <Zap className="h-4 w-4 fill-current" />
        </div>
        <div className="text-[13px] leading-[1.45] text-zinc-300 md:text-[0.92rem]">
          <span className="font-semibold text-white">A real athlete journey inside a live university environment.</span>{' '}
          {ATHLETE_SPOTLIGHT.name}&apos;s story is what Pulse Check × AuntEdna is built to support before, during, and
          after the breakdown.
        </div>
      </motion.div>
    </div>
  </SceneFrame>
);

const SceneProblem: React.FC = () => (
  <SceneFrame accent={COLORS.red}>
    <div className="relative h-full min-h-[42rem] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(251,113,133,0.14),transparent_24%),radial-gradient(circle_at_56%_46%,rgba(224,254,16,0.08),transparent_20%),radial-gradient(circle_at_82%_30%,rgba(56,189,248,0.12),transparent_26%)]" />

      <div className="relative z-10 flex h-full flex-col gap-10">
        <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr] xl:items-start">
          <div className="max-w-5xl">
            <SlideKicker>The problem</SlideKicker>
            <h1 className="mt-5 text-5xl font-black leading-[0.9] text-white md:text-7xl">
              Performance pressure gets seen too late.
            </h1>
            <p className="mt-4 max-w-4xl text-2xl font-semibold leading-tight text-[#FB7185] md:text-4xl">
              The signal spikes before the support system does.
            </p>
          </div>

          <div className="relative hidden min-h-[11rem] xl:block">
            <svg viewBox="0 0 100 24" className="absolute inset-0 z-0 h-full w-full overflow-visible">
              <motion.path
                d="M 2 17 C 12 17, 17 8, 27 8 S 44 19, 58 7 S 76 8, 86 15 S 95 25, 99 20"
                fill="none"
                stroke="url(#problem-line)"
                strokeWidth="0.55"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0.2 }}
                animate={{ pathLength: 1, opacity: 0.95 }}
                transition={{ duration: 1.4, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="problem-line" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#FB7185" stopOpacity="0.2" />
                  <stop offset="48%" stopColor="#FB7185" stopOpacity="0.95" />
                  <stop offset="78%" stopColor="#38BDF8" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#E0FE10" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              {[
                { x: 27, y: 8, color: COLORS.red },
                { x: 58, y: 7, color: COLORS.sky },
                { x: 86, y: 15, color: COLORS.lime },
              ].map((node) => (
                <g key={`${node.x}-${node.y}`}>
                  <circle cx={node.x} cy={node.y} r="5.5" fill={`${node.color}12`} />
                  <circle cx={node.x} cy={node.y} r="1.9" fill={node.color} />
                  <circle cx={node.x} cy={node.y} r="8.3" fill="none" stroke={`${node.color}28`} strokeWidth="0.28" />
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
          {PROBLEM_STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="relative"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 * index, duration: 0.7, ease: 'easeOut' }}
            >
              <div
                className="pointer-events-none absolute -left-8 top-6 h-40 w-40 rounded-full blur-3xl"
                style={{ background: `${stat.accent}22` }}
              />
              <div className="relative">
                <div className="text-[7rem] font-black leading-none tracking-[-0.08em] text-white md:text-[11rem]">
                  {stat.value}
                </div>
                <div
                  className="mt-3 text-[11px] font-semibold uppercase tracking-[0.34em]"
                  style={{ color: stat.accent }}
                >
                  {stat.label}
                </div>
                <div className="mt-4 max-w-sm text-2xl font-semibold leading-[1.02] text-zinc-100 md:text-[2.2rem]">
                  {stat.detail}
                </div>
                <div className="mt-6 h-px w-full max-w-[18rem]" style={{ background: `linear-gradient(90deg, ${stat.accent}, transparent)` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </SceneFrame>
);

const SceneSolution: React.FC = () => (
  <SceneFrame accent={COLORS.sky}>
    <div className="grid min-h-[44rem] items-center gap-10 xl:grid-cols-[0.92fr_1.08fr] xl:gap-12">
      <div className="flex flex-col">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
        >
          <SlideKicker>The solution</SlideKicker>
          <h1 className="mt-5 text-[2.8rem] font-black leading-[0.96] tracking-[-0.04em] text-white md:text-[3.8rem] xl:text-[4.2rem]">
            <span className="text-zinc-500 line-through decoration-[#EC4899]/45 decoration-[2px]">They see it too late.</span>
            <br />
            <span className="text-[#E0FE10]">We see it first.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-[1.6] text-zinc-300 md:text-xl">
            Pulse Check turns athlete pressure signals into action, detecting the signal before it becomes a crisis,
            regulating it in the moment, and routing to real care when the athlete needs more than coaching.
          </p>
        </motion.div>

        <div className="mt-8 flex max-w-2xl flex-col gap-3">
          {SOLUTION_PROOF_CHIPS.map((chip, index) => (
            <motion.div
              key={chip.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl transition-all duration-300 hover:border-white/15 hover:translate-x-[3px]"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.9 + index * 0.12, ease: 'easeOut' }}
            >
              <div className="flex items-start gap-4">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: chip.accent, boxShadow: `0 0 10px ${chip.accent}` }}
                />
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-[0.22em]"
                    style={{ color: chip.accent }}
                  >
                    {chip.label}
                  </div>
                  <div className="mt-1 text-[1.02rem] font-semibold leading-snug text-white md:text-[1.08rem]">
                    {chip.title} <span className="font-normal text-zinc-400">{chip.detail}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        className="relative"
        initial={{ opacity: 0, x: 22 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.25, ease: 'easeOut' }}
      >
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.025] p-7 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,#5B8DEF_0%,#E0FE10_50%,#EC4899_100%)] opacity-70" />
          <div className="pointer-events-none absolute -left-12 top-10 h-48 w-48 rounded-full bg-[#5B8DEF]/10 blur-3xl" />
          <div className="pointer-events-none absolute right-[-8%] top-[15%] h-56 w-56 rounded-full bg-[#E0FE10]/8 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-12%] right-[10%] h-48 w-48 rounded-full bg-[#EC4899]/8 blur-3xl" />

          <div className="relative flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">Signal-to-care pipeline</div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#E0FE10]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E0FE10] shadow-[0_0_8px_rgba(224,254,16,0.45)] animate-pulse" />
              Live
            </div>
          </div>

          <div className="relative mt-6 h-44">
            <svg viewBox="0 0 1000 220" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="solution-curve" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#5B8DEF" stopOpacity="0.7" />
                  <stop offset="50%" stopColor="#E0FE10" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#EC4899" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="solution-fill" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#E0FE10" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#E0FE10" stopOpacity="0" />
                </linearGradient>
                <filter id="solution-glow">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <path d="M0 110 H1000" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 8" />
              <path d="M333 14 V206" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <path d="M666 14 V206" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

              <path
                d="M0 110 C82 78 192 164 333 102 C422 74 540 80 666 112 C780 122 888 118 1000 110 L1000 220 L0 220 Z"
                fill="url(#solution-fill)"
              />
              <path
                d="M0 110 C82 78 192 164 333 102 C422 74 540 80 666 112 C780 122 888 118 1000 110"
                fill="none"
                stroke="url(#solution-curve)"
                strokeWidth="2.4"
                strokeDasharray="4 8"
                filter="url(#solution-glow)"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="3.4s" repeatCount="indefinite" />
              </path>

              <circle cx="333" cy="102" r="12" fill="rgba(91,141,239,0.14)">
                <animate attributeName="r" values="11;15;11" dur="2.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="333" cy="102" r="4.5" fill="#5B8DEF" />

              <circle cx="666" cy="112" r="12" fill="rgba(224,254,16,0.14)">
                <animate attributeName="r" values="11;15;11" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="666" cy="112" r="4.5" fill="#E0FE10" />

              <circle cx="994" cy="110" r="14" fill="rgba(236,72,153,0.13)">
                <animate attributeName="r" values="12;16;12" dur="2.1s" repeatCount="indefinite" />
              </circle>
              <circle cx="994" cy="110" r="5.5" fill="#EC4899" />

              <g>
                <circle r="11" fill="rgba(255,255,255,0.08)" />
                <circle r="5" fill="#ffffff" />
                <animateMotion
                  dur="4.6s"
                  repeatCount="indefinite"
                  path="M0 110 C82 78 192 164 333 102 C422 74 540 80 666 112 C780 122 888 118 1000 110"
                />
              </g>
            </svg>
          </div>

          <div className="relative mt-3 grid gap-4 md:grid-cols-3">
            {SOLUTION_STAGES.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <motion.div
                  key={stage.title}
                  className="relative rounded-[18px] border border-white/10 bg-white/[0.025] px-5 pb-5 pt-6"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 1.05 + index * 0.16, ease: 'easeOut' }}
                >
                  <div
                    className="absolute -top-3 left-5 flex h-7 w-7 items-center justify-center rounded-full border bg-[#0a0a0b] font-['Bebas_Neue'] text-sm tracking-[0.06em]"
                    style={{ borderColor: stage.accent, color: stage.accent, boxShadow: `0 0 14px ${stage.accent}44` }}
                  >
                    {stage.number}
                  </div>
                  <div
                    className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border"
                    style={{ background: `${stage.accent}16`, borderColor: `${stage.accent}40` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: stage.accent }} />
                  </div>
                  <div className="font-['Bebas_Neue'] text-[1.85rem] leading-none tracking-[0.06em]" style={{ color: stage.accent }}>
                    {stage.title}
                  </div>
                  <div className="mt-2 text-[0.96rem] leading-[1.45] text-zinc-300">{stage.detail}</div>
                  <div className="mt-4 border-t border-white/10 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                    {stage.tagLead} · <span className="text-zinc-100">{stage.tagValue}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            className="mt-5 flex items-center gap-3 rounded-2xl border border-[#E0FE10]/10 bg-[linear-gradient(90deg,rgba(91,141,239,0.05),rgba(224,254,16,0.05),rgba(236,72,153,0.05))] px-5 py-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.6 }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E0FE10] text-black">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <div className="text-sm leading-[1.5] text-zinc-300 md:text-[0.96rem]">
              <span className="font-semibold text-white">One continuous system</span> not three disconnected products stitched together.
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  </SceneFrame>
);

const SceneCheckIn: React.FC = () => {
  const breathPhases = [
    { label: 'Inhale', accent: COLORS.sky, scale: 1.08 },
    { label: 'Hold', accent: COLORS.lime, scale: 1.03 },
    { label: 'Exhale', accent: COLORS.pink, scale: 0.92 },
    { label: 'Hold', accent: COLORS.lime, scale: 0.98 },
  ] as const;
  const totalBreathTicks = breathPhases.length * 4;
  const [breathTick, setBreathTick] = useState(0);

  useEffect(() => {
    setBreathTick(0);
    const interval = window.setInterval(() => {
      setBreathTick((current) => {
        if (current >= totalBreathTicks) {
          window.clearInterval(interval);
          return current;
        }

        return current + 1;
      });
    }, 850);

    return () => window.clearInterval(interval);
  }, [totalBreathTicks]);

  const isBreathComplete = breathTick >= totalBreathTicks;
  const phaseIndex = Math.min(Math.floor(breathTick / 4), breathPhases.length - 1);
  const activePhase = breathPhases[phaseIndex];
  const phaseCount = isBreathComplete ? '✓' : `${4 - (breathTick % 4)}`;
  const progress = Math.min(breathTick, totalBreathTicks) / totalBreathTicks;
  const metrics = [
    { label: 'BPM', value: `${Math.round(78 - progress * 7)}`, trend: '↓ settling', accent: COLORS.pink, icon: '💓' },
    { label: 'HRV', value: `${Math.round(39 + progress * 8)}`, trend: '↑ recovering', accent: COLORS.sky, icon: '📈' },
    { label: 'CALM', value: `${Math.round(24 + progress * 9)}`, trend: '↑ rising', accent: COLORS.teal, icon: '🧘' },
  ] as const;

  return (
    <SceneFrame accent={COLORS.lime}>
      <div className="relative h-full min-h-[42rem] overflow-hidden">
        <div className="pointer-events-none absolute -right-[8%] top-[-12%] h-[24rem] w-[24rem] rounded-full bg-[#E0FE10]/7 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-[24%] -left-[6%] h-[20rem] w-[20rem] rounded-full bg-[#00D4AA]/6 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col">
          <div>
            <SlideKicker>How it works</SlideKicker>
            <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.94] text-white md:text-6xl">
              Pulse Check catches the athlete <span className="text-[#00D4AA]">before the spiral.</span>
            </h1>
            <div className="mt-4 max-w-5xl text-lg leading-relaxed text-zinc-300 md:text-xl">
              A passive check-in fires at game-day timing. Nora opens the conversation, detects the signal, and{' '}
              <span className="font-medium text-[#E0FE10]">regulates in real time</span> all inside the athlete flow.
            </div>
          </div>

          <motion.div
            className="mt-8 grid min-h-0 flex-1 items-center gap-6 xl:grid-cols-[auto_auto_minmax(38rem,54rem)] xl:justify-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
          >
            <div className="flex flex-col items-center gap-4 xl:items-start">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#00D4AA]">Step 1 · The trigger</div>
              <div className="relative w-full max-w-[230px] rounded-[28px] border border-white/12 bg-[#18181c] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <div className="absolute left-1/2 top-3 h-1 w-16 -translate-x-1/2 rounded-full bg-white/15" />
                <div className="min-h-[320px] rounded-[20px] bg-gradient-to-b from-[#0a0a0c] to-[#0f0f12] px-4 pb-5 pt-7">
                  <div className="mb-5 flex items-center justify-between text-[10px] font-medium text-white/70">
                    <span>6:47</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-end gap-[1.5px]">
                        <span className="h-[3px] w-[2px] rounded-[1px] bg-white/70" />
                        <span className="h-[5px] w-[2px] rounded-[1px] bg-white/70" />
                        <span className="h-[7px] w-[2px] rounded-[1px] bg-white/70" />
                        <span className="h-[9px] w-[2px] rounded-[1px] bg-white/70" />
                      </div>
                      <span className="relative h-[10px] w-5 rounded-[2px] border border-white/70 p-[1px] after:absolute after:right-[-3px] after:top-[2px] after:h-1 after:w-[2px] after:rounded-r-sm after:bg-white/70">
                        <span className="block h-full w-[80%] rounded-[1px] bg-white/70" />
                      </span>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-white/24">Saturday · March 2</div>
                    <div className="mt-2 font-['Bebas_Neue'] text-[4rem] leading-none text-white">6:47</div>
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[#E0FE10]">Game Day</div>
                  </div>

                  <motion.div
                    className="mt-8 flex gap-3 rounded-[14px] border border-[#E0FE10]/20 bg-[#E0FE10]/8 p-3"
                    animate={{
                      boxShadow: ['0 0 0 0 rgba(224,254,16,0.2)', '0 0 0 6px rgba(224,254,16,0)', '0 0 0 0 rgba(224,254,16,0)'],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E0FE10] text-black">
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3 text-[9px] font-bold uppercase tracking-[0.14em]">
                        <span className="text-[#E0FE10]">Pulse Check</span>
                        <span className="font-medium tracking-[0.12em] text-white/25">now</span>
                      </div>
                      <div className="mt-1.5 text-[11.5px] font-medium leading-[1.35] text-white">
                        Good morning. Time for your check-in with Nora.
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            <motion.div
              className="hidden items-center gap-3 xl:flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.75 }}
            >
              <div className="relative h-px w-10 bg-gradient-to-r from-[#00D4AA]/50 to-[#E0FE10]/50 before:absolute before:left-0 before:top-1/2 before:h-1 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-[#00D4AA] before:shadow-[0_0_6px_rgba(0,212,170,0.45)] after:absolute after:right-0 after:top-1/2 after:h-1 after:w-1 after:-translate-y-1/2 after:rounded-full after:bg-[#E0FE10] after:shadow-[0_0_6px_rgba(224,254,16,0.45)]" />
              <motion.div
                className="text-sm text-[#E0FE10]"
                animate={{ x: [0, 4, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                →
              </motion.div>
              <div className="max-w-[4.25rem] text-center text-[9px] font-bold uppercase leading-relaxed tracking-[0.2em] text-zinc-500">
                Athlete taps in
              </div>
            </motion.div>

            <div className="w-full max-w-[54rem] justify-self-start rounded-[20px] border border-white/8 bg-white/[0.02] p-5 md:p-6">
              <div className="flex items-center gap-3 border-b border-white/8 pb-4">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#00D4AA] to-[#E0FE10] font-['Bebas_Neue'] text-base text-black after:absolute after:bottom-[-2px] after:right-[-2px] after:h-[10px] after:w-[10px] after:rounded-full after:border-2 after:border-[#0a0a0b] after:bg-[#00D4AA]">
                  N
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Nora</div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#00D4AA]">Mental Performance AI</div>
                </div>
              </div>

              <div className="mt-4 flex min-h-0 flex-col gap-3">
                <motion.div
                  className="max-w-[85%] rounded-[12px] border border-[#E0FE10]/12 bg-[#E0FE10]/6 px-4 py-3 text-sm leading-relaxed text-zinc-200"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.4 }}
                >
                  <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.18em] text-[#E0FE10]">Step 2 · The read</span>
                  I&apos;m sensing some anxiety in your check-in. Let&apos;s run box breathing right now before this builds.
                </motion.div>

                <motion.div
                  className="ml-auto max-w-[70%] rounded-[12px] border border-[#5B8DEF]/15 bg-[#5B8DEF]/10 px-4 py-3 text-sm text-white"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.85, duration: 0.4 }}
                >
                  Okay. I need that.
                </motion.div>

                <motion.div
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[12px] border border-[#5B8DEF]/12 bg-[#5B8DEF]/4 px-4 py-3"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.4 }}
                >
                  <motion.div
                    className="relative flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-2"
                    style={{ borderColor: activePhase.accent, boxShadow: `0 0 18px ${activePhase.accent}33` }}
                    animate={{ scale: isBreathComplete ? 1 : activePhase.scale }}
                    transition={{ duration: 0.7, ease: 'easeInOut' }}
                  >
                    <div className="font-['Bebas_Neue'] text-[28px] leading-none" style={{ color: activePhase.accent }}>
                      {phaseCount}
                    </div>
                    <div className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                      {isBreathComplete ? 'Settled' : activePhase.label}
                    </div>
                  </motion.div>

                  <div>
                    <div className="text-sm font-bold text-white">Box Breathing · Round 1</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Step 3 · The regulation</div>
                    <div className="mt-2 text-xs leading-relaxed text-zinc-400">
                      Nora stays in the chat while the athlete completes one full breathing cycle.
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Round</div>
                    <div className="mt-1 font-['Bebas_Neue'] text-[28px] leading-none text-white">1 / 1</div>
                  </div>
                </motion.div>

                <motion.div
                  className="grid grid-cols-3 gap-2"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3, duration: 0.4 }}
                >
                  {metrics.map((metric) => (
                    <div key={metric.label} className="rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2 text-center">
                      <div className="text-[11px]">{metric.icon}</div>
                      <div className="mt-1 font-['Bebas_Neue'] text-[22px] leading-none" style={{ color: metric.accent }}>
                        {metric.value}
                      </div>
                      <div className="mt-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{metric.label}</div>
                      <div className="mt-1 text-[8px] font-medium" style={{ color: metric.accent }}>
                        {metric.trend}
                      </div>
                    </div>
                  ))}
                </motion.div>

                <AnimatePresence initial={false}>
                  {isBreathComplete ? (
                    <>
                      <motion.div
                        key="nora-follow-up"
                        className="max-w-[72%] rounded-[12px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-zinc-200"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35 }}
                      >
                        <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.18em] text-[#E0FE10]">Nora</span>
                        How are you feeling now?
                      </motion.div>

                      <motion.div
                        key="athlete-follow-up"
                        className="ml-auto max-w-[62%] rounded-[12px] border border-[#10B981]/18 bg-[#10B981]/10 px-4 py-3 text-sm font-medium text-white"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35, delay: 0.1 }}
                      >
                        I feel really great now!
                      </motion.div>
                    </>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="mt-5 flex items-start gap-4 rounded-[12px] border border-[#E0FE10]/10 bg-gradient-to-r from-[#E0FE10]/12 to-transparent px-4 py-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.5 }}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E0FE10] text-black">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <div className="text-sm leading-relaxed text-zinc-300">
              <span className="font-semibold text-white">When regulation works, the athlete settles without leaving the flow.</span>{' '}
              No survey. No coach interruption. No waiting room. The next slide shows what the system does when the moment goes beyond Nora.
            </div>
          </motion.div>
        </div>
      </div>
    </SceneFrame>
  );
};

const SceneClinicalRouting: React.FC = () => (
  <SceneFrame accent={COLORS.purple}>
    <div className="grid h-full min-h-[42rem] content-center gap-7">
      <div className="max-w-6xl">
        <SlideKicker>How it works</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          When it moves beyond Nora, the signal routes into <span className="text-purple-400">AuntEdna.</span>
        </h1>
        <div className="mt-4 max-w-5xl text-xl font-semibold leading-tight text-purple-300 md:text-3xl">
          The trigger shows up in the chat first. Then Pulse Check packages the context and routes it to clinical care.
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <motion.div
          className="relative flex min-h-[32rem] flex-col overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.03] p-5"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div className="absolute left-0 right-0 top-0 h-[2px] bg-purple-400/70" />
          <div className="mb-4 flex items-center gap-3 border-b border-white/8 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#00D4AA] to-[#E0FE10] font-['Bebas_Neue'] text-[15px] text-black">
              N
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">Nora</div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#00D4AA]">Mental Performance AI</div>
            </div>
            <div className="text-[10px] text-zinc-500">2:14 AM</div>
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <motion.div
              className="max-w-[92%] rounded-[12px] border border-[#E0FE10]/10 bg-[#E0FE10]/5 px-4 py-3 text-[12.5px] leading-relaxed text-white"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              You&apos;re up late. How are you feeling tonight?
            </motion.div>

            <motion.div
              className="ml-auto max-w-[92%] rounded-[12px] border border-[#EC4899]/20 bg-[#EC4899]/8 px-4 py-3 text-[12.5px] leading-relaxed text-white"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              I don&apos;t feel happy anymore. I feel empty inside. I don&apos;t know why I&apos;m still doing this.
              <div className="mt-3 flex items-center gap-2 border-t border-dashed border-[#EC4899]/20 pt-2 text-[8px] font-bold uppercase tracking-[0.18em] text-[#F472B6]">
                <span className="h-[5px] w-[5px] rounded-full bg-[#F472B6] shadow-[0_0_8px_rgba(244,114,182,0.7)]" />
                Critical signal detected
              </div>
            </motion.div>

            <motion.div
              className="max-w-[92%] rounded-[12px] border border-[#E0FE10]/10 bg-[#E0FE10]/5 px-4 py-3 text-[12.5px] leading-relaxed text-white"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75 }}
            >
              I hear you. This is beyond what I should handle alone. Connecting you with someone trained to help right now.
            </motion.div>

            <motion.div
              className="mt-auto flex items-center gap-3 rounded-[10px] border border-purple-400/15 bg-gradient-to-r from-purple-400/10 to-pink-400/10 px-4 py-3 text-sm font-medium text-white"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95 }}
            >
              <span>Handoff initiated to signal layer</span>
              <motion.span
                className="text-[#F472B6]"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                →
              </motion.span>
            </motion.div>
          </div>
        </motion.div>

        <div className="flex min-h-0 flex-col gap-4">
          <motion.div
            className="relative overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.03] px-6 py-8 md:px-8"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
          >
            <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-[#E0FE10]/70 via-[#8B5CF6]/70 to-[#EC4899]/70" />
            <div className="mb-8 flex items-center justify-between">
              <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-500">Signal-to-care pipeline</div>
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.24em] text-[#E0FE10]">
                <span className="h-[5px] w-[5px] rounded-full bg-[#E0FE10] shadow-[0_0_8px_rgba(224,254,16,0.7)]" />
                Live
              </div>
            </div>

            <div className="relative min-h-[11rem]">
              <div className="absolute left-16 right-16 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-[#E0FE10]/30 via-[#8B5CF6]/40 to-[#EC4899]/30" />

              {[
                { delay: 0, color: '#EC4899' },
                { delay: 0.45, color: '#00D4AA' },
                { delay: 1.2, color: '#E0FE10' },
                { delay: 2.0, color: '#F472B6' },
                { delay: 2.6, color: '#8B5CF6' },
              ].map((pulse) => (
                <motion.span
                  key={`${pulse.color}-${pulse.delay}`}
                  className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: pulse.color, boxShadow: `0 0 10px ${pulse.color}` }}
                  initial={{ left: '8%', opacity: 0 }}
                  animate={{ left: ['8%', '92%'], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay: pulse.delay }}
                />
              ))}

              <div className="relative grid gap-6 md:grid-cols-3">
                {[
                  {
                    name: 'Pulse Check',
                    sub: 'Athlete check-in',
                    accent: COLORS.lime,
                    icon: Brain,
                    large: false,
                  },
                  {
                    name: 'Signal Layer',
                    sub: 'AI classification',
                    accent: COLORS.purple,
                    icon: Zap,
                    large: true,
                  },
                  {
                    name: 'AuntEdna',
                    sub: 'Clinical platform',
                    accent: '#EC4899',
                    icon: Shield,
                    large: false,
                  },
                ].map((node) => {
                  const Icon = node.icon;
                  return (
                    <div key={node.name} className="flex flex-col items-center gap-3 text-center">
                      <div
                        className={`relative flex items-center justify-center rounded-full bg-[#0a0a0b] ${node.large ? 'h-[88px] w-[88px]' : 'h-[72px] w-[72px]'}`}
                        style={{
                          border: `1.5px solid ${node.accent}`,
                          boxShadow: `0 0 20px ${node.accent}33`,
                        }}
                      >
                        {node.large ? (
                          <motion.div
                            className="absolute inset-[-6px] rounded-full border"
                            style={{ borderColor: `${node.accent}44` }}
                            animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0, 0.6] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        ) : null}
                        <Icon className="h-5.5 w-5.5" style={{ color: node.accent }} />
                      </div>
                      <div className="font-['Bebas_Neue'] text-[18px] uppercase tracking-[0.2em] leading-none" style={{ color: node.accent }}>
                        {node.name}
                      </div>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.18em] leading-relaxed text-zinc-500">
                        {node.sub}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: 'Trigger', detail: 'Flagged chat context + biometric snapshot', accent: COLORS.lime },
              { title: 'Decision', detail: 'Signal layer determines clinical routing', accent: COLORS.purple },
              { title: 'Destination', detail: 'AuntEdna chart seed + response path', accent: '#EC4899' },
            ].map((card, index) => (
              <motion.div
                key={card.title}
                className="relative min-h-[11rem] overflow-hidden rounded-[14px] border border-white/8 bg-white/[0.03] p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 + index * 0.12, duration: 0.45 }}
              >
                <div className="absolute left-0 right-0 top-0 h-[2px]" style={{ background: card.accent, opacity: 0.7 }} />
                <div className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: card.accent }}>
                  {card.title}
                </div>
                <div className="mt-6 text-2xl font-black leading-tight text-white">{card.detail}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </SceneFrame>
);

const SceneWelfareCheck: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const connectTimer = window.setTimeout(() => setConnected(true), 1800);
    return () => window.clearTimeout(connectTimer);
  }, []);

  useEffect(() => {
    if (!connected) return undefined;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [connected]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <SceneFrame accent={COLORS.red}>
      <div className="grid items-center gap-8 xl:grid-cols-[0.86fr_1.14fr]">
        <div>
          <SlideKicker>How it works</SlideKicker>
          <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
            A clinician can immediately start the welfare check.
          </h1>
          <div className="mt-4 max-w-4xl text-2xl font-semibold leading-tight text-[#FB7185] md:text-4xl">
            This is not just a score. It creates a live human response path.
          </div>
          <div className="mt-7 grid gap-3">
            {[
              'K. Thompson is contacted directly',
              'Clinical context is already packaged',
              'Same-day follow-up can start immediately',
            ].map((line, index) => (
              <GlassCard key={line} accentColor={[COLORS.red, COLORS.purple, COLORS.lime][index] ?? COLORS.red}>
                <div className="p-4">
                  <div className="text-2xl font-black leading-tight text-white">{line}</div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <GlassCard accentColor={COLORS.red}>
            <div className="p-6 md:p-7">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">Welfare check in progress</div>
                  <div className="mt-2 text-3xl font-black text-white">Calling K. Thompson</div>
                </div>
                <div className="rounded-full border border-red-400/25 bg-red-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-red-300">
                  urgent
                </div>
              </div>

              <div className="mx-auto max-w-[320px] rounded-[34px] border border-white/10 bg-[#111318] p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-2xl font-black text-zinc-300">
                  KT
                </div>
                <div className="mt-4 text-2xl font-black text-white">K. Thompson</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">#52 • athlete</div>

                <div className="relative mt-8 flex justify-center">
                  <motion.div
                    animate={{ scale: connected ? 1 : [1, 1.55, 1], opacity: connected ? 0.2 : [0.45, 0, 0.45] }}
                    transition={{ duration: 1.5, repeat: connected ? 0 : Infinity }}
                    className="absolute h-16 w-16 rounded-full bg-[#E0FE10]/20"
                  />
                  <div
                    className="relative flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ background: connected ? 'rgba(34,197,94,0.18)' : 'rgba(224,254,16,0.12)' }}
                  >
                    <PhoneCall className="h-7 w-7" style={{ color: connected ? '#4ade80' : COLORS.lime }} />
                  </div>
                </div>

                <div className="mt-6 text-lg font-semibold text-white">
                  {connected ? `Connected • ${mins}:${secs.toString().padStart(2, '0')}` : 'Calling...'}
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  {connected ? '"Hey Doc, thanks for calling..."' : 'Immediate clinician outreach'}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </SceneFrame>
  );
};

type ComparisonStatus = 'yes' | 'partial' | 'no';

const ComparisonCell: React.FC<{ status: ComparisonStatus; accent?: string }> = ({
  status,
  accent = COLORS.lime,
}) => {
  if (status === 'yes') {
    return (
      <div className="flex justify-center">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full border"
          style={{ borderColor: accent, background: `${accent}18` }}
        >
          <CheckCircle2 className="h-5.5 w-5.5" style={{ color: accent }} />
        </div>
      </div>
    );
  }

  if (status === 'partial') {
    return (
      <div className="flex justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/10">
          <div className="h-[2.5px] w-4.5 rounded-full bg-amber-300/80" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
        <XCircle className="h-5.5 w-5.5 text-white/20" />
      </div>
    </div>
  );
};

const SceneCompetitiveNarrative: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-6xl">
        <SlideKicker>Uniqueness / superiority</SlideKicker>
        <h1 className="mt-4 text-[2.9rem] font-black leading-[0.92] text-white md:text-[4.1rem]">
          WHOOP meets Calm, then extends into <span className="text-[#E0FE10]">BetterHelp</span> and{' '}
          <span className="text-[#E0FE10]">988.</span>
        </h1>
        <div className="mt-3 text-lg font-medium text-zinc-300 md:text-[1.35rem]">
          Four fragmented systems become one end-to-end athlete workflow.
        </div>
      </div>

      <div className="grid flex-1 items-center gap-3 xl:grid-cols-[1fr_auto_1fr]">
        <div className="grid gap-2.5 md:grid-cols-2 xl:pr-6">
          {COMPETITOR_CARDS.map((card, index) => {
            const isWhoop = card.name === 'WHOOP';
            const isCalm = card.name === 'Calm';
            const isBetterHelp = card.name === 'BetterHelp';

            return (
              <motion.div
                key={card.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * index }}
              >
                <GlassCard accentColor={card.accent} className="h-full">
                  <div className="relative h-full p-4">
                    <div
                      className="absolute left-0 right-0 top-0 h-[2px]"
                      style={{ background: `linear-gradient(90deg, transparent, ${card.accent}, transparent)` }}
                    />
                    <div className="text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: card.accent }}>
                      {card.category}
                    </div>
                    {isWhoop ? (
                      <WhoopWordmark className="mt-3 scale-[0.92] origin-left" />
                    ) : isCalm ? (
                      <CalmWordmark className="mt-3 scale-[0.88] origin-left" />
                    ) : isBetterHelp ? (
                      <BetterHelpWordmark className="mt-3 scale-[0.88] origin-left" />
                    ) : (
                      <Lifeline988Wordmark className="mt-3 scale-[0.74] origin-left" />
                    )}
                    <div className="mt-3 text-sm leading-snug text-zinc-400">{card.detail}</div>

                    <div className="mt-4 grid gap-2">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{card.scaleLabel}</div>
                        <div className="mt-1 text-sm font-bold text-white">{card.scaleValue}</div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{card.costLabel}</div>
                        <div className="mt-1 text-sm font-bold text-white">{card.costValue}</div>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        <div className="flex flex-row items-center justify-center gap-4 py-2 xl:flex-col xl:px-3">
          <div className="h-[2px] w-14 bg-gradient-to-r from-transparent via-[#E0FE10] to-transparent xl:h-16 xl:w-[2px]" />
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E0FE10] bg-[#E0FE10]/12 shadow-[0_0_24px_rgba(224,254,16,0.18)]">
            <ArrowRight className="h-5 w-5 text-[#E0FE10] xl:rotate-90" />
          </div>
          <div className="h-[2px] w-14 bg-gradient-to-r from-transparent via-[#E0FE10] to-transparent xl:h-16 xl:w-[2px]" />
        </div>

        <GlassCard accentColor={COLORS.lime} className="h-full">
          <div className="relative flex h-full flex-col justify-center overflow-hidden p-6 md:p-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,212,170,0.12),transparent_45%),linear-gradient(135deg,rgba(0,212,170,0.06),rgba(224,254,16,0.03))]" />
            <div className="relative">
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#00D4AA]">Unified here</div>
              <div className="mt-3 text-[2.4rem] font-black leading-[0.95] text-white md:text-[3.1rem]">
                Pulse Check x AuntEdna turns that stack into one system.
              </div>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {[
                  { label: 'Detect the signal', accent: COLORS.sky },
                  { label: 'Regulate in the moment', accent: COLORS.purple },
                  { label: 'Connect to care', accent: COLORS.teal },
                  { label: 'Escalate if crisis appears', accent: COLORS.red },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border px-4 py-4"
                    style={{ borderColor: `${item.accent}35`, background: `${item.accent}0f` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.accent, boxShadow: `0 0 10px ${item.accent}66` }} />
                      <div className="text-base font-bold leading-tight text-white">{item.label}</div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  </SceneFrame>
);

const SceneCompetitiveProof: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-6xl">
        <SlideKicker>Competitive advantage</SlideKicker>
        <h1 className="mt-5 text-6xl font-black leading-[0.9] text-white md:text-7xl">
          One platform. <span className="text-[#E0FE10]">Every capability.</span>
        </h1>
        <div className="mt-4 text-2xl font-medium text-zinc-300 md:text-3xl">
          No other single product covers detection, regulation, clinical routing, and crisis escalation for athletes.
        </div>
      </div>

      <GlassCard accentColor={COLORS.lime}>
        <div className="overflow-x-auto p-4 md:p-6">
          <div className="min-w-[1100px]">
            <div className="grid grid-cols-[2.2fr_repeat(4,1fr)_1.4fr] overflow-hidden rounded-t-[22px] border border-white/8 bg-[#131315]">
              <div className="flex items-center px-4 py-5 text-[12px] font-semibold uppercase tracking-[0.24em] text-zinc-400 md:text-[13px]">
                Capability
              </div>
              {COMPETITOR_CARDS.map((card) => (
                <div key={`header-${card.name}`} className="flex items-center justify-center px-3 py-5 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-zinc-400 md:text-[13px]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: card.accent }} />
                      {card.name}
                    </div>
                    <div className="mt-2 text-[11px] text-zinc-500 md:text-xs">{card.scaleValue}</div>
                    <div className="text-[11px] text-zinc-500 md:text-xs">{card.costValue}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-center border-l border-[#E0FE10]/10 bg-[#E0FE10]/10 px-4 py-5 text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-[#E0FE10] md:text-[13px]">
                Pulse Check × AuntEdna
              </div>
            </div>

            <div className="rounded-b-[22px] border border-t-0 border-white/8">
              {COMPETITIVE_ROWS.map((row, index) => (
                <div
                  key={row.feature}
                  className={`grid grid-cols-[2.2fr_repeat(4,1fr)_1.4fr] items-center ${
                    index !== COMPETITIVE_ROWS.length - 1 ? 'border-b border-white/8' : ''
                  } bg-white/[0.02] transition-colors hover:bg-white/[0.03]`}
                >
                  <div className="px-4 py-5 text-base font-semibold leading-snug text-white md:text-lg">{row.feature}</div>
                  <div className="px-3 py-5">
                    <ComparisonCell status={row.whoop} accent={COLORS.orange} />
                  </div>
                  <div className="px-3 py-5">
                    <ComparisonCell status={row.calm} accent={COLORS.purple} />
                  </div>
                  <div className="px-3 py-5">
                    <ComparisonCell status={row.clinical} accent={COLORS.teal} />
                  </div>
                  <div className="px-3 py-5">
                    <ComparisonCell status={row.lifeline} accent={COLORS.red} />
                  </div>
                  <div className="border-l border-[#E0FE10]/10 bg-[#E0FE10]/5 px-3 py-5">
                    <ComparisonCell status={row.pulse} accent={COLORS.lime} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard accentColor={COLORS.lime}>
        <div className="flex items-start gap-4 p-5 md:p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E0FE10] text-black">
            <Zap className="h-5.5 w-5.5" />
          </div>
          <div className="text-base leading-relaxed text-zinc-300 md:text-lg">
            <span className="font-bold text-white">No single competitor covers the full pipeline.</span> Athletes today
            need multiple disconnected tools. Pulse Check x AuntEdna is the system that owns the workflow from signal
            detection through crisis escalation.
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const SceneBuildingBlocks: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-6xl">
        <SlideKicker>Contract economics</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.92] text-white md:text-6xl">
          The <span className="text-[#E0FE10]">building blocks.</span>
        </h1>
        <div className="mt-4 max-w-5xl text-xl font-medium leading-relaxed text-zinc-300 md:text-2xl">
          Average annual contract value at each segment of the market. These are the units that compound into the $100M
          path.
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-6">
        {BUILDING_BLOCK_TIERS.map((tier, index) => {
          const Icon = tier.icon;

          return (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * index }}
            >
              <GlassCard accentColor={tier.accent} className="h-full">
                <div className="flex min-h-[28rem] flex-col p-5 md:p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${tier.accent}12` }}>
                    <Icon className="h-5.5 w-5.5" style={{ color: tier.accent }} />
                  </div>
                  <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: tier.accent }}>
                    {tier.tier}
                  </div>
                  <div className="mt-3 text-3xl font-black leading-tight text-white">{tier.name}</div>
                  <div className="mt-3 text-base leading-snug text-zinc-400">{tier.detail}</div>

                  <div className="mt-auto border-t border-white/8 pt-5">
                    <div className="text-5xl font-black leading-none text-[#E0FE10] md:text-6xl">{tier.price}</div>
                    <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{tier.unit}</div>
                    <div className="mt-4 text-sm italic leading-relaxed text-zinc-500">{tier.example}</div>
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

const SceneMarket: React.FC = () => (
  <SceneFrame accent={COLORS.sky}>
    <div className="grid h-full min-h-0 content-center gap-5">
      <div className="max-w-5xl">
        <SlideKicker>Full TAM</SlideKicker>
        <h1 className="mt-4 text-[2.9rem] font-black leading-[0.94] text-white md:text-[4.1rem]">
          The full opportunity is already <span className="text-[#E0FE10]">$10B+</span>.
        </h1>
        <div className="mt-3 max-w-4xl text-xl font-medium text-zinc-300 md:text-[1.75rem]">
          We sit at the intersection of performance tech, digital mental health, and connected care.
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <GlassCard accentColor={COLORS.lime} className="h-full">
          <div className="flex h-full flex-col justify-between p-5 md:p-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#E0FE10]">Full adjacent market TAM</div>
              <div className="mt-3 text-[4.6rem] font-black leading-none text-white md:text-[5.7rem]">{FULL_TAM_TOTAL}</div>
              <div className="mt-4 text-[1.35rem] font-semibold leading-tight text-zinc-200 md:text-[1.65rem]">
                That number does not come from one narrow contract model. It comes from the full stack we are touching.
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Why it belongs together</div>
              <div className="mt-3 grid gap-2.5">
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-2.5">
                  <span className="text-sm font-medium text-zinc-300">Performance signal</span>
                  <span className="text-lg font-black text-white">Pulse Check</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-2.5">
                  <span className="text-sm font-medium text-zinc-300">In-the-moment support</span>
                  <span className="text-lg font-black text-white">AI + intervention</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-2.5">
                  <span className="text-sm font-medium text-zinc-300">Clinical routing</span>
                  <span className="text-lg font-black text-white">AuntEdna</span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-4 md:grid-cols-3">
          {FULL_TAM_MARKETS.map((segment, index) => (
            <motion.div
              key={segment.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * index }}
            >
              <GlassCard accentColor={segment.accent} className="h-full">
                <div className="flex min-h-[15.5rem] flex-col justify-between p-4 md:p-5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: segment.accent }}>
                      Adjacent market
                    </div>
                    <div className="mt-3 text-[2rem] font-black leading-tight text-white">{segment.title}</div>
                    <div className="mt-3 text-base leading-snug text-zinc-300">{segment.scope}</div>
                  </div>
                  <div className="mt-5 text-[2.6rem] font-black md:text-[3.3rem]" style={{ color: segment.accent }}>
                    {segment.value}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>

      <GlassCard accentColor={COLORS.pink}>
        <div className="flex items-center justify-between gap-5 p-4 md:p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">TAM framing</div>
            <div className="mt-2 text-xl font-semibold text-zinc-200 md:text-[1.6rem]">
              Full TAM includes adjacent markets because we are not selling one narrow point solution.
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-4xl font-black text-[#E0FE10] md:text-5xl">{FULL_TAM_TOTAL}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Full opportunity</div>
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const SceneBeachhead: React.FC = () => (
  <SceneFrame accent={COLORS.teal}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-5xl">
        <SlideKicker>Beachhead</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          The first <span className="text-[#E0FE10]">$3M</span> is already visible.
        </h1>
        <div className="mt-4 max-w-4xl text-2xl font-medium text-zinc-300 md:text-3xl">
          Our 12–24 month beachhead is the set of contracts already in motion across schools, teams, and federations.
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {BEACHHEAD_MARKET_SEGMENTS.map((segment, index) => (
          <motion.div
            key={segment.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
          >
            <GlassCard accentColor={segment.accent} className="h-full">
              <div className="flex min-h-[14rem] flex-col justify-between p-5 md:p-6" style={{ background: `linear-gradient(180deg, ${segment.accent}12, transparent 88%)` }}>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: segment.accent }}>
                    Near-term lane
                  </div>
                  <div className="mt-3 text-3xl font-black leading-tight text-white">{segment.title}</div>
                  <div className="mt-4 text-base leading-snug text-zinc-400">{segment.detail}</div>
                </div>
                <div className="mt-5 text-3xl font-black" style={{ color: segment.accent }}>
                  {segment.value}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard accentColor={COLORS.lime}>
        <div className="flex items-center justify-between gap-6 p-5 md:p-6" style={{ background: 'linear-gradient(90deg, rgba(200,255,0,0.12), rgba(0,212,170,0.04))' }}>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">12–24 month beachhead</div>
            <div className="mt-2 text-4xl font-black text-white">12-14 contracts</div>
          </div>
          <div className="text-right">
            <div className="text-6xl font-black text-[#E0FE10] md:text-7xl">{BEACHHEAD_TOTAL}</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Visible ARR</div>
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const SceneHundredMPath: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="relative h-full min-h-[42rem] overflow-hidden">
      <div className="pointer-events-none absolute -right-[6%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-[#E0FE10]/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-[6%] bottom-[-22%] h-[24rem] w-[24rem] rounded-full bg-[#00D4AA]/8 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <SlideKicker>Revenue roadmap</SlideKicker>
            <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
              A visible path to <span className="text-[#E0FE10]">$100M ARR.</span>
            </h1>
            <div className="mt-4 max-w-3xl text-lg leading-relaxed text-zinc-300 md:text-xl">
              Phased contract roadmap. Prove the product in every segment, then scale with proof points.
            </div>
          </div>

          <motion.div
            className="text-left lg:text-right"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.25 }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">5-Year target</div>
            <div className="mt-2 text-7xl font-black leading-none text-[#E0FE10] drop-shadow-[0_0_34px_rgba(224,254,16,0.22)] md:text-[5.8rem]">
              $100M+
            </div>
            <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-400">Annual recurring revenue</div>
          </motion.div>
        </div>

        <div className="relative mt-8 flex min-h-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col gap-8 pb-16 lg:flex-row lg:items-end lg:gap-4">
            <div className="pointer-events-none absolute inset-x-0 bottom-16 hidden h-px bg-gradient-to-r from-transparent via-white/14 to-transparent lg:block" />

            <div className="pointer-events-none absolute inset-x-0 bottom-16 top-0 hidden lg:block">
              <svg viewBox="0 0 1000 400" preserveAspectRatio="none" className="h-full w-full">
                <defs>
                  <linearGradient id="path-arr-curve" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#00D4AA" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#c8ff00" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#c8ff00" stopOpacity="0.5" />
                  </linearGradient>
                  <linearGradient id="path-arr-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#c8ff00" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#c8ff00" stopOpacity="0" />
                  </linearGradient>
                </defs>

                <path
                  d="M 0 380 Q 200 370, 300 340 Q 500 280, 700 140 Q 850 60, 1000 20 L 1000 400 L 0 400 Z"
                  fill="url(#path-arr-fill)"
                />
                <motion.path
                  d="M 0 380 Q 200 370, 300 340 Q 500 280, 700 140 Q 850 60, 1000 20"
                  fill="none"
                  stroke="url(#path-arr-curve)"
                  strokeWidth="2"
                  strokeDasharray="4 8"
                  opacity="0.72"
                  animate={{ strokeDashoffset: [0, -18] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
                <motion.circle
                  cx="1000"
                  cy="20"
                  r="6"
                  fill="#c8ff00"
                  animate={{ r: [6, 10, 6], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </svg>
            </div>

            <motion.div
              className="relative z-10 flex min-h-0 flex-1 flex-col lg:pr-2"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35 }}
            >
              <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500">Years 1-2</div>
              <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.45)]" />
                  <span>Prove it</span>
                </div>
                <div className="font-black tracking-[0.03em] text-emerald-300">
                  <span className="text-[1.7rem] leading-none">~$3M</span>
                  <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">ARR</span>
                </div>
              </div>
              <div className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-400">
                Land anchor contracts across every segment. Validate product, build case studies, establish credibility.
              </div>

              <div className="mt-5 flex flex-1 flex-col justify-end gap-2">
                {PATH_PHASE_ONE.map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="grid grid-cols-[18px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2.5 transition-all duration-300 hover:border-white/14 hover:bg-white/[0.04] hover:translate-x-[2px]"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.05, duration: 0.45 }}
                  >
                    <span className="mx-auto h-2 w-2 rounded-full" style={{ background: item.accent, boxShadow: `0 0 6px ${item.accent}` }} />
                    <span className="min-w-0 text-sm font-semibold text-white">
                      {item.label}
                      <span className="ml-2 text-[11px] font-normal text-zinc-500">{item.detail}</span>
                    </span>
                    <span className="text-right font-black tracking-[0.04em] text-white">{item.count}</span>
                    <span className="min-w-[5.5rem] text-right text-lg font-black tracking-[0.03em]" style={{ color: item.accent }}>
                      {item.revenue}
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-md border-l-2 border-emerald-300 bg-gradient-to-r from-white/[0.04] to-transparent px-4 py-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">12-14 contracts</div>
                <div className="font-black tracking-[0.03em] text-emerald-300">~$3.0M ARR</div>
              </div>
            </motion.div>

            <div className="relative z-10 hidden w-24 shrink-0 flex-col items-center justify-end pb-10 lg:flex">
              <motion.div
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E0FE10]/30 bg-[#E0FE10]/10 text-[#E0FE10]"
                animate={{ scale: [1, 1.05, 1], boxShadow: ['0 0 0 0 rgba(224,254,16,0.3)', '0 0 0 8px rgba(224,254,16,0)', '0 0 0 0 rgba(224,254,16,0)'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ArrowRight className="h-4 w-4" />
              </motion.div>
              <div className="mt-3 max-w-[5rem] text-center text-[9px] font-semibold uppercase leading-relaxed tracking-[0.22em] text-zinc-500">
                Proof points unlock scale
              </div>
            </div>

            <motion.div
              className="relative z-10 flex min-h-0 flex-[2.2] flex-col lg:pl-2"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55 }}
            >
              <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500">Years 3-5</div>
              <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#E0FE10]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#E0FE10] shadow-[0_0_8px_rgba(224,254,16,0.45)]" />
                  <span>Scale</span>
                </div>
                <div className="font-black tracking-[0.03em] text-[#E0FE10]">
                  <span className="text-[1.7rem] leading-none">$100M+</span>
                  <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">Target ARR</span>
                </div>
              </div>
              <div className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Expand across segments. Close league-wide deals. Enter international federation market.
              </div>

              <div className="mt-5 flex flex-1 flex-col justify-end gap-2">
                {PATH_PHASE_TWO.map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="grid grid-cols-[18px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2.5 transition-all duration-300 hover:border-white/14 hover:bg-white/[0.04] hover:translate-x-[2px]"
                    style={
                      item.label === 'League + Intl'
                        ? { background: 'linear-gradient(90deg, rgba(236,72,153,0.06), transparent)', borderColor: 'rgba(236,72,153,0.2)' }
                        : undefined
                    }
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.72 + index * 0.05, duration: 0.45 }}
                  >
                    <span className="mx-auto h-2 w-2 rounded-full" style={{ background: item.accent, boxShadow: `0 0 6px ${item.accent}` }} />
                    <span className="min-w-0 text-sm font-semibold text-white">
                      {item.label}
                      <span className="ml-2 text-[11px] font-normal text-zinc-500">{item.detail}</span>
                    </span>
                    <span className="text-right font-black tracking-[0.04em] text-white">{item.count}</span>
                    <span className="min-w-[5.5rem] text-right text-lg font-black tracking-[0.03em]" style={{ color: item.accent }}>
                      {item.revenue}
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-md border-l-2 border-[#E0FE10] bg-gradient-to-r from-white/[0.04] to-transparent px-4 py-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">~50 contracts</div>
                <div className="font-black tracking-[0.03em] text-[#E0FE10]">$100M+ ARR</div>
              </div>
            </motion.div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-4 hidden justify-between px-6 lg:flex">
            {['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'].map((year) => (
              <div key={year} className="flex flex-col items-center gap-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                <span className="h-2 w-px bg-white/18" />
                <span>{year}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
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

const SceneSupporters: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="grid h-full min-h-0 content-center gap-6">
      <div className="max-w-5xl">
        <SlideKicker>Who supports us</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
          We are backed by serious institutional support.
        </h1>
        <div className="mt-4 max-w-4xl text-2xl font-medium text-zinc-300 md:text-3xl">
          From sports institutions to venture networks to scientific infrastructure, the support around us is real.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SUPPORT_NETWORK.map((supporter, index) => (
          <motion.div
            key={supporter.name}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * index }}
          >
            <GlassCard accentColor={supporter.accent} className="h-full">
              <div className="flex min-h-[14rem] flex-col justify-between p-6 md:p-7">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: supporter.accent }}>
                    Supporter
                  </div>
                  <div className="mt-4 text-3xl font-black leading-tight text-white">{supporter.name}</div>
                </div>
                <div className="mt-6 text-lg leading-snug text-zinc-300">{supporter.detail}</div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlassCard accentColor={COLORS.lime}>
        <div className="flex items-center justify-between gap-6 p-5 md:p-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">What it signals</div>
            <div className="mt-2 text-2xl font-semibold text-zinc-200 md:text-3xl">
              This company is not building in isolation. We already have support spanning athletics, science, startups, and venture.
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const SceneEvidence: React.FC = () => {
  const [activeSportIndex, setActiveSportIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSportIndex((current) => (current + 1) % SPORT_PRECISION_MAP.length);
    }, 4000);

    return () => window.clearInterval(interval);
  }, []);

  const sports = useMemo(
    () =>
      SPORT_PRECISION_MAP.map((sport, index) => ({
        ...sport,
        sourceIndex: index,
      })),
    [],
  );

  const activeSport = sports[activeSportIndex];
  const centerPoint = { x: 50, y: 58 };
  const activeNodePoint = SPORT_ORBIT_SLOTS[activeSportIndex];
  const activeMarkerSlots = SPORT_MARKER_SLOT_MAP[activeSportIndex];

  return (
    <motion.div
      className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-[#07090d] md:overflow-hidden"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={transition}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(224,254,16,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.08),transparent_28%),linear-gradient(135deg,#06080b_0%,#0a0d12_60%,#080a0f_100%)]" />
      <div className="absolute -left-20 top-16 h-72 w-72 rounded-full blur-3xl" style={{ background: `${activeSport.accent}18` }} />
      <div className="absolute right-[-6%] top-[18%] h-64 w-64 rounded-full bg-white/[0.04] blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative z-10 min-h-full px-6 py-8 md:h-full md:px-14 md:py-12">
        <div className="grid min-h-full items-center gap-10 lg:grid-cols-[minmax(20rem,0.72fr)_minmax(34rem,1.28fr)] lg:gap-12">
          <div className="max-w-2xl lg:pr-4">
            <div className="inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#E0FE10]">
              <span className="h-px w-10 bg-[#E0FE10]/30" />
              <span>White Glove Precision</span>
            </div>
            <h1 className="mt-5 text-5xl font-black uppercase leading-[0.9] tracking-[0.04em] text-white md:text-7xl">
              <span className="text-white/45">Their AI sees </span>
              <span className="text-[#E0FE10]">an athlete.</span>
              <br />
              <span className="text-white/45">Nora sees </span>
              <span className="text-[#00D4AA]">your athlete.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65 md:text-xl">
              Nora calibrates against the sport, the stress pattern, and the performance context, not just a generic wellness score.
            </p>
          </div>

          <div className="relative h-[42rem] min-h-[42rem] overflow-hidden lg:h-full lg:min-h-[44rem]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(0,212,170,0.08),transparent_28%),radial-gradient(circle_at_bottom_center,rgba(139,92,246,0.08),transparent_34%)]" />

            {MINDMAP_PARTICLES.map((particle, index) => (
              <motion.div
                key={`particle-${index}`}
                className="absolute rounded-full bg-[#c8ff00]"
                style={{
                  left: particle.left,
                  top: particle.top,
                  width: particle.size,
                  height: particle.size,
                  opacity: particle.opacity,
                }}
                animate={{ opacity: [particle.opacity * 0.45, particle.opacity, particle.opacity * 0.45] }}
                transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}

            <svg viewBox="0 0 100 100" className="absolute inset-0 z-10 h-full w-full">
              <motion.circle
                cx={centerPoint.x}
                cy={centerPoint.y}
                r="25"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="1.5 5"
                animate={{ rotate: 360 }}
                transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
                style={{ transformOrigin: `${centerPoint.x}% ${centerPoint.y}%` }}
              />

              {SPORT_ORBIT_SLOTS.map((slot, index) => {
                const sport = sports[index];
                const isActive = index === activeSportIndex;
                return (
                  <line
                    key={`${sport.name}-link`}
                    x1={centerPoint.x}
                    y1={centerPoint.y}
                    x2={slot.x}
                    y2={slot.y}
                    stroke={isActive ? `${sport.accent}80` : `${sport.accent}22`}
                    strokeWidth={isActive ? 0.35 : 0.18}
                    strokeDasharray={isActive ? '1.2 1.4' : '0.8 2.6'}
                  />
                );
              })}

              <AnimatePresence mode="wait">
                <motion.g
                  key={activeSport.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {activeSport.markers.map((marker, index) => {
                    const point = activeMarkerSlots[index];
                    const textAnchor =
                      point.x < activeNodePoint.x - 4 ? 'end' : point.x > activeNodePoint.x + 4 ? 'start' : 'middle';
                    const textX = textAnchor === 'end' ? point.x - 1.2 : textAnchor === 'start' ? point.x + 1.2 : point.x;

                    return (
                      <g key={`${activeSport.name}-${marker}`}>
                        <motion.line
                          x1={activeNodePoint.x}
                          y1={activeNodePoint.y}
                          x2={point.x}
                          y2={point.y}
                          stroke={activeSport.accent}
                          strokeWidth={0.28}
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 0.7 }}
                          exit={{ pathLength: 0, opacity: 0 }}
                          transition={{ duration: 0.45, delay: index * 0.08 }}
                        />
                        <motion.circle
                          cx={point.x}
                          cy={point.y}
                          r="0.55"
                          fill={activeSport.accent}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 0.95 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.25, delay: index * 0.08 + 0.18 }}
                        />
                        <motion.text
                          x={textX}
                          y={point.y - 1.1}
                          fill={activeSport.accent}
                          fontSize="1.45"
                          fontWeight="600"
                          textAnchor={textAnchor}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.95 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25, delay: index * 0.08 + 0.24 }}
                        >
                          {marker}
                        </motion.text>
                      </g>
                    );
                  })}
                </motion.g>
              </AnimatePresence>
            </svg>

            <div className="absolute inset-0 z-20">
              {sports.map((sport, index) => {
                const slot = SPORT_ORBIT_SLOTS[index];
                const isActive = index === activeSportIndex;
                return (
                  <motion.div
                    key={`${sport.name}-${sport.sourceIndex}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                    animate={{ scale: isActive ? 1.08 : 1, y: isActive ? -4 : 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  >
                    <button type="button" onClick={() => setActiveSportIndex(sport.sourceIndex)} className="relative">
                      {isActive && (
                        <motion.div
                          className="absolute inset-[-12px] rounded-full blur-xl"
                          style={{ background: sport.glow }}
                          animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.08, 1] }}
                          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                      <div
                        className={`relative flex items-center justify-center rounded-full border backdrop-blur-xl ${isActive ? 'h-24 w-24 md:h-28 md:w-28' : 'h-20 w-20 md:h-24 md:w-24'}`}
                        style={{
                          borderColor: isActive ? `${sport.accent}80` : `${sport.accent}32`,
                          background: `radial-gradient(circle, ${sport.glow}, rgba(8,10,14,0.92) 70%)`,
                          boxShadow: isActive ? `0 0 30px ${sport.glow}` : 'none',
                        }}
                      >
                        <div
                          className="absolute inset-2 rounded-full border"
                          style={{ borderColor: isActive ? `${sport.accent}35` : 'rgba(255,255,255,0.04)' }}
                        />
                        <div className={isActive ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'}>{sport.icon}</div>
                      </div>
                    </button>
                    <div
                      className="pointer-events-none absolute left-1/2 top-full mt-4 -translate-x-1/2 whitespace-nowrap text-sm font-black uppercase tracking-[0.18em] md:text-base"
                      style={{ color: isActive ? sport.accent : 'rgba(255,255,255,0.55)' }}
                    >
                      {sport.name}
                    </div>
                  </motion.div>
                );
              })}

              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                style={{ left: `${centerPoint.x}%`, top: `${centerPoint.y}%` }}
              >
                <motion.div
                  className="absolute inset-[-18px] rounded-full blur-2xl"
                  style={{ background: activeSport.glow }}
                  animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="relative flex h-28 w-28 items-center justify-center rounded-full border backdrop-blur-xl md:h-32 md:w-32"
                  animate={{
                    borderColor: `${activeSport.accent}73`,
                    boxShadow: `0 0 28px ${activeSport.glow}`,
                  }}
                  style={{
                    background: `radial-gradient(circle, ${activeSport.accent}33, rgba(3,12,10,0.92) 72%)`,
                  }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                >
                  <motion.div
                    className="absolute inset-2 rounded-full border"
                    animate={{ borderColor: `${activeSport.accent}40` }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="text-3xl font-black uppercase tracking-[0.14em] md:text-4xl"
                    animate={{ color: activeSport.accent }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  >
                    Nora
                  </motion.div>
                </motion.div>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 text-center">
              <div className="text-[12px] uppercase tracking-[0.22em] text-white/30">
                Auto-cycling sport-specific biomarkers every 4 seconds
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const SceneSummary: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="grid h-full items-center gap-6 xl:grid-cols-[0.94fr_1.06fr]">
      <div className="max-w-3xl">
        <SlideKicker>Why pick us</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.9] tracking-[-0.04em] text-white md:text-7xl">
          Athletes should not have to <span className="text-[#FB7185]">break down</span> before the system
          <span className="text-[#E0FE10]"> responds.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-300 md:text-[22px]">
          Pulse Check × AuntEdna turns performance pressure into an earlier, calmer, clinically connected
          response for elite athletes.
        </p>

        <div className="mt-7 grid gap-3">
          {FINAL_IMPACT_LINES.map((line, index) => (
            <motion.div
              key={line.title}
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * index }}
              className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
            >
              <span
                className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ background: line.accent, boxShadow: `0 0 14px ${line.accent}88` }}
              />
              <div>
                <div className="text-lg font-black text-white md:text-xl">{line.title}</div>
                <div className="mt-1 text-sm leading-relaxed text-zinc-400 md:text-base">{line.detail}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <GlassCard accentColor={COLORS.lime}>
          <div className="p-6 md:p-7">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-zinc-500">Closing statement</div>
            <div className="mt-3 text-3xl font-black leading-[1.02] text-white md:text-4xl">
              We close the gap between performance tech, real-time regulation, and licensed care.
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5 text-sm font-semibold md:text-base">
              <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3.5 py-2 text-sky-300">Detect earlier</span>
              <span className="rounded-full border border-lime-300/30 bg-lime-300/10 px-3.5 py-2 text-lime-200">Regulate sooner</span>
              <span className="rounded-full border border-pink-400/30 bg-pink-400/10 px-3.5 py-2 text-pink-300">Route to care</span>
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-4 sm:grid-cols-2">
          {FINAL_WEBSITES.map((site, index) => (
            <motion.a
              key={site.name}
              href={site.href}
              target="_blank"
              rel="noreferrer"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + 0.08 * index }}
              className="block"
            >
              <GlassCard accentColor={site.accent}>
                <div className="flex h-full items-start justify-between gap-4 p-5">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: site.accent }}>
                      Website
                    </div>
                    <div className="mt-2 text-2xl font-black text-white">{site.name}</div>
                    <div className="mt-2 break-all text-base font-semibold text-zinc-100">{site.url}</div>
                    <div className="mt-2 text-sm leading-relaxed text-zinc-400">{site.detail}</div>
                  </div>
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border"
                    style={{ borderColor: `${site.accent}44`, background: `${site.accent}12`, color: site.accent }}
                  >
                    <Globe className="h-5 w-5" />
                  </div>
                </div>
              </GlassCard>
            </motion.a>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {TEAM_MEMBERS.map((member, index) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 + 0.06 * index }}
            >
              <GlassCard accentColor={member.accent}>
                <div className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="text-lg font-black text-white">{member.name}</div>
                    <div className="text-sm text-zinc-400">{member.role}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: member.accent }}>
                      {member.org}
                    </div>
                    <div className="mt-3 flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
                      <Mail className="h-4 w-4 flex-shrink-0" style={{ color: member.accent }} />
                      <span className="min-w-0 break-all text-zinc-100">{member.email}</span>
                    </div>
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

const PulseAuntEdnaPitchPage: React.FC = () => {
  const [slide, setSlide] = useState(0);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const goNext = useCallback(() => setSlide((current) => Math.min(current + 1, TOTAL_SLIDES - 1)), []);
  const goBack = useCallback(() => setSlide((current) => Math.max(current - 1, 0)), []);

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

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
    if (slide === 1) return <SceneMeetNakyala />;
    if (slide === 2) return <SceneProblem />;
    if (slide === 3) return <SceneSolution />;
    if (slide === 4) return <SceneCheckIn />;
    if (slide === 5) return <SceneClinicalRouting />;
    if (slide === 6) return <SceneWelfareCheck />;
    if (slide === 7) return <SceneCompetitiveNarrative />;
    if (slide === 8) return <SceneCompetitiveProof />;
    if (slide === 9) return <SceneEvidence />;
    if (slide === 10) return <SceneBuildingBlocks />;
    if (slide === 11) return <SceneMarket />;
    if (slide === 12) return <SceneBeachhead />;
    if (slide === 13) return <SceneHundredMPath />;
    if (slide === 14) return <SceneGTM />;
    if (slide === 15) return <SceneTeam />;
    if (slide === 16) return <SceneSupporters />;
    return <SceneSummary />;
  }, [slide]);

  const footerReserve = viewport.width >= 768 ? 138 : 152;
  const idealSlideHeight = viewport.width >= 1600 ? 1020 : viewport.width >= 1280 ? 1040 : 980;
  const stageScale =
    viewport.width >= 1024 && viewport.height > 0
      ? Math.max(0.72, Math.min(1, (viewport.height - footerReserve) / idealSlideHeight))
      : 1;
  const stageDimension = `${100 / stageScale}%`;

  return (
    <>
      <Head>
        <title>Pulse Check x AuntEdna Pitch | Pulse Intelligence Labs</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
        <meta
          name="description"
          content="Pitch presentation for Pulse Check x AuntEdna, the signal-to-care platform for elite athlete mental performance training and mental care."
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
            <div className="flex h-full items-start justify-center overflow-hidden">
              <div
                className="origin-top"
                style={{
                  transform: `scale(${stageScale})`,
                  width: stageDimension,
                  height: stageDimension,
                }}
              >
                <AnimatePresence mode="wait">{scene}</AnimatePresence>
              </div>
            </div>
          </main>

          <footer className="sticky bottom-0 z-20 mx-3 mb-3 mt-1.5 flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl md:mx-5 md:px-5">
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
