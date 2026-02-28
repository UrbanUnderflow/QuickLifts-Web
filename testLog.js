const admin = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT = {
    type: 'service_account',
    project_id: 'quicklifts-dd3f1',
    private_key_id: 'abbd015806ef3b43d93101522f12d029e736f447',
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEZkOP1Kz/jfQc\nLrN2SKLVdRNCZHGHN+wcfqQXknnD47Y6GBA35O1573Ipk5FaRNvxysB/YP/Z9dLP\nOO/xk8yRA+FFI32kzQlBIpVHDVN/upfXRWS/38+1kktPD3EjwEFRB8HvYVopCm1k\nCaFOZZfrrHM2IEdboKDt3ByLoNNPLZhivcurhBm4PENNEVlyMiqqWBwTu0sFGkZ8\nLHQ4JGtaPe5VomlpVlokKmdQzEwVTWexSeQkbdXnYkd1m/sfT3mjP6RLBlXlJ4f/\nOp36QofqPxNRV7TJ/YkrL2nOLo6gq6XWS3ciVINUS9cuPlEIg+5OrR4eQUYhay3N\n5dakXn+ZAgMBAAECggEAJv+de9KB1a8E4ZG+bgbnWpaIT/8s8eo/Vrso70tVJXoy\nhZ+gnNC2/Sb4VtwoGTIiMIWPqtuCgm/HQAGw15n/HW6VTUrKWK6kH0x0MuspAOx2\n2Ta81kLldksJ7DWHRE+ZSLNPJa8BnbOl3B7zamNPAuu35vAK611eh0zVWD6Dpy1v\n7933i/pOMpvDY0ieoT0pl0GJcCVOBTS2f8z1+huepW5++G0TrTCZdq9ixCF68xEc\nyGTr1Dz/Qdv4gIO2SNk3TfKmw/HaL3tQM1izdMsJVs+nPxzmHj3tLnppyQJJFwcF\nZ1njhg6eSHPOINU/wu2KL2B+pXiROBLQr1JnvJsCZwKBgQDsYNrmbDhShYeU+OSs\nSaQx0POBeZFtlsMIbJomTSDr73Gn4ZXJaXfNoqvIuJel5SCTytK36Y+84/S3xeuy\nmXGMpfqBmEilMU5D4VOmSH/HFH6+35m1LWFw3aWSVGuUSIEQoWTKjWB9zQVwFd5w\nEw6HsuNm1IJvsEfZpzXpcydBMwKBgQDUs9cLfY93MbkT5M/WL9jbPp846HZxvzeW\nGiBR7gMAPMre32DPDKQKqnRVAvXJPhd8mKjC3T4gRm+NBWKLQjIUO0RQoVG39HN/\n9yGBTyLMccJf5d9MZe5OIwkVhbN5ekPucNhqHJQEIVz0duZ7UhFgfgLSroy/04vA\ndjgGeGxUAwKBgD+9Pkm0FNvrtcut8bujf+sO9RqMtXJfnOfAoTCCy8XTI0qpwcI1\n9mA05S2S2RGa31X68yc0i9Xbgjmr3Qqj5cKPXyVi8vPYf8o+EFheZFZCaIr/sGry\nebv9iJAUw42Qn3zkiFE2HjbN+hFnVDvUZ66fxkIMO7/yQO2n8RmqO4ORAoGAFbqV\nglf+WvfaZ1zdmoziw2r/Swn8Z5xYKl5a5OPCrLiJJQF+20f4ThqhrbmSsE9GiPTz\ncIy3dwabCLX/HijSAt0XGoGQXpF7Zxww8QvLi0UnzTIngJ99G8BagjdZYVSLMgWX\nJifrOwzJeTPYUcrNeaUF1s38FPCgezXYfVi6AE8CgYEAv+9EP3q6zY51CMtXKb04\n1yLrnZze20aUMmAQ0KE1nH9ZRk7GgT+Bbmq1Nw6Ro3xItPffX42S5w8jDhiZJK/j\neVGloaXM9MHG2uTPWSVlUJ2ew2LcYpq42PbJUuS06teFFPohMCOs7urTc0Vdya5u\ngTynFJmBFslLO3UKNPAshn0=\n-----END PRIVATE KEY-----\n',
    client_email: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
    client_id: '111494077667496751062',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com',
    universe_domain: 'googleapis.com'
};

const credential = admin.cert(SERVICE_ACCOUNT);
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
