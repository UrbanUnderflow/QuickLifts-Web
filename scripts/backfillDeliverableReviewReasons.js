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
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const app = initializeApp({
    credential: resolveAdminCredential(),
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
