#!/usr/bin/env node

/**
 * Seed the feed-taxonomy Firestore collection with task type definitions
 * for each agent lane.
 *
 * Usage:
 *   node scripts/seedFeedTaxonomy.js
 *
 * This only needs to run once. Running again will skip entries that already
 * exist (matched by taskType).
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

/* ─── Firebase init ──────────────────────────────────── */

const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
const app = initializeApp({ credential: cert(require(serviceAccountPath)) });
const db = getFirestore(app);

const COLLECTION = 'feed-taxonomy';

/* ─── Task type definitions ──────────────────────────── */

const ENTRIES = [
    // ─── Scout lane (signals → research) ──────────────
    {
        taskType: 'influencer-research',
        description: 'Deep-dive research on a creator or influencer prospect — profile analysis, audience metrics, content audit.',
        lane: 'signals',
        typicalDurationMinutes: 45,
        artifactRequirement: 'Research report with data points and recommendation',
        idleThresholdMinutes: 90,
        defaultColor: 'blue',
        cadence: 'slow',
        ownerAgentId: 'scout',
    },
    {
        taskType: 'university-prospect-scan',
        description: 'Scan universities for fitness program partnerships — identify contacts, programs, and outreach angles.',
        lane: 'signals',
        typicalDurationMinutes: 30,
        artifactRequirement: 'Prospect list with contact info and partnership angles',
        idleThresholdMinutes: 60,
        defaultColor: 'blue',
        cadence: 'flash',
        ownerAgentId: 'scout',
    },
    {
        taskType: 'market-signal-capture',
        description: 'Capture and analyze a trending signal — competitor moves, viral content, market shifts.',
        lane: 'signals',
        typicalDurationMinutes: 20,
        artifactRequirement: 'Signal brief with context and recommended action',
        idleThresholdMinutes: 45,
        defaultColor: 'blue',
        cadence: 'flash',
        ownerAgentId: 'scout',
    },

    // ─── Solara lane (meanings → narrative/brand) ─────
    {
        taskType: 'brand-narrative-draft',
        description: 'Draft brand narrative content — taglines, story arcs, positioning statements, creator-facing copy.',
        lane: 'meanings',
        typicalDurationMinutes: 60,
        artifactRequirement: 'Written narrative draft with tone notes',
        idleThresholdMinutes: 120,
        defaultColor: 'blue',
        cadence: 'slow',
        ownerAgentId: 'solara',
    },
    {
        taskType: 'emotional-state-mapping',
        description: 'Map user emotional states (spark, skeptic, tired, etc.) to content triggers and narrative lens instructions.',
        lane: 'meanings',
        typicalDurationMinutes: 45,
        artifactRequirement: 'Emotional state rubric with lens assignments',
        idleThresholdMinutes: 90,
        defaultColor: 'blue',
        cadence: 'slow',
        ownerAgentId: 'solara',
    },
    {
        taskType: 'vibe-cadence-calibration',
        description: 'Calibrate flash vs slow signal cadence — determine when quick updates vs deep content is appropriate.',
        lane: 'meanings',
        typicalDurationMinutes: 30,
        artifactRequirement: 'Cadence matrix mapping signal types to pacing',
        idleThresholdMinutes: 60,
        defaultColor: 'green',
        cadence: 'flash',
        ownerAgentId: 'solara',
    },

    // ─── Nora lane (signals → ops/coordination) ───────
    {
        taskType: 'feature-implementation',
        description: 'Build or modify a feature — code changes, UI components, API integrations, config updates.',
        lane: 'signals',
        typicalDurationMinutes: 90,
        artifactRequirement: 'Code changes with commit hash and file list',
        idleThresholdMinutes: 120,
        defaultColor: 'blue',
        cadence: 'slow',
        ownerAgentId: 'nora',
    },
    {
        taskType: 'bug-fix',
        description: 'Diagnose and fix a bug — root cause analysis, code fix, verification.',
        lane: 'signals',
        typicalDurationMinutes: 45,
        artifactRequirement: 'Fix with root cause explanation and test confirmation',
        idleThresholdMinutes: 90,
        defaultColor: 'yellow',
        cadence: 'flash',
        ownerAgentId: 'nora',
    },
    {
        taskType: 'agent-coordination',
        description: 'Coordinate agent work — task assignment, dependency resolution, status check-ins, nudges.',
        lane: 'signals',
        typicalDurationMinutes: 15,
        artifactRequirement: 'Coordination log or status update',
        idleThresholdMinutes: 30,
        defaultColor: 'green',
        cadence: 'flash',
        ownerAgentId: 'nora',
    },

    // ─── Sage lane (meanings → automation/kanban) ─────
    {
        taskType: 'kanban-automation',
        description: 'Build or update KanBan automation rules — idle detection, color transitions, card state logic.',
        lane: 'meanings',
        typicalDurationMinutes: 60,
        artifactRequirement: 'Automation rule config or code',
        idleThresholdMinutes: 120,
        defaultColor: 'blue',
        cadence: 'slow',
        ownerAgentId: 'sage',
    },
    {
        taskType: 'pattern-analysis',
        description: 'Analyze patterns from field data — identify trends, anomalies, recurring themes across agent outputs.',
        lane: 'meanings',
        typicalDurationMinutes: 45,
        artifactRequirement: 'Pattern report with supporting data points',
        idleThresholdMinutes: 90,
        defaultColor: 'blue',
        cadence: 'slow',
        ownerAgentId: 'sage',
    },
    {
        taskType: 'feed-drop',
        description: 'Publish a curated feed drop — field notes distilled into actionable insight posts.',
        lane: 'meanings',
        typicalDurationMinutes: 20,
        artifactRequirement: 'Published feed entry with context and insight',
        idleThresholdMinutes: 45,
        defaultColor: 'green',
        cadence: 'flash',
        ownerAgentId: 'sage',
    },

    // ─── Cross-cutting types ──────────────────────────
    {
        taskType: 'documentation',
        description: 'Write or update documentation — READMEs, runbooks, API docs, process guides.',
        lane: 'signals',
        typicalDurationMinutes: 30,
        artifactRequirement: 'Markdown doc committed to repo or published',
        idleThresholdMinutes: 60,
        defaultColor: 'green',
        cadence: 'flash',
        ownerAgentId: '',
    },
    {
        taskType: 'review-and-verify',
        description: 'Review deliverables from another agent — code review, content review, fact-check, approval.',
        lane: 'meanings',
        typicalDurationMinutes: 20,
        artifactRequirement: 'Review notes with approval/rejection decision',
        idleThresholdMinutes: 45,
        defaultColor: 'green',
        cadence: 'flash',
        ownerAgentId: '',
    },
];

/* ─── Seed logic ─────────────────────────────────────── */

async function seed() {
    console.log(`🌱 Seeding ${ENTRIES.length} feed-taxonomy entries...\n`);

    // Check what already exists
    const existingSnap = await db.collection(COLLECTION).get();
    const existingTypes = new Set(existingSnap.docs.map(d => d.data().taskType));

    let created = 0;
    let skipped = 0;

    for (const entry of ENTRIES) {
        if (existingTypes.has(entry.taskType)) {
            console.log(`  ⏭  ${entry.taskType} — already exists`);
            skipped++;
            continue;
        }

        await db.collection(COLLECTION).add({
            ...entry,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`  ✅ ${entry.taskType} (${entry.lane}/${entry.ownerAgentId || 'any'})`);
        created++;
    }

    console.log(`\n✅ Done! Created ${created}, skipped ${skipped} (already existed).`);
    process.exit(0);
}

seed().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
