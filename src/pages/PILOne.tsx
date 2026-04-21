import React, { useEffect, useMemo, useState } from 'react';
import type { NextPage } from 'next';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Brain,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Compass,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  LineChart,
  Mail,
  Medal,
  Phone,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import PageHead from '../components/PageHead';

const PULSE_GREEN = '#E0FE10';
const SKY = '#38BDF8';
const VIOLET = '#A78BFA';
const CORAL = '#FB7185';
const AMBER = '#FBBF24';

type ProductKey = 'pulse' | 'pulseCheck';
type LensKey = 'athlete' | 'engineer' | 'clinical';

const sections = [
  { id: 'company', label: 'Company' },
  { id: 'founder', label: 'Founder' },
  { id: 'team', label: 'Team' },
  { id: 'business', label: 'Business' },
  { id: 'traction', label: 'Traction' },
  { id: 'why-now', label: 'Why Now' },
  { id: 'contact', label: 'Contact' },
];

const founderLenses: Record<LensKey, {
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
  color: string;
  stats: string[];
}> = {
  athlete: {
    label: 'Athlete',
    title: 'Tremaine understands performance from the inside.',
    body: 'Division I track and field at Florida State, competitive physique athlete, and a decade in the gym as a trainer. That background gives Pulse a practical view of pressure, recovery, discipline, and the communities that keep people training.',
    icon: Medal,
    color: PULSE_GREEN,
    stats: ['D1 Track and Field', 'Florida State', 'Trainer'],
  },
  engineer: {
    label: 'Engineer',
    title: 'Shipped software used by millions before building Pulse.',
    body: 'Two decades in engineering, including Principal Engineer roles at Warby Parker and General Motors. Consumer and in-vehicle software across OnStar and Cadillac gave him a high bar for reliability, product quality, and scale.',
    icon: Zap,
    color: SKY,
    stats: ['20+ years', 'Principal Engineer', 'Consumer scale'],
  },
  clinical: {
    label: 'Clinical',
    title: 'Clinical research discipline informs the product.',
    body: "Clinical research roles at IQVIA and Clinical Inc included studies across Long COVID, Type 2 Diabetes, and Parkinson's, supporting Pfizer, Eli Lilly, Dexcom, and others. The operating habit is clear: design for outcomes, instrument the work, and move with evidence.",
    icon: ShieldCheck,
    color: VIOLET,
    stats: ['IQVIA', 'Clinical Inc', 'Evidence-led'],
  },
};

const productDetails: Record<ProductKey, {
  name: string;
  eyebrow: string;
  title: string;
  body: string;
  status: string;
  icon: LucideIcon;
  color: string;
  bullets: string[];
  buyers: string[];
}> = {
  pulse: {
    name: 'Fit With Pulse',
    eyebrow: 'Community fitness OS',
    title: 'Community infrastructure for creators, clubs, brands, and corporate wellness teams.',
    body: 'Fit With Pulse gives run clubs, trainers, strength coaches, and wellness operators one place to manage programming, challenges, content, memberships, and payments.',
    status: 'Live on iOS, Android, and Web.',
    icon: Users,
    color: PULSE_GREEN,
    bullets: [
      'Creator-owned communities with built-in monetization',
      'Challenges, seasons, and recurring programming',
      'Commerce and membership for social fitness and recreation',
    ],
    buyers: ['Creators', 'Brands', 'Corporations', 'Run clubs'],
  },
  pulseCheck: {
    name: 'Pulse Check',
    eyebrow: 'Mental performance OS',
    title: 'Cognitive training and measurement built for athletes who compete for a living.',
    body: 'Pulse Check uses software simulations and Nora, its AI coach, to train attention, stress response, and decision-making. Teams receive readiness and cognitive-state signals they can use in training.',
    status: 'Live on iOS and Web. University and professional pilots in progress.',
    icon: Brain,
    color: SKY,
    bullets: [
      'Simulation-based attention and stress training',
      'Readiness and cognitive-state capture per athlete',
      'Built for teams, athletic departments, and pro organizations',
    ],
    buyers: ['Athletes', 'Teams', 'Universities', 'Pro sports'],
  },
};

const coreMetrics = [
  { value: '2025', label: 'Founded and Delaware incorporated' },
  { value: '$25K', label: 'Pre-seed closed from LAUNCH in Jan 2026' },
  { value: '50+', label: 'Fitness creators onboarded' },
  { value: '$1.4M', label: 'Planned seed after anchor milestones' },
];

const tractionItems = [
  {
    label: 'Fit With Pulse',
    title: 'Live on iOS, Android, and Web',
    body: '50+ fitness creators are onboarded, including run clubs, personal trainers, strength coaches, and wellness operators building and monetizing community on the platform today.',
    icon: Dumbbell,
    color: PULSE_GREEN,
  },
  {
    label: 'University pilots',
    title: 'HBCU athletic departments moving',
    body: 'Clark Atlanta University launch scheduled for April 6, 2026 (National Student Athlete Day). University of Maryland Eastern Shore pilot confirmed, date TBA.',
    icon: GraduationCap,
    color: SKY,
  },
  {
    label: 'Professional sports',
    title: 'NFL conversations underway',
    body: 'Active early-stage discussions with the New England Patriots are focused on integrating Pulse Check at the professional level and expanding into the broader league environment.',
    icon: Medal,
    color: VIOLET,
  },
  {
    label: 'Anchor partnerships',
    title: 'Celebrity-backed run club in final talks',
    body: 'Final negotiations with a prominent celebrity-backed run club, plus additional conversations across the run-club and cultural-sport landscape.',
    icon: Rocket,
    color: CORAL,
  },
];

const team = [
  {
    name: 'Tremaine Grant',
    role: 'Founder and CEO',
    image: '/TremaineFounder.jpg',
    color: PULSE_GREEN,
    tags: ['D1 athlete', 'Principal engineer', 'Clinical research'],
    body: 'Leads product and company strategy from his background as an athlete, enterprise engineer, and clinical research operator.',
    email: 'tre@fitwithpulse.ai',
  },
  {
    name: 'Bobby Nweke',
    role: 'Chief of Staff',
    image: '/bobbyAdvisor.jpg',
    color: SKY,
    tags: ['Harvard', 'Teach For America', 'TED'],
    body: 'Supports operations, hiring, partnerships, and execution across the company. His background spans Harvard, Teach For America, TED, education, policy, and public leadership.',
    email: 'bobby@fitwithpulse.ai',
  },
  {
    name: 'Lola Oluwaladun',
    role: 'Design Lead',
    image: '/lola.jpg',
    color: VIOLET,
    tags: ['Product design', 'Brand identity', 'UX'],
    body: 'Owns visual identity, product surface, and experience quality across Fit With Pulse and Pulse Check.',
  },
];

const advisors = [
  {
    name: 'Marques Zak',
    role: 'CMO, Atlantic Coast Conference',
    focus: 'Sports and brand strategy',
    image: '/zak.jpg',
    color: PULSE_GREEN,
  },
  {
    name: 'Valerie Alexander',
    role: 'IP Attorney and former AI founder',
    focus: 'Legal and corporate strategy',
    image: '/Val.jpg',
    color: SKY,
  },
  {
    name: 'DeRay Mckesson',
    role: 'Founder, Campaign Zero',
    focus: 'Social impact and community',
    image: '/Deray.png',
    color: VIOLET,
  },
  {
    name: 'Erik Edwards',
    role: 'Cooley LLP',
    focus: 'Legal counsel and company readiness',
    image: '/ErikEdwards.png',
    color: AMBER,
  },
];

const whyNow = [
  {
    title: 'Social sport is becoming culture.',
    body: 'Run clubs, training groups, recreational leagues, and community fitness are among the fastest-growing modalities in sport. Most still operate without serious infrastructure underneath them.',
    icon: Activity,
    color: PULSE_GREEN,
  },
  {
    title: 'Mental performance is the new edge.',
    body: 'Teams, athletes, and institutions are actively buying tools that train the mental game. The category is forming now, and no clear leader has emerged yet.',
    icon: HeartPulse,
    color: CORAL,
  },
  {
    title: 'AI coaching is finally real.',
    body: 'Neuroscience, wearable data, adaptive coaching, and modern AI have matured enough to support a software-native performance lab with real products in market.',
    icon: Brain,
    color: SKY,
  },
];

const partnerLogos = [
  { src: '/Launch.png', alt: 'LAUNCH' },
  { src: '/cooley-logo.png', alt: 'Cooley' },
  { src: '/awsstartups.png', alt: 'AWS Startups' },
  { src: '/techstars.png', alt: 'Techstars' },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.55, ease: 'easeOut' },
} as const;

const SectionShell: React.FC<{
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  children: React.ReactNode;
  tone?: 'dark' | 'light' | 'green';
}> = ({ id, eyebrow, title, children, tone = 'dark' }) => {
  const toneClass =
    tone === 'light'
      ? 'bg-[#EEF3ED] text-[#0B0D0C]'
      : tone === 'green'
        ? 'bg-[#DDFB39] text-[#0B0D0C]'
        : 'bg-[#090A0C] text-white';

  return (
    <section id={id} className={`relative overflow-hidden ${toneClass}`}>
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(10,10,10,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.8) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
      <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <motion.div {...fadeUp} className="mb-10 max-w-4xl">
          <div className={`mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase ${tone === 'dark' ? 'text-zinc-400' : 'text-zinc-700'}`}>
            <span className="h-2 w-2 bg-current" />
            <span>{eyebrow}</span>
          </div>
          <h2 className="text-4xl font-black leading-none sm:text-5xl lg:text-6xl">{title}</h2>
        </motion.div>
        {children}
      </div>
    </section>
  );
};

const MetricTile: React.FC<{ value: string; label: string; index: number }> = ({ value, label, index }) => (
  <motion.div
    {...fadeUp}
    transition={{ duration: 0.5, delay: index * 0.06, ease: 'easeOut' }}
    className="border border-white/10 bg-white/[0.04] p-5 backdrop-blur rounded-lg"
  >
    <div className="text-3xl font-black text-white sm:text-4xl">{value}</div>
    <p className="mt-3 text-sm leading-6 text-zinc-300">{label}</p>
  </motion.div>
);

const PersonCard: React.FC<{
  person: {
    name: string;
    role: string;
    image: string;
    color: string;
    tags?: string[];
    body?: string;
    focus?: string;
    email?: string;
  };
  compact?: boolean;
  index: number;
}> = ({ person, compact = false, index }) => (
  <motion.article
    {...fadeUp}
    transition={{ duration: 0.5, delay: index * 0.07, ease: 'easeOut' }}
    whileHover={{ y: -6 }}
    className="group overflow-hidden border border-white/10 bg-white/[0.04] rounded-lg"
  >
    <div className={compact ? 'flex gap-4 p-4' : 'grid gap-0 md:grid-cols-[0.9fr_1.1fr]'}>
      <div className={compact ? 'h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg' : 'h-72 overflow-hidden md:h-full'}>
        <img src={person.image} alt={person.name} className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-105" />
      </div>
      <div className={compact ? 'min-w-0' : 'p-6'}>
        <div className="mb-3 h-1 w-10" style={{ backgroundColor: person.color }} />
        <h3 className={compact ? 'text-base font-black text-white' : 'text-2xl font-black text-white'}>{person.name}</h3>
        <p className={compact ? 'mt-1 text-sm text-zinc-400' : 'mt-2 text-sm font-bold uppercase text-zinc-400'}>{person.role}</p>
        {person.body && <p className="mt-4 text-sm leading-6 text-zinc-300">{person.body}</p>}
        {person.focus && <p className="mt-2 text-sm leading-6 text-zinc-300">{person.focus}</p>}
        {person.tags && (
          <div className="mt-5 flex flex-wrap gap-2">
            {person.tags.map((tag) => (
              <span key={tag} className="border border-white/10 bg-black/20 px-2 py-1 text-xs text-zinc-300 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
        {person.email && !compact && (
          <a
            href={`mailto:${person.email}`}
            className="mt-5 inline-flex items-center gap-2 border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:border-[#E0FE10]/50 hover:text-white rounded-lg"
          >
            <Mail className="h-3.5 w-3.5 text-[#E0FE10]" />
            {person.email}
          </a>
        )}
      </div>
    </div>
  </motion.article>
);

const ProductSwitch: React.FC<{
  activeProduct: ProductKey;
  setActiveProduct: (product: ProductKey) => void;
}> = ({ activeProduct, setActiveProduct }) => {
  const product = productDetails[activeProduct];
  const ProductIcon = product.icon;
  const onWhiteColor = activeProduct === 'pulse' ? VIOLET : product.color;
  const onWhiteBg = activeProduct === 'pulse' ? '#F5F2FF' : '#F7F9F4';

  return (
    <div className="grid gap-6 lg:grid-cols-[0.45fr_0.55fr]">
      <motion.div {...fadeUp} className="flex flex-col gap-3">
        {(Object.keys(productDetails) as ProductKey[]).map((key) => {
          const item = productDetails[key];
          const Icon = item.icon;
          const isActive = activeProduct === key;
          const buttonAccent = key === 'pulse' ? VIOLET : item.color;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveProduct(key)}
              className={`flex items-center justify-between border p-4 text-left transition rounded-lg ${
                isActive
                  ? 'border-black bg-black text-white'
                  : 'border-black/10 bg-white/50 text-black hover:border-black/30 hover:bg-white'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: isActive ? `${item.color}22` : `${buttonAccent}18` }}>
                  <Icon className="h-5 w-5" style={{ color: isActive ? item.color : buttonAccent }} />
                </span>
                <span>
                  <span className="block text-sm font-black">{item.name}</span>
                  <span className={`mt-1 block text-xs ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`}>{item.eyebrow}</span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5" />
            </button>
          );
        })}
      </motion.div>

      <motion.div
        key={activeProduct}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="border border-black/10 bg-white p-6 text-black shadow-[0_24px_70px_rgba(10,10,10,0.10)] rounded-lg"
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase text-zinc-500">{product.eyebrow}</div>
            <h3 className="mt-2 text-3xl font-black leading-none">{product.name}</h3>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-lg" style={{ backgroundColor: `${onWhiteColor}26` }}>
            <ProductIcon className="h-7 w-7" style={{ color: onWhiteColor }} />
          </div>
        </div>
        <p className="max-w-2xl text-2xl font-black leading-tight">{product.title}</p>
        <p className="mt-5 text-base leading-7 text-zinc-700">{product.body}</p>
        <div className="mt-6 border-l-4 py-3 pl-4 text-sm font-bold text-zinc-900" style={{ borderColor: onWhiteColor }}>
          {product.status}
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {product.bullets.map((bullet) => (
            <div key={bullet} className="flex items-start gap-3 border border-black/10 p-4 rounded-lg" style={{ backgroundColor: onWhiteBg }}>
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: onWhiteColor }} />
              <p className="text-sm leading-6 text-zinc-800">{bullet}</p>
            </div>
          ))}
          <div className="border border-black/10 bg-black p-4 text-white rounded-lg">
            <div className="text-xs font-bold uppercase text-zinc-400">Primary buyers</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.buyers.map((buyer) => (
                <span key={buyer} className="border border-white/10 px-2 py-1 text-xs rounded">
                  {buyer}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const PILOnePage: NextPage = () => {
  const [activeSection, setActiveSection] = useState('company');
  const [activeLens, setActiveLens] = useState<LensKey>('athlete');
  const [activeProduct, setActiveProduct] = useState<ProductKey>('pulse');

  const currentLens = founderLenses[activeLens];
  const CurrentLensIcon = currentLens.icon;

  const navItems = useMemo(() => sections, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observers = navItems
      .map((section) => document.getElementById(section.id))
      .filter(Boolean)
      .map((element) => {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) setActiveSection(element!.id);
          },
          { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
        );
        observer.observe(element!);
        return observer;
      });

    return () => observers.forEach((observer) => observer.disconnect());
  }, [navItems]);

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'pulse-intelligence-labs-company-brief',
          pageTitle: 'Pulse Intelligence Labs, Inc. | Executive Summary',
          metaDescription: 'Company one-pager and executive summary for Pulse Intelligence Labs, Inc., covering founder credibility, team, products, traction, and market timing.',
          ogTitle: 'Pulse Intelligence Labs, Inc. | Executive Summary',
          ogDescription: 'Company brief for Pulse Intelligence Labs: human performance AI, Fit With Pulse, Pulse Check, team, traction, and seed narrative.',
          ogImage: 'https://fitwithpulse.ai/pil-og.png',
          ogType: 'website',
          twitterCard: 'summary_large_image',
          twitterTitle: 'Pulse Intelligence Labs, Inc. | Executive Summary',
          twitterDescription: 'Company one-pager and executive summary for Pulse Intelligence Labs, Inc.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/PILOne"
        pageOgImage="/pil-og.png"
        themeColor="#090A0C"
      />

      <main className="min-h-screen bg-[#090A0C] text-white">
        <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
            <a href="#company" className="flex items-center gap-3">
              <img src="/pulse-logo-green.svg" alt="Pulse" className="h-8 w-auto" />
              <span className="hidden text-sm font-black sm:block">Pulse Intelligence Labs</span>
            </a>
            <div className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`px-3 py-2 text-xs font-bold transition rounded ${
                    activeSection === item.id ? 'bg-white text-black' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
            <a
              href="mailto:tre@fitwithpulse.ai"
              className="inline-flex items-center gap-2 bg-[#E0FE10] px-4 py-2 text-sm font-black text-black transition hover:bg-white rounded-lg"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Connect</span>
            </a>
          </div>
        </nav>

        <section id="company" className="relative overflow-hidden bg-[#090A0C] pt-24 text-white">
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
          <div className="pointer-events-none absolute -right-32 -top-32 h-[640px] w-[640px] rounded-full bg-[#E0FE10]/[0.08] blur-[140px]" />
          <div className="pointer-events-none absolute -left-24 bottom-10 h-[420px] w-[420px] rounded-full bg-[#38BDF8]/[0.06] blur-[140px]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#E0FE10] to-transparent" />

          <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 pb-6 pt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 sm:px-8 lg:px-10">
            <span>Pulse Intelligence Labs, Inc.</span>
            <span className="hidden sm:inline">Delaware C-Corp · Atlanta, GA · Est. 2025</span>
            <span>Company brief · April 2026</span>
          </div>

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-10 lg:pb-24 lg:pt-10">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: 'easeOut' }}>
              <span className="inline-flex items-center gap-2 border border-[#E0FE10]/30 bg-[#E0FE10]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#E0FE10] rounded">
                <Sparkles className="h-3.5 w-3.5" />
                Human performance · Applied AI
              </span>

              <h1 className="mt-8 text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl lg:text-[5.75rem]">
                The AI lab for <span className="text-[#E0FE10]">human performance.</span>
              </h1>

              <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl sm:leading-9">
                Pulse Intelligence Labs builds applied AI software for human performance. Fit With Pulse serves fitness communities and wellness operators. Pulse Check helps teams and athletes train attention, stress response, and decision-making under pressure.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <a href="mailto:tre@fitwithpulse.ai" className="inline-flex items-center gap-2 bg-[#E0FE10] px-5 py-3 text-sm font-black text-black transition hover:bg-white rounded-lg">
                  <Mail className="h-4 w-4" />
                  Connect with Pulse
                </a>
                <a href="#traction" className="inline-flex items-center gap-2 border border-white/20 bg-white/[0.03] px-5 py-3 text-sm font-black text-white transition hover:border-white/40 hover:bg-white/10 rounded-lg">
                  See the traction
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.1, ease: 'easeOut' }}
              className="relative"
              aria-label="Company tearsheet"
            >
              <div className="relative overflow-hidden border border-white/10 bg-white/[0.04] p-6 shadow-[0_40px_120px_rgba(224,254,16,0.12)] rounded-2xl backdrop-blur sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Tearsheet</div>
                    <h2 className="mt-2 text-xl font-black leading-tight">Company at a glance</h2>
                  </div>
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-[#E0FE10]/30 bg-[#E0FE10]/10 rounded-lg">
                    <img src="/pulse-logo-green.svg" alt="Pulse" className="h-5 w-auto" />
                  </div>
                </div>

                <div className="my-5 h-px bg-white/10" />

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[
                    { label: 'Founded', value: '2025' },
                    { label: 'Structure', value: 'Delaware C-Corp' },
                    { label: 'Headquarters', value: 'Atlanta, GA' },
                    { label: 'Stage', value: 'Pre-seed' },
                    { label: 'Validation', value: '$25K LAUNCH' },
                    { label: 'Counsel', value: 'Cooley LLP' },
                  ].map((f) => (
                    <div key={f.label}>
                      <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{f.label}</dt>
                      <dd className="mt-1 text-sm font-black text-white">{f.value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="my-5 h-px bg-white/10" />

                <div>
                  <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Live products</div>
                  <div className="space-y-2.5">
                    {(Object.keys(productDetails) as ProductKey[]).map((key) => {
                      const product = productDetails[key];
                      const Icon = product.icon;
                      const oneLiner = key === 'pulse' ? 'Community fitness infrastructure' : 'Elite cognitive performance';
                      const platformLabel = key === 'pulse' ? 'iOS · Android · Web' : 'iOS · Web';
                      return (
                        <div key={product.name} className="flex items-center justify-between gap-3 border border-white/10 bg-black/25 p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${product.color}22` }}>
                              <Icon className="h-4 w-4" style={{ color: product.color }} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-black leading-tight">{product.name}</div>
                              <div className="text-[11px] leading-tight text-zinc-500">{oneLiner}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{platformLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="my-5 h-px bg-white/10" />

                <div>
                  <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Backed by · Built with</div>
                  <div className="flex flex-wrap items-center gap-5">
                    {partnerLogos.map((logo) => (
                      <img key={logo.alt} src={logo.src} alt={logo.alt} className="h-6 w-auto object-contain opacity-75 transition hover:opacity-100" />
                    ))}
                  </div>
                </div>
              </div>
            </motion.aside>
          </div>
        </section>

        <SectionShell id="founder" eyebrow="Founder" title="Tremaine Grant brings athletic experience, engineering depth, and clinical research discipline to Pulse.">
          <div className="grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
            <motion.div {...fadeUp} className="flex flex-col gap-3">
              {(Object.keys(founderLenses) as LensKey[]).map((key) => {
                const lens = founderLenses[key];
                const Icon = lens.icon;
                const isActive = activeLens === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveLens(key)}
                    className={`flex items-center justify-between border p-4 text-left transition rounded-lg ${
                      isActive ? 'border-white bg-white text-black' : 'border-white/10 bg-white/[0.04] text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: `${lens.color}24` }}>
                        <Icon className="h-5 w-5" style={{ color: isActive ? '#0B0D0C' : lens.color }} />
                      </span>
                      <span>
                        <span className="block font-black">{lens.label}</span>
                        <span className={`mt-1 block text-xs ${isActive ? 'text-zinc-600' : 'text-zinc-400'}`}>{lens.stats.join(' / ')}</span>
                      </span>
                    </span>
                    <ArrowRight className="h-5 w-5" />
                  </button>
                );
              })}
            </motion.div>

            <motion.div
              key={activeLens}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="border border-white/10 bg-white/[0.04] p-6 rounded-lg"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg" style={{ backgroundColor: `${currentLens.color}24` }}>
                <CurrentLensIcon className="h-7 w-7" style={{ color: currentLens.color }} />
              </div>
              <h3 className="text-3xl font-black leading-tight sm:text-4xl">{currentLens.title}</h3>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">{currentLens.body}</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {currentLens.stats.map((stat) => (
                  <div key={stat} className="border border-white/10 bg-black/20 p-4 rounded-lg">
                    <div className="text-sm font-black" style={{ color: currentLens.color }}>{stat}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {coreMetrics.map((metric, index) => (
              <MetricTile key={metric.label} index={index} value={metric.value} label={metric.label} />
            ))}
          </div>
        </SectionShell>

        <SectionShell id="team" eyebrow="Team and advisors" title="Pulse is led by a focused core team with advisors across sport, design, law, and community.">
          <div className="grid gap-5 lg:grid-cols-3">
            {team.map((person, index) => (
              <PersonCard key={person.name} person={person} index={index} />
            ))}
          </div>

          <motion.div {...fadeUp} className="mt-12 border border-white/10 bg-white/[0.04] p-5 rounded-lg">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase text-zinc-500">Advisory board and ecosystem</div>
                <h3 className="mt-2 text-2xl font-black">Advisor support across sports marketing, IP, legal readiness, startup programs, and community building.</h3>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                {partnerLogos.map((logo) => (
                  <img key={logo.alt} src={logo.src} alt={logo.alt} className="h-8 w-auto object-contain opacity-90" />
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {advisors.map((person, index) => (
                <PersonCard key={person.name} person={person} compact index={index} />
              ))}
            </div>
          </motion.div>
        </SectionShell>

        <SectionShell id="business" eyebrow="Products and business model" title="Pulse sells human performance software across community fitness and competitive sport." tone="light">
          <ProductSwitch activeProduct={activeProduct} setActiveProduct={setActiveProduct} />

          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {[
              { icon: Building2, title: 'Company', body: 'Pulse Intelligence Labs, Inc. is a Delaware C-Corp headquartered in Atlanta. The company operates with two product units under one strategy.' },
              { icon: Compass, title: 'Vision', body: 'Build the software layer for human performance across fitness, athletics, wellness, and cognition.' },
              { icon: LineChart, title: 'Model', body: 'Platform revenue on Fit With Pulse; enterprise contracts and pilots on Pulse Check. Both expand through partner channels, reducing dependence on paid acquisition.' },
              { icon: Briefcase, title: 'Counsel', body: 'Corporate and IP counsel through Erik Edwards at Cooley LLP. Structured for institutional capital from day one.' },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  {...fadeUp}
                  transition={{ duration: 0.5, delay: index * 0.06, ease: 'easeOut' }}
                  className="border border-black/10 bg-white p-5 text-black rounded-lg"
                >
                  <Icon className="mb-4 h-6 w-6 text-zinc-800" />
                  <h3 className="text-lg font-black">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-700">{item.body}</p>
                </motion.div>
              );
            })}
          </div>
        </SectionShell>

        <SectionShell id="traction" eyebrow="Traction and capital posture" title="Pulse is securing anchor partnerships and raising $1.4M to accelerate.">
          <div className="grid gap-5 md:grid-cols-2">
            {tractionItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.label}
                  {...fadeUp}
                  transition={{ duration: 0.5, delay: index * 0.06, ease: 'easeOut' }}
                  className="border border-white/10 bg-white/[0.04] p-6 rounded-lg"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-bold uppercase text-zinc-500">{item.label}</div>
                      <h3 className="mt-2 text-2xl font-black">{item.title}</h3>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: `${item.color}24` }}>
                      <Icon className="h-6 w-6" style={{ color: item.color }} />
                    </div>
                  </div>
                  <p className="text-sm leading-7 text-zinc-300">{item.body}</p>
                </motion.article>
              );
            })}
          </div>

          <motion.div {...fadeUp} className="mt-8 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="border border-[#E0FE10]/30 bg-[#E0FE10] p-6 text-black rounded-lg">
              <CircleDollarSign className="mb-5 h-8 w-8" />
              <div className="text-xs font-black uppercase">First outside capital</div>
              <h3 className="mt-3 text-4xl font-black">$25,000 LAUNCH pre-seed</h3>
              <p className="mt-4 text-sm leading-7 text-black/75">
                Closed January 2026 from LAUNCH, the fund led by Jason Calacanis. Structured as a family-and-friends SAFE, it was the first outside check into Pulse Intelligence Labs.
              </p>
            </div>
            <div className="border border-white/10 bg-white/[0.04] p-6 rounded-lg">
              <div className="text-xs font-bold uppercase text-zinc-500">Active seed: $1.4M</div>
              <h3 className="mt-3 text-3xl font-black">Partnerships are the priority for the seed round.</h3>
              <p className="mt-5 text-sm leading-7 text-zinc-300">
                The primary focus is locking in anchor partnerships with high-profile athletes, pro teams, and cultural creators for Fit With Pulse. The $1.4M seed is open alongside that motion. Planned uses include product, team, partnership infrastructure, and select tuck-in acquisitions.
              </p>
            </div>
          </motion.div>
        </SectionShell>

        <SectionShell id="why-now" eyebrow="Why now" title="The market is ready for a software company focused on human performance." tone="green">
          <div className="grid gap-5 lg:grid-cols-3">
            {whyNow.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.title}
                  {...fadeUp}
                  transition={{ duration: 0.5, delay: index * 0.07, ease: 'easeOut' }}
                  className="border border-black/10 bg-[#F7FFE0] p-6 text-black rounded-lg"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center bg-black text-white rounded-lg">
                    <Icon className="h-6 w-6" style={{ color: item.color }} />
                  </div>
                  <h3 className="text-2xl font-black leading-tight">{item.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-black/75">{item.body}</p>
                </motion.article>
              );
            })}
          </div>
        </SectionShell>

        <section id="contact" className="relative overflow-hidden bg-[#090A0C] text-white">
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_0.7fr] lg:px-10 lg:py-28">
            <motion.div {...fadeUp}>
              <div className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase text-zinc-400">
                <span className="h-2 w-2 bg-[#E0FE10]" />
                Company focus
              </div>
              <h2 className="max-w-4xl text-5xl font-black leading-none sm:text-6xl">
                Pulse is building practical AI software for human performance.
              </h2>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
                Tremaine's background helps the company connect community fitness, elite athlete mental performance, AI systems, and evidence-based product development.
              </p>
            </motion.div>

            <motion.div {...fadeUp} className="border border-white/10 bg-white/[0.04] p-6 rounded-lg">
              <img src="/pulse-logo-green.svg" alt="Pulse" className="h-10 w-auto" />
              <h3 className="mt-8 text-3xl font-black">Tremaine Grant</h3>
              <p className="mt-2 text-sm font-bold uppercase text-zinc-400">Founder and CEO, Pulse Intelligence Labs</p>
              <div className="mt-8 space-y-4">
                <a href="mailto:tre@fitwithpulse.ai" className="flex items-center gap-3 border border-white/10 bg-black/20 p-4 transition hover:border-[#E0FE10]/60 rounded-lg">
                  <Mail className="h-5 w-5 text-[#E0FE10]" />
                  <span className="font-bold">tre@fitwithpulse.ai</span>
                </a>
                <a href="tel:+19545484221" className="flex items-center gap-3 border border-white/10 bg-black/20 p-4 transition hover:border-[#E0FE10]/60 rounded-lg">
                  <Phone className="h-5 w-5 text-[#E0FE10]" />
                  <span className="font-bold">(954) 548-4221</span>
                </a>
                <a href="https://linkedin.com/in/tremainegrant" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border border-white/10 bg-black/20 p-4 transition hover:border-[#E0FE10]/60 rounded-lg">
                  <Target className="h-5 w-5 text-[#E0FE10]" />
                  <span className="font-bold">linkedin.com/in/tremainegrant</span>
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </>
  );
};

export default PILOnePage;
