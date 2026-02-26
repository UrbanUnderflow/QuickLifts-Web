import type { Handler } from "@netlify/functions";
import { getFirestore, initAdmin } from "./utils/getServiceAccount";

/**
 * Scheduled function: Award Round Win Badges
 *
 * Runs daily after the challenge-status updater.
 * Finds rounds that transitioned to "completed" and awards badges
 * to the top-3 finishers. Badges are stored in `users/{uid}/badges/{badgeId}`
 * and logged to `round-badge-log` for idempotency.
 *
 * Schedule: 3 AM UTC (1 hour after challenge-status updater)
 */

interface ParticipantSummary {
    userId: string;
    username: string;
    totalPoints: number;
    completedWorkouts: number;
    fcmToken?: string;
}

export const handler: Handler = async () => {
    console.log("[award-round-badges] Starting badge award run...");

    try {
        const admin = initAdmin();
        const db = await getFirestore();
        const messaging = admin.messaging();
        const now = new Date();
        const nowSeconds = Math.floor(now.getTime() / 1000);

        // ── 1. Find completed rounds ──────────────────────────────────
        const collectionsSnap = await db
            .collection("sweatlist-collection")
            .where("challenge.status", "==", "completed")
            .get();

        if (collectionsSnap.empty) {
            console.log("[award-round-badges] No completed rounds found.");
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "No completed rounds." }),
            };
        }

        let badgesAwarded = 0;
        let roundsProcessed = 0;
        const errors: string[] = [];

        for (const doc of collectionsSnap.docs) {
            const data = doc.data();
            const challenge = data.challenge;
            if (!challenge) continue;

            const endDate =
                typeof challenge.endDate === "number" ? challenge.endDate : 0;

            // Only process rounds that ended recently (within 7 days)
            if (endDate < nowSeconds - 7 * 24 * 60 * 60) continue;

            const roundId = challenge.id || doc.id;
            const roundTitle = challenge.title || "Round";

            // ── 2. Check idempotency ────────────────────────────────────
            const badgeCheck = await db
                .collection("round-badge-log")
                .doc(roundId)
                .get();

            if (badgeCheck.exists) continue; // Already processed

            // ── 3. Fetch participants ───────────────────────────────────
            const participantsSnap = await db
                .collection("user-challenge")
                .where("challengeId", "==", roundId)
                .get();

            if (participantsSnap.empty) {
                console.log(
                    `[award-round-badges] Round ${roundId} has no participants. Skipping.`
                );
                continue;
            }

            const participants: ParticipantSummary[] = [];
            for (const pDoc of participantsSnap.docs) {
                const p = pDoc.data();
                participants.push({
                    userId: p.userId || "",
                    username: p.username || p.displayName || "user",
                    totalPoints: (typeof p.pulsePoints === 'number' ? p.pulsePoints : p.pulsePoints?.totalPoints) ?? p.points ?? 0,
                    completedWorkouts: p.completedWorkouts ?? 0,
                    fcmToken: p.fcmToken,
                });
            }

            let sortedParticipants = participants;
            sortedParticipants.sort((a, b) => b.totalPoints - a.totalPoints);
            const roundType = challenge.challengeType || "lift";

            if (roundType === "run") {
                try {
                    const { handler: getRunLeaderboard } = require("./get-run-round-leaderboard");
                    const runRes = await getRunLeaderboard({
                        httpMethod: "GET",
                        queryStringParameters: {
                            challengeId: roundId,
                            leaderboardMetric: challenge.runRoundConfig?.leaderboardMetric || "totalDistance",
                            allowTreadmill: "true",
                            startDate: challenge.startDate ? String(challenge.startDate) : undefined,
                            endDate: challenge.endDate ? String(challenge.endDate) : undefined
                        }
                    });
                    if (runRes.statusCode === 200) {
                        const data = JSON.parse(runRes.body);
                        if (data.success && data.leaderboard && data.leaderboard.length > 0) {
                            sortedParticipants = data.leaderboard.map((lb: any) => ({
                                userId: lb.userId,
                                username: lb.username,
                                totalPoints: Math.round(lb.totalDistance),
                                completedWorkouts: lb.totalRuns,
                                metricFormatted: lb.formattedValue,
                                fcmToken: null
                            }));
                        }
                    }
                } catch (e) {
                    console.error("Failed to get run round leaderboard:", e);
                }
            }

            if (participants.length < 1) {
                console.log(
                    `[award-round-badges] Round ${roundId} has 0 participants. Skipping.`
                );
                await db.collection("round-badge-log").doc(roundId).set({
                    roundId,
                    processedAt: nowSeconds,
                    participantCount: participants.length,
                    skipped: true,
                    reason: "0 participants",
                });
                continue;
            }

            // ── 4. Award badges to top 3 ────────────────────────────────
            const top3 = sortedParticipants.slice(0, 3);
            const hostIds: string[] = Array.isArray(challenge.ownerId)
                ? challenge.ownerId
                : challenge.ownerId
                    ? [challenge.ownerId]
                    : [];

            // Find host username
            let hostUsername = "host";
            if (hostIds.length > 0) {
                try {
                    const hostDoc = await db.collection("users").doc(hostIds[0]).get();
                    hostUsername = hostDoc.data()?.username || "host";
                } catch {
                    // Ignore
                }
            }

            const startDate =
                typeof challenge.startDate === "number" ? challenge.startDate : 0;
            const durationDays = Math.max(
                1,
                Math.round((endDate - startDate) / 86400)
            );

            const batch = db.batch();

            // Build a snapshot of the top 3 for embedding in every badge
            const topParticipants = top3.map((tp: any, idx: number) => ({
                userId: tp.userId,
                username: tp.username,
                rank: idx + 1,
                totalPoints: tp.totalPoints,
                completedWorkouts: tp.completedWorkouts,
                metricFormatted: (tp as any).metricFormatted || null,
            }));

            for (let i = 0; i < top3.length; i++) {
                const p = top3[i];
                if (!p.userId) continue;

                const rank = i + 1;
                const badgeId = `${roundId}-${rank}`;

                // ── 5. Save the Badge ─────────────────────────────────────
                const badgeData = {
                    id: badgeId,
                    userId: p.userId,
                    roundId,
                    roundTitle,
                    roundType,
                    rank,
                    totalPoints: p.totalPoints,
                    participantCount: participants.length,
                    completedWorkouts: p.completedWorkouts,
                    metricFormatted: (p as any).metricFormatted || null,
                    topParticipants,
                    awardedAt: endDate,
                    roundStartDate: startDate,
                    roundEndDate: endDate,
                    hostUsername,
                    durationDays,
                };

                // Write badge to user's subcollection
                const badgeRef = db
                    .collection("users")
                    .doc(p.userId)
                    .collection("badges")
                    .doc(badgeId);
                batch.set(badgeRef, badgeData);

                badgesAwarded++;

                // Send notification to winner
                if (p.fcmToken) {
                    try {
                        const rankLabel =
                            rank === 1
                                ? "🥇 Champion"
                                : rank === 2
                                    ? "🥈 Runner Up"
                                    : "🥉 Third Place";
                        await messaging.send({
                            token: p.fcmToken,
                            notification: {
                                title: `${rankLabel}!`,
                                body: `You finished #${rank} in "${roundTitle}" with ${p.totalPoints} pts! Your badge is waiting.`,
                            },
                            data: {
                                type: "ROUND_WIN_BADGE",
                                challengeId: roundId,
                                badgeId,
                                rank: String(rank),
                            },
                            apns: {
                                payload: {
                                    aps: {
                                        sound: "default",
                                        badge: 1,
                                    },
                                },
                            },
                        });
                    } catch (fcmErr: any) {
                        console.warn(
                            `[award-round-badges] FCM failed for ${p.userId}:`,
                            fcmErr?.message
                        );
                    }
                }
            }

            // ── 5. Mark round as badged ─────────────────────────────────
            batch.set(db.collection("round-badge-log").doc(roundId), {
                roundId,
                roundTitle,
                processedAt: nowSeconds,
                participantCount: participants.length,
                top3: top3.map((p, i) => ({
                    userId: p.userId,
                    username: p.username,
                    rank: i + 1,
                    totalPoints: p.totalPoints,
                })),
            });

            await batch.commit();
            roundsProcessed++;

            console.log(
                `[award-round-badges] Awarded ${Math.min(3, top3.length)} badges for "${roundTitle}" (${roundId}).`
            );
        }

        // ── 6. Summary ────────────────────────────────────────────────
        console.log(
            `[award-round-badges] Done. Rounds: ${roundsProcessed}, Badges: ${badgesAwarded}.`
        );

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                roundsProcessed,
                badgesAwarded,
                errors,
            }),
        };
    } catch (err: any) {
        console.error("[award-round-badges] Fatal error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: err.message }),
        };
    }
};
