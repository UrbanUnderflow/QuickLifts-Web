import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import { FiActivity, FiArrowLeft, FiTarget, FiTrendingUp, FiUsers, FiX } from 'react-icons/fi';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useUser, useUserLoading } from '../hooks/useUser';
import { clubService } from '../api/firebase/club/service';
import { Club, ClubMember } from '../api/firebase/club/types';
import { getClubMemberOriginDisplayLabel, parseClubMemberOrigin } from '../api/firebase/club/origin';
import PageHead from '../components/PageHead';
import { db } from '../api/firebase/config';
import { WorkoutSummary } from '../api/firebase/workout/types';
import { dateToUnixTimestamp } from '../utils/formatDate';

interface MemberOriginOption {
    key: string;
    label: string;
    count: number;
}

const originColors: Record<string, string> = {
    creator: '#14B8A6',
    round: '#A855F7',
    manual: '#F59E0B',
    backfill: '#71717A',
    unknown: '#71717A',
    'event-checkin': '#22D3EE'
};

const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatJoinDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const generateDateRange = (days: number) => {
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - i);
        dates.push(currentDate);
    }
    return dates;
};

export default function ClubAnalytics() {
    const router = useRouter();
    const currentUser = useUser();
    const authLoading = useUserLoading();

    const [club, setClub] = useState<Club | null>(null);
    const [members, setMembers] = useState<ClubMember[]>([]);
    const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAllMembers, setShowAllMembers] = useState(false);
    const [originFilter, setOriginFilter] = useState('all');
    const [roundNameCache, setRoundNameCache] = useState<Record<string, string>>({});

    useEffect(() => {
        if (authLoading) return;

        if (!currentUser) {
            router.push('/login');
            return;
        }

        const fetchAnalyticsData = async () => {
            try {
                const fetchedClub = await clubService.getClubByCreatorId(currentUser.id);
                if (!fetchedClub) {
                    return;
                }

                setClub(fetchedClub);

                const fetchedMembers = await clubService.getClubMembers(fetchedClub.id);
                setMembers(fetchedMembers);

                const sevenDaysAgoDate = new Date();
                sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);

                const workoutPromises = fetchedMembers.map(async (member) => {
                    const summariesRef = collection(db, 'users', member.userId, 'workoutSummary');
                    const workoutQuery = query(
                        summariesRef,
                        where('createdAt', '>=', dateToUnixTimestamp(sevenDaysAgoDate)),
                        where('isCompleted', '==', true)
                    );

                    try {
                        const snapshot = await getDocs(workoutQuery);
                        return snapshot.docs.map((summaryDoc) => new WorkoutSummary(summaryDoc.data()));
                    } catch (error) {
                        console.error(`Error fetching workouts for ${member.userId}:`, error);
                        return [];
                    }
                });

                const allRecentWorkouts = (await Promise.all(workoutPromises)).flat();
                setRecentWorkouts(allRecentWorkouts);
            } catch (error) {
                console.error('Failed to load analytics data:', error);
            } finally {
                setLoading(false);
            }
        };

        void fetchAnalyticsData();
    }, [authLoading, currentUser, router]);

    useEffect(() => {
        const missingRoundIds = Array.from(new Set(
            members
                .map((member) => parseClubMemberOrigin(member.joinedVia).roundId)
                .filter((roundId): roundId is string => typeof roundId === 'string')
                .filter((roundId) => !roundNameCache[roundId])
        ));

        if (missingRoundIds.length === 0) {
            return;
        }

        let cancelled = false;

        const fetchRoundNames = async () => {
            const updates: Record<string, string> = {};

            await Promise.all(
                missingRoundIds.map(async (roundId) => {
                    try {
                        const roundSnapshot = await getDoc(doc(db, 'rounds', roundId));
                        if (roundSnapshot.exists()) {
                            const roundData = roundSnapshot.data();
                            updates[roundId] = roundData.name || roundData.title || roundId;
                        } else {
                            updates[roundId] = roundId;
                        }
                    } catch {
                        updates[roundId] = roundId;
                    }
                })
            );

            if (!cancelled) {
                setRoundNameCache((previousCache) => ({ ...previousCache, ...updates }));
            }
        };

        void fetchRoundNames();

        return () => {
            cancelled = true;
        };
    }, [members, roundNameCache]);

    const sortedMembers = useMemo(() => {
        return members.slice().sort((left, right) => right.joinedAt.getTime() - left.joinedAt.getTime());
    }, [members]);

    const growthChartData = useMemo(() => {
        if (members.length === 0) return [];

        const last30Days = generateDateRange(30);
        let cumulativeCount = 0;

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoMs = thirtyDaysAgo.getTime();

        cumulativeCount += members.filter((member) => member.joinedAt.getTime() < thirtyDaysAgoMs).length;

        return last30Days.map((date) => {
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);

            const startMs = date.getTime();
            const endMs = nextDay.getTime();
            const joinedToday = members.filter((member) => {
                const joinedAtMs = member.joinedAt.getTime();
                return joinedAtMs >= startMs && joinedAtMs < endMs;
            }).length;

            cumulativeCount += joinedToday;

            return {
                name: formatDate(date),
                Members: cumulativeCount,
                New: joinedToday
            };
        });
    }, [members]);

    const engagementData = useMemo(() => {
        const last7Days = generateDateRange(7);

        return last7Days.map((date) => {
            const dateStr = formatDate(date);
            const startMs = date.getTime();
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);
            const endMs = nextDay.getTime();

            const workoutsCount = recentWorkouts.filter((workout) => {
                const createdAtMs = workout.createdAt.getTime();
                return createdAtMs >= startMs && createdAtMs < endMs;
            }).length;

            return {
                name: dateStr,
                Workouts: workoutsCount
            };
        });
    }, [recentWorkouts]);

    const memberOriginOptions = useMemo<MemberOriginOption[]>(() => {
        const groupedOrigins = new Map<string, MemberOriginOption>();

        for (const member of sortedMembers) {
            const parsedOrigin = parseClubMemberOrigin(member.joinedVia);
            const label = getClubMemberOriginDisplayLabel(parsedOrigin, roundNameCache);
            const existingOrigin = groupedOrigins.get(parsedOrigin.key);

            if (existingOrigin) {
                existingOrigin.count += 1;
                continue;
            }

            groupedOrigins.set(parsedOrigin.key, {
                key: parsedOrigin.key,
                label,
                count: 1
            });
        }

        return [
            {
                key: 'all',
                label: 'All Origins',
                count: sortedMembers.length
            },
            ...Array.from(groupedOrigins.values()).sort((left, right) => {
                if (right.count !== left.count) {
                    return right.count - left.count;
                }

                return left.label.localeCompare(right.label);
            })
        ];
    }, [roundNameCache, sortedMembers]);

    const filteredMembers = useMemo(() => {
        if (originFilter === 'all') {
            return sortedMembers;
        }

        return sortedMembers.filter((member) => parseClubMemberOrigin(member.joinedVia).key === originFilter);
    }, [originFilter, sortedMembers]);

    useEffect(() => {
        if (originFilter === 'all') {
            return;
        }

        const selectedOriginExists = memberOriginOptions.some((option) => option.key === originFilter);
        if (!selectedOriginExists) {
            setOriginFilter('all');
        }
    }, [memberOriginOptions, originFilter]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-[#0E0E10] flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <p className="text-white">Compiling analytics...</p>
            </div>
        );
    }

    if (!club) {
        return (
            <div className="min-h-screen bg-[#0E0E10] flex flex-col items-center justify-center text-white px-6">
                <h2 className="text-2xl font-bold mb-4">No Club Found</h2>
                <p className="text-gray-400 mb-8">You need to set up a club first to view analytics.</p>
                <button
                    onClick={() => router.push('/club-studio')}
                    className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl font-bold transition-all"
                >
                    Go to Club Studio
                </button>
            </div>
        );
    }

    const newMembersThisWeek = members.filter((member) => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return member.joinedAt.getTime() > oneWeekAgo.getTime();
    }).length;

    return (
        <div className="min-h-screen bg-[#0E0E10] text-white font-sans overflow-hidden">
            <PageHead
                pageOgUrl="https://fitwithpulse.ai/club-analytics"
                metaData={{
                    pageId: 'club-analytics',
                    pageTitle: 'Club Analytics | Pulse',
                    metaDescription: 'View real-time analytics for your Pulse Club.',
                    ogTitle: 'Club Analytics | Pulse',
                    ogDescription: 'Real-time metrics and growth for your fitness community.',
                    lastUpdated: new Date().toISOString()
                }}
            />

            <div className="max-w-7xl mx-auto px-6 py-12 md:py-20 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <button
                            onClick={() => router.push('/club-studio')}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 w-fit"
                        >
                            <FiArrowLeft /> Back to Club Studio
                        </button>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-lg">Community Analytics</h1>
                        <p className="text-gray-400 mt-2 text-lg">Bird&apos;s eye view of engagement and growth.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#151518] border border-white/5 p-6 rounded-3xl relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <FiUsers className="w-24 h-24 text-teal-400 transform rotate-12 -mr-6 -mt-6 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4 relative z-10">
                            <FiUsers size={20} />
                        </div>
                        <p className="text-gray-400 text-sm font-medium relative z-10 mb-1">Total Members</p>
                        <h3 className="text-4xl font-black relative z-10">{club.memberCount}</h3>
                        <div className="mt-4 flex items-center gap-2 text-sm text-teal-400 relative z-10">
                            <FiTrendingUp />
                            <span>+{newMembersThisWeek} this week</span>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-[#151518] border border-white/5 p-6 rounded-3xl relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <FiActivity className="w-24 h-24 text-purple-400 transform rotate-12 -mr-6 -mt-6 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 relative z-10">
                            <FiActivity size={20} />
                        </div>
                        <p className="text-gray-400 text-sm font-medium relative z-10 mb-1">Active Rounds</p>
                        <h3 className="text-4xl font-black relative z-10">{currentUser?.featuredRoundIds?.length || 0}</h3>
                        <div className="mt-4 flex items-center gap-2 text-sm text-purple-400 relative z-10">
                            <span>Currently featured</span>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-[#151518] border border-white/5 p-6 rounded-3xl relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <FiTarget className="w-24 h-24 text-emerald-400 transform rotate-12 -mr-6 -mt-6 group-hover:scale-110 transition-transform" />
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 relative z-10">
                            <FiTarget size={20} />
                        </div>
                        <p className="text-gray-400 text-sm font-medium relative z-10 mb-1">7-Day Completed Workouts</p>
                        <h3 className="text-4xl font-black relative z-10">{recentWorkouts.length}</h3>
                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 relative z-10">
                            <span>Total by all members combined</span>
                        </div>
                    </motion.div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6 mb-12">
                    <div className="lg:col-span-2 bg-[#151518] border border-white/5 p-6 md:p-8 rounded-3xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold">Member Growth (Last 30 Days)</h3>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={growthChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorMembers" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="#52525B" tick={{ fill: '#A1A1AA', fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#52525B" tick={{ fill: '#A1A1AA', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181B', borderColor: '#3F3F46', color: '#fff', borderRadius: '12px' }}
                                        itemStyle={{ color: '#14B8A6' }}
                                    />
                                    <Area type="monotone" dataKey="Members" stroke="#14B8A6" strokeWidth={3} fillOpacity={1} fill="url(#colorMembers)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-[#151518] border border-white/5 p-6 md:p-8 rounded-3xl">
                        <div className="mb-8">
                            <h3 className="text-xl font-bold mb-1">Engagement</h3>
                            <p className="text-sm text-gray-500">Activity past 7 days</p>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={engagementData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                                    <XAxis dataKey="name" stroke="#52525B" tick={{ fill: '#A1A1AA', fontSize: 10 }} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#52525B" tick={{ fill: '#A1A1AA', fontSize: 10 }} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        cursor={{ fill: '#27272A' }}
                                        contentStyle={{ backgroundColor: '#18181B', borderColor: '#3F3F46', color: '#fff', borderRadius: '12px' }}
                                    />
                                    <Bar dataKey="Workouts" fill="#A855F7" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="bg-[#151518] border border-white/5 p-8 rounded-3xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h3 className="text-xl font-bold">Recent Members</h3>
                            <p className="text-sm text-gray-500 mt-1">See who joined most recently and where they came from.</p>
                        </div>
                        <button
                            onClick={() => setShowAllMembers(true)}
                            disabled={members.length === 0}
                            className="text-purple-400 text-sm font-semibold hover:text-purple-300 transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
                        >
                            View All
                        </button>
                    </div>

                    {members.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-gray-500">No members to show yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sortedMembers.slice(0, 5).map((member, index) => {
                                const parsedOrigin = parseClubMemberOrigin(member.joinedVia);
                                const originLabel = getClubMemberOriginDisplayLabel(parsedOrigin, roundNameCache, {
                                    includeRoundPrefix: false
                                });
                                const originColor = originColors[parsedOrigin.category] || originColors.unknown;
                                const displayName = member.userInfo?.displayName || member.userInfo?.username || 'Member';
                                const username = member.userInfo?.username ? `@${member.userInfo.username}` : 'No username';

                                return (
                                    <div
                                        key={member.id || index}
                                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-2xl bg-[#0E0E10] border border-white/5 hover:border-white/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <img
                                                src={member.userInfo?.profileImage?.profileImageURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
                                                alt={displayName}
                                                className="w-12 h-12 rounded-full object-cover bg-zinc-800 border border-white/10"
                                            />
                                            <div className="min-w-0">
                                                <p className="font-bold text-white truncate">{displayName}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <p className="text-sm text-gray-400 truncate">{username}</p>
                                                    <span
                                                        className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                                                        style={{
                                                            borderColor: `${originColor}40`,
                                                            color: originColor,
                                                            backgroundColor: `${originColor}14`
                                                        }}
                                                    >
                                                        {originLabel}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-medium text-white">{formatJoinDate(member.joinedAt)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {showAllMembers ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 md:p-8"
                        onClick={() => setShowAllMembers(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 24, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#151518] shadow-2xl shadow-black/40"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-5 md:px-8">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight">All Members</h2>
                                    <p className="mt-1 text-sm text-gray-400">
                                        Filter the full member list by where each person joined from.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowAllMembers(false)}
                                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition-colors hover:text-white hover:border-white/20"
                                    aria-label="Close all members modal"
                                >
                                    <FiX size={18} />
                                </button>
                            </div>

                            <div className="border-b border-white/5 px-6 py-5 md:px-8">
                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-end">
                                    <div className="flex flex-wrap gap-2">
                                        {memberOriginOptions.map((option) => {
                                            const isActive = option.key === originFilter;

                                            return (
                                                <button
                                                    key={option.key}
                                                    onClick={() => setOriginFilter(option.key)}
                                                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${isActive
                                                            ? 'border-purple-400/60 bg-purple-500/15 text-purple-200'
                                                            : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white'
                                                        }`}
                                                >
                                                    {option.label} ({option.count})
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <label className="block">
                                        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                                            Origin Filter
                                        </span>
                                        <select
                                            value={originFilter}
                                            onChange={(event) => setOriginFilter(event.target.value)}
                                            className="w-full rounded-2xl border border-white/10 bg-[#0E0E10] px-4 py-3 text-white outline-none transition-colors focus:border-purple-400/60"
                                        >
                                            {memberOriginOptions.map((option) => (
                                                <option key={option.key} value={option.key}>
                                                    {option.label} ({option.count})
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
                                {filteredMembers.length === 0 ? (
                                    <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-white/10 bg-black/20 px-6 text-center">
                                        <p className="text-gray-400">No members match that origin yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredMembers.map((member) => {
                                            const parsedOrigin = parseClubMemberOrigin(member.joinedVia);
                                            const originLabel = getClubMemberOriginDisplayLabel(parsedOrigin, roundNameCache);
                                            const originColor = originColors[parsedOrigin.category] || originColors.unknown;
                                            const displayName = member.userInfo?.displayName || member.userInfo?.username || 'Member';
                                            const username = member.userInfo?.username ? `@${member.userInfo.username}` : 'No username';

                                            return (
                                                <div
                                                    key={member.id}
                                                    className="flex flex-col gap-4 rounded-3xl border border-white/6 bg-[#0E0E10] p-4 md:flex-row md:items-center md:justify-between"
                                                >
                                                    <div className="flex min-w-0 items-center gap-4">
                                                        <img
                                                            src={member.userInfo?.profileImage?.profileImageURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
                                                            alt={displayName}
                                                            className="h-12 w-12 rounded-full object-cover border border-white/10 bg-zinc-800"
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="truncate text-base font-bold text-white">{displayName}</p>
                                                            <p className="truncate text-sm text-gray-400">{username}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col items-start gap-2 md:items-end">
                                                        <span
                                                            className="rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]"
                                                            style={{
                                                                borderColor: `${originColor}40`,
                                                                color: originColor,
                                                                backgroundColor: `${originColor}14`
                                                            }}
                                                        >
                                                            {originLabel}
                                                        </span>
                                                        <span className="text-sm text-gray-400">{formatJoinDate(member.joinedAt)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
