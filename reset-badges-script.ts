import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as admin from 'firebase-admin';

// Initialize with the actual credentials
if (!admin.apps.length) {
    if (process.env.FIREBASE_SECRET_KEY) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: "quicklifts-dd3f1",
                privateKey: process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
                clientEmail: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
            })
        });
    } else {
        console.error('ERROR: FIREBASE_SECRET_KEY missing.');
        process.exit(1);
    }
}
const db = admin.firestore();

async function run() {
    console.log('[reset-badges] Starting wholesale reset of all badges and logs...');

    let deletedBadges = 0;
    let deletedLogs = 0;

    // 1. Delete all round-badge-log documents
    const logsSnap = await db.collection('round-badge-log').get();
    const logsBatch = db.batch();
    logsSnap.docs.forEach(doc => {
        logsBatch.delete(doc.ref);
        deletedLogs++;
    });
    await logsBatch.commit();
    console.log(`[reset-badges] Deleted ${deletedLogs} round-badge-log docs.`);

    // 2. Delete all badges from all users
    const badgesSnap = await db.collectionGroup('badges').get();

    let batch = db.batch();
    let currentBatchSize = 0;

    for (const doc of badgesSnap.docs) {
        batch.delete(doc.ref);
        deletedBadges++;
        currentBatchSize++;

        if (currentBatchSize >= 400) {
            await batch.commit();
            batch = db.batch();
            currentBatchSize = 0;
        }
    }
    if (currentBatchSize > 0) {
        await batch.commit();
    }

    console.log(`[reset-badges] Deleted ${deletedBadges} old badges.`);

    // 3. Now run the backfill
    console.log('\n[backfill-badges] Starting backfill...');

    const collectionsSnap = await db
        .collection('sweatlist-collection')
        .where('challenge.status', '==', 'completed')
        .get();

    if (collectionsSnap.empty) {
        console.log('No completed rounds found.');
        return;
    }

    let roundsProcessed = 0;
    let badgesAwarded = 0;

    for (const doc of collectionsSnap.docs) {
        const data = doc.data();
        const challenge = data.challenge;
        if (!challenge) continue;

        const roundId = challenge.id || doc.id;
        const roundTitle = challenge.title || 'Round';

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

        participants.sort((a: any, b: any) => b.totalPoints - a.totalPoints);

        // Require at least 3 participants for a competition to be badge-worthy
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

        // Award ONLY the top 1
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

        const bBatch = db.batch();

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
            bBatch.set(badgeRef, badgeData);

            badgesAwarded++;
        }

        bBatch.set(db.collection('round-badge-log').doc(roundId), {
            roundId,
            roundTitle,
            processedAt: Math.floor(Date.now() / 1000),
            participantCount: participants.length,
            top1: top1.map((p: any, i: number) => ({
                userId: p.userId,
                username: p.username,
                rank: i + 1,
                totalPoints: p.totalPoints,
            })),
            isBackfill: true,
        });

        await bBatch.commit();
        roundsProcessed++;
        console.log(`[backfill-badges] Processed ${roundTitle}`);
    }

    console.log(`\n[backfill-badges] Done. Rounds: ${roundsProcessed}, Badges: ${badgesAwarded}`);
}

run().then(() => {
    console.log('Script finish');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
