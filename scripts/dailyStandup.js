#!/usr/bin/env node

/**
 * Daily Standup Orchestrator  (v2 — grounded in real data)
 *
 * Runs automated 15-20 minute standup meetings with Nora as moderator.
 * Creates a group-chat session in Firestore, sends discussion prompts,
 * waits for agent responses, and enforces a hard 20-minute cap.
 *
 * KEY IMPROVEMENTS over v1:
 *  • Agents receive their REAL work history (kanban tasks, heartbeat beats)
 *    so they cannot hallucinate. If no work exists, they must say so.
 *  • Meeting minutes are posted to progress-timeline tagged as "standup".
 *  • After standup, Nora creates kanban tasks for idle agents.
 *
 * Usage:
 *   node scripts/dailyStandup.js              # auto-detect morning/evening
 *   node scripts/dailyStandup.js morning      # force morning standup
 *   node scripts/dailyStandup.js evening      # force evening standup
 *
 * Scheduled via launchd at 9:00 AM and 9:00 PM EST.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

/* ─── Firebase init ──────────────────────────────────── */

const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
const app = initializeApp({ credential: cert(require(serviceAccountPath)) });
const db = getFirestore(app);

/* ─── Configuration (defaults — overridden by Firestore) ─ */

let AGENTS = ['nora', 'scout', 'solara', 'sage'];
let MODERATOR = 'nora';
let MAX_DURATION_MS = 20 * 60 * 1000;   // Hard 20-minute cap
const MIN_DURATION_MS = 5 * 60 * 1000;    // Minimum 5 minutes — standup continues with brainstorming if under this
const ROUND_WAIT_MS = 4 * 60 * 1000;      // Wait up to 4 min for agents to respond per round
const POLL_INTERVAL_MS = 10_000;           // Check for responses every 10s
const MAX_ROUNDS = 6;                       // Up to 6 rounds: 4 core + 2 brainstorm bonus

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
 * Check if we should run a standup right now based on Firestore config.
 * Only proceeds if the standup is enabled AND the current time is within
 * a 30-minute window of the scheduled time.
 */
function shouldRunNow(config, type) {
    if (!config) return true; // No config → run with defaults (backward compat)

    const now = new Date();
    const estHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
    const estMinute = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getMinutes();

    if (type === 'morning') {
        if (!config.morningEnabled) return false;
        const targetH = config.morningHour ?? 9;
        const targetM = config.morningMinute ?? 0;
        const diffMins = Math.abs((estHour * 60 + estMinute) - (targetH * 60 + targetM));
        return diffMins <= 30;
    } else {
        if (!config.eveningEnabled) return false;
        const targetH = config.eveningHour ?? 21;
        const targetM = config.eveningMinute ?? 0;
        const diffMins = Math.abs((estHour * 60 + estMinute) - (targetH * 60 + targetM));
        return diffMins <= 30;
    }
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

/* ─── Standup Prompts (v2 — grounded) ──────────────────── */

function buildMorningPrompts(workHistory, northStar) {
    const nsBlock = northStar ? `\n${northStar}\n` : '';
    return [
        // Round 1: Opening — GROUNDED in real data
        `☀️ Good morning team! This is our daily standup. Let's keep it focused — we have 20 minutes.
${nsBlock}
**IMPORTANT — REAL DATA BELOW. You MUST base your report on this data. Do NOT make up work you didn't do.**

${workHistory}

─── INSTRUCTIONS ───

**Round 1 — Yesterday's Report (FROM THE DATA ABOVE):**
Each of you:
1. Report ONLY what the data above shows you actually did. Reference specific task names, beat entries, and timestamps.
2. If the data shows NO completed work for you — say: "I did not complete any tasks yesterday."
3. Do NOT fabricate accomplishments. The data above is the single source of truth.
4. Mention any in-progress work that is still ongoing.

Keep it honest — 3-4 sentences max.`,

        // Round 2: Today's Plan
        `**Round 2 — Today's Plan:**
Based on the kanban board and your current priorities:
1. What specific task will you work on TODAY? Name it exactly.
2. Are there blockers, dependencies, or things you need from another agent?
3. If you have no assigned tasks, say so explicitly.

@Nora — take note of who has no tasks. You'll need to assign work after this standup.

Quick and specific — 2-3 sentences each.`,

        // Round 3: Coordination
        `**Round 3 — Coordination & Blockers:**
- Does anyone need help from another agent?
- Are there any overlaps or conflicts in today's plans?
- @Nora — summarize what each agent committed to and identify anyone who needs task assignments.

If nothing to add, say "No blockers."`,

        // Round 4: Closing
        `**Wrap-up:**
Thanks team. Let's get to work.

@Nora — After this standup:
1. Summarize what each agent reported and committed to.
2. For any agent with NO assigned tasks, create a kanban task for them — tasks should be aligned with the North Star.
3. Post meeting minutes to the heartbeat feed.

💪 Let's get to work — every task should move us toward the North Star.`,
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

function buildEveningPrompts(workHistory, northStar) {
    const nsBlock = northStar ? `\n${northStar}\n` : '';
    return [
        // Round 1: End-of-day — GROUNDED in real data
        `🌙 Good evening team! This is our daily recap. Let's review the day — 20 minutes max.
${nsBlock}
**IMPORTANT — REAL DATA BELOW. You MUST base your report on this data. Do NOT make up work you didn't do.**

${workHistory}

─── INSTRUCTIONS ───

**Round 1 — End of Day Report (FROM THE DATA ABOVE):**
Each of you:
1. Report ONLY what the data above shows you actually completed today. Reference specific tasks, beat entries, and timestamps.
2. If the data shows NO completed work — say: "I did not complete any tasks today." Be honest.
3. What is still in-progress and what's the expected completion?
4. Any unresolved blockers to flag for tomorrow?

Be specific about REAL deliverables. No vague "worked on X" — name the actual artifact. If there's nothing, say nothing.`,

        // Round 2: Wins and friction
        `**Round 2 — Wins & Friction:**
- Based on the ACTUAL data from today, what went well?
- Where did you hit friction? What slowed you down?
- If you had no tasks or did no work today, reflect on why and what should change.`,

        // Round 3: Tomorrow preview
        `**Round 3 — Tomorrow Preview:**
What's the single most important thing you need to accomplish tomorrow?
If you need something from another agent, flag it now.

@Nora — note any agents that were idle today. They need task assignments for tomorrow.`,

        // Round 4: Closing
        `**Wrap-up:**
@Nora — Post meeting minutes summarizing:
- What each agent actually accomplished (based on data, not what they claimed)
- Who was idle and needs work assignments
- Priority items for tomorrow

Get some rest — see you at the morning standup. 🌃`,
    ];
}

/* ─── Helpers ────────────────────────────────────────── */

function getStandupType() {
    const arg = process.argv[2];
    if (arg === 'morning' || arg === 'evening') return arg;

    // Auto-detect based on current hour (EST)
    const now = new Date();
    const estHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getHours();
    return estHour < 15 ? 'morning' : 'evening';
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
            return resp && (resp.status === 'completed' || resp.status === 'failed');
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
 * to the progress-timeline as a heartbeat beat tagged as "standup".
 */
async function postMeetingMinutes(chatId, type, durationMin, roundsCompleted) {
    const label = type === 'morning' ? 'Morning Standup' : 'Evening Standup';
    const emoji = type === 'morning' ? '☀️' : '🌙';

    // Collect all responses from the session
    const messagesSnap = await db.collection(`agent-group-chats/${chatId}/messages`)
        .orderBy('createdAt', 'asc')
        .get();

    const minutesSections = [];
    let roundNum = 0;

    for (const msgDoc of messagesSnap.docs) {
        const msgData = msgDoc.data();
        if (msgData.from !== 'admin') continue; // Only count prompts from admin
        roundNum++;

        const prompt = (msgData.content || '').split('\n')[0].substring(0, 80); // First line as section header
        const responses = msgData.responses || {};

        const agentResponses = [];
        for (const agentId of AGENTS) {
            const resp = responses[agentId];
            const displayName = AGENT_DISPLAY_NAMES[agentId] || agentId;
            if (resp?.status === 'completed' && resp.content) {
                agentResponses.push(`**${displayName}**: ${resp.content.substring(0, 300)}`);
            } else if (resp?.skipped) {
                agentResponses.push(`**${displayName}**: (skipped)`);
            } else {
                agentResponses.push(`**${displayName}**: (no response)`);
            }
        }

        minutesSections.push(`Round ${roundNum}: ${prompt}\n${agentResponses.join('\n')}`);
    }

    const minutesText = minutesSections.join('\n\n---\n\n');
    const headline = `${emoji} ${label} — ${roundsCompleted} rounds, ${durationMin} min`;

    // Post to progress-timeline as a standup beat
    try {
        await db.collection(TIMELINE_COLLECTION).add({
            agentId: MODERATOR,
            agentName: AGENT_DISPLAY_NAMES[MODERATOR] || MODERATOR,
            emoji: AGENT_EMOJIS[MODERATOR] || '🟢',
            objectiveCode: `STANDUP-${type.toUpperCase()}`,
            beat: 'result',
            headline: headline,
            artifactType: 'text',
            artifactText: minutesText,
            artifactUrl: '',
            lensTag: 'standup',
            confidenceColor: 'green',
            stateTag: 'signals',
            standupChatId: chatId,
            standupType: type,
            isStandup: true,
            createdAt: FieldValue.serverTimestamp(),
        });
        console.log(`📝 Meeting minutes posted to heartbeat feed`);
    } catch (err) {
        console.error('⚠️  Failed to post meeting minutes:', err.message);
    }
}

/* ─── Post-Standup: Auto-assign Tasks for Idle Agents ── */

/**
 * After standup, check which agents have no tasks assigned.
 * For each idle agent, create a kanban task so they have work to do.
 */
async function assignTasksToIdleAgents(type) {
    console.log('\n📋 Checking for idle agents to assign tasks...');

    for (const agentId of AGENTS) {
        const displayName = AGENT_DISPLAY_NAMES[agentId] || agentId;
        const nameVariants = [displayName, displayName.toLowerCase(), agentId];

        // Check if agent already has tasks
        try {
            const existingTasks = await db.collection(KANBAN_COLLECTION)
                .where('assignee', 'in', nameVariants)
                .where('status', 'in', ['todo', 'in-progress'])
                .limit(1)
                .get();

            if (!existingTasks.empty) {
                console.log(`   ✅ ${displayName} has active tasks — skipping`);
                continue;
            }

            // Agent has no tasks — create one based on their role
            const taskForAgent = getDefaultTask(agentId, type);
            if (!taskForAgent) continue;

            await db.collection(KANBAN_COLLECTION).add({
                name: taskForAgent.name,
                description: taskForAgent.description,
                assignee: displayName,
                status: 'todo',
                priority: 'medium',
                source: 'standup-auto-assign',
                standupType: type,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            console.log(`   📌 Created task for ${displayName}: "${taskForAgent.name}"`);

            // Also post a beat about the assignment
            await db.collection(TIMELINE_COLLECTION).add({
                agentId: MODERATOR,
                agentName: AGENT_DISPLAY_NAMES[MODERATOR] || MODERATOR,
                emoji: AGENT_EMOJIS[MODERATOR] || '🟢',
                objectiveCode: 'TASK-ASSIGN',
                beat: 'work-in-flight',
                headline: `Assigned "${taskForAgent.name}" to ${displayName} (post-standup auto-assignment)`,
                artifactType: 'none',
                artifactText: '',
                artifactUrl: '',
                lensTag: 'standup',
                confidenceColor: 'blue',
                stateTag: 'signals',
                isStandup: true,
                createdAt: FieldValue.serverTimestamp(),
            });

        } catch (err) {
            console.error(`   ⚠️ Could not check/assign for ${displayName}:`, err.message);
        }
    }
}

/**
 * Generate a default task for an idle agent based on their role.
 */
function getDefaultTask(agentId, standupType) {
    const isEvening = standupType === 'evening';
    const tasks = {
        nora: {
            name: isEvening
                ? 'Review and organize tomorrow\'s task queue'
                : 'Audit agent task queues and identify blockers',
            description: isEvening
                ? 'Review all agent kanban boards, close completed tasks, organize priorities for tomorrow. Ensure every agent will have work to do in the morning.'
                : 'Review the kanban board for all agents. Check for blocked tasks, stale in-progress items, and re-prioritize based on current objectives. Create follow-up tasks as needed.',
        },
        scout: {
            name: isEvening
                ? 'Research brief: fitness industry trends this week'
                : 'Competitive analysis: top 3 fitness app features launched this month',
            description: isEvening
                ? 'Compile a short research brief covering notable fitness industry trends, competitor moves, and emerging opportunities. Focus on actionable insights for Pulse.'
                : 'Analyze features recently launched by competitor fitness apps (e.g., Strava, Peloton, Nike Run Club). Identify opportunities for Pulse to differentiate. Write findings to a deliverable.',
        },
        solara: {
            name: isEvening
                ? 'Brand voice audit on latest Pulse content'
                : 'Draft content for the next community engagement post',
            description: isEvening
                ? 'Review the latest Pulse-facing content (app copy, social posts, documentation) for brand consistency. Flag any messaging that doesn\'t align with Pulse\'s voice.'
                : 'Create a draft for a community-focused social post or in-app notification. Ensure it reflects Pulse\'s brand values: authenticity, community, and movement.',
        },
        sage: {
            name: isEvening
                ? 'Literature scan: latest sports science publications'
                : 'Research synthesis: top 3 recovery science insights this month',
            description: isEvening
                ? 'Scan recent sports science and wellness publications for findings relevant to Pulse\'s product. Focus on recovery, training optimization, and health tech.'
                : 'Synthesize the top 3 most relevant recovery science or exercise science insights from recent literature. Create a brief that could inform Pulse\'s content or product decisions.',
        },
    };

    return tasks[agentId] || null;
}

/* ─── Main Standup Flow ──────────────────────────────── */

async function runStandup() {
    const type = getStandupType();

    // Load config from Firestore and check schedule
    const config = await loadConfig();

    // Apply config overrides
    if (config) {
        if (config.agents && config.agents.length > 0) AGENTS = config.agents;
        if (config.moderator) MODERATOR = config.moderator;
        if (config.maxDurationMinutes) MAX_DURATION_MS = config.maxDurationMinutes * 60 * 1000;
    }

    // Only proceed if this standup is scheduled (unless manually forced via CLI arg)
    if (!process.argv[2] && !shouldRunNow(config, type)) {
        console.log(`⏭️  ${type} standup not scheduled for now — exiting.`);
        process.exit(0);
    }

    const emoji = type === 'morning' ? '☀️' : '🌙';
    const label = type === 'morning' ? 'Morning Standup' : 'Evening Standup';

    console.log(`\n${emoji} Daily ${label} starting...`);
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

    const prompts = type === 'morning'
        ? buildMorningPrompts(workHistory, northStar)
        : buildEveningPrompts(workHistory, northStar);

    const startTime = Date.now();

    // 1. Create group chat session with standup metadata
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
            type: type,
            scheduledAt: FieldValue.serverTimestamp(),
            moderator: MODERATOR,
            maxDurationMinutes: 20,
            grounded: true,  // v2: indicates data-grounded standup
        },
    });
    const chatId = chatRef.id;
    console.log(`📋 Session created: ${chatId}`);

    // 2. Set agent presence to 'meeting'
    await setAgentPresenceStatus(AGENTS, 'meeting', `${emoji} ${label} in progress`);

    // 3. Run conversation rounds (core reporting)
    let roundsCompleted = 0;
    for (let round = 0; round < prompts.length; round++) {
        const elapsed = Date.now() - startTime;
        const remaining = MAX_DURATION_MS - elapsed;

        // Hard time cap — if past MAX duration, stop immediately
        if (elapsed >= MAX_DURATION_MS) {
            console.log(`\n⏰ ${MAX_DURATION_MS / 60000}-minute cap reached — ending standup`);
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
            }

            roundsCompleted++;
            if (b < bonusCount - 1) await sleep(5_000);
        }
    } else {
        console.log(`\n✅ Standup hit ${Math.floor(elapsedAfterCore / 60000)} min — no brainstorm rounds needed`);
    }

    // 4. Close the session
    const durationMs = Date.now() - startTime;
    const durationMin = Math.floor(durationMs / 60000);
    console.log(`\n✅ Standup complete: ${roundsCompleted} rounds in ${durationMin} minutes`);

    await db.doc(`agent-group-chats/${chatId}`).update({
        status: 'closed',
        closedAt: FieldValue.serverTimestamp(),
        metadata: {
            messageCount: roundsCompleted,
            sessionDuration: durationMin,
        },
    });

    // 5. Post meeting minutes to heartbeat feed
    console.log('\n📝 Posting meeting minutes...');
    await postMeetingMinutes(chatId, type, durationMin, roundsCompleted);

    // 6. Auto-assign tasks to idle agents
    await assignTasksToIdleAgents(type);

    // 7. Reset agent presence
    await setAgentPresenceStatus(AGENTS, 'idle', `✅ ${label} complete`);

    console.log('\n👋 Done.\n');
    process.exit(0);
}

/* ─── Entry Point ────────────────────────────────────── */

runStandup().catch(err => {
    console.error('❌ Standup failed:', err);
    process.exit(1);
});
