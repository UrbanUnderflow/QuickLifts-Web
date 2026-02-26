import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
    Bell,
    Smartphone,
    Server,
    Search,
    X,
    ChevronDown,
    ChevronUp,
    Zap,
    Clock,
    MessageCircle,
    Trophy,
    Activity,
    Brain,
    Users,
    Eye,
    Flame,
    Timer,
    Watch,
} from 'lucide-react';

/* ─────────────────────────── Types ───────────────────────────── */

type DeliveryMethod = 'fcm-remote' | 'local' | 'scheduled-function' | 'fcm-or-local';

type NotificationCategory =
    | 'onboarding'
    | 'engagement'
    | 'social'
    | 'round-activity'
    | 'run-round'
    | 'fat-burn-round'
    | 'race'
    | 'chat'
    | 'mental-training'
    | 'watch'
    | 'system';

type NotificationRow = {
    id: string;
    name: string;
    trigger: string;
    title: string;
    body: string;
    category: NotificationCategory;
    deliveryMethod: DeliveryMethod;
    /** Where the sending logic lives */
    source: string;
    /** Extra data keys attached to the payload */
    dataKeys?: string[];
    /** Related admin page link */
    adminLink?: string;
    adminLinkLabel?: string;
    notes?: string;
};

/* ─────────────────────────── Data ────────────────────────────── */

const NOTIFICATIONS: NotificationRow[] = [
    // ── Engagement / Local ──────────────────────────────
    {
        id: 'daily-activity-reminder',
        name: 'Daily Activity Reminder',
        trigger: 'Locally scheduled at the time the user set (default daily)',
        title: 'Your Workout Awaits',
        body: "Hey Pulse Fam! Are you ready to crush your workout today?",
        category: 'engagement',
        deliveryMethod: 'local',
        source: 'iOS — NotificationService.scheduleDailyNotification()',
        notes: 'Uses UNCalendarNotificationTrigger. User can toggle in settings.',
    },
    {
        id: 'weekly-checkin-reminder',
        name: 'Weekly Check-in Reminder',
        trigger: 'Local notification on the user-chosen day at 9 AM',
        title: '📸 Time for Your Check-in!',
        body: "It's {{dayOfWeek}}! Take a moment to log your progress with photos and weight.",
        category: 'engagement',
        deliveryMethod: 'local',
        source: 'iOS — NotificationService.scheduleWeeklyCheckinReminder()',
        dataKeys: ['type: checkin_reminder', 'dayOfWeek'],
    },

    // ── Social ──────────────────────────────────────────
    {
        id: 'checkin-uploaded',
        name: 'Check-in Uploaded (Host)',
        trigger: 'When a participant uploads a weigh-in inside a Round',
        title: 'New Weigh-in',
        body: '{{username}} just uploaded a new weigh-in.',
        category: 'social',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendCheckinUploadedNotification()',
        dataKeys: ['type: checkin_uploaded', 'challengeId', 'userId'],
    },
    {
        id: 'checkin-access-list',
        name: 'Check-in Completed (Access List)',
        trigger: 'When a user completes a check-in and has users in their checkinsAccessList',
        title: 'New Check-in',
        body: '{{displayName}} just completed a new check-in.',
        category: 'social',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.notifyCheckinsAccessListUsers()',
        dataKeys: ['type: checkin_access_notification', 'fromUserId', 'fromUsername'],
    },
    {
        id: 'referral-join-bonus',
        name: 'Referral Join Bonus',
        trigger: 'When a referred user joins a Round via a referral link',
        title: '💰 +25 Pulse Points!',
        body: "Your friend {{referredUserName}} just joined '{{challengeTitle}}' using your link! You earned 25 points.",
        category: 'social',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendReferralJoinNotification()',
        dataKeys: ['type: referral_join_bonus', 'challengeId', 'userId'],
    },

    // ── Round Activity ─────────────────────────────────
    {
        id: 'workout-shared',
        name: 'Workout Shared to Round',
        trigger: 'When another participant completes a workout inside a Round',
        title: '🎉 {{username}} completed a workout!',
        body: '{{username}} just completed a workout in your Round.',
        category: 'round-activity',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — MyWorkoutView / CustomWorkoutsListView (via CloudFunctionsService)',
        dataKeys: ['type: workout_completed', 'challengeId'],
    },

    // ── Run Round ──────────────────────────────────────
    {
        id: 'run-round-started',
        name: 'Run Round — Run Started',
        trigger: 'When a participant starts a run in a Run Round',
        title: 'Run started',
        body: '{{username}} just started a run in {{roundName}}.',
        category: 'run-round',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendRunRoundStartedNotification()',
        dataKeys: ['type: run_round_session_started', 'challengeId', 'roundId', 'roundName', 'fromUsername', 'userId'],
        notes: 'Sent immediately (bypasses notification queue).',
    },
    {
        id: 'run-round-completed',
        name: 'Run Round — Run Completed',
        trigger: 'When a participant finishes a run in a Run Round',
        title: 'Run completed',
        body: '{{username}} just ran {{distanceMiles}} miles in {{roundName}}.',
        category: 'run-round',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendRunRoundCompletedNotification()',
        dataKeys: ['type: run_round_session_completed', 'challengeId', 'roundId', 'roundName', 'fromUsername', 'distanceMiles', 'userId'],
        notes: 'Sent immediately (bypasses notification queue).',
    },

    // ── Fat Burn Round ─────────────────────────────────
    {
        id: 'fat-burn-started',
        name: 'Fat Burn Round — Session Started',
        trigger: 'When a participant starts a cardio session in a Fat Burn Round',
        title: 'Session started',
        body: '{{username}} just started a {{equipment}} session in {{roundName}}.',
        category: 'fat-burn-round',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendFatBurnRoundStartedNotification()',
        dataKeys: ['type: fat_burn_round_started', 'challengeId', 'roundId', 'roundName', 'equipment', 'fromUsername', 'userId'],
        notes: 'Sent immediately (bypasses notification queue).',
    },
    {
        id: 'fat-burn-completed',
        name: 'Fat Burn Round — Session Completed',
        trigger: 'When a participant finishes a cardio session in a Fat Burn Round',
        title: 'Session completed',
        body: '{{username}} just finished a {{equipment}} session ({{duration}} • {{calories}} cal) in {{roundName}}.',
        category: 'fat-burn-round',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendFatBurnRoundCompletedNotification()',
        dataKeys: ['type: fat_burn_round_completed', 'challengeId', 'roundId', 'roundName', 'equipment', 'fromUsername', 'durationSeconds', 'calories', 'distanceMiles', 'userId'],
        notes: 'Sent immediately (bypasses notification queue).',
    },

    // ── Race ───────────────────────────────────────────
    {
        id: 'race-started',
        name: 'Race Started',
        trigger: 'When a 1-day Race Round is started (manual or scheduled)',
        title: 'The race has begun!',
        body: '{{roundName}} has started. Good luck!',
        category: 'race',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendRaceStartedNotification()',
        dataKeys: ['type: raceStarted', 'challengeId', 'roundId', 'roundName'],
        notes: 'Broadcast to all Round participants.',
    },

    // ── Chat ───────────────────────────────────────────
    {
        id: 'round-chat-message',
        name: 'Round Chat Message',
        trigger: 'When someone sends a message in a Round group chat',
        title: '{{senderUsername}} in {{roundName}}',
        body: '{{messageContent}} (or 📷 Sent a photo if empty)',
        category: 'chat',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendRoundChatMessageNotification()',
        dataKeys: ['type: round_chat_message', 'challengeId', 'roundId', 'roundName', 'messageId', 'fromUsername', 'fromUserId'],
        notes: 'Excludes the sender from recipients.',
    },

    // ── Apple Watch ────────────────────────────────────
    {
        id: 'watch-workout-started',
        name: 'Watch Workout Started',
        trigger: 'When an Apple Watch workout starts via WatchConnectivity',
        title: '🏃‍♂️ Workout Started',
        body: 'You started a {{workoutType}} workout on Apple Watch. Keep crushing it!',
        category: 'watch',
        deliveryMethod: 'fcm-or-local',
        source: 'iOS — NotificationService.sendWatchWorkoutStartedNotification()',
        dataKeys: ['type: watch_workout_started', 'workoutType', 'timestamp'],
        notes: 'Falls back to local notification if no FCM token.',
    },
    {
        id: 'watch-workout-completed',
        name: 'Watch Workout Completed',
        trigger: 'When an Apple Watch workout finishes',
        title: '✅ Workout Completed',
        body: 'Great job! Your {{workoutType}} workout ({{duration}}) has been logged successfully. You burned {{calories}} calories!',
        category: 'watch',
        deliveryMethod: 'fcm-or-local',
        source: 'iOS — NotificationService.sendWatchWorkoutCompletedNotification()',
        dataKeys: ['type: watch_workout_completed', 'workoutType', 'duration', 'calories', 'timestamp'],
        notes: 'Falls back to local notification if no FCM token.',
    },

    // ── Mental Training (Scheduled) ────────────────────
    {
        id: 'mental-checkin',
        name: 'Mental Check-in Prompt',
        trigger: "Scheduled function (runs periodically). Sends when it's the user's preferred check-in hour",
        title: '🧠 Quick Mental Check-in',
        body: 'Take a moment to check in with yourself. How are you feeling today?',
        category: 'mental-training',
        deliveryMethod: 'scheduled-function',
        source: 'Netlify — scheduled-mental-checkin.ts',
        dataKeys: ['type: mental_checkin', 'userId'],
        adminLink: '/admin/mental-training',
        adminLinkLabel: 'Mental Training Library',
        notes: 'Respects user opt-out (checkInNotificationsEnabled). Logs to notification-logs collection.',
    },
    {
        id: 'mental-assignment-reminder',
        name: 'Mental Assignment Reminder',
        trigger: "Scheduled function. Fires if the user hasn't completed their daily mental assignment by noon (user local time)",
        title: '🎯 Assignment Reminder',
        body: "You haven't completed today's mental assignment yet. Take a moment to train your mind.",
        category: 'mental-training',
        deliveryMethod: 'scheduled-function',
        source: 'Netlify — scheduled-mental-assignment-reminder.ts',
        dataKeys: ['type: mental_assignment_reminder', 'userId'],
        adminLink: '/admin/mental-training',
        adminLinkLabel: 'Mental Training Library',
        notes: 'Logs to notification-logs collection.',
    },

    // ── Round Daily Summary (Scheduled) ────────────────
    {
        id: 'round-daily-summary',
        name: 'Round Daily Summary',
        trigger: 'Scheduled function (runs daily at 9 PM EST / 2 AM UTC). Sends to all participants of every active Round.',
        title: '📊 {{roundTitle}} — Daily Recap',
        body: '🥇 {{leader}} leads with {{pts}} pts · ⏳ {{daysLeft}} days left · ⚡ {{topScorer}} scored {{pts}} pts today',
        category: 'round-activity',
        deliveryMethod: 'scheduled-function',
        source: 'Netlify — scheduled-round-daily-summary.ts',
        dataKeys: [
            'type: ROUND_DAILY_SUMMARY',
            'challengeId',
            'roundTitle',
            'daysLeft',
            'totalParticipants',
            'recipientRank',
            'isRunRound',
            'top3 (JSON array)',
            'todayTopScorer (JSON)',
            'todayTopRunner (JSON)',
            'timestamp',
        ],
        notes: 'Personalised per recipient (shows their rank). Tapping opens the Round detail and shows a summary modal with top 3 leaderboard, daily highlights, and days remaining. Implemented on both iOS (RoundDailySummaryView) and Android (RoundDailySummaryScreen). Idempotent — skips if already sent today. Logs batch results to notification-logs collection.',
    },
];

/* ─────────────────────────── Helpers ─────────────────────────── */

const CATEGORY_META: Record<
    NotificationCategory,
    { label: string; icon: React.ReactNode; color: string }
> = {
    onboarding: { label: 'Onboarding', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-blue-400' },
    engagement: { label: 'Engagement', icon: <Clock className="w-3.5 h-3.5" />, color: 'text-amber-400' },
    social: { label: 'Social', icon: <Users className="w-3.5 h-3.5" />, color: 'text-pink-400' },
    'round-activity': { label: 'Round Activity', icon: <Activity className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
    'run-round': { label: 'Run Round', icon: <Timer className="w-3.5 h-3.5" />, color: 'text-cyan-400' },
    'fat-burn-round': { label: 'Fat Burn Round', icon: <Flame className="w-3.5 h-3.5" />, color: 'text-orange-400' },
    race: { label: 'Race', icon: <Trophy className="w-3.5 h-3.5" />, color: 'text-yellow-400' },
    chat: { label: 'Chat', icon: <MessageCircle className="w-3.5 h-3.5" />, color: 'text-indigo-400' },
    'mental-training': { label: 'Mental Training', icon: <Brain className="w-3.5 h-3.5" />, color: 'text-violet-400' },
    watch: { label: 'Apple Watch', icon: <Watch className="w-3.5 h-3.5" />, color: 'text-rose-400' },
    system: { label: 'System', icon: <Server className="w-3.5 h-3.5" />, color: 'text-zinc-400' },
};

const DELIVERY_META: Record<DeliveryMethod, { label: string; color: string }> = {
    'fcm-remote': { label: 'FCM Remote Push', color: 'bg-emerald-900/40 text-emerald-300 border-emerald-800' },
    local: { label: 'Local (On-Device)', color: 'bg-amber-900/40 text-amber-300 border-amber-800' },
    'scheduled-function': { label: 'Scheduled Function', color: 'bg-violet-900/40 text-violet-300 border-violet-800' },
    'fcm-or-local': { label: 'FCM → Local Fallback', color: 'bg-cyan-900/40 text-cyan-300 border-cyan-800' },
};

/* ─────────────────────── Component ───────────────────────────── */

const NotificationSequencesAdmin: React.FC = () => {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const categories = useMemo(() => {
        const uniqueCats = Array.from(new Set(NOTIFICATIONS.map((n) => n.category)));
        return uniqueCats.sort();
    }, []);

    const filtered = useMemo(() => {
        let list = NOTIFICATIONS;

        if (categoryFilter !== 'all') {
            list = list.filter((n) => n.category === categoryFilter);
        }

        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (n) =>
                    n.name.toLowerCase().includes(q) ||
                    n.trigger.toLowerCase().includes(q) ||
                    n.title.toLowerCase().includes(q) ||
                    n.body.toLowerCase().includes(q) ||
                    n.source.toLowerCase().includes(q) ||
                    (n.notes || '').toLowerCase().includes(q)
            );
        }

        return list;
    }, [search, categoryFilter]);

    const toggleExpand = (id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    return (
        <AdminRouteGuard>
            <Head>
                <title>Notification Sequences | Pulse Admin</title>
            </Head>

            <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
                <div className="max-w-6xl mx-auto">
                    {/* ── Header ──────────────────────────────────── */}
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Bell className="w-7 h-7 text-[#d7ff00]" />
                                Notification Sequences
                            </h1>
                            <p className="text-zinc-400 mt-1">
                                Every push notification in the app — when it fires, why, and how it's delivered.
                            </p>
                        </div>

                        <a
                            href="/admin/emailSequences"
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
                        >
                            📧 Email Sequences
                        </a>
                    </div>

                    {/* ── Stats strip ────────────────────────────── */}
                    <div className="flex flex-wrap gap-3 mb-6 mt-4">
                        <div className="px-4 py-2 rounded-xl bg-[#1a1e24] border border-zinc-800 text-sm">
                            <span className="text-zinc-400">Total:</span>{' '}
                            <span className="text-white font-semibold">{NOTIFICATIONS.length}</span>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-[#1a1e24] border border-zinc-800 text-sm">
                            <span className="text-zinc-400">FCM Remote:</span>{' '}
                            <span className="text-emerald-400 font-semibold">
                                {NOTIFICATIONS.filter((n) => n.deliveryMethod === 'fcm-remote').length}
                            </span>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-[#1a1e24] border border-zinc-800 text-sm">
                            <span className="text-zinc-400">Local:</span>{' '}
                            <span className="text-amber-400 font-semibold">
                                {NOTIFICATIONS.filter((n) => n.deliveryMethod === 'local').length}
                            </span>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-[#1a1e24] border border-zinc-800 text-sm">
                            <span className="text-zinc-400">Scheduled:</span>{' '}
                            <span className="text-violet-400 font-semibold">
                                {NOTIFICATIONS.filter((n) => n.deliveryMethod === 'scheduled-function').length}
                            </span>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-[#1a1e24] border border-zinc-800 text-sm">
                            <span className="text-zinc-400">FCM→Local:</span>{' '}
                            <span className="text-cyan-400 font-semibold">
                                {NOTIFICATIONS.filter((n) => n.deliveryMethod === 'fcm-or-local').length}
                            </span>
                        </div>
                    </div>

                    {/* ── Search + Filter ────────────────────────── */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search notifications…"
                                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-zinc-700 bg-[#1a1e24] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40 transition-all"
                            />
                            {search.trim().length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setCategoryFilter('all')}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${categoryFilter === 'all'
                                    ? 'bg-[#d7ff00] text-black'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                    }`}
                            >
                                All
                            </button>
                            {categories.map((cat) => {
                                const meta = CATEGORY_META[cat];
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setCategoryFilter(cat)}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${categoryFilter === cat
                                            ? 'bg-[#d7ff00] text-black'
                                            : `bg-zinc-800 ${meta.color} hover:bg-zinc-700`
                                            }`}
                                    >
                                        {meta.icon}
                                        {meta.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Results count ──────────────────────────── */}
                    <div className="text-sm text-zinc-400 mb-4">
                        Showing <span className="text-white font-medium">{filtered.length}</span> of{' '}
                        <span className="text-white font-medium">{NOTIFICATIONS.length}</span> notification
                        {NOTIFICATIONS.length === 1 ? '' : 's'}
                    </div>

                    {/* ── Notification Cards ─────────────────────── */}
                    <div className="space-y-3">
                        {filtered.map((n) => {
                            const catMeta = CATEGORY_META[n.category];
                            const delMeta = DELIVERY_META[n.deliveryMethod];
                            const isExpanded = expandedId === n.id;

                            return (
                                <div
                                    key={n.id}
                                    className="bg-[#1a1e24] rounded-xl border border-zinc-800 overflow-hidden hover:border-zinc-700 transition-colors"
                                >
                                    {/* Row summary */}
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(n.id)}
                                        className="w-full text-left px-5 py-4 flex items-start sm:items-center gap-4 group"
                                    >
                                        {/* Icon */}
                                        <div
                                            className={`flex-shrink-0 w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center ${catMeta.color}`}
                                        >
                                            {catMeta.icon}
                                        </div>

                                        {/* Main info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-white text-sm">{n.name}</span>
                                                <span
                                                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${delMeta.color}`}
                                                >
                                                    {n.deliveryMethod === 'fcm-remote' || n.deliveryMethod === 'fcm-or-local' ? (
                                                        <Smartphone className="w-3 h-3" />
                                                    ) : n.deliveryMethod === 'scheduled-function' ? (
                                                        <Server className="w-3 h-3" />
                                                    ) : (
                                                        <Bell className="w-3 h-3" />
                                                    )}
                                                    {delMeta.label}
                                                </span>
                                            </div>
                                            <p className="text-zinc-400 text-xs mt-1 line-clamp-1">{n.trigger}</p>
                                        </div>

                                        {/* Category badge */}
                                        <span
                                            className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-medium ${catMeta.color} bg-zinc-900 px-2.5 py-1 rounded-full`}
                                        >
                                            {catMeta.icon}
                                            {catMeta.label}
                                        </span>

                                        {/* Chevron */}
                                        <div className="flex-shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </div>
                                    </button>

                                    {/* Expanded detail */}
                                    {isExpanded && (
                                        <div className="border-t border-zinc-800 px-5 py-4 space-y-4 animate-in slide-in-from-top-1 duration-200">
                                            {/* Title + Body preview */}
                                            <div className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-800">
                                                <div className="flex items-center gap-2 mb-2 text-xs text-zinc-500 uppercase tracking-wider font-medium">
                                                    <Smartphone className="w-3.5 h-3.5" />
                                                    Notification Preview
                                                </div>
                                                <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="w-5 h-5 rounded bg-[#d7ff00] flex items-center justify-center">
                                                            <span className="text-[8px] font-bold text-black">P</span>
                                                        </div>
                                                        <span className="text-xs text-zinc-500 font-medium">Pulse</span>
                                                        <span className="text-xs text-zinc-600 ml-auto">now</span>
                                                    </div>
                                                    <p className="text-white text-sm font-semibold">{n.title}</p>
                                                    <p className="text-zinc-400 text-sm mt-0.5">{n.body}</p>
                                                </div>
                                            </div>

                                            {/* Meta grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Trigger</span>
                                                    <p className="text-sm text-zinc-200 mt-1">{n.trigger}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Source</span>
                                                    <p className="text-sm text-zinc-200 mt-1 font-mono text-xs">{n.source}</p>
                                                </div>
                                            </div>

                                            {/* Data keys */}
                                            {n.dataKeys && n.dataKeys.length > 0 && (
                                                <div>
                                                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider block mb-2">
                                                        Payload Data Keys
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {n.dataKeys.map((key) => (
                                                            <span
                                                                key={key}
                                                                className="text-[11px] font-mono px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300"
                                                            >
                                                                {key}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Notes */}
                                            {n.notes && (
                                                <div className="text-xs text-zinc-500 bg-zinc-900/40 rounded-lg p-3 border border-zinc-800">
                                                    💡 {n.notes}
                                                </div>
                                            )}

                                            {/* Admin link */}
                                            {n.adminLink && (
                                                <a
                                                    href={n.adminLink}
                                                    className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    {n.adminLinkLabel || 'Open in admin'}
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {filtered.length === 0 && (
                        <div className="mt-12 text-center text-zinc-500">
                            <Bell className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
                            <p className="text-lg font-medium text-zinc-400">No matching notifications</p>
                            <p className="text-sm mt-1">Try adjusting your search or filter.</p>
                        </div>
                    )}

                    {/* ── Legend ──────────────────────────────────── */}
                    <div className="mt-12 bg-[#1a1e24] rounded-xl border border-zinc-800 p-5">
                        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Delivery Method Legend</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {(Object.entries(DELIVERY_META) as [DeliveryMethod, typeof DELIVERY_META[DeliveryMethod]][]).map(
                                ([key, meta]) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <span
                                            className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full border ${meta.color}`}
                                        >
                                            {key === 'fcm-remote' || key === 'fcm-or-local' ? (
                                                <Smartphone className="w-3 h-3" />
                                            ) : key === 'scheduled-function' ? (
                                                <Server className="w-3 h-3" />
                                            ) : (
                                                <Bell className="w-3 h-3" />
                                            )}
                                            {meta.label}
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                            {key === 'fcm-remote'
                                                ? 'Sent via Firebase Cloud Messaging'
                                                : key === 'local'
                                                    ? 'Scheduled on-device'
                                                    : key === 'scheduled-function'
                                                        ? 'Netlify/Firebase scheduled fn'
                                                        : 'FCM first, local fallback'}
                                        </span>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminRouteGuard>
    );
};

export default NotificationSequencesAdmin;
