#!/usr/bin/env node
/**
 * Direct lookup of a specific workout summary.
 * Finds user by username, then reads doc directly by path.
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let credential;
try {
    credential = cert(require(path.join(__dirname, '..', 'serviceAccountKey.json')));
} catch {
    credential = cert({
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
    });
}

const app = initializeApp({ credential }, 'inspect-direct');
const db = getFirestore(app);

const summaryId = process.argv[2] || '6rKhFX3sPhXe2ROn1YpJ';
const username = process.argv[3] || 'thetrefecta';

async function run() {
    // Step 1: Find user by username
    console.log(`Looking up user "${username}"...`);
    const userSnap = await db.collection('users').where('username', '==', username).limit(1).get();

    if (userSnap.empty) {
        console.log('User not found by username. Trying known IDs from backfill...');
        // Try known creator IDs from the backfill output
        const knownIds = [
            'Bq6zlqIlSdPUGki6gsv6X9TdVtG3',
            'NEJlgfPcxga02bP9uM7fNIPK5Mv2',
            'UEaL0Tl53mW7uGmiLtFFPSL89Vf1',
            'pcBqSCWCqKSou0uiSnBmNCaqDTh2',
            'iNCW0VxnG3SAtr0IKIAoB3n3EF33',
            'vGeG8IE9UzMVEDoFqbE1dKh1DWW2',
        ];
        for (const uid of knownIds) {
            const doc = await db.doc(`users/${uid}/workoutSummary/${summaryId}`).get();
            if (doc.exists) {
                return processDoc(doc, uid);
            }
        }
        console.log('Not found under known creator IDs either.');
        process.exit(1);
    }

    const userId = userSnap.docs[0].id;
    console.log(`Found user "${username}" → userId: ${userId}`);

    // Step 2: Direct document read
    console.log(`Reading users/${userId}/workoutSummary/${summaryId} ...`);
    const doc = await db.doc(`users/${userId}/workoutSummary/${summaryId}`).get();

    if (!doc.exists) {
        console.log('Doc NOT found at that path. Listing their summaries to see what IDs look like...');
        const allSummaries = await db.collection(`users/${userId}/workoutSummary`).limit(5).get();
        console.log(`Sample summary IDs for this user (first 5):`);
        allSummaries.docs.forEach(d => console.log(`  - ${d.id}`));
        process.exit(0);
    }

    return processDoc(doc, userId);
}

function processDoc(doc, workoutUserId) {
    const data = doc.data();
    const userId = data.userId || workoutUserId;

    console.log('\n✅ Document found at path:', doc.ref.path);
    console.log('Workout User ID (person who did the workout):', userId);
    console.log('Workout Title:', data.workoutTitle || '(none)');

    const exercises = data.exercisesCompleted || [];
    console.log('Total completed exercises:', exercises.length);

    exercises.forEach((log, i) => {
        const exercise = log.exercise || {};
        const videos = exercise.videos || [];
        const pos = exercise.currentVideoPosition || 0;

        console.log(`\n--- Exercise ${i + 1}: ${exercise.name || '(unknown)'} ---`);
        console.log(`  currentVideoPosition: ${pos}`);
        console.log(`  videos count: ${videos.length}`);

        if (videos.length > 0) {
            const safePos = Math.max(0, Math.min(pos, videos.length - 1));
            const v = videos[safePos];
            console.log(`  ➜ Video owner userId: ${v.userId || '(empty)'}`);
            console.log(`  ➜ Video owner username: ${v.username || '(empty)'}`);

            if (!v.userId) {
                console.log('  ⚠️  PROBLEM: userId is empty — backfill SKIPS this');
            } else if (v.userId === userId) {
                console.log('  ⚠️  SKIPPED: creator === workout user (self-use)');
            } else {
                console.log(`  ✅ Would award +1 to creator ${v.userId}`);
            }
        } else {
            console.log('  ⚠️  PROBLEM: No videos — backfill SKIPS this');
        }
    });

    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
