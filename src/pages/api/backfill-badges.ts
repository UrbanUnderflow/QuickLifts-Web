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
                    completedWorkouts: Array.isArray(p.completedWorkouts) ? p.completedWorkouts.length : (p.completedWorkouts ?? 0),
                });
            }

            const roundType = challenge.challengeType || 'lift';

            // ── For run rounds, compute distance from runSummaries directly ──
            let sortedParticipants = [...participants];

            if (roundType === 'run') {
                const startTs = typeof challenge.startDate === 'number' ? challenge.startDate : null;
                const endTs = typeof challenge.endDate === 'number' ? challenge.endDate : null;

                const runEntries: any[] = [];

                for (const p of participants) {
                    if (!p.userId) continue;

                    // Fetch runSummaries for this user
                    const runSnap = await db
                        .collection('users')
                        .doc(p.userId)
                        .collection('runSummaries')
                        .get();

                    let totalDistance = 0;
                    let totalRuns = 0;

                    for (const rDoc of runSnap.docs) {
                        const rd = rDoc.data();

                        // Parse timestamps
                        let runDate: number | null = null;
                        if (rd.completedAt) {
                            runDate = rd.completedAt.toDate ? rd.completedAt.toDate().getTime() / 1000 : (typeof rd.completedAt === 'number' ? rd.completedAt : null);
                        } else if (rd.createdAt) {
                            runDate = rd.createdAt.toDate ? rd.createdAt.toDate().getTime() / 1000 : (typeof rd.createdAt === 'number' ? rd.createdAt : null);
                        }

                        // Filter by challenge date range
                        if (startTs && runDate && runDate < startTs) continue;
                        if (endTs && runDate && runDate > endTs) continue;

                        totalDistance += rd.distance || 0;
                        totalRuns++;
                    }

                    // Also check fatBurnSummaries for treadmill runs
                    const fatBurnSnap = await db
                        .collection('users')
                        .doc(p.userId)
                        .collection('fatBurnSummaries')
                        .get();

                    for (const fbDoc of fatBurnSnap.docs) {
                        const fbd = fbDoc.data();
                        if (fbd.equipment !== 'treadmill') continue;
                        const dist = fbd.distance || 0;
                        if (dist <= 0) continue;

                        let runDate: number | null = null;
                        if (fbd.completedAt) {
                            runDate = fbd.completedAt.toDate ? fbd.completedAt.toDate().getTime() / 1000 : (typeof fbd.completedAt === 'number' ? fbd.completedAt : null);
                        } else if (fbd.createdAt) {
                            runDate = fbd.createdAt.toDate ? fbd.createdAt.toDate().getTime() / 1000 : (typeof fbd.createdAt === 'number' ? fbd.createdAt : null);
                        }

                        if (startTs && runDate && runDate < startTs) continue;
                        if (endTs && runDate && runDate > endTs) continue;

                        totalDistance += dist;
                        totalRuns++;
                    }

                    runEntries.push({
                        userId: p.userId,
                        username: p.username,
                        totalPoints: totalDistance, // Use distance as the primary metric
                        completedWorkouts: totalRuns,
                        metricFormatted: `${totalDistance.toFixed(1)} mi`,
                    });
                }

                // Sort by total distance descending
                runEntries.sort((a, b) => b.totalPoints - a.totalPoints);

                if (runEntries.length > 0) {
                    sortedParticipants = runEntries;
                    console.log(`[backfill-badges] Run round "${roundTitle}": top runner = ${runEntries[0]?.username} at ${runEntries[0]?.metricFormatted}`);
                }
            } else {
                sortedParticipants.sort((a, b) => b.totalPoints - a.totalPoints);
            }

            if (participants.length < 1) {
                await db.collection('round-badge-log').doc(roundId).set({
                    roundId,
                    processedAt: Math.floor(Date.now() / 1000),
                    participantCount: participants.length,
                    skipped: true,
                    reason: '0 participants',
                });
                continue;
            }

            // 4. Award top 3
            const top3 = sortedParticipants.slice(0, 3);
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

            // Build a snapshot of the top 3 for embedding in every badge
            const topParticipants = top3.map((tp, idx) => ({
                userId: tp.userId,
                username: tp.username,
                rank: idx + 1,
                totalPoints: roundType === 'run' ? Math.round(tp.totalPoints * 10) / 10 : tp.totalPoints,
                completedWorkouts: tp.completedWorkouts,
                metricFormatted: tp.metricFormatted || null,
            }));

            for (let i = 0; i < top3.length; i++) {
                const p = top3[i];
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
                    totalPoints: roundType === 'run' ? Math.round(p.totalPoints * 10) / 10 : p.totalPoints,
                    participantCount: participants.length,
                    completedWorkouts: p.completedWorkouts,
                    metricFormatted: p.metricFormatted || null,
                    topParticipants,
                    awardedAt: endDate,
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
                top3: top3.map((p, i) => ({
                    userId: p.userId,
                    username: p.username,
                    rank: i + 1,
                    totalPoints: p.totalPoints,
                    metricFormatted: p.metricFormatted || null,
                })),
                isBackfill: true,
            });

            await batch.commit();
            roundsProcessed++;
            console.log(`[backfill-badges] Processed ${roundTitle} (${roundType})`);
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
