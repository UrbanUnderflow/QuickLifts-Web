#!/usr/bin/env node
/**
 * kickoffMission.js
 *
 * Autonomous Mission Kickoff Engine
 * ──────────────────────────────────
 * When triggered (by the "Start Mission" button or API), this script:
 *
 *  1. Reads the North Star + any approved proposed objectives from Firestore
 *  2. Loads each agent's current queue to understand gaps
 *  3. Uses GPT-4o to run a structured "mission briefing" — each agent
 *     claims one North Star objective and immediately generates 2-3 real tasks
 *  4. Creates those tasks in Firestore so agent runners pick them up immediately
 *  5. Posts a group-chat mission kickoff message so agents discuss the plan
 *  6. Sets mission status to 'active' so the runners know they're in autonomous mode
 *
 * Usage:
 *   node scripts/kickoffMission.js
 *   node scripts/kickoffMission.js --force   # skip validation, just launch
 */

'use strict';

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

/* ─── Config ─────────────────────────────────────────── */

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

const app = initializeApp({ credential: cert(SERVICE_ACCOUNT) });
const db = getFirestore(app);

const KANBAN_COLLECTION = 'agent-tasks';
const TIMELINE_COLLECTION = 'progress-timeline';
const MISSION_DOC = 'company-config/mission-status';
const NORTH_STAR_DOC = 'company-config/north-star';

const AGENTS = [
    { id: 'nora', name: 'Nora', emoji: '⚡', role: 'Engineering & Operations Lead — builds, deploys, maintains systems' },
    { id: 'scout', name: 'Scout', emoji: '🔭', role: 'Data & Research Lead — finds insights, tracks metrics, analyzes trends' },
    { id: 'solara', name: 'Solara', emoji: '☀️', role: 'Brand & Content Lead — crafts voice, messaging, community content' },
    { id: 'sage', name: 'Sage', emoji: '🌿', role: 'Health Science Lead — synthesizes research, guides product health logic' },
];

const FORCE_MODE = process.argv.includes('--force');

/* ─── Helpers ─────────────────────────────────────────── */

async function postTimeline(agentId, agentName, emoji, beat, headline, opts = {}) {
    await db.collection(TIMELINE_COLLECTION).add({
        agentId, agentName, emoji,
        beat,
        headline,
        objectiveCode: opts.objectiveCode || 'MISSION',
        artifactType: opts.artifactType || 'none',
        artifactText: opts.artifactText || '',
        artifactUrl: opts.artifactUrl || '',
        lensTag: opts.lensTag || 'mission',
        confidenceColor: opts.color || 'green',
        stateTag: opts.stateTag || 'signals',
        createdAt: FieldValue.serverTimestamp(),
    });
}

async function loadNorthStar() {
    const snap = await db.doc(NORTH_STAR_DOC).get();
    if (!snap.exists) throw new Error('No North Star configured. Set one first via the Virtual Office.');
    const data = snap.data();
    if (!data.title) throw new Error('North Star has no title. Please complete the North Star setup.');
    return data;
}

async function loadAgentQueues() {
    const queues = {};
    for (const agent of AGENTS) {
        const snap = await db.collection(KANBAN_COLLECTION)
            .where('assignee', '==', agent.name)
            .where('status', 'in', ['todo', 'in-progress'])
            .limit(10)
            .get();
        queues[agent.id] = snap.docs.map(d => ({ id: d.id, name: d.data().name, status: d.data().status }));
    }
    return queues;
}

async function loadProposedObjectives() {
    const snap = await db.collection('northstar-proposed-objectives')
        .where('status', 'in', ['approved', 'auto-approved'])
        .limit(10)
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function callGPT(systemPrompt, userPrompt, maxTokens = 2000) {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
        }),
    });
    const data = await resp.json();
    if (!data.choices?.[0]?.message?.content) {
        throw new Error(`GPT error: ${JSON.stringify(data).substring(0, 200)}`);
    }
    return JSON.parse(data.choices[0].message.content);
}

/* ─── Phase 1: Mission Plan Generation ───────────────── */

async function generateMissionPlan(northStar, queues, proposedObjectives) {
    const objectives = northStar.objectives || [];
    const proposedBlock = proposedObjectives.length > 0
        ? `\nApproved Agent-Proposed Objectives (treat these with equal priority to the main objectives):\n${proposedObjectives.map((o, i) => `  ${i + 1}. [${o.proposedBy}] ${o.title}: ${o.reason || ''}`).join('\n')}`
        : '';

    const queueBlock = AGENTS.map(a => {
        const q = queues[a.id] || [];
        return `${a.name}: ${q.length === 0 ? 'No tasks — needs work' : q.map(t => `"${t.name}" (${t.status})`).join(', ')}`;
    }).join('\n');

    const systemPrompt = [
        `You are the Mission Director for Pulse (FitWithPulse.ai).`,
        `Your job is to create a CONCRETE autonomous work plan where each agent owns a specific objective and immediately generates real, executable tasks.`,
        ``,
        `NORTH STAR: ${northStar.title}`,
        northStar.description ? `Context: ${northStar.description}` : '',
        ``,
        `NORTH STAR OBJECTIVES:`,
        objectives.map((o, i) => `${i + 1}. ${o}`).join('\n'),
        proposedBlock,
        ``,
        `CURRENT AGENT QUEUES:`,
        queueBlock,
        ``,
        `RULES:`,
        `1. Assign each agent exactly ONE objective they will OWN this mission.`,
        `2. Generate 2-3 CONCRETE tasks per agent. Each task must name a specific file, feature, Firestore collection, or API endpoint.`,
        `3. Tasks must be immediately executable — no planning docs, no "analyze X".`,
        `4. Each task must have a direct_impact explaining exactly how it moves the North Star.`,
        `5. Complexity 1-5: 1=trivial, 3=moderate, 5=massive.`,
        `6. For agents that already have tasks, create tasks that COMPLEMENT (not duplicate) existing work.`,
    ].filter(Boolean).join('\n');

    const result = await callGPT(systemPrompt, `Generate the mission plan. Return JSON with shape:
{
  "mission_summary": "One paragraph describing the overall mission plan",
  "agents": [
    {
      "agentId": "nora|scout|solara|sage",
      "agentName": "Name",
      "claimedObjective": "Which North Star objective they own",
      "tasks": [
        {
          "name": "Task name (specific, action-oriented)",
          "description": "Detailed description with file paths, endpoints, or Firestore collections named explicitly",
          "priority": "high|medium|low",
          "complexity": 1-5,
          "direct_impact": "How this specifically moves the North Star"
        }
      ]
    }
  ]
}`, 3000);

    return result;
}

/* ─── Phase 2: Create Tasks in Firestore ─────────────── */

async function createMissionTasks(plan, missionId) {
    const created = [];
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();

    for (const agentPlan of plan.agents || []) {
        for (const task of agentPlan.tasks || []) {
            const ref = db.collection(KANBAN_COLLECTION).doc();
            batch.set(ref, {
                name: task.name,
                description: `${task.description}\n\n**North Star Impact:** ${task.direct_impact}`,
                assignee: agentPlan.agentName,
                status: 'todo',
                priority: task.priority || 'high',
                complexity: task.complexity || 3,
                source: 'mission-kickoff',
                missionId,
                objectiveCode: `MISSION-${agentPlan.agentId.toUpperCase()}`,
                northStarObjective: agentPlan.claimedObjective,
                northStarDirectImpact: task.direct_impact,
                missionKickoffAt: now,
                createdAt: now,
                updatedAt: now,
            });
            created.push({ id: ref.id, agent: agentPlan.agentName, name: task.name });
        }
    }

    await batch.commit();
    console.log(`✅ Created ${created.length} mission tasks in Firestore`);
    return created;
}

/* ─── Phase 3: Kickoff Group Chat ────────────────────── */

async function postMissionGroupChat(northStar, plan, missionId) {
    const chatRef = await db.collection('agent-group-chats').add({
        title: `🚀 Mission Kickoff: ${northStar.title}`,
        initiatedBy: 'system',
        missionId,
        phase: 'mission-kickoff',
        context: {
            northStarTitle: northStar.title,
            missionSummary: plan.mission_summary,
            meetingPhase: 'strategy',
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        isActive: true,
    });

    // Build the kickoff message
    const agentClaims = (plan.agents || []).map(a =>
        `**${a.agentName}** owns: *${a.claimedObjective}*\n${(a.tasks || []).map(t => `  → ${t.name}`).join('\n')}`
    ).join('\n\n');

    const kickoffContent = [
        `🚀 **MISSION BRIEFING: ${northStar.title}**`,
        ``,
        northStar.description ? `**Context:** ${northStar.description.substring(0, 300)}` : '',
        ``,
        `**Objective Claims:**`,
        agentClaims,
        ``,
        `**Mission Summary:** ${plan.mission_summary}`,
        ``,
        `Your tasks have been created in the Kanban. Agent runners will pick them up immediately.`,
        `As you work, use proposeObjective() to add new objectives you discover. Autonomous mode is NOW ACTIVE.`,
    ].filter(Boolean).join('\n');

    // Post initial message addressed to all agents
    const responses = {};
    for (const agent of AGENTS) {
        responses[agent.id] = { content: '', status: 'pending' };
    }

    await db.collection(`agent-group-chats/${chatRef.id}/messages`).add({
        from: 'system',
        fromName: 'Mission Control',
        content: kickoffContent,
        responses,
        allCompleted: false,
        isKickoff: true,
        missionId,
        createdAt: FieldValue.serverTimestamp(),
        broadcastedAt: FieldValue.serverTimestamp(),
        context: {
            meetingPhase: 'strategy',
            isStrategyPhase: true,
        },
    });

    // Also dispatch individual commands to each agent
    for (const agent of AGENTS) {
        await db.collection('agent-commands').add({
            from: 'system',
            to: agent.id,
            type: 'group-chat',
            content: kickoffContent,
            status: 'pending',
            groupChatId: chatRef.id,
            context: {
                meetingPhase: 'strategy',
                isStrategyPhase: true,
                otherAgents: AGENTS.filter(a => a.id !== agent.id).map(a => a.id),
            },
            createdAt: FieldValue.serverTimestamp(),
        });
    }

    console.log(`💬 Mission kickoff group chat created: ${chatRef.id}`);
    return chatRef.id;
}

/* ─── Phase 4: Activate Mission Status ───────────────── */

async function activateMission(northStar, plan, chatId, taskIds, missionId) {
    await db.doc(MISSION_DOC).set({
        status: 'active',
        missionId,
        northStarTitle: northStar.title,
        missionSummary: plan.mission_summary,
        kickoffChatId: chatId,
        agentObjectives: Object.fromEntries(
            (plan.agents || []).map(a => [a.agentId, a.claimedObjective])
        ),
        taskCount: taskIds.length,
        createdTaskIds: taskIds.map(t => t.id),
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`🎯 Mission status set to ACTIVE (${missionId})`);
}

/* ─── Main ────────────────────────────────────────────── */

async function main() {
    console.log('\n🚀 Pulse Mission Kickoff Engine v1.0');
    console.log('─'.repeat(50));

    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY not set. Cannot run mission kickoff.');
        process.exit(1);
    }

    try {
        // Check if a mission is already active
        if (!FORCE_MODE) {
            const existing = await db.doc(MISSION_DOC).get();
            if (existing.exists && existing.data()?.status === 'active') {
                console.log('⚠️  A mission is already active. Use --force to start a new one.');
                process.exit(0);
            }
        }

        // Generate unique mission ID
        const missionId = `mission-${Date.now()}`;
        console.log(`\n📋 Mission ID: ${missionId}`);

        // Step 1: Load North Star
        console.log('\n⭐ Loading North Star...');
        const northStar = await loadNorthStar();
        console.log(`   Title: ${northStar.title}`);
        console.log(`   Objectives: ${(northStar.objectives || []).length}`);

        // Step 2: Load agent queues
        console.log('\n📊 Loading agent queues...');
        const queues = await loadAgentQueues();
        for (const [agentId, tasks] of Object.entries(queues)) {
            console.log(`   ${agentId}: ${tasks.length} active tasks`);
        }

        // Step 3: Load approved proposed objectives
        const proposedObjectives = await loadProposedObjectives();
        if (proposedObjectives.length > 0) {
            console.log(`\n💡 ${proposedObjectives.length} approved agent-proposed objectives included`);
        }

        // Step 4: Generate mission plan
        console.log('\n🧠 Generating mission plan with GPT-4o...');
        const plan = await generateMissionPlan(northStar, queues, proposedObjectives);
        console.log(`\n📋 Mission Summary: ${plan.mission_summary?.substring(0, 150)}...`);
        for (const agent of plan.agents || []) {
            console.log(`\n   ${agent.agentName} → "${agent.claimedObjective}"`);
            for (const task of agent.tasks || []) {
                console.log(`     • ${task.name}`);
            }
        }

        // Step 5: Create tasks
        console.log('\n✏️  Creating tasks in Firestore...');
        const createdTasks = await createMissionTasks(plan, missionId);

        // Step 6: Post kickoff group chat
        console.log('\n💬 Posting mission kickoff group chat...');
        const chatId = await postMissionGroupChat(northStar, plan, missionId);

        // Step 7: Activate mission
        console.log('\n🎯 Activating mission...');
        await activateMission(northStar, plan, chatId, createdTasks, missionId);

        // Step 8: Post timeline beat
        await postTimeline(
            'system', 'Mission Control', '🚀',
            'result',
            `🚀 Mission Launched: ${northStar.title}`,
            {
                objectiveCode: 'MISSION',
                color: 'green',
                lensTag: 'mission',
                artifactText: `${createdTasks.length} tasks created across ${AGENTS.length} agents`,
            }
        );

        console.log('\n' + '═'.repeat(50));
        console.log('✅ MISSION LAUNCHED SUCCESSFULLY');
        console.log(`   Tasks created: ${createdTasks.length}`);
        console.log(`   Agents briefed: ${AGENTS.length}`);
        console.log(`   Group chat: ${chatId}`);
        console.log(`   Mission ID: ${missionId}`);
        console.log('═'.repeat(50) + '\n');

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Mission kickoff failed:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

main();
