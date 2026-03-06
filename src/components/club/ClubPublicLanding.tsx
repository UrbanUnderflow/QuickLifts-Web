import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  FiActivity,
  FiAward,
  FiCheckCircle,
  FiMessageCircle,
  FiShare2,
  FiUsers,
} from 'react-icons/fi';
import PageHead from '../PageHead';
import { ClubLandingPageProps, RoundPreview } from '../../api/firebase/club/landingPage';
import {
  CLUB_TYPE_LABELS,
  deriveDarkBackground,
  ensureHexColor,
  getAccentTextColor,
} from './theme';

type ClubData = NonNullable<ClubLandingPageProps['clubData']>;

interface ClubPublicLandingProps {
  clubData: ClubData;
  creatorData?: ClubLandingPageProps['creatorData'];
  totalWorkoutsCompleted?: number;
  allRounds?: RoundPreview[];
  onJoin: () => void;
  isJoining?: boolean;
}

function getFeatureDescription(featureName: string): string {
  const lower = featureName.toLowerCase();

  if (lower.includes('chat')) return 'Connect with fellow members in real-time.';
  if (lower.includes('challenges')) return 'Join challenges and push your limits together.';
  if (lower.includes('leaderboard')) return 'Compete and climb the ranks.';
  if (lower.includes('community')) return 'A supportive space to grow and stay accountable.';

  return 'Included with your membership.';
}

function useCountUp(end: number, duration: number, startOnView: boolean, inView: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!startOnView || !inView) return;

    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [duration, end, inView, startOnView]);

  return count;
}

export const ClubPublicLanding: React.FC<ClubPublicLandingProps> = ({
  clubData,
  creatorData,
  totalWorkoutsCompleted = 0,
  allRounds = [],
  onJoin,
  isJoining = false,
}) => {
  const [copied, setCopied] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.3 });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { threshold: 0.1, rootMargin: '-60px 0px 0px 0px' }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const memberCount = clubData.memberCount ?? 1;
  const countMembers = useCountUp(memberCount, 1200, true, statsInView);
  const workoutsTotal = totalWorkoutsCompleted ?? 0;
  const countWorkouts = useCountUp(workoutsTotal, 1400, true, statsInView);

  const accent = ensureHexColor(clubData.accentColor);
  const accentHex = accent.replace('#', '');
  const darkBg = useMemo(() => deriveDarkBackground(accentHex), [accentHex]);
  const accentTextColor = useMemo(() => getAccentTextColor(accentHex), [accentHex]);

  const config = clubData.landingPageConfig || {};
  const title = config.heroTitle || clubData.name || 'Pulse Community Fitness';
  const description =
    config.heroSubtitle ||
    config.aboutText ||
    clubData.description ||
    'Welcome to our fitness community! Join rounds, chat, and grow together.';
  const heroImage =
    config.heroImage ||
    clubData.coverImageURL ||
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop';
  const features =
    config.features && config.features.length > 0
      ? config.features
      : ['Chat', 'Challenges', 'Leaderboard', 'Community'];
  const tagline = clubData.tagline || null;
  const clubTypeLabel = clubData.clubType ? CLUB_TYPE_LABELS[clubData.clubType] || null : null;
  const shareUrl = `https://fitwithpulse.ai/club/${clubData.id}`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[ClubPublicLanding] Failed to copy link:', error);
    }
  };

  const marqueeItems = [
    `${memberCount}+ active members`,
    'Daily workouts',
    'Live chat',
    'New challenges weekly',
    'Leaderboards',
    'Community support',
  ];

  return (
    <div className="min-h-screen overflow-y-auto font-sans text-white" style={{ backgroundColor: darkBg }}>
      <PageHead
        pageOgUrl={shareUrl}
        metaData={{
          pageId: clubData.id,
          pageTitle: `${title} | Pulse`,
          metaDescription: description,
          ogTitle: title,
          ogDescription: description,
          ogImage: heroImage,
          ogUrl: shareUrl,
          twitterTitle: title,
          twitterDescription: description,
          twitterImage: heroImage,
          lastUpdated: new Date().toISOString(),
        }}
        pageOgImage={heroImage}
      />

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-32 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full opacity-[0.07] blur-[180px]"
          style={{ backgroundColor: accent }}
        />
        <div
          className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full opacity-[0.04] blur-[150px]"
          style={{ backgroundColor: accent }}
        />
      </div>

      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: showStickyCta ? 0 : -80, opacity: showStickyCta ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 p-3 backdrop-blur-lg md:hidden"
        style={{ backgroundColor: `${darkBg}e6` }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <span className="truncate text-sm font-bold">{title}</span>
          <button
            onClick={onJoin}
            className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-extrabold transition-all"
            style={{ backgroundColor: accent, color: accentTextColor }}
          >
            {isJoining ? 'Joining...' : 'Join Club'}
          </button>
        </div>
      </motion.div>

      <div className="relative z-10 mx-auto max-w-5xl pb-24">
        <div
          ref={heroRef}
          className="relative flex min-h-[100vh] w-full flex-col justify-end overflow-hidden rounded-b-3xl md:rounded-b-[3rem]"
        >
          <div className="absolute inset-0 z-0">
            <img src={heroImage} alt={title} className="h-full w-full scale-105 object-cover" />
            <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundColor: accent }} />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to top, ${darkBg} 0%, ${darkBg}b3 35%, transparent 100%)`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />
          </div>

          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div
              className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full opacity-[0.12] blur-[120px]"
              style={{ backgroundColor: accent }}
            />
            <div
              className="absolute bottom-1/3 right-1/4 h-80 w-80 rounded-full opacity-[0.06] blur-[100px]"
              style={{ backgroundColor: accent }}
            />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-20 pt-24 md:pb-24 md:pt-32">
            {clubTypeLabel && (
              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 backdrop-blur-md"
                style={{ backgroundColor: `${accent}1a`, borderColor: `${accent}40` }}
              >
                <span className="text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
                  {clubTypeLabel}
                </span>
              </motion.div>
            )}

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.04 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-md"
            >
              <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ backgroundColor: accent }} />
              <span className="text-sm font-semibold uppercase tracking-wide text-white/90">Active Now</span>
            </motion.div>

            <motion.h1
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08, duration: 0.5 }}
              className="mb-4 text-5xl font-black uppercase tracking-tighter text-white drop-shadow-2xl md:text-7xl lg:text-8xl"
            >
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(135deg, #ffffff 30%, ${accent})` }}
              >
                {title}
              </span>
            </motion.h1>

            {tagline && (
              <motion.p
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.12, duration: 0.5 }}
                className="mb-4 text-lg font-medium italic drop-shadow-md md:text-xl"
                style={{ color: `${accent}cc` }}
              >
                &ldquo;{tagline}&rdquo;
              </motion.p>
            )}

            <motion.p
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.16, duration: 0.5 }}
              className="mb-10 max-w-2xl text-lg font-light leading-relaxed text-gray-300 drop-shadow-md md:text-2xl"
            >
              {description}
            </motion.p>

            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.24, duration: 0.5 }}
              className="flex w-full flex-col gap-4 sm:flex-row md:w-auto"
            >
              <button
                onClick={onJoin}
                disabled={isJoining}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-8 py-4 font-extrabold transition-all md:flex-none"
                style={{
                  backgroundColor: accent,
                  color: accentTextColor,
                  boxShadow: `0 10px 40px ${accent}33`,
                }}
              >
                {isJoining ? 'Joining...' : 'Join Club'}
              </button>
              <button
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-bold text-white transition-colors hover:bg-white/10 md:flex-none"
              >
                <FiShare2 /> {copied ? 'Copied!' : 'Share Link'}
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-16 flex justify-center"
            >
              <div className="flex h-12 w-8 items-start justify-center rounded-full border-2 p-2" style={{ borderColor: `${accent}50` }}>
                <motion.span
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: `${accent}cc` }}
                />
              </div>
            </motion.div>
          </div>
        </div>

        <div className="relative overflow-hidden border-y border-white/10 py-6" style={{ backgroundColor: darkBg }}>
          <div className="flex w-max animate-marquee whitespace-nowrap">
            {[...marqueeItems, ...marqueeItems].map((item, index) => (
              <span key={`${item}-${index}`} className="mx-8 flex items-center gap-2 font-semibold text-gray-400">
                <span style={{ color: accent }}>◆</span> {item}
              </span>
            ))}
          </div>
        </div>

        {creatorData && (
          <motion.section
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5 }}
            className="px-6 py-20 md:px-12 md:py-28"
          >
            <p className="mb-6 text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>
              Designed and led by
            </p>
            <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
              <div className="relative shrink-0">
                <div
                  className="h-32 w-32 overflow-hidden rounded-full md:h-40 md:w-40"
                  style={{ boxShadow: `0 0 0 4px ${accent}4d` }}
                >
                  <img
                    src={
                      creatorData.profileImage?.profileImageURL ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorData.displayName || 'Coach')}`
                    }
                    alt={creatorData.displayName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="absolute -inset-1 -z-10 rounded-full opacity-30 blur-xl" style={{ backgroundColor: accent }} />
              </div>
              <div className="max-w-xl text-center md:text-left">
                <h2 className="mb-2 text-3xl font-black text-white md:text-4xl">{creatorData.displayName}</h2>
                <p className="mb-6 font-semibold" style={{ color: `${accent}99` }}>
                  Head Coach
                </p>
                <blockquote className="text-lg font-light italic leading-relaxed text-gray-300 md:text-xl">
                  &ldquo;{description}&rdquo;
                </blockquote>
              </div>
            </div>
          </motion.section>
        )}

        <section className="px-6 py-20 md:px-12 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            className="mb-16 text-center"
          >
            <h2 className="mb-6 text-4xl font-black tracking-tight md:text-5xl">Everything You Need To Level Up</h2>
            <p className="mx-auto max-w-2xl text-xl text-gray-400">
              Join a community of like-minded individuals. Motivation, progress, and results.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {features.map((feature: string, index: number) => {
              let Icon = FiCheckCircle;
              if (feature.toLowerCase().includes('chat')) Icon = FiMessageCircle;
              if (feature.toLowerCase().includes('leaderboard')) Icon = FiAward;
              if (feature.toLowerCase().includes('challenges')) Icon = FiActivity;
              if (feature.toLowerCase().includes('community')) Icon = FiUsers;

              return (
                <motion.div
                  key={`${feature}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ delay: index * 0.05 }}
                  className="group rounded-3xl border border-white/5 bg-[#151518] p-6 text-center transition-all duration-300 hover:border-white/20 md:p-8"
                >
                  <div
                    className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border transition-transform group-hover:scale-110"
                    style={{
                      color: accent,
                      backgroundColor: `${accent}15`,
                      borderColor: `${accent}30`,
                      boxShadow: `0 4px 16px ${accent}20`,
                    }}
                  >
                    <Icon size={28} />
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{feature}</h3>
                  <p className="text-sm text-gray-400">{getFeatureDescription(feature)}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          className="px-6 py-20 md:px-12 md:py-28"
        >
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest" style={{ color: accent }}>
              Featured Rounds
            </p>
            <h2 className="mb-6 text-4xl font-black tracking-tight md:text-5xl">See What&apos;s Waiting Inside</h2>
            <p className="mx-auto max-w-2xl text-xl text-gray-400">
              {allRounds.length > 0
                ? 'Join the club to get access to these rounds and more.'
                : 'Your community, workouts, and progress in one place.'}
            </p>
          </div>

          {allRounds.length > 0 ? (
            <div className="mx-auto flex max-w-2xl flex-col gap-5">
              {allRounds.map((round) => (
                <motion.div
                  key={round.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="rounded-2xl border bg-[#151518] p-5 transition-colors md:p-6"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.borderColor = `${accent}33`;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-white md:text-xl">{round.title}</h3>
                      {round.subtitle ? (
                        <p className="mt-0.5 line-clamp-1 text-sm text-gray-400">{round.subtitle}</p>
                      ) : null}
                    </div>
                    <span
                      className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
                        round.isActive ? 'text-green-400' : 'bg-white/10 text-gray-400'
                      }`}
                      style={round.isActive ? { backgroundColor: `${accent}20`, color: accent } : undefined}
                    >
                      {round.isActive ? 'Live' : 'Ended'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold"
                      style={{ backgroundColor: `${accent}15`, color: accent }}
                    >
                      <FiActivity className="h-3.5 w-3.5" />
                      {round.workoutCount} workout{round.workoutCount !== 1 ? 's' : ''}
                    </span>
                    {round.participantCount > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm font-semibold text-gray-300">
                        <FiUsers className="h-3.5 w-3.5" />
                        {round.participantCount} participant{round.participantCount !== 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#151518] p-8 text-center">
                <div className="mb-6 aspect-video overflow-hidden rounded-2xl bg-[#0E0E10]">
                  <img src={heroImage} alt={title} className="h-full w-full object-cover" />
                </div>
                <p className="text-lg text-gray-300">Join to see rounds, workouts, and challenges from the host.</p>
              </div>
            </div>
          )}
        </motion.section>

        <section ref={statsRef} className="px-6 py-20 md:px-12 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#151518] p-8 text-center md:p-12"
          >
            <div
              className="absolute left-1/2 top-0 h-32 w-96 -translate-x-1/2 rounded-full opacity-[0.12] blur-3xl"
              style={{ backgroundColor: accent }}
            />
            <div className="relative">
              <h2 className="mb-10 text-2xl font-bold text-white md:text-3xl">
                Join {memberCount}+ others already training
              </h2>
              <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
                <div>
                  <p className="text-4xl font-black md:text-5xl" style={{ color: accent }}>
                    {countMembers.toLocaleString()}
                  </p>
                  <p className="mt-1 font-semibold uppercase tracking-wider text-gray-400">Members</p>
                </div>
                <div>
                  <p className="text-4xl font-black md:text-5xl" style={{ color: accent }}>
                    {countWorkouts.toLocaleString()}
                  </p>
                  <p className="mt-1 font-semibold uppercase tracking-wider text-gray-400">Workouts Completed</p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <p className="text-4xl font-black md:text-5xl" style={{ color: accent }}>
                    24/7
                  </p>
                  <p className="mt-1 font-semibold uppercase tracking-wider text-gray-400">Community</p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          className="px-6 py-20 md:px-12 md:py-28"
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-10 text-center md:p-16">
            <div className="absolute inset-0 opacity-5" style={{ backgroundColor: accent }} />
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.10] blur-[120px]"
              style={{ backgroundColor: accent }}
            />
            <div className="relative">
              <h2 className="mb-6 text-4xl font-black text-white md:text-5xl">Ready to Join {title}?</h2>
              <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-300 md:text-xl">{description}</p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <motion.button
                  onClick={onJoin}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-10 py-4 font-extrabold transition-all sm:w-auto"
                  style={{
                    backgroundColor: accent,
                    color: accentTextColor,
                    boxShadow: `0 10px 40px ${accent}4d`,
                  }}
                >
                  {isJoining ? 'Joining...' : 'Join Club'}
                </motion.button>
                <button
                  onClick={handleShare}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 font-bold text-white transition-colors hover:bg-white/10 sm:w-auto"
                >
                  <FiShare2 /> {copied ? 'Copied!' : 'Share Link'}
                </button>
              </div>
              <p className="mt-10 text-sm text-gray-500">Powered by Pulse</p>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
};
