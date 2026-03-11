#!/usr/bin/env node

/**
 * fix-duplicate-runs.js
 *
 * One-time admin script to find and remove duplicate runSummary documents
 * for a specific user (default: 'deray'). Three identical runs appeared in
 * the run challenge leaderboard — this script deletes the two extra copies,
 * keeping the earliest createdAt as the canonical record.
 *
 * Also detects cross-collection duplicates (runSummaries vs appleWatchWorkoutSummaries)
 * which are handled by the code fix in RunRoundScoringService — those don't need
 * to be deleted, just de-duped at query time.
 *
 * Usage:
 *   node scripts/fix-duplicate-runs.js              # dry run (default, no writes)
 *   node scripts/fix-duplicate-runs.js --live       # actually delete duplicates
 *   node scripts/fix-duplicate-runs.js --user=deray # specify a different username
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ─── Firebase Admin Setup (same pattern as all scripts in this folder) ───────
let credential;
try {
    const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    credential = cert(require(keyPath));
} catch {
    const SERVICE_ACCOUNT = {
        type: 'service_account',
        project_id: 'quicklifts-dd3f1',
        private_key_id: '***REMOVED***',
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY || "***REMOVED***",
        client_email: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
        client_id: '111494077667496751062',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com',
        universe_domain: 'googleapis.com'
    };
    credential = cert(SERVICE_ACCOUNT);
}

const app = initializeApp({ credential }, 'fix-duplicate-runs');
const db = getFirestore(app);

// ─── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const userArg = args.find(a => a.startsWith('--user='));
const TARGET_USERNAME = userArg ? userArg.split('=')[1] : 'deray';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts) {
    if (!ts || ts === 0) return 'N/A';
    return new Date(ts * 1000).toLocaleString();
}

function makeDedupeKey(run) {
    // Two runs are "the same" if they share startTime (±1s), distance (4dp), and duration (exact).
    const dist = Math.round((run.distance || 0) * 10000) / 10000;
    const dur = run.duration || 0;
    const start = Math.round(run.startTime || run.completedAt || run.createdAt || 0);
    return `${start}|${dist}|${dur}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log(`║  DUPLICATE RUN FIXER  [${LIVE ? '⚠️  LIVE — WILL DELETE' : '🔒 DRY RUN — no changes'}]`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(`Target username: ${TARGET_USERNAME}`);

    // Step 1: Resolve user
    const usersSnap = await db.collection('users')
        .where('username', '==', TARGET_USERNAME)
        .limit(5)
        .get();

    if (usersSnap.empty) {
        console.error(`\n❌ No user found with username "${TARGET_USERNAME}". Aborting.`);
        process.exit(1);
    }

    const userDoc = usersSnap.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    console.log(`\n✅ Found user: userId=${userId}, displayName=${userData.displayName || 'N/A'}\n`);

    // Step 2: Fetch all runSummaries
    console.log(`── Fetching runSummaries for ${userId}...`);
    const runsSnap = await db.collection('users').doc(userId)
        .collection('runSummaries')
        .get();
    console.log(`   Found ${runsSnap.docs.length} total runSummary docs\n`);

    // Step 3: Group by dedupe key
    const groups = {};
    for (const doc of runsSnap.docs) {
        const data = doc.data();
        const key = makeDedupeKey(data);
        if (!groups[key]) groups[key] = [];
        groups[key].push({ id: doc.id, data, ref: doc.ref });
    }

    const duplicateGroups = Object.entries(groups).filter(([, docs]) => docs.length > 1);

    if (duplicateGroups.length === 0) {
        console.log('✅ No duplicate runSummary documents found.');
        console.log('   (The triple-count may be purely from cross-collection duplication:');
        console.log('    runSummaries + appleWatchWorkoutSummaries — that is handled by');
        console.log('    the code fix in RunRoundScoringService, no Firestore cleanup needed.)\n');
    } else {
        console.log(`Found ${duplicateGroups.length} duplicate group(s):\n`);
    }

    let totalDeleted = 0;

    for (const [key, docs] of duplicateGroups) {
        // Sort by createdAt ascending — keep the earliest (most canonical)
        docs.sort((a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0));

        console.log(`  ┌─ Duplicate group (${docs.length} docs)`);
        console.log(`  │  key="${key}"`);
        docs.forEach((d, i) => {
            const tag = i === 0 ? '✅ KEEP  ' : '🗑️  DELETE';
            console.log(`  │  [${tag}] id=${d.id}`);
            console.log(`  │           distance=${d.data.distance} mi, duration=${d.data.duration}s`);
            console.log(`  │           startTime=${formatDate(d.data.startTime)}, createdAt=${formatDate(d.data.createdAt)}`);
        });
        console.log('  └─\n');

        if (LIVE) {
            const toDelete = docs.slice(1);
            for (const d of toDelete) {
                await d.ref.delete();
                console.log(`  🗑️  Deleted: ${d.id}`);
                totalDeleted++;
            }
        }
    }

    // Step 4: Cross-collection overlap check (informational only — no deletes needed)
    console.log('── Checking for cross-collection overlaps (appleWatchWorkoutSummaries)...');
    const appleSnap = await db.collection('users').doc(userId)
        .collection('appleWatchWorkoutSummaries')
        .get();

    let appleOverlaps = 0;
    for (const doc of appleSnap.docs) {
        const data = doc.data();
        const activityType = (data.activityType || '').toLowerCase();
        if (!['walking', 'running'].includes(activityType)) continue;
        const dist = data.distance || 0;
        if (dist <= 0) continue;

        const overlap = Object.keys(groups).find(key => {
            const keyDist = parseFloat(key.split('|')[1]);
            return Math.abs(keyDist - dist) < 0.02;
        });

        if (overlap) {
            appleOverlaps++;
            console.log(`   ⚠️  Apple Watch doc ${doc.id} (${activityType}, ${dist} mi) overlaps a runSummary with same distance.`);
            console.log(`      → This cross-collection duplicate is handled by the RunRoundScoringService code fix (no delete needed).`);
        }
    }
    if (appleOverlaps === 0) {
        console.log('   No cross-collection overlaps found.\n');
    }

    // Summary
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log(`║  SUMMARY`);
    console.log(`║  Duplicate groups in runSummaries: ${duplicateGroups.length}`);
    console.log(`║  Documents deleted: ${LIVE ? totalDeleted : `0 (dry run)`}`);
    console.log(`║  Cross-collection (Apple Watch) overlaps: ${appleOverlaps}`);
    if (!LIVE) {
        console.log('║');
        console.log('║  🔒 DRY RUN — no data was changed.');
        console.log('║  Rerun with --live to apply deletions.');
    }
    console.log('╚══════════════════════════════════════════════════════════╝\n');
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('[Fatal]', err);
        process.exit(1);
    });
