#!/usr/bin/env node

/**
 * Backfill agent deliverable review reasons.
 *
 * Usage:
 *   node scripts/backfillDeliverableReviewReasons.js --dry-run
 *   node scripts/backfillDeliverableReviewReasons.js --agent=nora --limit=50
 *   node scripts/backfillDeliverableReviewReasons.js --overwrite
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

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

const app = initializeApp({
    credential: cert(SERVICE_ACCOUNT),
}, 'deliverable-backfill-reasons');

const db = getFirestore(app);

const args = process.argv.slice(2);
const opts = {
    dryRun: args.includes('--dry-run'),
    overwrite: args.includes('--overwrite'),
    limit: Number.parseInt(args.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || '0', 10),
    agentId: args.find((arg) => arg.startsWith('--agent='))?.split('=')[1]?.trim() || '',
};

const normalize = (value) => String(value || '').trim();

const artifactLabel = (artifactType) => {
    if (!artifactType) return 'document';
    return normalize(artifactType).toLowerCase();
};

const inferImpactCategory = (filePath = '', artifactType = '', tags = []) => {
    const lower = normalize(filePath).toLowerCase();
    const normalTags = (Array.isArray(tags) ? tags : []).map((t) => normalize(t).toLowerCase());
    const tagSet = new Set(normalTags);

    if (lower.includes('docs/sage/deliverables') || lower.includes('docs/agents') || lower.includes('/docs/')) {
        return 'documentation and execution guidance';
    }
    if (lower.includes('functions/') || lower.includes('web/') || lower.includes('src/') || lower.includes('components/')) {
        return 'product UX or runtime behavior';
    }
    if (lower.includes('scripts/') || lower.includes('.github/') || lower.includes('tools/')) {
        return 'developer tooling or operational support';
    }
    if (artifactType === 'test') return 'test coverage and quality guardrails';
    if (tagSet.has('config')) return 'configuration and integration stability';
    return 'cross-system behavior or content surface';
};

const deriveReason = (d) => {
    const taskName = normalize(d.taskName || d.taskId || 'an internal task');
    const filePath = normalize(d.filePath);
    const artifact = artifactLabel(d.artifactType);
    const surface = inferImpactCategory(filePath, d.artifactType, d.tags || []);
    const title = normalize(d.title || filePath.split('/').pop() || 'this deliverable');

    const impacts = [];
    if (artifact === 'code' || artifact === 'test' || artifact === 'config') {
        impacts.push('should affect execution behavior, quality, or validation');
    } else if (artifact === 'document') {
        impacts.push('adds project knowledge and onboarding detail for execution consistency');
    }

    if (normalize(d.tags || []).length) {
        impacts.push(`with explicit context from: ${normalize((d.tags || []).join(', '))}`);
    }

    const surfaceClause = `It appears to touch ${surface} via ${artifact} artifacts.`;
    const impactClause = impacts.length
        ? `Likely impact: ${impacts.join('; ')}.`
        : 'Likely impact: delivery traceability and downstream implementation clarity.';

    return [
        `Auto-generated impact rationale for "${title}".`,
        `${surfaceClause}`,
        `${impactClause}`,
        `Task: ${taskName}.`,
        'Keep this deliverable if it materially changes user-facing behavior, improves conversion/activation, or strengthens partner/community execution.',
    ].join(' ').trim();
};

async function main() {
    const query = db.collection('agent-deliverables');
    let snap;
    if (opts.agentId) {
        snap = await query.where('agentId', '==', opts.agentId).get();
        console.log(`🔎 Filtering to agent: ${opts.agentId}`);
    } else {
        snap = await query.get();
    }

    const docs = snap.docs.filter((doc) => {
        const d = doc.data();
        const existingReason = normalize(d.reviewReason);
        return opts.overwrite ? true : !existingReason;
    });

    const ordered = [...docs].sort((a, b) => {
        const aTime = a.createTime?.toMillis ? a.createTime.toMillis() : 0;
        const bTime = b.createTime?.toMillis ? b.createTime.toMillis() : 0;
        return bTime - aTime;
    });

    const selected = opts.limit > 0 ? ordered.slice(0, opts.limit) : ordered;

    console.log(`\n📦 Deliverables found: ${snap.size}`);
    console.log(`🧠 Eligible for backfill: ${selected.length}${opts.overwrite ? ' (overwrite enabled)' : ' (missing reviewReason only)'}`);

    if (selected.length === 0) {
        console.log('✅ Nothing to do.');
        return;
    }

    for (const doc of selected) {
        const d = doc.data();
        const id = doc.id;
        const reason = deriveReason(d);
        const file = normalize(d.filePath) || 'n/a';
        const current = normalize(d.reviewReason);

        if (opts.dryRun) {
            console.log(`🧪 DRY RUN [${id}] ${file}`);
            console.log(`   Current: ${current || '(none)'}`);
            console.log(`   Next:    ${reason}`);
            continue;
        }

        const payload = {
            reviewReason: reason,
            reviewReasonSource: 'backfill-auto',
            reviewReasonUpdatedAt: FieldValue.serverTimestamp(),
        };
        await doc.ref.update(payload);
        console.log(`✅ Backfilled [${id}] ${file}`);
    }

    if (opts.dryRun) {
        console.log(`\n🧪 Dry run complete. No writes performed.`);
    } else {
        console.log(`\n✅ Backfill complete: ${selected.length} deliverable(s) updated.`);
    }
}

main().catch((err) => {
    console.error('❌ Backfill failed:', err.message || err);
    process.exit(1);
});
