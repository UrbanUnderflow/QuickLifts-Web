import React, { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Download,
  ExternalLink,
  Sparkles,
  Smartphone,
  TabletSmartphone,
  Users2,
  Globe,
  ShieldCheck,
  BadgeInfo,
} from 'lucide-react';
import PageHead from '../PageHead';
import { ClubLandingPageProps, RoundPreview } from '../../api/firebase/club/landingPage';
import { CLUB_TYPE_LABELS, deriveDarkBackground, ensureHexColor, formatCompactNumber, getAccentTextColor } from './theme';
import { appLinks, platformDetection } from '../../utils/platformDetection';
import { buildClubCanonicalUrl, buildClubInstallPath, buildClubOneLink } from '../../utils/clubLinks';
import {
  trackClubInstallPageViewed,
  trackClubInstallStoreTapped,
  trackClubOpenInAppTapped,
} from '../../lib/clubShareAnalytics';

type ClubData = NonNullable<ClubLandingPageProps['clubData']>;

type ClubInstallLandingProps = {
  clubData: ClubData;
  creatorData?: ClubLandingPageProps['creatorData'];
  totalWorkoutsCompleted?: number;
  allRounds?: RoundPreview[];
  pageUrl: string;
  sharedBy?: string | null;
  eventId?: string | null;
};

const splitIntoLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const buildInstallSteps = (args: {
  clubName: string;
  sharedBy?: string | null;
  eventId?: string | null;
}) => {
  const steps = [
    {
      title: 'Download the Pulse app',
      body: 'Install Pulse on your phone so the club can open in the native experience.',
    },
    {
      title: 'Tap Open in Pulse',
      body: 'Use the button below to hand off the invite directly into the app when it is installed.',
    },
    {
      title: 'Sign in and join',
      body: `Complete sign-in, then join ${args.clubName} inside the app with the invite context already attached.`,
    },
    {
      title: 'Return anytime',
      body: 'Keep the link handy. It will bring you back into the club on future visits too.',
    },
  ];

  if (args.sharedBy || args.eventId) {
    steps[2] = {
      title: 'Join with your invite context',
      body: `This share link keeps the right club handoff${args.eventId ? ' and event context' : ''} attached when the app opens.`,
    };
  }

  return steps;
};

const ClubInstallLanding: React.FC<ClubInstallLandingProps> = ({
  clubData,
  creatorData,
  totalWorkoutsCompleted = 0,
  allRounds = [],
  pageUrl,
  sharedBy,
  eventId,
}) => {
  const accent = ensureHexColor(clubData.accentColor);
  const accentHex = accent.replace('#', '');
  const darkBg = deriveDarkBackground(accentHex);
  const accentTextColor = getAccentTextColor(accentHex);

  const config = clubData.landingPageConfig || {};
  const title = config.heroTitle || clubData.name || 'Pulse Club';
  const description =
    config.heroSubtitle ||
    config.aboutText ||
    clubData.description ||
    'Install Pulse to join your club in the best possible experience.';
  const heroImage =
    config.heroImage ||
    clubData.coverImageURL ||
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop';
  const clubTypeLabel = clubData.clubType ? CLUB_TYPE_LABELS[clubData.clubType] || null : null;

  const creatorName = creatorData?.displayName || creatorData?.username || 'Your creator';
  const creatorAvatar =
    creatorData?.profileImage?.profileImageURL ||
    clubData.logoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorName)}`;

  const installFallbackPath = buildClubInstallPath(clubData.id, {
    sharedBy: sharedBy || undefined,
    eventId: eventId || undefined,
    web: true,
  });

  const openInPulseUrl = buildClubOneLink({
    clubId: clubData.id,
    sharedBy: sharedBy || undefined,
    eventId: eventId || undefined,
    fallbackPath: installFallbackPath,
    pid: 'creator_club_install',
    campaign: 'creator_club_install',
    title: `Open ${title} in Pulse`,
    description: `Open ${title} in the Pulse app to continue your club journey.`,
    imageUrl: heroImage,
  });

  const desktopHref = buildClubCanonicalUrl(clubData.id, {
    sharedBy: sharedBy || undefined,
    eventId: eventId || undefined,
  });

  const steps = buildInstallSteps({
    clubName: title,
    sharedBy,
    eventId,
  });

  const features: string[] =
    config.features && config.features.length > 0 ? config.features : ['Chat', 'Challenges', 'Leaderboard', 'Community'];
  const roundHighlights = allRounds.slice(0, 3);
  const memberCount = clubData.memberCount ?? 0;
  const mobileAppCtaLabel = eventId ? 'Open event invite in Pulse' : 'Open in Pulse';

  useEffect(() => {
    trackClubInstallPageViewed({
      clubId: clubData.id,
      sharedBy,
      eventId,
      source: 'club_install_page',
      platform: platformDetection.getPlatform(),
    });
  }, [clubData.id, eventId, sharedBy]);

  const handleStoreTap = (store: 'ios' | 'android') => {
    trackClubInstallStoreTapped(
      {
        clubId: clubData.id,
        sharedBy,
        eventId,
        source: 'club_install_page',
        platform: platformDetection.getPlatform(),
      },
      store
    );
  };

  const handleOpenInApp = () => {
    trackClubOpenInAppTapped({
      clubId: clubData.id,
      sharedBy,
      eventId,
      source: 'club_install_page',
      platform: platformDetection.getPlatform(),
    });
  };

  return (
    <div className="min-h-screen overflow-hidden text-white" style={{ backgroundColor: darkBg }}>
      <Head>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <PageHead
        pageOgUrl={pageUrl}
        metaData={{
          pageId: clubData.id,
          pageTitle: `${title} | Install Pulse`,
          metaDescription: `Install the Pulse app to join ${title}.`,
          ogTitle: `Install Pulse for ${title}`,
          ogDescription: description,
          ogImage: heroImage,
          ogUrl: pageUrl,
          twitterTitle: `Install Pulse for ${title}`,
          twitterDescription: description,
          twitterImage: heroImage,
          lastUpdated: new Date().toISOString(),
        }}
        pageOgImage={heroImage}
      />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-8rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full blur-[140px] opacity-20"
          style={{ backgroundColor: accent }}
        />
        <div
          className="absolute bottom-[-9rem] right-[-7rem] h-[24rem] w-[24rem] rounded-full blur-[130px] opacity-20"
          style={{ backgroundColor: accent }}
        />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] backdrop-blur-xl"
          >
            <div className="relative min-h-[18rem] sm:min-h-[24rem] lg:min-h-[32rem]">
              <img src={heroImage} alt={title} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/20" />
              <div
                className="absolute inset-0 opacity-25 mix-blend-screen"
                style={{ background: `radial-gradient(circle at top left, ${accent}, transparent 55%)` }}
              />

              <div className="relative flex h-full flex-col justify-between p-5 sm:p-7 lg:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-white/85 backdrop-blur-md">
                    <Sparkles className="h-3.5 w-3.5" style={{ color: accent }} />
                    Creator Club Install
                  </div>
                  {clubTypeLabel ? (
                    <div className="rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/75 backdrop-blur-md">
                      {clubTypeLabel}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-5">
                  <div className="inline-flex items-center gap-3 rounded-3xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md">
                    <img src={creatorAvatar} alt={creatorName} className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/15" />
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/45">Hosted by</div>
                      <div className="text-sm font-semibold text-white">{creatorName}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm uppercase tracking-[0.28em] text-white/40">Pulse Club</p>
                    <h1 className="max-w-3xl text-4xl font-black leading-[0.9] tracking-tighter sm:text-5xl lg:text-6xl">
                      <span
                        className="bg-clip-text text-transparent"
                        style={{ backgroundImage: `linear-gradient(135deg, #ffffff 20%, ${accent})` }}
                      >
                        {title}
                      </span>
                    </h1>
                    <p className="max-w-2xl text-sm leading-7 text-white/75 sm:text-base">{description}</p>
                  </div>

                  {splitIntoLines(clubData.tagline || '').length > 0 ? (
                    <p className="max-w-2xl text-sm font-medium italic text-white/70">
                      &ldquo;{clubData.tagline}&rdquo;
                    </p>
                  ) : null}

                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">Members</div>
                      <div className="mt-2 text-2xl font-bold" style={{ color: accent }}>
                        {formatCompactNumber(memberCount)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">Workouts</div>
                      <div className="mt-2 text-2xl font-bold" style={{ color: accent }}>
                        {formatCompactNumber(totalWorkoutsCompleted)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">Rounds</div>
                      <div className="mt-2 text-2xl font-bold" style={{ color: accent }}>
                        {formatCompactNumber(roundHighlights.length)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="rounded-[32px] border border-white/10 bg-[#090f1c]/95 p-5 shadow-[0_0_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6"
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: accent }} />
                  Install first, then join in app
                </div>
                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Download the app to join this club the right way
                </h2>
                <p className="text-sm leading-7 text-white/65">
                  If the app is already installed, Pulse will open directly into your invite. If not, the buttons below will help you get set up in under a minute.
                </p>
              </div>

              {eventId || sharedBy ? (
                <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-4 text-sm leading-7 text-cyan-50">
                  {eventId ? 'This invite also carries event context. ' : ''}
                  {sharedBy ? 'Your share context will stay attached through the handoff.' : 'The club handoff will stay attached through the install flow.'}
                </div>
              ) : null}

              <div className="grid gap-3">
                {steps.map((step, index) => (
                  <div key={step.title} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black"
                        style={{ backgroundColor: accent, color: accentTextColor }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-white">{step.title}</div>
                        <div className="text-sm leading-6 text-white/65">{step.body}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={appLinks.appStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => handleStoreTap('ios')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
                >
                  <Download className="h-4 w-4" />
                  Download on iPhone
                </a>
                <a
                  href={appLinks.playStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => handleStoreTap('android')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Smartphone className="h-4 w-4" style={{ color: accent }} />
                  Get it on Android
                </a>
              </div>

              <a
                href={openInPulseUrl}
                onClick={handleOpenInApp}
                className="group inline-flex w-full items-center justify-between gap-3 rounded-[1.25rem] border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(14,165,233,0.12))] px-4 py-4 text-sm font-semibold text-cyan-50 transition hover:border-cyan-200/40 hover:bg-[linear-gradient(135deg,rgba(34,211,238,0.28),rgba(14,165,233,0.18))]"
              >
                <span className="inline-flex items-center gap-3">
                  <TabletSmartphone className="h-4 w-4" />
                  {mobileAppCtaLabel}
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>

              <div className="grid gap-3 rounded-3xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
                  <BadgeInfo className="h-4 w-4" style={{ color: accent }} />
                  What&apos;s inside
                </div>
                <div className="flex flex-wrap gap-2">
                  {features.slice(0, 4).map((feature: string) => (
                    <span
                      key={feature}
                      className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs font-semibold text-white/75"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {roundHighlights.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
                    <Users2 className="h-4 w-4" style={{ color: accent }} />
                    Featured rounds
                  </div>
                  <div className="grid gap-3">
                    {roundHighlights.map((round) => (
                      <div key={round.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                        <div className="text-sm font-semibold text-white">{round.title}</div>
                        <div className="mt-2 text-xs leading-6 text-white/55">
                          {round.subtitle || 'A featured club round ready to continue in Pulse.'}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-white/45">
                          <span>{formatCompactNumber(round.workoutCount)} workouts</span>
                          <span>•</span>
                          <span>{formatCompactNumber(round.participantCount)} participants</span>
                          <span>•</span>
                          <span>{round.isActive ? 'Active' : 'Archived'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-white/8 pt-2 sm:flex-row">
                <Link
                  href={desktopHref}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Globe className="h-4 w-4" />
                  Open the web club page
                </Link>
                <a
                  href={installFallbackPath}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                >
                  <ExternalLink className="h-4 w-4" />
                  Keep the install link handy
                </a>
              </div>
            </div>
          </motion.aside>
        </section>
      </main>
    </div>
  );
};

export default ClubInstallLanding;
