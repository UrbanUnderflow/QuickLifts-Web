import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiUsers, FiActivity, FiTrendingUp, FiTarget, FiDollarSign } from 'react-icons/fi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useUser, useUserLoading } from '../hooks/useUser';
import { clubService } from '../api/firebase/club/service';
import { Club, ClubMember } from '../api/firebase/club/types';
import PageHead from '../components/PageHead';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../api/firebase/config';
import { WorkoutSummary } from '../api/firebase/workout/types';
import { dateToUnixTimestamp } from '../utils/formatDate';

// Utility for formatting dates
const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Generates an array of dates for the last N days
const generateDateRange = (days: number) => {
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d);
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

    useEffect(() => {
        if (authLoading) return;

        if (!currentUser) {
            router.push('/login');
            return;
        }

        const fetchAnalyticsData = async () => {
            try {
                // Fetch creator's club
                const fetchedClub = await clubService.getClubByCreatorId(currentUser.id);
                if (fetchedClub) {
                    setClub(fetchedClub);
                    // Fetch all members to process real data
                    const fetchedMembers = await clubService.getClubMembers(fetchedClub.id);
                    setMembers(fetchedMembers);

                    // Fetch actual workout summaries for the last 7 days
                    const sevenDaysAgoDate = new Date();
                    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);

                    const workoutsPromises = fetchedMembers.map(async (member) => {
                        const summariesRef = collection(db, 'users', member.userId, 'workoutSummary');

                        // We fetch recent workouts by filtering those completed in the past 7 days
                        const q = query(
                            summariesRef,
                            where('createdAt', '>=', dateToUnixTimestamp(sevenDaysAgoDate)),
                            where('isCompleted', '==', true)
                        );
                        try {
                            const snapshot = await getDocs(q);
                            return snapshot.docs.map(doc => new WorkoutSummary(doc.data()));
                        } catch (err) {
                            console.error(`Error fetching workouts for ${member.userId}:`, err);
                            return [];
                        }
                    });

                    const allSummariesArrays = await Promise.all(workoutsPromises);
                    const allRecentWorkouts = allSummariesArrays.flat();
                    setRecentWorkouts(allRecentWorkouts);
                }
            } catch (error) {
                console.error("Failed to load analytics data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalyticsData();
    }, [currentUser, authLoading, router]);

    // Process real member data to create growth chart
    const growthChartData = useMemo(() => {
        if (members.length === 0) return [];

        const last30Days = generateDateRange(30);
        let cumulativeCount = 0;

        // Count pre-existing members (joined before the 30-day window)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoMs = thirtyDaysAgo.getTime();

        cumulativeCount += members.filter(m => m.joinedAt.getTime() < thirtyDaysAgoMs).length;

        return last30Days.map(date => {
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);

            const startMs = date.getTime();
            const endMs = nextDay.getTime();

            // Add members who joined on this day
            const joinedToday = members.filter(m => m.joinedAt.getTime() >= startMs && m.joinedAt.getTime() < endMs).length;
            cumulativeCount += joinedToday;

            return {
                name: formatDate(date),
                Members: cumulativeCount,
                New: joinedToday
            };
        });
    }, [members]);

    // Process real data for Engagement
    const engagementData = useMemo(() => {
        const last7Days = generateDateRange(7);
        return last7Days.map(date => {
            const dateStr = formatDate(date);
            const startMs = date.getTime();
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);
            const endMs = nextDay.getTime();

            // Count workouts within this day
            const workoutsCount = recentWorkouts.filter(w => {
                return w.createdAt.getTime() >= startMs && w.createdAt.getTime() < endMs;
            }).length;

            return {
                name: dateStr,
                Workouts: workoutsCount
            };
        });
    }, [recentWorkouts]);

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

    // Calculations
    const newMembersThisWeek = members.filter(m => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return m.joinedAt.getTime() > oneWeekAgo.getTime();
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
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <button
                            onClick={() => router.push('/club-studio')}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 w-fit"
                        >
                            <FiArrowLeft /> Back to Club Studio
                        </button>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-lg">Community Analytics</h1>
                        <p className="text-gray-400 mt-2 text-lg">Bird's eye view of engagement and growth.</p>
                    </div>
                </div>

                {/* Top KPI Cards */}
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
                        <h3 className="text-4xl font-black relative z-10">
                            {recentWorkouts.length}
                        </h3>
                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 relative z-10">
                            <span>Total by all members combined</span>
                        </div>
                    </motion.div>
                </div>

                {/* Charts Area */}
                <div className="grid lg:grid-cols-3 gap-6 mb-12">
                    {/* Main Growth Chart */}
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

                    {/* Engagement Bar Chart */}
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

                {/* Bottom List - Recent Activity */}
                <div className="bg-[#151518] border border-white/5 p-8 rounded-3xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">Recent Members</h3>
                        <button className="text-purple-400 text-sm font-semibold hover:text-purple-300 transition-colors">View All</button>
                    </div>

                    {members.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-gray-500">No members to show yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {members.slice().sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime()).slice(0, 5).map((member, idx) => (
                                <div key={member.id || idx} className="flex items-center justify-between p-4 rounded-2xl bg-[#0E0E10] border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <img
                                            src={member.userInfo?.profileImage?.profileImageURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.userInfo?.displayName || 'User')}&background=random`}
                                            alt={member.userInfo?.displayName}
                                            className="w-12 h-12 rounded-full object-cover bg-zinc-800 border border-white/10"
                                        />
                                        <div>
                                            <p className="font-bold text-white">{member.userInfo?.displayName}</p>
                                            <p className="text-sm text-gray-400">@{member.userInfo?.username}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-white">
                                            {member.joinedAt.toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
