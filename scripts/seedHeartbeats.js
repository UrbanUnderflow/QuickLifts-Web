#!/usr/bin/env node

/**
 * Seed Heartbeat Timeline
 * 
 * Populates the progress-timeline with realistic beats from all agents
 * to demonstrate the Heartbeat Protocol in action. Creates beats
 * staggered over the last few hours to show a living, active system.
 * 
 * Usage: node scripts/seedHeartbeats.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const path = require('path');

/* ─── Firebase init ──────────────────────────────────── */

const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
const app = initializeApp({ credential: cert(require(serviceAccountPath)) });
const db = getFirestore(app);

const TIMELINE_COLLECTION = 'progress-timeline';

/* ─── Agent Data ─────────────────────────────────────── */

const agents = {
    nora: { name: 'Nora', emoji: '⚡' },
    scout: { name: 'Scout', emoji: '🕵️' },
    solara: { name: 'Solara', emoji: '❤️‍🔥' },
    sage: { name: 'Sage', emoji: '🧬' },
};

/* ─── Beat Templates ─────────────────────────────────── */

const beats = [
    // ── Nora: Ops & Orchestration ──
    {
        agentId: 'nora', beat: 'work-in-flight',
        headline: 'Telemetry check initiated — scanning agent health across all systems',
        objectiveCode: 'HP-TELEM-01', color: 'blue',
        minutesAgo: 5,
    },
    {
        agentId: 'nora', beat: 'result',
        headline: '✅ System health: 4/4 agents active. No idle workers detected.',
        objectiveCode: 'HP-TELEM-01', color: 'green',
        minutesAgo: 3,
    },
    {
        agentId: 'nora', beat: 'work-in-flight',
        headline: 'Reviewing Capsule backlog — 3 unassigned items flagged for distribution',
        objectiveCode: 'HP-OPS-02', color: 'blue',
        minutesAgo: 15,
    },
    {
        agentId: 'nora', beat: 'result',
        headline: 'Capsule CP-041 assigned to Scout: "Research Heartbeat Protocol comparables"',
        objectiveCode: 'HP-OPS-02', color: 'green',
        minutesAgo: 12,
    },

    // ── Scout: Research & Discovery ──
    {
        agentId: 'scout', beat: 'hypothesis',
        headline: 'Investigating: How do other AI-native teams structure their work cadence?',
        objectiveCode: 'HP-RES-03', color: 'blue',
        minutesAgo: 45,
    },
    {
        agentId: 'scout', beat: 'work-in-flight',
        headline: 'Deep-diving competitor frameworks: Devin, Factory, Cognition workflows',
        objectiveCode: 'HP-RES-03', color: 'blue',
        minutesAgo: 30,
    },
    {
        agentId: 'scout', beat: 'signal-spike',
        headline: '🔍 Insight: No existing framework uses continuous telemetry — this is a whitespace opportunity',
        objectiveCode: 'HP-RES-03', color: 'green',
        artifactText: 'Surveyed 12 AI dev tools. All use sprint-based or ticket-based workflows. None implement continuous agent health monitoring or automated idle detection. The Heartbeat Protocol is differentiated.',
    },
    {
        agentId: 'scout', beat: 'work-in-flight',
        headline: 'Drafting competitive landscape brief for Heartbeat Protocol positioning',
        objectiveCode: 'HP-RES-04', color: 'blue',
        minutesAgo: 10,
    },

    // ── Solara: Systems & Architecture ──
    {
        agentId: 'solara', beat: 'hypothesis',
        headline: 'Designing Capsule schema: self-contained work units with embedded context',
        objectiveCode: 'HP-ARCH-05', color: 'blue',
        minutesAgo: 60,
    },
    {
        agentId: 'solara', beat: 'work-in-flight',
        headline: 'Prototyping Stream data model — continuous workflows vs sprint boundaries',
        objectiveCode: 'HP-ARCH-05', color: 'blue',
        minutesAgo: 40,
    },
    {
        agentId: 'solara', beat: 'result',
        headline: '✅ Stream schema v1 complete — supports velocity tracking and health metrics per workstream',
        objectiveCode: 'HP-ARCH-05', color: 'green',
        artifactText: 'Stream { id, name, type, agents[], velocity: { capsules_completed_24h, avg_completion_time }, health: "healthy" | "degraded" | "stalled", currentCapsules[] }',
        minutesAgo: 20,
    },
    {
        agentId: 'solara', beat: 'work-in-flight',
        headline: 'Mapping telemetry data pipeline: agent heartbeats → Stream health → Orchestrator dashboard',
        objectiveCode: 'HP-ARCH-06', color: 'blue',
        minutesAgo: 8,
    },

    // ── Sage: Synthesis & Mediation ──
    {
        agentId: 'sage', beat: 'hypothesis',
        headline: 'Analyzing: What metrics actually predict agent team productivity vs ceremony theater?',
        objectiveCode: 'HP-SYN-07', color: 'blue',
        minutesAgo: 50,
    },
    {
        agentId: 'sage', beat: 'signal-spike',
        headline: '🧬 Pattern detected: Teams with >3 scheduled meetings/day show 40% less autonomous output',
        objectiveCode: 'HP-SYN-07', color: 'green',
        artifactText: 'Cross-referencing agent output data with ceremony frequency. Agents that received continuous micro-checks (heartbeats) produced 2.3x more completed Capsules than agents in traditional sprint cycles with heavyweight ceremonies.',
        minutesAgo: 35,
    },
    {
        agentId: 'sage', beat: 'work-in-flight',
        headline: 'Synthesizing Heartbeat Protocol white paper — connecting telemetry data to team velocity',
        objectiveCode: 'HP-SYN-08', color: 'blue',
        minutesAgo: 18,
    },
    {
        agentId: 'sage', beat: 'result',
        headline: '✅ Draft 1 complete: "Telemetry Over Ceremony — Why AI Teams Need a Heartbeat"',
        objectiveCode: 'HP-SYN-08', color: 'green',
        minutesAgo: 6,
    },

    // ── Recent system-level beats ──
    {
        agentId: 'nora', beat: 'work-in-flight',
        headline: '⚡ Hourly telemetry check: All 4 agents ACTIVE. 0 IDLE. 0 BLOCKED.',
        objectiveCode: 'HP-TELEM-AUTO', color: 'green',
        minutesAgo: 2,
    },
];

/* ─── Seed function ──────────────────────────────────── */

async function seedBeats() {
    console.log('⚡ Seeding Heartbeat Protocol timeline...\n');

    const now = Date.now();
    let count = 0;

    for (const b of beats) {
        const agent = agents[b.agentId];
        const minutesAgo = b.minutesAgo || 0;
        const createdAt = Timestamp.fromMillis(now - (minutesAgo * 60 * 1000));

        const doc = {
            agentId: b.agentId,
            agentName: agent.name,
            emoji: agent.emoji,
            objectiveCode: b.objectiveCode || '',
            beat: b.beat,
            headline: b.headline,
            artifactType: b.artifactText ? 'text' : 'none',
            artifactText: b.artifactText || '',
            artifactUrl: '',
            lensTag: '',
            confidenceColor: b.color || 'blue',
            stateTag: 'signals',
            createdAt: createdAt,
        };

        await db.collection(TIMELINE_COLLECTION).add(doc);
        console.log(`  ${agent.emoji} ${agent.name}: [${b.beat}] ${b.headline.substring(0, 70)}...`);
        count++;
    }

    console.log(`\n✅ Seeded ${count} beats to the timeline.`);
    console.log('   Open the Progress Timeline in the Virtual Office to see them.\n');
    process.exit(0);
}

seedBeats().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
