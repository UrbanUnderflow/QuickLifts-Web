import { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const db = admin.firestore();
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
        // Since we can't easily query cross-collection without a collectionGroup query that might need indexes,
        // we can use a collectionGroup query. Let's try it:
        const badgesSnap = await db.collectionGroup('badges').get();

        let batch = db.batch();
        let currentBatchSize = 0;

        for (const doc of badgesSnap.docs) {
            batch.delete(doc.ref);
            deletedBadges++;
            currentBatchSize++;

            if (currentBatchSize >= 500) {
                await batch.commit();
                batch = db.batch();
                currentBatchSize = 0;
            }
        }
        if (currentBatchSize > 0) {
            await batch.commit();
        }

        console.log(`[reset-badges] Deleted ${deletedBadges} old badges.`);

        return res.status(200).json({
            success: true,
            deletedLogs,
            deletedBadges
        });

    } catch (err: any) {
        console.error('[reset-badges] Error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
