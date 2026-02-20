#!/usr/bin/env node

/**
 * Telemetry Check Orchestrator  (Heartbeat Protocol)
 *
 * Runs automated system health checks with Nora as lead.
 * Creates a group-chat session in Firestore, sends diagnostic prompts,
 * waits for agent responses, and enforces a hard time cap.
 *
 * Part of the Heartbeat Protocol — replaces traditional standups with
 * continuous telemetry: agent health monitoring, idle detection, and
 * automatic work assignment.
 *
 * KEY CAPABILITIES:
 *  • Agents receive their REAL work history (kanban tasks, heartbeat beats)
 *    so they cannot hallucinate. If no work exists, they must say so.
 *  • Meeting minutes are posted to progress-timeline tagged as "telemetry".
 *  • After check, Nora creates kanban tasks for idle agents.
 *
 * Usage:
 *   node scripts/dailyStandup.js              # run telemetry check
 *   node scripts/dailyStandup.js --force      # skip schedule check
 *
 * Runs every hour on the hour via the Heartbeat Protocol scheduler.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

/* ─── Firebase init ──────────────────────────────────── */

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

/* ─── Configuration (defaults — overridden by Firestore) ─ */

let AGENTS = ['nora', 'scout', 'solara', 'sage'];
let MODERATOR = 'nora';
let MAX_DURATION_MS = 10 * 60 * 1000;   // Hard 10-minute cap (telemetry checks are fast)
const MIN_DURATION_MS = 3 * 60 * 1000;    // Minimum 3 minutes — check continues with brainstorming if under this
const ROUND_WAIT_MS = 2 * 60 * 1000;      // Wait up to 2 min per round (turn SLA is 30s, so 4 agents = 2 min max)
const POLL_INTERVAL_MS = 4_000;            // Check for responses every 4s — faster detection = less dead air
const MAX_ROUNDS = 5;                       // Up to 5 rounds: 3 core + 2 brainstorm bonus

const KANBAN_COLLECTION = 'kanbanTasks';
const TIMELINE_COLLECTION = 'progress-timeline';
const NORTH_STAR_DOC = 'company-config/north-star';

/* ─── Agent display names ──────────────────────────────── */
const AGENT_DISPLAY_NAMES = {
    nora: 'Nora', scout: 'Scout', solara: 'Solara', sage: 'Sage', antigravity: 'Antigravity',
};
const AGENT_EMOJIS = {
    nora: '🟢', scout: '🟡', solara: '🔴', sage: '🧬', antigravity: '🔮',
};

/**
 * Load schedule config from Firestore (standup-config/default).
 * Returns the config object, or null if not found.
 */
async function loadConfig() {
    const snap = await db.doc('standup-config/default').get();
    if (!snap.exists) return null;
    return snap.data();
}

/**
 * Check if we should run a telemetry check right now based on Firestore config.
 * Uses interval-based scheduling (e.g. every 60min) instead of fixed times.
 * Passes if the current minute is within a 5-minute window of the interval boundary.
 */
function shouldRunNow(config) {
    if (!config) return true; // No config → run with defaults (backward compat)
    if (config.enabled === false) {
        console.log('⏭️  Telemetry checks are disabled in config — exiting.');
        return false;
    }

    const now = new Date();
    const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localHour = new Date(now.toLocaleString('en-US', { timeZone: systemTimezone })).getHours();
    const localMinute = new Date(now.toLocaleString('en-US', { timeZone: systemTimezone })).getMinutes();
    const totalMinutes = localHour * 60 + localMinute;
    const interval = config.intervalMinutes || 60;

    console.log(`⏰ Checking schedule (local time: ${localHour}:${String(localMinute).padStart(2, '0')}, interval: every ${interval}min, timezone: ${systemTimezone})`);

    // Check if we're within 5 minutes of an interval boundary
    const nearestBoundary = Math.round(totalMinutes / interval) * interval;
    const diff = Math.abs(totalMinutes - nearestBoundary);
    console.log(`   Nearest boundary: ${Math.floor(nearestBoundary / 60)}:${String(nearestBoundary % 60).padStart(2, '0')}, diff: ${diff} min`);
    return diff <= 5;
}

/* ─── Fetch REAL Work History per Agent ───────────────── */

/**
 * Pull the last 24h of real work for a specific agent:
 *  - Kanban tasks completed/in-progress
 *  - Progress-timeline beats posted
 * Returns a formatted text block the agent can reference.
 */
async function fetchAgentWorkHistory(agentId) {
    const displayName = AGENT_DISPLAY_NAMES[agentId] || agentId;
    const nameVariants = [displayName, displayName.toLowerCase(), agentId];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const lines = [];

    // ── Kanban tasks updated in last 24h ──
    try {
        const taskSnap = await db.collection(KANBAN_COLLECTION)
            .where('assignee', 'in', nameVariants)
            .where('updatedAt', '>=', since)
            .orderBy('updatedAt', 'desc')
            .limit(10)
            .get();

        if (!taskSnap.empty) {
            lines.push('📋 KANBAN TASKS (last 24h):');
            taskSnap.docs.forEach(doc => {
                const d = doc.data();
                const status = d.status || 'unknown';
                const name = d.name || d.title || '(unnamed)';
                const updated = d.updatedAt?.toDate?.()?.toISOString?.() || '';
                lines.push(`  • [${status.toUpperCase()}] ${name}${updated ? ` (${updated})` : ''}`);
            });
        } else {
            lines.push('📋 KANBAN TASKS: None updated in the last 24 hours.');
        }
    } catch (err) {
        // Fallback: try without the updatedAt filter (index might not exist)
        try {
            const fallbackSnap = await db.collection(KANBAN_COLLECTION)
                .where('assignee', 'in', nameVariants)
                .where('status', 'in', ['in-progress', 'done', 'completed'])
                .limit(5)
                .get();
            if (!fallbackSnap.empty) {
                lines.push('📋 RECENT KANBAN TASKS:');
                fallbackSnap.docs.forEach(doc => {
                    const d = doc.data();
                    lines.push(`  • [${(d.status || '?').toUpperCase()}] ${d.name || d.title || '(unnamed)'}`);
                });
            } else {
                lines.push('📋 KANBAN TASKS: No tasks assigned to this agent.');
            }
        } catch {
            lines.push('📋 KANBAN TASKS: Could not fetch (missing index).');
        }
    }

    // ── Progress-timeline beats in last 24h ──
    try {
        const beatSnap = await db.collection(TIMELINE_COLLECTION)
            .where('agentId', '==', agentId)
            .where('createdAt', '>=', since)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        if (!beatSnap.empty) {
            lines.push('');
            lines.push('💓 HEARTBEAT ENTRIES (last 24h):');
            beatSnap.docs.forEach(doc => {
                const d = doc.data();
                const beat = d.beat || '?';
                const headline = d.headline || '';
                const time = d.createdAt?.toDate?.()?.toISOString?.() || '';
                lines.push(`  • [${beat.toUpperCase()}] ${headline}${time ? ` (${time})` : ''}`);
            });
        } else {
            lines.push('');
            lines.push('💓 HEARTBEAT: No beats logged in the last 24 hours.');
        }
    } catch (err) {
        lines.push('');
        lines.push('💓 HEARTBEAT: Could not fetch beats.');
    }

    // ── Current agent presence snapshot ──
    try {
        const presSnap = await db.doc(`agent-presence/${agentId}`).get();
        if (presSnap.exists) {
            const p = presSnap.data();
            const status = p.status || 'unknown';
            const task = p.currentTask || 'none';
            const progress = p.taskProgress || 0;
            lines.push('');
            lines.push(`🔹 CURRENT STATUS: ${status} | Task: ${task} | Progress: ${progress}%`);
        }
    } catch { /* best effort */ }

    if (lines.length === 0) {
        return `NO WORK HISTORY FOUND for ${displayName} in the last 24 hours. This agent has not completed any tasks, logged any heartbeat beats, or updated any kanban items.`;
    }

    return lines.join('\n');
}

/**
 * Build a combined work-history context block for all agents.
 */
async function buildWorkHistoryContext() {
    const sections = [];
    for (const agentId of AGENTS) {
        const displayName = AGENT_DISPLAY_NAMES[agentId] || agentId;
        const history = await fetchAgentWorkHistory(agentId);
        sections.push(`═══ ${displayName}'s VERIFIED Work History ═══\n${history}`);
    }
    return sections.join('\n\n');
}

/* ─── Load North Star ───────────────────────────────── */

/**
 * Fetch the company's North Star from Firestore.
 * Returns a formatted context block or empty string if not set.
 */
async function loadNorthStar() {
    try {
        const snap = await db.doc(NORTH_STAR_DOC).get();
        if (!snap.exists) return '';
        const data = snap.data();
        if (!data?.title) return '';

        const lines = [
            `⭐ COMPANY NORTH STAR ⭐`,
            `Title: ${data.title}`,
        ];
        if (data.description) {
            lines.push(``, `Description:`, data.description);
        }
        if (data.objectives && data.objectives.length > 0) {
            lines.push(``, `Key Objectives:`);
            data.objectives.forEach((obj, i) => {
                lines.push(`  ${i + 1}. ${obj}`);
            });
        }
        lines.push(``, `ALL work should move us toward this North Star. Reference it in your planning and brainstorming.`);
        return lines.join('\n');
    } catch (err) {
        console.warn('⚠️  Could not load North Star:', err.message);
        return '';
    }
}

/**
 * Load the raw North Star data object from Firestore.
 * Returns { title, description, objectives } or null if not set.
 * Used by the Capsule generator for structured task creation.
 */
async function loadNorthStarRaw() {
    try {
        const snap = await db.doc(NORTH_STAR_DOC).get();
        if (!snap.exists) return null;
        const data = snap.data();
        if (!data?.title) return null;
        return {
            title: data.title || '',
            description: data.description || '',
            objectives: data.objectives || [],
        };
    } catch (err) {
        console.warn('⚠️  Could not load raw North Star:', err.message);
        return null;
    }
}

/* ─── Telemetry Check Prompts (Heartbeat Protocol) ────── */

function buildTelemetryPrompts(workHistory, northStar) {
    const nsBlock = northStar ? `\n${northStar}\n` : '';
    return [
        // Round 1: System Health Scan
        `⚡ **Telemetry Check** — System health scan. Let's be fast and precise.
${nsBlock}
**REAL DATA BELOW. Base your status on this data only. Do NOT fabricate work.**

${workHistory}

─── INSTRUCTIONS ───

**Round 1 — Status & Health:**
Each of you:
1. Report your current status: ACTIVE (working on something), IDLE (no assigned work), or BLOCKED (stuck).
2. If ACTIVE: Name the exact task from the data above. What % complete? ETA?
3. If IDLE: Say "I have no assigned Capsules" — Nora will assign work.
4. If BLOCKED: What's blocking you and what do you need to unblock?

1-2 sentences each. Speed matters.`,

        // Round 2: Idle Detection & Work Assignment
        `**Round 2 — Work Assignment:**
@Nora — Based on status reports:
1. Which agents reported IDLE or have no in-progress tasks?
2. Pull from the backlog/kanban and assign a Capsule to each idle agent.
3. Verify no agents are duplicating work.

Other agents: If you need something from another agent, flag it now.

Keep it surgical — 1-2 sentences.`,

        // Round 3: Closing
        `**Closing — Heartbeat logged.**
@Nora — Post a summary:
1. System health status (how many agents active vs idle vs blocked).
2. Any Capsules assigned during this check.
3. Flag anything that needs the Orchestrator's attention.

Back to work. Next telemetry check runs automatically. ⚡`,
    ];
}

/* ─── Brainstorming Bonus Rounds ─────────────────────── */

/**
 * These fire when the standup finishes its core rounds but hasn't
 * hit the 5-minute minimum yet. They encourage tree-of-thought
 * style collaboration, @mentions, and creative strategic thinking.
 */
const BRAINSTORM_PROMPTS = [
    `🧠 **Brainstorm Round — Strategic Thinking**

We have time before we wrap up, so let's use it well.

Think about Pulse's biggest opportunity RIGHT NOW — keeping our North Star in mind. What's the one thing that, if we nailed it this week, would make the biggest impact toward our goal?

**RULES — TREE OF THOUGHT:**
• You MUST @mention at least one other agent and build on, challenge, or extend their idea.
• Think out loud: "I'm considering...", "What if we...", "The pattern I see is..."
• Be specific — name features, user outcomes, or metrics. No vague hand-waving.
• Don't just agree — add a new angle, a concern, or a creative twist.
• @Nora — synthesize the ideas into potential tasks at the end.

3-5 sentences, conversational and real.`,

    `💡 **Brainstorm Round — Creative Problem Solving**

Pick one thing that's been frustrating, slow, or underperforming — especially anything blocking our North Star — and propose a creative solution.

**RULES — BUILD ON EACH OTHER:**
• @mention someone who hasn't spoken much yet and ask their perspective.
• Use "Yes, and..." thinking — build on what others said, don't tear it down.
• If you see a connection between two ideas, call it out: "@Scout's research point connects to @Solara's brand idea because..."
• Propose something bold. Even if it's risky, name it. We brainstorm to explore, not to be safe.
• @Nora — if any idea is strong enough, draft a task for it.

3-5 sentences, be bold.`,

    `🎯 **Brainstorm Round — What Are We Missing?**

Look at the big picture — and our North Star. What's a blind spot we haven't addressed?

• @Sage — any health/science trends we're not leveraging?
• @Scout — any competitor moves we need to respond to?
• @Solara — is our brand story landing? What needs sharpening?
• @Nora — are there operational gaps or tech debt we're ignoring?

Be curious. Ask each other hard questions. This is how we find the insights hiding in plain sight.

3-5 sentences per agent.`,
];

// Kept for backward compat — maps to telemetry prompts
function buildEveningPrompts(workHistory, northStar) {
    return buildTelemetryPrompts(workHistory, northStar);
}

/* ─── Helpers ────────────────────────────────────────── */

function getCheckType() {
    // Telemetry checks are type-agnostic — they always run the same prompts.
    // We still return a label for backward compat with Firestore metadata.
    return 'telemetry';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for all agents to respond to a specific message, with a timeout.
 * Returns true if all responded, false if timed out.
 */
async function waitForResponses(chatId, messageId, agents, timeoutMs) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const msgSnap = await db.doc(`agent-group-chats/${chatId}/messages/${messageId}`).get();
        const data = msgSnap.data();
        if (!data) break;

        const responses = data.responses || {};
        const allDone = agents.every(agentId => {
            const resp = responses[agentId];
            return resp && (resp.status === 'completed' || resp.status === 'failed' || resp.status === 'timed-out');
        });

        if (allDone) return true;

        // Log progress
        const completed = agents.filter(a => responses[a]?.status === 'completed').length;
        const pending = agents.length - completed;
        if (pending > 0) {
            const pendingNames = agents.filter(a => responses[a]?.status !== 'completed');
            console.log(`   ⏳ Waiting for ${pending} agent(s): ${pendingNames.join(', ')}`);
        }

        await sleep(POLL_INTERVAL_MS);
    }

    return false;
}

/**
 * After a round times out, sweep any responses still stuck in 'pending' or 'processing'
 * and mark them as 'timed-out' so the UI typing indicator clears automatically.
 *
 * @param {string} chatId  - The group chat document ID
 * @param {string} messageId - The round message document ID
 * @param {string[]} agents - Full agent list for the round
 */
async function clearStaleResponses(chatId, messageId, agents) {
    try {
        const msgSnap = await db.doc(`agent-group-chats/${chatId}/messages/${messageId}`).get();
        if (!msgSnap.exists) return;

        const data = msgSnap.data();
        const responses = data?.responses || {};
        const updates = {};
        const stale = [];

        agents.forEach(agentId => {
            const r = responses[agentId];
            if (!r) return;
            if (r.status === 'pending' || r.status === 'processing') {
                updates[`responses.${agentId}.status`] = 'timed-out';
                updates[`responses.${agentId}.timedOutAt`] = FieldValue.serverTimestamp();
                updates[`responses.${agentId}.content`] = r.content || '(no response within timeout window)';
                stale.push(agentId);
            }
        });

        if (Object.keys(updates).length > 0) {
            await db.doc(`agent-group-chats/${chatId}/messages/${messageId}`).update(updates);
            console.log(`   🧹 Cleared stale responses for: ${stale.join(', ')}`);
        }
    } catch (err) {
        console.warn('⚠️  Could not clear stale responses:', err.message);
    }
}

/**
 * Post a message to the group chat and dispatch commands to all agents.
 */
async function postMessage(chatId, content, agents) {
    // Build response placeholders
    const responses = {};
    agents.forEach(agentId => {
        responses[agentId] = {
            content: '',
            status: 'pending',
        };
    });

    // Add message
    const messageRef = await db.collection(`agent-group-chats/${chatId}/messages`).add({
        from: 'admin',
        content: content,
        createdAt: FieldValue.serverTimestamp(),
        broadcastedAt: FieldValue.serverTimestamp(),
        responses: responses,
        allCompleted: false,
    });

    // Dispatch commands to each agent
    const batch = db.batch();
    agents.forEach(agentId => {
        const cmdRef = db.collection('agent-commands').doc();
        batch.set(cmdRef, {
            from: 'admin',
            to: agentId,
            type: 'group-chat',
            content: content,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            groupChatId: chatId,
            messageId: messageRef.id,
            context: {
                otherAgents: agents.filter(id => id !== agentId),
            },
        });
    });
    await batch.commit();

    // Update chat metadata
    await db.doc(`agent-group-chats/${chatId}`).update({
        lastMessageAt: FieldValue.serverTimestamp(),
    });

    return messageRef.id;
}

/**
 * Set agent presence to 'meeting' or back to 'idle'.
 */
async function setAgentPresenceStatus(agents, status, note) {
    const batch = db.batch();
    agents.forEach(agentId => {
        const ref = db.collection('agent-presence').doc(agentId);
        batch.update(ref, {
            status: status,
            notes: note,
            lastUpdate: FieldValue.serverTimestamp(),
        });
    });
    try {
        await batch.commit();
    } catch (err) {
        console.warn('⚠️  Could not update agent presence:', err.message);
    }
}

/* ─── Post-Standup: Meeting Minutes ─────────────────── */

/**
 * Collect all responses from the standup and post meeting minutes
 * to BOTH the progress-timeline (heartbeat feed) AND the meeting-minutes
 * collection (Filing Cabinet) so they appear in both places.
 */
async function postMeetingMinutes(chatId, type, durationMin, roundsCompleted) {
    // Collect all responses from the session
    const messagesSnap = await db.collection(`agent-group-chats/${chatId}/messages`)
        .orderBy('createdAt', 'asc')
        .get();

    const minutesSections = [];
    const highlights = [];
    let roundNum = 0;
    let messageCount = 0;
    let activeCount = 0;
    let idleCount = 0;

    for (const msgDoc of messagesSnap.docs) {
        const msgData = msgDoc.data();
        messageCount++;
        if (msgData.from !== 'admin') continue;
        roundNum++;

        const prompt = (msgData.content || '').split('\n')[0].substring(0, 80);
        const responses = msgData.responses || {};

        const agentResponses = [];
        for (const agentId of AGENTS) {
            const resp = responses[agentId];
            const displayName = AGENT_DISPLAY_NAMES[agentId] || agentId;
            if (resp?.status === 'completed' && resp.content) {
                agentResponses.push(`**${displayName}**: ${resp.content.substring(0, 300)}`);
                // Track active/idle for summary
                if (roundNum === 1) {
                    if (/ACTIVE/i.test(resp.content)) activeCount++;
                    else if (/IDLE|BLOCKED/i.test(resp.content)) idleCount++;
                    else activeCount++; // Default to active if unclear
                }
                if (roundNum <= 2) {
                    highlights.push({
                        speaker: displayName,
                        summary: resp.content.substring(0, 200),
                    });
                }
            } else if (resp?.skipped) {
                agentResponses.push(`**${displayName}**: (skipped)`);
            } else {
                agentResponses.push(`**${displayName}**: (no response)`);
            }
        }

        minutesSections.push(`Round ${roundNum}: ${prompt}\n${agentResponses.join('\n')}`);
    }

    const minutesText = minutesSections.join('\n\n---\n\n');

    // Build executive summary
    const agentSummary = activeCount > 0 || idleCount > 0
        ? `${activeCount} active, ${idleCount} idle`
        : `${AGENTS.length} agents`;
    const execSummary = `⚡ Telemetry check completed: ${roundsCompleted} rounds, ${durationMin} min — ${agentSummary}.`;

    // 1. Save to meeting-minutes collection (Filing Cabinet) — do this first to get the doc ID
    let minutesDocId = '';
    try {
        const minutesRef = await db.collection('meeting-minutes').add({
            chatId: chatId,
            duration: `${durationMin}m`,
            participants: AGENTS,
            messageCount: messageCount,
            executiveSummary: execSummary,
            highlights: highlights.slice(0, 8),
            valueInsights: [],
            strategicDecisions: [],
            nextActions: [],
            risksOrOpenQuestions: [],
            isStandup: true,
            standupType: type,
            protocol: 'heartbeat',
            createdAt: FieldValue.serverTimestamp(),
        });
        minutesDocId = minutesRef.id;
        console.log(`📁 Meeting minutes saved to Filing Cabinet (${minutesDocId})`);
    } catch (err) {
        console.error('⚠️  Failed to save meeting minutes to Filing Cabinet:', err.message);
    }

    // 2. Post summary beat to progress-timeline (Activity Feed)
    try {
        await db.collection(TIMELINE_COLLECTION).add({
            agentId: MODERATOR,
            agentName: AGENT_DISPLAY_NAMES[MODERATOR] || MODERATOR,
            emoji: AGENT_EMOJIS[MODERATOR] || '⚡',
            objectiveCode: 'TELEMETRY-CHECK',
            beat: 'result',
            headline: execSummary,
            artifactType: 'text',
            artifactText: minutesText.substring(0, 2000),
            artifactUrl: minutesDocId ? `/admin/virtualOffice?minutes=${minutesDocId}` : '',
            lensTag: 'telemetry',
            confidenceColor: 'green',
            stateTag: 'signals',
            standupChatId: chatId,
            minutesDocId: minutesDocId,
            protocol: 'heartbeat',
            createdAt: FieldValue.serverTimestamp(),
        });
        console.log(`📝 Telemetry summary beat posted to Activity Feed`);
    } catch (err) {
        console.error('⚠️  Failed to post telemetry beat to timeline:', err.message);
    }
}


/* ─── Post-Telemetry: Auto-assign Capsules for Idle Agents ── */

/**
 * After telemetry check, scan which agents have no Capsules assigned.
 * For each idle agent, create a North Star-aligned kanban task.
 * This is the Heartbeat Protocol's work assignment engine.
 */
async function assignTasksToIdleAgents(northStarData) {
    console.log('\n📋 Scanning for idle agents — assigning Capsules...');

    // Parse North Star for task alignment
    const nsTitle = northStarData?.title || '';
    const nsObjectives = northStarData?.objectives || [];
    const nsDescription = northStarData?.description || '';

    if (nsTitle) {
        console.log(`   ⭐ North Star: "${nsTitle}"`);
        if (nsObjectives.length > 0) {
            console.log(`   🎯 Objectives: ${nsObjectives.join(' | ')}`);
        }
    } else {
        console.log('   ⚠️  No North Star set — using role-based defaults');
    }

    for (const agentId of AGENTS) {
        const displayName = AGENT_DISPLAY_NAMES[agentId] || agentId;
        const nameVariants = [displayName, displayName.toLowerCase(), agentId];

        try {
            // Check if agent already has active Capsules
            const existingTasks = await db.collection(KANBAN_COLLECTION)
                .where('assignee', 'in', nameVariants)
                .where('status', 'in', ['todo', 'in-progress'])
                .limit(1)
                .get();

            if (!existingTasks.empty) {
                console.log(`   ✅ ${displayName} has active Capsules — skipping`);
                continue;
            }

            // Agent is IDLE — generate a North Star-aligned Capsule
            const capsule = generateCapsule(agentId, nsTitle, nsObjectives, nsDescription);
            if (!capsule) continue;

            const docRef = await db.collection(KANBAN_COLLECTION).add({
                name: capsule.name,
                description: capsule.description,
                assignee: displayName,
                status: 'todo',
                priority: capsule.priority || 'medium',
                source: 'telemetry-auto-assign',
                northStarAligned: !!nsTitle,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            console.log(`   ⚡ Capsule assigned to ${displayName}: "${capsule.name}"`);

            // Post a beat about the assignment
            await db.collection(TIMELINE_COLLECTION).add({
                agentId: MODERATOR,
                agentName: AGENT_DISPLAY_NAMES[MODERATOR] || MODERATOR,
                emoji: AGENT_EMOJIS[MODERATOR] || '🟢',
                objectiveCode: docRef.id,
                beat: 'work-in-flight',
                headline: `⚡ Capsule assigned to ${displayName}: "${capsule.name}"`,
                artifactType: capsule.description ? 'text' : 'none',
                artifactText: capsule.description.substring(0, 500),
                artifactUrl: '',
                lensTag: 'telemetry',
                confidenceColor: 'blue',
                stateTag: 'signals',
                isTelemetry: true,
                createdAt: FieldValue.serverTimestamp(),
            });

        } catch (err) {
            console.error(`   ⚠️ Could not check/assign for ${displayName}:`, err.message);
        }
    }
}

/**
 * Generate a North Star-aligned Capsule for an idle agent.
 * 
 * Each agent gets work shaped by their role:
 *   Nora   → Orchestration, ops, task queue management
 *   Scout  → Research, competitive intel, discovery
 *   Solara → Architecture, systems design, technical planning
 *   Sage   → Synthesis, analysis, insight distillation
 *
 * If a North Star is set, every task is framed around it.
 * If not, we fall back to role-based defaults.
 */
function generateCapsule(agentId, nsTitle, nsObjectives, nsDescription) {
    // Pick a relevant objective to focus on (rotate through them)
    const objectiveIdx = Math.floor(Date.now() / 3600000) % Math.max(nsObjectives.length, 1);
    const focusObjective = nsObjectives[objectiveIdx] || '';

    // Build context string for descriptions
    const nsContext = nsTitle
        ? `This Capsule is aligned to our North Star: "${nsTitle}".${focusObjective ? ` Focus area: "${focusObjective}".` : ''}`
        : '';

    const capsules = {
        nora: nsTitle
            ? {
                name: `Ops audit: Ensure all agents are advancing "${nsTitle}"`,
                description: `Review the kanban board for all agents. For each agent, verify their current task is aligned to our North Star: "${nsTitle}". ${focusObjective ? `Priority focus: "${focusObjective}".` : ''} Close stale tasks, re-prioritize blocked items, and ensure every agent has meaningful work. Post a summary to the heartbeat feed.`,
                priority: 'high',
            }
            : {
                name: 'Ops audit: Review all agent task queues and clear blockers',
                description: 'Review the kanban board for all agents. Check for blocked tasks, stale in-progress items, and re-prioritize based on current objectives. Create follow-up tasks as needed.',
                priority: 'medium',
            },

        scout: nsTitle
            ? {
                name: `Research: Discovery sprint for "${focusObjective || nsTitle}"`,
                description: `Conduct a focused research sprint supporting our North Star: "${nsTitle}". ${focusObjective ? `Specific focus: "${focusObjective}".` : ''} Investigate competitive landscape, market opportunities, and emerging trends. Deliver a concise .md brief in docs/research/ with actionable findings. ${nsDescription ? `Context: ${nsDescription.substring(0, 200)}` : ''}`,
                priority: 'high',
            }
            : {
                name: 'Research: Competitive landscape analysis for Pulse',
                description: 'Analyze the competitive landscape for Pulse. Identify top competitor moves, emerging opportunities, and gaps we can exploit. Write findings as a .md deliverable in docs/research/.',
                priority: 'medium',
            },

        solara: nsTitle
            ? {
                name: `Architecture: Design system components for "${focusObjective || nsTitle}"`,
                description: `Design and document the technical architecture needed to advance our North Star: "${nsTitle}". ${focusObjective ? `Focus on: "${focusObjective}".` : ''} Identify required system components, data flows, and integration points. Deliver a technical spec as .md in docs/architecture/. ${nsDescription ? `Context: ${nsDescription.substring(0, 200)}` : ''}`,
                priority: 'high',
            }
            : {
                name: 'Architecture: Document current system design and propose improvements',
                description: 'Review current system architecture. Identify areas for improvement, potential technical debt, and opportunities for better design patterns. Write findings as .md deliverable in docs/architecture/.',
                priority: 'medium',
            },

        sage: nsTitle
            ? {
                name: `Synthesis: Strategic analysis of "${focusObjective || nsTitle}"`,
                description: `Synthesize all available data and insights related to our North Star: "${nsTitle}". ${focusObjective ? `Deep-dive on: "${focusObjective}".` : ''} Cross-reference agent outputs, research findings, and progress data. Produce a strategic brief with recommendations. Deliver as .md in docs/synthesis/. ${nsDescription ? `Context: ${nsDescription.substring(0, 200)}` : ''}`,
                priority: 'high',
            }
            : {
                name: 'Synthesis: Cross-team insight report',
                description: 'Review all recent agent outputs and research findings. Identify patterns, connections, and strategic insights that span multiple workstreams. Write a synthesis brief as .md deliverable in docs/synthesis/.',
                priority: 'medium',
            },
    };

    return capsules[agentId] || null;
}

/* ─── Main Standup Flow ──────────────────────────────── */

async function runStandup() {
    const type = getCheckType();

    // Load config from Firestore and check schedule
    const config = await loadConfig();

    // Apply config overrides
    if (config) {
        if (config.agents && config.agents.length > 0) AGENTS = config.agents;
        if (config.moderator) MODERATOR = config.moderator;
        if (config.maxDurationMinutes) MAX_DURATION_MS = config.maxDurationMinutes * 60 * 1000;
    }

    // Only proceed if scheduled (unless manually forced via --force)
    const isForced = process.argv.includes('--force');
    if (!isForced && !shouldRunNow(config)) {
        console.log(`⏭️  Telemetry check not scheduled for now — exiting.`);
        process.exit(0);
    }
    if (isForced) {
        console.log('🔧 Force flag detected — skipping schedule check');
    }

    const emoji = '⚡';
    const label = 'Telemetry Check';

    console.log(`\n${emoji} ${label} starting...`);
    console.log(`   Agents: ${AGENTS.join(', ')}`);
    console.log(`   Moderator: ${MODERATOR}`);
    console.log(`   Max duration: ${MAX_DURATION_MS / 60000} minutes`);
    console.log(`   Rounds: up to ${MAX_ROUNDS}`);

    // ── Step 0: Fetch real work history + North Star ──
    console.log('\n📊 Fetching real work history for all agents...');
    const workHistory = await buildWorkHistoryContext();
    console.log('   ✅ Work history loaded');

    console.log('⭐ Loading North Star...');
    const northStar = await loadNorthStar();
    if (northStar) {
        console.log('   ✅ North Star loaded\n');
    } else {
        console.log('   ⚠️  No North Star set — agents will brainstorm without a focus anchor\n');
    }

    const prompts = buildTelemetryPrompts(workHistory, northStar);

    const startTime = Date.now();

    // 1. Create group chat session with telemetry metadata
    const chatRef = await db.collection('agent-group-chats').add({
        participants: AGENTS,
        createdBy: 'admin',
        createdAt: FieldValue.serverTimestamp(),
        lastMessageAt: FieldValue.serverTimestamp(),
        status: 'active',
        metadata: {
            messageCount: 0,
            sessionDuration: 0,
        },
        standupMeta: {
            type: 'telemetry',
            scheduledAt: FieldValue.serverTimestamp(),
            moderator: MODERATOR,
            maxDurationMinutes: MAX_DURATION_MS / 60000,
            grounded: true,
            protocol: 'heartbeat', // Heartbeat Protocol marker
        },
    });
    const chatId = chatRef.id;
    console.log(`📋 Telemetry session created: ${chatId}`);

    // 2. Set agent presence to 'meeting' (telemetry check active)
    await setAgentPresenceStatus(AGENTS, 'meeting', `${emoji} Telemetry check in progress`);

    // 3. Run conversation rounds (core reporting)
    let roundsCompleted = 0;
    for (let round = 0; round < prompts.length; round++) {
        const elapsed = Date.now() - startTime;
        const remaining = MAX_DURATION_MS - elapsed;

        // Hard time cap — if past MAX duration, stop immediately
        if (elapsed >= MAX_DURATION_MS) {
            console.log(`\n⏰ ${MAX_DURATION_MS / 60000}-minute cap reached — ending check`);
            break;
        }

        // Hard time cap — if less than 2 minutes remain and we're past core rounds, skip to closing
        if (remaining < 2 * 60 * 1000 && round >= prompts.length - 1) {
            console.log(`\n⏰ Less than 2 minutes remaining — running closing round`);
        }

        const prompt = prompts[round];
        if (!prompt) break;

        console.log(`\n📢 Round ${round + 1}: "${prompt.substring(0, 60)}..."`);
        const messageId = await postMessage(chatId, prompt, AGENTS);

        // Wait for responses (with remaining time as upper bound)
        const waitTime = Math.min(ROUND_WAIT_MS, remaining);
        const allResponded = await waitForResponses(chatId, messageId, AGENTS, waitTime);

        if (allResponded) {
            console.log(`   ✅ All agents responded`);
            await db.doc(`agent-group-chats/${chatId}/messages/${messageId}`).update({
                allCompleted: true,
            });
        } else {
            console.log(`   ⚠️  Some agents did not respond in time — moving on`);
            await clearStaleResponses(chatId, messageId, AGENTS);
        }

        roundsCompleted++;

        // Brief pause between rounds
        if (round < prompts.length - 1) {
            await sleep(5_000);
        }
    }

    // ── 3b. Minimum duration enforcement — brainstorming bonus rounds ──
    const elapsedAfterCore = Date.now() - startTime;
    if (elapsedAfterCore < MIN_DURATION_MS) {
        const timeLeft = MIN_DURATION_MS - elapsedAfterCore;
        const bonusCount = Math.min(
            BRAINSTORM_PROMPTS.length,
            Math.ceil(timeLeft / (ROUND_WAIT_MS + 10_000))  // Estimate how many rounds we can fit
        );
        console.log(`\n🧠 Core rounds finished in ${Math.floor(elapsedAfterCore / 60000)} min — under 5-min minimum`);
        console.log(`   Adding ${bonusCount} brainstorming round(s) to fill the time...`);

        for (let b = 0; b < bonusCount; b++) {
            const elapsed = Date.now() - startTime;
            if (elapsed >= MAX_DURATION_MS) break;

            const bPrompt = BRAINSTORM_PROMPTS[b];
            console.log(`\n🧠 Brainstorm ${b + 1}: "${bPrompt.substring(0, 60)}..."`);
            const bMsgId = await postMessage(chatId, bPrompt, AGENTS);

            const remaining = MAX_DURATION_MS - elapsed;
            const bWait = Math.min(ROUND_WAIT_MS, remaining);
            const bAllDone = await waitForResponses(chatId, bMsgId, AGENTS, bWait);

            if (bAllDone) {
                console.log(`   ✅ All agents responded to brainstorm`);
                await db.doc(`agent-group-chats/${chatId}/messages/${bMsgId}`).update({
                    allCompleted: true,
                });
            } else {
                console.log(`   ⚠️  Some agents timed out on brainstorm — moving on`);
                await clearStaleResponses(chatId, bMsgId, AGENTS);
            }

            roundsCompleted++;
            if (b < bonusCount - 1) await sleep(5_000);
        }
    } else {
        console.log(`\n✅ Check hit ${Math.floor(elapsedAfterCore / 60000)} min — no brainstorm rounds needed`);
    }

    // 4. Close the session
    const durationMs = Date.now() - startTime;
    const durationMin = Math.floor(durationMs / 60000);
    console.log(`\n✅ Telemetry check complete: ${roundsCompleted} rounds in ${durationMin} minutes`);

    await db.doc(`agent-group-chats/${chatId}`).update({
        status: 'closed',
        closedAt: FieldValue.serverTimestamp(),
        metadata: {
            messageCount: roundsCompleted,
            sessionDuration: durationMin,
        },
    });

    // 5. Post telemetry minutes to heartbeat feed
    console.log('\n📝 Posting telemetry minutes...');
    await postMeetingMinutes(chatId, type, durationMin, roundsCompleted);

    // 6. Auto-assign Capsules to idle agents (North Star-aligned)
    const northStarData = await loadNorthStarRaw();
    await assignTasksToIdleAgents(northStarData);

    // 7. Reset agent presence
    await setAgentPresenceStatus(AGENTS, 'idle', `✅ Telemetry check complete`);

    console.log('\n👋 Done.\n');
    process.exit(0);
}

/* ─── Entry Point ────────────────────────────────────── */

runStandup().catch(err => {
    console.error('❌ Telemetry check failed:', err);
    process.exit(1);
});
