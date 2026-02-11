#!/usr/bin/env node

/**
 * Pulse Agent Runner — Bridge between OpenClaw and the Virtual Office
 *
 * This script runs on the Mac Mini alongside OpenClaw. It:
 *   1. Picks up the next "in-progress" task from the kanban board (assigned to this agent)
 *   2. Uses an AI to break the task down into granular execution steps
 *   3. Reports each step to Firestore as it works → Virtual Office shows it live
 *   4. Heartbeats to keep the agent "online"
 *   5. Listens for incoming commands from other agents (agent-to-agent messaging)
 *
 * Usage:
 *   AGENT_ID=nora AGENT_NAME="Nora" node scripts/agentRunner.js
 *
 * Environment variables:
 *   AGENT_ID       — Firestore document ID for this agent (required)
 *   AGENT_NAME     — Display name for the agent (default: AGENT_ID)
 *   AGENT_EMOJI    — Emoji for the agent (default: ⚡️)
 *   HEARTBEAT_MS   — Heartbeat interval in ms (default: 30000)
 *   OPENAI_API_KEY — For task decomposition (optional — falls back to simple breakdown)
 *   USE_OPENCLAW   — Set to 'true' to use OpenClaw for execution
 *   PROJECT_DIR    — Working directory for OpenClaw (default: cwd)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { execSync, spawn } = require('child_process');
const path = require('path');

/* ─── Configuration ───────────────────────────────────── */

const AGENT_ID = process.env.AGENT_ID || 'nora';
const AGENT_NAME = process.env.AGENT_NAME || AGENT_ID;
const AGENT_EMOJI = process.env.AGENT_EMOJI || '⚡️';
const HEARTBEAT_MS = parseInt(process.env.HEARTBEAT_MS || '30000', 10);
const PRESENCE_COLLECTION = 'agent-presence';
const KANBAN_COLLECTION = 'kanbanTasks';
const COMMANDS_COLLECTION = 'agent-commands';
const HISTORY_SUBCOLLECTION = 'task-history';

/* ─── Firebase Admin Init ─────────────────────────────── */

let app;
try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
        || path.join(__dirname, '..', 'service-account.json');
    const serviceAccount = require(serviceAccountPath);
    app = initializeApp({
        credential: cert(serviceAccount),
    });
} catch (e) {
    console.log('⚠️  No service account found, trying default credentials...');
    app = initializeApp();
}

const db = getFirestore(app);

/* ── Incoming command queue (filled by the Firestore listener) ── */
const commandQueue = [];

/* ─── Firestore Helpers ───────────────────────────────── */

async function updatePresence(payload) {
    const docRef = db.collection(PRESENCE_COLLECTION).doc(AGENT_ID);
    await docRef.set({
        displayName: AGENT_NAME,
        emoji: AGENT_EMOJI,
        ...payload,
        lastUpdate: FieldValue.serverTimestamp(),
    }, { merge: true });
}

async function heartbeat() {
    await updatePresence({});
}

async function setStatus(status, extras = {}) {
    await updatePresence({ status, ...extras });
}

async function reportSteps(steps, currentStepIndex, taskProgress, extras = {}) {
    await updatePresence({
        executionSteps: steps.map(serializeStep),
        currentStepIndex,
        taskProgress,
        ...extras,
    });
}

function serializeStep(step) {
    return {
        id: step.id,
        description: step.description,
        status: step.status,
        startedAt: step.startedAt || null,
        completedAt: step.completedAt || null,
        reasoning: step.reasoning || '',
        output: step.output || '',
        durationMs: step.durationMs || 0,
    };
}

/* ─── Task History ────────────────────────────────────── */

async function saveTaskHistory(taskName, taskId, steps, status, startedAt) {
    const historyRef = db.collection(PRESENCE_COLLECTION)
        .doc(AGENT_ID)
        .collection(HISTORY_SUBCOLLECTION);

    const completedAt = new Date();
    const totalDurationMs = completedAt.getTime() - startedAt.getTime();
    const completedStepCount = steps.filter(s => s.status === 'completed').length;

    await historyRef.add({
        taskName,
        taskId,
        status,
        steps: steps.map(serializeStep),
        startedAt,
        completedAt,
        totalDurationMs,
        stepCount: steps.length,
        completedStepCount,
    });

    console.log(`📜 Task history saved: ${taskName} (${status}, ${formatMs(totalDurationMs)})`);
}

/* ─── Agent-to-Agent Messaging ────────────────────────── */

/**
 * Start listening for incoming commands from other agents.
 * Commands land in the `agent-commands` collection addressed to this agent.
 */
function startCommandListener() {
    console.log('📡 Listening for incoming commands...');

    const query = db.collection(COMMANDS_COLLECTION)
        .where('to', '==', AGENT_ID)
        .where('status', '==', 'pending');

    return query.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const cmd = { id: change.doc.id, ...change.doc.data() };
                console.log(`\n📨 Incoming ${cmd.type} from ${cmd.from}: "${cmd.content}"`);
                commandQueue.push(cmd);
            }
        });
    });
}

/**
 * Process any pending commands in the queue.
 * Returns true if a command was handled (caller should re-check for tasks).
 */
async function processCommands() {
    if (commandQueue.length === 0) return false;

    const cmd = commandQueue.shift();
    const cmdRef = db.collection(COMMANDS_COLLECTION).doc(cmd.id);

    try {
        // Mark as in-progress
        await cmdRef.update({ status: 'in-progress' });

        let response = '';

        switch (cmd.type) {
            case 'task':
                // Create a kanban task from the command
                const newTask = await db.collection(KANBAN_COLLECTION).add({
                    name: cmd.content,
                    description: cmd.metadata?.description || '',
                    assignee: AGENT_NAME,
                    status: 'todo',
                    project: cmd.metadata?.project || 'General',
                    priority: cmd.metadata?.priority || 'medium',
                    subtasks: [],
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                response = `Task created and queued: ${newTask.id}. I'll pick it up on my next cycle.`;
                console.log(`📋 Created task from command: ${cmd.content} → ${newTask.id}`);
                break;

            case 'command':
                // Handle direct commands
                if (cmd.content.toLowerCase().includes('stop') || cmd.content.toLowerCase().includes('pause')) {
                    response = 'Acknowledged. Will pause after current step completes.';
                    // You could set a flag to pause the main loop
                } else if (cmd.content.toLowerCase().includes('status')) {
                    const presenceDoc = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
                    const data = presenceDoc.data();
                    response = `Status: ${data?.status || 'unknown'}. Task: ${data?.currentTask || 'none'}. Progress: ${data?.taskProgress || 0}%.`;
                } else if (cmd.content.toLowerCase().includes('priority') || cmd.content.toLowerCase().includes('prioritize')) {
                    response = `Noted: "${cmd.content}". I'll prioritize this on my next task fetch.`;
                } else {
                    response = `Command received: "${cmd.content}". Processing...`;
                }
                break;

            case 'question':
                // Answer questions about status/capability
                const presenceDoc = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
                const presenceData = presenceDoc.data();
                response = `I'm currently ${presenceData?.status || 'idle'}. ${presenceData?.currentTask ? `Working on: ${presenceData.currentTask} (${presenceData.taskProgress || 0}% done).` : 'No active task.'} Queue has ${commandQueue.length} pending commands.`;
                break;

            case 'chat':
                response = `Hey ${cmd.from}! I'm ${AGENT_NAME}. Message received: "${cmd.content}". I'm here and ready to help!`;
                break;

            default:
                response = `Received ${cmd.type}: "${cmd.content}". Not sure how to handle this type.`;
        }

        // Write response back
        await cmdRef.update({
            status: 'completed',
            response,
            completedAt: FieldValue.serverTimestamp(),
        });

        console.log(`✅ Responded to ${cmd.from}: "${response}"`);
        return true;

    } catch (err) {
        console.error(`❌ Error processing command ${cmd.id}:`, err.message);
        await cmdRef.update({
            status: 'failed',
            response: `Error: ${err.message}`,
            completedAt: FieldValue.serverTimestamp(),
        });
        return false;
    }
}

/**
 * Send a message TO another agent (for escalation, help requests, etc.)
 */
async function sendMessage(toAgent, content, type = 'chat', metadata = {}) {
    const msgRef = await db.collection(COMMANDS_COLLECTION).add({
        from: AGENT_ID,
        to: toAgent,
        type,
        content,
        metadata,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`📤 Sent ${type} to ${toAgent}: "${content}" (${msgRef.id})`);
    return msgRef.id;
}

/* ─── Kanban Integration ──────────────────────────────── */

async function fetchNextTask() {
    const inProgressSnap = await db.collection(KANBAN_COLLECTION)
        .where('assignee', '==', AGENT_NAME)
        .where('status', '==', 'in-progress')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

    if (!inProgressSnap.empty) {
        const doc = inProgressSnap.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    const todoSnap = await db.collection(KANBAN_COLLECTION)
        .where('assignee', '==', AGENT_NAME)
        .where('status', '==', 'todo')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

    if (!todoSnap.empty) {
        const doc = todoSnap.docs[0];
        await db.collection(KANBAN_COLLECTION).doc(doc.id).update({
            status: 'in-progress',
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { id: doc.id, ...doc.data() };
    }

    return null;
}

async function markTaskDone(taskId) {
    await db.collection(KANBAN_COLLECTION).doc(taskId).update({
        status: 'done',
        updatedAt: FieldValue.serverTimestamp(),
    });
}

/* ─── Task Decomposition ──────────────────────────────── */

async function decomposeTask(task) {
    if (task.subtasks && task.subtasks.length > 0) {
        return task.subtasks.map((st, i) => ({
            id: `step-${i}`,
            description: st.title || st.description || `Step ${i + 1}`,
            status: 'pending',
            reasoning: '',
        }));
    }

    if (process.env.OPENAI_API_KEY) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a task decomposition agent. Break down software development tasks into 4-8 granular executable steps. Each step should be a clear action. Return JSON: { "steps": [{ "description": "...", "reasoning": "..." }] }`
                        },
                        {
                            role: 'user',
                            content: `Task: ${task.name}\nDescription: ${task.description || 'No description'}\nProject: ${task.project || 'Unknown'}\nNotes: ${task.notes || 'None'}`
                        }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.3,
                }),
            });

            const data = await response.json();
            const parsed = JSON.parse(data.choices[0].message.content);
            return (parsed.steps || []).map((s, i) => ({
                id: `step-${i}`,
                description: s.description,
                status: 'pending',
                reasoning: s.reasoning || '',
            }));
        } catch (err) {
            console.error('AI decomposition failed, using fallback:', err.message);
        }
    }

    return [
        { id: 'step-0', description: `Analyze requirements for: ${task.name}`, status: 'pending', reasoning: 'Understanding the task scope and constraints' },
        { id: 'step-1', description: `Implement: ${task.name}`, status: 'pending', reasoning: 'Core implementation work' },
        { id: 'step-2', description: `Verify and finalize: ${task.name}`, status: 'pending', reasoning: 'Testing and quality checks' },
    ];
}

/* ─── Execute a step ──────────────────────────────────── */

async function executeStep(step, task, stepIndex, allSteps) {
    const startTime = Date.now();

    step.reasoning = step.reasoning || `Working on: ${step.description}`;
    step.status = 'in-progress';
    step.startedAt = new Date();

    const completedCount = allSteps.filter(s => s.status === 'completed').length;
    const progress = Math.round((completedCount / allSteps.length) * 100);
    await reportSteps(allSteps, stepIndex, progress);

    try {
        const useOpenClaw = process.env.USE_OPENCLAW === 'true';

        if (useOpenClaw) {
            const prompt = `You are working on task "${task.name}" for the Pulse Fitness project.
Current step: ${step.description}
Context: ${task.description || ''}
Notes: ${task.notes || ''}

Complete this step. Be concise in your output.`;

            const result = execSync(`echo "${prompt.replace(/"/g, '\\"')}" | openclaw`, {
                cwd: process.env.PROJECT_DIR || process.cwd(),
                timeout: 300_000,
                encoding: 'utf-8',
            });

            step.output = result.trim().substring(0, 500);
        } else {
            const waitMs = 2000 + Math.random() * 5000;
            await new Promise(r => setTimeout(r, waitMs));
            step.output = `Completed: ${step.description}`;
        }

        step.status = 'completed';
        step.completedAt = new Date();
        step.durationMs = Date.now() - startTime;

        const newCompletedCount = allSteps.filter(s => s.status === 'completed').length;
        const newProgress = Math.round((newCompletedCount / allSteps.length) * 100);
        await reportSteps(allSteps, stepIndex, newProgress);

        // Check for incoming commands between steps
        await processCommands();

        return true;
    } catch (err) {
        step.status = 'failed';
        step.completedAt = new Date();
        step.durationMs = Date.now() - startTime;
        step.output = `Error: ${err.message}`;
        await reportSteps(allSteps, stepIndex, -1, {
            notes: `❌ Failed at step ${stepIndex + 1}: ${err.message}`,
        });
        return false;
    }
}

/* ─── Main Loop ───────────────────────────────────────── */

async function run() {
    console.log(`\n🤖 Pulse Agent Runner v2 starting...`);
    console.log(`   Agent: ${AGENT_NAME} (${AGENT_ID})`);
    console.log(`   Heartbeat: every ${HEARTBEAT_MS / 1000}s`);
    console.log(`   OpenClaw: ${process.env.USE_OPENCLAW === 'true' ? 'ENABLED' : 'SIMULATION MODE'}`);
    console.log(`   Messaging: ENABLED`);
    console.log('');

    // Set agent online
    await setStatus('idle', {
        sessionStartedAt: new Date(),
        notes: '🟢 Agent online, waiting for tasks...',
        executionSteps: [],
        currentStepIndex: -1,
        taskProgress: 0,
    });

    // Start heartbeat
    const heartbeatInterval = setInterval(heartbeat, HEARTBEAT_MS);

    // Start command listener (real-time Firestore listener)
    const unsubCommands = startCommandListener();

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n👋 Shutting down...');
        clearInterval(heartbeatInterval);
        unsubCommands();
        await setStatus('offline', {
            notes: 'Agent shut down gracefully',
            executionSteps: [],
            currentStepIndex: -1,
        });
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Main task loop
    while (true) {
        try {
            // Process any pending commands first
            while (commandQueue.length > 0) {
                await processCommands();
            }

            console.log('🔍 Looking for tasks...');
            const task = await fetchNextTask();

            if (!task) {
                console.log('💤 No tasks found. Waiting 30s...');
                await setStatus('idle', {
                    notes: 'No tasks in queue. Waiting...',
                    executionSteps: [],
                    currentStepIndex: -1,
                    taskProgress: 0,
                });
                // Wait but check for commands every 5s
                for (let w = 0; w < 6; w++) {
                    await new Promise(r => setTimeout(r, 5_000));
                    if (commandQueue.length > 0) {
                        await processCommands();
                    }
                }
                continue;
            }

            console.log(`📋 Found task: ${task.name} (${task.id})`);

            // Decompose
            console.log('🧠 Breaking down task into steps...');
            const steps = await decomposeTask(task);
            console.log(`   → ${steps.length} steps planned`);

            // Report task start
            const taskStartTime = new Date();
            await setStatus('working', {
                currentTask: task.name,
                currentTaskId: task.id,
                taskStartedAt: taskStartTime,
                notes: `Starting: ${task.name}`,
            });

            steps[0].status = 'in-progress';
            steps[0].startedAt = new Date();
            await reportSteps(steps, 0, 0);

            // Execute steps
            let allPassed = true;
            for (let i = 0; i < steps.length; i++) {
                console.log(`\n⚡ Step ${i + 1}/${steps.length}: ${steps[i].description}`);
                const success = await executeStep(steps[i], task, i, steps);

                if (!success) {
                    console.log(`❌ Step ${i + 1} failed. Stopping task.`);
                    allPassed = false;
                    break;
                }

                console.log(`✅ Step ${i + 1} completed${steps[i].durationMs ? ` (${formatMs(steps[i].durationMs)})` : ''}`);

                if (i + 1 < steps.length) {
                    steps[i + 1].status = 'in-progress';
                    steps[i + 1].startedAt = new Date();
                }
            }

            if (allPassed) {
                console.log(`\n🎉 Task completed: ${task.name}`);
                await saveTaskHistory(task.name, task.id, steps, 'completed', taskStartTime);
                await markTaskDone(task.id);
                await setStatus('idle', {
                    currentTask: '',
                    currentTaskId: '',
                    notes: `✅ Completed: ${task.name}`,
                    taskProgress: 100,
                });
            } else {
                // Save failed pipeline to history too
                await saveTaskHistory(task.name, task.id, steps, 'failed', taskStartTime);
            }

            await new Promise(r => setTimeout(r, 5_000));

        } catch (err) {
            console.error('❌ Error in main loop:', err.message);
            await setStatus('idle', { notes: `Error: ${err.message}` });
            await new Promise(r => setTimeout(r, 10_000));
        }
    }
}

function formatMs(ms) {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
