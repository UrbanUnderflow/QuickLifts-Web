#!/usr/bin/env node

/**
 * Clean historical agent-system Firestore noise.
 *
 * Dry-run by default:
 *   node scripts/cleanupAgentFirestoreGarbage.js
 *
 * Apply deletes and write a JSONL backup:
 *   node scripts/cleanupAgentFirestoreGarbage.js --apply
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');

initializeApp({ credential: resolveAdminCredential() });

const db = getFirestore();
const APPLY = process.argv.includes('--apply');
const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;
const MACRA_START_MS = Date.parse('2026-06-25T00:00:00.000Z');
const RECENT_KEEP_MS = NOW - 7 * DAY_MS;
const STUCK_OPEN_CUTOFF_MS = NOW - 60 * 60 * 1000;
const BACKUP_PATH = path.join(
    os.tmpdir(),
    `quicklifts-firestore-agent-garbage-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`
);

function toMillis(value) {
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        return value.seconds * 1000;
    }
    return 0;
}

function serialize(value) {
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
    if (Array.isArray(value)) return value.map(serialize);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialize(child)]));
    }
    return value;
}

function getDocTime(data) {
    return toMillis(data.createdAt) || toMillis(data.updatedAt) || toMillis(data.completedAt);
}

function trueHourKey(data) {
    const ms = getDocTime(data);
    if (!ms) return '';
    const date = new Date(ms);
    date.setUTCMinutes(0, 0, 0);
    return date.toISOString();
}

function addCandidate(candidates, collectionPath, doc, reason) {
    const key = `${collectionPath}/${doc.id}`;
    if (!candidates.has(key)) {
        candidates.set(key, { collectionPath, doc, reason });
    }
}

async function collectAgentTaskCandidates(candidates) {
    const snap = await db.collection('agent-tasks').get();
    for (const doc of snap.docs) {
        const data = doc.data();
        const status = String(data.status || '').toLowerCase();
        const source = String(data.source || '');
        const createdMs = getDocTime(data);
        const oldPreMacra = createdMs > 0 && createdMs < MACRA_START_MS;
        const stuckOpen = data.runnerBlocked === true &&
            ['in-progress', 'needs-review'].includes(status) &&
            (!createdMs || createdMs < STUCK_OPEN_CUTOFF_MS);

        if (oldPreMacra && ['quarantined', 'needs-review', 'blocked', 'canceled', 'pending'].includes(status)) {
            addCandidate(candidates, 'agent-tasks', doc, 'old pre-Macra parked/failed agent task');
            continue;
        }

        if (['self-assigned-idle', 'nora-task-manager'].includes(source) &&
            ['quarantined', 'needs-review'].includes(status)) {
            addCandidate(candidates, 'agent-tasks', doc, 'auto-assignment loop residue');
            continue;
        }

        if (stuckOpen) {
            addCandidate(candidates, 'agent-tasks', doc, 'blocked in-progress agent task from broken runner loop');
            continue;
        }

        if (!source && status === 'pending' && !data.name) {
            addCandidate(candidates, 'agent-tasks', doc, 'empty pending agent task');
        }
    }
}

async function collectProgressSnapshotCandidates(candidates) {
    const snap = await db.collection('progress-snapshots').get();
    const recentByHour = new Map();

    for (const doc of snap.docs) {
        const data = doc.data();
        const ms = getDocTime(data);
        if (!ms || ms < RECENT_KEEP_MS) {
            addCandidate(candidates, 'progress-snapshots', doc, 'snapshot older than 7-day retention');
            continue;
        }

        const key = `${data.agentId || data.agentName || 'unknown'}|${trueHourKey(data)}`;
        const row = recentByHour.get(key) || [];
        row.push(doc);
        recentByHour.set(key, row);
    }

    for (const docs of recentByHour.values()) {
        docs.sort((a, b) => getDocTime(b.data()) - getDocTime(a.data()));
        for (const duplicate of docs.slice(1)) {
            addCandidate(candidates, 'progress-snapshots', duplicate, 'duplicate 10-minute snapshot inside hourly bucket');
        }
    }
}

async function collectSimpleRetentionCandidates(candidates, collectionPath, statuses, cutoffMs, reason) {
    const snap = await db.collection(collectionPath).get();
    for (const doc of snap.docs) {
        const data = doc.data();
        const status = String(data.status || '').toLowerCase();
        const ms = getDocTime(data);
        if (statuses.includes(status) && ms > 0 && ms < cutoffMs) {
            addCandidate(candidates, collectionPath, doc, reason);
        }
    }
}

async function collectProgressTimelineCandidates(candidates) {
    const snap = await db.collection('progress-timeline').get();
    for (const doc of snap.docs) {
        const data = doc.data();
        const ms = getDocTime(data);
        if (ms > 0 && ms < MACRA_START_MS) {
            addCandidate(candidates, 'progress-timeline', doc, 'pre-Macra agent timeline noise');
        }
    }
}

async function collectClosedGroupChatCandidates(candidates) {
    const snap = await db.collection('agent-group-chats').get();
    for (const doc of snap.docs) {
        const data = doc.data();
        const status = String(data.status || '').toLowerCase();
        const ms = getDocTime(data) || toMillis(data.lastMessageAt);
        if (status === 'closed' && ms > 0 && ms < MACRA_START_MS) {
            const messages = await doc.ref.collection('messages').get();
            for (const message of messages.docs) {
                addCandidate(candidates, `agent-group-chats/${doc.id}/messages`, message, 'message from old closed group chat');
            }
            addCandidate(candidates, 'agent-group-chats', doc, 'old closed group chat');
        }
    }
}

async function writeBackup(candidates) {
    if (!APPLY) return '';
    const stream = fs.createWriteStream(BACKUP_PATH, { flags: 'wx' });
    for (const item of candidates.values()) {
        stream.write(JSON.stringify({
            path: `${item.collectionPath}/${item.doc.id}`,
            reason: item.reason,
            data: serialize(item.doc.data()),
        }) + '\n');
    }
    await new Promise((resolve, reject) => {
        stream.end(resolve);
        stream.on('error', reject);
    });
    return BACKUP_PATH;
}

async function deleteCandidates(candidates) {
    if (!APPLY) return;
    const refs = [...candidates.values()].map((item) => item.doc.ref);
    for (let i = 0; i < refs.length; i += 400) {
        const batch = db.batch();
        refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
        await batch.commit();
        console.log(`Deleted ${Math.min(i + 400, refs.length)} / ${refs.length}`);
    }
}

function printSummary(candidates) {
    const byCollection = new Map();
    const byReason = new Map();
    for (const item of candidates.values()) {
        byCollection.set(item.collectionPath, (byCollection.get(item.collectionPath) || 0) + 1);
        byReason.set(item.reason, (byReason.get(item.reason) || 0) + 1);
    }

    console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`Candidates: ${candidates.size}`);
    console.log('\nBy collection:');
    [...byCollection.entries()].sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
        console.log(`  ${String(count).padStart(6)} ${key}`);
    });
    console.log('\nBy reason:');
    [...byReason.entries()].sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
        console.log(`  ${String(count).padStart(6)} ${key}`);
    });
}

async function main() {
    const candidates = new Map();
    await collectAgentTaskCandidates(candidates);
    await collectProgressSnapshotCandidates(candidates);
    await collectSimpleRetentionCandidates(
        candidates,
        'agent-commands',
        ['completed', 'expired', 'failed'],
        RECENT_KEEP_MS,
        'old completed/terminal agent command'
    );
    await collectProgressTimelineCandidates(candidates);
    await collectSimpleRetentionCandidates(
        candidates,
        'pulsecommand-notification-logs',
        ['sent', 'failed', 'skipped'],
        RECENT_KEEP_MS,
        'old PulseCommand notification log'
    );
    await collectClosedGroupChatCandidates(candidates);

    printSummary(candidates);
    const backupPath = await writeBackup(candidates);
    if (backupPath) console.log(`\nBackup: ${backupPath}`);
    await deleteCandidates(candidates);
    if (!APPLY) console.log('\nRun with --apply to delete these documents after reviewing the summary.');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
