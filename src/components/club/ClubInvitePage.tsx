import React from 'react';
import Head from 'next/head';
import { ArrowRight, ChevronDown, Medal, MessageCircle, Share2, Users } from 'lucide-react';
import { FaApple, FaGooglePlay } from 'react-icons/fa';

export interface ClubInvite {
  name: string;
  nameLine1: string;
  nameLine2: string;
  tagline: string;
  description: string;
  coverImageURL: string;
  accentColor: string;
  clubType: string;
  memberCount: number;
  workoutsCompleted: number;
  creatorDisplayName: string;
  creatorUsername: string;
  creatorInitials: string;
  inviteDeepLink: string;
  openInviteDeepLink?: string;
  webFallbackURL: string;
}

type ClubInvitePageProps = {
  club: ClubInvite;
  onOpenInvite?: () => void;
  onShare?: () => void;
  onStoreTap?: (store: 'ios' | 'android') => void;
};

const tickerItems = [
  { label: 'Daily workouts', color: 'lime' as const },
  { label: 'Group challenges', color: 'lime' as const },
  { label: 'Coach-led sessions', color: 'lime' as const },
  { label: 'Live leaderboard', color: 'orange' as const },
  { label: 'Real-time chat', color: 'orange' as const },
  { label: 'Free to join', color: 'orange' as const },
];

const joinSteps = [
  {
    title: 'Download Pulse',
    description: "Get the app on iPhone or Android - it's free.",
  },
  {
    title: 'Tap "Join this club in Pulse"',
    description: 'The button hands your invite directly into the app with context already attached.',
  },
  {
    title: 'Sign in & accept',
    description: 'Create your account, then accept the club invite inside Pulse.',
  },
  {
    title: 'Start moving',
    description: 'Jump into workouts, hit the chat, climb the leaderboard - this link always brings you back.',
  },
];

const PulseWaveIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M3 13h3l2-5 3 10 2-6h3l2 4h3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PulseLayersIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M12 4 4 8.5 12 13l8-4.5L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M4 12.5 12 17l8-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 16.5 12 21l8-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PulseWordmark = () => (
  <img
    src="/pulse-logo-white.svg"
    alt="Pulse"
    className="h-[22px] w-auto"
    loading="eager"
    decoding="async"
  />
);

const featureCards = [
  {
    title: 'Live Chat',
    description: 'Talk with the crew in real-time, any time.',
    icon: MessageCircle,
  },
  {
    title: 'Challenges',
    description: 'Push limits alongside your crew weekly.',
    icon: PulseWaveIcon,
  },
  {
    title: 'Leaderboard',
    description: 'See exactly where you rank among members.',
    icon: Medal,
  },
  {
    title: 'Community',
    description: 'Grow with motivated athletes around you.',
    icon: Users,
  },
];

const SectionDivider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3">
    <div className="h-[0.5px] flex-1 bg-[rgba(255,255,255,0.08)]" />
    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[rgba(255,255,255,0.22)]">{label}</span>
    <div className="h-[0.5px] flex-1 bg-[rgba(255,255,255,0.08)]" />
  </div>
);

const formatCount = (value: number): string => {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}K`;
  }

  return `${Math.max(1, Math.round(value || 0))}`;
};

const ClubInvitePage: React.FC<ClubInvitePageProps> = ({
  club,
  onOpenInvite,
  onShare,
  onStoreTap,
}) => {
  const heroCtaRef = React.useRef<HTMLButtonElement | null>(null);
  const howToJoinRef = React.useRef<HTMLElement | null>(null);
  const [isStickyCtaVisible, setIsStickyCtaVisible] = React.useState(false);
  const [hasStartedScrolling, setHasStartedScrolling] = React.useState(false);
  const accentColor = club.accentColor || '#FF6B35';
  const invitedByHandle = club.creatorUsername.startsWith('@') ? club.creatorUsername : `@${club.creatorUsername}`;
  const memberCountLabel = `${formatCount(club.memberCount)}+`;
  const workoutsLabel = formatCount(club.workoutsCompleted);
  const stickyLabel = `Join ${club.name.replace(/\([^)]*\)/g, '').trim() || club.name}`;
  const openInviteDeepLink = club.openInviteDeepLink || club.inviteDeepLink;

  React.useEffect(() => {
    const node = heroCtaRef.current;
    if (typeof window === 'undefined' || !node) {
      return undefined;
    }
    const browserWindow = window as Window;

    const updateStickyVisibility = () => {
      const rect = node.getBoundingClientRect();
      const isHeroCtaVisible = rect.bottom > 0 && rect.top < browserWindow.innerHeight;
      setIsStickyCtaVisible(!isHeroCtaVisible);
    };

    updateStickyVisibility();

    if (!('IntersectionObserver' in browserWindow)) {
      browserWindow.addEventListener('scroll', updateStickyVisibility, { passive: true });
      browserWindow.addEventListener('resize', updateStickyVisibility);

      return () => {
        browserWindow.removeEventListener('scroll', updateStickyVisibility);
        browserWindow.removeEventListener('resize', updateStickyVisibility);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStickyCtaVisible(!entry.isIntersecting);
      },
      {
        threshold: 0.01,
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const browserWindow = window as Window;

    const updateHasStartedScrolling = () => {
      setHasStartedScrolling(browserWindow.scrollY > 10);
    };

    updateHasStartedScrolling();
    browserWindow.addEventListener('scroll', updateHasStartedScrolling, { passive: true });
    browserWindow.addEventListener('resize', updateHasStartedScrolling);

    return () => {
      browserWindow.removeEventListener('scroll', updateHasStartedScrolling);
      browserWindow.removeEventListener('resize', updateHasStartedScrolling);
    };
  }, []);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const previousBodyBackground = document.body.style.backgroundColor;
    const previousHtmlBackground = document.documentElement.style.backgroundColor;

    document.body.style.backgroundColor = '#080808';
    document.documentElement.style.backgroundColor = '#080808';

    return () => {
      document.body.style.backgroundColor = previousBodyBackground;
      document.documentElement.style.backgroundColor = previousHtmlBackground;
    };
  }, []);

  const openInvite = () => {
    if (onOpenInvite) {
      onOpenInvite();
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.href = openInviteDeepLink;
    }
  };

  const shareInvite = async () => {
    if (onShare) {
      await onShare();
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: club.name,
        text: `Join ${club.name} on Pulse.`,
        url: club.inviteDeepLink,
      });
      return;
    }

    await navigator.clipboard.writeText(club.inviteDeepLink);
  };

  const scrollToHowToJoin = () => {
    setHasStartedScrolling(true);
    howToJoinRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="min-h-screen bg-black-pulse font-body text-white">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="animate-orb-in fixed left-[-92px] top-[-74px] h-[220px] w-[220px] rounded-full blur-[70px] [animation-delay:100ms]"
          style={{ backgroundColor: 'rgba(255,107,53,0.32)' }}
        />
        <div
          className="animate-orb-in fixed right-[-48px] top-[58px] h-[130px] w-[130px] rounded-full blur-[70px] [animation-delay:400ms]"
          style={{ backgroundColor: 'rgba(197,255,0,0.10)' }}
        />
        <div
          className="animate-orb-in fixed left-[34%] top-[48%] h-[180px] w-[180px] rounded-full blur-[70px] [animation-delay:700ms]"
          style={{ backgroundColor: 'rgba(255,107,53,0.07)' }}
        />
      </div>

      <div
        className="pointer-events-none fixed left-1/2 top-0 z-20 w-full max-w-[430px] -translate-x-1/2"
        style={{
          height: 'calc(env(safe-area-inset-top, 0px) + 76px)',
          background: 'linear-gradient(180deg, rgba(8,8,8,0.96) 0%, rgba(8,8,8,0.86) 34%, rgba(8,8,8,0.44) 68%, transparent 100%)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[430px]">
        <section className="relative h-[100svh] max-h-[700px] min-h-[560px] overflow-hidden">
          <img
            src={club.coverImageURL}
            alt={club.name}
            className="absolute inset-0 h-full w-full animate-photo-zoom object-cover"
            style={{ objectPosition: 'center 20%' }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.55)_0%,transparent_35%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,8,8,1)_0%,rgba(8,8,8,0.9)_12%,rgba(8,8,8,0.4)_45%,transparent_70%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(130deg,rgba(255,107,53,0.18)_0%,transparent_55%)]" />

          <div
            className="animate-fade-down absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 [animation-delay:150ms] [animation-fill-mode:both]"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          >
            <div className="flex items-center">
              <PulseWordmark />
            </div>

            <button
              type="button"
              onClick={() => void shareInvite()}
              aria-label="Share invite link"
              className="club-invite-glass flex h-[38px] w-[38px] items-center justify-center rounded-full text-white/80 backdrop-blur-[16px] transition hover:text-white"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          <div className="animate-fade-up absolute inset-x-0 bottom-0 px-5 pb-7 [animation-delay:450ms] [animation-fill-mode:both]">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(197,255,0,0.22)] bg-[rgba(197,255,0,0.08)] px-3 py-[7px] pl-[7px] backdrop-blur-glass">
              <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF6B35,#ff9d6b)] text-[10px] font-bold text-white">
                {club.creatorInitials}
              </div>
              <p className="text-[12px] text-[rgba(255,255,255,0.7)]">
                <span className="font-semibold text-lime">{invitedByHandle}</span> invited you personally
              </p>
            </div>

            <div className="mb-[10px] flex flex-wrap gap-[7px]">
              <div className="club-invite-glass rounded-full px-3 py-1.5 text-[12px] font-medium text-white">{club.clubType}</div>
              <div className="rounded-full border border-[rgba(255,107,53,0.30)] bg-[rgba(255,107,53,0.15)] px-3 py-1.5 text-[12px] font-medium text-[rgba(255,107,53,0.95)]">
                <span className="mr-2 inline-block h-[5px] w-[5px] rounded-full bg-orange-pulse align-middle animate-live-dot-pulse" />
                Active Now
              </div>
            </div>

            <h1 className="font-display text-[56px] leading-[0.94] tracking-[0.01em] text-white">
              <span className="block">{club.nameLine1}</span>
              <span className="block" style={{ color: accentColor }}>
                {club.nameLine2}
              </span>
            </h1>

            <p className="mb-5 mt-2 text-[13px] italic text-[rgba(255,255,255,0.5)]">{club.tagline}</p>

            <button
              ref={heroCtaRef}
              type="button"
              onClick={openInvite}
              data-invite-deep-link={openInviteDeepLink}
              data-testid="hero-join-cta"
              className="club-invite-cta w-full rounded-[14px] bg-lime px-4 py-4 text-left text-black-pulse shadow-[0_0_40px_rgba(197,255,0,0.18)] transition active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-black-pulse/10">
                  <PulseLayersIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[16px] font-bold leading-none">Join this club in Pulse</div>
                  <div className="mt-1 text-[10px] font-normal uppercase tracking-[0.08em] text-black-pulse/60">
                    Opens app · free to join
                  </div>
                </div>
              </div>
            </button>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <a
                href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                target="_blank"
                rel="noreferrer"
                onClick={() => onStoreTap?.('ios')}
                className="club-invite-glass flex items-center justify-center gap-2 rounded-[14px] px-3 py-[14px] text-[13px] font-medium text-[rgba(255,255,255,0.72)] transition hover:text-white"
              >
                <FaApple className="h-4 w-4" />
                Download on iOS
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=ai.fitwithpulse.pulse"
                target="_blank"
                rel="noreferrer"
                onClick={() => onStoreTap?.('android')}
                className="club-invite-glass flex items-center justify-center gap-2 rounded-[14px] px-3 py-[14px] text-[13px] font-medium text-[rgba(255,255,255,0.72)] transition hover:text-white"
              >
                <FaGooglePlay className="h-4 w-4" />
                Download on Android
              </a>
            </div>

            {!hasStartedScrolling ? (
              <button
                type="button"
                onClick={scrollToHowToJoin}
                className="mx-auto mt-5 flex items-center gap-2 text-[11px] font-medium tracking-[0.08em] text-[rgba(255,255,255,0.5)] transition hover:text-[rgba(255,255,255,0.78)] animate-scroll-cue"
                aria-label="Scroll down to see how to join"
              >
                <span className="uppercase">Scroll down to see how to join</span>
                <ChevronDown className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </section>

        <main className="relative px-5 pb-[110px]">
          <section ref={howToJoinRef} className="pt-7">
            <SectionDivider label="How to join" />

            <div className="pt-5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: accentColor }}>
                Install first, then join in app
              </p>
              <h2 className="font-display text-[32px] leading-[0.96] text-white">Get in in 60 seconds</h2>
            </div>

            <div className="pt-3">
              {joinSteps.map((step, index) => (
                <div key={step.title} className="relative flex gap-[14px] py-[14px]">
                  {index < joinSteps.length - 1 ? (
                    <div
                      className="absolute left-[17px] top-[48px] bottom-0 w-px"
                      style={{ background: 'linear-gradient(180deg, rgba(255,107,53,0.3), transparent)' }}
                    />
                  ) : null}

                  <div
                    className="relative z-10 flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-full border font-display text-[16px]"
                    style={{
                      backgroundColor: 'rgba(255,107,53,0.15)',
                      borderColor: 'rgba(255,107,53,0.30)',
                      color: accentColor,
                    }}
                  >
                    {index + 1}
                  </div>

                  <div className="pt-1">
                    <div className="text-[14px] font-semibold text-white">{step.title}</div>
                    <div className="mt-1 text-[12px] leading-[1.45] text-[rgba(255,255,255,0.5)]">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>

            <a
              href={club.webFallbackURL}
              className="mt-4 block text-center text-[12px] text-[rgba(255,255,255,0.3)] transition hover:text-[rgba(255,255,255,0.5)]"
            >
              Or open the web version instead →
            </a>
          </section>

          <section className="pt-10">
            <SectionDivider label="The club" />

            <div className="mt-6 grid grid-cols-3 gap-[10px]">
              {[
                { value: memberCountLabel, label: 'Members' },
                { value: workoutsLabel, label: 'Workouts' },
                { value: '24/7', label: 'Community' },
              ].map((stat) => (
                <div key={stat.label} className="club-invite-glass rounded-[16px] px-[10px] py-[14px] text-center">
                  <div className="font-display text-[34px] leading-none" style={{ color: accentColor }}>
                    {stat.value}
                  </div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-[rgba(255,255,255,0.3)]">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="club-invite-glass mt-7 flex items-center gap-3 rounded-[16px] px-4 py-[14px]">
              <div className="relative">
                <div className="absolute inset-[-2px] rounded-full border-[1.5px]" style={{ borderColor: 'rgba(255,107,53,0.35)' }} />
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF6B35,#ff9d6b)] font-display text-[20px] text-white">
                  {club.creatorInitials}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-white">{club.creatorDisplayName}</div>
                <div className="text-[12px] text-[rgba(255,255,255,0.5)]">
                  {invitedByHandle} · Head Coach
                </div>
              </div>

              <div
                className="rounded-full border px-[11px] py-[5px] text-[10px] font-semibold uppercase tracking-[0.06em]"
                style={{
                  backgroundColor: 'rgba(255,107,53,0.15)',
                  borderColor: 'rgba(255,107,53,0.30)',
                  color: accentColor,
                }}
              >
                Host
              </div>
            </div>

            <div className="mt-7">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: accentColor }}>
                About the club
              </p>
              <h2 className="font-display text-[32px] leading-[0.96] text-white">Why join FWB</h2>
              <p className="mt-3 text-[14px] leading-[1.65] text-[rgba(255,255,255,0.48)]">{club.description}</p>
            </div>

            <div className="club-invite-glass relative mt-7 aspect-[4/3] overflow-hidden rounded-[20px]">
              <img src={club.coverImageURL} alt={club.name} className="h-full w-full object-cover" style={{ objectPosition: 'center 20%' }} />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent_0%,rgba(8,8,8,0.92)_100%)]" />
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                <div className="text-[14px] font-semibold text-white">The crew on the track</div>
                <div className="mt-1 text-[12px] leading-[1.5] text-[rgba(255,255,255,0.56)]">
                  Join to unlock workouts, rounds &amp; challenges from the host
                </div>
              </div>
            </div>
          </section>

          <section className="pt-10">
            <div className="relative overflow-hidden rounded-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-[linear-gradient(90deg,#080808_0%,transparent_100%)]" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-[linear-gradient(270deg,#080808_0%,transparent_100%)]" />
              <div className="flex w-max animate-ticker-move gap-3 pr-3">
                {[...tickerItems, ...tickerItems].map((item, index) => (
                  <div key={`${item.label}-${index}`} className="club-invite-glass flex items-center gap-2 rounded-full px-3 py-2">
                    <span
                      className="inline-block h-[5px] w-[5px] rounded-full"
                      style={{ backgroundColor: item.color === 'lime' ? '#C5FF00' : accentColor }}
                    />
                    <span className="text-[12px] font-medium text-[rgba(255,255,255,0.72)]">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8">
              <SectionDivider label="What's inside" />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-[10px]">
              {featureCards.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="club-invite-glass rounded-[18px] px-[14px] py-[18px] transition hover:border-[rgba(255,107,53,0.2)]"
                  >
                    <div
                      className="mb-4 flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border"
                      style={{
                        backgroundColor: 'rgba(255,107,53,0.12)',
                        borderColor: 'rgba(255,107,53,0.22)',
                        color: accentColor,
                      }}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="text-[13px] font-semibold text-white">{feature.title}</div>
                    <div className="mt-1 text-[11px] leading-[1.45] text-[rgba(255,255,255,0.5)]">{feature.description}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      <div
        className="pointer-events-none fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2"
        style={{
          height: 'calc(env(safe-area-inset-bottom, 0px) + 112px)',
          background: 'linear-gradient(0deg, rgba(8,8,8,1) 22%, rgba(8,8,8,0.92) 48%, rgba(8,8,8,0.42) 78%, transparent 100%)',
        }}
      />

      <div
        aria-hidden={!isStickyCtaVisible}
        data-testid="sticky-join-cta-shell"
        data-sticky-visible={isStickyCtaVisible ? 'true' : 'false'}
        className={`fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 px-5 pt-3 transition-all duration-300 ease-out ${
          isStickyCtaVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={openInvite}
          data-invite-deep-link={openInviteDeepLink}
          data-testid="sticky-join-cta"
          tabIndex={isStickyCtaVisible ? 0 : -1}
          className="club-invite-cta flex w-full items-center justify-center gap-3 rounded-[16px] bg-lime px-4 py-[17px] text-[16px] font-bold text-black-pulse shadow-[0_-4px_48px_rgba(197,255,0,0.16),0_4px_24px_rgba(0,0,0,0.5)] transition active:scale-[0.98]"
        >
          <PulseLayersIcon className="h-5 w-5" />
          <span>{stickyLabel}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default ClubInvitePage;
