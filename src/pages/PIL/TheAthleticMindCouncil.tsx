import type { GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Bot,
  Brain,
  ClipboardCheck,
  Compass,
  Eye,
  FlaskConical,
  Landmark,
  Megaphone,
  Network,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const META_TITLE = 'The Athletic Mind Council | Pulse Intelligence Labs';
const META_DESCRIPTION =
  'A founding council convened by PulseCheck and auntEDNA.ai to shape cognitive performance and clinical mental health infrastructure for athletes.';
const META_URL = 'https://pulseintelligencelabs.com/TheAthleticMindCouncil';
const META_OG_IMAGE = 'https://pulseintelligencelabs.com/pil-og.png';

type IconComponent = LucideIcon;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const missionPillars = [
  {
    title: 'Performance and care, connected.',
    body: 'The council treats cognitive performance and clinical care as one athlete support continuum, not two systems that occasionally meet.',
    accent: '#E0FE10',
    Icon: Brain,
  },
  {
    title: 'Cultural relevance',
    body: 'Black, brown, first-generation, and under-resourced student-athletes stay at the center of design, research, and deployment.',
    accent: '#38BDF8',
    Icon: Users,
  },
  {
    title: 'Ethical grounding',
    body: 'Clear IP boundaries, audited handoffs, explicit escalation rules, and transparency about what the AI does and does not do.',
    accent: '#F472B6',
    Icon: ShieldCheck,
  },
  {
    title: 'Built in public',
    body: 'Research, product decisions, and field vocabulary are shaped with the people closest to the work before the category hardens.',
    accent: '#A78BFA',
    Icon: Megaphone,
  },
] satisfies Array<{ title: string; body: string; accent: string; Icon: IconComponent }>;

const simulationFamilies = [
  { name: 'Reset', body: 'Recovery, breath, and regulation after state shifts.', accent: '#E0FE10' },
  { name: 'Noise Gate', body: 'Attention control when the environment is loud.', accent: '#38BDF8' },
  { name: 'Brake Point', body: 'Inhibition and decision discipline under pressure.', accent: '#F97316' },
  { name: 'Signal Window', body: 'Reading the right cue at the right time.', accent: '#F472B6' },
  { name: 'Sequence Shift', body: 'Cognitive flexibility when the plan changes.', accent: '#A78BFA' },
  { name: 'Endurance Lock', body: 'Sustained control deep into fatigue and load.', accent: '#2DD4BF' },
];

const protocolStructure = [
  {
    name: 'Regulation',
    body: 'Downshift or steady the athlete when activation, anxiety, or emotional spillover is the bottleneck.',
    examples: ['acute downshift', 'steady regulation', 'focus narrowing', 'cognitive reframe'],
    accent: '#F472B6',
  },
  {
    name: 'Priming',
    body: 'Sharpen, energize, or narrow attention so the athlete can enter the next performance moment prepared.',
    examples: ['activation upshift', 'focus narrowing', 'imagery priming', 'confidence priming'],
    accent: '#E0FE10',
  },
  {
    name: 'Recovery',
    body: 'Help the athlete clear post-load stress, rumination, or fatigue after demanding work.',
    examples: ['recovery downregulation', 'recovery reflection'],
    accent: '#38BDF8',
  },
];

const coreFunctions = [
  {
    title: 'Product and concept workshopping',
    body: 'Members see the live product, workshop new features as they develop, and pressure-test upcoming releases.',
    Icon: Sparkles,
  },
  {
    title: 'Pilot design and field validation',
    body: 'The council helps design pilots inside institutions, programs, and athlete networks where the work can be tested in the real world.',
    Icon: ClipboardCheck,
  },
  {
    title: 'Co-authored research and publication',
    body: 'Members can shape the research agenda, contribute data, and co-author work on escalation accuracy, outcomes, and cultural dimensions.',
    Icon: FlaskConical,
  },
  {
    title: 'Network and introductions',
    body: 'Introductions to athletic departments, professional teams, federations, clinical partners, foundations, and adjacent markets are tracked and mutual.',
    Icon: Network,
  },
  {
    title: 'Field awareness and thought leadership',
    body: 'The council shapes the public conversation through talks, panels, essays, podcasts, and joint appearances.',
    Icon: Megaphone,
  },
  {
    title: 'Adjacent market strategy',
    body: 'Student-athlete support is the wedge, not the ceiling. Members help identify expansions that strengthen the system without diluting it.',
    Icon: Compass,
  },
] satisfies Array<{ title: string; body: string; Icon: IconComponent }>;

const commitments = [
  { label: 'Term', value: 'Open-ended, reviewed annually.' },
  { label: 'Cadence', value: 'Quarterly virtual convenings, plus one in-person convening per year.' },
  { label: 'Confidentiality', value: 'Mutual NDA for pre-release product, research, and partnership information.' },
  { label: 'Conflicts', value: 'Material conflicts are disclosed and managed, not automatically disqualifying.' },
  { label: 'Voice', value: 'Members may speak publicly about council membership and the field; specific details are coordinated with the founding teams.' },
];

const cohortLanes = [
  { title: 'Clinicians and mental health', body: 'Clinical psychologists and licensed professionals with athlete-facing practice.', Icon: Stethoscope, accent: '#F472B6' },
  { title: 'National Governing Body leaders', body: 'Leaders who understand sport policy, federation standards, and scaled athlete support.', Icon: Landmark, accent: '#38BDF8' },
  { title: 'Elite athletes', body: 'Current and former competitors who can speak to performing under load from lived experience.', Icon: Trophy, accent: '#E0FE10' },
  { title: 'Coaches and performance staff', body: 'Performance directors, head coaches, and athletic administrators from collegiate and professional programs.', Icon: Timer, accent: '#F97316' },
  { title: 'Sports policy leaders', body: 'Voices who understand the institutional, ethical, and regulatory realities around athlete care.', Icon: ShieldCheck, accent: '#A78BFA' },
  { title: 'Technology and AI experts', body: 'Builders and researchers who can stress-test model behavior, safety boundaries, and product architecture.', Icon: Bot, accent: '#2DD4BF' },
] satisfies Array<{ title: string; body: string; Icon: IconComponent; accent: string }>;

const foundingTeam = [
  {
    name: 'Tremaine Grant',
    role: 'Founder and CEO, Pulse Intelligence Labs',
    imageSrc: '/TremaineFounder.jpg',
    imagePosition: 'center top',
    accent: '#E0FE10',
    body: 'Former Florida State D1 track and field athlete, longtime personal trainer, and software engineer with more than 20 years of experience. Tremaine builds AI systems at the intersection of human performance, fitness, cognitive science, and clinical research.',
    proof: ['Pulse Intelligence Labs founder', 'Former D1 athlete', 'Clinical research and product development'],
  },
  {
    name: 'Dr. Tracey',
    role: 'Co-CEO, auntEDNA.ai',
    imageSrc: '/dr-tracey-basketball.jpeg',
    imagePosition: 'center 16%',
    accent: '#F472B6',
    body: 'Dr. Tracey brings the clinical care, escalation workflow, and athlete-support lens behind the AuntEdna side of the council. She is the AuntEdna partner contact for pilot, research, and care-pathway coordination.',
    proof: ['Athlete-facing clinical lens', 'AuntEdna partner contact', 'NCAA committee experience'],
  },
  {
    name: 'Jelanna Salas Olivera',
    role: 'Co-CEO, auntEDNA.ai',
    imageSrc: '/jelanna.jpg',
    imagePosition: 'center',
    accent: '#A78BFA',
    body: 'Jelanna brings operations, care coordination, and pilot-stage execution support across the AuntEdna side of the partnership.',
    proof: ['Operations', 'Care coordination', 'Pilot execution'],
  },
  {
    name: 'Bobby Nweke',
    role: 'Chief of Staff, Pulse Intelligence Labs',
    imageSrc: '/bobbyAdvisor.jpg',
    imagePosition: 'center 15%',
    accent: '#38BDF8',
    body: 'Bobby supports operations, partnerships, and organizational design across education, venture, and the broader Pulse Intelligence Labs ecosystem.',
    proof: ['Operations', 'Partnerships', 'Organizational design'],
  },
];

const advisors = [
  {
    name: 'Marques Zak',
    role: 'CMO @ ACC',
    imageSrc: '/zak.jpg',
    imagePosition: 'center top',
    imageFit: 'cover',
    accent: '#3B82F6',
  },
  {
    name: 'Valerie Alexander',
    role: 'Fortune 500 Consultant, IP Attorney',
    imageSrc: '/Val.jpg',
    imagePosition: 'center top',
    imageFit: 'cover',
    accent: '#A855F7',
  },
  {
    name: 'DeRay Mckesson',
    role: 'Campaign Zero, Activist',
    imageSrc: '/Deray.png',
    imagePosition: 'center top',
    imageFit: 'cover',
    accent: '#38BDF8',
  },
  {
    name: 'Erik Edwards',
    role: 'Partner @ Cooley',
    imageSrc: '/ErikEdwards.png',
    imagePosition: 'center top',
    imageFit: 'cover',
    accent: '#EC4899',
  },
  {
    name: 'Evan Poncelet',
    role: 'Lead Partner @ Venture Black',
    imageSrc: '/evan-poncelet.jpeg',
    imagePosition: 'center 18%',
    imageFit: 'cover',
    accent: '#10B981',
  },
  {
    name: 'Garin Varis',
    role: 'Retired Patriots Player, Attorney',
    imageSrc: '/garin-varis.webp',
    imagePosition: 'center 24%',
    imageFit: 'contain',
    accent: '#FF6B35',
  },
  {
    name: 'Dr. Malikia Johnson',
    role: 'Director of Counseling, Council Lead of Clinical Directors - East Coast',
    imageSrc: '/malkia-advisor.png',
    imagePosition: 'center 18%',
    imageFit: 'cover',
    accent: '#F59E0B',
  },
] as const;

const ProductFlow: React.FC = () => (
  <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/55 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(224,254,16,0.10),transparent_28%,rgba(244,114,182,0.10)_72%,transparent)]" />
    <div className="relative">
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">Performance-to-Care Pathway</p>
        <span className="h-2 w-2 rounded-full bg-[#E0FE10]" />
      </div>
      <div className="grid gap-3">
        {[
          { title: 'Cognitive training', body: 'PulseCheck trains attention, regulation, and decisions under load.', color: '#E0FE10' },
          { title: 'Threshold routing', body: 'Non-clinical scoring and escalation rules decide when the moment changes.', color: '#38BDF8' },
          { title: 'Clinical handoff', body: 'AuntEdna receives the context when support moves beyond performance work.', color: '#F472B6' },
        ].map((step, index) => (
          <React.Fragment key={step.title}>
            <div className="grid grid-cols-[34px,1fr] items-start gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold"
                style={{ borderColor: `${step.color}55`, color: step.color, backgroundColor: `${step.color}14` }}
              >
                {index + 1}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{step.body}</p>
              </div>
            </div>
            {index < 2 && <div className="ml-4 h-7 border-l border-dashed border-white/15" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  </div>
);

const SectionHeader: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
  align?: 'left' | 'center';
}> = ({ eyebrow, title, body, align = 'left' }) => (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}
  >
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{eyebrow}</p>
    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h2>
    {body && <p className="mt-5 text-base leading-relaxed text-zinc-400 sm:text-lg">{body}</p>}
  </motion.div>
);

const AthleticMindCouncilPage: NextPage = () => {
  const heroVideoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return undefined;

    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    const playHeroVideo = () => {
      if (video.readyState === 0) {
        video.load();
      }

      const playPromise = video.play();
      if (playPromise) {
        void playPromise.catch(() => {
          // Safari may still delay autoplay on constrained connections.
        });
      }
    };

    playHeroVideo();
    video.addEventListener('loadeddata', playHeroVideo, { once: true });
    video.addEventListener('canplay', playHeroVideo, { once: true });

    return () => {
      video.removeEventListener('loadeddata', playHeroVideo);
      video.removeEventListener('canplay', playHeroVideo);
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
        <link rel="preload" href="/pil-hero.mp4" as="video" type="video/mp4" />
      </Head>

      <main className="min-h-screen overflow-hidden bg-black text-white selection:bg-[#E0FE10]/30 selection:text-black">
        <section className="relative min-h-[88svh] overflow-hidden">
          <video
            ref={heroVideoRef}
            className="absolute inset-0 h-full w-full object-cover opacity-55"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/pil-og-source.jpg"
            aria-hidden="true"
          >
            <source src="/pil-hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.92),rgba(0,0,0,0.58)_48%,rgba(0,0,0,0.88))]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:44px_44px] opacity-30" />

          <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E0FE10]" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-200">Pulse Intelligence Labs</span>
            </Link>
            <div className="hidden items-center gap-7 text-sm text-zinc-300 md:flex">
              <a href="#mission" className="transition-colors hover:text-white">Mission</a>
              <a href="#product" className="transition-colors hover:text-white">Product</a>
              <a href="#council" className="transition-colors hover:text-white">Council</a>
              <a href="#team" className="transition-colors hover:text-white">Team</a>
            </div>
            <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400 sm:block">
              Council Brief · May 2026
            </p>
          </nav>

          <div className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-24 lg:grid-cols-[1.08fr,0.92fr] lg:px-8 lg:pt-28">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-4xl"
            >
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#E0FE10]">
                <Activity className="h-4 w-4" />
                PulseCheck x auntEDNA.ai
              </p>
              <h1 className="mt-5 max-w-5xl text-5xl font-semibold tracking-tight text-white sm:text-7xl lg:text-8xl">
                The Athletic Mind Council
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-relaxed text-zinc-200 sm:text-2xl">
                A founding council of clinicians, athletes, coaches, researchers, technologists, and cultural voices shaping the mental performance and clinical care infrastructure athletes deserve.
              </p>
              <div className="mt-9 max-w-2xl border-l border-[#E0FE10]/50 pl-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#E0FE10]">Purpose</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  Convened by Pulse Intelligence Labs and auntEDNA.ai to define the next generation of athlete mental performance and clinical support infrastructure.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="lg:pt-10"
            >
              <ProductFlow />
            </motion.div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-zinc-950">
          <div className="mx-auto grid max-w-7xl gap-px bg-white/10 px-0 sm:grid-cols-3">
            {[
              ['Mission', 'Advance the mental performance and overall well-being of student-athletes.'],
              ['Timing', 'Convened as PulseCheck moves from live product into university deployment, research, and continued feature development.'],
              ['Invitation', 'Judgment, network, and active participation in shaping the field.'],
            ].map(([label, body]) => (
              <div key={label} className="bg-zinc-950 px-5 py-7 sm:px-8">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</p>
                <p className="mt-3 text-base leading-relaxed text-zinc-200">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="mission" className="relative bg-black">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.95fr,1.05fr] lg:items-start">
              <SectionHeader
                eyebrow="The Opportunity"
                title="Athletes are asked to perform under conditions designed to break attention, regulation, and identity."
                body="Mental performance training and mental health care still sit in separate silos. Wearables capture physiology without enough interpretation. Coaches and clinicians often work with different vocabularies, different timelines, and different data."
              />
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-lg border border-white/10 bg-zinc-950 p-6 sm:p-8"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#E0FE10]">Council Mission</p>
                <p className="mt-4 text-2xl font-semibold leading-snug text-white sm:text-4xl">
                  To advance the mental performance and overall well-being of student-athletes by delivering accessible, culturally relevant, and ethically grounded AI-powered support.
                </p>
              </motion.div>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {missionPillars.map((pillar, index) => {
                const Icon = pillar.Icon;
                return (
                  <motion.article
                    key={pillar.title}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.6, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-6"
                  >
                    <Icon className="h-6 w-6" style={{ color: pillar.accent }} />
                    <h3 className="mt-5 text-lg font-semibold text-white">{pillar.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">{pillar.body}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="product" className="relative border-t border-white/10 bg-zinc-950">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
            <SectionHeader
              eyebrow="Product Backbone"
              title="PulseCheck trains the cognitive side. AuntEdna receives the clinical handoff."
              body="The council exists because the handoff between cognitive training and clinical care happens in a single moment in a single athlete's life. The people advising that moment should be in the same room."
            />

            <div className="mt-12 grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-lg border border-white/10 bg-black p-6 sm:p-8"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <img src="/pulseCheckIcon.png" alt="PulseCheck app icon" className="h-14 w-14 rounded-lg object-cover ring-1 ring-white/15" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">About PulseCheck</p>
                    <h3 className="text-2xl font-semibold text-white">AI-driven mental-state and cognitive performance training for athletes.</h3>
                  </div>
                </div>
                <p className="mt-6 text-base leading-relaxed text-zinc-300">
                  PulseCheck is built around two non-clinical training layers: Protocols for athlete mental-state regulation, and Simulations for cognitive sharpening under stress. Together, they train the mind while producing the detection, scoring, thresholding, and escalation signals that define when support should move toward care.
                </p>

                <div className="mt-7 rounded-lg border border-[#F472B6]/20 bg-[#F472B6]/[0.04] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F472B6]">Protocols</p>
                  <h4 className="mt-2 text-lg font-semibold text-white">Mental-state regulation practices.</h4>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    Protocols are guided practices that help an athlete regulate, prime, or recover their state before, during, or after performance pressure.
                  </p>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {protocolStructure.map((protocol) => (
                      <div key={protocol.name} className="rounded-lg border border-white/10 bg-black/45 p-4">
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: protocol.accent }} />
                          <h5 className="text-sm font-semibold text-white">{protocol.name}</h5>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{protocol.body}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {protocol.examples.map((example) => (
                            <span key={example} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                              {example}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-[#E0FE10]/20 bg-[#E0FE10]/[0.035] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E0FE10]">Simulations</p>
                  <h4 className="mt-2 text-lg font-semibold text-white">Cognitive sharpening under stress.</h4>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    Simulations are structured training exercises that put attention, recovery, and decision-making under measurable load.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {simulationFamilies.map((family) => (
                      <div key={family.name} className="rounded-lg border border-white/10 bg-black/45 p-4">
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: family.accent }} />
                          <h5 className="text-sm font-semibold text-white">{family.name}</h5>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{family.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="relative overflow-hidden rounded-lg border border-[#4C1D95]/60 bg-[#12091F] p-6 shadow-2xl shadow-[#4C1D95]/20 sm:p-8"
              >
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#4C1D95]/30 blur-3xl" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(76,29,149,0.20),transparent_42%,rgba(109,40,217,0.12))]" />
                <div className="relative flex flex-wrap items-center gap-4">
                  <img src="/auntedna-logo.svg" alt="auntEDNA.ai logo" className="h-16 w-auto max-w-[210px] object-contain" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#A78BFA]">About auntEDNA.ai</p>
                    <h3 className="text-2xl font-semibold text-white">Clinical infrastructure for care once performance support is not enough.</h3>
                  </div>
                </div>
                <p className="relative mt-6 text-base leading-relaxed text-zinc-200">
                  AuntEdna provides the clinical mental health infrastructure that activates when training surfaces signals beyond the scope of performance work. AuntEdna's authority begins on receipt of a Clinical Handoff.
                </p>
                <div className="relative mt-7 space-y-3">
                  {[
                    ['Standalone clinical product', 'Clinicians can use AuntEdna directly for triage, matching, and care tracking.'],
                    ['API usage inside PulseCheck', 'PulseCheck integrates AuntEdna directly so clinical escalation, routing, and care delivery can activate from the athlete support workflow.'],
                    ['Auditable handoff', 'The handoff package keeps the performance system and the clinical system accountable to their own boundaries.'],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-lg border border-[#6D28D9]/35 bg-[#2E1065]/20 p-4">
                      <h4 className="text-sm font-semibold text-white">{title}</h4>
                      <p className="mt-2 text-xs leading-relaxed text-[#C4B5FD]">{body}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-white/10 bg-black">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
            <SectionHeader
              eyebrow="Why Now"
              title="We are convening at the founding stage on purpose."
              body="The council is forming now as we deploy the software into university athletic departments, teams, and performance clinics to directly support athletes, while the research agenda, product roadmap, and field vocabulary are still early enough for the right voices to shape what comes next."
              align="center"
            />

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                { label: 'Before university scale', value: 'The product is live; the council helps shape how it is deployed, studied, and improved across real athletic programs.', Icon: Eye, color: '#38BDF8' },
                { label: 'Before research scales', value: 'Pilot design and validation methods can still be shaped with the people closest to athletes.', Icon: Target, color: '#E0FE10' },
                { label: 'Before the category hardens', value: 'A shared language for cognitive performance, escalation, ethics, and culture.', Icon: Brain, color: '#F472B6' },
              ].map((item, index) => {
                const Icon = item.Icon;
                return (
                  <motion.article
                    key={item.label}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.6, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-lg border border-white/10 bg-zinc-950 p-6"
                  >
                    <Icon className="h-7 w-7" style={{ color: item.color }} />
                    <h3 className="mt-5 text-xl font-semibold text-white">{item.label}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.value}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="council" className="relative border-t border-white/10 bg-zinc-950">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
            <SectionHeader
              eyebrow="Core Functions"
              title="Six ways the council turns expertise into infrastructure."
              body="Members are not expected to contribute to every function. The cohort is intentionally diverse so different members can lead in different lanes."
            />

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {coreFunctions.map((item, index) => {
                const Icon = item.Icon;
                return (
                  <motion.article
                    key={item.title}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.55, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-lg border border-white/10 bg-black p-6"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E0FE10]/25 bg-[#E0FE10]/10">
                      <Icon className="h-5 w-5 text-[#E0FE10]" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.body}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative border-t border-white/10 bg-black">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.88fr,1.12fr] lg:px-8">
            <SectionHeader
              eyebrow="Cohort Composition"
              title="The cognitive and clinical, elite and developmental, institutional and cultural in active conversation."
              body="The council is intentionally cross-disciplinary. We are recruiting across the lanes that can see the athlete, the system, and the field at the same time."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {cohortLanes.map((lane, index) => {
                const Icon = lane.Icon;
                return (
                  <motion.article
                    key={lane.title}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.5, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-lg border border-white/10 bg-zinc-950 p-5"
                  >
                    <Icon className="h-5 w-5" style={{ color: lane.accent }} />
                    <h3 className="mt-4 text-base font-semibold text-white">{lane.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{lane.body}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative border-t border-white/10 bg-zinc-950">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1fr,1fr]">
              <SectionHeader
                eyebrow="Member Commitments"
                title="A real seat at the table, with a cadence that respects serious people."
                body="The council is designed for real contribution: a quarterly convening, a working group of each member's choosing, and the occasional response to a pressing question."
              />
              <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-lg border border-white/10 bg-black"
              >
                {commitments.map((item, index) => (
                  <div key={item.label} className={`grid gap-3 p-5 sm:grid-cols-[160px,1fr] sm:p-6 ${index > 0 ? 'border-t border-white/10' : ''}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
                    <p className="text-sm leading-relaxed text-zinc-300">{item.value}</p>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        <section id="team" className="relative border-t border-white/10 bg-black">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
            <SectionHeader
              eyebrow="About the Founding Team"
              title="Built by product operators and clinical partners who understand the athlete moment from different angles."
              body="Pulse Intelligence Labs brings the performance technology and cognitive training stack. auntEDNA.ai brings the clinical care infrastructure, coordination layer, and escalation pathway."
            />

            <div className="mt-12 grid gap-5 lg:grid-cols-2">
              {foundingTeam.map((member, index) => (
                <motion.article
                  key={member.name}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.65, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="grid overflow-hidden rounded-lg border border-white/10 bg-zinc-950 sm:grid-cols-[220px,1fr]"
                >
                  <div className="h-72 sm:h-full">
                    <img
                      src={member.imageSrc}
                      alt={member.name}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: member.imagePosition }}
                    />
                  </div>
                  <div className="p-6 sm:p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: member.accent }}>
                      {member.role}
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-white">{member.name}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-zinc-400">{member.body}</p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {member.proof.map((proof) => (
                        <span
                          key={proof}
                          className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300"
                        >
                          {proof}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>

            <div className="mt-20">
              <SectionHeader
                eyebrow="Our Advisors"
                title="A board of advisors spanning athletics, clinical leadership, legal infrastructure, venture, and culture."
                body="This roster reflects the cross-disciplinary network behind the initiative across Pulse Intelligence Labs and auntEDNA.ai."
              />

              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {advisors.map((advisor, index) => (
                  <motion.article
                    key={advisor.name}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{ duration: 0.5, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    className="rounded-lg border border-white/10 bg-zinc-950 p-4"
                  >
                    <div
                      className="h-40 overflow-hidden rounded-lg border bg-white/[0.04]"
                      style={{ borderColor: `${advisor.accent}66` }}
                    >
                      <img
                        src={advisor.imageSrc}
                        alt={advisor.name}
                        className="h-full w-full"
                        style={{
                          objectFit: advisor.imageFit,
                          objectPosition: advisor.imagePosition,
                        }}
                      />
                    </div>
                    <div className="mt-4">
                      <h3 className="text-base font-semibold text-white">{advisor.name}</h3>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: advisor.accent }}>
                        {advisor.role}
                      </p>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-white/10 bg-zinc-950">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-8">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-lg border border-white/10 bg-black p-7 sm:p-10"
            >
              <div className="grid gap-10 lg:grid-cols-[1.05fr,0.95fr] lg:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#E0FE10]">The Ask</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                    We are asking for judgment, network, and willingness to be in the room while the field is being defined.
                  </h2>
                  <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-400 sm:text-lg">
                    In return, members get direct visibility into the live product, influence on research and future features, a public platform for the field, and peers chosen because they sharpen the work.
                  </p>
                </div>
                <div className="grid gap-3">
                  {[
                    ['For prospective members', 'A quarterly convening, an optional working group, and the chance to help shape the field before the vocabulary hardens.'],
                    ['For warm introductions', 'Context-rich introductions are the highest-leverage contribution the network can make at this stage.'],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <footer className="border-t border-white/10 bg-black">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[#E0FE10]" />
              <span className="font-semibold uppercase tracking-[0.22em] text-zinc-300">The Athletic Mind Council</span>
              <span>Communications Kit v1.0 - May 2026</span>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/" className="transition-colors hover:text-white">Pulse Intelligence Labs</Link>
              <Link href="/apps" className="transition-colors hover:text-white">Apps</Link>
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

export default AthleticMindCouncilPage;
