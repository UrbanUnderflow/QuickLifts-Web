import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';

/**
 * Scheduled Round Daily Summary Notifications
 *
 * Sends a nightly summary push notification to every participant in an active Round.
 * The notification tells users who is in the lead, how many days are left, and highlights
 * the day's top performers (most points, furthest run, etc.).
 *
 * Schedule: Every day at 9 PM EST (2 AM UTC next day)
 *
 * Netlify Schedule Configuration (add to netlify.toml):
 * [[functions]]
 *   name = "scheduled-round-daily-summary"
 *   schedule = "0 2 * * *"   # 9PM EST / 2AM UTC
 */

const BATCH_LIMIT = 500;

interface SummaryResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

interface ParticipantSummary {
    userId: string;
    username: string;
    totalPoints: number;
    todayPoints: number;
    completedWorkouts: number;
    currentStreak: number;
    todayDistance?: number; // miles, for run rounds
    profileImage?: string;
}

function utcDateString(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function daysRemaining(endDate: Date, now: Date): number {
    const diffMs = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function ordinalSuffix(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function sendNotification(
    messaging: any,
    fcmToken: string,
    title: string,
    body: string,
    data: Record<string, string>
): Promise<SummaryResult> {
    try {
        const message = {
            token: fcmToken,
            notification: { title, body },
            data,
            apns: {
                payload: {
                    aps: {
                        alert: { title, body },
                        badge: 1,
                        sound: 'default',
                    },
                },
            },
            android: {
                priority: 'high' as const,
                notification: { sound: 'default' },
            },
        };

        const messageId = await messaging.send(message);
        return { success: true, messageId };
    } catch (error: any) {
        console.error(`Failed to send notification to token ${fcmToken.substring(0, 10)}...`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Compute participant summary data for a round.
 * Uses the UserChallenge documents (which contain completedWorkouts, pulsePoints, etc.)
 * and today's workout summaries.
 */
async function computeRoundSummary(
    db: FirebaseFirestore.Firestore,
    challengeId: string,
    now: Date
): Promise<{
    participants: ParticipantSummary[];
    roundTitle: string;
    daysLeft: number;
    isRunRound: boolean;
}> {
    // Fetch the challenge/collection doc
    const collectionSnap = await db.collection('collections').doc(challengeId).get();
    if (!collectionSnap.exists) {
        return { participants: [], roundTitle: '', daysLeft: 0, isRunRound: false };
    }

    const collectionData = collectionSnap.data() as any;
    const challenge = collectionData?.challenge;
    if (!challenge) {
        return { participants: [], roundTitle: collectionData?.title || '', daysLeft: 0, isRunRound: false };
    }

    const roundTitle = collectionData.title || challenge.title || 'your Round';
    const endDate = challenge.endDate?.toDate?.() || new Date(challenge.endDate);
    const daysLeft = daysRemaining(endDate, now);
    const isRunRound = collectionData.isRunRound === true;

    // Fetch userChallenges for this round
    const ucSnap = await db
        .collection('userChallenges')
        .where('challengeId', '==', challengeId)
        .limit(BATCH_LIMIT)
        .get();

    if (ucSnap.empty) {
        return { participants: [], roundTitle, daysLeft, isRunRound };
    }

    // Today's date boundaries (UTC)
    const todayStr = utcDateString(now);

    const participants: ParticipantSummary[] = [];

    for (const ucDoc of ucSnap.docs) {
        const uc = ucDoc.data();

        // Calculate total points
        const pulsePoints = uc.pulsePoints || {};
        const totalPoints =
            (pulsePoints.workoutPoints || 0) +
            (pulsePoints.encouragementPointsReceived || 0) +
            (pulsePoints.encouragementPointsGiven || 0) +
            (pulsePoints.streakPoints || 0) +
            (pulsePoints.sharePoints || 0) +
            (pulsePoints.checkInPoints || 0);

        // Count completed workouts and calculate today's points
        const completedWorkouts: any[] = uc.completedWorkouts || [];
        let todayPoints = 0;
        let todayDistance = 0;

        for (const cw of completedWorkouts) {
            const cwDate = cw.completedAt?.toDate?.()
                ? utcDateString(cw.completedAt.toDate())
                : typeof cw.completedAt === 'number'
                    ? utcDateString(new Date(cw.completedAt * 1000))
                    : null;

            if (cwDate === todayStr) {
                todayPoints += cw.points || 10; // Default 10 points per workout
                todayDistance += cw.distanceMiles || 0;
            }
        }

        participants.push({
            userId: uc.userId || '',
            username: uc.username || 'Unknown',
            totalPoints,
            todayPoints,
            completedWorkouts: completedWorkouts.length,
            currentStreak: uc.currentStreak || 0,
            todayDistance: isRunRound ? todayDistance : undefined,
            profileImage: uc.profileImage?.profileImageUrl || undefined,
        });
    }

    // Sort by total points descending (leaderboard)
    participants.sort((a, b) => b.totalPoints - a.totalPoints);

    return { participants, roundTitle, daysLeft, isRunRound };
}

/**
 * Build the notification body text from the round summary
 */
function buildNotificationContent(
    roundTitle: string,
    daysLeft: number,
    participants: ParticipantSummary[],
    recipientUserId: string,
    isRunRound: boolean
): { title: string; body: string } {
    if (participants.length === 0) {
        return {
            title: `📊 ${roundTitle} — Daily Recap`,
            body: `No activity yet today. Be the first to make a move!`,
        };
    }

    const leader = participants[0];
    const recipientRank = participants.findIndex((p) => p.userId === recipientUserId) + 1;
    const daysText = daysLeft === 1 ? '1 day left' : daysLeft === 0 ? 'Final day!' : `${daysLeft} days left`;

    let title = `📊 ${roundTitle} — Daily Recap`;
    let bodyParts: string[] = [];

    // Who's leading
    if (leader.userId === recipientUserId) {
        bodyParts.push(`🥇 You're in the lead with ${leader.totalPoints} pts!`);
    } else {
        bodyParts.push(`🥇 ${leader.username} leads with ${leader.totalPoints} pts.`);
        if (recipientRank > 0) {
            bodyParts.push(`You're ${ordinalSuffix(recipientRank)}.`);
        }
    }

    // Days left
    bodyParts.push(`⏳ ${daysText}`);

    // Today's top performer (most points today)
    const todaysTopScorer = [...participants].sort((a, b) => b.todayPoints - a.todayPoints)[0];
    if (todaysTopScorer && todaysTopScorer.todayPoints > 0) {
        if (todaysTopScorer.userId === recipientUserId) {
            bodyParts.push(`⚡ You scored the most today (${todaysTopScorer.todayPoints} pts)`);
        } else {
            bodyParts.push(`⚡ ${todaysTopScorer.username} scored ${todaysTopScorer.todayPoints} pts today`);
        }
    }

    // Run round: today's longest run
    if (isRunRound) {
        const topRunner = [...participants]
            .filter((p) => (p.todayDistance || 0) > 0)
            .sort((a, b) => (b.todayDistance || 0) - (a.todayDistance || 0))[0];
        if (topRunner) {
            const miles = (topRunner.todayDistance || 0).toFixed(2);
            if (topRunner.userId === recipientUserId) {
                bodyParts.push(`🏃 You ran the furthest today (${miles} mi)`);
            } else {
                bodyParts.push(`🏃 ${topRunner.username} ran ${miles} mi today`);
            }
        }
    }

    return { title, body: bodyParts.join(' · ') };
}

export const handler: Handler = async (event) => {
    try {
        const admin = initAdmin();
        const db = await getFirestore();
        const messaging = admin.messaging();

        const now = new Date();
        const today = utcDateString(now);

        // Check idempotency — don't send twice in the same day
        const configRef = db.collection('notification-config').doc('round-daily-summary');
        const configSnap = await configRef.get();
        const config = configSnap.exists ? (configSnap.data() as any) : {};

        if (config.enabled === false) {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, message: 'Round daily summary disabled', processed: 0 }),
            };
        }

        if (config.lastRunDateUtc === today) {
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, message: 'Already ran today', processed: 0 }),
            };
        }

        // Mark as ran for today
        await configRef.set({ lastRunDateUtc: today, updatedAt: new Date(), enabled: true }, { merge: true });

        // Find all active rounds (challenges where endDate > now & startDate <= now)
        const collectionsSnap = await db
            .collection('collections')
            .where('challenge.endDate', '>', now)
            .limit(200)
            .get();

        if (collectionsSnap.empty) {
            console.log('[round-daily-summary] No active rounds found');
            return {
                statusCode: 200,
                body: JSON.stringify({ success: true, message: 'No active rounds', processed: 0 }),
            };
        }

        let totalSuccess = 0;
        let totalFail = 0;
        let roundsProcessed = 0;
        const errors: string[] = [];

        for (const collDoc of collectionsSnap.docs) {
            const collData = collDoc.data() as any;
            const challenge = collData?.challenge;
            if (!challenge) continue;

            // Skip rounds that haven't started yet
            const startDate = challenge.startDate?.toDate?.() || new Date(challenge.startDate);
            if (startDate > now) continue;

            const challengeId = collDoc.id;

            // Compute the summary data
            const summary = await computeRoundSummary(db, challengeId, now);
            if (summary.participants.length < 2) continue; // Skip single-person rounds

            roundsProcessed++;

            // Build the JSON payload for the mobile summary modal
            const top3 = summary.participants.slice(0, 3).map((p, i) => ({
                rank: i + 1,
                username: p.username,
                totalPoints: p.totalPoints,
                todayPoints: p.todayPoints,
                profileImage: p.profileImage || '',
            }));

            const todayTopScorer = [...summary.participants].sort((a, b) => b.todayPoints - a.todayPoints)[0];
            const todayTopRunner = summary.isRunRound
                ? [...summary.participants]
                    .filter((p) => (p.todayDistance || 0) > 0)
                    .sort((a, b) => (b.todayDistance || 0) - (a.todayDistance || 0))[0]
                : null;

            // Send to each participant
            const ucSnap = await db
                .collection('userChallenges')
                .where('challengeId', '==', challengeId)
                .limit(BATCH_LIMIT)
                .get();

            for (const ucDoc of ucSnap.docs) {
                const uc = ucDoc.data();
                const fcmToken = uc.fcmToken;

                if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim() === '') continue;

                // Build personalised notification text
                const { title, body } = buildNotificationContent(
                    summary.roundTitle,
                    summary.daysLeft,
                    summary.participants,
                    uc.userId,
                    summary.isRunRound
                );

                // Participant's own rank
                const recipientRank =
                    summary.participants.findIndex((p) => p.userId === uc.userId) + 1;

                // Data payload for the mobile apps to show the summary modal
                const dataPayload: Record<string, string> = {
                    type: 'ROUND_DAILY_SUMMARY',
                    challengeId,
                    roundTitle: summary.roundTitle,
                    daysLeft: String(summary.daysLeft),
                    totalParticipants: String(summary.participants.length),
                    recipientRank: String(recipientRank),
                    isRunRound: String(summary.isRunRound),
                    top3: JSON.stringify(top3),
                    todayTopScorer: todayTopScorer ? JSON.stringify({
                        username: todayTopScorer.username,
                        points: todayTopScorer.todayPoints,
                    }) : '',
                    todayTopRunner: todayTopRunner ? JSON.stringify({
                        username: todayTopRunner.username,
                        distanceMiles: (todayTopRunner.todayDistance || 0).toFixed(2),
                    }) : '',
                    timestamp: String(Date.now()),
                };

                const result = await sendNotification(messaging, fcmToken, title, body, dataPayload);

                if (result.success) {
                    totalSuccess++;
                } else {
                    totalFail++;
                    if (errors.length < 20) errors.push(`${uc.userId}: ${result.error}`);
                }
            }
        }

        // Log the batch result
        await db.collection('notification-logs').add({
            type: 'ROUND_DAILY_SUMMARY_BATCH',
            date: today,
            roundsProcessed,
            totalSuccess,
            totalFail,
            totalAttempted: totalSuccess + totalFail,
            errors: errors.slice(0, 20),
            createdAt: new Date(),
        });

        console.log(`[round-daily-summary] Done: ${roundsProcessed} rounds, ${totalSuccess} sent, ${totalFail} failed`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                roundsProcessed,
                totalSuccess,
                totalFail,
            }),
        };
    } catch (error: any) {
        console.error('[round-daily-summary] Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message }),
        };
    }
};
