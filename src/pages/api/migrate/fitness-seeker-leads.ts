import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

/**
 * API Route: /api/migrate/fitness-seeker-leads
 * 
 * One-time migration endpoint that:
 * 1. Reads all users from bulk-dev-26ba8 Realtime Database (REST API)
 * 2. Writes them to fitnessSeeker_leads collection in QuickLifts Firestore
 * 
 * Call via: POST /api/migrate/fitness-seeker-leads
 */

async function fetchFromRTDB(): Promise<[string, any][]> {
    const url = 'https://bulk-dev-26ba8.firebaseio.com/User.json';
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`RTDB fetch failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data) return [];
    return Object.entries(data);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        console.log('[Migration API] Starting Fitness Seeker Leads migration...');

        // Step 1: Fetch from RTDB
        const userEntries = await fetchFromRTDB();
        console.log(`[Migration API] Fetched ${userEntries.length} users from RTDB`);

        if (userEntries.length === 0) {
            return res.status(200).json({ message: 'No users found in RTDB', count: 0 });
        }

        // Step 2: Write to Firestore in batches
        const db = admin.firestore();
        const collectionRef = db.collection('fitnessSeeker_leads');
        const batchSize = 500;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < userEntries.length; i += batchSize) {
            const batchEntries = userEntries.slice(i, i + batchSize);
            const batch = db.batch();

            for (const [rtdbKey, userData] of batchEntries) {
                const docRef = collectionRef.doc(rtdbKey);

                // Map known fields
                const doc: Record<string, any> = {
                    rtdbKey,
                    name: userData.name || null,
                    email: userData.email || null,
                    username: userData.username || null,
                    uid: userData.uid || userData.objectId || null,
                    objectId: userData.objectId || null,
                    gender: userData.gender || null,
                    birthdate: userData.birthdate || null,
                    height: userData.height || null,
                    weight: userData.weight || null,
                    bodyFat: userData.bodyFat || null,
                    goal: userData.goal || null,
                    focusArea: userData.focusArea || null,
                    level: userData.level || null,
                    idlWeight: userData.idlWeight || null,
                    gainPerWeek: userData.gainPerWeek || null,
                    calorieReq: userData.calorieReq || null,
                    proteinReq: userData.proteinReq || null,
                    fatReq: userData.fatReq || null,
                    dairyReq: userData.dairyReq || null,
                    fruitReq: userData.fruitReq || null,
                    grainReq: userData.grainReq || null,
                    vegReq: userData.vegReq || null,
                    LBM: userData.LBM || null,
                    lifestyleMultiplier: userData.lifestyleMultiplier || null,
                    max: userData.max || null,
                    score: userData.score || null,
                    unit: userData.unit || null,
                    createdAt: userData.createdAt || null,
                    updatedAt: userData.updatedAt || null,
                    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                    sourceProject: 'bulk-dev-26ba8',
                    sourceCollection: 'User',
                };

                // Capture any extra fields not explicitly mapped
                const knownFields = new Set([
                    'name', 'email', 'username', 'uid', 'objectId',
                    'gender', 'birthdate', 'height', 'weight', 'bodyFat',
                    'goal', 'focusArea', 'level', 'idlWeight', 'gainPerWeek',
                    'calorieReq', 'proteinReq', 'fatReq', 'dairyReq', 'fruitReq', 'grainReq', 'vegReq',
                    'LBM', 'lifestyleMultiplier', 'max', 'score', 'unit',
                    'createdAt', 'updatedAt'
                ]);

                if (typeof userData === 'object' && userData !== null) {
                    for (const [key, value] of Object.entries(userData)) {
                        if (!knownFields.has(key) && value !== undefined) {
                            doc[key] = value;
                        }
                    }
                }

                batch.set(docRef, doc, { merge: true });
            }

            try {
                await batch.commit();
                successCount += batchEntries.length;
                console.log(`[Migration API] Batch committed: ${successCount}/${userEntries.length} (${Math.round(successCount / userEntries.length * 100)}%)`);
            } catch (err: any) {
                errorCount += batchEntries.length;
                console.error(`[Migration API] Batch error at offset ${i}:`, err.message);
            }
        }

        console.log(`[Migration API] Complete! Success: ${successCount}, Errors: ${errorCount}`);

        return res.status(200).json({
            message: 'Migration complete',
            total: userEntries.length,
            success: successCount,
            errors: errorCount,
        });
    } catch (error: any) {
        console.error('[Migration API] Fatal error:', error);
        return res.status(500).json({ error: error.message });
    }
}

// Increase timeout for this long-running API route
export const config = {
    api: {
        responseLimit: false,
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
};
