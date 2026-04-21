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
    title: 'Performance is not theoretical for Tremaine.',
    body: 'Former D1 track and field athlete at Florida State University, competitive physique athlete, and longtime trainer. Pulse starts with lived experience in pressure, discipline, recovery, and community.',
    icon: Medal,
    color: PULSE_GREEN,
    stats: ['D1 Track and Field', 'Florida State', 'Trainer lens'],
  },
  engineer: {
    label: 'Engineer',
    title: 'Built software for millions before building Pulse.',
    body: 'More than 20 years of software engineering experience, including Principal Engineer roles at Warby Parker and General Motors, with shipped user-facing products across OnStar and Cadillac infotainment systems.',
    icon: Zap,
    color: SKY,
    stats: ['20+ years', 'Principal Engineer', 'Global products'],
  },
  clinical: {
    label: 'Clinical',
    title: 'Product taste grounded in research discipline.',
    body: 'Clinical research roles at IQVIA and Clinical Inc across studies connected to Long Covid, Type 2 Diabetes, and Parkinsons disease with organizations including Pfizer, Eli Lilly, Dexcom, and others.',
    icon: ShieldCheck,
    color: VIOLET,
    stats: ['IQVIA', 'Clinical Inc', 'Evidence rigor'],
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
    eyebrow: 'Community operating system',
    title: 'Infrastructure for creators, brands, and corporations to build fitness communities.',
    body: 'Pulse gives personal trainers, run clubs, strength coaches, yoga instructors, and wellness operators a dedicated home to build, manage, and monetize community-based movement.',
    status: 'Live on iOS and Web. Android coming soon.',
    icon: Users,
    color: PULSE_GREEN,
    bullets: [
      'Creator-first community platform',
      'Challenge seasons, rituals, and participation loops',
      'Monetization layer for social fitness and recreation',
    ],
    buyers: ['Creators', 'Brands', 'Corporations', 'Run clubs'],
  },
  pulseCheck: {
    name: 'Pulse Check',
    eyebrow: 'Mental performance system',
    title: 'AI-driven cognitive training and measurement for elite athletes.',
    body: 'Pulse Check trains attentional control, stress inoculation, and cognitive performance through software simulations assigned by Nora, the AI coach inside the system.',
    status: 'Live on iOS and Web. University and professional pilots active.',
    icon: Brain,
    color: SKY,
    bullets: [
      'Simulation-based mental performance training',
      'Athlete state, readiness, and cognitive signal capture',
      'Built for teams, institutions, and elite performance environments',
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
    label: 'Pulse Platform',
    title: 'Live on iOS and Web',
    body: '50+ fitness creators onboarded across run clubs, personal training, strength and conditioning, and wellness.',
    icon: Dumbbell,
    color: PULSE_GREEN,
  },
  {
    label: 'Pulse Check Pilots',
    title: 'University pilots moving',
    body: 'Clark Atlanta University launch planned for April 6, 2026 in conjunction with National Student Athlete Day. University of Maryland Eastern Shore pilot confirmed with date TBA.',
    icon: GraduationCap,
    color: SKY,
  },
  {
    label: 'Professional Sports',
    title: 'Pro conversations started',
    body: 'Early-stage conversations with the New England Patriots regarding Pulse Check integration at the professional level.',
    icon: Medal,
    color: VIOLET,
  },
  {
    label: 'Partner Pipeline',
    title: 'Anchor partnership motion',
    body: 'Final negotiations with a prominent celebrity-backed run club, with additional conversations underway across the run club and cultural space.',
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
    tags: ['D1 athlete', 'Engineer', 'Clinical research'],
    body: 'The connective tissue across athlete experience, enterprise engineering, and evidence-grounded product development.',
  },
  {
    name: 'Bobby Nweke',
    role: 'Chief of Staff',
    image: '/bobbyAdvisor.jpg',
    color: SKY,
    tags: ['Harvard', 'TFA', 'TED'],
    body: 'Operational backbone with institutional leadership, people development, and strategic execution experience.',
  },
  {
    name: 'Lola Oluwaladun',
    role: 'Design Lead',
    image: '/lola.jpg',
    color: VIOLET,
    tags: ['Product design', 'Identity', 'UX'],
    body: 'Leads visual identity and experience quality across Pulse and Pulse Check.',
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
    title: 'Social sport is becoming culture',
    body: 'Run clubs, training groups, recreational leagues, and social fitness communities are growing fast while still operating without a serious infrastructure layer.',
    icon: Activity,
    color: PULSE_GREEN,
  },
  {
    title: 'Mental performance is now a competitive edge',
    body: 'Athletes, coaches, and institutions are actively looking for tools that train the mental game instead of treating it as a taboo subject.',
    icon: HeartPulse,
    color: CORAL,
  },
  {
    title: 'AI performance training is early but real',
    body: 'Neuroscience research, wearable data, adaptive coaching, and AI infrastructure are converging into a new category Pulse can help define.',
    icon: Brain,
    color: SKY,
  },
];

const narrativeFlow = [
  { title: 'One company', body: 'An AI lab focused on the full spectrum of human performance.' },
  { title: 'Two wedges', body: 'Community fitness infrastructure and elite cognitive performance training.' },
  { title: 'Live products', body: 'Pulse and Pulse Check are already live across iOS and Web.' },
  { title: 'Seed narrative', body: 'Secure anchor partnerships first, then raise around proof instead of promise.' },
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

  return (
    <div className="grid gap-6 lg:grid-cols-[0.45fr_0.55fr]">
      <motion.div {...fadeUp} className="flex flex-col gap-3">
        {(Object.keys(productDetails) as ProductKey[]).map((key) => {
          const item = productDetails[key];
          const Icon = item.icon;
          const isActive = activeProduct === key;
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
                <span className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: isActive ? `${item.color}22` : '#0B0D0C0D' }}>
                  <Icon className="h-5 w-5" style={{ color: isActive ? item.color : '#0B0D0C' }} />
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
          <div className="flex h-14 w-14 items-center justify-center rounded-lg" style={{ backgroundColor: `${product.color}26` }}>
            <ProductIcon className="h-7 w-7" style={{ color: product.color }} />
          </div>
        </div>
        <p className="max-w-2xl text-2xl font-black leading-tight">{product.title}</p>
        <p className="mt-5 text-base leading-7 text-zinc-700">{product.body}</p>
        <div className="mt-6 border-l-4 py-3 pl-4 text-sm font-bold text-zinc-900" style={{ borderColor: product.color }}>
          {product.status}
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {product.bullets.map((bullet) => (
            <div key={bullet} className="flex items-start gap-3 border border-black/10 bg-[#F7F9F4] p-4 rounded-lg">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: product.color }} />
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
          <div className="absolute inset-0 opacity-[0.09]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#E0FE10] to-transparent" />
          <div className="relative mx-auto grid min-h-[calc(100vh-6rem)] max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-20">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: 'easeOut' }}>
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 border border-[#E0FE10]/30 bg-[#E0FE10]/10 px-3 py-2 text-xs font-bold uppercase text-[#E0FE10] rounded">
                  <Sparkles className="h-4 w-4" />
                  Pulse Intelligence Labs, Inc.
                </span>
                <span className="border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase text-zinc-300 rounded">Company brief / April 2026</span>
              </div>
              <h1 className="max-w-5xl text-5xl font-black leading-none sm:text-7xl lg:text-8xl">
                Pulse Intelligence Labs, Inc. is building the <span className="text-[#E0FE10]">AI company</span> for human performance.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300 sm:text-xl">
                An Atlanta-based AI company with two distinct products, two distinct markets, and one company vision: make the body, mind, and performance state more trainable.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
                {narrativeFlow.map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.18 + index * 0.08, ease: 'easeOut' }}
                    className="border border-white/10 bg-white/[0.04] p-4 rounded-lg"
                  >
                    <div className="text-sm font-black text-white">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.1, ease: 'easeOut' }}
              className="relative"
            >
              <div className="relative overflow-hidden border border-white/10 bg-white/[0.04] p-6 shadow-[0_40px_120px_rgba(224,254,16,0.12)] rounded-lg">
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase text-zinc-500">Company operating view</div>
                    <h2 className="mt-2 text-4xl font-black leading-none">Two products. One human performance lab.</h2>
                  </div>
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center border border-[#E0FE10]/30 bg-[#E0FE10]/10 rounded-lg">
                    <img src="/pulse-logo-green.svg" alt="Pulse" className="h-8 w-auto" />
                  </div>
                </div>

                <div className="grid gap-4">
                  {(Object.keys(productDetails) as ProductKey[]).map((key) => {
                    const product = productDetails[key];
                    const Icon = product.icon;
                    return (
                      <div key={product.name} className="border border-white/10 bg-black/25 p-5 rounded-lg">
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <div className="text-xs font-bold uppercase text-zinc-500">{product.eyebrow}</div>
                            <h3 className="mt-1 text-2xl font-black">{product.name}</h3>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ backgroundColor: `${product.color}24` }}>
                            <Icon className="h-5 w-5" style={{ color: product.color }} />
                          </div>
                        </div>
                        <p className="text-sm leading-6 text-zinc-300">{product.title}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4">
                  {[
                    { label: 'Stage', value: 'Pre-Seed' },
                    { label: 'Structure', value: 'Delaware C-Corp' },
                    { label: 'Headquarters', value: 'Atlanta, GA' },
                    { label: 'Validation', value: 'LAUNCH $25K' },
                  ].map((item) => (
                    <div key={item.label} className="border border-white/10 bg-white/[0.04] p-4 rounded-lg">
                      <div className="text-xs uppercase text-zinc-500">{item.label}</div>
                      <div className="mt-1 text-lg font-black">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-5 border border-white/10 bg-black/25 p-4 rounded-lg">
                  {partnerLogos.map((logo) => (
                    <img key={logo.alt} src={logo.src} alt={logo.alt} className="h-8 w-auto object-contain opacity-90" />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <SectionShell id="founder" eyebrow="Founder credibility" title="A personal founder section: athlete, engineer, clinical research operator.">
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

        <SectionShell id="team" eyebrow="The people around him" title="A compact team with institutional, design, sports, legal, and community signal.">
          <div className="grid gap-5 lg:grid-cols-3">
            {team.map((person, index) => (
              <PersonCard key={person.name} person={person} index={index} />
            ))}
          </div>

          <motion.div {...fadeUp} className="mt-12 border border-white/10 bg-white/[0.04] p-5 rounded-lg">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase text-zinc-500">Advisory board and ecosystem</div>
                <h3 className="mt-2 text-2xl font-black">Sports, IP, legal readiness, startup backing, and community.</h3>
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

        <SectionShell id="business" eyebrow="Business flow" title="Two surface areas. One thesis around human performance." tone="light">
          <ProductSwitch activeProduct={activeProduct} setActiveProduct={setActiveProduct} />

          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {[
              { icon: Building2, title: 'Company', body: 'Pulse Intelligence Labs, Inc. is a Delaware C-Corporation headquartered in Atlanta.' },
              { icon: Compass, title: 'Vision', body: 'Own the full spectrum of human performance across fitness, athletics, wellness, and cognition.' },
              { icon: LineChart, title: 'Model', body: 'Community infrastructure and performance training systems that can expand by partner channel.' },
              { icon: Briefcase, title: 'Counsel', body: 'Legal counsel through Erik Edwards at Cooley LLP.' },
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

        <SectionShell id="traction" eyebrow="Traction and capital posture" title="Build the asset base, then raise around proof.">
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
              <div className="text-xs font-black uppercase">Investment validation</div>
              <h3 className="mt-3 text-4xl font-black">$25,000 LAUNCH pre-seed</h3>
              <p className="mt-4 text-sm leading-7 text-black/75">
                Closed in January 2026 from LAUNCH, the fund led by Jason Calacanis. Structured as a family and friends SAFE and used as first institutional validation.
              </p>
            </div>
            <div className="border border-white/10 bg-white/[0.04] p-6 rounded-lg">
              <div className="text-xs font-bold uppercase text-zinc-500">Seed sequencing</div>
              <h3 className="mt-3 text-3xl font-black">Not actively fundraising. Anchor partnerships first, then a planned $1.4M seed.</h3>
              <p className="mt-5 text-sm leading-7 text-zinc-300">
                The near-term focus is closing the partnerships that define the trajectory and make the seed narrative sharper. Planned use of funds includes product development, team expansion, partnership infrastructure, and acquisitions.
              </p>
            </div>
          </motion.div>
        </SectionShell>

        <SectionShell id="why-now" eyebrow="Market timing" title="The moment is opening across social fitness, athlete psychology, and AI coaching." tone="green">
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
                Closing thought
              </div>
              <h2 className="max-w-4xl text-5xl font-black leading-none sm:text-6xl">
                Pulse is a founder-led bet on making performance more trainable.
              </h2>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
                The founder story is not separate from the business. It is the reason the company can credibly bridge community fitness, elite athlete mental performance, AI systems, and evidence-grounded product development.
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
