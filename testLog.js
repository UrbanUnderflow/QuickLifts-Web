const admin = require('firebase-admin/app');
const { resolveAdminCredential } = require('./scripts/lib/resolveAdminCredential');
const { getFirestore } = require('firebase-admin/firestore');

const credential = resolveAdminCredential();
const app = admin.initializeApp({ credential });
const db = getFirestore(app);

async function run() {
    const docId = '6rKhFX3sPhXe2ROn1YpJ';

    console.log('Searching for Workout Summary:', docId);

    // Some of the docs store ID natively, some don't.
    const snapshot = await db.collectionGroup('workoutSummary').where('id', '==', docId).get();

    if (snapshot.empty) {
        console.log('Document not found via `id` field. Scanning raw documents natively by doc.id...');
        const stream = db.collectionGroup('workoutSummary').stream();
        let found = null;

        for await (const doc of stream) {
            if (doc.id === docId) {
                found = doc;
                break;
            }
        }

        if (!found) {
            console.log('Document strictly not found ANYWHERE in the database.');
            process.exit(0);
        } else {
            processDoc(found);
        }
    } else {
        processDoc(snapshot.docs[0]);
    }
}

function processDoc(doc) {
    const data = doc.data();
    console.log('\n✅ Document found at path:', doc.ref.path);
    console.log('User ID logged workout:', data.userId || doc.ref.parent.parent.id);

    const exercises = data.exercisesCompleted || [];
    console.log('Total completed exercises in this workout:', exercises.length);

    exercises.forEach((log, index) => {
        const exercise = log.exercise || {};
        const videos = exercise.videos || [];
        const currentVideoPosition = exercise.currentVideoPosition || 0;

        console.log('\n--- Exercise ' + (index + 1) + ': ' + exercise.name + ' ---');
        console.log('currentVideoPosition stored in doc:', currentVideoPosition);
        console.log('number of videos physically attached in array:', videos.length);

        if (videos.length > 0) {
            const pos = Math.max(0, Math.min(currentVideoPosition, videos.length - 1));
            const selectedVideo = videos[pos];
            console.log('Selected Video Owner User ID:', selectedVideo.userId);
            console.log('Selected Video Owner Username:', selectedVideo.username);
        } else {
            console.log('No videos available for this exercise.');
        }
    });

    process.exit(0);
}

run().catch(console.error);
