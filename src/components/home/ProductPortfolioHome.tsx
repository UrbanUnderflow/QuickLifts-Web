import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Brain,
  Building2,
  Dumbbell,
  MessageCircle,
  ShieldCheck,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import PageHead from '../PageHead';

type ProductPortfolioHomeProps = {
  metaData: React.ComponentProps<typeof PageHead>['metaData'];
  pageOgUrl?: string;
  finalCtaHeading?: string;
  finalCtaBody?: string;
};

type ProductLink = {
  name: string;
  href: string;
  label: string;
};

type Screen = {
  src: string;
  alt: string;
};

type ProductSection = {
  id: string;
  name: string;
  eyebrow: string;
  body: string;
  accent: string;
  bg: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  screens: Screen[];
  links: ProductLink[];
  proof: string[];
};

const HOME_META_LAST_UPDATED = '2026-06-25T00:00:00.000Z';
const HERO_VIDEO_SRC = '/pil-hero.mp4';
const HERO_VIDEO_POSTER = '/pil-og-source.jpg';
const CONTACT_EMAIL = 'tre@fitwithpulse.ai';
const DEMO_PRODUCT_OPTIONS = ['PulseCheck', 'Fit With Pulse', 'Fit Club', 'Macra', 'Not sure yet'];

const homeMeta = (metaData: ProductPortfolioHomeProps['metaData'], pageOgUrl: string) => ({
  ...(metaData || {}),
  pageId: 'index',
  pageTitle: 'Pulse Intelligence Labs — PulseCheck, Fit With Pulse, Fit Club, and Macra',
  metaDescription:
    'Pulse Intelligence Labs builds products for mental performance, fitness communities, clubs, and nutrition: PulseCheck, Fit With Pulse, Fit Club, and Macra.',
  ogTitle: 'Pulse Intelligence Labs',
  ogDescription:
    'The company behind PulseCheck, Fit With Pulse, Fit Club, and Macra.',
  ogImage: '/pil-og.png',
  ogUrl: pageOgUrl,
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Pulse Intelligence Labs',
  twitterDescription:
    'The company behind PulseCheck, Fit With Pulse, Fit Club, and Macra.',
  twitterImage: '/pil-og.png',
  lastUpdated: metaData?.lastUpdated || HOME_META_LAST_UPDATED,
});

const pulseCheckScreens: Screen[] = [
  { src: '/pulsecheck-media/00-app-store-meet-nora.png', alt: 'PulseCheck App Store screen' },
  { src: '/pulsecheck-media/01-today-checkin.png', alt: 'PulseCheck daily check-in' },
  { src: '/pulsecheck-media/03-sports-intel.png', alt: 'PulseCheck sports intelligence' },
  { src: '/pulsecheck-media/09-critical-signal.png', alt: 'PulseCheck critical signal screen' },
];

const productSections: ProductSection[] = [
  {
    id: 'fit-club',
    name: 'Fit Club',
    eyebrow: 'Club app',
    body:
      'Fit Club helps coaches, creators, and community leaders run groups, events, challenges, and member updates in one place.',
    accent: '#5EEAD4',
    bg: 'bg-[#5EEAD4]',
    Icon: Users,
    screens: [
      { src: '/fitclub-media/02-club-home.png', alt: 'Fit Club home screen' },
      { src: '/fitclub-media/09-club-home-happening.png', alt: 'Fit Club happening rail' },
      { src: '/fitclub-media/10-event-detail-rsvp.png', alt: 'Fit Club event RSVP screen' },
    ],
    links: [
      { name: 'Visit Fit Club', href: '/fitclub', label: 'Visit the Fit Club website' },
      { name: 'Contact', href: `mailto:${CONTACT_EMAIL}?subject=Fit%20Club%20Inquiry`, label: 'Contact Pulse Intelligence Labs about Fit Club' },
    ],
    proof: ['Club pages', 'Events and RSVPs', 'Challenges'],
  },
  {
    id: 'fit-with-pulse',
    name: 'Fit With Pulse',
    eyebrow: 'Workout app',
    body:
      'Fit With Pulse helps people find workouts, follow creator-led training, and choose the right workout for how their body feels that day.',
    accent: '#E0FE10',
    bg: 'bg-[#E0FE10]',
    Icon: Dumbbell,
    screens: [
      { src: '/fwp-media/01-today-home.png', alt: 'Fit With Pulse Today screen' },
      { src: '/fwp-media/02-recovery-heat-map.png', alt: 'Fit With Pulse recovery heat map' },
      { src: '/fwp-media/04-immersive-player.png', alt: 'Fit With Pulse immersive workout player' },
    ],
    links: [
      { name: 'Visit Fit With Pulse', href: '/FWP', label: 'Visit the Fit With Pulse website' },
      { name: 'Contact', href: `mailto:${CONTACT_EMAIL}?subject=Fit%20With%20Pulse%20Inquiry`, label: 'Contact Pulse Intelligence Labs about Fit With Pulse' },
    ],
    proof: ['Personal workouts', 'Recovery guidance', 'Creator-led training'],
  },
  {
    id: 'macra',
    name: 'Macra',
    eyebrow: 'Nutrition app',
    body:
      'Macra helps people understand what they eat. Scan a meal or food label, see the macros, and get simple meal ideas from Nora.',
    accent: '#6A9AFA',
    bg: 'bg-[#6A9AFA]',
    Icon: Utensils,
    screens: [
      { src: '/system-overview/macra/app-store-screenshots/01-food-journal.png', alt: 'Macra food journal' },
      { src: '/system-overview/macra/app-store-screenshots/02-ai-meal-scan.png', alt: 'Macra AI meal scan' },
      { src: '/system-overview/macra/app-store-screenshots/05-ask-nora.png', alt: 'Macra Ask Nora screen' },
    ],
    links: [
      { name: 'Visit Macra', href: 'https://eatwithmacra.ai', label: 'Visit the Macra website' },
      { name: 'Contact', href: `mailto:${CONTACT_EMAIL}?subject=Macra%20Inquiry`, label: 'Contact Pulse Intelligence Labs about Macra' },
    ],
    proof: ['Food log', 'Meal scan', 'Ask Nora'],
  },
];

const featuredStats = [
  { label: 'Daily check-in', value: '5 min' },
  { label: 'Built for', value: 'Teams' },
  { label: 'Tracks', value: 'Readiness' },
];

const ScreenshotRail: React.FC<{ screens: Screen[]; label: string }> = ({ screens, label }) => (
  <div className="grid grid-cols-3 gap-3" aria-label={label}>
    {screens.map((screen, index) => (
      <div
        key={screen.src}
        className={`overflow-hidden rounded-[24px] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/30 ${
          index === 1 ? 'translate-y-6' : ''
        }`}
      >
        <img
          src={screen.src}
          alt={screen.alt}
          className="aspect-[9/19] h-full w-full object-cover object-top"
          loading="eager"
          draggable={false}
        />
      </div>
    ))}
  </div>
);

const ProductPill: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({ children, icon }) => (
  <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-300">
    {icon}
    {children}
  </span>
);

type DemoRequestForm = {
  name: string;
  email: string;
  role: string;
  product: string;
};

const emptyDemoRequestForm: DemoRequestForm = {
  name: '',
  email: '',
  role: '',
  product: '',
};

const ProductPortfolioHome: React.FC<ProductPortfolioHomeProps> = ({
  metaData,
  pageOgUrl = 'https://fitwithpulse.ai',
  finalCtaHeading = 'Tell us what you are building. We will point you to the right product.',
  finalCtaBody =
    'Use the demo form to tell us your role and which product you want to see. We will follow up with the clearest next step.',
}) => {
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const [heroVideoIsPlaying, setHeroVideoIsPlaying] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoForm, setDemoForm] = useState<DemoRequestForm>(emptyDemoRequestForm);
  const [demoStatus, setDemoStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [demoError, setDemoError] = useState('');

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    let isMounted = true;
    const primeVideo = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
    };
    const tryPlay = () => {
      if (!isMounted) return;
      primeVideo();
      void video.play().catch(() => undefined);
    };
    const handlePlaying = () => {
      if (isMounted) setHeroVideoIsPlaying(true);
    };

    primeVideo();
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('loadeddata', tryPlay, { once: true });
    video.addEventListener('canplay', tryPlay, { once: true });
    tryPlay();

    return () => {
      isMounted = false;
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('loadeddata', tryPlay);
      video.removeEventListener('canplay', tryPlay);
    };
  }, []);

  useEffect(() => {
    if (!isDemoModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && demoStatus !== 'sending') {
        setIsDemoModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [demoStatus, isDemoModalOpen]);

  const openDemoModal = (product = '') => {
    setDemoForm((current) => ({ ...current, product }));
    setDemoStatus('idle');
    setDemoError('');
    setIsDemoModalOpen(true);
  };

  const closeDemoModal = () => {
    if (demoStatus === 'sending') return;
    setIsDemoModalOpen(false);
  };

  const handleDemoFieldChange = (field: keyof DemoRequestForm, value: string) => {
    setDemoForm((current) => ({ ...current, [field]: value }));
  };

  const handleDemoSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!demoForm.name.trim() || !demoForm.email.trim() || !demoForm.role.trim() || !demoForm.product.trim()) {
      setDemoStatus('error');
      setDemoError('Please fill out your name, email, role, and product.');
      return;
    }

    setDemoStatus('sending');
    setDemoError('');

    try {
      const response = await fetch('/api/brevo/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demoForm),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Could not send demo request.');
      }

      setDemoStatus('success');
      setDemoForm(emptyDemoRequestForm);
    } catch (error) {
      setDemoStatus('error');
      setDemoError(error instanceof Error ? error.message : 'Could not send demo request.');
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white selection:bg-white/20">
      <PageHead
        metaData={homeMeta(metaData, pageOgUrl)}
        pageOgUrl={pageOgUrl}
        pageOgImage="/pil-og.png"
        themeColor="#050505"
      />

      <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-black/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-3" aria-label="Pulse Intelligence Labs home">
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
            <span className="text-sm font-semibold text-white">Pulse Intelligence Labs</span>
          </a>

          <nav className="hidden items-center gap-5 text-sm text-zinc-300 md:flex" aria-label="Primary">
            <a href="#pulsecheck" className="transition-colors hover:text-white">PulseCheck</a>
            <a href="#fit-club" className="transition-colors hover:text-white">Fit Club</a>
            <a href="#fit-with-pulse" className="transition-colors hover:text-white">Fit With Pulse</a>
            <a href="#macra" className="transition-colors hover:text-white">Macra</a>
          </nav>

          <button
            type="button"
            onClick={() => openDemoModal()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Request a Demo
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="relative flex min-h-[82vh] overflow-hidden pt-16">
          <video
            ref={heroVideoRef}
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${heroVideoIsPlaying ? 'opacity-100' : 'opacity-0'}`}
            autoPlay
            muted
            loop
            controls={false}
            playsInline
            preload="auto"
            poster={HERO_VIDEO_POSTER}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            tabIndex={-1}
            aria-hidden="true"
          >
            <source src={HERO_VIDEO_SRC} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#E0FE10]/10 via-transparent to-[#8B5CF6]/10 mix-blend-overlay" />

          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center px-4 py-20 sm:px-6 lg:justify-end lg:pb-24">
            <div className="max-w-4xl">
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-none text-white">
                The Human Performance Company
              </h1>
              <p className="mt-6 max-w-2xl text-xl leading-relaxed text-zinc-200">
                Using AI technology to improve human performance.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => openDemoModal()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                >
                  Request a Demo
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="pulsecheck" className="border-t border-white/10 bg-[#08070d]">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
            <div>
              <ProductPill icon={<Brain className="h-4 w-4 text-[#A05EF8]" />}>Featured product</ProductPill>
              <h2 className="mt-6 text-4xl font-semibold leading-tight text-white">
                <span className="bg-gradient-to-r from-[#C084FC] via-[#A05EF8] to-[#6A9AFA] bg-clip-text text-transparent">
                  PulseCheck
                </span>{' '}
                is the mental performance infrastructure for athletes and the people responsible for them.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-zinc-300">
                Athletes answer a quick daily check-in. Nora assigns mental exercises in the app to help athletes sharpen their mental skills and calm anxiety before competition. Coaches can see who may need attention, and serious concerns are flagged so the right human can step in.
              </p>

              <div className="mt-8 grid grid-cols-3 gap-3">
                {featuredStats.map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-2xl font-semibold text-white">{stat.value}</div>
                    <div className="mt-1 text-xs text-zinc-500">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid gap-3">
                <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <MessageCircle className="mt-1 h-5 w-5 text-[#A05EF8]" />
                  <p className="text-sm leading-relaxed text-zinc-300">Nora gives athletes a private place to talk through how they feel and what they need that day.</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <Building2 className="mt-1 h-5 w-5 text-[#6A9AFA]" />
                  <p className="text-sm leading-relaxed text-zinc-300">Coaches can quickly see who is doing well and who may need help, without making athletes fill out long reports.</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <ShieldCheck className="mt-1 h-5 w-5 text-[#5EEAD4]" />
                  <p className="text-sm leading-relaxed text-zinc-300">When something looks serious, PulseCheck helps the team know who should step in and what happened.</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="https://pulsecheckmind.ai"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#A05EF8] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#8B5CF6]"
                >
                  Visit PulseCheck
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=PulseCheck%20Inquiry`}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Contact
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="self-center">
              <ScreenshotRail screens={pulseCheckScreens} label="PulseCheck screenshots" />
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="text-sm font-semibold text-zinc-500">More Pulse products</p>
            <h2 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-white">
              One app helps with workouts, one helps with clubs, and one helps with food.
            </h2>
          </div>
        </section>

        {productSections.map((product, index) => (
          <section
            key={product.id}
            id={product.id}
            className={`border-t border-white/10 ${index % 2 === 0 ? 'bg-[#050505]' : 'bg-[#0b0b0c]'}`}
          >
            <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className={index % 2 === 0 ? 'lg:order-1' : 'lg:order-2'}>
                <ProductPill icon={<product.Icon className="h-4 w-4" style={{ color: product.accent }} />}>
                  {product.eyebrow}
                </ProductPill>
                <h3 className="mt-6 text-4xl font-semibold leading-tight text-white">{product.name}</h3>
                <p className="mt-5 text-lg leading-relaxed text-zinc-300">{product.body}</p>

                <div className="mt-7 flex flex-wrap gap-2">
                  {product.proof.map((item) => (
                    <span key={item} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-300">
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {product.links.map((link, linkIndex) => {
                    const isPrimary = linkIndex === 0;
                    const isExternal = link.href.startsWith('http');
                    const content = (
                      <>
                        {link.name}
                        <ArrowUpRight className="h-4 w-4" />
                      </>
                    );
                    const className = isPrimary
                      ? 'inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-black transition-colors hover:opacity-90'
                      : 'inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10';
                    const style = isPrimary ? { backgroundColor: product.accent } : undefined;

                    if (isExternal) {
                      return (
                        <a
                          key={link.name}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={link.label}
                          className={className}
                          style={style}
                        >
                          {content}
                        </a>
                      );
                    }

                    return (
                      <Link key={link.name} href={link.href} aria-label={link.label} className={className} style={style}>
                        {content}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className={`self-center ${index % 2 === 0 ? 'lg:order-2' : 'lg:order-1'}`}>
                <ScreenshotRail screens={product.screens} label={`${product.name} screenshots`} />
              </div>
            </div>
          </section>
        ))}

        <section className="border-t border-white/10 bg-white text-black">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-sm font-semibold text-zinc-500">Need help choosing?</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight">
                {finalCtaHeading}
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600">
                {finalCtaBody}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openDemoModal()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Request a Demo
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="font-semibold text-zinc-300">Pulse Intelligence Labs © {new Date().getFullYear()}</div>
          <div className="flex flex-wrap gap-4">
            <a href="#pulsecheck" className="hover:text-white">PulseCheck</a>
            <a href="#fit-club" className="hover:text-white">Fit Club</a>
            <a href="#fit-with-pulse" className="hover:text-white">Fit With Pulse</a>
            <a href="#macra" className="hover:text-white">Macra</a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>

      {isDemoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-request-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#09090d] shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C084FC]">Pulse Intelligence Labs</p>
                <h2 id="demo-request-title" className="mt-2 text-2xl font-semibold text-white">Request a demo</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Tell us who you are and which product you want to see. We will follow up from hello@fitwithpulse.ai.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDemoModal}
                className="rounded-lg border border-white/10 p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close demo request form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {demoStatus === 'success' ? (
              <div className="px-6 py-8">
                <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-5">
                  <h3 className="text-lg font-semibold text-white">Demo request sent</h3>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-100/80">
                    Thanks. The request was sent to hello@fitwithpulse.ai with the subject line Demo Request.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDemoModal}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="grid gap-4 px-6 py-6">
                <label className="grid gap-2 text-sm font-medium text-zinc-200">
                  Name
                  <input
                    value={demoForm.name}
                    onChange={(event) => handleDemoFieldChange('name', event.target.value)}
                    autoComplete="name"
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#A05EF8]"
                    placeholder="Your name"
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-zinc-200">
                  Email
                  <input
                    type="email"
                    value={demoForm.email}
                    onChange={(event) => handleDemoFieldChange('email', event.target.value)}
                    autoComplete="email"
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#A05EF8]"
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-zinc-200">
                  Role
                  <input
                    value={demoForm.role}
                    onChange={(event) => handleDemoFieldChange('role', event.target.value)}
                    autoComplete="organization-title"
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-[#A05EF8]"
                    placeholder="Coach, founder, athletic director..."
                    required
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-zinc-200">
                  Product
                  <select
                    value={demoForm.product}
                    onChange={(event) => handleDemoFieldChange('product', event.target.value)}
                    className="rounded-lg border border-white/10 bg-[#111118] px-4 py-3 text-white outline-none transition-colors focus:border-[#A05EF8]"
                    required
                  >
                    <option value="">Choose a product</option>
                    {DEMO_PRODUCT_OPTIONS.map((product) => (
                      <option key={product} value={product}>{product}</option>
                    ))}
                  </select>
                </label>

                {demoStatus === 'error' && (
                  <div className="rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                    {demoError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={demoStatus === 'sending'}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#C084FC] via-[#A05EF8] to-[#6A9AFA] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {demoStatus === 'sending' ? 'Sending...' : 'Send demo request'}
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPortfolioHome;
