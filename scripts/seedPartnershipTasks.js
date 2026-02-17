#!/usr/bin/env node

/**
 * Seed partnership-themed tasks for agents.
 * Also resets any blocked tasks so agents can pick up work.
 * 
 * Usage: node scripts/seedPartnershipTasks.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT = {
    type: "service_account",
    project_id: "quicklifts-dd3f1",
    private_key_id: "***REMOVED***",
    private_key: "***REMOVED***",
    client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
    client_id: "111494077667496751062",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
};

const app = initializeApp({ credential: cert(SERVICE_ACCOUNT) }, 'seed-partnerships');
const db = getFirestore(app);

const KANBAN = 'kanbanTasks';
const TIMELINE = 'progress-timeline';

async function resetBlockedTasks() {
    console.log('\n🔓 Checking for blocked tasks across all agents...\n');

    const snap = await db.collection(KANBAN)
        .where('runnerBlocked', '==', true)
        .get();

    if (snap.empty) {
        console.log('   ✅ No blocked tasks found.');
        return 0;
    }

    console.log(`   Found ${snap.size} blocked task(s):`);
    let count = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        console.log(`   📋 [${doc.id}] "${data.name}" (assignee: ${data.assignee})`);
        console.log(`      Failure: ${data.runnerFailureMessage || 'no message'}`);

        await db.collection(KANBAN).doc(doc.id).update({
            runnerBlocked: FieldValue.delete(),
            runnerFailureAt: FieldValue.delete(),
            runnerFailureMessage: FieldValue.delete(),
            status: 'todo',
            updatedAt: FieldValue.serverTimestamp(),
        });
        count++;
    }
    console.log(`   ✅ Reset ${count} blocked task(s).\n`);
    return count;
}

async function seedPartnershipTasks() {
    console.log('\n📋 Seeding partnership-themed tasks...\n');

    const now = FieldValue.serverTimestamp();

    // The master task for Nora to plan partnership strategy and create sub-tasks for all agents
    const tasks = [
        {
            name: 'Design Pulse Partnership Strategy & Create Agent Work Plans',
            description: `As Chief of Staff, develop a comprehensive partnership strategy for Pulse. This includes:

1. **Identify partnership categories** that align with Pulse's fitness/wellness mission (gym chains, wearable tech, nutrition brands, corporate wellness programs, health insurers, fitness influencers, content creators).

2. **Define what a partnership looks like** for Pulse — what we offer (platform access, data insights, co-branded experiences, API integrations) and what we need (distribution, credibility, content, users).

3. **Create a partnership pipeline framework** — from prospecting → outreach → evaluation → proposal → onboarding → measurement.

4. **Assign specific tasks to each agent**:
   - Scout: research potential partners, competitive analysis of partnership models
   - Solara: craft partnership pitch narratives, brand alignment guidelines
   - Sage: analyze partnership ROI models, identify data-driven opportunities
   - Nora: build tracking systems, create outreach templates, manage pipeline

5. **Create kanban tasks** for each agent with clear deliverables and subtasks.

Output: A partnership strategy doc + individual kanban tasks created for Scout, Sage, and Solara.`,
            project: 'Partnerships',
            theme: 'Partnerships',
            assignee: 'Nora',
            status: 'todo',
            complexity: 4,
            priority: 'high',
            lane: 'signals',
            color: 'blue',
            notes: 'Master task — Nora should create follow-up tasks for all agents. Theme: gaining partnerships for Pulse.',
            subtasks: [
                { id: `${Date.now()}-1`, title: 'Identify 5+ partnership categories relevant to Pulse', completed: false, createdAt: new Date() },
                { id: `${Date.now()}-2`, title: 'Define value exchange framework (what Pulse offers vs. what partners bring)', completed: false, createdAt: new Date() },
                { id: `${Date.now()}-3`, title: 'Design partnership pipeline stages', completed: false, createdAt: new Date() },
                { id: `${Date.now()}-4`, title: 'Create and assign tasks: Scout → research & competitive analysis', completed: false, createdAt: new Date() },
                { id: `${Date.now()}-5`, title: 'Create and assign tasks: Solara → pitch decks & brand alignment', completed: false, createdAt: new Date() },
                { id: `${Date.now()}-6`, title: 'Create and assign tasks: Sage → ROI analysis & opportunity scoring', completed: false, createdAt: new Date() },
                { id: `${Date.now()}-7`, title: 'Write partnership strategy doc and share with admin', completed: false, createdAt: new Date() },
            ],
        },
    ];

    for (const task of tasks) {
        const ref = await db.collection(KANBAN).add({
            ...task,
            createdAt: now,
            updatedAt: now,
        });
        console.log(`   ✅ Created: "${task.name}" → ${ref.id} (assigned to ${task.assignee})`);
    }

    // Also post a beat so it shows up in the activity feed immediately
    await db.collection(TIMELINE).add({
        agentId: 'nora',
        agentName: 'Nora',
        beat: 'signal-spike',
        headline: '🤝 New mission: Partnership Strategy for Pulse',
        detail: 'Partnership strategy task created. Nora will design the approach and assign work to Scout, Solara, and Sage.',
        color: 'blue',
        taskName: 'Design Pulse Partnership Strategy & Create Agent Work Plans',
        createdAt: now,
    });
    console.log('   📣 Posted signal beat to activity feed.');

    return tasks.length;
}

async function showBoardStatus() {
    console.log('\n📊 Current kanban board status:\n');
    const snap = await db.collection(KANBAN).get();
    const byStatus = {};
    const byAssignee = {};
    snap.forEach(d => {
        const data = d.data();
        const s = data.status || 'unknown';
        const a = data.assignee || 'unassigned';
        byStatus[s] = (byStatus[s] || 0) + 1;
        if (!byAssignee[a]) byAssignee[a] = {};
        byAssignee[a][s] = (byAssignee[a][s] || 0) + 1;
    });

    console.log('   By status:');
    for (const [status, count] of Object.entries(byStatus)) {
        console.log(`     ${status}: ${count}`);
    }
    console.log('\n   By assignee:');
    for (const [assignee, statuses] of Object.entries(byAssignee)) {
        const parts = Object.entries(statuses).map(([s, c]) => `${s}:${c}`).join(', ');
        console.log(`     ${assignee}: ${parts}`);
    }
}

async function main() {
    await resetBlockedTasks();
    await seedPartnershipTasks();
    await showBoardStatus();
    console.log('\n✅ Done! Agents will pick up tasks on their next 30s polling cycle.\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
