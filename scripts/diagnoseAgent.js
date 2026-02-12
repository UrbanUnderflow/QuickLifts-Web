#!/usr/bin/env node

/**
 * Diagnose Scout's state: check pending commands and task statuses.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT = {
    type: "service_account",
    project_id: "quicklifts-dd3f1",
    private_key_id: "abbd015806ef3b43d93101522f12d029e736f447",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEZkOP1Kz/jfQc\nLrN2SKLVdRNCZHGHN+wcfqQXknnD47Y6GBA35O1573Ipk5FaRNvxysB/YP/Z9dLP\nOO/xk8yRA+FFI32kzQlBIpVHDVN/upfXRWS/38+1kktPD3EjwEFRB8HvYVopCm1k\nCaFOZZfrrHM2IEdboKDt3ByLoNNPLZhivcurhBm4PENNEVlyMiqqWBwTu0sFGkZ8\nLHQ4JGtaPe5VomlpVlokKmdQzEwVTWexSeQkbdXnYkd1m/sfT3mjP6RLBlXlJ4f/\nOp36QofqPxNRV7TJ/YkrL2nOLo6gq6XWS3ciVINUS9cuPlEIg+5OrR4eQUYhay3N\n5dakXn+ZAgMBAAECggEAJv+de9KB1a8E4ZG+bgbnWpaIT/8s8eo/Vrso70tVJXoy\nhZ+gnNC2/Sb4VtwoGTIiMIWPqtuCgm/HQAGw15n/HW6VTUrKWK6kH0x0MuspAOx2\n2Ta81kLldksJ7DWHRE+ZSLNPJa8BnbOl3B7zamNPAuu35vAK611eh0zVWD6Dpy1v\n7933i/pOMpvDY0ieoT0pl0GJcCVOBTS2f8z1+huepW5++G0TrTCZdq9ixCF68xEc\nyGTr1Dz/Qdv4gIO2SNk3TfKmw/HaL3tQM1izdMsJVs+nPxzmHj3tLnppyQJJFwcF\nZ1njhg6eSHPOINU/wu2KL2B+pXiROBLQr1JnvJsCZwKBgQDsYNrmbDhShYeU+OSs\nSaQx0POBeZFtlsMIbJomTSDr73Gn4ZXJaXfNoqvIuJel5SCTytK36Y+84/S3xeuy\nmXGMpfqBmEilMU5D4VOmSH/HFH6+35m1LWFw3aWSVGuUSIEQoWTKjWB9zQVwFd5w\nEw6HsuNm1IJvsEfZpzXpcydBMwKBgQDUs9cLfY93MbkT5M/WL9jbPp846HZxvzeW\nGiBR7gMAPMre32DPDKQKqnRVAvXJPhd8mKjC3T4gRm+NBWKLQjIUO0RQoVG39HN/\n9yGBTyLMccJf5d9MZe5OIwkVhbN5ekPucNhqHJQEIVz0duZ7UhFgfgLSroy/04vA\ndjgGeGxUAwKBgD+9Pkm0FNvrtcut8bujf+sO9RqMtXJfnOfAoTCCy8XTI0qpwcI1\n9mA05S2S2RGa31X68yc0i9Xbgjmr3Qqj5cKPXyVi8vPYf8o+EFheZFZCaIr/sGry\nebv9iJAUw42Qn3zkiFE2HjbN+hFnVDvUZ66fxkIMO7/yQO2n8RmqO4ORAoGAFbqV\nglf+WvfaZ1zdmoziw2r/Swn8Z5xYKl5a5OPCrLiJJQF+20f4ThqhrbmSsE9GiPTz\ncIy3dwabCLX/HijSAt0XGoGQXpF7Zxww8QvLi0UnzTIngJ99G8BagjdZYVSLMgWX\nJifrOwzJeTPYUcrNeaUF1s38FPCgezXYfVi6AE8CgYEAv+9EP3q6zY51CMtXKb04\n1yLrnZze20aUMmAQ0KE1nH9ZRk7GgT+Bbmq1Nw6Ro3xItPffX42S5w8jDhiZJK/j\neVGloaXM9MHG2uTPWSVlUJ2ew2LcYpq42PbJUuS06teFFPohMCOs7urTc0Vdya5u\ngTynFJmBFslLO3UKNPAshn0=\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
    client_id: "111494077667496751062",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
};

const app = initializeApp({ credential: cert(SERVICE_ACCOUNT) }, 'diagnose');
const db = getFirestore(app);

async function main() {
    const agentId = 'scout';
    const agentName = 'Scout';

    console.log(`\n══════════════════════════════════════`);
    console.log(`  Scout Agent Diagnostic Report`);
    console.log(`══════════════════════════════════════\n`);

    // 1. Check presence
    const presSnap = await db.collection('agent-presence').doc(agentId).get();
    const pres = presSnap.data();
    if (pres) {
        console.log(`📡 PRESENCE:`);
        console.log(`   Status: ${pres.status}`);
        console.log(`   Current Task: ${pres.currentTask || '(none)'}`);
        console.log(`   Task Progress: ${pres.taskProgress || 0}%`);
        console.log(`   Notes: ${pres.notes || '(none)'}`);
        console.log(`   Last Heartbeat: ${pres.lastHeartbeat?.toDate?.() || 'unknown'}`);
        console.log('');
    }

    // 2. Check pending/in-progress commands
    console.log(`📨 PENDING COMMANDS (to scout):`);
    const pendingSnap = await db.collection('agent-commands')
        .where('to', '==', agentId)
        .where('status', 'in', ['pending', 'in-progress'])
        .get();

    if (pendingSnap.empty) {
        console.log(`   (none)\n`);
    } else {
        pendingSnap.docs.forEach(d => {
            const data = d.data();
            console.log(`   [${d.id}] type=${data.type} status=${data.status} from=${data.from}`);
            console.log(`   Content: "${(data.content || '').substring(0, 100)}..."`);
            console.log('');
        });
    }

    // 3. Check recent commands (last 5)
    console.log(`📋 RECENT COMMANDS (to scout, last 5):`);
    const recentSnap = await db.collection('agent-commands')
        .where('to', '==', agentId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

    recentSnap.docs.forEach(d => {
        const data = d.data();
        console.log(`   [${d.id}] type=${data.type} status=${data.status} from=${data.from}`);
        console.log(`   Content: "${(data.content || '').substring(0, 80)}${(data.content || '').length > 80 ? '...' : ''}"`);
        console.log(`   Response: "${(data.response || '(none)').substring(0, 100)}${(data.response || '').length > 100 ? '...' : ''}"`);
        console.log(`   Created: ${data.createdAt?.toDate?.() || 'unknown'}`);
        console.log('');
    });

    // 4. Check kanban tasks
    console.log(`🗂️  KANBAN TASKS (assigned to ${agentName}):`);
    const kanbanSnap = await db.collection('kanban-tasks')
        .where('assignee', '==', agentName)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

    if (kanbanSnap.empty) {
        console.log(`   (none)\n`);
    } else {
        kanbanSnap.docs.forEach(d => {
            const data = d.data();
            console.log(`   [${d.id}] "${data.name}"`);
            console.log(`   Status: ${data.status} | Blocked: ${data.runnerBlocked || false}`);
            if (data.runnerFailureMessage) {
                console.log(`   Failure: ${data.runnerFailureMessage.substring(0, 120)}`);
            }
            console.log('');
        });
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
