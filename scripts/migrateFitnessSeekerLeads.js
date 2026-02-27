#!/usr/bin/env node

/**
 * Migration Script: Fitness Seeker Leads
 * 
 * Reads all users from the bulk-dev-26ba8 Realtime Database
 * and writes them to the fitnessSeeker_leads collection in QuickLifts Firestore.
 * 
 * Usage:
 *   node scripts/migrateFitnessSeekerLeads.js
 * 
 * Prerequisites:
 *   - FIREBASE_SECRET_KEY env var must be set (for QuickLifts Firestore write access)
 *   - Or run from a machine with application default credentials
 */

const https = require('https');

// ─── 1. Read from Realtime Database via REST API ──────────────────────────────

function fetchRealtimeDBUsers() {
    return new Promise((resolve, reject) => {
        const url = 'https://bulk-dev-26ba8.firebaseio.com/User.json';
        console.log('[Migration] Fetching users from Realtime Database...');
        console.log(`[Migration] URL: ${url}`);

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (!parsed) {
                        reject(new Error('No data returned from Realtime Database'));
                        return;
                    }
                    const entries = Object.entries(parsed);
                    console.log(`[Migration] Fetched ${entries.length} users from RTDB`);
                    resolve(entries);
                } catch (err) {
                    reject(new Error(`Failed to parse RTDB response: ${err.message}`));
                }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

// ─── 2. Write to QuickLifts Firestore ─────────────────────────────────────────

async function writeToFirestore(userEntries) {
    // Dynamic import of firebase-admin
    const admin = require('firebase-admin');

    // Initialize Firebase Admin for QuickLifts
    if (!admin.apps.length) {
        if (process.env.FIREBASE_SECRET_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: 'quicklifts-dd3f1',
                    privateKey: process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
                    clientEmail: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
                }),
            });
            console.log('[Migration] Firebase Admin initialized with credentials');
        } else {
            // Try application default credentials
            admin.initializeApp({
                projectId: 'quicklifts-dd3f1',
                credential: admin.credential.applicationDefault(),
            });
            console.log('[Migration] Firebase Admin initialized with application default credentials');
        }
    }

    const db = admin.firestore();
    const collectionRef = db.collection('fitnessSeeker_leads');

    console.log(`[Migration] Writing ${userEntries.length} users to fitnessSeeker_leads collection...`);

    let successCount = 0;
    let errorCount = 0;
    const batchSize = 500; // Firestore batch limit

    // Process in batches of 500
    for (let i = 0; i < userEntries.length; i += batchSize) {
        const batchEntries = userEntries.slice(i, i + batchSize);
        const batch = db.batch();

        for (const [rtdbKey, userData] of batchEntries) {
            // Use the RTDB key as the doc ID for traceability
            const docRef = collectionRef.doc(rtdbKey);

            // Flatten and normalize the data
            const doc = {
                // Original RTDB key
                rtdbKey,

                // Core profile fields
                name: userData.name || null,
                email: userData.email || null,
                username: userData.username || null,
                uid: userData.uid || userData.objectId || null,
                objectId: userData.objectId || null,

                // Demographics
                gender: userData.gender || null,
                birthdate: userData.birthdate || null,
                height: userData.height || null,
                weight: userData.weight || null,
                bodyFat: userData.bodyFat || null,

                // Fitness goals
                goal: userData.goal || null,
                focusArea: userData.focusArea || null,
                level: userData.level || null,
                idlWeight: userData.idlWeight || null,
                gainPerWeek: userData.gainPerWeek || null,

                // Nutrition requirements
                calorieReq: userData.calorieReq || null,
                proteinReq: userData.proteinReq || null,
                fatReq: userData.fatReq || null,
                dairyReq: userData.dairyReq || null,
                fruitReq: userData.fruitReq || null,
                grainReq: userData.grainReq || null,
                vegReq: userData.vegReq || null,

                // Fitness data
                LBM: userData.LBM || null,
                lifestyleMultiplier: userData.lifestyleMultiplier || null,
                max: userData.max || null, // JSON string of lift maxes
                score: userData.score || null,
                unit: userData.unit || null,

                // Timestamps
                createdAt: userData.createdAt || null,
                updatedAt: userData.updatedAt || null,

                // Migration metadata
                migratedAt: admin.firestore.FieldValue.serverTimestamp(),
                sourceProject: 'bulk-dev-26ba8',
                sourceCollection: 'User',
            };

            // Also spread any additional fields we might have missed
            // to capture ALL data from the source
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
                        // Store any extra fields we didn't explicitly map
                        doc[key] = value;
                    }
                }
            }

            batch.set(docRef, doc, { merge: true });
        }

        try {
            await batch.commit();
            successCount += batchEntries.length;
            console.log(`[Migration] Batch committed: ${successCount}/${userEntries.length} (${Math.round(successCount / userEntries.length * 100)}%)`);
        } catch (err) {
            errorCount += batchEntries.length;
            console.error(`[Migration] Batch error at offset ${i}:`, err.message);
        }
    }

    console.log('\n[Migration] ═══════════════════════════════════════');
    console.log(`[Migration] Complete!`);
    console.log(`[Migration]   ✅ Successfully written: ${successCount}`);
    console.log(`[Migration]   ❌ Errors: ${errorCount}`);
    console.log(`[Migration]   📦 Total: ${userEntries.length}`);
    console.log(`[Migration]   📁 Collection: fitnessSeeker_leads`);
    console.log('[Migration] ═══════════════════════════════════════\n');
}

// ─── 3. Main ──────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n══════════════════════════════════════════════════');
    console.log('  Fitness Seeker Leads Migration');
    console.log('  bulk-dev-26ba8 (RTDB) → quicklifts-dd3f1 (Firestore)');
    console.log('══════════════════════════════════════════════════\n');

    try {
        // Step 1: Fetch from RTDB
        const userEntries = await fetchRealtimeDBUsers();

        if (userEntries.length === 0) {
            console.log('[Migration] No users found. Exiting.');
            process.exit(0);
        }

        // Step 2: Preview a sample
        const [sampleKey, sampleData] = userEntries[0];
        console.log(`\n[Migration] Sample user (${sampleKey}):`);
        console.log(JSON.stringify(sampleData, null, 2).substring(0, 500));
        console.log('...\n');

        // Step 3: Write to Firestore
        await writeToFirestore(userEntries);

        process.exit(0);
    } catch (err) {
        console.error('[Migration] Fatal error:', err);
        process.exit(1);
    }
}

main();
