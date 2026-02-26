import { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../lib/firebase-admin';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        const db = admin.firestore();
        console.log('[backfill-badges] Starting backfill...');

        // 1. Find all completed rounds
        const collectionsSnap = await db
            .collection('sweatlist-collection')
            .where('challenge.status', '==', 'completed')
            .get();

        if (collectionsSnap.empty) {
            return res.status(200).json({ message: 'No completed rounds found.' });
        }

        let roundsProcessed = 0;
        let badgesAwarded = 0;

        for (const doc of collectionsSnap.docs) {
            const data = doc.data();
            const challenge = data.challenge;
            if (!challenge) continue;

            const roundId = challenge.id || doc.id;
            const roundTitle = challenge.title || 'Round';

            // 2. Check if badged
            const badgeCheck = await db
                .collection('round-badge-log')
                .doc(roundId)
                .get();

            if (badgeCheck.exists) continue; // Already processed

            // 3. Fetch participants
            const participantsSnap = await db
                .collection('user-challenge')
                .where('challengeId', '==', roundId)
                .get();

            if (participantsSnap.empty) continue;

            const participants: any[] = [];
            for (const pDoc of participantsSnap.docs) {
                const p = pDoc.data();
                participants.push({
                    userId: p.userId || '',
                    username: p.username || p.displayName || 'user',
                    totalPoints: (typeof p.pulsePoints === 'number' ? p.pulsePoints : p.pulsePoints?.totalPoints) ?? p.points ?? 0,
                    completedWorkouts: p.completedWorkouts ?? 0,
                });
            }

            participants.sort((a, b) => b.totalPoints - a.totalPoints);
            // Require 1st place + at least 2 other people = 3 participants minimum
            if (participants.length < 3) {
                await db.collection('round-badge-log').doc(roundId).set({
                    roundId,
                    processedAt: Math.floor(Date.now() / 1000),
                    participantCount: participants.length,
                    skipped: true,
                    reason: 'fewer than 3 participants',
                });
                continue;
            }

            // 4. Award ONLY the top 1 (1st place)
            const top1 = participants.slice(0, 1);
            const roundType = challenge.challengeType || 'lift';
            const endDate =
                typeof challenge.endDate === 'number'
                    ? challenge.endDate
                    : Math.floor(Date.now() / 1000);
            const startDate =
                typeof challenge.startDate === 'number'
                    ? challenge.startDate
                    : endDate - 86400;
            const durationDays = Math.max(1, Math.round((endDate - startDate) / 86400));

            const hostIds = Array.isArray(challenge.ownerId)
                ? challenge.ownerId
                : challenge.ownerId
                    ? [challenge.ownerId]
                    : [];
            let hostUsername = 'host';
            if (hostIds.length > 0) {
                try {
                    const hostDoc = await db.collection('users').doc(hostIds[0]).get();
                    hostUsername = hostDoc.data()?.username || 'host';
                } catch { }
            }

            const batch = db.batch();

            for (let i = 0; i < top1.length; i++) {
                const p = top1[i];
                if (!p.userId) continue;

                const rank = i + 1;
                const badgeId = `${roundId}-${rank}`;

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
                    awardedAt: endDate, // Awarded when the challenge ended
                    roundStartDate: startDate,
                    roundEndDate: endDate,
                    hostUsername,
                    durationDays,
                };

                const badgeRef = db
                    .collection('users')
                    .doc(p.userId)
                    .collection('badges')
                    .doc(badgeId);
                batch.set(badgeRef, badgeData);

                badgesAwarded++;
            }

            // 5. Log
            batch.set(db.collection('round-badge-log').doc(roundId), {
                roundId,
                roundTitle,
                processedAt: Math.floor(Date.now() / 1000),
                participantCount: participants.length,
                top1: top1.map((p, i) => ({
                    userId: p.userId,
                    username: p.username,
                    rank: i + 1,
                    totalPoints: p.totalPoints,
                })),
                isBackfill: true,
            });

            await batch.commit();
            roundsProcessed++;
            console.log(`[backfill-badges] Processed ${roundTitle}`);
        }

        console.log(`[backfill-badges] Done. Rounds: ${roundsProcessed}, Badges: ${badgesAwarded}`);
        return res.status(200).json({
            success: true,
            roundsProcessed,
            badgesAwarded,
        });
    } catch (err: any) {
        console.error('[backfill-badges] Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
