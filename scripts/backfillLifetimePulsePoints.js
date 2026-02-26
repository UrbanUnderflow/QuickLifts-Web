#!/usr/bin/env node

/**
 * Backfill lifetimePulsePoints for all users.
 *
 * Aggregates Pulse Points from THREE sources per user:
 *   1. workout-summaries   → each doc has pulsePoints.totalPoints (or computed sum)
 *   2. runSummaries         → each doc has pulsePoints.totalPoints
 *   3. fatBurnSummaries     → each doc has pulsePoints.totalPoints
 *   4. user-challenges      → each doc has pulsePoints.totalPoints (challenge participation)
 *
 * The final lifetimePulsePoints = SUM of all totalPoints across these collections.
 *
 * Usage:
 *   node scripts/backfillLifetimePulsePoints.js              # run backfill
 *   node scripts/backfillLifetimePulsePoints.js --dry-run    # log only, no writes
 *   node scripts/backfillLifetimePulsePoints.js --limit=10   # process first 10 users only
 *
 * Requires Firebase Admin credentials. Uses serviceAccountKey.json at project root.
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Firebase Admin setup
let credential;
try {
    const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    credential = cert(require(keyPath));
} catch {
    const SERVICE_ACCOUNT = {
        type: 'service_account',
        project_id: 'quicklifts-dd3f1',
        private_key_id: 'abbd015806ef3b43d93101522f12d029e736f447',
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY || "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEZkOP1Kz/jfQc\nLrN2SKLVdRNCZHGHN+wcfqQXknnD47Y6GBA35O1573Ipk5FaRNvxysB/YP/Z9dLP\nOO/xk8yRA+FFI32kzQlBIpVHDVN/upfXRWS/38+1kktPD3EjwEFRB8HvYVopCm1k\nCaFOZZfrrHM2IEdboKDt3ByLoNNPLZhivcurhBm4PENNEVlyMiqqWBwTu0sFGkZ8\nLHQ4JGtaPe5VomlpVlokKmdQzEwVTWexSeQkbdXnYkd1m/sfT3mjP6RLBlXlJ4f/\nOp36QofqPxNRV7TJ/YkrL2nOLo6gq6XWS3ciVINUS9cuPlEIg+5OrR4eQUYhay3N\n5dakXn+ZAgMBAAECggEAJv+de9KB1a8E4ZG+bgbnWpaIT/8s8eo/Vrso70tVJXoy\nhZ+gnNC2/Sb4VtwoGTIiMIWPqtuCgm/HQAGw15n/HW6VTUrKWK6kH0x0MuspAOx2\n2Ta81kLldksJ7DWHRE+ZSLNPJa8BnbOl3B7zamNPAuu35vAK611eh0zVWD6Dpy1v\n7933i/pOMpvDY0ieoT0pl0GJcCVOBTS2f8z1+huepW5++G0TrTCZdq9ixCF68xEc\nyGTr1Dz/Qdv4gIO2SNk3TfKmw/HaL3tQM1izdMsJVs+nPxzmHj3tLnppyQJJFwcF\nZ1njhg6eSHPOINU/wu2KL2B+pXiROBLQr1JnvJsCZwKBgQDsYNrmbDhShYeU+OSs\nSaQx0POBeZFtlsMIbJomTSDr73Gn4ZXJaXfNoqvIuJel5SCTytK36Y+84/S3xeuy\nmXGMpfqBmEilMU5D4VOmSH/HFH6+35m1LWFw3aWSVGuUSIEQoWTKjWB9zQVwFd5w\nEw6HsuNm1IJvsEfZpzXpcydBMwKBgQDUs9cLfY93MbkT5M/WL9jbPp846HZxvzeW\nGiBR7gMAPMre32DPDKQKqnRVAvXJPhd8mKjC3T4gRm+NBWKLQjIUO0RQoVG39HN/\n9yGBTyLMccJf5d9MZe5OIwkVhbN5ekPucNhqHJQEIVz0duZ7UhFgfgLSroy/04vA\ndjgGeGxUAwKBgD+9Pkm0FNvrtcut8bujf+sO9RqMtXJfnOfAoTCCy8XTI0qpwcI1\n9mA05S2S2RGa31X68yc0i9Xbgjmr3Qqj5cKPXyVi8vPYf8o+EFheZFZCaIr/sGry\nebv9iJAUw42Qn3zkiFE2HjbN+hFnVDvUZ66fxkIMO7/yQO2n8RmqO4ORAoGAFbqV\nglf+WvfaZ1zdmoziw2r/Swn8Z5xYKl5a5OPCrLiJJQF+20f4ThqhrbmSsE9GiPTz\ncIy3dwabCLX/HijSAt0XGoGQXpF7Zxww8QvLi0UnzTIngJ99G8BagjdZYVSLMgWX\nJifrOwzJeTPYUcrNeaUF1s38FPCgezXYfVi6AE8CgYEAv+9EP3q6zY51CMtXKb04\n1yLrnZze20aUMmAQ0KE1nH9ZRk7GgT+Bbmq1Nw6Ro3xItPffX42S5w8jDhiZJK/j\neVGloaXM9MHG2uTPWSVlUJ2ew2LcYpq42PbJUuS06teFFPohMCOs7urTc0Vdya5u\ngTynFJmBFslLO3UKNPAshn0=\n-----END PRIVATE KEY-----\n",
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

const app = initializeApp({ credential }, 'backfill-lifetime-pulse-points');
const db = getFirestore(app);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Math.max(0, parseInt(limitArg.split('=')[1], 10)) : 0;

// ─── Hunter Rank thresholds (mirrors HunterRank.swift) ─────────────────
function hunterRank(points) {
    if (points >= 100_000) return 'S-Rank';
    if (points >= 40_000) return 'A-Rank';
    if (points >= 15_000) return 'B-Rank';
    if (points >= 5_000) return 'C-Rank';
    if (points >= 1_000) return 'D-Rank';
    return 'E-Rank';
}

/**
 * Sum totalPoints from a user's subcollection where each doc has a `pulsePoints` map.
 */
async function sumPointsFromSubcollection(userId, subcollectionName) {
    const snap = await db.collection('users').doc(userId).collection(subcollectionName).get();
    let total = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        const pp = data.pulsePoints;
        if (pp) {
            // Use pre-computed totalPoints if available, otherwise sum manually
            if (typeof pp.totalPoints === 'number') {
                total += pp.totalPoints;
            } else {
                // Manual sum matching PulsePoints.totalPoints computation
                const stack = (pp.baseCompletion || 0) + (pp.firstCompletion || 0) +
                    (pp.streakBonus || 0) + (pp.checkInBonus || 0) +
                    (pp.effortRating || 0) + (pp.mealTrackingBonus || 0) + (pp.stepPoints || 0);
                const community = (pp.chatParticipation || 0) + (pp.locationCheckin || 0) +
                    (pp.contentEngagement || 0) + (pp.encouragementSent || 0) +
                    (pp.encouragementReceived || 0);
                const extra = (pp.cumulativeStreakBonus || 0) + (pp.shareBonus || 0) +
                    (pp.referralBonus || 0) + (pp.peerChallengeBonus || 0) +
                    (pp.physicalCheckInBonus || 0);
                total += stack + community + extra;
            }
        }
    }
    return { total, docCount: snap.size };
}

/**
 * Sum totalPoints from user-challenges (top-level collection, filtered by userId).
 */
async function sumPointsFromChallenges(userId) {
    const snap = await db.collection('user-challenges')
        .where('userId', '==', userId)
        .get();
    let total = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        const pp = data.pulsePoints;
        if (pp) {
            if (typeof pp.totalPoints === 'number') {
                total += pp.totalPoints;
            } else {
                const stack = (pp.baseCompletion || 0) + (pp.firstCompletion || 0) +
                    (pp.streakBonus || 0) + (pp.checkInBonus || 0) +
                    (pp.effortRating || 0) + (pp.mealTrackingBonus || 0) + (pp.stepPoints || 0);
                const community = (pp.chatParticipation || 0) + (pp.locationCheckin || 0) +
                    (pp.contentEngagement || 0) + (pp.encouragementSent || 0) +
                    (pp.encouragementReceived || 0);
                const extra = (pp.cumulativeStreakBonus || 0) + (pp.shareBonus || 0) +
                    (pp.referralBonus || 0) + (pp.peerChallengeBonus || 0) +
                    (pp.physicalCheckInBonus || 0);
                total += stack + community + extra;
            }
        }
    }
    return { total, docCount: snap.size };
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║   Backfill lifetimePulsePoints → Hunter Rank System        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    if (dryRun) console.log('🔒 DRY RUN — no writes.\n');
    if (limit) console.log(`📦 Limit: ${limit} users.\n`);

    const usersSnap = await db.collection('users').get();
    const userDocs = usersSnap.docs;
    const toProcess = limit ? userDocs.slice(0, limit) : userDocs;
    console.log(`Total users: ${userDocs.length}. Will process: ${toProcess.length}.\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const rankDistribution = {};

    let processed = 0;
    const BATCH_SIZE = 50;

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
        const batchDocs = toProcess.slice(i, i + BATCH_SIZE);

        await Promise.all(batchDocs.map(async (userDoc) => {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const username = userData.username || '(no username)';

            try {
                // Workouts from TOP LEVEL collection 'workout-summaries'
                const workoutsSnap = await db.collection('workout-summaries')
                    .where('userId', '==', userId)
                    .get();
                let workoutsTotal = 0;
                workoutsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    const pp = data.pulsePoints;
                    if (pp) {
                        if (typeof pp.totalPoints === 'number') {
                            workoutsTotal += pp.totalPoints;
                        } else {
                            workoutsTotal += (pp.baseCompletion || 0) + (pp.firstCompletion || 0) + (pp.streakBonus || 0) + (pp.checkInBonus || 0) + (pp.effortRating || 0) + (pp.mealTrackingBonus || 0) + (pp.stepPoints || 0) + (pp.chatParticipation || 0) + (pp.locationCheckin || 0) + (pp.contentEngagement || 0) + (pp.encouragementSent || 0) + (pp.encouragementReceived || 0) + (pp.cumulativeStreakBonus || 0) + (pp.shareBonus || 0) + (pp.referralBonus || 0) + (pp.peerChallengeBonus || 0) + (pp.physicalCheckInBonus || 0);
                        }
                    } else if (data.pulsePointsEarned) {
                        workoutsTotal += (data.pulsePointsEarned || 0);
                    }
                });

                // Runs and FatBurns from SUBCOLLECTION
                const runs = await sumPointsFromSubcollection(userId, 'runSummaries');
                const fatBurns = await sumPointsFromSubcollection(userId, 'fatBurnSummaries');

                // Challenges
                const challenges = await sumPointsFromChallenges(userId);

                const lifetimeTotal = workoutsTotal + runs.total + fatBurns.total + challenges.total;
                const rank = hunterRank(lifetimeTotal);

                // Track distribution
                rankDistribution[rank] = (rankDistribution[rank] || 0) + 1;

                const currentValue = userData.lifetimePulsePoints;
                if (currentValue === lifetimeTotal) {
                    skipped++;
                    processed++;
                    return;
                }

                if (!dryRun) {
                    await db.collection('users').doc(userId).update({ lifetimePulsePoints: lifetimeTotal });
                }
                updated++;

                const prevLabel = typeof currentValue === 'number' ? currentValue : '(missing)';
                console.log(`  ${dryRun ? '[would update]' : '✅'} @${username}: ${prevLabel} → ${lifetimeTotal} (${rank})`);
                processed++;
            } catch (err) {
                errors++;
                console.error(`  ❌ @${username} (${userId}): ${err.message}`);
                processed++;
            }
        }));

        console.log(`⏳ Progress: ${processed}/${toProcess.length}`);
    }
    console.log('\n═══════════════════════════════════════════════');
    console.log(`${dryRun ? '🔒 DRY RUN' : '✅ DONE'}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped (already correct): ${skipped}`);
    console.log(`  Errors: ${errors}`);

    console.log('\n📊 Rank Distribution:');
    const rankOrder = ['E-Rank', 'D-Rank', 'C-Rank', 'B-Rank', 'A-Rank', 'S-Rank'];
    for (const r of rankOrder) {
        const count = rankDistribution[r] || 0;
        const bar = '█'.repeat(Math.min(count, 50));
        console.log(`  ${r.padEnd(7)}: ${bar} ${count}`);
    }

    if (dryRun) {
        console.log('\n💡 To apply for real, run without --dry-run.');
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
