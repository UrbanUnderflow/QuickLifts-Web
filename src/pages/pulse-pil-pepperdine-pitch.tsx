import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  Download,
  Globe,
  GraduationCap,
  Landmark,
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

const TOTAL_SLIDES = 22;
const PDF_DOWNLOAD_PATH = '/Pulse_Intelligence_Labs_Deck.pdf';

const SLIDE_META = [
  { label: 'Title', eyebrow: 'Slide 1' },
  { label: 'PIL Thesis', eyebrow: 'Slide 2' },
  { label: 'Flagship', eyebrow: 'Slide 3' },
  { label: 'Meet Nakyala', eyebrow: 'Slide 4' },
  { label: 'Problem', eyebrow: 'Slide 5' },
  { label: 'Solution', eyebrow: 'Slide 6' },
  { label: 'How It Works', eyebrow: 'Slide 7' },
  { label: 'Clinical Routing', eyebrow: 'Slide 8' },
  { label: 'Welfare Check', eyebrow: 'Slide 9' },
  { label: 'Competitive Story', eyebrow: 'Slide 10' },
  { label: 'Competitive Proof', eyebrow: 'Slide 11' },
  { label: 'AI Edge', eyebrow: 'Slide 12' },
  { label: 'Building Blocks', eyebrow: 'Slide 13' },
  { label: 'Market', eyebrow: 'Slide 14' },
  { label: 'Beachhead', eyebrow: 'Slide 15' },
  { label: 'Path to $100M', eyebrow: 'Slide 16' },
  { label: 'Capital Ladder', eyebrow: 'Slide 17' },
  { label: 'Go-To-Market', eyebrow: 'Slide 18' },
  { label: 'Team', eyebrow: 'Slide 19' },
  { label: 'AuntEDNA Partner', eyebrow: 'Slide 20' },
  { label: 'Who Supports Us', eyebrow: 'Slide 21' },
  { label: 'Summary', eyebrow: 'Slide 22' },
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

const PIL_PRODUCTS = [
  {
    name: 'Pulse Check',
    status: 'Shipped · flagship',
    buyer: 'Teams, universities, federations',
    detail: 'Mental performance training, athlete signal detection, and program-level sports intelligence.',
    accent: COLORS.lime,
  },
  {
    name: 'Fit With Pulse',
    status: 'Shipped',
    buyer: 'Creators, brands, corporations',
    detail: 'Community fitness infrastructure for challenges, accountability, retention, and monetization.',
    accent: COLORS.sky,
  },
  {
    name: 'Macra',
    status: 'Shipped',
    buyer: 'Consumers and performance users',
    detail: 'AI nutrition intelligence that turns meals, labels, and macros into structured health context.',
    accent: COLORS.orange,
  },
] as const;

const FLAGSHIP_SIGNALS = [
  {
    value: '$3M',
    label: 'visible ARR',
    detail: '12-24 month institutional beachhead already mapped across schools, teams, and federations.',
    accent: COLORS.lime,
  },
  {
    value: '$500M',
    label: 'SAM',
    detail: 'near-term serviceable market for institutional sports performance and mental-performance buyers.',
    accent: COLORS.sky,
  },
  {
    value: '$33.34B',
    label: 'TAM',
    detail: 'sports analytics, mental health apps, and remote patient monitoring at the market intersection.',
    accent: COLORS.pink,
  },
] as const;

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
    label: 'Support before crisis',
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
    detail: 'Nora requests a chat with the athlete to help settle their state in real time.',
    tagLead: 'In-flow',
    tagValue: 'AI Coach',
    accent: COLORS.lime,
    icon: Wind,
  },
  {
    number: '3',
    title: 'Route',
    detail: 'AuntEDNA.ai is the strategic clinical pathway partner when escalation is needed.',
    tagLead: 'Clinical',
    tagValue: 'Partner',
    accent: '#EC4899',
    icon: Shield,
  },
] as const;

const COMPETITOR_CARDS = [
  {
    name: 'Catapult',
    category: 'Athlete monitoring',
    detail: 'GPS load, team dashboards, and physical-performance analytics.',
    accent: COLORS.orange,
    icon: Globe,
    scaleLabel: 'Core strength',
    scaleValue: 'Physical load intelligence',
    costLabel: 'Gap',
    costValue: 'No mental performance-to-care pathway',
  },
  {
    name: 'WHOOP',
    category: 'Performance wearable',
    detail: 'Consumer recovery, strain, sleep, and biometric habit loops.',
    accent: COLORS.teal,
    icon: Zap,
    scaleLabel: 'Core strength',
    scaleValue: 'Wearable recovery signal',
    costLabel: 'Gap',
    costValue: 'No institutional clinical routing',
  },
  {
    name: 'Lumos Labs',
    category: 'Cognitive training',
    detail: 'Consumer brain-training games and cognitive exercise content.',
    accent: COLORS.purple,
    icon: Brain,
    scaleLabel: 'Core strength',
    scaleValue: 'Cognitive exercise library',
    costLabel: 'Gap',
    costValue: 'Not built for teams or live care',
  },
] as const;

const COMPETITIVE_ROWS = [
  {
    feature: 'Athlete biometric and performance signal',
    catapult: 'yes',
    whoop: 'yes',
    lumos: 'no',
    pulse: 'yes',
  },
  {
    feature: 'AI-driven mental performance coaching',
    catapult: 'no',
    whoop: 'partial',
    lumos: 'partial',
    pulse: 'yes',
  },
  {
    feature: 'Sport-specific context and athlete language',
    catapult: 'partial',
    whoop: 'no',
    lumos: 'no',
    pulse: 'yes',
  },
  {
    feature: 'Institutional buyer workflow',
    catapult: 'yes',
    whoop: 'partial',
    lumos: 'no',
    pulse: 'yes',
  },
  {
    feature: 'Strategic clinical pathway partner',
    catapult: 'no',
    whoop: 'no',
    lumos: 'no',
    pulse: 'yes',
  },
  {
    feature: 'Unified detect → train → route → measure pipeline',
    catapult: 'no',
    whoop: 'no',
    lumos: 'no',
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
    detail: 'New England Patriots (initial conversations had)',
    price: '$500K',
    unit: 'avg annual contract',
    example: '~55 roster + practice squad',
    accent: '#F59E0B',
    icon: Trophy,
  },
  {
    tier: 'Segment 5',
    name: 'Federation / NGB',
    detail: 'USATF or USA Soccer',
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

const _FULL_TAM_MARKETS = [
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

const _FULL_TAM_TOTAL = '$33.34B';

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
    detail: 'Patriots initial conversations had.',
    value: '$500K',
    accent: '#F59E0B',
  },
  {
    title: 'Federation / NGB',
    detail: 'USATF or USA Soccer.',
    value: '$750K',
    accent: '#EF4444',
  },
] as const;

const BEACHHEAD_TOTAL = '~$3.0M';

const PATH_PHASE_ONE = [
  {
    label: 'D2 / D3',
    count: '3-4',
    detail: 'Fastest close, volume play',
    revenue: '$225-300K',
    accent: '#6EE7B7',
  },
  {
    label: 'Mid-Major',
    count: '6-7',
    detail: 'Hampton, Clark Atlanta + new',
    revenue: '$900K-$1.05M',
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
    detail: 'Initial conversations had',
    revenue: '$500K',
    accent: '#F59E0B',
  },
  {
    label: 'Federation',
    count: '1',
    detail: 'USATF or USA Soccer',
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
    detail: 'NFL, NBA, MLS - Patriots pathway',
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

const CAPITAL_LADDER = [
  { round: 'Pre-Seed', amount: '$1.4M', timing: 'Now', note: '$10M pre-money', accent: COLORS.lime },
  { round: 'Seed', amount: '$5M', timing: 'After beachhead proof', note: 'Expand sales and product', accent: COLORS.sky },
  { round: 'Series A', amount: '$12M', timing: 'After repeatable ACV', note: 'National institutional scale', accent: COLORS.purple },
  { round: 'Series B', amount: '$25M', timing: 'After category leadership', note: 'League and international growth', accent: COLORS.pink },
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
  quoteAttribution: 'Pulse Check Flagship Thesis',
  biometrics: [
    { label: 'HRV baseline', value: '62 ms', accent: COLORS.sky },
    { label: 'Pre-match focus', value: 'High', accent: COLORS.lime },
    { label: 'Nora check-ins', value: '14 / wk', accent: COLORS.pink },
  ],
  focus: [
    { title: 'The Challenge', detail: 'The challenge often starts before a visible breakdown.', accent: COLORS.sky },
    { title: 'In-the-moment support', detail: 'Help needs to live inside the athlete flow.', accent: COLORS.lime },
    { title: 'Care if needed', detail: 'Escalation is available when the moment goes beyond coaching.', accent: COLORS.red },
  ],
} as const;

const MANAGEMENT_TEAM = [
  {
    name: 'Tremaine Grant',
    role: 'Founder & CEO',
    imageSrc: '/TremaineFounder.jpg',
    imagePosition: 'center 12%',
    accent: COLORS.lime,
    schoolChip: { label: 'Florida State', background: '#782F40', color: '#CEB888', border: '#CEB88866' },
    summary: 'Computer science background with 20 years software engineering across consumer, health, data, and AI product systems.',
    credentials: [
      'D1 athlete at FSU',
      'Clinical research: IQVIA + Clinical Inc',
      'Pfizer, Eli Lilly, Medpace, Dexcom program exposure',
      'Founder University Cohort 11',
      'Prior founder: Bulk to 200K+ downloads',
    ],
  },
  {
    name: 'Bobby Nweke',
    role: 'Chief of Staff',
    imageSrc: '/bobbyAdvisor.jpg',
    imagePosition: 'center 15%',
    accent: COLORS.sky,
    schoolChip: { label: 'Harvard', background: '#A51C30', color: '#FFFFFF', border: '#FFFFFF33' },
    summary: '10 years in human performance across training, athletics, education, and executive communication.',
    credentials: [
      'Personal trainer, athlete, and educator',
      'Teach For America alumnus',
      'Former principal',
      'TED executive speaking coach',
      'Builds operating rhythm across product, people, and partnerships',
    ],
  },
] as const;

const HEAD_OF_DESIGN = {
  name: 'Lola Oluwaladun',
  role: 'Head of Design',
  imageSrc: '/lola.jpg',
  imagePosition: 'center 20%',
  accent: COLORS.purple,
  summary: 'Owns product experience, visual systems, and athlete-facing UX across the Pulse portfolio.',
  tags: ['Figma', 'UX/UI', 'Branding'],
} as const;

const TEAM_ADVISORS = [
  { name: 'Marques Zak', role: 'CMO @ ACC', detail: 'Power-conference access and institutional marketing', imageSrc: '/zak.jpg', imagePosition: 'center top' },
  { name: 'Valerie Alexander', role: 'Fortune 500 Consultant', detail: 'Enterprise strategy, IPO Attorney, and executive advisory', imageSrc: '/Val.jpg', imagePosition: 'center top' },
  { name: 'DeRay Mckesson', role: 'Campaign Zero', detail: 'Movement building, public systems, and civic trust', imageSrc: '/Deray.png', imagePosition: 'center top' },
  { name: 'Erik Edwards', role: 'Partner @ Cooley', detail: 'Venture legal strategy and company formation', imageSrc: '/ErikEdwards.png', imagePosition: 'center top' },
] as const;

const TEAM_STRATEGIC_PARTNERS = [
  {
    name: 'AuntEDNA.ai',
    role: 'Clinical pathway partner',
    detail: 'Escalation, clinician workflow, and care-routing infrastructure for Pulse Check.',
    accent: COLORS.pink,
    people: [
      { name: 'Jelanna Salas Olivera', role: 'CEO', imageSrc: '/jelanna.jpg' },
      { name: 'Dr. Tracey Hathaway', role: 'COO', imageSrc: '/dr-tracey-basketball.jpeg' },
    ],
  },
  {
    name: 'Polar',
    role: 'Hardware partner',
    detail: 'Wearable signal partner for heart rate, exertion, and recovery context.',
    accent: COLORS.sky,
  },
  {
    name: 'Cooley LLP',
    role: 'Legal counsel',
    detail: 'Venture counsel and company infrastructure.',
    accent: COLORS.pink,
  },
] as const;

const TEAM_INVESTORS = [
  {
    name: 'LAUNCH',
    role: 'Investor',
    detail: "Jason Calacanis's Fund and founder network.",
    accent: COLORS.lime,
  },
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
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E0FE10]/25 bg-black/35 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#E0FE10] backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E0FE10] shadow-[0_0_8px_rgba(224,254,16,0.5)]" />
            Institutional Stakeholder Deck
          </div>

          <div
            className="text-center leading-[0.82]"
            style={{ fontFamily: '"Bebas Neue", Impact, "Arial Narrow", sans-serif' }}
          >
            <span className="block text-[4.6rem] tracking-[-0.05em] text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.08)] md:text-[8.5rem] xl:text-[10rem]">
              Pulse Intelligence Labs
            </span>
            <motion.span
              className="mt-4 block text-[3.3rem] leading-none text-[#E0FE10] md:text-[5.6rem] xl:text-[6.6rem]"
              animate={{ scale: [1, 1.025, 1], textShadow: ['0 0 20px rgba(224,254,16,0.28)', '0 0 38px rgba(224,254,16,0.55)', '0 0 20px rgba(224,254,16,0.28)'] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              The Human Performance Company
            </motion.span>
          </div>

          <motion.div
            className="mx-auto mt-8 max-w-5xl text-xl leading-relaxed text-white/60 md:mt-9 md:text-[1.4rem]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.9 }}
          >
            We build AI-powered systems for measuring and training human performance.{' '}
            <span className="font-medium text-[#E0FE10]">Pulse Check is the flagship institutional platform.</span>
          </motion.div>

          <motion.div
            className="mx-auto mt-8 grid max-w-4xl gap-3 md:grid-cols-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.15 }}
          >
            {[
              { label: 'Pre-Seed Ask', value: '$1.4M', detail: '$10M pre-money', color: COLORS.lime },
              { label: 'Founder', value: 'Tremaine Grant', detail: 'Founder & CEO', color: COLORS.sky },
              { label: 'Flagship product', value: 'Pulse Check', detail: '', color: COLORS.pink },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-left backdrop-blur-xl">
                <div className="text-[9px] font-bold uppercase tracking-[0.24em]" style={{ color: item.color }}>
                  {item.label}
                </div>
                <div className="mt-2 text-2xl font-black leading-none text-white md:text-3xl">{item.value}</div>
                {item.detail ? (
                  <div className="mt-2 text-xl font-medium uppercase tracking-[0.16em] text-white/38">{item.detail}</div>
                ) : null}
              </div>
            ))}
          </motion.div>

          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium uppercase tracking-[0.26em] text-white/30 md:mt-10 md:gap-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 1.35 }}
          >
            {[
              { label: 'Detect', color: COLORS.teal },
              { label: 'Train', color: COLORS.lime },
              { label: 'Route', color: COLORS.purple },
              { label: 'Measure', color: COLORS.pink },
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
    </div>
  </SceneFrame>
);

const ScenePILThesis: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="grid min-h-[42rem] items-center gap-8 xl:grid-cols-[0.9fr_1.1fr]">
      <div>
        <SlideKicker>PIL thesis</SlideKicker>
        <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.94] text-white md:text-7xl">
          One company building the infrastructure for <span className="text-[#E0FE10]">human performance.</span>
        </h1>
        <p className="mt-5 max-w-3xl text-xl leading-relaxed text-zinc-300 md:text-2xl">
          Pulse Intelligence Labs turns body, mind, nutrition, and program context into measurable performance systems.
        </p>

        <div className="mt-8 grid max-w-xs gap-3">
          {[
            { value: '1', label: 'shared ecosystem', accent: COLORS.pink },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="font-['Bebas_Neue'] text-[4.5rem] leading-none" style={{ color: item.accent }}>
                {item.value}
              </div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          {PIL_PRODUCTS.map((product, index) => (
            <motion.div
              key={product.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 + index * 0.12 }}
            >
              <GlassCard accentColor={product.accent} className="h-full">
                <div className="flex min-h-[19rem] flex-col p-5">
                  <div className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: product.accent }}>
                    {product.status}
                  </div>
                  <div className="mt-4 font-['Bebas_Neue'] text-[2.8rem] leading-none tracking-[0.02em] text-white">
                    {product.name}
                  </div>
                  <div className="mt-2 text-[15px] leading-[1.55] font-bold uppercase tracking-[0.14em] text-white/45 md:text-xl">
                    {product.buyer}
                  </div>
                  <div className="mt-auto border-t border-white/8 pt-4 text-xl leading-relaxed text-zinc-400">{product.detail}</div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        <GlassCard accentColor={COLORS.lime}>
          <div className="grid gap-4 p-5 md:grid-cols-[0.55fr_1.45fr] md:p-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#E0FE10]">Shared core</div>
              <div className="mt-2 text-2xl font-black leading-tight text-white">Nora + identity + health data</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { label: 'AI coach', value: 'Nora', accent: COLORS.lime },
                { label: 'Shared user', value: 'Identity', accent: COLORS.sky },
                { label: 'Signals', value: 'Health data', accent: COLORS.pink },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: item.accent }}>
                    {item.label}
                  </div>
                  <div className="mt-2 text-xl font-black text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  </SceneFrame>
);

const SceneFlagshipThesis: React.FC = () => (
  <SceneFrame accent={COLORS.sky}>
    <div className="grid min-h-[42rem] items-center gap-9 xl:grid-cols-[0.95fr_1.05fr]">
      <div>
        <SlideKicker>Flagship focus</SlideKicker>
        <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-7xl">
          Pulse Check is our primary focus and clearest path to a $100M company.
        </h1>
        <p className="mt-5 max-w-3xl text-xl leading-relaxed text-zinc-300 md:text-2xl">
          Institutional buyers, proprietary sports context, and a clear clinical pathway make Pulse Check the flagship
          product.
        </p>
      </div>

      <div className="relative">
        <div className="absolute inset-0 rounded-[34px] bg-[radial-gradient(circle_at_50%_50%,rgba(224,254,16,0.18),transparent_58%)] blur-2xl" />
        <GlassCard accentColor={COLORS.sky}>
          <div className="relative overflow-hidden p-6 md:p-8">
            <div className="absolute right-[-10%] top-[-20%] h-72 w-72 rounded-full bg-[#38BDF8]/8 blur-3xl" />
            <div className="absolute bottom-[-20%] left-[-8%] h-72 w-72 rounded-full bg-[#E0FE10]/8 blur-3xl" />

            <div className="relative grid gap-4">
              {FLAGSHIP_SIGNALS.map((signal, index) => (
                <motion.div
                  key={signal.label}
                  className="grid gap-4 rounded-2xl border border-white/10 bg-black/25 p-5 md:grid-cols-[11rem_1fr]"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.12 }}
                >
                  <div>
                    <div className="font-['Bebas_Neue'] text-[4.3rem] leading-none" style={{ color: signal.accent }}>
                      {signal.value}
                    </div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">{signal.label}</div>
                  </div>
                  <div className="flex items-center text-xl font-semibold leading-snug text-white md:text-xl">{signal.detail}</div>
                </motion.div>
              ))}
            </div>

            <div className="relative mt-6 rounded-2xl border border-[#E0FE10]/15 bg-[#E0FE10]/8 p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#E0FE10]">Moat</div>
              <div className="mt-2 text-2xl font-black leading-tight text-white">Sports Intelligence Layer</div>
              <div className="mt-2 text-xl leading-relaxed text-zinc-300">
                Sport-specific language, athlete biometrics, coach workflows, and strategic clinical partner routing compound into a
                system competitors cannot match with a single wearable, analytics dashboard, or cognitive game library.
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
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

            <div className="mt-5 flex flex-wrap items-center gap-3 text-xl font-medium tracking-[0.03em] text-white/65 md:text-xl">
              <span className="font-semibold text-[#A855F7]">{ATHLETE_SPOTLIGHT.sport}</span>
              <span className="text-white/18">·</span>
              <span>{ATHLETE_SPOTLIGHT.position}</span>
              <span className="text-white/18">·</span>
              <span>{ATHLETE_SPOTLIGHT.number}</span>
            </div>
            <div className="mt-2 text-xl tracking-[0.02em] text-white/38 md:text-xl">
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
                <span className="font-['Bebas_Neue'] text-xl tracking-[0.08em] text-white">{ATHLETE_SPOTLIGHT.number.replace('#', '')}</span>
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
          {ATHLETE_SPOTLIGHT.name}&apos;s story is what Pulse Check is built to support before, during, and after the
          breakdown, with AuntEDNA.ai available as the strategic clinical pathway partner when care is needed.
        </div>
      </motion.div>
    </div>
  </SceneFrame>
);

const SceneProblem: React.FC = () => (
  <SceneFrame accent={COLORS.red}>
    <div className="relative box-border h-full min-h-[42rem] overflow-hidden pt-8 md:pt-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_20%,rgba(251,113,133,0.14),transparent_24%),radial-gradient(circle_at_56%_46%,rgba(224,254,16,0.08),transparent_20%),radial-gradient(circle_at_82%_30%,rgba(56,189,248,0.12),transparent_26%)]" />

      <div className="relative z-10 flex h-full flex-col gap-8 md:gap-10">
        <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr] xl:items-start">
          <div className="max-w-5xl">
            <SlideKicker>The problem</SlideKicker>
            <h1 className="mt-5 text-5xl font-black leading-[0.9] text-white md:text-7xl">
              Performance pressure gets seen too late.
            </h1>
            <p className="mt-4 max-w-4xl text-2xl font-semibold leading-tight text-[#FB7185] md:text-4xl">
              Athlete pressure rises before support systems respond.
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
          <p className="mt-6 max-w-2xl text-xl leading-[1.6] text-zinc-300 md:text-xl">
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
                    className="absolute -top-3 left-5 flex h-7 w-7 items-center justify-center rounded-full border bg-[#0a0a0b] font-['Bebas_Neue'] text-xl tracking-[0.06em]"
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
            <div className="text-xl leading-[1.5] text-zinc-300 md:text-[0.96rem]">
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
            <div className="mt-4 max-w-5xl text-xl leading-relaxed text-zinc-300 md:text-xl">
              A passive check-in fires at game-day timing. Nora requests a chat, detects the signal, and{' '}
              <span className="font-medium text-[#E0FE10]">helps regulate in real time</span> all inside the athlete flow.
            </div>
          </div>

          <motion.div
            className="mt-8 grid min-h-0 flex-1 items-stretch gap-6 xl:grid-cols-[minmax(48rem,1.35fr)_minmax(24rem,0.65fr)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
          >
            <div className="flex w-full flex-col rounded-[20px] border border-white/8 bg-white/[0.02] p-5 md:p-6">
              <div className="flex items-center gap-3 border-b border-white/8 pb-4">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#00D4AA] to-[#E0FE10] font-['Bebas_Neue'] text-xl text-black after:absolute after:bottom-[-2px] after:right-[-2px] after:h-[10px] after:w-[10px] after:rounded-full after:border-2 after:border-[#0a0a0b] after:bg-[#00D4AA]">
                  N
                </div>
                <div>
                  <div className="text-xl font-bold text-white">Nora</div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#00D4AA]">Mental Performance AI</div>
                </div>
              </div>

              <div className="mt-4 flex min-h-0 flex-col gap-3">
                <motion.div
                  className="max-w-[85%] rounded-[12px] border border-[#E0FE10]/12 bg-[#E0FE10]/6 px-4 py-3 text-xl leading-relaxed text-zinc-200"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.4 }}
                >
                  <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.18em] text-[#E0FE10]">Step 2 · The read</span>
                  I&apos;m sensing some anxiety in your check-in. Let&apos;s run box breathing right now before this builds.
                </motion.div>

                <motion.div
                  className="ml-auto max-w-[70%] rounded-[12px] border border-[#5B8DEF]/15 bg-[#5B8DEF]/10 px-4 py-3 text-xl text-white"
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
                    <div className="text-xl font-bold text-white">Box Breathing · Round 1</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Step 3 · The regulation</div>
                    <div className="mt-2 text-xl leading-relaxed text-zinc-400">
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
                        className="max-w-[72%] rounded-[12px] border border-white/10 bg-white/[0.03] px-4 py-3 text-xl leading-relaxed text-zinc-200"
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
                        className="ml-auto max-w-[62%] rounded-[12px] border border-[#10B981]/18 bg-[#10B981]/10 px-4 py-3 text-xl font-medium text-white"
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

            <motion.div
              className="hidden h-full rounded-[20px] border border-white/8 bg-white/[0.025] p-5 xl:block"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, delay: 0.65 }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#E0FE10]">What is happening</div>
              <div className="mt-4 grid gap-3">
                {[
                  {
                    step: '01',
                    title: 'Game-day prompt',
                    detail: 'Pulse Check reaches the athlete before staff can see the pressure building.',
                    accent: COLORS.teal,
                  },
                  {
                    step: '02',
                    title: 'Athlete opts into the chat',
                    detail: 'Nora requests a conversation and reads the check-in signal in context.',
                    accent: COLORS.lime,
                  },
                  {
                    step: '03',
                    title: 'State regulation starts immediately',
                    detail: 'Nora guides a short breathing cycle and watches the biometric trend move.',
                    accent: COLORS.pink,
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.step}
                    className="rounded-2xl border border-white/8 bg-black/20 p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.78 + index * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-['Bebas_Neue'] text-xl leading-none"
                        style={{ borderColor: `${item.accent}55`, color: item.accent, background: `${item.accent}12` }}
                      >
                        {item.step}
                      </div>
                      <div className="text-xl font-black leading-tight text-white">{item.title}</div>
                    </div>
                    <div className="mt-3 text-xl leading-relaxed text-zinc-400">{item.detail}</div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-[#E0FE10]/15 bg-[#E0FE10]/10 p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#E0FE10]">Outcome</div>
                <div className="mt-2 text-2xl font-black leading-tight text-white">Support happens before escalation.</div>
                <div className="mt-3 text-xl leading-relaxed text-zinc-300">
                  If the athlete settles, the moment stays lightweight. If the signal worsens, the next slide shows how
                  Pulse Check routes the context to the clinical pathway.
                </div>
              </div>
            </motion.div>
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
            <div className="text-xl leading-relaxed text-zinc-300">
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
          When it moves beyond Nora, Pulse Check routes through a strategic clinical pathway.
        </h1>
        <div className="mt-4 max-w-5xl text-xl font-semibold leading-tight text-purple-300 md:text-3xl">
          The trigger shows up in the chat first. Then Pulse Check packages the context for AuntEDNA.ai, PIL&apos;s
          strategic clinical pathway partner.
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-7 xl:grid-cols-[minmax(400px,440px)_minmax(0,1fr)]">
        <motion.div
          className="relative mx-auto flex w-full max-w-[440px] flex-col"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#F472B6]">
              Nora in-chat app experience
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
              Athlete view
            </div>
          </div>

          <div className="relative h-[38rem] w-full overflow-hidden rounded-[42px] border-2 border-zinc-700/70 bg-[#0a0a0b] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
            <div className="absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-black" />
            <div className="relative flex h-full flex-col bg-gradient-to-b from-[#111113] to-[#050505]">
              <div className="flex items-center justify-between px-8 pb-2 pt-4 text-[11px] font-semibold text-white">
                <span>T-Mobile</span>
                <span className="text-white/45">2:14 AM</span>
                <div className="relative h-2.5 w-5 rounded-sm border border-white/60">
                  <div className="absolute inset-[2px] rounded-[1px] bg-green-400" />
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-7 pb-7 pt-5">
                <div className="mb-4 flex items-center gap-3 border-b border-white/15 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#00D4AA] to-[#E0FE10] font-['Bebas_Neue'] text-[18px] text-black">
                    N
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-black leading-tight text-white">Nora</div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] leading-snug text-[#00D4AA]">
                      Mental Performance AI
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3">
                  <motion.div
                    className="max-w-[88%] rounded-[15px] border border-[#E0FE10]/12 bg-[#E0FE10]/6 px-4 py-3 text-[15px] leading-relaxed text-white"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    You&apos;re up late. How are you feeling tonight?
                  </motion.div>

                  <motion.div
                    className="ml-auto max-w-[88%] rounded-[15px] border border-[#EC4899]/30 bg-[#EC4899]/8 px-4 py-3 text-[15px] leading-relaxed text-white"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 }}
                  >
                    I don&apos;t feel happy anymore. I feel empty inside. I don&apos;t know why I&apos;m still doing this.
                    <div className="mt-3 flex items-center gap-2 border-t border-dashed border-[#EC4899]/30 pt-2 text-[8px] font-bold uppercase tracking-[0.18em] text-[#F472B6]">
                      <span className="h-[5px] w-[5px] rounded-full bg-[#F472B6] shadow-[0_0_8px_rgba(244,114,182,0.7)]" />
                      Critical signal detected
                    </div>
                  </motion.div>

                  <motion.div
                    className="max-w-[88%] rounded-[15px] border border-[#E0FE10]/12 bg-[#E0FE10]/6 px-4 py-3 text-[15px] leading-relaxed text-white"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75 }}
                  >
                    I hear you. This is beyond what I should handle alone. Connecting you with someone trained to help right now.
                  </motion.div>

                  <motion.div
                    className="mt-auto flex items-center justify-between gap-3 rounded-[14px] border border-purple-400/20 bg-gradient-to-r from-purple-400/12 to-pink-400/12 px-4 py-3 text-[15px] font-semibold leading-tight text-white"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.95 }}
                  >
                    <span>Clinical pathway handoff initiated</span>
                    <motion.span
                      className="text-xl text-[#F472B6]"
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      →
                    </motion.span>
                  </motion.div>
                </div>
              </div>
            </div>
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
                    name: 'AuntEDNA.ai',
                    sub: 'Strategic partner',
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
              { title: 'Destination', detail: 'AuntEDNA.ai clinical pathway handoff', accent: '#EC4899' },
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
            This is not just a score. It creates a live human response experience.
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

                <div className="mt-6 text-xl font-semibold text-white">
                  {connected ? `Connected • ${mins}:${secs.toString().padStart(2, '0')}` : 'Calling...'}
                </div>
                <div className="mt-2 text-xl text-zinc-400">
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
          Pulse Check owns the athlete-performance workflow competitors split apart.
        </h1>
        <div className="mt-3 text-xl font-medium text-zinc-300 md:text-[1.35rem]">
          Catapult, WHOOP, and Lumos Labs each own a slice. Pulse Check ties signal, training, routing, and measurement
          into one institutional system.
        </div>
      </div>

      <div className="grid flex-1 items-center gap-3 xl:grid-cols-[1fr_auto_1fr]">
        <div className="grid gap-3 xl:pr-6">
          {COMPETITOR_CARDS.map((card, index) => {
            const Icon = card.icon;

            return (
              <motion.div
                key={card.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * index }}
              >
                <GlassCard accentColor={card.accent} className="h-full">
                  <div className="relative grid gap-4 p-4 md:grid-cols-[auto_1fr_1.1fr] md:items-center">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border"
                      style={{ borderColor: `${card.accent}45`, background: `${card.accent}12` }}
                    >
                      <Icon className="h-5.5 w-5.5" style={{ color: card.accent }} />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: card.accent }}>
                        {card.category}
                      </div>
                      <div className="mt-1 text-2xl font-black leading-none text-white">{card.name}</div>
                      <div className="mt-2 text-xl leading-snug text-zinc-400">{card.detail}</div>
                    </div>
                    <div className="grid gap-2">
                      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                        <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{card.scaleLabel}</div>
                        <div className="mt-1 text-xl font-bold text-white">{card.scaleValue}</div>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                        <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{card.costLabel}</div>
                        <div className="mt-1 text-xl font-bold text-white">{card.costValue}</div>
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
                Pulse Check turns that stack into one system.
              </div>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {[
                  { label: 'Detect the signal', accent: COLORS.sky },
                  { label: 'Train under pressure', accent: COLORS.purple },
                  { label: 'Route through AuntEDNA.ai', accent: COLORS.teal },
                  { label: 'Measure program progress', accent: COLORS.red },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border px-4 py-4"
                    style={{ borderColor: `${item.accent}35`, background: `${item.accent}0f` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.accent, boxShadow: `0 0 10px ${item.accent}66` }} />
                      <div className="text-xl font-bold leading-tight text-white">{item.label}</div>
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
          One platform. <span className="text-[#E0FE10]">Institutional athlete intelligence.</span>
        </h1>
        <div className="mt-4 text-2xl font-medium text-zinc-300 md:text-3xl">
          The application competitors map exactly to the form: Catapult, WHOOP, and Lumos Labs.
        </div>
      </div>

      <GlassCard accentColor={COLORS.lime}>
        <div className="overflow-x-auto p-4 md:p-6">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[2.35fr_repeat(3,1fr)_1.35fr] overflow-hidden rounded-t-[22px] border border-white/8 bg-[#131315]">
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
                    <div className="mt-2 text-[11px] text-zinc-500 md:text-xl">{card.scaleValue}</div>
                    <div className="text-[11px] text-zinc-500 md:text-xl">{card.costValue}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-center border-l border-[#E0FE10]/10 bg-[#E0FE10]/10 px-4 py-5 text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-[#E0FE10] md:text-[13px]">
                Pulse Check
              </div>
            </div>

            <div className="rounded-b-[22px] border border-t-0 border-white/8">
              {COMPETITIVE_ROWS.map((row, index) => (
                <div
                  key={row.feature}
                  className={`grid grid-cols-[2.35fr_repeat(3,1fr)_1.35fr] items-center ${
                    index !== COMPETITIVE_ROWS.length - 1 ? 'border-b border-white/8' : ''
                  } bg-white/[0.02] transition-colors hover:bg-white/[0.03]`}
                >
                  <div className="px-4 py-5 text-xl font-semibold leading-snug text-white md:text-xl">{row.feature}</div>
                  <div className="px-3 py-5">
                    <ComparisonCell status={row.catapult} accent={COLORS.orange} />
                  </div>
                  <div className="px-3 py-5">
                    <ComparisonCell status={row.whoop} accent={COLORS.teal} />
                  </div>
                  <div className="px-3 py-5">
                    <ComparisonCell status={row.lumos} accent={COLORS.purple} />
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
          <div className="text-xl leading-relaxed text-zinc-300 md:text-xl">
            <span className="font-bold text-white">No single competitor covers the full pipeline.</span> Athletes today
            need multiple disconnected tools. Pulse Check owns the workflow from performance signal to pressure training,
            strategic clinical handoff, and program-level measurement.
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
          Average annual contract value at each segment of the market. These are the units that compound into the
          revenue plan.
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
                  <div className="mt-3 text-xl leading-snug text-zinc-400">{tier.detail}</div>

                  <div className="mt-auto border-t border-white/8 pt-5">
                    <div className="text-5xl font-black leading-none text-[#E0FE10] md:text-6xl">{tier.price}</div>
                    <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{tier.unit}</div>
                    <div className="mt-4 text-xl italic leading-relaxed text-zinc-500">{tier.example}</div>
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

const SceneMarket: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let W = 0, H = 0;

    function resize() {
      if (!canvas) return;
      const rect = canvas.parentElement!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx!.scale(dpr, dpr);
      W = rect.width;
      H = rect.height;
    }
    resize();
    window.addEventListener('resize', resize);

    const circles = [
      { label: ['Sports', 'Analytics'], sub: '$4.79B', color: [91,141,239] as [number,number,number], offsetX: -0.14, offsetY: -0.12, r: 0.28 },
      { label: ['Mental', 'Health'], sub: '$6.52B', color: [168,85,247] as [number,number,number], offsetX: 0.14, offsetY: -0.12, r: 0.28 },
      { label: ['Remote', 'Monitoring'], sub: '$22.03B', color: [236,72,153] as [number,number,number], offsetX: 0, offsetY: 0.14, r: 0.3 },
    ];

    const orbitParticles = circles.flatMap((_, ci) =>
      Array.from({ length: 12 }, () => ({
        ci,
        angle: Math.random() * Math.PI * 2,
        speed: (Math.random() * 0.3 + 0.2) * (Math.random() > 0.5 ? 1 : -1),
        dist: 0.9 + Math.random() * 0.25,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.2,
      }))
    );

    let time = 0;

    function draw() {
      if (!ctx) return;
      time += 0.012;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2 + Math.min(W, H) * 0.11;
      const cy = H / 2;
      const baseR = Math.min(W, H) * 1.03;

      circles.forEach((c, i) => {
        const x = cx + c.offsetX * baseR;
        const y = cy + c.offsetY * baseR;
        const r = c.r * baseR;
        const breathe = 1 + Math.sin(time * 0.8 + i * 2) * 0.015;
        const rr = r * breathe;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, rr);
        grad.addColorStop(0, `rgba(${c.color.join(',')}, 0.12)`);
        grad.addColorStop(0.7, `rgba(${c.color.join(',')}, 0.04)`);
        grad.addColorStop(1, `rgba(${c.color.join(',')}, 0)`);
        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();

        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.color.join(',')}, 0.25)`;
        ctx.lineWidth = 1.5; ctx.stroke();

        ctx.save();
        ctx.setLineDash([3, 8]);
        ctx.lineDashOffset = -time * 15 * (i % 2 === 0 ? 1 : -1);
        ctx.beginPath(); ctx.arc(x, y, rr + 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c.color.join(',')}, 0.1)`;
        ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();

        const lx = cx + c.offsetX * 1.8 * baseR;
        const ly = cy + c.offsetY * 1.8 * baseR;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 16px "DM Sans", sans-serif';
        ctx.fillStyle = `rgba(${c.color.join(',')}, 0.85)`;
        c.label.forEach((line, li) => ctx.fillText(line, lx, ly - 12 + li * 20));
        ctx.font = '32px "Bebas Neue", sans-serif';
        ctx.fillStyle = `rgba(${c.color.join(',')}, 0.7)`;
        ctx.fillText(c.sub, lx, ly + 28);
      });

      // Center glow
      const intGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 0.12);
      intGrad.addColorStop(0, 'rgba(200,255,0,0.2)');
      intGrad.addColorStop(1, 'rgba(200,255,0,0)');
      ctx.beginPath(); ctx.arc(cx, cy, baseR * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = intGrad; ctx.fill();

      // Pulsing ring
      const pulseR = baseR * 0.08 + Math.sin(time * 2) * baseR * 0.01;
      ctx.beginPath(); ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200,255,0,${0.35 + Math.sin(time * 2) * 0.15})`;
      ctx.lineWidth = 2; ctx.stroke();

      // Center labels
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 11px "DM Sans", sans-serif';
      ctx.fillStyle = 'rgba(200,255,0,0.9)';
      ctx.fillText('PULSE CHECK', cx, cy - 8);
      ctx.fillStyle = 'rgba(200,255,0,0.6)';
      ctx.fillText('PIL FLAGSHIP', cx, cy + 8);

      // Orbit particles
      orbitParticles.forEach(p => {
        const c = circles[p.ci];
        const x = cx + c.offsetX * baseR;
        const y = cy + c.offsetY * baseR;
        const r = c.r * baseR * p.dist;
        p.angle += p.speed * 0.016;
        const px = x + Math.cos(p.angle) * r;
        const py = y + Math.sin(p.angle) * r;
        ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.color.join(',')},${p.opacity * (0.6 + Math.sin(time + p.angle) * 0.4)})`;
        ctx.fill();
      });

      // Connecting lines from center
      circles.forEach((c) => {
        const x = cx + c.offsetX * baseR;
        const y = cy + c.offsetY * baseR;
        ctx.save();
        ctx.setLineDash([2, 6]);
        ctx.lineDashOffset = -time * 20;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(200,255,0,0.08)';
        ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      });

      animId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const markets = [
    { name: 'Sports Analytics', desc: 'Performance data, wearables, athlete monitoring', value: '$4.79B', color: '#5B8DEF' },
    { name: 'Mental Health Apps', desc: 'Meditation, stress support, digital wellness', value: '$6.52B', color: '#A855F7' },
    { name: 'Remote Patient Monitoring', desc: 'Connected care, escalation, intervention systems', value: '$22.03B', color: '#EC4899' },
  ];

  return (
    <motion.div
      className="relative h-full w-full overflow-hidden"
      style={{ background: '#0a0a0b' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={transition}
    >
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute left-[20%] top-[-10%] h-[55vh] w-[50vw] rounded-full" style={{ background: 'radial-gradient(circle,rgba(200,255,0,0.05),transparent 55%)' }} />
      <div className="pointer-events-none absolute bottom-[-15%] right-[10%] h-[45vh] w-[45vw] rounded-full" style={{ background: 'radial-gradient(circle,rgba(91,141,239,0.04),transparent 55%)' }} />

      <div className="relative z-10 grid h-full items-center px-10 py-10 md:px-14 xl:grid-cols-[0.92fr_1.08fr] xl:gap-12">
        {/* LEFT */}
        <motion.div
          className="flex flex-col"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Kicker */}
          <div className="mb-3.5 inline-flex items-center gap-2 self-start text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c8ff00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c8ff00]" style={{ boxShadow: '0 0 8px rgba(200,255,0,0.4)' }} />
            Market size
          </div>

          <h1 className="mb-2.5 text-[1.9rem] font-bold leading-[1.05] tracking-tight text-white md:text-[2.6rem]">
            $33.34B TAM.{' '}
            <span className="text-[#c8ff00]">$500M SAM.</span>
          </h1>

          <p className="mb-8 max-w-[520px] text-[15px] leading-relaxed text-white/55">
            Pulse Check sits where performance tech, digital mental health, and connected care overlap. The near-term
            serviceable market is the institutional sports performance buyer set we can sell into first.
          </p>

          {/* TAM Hero card */}
          <div
            className="relative mb-7 overflow-hidden rounded-[18px] border p-7"
            style={{
              background: 'linear-gradient(135deg, rgba(200,255,0,0.12), rgba(0,212,170,0.06))',
              borderColor: 'rgba(200,255,0,0.15)',
            }}
          >
            <div className="pointer-events-none absolute -right-[30%] top-[-50%] h-[200%] w-[80%]" style={{ background: 'radial-gradient(circle,rgba(200,255,0,0.06),transparent 60%)' }} />
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">Full Adjacent Market TAM</div>
            <div
              className="leading-[0.9] text-[#c8ff00]"
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 'clamp(60px, 7vw, 88px)',
                letterSpacing: '-1px',
                textShadow: '0 0 40px rgba(200,255,0,0.3)',
              }}
            >
              $33.34B
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">SAM</div>
                <div className="mt-1 text-3xl font-black text-white">$500M</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Beachhead</div>
                <div className="mt-1 text-3xl font-black text-white">~$3M ARR</div>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-white/55">
              <strong className="font-semibold text-white">The company applying is PIL.</strong> AuntEDNA.ai is a
              strategic partner inside the clinical pathway, not the funding applicant.
            </p>
          </div>

          {/* Market rows */}
          <div className="flex flex-col gap-2.5">
            {markets.map((m, i) => (
              <motion.div
                key={m.name}
                className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-[18px] py-3.5 transition-all duration-300 hover:translate-x-[3px] hover:border-white/[0.14]"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.15 }}
              >
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}88` }} />
                  <div>
                    <div className="text-[13px] font-semibold text-white">{m.name}</div>
                    <div className="mt-0.5 text-[10px] leading-snug text-white/30">{m.desc}</div>
                  </div>
                </div>
                <div
                  className="text-[26px] leading-none tracking-wide"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", color: m.color }}
                >
                  {m.value}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* RIGHT: Venn canvas */}
        <motion.div
          className="relative hidden min-h-[560px] xl:flex xl:h-full xl:items-center xl:justify-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative mx-auto aspect-square h-full max-h-[46rem] w-full max-w-[46rem]">
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

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
                  <div className="mt-4 text-xl leading-snug text-zinc-400">{segment.detail}</div>
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
            <div className="mt-4 max-w-3xl text-xl leading-relaxed text-zinc-300 md:text-xl">
              Phased contract roadmap. Prove Pulse Check in every segment, then scale with proof points.
            </div>
          </div>

          <motion.div
            className="text-left lg:text-right"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.25 }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">5-year target</div>
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
              <div className="mt-3 max-w-lg text-xl leading-relaxed text-zinc-400">
                Land anchor contracts across every segment. Validate product, build case studies, establish credibility.
              </div>

              <div className="mt-5 flex flex-1 flex-col justify-end gap-2">
                {PATH_PHASE_ONE.map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="grid grid-cols-[18px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2.5 transition-all duration-300 hover:translate-x-[2px] hover:border-white/14 hover:bg-white/[0.04]"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.05, duration: 0.45 }}
                  >
                    <span className="mx-auto h-2 w-2 rounded-full" style={{ background: item.accent, boxShadow: `0 0 6px ${item.accent}` }} />
                    <span className="min-w-0 text-xl font-semibold text-white">
                      {item.label}
                      <span className="ml-2 text-[11px] font-normal text-zinc-500">{item.detail}</span>
                    </span>
                    <span className="text-right font-black tracking-[0.04em] text-white">{item.count}</span>
                    <span className="min-w-[5.5rem] text-right text-xl font-black tracking-[0.03em]" style={{ color: item.accent }}>
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
              <div className="mt-3 max-w-2xl text-xl leading-relaxed text-zinc-400">
                Expand across segments. Close league-wide deals. Enter international federation market.
              </div>

              <div className="mt-5 flex flex-1 flex-col justify-end gap-2">
                {PATH_PHASE_TWO.map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="grid grid-cols-[18px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[10px] border border-white/8 bg-white/[0.02] px-3 py-2.5 transition-all duration-300 hover:translate-x-[2px] hover:border-white/14 hover:bg-white/[0.04]"
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
                    <span className="min-w-0 text-xl font-semibold text-white">
                      {item.label}
                      <span className="ml-2 text-[11px] font-normal text-zinc-500">{item.detail}</span>
                    </span>
                    <span className="text-right font-black tracking-[0.04em] text-white">{item.count}</span>
                    <span className="min-w-[5.5rem] text-right text-xl font-black tracking-[0.03em]" style={{ color: item.accent }}>
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

const SceneCapitalPlan: React.FC = () => (
  <SceneFrame accent={COLORS.sky}>
    <div className="grid min-h-[42rem] content-center gap-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-5xl">
          <SlideKicker>Revenue + capital plan</SlideKicker>
          <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
            The capital plan: <span className="text-[#E0FE10]">From Pre-Seed to Series B.</span>
          </h1>
          <p className="mt-4 max-w-4xl text-xl leading-relaxed text-zinc-300 md:text-2xl">
            Current ask, valuation, financing sequence, and use of funds.
          </p>
        </div>

        <GlassCard accentColor={COLORS.lime}>
          <div className="min-w-[18rem] p-5 text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Current raise</div>
            <div className="mt-2 font-['Bebas_Neue'] text-[5rem] leading-none text-[#E0FE10]">$1.4M</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">$10M pre-money</div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <GlassCard accentColor={COLORS.sky}>
          <div className="p-6 md:p-7">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#38BDF8]">Capital ladder</div>
                <div className="mt-1 text-2xl font-black text-white">$1.4M → $5M → $12M → $25M</div>
              </div>
              <div className="rounded-full border border-[#38BDF8]/20 bg-[#38BDF8]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#38BDF8]">
                Pre-Seed to Series B
              </div>
            </div>

            <div className="relative mt-8 grid gap-4 md:grid-cols-4">
              <div className="pointer-events-none absolute left-[7%] right-[7%] top-9 hidden h-px bg-gradient-to-r from-[#E0FE10]/60 via-[#38BDF8]/45 to-[#F472B6]/60 md:block" />
              {CAPITAL_LADDER.map((round, index) => (
                <motion.div
                  key={round.round}
                  className="relative z-10 rounded-2xl border border-white/10 bg-black/25 p-5"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.08 }}
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 font-['Bebas_Neue'] text-3xl"
                    style={{ background: `${round.accent}18`, color: round.accent, boxShadow: `0 0 22px ${round.accent}18` }}
                  >
                    {index + 1}
                  </div>
                  <div className="mt-6 text-xl font-black text-white">{round.round}</div>
                  <div className="mt-2 font-['Bebas_Neue'] text-5xl leading-none" style={{ color: round.accent }}>
                    {round.amount}
                  </div>
                  <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{round.timing}</div>
                  <div className="mt-2 min-h-[2.75rem] text-xl leading-snug text-zinc-400">{round.note}</div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                { label: 'Now', value: '$1.4M Pre-Seed', accent: COLORS.lime },
                { label: 'After beachhead proof', value: '$5M Seed', accent: COLORS.sky },
                { label: 'Scale capital', value: '$12M Series A + $25M Series B', accent: COLORS.pink },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">{item.label}</div>
                  <div className="mt-2 text-xl font-black" style={{ color: item.accent }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <div className="grid gap-5">
          <GlassCard accentColor={COLORS.lime}>
            <div className="p-6 md:p-7">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#E0FE10]">Use of funds</div>
                  <div className="mt-1 text-2xl font-black text-white">$1.4M Pre-Seed allocation</div>
                </div>
                <div className="rounded-full border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#E0FE10]">
                  What it funds
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {[
                  { label: 'Head of Engineering', amount: '~$200K', detail: 'Own product velocity, platform reliability, and data systems.', accent: COLORS.sky },
                  { label: 'Head of Partnerships', amount: '~$150K', detail: 'Convert schools, teams, federations, and strategic partners.', accent: COLORS.teal },
                  { label: 'Head of Athlete Performance Science', amount: '~$150K', detail: 'Lead applied sport science and athlete outcomes.', accent: COLORS.purple },
                  { label: 'R&D and hardware', amount: '~$500K', detail: 'Deepen the Sports Intelligence Layer, using AI to personalize data reads per athlete and sport.', accent: COLORS.lime },
                  { label: 'GTM and marketing', amount: '~$150K', detail: 'Support beachhead launches, institutional proof, and sales material.', accent: COLORS.pink },
                  { label: 'Operating runway', amount: '~$250K', detail: 'Existing team salaries, legal, finance, software, and operating infrastructure.', accent: COLORS.orange },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.06 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-1.5 h-2.5 w-2.5 flex-none rounded-full" style={{ background: item.accent, boxShadow: `0 0 10px ${item.accent}66` }} />
                        <div className="min-w-0">
                          <div className="text-xl font-black leading-tight text-white">{item.label}</div>
                          <div className="mt-1 text-xl leading-snug text-zinc-400">{item.detail}</div>
                        </div>
                      </div>
                      <div className="flex-none text-right text-xl font-black" style={{ color: item.accent }}>
                        {item.amount}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard accentColor={COLORS.lime}>
            <div className="p-6 md:p-7">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#E0FE10]">Milestones to next round</div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  { value: '$3M', label: 'visible ARR beachhead', accent: COLORS.lime },
                  { value: 'Patent', label: 'file non-provisional', accent: COLORS.sky },
                  { value: 'VR', label: 'ship training integration', accent: COLORS.pink },
                ].map((milestone) => (
                  <div key={milestone.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-2xl font-black leading-none" style={{ color: milestone.accent }}>
                      {milestone.value}
                    </div>
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] leading-snug text-white/55">{milestone.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  </SceneFrame>
);

const GTM_NODES = [
  {
    stage: 'Campus Pilot',
    icon: '🏫',
    name: 'Worcester State',
    type: 'University · D3',
    statusBold: 'Pilot lane',
    statusDetail: 'student-athlete workflow',
    accent: '#5B8DEF',
    accentDim: 'rgba(91,141,239,0.12)',
    accentBorder: 'rgba(91,141,239,0.25)',
    accentGlow: 'rgba(91,141,239,0.2)',
  },
  {
    stage: 'Research Lane',
    icon: '🎓',
    name: 'DePaul University',
    type: 'University · D1',
    statusBold: 'Paid pilot lane',
    statusDetail: 'institutional workflow',
    accent: '#10B981',
    accentDim: 'rgba(16,185,129,0.12)',
    accentBorder: 'rgba(16,185,129,0.25)',
    accentGlow: 'rgba(16,185,129,0.2)',
  },
  {
    stage: 'Pro Team',
    icon: '🏆',
    name: 'New England Patriots',
    type: 'NFL · Professional',
    statusBold: 'Initial conversations',
    statusDetail: 'professional team lane',
    accent: '#FF6B35',
    accentDim: 'rgba(255,107,53,0.12)',
    accentBorder: 'rgba(255,107,53,0.25)',
    accentGlow: 'rgba(255,107,53,0.2)',
  },
] as const;

const GTM_ADDITIONAL_PILOTS = [
  { school: 'Clark Atlanta University', meta: 'Atlanta, GA · HBCU · Active pilot' },
  { school: 'UMES', meta: 'Princess Anne, MD · HBCU · Final pilot-pricing negotiations' },
] as const;

const SceneGTM: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    {/* Injected keyframes for corridor animations */}
    <style>{`
      @keyframes gtmPulseTravel {
        0%   { left: 5%;  background: #5B8DEF; box-shadow: 0 0 8px #5B8DEF; opacity: 0; }
        8%   { opacity: 1; }
        40%  { background: #10B981; box-shadow: 0 0 8px #10B981; }
        80%  { background: #FF6B35; box-shadow: 0 0 8px #FF6B35; }
        92%  { opacity: 1; }
        100% { left: 95%; opacity: 0; }
      }
      @keyframes gtmBadgeRing {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes gtmStatusPulse {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.4; }
      }
    `}</style>

    <div className="flex h-full min-h-0 flex-col justify-center gap-4">
      {/* Header */}
      <div>
        <SlideKicker>Go-to-Market</SlideKicker>
        <h1 className="mt-4 text-[2.6rem] font-black leading-[1.05] tracking-tight text-white md:text-[3.2rem]">
          Three prospective partners already in the <span style={{ color: COLORS.lime }}>pipeline.</span>
        </h1>
      </div>

      {/* ── THE CORRIDOR TRACK ── */}
      <div className="relative flex flex-1 flex-col justify-center py-4" style={{ minHeight: 0 }}>
        <div className="relative px-10">
          {/* Track line */}
          <div
            className="pointer-events-none absolute left-10 right-10 top-1/2 z-[1] h-px -translate-y-1/2 hidden xl:block"
            style={{
              background:
                'linear-gradient(90deg, rgba(91,141,239,0.4) 0%, rgba(16,185,129,0.4) 50%, rgba(255,107,53,0.4) 100%)',
            }}
          />

          {/* Traveling pulses */}
          {[0, 1.7, 3.4].map((delay, i) => (
            <div
              key={i}
              className="pointer-events-none absolute top-1/2 z-[2] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full hidden xl:block"
              style={{
                animation: `gtmPulseTravel 5s linear ${delay}s infinite`,
              }}
            />
          ))}

          {/* Institution nodes */}
          <div className="relative z-[3] grid gap-6 md:grid-cols-3">
            {GTM_NODES.map((node, index) => (
              <motion.div
                key={node.name}
                className="flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Stage label */}
                <div
                  className="mb-4 rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-[0.22em]"
                  style={{
                    color: node.accent,
                    borderColor: node.accentBorder,
                    background: node.accentDim,
                  }}
                >
                  {node.stage}
                </div>

                {/* Circular badge */}
                <div
                  className="group relative mb-5 flex h-[120px] w-[120px] items-center justify-center rounded-full transition-transform duration-300 hover:scale-105 md:h-[140px] md:w-[140px]"
                  style={{
                    background: '#07090d',
                    border: `2px solid ${node.accent}`,
                    boxShadow: `0 0 40px ${node.accentGlow}`,
                  }}
                >
                  {/* Dashed orbit ring */}
                  <div
                    className="pointer-events-none absolute rounded-full opacity-30"
                    style={{
                      inset: '-8px',
                      border: `1px dashed ${node.accent}`,
                      animation: `gtmBadgeRing 8s linear infinite${index === 2 ? ' reverse' : ''}`,
                    }}
                  />
                  <span className="text-[42px] leading-none">{node.icon}</span>
                </div>

                {/* Institution name */}
                <div className="text-[26px] font-black uppercase leading-none tracking-wide text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {node.name}
                </div>
                <div
                  className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.15em]"
                  style={{ color: node.accent }}
                >
                  {node.type}
                </div>

                {/* Status chip */}
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/55">
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{
                      background: node.accent,
                      boxShadow: `0 0 6px ${node.accent}`,
                      animation: `gtmStatusPulse 2s ease-in-out ${index * 0.5}s infinite`,
                    }}
                  />
                  <strong className="font-semibold text-white">{node.statusBold}</strong> · {node.statusDetail}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ADDITIONAL PILOTS ROW ── */}
      <motion.div
        className="grid items-stretch gap-3.5 md:grid-cols-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
      >
        {/* Pilot cards */}
        {GTM_ADDITIONAL_PILOTS.map((pilot) => (
          <div
            key={pilot.school}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/[0.14]"
          >
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{
                background: COLORS.lime,
                boxShadow: '0 0 6px rgba(200,255,0,0.3)',
                animation: 'gtmStatusPulse 2s ease-in-out infinite',
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold leading-tight text-white">{pilot.school}</div>
              <div className="text-[10px] tracking-wide text-white/30">{pilot.meta}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── FOOTER ── */}
      <motion.div
        className="flex flex-wrap items-center gap-3.5 rounded-xl border px-5 py-4 md:flex-nowrap"
        style={{
          background: 'linear-gradient(90deg, rgba(224,254,16,0.12), transparent 70%)',
          borderColor: 'rgba(224,254,16,0.1)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#E0FE10]">
            <Zap className="h-3.5 w-3.5 text-[#0a0a0b]" />
          </div>
          <div className="text-[13px] leading-snug text-white/55">
            <strong className="font-semibold text-white">Paid pilots are contracts.</strong>{' '}
            We conform the software to the institution and sports team, then convert into a continuation contract after
            the pilot and personalization phase.
          </div>
        </div>
      </motion.div>
    </div>
  </SceneFrame>
);

const SceneTeam: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <motion.div
      className="mx-auto grid min-h-[42rem] w-full max-w-[92rem] content-center gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
    >
      <div className="w-full">
        <SlideKicker>Management team strength</SlideKicker>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start xl:items-end">
          <h1 className="text-4xl font-black leading-[0.96] text-white md:text-5xl">
            Built by operators who know <span className="text-[#E0FE10]">software, athletes, and clinical trust.</span>
          </h1>
          <div className="text-xl leading-relaxed text-zinc-300 md:text-xl">
            Pulse Intelligence Labs pairs founder-led product depth with human-performance operations, institutional
            advisors, clinical pathway partners, and venture backing.
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="grid gap-4">
          {MANAGEMENT_TEAM.map((member, index) => (
            <motion.div
              key={member.name}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4"
              style={{
                boxShadow: `0 0 0 1px ${member.accent}10, 0 18px 60px rgba(0,0,0,0.24)`,
              }}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 + index * 0.12, duration: 0.55 }}
            >
              <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: member.accent }} />
              <div className="grid gap-4 md:grid-cols-[7.25rem_1fr]">
                <div>
                  <div
                    className="h-28 w-28 overflow-hidden rounded-2xl border-2 bg-white/[0.04]"
                    style={{ borderColor: `${member.accent}66` }}
                  >
                    <img
                      src={member.imageSrc}
                      alt={member.name}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: member.imagePosition }}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-black leading-none text-white md:text-2xl">{member.name}</h3>
                    <span
                      className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={{ borderColor: `${member.accent}33`, background: `${member.accent}12`, color: member.accent }}
                    >
                      {member.role}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span
                      className="inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{
                        background: member.schoolChip.background,
                        borderColor: member.schoolChip.border,
                        color: member.schoolChip.color,
                      }}
                    >
                      {member.schoolChip.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xl leading-relaxed text-zinc-300 md:text-[15px]">{member.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {member.credentials.map((credential) => (
                      <div key={credential} className="rounded-lg border border-white/8 bg-black/20 px-3 py-1.5 text-[12px] font-semibold leading-snug text-white md:text-[13px]">
                        {credential}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          <motion.div
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4"
            style={{
              boxShadow: `0 0 0 1px ${HEAD_OF_DESIGN.accent}10, 0 18px 60px rgba(0,0,0,0.2)`,
            }}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.42, duration: 0.55 }}
          >
            <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: HEAD_OF_DESIGN.accent }} />
            <div className="grid items-center gap-4 md:grid-cols-[5.25rem_1fr]">
              <div
                className="h-20 w-20 overflow-hidden rounded-2xl border-2 bg-white/[0.04]"
                style={{ borderColor: `${HEAD_OF_DESIGN.accent}66` }}
              >
                <img
                  src={HEAD_OF_DESIGN.imageSrc}
                  alt={HEAD_OF_DESIGN.name}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: HEAD_OF_DESIGN.imagePosition }}
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-black leading-none text-white md:text-2xl">{HEAD_OF_DESIGN.name}</h3>
                  <span
                    className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ borderColor: `${HEAD_OF_DESIGN.accent}33`, background: `${HEAD_OF_DESIGN.accent}12`, color: HEAD_OF_DESIGN.accent }}
                  >
                    {HEAD_OF_DESIGN.role}
                  </span>
                </div>
                <p className="mt-2 text-xl leading-relaxed text-zinc-300">{HEAD_OF_DESIGN.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {HEAD_OF_DESIGN.tags.map((tag) => (
                    <div key={tag} className="rounded-lg border border-purple-300/20 bg-purple-400/10 px-3 py-1.5 text-[12px] font-semibold leading-snug text-purple-200">
                      {tag}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid gap-4">
          <motion.div
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.22, duration: 0.55 }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#E0FE10]">Advisors</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TEAM_ADVISORS.map((advisor, index) => (
                <motion.div
                  key={advisor.name}
                  className="grid grid-cols-[3.25rem_1fr] items-center gap-3 rounded-xl border border-white/8 bg-black/20 p-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28 + index * 0.05 }}
                >
                  <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
                    <img
                      src={advisor.imageSrc}
                      alt={advisor.name}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: advisor.imagePosition }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-black leading-tight text-white">{advisor.name}</div>
                    <div className="mt-0.5 text-[9px] font-bold uppercase leading-tight tracking-[0.12em] text-[#E0FE10]">{advisor.role}</div>
                    <div className="mt-1 text-[11px] leading-snug text-zinc-400">{advisor.detail}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.32, duration: 0.55 }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#38BDF8]">Partners + investors</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[...TEAM_STRATEGIC_PARTNERS, ...TEAM_INVESTORS].map((partner, index) => (
                <motion.div
                  key={partner.name}
                  className="rounded-xl border border-white/8 bg-black/20 p-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38 + index * 0.06 }}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ background: partner.accent, boxShadow: `0 0 10px ${partner.accent}66` }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl font-black text-white">{partner.name}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: partner.accent }}>
                          {partner.role}
                        </span>
                      </div>
                      <div className="mt-1 text-xl leading-snug text-zinc-400">{partner.detail}</div>
                      {'people' in partner ? (
                        <div className="mt-2 grid gap-2">
                          {partner.people.map((person) => (
                            <div key={person.name} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5">
                              <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10">
                                <img src={person.imageSrc} alt={person.name} className="h-full w-full object-cover" />
                              </div>
                              <div>
                                <div className="text-[11px] font-bold leading-tight text-white">{person.name}</div>
                                <div className="text-[9px] leading-tight text-zinc-500">{person.role}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  </SceneFrame>
);

const SceneAuntEdnaPartnership: React.FC = () => (
  <SceneFrame accent={COLORS.pink}>
    <div className="grid min-h-[42rem] content-center gap-7">
      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr] xl:items-end">
        <div className="max-w-6xl">
          <SlideKicker>Strategic Alliance</SlideKicker>
          <h1 className="mt-5 text-5xl font-black leading-[0.94] text-white md:text-6xl">
            AuntEDNA.ai — <span className="text-[#F472B6]">Clinical pathway, validated.</span>
          </h1>
          <p className="mt-4 max-w-4xl text-xl leading-relaxed text-zinc-300 md:text-2xl">
            For Pulse Check specifically, AuntEDNA strengthens clinical support, athlete adherence psychology, and implementation practices.
          </p>
        </div>

        <GlassCard accentColor={COLORS.pink}>
          <div className="p-5 md:p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#F472B6]">AuntEDNA.ai co-founders</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { name: 'Jelanna Salas Olivera', role: 'CEO', imageSrc: '/jelanna.jpg' },
                { name: 'Dr. Tracey Hathaway', role: 'COO', imageSrc: '/dr-tracey-basketball.jpeg' },
              ].map((person) => (
                <div key={person.name} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border border-[#F472B6]/25 bg-white/[0.04]">
                    <img src={person.imageSrc} alt={person.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="mt-4 text-xl font-black leading-tight text-white">{person.name}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F472B6]">{person.role}</div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: 'NSF Phase I Grant',
            value: 'Independent validation',
            detail: 'Awarded for clinical methodology validation through scientific peer review.',
            accent: COLORS.sky,
            icon: GraduationCap,
          },
          {
            label: '80% Adherence',
            value: '1,000+ athletes',
            detail: 'Real-world student-athlete evidence on behavioral check-in protocols.',
            accent: COLORS.lime,
            icon: CheckCircle2,
          },
          {
            label: 'R&D Data Partnership',
            value: 'Shared research layer',
            detail: 'Pulse Check models trained against the largest validated athlete mental health dataset in the category.',
            accent: COLORS.pink,
            icon: Brain,
          },
        ].map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              className="relative min-h-[17rem] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + index * 0.1, duration: 0.55 }}
            >
              <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: card.accent }} />
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border"
                style={{ borderColor: `${card.accent}40`, background: `${card.accent}12`, color: card.accent }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-5 text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: card.accent }}>
                {card.label}
              </div>
              <div className="mt-3 text-3xl font-black leading-tight text-white">{card.value}</div>
              <div className="mt-4 text-xl leading-relaxed text-zinc-400">{card.detail}</div>
            </motion.div>
          );
        })}
      </div>

      <GlassCard accentColor={COLORS.lime}>
        <div className="grid gap-4 p-5 md:grid-cols-[auto_1fr] md:p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E0FE10] text-black">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-black text-white">A defensible, integrated stack.</div>
            <div className="mt-2 text-xl leading-relaxed text-zinc-300">
              Clinical detection, scoring, and routing logic owned by PIL. Clinical pathway handoff handled by AuntEDNA.
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  </SceneFrame>
);

const SUPPORTERS_V2 = [
  {
    key: 'auntedna',
    category: 'Clinical Pathway',
    categoryColor: '#EC4899',
    topBar: '#EC4899',
    colSpan: 'xl:col-span-4',
    description: '<strong>Strategic clinical pathway partner</strong> connecting care routing, research validation, and athletics access',
  },
  {
    key: 'polar',
    category: 'Hardware',
    categoryColor: '#38BDF8',
    topBar: '#38BDF8',
    colSpan: 'xl:col-span-4',
    description: '<strong>Wearable hardware partner</strong> for biometric and recovery signals',
  },
  {
    key: 'cooley',
    category: 'Legal Counsel',
    categoryColor: '#EC4899',
    topBar: '#8B1E41',
    colSpan: 'xl:col-span-4',
    description: '<strong>Legal and venture infrastructure</strong> for company formation and financing',
  },
  {
    key: 'acc',
    category: 'Conference',
    categoryColor: '#3B82F6',
    topBar: '#00447C',
    colSpan: 'xl:col-span-3',
    description: '<strong>Conference-level marketing and institutional access</strong>',
  },
  {
    key: 'aws',
    category: 'Venture Network',
    categoryColor: '#FF9900',
    topBar: '#FF9900',
    colSpan: 'xl:col-span-3',
    description: '<strong>Technical backing</strong> & credits',
  },
  {
    key: 'techstars',
    category: 'Venture Network',
    categoryColor: '#00D4AA',
    topBar: '#00D4AA',
    colSpan: 'xl:col-span-3',
    description: '<strong>Founder network</strong> and support',
  },
  {
    key: 'launch',
    category: 'Lead Investor',
    categoryColor: '#c8ff00',
    topBar: '#c8ff00',
    colSpan: 'xl:col-span-3',
    description: '<strong>Investor backing</strong> and Founder University network',
  },
  {
    key: 'harvard',
    category: 'Academic',
    categoryColor: '#A51C30',
    topBar: '#A51C30',
    colSpan: 'xl:col-span-12',
    description: '<strong>Harvard Graduate School of Education</strong> — HGSE network and education leadership',
  },
] as const;

/* Typographic logo renderers per supporter key */
const SupporterLogo: React.FC<{ supporterKey: string }> = ({ supporterKey }) => {
  switch (supporterKey) {
    case 'auntedna':
      return (
        <div className="w-full">
          <div className="text-[34px] font-black leading-none tracking-tight text-white">
            Aunt<span className="text-[#EC4899]">EDNA</span><span className="text-xl text-white/50">.ai</span>
          </div>
          <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#EC4899]">Clinical pathway</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[15px] font-black leading-none tracking-tight text-white">
              NCAA<span className="ml-0.5 align-super text-[8px] font-semibold text-white/35">®</span>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-black leading-none tracking-tight text-white">
              NSF
            </div>
          </div>
        </div>
      );
    case 'polar':
      return (
        <div>
          <div className="text-[36px] font-black uppercase leading-none tracking-[0.08em] text-white">Polar</div>
          <div className="mt-1.5 h-[3px] w-20 rounded-full bg-[#38BDF8]" />
        </div>
      );
    case 'acc':
      return (
        <div>
          <div className="text-[52px] font-black italic leading-none text-white" style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '-2px' }}>
            ACC
          </div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">Atlantic Coast Conference</div>
        </div>
      );
    case 'cooley':
      return (
        <div>
          <div className="text-[34px] font-bold leading-none tracking-[2px] text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            COOLEY
          </div>
          <div className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">LLP · Est. 1920</div>
        </div>
      );
    case 'aws':
      return (
        <div className="flex flex-col items-start gap-1">
          <div className="relative text-[38px] font-black leading-[0.9] text-[#FF9900]" style={{ letterSpacing: '-2px' }}>
            aws
            <div className="mt-0.5 h-[3px] w-[34px] rounded-sm bg-[#FF9900]" style={{ transform: 'skewX(-15deg)' }} />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/55">Startups</div>
        </div>
      );
    case 'techstars':
      return (
        <div className="flex items-center gap-1.5 text-[22px] font-black leading-none text-white" style={{ letterSpacing: '-0.5px' }}>
          <span className="text-2xl text-[#00D4AA]">★</span>
          techstars
        </div>
      );
    case 'launch':
      return (
        <div>
          <div className="text-[32px] font-black leading-none text-white" style={{ letterSpacing: '-1px' }}>
            LAUNCH<span className="ml-1 align-super text-xl text-[#c8ff00]">▲</span>
          </div>
          <div className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/30">Founder University</div>
        </div>
      );
    case 'harvard':
      return (
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl border-2 text-2xl font-black text-white"
            style={{
              borderColor: '#A51C30',
              background: 'linear-gradient(135deg, #A51C30, #6F1222)',
              fontFamily: "'Playfair Display', serif",
            }}
          >
            H
          </div>
          <div>
            <div className="text-[28px] font-black leading-none tracking-tight text-white" style={{ letterSpacing: '-0.5px' }}>
              Harvard
            </div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white/55">HGSE</div>
          </div>
        </div>
      );
    default:
      return null;
  }
};

const SceneSupporters: React.FC = () => (
  <SceneFrame accent={COLORS.lime}>
    <div className="flex h-full min-h-0 flex-col justify-center gap-5">
      {/* Header */}
      <div>
        <SlideKicker>Who Supports Us</SlideKicker>
        <h1 className="mt-3 text-[2.15rem] font-bold leading-[1.05] tracking-tight text-white md:text-[2.65rem]">
          We are not building <span style={{ color: COLORS.lime }}>in isolation.</span>
        </h1>
        <p className="mt-1.5 max-w-[880px] text-[13px] leading-relaxed text-white/55 md:text-[14px]">
          Strategic support already spans <strong className="font-medium text-white">clinical pathway, hardware, legal, capital, institutional access, infrastructure, and research.</strong>
        </p>
      </div>

      {/* Logo Wall */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6 xl:grid-cols-12">
        {SUPPORTERS_V2.map((s, index) => (
          <motion.div
            key={s.key}
            className={`relative flex min-h-[8.9rem] flex-col justify-between overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-4 transition-all duration-300 hover:-translate-y-[3px] hover:border-white/[0.14] md:col-span-3 ${s.colSpan}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + index * 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Accent top bar */}
            <div className="absolute left-0 right-0 top-0 h-[2px] opacity-60" style={{ background: s.topBar }} />

            {/* Category */}
            <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.16em]" style={{ color: s.categoryColor }}>
              <span className="h-1 w-1 rounded-full" style={{ background: s.categoryColor }} />
              {s.category}
            </div>

            {/* Logo area */}
            <div className="my-2 flex min-h-[42px] flex-1 items-center">
              <SupporterLogo supporterKey={s.key} />
            </div>

            {/* Description */}
            <div
              className="border-t border-white/[0.08] pt-2.5 text-[10px] leading-snug text-white/55 md:text-[10.5px] [&_strong]:font-semibold [&_strong]:text-white"
              dangerouslySetInnerHTML={{ __html: s.description }}
            />
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <motion.div
        className="flex items-center gap-3 rounded-xl border px-4 py-3"
        style={{
          background: 'linear-gradient(90deg, rgba(224,254,16,0.12), transparent 70%)',
          borderColor: 'rgba(224,254,16,0.1)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.6 }}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#E0FE10]">
          <Zap className="h-3.5 w-3.5 text-[#0a0a0b]" />
        </div>
        <div className="text-[11px] leading-snug text-white/55 md:text-[12px]">
          <strong className="font-semibold text-white">Clinical, hardware, legal, capital, and institutional infrastructure.</strong>{' '}
          The support around us is real — and already in motion.
        </div>
      </motion.div>
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
            <p className="mt-6 max-w-xl text-xl leading-relaxed text-white/65 md:text-xl">
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

            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 z-10 h-full w-full">
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
                    animate={{ scale: isActive ? 1.08 : 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSportIndex(sport.sourceIndex)}
                      className="relative block appearance-none border-0 bg-transparent p-0"
                    >
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
                      className="pointer-events-none absolute left-1/2 top-full mt-4 -translate-x-1/2 whitespace-nowrap text-xl font-black uppercase tracking-[0.18em] md:text-xl"
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
  <motion.div
    className="relative h-full w-full overflow-hidden"
    style={{ background: '#050507' }}
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -24 }}
    transition={transition}
  >
    {/* Injected styles for close slide */}
    <style>{`
      @keyframes closeD1{0%,100%{transform:translate(0,0)}50%{transform:translate(60px,40px)}}
      @keyframes closeD2{0%,100%{transform:translate(0,0)}50%{transform:translate(-50px,-30px)}}
      @keyframes closeD3{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-50px)}}
      @keyframes closeCornerIn{from{opacity:0}to{opacity:0.5}}
      @keyframes closeStmtIn{
        from{opacity:0;transform:translateY(40px);filter:blur(6px);}
        to{opacity:1;transform:translateY(0);filter:blur(0);}
      }
      @keyframes closeFadeUp{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
      .close-amb{position:absolute;pointer-events:none;z-index:0;}
      .close-a1{top:-20%;left:-10%;width:60vw;height:60vh;background:radial-gradient(circle,rgba(0,212,170,0.06),transparent 55%);animation:closeD1 20s ease-in-out infinite;}
      .close-a2{bottom:-25%;right:-10%;width:65vw;height:65vh;background:radial-gradient(circle,rgba(200,255,0,0.05),transparent 55%);animation:closeD2 24s ease-in-out infinite;}
      .close-a3{top:30%;left:40%;width:40vw;height:40vh;background:radial-gradient(circle,rgba(168,85,247,0.03),transparent 55%);animation:closeD3 28s ease-in-out infinite;}
      .close-corner{position:absolute;width:28px;height:28px;z-index:15;opacity:0;animation:closeCornerIn 1s ease 0.3s both;}
      .close-corner::before,.close-corner::after{content:'';position:absolute;background:#c8ff00;}
      .close-corner::before{top:0;left:0;width:16px;height:1.5px;}
      .close-corner::after{top:0;left:0;width:1.5px;height:16px;}
      .close-corner.close-tl{top:24px;left:24px;}
      .close-corner.close-tr{top:24px;right:24px;transform:scaleX(-1);}
      .close-corner.close-bl{bottom:24px;left:24px;transform:scaleY(-1);}
      .close-corner.close-br{bottom:24px;right:24px;transform:scale(-1);}
      .close-statement{animation:closeStmtIn 1.6s cubic-bezier(0.22,1,0.36,1) 0.3s both;max-width:1100px;}
      .close-thesis{animation:closeFadeUp 1s ease 1s both;}
      .close-signal{animation:closeFadeUp 1s ease 1.3s both;}
      .close-contact{animation:closeFadeUp 1s ease 1.6s both;}
      .close-grain{
        position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0.04;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      }
    `}</style>

    {/* Ambient blobs */}
    <div className="close-amb close-a1" />
    <div className="close-amb close-a2" />
    <div className="close-amb close-a3" />
    <div className="close-grain" />

    {/* Corner marks */}
    <div className="close-corner close-tl" />
    <div className="close-corner close-tr" />
    <div className="close-corner close-bl" />
    <div className="close-corner close-br" />

    {/* Main content */}
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 py-24 text-center md:px-14">
      <div className="close-statement">
        {/* Headline */}
        <h1
          className="mb-8 leading-[0.92]"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(40px, 5.5vw, 90px)',
            letterSpacing: '-1px',
          }}
        >
          <span className="text-white">Pulse Intelligence Labs helps athletes become</span>
          <br />
          <span className="text-[#c8ff00]">higher-performing </span>
          <span className="text-white">without being</span>
          <br />
          <span className="text-[#EC4899]">hollowed out.</span>
        </h1>

        {/* Thesis */}
        <p
          className="close-thesis mx-auto mb-9 max-w-[750px] leading-relaxed text-white/55"
          style={{ fontSize: 'clamp(16px, 1.6vw, 22px)' }}
        >
          Pulse Check is the flagship system inside PIL&apos;s human performance portfolio, closing the gap between{' '}
          <span className="font-medium text-white">
            performance signal, pressure training, and strategic clinical pathway routing
          </span>{' '}
          so the signal gets caught before the spiral starts.
        </p>

        {/* Signal flow */}
        <div className="close-signal mb-4 flex flex-wrap items-center justify-center gap-4 text-[11px] uppercase tracking-[0.18em] text-white/30 md:gap-6">
          <span className="flex items-center gap-2">
            <span className="h-[7px] w-[7px] rounded-full bg-[#5B8DEF]" style={{ boxShadow: '0 0 6px #5B8DEF' }} />
            Detect
          </span>
          <span className="text-[10px] text-white/18">→</span>
          <span className="flex items-center gap-2">
            <span className="h-[7px] w-[7px] rounded-full bg-[#c8ff00]" style={{ boxShadow: '0 0 6px rgba(200,255,0,0.3)' }} />
            Train
          </span>
          <span className="text-[10px] text-white/18">→</span>
          <span className="flex items-center gap-2">
            <span className="h-[7px] w-[7px] rounded-full bg-[#A855F7]" style={{ boxShadow: '0 0 6px rgba(168,85,247,0.5)' }} />
            Route
          </span>
          <span className="text-[10px] text-white/18">→</span>
          <span className="flex items-center gap-2">
            <span className="h-[7px] w-[7px] rounded-full bg-[#EC4899]" style={{ boxShadow: '0 0 6px rgba(236,72,153,0.5)' }} />
            Measure
          </span>
        </div>
      </div>
    </div>

    {/* Contact strip — fixed at bottom */}
    <div className="close-contact absolute bottom-8 left-6 right-6 z-20 flex flex-col gap-4 md:left-14 md:right-14 md:flex-row md:items-end md:justify-between">
      {/* Left: team contacts */}
      <div>
        <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Get in touch</div>
        <div className="flex flex-col gap-1.5 text-[12px] text-white/55 md:flex-row md:flex-wrap md:items-center md:gap-x-4">
          <span><strong className="font-semibold text-white">Tremaine Grant</strong> · tre@fitwithpulse.ai</span>
          <span className="hidden text-white/18 md:inline">|</span>
          <span><strong className="font-semibold text-white">Pulse Intelligence Labs</strong> · Institutional stakeholder deck</span>
        </div>
      </div>

      {/* Right: site chips + raise */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12px] font-medium text-white/55">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#00D4AA]" style={{ boxShadow: '0 0 6px #00D4AA' }} />
          fitwithpulse.ai
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12px] font-medium text-white/55">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#EC4899]" style={{ boxShadow: '0 0 6px #EC4899' }} />
          $1.4M Pre-Seed · $10M pre-money
        </div>

      </div>
    </div>
  </motion.div>
);

const PulsePILPepperdinePitchPage: React.FC = () => {
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
    if (slide === 1) return <ScenePILThesis />;
    if (slide === 2) return <SceneFlagshipThesis />;
    if (slide === 3) return <SceneMeetNakyala />;
    if (slide === 4) return <SceneProblem />;
    if (slide === 5) return <SceneSolution />;
    if (slide === 6) return <SceneCheckIn />;
    if (slide === 7) return <SceneClinicalRouting />;
    if (slide === 8) return <SceneWelfareCheck />;
    if (slide === 9) return <SceneCompetitiveNarrative />;
    if (slide === 10) return <SceneCompetitiveProof />;
    if (slide === 11) return <SceneEvidence />;
    if (slide === 12) return <SceneBuildingBlocks />;
    if (slide === 13) return <SceneMarket />;
    if (slide === 14) return <SceneBeachhead />;
    if (slide === 15) return <SceneHundredMPath />;
    if (slide === 16) return <SceneCapitalPlan />;
    if (slide === 17) return <SceneGTM />;
    if (slide === 18) return <SceneTeam />;
    if (slide === 19) return <SceneAuntEdnaPartnership />;
    if (slide === 20) return <SceneSupporters />;
    return <SceneSummary />;
  }, [slide]);

  const footerReserve = viewport.width >= 768 ? 138 : 152;
  const idealSlideHeight = viewport.width >= 1600 ? 980 : viewport.width >= 1280 ? 960 : 920;
  const stageScale =
    viewport.width >= 1024 && viewport.height > 0
      ? Math.max(0.76, Math.min(1, (viewport.height - footerReserve) / idealSlideHeight))
      : 1;
  const stageDimension = `${100 / stageScale}%`;

  return (
    <>
      <Head>
        <title>Pulse Intelligence Labs Stakeholder Deck | Pulse Check</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Playfair+Display:wght@700;900&display=swap"
          rel="stylesheet"
        />
        <meta
          name="description"
          content="Pitch presentation for Pulse Intelligence Labs, with Pulse Check as the flagship institutional human performance platform."
        />
      </Head>

      <div className="deck-reading-boost h-screen overflow-hidden bg-[#05070b] text-white">
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
                <div className="relative h-full w-full">
                  <AnimatePresence mode="wait">{scene}</AnimatePresence>
                </div>
              </div>
            </div>
          </main>

          <footer className="sticky bottom-0 z-20 mx-3 mb-3 mt-1.5 flex items-center justify-between gap-4 rounded-[28px] border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl md:mx-5 md:px-5">
            <button
              type="button"
              onClick={goBack}
              disabled={slide === 0}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xl font-medium text-white transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-35"
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

            <div className="flex items-center gap-2">
              <a
                href={PDF_DOWNLOAD_PATH}
                download="Pulse_Intelligence_Labs_Deck.pdf"
                className="inline-flex items-center gap-2 rounded-full border border-[#E0FE10]/30 bg-[#E0FE10]/10 px-4 py-2 text-xl font-semibold text-[#E0FE10] transition hover:bg-[#E0FE10]/15"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">PDF</span>
              </a>

              <button
                type="button"
                onClick={goNext}
                disabled={slide === TOTAL_SLIDES - 1}
                className="inline-flex items-center gap-2 rounded-full bg-[#E0FE10] px-4 py-2 text-xl font-semibold text-black transition hover:bg-[#d1ef15] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </div>
        <style jsx global>{`
          .deck-reading-boost [class~='text-xl']:not([class*='leading']),
          .deck-reading-boost [class~='text-[15px]']:not([class*='leading']),
          .deck-reading-boost [class~='text-[14px]']:not([class*='leading']),
          .deck-reading-boost [class~='text-[13px]']:not([class*='leading']),
          .deck-reading-boost [class~='text-[12px]']:not([class*='leading']) {
            font-size: clamp(1.2rem, 1.08rem + 0.22vw, 1.45rem) !important;
          }

          .deck-reading-boost [class~='text-xl'][class*='leading'],
          .deck-reading-boost [class~='text-[15px]'][class*='leading'],
          .deck-reading-boost [class~='text-[14px]'][class*='leading'],
          .deck-reading-boost [class~='text-[13px]'][class*='leading'],
          .deck-reading-boost [class~='text-[12px]'][class*='leading'],
          .deck-reading-boost [class~='text-[0.92rem]'][class*='leading'],
          .deck-reading-boost [class~='text-[0.94rem]'][class*='leading'],
          .deck-reading-boost [class~='text-[0.95rem]'][class*='leading'],
          .deck-reading-boost [class~='text-[0.96rem]'][class*='leading'],
          .deck-reading-boost [class~='text-[0.98rem]'][class*='leading'] {
            font-size: clamp(1.28rem, 1.14rem + 0.3vw, 1.62rem) !important;
          }

          .deck-reading-boost [class~='text-[11px]'][class*='leading'],
          .deck-reading-boost [class~='text-[10.5px]'][class*='leading'],
          .deck-reading-boost [class~='text-[10px]'][class*='leading'] {
            font-size: clamp(1.14rem, 1.04rem + 0.14vw, 1.32rem) !important;
          }

          .deck-reading-boost [class~='text-[11px]']:not([class*='leading']),
          .deck-reading-boost [class~='text-[10.5px]']:not([class*='leading']),
          .deck-reading-boost [class~='text-[10px]']:not([class*='leading']) {
            font-size: clamp(1.02rem, 0.92rem + 0.11vw, 1.18rem) !important;
          }

          .deck-reading-boost [class~='text-[9px]'][class*='leading'],
          .deck-reading-boost [class~='text-[8px]'][class*='leading'],
          .deck-reading-boost [class~='text-[7px]'][class*='leading'] {
            font-size: clamp(1.02rem, 0.9rem + 0.11vw, 1.16rem) !important;
          }

          .deck-reading-boost [class~='text-[9px]']:not([class*='leading']),
          .deck-reading-boost [class~='text-[8px]']:not([class*='leading']),
          .deck-reading-boost [class~='text-[7px]']:not([class*='leading']) {
            font-size: clamp(0.94rem, 0.84rem + 0.09vw, 1.08rem) !important;
          }

          .deck-reading-boost .close-thesis {
            font-size: clamp(1.34rem, 1.2rem + 0.38vw, 1.74rem);
          }

          @media print {
            .deck-reading-boost {
              font-size: 115%;
            }

            .deck-reading-boost [class~='text-xl']:not([class*='leading']),
            .deck-reading-boost [class~='text-[15px]']:not([class*='leading']),
            .deck-reading-boost [class~='text-[14px]']:not([class*='leading']),
            .deck-reading-boost [class~='text-[13px]']:not([class*='leading']),
            .deck-reading-boost [class~='text-[12px]']:not([class*='leading']) {
              font-size: clamp(1.3rem, 1.16rem + 0.24vw, 1.56rem) !important;
            }

            .deck-reading-boost [class~='text-xl'][class*='leading'],
            .deck-reading-boost [class~='text-[15px]'][class*='leading'],
            .deck-reading-boost [class~='text-[14px]'][class*='leading'],
            .deck-reading-boost [class~='text-[13px]'][class*='leading'],
            .deck-reading-boost [class~='text-[12px]'][class*='leading'],
            .deck-reading-boost [class~='text-[0.92rem]'][class*='leading'],
            .deck-reading-boost [class~='text-[0.94rem]'][class*='leading'],
            .deck-reading-boost [class~='text-[0.95rem]'][class*='leading'],
            .deck-reading-boost [class~='text-[0.96rem]'][class*='leading'],
            .deck-reading-boost [class~='text-[0.98rem]'][class*='leading'] {
              font-size: clamp(1.45rem, 1.3rem + 0.34vw, 1.75rem) !important;
            }

            .deck-reading-boost [class~='text-[11px]'][class*='leading'],
            .deck-reading-boost [class~='text-[10.5px]'][class*='leading'],
            .deck-reading-boost [class~='text-[10px]'][class*='leading'] {
              font-size: clamp(1.24rem, 1.12rem + 0.16vw, 1.4rem) !important;
            }

            .deck-reading-boost [class~='text-[11px]']:not([class*='leading']),
            .deck-reading-boost [class~='text-[10.5px]']:not([class*='leading']),
            .deck-reading-boost [class~='text-[10px]']:not([class*='leading']) {
              font-size: clamp(1.08rem, 0.98rem + 0.13vw, 1.22rem) !important;
            }

            .deck-reading-boost [class~='text-[9px]'][class*='leading'],
            .deck-reading-boost [class~='text-[8px]'][class*='leading'],
            .deck-reading-boost [class~='text-[7px]'][class*='leading'] {
              font-size: clamp(1.12rem, 1rem + 0.12vw, 1.24rem) !important;
            }

            .deck-reading-boost [class~='text-[9px]']:not([class*='leading']),
            .deck-reading-boost [class~='text-[8px]']:not([class*='leading']),
            .deck-reading-boost [class~='text-[7px]']:not([class*='leading']) {
              font-size: clamp(1.02rem, 0.92rem + 0.1vw, 1.16rem) !important;
            }

            .deck-reading-boost .close-thesis {
              font-size: clamp(1.48rem, 1.32rem + 0.4vw, 1.82rem);
            }
          }
        `}</style>
      </div>
    </>
  );
};

export default PulsePILPepperdinePitchPage;
