import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Apple,
  ArrowUpRight,
  Brain,
  Building2,
  Dumbbell,
  MessageCircle,
  ShieldCheck,
  Users,
  Utensils,
} from 'lucide-react';
import PageHead from '../PageHead';
import SignInModal from '../SignInModal';
import { appLinks } from '../../utils/platformDetection';

type ProductPortfolioHomeProps = {
  metaData: React.ComponentProps<typeof PageHead>['metaData'];
  onUseWebApp: () => void;
  isSignInModalOpen: boolean;
  setIsSignInModalOpen: (open: boolean) => void;
  isAuthenticated: boolean;
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
const PULSECHECK_APP_STORE_URL = 'https://apps.apple.com/us/app/pulsecheck-mindset-coaching/id6747253393';
const MACRA_APP_STORE_URL = 'https://apps.apple.com/us/app/macra-ai-calorie/id6463771067';

const homeMeta = (metaData: ProductPortfolioHomeProps['metaData']) => ({
  ...(metaData || {}),
  pageId: 'index',
  pageTitle: 'Pulse Intelligence Labs — PulseCheck, Fit With Pulse, Fit Club, and Macra',
  metaDescription:
    'Pulse Intelligence Labs builds products for mental performance, fitness communities, clubs, and nutrition: PulseCheck, Fit With Pulse, Fit Club, and Macra.',
  ogTitle: 'Pulse Intelligence Labs',
  ogDescription:
    'The company behind PulseCheck, Fit With Pulse, Fit Club, and Macra.',
  ogImage: '/pil-og.png',
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
    id: 'fit-with-pulse',
    name: 'Fit With Pulse',
    eyebrow: 'Training intelligence',
    body:
      'The consumer training app for adaptive workouts, creator-led movement, recovery-aware programming, and the fitness graph that keeps people showing up.',
    accent: '#E0FE10',
    bg: 'bg-[#E0FE10]',
    Icon: Dumbbell,
    screens: [
      { src: '/fwp-media/01-today-home.png', alt: 'Fit With Pulse Today screen' },
      { src: '/fwp-media/02-recovery-heat-map.png', alt: 'Fit With Pulse recovery heat map' },
      { src: '/fwp-media/04-immersive-player.png', alt: 'Fit With Pulse immersive workout player' },
    ],
    links: [
      { name: 'App Store', href: appLinks.appStoreUrl, label: 'Download Fit With Pulse on iOS' },
      { name: 'Google Play', href: appLinks.playStoreUrl, label: 'Download Fit With Pulse on Android' },
      { name: 'Media', href: '/admin/fwpMedia', label: 'Open Fit With Pulse media' },
    ],
    proof: ['AI-built workouts', 'Recovery heat map', 'Mover-powered training'],
  },
  {
    id: 'fit-club',
    name: 'Fit Club',
    eyebrow: 'Community intelligence',
    body:
      'The operating layer for clubs, hosts, events, challenges, and recurring community rituals. Fit Club turns a fitness audience into a place people return to.',
    accent: '#5EEAD4',
    bg: 'bg-[#5EEAD4]',
    Icon: Users,
    screens: [
      { src: '/fitclub-media/02-club-home.png', alt: 'Fit Club home screen' },
      { src: '/fitclub-media/09-club-home-happening.png', alt: 'Fit Club happening rail' },
      { src: '/fitclub-media/10-event-detail-rsvp.png', alt: 'Fit Club event RSVP screen' },
    ],
    links: [
      { name: 'Open Fit Club', href: '/FWB', label: 'Open Fit Club' },
      { name: 'Media', href: '/admin/fitclubMedia', label: 'Open Fit Club media' },
    ],
    proof: ['Club home', 'Events and RSVP', 'Challenge cycles'],
  },
  {
    id: 'macra',
    name: 'Macra',
    eyebrow: 'Nutrition intelligence',
    body:
      'The nutrition product for scanning meals, labels, and food context, then turning that evidence into macro targets, daily planning, and Nora-powered meal support.',
    accent: '#6A9AFA',
    bg: 'bg-[#6A9AFA]',
    Icon: Utensils,
    screens: [
      { src: '/system-overview/macra/app-store-screenshots/01-food-journal.png', alt: 'Macra food journal' },
      { src: '/system-overview/macra/app-store-screenshots/02-ai-meal-scan.png', alt: 'Macra AI meal scan' },
      { src: '/system-overview/macra/app-store-screenshots/05-ask-nora.png', alt: 'Macra Ask Nora screen' },
    ],
    links: [
      { name: 'App Store', href: MACRA_APP_STORE_URL, label: 'Download Macra on iOS' },
      { name: 'Website', href: 'https://eatwithmacra.ai', label: 'Open Macra website' },
      { name: 'Media', href: '/admin/macraMedia', label: 'Open Macra media' },
    ],
    proof: ['Food journal', 'AI meal scan', 'Ask Nora nutrition'],
  },
];

const featuredStats = [
  { label: 'Daily check-in', value: '2 min' },
  { label: 'Built for', value: 'Teams' },
  { label: 'Signal layer', value: 'Readiness' },
];

const productTiles = [
  { name: 'PulseCheck', icon: '/pulseCheckIcon.png', href: '#pulsecheck', status: 'Featured product' },
  { name: 'Fit With Pulse', icon: '/fwp-app-icon.jpg', href: '#fit-with-pulse', status: 'Training app' },
  { name: 'Fit Club', icon: '/fitclub-favicon.png', href: '#fit-club', status: 'Club layer' },
  { name: 'Macra', icon: '/macra-icon.png', href: '#macra', status: 'Nutrition app' },
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

const ProductPortfolioHome: React.FC<ProductPortfolioHomeProps> = ({
  metaData,
  onUseWebApp,
  isSignInModalOpen,
  setIsSignInModalOpen,
  isAuthenticated,
}) => {
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const [heroVideoIsPlaying, setHeroVideoIsPlaying] = useState(false);

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

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white selection:bg-white/20">
      <PageHead
        metaData={homeMeta(metaData)}
        pageOgUrl="https://fitwithpulse.ai"
        pageOgImage="/pil-og.png"
        themeColor="#050505"
      />

      <header className={`fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-black/75 backdrop-blur-xl ${isSignInModalOpen ? 'hidden' : ''}`}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-3" aria-label="Pulse Intelligence Labs home">
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
            <span className="text-sm font-semibold text-white">Pulse Intelligence Labs</span>
          </a>

          <nav className="hidden items-center gap-5 text-sm text-zinc-300 md:flex" aria-label="Primary">
            <a href="#pulsecheck" className="transition-colors hover:text-white">PulseCheck</a>
            <a href="#fit-with-pulse" className="transition-colors hover:text-white">Fit With Pulse</a>
            <a href="#fit-club" className="transition-colors hover:text-white">Fit Club</a>
            <a href="#macra" className="transition-colors hover:text-white">Macra</a>
          </nav>

          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => setIsSignInModalOpen(true)}
                className="hidden rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:inline-flex"
              >
                Log in
              </button>
            )}
            <button
              type="button"
              onClick={onUseWebApp}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
            >
              {isAuthenticated ? 'Use Web App' : 'Get Started'}
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative flex min-h-[86vh] overflow-hidden pt-16">
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

          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-end px-4 pb-10 pt-16 sm:px-6">
            <div className="max-w-4xl">
              <ProductPill icon={<span className="h-2 w-2 rounded-full bg-[#E0FE10]" />}>
                The company behind the Pulse product suite
              </ProductPill>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-none text-white">
                Human performance products, all under one roof.
              </h1>
              <p className="mt-6 max-w-2xl text-xl leading-relaxed text-zinc-200">
                PulseCheck, Fit With Pulse, Fit Club, and Macra each solve a different part of training, mindset, community, and nutrition.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#pulsecheck"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
                >
                  See PulseCheck
                  <Brain className="h-4 w-4" />
                </a>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                >
                  Contact
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
              {productTiles.map((tile) => (
                <a
                  key={tile.name}
                  href={tile.href}
                  className="group flex items-center gap-3 rounded-lg border border-white/10 bg-black/45 p-4 backdrop-blur-md transition-colors hover:bg-white/10"
                >
                  <img src={tile.icon} alt="" className="h-11 w-11 rounded-lg object-cover ring-1 ring-white/10" draggable={false} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{tile.name}</span>
                    <span className="block truncate text-xs text-zinc-400">{tile.status}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="pulsecheck" className="border-t border-white/10 bg-[#08070d]">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
            <div>
              <ProductPill icon={<Brain className="h-4 w-4 text-[#A05EF8]" />}>Featured product</ProductPill>
              <h2 className="mt-6 text-4xl font-semibold leading-tight text-white">
                PulseCheck is the mental performance OS for athletes and the people responsible for them.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-zinc-300">
                A two-minute daily check-in becomes readiness intelligence, Nora support, coach visibility, and safety-aware escalation when the signal requires care.
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
                  <p className="text-sm leading-relaxed text-zinc-300">Nora turns daily state signals into private athlete support and structured follow-up.</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <Building2 className="mt-1 h-5 w-5 text-[#6A9AFA]" />
                  <p className="text-sm leading-relaxed text-zinc-300">Coaches get roster-level visibility without forcing athletes into another reporting chore.</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <ShieldCheck className="mt-1 h-5 w-5 text-[#5EEAD4]" />
                  <p className="text-sm leading-relaxed text-zinc-300">Clinical safety rails separate support signals from emergency response and keep care handoffs reviewable.</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="https://pulsecheckmind.ai"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#A05EF8] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#8B5CF6]"
                >
                  Open PulseCheck
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <a
                  href={PULSECHECK_APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  App Store
                  <Apple className="h-4 w-4" />
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
            <p className="text-sm font-semibold text-zinc-500">The rest of the company portfolio</p>
            <h2 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-white">
              Training, community, and nutrition each get their own surface.
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
                        {link.name === 'App Store' ? <Apple className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
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
              <p className="text-sm font-semibold text-zinc-500">One company, clearer doors</p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight">
                Use fitwithpulse.ai as the front door for the whole portfolio.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600">
                The email domain can point people to the company first, then route them to the product that matches their job: athlete readiness, training, club building, or nutrition.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <button
                type="button"
                onClick={onUseWebApp}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
              >
                {isAuthenticated ? 'Use Web App' : 'Get Started'}
                <Activity className="h-4 w-4" />
              </button>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-100"
              >
                Contact
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="font-semibold text-zinc-300">Pulse Intelligence Labs © {new Date().getFullYear()}</div>
          <div className="flex flex-wrap gap-4">
            <a href="#pulsecheck" className="hover:text-white">PulseCheck</a>
            <a href="#fit-with-pulse" className="hover:text-white">Fit With Pulse</a>
            <a href="#fit-club" className="hover:text-white">Fit Club</a>
            <a href="#macra" className="hover:text-white">Macra</a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>

      <SignInModal
        isVisible={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSignInSuccess={() => {
          setIsSignInModalOpen(false);
          onUseWebApp();
        }}
        onSignUpSuccess={() => {
          setIsSignInModalOpen(false);
          onUseWebApp();
        }}
      />
    </div>
  );
};

export default ProductPortfolioHome;
