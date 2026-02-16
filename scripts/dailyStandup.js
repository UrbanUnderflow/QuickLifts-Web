#!/usr/bin/env node

/**
 * Daily Standup Orchestrator
 *
 * Runs automated 15-20 minute standup meetings with Nora as moderator.
 * Creates a group-chat session in Firestore, sends discussion prompts,
 * waits for agent responses, and enforces a hard 20-minute cap.
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
const ROUND_WAIT_MS = 4 * 60 * 1000;      // Wait up to 4 min for agents to respond per round
const POLL_INTERVAL_MS = 10_000;           // Check for responses every 10s
const MAX_ROUNDS = 4;                       // 4 rounds × ~5 min = ~20 min

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

/* ─── Standup Prompts ────────────────────────────────── */

const MORNING_PROMPTS = [
    // Round 1: Opening — what are you working on today?
    `☀️ Good morning team! This is our 9 AM daily standup. Let's keep it focused — we have 20 minutes.

**Round 1 — Today's Plan:**
Each of you, share:
1. What you accomplished yesterday (one line)
2. What you're working on today (be specific — name the task or feature)
3. Any blockers or dependencies you need help with

Keep it concise — 3-4 sentences max.`,

    // Round 2: Cross-team coordination
    `**Round 2 — Coordination:**
Based on what everyone shared, does anyone:
- Need something from another agent to unblock their work?
- See overlap or conflict in today's plans?
- Have a suggestion for reprioritizing?

If nothing, just say "No coordination needed."`,

    // Round 3: Priorities alignment
    `**Round 3 — Priority Check:**
Given our current objectives, are we focused on the right things? Any signals or insights from yesterday that should change today's priorities?

Quick takes only — we're wrapping up soon.`,

    // Round 4 (if time): Closing
    `**Wrap-up:**
Thanks team. Quick final thoughts? Otherwise, let's get to work. 💪`,
];

const EVENING_PROMPTS = [
    // Round 1: Opening — what did you accomplish?
    `🌙 Good evening team! This is our 9 PM daily recap. Let's review the day — 20 minutes max.

**Round 1 — End of Day Report:**
Each of you, share:
1. What you completed today (specific deliverables — commits, docs, research, etc.)
2. What's still in progress and expected completion
3. Any unresolved blockers to flag for tomorrow

Be specific about deliverables. No vague "worked on X" — name the artifact.`,

    // Round 2: Wins and friction
    `**Round 2 — Wins & Friction:**
- What went well today? Any wins worth celebrating?
- Where did you hit friction? What slowed you down?
- Any process improvements to suggest?`,

    // Round 3: Tomorrow preview
    `**Round 3 — Tomorrow Preview:**
What's the single most important thing you need to accomplish tomorrow? 

If you need something from another agent, flag it now so they can prepare overnight.`,

    // Round 4 (if time): Closing
    `**Wrap-up:**
Great work today, team. Get some rest — see you at the morning standup. 🌃`,
];

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

    const prompts = type === 'morning' ? MORNING_PROMPTS : EVENING_PROMPTS;
    const emoji = type === 'morning' ? '☀️' : '🌙';
    const label = type === 'morning' ? 'Morning Standup' : 'Evening Standup';

    console.log(`\n${emoji} Daily ${label} starting...`);
    console.log(`   Agents: ${AGENTS.join(', ')}`);
    console.log(`   Moderator: ${MODERATOR}`);
    console.log(`   Max duration: ${MAX_DURATION_MS / 60000} minutes`);
    console.log(`   Rounds: up to ${MAX_ROUNDS}`);
    console.log('');

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
        },
    });
    const chatId = chatRef.id;
    console.log(`📋 Session created: ${chatId}`);

    // 2. Set agent presence to 'meeting'
    await setAgentPresenceStatus(AGENTS, 'meeting', `${emoji} ${label} in progress`);

    // 3. Run conversation rounds
    let roundsCompleted = 0;
    for (let round = 0; round < MAX_ROUNDS; round++) {
        const elapsed = Date.now() - startTime;
        const remaining = MAX_DURATION_MS - elapsed;

        // Hard time cap — if less than 2 minutes remain, skip to closing
        if (remaining < 2 * 60 * 1000 && round < MAX_ROUNDS - 1) {
            console.log(`\n⏰ Less than 2 minutes remaining — skipping to closing round`);
            // Jump to the last prompt (wrap-up)
            const closingPrompt = prompts[prompts.length - 1];
            console.log(`\n📢 Closing Round: "${closingPrompt.substring(0, 60)}..."`);
            const closingMsgId = await postMessage(chatId, closingPrompt, AGENTS);
            await waitForResponses(chatId, closingMsgId, AGENTS, Math.min(remaining, ROUND_WAIT_MS));
            roundsCompleted++;
            break;
        }

        // Hard time cap — if past 20 minutes, stop immediately
        if (elapsed >= MAX_DURATION_MS) {
            console.log(`\n⏰ 20-minute cap reached — ending standup`);
            break;
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
            // Mark message as complete
            await db.doc(`agent-group-chats/${chatId}/messages/${messageId}`).update({
                allCompleted: true,
            });
        } else {
            console.log(`   ⚠️  Some agents did not respond in time — moving on`);
        }

        roundsCompleted++;

        // Brief pause between rounds
        if (round < MAX_ROUNDS - 1) {
            await sleep(5_000);
        }
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

    // 5. Reset agent presence
    await setAgentPresenceStatus(AGENTS, 'idle', `✅ ${label} complete`);

    console.log('👋 Done.\n');
    process.exit(0);
}

/* ─── Entry Point ────────────────────────────────────── */

runStandup().catch(err => {
    console.error('❌ Standup failed:', err);
    process.exit(1);
});
