import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
    Bell,
    Smartphone,
    Server,
    Search,
    X,
    Send,
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
    Home,
    Footprints,
    Loader,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';

/* ─────────────────────────── Types ───────────────────────────── */

type DeliveryMethod = 'fcm-remote' | 'local' | 'scheduled-function' | 'fcm-or-local';
type ProductScope = 'pulse' | 'pulsecheck';

type NotificationCategory =
    | 'onboarding'
    | 'engagement'
    | 'social'
    | 'round-activity'
    | 'run-round'
    | 'fat-burn-round'
    | 'race'
    | 'chat'
    | 'club'
    | 'step-challenge'
    | 'mental-training'
    | 'watch'
    | 'system';

type NotificationRow = {
    id: string;
    name: string;
    trigger: string;
    title: string;
    subtitle?: string;
    body: string;
    category: NotificationCategory;
    productScope?: ProductScope;
    deliveryMethod: DeliveryMethod;
    /** Where the sending logic lives */
    source: string;
    /** Extra data keys attached to the payload */
    dataKeys?: string[];
    /** Related admin page link */
    adminLink?: string;
    adminLinkLabel?: string;
    opensInto?: string;
    tokenField?: string;
    notes?: string;
};

type TestTargetUser = {
    id: string;
    username: string;
    displayName: string;
    email: string;
    hasFcmToken: boolean;
    hasPulseFcmToken: boolean;
    hasPulseCheckFcmToken: boolean;
    profileImageUrl?: string;
};

type TestStatus =
    | { kind: 'success'; message: string }
    | { kind: 'error'; message: string }
    | null;

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
    {
        id: 'streak-3-days',
        name: '3 Day Streak',
        trigger: 'When a user reaches a 3-day activity streak',
        title: 'Streak Alert 🔥',
        body: "You've started a Streak! Stay consistent by logging an activity once a week to keep it alive.",
        category: 'engagement',
        deliveryMethod: 'fcm-remote',
        source: 'Backend / Firestore trigger',
        dataKeys: ['type: streak_alert', 'userId'],
        notes: 'Sent when the user successfully starts a 3-day streak.',
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
    {
        id: 'race-ended',
        name: 'Race Ended',
        trigger: 'When all runners finish OR the host manually ends the race',
        title: '🏁 Race Over!',
        body: '{{roundName}} has ended. {{winnerUsername}} takes the win! Tap to see full results.',
        category: 'race',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendRaceEndedNotification()',
        dataKeys: ['type: raceEnded', 'challengeId', 'roundId', 'roundName', 'endedBy', 'winnerUsername'],
        notes: 'Deep links to race results page. endedBy: "auto" (last runner) or "host" (manual).',
    },

    // ── Club ───────────────────────────────────────────
    {
        id: 'new-challenge-in-club',
        name: 'New Challenge in Club',
        trigger: 'When a club host links a new challenge/round to their club',
        title: '🆕 New Challenge in {{clubName}}',
        body: '"{{challengeTitle}}" has been added. Tap to check it out!',
        category: 'club',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendNewChallengeInClubNotification()',
        dataKeys: ['type: new_challenge_in_club', 'challengeId', 'clubId', 'clubName', 'challengeTitle'],
        notes: 'Excludes the host who created the challenge.',
    },

    // ── Challenge Lifecycle ───────────────────────────
    {
        id: 'challenge-ending-soon',
        name: 'Challenge Ending Soon',
        trigger: 'When a challenge/round has 24 hours or less remaining',
        title: '⏰ Challenge Ending Soon!',
        body: '"{{challengeTitle}}" ends in less than 24 hours. Make your final push!',
        category: 'round-activity',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendChallengeEndingSoonNotification() / Scheduled function',
        dataKeys: ['type: challenge_ending_soon', 'challengeId', 'challengeTitle', 'hoursRemaining'],
        notes: 'Best triggered from a scheduled cloud function that checks active challenges daily.',
    },
    {
        id: 'challenge-ended',
        name: 'Challenge Ended',
        trigger: 'When a challenge/round reaches its end date',
        title: '🎉 Challenge Complete!',
        body: '"{{challengeTitle}}" has ended. {{winnerUsername}} wins! Tap to see the final standings.',
        category: 'round-activity',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendChallengeEndedNotification() / Scheduled function',
        dataKeys: ['type: challenge_ended', 'challengeId', 'challengeTitle', 'winnerUsername'],
        notes: 'Deep links to challenge detail with final leaderboard.',
    },

    // ── Leaderboard ───────────────────────────────────
    {
        id: 'leaderboard-passed',
        name: 'Leaderboard — Passed',
        trigger: 'When another participant passes you on the leaderboard',
        title: "📉 You've been passed!",
        body: '{{passerUsername}} just passed you in "{{challengeTitle}}". You\'re now {{newRank}}{{ordinal}}. Time to fight back!',
        category: 'round-activity',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendLeaderboardPassedNotification()',
        dataKeys: ['type: leaderboard_passed', 'challengeId', 'challengeTitle', 'passerUsername', 'newRank', 'metricLabel', 'userId'],
        notes: 'Sent when leaderboard recalculates and detects a rank change.',
    },

    // ── Step Milestones ───────────────────────────────
    {
        id: 'step-milestone',
        name: 'Step Milestone',
        trigger: 'When a user hits 5K, 10K, 15K, or 20K steps in a day',
        title: '👟 {{milestone}} Steps Today!',
        body: "Amazing! You've hit {{milestone}} steps. Keep the momentum going!",
        category: 'step-challenge',
        deliveryMethod: 'fcm-remote',
        source: 'iOS — NotificationService.sendStepMilestoneNotification()',
        dataKeys: ['type: step_milestone', 'steps', 'milestone', 'userId', 'challengeId?', 'challengeTitle?'],
        notes: 'Context-aware: if user is in a Step Challenge, title and body reference the challenge name. Otherwise standalone milestone.',
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
        notes: 'Excludes the sender from recipients. Works for ALL challenge/round types.',
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

    // ── PulseCheck ────────────────────────────────────
    {
        id: 'pulsecheck-daily-reflection-local',
        name: 'PulseCheck — Daily Reflection Reminder',
        trigger: 'Locally scheduled on-device at the user preference time (default 8 PM local)',
        title: 'Nora',
        subtitle: 'End-of-day check-in',
        body: "Hey, how was your day? I'm ready when you are.",
        category: 'mental-training',
        productScope: 'pulsecheck',
        deliveryMethod: 'local',
        source: 'iOS — NotificationService.scheduleDailyReflectionReminder()',
        dataKeys: ['type: DAILY_REFLECTION', 'route: nora_chat', 'prompt', 'assistantOpeningMessage', 'launchSubtitle'],
        opensInto: 'Nora chat in the Pulse Check app',
        tokenField: 'users.pulseCheckFcmToken',
        notes: 'Enabled during Nora onboarding and seeded for athlete team onboarding. Tapping stays in Pulse Check and opens Nora chat.',
    },
    {
        id: 'pulsecheck-wind-down-local',
        name: 'PulseCheck — Wind-down Reminder',
        trigger: 'Locally scheduled from recent HealthKit sleep patterns when notification delivery is authorized',
        title: 'Nora',
        subtitle: 'Wind-down check-in',
        body: 'Hey, you should be winding down in the next 30 minutes to get optimal sleep and recovery.',
        category: 'mental-training',
        productScope: 'pulsecheck',
        deliveryMethod: 'local',
        source: 'iOS — NotificationService.scheduleWindDownReminder()',
        dataKeys: ['type: WIND_DOWN_REMINDER', 'route: nora_chat', 'prompt', 'assistantOpeningMessage', 'launchSubtitle'],
        opensInto: 'Nora chat in the Pulse Check app',
        tokenField: 'users.pulseCheckFcmToken',
        notes: 'Depends on HealthKit sleep data and local notification authorization. Tapping opens Nora chat inside Pulse Check.',
    },
    {
        id: 'pulsecheck-biometric-brief-ready',
        name: 'PulseCheck — Biometric Brief Ready',
        trigger: 'Remote push when the latest recovery/biometric brief is prepared for the athlete',
        title: 'Nora',
        subtitle: 'Biometric brief ready',
        body: "Hey {{displayName}}, your biometric brief is ready. Let's talk about it.",
        category: 'mental-training',
        productScope: 'pulsecheck',
        deliveryMethod: 'fcm-remote',
        source: 'iOS + backend — Nora biometric brief push pipeline',
        dataKeys: [
            'type: BIOMETRIC_BRIEF_READY',
            'route: nora_chat',
            'dmKind: biometric_brief_ready',
            'prompt',
            'assistantOpeningMessage',
            'launchSubtitle',
            'snapshotDateKey',
            'observedDateKey',
        ],
        opensInto: 'Nora chat in the Pulse Check app',
        tokenField: 'users.pulseCheckFcmToken',
        notes: 'This is a Pulse Check notification, not a Fit With Pulse one. Tapping should stay in Pulse Check and launch Nora chat with the biometric brief context.',
    },
    {
        id: 'pulsecheck-daily-checkin-scheduled',
        name: 'PulseCheck — Daily Check-in Push',
        trigger: "Scheduled backend function runs hourly and targets users whose local hour matches dailyReflectionPreferences.hour",
        title: 'PulseCheck daily check-in',
        body: "Open today's web task and log how you're showing up.",
        category: 'mental-training',
        productScope: 'pulsecheck',
        deliveryMethod: 'scheduled-function',
        source: 'Firebase Functions — functions/dailyReflectionNotifications.js',
        dataKeys: ['type: MENTAL_CHECKIN', 'prompt', 'checkInType', 'screen', 'webUrl'],
        opensInto: 'PulseCheck web Today task',
        tokenField: 'users.pulseCheckFcmToken',
        notes: 'Requires dailyReflectionPreferences.enabled=true and a valid users.pulseCheckFcmToken. This is the only Pulse Check sequence here that intentionally opens the web task.',
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
        adminLink: '/admin/systemOverview#variant-registry',
        adminLinkLabel: 'Variant Registry',
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
        adminLink: '/admin/systemOverview#variant-registry',
        adminLinkLabel: 'Variant Registry',
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
    club: { label: 'Club', icon: <Home className="w-3.5 h-3.5" />, color: 'text-lime-400' },
    'step-challenge': { label: 'Step Challenge', icon: <Footprints className="w-3.5 h-3.5" />, color: 'text-teal-400' },
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

const PRODUCT_META: Record<ProductScope, { label: string; accent: string }> = {
    pulse: { label: 'Pulse', accent: 'text-[#d7ff00]' },
    pulsecheck: { label: 'PulseCheck', accent: 'text-cyan-300' },
};

const DEFAULT_TEMPLATE_VALUES: Record<string, string> = {
    dayOfWeek: 'Friday',
    challengeId: 'test-challenge',
    challengeTitle: 'Test Challenge',
    roundId: 'test-round',
    roundName: 'Test Round',
    roundTitle: 'Test Round',
    clubId: 'test-club',
    clubName: 'Test Club',
    winnerUsername: 'Coach Demo',
    passerUsername: 'Demo Athlete',
    referredUserName: 'Demo Friend',
    senderUsername: 'Demo Sender',
    fromUsername: 'Demo Sender',
    fromUserId: 'test-sender',
    newUserId: 'test-new-user',
    newUsername: 'demo_new_user',
    messageId: 'test-message',
    messageContent: 'Test message from admin',
    workoutType: 'Strength',
    equipment: 'treadmill',
    duration: '30 min',
    durationSeconds: '1800',
    calories: '320',
    distanceMiles: '3.25',
    milestone: '10000',
    steps: '10000',
    hoursRemaining: '24',
    newRank: '2',
    recipientRank: '2',
    rank: '2',
    ordinal: 'nd',
    metricLabel: 'pts',
    endedBy: 'admin-test',
    totalParticipants: '12',
    daysLeft: '4',
    isRunRound: 'false',
    timestamp: String(Date.now()),
    top3: JSON.stringify([
        { rank: 1, username: 'leader_one', totalPoints: 540, todayPoints: 110, profileImage: '' },
        { rank: 2, username: 'leader_two', totalPoints: 490, todayPoints: 90, profileImage: '' },
        { rank: 3, username: 'leader_three', totalPoints: 430, todayPoints: 75, profileImage: '' },
    ]),
    todayTopScorer: JSON.stringify({ username: 'leader_one', points: 110 }),
    todayTopRunner: JSON.stringify({ username: 'runner_one', distanceMiles: '4.10' }),
    snapshotDateKey: '2026-03-28',
    observedDateKey: '2026-03-28',
};

const getNormalizedNotificationType = (notificationId: string) =>
    notificationId.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();

const getNotificationProductScope = (notification: NotificationRow): ProductScope =>
    notification.productScope ?? 'pulse';

const getNotificationTokenField = (notification: NotificationRow) =>
    notification.tokenField ?? (getNotificationProductScope(notification) === 'pulsecheck' ? 'users.pulseCheckFcmToken' : 'users.fcmToken');

const hasScopedPushToken = (user: TestTargetUser | null, notification: NotificationRow | null) => {
    if (!user || !notification) return false;
    return getNotificationProductScope(notification) === 'pulsecheck' ? user.hasPulseCheckFcmToken : user.hasPulseFcmToken;
};

const getScopedPushTokenLabel = (user: TestTargetUser | null, notification: NotificationRow | null) => {
    if (!notification) return 'No push token on file';
    const available = hasScopedPushToken(user, notification);
    const scope = getNotificationProductScope(notification);

    if (scope === 'pulsecheck') {
        return available ? 'Pulse Check push token available' : 'No Pulse Check push token on file';
    }

    return available ? 'Pulse push token available' : 'No Pulse push token on file';
};

const getPreviewAppChrome = (notification: NotificationRow) => {
    const scope = getNotificationProductScope(notification);
    if (scope === 'pulsecheck') {
        return {
            label: 'Pulse Check',
            badgeClassName: 'bg-cyan-400 text-slate-950',
        };
    }

    return {
        label: 'Pulse',
        badgeClassName: 'bg-[#d7ff00] text-black',
    };
};

const renderTemplate = (template: string, values: Record<string, string>) =>
    template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey) => values[rawKey.trim()] ?? `{{${rawKey.trim()}}}`);

const getTemplateValues = (notification: NotificationRow, user: TestTargetUser | null): Record<string, string> => {
    const username = user?.username || 'test_user';
    const displayName = user?.displayName || username || 'Test User';
    return {
        ...DEFAULT_TEMPLATE_VALUES,
        type: getNormalizedNotificationType(notification.id),
        userId: user?.id || 'test-user',
        username,
        displayName,
        fromUsername: username,
        senderUsername: username,
        fromUserId: user?.id || 'test-user',
        newUserId: user?.id || 'test-user',
        newUsername: username,
        referredUserName: displayName,
        timestamp: String(Date.now()),
    };
};

const buildDataPayload = (notification: NotificationRow, user: TestTargetUser | null): Record<string, string> => {
    const values = getTemplateValues(notification, user);
    const payload: Record<string, string> = {
        type: getNormalizedNotificationType(notification.id),
        testMode: 'true',
        notificationId: notification.id,
        notificationName: notification.name,
        recipientUserId: user?.id || 'test-user',
    };

    for (const keyDef of notification.dataKeys || []) {
        const separatorIndex = keyDef.indexOf(':');
        const rawKey = separatorIndex >= 0 ? keyDef.slice(0, separatorIndex) : keyDef;
        const rawValue = separatorIndex >= 0 ? keyDef.slice(separatorIndex + 1) : '';
        const key = rawKey.trim().replace(/\?$/, '');

        if (!key) continue;
        payload[key] = rawValue.trim() || values[key] || '';
    }

    if (!payload.userId && user?.id) {
        payload.userId = user.id;
    }
    if (!payload.challengeId && notification.category === 'round-activity') {
        payload.challengeId = values.challengeId;
    }

    return payload;
};

/* ─────────────────────── Component ───────────────────────────── */

const NotificationSequencesAdmin: React.FC = () => {
    const [search, setSearch] = useState('');
    const [productFilter, setProductFilter] = useState<ProductScope | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [testNotification, setTestNotification] = useState<NotificationRow | null>(null);
    const [testUserSearch, setTestUserSearch] = useState('');
    const [testUserResults, setTestUserResults] = useState<TestTargetUser[]>([]);
    const [selectedTestUser, setSelectedTestUser] = useState<TestTargetUser | null>(null);
    const [testSearchLoading, setTestSearchLoading] = useState(false);
    const [testSendLoading, setTestSendLoading] = useState(false);
    const [testStatus, setTestStatus] = useState<TestStatus>(null);

    const categories = useMemo(() => {
        const scopedNotifications = NOTIFICATIONS.filter((notification) =>
            productFilter === 'all' ? true : getNotificationProductScope(notification) === productFilter
        );
        const uniqueCats = Array.from(new Set(scopedNotifications.map((n) => n.category)));
        return uniqueCats.sort();
    }, [productFilter]);

    const scopedNotifications = useMemo(
        () =>
            NOTIFICATIONS.filter((notification) =>
                productFilter === 'all' ? true : getNotificationProductScope(notification) === productFilter
            ),
        [productFilter]
    );

    const filtered = useMemo(() => {
        let list = scopedNotifications;

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
    }, [search, categoryFilter, scopedNotifications]);

    React.useEffect(() => {
        if (categoryFilter !== 'all' && !categories.includes(categoryFilter)) {
            setCategoryFilter('all');
        }
    }, [categories, categoryFilter]);

    const toggleExpand = (id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const closeTestModal = () => {
        setTestNotification(null);
        setTestUserSearch('');
        setTestUserResults([]);
        setSelectedTestUser(null);
        setTestStatus(null);
        setTestSearchLoading(false);
        setTestSendLoading(false);
    };

    const openTestModal = (notification: NotificationRow) => {
        setTestNotification(notification);
        setTestUserSearch('');
        setTestUserResults([]);
        setSelectedTestUser(null);
        setTestStatus(null);
    };

    React.useEffect(() => {
        if (!testNotification) return;

        const query = testUserSearch.trim();
        if (query.length < 2) {
            setTestUserResults([]);
            setTestSearchLoading(false);
            return;
        }

        let isCancelled = false;
        setTestSearchLoading(true);

        const timeoutId = window.setTimeout(async () => {
            try {
                const response = await fetch(`/.netlify/functions/admin-notification-test?q=${encodeURIComponent(query)}`);
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Failed to search users');
                }

                if (!isCancelled) {
                    setTestUserResults(result.users || []);
                }
            } catch (error) {
                if (!isCancelled) {
                    setTestUserResults([]);
                    setTestStatus({
                        kind: 'error',
                        message: error instanceof Error ? error.message : 'Failed to search users',
                    });
                }
            } finally {
                if (!isCancelled) {
                    setTestSearchLoading(false);
                }
            }
        }, 300);

        return () => {
            isCancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [testNotification, testUserSearch]);

    const handleSendTest = async () => {
        if (!testNotification || !selectedTestUser) return;

        setTestSendLoading(true);
        setTestStatus(null);

        try {
            const templateValues = getTemplateValues(testNotification, selectedTestUser);
            const response = await fetch('/.netlify/functions/admin-notification-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: selectedTestUser.id,
                    notificationId: testNotification.id,
                    notificationName: testNotification.name,
                    productScope: getNotificationProductScope(testNotification),
                    title: `[TEST] ${renderTemplate(testNotification.title, templateValues)}`,
                    body: renderTemplate(testNotification.body, templateValues),
                    dataPayload: buildDataPayload(testNotification, selectedTestUser),
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'Failed to send test notification');
            }

            setTestStatus({
                kind: 'success',
                message: `Sent "${testNotification.name}" to @${selectedTestUser.username || selectedTestUser.email}`,
            });
        } catch (error) {
            setTestStatus({
                kind: 'error',
                message: error instanceof Error ? error.message : 'Failed to send test notification',
            });
        } finally {
            setTestSendLoading(false);
        }
    };

    const testPreviewValues = useMemo(
        () => (testNotification ? getTemplateValues(testNotification, selectedTestUser) : null),
        [testNotification, selectedTestUser]
    );
    const testPreviewChrome = useMemo(
        () => (testNotification ? getPreviewAppChrome(testNotification) : null),
        [testNotification]
    );
    const selectedUserHasScopedPushToken = testNotification ? hasScopedPushToken(selectedTestUser, testNotification) : false;

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
                            <span className="text-white font-semibold">{scopedNotifications.length}</span>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-[#1a1e24] border border-zinc-800 text-sm">
                            <span className="text-zinc-400">FCM Remote:</span>{' '}
                            <span className="text-emerald-400 font-semibold">
                                {scopedNotifications.filter((n) => n.deliveryMethod === 'fcm-remote').length}
                            </span>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-[#1a1e24] border border-zinc-800 text-sm">
                            <span className="text-zinc-400">Local:</span>{' '}
                            <span className="text-amber-400 font-semibold">
                                {scopedNotifications.filter((n) => n.deliveryMethod === 'local').length}
                            </span>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-[#1a1e24] border border-zinc-800 text-sm">
                            <span className="text-zinc-400">Scheduled:</span>{' '}
                            <span className="text-violet-400 font-semibold">
                                {scopedNotifications.filter((n) => n.deliveryMethod === 'scheduled-function').length}
                            </span>
                        </div>
                        <div className="px-4 py-2 rounded-xl bg-[#1a1e24] border border-zinc-800 text-sm">
                            <span className="text-zinc-400">FCM→Local:</span>{' '}
                            <span className="text-cyan-400 font-semibold">
                                {scopedNotifications.filter((n) => n.deliveryMethod === 'fcm-or-local').length}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                        <button
                            onClick={() => setProductFilter('all')}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${productFilter === 'all'
                                ? 'bg-[#d7ff00] text-black'
                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                }`}
                        >
                            All Products
                        </button>
                        {(Object.entries(PRODUCT_META) as [ProductScope, typeof PRODUCT_META[ProductScope]][]).map(([scope, meta]) => (
                            <button
                                key={scope}
                                onClick={() => setProductFilter(scope)}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${productFilter === scope
                                    ? 'bg-[#d7ff00] text-black'
                                    : `bg-zinc-800 ${meta.accent} hover:bg-zinc-700`
                                    }`}
                            >
                                {meta.label}
                            </button>
                        ))}
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
                        <span className="text-white font-medium">{scopedNotifications.length}</span> notification
                        {scopedNotifications.length === 1 ? '' : 's'}
                    </div>

                    {/* ── Notification Cards ─────────────────────── */}
                    <div className="space-y-3">
                        {filtered.map((n) => {
                            const catMeta = CATEGORY_META[n.category];
                            const delMeta = DELIVERY_META[n.deliveryMethod];
                            const isExpanded = expandedId === n.id;
                            const previewChrome = getPreviewAppChrome(n);

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
                                                        <div className={`w-5 h-5 rounded flex items-center justify-center ${previewChrome.badgeClassName}`}>
                                                            <span className="text-[8px] font-bold text-black">P</span>
                                                        </div>
                                                        <span className="text-xs text-zinc-500 font-medium">{previewChrome.label}</span>
                                                        <span className="text-xs text-zinc-600 ml-auto">now</span>
                                                    </div>
                                                    <p className="text-white text-sm font-semibold">{n.title}</p>
                                                    {n.subtitle && <p className="text-zinc-500 text-xs mt-0.5">{n.subtitle}</p>}
                                                    <p className="text-zinc-400 text-sm mt-0.5">{n.body}</p>
                                                </div>
                                            </div>

                                            {/* Meta grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                                <div>
                                                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Trigger</span>
                                                    <p className="text-sm text-zinc-200 mt-1">{n.trigger}</p>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Source</span>
                                                    <p className="text-sm text-zinc-200 mt-1 font-mono text-xs">{n.source}</p>
                                                </div>
                                                {n.opensInto && (
                                                    <div>
                                                        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Opens</span>
                                                        <p className="text-sm text-zinc-200 mt-1">{n.opensInto}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Token Field</span>
                                                    <p className="text-sm text-zinc-200 mt-1 font-mono text-xs">{getNotificationTokenField(n)}</p>
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
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openTestModal(n)}
                                                    className="inline-flex items-center gap-2 px-3 py-2 bg-[#d7ff00] hover:bg-[#c4ea00] text-black rounded-lg text-sm font-semibold transition-colors"
                                                >
                                                    <Send className="w-4 h-4" />
                                                    Test Push
                                                </button>

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

            {testNotification && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
                    <div className="w-full max-w-3xl bg-[#111417] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-zinc-800">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">Test Notification</p>
                                <h2 className="text-xl font-semibold text-white mt-1">{testNotification.name}</h2>
                                <p className="text-sm text-zinc-400 mt-1">
                                    Search for a user, select them, and send a targeted test push from this sequence.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeTestModal}
                                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-0">
                            <div className="p-6 border-b lg:border-b-0 lg:border-r border-zinc-800 space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                                        Find Test User
                                    </label>
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            value={testUserSearch}
                                            onChange={(e) => {
                                                setTestUserSearch(e.target.value);
                                                setTestStatus(null);
                                            }}
                                            placeholder="Search by username, display name, or email..."
                                            className="w-full pl-9 pr-10 py-3 rounded-xl border border-zinc-700 bg-[#1a1e24] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40 transition-all"
                                        />
                                        {testSearchLoading && (
                                            <Loader className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">
                                        Searches live users and only sends if the selected account has a valid token for{' '}
                                        <span className="text-zinc-300">{testNotification ? getNotificationTokenField(testNotification) : 'this sequence'}</span>.
                                    </p>
                                </div>

                                {selectedTestUser && (
                                    <div className="rounded-xl border border-emerald-800/50 bg-emerald-900/10 p-4">
                                        <div className="flex items-center gap-3">
                                            {selectedTestUser.profileImageUrl ? (
                                                <img
                                                    src={selectedTestUser.profileImageUrl}
                                                    alt={selectedTestUser.username || selectedTestUser.email}
                                                    className="w-11 h-11 rounded-full object-cover border border-zinc-700"
                                                />
                                            ) : (
                                                <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                                                    <Users className="w-5 h-5" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-white font-medium truncate">
                                                    {selectedTestUser.displayName || selectedTestUser.username || selectedTestUser.email}
                                                </p>
                                                <p className="text-sm text-zinc-400 truncate">
                                                    @{selectedTestUser.username || 'no-username'} · {selectedTestUser.email || 'No email'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-3 text-xs">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${
                                                    selectedUserHasScopedPushToken
                                                        ? 'border-emerald-700 bg-emerald-900/30 text-emerald-300'
                                                        : 'border-red-800 bg-red-900/20 text-red-300'
                                                }`}
                                            >
                                                {getScopedPushTokenLabel(selectedTestUser, testNotification)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                                    {testUserResults.map((user) => {
                                        const isSelected = selectedTestUser?.id === user.id;
                                        return (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedTestUser(user);
                                                    setTestStatus(null);
                                                }}
                                                className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                                                    isSelected
                                                        ? 'border-[#d7ff00]/60 bg-[#d7ff00]/10'
                                                        : 'border-zinc-800 bg-[#1a1e24] hover:border-zinc-700 hover:bg-zinc-900'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-white truncate">
                                                            {user.displayName || user.username || user.email}
                                                        </p>
                                                        <p className="text-xs text-zinc-400 truncate">
                                                            @{user.username || 'no-username'} · {user.email || 'No email'}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`text-[10px] font-medium px-2 py-1 rounded-full border ${
                                                            hasScopedPushToken(user, testNotification)
                                                                ? 'border-emerald-800 bg-emerald-900/20 text-emerald-300'
                                                                : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                                                        }`}
                                                    >
                                                        {hasScopedPushToken(user, testNotification) ? 'Push Ready' : 'No Token'}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}

                                    {!testSearchLoading && testUserSearch.trim().length >= 2 && testUserResults.length === 0 && (
                                        <div className="rounded-xl border border-zinc-800 bg-[#1a1e24] px-4 py-6 text-center text-sm text-zinc-500">
                                            No matching users found.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 space-y-5">
                                {testStatus && (
                                    <div
                                        className={`rounded-xl border px-4 py-3 text-sm ${
                                            testStatus.kind === 'success'
                                                ? 'border-emerald-800 bg-emerald-900/20 text-emerald-300'
                                                : 'border-red-800 bg-red-900/20 text-red-300'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            {testStatus.kind === 'success' ? (
                                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            ) : (
                                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            )}
                                            <span>{testStatus.message}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-xl border border-zinc-800 bg-[#1a1e24] p-4">
                                    <div className="flex items-center gap-2 mb-3 text-xs text-zinc-500 uppercase tracking-wider font-medium">
                                        <Bell className="w-3.5 h-3.5" />
                                        Preview
                                    </div>
                                    <div className="bg-zinc-950 rounded-lg p-3 border border-zinc-800">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-5 h-5 rounded flex items-center justify-center ${testPreviewChrome?.badgeClassName ?? 'bg-[#d7ff00] text-black'}`}>
                                                <span className="text-[8px] font-bold text-black">P</span>
                                            </div>
                                            <span className="text-xs text-zinc-500 font-medium">{testPreviewChrome?.label ?? 'Pulse'}</span>
                                            <span className="text-xs text-zinc-600 ml-auto">test</span>
                                        </div>
                                        <p className="text-white text-sm font-semibold">
                                            {testPreviewValues ? `[TEST] ${renderTemplate(testNotification.title, testPreviewValues)}` : testNotification.title}
                                        </p>
                                        {testNotification.subtitle && (
                                            <p className="text-zinc-500 text-xs mt-0.5">
                                                {testPreviewValues ? renderTemplate(testNotification.subtitle, testPreviewValues) : testNotification.subtitle}
                                            </p>
                                        )}
                                        <p className="text-zinc-400 text-sm mt-0.5">
                                            {testPreviewValues ? renderTemplate(testNotification.body, testPreviewValues) : testNotification.body}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400 space-y-2">
                                    <p>
                                        This sends a remote push test using the sequence template and sample payload values.
                                    </p>
                                    {testNotification.opensInto && (
                                        <p>
                                            Expected open behavior: <span className="text-zinc-200">{testNotification.opensInto}</span>.
                                        </p>
                                    )}
                                    {testNotification.deliveryMethod === 'local' && (
                                        <p>
                                            This does not validate on-device local scheduling; it only verifies the content can be delivered as a push.
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleSendTest}
                                        disabled={!selectedTestUser || !selectedUserHasScopedPushToken || testSendLoading}
                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                                            !selectedTestUser || !selectedUserHasScopedPushToken || testSendLoading
                                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                                : 'bg-[#d7ff00] text-black hover:bg-[#c4ea00]'
                                        }`}
                                    >
                                        {testSendLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        {testSendLoading ? 'Sending...' : 'Send Test Push'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeTestModal}
                                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminRouteGuard>
    );
};

export default NotificationSequencesAdmin;
