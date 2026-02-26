import { GetServerSideProps } from 'next';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import PageHead from '../../components/PageHead';
import { clubService } from '../../api/firebase/club/service';
import { workoutService } from '../../api/firebase/workout/service';
import { userService } from '../../api/firebase/user';
import { FiShare2, FiUsers, FiMessageCircle, FiAward, FiActivity, FiCheckCircle } from 'react-icons/fi';
import { motion, useInView } from 'framer-motion';

interface RoundPreview {
    id: string;
    title: string;
    subtitle: string;
    workoutCount: number;
    participantCount: number;
    isActive: boolean;
}

interface ClubPageProps {
    clubData?: any | null;
    creatorData?: any | null;
    totalWorkoutsCompleted?: number;
    allRounds?: RoundPreview[];
    error?: string | null;
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
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [end, duration, startOnView, inView]);
    return count;
}

const ClubPage: React.FC<ClubPageProps> = ({ clubData, creatorData, totalWorkoutsCompleted = 0, allRounds = [], error }) => {
    const router = useRouter();
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
        if (heroRef.current) observer.observe(heroRef.current);
        return () => observer.disconnect();
    }, []);

    const memberCount = clubData?.memberCount ?? 1;
    const countMembers = useCountUp(memberCount, 1200, true, statsInView);
    const workoutsTotal = totalWorkoutsCompleted ?? 0;
    const countWorkouts = useCountUp(workoutsTotal, 1400, true, statsInView);

    if (error || !clubData) {
        return (
            <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center text-white">
                <PageHead pageOgUrl={`https://fitwithpulse.ai/club/${router.query.id as string}`} />
                <h1 className="text-xl font-semibold">{error || 'Club not found'}</h1>
            </div>
        );
    }

    const config = clubData.landingPageConfig || {};
    const title = config.heroTitle || clubData.name || 'Pulse Community Fitness';
    const description = config.heroSubtitle || config.aboutText || clubData.description || 'Welcome to our fitness community! Join rounds, chat, and grow together.';
    const heroImage = config.heroImage || clubData.coverImageURL || "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop";
    const features = config.features && config.features.length > 0 ? config.features : ["Chat", "Challenges", "Leaderboard", "Community"];

    const handleShare = () => {
        navigator.clipboard.writeText(`https://fitwithpulse.ai/club/${clubData.id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleJoin = () => {
        router.push(creatorData?.username ? `/${creatorData.username}` : '/');
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
        <div className="min-h-screen bg-[#0E0E10] text-white font-sans overflow-y-auto">
            <PageHead
                pageOgUrl={`https://fitwithpulse.ai/club/${clubData.id}`}
                metaData={{
                    pageId: clubData.id,
                    pageTitle: `${title} | Pulse`,
                    metaDescription: description,
                    ogTitle: title,
                    ogDescription: description,
                    ogImage: heroImage,
                    ogUrl: `https://fitwithpulse.ai/club/${clubData.id}`,
                    twitterTitle: title,
                    twitterDescription: description,
                    twitterImage: heroImage,
                    lastUpdated: new Date().toISOString()
                }}
                pageOgImage={heroImage}
            />

            {/* Sticky CTA (mobile-first) */}
            <motion.div
                initial={{ y: -80, opacity: 0 }}
                animate={{ y: showStickyCta ? 0 : -80, opacity: showStickyCta ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                className="fixed top-0 left-0 right-0 z-50 p-3 bg-[#0E0E10]/95 backdrop-blur-lg border-b border-white/10 md:hidden"
            >
                <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
                    <span className="font-bold text-sm truncate">{title}</span>
                    <button
                        onClick={handleJoin}
                        className="shrink-0 bg-[#E0FE10] hover:bg-[#c8e60e] text-black font-extrabold px-5 py-2.5 rounded-xl transition-all text-sm"
                    >
                        Join Club
                    </button>
                </div>
            </motion.div>

            <div className="max-w-5xl mx-auto pb-24">
                {/* Section 1: Cinematic Hero */}
                <div
                    ref={heroRef}
                    className="relative min-h-[100vh] w-full flex flex-col justify-end overflow-hidden md:rounded-b-[3rem] rounded-b-3xl"
                >
                    <div className="absolute inset-0 z-0">
                        <img src={heroImage} alt="Club Background" className="w-full h-full object-cover scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E10] via-[#0E0E10]/70 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />
                    </div>
                    {/* Ambient glow orbs */}
                    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#E0FE10]/10 blur-[120px]" />
                        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-[#E0FE10]/5 blur-[100px]" />
                    </div>

                    <div className="relative z-10 px-6 pb-20 md:pb-24 pt-24 md:pt-32 w-full max-w-4xl mx-auto">
                        <motion.div
                            initial={{ y: 24, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6"
                        >
                            <span className="w-2.5 h-2.5 rounded-full bg-[#E0FE10] animate-pulse" />
                            <span className="text-white/90 text-sm font-semibold tracking-wide uppercase">Active Now</span>
                        </motion.div>

                        <motion.h1
                            initial={{ y: 24, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.08, duration: 0.5 }}
                            className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 uppercase tracking-tighter drop-shadow-2xl"
                        >
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/90">{title}</span>
                        </motion.h1>

                        <motion.p
                            initial={{ y: 24, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.16, duration: 0.5 }}
                            className="text-lg md:text-2xl text-gray-300 font-light mb-10 max-w-2xl drop-shadow-md leading-relaxed"
                        >
                            {description}
                        </motion.p>

                        <motion.div
                            initial={{ y: 24, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.24, duration: 0.5 }}
                            className="flex flex-col sm:flex-row gap-4 w-full md:w-auto"
                        >
                            <button
                                onClick={handleJoin}
                                className="flex-1 md:flex-none bg-[#E0FE10] hover:bg-[#c8e60e] text-black font-extrabold px-8 py-4 rounded-xl transition-all shadow-xl shadow-[#E0FE10]/20 flex items-center justify-center gap-2"
                            >
                                Join Club
                            </button>
                            <button
                                onClick={handleShare}
                                className="flex-1 md:flex-none bg-white/5 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-2 backdrop-blur-md"
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
                            <div className="w-8 h-12 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
                                <motion.span
                                    animate={{ y: [0, 6, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                    className="w-1.5 h-1.5 rounded-full bg-white/80"
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Section 2: Social Proof Marquee */}
                <div className="relative py-6 overflow-hidden border-y border-white/10 bg-[#0E0E10]">
                    <div className="flex animate-marquee whitespace-nowrap w-max">
                        {[...marqueeItems, ...marqueeItems].map((item, i) => (
                            <span key={i} className="mx-8 text-gray-400 font-semibold flex items-center gap-2">
                                <span className="text-[#E0FE10]">◆</span> {item}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Section 3: Creator Spotlight */}
                {creatorData && (
                    <motion.section
                        initial={{ opacity: 0, y: 32 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.5 }}
                        className="py-20 md:py-28 px-6 md:px-12"
                    >
                        <p className="text-sm font-semibold text-[#E0FE10] uppercase tracking-wider mb-6">Designed and led by</p>
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                            <div className="relative shrink-0">
                                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full ring-4 ring-[#E0FE10]/30 ring-offset-4 ring-offset-[#0E0E10] overflow-hidden">
                                    <img
                                        src={creatorData.profileImage?.profileImageURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(creatorData.displayName || 'Coach')}`}
                                        alt={creatorData.displayName}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute -inset-1 rounded-full bg-[#E0FE10]/20 blur-xl -z-10" />
                            </div>
                            <div className="text-center md:text-left max-w-xl">
                                <h2 className="text-3xl md:text-4xl font-black text-white mb-2">{creatorData.displayName}</h2>
                                <p className="text-gray-400 font-semibold mb-6">Head Coach</p>
                                <blockquote className="text-lg md:text-xl text-gray-300 font-light leading-relaxed italic">
                                    "{description}"
                                </blockquote>
                            </div>
                        </div>
                    </motion.section>
                )}

                {/* Section 4: What's Inside (Features Reimagined) */}
                <section className="py-20 md:py-28 px-6 md:px-12">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">Everything You Need To Level Up</h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Join a community of like-minded individuals. Motivation, progress, and results.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {features.map((ft: string, idx: number) => {
                            let Icon = FiCheckCircle;
                            let colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                            let glowClass = 'shadow-emerald-500/20';
                            if (ft.toLowerCase().includes('chat')) {
                                Icon = FiMessageCircle;
                                colorClass = 'text-teal-400 bg-teal-500/10 border-teal-500/20';
                                glowClass = 'shadow-teal-500/20';
                            }
                            if (ft.toLowerCase().includes('leaderboard')) {
                                Icon = FiAward;
                                colorClass = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
                                glowClass = 'shadow-purple-500/20';
                            }
                            if (ft.toLowerCase().includes('challenges')) {
                                Icon = FiActivity;
                                colorClass = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
                                glowClass = 'shadow-orange-500/20';
                            }
                            if (ft.toLowerCase().includes('community')) {
                                Icon = FiUsers;
                                colorClass = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
                                glowClass = 'shadow-blue-500/20';
                            }

                            return (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true, amount: 0.2 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-[#151518] p-6 md:p-8 rounded-3xl border border-white/5 text-center group hover:border-white/20 hover:shadow-xl transition-all duration-300"
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform border ${colorClass} shadow-lg ${glowClass}`}>
                                        <Icon size={28} />
                                    </div>
                                    <h3 className="font-bold text-lg mb-2">{ft}</h3>
                                    <p className="text-sm text-gray-400">{getFeatureDescription(ft)}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                </section>

                {/* Section 5: All Featured Rounds */}
                <motion.section
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    className="py-20 md:py-28 px-6 md:px-12"
                >
                    <div className="text-center mb-12">
                        <p className="text-[#E0FE10] text-sm font-bold uppercase tracking-widest mb-3">Featured Rounds</p>
                        <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">See What&apos;s Waiting Inside</h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            {allRounds.length > 0
                                ? 'Join the club to get access to these rounds and more.'
                                : 'Your community, workouts, and progress in one place.'}
                        </p>
                    </div>
                    {allRounds.length > 0 ? (
                        <div className="max-w-2xl mx-auto flex flex-col gap-5">
                            {allRounds.map((round) => (
                                <motion.div
                                    key={round.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="rounded-2xl border border-white/10 bg-[#151518] hover:border-[#E0FE10]/20 transition-colors p-5 md:p-6"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="min-w-0">
                                            <h3 className="text-lg md:text-xl font-bold text-white truncate">{round.title}</h3>
                                            {round.subtitle && <p className="text-gray-400 text-sm mt-0.5 line-clamp-1">{round.subtitle}</p>}
                                        </div>
                                        <span className={`shrink-0 ml-3 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${round.isActive ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'}`}>
                                            {round.isActive ? 'Live' : 'Ended'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E0FE10]/10 text-[#E0FE10] font-semibold text-sm">
                                            <FiActivity className="w-3.5 h-3.5" />
                                            {round.workoutCount} workout{round.workoutCount !== 1 ? 's' : ''}
                                        </span>
                                        {round.participantCount > 0 && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 font-semibold text-sm">
                                                <FiUsers className="w-3.5 h-3.5" />
                                                {round.participantCount} participant{round.participantCount !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <div className="relative max-w-md w-full rounded-3xl overflow-hidden border border-white/10 bg-[#151518] p-8 text-center">
                                <div className="aspect-video rounded-2xl overflow-hidden mb-6 bg-[#0E0E10]">
                                    <img src={heroImage} alt="Club" className="w-full h-full object-cover" />
                                </div>
                                <p className="text-lg text-gray-300">Join to see rounds, workouts, and challenges from the host.</p>
                            </div>
                        </div>
                    )}
                </motion.section>

                {/* Section 6: Community Stats + Urgency */}
                <section ref={statsRef} className="py-20 md:py-28 px-6 md:px-12">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        className="bg-[#151518] border border-white/10 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-[#E0FE10]/10 rounded-full blur-3xl" />
                        <div className="relative">
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-10">
                                Join {memberCount}+ others already training
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                                <div>
                                    <p className="text-4xl md:text-5xl font-black text-[#E0FE10]">{countMembers.toLocaleString()}</p>
                                    <p className="text-gray-400 font-semibold uppercase tracking-wider mt-1">Members</p>
                                </div>
                                <div>
                                    <p className="text-4xl md:text-5xl font-black text-[#E0FE10]">{countWorkouts.toLocaleString()}</p>
                                    <p className="text-gray-400 font-semibold uppercase tracking-wider mt-1">Workouts Completed</p>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <p className="text-4xl md:text-5xl font-black text-[#E0FE10]">24/7</p>
                                    <p className="text-gray-400 font-semibold uppercase tracking-wider mt-1">Community</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </section>

                {/* Section 7: Final CTA Block */}
                <motion.section
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    className="py-20 md:py-28 px-6 md:px-12"
                >
                    <div className="relative rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-10 md:p-16 text-center overflow-hidden">
                        <div className="absolute inset-0 bg-[#E0FE10]/5" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#E0FE10]/10 blur-[120px] pointer-events-none" />
                        <div className="relative">
                            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
                                Ready to Join {title}?
                            </h2>
                            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
                                {description}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                <motion.button
                                    onClick={handleJoin}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full sm:w-auto bg-[#E0FE10] hover:bg-[#c8e60e] text-black font-extrabold px-10 py-4 rounded-xl transition-all shadow-xl shadow-[#E0FE10]/30 flex items-center justify-center gap-2"
                                >
                                    Join Club
                                </motion.button>
                                <button
                                    onClick={handleShare}
                                    className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-2 backdrop-blur-md"
                                >
                                    <FiShare2 /> {copied ? 'Copied!' : 'Share Link'}
                                </button>
                            </div>
                            <p className="text-gray-500 text-sm mt-10">Powered by Pulse</p>
                        </div>
                    </div>
                </motion.section>
            </div>
        </div>
    );
};

export const getServerSideProps: GetServerSideProps<ClubPageProps> = async ({ params, res }) => {
    try {
        const id = params?.id as string;
        if (!id) {
            return { props: { error: 'Club ID is required' } };
        }

        res.setHeader(
            'Cache-Control',
            'public, s-maxage=30, stale-while-revalidate=59'
        );

        const club = await clubService.getClubById(id);

        if (!club) {
            return { props: { error: 'Club not found' } };
        }

        const clubData = {
            id: club.id,
            name: club.name || '',
            description: club.description || '',
            coverImageURL: club.coverImageURL || null,
            creatorId: club.creatorId || '',
            memberCount: club.memberCount || 1,
            landingPageConfig: club.landingPageConfig || null
        };

        let totalWorkoutsCompleted = 0;
        let allRounds: RoundPreview[] = [];

        try {
            totalWorkoutsCompleted = await clubService.getTotalWorkoutsCompletedByMembers(club.id);
        } catch (e) {
            console.error('Error fetching total workouts for club:', e);
        }

        const linkedIds = club.linkedRoundIds || [];
        let featuredIds: string[] = [];
        try {
            if (club.creatorId) {
                const creator = await userService.getUserById(club.creatorId);
                featuredIds = creator?.featuredRoundIds || [];
            }
        } catch (e) {
            console.error('Error fetching creator featured rounds:', e);
        }

        const allRoundIds = [...new Set([...linkedIds, ...featuredIds])];
        if (allRoundIds.length > 0) {
            try {
                const collections = await Promise.all(
                    allRoundIds.map(rid => workoutService.getCollectionById(rid).catch(() => null))
                );
                const valid = collections.filter((c): c is any => c !== null);

                // Fetch real participant counts from user-challenge collection
                // (challenge.participants is never populated from Firestore — participants
                //  are stored as separate docs in user-challenge where challengeId == collection.id)
                const participantCounts = await Promise.all(
                    valid.map(col =>
                        workoutService.fetchUserChallengesByChallengeId(col.id)
                            .then(uc => uc.length)
                            .catch(() => 0)
                    )
                );

                const now = new Date();
                allRounds = valid
                    .map((col, i) => {
                        const challenge = col.challenge;
                        const endDate = challenge?.endDate ? new Date(challenge.endDate) : null;
                        return {
                            id: col.id,
                            title: col.title || challenge?.title || 'Round',
                            subtitle: col.subtitle || challenge?.subtitle || '',
                            workoutCount: col.sweatlistIds?.length ?? 0,
                            participantCount: participantCounts[i],
                            isActive: endDate ? now <= endDate : true
                        };
                    })
                    .sort((a, b) => {
                        const aScore = a.participantCount + a.workoutCount;
                        const bScore = b.participantCount + b.workoutCount;
                        return bScore - aScore;
                    });
            } catch (e) {
                console.error('Error fetching rounds for club:', e);
            }
        }

        return {
            props: {
                clubData,
                creatorData: club.creatorInfo || null,
                totalWorkoutsCompleted,
                allRounds
            }
        };
    } catch (error) {
        console.error('Error fetching club:', error);
        return {
            props: {
                error: 'Failed to load club information'
            }
        };
    }
};

export default ClubPage;
