#!/usr/bin/env node
/**
 * kickoffMission.js
 *
 * Autonomous Mission Kickoff Engine
 * ──────────────────────────────────
 * When triggered (by the "Start Mission" button or API), this script:
 *
 *  1. Reads the North Star + approved agent-proposed objectives from Firestore
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
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const {
    DEFAULT_MAX_ACTIVE_TASKS_PER_AGENT,
    DEFAULT_EXECUTE_GATE_MODE,
    DEFAULT_SCORE_GATE_MODE,
    DEFAULT_MAX_LEARNING_INVALIDATION_WIP_PCT,
    DEFAULT_MAX_WAIVED_CREDIT_PCT,
    DEFAULT_MAX_QUEUED_EXECUTE_TASKS_PER_AGENT,
    DEFAULT_MAX_QUEUED_EXPLORE_TASKS_PER_AGENT,
    DEFAULT_MISSION_MODE,
    DEFAULT_PLANNER_MODE,
    DEFAULT_PLANNER_MIN_CREDITED_SCORE,
    DEFAULT_PLANNER_MIN_NET_SCORE,
    DEFAULT_STALL_WINDOW_MINUTES,
    MISSION_SYSTEM_VERSION,
    OUTCOME_COLLECTION,
    buildExecuteTaskContract,
    normalizeMissionPolicy,
    recordMissionRunEvent,
    shouldQuarantineTask,
} = require('./missionOsV2');

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
// Mission kickoff should default to OpenClaw OAuth unless explicitly disabled.
const USE_OPENCLAW = process.env.USE_OPENCLAW !== 'false';
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'main';
const ALLOW_DIRECT_OPENAI = Boolean(process.env.OPENAI_API_KEY) && !USE_OPENCLAW;
const MISSION_PLANNING_WINDOW_MS = parseInt(process.env.MISSION_PLANNING_WINDOW_MS || '90000', 10);
const MISSION_PLANNING_POLL_MS = parseInt(process.env.MISSION_PLANNING_POLL_MS || '4000', 10);
const SYSTEM_VERSION_ARG = process.argv.find((arg) => arg.startsWith('--system-version='));
const MODE_ARG = process.argv.find((arg) => arg.startsWith('--mode='));
const MISSION_SYSTEM_VERSION_OVERRIDE = parseInt(
    process.env.MISSION_SYSTEM_VERSION || SYSTEM_VERSION_ARG?.split('=')[1] || `${MISSION_SYSTEM_VERSION}`,
    10
);
const MISSION_MODE = String(process.env.MISSION_MODE || MODE_ARG?.split('=')[1] || DEFAULT_MISSION_MODE).toLowerCase() === 'explore'
    ? 'explore'
    : 'execute';
const MISSION_CANARY = ['1', 'true', 'yes'].includes(String(process.env.MISSION_CANARY || '').toLowerCase()) || process.argv.includes('--canary');
const USE_MISSION_V2 = Number.isFinite(MISSION_SYSTEM_VERSION_OVERRIDE) && MISSION_SYSTEM_VERSION_OVERRIDE >= MISSION_SYSTEM_VERSION;

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

function normalizeObjectiveText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function getPrimaryObjectives(northStar) {
    const explicitObjectives = Array.isArray(northStar?.objectives)
        ? northStar.objectives.map(normalizeObjectiveText).filter(Boolean)
        : [];
    if (explicitObjectives.length > 0) return explicitObjectives;

    const fallback = normalizeObjectiveText(northStar?.title);
    return fallback ? [fallback] : ['Advance the current company North Star'];
}

function getApprovedProposedObjectives(proposedObjectives) {
    return (Array.isArray(proposedObjectives) ? proposedObjectives : [])
        .map((item) => {
            const id = normalizeObjectiveText(item?.id);
            const title = normalizeObjectiveText(item?.title);
            if (!id || !title) return null;
            return {
                id,
                title,
                reason: normalizeObjectiveText(item?.reason),
                proposedBy: normalizeObjectiveText(item?.proposedBy || item?.proposedByName || 'agent'),
            };
        })
        .filter(Boolean);
}

function findBestPrimaryObjective(rawValue, primaryObjectives, fallbackIndex = 0) {
    const candidate = normalizeObjectiveText(rawValue);
    if (candidate) {
        const exact = primaryObjectives.find((o) => o === candidate);
        if (exact) return exact;

        const caseInsensitive = primaryObjectives.find((o) => o.toLowerCase() === candidate.toLowerCase());
        if (caseInsensitive) return caseInsensitive;

        const fuzzy = primaryObjectives.find((o) =>
            o.toLowerCase().includes(candidate.toLowerCase()) ||
            candidate.toLowerCase().includes(o.toLowerCase())
        );
        if (fuzzy) return fuzzy;
    }

    return primaryObjectives[fallbackIndex % primaryObjectives.length];
}

function normalizeObjectiveSource(rawValue) {
    const value = String(rawValue || '').trim().toLowerCase();
    return value === 'agent-proposed' ? 'agent-proposed' : 'primary';
}

function findMatchingProposedObjective(task, approvedProposedObjectives) {
    const requestedId = normalizeObjectiveText(task?.proposedObjectiveId);
    if (requestedId) {
        const byId = approvedProposedObjectives.find((o) => o.id === requestedId);
        if (byId) return byId;
    }

    const requestedTitle = normalizeObjectiveText(task?.objectiveLink);
    if (!requestedTitle) return null;

    const exact = approvedProposedObjectives.find((o) => o.title.toLowerCase() === requestedTitle.toLowerCase());
    if (exact) return exact;

    const fuzzy = approvedProposedObjectives.find((o) =>
        o.title.toLowerCase().includes(requestedTitle.toLowerCase()) ||
        requestedTitle.toLowerCase().includes(o.title.toLowerCase())
    );
    return fuzzy || null;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGPT(systemPrompt, userPrompt, maxTokens = 2000) {
    if (USE_OPENCLAW) {
        const clawPrompt = `${systemPrompt}\n\n${userPrompt}`;
        const spawnResult = spawnSync(
            OPENCLAW_BIN,
            [
                '--no-color',
                'agent',
                '--local',
                '--agent',
                OPENCLAW_AGENT_ID,
                '--message',
                clawPrompt,
                '--timeout',
                '90',
            ],
            { encoding: 'utf8', timeout: 120_000, maxBuffer: 10 * 1024 * 1024, cwd: process.cwd(), env: process.env }
        );

        if (spawnResult.error) {
            throw new Error(`OpenClaw mission planning failed to start: ${spawnResult.error.message}`);
        }
        if (spawnResult.status !== 0) {
            const detail = (spawnResult.stderr || spawnResult.stdout || '').trim();
            throw new Error(`OpenClaw mission planning failed (exit ${spawnResult.status}): ${detail.substring(0, 500)}`);
        }
        const result = String(spawnResult.stdout || '').trim();

        let content = result;
        try {
            const wrapped = JSON.parse(result);
            if (wrapped && typeof wrapped === 'object' && wrapped.mission_summary) {
                return wrapped;
            }
            content = wrapped?.response || wrapped?.output || wrapped?.result || result;
        } catch {
            // Keep raw result and parse below.
        }

        if (content && typeof content === 'object' && content.mission_summary) {
            return content;
        }

        const cleaned = String(content || '')
            .replace(/^```json?\n?/i, '')
            .replace(/\n?```$/i, '')
            .trim();

        const jsonCandidateMatch = cleaned.match(/\{[\s\S]*\}$/m);
        const jsonCandidate = jsonCandidateMatch ? jsonCandidateMatch[0] : cleaned;
        return JSON.parse(jsonCandidate);
    }

    if (!ALLOW_DIRECT_OPENAI) {
        throw new Error('No AI provider available. Enable USE_OPENCLAW or set OPENAI_API_KEY.');
    }

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

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`GPT error: ${errText.substring(0, 300)}`);
    }

    const data = await resp.json();
    if (!data.choices?.[0]?.message?.content) {
        throw new Error(`GPT error: ${JSON.stringify(data).substring(0, 200)}`);
    }
    return JSON.parse(data.choices[0].message.content);
}

/* ─── Phase 1: Mission Plan Generation ───────────────── */

async function generateMissionPlan(northStar, primaryObjectives, approvedProposedObjectives, queues, planningTranscript) {
    const proposedBlock = approvedProposedObjectives.length > 0
        ? `\nAPPROVED AGENT-PROPOSED OBJECTIVES (SECONDARY LANE; LOWER PRIORITY THAN PRIMARY OBJECTIVES):\n${approvedProposedObjectives.map((o, i) => `  ${i + 1}. [${o.proposedBy}] (${o.id}) ${o.title}${o.reason ? `: ${o.reason}` : ''}`).join('\n')}`
        : '';
    const planningBlock = planningTranscript
        ? `\nROUND-TABLE STRATEGY TRANSCRIPT (use this to drive assignment choices):\n${planningTranscript}`
        : '\nROUND-TABLE STRATEGY TRANSCRIPT:\n(no responses captured — infer best assignments from North Star + queues)';

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
        `PRIMARY NORTH STAR OBJECTIVES (operator-set, highest priority):`,
        primaryObjectives.map((o, i) => `${i + 1}. ${o}`).join('\n'),
        proposedBlock,
        ``,
        `CURRENT AGENT QUEUES:`,
        queueBlock,
        planningBlock,
        ``,
        `RULES:`,
        `1. Assign each agent exactly ONE claimedObjective from the PRIMARY objective list above. Copy objective text exactly.`,
        `2. Generate 2-3 CONCRETE tasks per agent. Each task must name a specific file, feature, Firestore collection, or API endpoint.`,
        `3. Tasks must be immediately executable — no planning docs, no "analyze X".`,
        `4. PRIMARY objectives take priority over agent-proposed objectives.`,
        `5. For each agent: at least 2 tasks must have objectiveSource="primary". At most 1 task may have objectiveSource="agent-proposed".`,
        `6. If objectiveSource="agent-proposed", proposedObjectiveId must reference an approved proposed objective from the list above.`,
        `7. Each task must include objectiveLink (exact objective text this task advances) and direct_impact (how it moves the North Star).`,
        `8. Complexity 1-5: 1=trivial, 3=moderate, 5=massive.`,
        `9. For agents that already have tasks, create tasks that COMPLEMENT (not duplicate) existing work.`,
        `10. Reflect at least one concrete idea from each agent's strategy response when possible.`,
        `11. If the mission mode is execute, every task must include a concrete artifactSpec and at least 2 acceptanceChecks: one artifact existence check and one impact/behavior check.`,
        `12. taskClass should be one of execute-unit, dependency-unblocker, correction, delivery, or explore-brief.`,
        `13. verificationPolicy should default to automatedAuthority=true with humanSpotCheck="exceptions-and-sample" unless the task obviously requires manual review.`,
    ].filter(Boolean).join('\n');

    const result = await callGPT(systemPrompt, `Generate the mission plan. Return JSON with shape:
{
  "mission_summary": "One paragraph describing the overall mission plan",
      "agents": [
        {
          "agentId": "nora|scout|solara|sage",
          "agentName": "Name",
          "claimedObjective": "ONE primary objective text copied exactly from the PRIMARY list",
          "tasks": [
            {
              "name": "Task name (specific, action-oriented)",
              "description": "Detailed description with file paths, endpoints, or Firestore collections named explicitly",
              "priority": "high|medium|low",
              "complexity": 1-5,
              "objectiveSource": "primary|agent-proposed",
              "objectiveLink": "Exact objective text this task advances",
              "proposedObjectiveId": "Required only when objectiveSource is agent-proposed, else empty string",
              "direct_impact": "How this specifically moves the North Star",
              "taskClass": "execute-unit|dependency-unblocker|correction|delivery|explore-brief",
              "priorityScore": 10,
              "expiresInHours": 72,
              "artifactSpec": {
                "kind": "repo_file|runtime_change|firestore_change|api_behavior|external_action|content_asset",
                "targets": ["specific file, endpoint, collection, or artifact target"],
                "successDefinition": "What must exist when the task is actually done",
                "mustTouchRepo": true,
                "impactScope": "user-facing|internal|supporting"
              },
              "acceptanceChecks": [
                {
                  "kind": "shell|file|firestore|http|manual-spot-check",
                  "label": "Check label",
                  "commandOrPath": "command, file path, endpoint, or firestore target",
                  "expectedSignal": "What success looks like"
                }
              ],
              "dependencyIds": ["Optional task ids or dependency names"],
              "verificationPolicy": {
                "automatedAuthority": true,
                "humanSpotCheck": "exceptions-and-sample",
                "sampleRate": 0.2
              }
            }
          ]
        }
      ]
}`, 3000);

    return result;
}

/* ─── Phase 2: Create Tasks in Firestore ─────────────── */

async function createMissionTasks(plan, missionId, primaryObjectives, approvedProposedObjectives, missionPolicy = {}) {
    const created = [];
    const auditEvents = [];
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();
    const normalizedPolicy = normalizeMissionPolicy(missionPolicy);

    for (let agentIndex = 0; agentIndex < (plan.agents || []).length; agentIndex += 1) {
        const agentPlan = plan.agents[agentIndex];
        const claimedObjective = findBestPrimaryObjective(agentPlan?.claimedObjective, primaryObjectives, agentIndex);
        let secondaryTaskCount = 0;
        let releasedExecuteCount = 0;

        for (const task of agentPlan.tasks || []) {
            let objectiveSource = normalizeObjectiveSource(task?.objectiveSource);
            let objectiveLink = normalizeObjectiveText(task?.objectiveLink);
            let matchedProposedObjective = null;

            if (objectiveSource === 'agent-proposed') {
                matchedProposedObjective = findMatchingProposedObjective(task, approvedProposedObjectives);
                const canUseSecondaryLane = matchedProposedObjective && secondaryTaskCount < 1;
                if (!canUseSecondaryLane) {
                    objectiveSource = 'primary';
                } else {
                    secondaryTaskCount += 1;
                    objectiveLink = matchedProposedObjective.title;
                }
            }

            if (objectiveSource === 'primary') {
                objectiveLink = findBestPrimaryObjective(objectiveLink || claimedObjective, primaryObjectives, agentIndex);
            }

            const taskDescription = String(task?.description || '').trim();
            const directImpact = String(task?.direct_impact || '').trim() || 'Advances the assigned objective through concrete execution.';
            const objectiveLaneLabel = objectiveSource === 'agent-proposed'
                ? `Agent-Proposed Objective (secondary): ${objectiveLink}`
                : `North Star Objective (primary): ${objectiveLink}`;
            const executeContract = USE_MISSION_V2 && normalizedPolicy.mode === 'execute'
                ? buildExecuteTaskContract(
                    {
                        ...task,
                        name: task.name,
                        description: taskDescription,
                        northStarObjective: claimedObjective,
                        northStarObjectiveLink: objectiveLink,
                    },
                    {
                        plannerSource: 'mission-supervisor',
                        taskClass: task?.taskClass || 'execute-unit',
                        objectiveId: objectiveLink,
                        priorityScore: task?.priorityScore,
                        expiresInHours: Number(task?.expiresInHours || 72) || 72,
                        missionPolicy: normalizedPolicy,
                        missionId,
                        assignee: agentPlan.agentName,
                    }
                )
                : null;
            let nextStatus = executeContract && (!executeContract.hasContract || !executeContract.executeGatePassed) ? 'needs-spec' : 'todo';
            if (executeContract && executeContract.hasContract && executeContract.executeGatePassed) {
                releasedExecuteCount += 1;
                if (releasedExecuteCount > normalizedPolicy.maxQueuedExecuteTasksPerAgent) {
                    nextStatus = 'blocked';
                }
            }

            const ref = db.collection(KANBAN_COLLECTION).doc();
            const outcomeRef = executeContract ? db.collection(OUTCOME_COLLECTION).doc(executeContract.outcomeId || undefined) : null;
            const outcomeStatus = nextStatus === 'blocked' ? 'planned' : 'planned';
            batch.set(ref, {
                name: task.name,
                description: `${taskDescription}\n\n**North Star Impact:** ${directImpact}\n**Objective Lane:** ${objectiveLaneLabel}`,
                assignee: agentPlan.agentName,
                status: nextStatus,
                priority: task.priority || 'high',
                complexity: task.complexity || 3,
                source: 'mission-kickoff',
                missionId,
                objectiveCode: `MISSION-${agentPlan.agentId.toUpperCase()}`,
                northStarObjective: claimedObjective,
                northStarObjectiveSource: objectiveSource,
                northStarObjectiveLink: objectiveLink,
                northStarDirectImpact: directImpact,
                agentProposedObjectiveId: matchedProposedObjective?.id || '',
                agentProposedObjectiveTitle: matchedProposedObjective?.title || '',
                missionKickoffAt: now,
                createdAt: now,
                updatedAt: now,
                ...(executeContract ? {
                    specVersion: executeContract.specVersion,
                    mode: executeContract.mode,
                    plannerSource: executeContract.plannerSource,
                    taskClass: executeContract.taskClass,
                    objectiveId: executeContract.objectiveId,
                    artifactSpec: executeContract.artifactSpec,
                    acceptanceChecks: executeContract.acceptanceChecks,
                    dependencyIds: executeContract.dependencyIds,
                    verificationPolicy: executeContract.verificationPolicy,
                    priorityScore: executeContract.priorityScore,
                    expiresAt: executeContract.expiresAt,
                    quarantineReason: executeContract.quarantineReason,
                    quarantinedAt: executeContract.quarantinedAt,
                    verificationResult: executeContract.verificationResult,
                    outcomeId: executeContract.outcomeId,
                    parentOutcomeId: executeContract.parentOutcomeId,
                    supersedesOutcomeId: executeContract.supersedesOutcomeId,
                    outcomeClass: executeContract.outcomeClass,
                    outcomeDomain: executeContract.outcomeDomain,
                    outcomeRole: executeContract.outcomeRole,
                    proofPacket: executeContract.proofPacket,
                    policyRefs: executeContract.policyRefs,
                    expectedAttribution: executeContract.expectedAttribution,
                    expectedOutcomeScore: executeContract.expectedOutcomeScore,
                    expectedImpactScore: executeContract.expectedImpactScore,
                    expectedCreditedScore: executeContract.expectedCreditedScore,
                    expectedNetScore: executeContract.expectedNetScore,
                    proofCompileStatus: executeContract.proofCompileStatus,
                    proofCompileErrors: executeContract.proofCompileErrors,
                    compiledProofPacketHash: executeContract.compiledProofPacketHash,
                    expectedSignalWindow: executeContract.expectedSignalWindow,
                    playbookId: executeContract.playbookId,
                    playbookVersion: executeContract.playbookVersion,
                    actionType: executeContract.actionType,
                    currentStageId: executeContract.currentStageId,
                    sideEffectClass: executeContract.sideEffectClass,
                    creditBucket: executeContract.creditBucket,
                    stageGateStatus: executeContract.stageGateStatus,
                    stageBlockReason: executeContract.stageBlockReason,
                    speculative: executeContract.speculative,
                    cleanupBy: executeContract.cleanupBy,
                    cleanupState: executeContract.cleanupState,
                    readinessSignals: executeContract.readinessSignals,
                    commercialCreditEligible: executeContract.commercialCreditEligible,
                    admissionDecision: executeContract.admissionDecision,
                    emittedReadinessSignalIds: executeContract.emittedReadinessSignalIds,
                    requiredReadinessSignalIds: executeContract.requiredReadinessSignalIds,
                    outcomeStatus,
                } : {}),
            });
            if (outcomeRef && executeContract?.outcomeRecord) {
                batch.set(outcomeRef, {
                    ...executeContract.outcomeRecord,
                    id: outcomeRef.id,
                    missionId,
                    objectiveId: executeContract.objectiveId,
                    primaryTaskIds: [ref.id],
                    status: outcomeStatus,
                    createdAt: now,
                    updatedAt: now,
                }, { merge: true });
            }
            created.push({
                id: ref.id,
                agent: agentPlan.agentName,
                name: task.name,
                objectiveSource,
                objectiveLink,
                mode: executeContract?.mode || normalizedPolicy.mode || 'explore',
                status: nextStatus,
                objectiveId: executeContract?.objectiveId || '',
            });
            auditEvents.push({
                agentId: agentPlan.agentId,
                taskId: ref.id,
                taskName: task.name,
                status: nextStatus,
                taskClass: executeContract?.taskClass || task?.taskClass || '',
                objectiveId: executeContract?.objectiveId || '',
                mode: executeContract?.mode || normalizedPolicy.mode || 'explore',
                outcomeId: executeContract?.outcomeId || '',
                outcomeClass: executeContract?.outcomeClass || '',
            });
        }
    }

    await batch.commit();
    if (USE_MISSION_V2) {
        for (const event of auditEvents) {
            await recordMissionRunEvent(db, FieldValue, missionId, 'created-task', event);
            if (event.outcomeId) {
                await recordMissionRunEvent(db, FieldValue, missionId, 'planned-outcome', {
                    outcomeId: event.outcomeId,
                    objectiveId: event.objectiveId || '',
                    taskId: event.taskId,
                    outcomeClass: event.outcomeClass || '',
                });
            }
        }
    }
    console.log(`✅ Created ${created.length} mission tasks in Firestore`);
    return created;
}

/* ─── Phase 3: Strategy Roundtable Kickoff ───────────── */

async function startMissionPlanningChat(northStar, missionId) {
    const now = FieldValue.serverTimestamp();
    const participants = AGENTS.map(a => a.id);
    const chatRef = await db.collection('agent-group-chats').add({
        participants,
        createdBy: 'admin',
        createdAt: now,
        lastMessageAt: now,
        status: 'active',
        metadata: {
            messageCount: 1,
            sessionDuration: 0,
        },
        title: `🚀 Mission Strategy: ${northStar.title}`,
        initiatedBy: 'system',
        missionId,
        phase: 'mission-kickoff',
        context: {
            northStarTitle: northStar.title,
            meetingPhase: 'strategy',
            missionPhase: 'planning',
        },
        updatedAt: now,
        isActive: true,
    });

    const kickoffContent = [
        `🚀 **MISSION STRATEGY ROUNDTABLE: ${northStar.title}**`,
        ``,
        northStar.description ? `**Context:** ${northStar.description.substring(0, 350)}` : '',
        ``,
        `Round 1 (strategy only — no task execution yet):`,
        `1. State which objective you believe you should own and why.`,
        `2. Challenge one risky assumption in this North Star.`,
        `3. @mention one teammate and ask a concrete strategic question.`,
        ``,
        `Do NOT create or execute tasks yet. Planning velocity first, assignment second.`,
        `Mission Control will convert this strategy thread into task assignments after the roundtable.`,
    ].filter(Boolean).join('\n');

    const responses = {};
    for (const agent of AGENTS) {
        responses[agent.id] = { content: '', status: 'pending' };
    }

    const messageRef = await db.collection(`agent-group-chats/${chatRef.id}/messages`).add({
        from: 'system',
        fromName: 'Mission Control',
        content: kickoffContent,
        responses,
        allCompleted: false,
        isKickoff: true,
        missionId,
        createdAt: now,
        broadcastedAt: now,
        context: {
            meetingPhase: 'strategy',
            isStrategyPhase: true,
            missionPhase: 'planning',
        },
    });

    const batch = db.batch();
    for (const agent of AGENTS) {
        const cmdRef = db.collection('agent-commands').doc();
        batch.set(cmdRef, {
            from: 'system',
            to: agent.id,
            type: 'group-chat',
            content: kickoffContent,
            status: 'pending',
            groupChatId: chatRef.id,
            messageId: messageRef.id,
            context: {
                meetingPhase: 'strategy',
                isStrategyPhase: true,
                missionPhase: 'planning',
                otherAgents: AGENTS.filter(a => a.id !== agent.id).map(a => a.id),
            },
            createdAt: now,
        });
    }
    batch.update(db.doc(`agent-group-chats/${chatRef.id}`), {
        lastMessageAt: now,
    });
    await batch.commit();

    console.log(`💬 Mission strategy group chat created: ${chatRef.id} (message ${messageRef.id})`);
    return { chatId: chatRef.id, messageId: messageRef.id, kickoffContent };
}

async function waitForMissionPlanningResponses(chatId, messageId, kickoffContent) {
    const messageRef = db.doc(`agent-group-chats/${chatId}/messages/${messageId}`);
    const deadline = Date.now() + MISSION_PLANNING_WINDOW_MS;
    let messageData = null;

    while (Date.now() < deadline) {
        const snap = await messageRef.get();
        if (snap.exists) {
            messageData = snap.data() || {};
            const responses = messageData.responses || {};
            const completedCount = AGENTS.filter(agent => {
                const status = responses[agent.id]?.status;
                return status === 'completed' || status === 'failed' || status === 'timed-out';
            }).length;
            const allCompleted = messageData.allCompleted === true || completedCount >= AGENTS.length;
            if (allCompleted) break;
        }
        await sleep(MISSION_PLANNING_POLL_MS);
    }

    const responses = messageData?.responses || {};
    const transcriptLines = [`Mission Control: ${kickoffContent}`];
    for (const agent of AGENTS) {
        const responseText = String(responses[agent.id]?.content || '').trim();
        if (!responseText) continue;
        transcriptLines.push(`${agent.name}: ${responseText}`);
    }

    const respondedCount = AGENTS.filter(agent => String(responses[agent.id]?.content || '').trim().length > 0).length;
    return {
        transcript: transcriptLines.join('\n\n'),
        respondedCount,
    };
}

async function postMissionExecutionHandoff(chatId, northStar, plan, primaryObjectives, createdTasks, missionId) {
    const now = FieldValue.serverTimestamp();
    const secondaryCount = createdTasks.filter((t) => t.objectiveSource === 'agent-proposed').length;
    const primaryCount = createdTasks.length - secondaryCount;
    const normalizedAgents = (plan.agents || []).map((a, i) => ({
        ...a,
        claimedObjective: findBestPrimaryObjective(a?.claimedObjective, primaryObjectives, i),
    }));
    const agentClaims = normalizedAgents.map(a =>
        `**${a.agentName}** owns: *${a.claimedObjective}*\n${(a.tasks || []).map(t => `  → ${t.name}`).join('\n')}`
    ).join('\n\n');
    const createdByAgent = AGENTS.map(agent => {
        const count = createdTasks.filter(t => t.agent === agent.name).length;
        return `${agent.name}: ${count} task${count === 1 ? '' : 's'}`;
    }).join(' • ');

    const handoffContent = [
        `⚡ **MISSION EXECUTION HANDOFF: ${northStar.title}**`,
        ``,
        `Strategy round complete. Assignments are now live in Kanban.`,
        ``,
        `**Objective Ownership + Tasks**`,
        agentClaims,
        ``,
        `**Mission Summary:** ${plan.mission_summary}`,
        `**Tasks Created:** ${createdTasks.length} total (${createdByAgent})`,
        `**Objective Lane Split:** ${primaryCount} primary / ${secondaryCount} agent-proposed secondary`,
        ``,
        `Execution mode is now active. Build immediately; keep cross-agent updates concise and concrete.`,
    ].filter(Boolean).join('\n');

    await db.doc(`agent-group-chats/${chatId}`).set({
        phase: 'mission-execution',
        updatedAt: now,
        context: {
            northStarTitle: northStar.title,
            meetingPhase: 'action',
            missionPhase: 'execution',
            missionSummary: plan.mission_summary,
        },
    }, { merge: true });

    const responses = {};
    for (const agent of AGENTS) {
        responses[agent.id] = { content: '', status: 'pending' };
    }

    const handoffRef = await db.collection(`agent-group-chats/${chatId}/messages`).add({
        from: 'system',
        fromName: 'Mission Control',
        content: handoffContent,
        responses,
        allCompleted: false,
        missionId,
        isExecutionHandoff: true,
        createdAt: now,
        broadcastedAt: now,
        context: {
            meetingPhase: 'action',
            missionPhase: 'execution',
        },
    });

    const batch = db.batch();
    for (const agent of AGENTS) {
        const cmdRef = db.collection('agent-commands').doc();
        batch.set(cmdRef, {
            from: 'system',
            to: agent.id,
            type: 'group-chat',
            content: handoffContent,
            status: 'pending',
            groupChatId: chatId,
            messageId: handoffRef.id,
            context: {
                meetingPhase: 'action',
                missionPhase: 'execution',
                otherAgents: AGENTS.filter(a => a.id !== agent.id).map(a => a.id),
            },
            createdAt: now,
        });
    }
    batch.update(db.doc(`agent-group-chats/${chatId}`), {
        lastMessageAt: now,
    });
    await batch.commit();
}

/* ─── Phase 4: Mission Status ─────────────────────────── */

async function loadPresenceByAgent() {
    const snap = await db.collection('agent-presence').get();
    return snap.docs.reduce((acc, doc) => {
        acc[doc.id] = { id: doc.id, ...doc.data() };
        return acc;
    }, {});
}

async function quarantineLegacyAutoBacklog(missionId) {
    if (!USE_MISSION_V2) return { count: 0, taskIds: [] };

    const presenceByAgent = await loadPresenceByAgent();
    const snap = await db.collection(KANBAN_COLLECTION)
        .where('status', 'in', ['todo', 'needs-review'])
        .get();

    const nowMs = Date.now();
    const taskIds = [];
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snap.docs) {
        const task = { id: doc.id, ...doc.data() };
        if (!shouldQuarantineTask(task, presenceByAgent, nowMs)) continue;

        batch.update(doc.ref, {
            status: 'quarantined',
            quarantineReason: 'mission-v2-backlog-cleanup',
            quarantinedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        batchCount += 1;
        taskIds.push(doc.id);

        if (batchCount >= 400) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    for (const taskId of taskIds) {
        await recordMissionRunEvent(db, FieldValue, missionId, 'quarantined-task', {
            taskId,
            reason: 'mission-v2-backlog-cleanup',
        });
    }

    return { count: taskIds.length, taskIds };
}

function buildMissionPolicyFields(overrides = {}) {
    const policy = normalizeMissionPolicy({
        systemVersion: MISSION_SYSTEM_VERSION_OVERRIDE,
        mode: MISSION_MODE,
        plannerMode: DEFAULT_PLANNER_MODE,
        stallWindowMinutes: DEFAULT_STALL_WINDOW_MINUTES,
        maxActiveTasksPerAgent: DEFAULT_MAX_ACTIVE_TASKS_PER_AGENT,
        maxQueuedExecuteTasksPerAgent: DEFAULT_MAX_QUEUED_EXECUTE_TASKS_PER_AGENT,
        maxQueuedExploreTasksPerAgent: DEFAULT_MAX_QUEUED_EXPLORE_TASKS_PER_AGENT,
        canary: MISSION_CANARY,
        ...overrides,
    });

    return {
        mode: policy.mode,
        plannerMode: policy.plannerMode,
        systemVersion: policy.systemVersion,
        stallWindowMinutes: policy.stallWindowMinutes,
        maxActiveTasksPerAgent: policy.maxActiveTasksPerAgent,
        maxQueuedExecuteTasksPerAgent: policy.maxQueuedExecuteTasksPerAgent,
        maxQueuedExploreTasksPerAgent: policy.maxQueuedExploreTasksPerAgent,
        plannerMinimumCreditedScore: policy.plannerMinimumCreditedScore,
        plannerMinimumNetScore: policy.plannerMinimumNetScore,
        executeGateMode: policy.executeGateMode || DEFAULT_EXECUTE_GATE_MODE,
        scoreGateMode: policy.scoreGateMode || DEFAULT_SCORE_GATE_MODE,
        maxLearningInvalidationWipPct: policy.maxLearningInvalidationWipPct || DEFAULT_MAX_LEARNING_INVALIDATION_WIP_PCT,
        allowWaivedCredit: policy.allowWaivedCredit,
        maxWaivedCreditPct: policy.maxWaivedCreditPct || DEFAULT_MAX_WAIVED_CREDIT_PCT,
        allowNegativeNetScore: policy.allowNegativeNetScore,
        clampCreditedScoreAtZero: policy.clampCreditedScoreAtZero,
        hardFailureNetHandling: policy.hardFailureNetHandling,
        hardFailureDebtFloor: policy.hardFailureDebtFloor,
        canary: policy.canary,
        playbookId: policy.playbookId || '',
        playbookVersion: policy.playbookVersion || 0,
        currentStageId: policy.currentStageId || '',
        currentStageOrdinal: policy.currentStageOrdinal || 0,
        readinessSignals: Array.isArray(policy.readinessSignals) ? policy.readinessSignals : [],
        speculativeActionsAllowed: Array.isArray(policy.speculativeActionsAllowed) ? policy.speculativeActionsAllowed : [],
        requiredApprovals: Array.isArray(policy.requiredApprovals) ? policy.requiredApprovals : [],
        commercialPrimaryDomain: policy.commercialPrimaryDomain || '',
        cleanupTTLHours: policy.cleanupTTLHours || 0,
        allowSpeculative: Boolean(policy.allowSpeculative),
    };
}

async function setMissionPlanningStatus(northStar, missionId, chatId) {
    await db.doc(MISSION_DOC).set({
        status: 'active',
        missionPhase: 'planning',
        missionId,
        northStarTitle: northStar.title,
        missionSummary: 'Mission strategy roundtable is live. Agents are planning before task assignment.',
        kickoffChatId: chatId,
        taskCount: 0,
        createdTaskIds: [],
        startedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        plannerState: USE_MISSION_V2 ? 'planning' : 'legacy',
        lastVerifiedDeliverableAt: null,
        verifiedDeliverableCount: 0,
        autopauseReason: '',
        objectiveProgress: {},
        quarantinedTaskCount: 0,
        plannedOutcomeCount: 0,
        observingOutcomeCount: 0,
        confirmedOutcomeCount: 0,
        reversedOutcomeCount: 0,
        guardrailFailureCount: 0,
        terminalOutcomeScore: 0,
        enablingOutcomeScore: 0,
        learningOutcomeScore: 0,
        invalidationOutcomeScore: 0,
        constraintOutcomeScore: 0,
        creditedOutcomeScore: 0,
        netOutcomeScore: 0,
        businessDebtScore: 0,
        waivedOutcomeCount: 0,
        waivedCreditedScore: 0,
        canceledOutcomeCount: 0,
        supersededOutcomeCount: 0,
        executionScore: 0,
        commercialMovementScore: 0,
        speculativeOutcomeCount: 0,
        ...buildMissionPolicyFields(),
    }, { merge: true });
    console.log(`🎯 Mission status set to PLANNING (${missionId})`);
}

async function activateMission(northStar, plan, primaryObjectives, chatId, taskIds, missionId, quarantineResult = { count: 0 }) {
    const objectiveProgress = Object.fromEntries(
        (plan.agents || []).map((a, i) => {
            const objective = findBestPrimaryObjective(a?.claimedObjective, primaryObjectives, i);
            const objectiveId = objective
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, 48) || `OBJECTIVE_${i + 1}`;
            return [objectiveId, {
                title: objective,
                verifiedDeliverableCount: 0,
                openTaskCount: (a.tasks || []).length,
                completedTaskCount: 0,
            }];
        })
    );
    await db.doc(MISSION_DOC).set({
        status: 'active',
        missionPhase: 'execution',
        missionId,
        northStarTitle: northStar.title,
        missionSummary: plan.mission_summary,
        kickoffChatId: chatId,
        agentObjectives: Object.fromEntries(
            (plan.agents || []).map((a, i) => [a.agentId, findBestPrimaryObjective(a?.claimedObjective, primaryObjectives, i)])
        ),
        taskCount: taskIds.length,
        createdTaskIds: taskIds.map(t => t.id),
        lastVerifiedDeliverableAt: null,
        verifiedDeliverableCount: 0,
        autopauseReason: '',
        quarantinedTaskCount: quarantineResult?.count || 0,
        plannerState: USE_MISSION_V2 ? 'executing' : 'legacy',
        objectiveProgress,
        plannedOutcomeCount: 0,
        observingOutcomeCount: 0,
        confirmedOutcomeCount: 0,
        reversedOutcomeCount: 0,
        guardrailFailureCount: 0,
        terminalOutcomeScore: 0,
        enablingOutcomeScore: 0,
        learningOutcomeScore: 0,
        invalidationOutcomeScore: 0,
        constraintOutcomeScore: 0,
        creditedOutcomeScore: 0,
        netOutcomeScore: 0,
        businessDebtScore: 0,
        waivedOutcomeCount: 0,
        waivedCreditedScore: 0,
        canceledOutcomeCount: 0,
        supersededOutcomeCount: 0,
        executionScore: 0,
        commercialMovementScore: 0,
        speculativeOutcomeCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
        ...buildMissionPolicyFields(),
    }, { merge: true });

    console.log(`🎯 Mission status set to EXECUTION (${missionId})`);
}

function spawnMissionSupervisor(missionId) {
    if (!USE_MISSION_V2) return;

    const supervisorScript = path.join(__dirname, 'missionSupervisor.js');
    const child = spawn(process.execPath, [supervisorScript, `--mission-id=${missionId}`], {
        cwd: process.cwd(),
        detached: true,
        stdio: 'ignore',
        env: {
            ...process.env,
            MISSION_ID: missionId,
            MISSION_SYSTEM_VERSION: String(MISSION_SYSTEM_VERSION_OVERRIDE),
            MISSION_MODE,
            MISSION_CANARY: MISSION_CANARY ? 'true' : 'false',
        },
    });
    child.unref();
}

/* ─── Main ────────────────────────────────────────────── */

async function main() {
    console.log('\n🚀 Pulse Mission Kickoff Engine v1.0');
    console.log('─'.repeat(50));

    if (!USE_OPENCLAW && !process.env.OPENAI_API_KEY) {
        console.error('❌ No AI provider configured. Set USE_OPENCLAW=true or provide OPENAI_API_KEY.');
        process.exit(1);
    }

    let missionId = null;
    let chatId = null;
    let northStar = null;

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
        missionId = `mission-${Date.now()}`;
        console.log(`\n📋 Mission ID: ${missionId}`);
        const missionPolicy = buildMissionPolicyFields();
        console.log(`   Mission mode: ${missionPolicy.mode}`);
        console.log(`   System version: ${missionPolicy.systemVersion}`);
        console.log(`   Canary: ${missionPolicy.canary ? 'yes' : 'no'}`);

        // Step 1: Load North Star
        console.log('\n⭐ Loading North Star...');
        northStar = await loadNorthStar();
        console.log(`   Title: ${northStar.title}`);
        const primaryObjectives = getPrimaryObjectives(northStar);
        console.log(`   Primary objectives: ${primaryObjectives.length}`);

        // Step 2: Load agent queues
        console.log('\n📊 Loading agent queues...');
        const queues = await loadAgentQueues();
        for (const [agentId, tasks] of Object.entries(queues)) {
            console.log(`   ${agentId}: ${tasks.length} active tasks`);
        }

        // Step 3: Load approved proposed objectives
        const proposedObjectives = await loadProposedObjectives();
        const approvedProposedObjectives = getApprovedProposedObjectives(proposedObjectives);
        if (approvedProposedObjectives.length > 0) {
            console.log(`\n💡 ${approvedProposedObjectives.length} approved agent-proposed objectives loaded as secondary lane`);
        }

        // Step 4: Start strategy roundtable first (no task assignment yet)
        console.log('\n💬 Starting mission strategy roundtable...');
        const planningSession = await startMissionPlanningChat(northStar, missionId);
        chatId = planningSession.chatId;
        await setMissionPlanningStatus(northStar, missionId, chatId);
        if (USE_MISSION_V2) {
            await recordMissionRunEvent(db, FieldValue, missionId, 'planning-started', {
                chatId,
                northStarTitle: northStar.title,
                mode: missionPolicy.mode,
                systemVersion: missionPolicy.systemVersion,
                canary: missionPolicy.canary,
            });
        }
        await postTimeline(
            'system', 'Mission Control', '🧠',
            'work-in-flight',
            `Mission planning started: ${northStar.title}`,
            {
                objectiveCode: 'MISSION',
                color: 'blue',
                lensTag: 'mission',
                artifactText: 'Agents moved to the round table for strategy-first planning.',
            }
        );

        // Step 5: Let the strategy conversation happen and capture it
        console.log(`\n🪑 Waiting for strategy responses (${Math.round(MISSION_PLANNING_WINDOW_MS / 1000)}s window)...`);
        const planningResults = await waitForMissionPlanningResponses(
            planningSession.chatId,
            planningSession.messageId,
            planningSession.kickoffContent,
        );
        console.log(`   Captured strategy responses from ${planningResults.respondedCount}/${AGENTS.length} agents`);

        // Step 6: Generate mission plan from North Star + strategy transcript
        console.log(`\n🧠 Generating mission plan with ${USE_OPENCLAW ? `OpenClaw (${OPENCLAW_AGENT_ID})` : 'GPT-4o'}...`);
        const plan = await generateMissionPlan(
            northStar,
            primaryObjectives,
            approvedProposedObjectives,
            queues,
            planningResults.transcript
        );
        console.log(`\n📋 Mission Summary: ${plan.mission_summary?.substring(0, 150)}...`);
        for (const agent of plan.agents || []) {
            console.log(`\n   ${agent.agentName} → "${agent.claimedObjective}"`);
            for (const task of agent.tasks || []) {
                console.log(`     • ${task.name}`);
            }
        }

        let quarantineResult = { count: 0, taskIds: [] };
        if (USE_MISSION_V2) {
            console.log('\n🧹 Quarantining stale auto-generated backlog...');
            quarantineResult = await quarantineLegacyAutoBacklog(missionId);
            console.log(`   Quarantined ${quarantineResult.count} legacy task${quarantineResult.count === 1 ? '' : 's'}`);
        }

        // Step 7: Create tasks only AFTER planning roundtable completes
        console.log('\n✏️  Creating tasks in Firestore...');
        const createdTasks = await createMissionTasks(plan, missionId, primaryObjectives, approvedProposedObjectives, missionPolicy);

        // Step 8: Post execution handoff back to the roundtable
        console.log('\n📣 Posting mission execution handoff...');
        await postMissionExecutionHandoff(chatId, northStar, plan, primaryObjectives, createdTasks, missionId);

        // Step 9: Activate mission execution status
        console.log('\n🎯 Activating mission...');
        await activateMission(northStar, plan, primaryObjectives, chatId, createdTasks, missionId, quarantineResult);
        spawnMissionSupervisor(missionId);

        // Step 10: Post timeline beat
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
        if (USE_MISSION_V2) {
            await recordMissionRunEvent(db, FieldValue, missionId, 'mission-activated', {
                chatId,
                createdTaskIds: createdTasks.map((task) => task.id),
                quarantinedTaskCount: quarantineResult.count,
                mode: missionPolicy.mode,
                systemVersion: missionPolicy.systemVersion,
                canary: missionPolicy.canary,
            });
        }

        console.log('\n' + '═'.repeat(50));
        console.log('✅ MISSION LAUNCHED SUCCESSFULLY');
        console.log(`   Tasks created: ${createdTasks.length}`);
        console.log(`   Agents briefed: ${AGENTS.length}`);
        console.log(`   Group chat: ${chatId}`);
        console.log(`   Mission ID: ${missionId}`);
        console.log('═'.repeat(50) + '\n');

        process.exit(0);
    } catch (err) {
        const errMsg = err?.message || String(err);
        console.error('\n❌ Mission kickoff failed:', errMsg);
        if (err?.stack) console.error(err.stack);

        // Surface failure in mission status so UI doesn't silently reset with no context.
        if (missionId) {
            try {
                await db.doc(MISSION_DOC).set({
                    status: 'idle',
                    missionPhase: 'idle',
                    missionId,
                    lastError: errMsg.substring(0, 800),
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
            } catch (statusErr) {
                console.error('❌ Could not persist mission failure state:', statusErr?.message || statusErr);
            }
        }
        if (chatId) {
            try {
                await db.doc(`agent-group-chats/${chatId}`).set({
                    phase: 'mission-error',
                    updatedAt: FieldValue.serverTimestamp(),
                    context: {
                        meetingPhase: 'strategy',
                        missionPhase: 'error',
                        error: errMsg.substring(0, 300),
                    },
                }, { merge: true });
            } catch (chatErr) {
                console.error('❌ Could not annotate mission chat failure:', chatErr?.message || chatErr);
            }
        }

        process.exit(1);
    }
}

main();
