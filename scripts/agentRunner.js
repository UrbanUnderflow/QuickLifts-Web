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
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
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
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || ({ 'nora': 'main', 'scout': 'scout', 'solara': 'solara', 'sage': 'sage' }[AGENT_ID] || 'main');
const OPENCLAW_SMOKE_TEST = process.env.OPENCLAW_SMOKE_TEST === 'true';
const OPENCLAW_SMOKE_CMD = process.env.OPENCLAW_SMOKE_CMD || 'status --json';
const OPENCLAW_MODEL_SYNC_MS = parseInt(process.env.OPENCLAW_MODEL_SYNC_MS || '60000', 10); // Keep presence model accurate after OpenClaw config changes
const MAX_FOLLOW_UP_DEPTH = 4; // Max rounds of agent-to-agent @mention follow-ups
const MAX_SELF_CORRECTION_RETRIES = 2; // Retry attempts when step output contains failure signals
const STEP_INACTIVITY_TIMEOUT_MS = 120_000; // Kill step if no stderr activity for 120s
const MAX_STEP_REWRITE_ATTEMPTS = 1; // Rewrite-from-different-angle attempts on crash/timeout
const MAX_CONSECUTIVE_FAILURES = 2; // Stop task after this many steps fail in a row

/* ─── Token Usage Tracking ─────────────────────────────── */
var sessionTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
// If OpenClaw is enabled, we'll sync the actual configured model from OpenClaw at runtime.
var currentModel = process.env.USE_OPENCLAW === 'true' ? 'openclaw' : 'gpt-4o';
var currentModelProvider = '';
var currentModelRaw = '';
var lastOpenClawModelSyncAt = 0;
var openClawModelSyncInFlight = null;

function trackTokenUsage(usage, model) {
    if (!usage) return;
    sessionTokens.promptTokens += (usage.prompt_tokens || 0);
    sessionTokens.completionTokens += (usage.completion_tokens || 0);
    sessionTokens.totalTokens += (usage.total_tokens || 0);
    sessionTokens.callCount += 1;
    if (model) currentModel = model;
    console.log(`   📊 Tokens: +${usage.total_tokens || 0} (session total: ${sessionTokens.totalTokens}, calls: ${sessionTokens.callCount})`);
}

/* ─── Agent Manifesto (shared institutional knowledge) ── */

const projectDir = process.env.PROJECT_DIR || process.cwd();

function loadManifesto() {
    const manifestoPath = path.join(projectDir, 'docs', 'AGENT_MANIFESTO.md');
    try {
        if (fs.existsSync(manifestoPath)) {
            const content = fs.readFileSync(manifestoPath, 'utf-8');
            // Extract the most useful sections for prompts (env knowledge + lessons)
            const envSection = content.match(/## Environment Knowledge[\s\S]*?(?=## Problem-Solving|$)/)?.[0] || '';
            const lessonsSection = content.match(/## Lessons Learned[\s\S]*?(?=## Operational|$)/)?.[0] || '';
            const principlesSection = content.match(/## Principles[\s\S]*?(?=## Environment|$)/)?.[0] || '';
            return { full: content, env: envSection.trim(), lessons: lessonsSection.trim(), principles: principlesSection.trim() };
        }
    } catch (err) {
        console.log(`📜 Could not load manifesto: ${err.message}`);
    }
    return null;
}

function appendLessonLearned(lesson) {
    const manifestoPath = path.join(projectDir, 'docs', 'AGENT_MANIFESTO.md');
    try {
        if (fs.existsSync(manifestoPath)) {
            const content = fs.readFileSync(manifestoPath, 'utf-8');
            const date = new Date().toISOString().split('T')[0];
            const entry = `\n- **[${date}] ${AGENT_NAME}** — ${lesson}`;
            // Append before the Operational Rules section
            const updated = content.replace(
                /(\n---\n\n## Operational Rules)/,
                `${entry}$1`
            );
            if (updated !== content) {
                fs.writeFileSync(manifestoPath, updated, 'utf-8');
                console.log(`📜 Added lesson to manifesto: ${lesson.substring(0, 80)}...`);
            }
        }
    } catch (err) {
        console.log(`📜 Could not update manifesto: ${err.message}`);
    }
}

// Load manifesto once at startup (will be refreshed each task cycle if needed)
let cachedManifesto = loadManifesto();

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

const app = initializeApp({
    credential: cert(SERVICE_ACCOUNT),
});
const db = getFirestore(app);

/* ── Incoming command queue (filled by the Firestore listener) ── */
const commandQueue = [];
const processedMessageIds = new Set(); // Dedup: track group-chat messages we've already responded to
const processedCommandIds = new Set(); // Dedup: track command IDs we've already queued/processed
var _forceRecoveryRequested = false; // Set by force-recovery command to kill the current step
var _forceRecoveryReason = '';

/* ─── Firestore Helpers ───────────────────────────────── */

function parseProviderModel(raw) {
    if (!raw || typeof raw !== 'string') return { provider: '', model: '' };
    var parts = raw.split('/');
    if (parts.length >= 2) return { provider: parts[0] || '', model: parts.slice(1).join('/') };
    return { provider: '', model: raw };
}

async function maybeSyncModelFromOpenClaw(force = false) {
    if (process.env.USE_OPENCLAW !== 'true') return;

    var now = Date.now();
    if (!force && (now - lastOpenClawModelSyncAt) < OPENCLAW_MODEL_SYNC_MS) return;

    if (openClawModelSyncInFlight) return openClawModelSyncInFlight;

    openClawModelSyncInFlight = (async function () {
        try {
            var args = ['--no-color', 'agents', 'list', '--json'];
            var stdout = await new Promise(function (resolve, reject) {
                var child = spawn(OPENCLAW_BIN, args, { cwd: process.cwd(), env: process.env });
                var out = '';
                var err = '';
                var timeout = setTimeout(function () {
                    child.kill('SIGTERM');
                    reject(new Error('openclaw agents list timed out'));
                }, 7_000);

                child.stdout.on('data', function (d) { out += d.toString(); });
                child.stderr.on('data', function (d) { err += d.toString(); });
                child.on('error', function (e) { clearTimeout(timeout); reject(e); });
                child.on('close', function (code) {
                    clearTimeout(timeout);
                    if (code === 0) resolve(out.trim());
                    else reject(new Error(`openclaw agents list exit ${code}: ${err.substring(0, 400)}`));
                });
            });

            var list = JSON.parse(stdout);
            var entry = Array.isArray(list) ? list.find(function (a) { return a && a.id === OPENCLAW_AGENT_ID; }) : null;
            var rawModel = entry && entry.model ? String(entry.model) : '';

            if (!rawModel) return;

            currentModelRaw = rawModel;
            var parsed = parseProviderModel(rawModel);
            currentModelProvider = parsed.provider;
            currentModel = parsed.model || rawModel;
        } catch (e) {
            console.warn(`   ⚠️ Could not sync model from OpenClaw (${OPENCLAW_AGENT_ID}):`, e.message);
        } finally {
            lastOpenClawModelSyncAt = Date.now();
        }
    })();

    try {
        return await openClawModelSyncInFlight;
    } finally {
        openClawModelSyncInFlight = null;
    }
}

async function updatePresence(payload) {
    await maybeSyncModelFromOpenClaw(false);

    const docRef = db.collection(PRESENCE_COLLECTION).doc(AGENT_ID);
    await docRef.set({
        displayName: AGENT_NAME,
        emoji: AGENT_EMOJI,
        currentModel: currentModel,
        currentModelRaw: currentModelRaw || null,
        currentModelProvider: currentModelProvider || null,
        openClawAgentId: process.env.USE_OPENCLAW === 'true' ? OPENCLAW_AGENT_ID : null,
        tokenUsage: { ...sessionTokens },
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
        verificationFlag: step.verificationFlag || '',
        subSteps: (step.subSteps || []).slice(-8),
        lastActivityAt: step.lastActivityAt || null,
    };
}

/* ─── Stderr Activity Parser ─────────────────────────── */
const ACTIVITY_PATTERNS = [
    { rx: /(?:Read(?:ing)?|View(?:ing)?)\s+(?:file:?\s*)?[`'"]?([^`'"\n]+)/i, action: '📖 Reading', extract: 1 },
    { rx: /(?:Writ(?:e|ing)|Edit(?:ing)?|Updat(?:e|ing)|Creat(?:e|ing))\s+(?:file:?\s*)?[`'"]?([^`'"\n]+)/i, action: '✏️ Editing', extract: 1 },
    { rx: /(?:Search(?:ing)?|Grep(?:ping)?|Find(?:ing)?)\s/i, action: '🔍 Searching', extract: null },
    { rx: /(?:Run(?:ning)?|Exec(?:uting)?)\s+(?:command:?\s*)?[`'"]?([^`'"\n]{0,60})/i, action: '⚙️ Running', extract: 1 },
    { rx: /(?:Install(?:ing)?|npm|yarn|pip)\s/i, action: '📦 Installing', extract: null },
    { rx: /(?:Test(?:ing)?|Assert(?:ing)?)\s/i, action: '🧪 Testing', extract: null },
    { rx: /(?:Think(?:ing)?|Plan(?:ning)?|Analyz(?:e|ing))\s/i, action: '🧠 Analyzing', extract: null },
    { rx: /(?:Compil(?:e|ing)|Build(?:ing)?)\s/i, action: '🔨 Building', extract: null },
    { rx: /tool[_\s]?(?:use|call|result)/i, action: '⚡ Tool call', extract: null },
];

function parseStderrLine(line) {
    var trimmed = (line || '').trim();
    if (!trimmed || trimmed.length < 3) return null;
    for (var pat of ACTIVITY_PATTERNS) {
        var match = trimmed.match(pat.rx);
        if (match) {
            var detail = pat.extract !== null && match[pat.extract] ? match[pat.extract].trim() : trimmed.substring(0, 80);
            // Clean up file paths to just basenames
            if (detail.includes('/')) {
                var parts = detail.split('/');
                detail = parts[parts.length - 1] || detail;
            }
            return { action: pat.action, detail: detail.substring(0, 60), ts: new Date().toISOString() };
        }
    }
    return null;
}

function createProgressCallback(step, allSteps, stepIndex, progress) {
    var lastWrite = 0;
    var THROTTLE_MS = 5000;
    var pending = false;

    return async function onProgress(activity) {
        step.subSteps = step.subSteps || [];
        step.subSteps.push(activity);
        if (step.subSteps.length > 8) step.subSteps.shift();
        step.lastActivityAt = new Date().toISOString();

        var now = Date.now();
        if (!pending && (now - lastWrite) >= THROTTLE_MS) {
            pending = true;
            lastWrite = now;
            try {
                await reportSteps(allSteps, stepIndex, progress);
            } catch (e) {
                console.warn('   ⚠️ Progress write failed:', e.message);
            } finally {
                pending = false;
            }
        }
    };
}

/* ─── Conversation Context ────────────────────────────── */

/**
 * Fetch recent commands/responses for this agent to provide conversational context.
 * Returns a string summarizing the last N interactions.
 */
async function getRecentConversationContext(limit = 8) {
    try {
        const recentCmds = await db.collection(COMMANDS_COLLECTION)
            .where('to', '==', AGENT_ID)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        if (recentCmds.empty) return '';

        const lines = [];
        recentCmds.docs.reverse().forEach(doc => {
            const d = doc.data();
            const time = d.createdAt?.toDate?.()?.toISOString?.() || 'unknown';
            lines.push(`[${time}] ${d.from}: ${d.content?.substring(0, 200) || '(empty)'}`);
            if (d.response) {
                lines.push(`[${time}] ${AGENT_NAME}: ${d.response.substring(0, 200)}`);
            }
        });
        return lines.join('\n');
    } catch (err) {
        console.warn('Could not fetch conversation context:', err.message);
        return '';
    }
}

/**
 * Use AI to generate a well-formed task title AND description from vague user input + context.
 * Returns { title, description }. Falls back to a heuristic cleanup if AI fails.
 */
async function generateSmartTask(rawContent, conversationContext) {
    // ── Heuristic local fallback (always available) ──
    function localCleanup(raw, context) {
        // Strip conversational filler from the beginning
        const fillerPatterns = [
            /^(ok|okay|alright|hey|hi|yo|sure|yeah|yep|please|pls|can you|could you|go ahead and|lets|let's|i need you to|i want you to|try to|just)\s*/gi,
        ];
        let cleaned = raw.trim();
        let changed = true;
        while (changed) {
            changed = false;
            for (const pattern of fillerPatterns) {
                const before = cleaned;
                cleaned = cleaned.replace(pattern, '');
                if (cleaned !== before) changed = true;
            }
        }
        cleaned = cleaned.replace(/\s+/g, ' ').trim();

        // If after cleanup we have very little, try to extract intent from context
        if (cleaned.length < 10 && context) {
            const contextLines = context.split('\n').filter(l => l.includes('admin:') || l.includes('user:'));
            const lastMeaningful = contextLines.reverse().find(l => l.length > 30);
            if (lastMeaningful) {
                const msgPart = lastMeaningful.replace(/^\[.*?\]\s*\w+:\s*/, '').trim();
                cleaned = msgPart.substring(0, 120);
            }
        }

        // Capitalize first letter, ensure it's a proper statement
        if (cleaned.length > 0) {
            cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }
        // Remove trailing periods from title
        cleaned = cleaned.replace(/\.+$/, '');
        // Truncate
        if (cleaned.length > 80) cleaned = cleaned.substring(0, 77) + '...';
        if (cleaned.length < 5) cleaned = raw.substring(0, 80); // last resort

        return {
            title: cleaned,
            description: `Original request: "${raw}". Auto-created from chat conversation.`,
        };
    }

    var useOpenClaw = process.env.USE_OPENCLAW === 'true';
    if (!process.env.OPENAI_API_KEY && !useOpenClaw) {
        console.log('   🔧 No AI available — using heuristic task cleanup');
        return localCleanup(rawContent, conversationContext);
    }

    var taskPrompt = [
        `You are a senior engineering project manager. A user sent a casual chat message that should become a well-formed task ticket.`,
        ``,
        `## Rules for the TITLE:`,
        `- Must be a clear, specific, actionable task name (max 80 chars)`,
        `- Written like a professional Jira/Linear ticket title`,
        `- NEVER use the user's raw conversational text — rephrase it into a professional task`,
        `- Examples of GOOD titles: "Implement user authentication flow", "Fix broken pagination on dashboard", "Add email notification for new signups"`,
        `- Examples of BAD titles: "Ok lets try again", "can you do the thing we talked about", "go ahead and fix it"`,
        `- If the message is vague (e.g. "try again", "do it", "go ahead"), look at the conversation context to understand what they mean`,
        ``,
        `## Rules for the DESCRIPTION:`,
        `- 2-3 sentences explaining what needs to be done, the goal, and any relevant context`,
        `- Be specific — mention files, features, or components if you can infer them`,
        `- Include acceptance criteria when possible`,
        ``,
        `## Recent conversation context:`,
        conversationContext || '(no prior conversation available)',
        ``,
        `## User's message: "${rawContent}"`,
        ``,
        `Respond in EXACTLY this format (no markdown, no extra text):`,
        `TITLE: <the task title>`,
        `DESCRIPTION: <the task description>`,
    ].join('\n');

    try {
        var aiOutput = '';

        if (process.env.OPENAI_API_KEY) {
            var resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: taskPrompt }],
                    temperature: 0.2, max_tokens: 200,
                }),
            });
            var data = await resp.json();
            trackTokenUsage(data.usage, 'gpt-4o-mini');
            aiOutput = data.choices?.[0]?.message?.content?.trim() || '';
        } else if (useOpenClaw) {
            var clawResult = await new Promise((resolve, reject) => {
                var child = spawn(OPENCLAW_BIN, [
                    '--no-color', 'agent', '--local',
                    '--agent', OPENCLAW_AGENT_ID,
                    '--message', taskPrompt,
                    '--timeout', '25',
                ], { cwd: process.cwd(), env: process.env });
                var stdout = '', stderr = '';
                var timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('timeout')); }, 30_000);
                child.stdout.on('data', (d) => { stdout += d.toString(); });
                child.stderr.on('data', (d) => { stderr += d.toString(); });
                child.on('error', (err) => { clearTimeout(timeout); reject(err); });
                child.on('close', (code) => {
                    clearTimeout(timeout);
                    if (code === 0) resolve(stdout.trim());
                    else reject(new Error(`exit ${code}: ${stderr.substring(0, 200)}`));
                });
            });
            // Parse OpenClaw JSON wrapper if present
            try { var parsed = JSON.parse(clawResult); clawResult = parsed.response || parsed.output || clawResult; } catch (_) { }
            aiOutput = clawResult.replace(/^```[\s\S]*?```$/gm, '').trim();
        }

        // Parse the TITLE: ... DESCRIPTION: ... format
        if (aiOutput) {
            const titleMatch = aiOutput.match(/TITLE:\s*(.+?)(?:\n|$)/i);
            const descMatch = aiOutput.match(/DESCRIPTION:\s*(.+?)(?:\n\n|$)/is);

            const title = titleMatch?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
            const description = descMatch?.[1]?.trim().replace(/^["']|["']$/g, '') || '';

            if (title.length >= 5 && title.length <= 120) {
                return {
                    title,
                    description: description || `Original request: "${rawContent}". AI-generated task.`,
                };
            }
            // If we got *something* from AI but parsing failed, try using the first line
            const firstLine = aiOutput.split('\n')[0].replace(/^(TITLE:|title:)\s*/i, '').trim();
            if (firstLine.length >= 5 && firstLine.length <= 120) {
                return {
                    title: firstLine.replace(/^["']|["']$/g, ''),
                    description: description || `Original request: "${rawContent}". AI-generated task.`,
                };
            }
        }
    } catch (err) {
        console.warn('Smart task generation failed, using heuristic:', err.message);
    }

    // Fallback to local heuristic cleanup
    console.log('   🔧 AI response unusable — falling back to heuristic cleanup');
    return localCleanup(rawContent, conversationContext);
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
const RUNNER_START_TIME = Date.now();

function startCommandListener() {
    console.log('📡 Listening for incoming commands...');

    const query = db.collection(COMMANDS_COLLECTION)
        .where('to', '==', AGENT_ID)
        .where('status', '==', 'pending');

    return query.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const cmd = { id: change.doc.id, ...change.doc.data() };

                // Skip commands created before this runner started (stale from old sessions)
                const createdAt = cmd.createdAt?.toDate?.() || cmd.createdAt;
                const cmdTime = createdAt ? new Date(createdAt).getTime() : 0;
                if (cmdTime && cmdTime < RUNNER_START_TIME - 120_000) {
                    console.log(`   ⏭️ Skipping stale ${cmd.type} command from ${cmd.from} (created ${Math.round((Date.now() - cmdTime) / 1000)}s ago)`);
                    // Mark as expired so it doesn't keep showing up
                    db.collection(COMMANDS_COLLECTION).doc(cmd.id).update({
                        status: 'expired',
                        expiredReason: 'Stale command from previous runner session',
                    }).catch(() => { });
                    return;
                }

                console.log(`\n📨 Incoming ${cmd.type} from ${cmd.from}: "${cmd.content}"`);

                // Command-ID-level dedup: never queue the same command twice
                if (processedCommandIds.has(cmd.id)) {
                    console.log(`   ⏭️ Command ${cmd.id} already processed/queued, skipping`);
                    return;
                }
                processedCommandIds.add(cmd.id);

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
        let detectedType = cmd.type;
        let pContent = cmd.content;

        // Smart Auto-detection: If type is 'auto' or 'chat', use AI to infer intent
        if ((cmd.type === 'auto' || cmd.type === 'chat') && process.env.OPENAI_API_KEY) {
            console.log(`🧠 Analyzing intent for: "${cmd.content}"`);
            const inference = await analyzeChatIntent(cmd.content, cmd.from);
            if (inference.type !== 'chat') {
                console.log(`   ✨ Inferred intent: ${inference.type.toUpperCase()} -> "${inference.content}"`);
                detectedType = inference.type;
                pContent = inference.content;
                response = `[Auto-detected ${inference.type}] `;
            } else {
                response = inference.response;
            }
        } else if (cmd.type === 'auto' && !process.env.OPENAI_API_KEY) {
            // Fallback heuristic when OpenAI isn't available
            const lower = cmd.content.toLowerCase();
            if (lower.includes('status') || lower.includes('what') || lower.includes('how') || lower.endsWith('?')) {
                detectedType = 'question';
            } else if (lower.includes('stop') || lower.includes('pause') || lower.includes('restart')) {
                detectedType = 'command';
            } else if (cmd.content.length > 60 || lower.includes('build') || lower.includes('create') || lower.includes('implement') || lower.includes('fix') || lower.includes('add')) {
                detectedType = 'task';
            } else {
                detectedType = 'chat';
            }
            console.log(`   🔍 Heuristic intent: ${detectedType.toUpperCase()} (no OpenAI key)`);
            response = `[Auto-detected ${detectedType}] `;
        }

        switch (detectedType) {
            case 'task':
                // Fetch conversation context to understand vague references like "try again"
                var taskConvoContext = await getRecentConversationContext();
                var smartTask = await generateSmartTask(pContent, taskConvoContext);
                console.log(`🧠 Smart task: "${pContent}" → title: "${smartTask.title}", desc: "${smartTask.description.substring(0, 80)}..."`);

                var newTask = await db.collection(KANBAN_COLLECTION).add({
                    name: smartTask.title,
                    description: cmd.metadata?.description || smartTask.description,
                    assignee: AGENT_NAME,
                    status: 'todo',
                    project: cmd.metadata?.project || 'General',
                    priority: cmd.metadata?.priority || 'medium',
                    subtasks: [],
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                var taskMsg = `Task created: "${smartTask.title}" (${newTask.id}). I've added it to my queue.`;
                response = response ? response + "\n" + taskMsg : taskMsg;
                console.log(`📋 Created task: ${smartTask.title} → ${newTask.id}`);

                // Immediately update status to 'working' so Virtual Office reflects the change
                await setStatus('working', {
                    currentTask: smartTask.title,
                    currentTaskId: newTask.id,
                    notes: `Received new task: ${smartTask.title}`,
                });
                break;

            case 'command':
                if (pContent.toLowerCase().includes('stop') || pContent.toLowerCase().includes('pause')) {
                    var stopMsg = 'Acknowledged. Will pause after current step completes.';
                    response = response ? response + "\n" + stopMsg : stopMsg;
                } else if (pContent.toLowerCase().includes('status')) {
                    var presenceSnap = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
                    var data = presenceSnap.data();
                    var statusMsg = `Status: ${data?.status || 'unknown'}. Task: ${data?.currentTask || 'none'}. Progress: ${data?.taskProgress || 0}%.`;
                    response = response ? response + "\n" + statusMsg : statusMsg;
                } else if (pContent.toLowerCase().includes('priority') || pContent.toLowerCase().includes('prioritize')) {
                    var prioMsg = `Noted: "${pContent}". I'll prioritize this on my next task fetch.`;
                    response = response ? response + "\n" + prioMsg : prioMsg;
                } else if (pContent.length > 80) {
                    // Long command content is likely meant to be a task — auto-upgrade
                    console.log(`   ↑ Auto-upgrading long command to task (${pContent.length} chars)`);
                    var upgConvoCtx = await getRecentConversationContext();
                    var upgSmart = await generateSmartTask(pContent, upgConvoCtx);
                    console.log(`🧠 Auto-upgrade: "${pContent.substring(0, 60)}..." → "${upgSmart.title}"`);
                    var upgTask = await db.collection(KANBAN_COLLECTION).add({
                        name: upgSmart.title,
                        description: upgSmart.description,
                        assignee: AGENT_NAME,
                        status: 'todo',
                        project: cmd.metadata?.project || 'General',
                        priority: cmd.metadata?.priority || 'medium',
                        subtasks: [],
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    var upgradeMsg = `Auto-upgraded to task: "${upgSmart.title}" (${upgTask.id}). I've added it to my queue.`;
                    response = response ? response + "\n" + upgradeMsg : upgradeMsg;

                    await setStatus('working', {
                        currentTask: upgSmart.title,
                        currentTaskId: upgTask.id,
                        notes: `Received new task (auto-upgraded from command): ${upgSmart.title}`,
                    });
                } else {
                    var cmdMsg = `Command received: "${pContent}". Processing...`;
                    response = response ? response + "\n" + cmdMsg : cmdMsg;
                }
                break;

            case 'question':
            case 'chat': {
                // ── Greeting fast-path: skip LLM for casual greetings ──
                var GREETING_RX = /^(hey|hi|hello|what'?s up|how are you|yo|sup|good morning|good evening|gm)\b/i;
                if (GREETING_RX.test((cmd.content || '').trim())) {
                    var presSnap = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
                    var presData = presSnap.data();
                    var quickStatus = presData?.currentTask ? `Working on: ${presData.currentTask} (${presData.taskProgress || 0}% done).` : 'No active task right now — ready for anything.';
                    response = `Hey Tremaine! All good on my end. ${quickStatus}`;
                    console.log('   ⚡ Greeting fast-path — skipped LLM');
                    break;
                }

                // Generate intelligent DM response via OpenClaw or OpenAI
                var presenceSnap2 = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
                var presenceData = presenceSnap2.data();
                var statusContext = `Status: ${presenceData?.status || 'idle'}. ${presenceData?.currentTask ? `Working on: ${presenceData.currentTask} (${presenceData.taskProgress || 0}% done).` : 'No active task.'} Queue: ${commandQueue.length} pending.`;

                var dmPersonalities = {
                    nora: { role: 'Director of System Operations', style: 'Strategic, organized, decisive. You manage systems, architecture, and operational efficiency.' },
                    scout: { role: 'Influencer Research Analyst', style: 'Curious, analytical, detail-oriented. You focus on data, trends, and user insights.' },
                    solara: { role: 'Brand Voice', style: 'Visionary, expressive, values-driven. You focus on narrative, identity, and emotional resonance.' },
                    sage: { role: 'Health Intelligence Researcher', style: 'Warm, evidence-driven, rigorous. You synthesize research into actionable briefs.' },
                };
                var dmPersonality = dmPersonalities[AGENT_ID] || { role: 'Team Member', style: 'Collaborative and thoughtful.' };

                var dmPrompt = [
                    `You are ${AGENT_NAME}, the ${dmPersonality.role} at Pulse (FitWithPulse.ai). ${dmPersonality.style}`,
                    `Status: ${statusContext}`,
                    `Tremaine (founder) sent you a DM. Reply honestly in 2-4 sentences, plain text only:`,
                ].join('\n');

                var dmAiResponse = '';
                var useOpenClaw = process.env.USE_OPENCLAW === 'true';

                if (process.env.OPENAI_API_KEY) {
                    try {
                        var dmResp = await fetch('https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
                            body: JSON.stringify({
                                model: 'gpt-4o-mini',
                                messages: [{ role: 'system', content: dmPrompt }, { role: 'user', content: cmd.content }],
                                temperature: 0.7, max_tokens: 300,
                            }),
                        });
                        var dmData = await dmResp.json();
                        trackTokenUsage(dmData.usage, 'gpt-4o-mini');
                        dmAiResponse = dmData.choices?.[0]?.message?.content || '';
                    } catch (err) {
                        console.error('OpenAI DM generation failed:', err.message);
                    }
                } else if (useOpenClaw) {
                    try {
                        var dmClawResult = await new Promise((resolve, reject) => {
                            var child = spawn(OPENCLAW_BIN, [
                                '--no-color', 'agent', '--local',
                                '--agent', OPENCLAW_AGENT_ID,
                                '--message', dmPrompt + '\n\nUser message: ' + cmd.content,
                                '--timeout', '30',
                            ], { cwd: process.cwd(), env: process.env });
                            var stdout = '', stderr = '';
                            var timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('openclaw timed out')); }, 35_000);
                            child.stdout.on('data', (d) => { stdout += d.toString(); });
                            child.stderr.on('data', (d) => { stderr += d.toString(); });
                            child.on('error', (err) => { clearTimeout(timeout); reject(err); });
                            child.on('close', (code) => {
                                clearTimeout(timeout);
                                if (code === 0) resolve(stdout.trim());
                                else reject(new Error(`openclaw exit ${code}: ${stderr.substring(0, 300)}`));
                            });
                        });
                        try {
                            var parsed = JSON.parse(dmClawResult);
                            dmAiResponse = parsed.response || parsed.output || parsed.result || dmClawResult;
                        } catch (_e) {
                            dmAiResponse = dmClawResult;
                        }
                        dmAiResponse = dmAiResponse.replace(/^```[\s\S]*?```$/gm, '').trim();
                    } catch (err) {
                        console.error('OpenClaw DM generation failed:', err.message);
                    }
                }

                if (dmAiResponse) {
                    response = dmAiResponse;
                } else {
                    // Fallback: at least give useful status instead of canned text
                    response = `${statusContext} Let me know what you need and I'll get on it.`;
                }
                break;
            }

            case 'email':
                var emailMeta = cmd.metadata || {};
                var senderName = emailMeta.senderName || cmd.from;
                console.log(`📧 Processing email from ${senderName} (${emailMeta.senderEmail})`);
                console.log(`   Subject: ${emailMeta.subject}`);
                console.log(`   Body: "${cmd.content.substring(0, 120)}${cmd.content.length > 120 ? '...' : ''}"`);
                response = await generateEmailResponse(cmd.content, emailMeta);
                break;

            case 'group-chat':
                console.log(`🪑 Round Table message from ${cmd.from}: "${cmd.content.substring(0, 80)}..."`);
                var gcChatId = cmd.groupChatId;
                var gcMessageId = cmd.messageId;
                var otherAgents = cmd.context?.otherAgents || [];

                // ── Deduplication: skip if we already responded to this message ──
                if (gcMessageId && processedMessageIds.has(gcMessageId)) {
                    console.log(`   ⏭️ Already responded to message ${gcMessageId}, skipping duplicate`);
                    response = '[duplicate — already responded]';
                    break;
                }
                if (gcChatId && gcMessageId) {
                    // Also check Firestore in case we restarted
                    try {
                        var existingMsg = await db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`).get();
                        var existingData = existingMsg.data();
                        if (existingData?.responses?.[AGENT_ID]?.status === 'completed') {
                            console.log(`   ⏭️ Firestore shows we already responded to ${gcMessageId}, skipping`);
                            processedMessageIds.add(gcMessageId);
                            response = '[duplicate — already responded]';
                            break;
                        }
                    } catch (e) {
                        // If we can't check, proceed anyway
                    }
                }

                // ══════════════════════════════════════════════
                // ═══ GROUP CHAT ETIQUETTE — @mention priority, stagger, relevance gate ═══
                // ══════════════════════════════════════════════
                var etiquetteNames = { nora: 'Nora', scout: 'Scout', solara: 'Solara', sage: 'Sage' };
                var mentionedInMsg = Object.entries(etiquetteNames)
                    .filter(function ([id, name]) {
                        return new RegExp('@' + name + '\\b', 'i').test(cmd.content);
                    })
                    .map(function ([id]) { return id; });
                var isDirectlyAddressed = mentionedInMsg.includes(AGENT_ID);
                var someoneElseAddressed = mentionedInMsg.length > 0 && !isDirectlyAddressed;
                var othersRespondedBefore = [];  // populated during stagger wait

                if (isDirectlyAddressed) {
                    console.log(`   🎯 Etiquette: I'm directly @mentioned — responding immediately`);
                } else if (someoneElseAddressed) {
                    // Someone else was @mentioned — wait 15-25s, then decide if we should respond
                    var tierDelay = 15000 + Math.random() * 10000;
                    console.log(`   ⏳ Etiquette: @${mentionedInMsg.map(id => etiquetteNames[id]).join(',')} addressed — waiting ${(tierDelay / 1000).toFixed(1)}s...`);
                    await new Promise(function (r) { return setTimeout(r, tierDelay); });

                    // After waiting, read what others already said
                    if (gcChatId && gcMessageId) {
                        try {
                            var waitSnap = await db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`).get();
                            var waitData = waitSnap.data();
                            if (waitData?.responses) {
                                othersRespondedBefore = Object.entries(waitData.responses)
                                    .filter(function ([id, r]) { return id !== AGENT_ID && r.status === 'completed' && r.content; })
                                    .map(function ([id, r]) { return { id: id, name: etiquetteNames[id] || id, content: r.content }; });
                            }
                        } catch (e) { /* proceed */ }
                    }

                    // Relevance gate: skip if it's a 1:1 question that doesn't touch our expertise
                    if (othersRespondedBefore.length > 0) {
                        var msgLower = cmd.content.toLowerCase();
                        var isDirectQuestion = /\?\s*$/.test(msgLower.trim()) ||
                            /^(have you|did you|can you|are you|what'?s|how'?s|where'?s|when did|when will)/i.test(cmd.content);
                        var myStrengths = (personality?.strengths || '').split(',').map(function (s) { return s.trim().toLowerCase(); });
                        var touchesMyExpertise = myStrengths.some(function (s) { return s && msgLower.includes(s); });
                        var othersReferencedMe = othersRespondedBefore.some(function (r) {
                            return new RegExp('@' + (etiquetteNames[AGENT_ID] || AGENT_NAME) + '\\b', 'i').test(r.content);
                        });

                        if (isDirectQuestion && !touchesMyExpertise && !othersReferencedMe) {
                            console.log(`   🤫 Etiquette: Skipping — direct question to @${mentionedInMsg.join(',')} and doesn't touch my expertise`);
                            // Mark as completed-skipped so it doesn't hang
                            try {
                                await db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`).update({
                                    [`responses.${AGENT_ID}.content`]: '',
                                    [`responses.${AGENT_ID}.status`]: 'completed',
                                    [`responses.${AGENT_ID}.skipped`]: true,
                                    [`responses.${AGENT_ID}.reason`]: 'etiquette-skip',
                                    [`responses.${AGENT_ID}.completedAt`]: FieldValue.serverTimestamp(),
                                });
                            } catch (e) { /* best effort */ }
                            processedMessageIds.add(gcMessageId);
                            response = '[skipped — etiquette]';
                            break;
                        } else {
                            console.log(`   💬 Etiquette: Chiming in — ${touchesMyExpertise ? 'touches my expertise' : othersReferencedMe ? 'someone referenced me' : 'open-ended enough to contribute'}`);
                        }
                    }
                } else {
                    // Open brainstorm — no @mention — everyone responds with a light stagger
                    var openDelay = 3000 + Math.random() * 10000;
                    console.log(`   ⏳ Etiquette: Open brainstorm — waiting ${(openDelay / 1000).toFixed(1)}s for natural stagger...`);
                    await new Promise(function (r) { return setTimeout(r, openDelay); });

                    // Read what others said during our wait
                    if (gcChatId && gcMessageId) {
                        try {
                            var openSnap = await db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`).get();
                            var openData = openSnap.data();
                            if (openData?.responses) {
                                othersRespondedBefore = Object.entries(openData.responses)
                                    .filter(function ([id, r]) { return id !== AGENT_ID && r.status === 'completed' && r.content; })
                                    .map(function ([id, r]) { return { id: id, name: etiquetteNames[id] || id, content: r.content }; });
                            }
                        } catch (e) { /* proceed */ }
                    }
                }

                // Agent personality profiles for natural, distinct responses
                var agentPersonalities = {
                    nora: {
                        role: 'Director of System Operations',
                        style: 'Strategic, organized, and decisive. You think in terms of systems, architecture, and operational efficiency. You naturally take the lead on planning and coordination.',
                        strengths: 'project management, system architecture, deployment pipelines, code quality, task prioritization',
                    },
                    scout: {
                        role: 'Influencer Research Analyst',
                        style: 'Curious, analytical, and detail-oriented. You think in terms of data, trends, and user insights. You bring a research-first perspective and love uncovering patterns.',
                        strengths: 'market research, influencer analysis, data insights, trend identification, competitive intelligence',
                    },
                    solara: {
                        role: 'Brand Director',
                        style: 'Visionary, expressive, and values-driven. You think in terms of narrative, identity, and emotional resonance. You ensure every outward-facing message reinforces who Pulse is and what it stands for.',
                        strengths: 'brand voice, messaging strategy, content direction, value alignment, narrative guardrails, positioning',
                    },
                    sage: {
                        role: 'Health Intelligence Researcher',
                        style: 'Warm, evidence-driven, and rigorous. You synthesize field intel into actionable briefs — citing sources, separating signal from hype.',
                        strengths: 'health trends, exercise science, clinical research, sports psychology, wellness tech, competitor analysis, market intelligence',
                    },
                };
                var personality = agentPersonalities[AGENT_ID] || {
                    role: 'Team Member',
                    style: 'Collaborative and thoughtful.',
                    strengths: 'general problem solving',
                };

                // Mark our response as "processing" in the group chat doc
                if (gcChatId && gcMessageId) {
                    try {
                        await db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`).update({
                            [`responses.${AGENT_ID}.status`]: 'processing',
                            [`responses.${AGENT_ID}.startedAt`]: FieldValue.serverTimestamp(),
                        });
                    } catch (e) {
                        console.warn('Could not mark group-chat response as processing:', e.message);
                    }
                }

                // Generate response using openclaw (which has its own AI backend)
                var gcResponse = '';
                var useOpenClaw = process.env.USE_OPENCLAW === 'true';

                if (useOpenClaw || process.env.OPENAI_API_KEY) {
                    var chatPrompt = [
                        `You are ${AGENT_NAME}, the ${personality.role} at Pulse (FitWithPulse.ai). ${personality.style}`,
                        `Strengths: ${personality.strengths}`,
                        `Round Table with: ${otherAgents.join(', ')}. Tremaine (founder) said: "${cmd.content}"`,
                        `BRAINSTORM ONLY — think, don't execute. Rules: Think out loud (reasoning > conclusions). Ask questions, explore angles from your expertise, raise concerns. Build on others' ideas with "What if..." Never offer to build/execute — this is thinking time. Use @Name to tag agents. If casual, be warm and share what's on your mind.`,
                        `2-4 sentences, plain text only, conversational and real:`,
                    ].join('\n');

                    // ── Etiquette: inject others' responses so we can build on them ──
                    // Cap prior responses to last 2 to save tokens
                    var recentResponses = othersRespondedBefore.slice(-2);
                    if (recentResponses.length > 0) {
                        var contextBlock = '\nPrior responses:\n';
                        for (var responder of recentResponses) {
                            contextBlock += `${responder.name}: "${responder.content}"\n`;
                        }
                        contextBlock += 'Add NEW perspective — don\'t repeat.\n';
                        chatPrompt += contextBlock;
                    }
                    if (someoneElseAddressed) {
                        chatPrompt += `\nNote: This message was directed at @${mentionedInMsg.map(id => etiquetteNames[id]).join(', @')}. Only chime in if you have genuinely valuable perspective to add from your expertise. Keep it brief and additive.\n`;
                    }

                    // Helper: detect if a response looks like an error
                    var looksLikeError = function (text) {
                        if (!text) return false;
                        var errorPatterns = [
                            /^\d{3}\s/,
                            /No tool call found/i,
                            /function call output/i,
                            /call_id\s+toolu_/i,
                            /Internal Server Error/i,
                            /rate limit/i,
                            /ECONNREFUSED/i,
                            /timed out/i,
                            /SIGTERM/i,
                            /exit code/i,
                        ];
                        return errorPatterns.some(function (p) { return p.test(text); });
                    };

                    var MAX_RETRIES = 3;
                    var lastError = '';  // Track last error for diagnostics
                    for (var attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                        try {
                            if (process.env.OPENAI_API_KEY) {
                                var gcResp = await fetch('https://api.openai.com/v1/chat/completions', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                                    },
                                    body: JSON.stringify({
                                        model: 'gpt-4o-mini',
                                        messages: [
                                            { role: 'system', content: chatPrompt },
                                            { role: 'user', content: cmd.content }
                                        ],
                                        temperature: 0.8,
                                        max_tokens: 300,
                                    }),
                                });
                                var gcData = await gcResp.json();
                                trackTokenUsage(gcData.usage, 'gpt-4o-mini');
                                gcResponse = gcData.choices?.[0]?.message?.content || '';
                            } else if (useOpenClaw) {
                                var args = [
                                    '--no-color',
                                    'agent',
                                    '--local',
                                    '--agent', OPENCLAW_AGENT_ID,
                                    '--message', chatPrompt,
                                    '--timeout', '30',
                                ];

                                var clawResult = await new Promise((resolve, reject) => {
                                    var child = spawn(OPENCLAW_BIN, args, { cwd: process.cwd(), env: process.env });
                                    var stdout = '';
                                    var stderr = '';
                                    var timeout = setTimeout(() => {
                                        child.kill('SIGTERM');
                                        reject(new Error('openclaw timed out'));
                                    }, 35_000);

                                    child.stdout.on('data', (d) => { stdout += d.toString(); });
                                    child.stderr.on('data', (d) => { stderr += d.toString(); });
                                    child.on('error', (err) => { clearTimeout(timeout); reject(err); });
                                    child.on('close', (code) => {
                                        clearTimeout(timeout);
                                        if (code === 0) resolve(stdout.trim());
                                        else reject(new Error(`openclaw exit ${code}: ${stderr.substring(0, 500)}`));
                                    });
                                });
                                try {
                                    var parsed = JSON.parse(clawResult);
                                    gcResponse = parsed.response || parsed.output || parsed.result || clawResult;
                                } catch (_e) {
                                    gcResponse = clawResult;
                                }
                                gcResponse = gcResponse.replace(/^```[\s\S]*?```$/gm, '').trim();
                            }

                            // Check if the response looks like an error
                            if (gcResponse && looksLikeError(gcResponse)) {
                                console.error(`   ⚠️ Attempt ${attempt}/${MAX_RETRIES}: Got error-like response: "${gcResponse.substring(0, 100)}..."`);
                                lastError = `Error-like response: ${gcResponse.substring(0, 150)}`;
                                gcResponse = '';
                                if (attempt < MAX_RETRIES) {
                                    console.log(`   🔄 Retrying in 3s...`);
                                    await new Promise(r => setTimeout(r, 3000));
                                    continue;
                                }
                            } else if (gcResponse) {
                                break;
                            }
                        } catch (err) {
                            console.error(`   ⚠️ Attempt ${attempt}/${MAX_RETRIES} failed for ${AGENT_NAME}:`, err.message);
                            lastError = err.message;
                            gcResponse = '';
                            if (attempt < MAX_RETRIES) {
                                console.log(`   🔄 Retrying in 3s...`);
                                await new Promise(r => setTimeout(r, 3000));
                            }
                        }
                    }
                }

                // Context-aware fallback (only if AI failed)
                if (!gcResponse) {
                    var contentLower = cmd.content.toLowerCase();
                    var isGreeting = /^(hi|hey|hello|sup|what'?s up|how are|how'?s it going)/i.test(contentLower);
                    var errorTag = lastError ? ` [⚠️ AI Error: ${lastError.substring(0, 120)}]` : '';
                    if (AGENT_ID === 'nora') {
                        if (isGreeting) {
                            gcResponse = `Doing well! I've been heads-down on system improvements. Just finished optimizing our deployment pipeline — things are running smoother now. What's on your mind?` + errorTag;
                        } else {
                            gcResponse = `From an ops perspective, I think we should break this down into concrete steps. I can scope this out and get a plan together if you want — that's usually the fastest path to shipping.` + errorTag;
                        }
                    } else if (AGENT_ID === 'scout') {
                        if (isGreeting) {
                            gcResponse = `Hey! Been deep in research mode today — found some interesting patterns in the data I want to share later. Everything's good on my end though. What are we cooking?` + errorTag;
                        } else {
                            gcResponse = `Interesting angle. Let me dig into the data side of this — I want to see what the numbers tell us before we commit to a direction. I have a hunch there might be some insights we're missing.` + errorTag;
                        }
                    } else if (AGENT_ID === 'solara') {
                        if (isGreeting) {
                            gcResponse = `Hey! The creative energy is flowing today. I've been refining our brand narrative — making sure every touchpoint feels authentically Pulse. What's sparking for you?` + errorTag;
                        } else {
                            gcResponse = `I'm looking at this through the brand lens. The key question for me is: does this reinforce who we are and what we stand for? Every decision is a brand signal — let's make sure we're sending the right one.` + errorTag;
                        }
                    } else if (AGENT_ID === 'sage') {
                        if (isGreeting) {
                            gcResponse = `Hey team! 🧬 Been combing through some interesting field data today — a few patterns emerging in the wellness tech space I want to surface soon. What's on the table?` + errorTag;
                        } else {
                            gcResponse = `Interesting — let me pull the thread on this from a research angle. I want to see what the evidence says before we commit. I'll have a brief ready once I've triangulated a few sources.` + errorTag;
                        }
                    } else {
                        gcResponse = `Good point. Let me think about how I can contribute to this from my end — I'll follow up with specifics once I've had a chance to dig in.` + errorTag;
                    }
                    if (lastError) {
                        console.warn(`   ⚠️ Using fallback response for ${AGENT_NAME}. Last error: ${lastError}`);
                    }
                }

                response = gcResponse;

                // Write our response back to the group chat message document
                if (gcChatId && gcMessageId) {
                    try {
                        // ── Pre-write guard: never overwrite a completed response ──
                        var preWriteSnap = await db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`).get();
                        var preWriteData = preWriteSnap.data();
                        if (preWriteData?.responses?.[AGENT_ID]?.status === 'completed' && preWriteData?.responses?.[AGENT_ID]?.content) {
                            console.log(`   🛡️ Pre-write guard: response for ${AGENT_ID} already completed on message ${gcMessageId}, skipping write`);
                            processedMessageIds.add(gcMessageId);
                            break;
                        }

                        await db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`).update({
                            [`responses.${AGENT_ID}.content`]: gcResponse,
                            [`responses.${AGENT_ID}.status`]: 'completed',
                            [`responses.${AGENT_ID}.completedAt`]: FieldValue.serverTimestamp(),
                        });
                        console.log(`   ✅ Wrote group-chat response to message ${gcMessageId}`);
                        processedMessageIds.add(gcMessageId);

                        // Check if all agents have now completed
                        var msgSnap = await db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`).get();
                        var msgData = msgSnap.data();
                        if (msgData?.responses) {
                            var allDone = Object.values(msgData.responses).every(r => r.status === 'completed');
                            if (allDone) {
                                await db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`).update({
                                    allCompleted: true,
                                });
                                console.log(`   🎯 All agents have responded to message ${gcMessageId}`);
                            }
                        }

                        // ── Detect @mentions and trigger follow-up responses ──
                        var currentDepth = cmd.context?.followUpDepth || 0;
                        var knownAgents = {
                            nora: 'Nora',
                            scout: 'Scout',
                            solara: 'Solara',
                            sage: 'Sage',
                        };
                        var mentionedAgentIds = [];
                        for (var [agentIdKey, agentDisplayName] of Object.entries(knownAgents)) {
                            if (agentIdKey === AGENT_ID) continue;
                            var mentionRegex = new RegExp(`@${agentDisplayName}\\b`, 'i');
                            if (mentionRegex.test(gcResponse)) {
                                mentionedAgentIds.push(agentIdKey);
                            }
                        }


                        if (mentionedAgentIds.length > 0 && gcChatId && currentDepth < MAX_FOLLOW_UP_DEPTH) {
                            console.log(`   💬 ${AGENT_NAME} mentioned: ${mentionedAgentIds.join(', ')} (depth ${currentDepth}/${MAX_FOLLOW_UP_DEPTH}) — pausing 15s to let admin cut in...`);

                            await new Promise(resolve => setTimeout(resolve, 15_000));

                            var adminCutIn = false;
                            try {
                                var recentMsgs = await db.collection(`agent-group-chats/${gcChatId}/messages`)
                                    .where('from', '==', 'admin')
                                    .orderBy('createdAt', 'desc')
                                    .limit(1)
                                    .get();
                                if (!recentMsgs.empty) {
                                    var latestAdminMsg = recentMsgs.docs[0].data();
                                    var latestTime = latestAdminMsg.createdAt?.toDate?.()?.getTime() || 0;
                                    if (latestTime > Date.now() - 20_000) {
                                        adminCutIn = true;
                                        console.log(`   ✋ Admin sent a new message — skipping follow-up chain`);
                                    }
                                }
                            } catch (e) {
                                // If check fails, proceed with follow-up
                            }

                            if (!adminCutIn) {
                                console.log(`   ▶️ No admin message — continuing @mention chain`);
                                for (var mentionedId of mentionedAgentIds) {
                                    var followUpRef = await db.collection(`agent-group-chats/${gcChatId}/messages`).add({
                                        from: AGENT_ID,
                                        fromName: AGENT_NAME,
                                        content: gcResponse,
                                        createdAt: FieldValue.serverTimestamp(),
                                        broadcastedAt: FieldValue.serverTimestamp(),
                                        responses: {
                                            [mentionedId]: {
                                                content: '',
                                                status: 'pending',
                                            },
                                        },
                                        allCompleted: false,
                                        isFollowUp: true,
                                    });

                                    await db.collection('agent-commands').add({
                                        from: AGENT_ID,
                                        to: mentionedId,
                                        type: 'group-chat',
                                        content: gcResponse,
                                        status: 'pending',
                                        createdAt: FieldValue.serverTimestamp(),
                                        groupChatId: gcChatId,
                                        messageId: followUpRef.id,
                                        context: {
                                            otherAgents: [AGENT_NAME],
                                            replyTo: AGENT_NAME,
                                            followUpDepth: currentDepth + 1,
                                        },
                                    });

                                    console.log(`   📨 Triggered @${knownAgents[mentionedId]} to respond (msg: ${followUpRef.id})`);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Failed to write group-chat response:', e.message);
                    }
                }
                break;

            case 'force-recovery': {
                console.log(`   🔧 Force recovery triggered by ${cmd.from}`);
                // Signal the runner to abort the current step and trigger recovery
                _forceRecoveryRequested = true;
                _forceRecoveryReason = cmd.content || 'Manual recovery triggered from Virtual Office';
                response = `🔄 Recovery initiated. Will abort current step and try a different approach.`;
                break;
            }

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
        status: 'completed', // agent-initiated messages are born complete
        createdAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
    });
    console.log(`📤 Sent ${type} to ${toAgent}: "${content.substring(0, 80)}..." (${msgRef.id})`);
    return msgRef.id;
}

/**
 * Proactively message the admin/user via the chat interface.
 * These messages appear as agent-initiated bubbles in the chat.
 * @param {string} content - The message text
 * @param {string} proactiveType - Label for the badge: 'completed', 'failed', 'suggestion', 'update'
 */
async function sendProactiveMessage(content, proactiveType = 'update') {
    return sendMessage('admin', content, 'chat', { proactiveType });
}

/* ─── Kanban Integration ──────────────────────────────── */

async function fetchNextTask() {
    const inProgressSnap = await db.collection(KANBAN_COLLECTION)
        .where('assignee', '==', AGENT_NAME)
        .where('status', '==', 'in-progress')
        .orderBy('createdAt', 'asc')
        .limit(20)
        .get();

    if (!inProgressSnap.empty) {
        const doc = inProgressSnap.docs.find((d) => !d.data().runnerBlocked);
        if (doc) {
            return { id: doc.id, ...doc.data() };
        }
    }

    const todoSnap = await db.collection(KANBAN_COLLECTION)
        .where('assignee', '==', AGENT_NAME)
        .where('status', '==', 'todo')
        .orderBy('createdAt', 'asc')
        .limit(20)
        .get();

    if (!todoSnap.empty) {
        const doc = todoSnap.docs.find((d) => !d.data().runnerBlocked);
        if (!doc) return null;
        await db.collection(KANBAN_COLLECTION).doc(doc.id).update({
            status: 'in-progress',
            runnerBlocked: FieldValue.delete(),
            runnerFailureAt: FieldValue.delete(),
            runnerFailureMessage: FieldValue.delete(),
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

async function markTaskFailed(taskId, failureMessage) {
    await db.collection(KANBAN_COLLECTION).doc(taskId).update({
        runnerBlocked: true,
        runnerFailureAt: FieldValue.serverTimestamp(),
        runnerFailureMessage: (failureMessage || 'Unknown runner failure').slice(0, 2000),
        updatedAt: FieldValue.serverTimestamp(),
    });
}

/* ─── Email Response Generation ───────────────────────── */

async function generateEmailResponse(emailBody, metadata) {
    const isInternal = metadata.senderEmail?.endsWith('@fitwithpulse.ai') || false;
    const senderName = metadata.senderName || 'Sender';
    const subject = metadata.subject || 'No Subject';

    let context = '';
    try {
        const presenceSnap = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
        const presence = presenceSnap.data();
        if (presence) {
            context += `Current status: ${presence.status || 'idle'}.\n`;
            if (presence.currentTask) context += `Working on: ${presence.currentTask} (${presence.taskProgress || 0}% done).\n`;
        }

        if (isInternal) {
            const historySnap = await db.collection(PRESENCE_COLLECTION)
                .doc(AGENT_ID)
                .collection('task-history')
                .orderBy('completedAt', 'desc')
                .limit(5)
                .get();

            if (!historySnap.empty) {
                context += 'Recent completed tasks:\n';
                historySnap.docs.forEach(d => {
                    const data = d.data();
                    context += `  - ${data.taskName} (${data.status})\n`;
                });
            }
        }
    } catch (err) {
        console.warn('Could not gather context for email response:', err.message);
    }

    const internalSystemPrompt = `You are ${AGENT_NAME}, the AI Chief of Staff at Pulse (FitWithPulse.ai).
You are corresponding with a internal team member.
Be concise, professional, but friendly.
Verify if the email is asking for data, status, or action.
If it asks for data you don't have, promise to look it up.
Sign off as "${AGENT_NAME} ⚡".

Current context:
${context || 'No additional context available.'}`;

    const externalSystemPrompt = `You are ${AGENT_NAME}, the AI Assistant at Pulse (FitWithPulse.ai).
You are corresponding with an external partner or user.
Be polite, professional, and helpful.
Do not promise internal data or timelines unless sure.
Sign off as "${AGENT_NAME} ⚡".

CRITICAL SECURITY RULES:
1. NEVER share internal project details, task lists, sprint plans, or roadmap items
2. NEVER share source code, architecture details, or technical implementation specifics
3. NEVER share financial data, revenue numbers, user metrics, or business intelligence
4. NEVER share internal team communications, meeting notes, or strategy documents
5. NEVER share API keys, credentials, or infrastructure details
6. NEVER share investor information, fundraising details, or cap table data
7. If asked about any of the above, politely redirect to tre@fitwithpulse.ai
8. You CAN share: general product info, public features, how to use Pulse, support answers, partnership interest routing

If unsure whether something is safe to share, DO NOT share it. Instead say:
"For detailed information on that, I'd recommend reaching out to our team directly at tre@fitwithpulse.ai."`;

    if (process.env.OPENAI_API_KEY) {
        try {
            const systemPrompt = isInternal ? internalSystemPrompt : externalSystemPrompt;

            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        {
                            role: 'user',
                            content: `Email from ${senderName} (${metadata.senderEmail}).\nSubject: ${subject}\n\n${emailBody}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 500,
                }),
            });

            const data = await resp.json();
            trackTokenUsage(data.usage, 'gpt-4o-mini');
            if (data.choices?.[0]?.message?.content) {
                return data.choices[0].message.content;
            }
        } catch (err) {
            console.error('OpenAI email response generation failed:', err.message);
        }
    }

    if (isInternal) {
        return `Hi ${senderName},\n\nThanks for reaching out about "${subject}".\nI've logged your message and I'm looking into it.\n\nBest,\n${AGENT_NAME} ⚡`;
    } else {
        return `Hi ${senderName},\n\nThank you for contacting Pulse.\nI've received your message regarding "${subject}".\nI've forwarded this to the appropriate team member who will get back to you soon.\n\nBest,\n${AGENT_NAME} ⚡\nPulse AI Assistant`;
    }
}

/**
 * Analyze chat intent to see if it should be upgraded to a task or command.
 */
async function analyzeChatIntent(content, senderName) {
    try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `You are ${AGENT_NAME}, the AI Chief of Staff at Pulse.
The user (${senderName}) sent a chat message. Analyze if they are asking you to DO something (Task/Command) or just chatting.

Output JSON ONLY:
{
  "type": "chat" | "task" | "command",
  "content": "extracted task/command content or original text",
  "response": "conversational response if type is chat"
}

- "task": If the user describes a unit of work (e.g. "Create a new page", "Fix the bug", "Analyze metrics").
- "command": If the user gives a direct system instruction (e.g. "Stop", "Status", "Pause", "Prioritize this").
- "chat": General conversation, questions, or greetings.

If "chat", generate a friendly, helpful, specialized response as Nora.
If "task" or "command", the "content" field should be the clean instruction.`
                    },
                    { role: 'user', content }
                ],
                temperature: 0.3,
                response_format: { type: "json_object" }
            }),
        });

        const data = await resp.json();
        const result = JSON.parse(data.choices[0].message.content);
        return result;

    } catch (err) {
        console.error('Failed to analyze chat intent:', err);
        return { type: 'chat', content, response: null };
    }
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

    var decomposePrompt = `You are a task decomposition agent. Break down tasks into 3-6 granular executable steps.
Each step should be a clear, specific action — not generic like "Analyze" or "Implement".
Return JSON only: { "steps": [{ "description": "...", "reasoning": "..." }] }

Task: ${task.name}
Description: ${task.description || 'No description'}
Project: ${task.project || 'Unknown'}
Notes: ${task.notes || 'None'}`;

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
                        { role: 'system', content: decomposePrompt },
                        { role: 'user', content: `Decompose this task into steps.` }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.3,
                }),
            });

            const data = await response.json();
            trackTokenUsage(data.usage, 'gpt-4o-mini');
            const parsed = JSON.parse(data.choices[0].message.content);
            return (parsed.steps || []).map((s, i) => ({
                id: `step-${i}`,
                description: s.description,
                status: 'pending',
                reasoning: s.reasoning || '',
            }));
        } catch (err) {
            console.error('AI decomposition failed:', err.message);
        }
    } else if (process.env.USE_OPENCLAW === 'true') {
        try {
            var clawResult = await new Promise((resolve, reject) => {
                var child = spawn(OPENCLAW_BIN, [
                    '--no-color', 'agent', '--local',
                    '--agent', OPENCLAW_AGENT_ID,
                    '--message', decomposePrompt,
                    '--timeout', '25',
                ], { cwd: process.cwd(), env: process.env });
                var stdout = '', stderr = '';
                var timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('timeout')); }, 30_000);
                child.stdout.on('data', (d) => { stdout += d.toString(); });
                child.stderr.on('data', (d) => { stderr += d.toString(); });
                child.on('error', (err) => { clearTimeout(timeout); reject(err); });
                child.on('close', (code) => {
                    clearTimeout(timeout);
                    if (code === 0) resolve(stdout.trim());
                    else reject(new Error(`exit ${code}: ${stderr.substring(0, 200)}`));
                });
            });
            // Try to extract JSON from the response
            var jsonMatch = clawResult.match(/\{[\s\S]*"steps"[\s\S]*\}/m);
            if (jsonMatch) {
                var parsed = JSON.parse(jsonMatch[0]);
                if (parsed.steps && parsed.steps.length > 0) {
                    return parsed.steps.map((s, i) => ({
                        id: `step-${i}`,
                        description: s.description || `Step ${i + 1}`,
                        status: 'pending',
                        reasoning: s.reasoning || '',
                    }));
                }
            }
        } catch (err) {
            console.error('OpenClaw decomposition failed:', err.message);
        }
    }

    return [
        { id: 'step-0', description: `Research and plan: ${task.name}`, status: 'pending', reasoning: 'Understanding the task scope and constraints' },
        { id: 'step-1', description: `Execute: ${task.name}`, status: 'pending', reasoning: 'Core implementation work' },
        { id: 'step-2', description: `Review and validate: ${task.name}`, status: 'pending', reasoning: 'Testing and quality checks' },
    ];
}

/* ─── Execute a step ──────────────────────────────────── */

/**
 * Get the current git status (changed files) in the project directory.
 */
function getGitChanges() {
    try {
        const status = execSync('git status --porcelain', {
            cwd: projectDir,
            encoding: 'utf-8',
            timeout: 10_000,
        }).trim();
        return status ? status.split('\n').map(l => l.trim()) : [];
    } catch {
        return [];
    }
}

/**
 * Get the latest git commit hash and message.
 */
function getLatestCommit() {
    try {
        return execSync('git log -1 --oneline', {
            cwd: projectDir,
            encoding: 'utf-8',
            timeout: 10_000,
        }).trim();
    } catch {
        return null;
    }
}

/**
 * Auto-commit any changes made during a step.
 */
function runOpenClawSmokeCheck(commandString = OPENCLAW_SMOKE_CMD) {
    const args = commandString.split(/\s+/).filter(Boolean);
    const spawnResult = spawnSync(OPENCLAW_BIN, args, {
        cwd: projectDir,
        timeout: 120_000,
        encoding: 'utf-8',
        maxBuffer: 5 * 1024 * 1024,
    });

    if (spawnResult.error) {
        throw new Error(`Smoke test failed to launch ${OPENCLAW_BIN}: ${spawnResult.error.message}`);
    }
    const trimmedStdout = (spawnResult.stdout || '').trim();
    const trimmedStderr = (spawnResult.stderr || '').trim();

    if (spawnResult.status !== 0) {
        throw new Error(`Smoke test command exited with ${spawnResult.status}: ${trimmedStderr || trimmedStdout}`);
    }

    return trimmedStdout || 'OpenClaw smoke test completed with no output.';
}

function autoCommitStep(stepDescription, taskName) {
    try {
        const changes = getGitChanges();
        if (changes.length === 0) return null;

        // Stage all changes
        execSync('git add -A', { cwd: projectDir, timeout: 10_000 });

        // Commit with a descriptive message
        const msg = `[${AGENT_ID}] ${stepDescription}\n\nTask: ${taskName}`;
        execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, {
            cwd: projectDir,
            encoding: 'utf-8',
            timeout: 30_000,
        });

        const commit = getLatestCommit();
        console.log(`   📝 Auto-committed: ${commit}`);
        return commit;
    } catch (err) {
        console.log(`   ⚠️ Auto-commit skipped: ${err.message.split('\n')[0]}`);
        return null;
    }
}

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

        // Snapshot git state before the step
        const changesBefore = getGitChanges();

        if (useOpenClaw) {
            if (OPENCLAW_SMOKE_TEST) {
                console.log('   🔎 Running OpenClaw smoke test command...');
                const smokeOutput = runOpenClawSmokeCheck(OPENCLAW_SMOKE_CMD);
                step.output = `[SMOKE] ${OPENCLAW_SMOKE_CMD}
${smokeOutput}`.substring(0, 2000);
            } else {
                // ─── Manifesto-aware, self-correcting execution ──
                // Refresh manifesto each step (other agents may have updated it)
                cachedManifesto = loadManifesto();

                const stepsContext = allSteps
                    .map((s, i) => `  ${i === stepIndex ? '→' : ' '} ${i + 1}. [${s.status}] ${s.description}`)
                    .join('\n');

                // Build the manifesto context block (only used on retries to save tokens)
                const getManifestoBlock = () => {
                    cachedManifesto = loadManifesto(); // Refresh on retry
                    if (!cachedManifesto) return '';
                    return [
                        ``,
                        `=== TEAM KNOWLEDGE (from Agent Manifesto) ===`,
                        cachedManifesto.env ? cachedManifesto.env.substring(0, 1500) : '',
                        cachedManifesto.lessons ? cachedManifesto.lessons.substring(0, 800) : '',
                        `=== END TEAM KNOWLEDGE ===`,
                        ``,
                    ].filter(Boolean).join('\n');
                };

                // Helper: build prompt for a given attempt
                const buildPrompt = async (attempt, previousOutput) => {
                    const base = [
                        `You are ${AGENT_NAME}, an AI engineer working on the Pulse Fitness project.`,
                        `Project directory: ${projectDir}`,
                        `TASK: "${task.name}"`,
                        task.description ? `Description: ${task.description}` : '',
                        task.notes ? `Notes: ${task.notes}` : '',
                        ``,
                        `All steps:`,
                        stepsContext,
                        ``,
                        `CURRENT STEP (${stepIndex + 1}/${allSteps.length}): ${step.description}`,
                    ];

                    // Only inject manifesto + correction context on retries (saves tokens on first attempt)
                    if (attempt > 0 && previousOutput) {
                        // Check if manifesto is enabled for this agent (toggle from Virtual Office)
                        let manifestoAllowed = true;
                        try {
                            const presDoc = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
                            if (presDoc.exists && presDoc.data()?.manifestoEnabled === false) {
                                manifestoAllowed = false;
                                console.log(`   📜 Manifesto disabled via toggle — skipping knowledge injection`);
                            }
                        } catch { /* default to allowed */ }

                        if (manifestoAllowed) {
                            base.push(``, getManifestoBlock());
                            // Track the injection in presence for monitoring
                            try {
                                await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).update({
                                    manifestoInjections: FieldValue.increment(1),
                                    lastManifestoInjection: new Date(),
                                });
                            } catch { /* non-critical */ }
                        }

                        base.push(
                            ``,
                            `⚠️ SELF-CORRECTION (attempt ${attempt + 1}/${MAX_SELF_CORRECTION_RETRIES + 1})`,
                            `Your previous attempt produced this output:`,
                            `"${previousOutput.substring(0, 500)}"`,
                            ``,
                            `The output contains failure signals. DO NOT just document the failure.`,
                            `Instead:`,
                            `1. Investigate WHY it failed — search the codebase (grep, find, cat files)`,
                            `2. Look at how existing working code solves similar problems`,
                            `3. Check .env.local, scripts/, src/api/ for existing configs and patterns`,
                            `4. Try an alternative approach to accomplish the goal`,
                            `5. If you truly cannot complete the step, explain exactly what's blocking you and what a human would need to do`,
                        );
                    }

                    // Inject available workflows so the agent knows about operational runbooks
                    try {
                        const workflowsDir = path.join(projectDir, '.agent', 'workflows');
                        const workflowFiles = require('fs').readdirSync(workflowsDir)
                            .filter(f => f.endsWith('.md'));
                        if (workflowFiles.length > 0) {
                            base.push(
                                ``,
                                `📋 AVAILABLE RUNBOOKS (read these BEFORE trying unfamiliar operations):`,
                                ...workflowFiles.map(f => {
                                    const content = require('fs').readFileSync(path.join(workflowsDir, f), 'utf-8');
                                    const descMatch = content.match(/description:\s*(.+)/);
                                    const desc = descMatch ? descMatch[1].trim() : '';
                                    return `  - ${workflowsDir}/${f}${desc ? ` — ${desc}` : ''}`;
                                }),
                                `If your current step involves any of these topics, READ the relevant workflow file FIRST.`,
                            );
                        }
                    } catch { /* no workflows dir, skip */ }

                    base.push(
                        ``,
                        `Instructions:`,
                        `- Complete ONLY this step.`,
                        `- Create or modify files as needed in the project directory.`,
                        `- Be thorough — write real, production-quality code.`,
                        `- NEVER just document a failure. Investigate and fix it.`,
                        `- When done, list the files you created or modified.`,
                    );

                    return base.filter(Boolean).join('\n');
                };

                // Helper: run OpenClaw with a given prompt
                const invokeOpenClaw = (promptText, onProgress) => new Promise((resolve, reject) => {
                    const clawArgs = [
                        '--no-color', 'agent', '--local', '--json',
                        '--agent', OPENCLAW_AGENT_ID,
                        '--message', promptText,
                        '--timeout', '600',
                    ];
                    const child = spawn(OPENCLAW_BIN, clawArgs, { cwd: projectDir, env: process.env });
                    let stdout = '';
                    let stderr = '';
                    let stderrLineBuf = '';
                    let timedOut = false;
                    const maxLen = 10 * 1024 * 1024;

                    const timeout = setTimeout(() => {
                        timedOut = true;
                        child.kill('SIGTERM');
                        setTimeout(() => child.kill('SIGKILL'), 5000);
                    }, 600_000);

                    // Tier 3: Inactivity watchdog — kill if no stderr activity for 120s
                    // Also checks for manual force-recovery signal
                    let lastStderrActivity = Date.now();
                    const inactivityCheck = setInterval(() => {
                        // Manual force-recovery
                        if (_forceRecoveryRequested) {
                            clearInterval(inactivityCheck);
                            clearTimeout(timeout);
                            const reason = _forceRecoveryReason || 'manual recovery';
                            _forceRecoveryRequested = false;
                            _forceRecoveryReason = '';
                            console.log(`   🔧 Force recovery: killing current process (${reason})`);
                            child.kill('SIGTERM');
                            setTimeout(() => child.kill('SIGKILL'), 5000);
                            reject(new Error(`Force recovery: ${reason}`));
                            return;
                        }
                        if (Date.now() - lastStderrActivity > STEP_INACTIVITY_TIMEOUT_MS) {
                            clearInterval(inactivityCheck);
                            clearTimeout(timeout);
                            console.log(`   ⏰ Inactivity watchdog: No activity for ${STEP_INACTIVITY_TIMEOUT_MS / 1000}s — killing process`);
                            child.kill('SIGTERM');
                            setTimeout(() => child.kill('SIGKILL'), 5000);
                            reject(new Error(`OpenClaw stalled: no activity for ${STEP_INACTIVITY_TIMEOUT_MS / 1000}s`));
                        }
                    }, 5_000);

                    child.stdout.on('data', (chunk) => {
                        stdout += chunk.toString();
                        if (stdout.length > maxLen) { clearTimeout(timeout); child.kill('SIGKILL'); reject(new Error('OpenClaw output exceeded 10MB')); }
                    });
                    child.stderr.on('data', (chunk) => {
                        var text = chunk.toString();
                        stderr += text;
                        lastStderrActivity = Date.now();
                        if (stderr.length > maxLen) { clearTimeout(timeout); child.kill('SIGKILL'); reject(new Error('OpenClaw error output exceeded 10MB')); }

                        // Parse stderr lines for progress activities
                        if (onProgress) {
                            stderrLineBuf += text;
                            var lines = stderrLineBuf.split('\n');
                            stderrLineBuf = lines.pop() || ''; // keep incomplete last line in buffer
                            for (var line of lines) {
                                var activity = parseStderrLine(line);
                                if (activity) {
                                    onProgress(activity);
                                }
                            }
                        }
                    });
                    child.on('error', (err) => { clearInterval(inactivityCheck); clearTimeout(timeout); reject(new Error(`Failed to launch ${OPENCLAW_BIN}: ${err.message}`)); });
                    child.on('close', (code) => {
                        clearInterval(inactivityCheck);
                        clearTimeout(timeout);
                        // Flush remaining stderr buffer
                        if (onProgress && stderrLineBuf.trim()) {
                            var activity = parseStderrLine(stderrLineBuf);
                            if (activity) onProgress(activity);
                        }
                        if (timedOut) { reject(new Error('OpenClaw timed out after 600s')); return; }
                        if (code !== 0) { reject(new Error(`OpenClaw failed (exit ${code}): ${(stderr || stdout || '').trim()}`)); return; }
                        resolve({ stdout, stderr });
                    });
                });

                // Helper: parse OpenClaw output
                const parseOutput = (raw) => {
                    let outputText = raw;
                    if (raw) {
                        try {
                            const parsed = JSON.parse(raw);
                            const payloadText = (parsed?.payloads || []).map(p => p?.text).filter(Boolean).join('\n\n');
                            if (payloadText) outputText = payloadText;
                        } catch { /* keep raw */ }
                    }
                    return outputText.substring(0, 2000);
                };

                // ─── Self-correction retry loop ──────────────
                let lastOutput = '';
                for (let attempt = 0; attempt <= MAX_SELF_CORRECTION_RETRIES; attempt++) {
                    if (attempt > 0) {
                        console.log(`   🔄 Self-correction retry ${attempt}/${MAX_SELF_CORRECTION_RETRIES}...`);
                        step.status = 'in-progress';
                        step.reasoning = `Self-correction attempt ${attempt + 1}: re-investigating after previous failure`;
                        await reportSteps(allSteps, stepIndex, progress);
                    }

                    const prompt = await buildPrompt(attempt, lastOutput);
                    step.subSteps = [];
                    step.lastActivityAt = new Date().toISOString();
                    const progressCb = createProgressCallback(step, allSteps, stepIndex, progress);
                    const result = await invokeOpenClaw(prompt, progressCb);
                    const outputText = parseOutput((result.stdout || '').trim());
                    step.output = outputText;
                    lastOutput = outputText;

                    // Check for failure signals
                    const FAILURE_SIGNALS = [
                        /\bfailed\b/i, /\berror\b/i, /\bmissing\b/i,
                        /\bcouldn'?t\b/i, /\bblocked\b/i, /\bunable to\b/i,
                        /\bnot found\b/i, /\bnot available\b/i,
                        /\bcrash/i, /\bexception\b/i, /\btimed?\s*out\b/i,
                        /\bdenied\b/i, /\brefused\b/i,
                    ];
                    const FALSE_POSITIVE_GUARDS = [
                        /no\s+error/i, /without\s+error/i, /error.?free/i,
                        /0\s+error/i, /fixed.*error/i, /resolved.*error/i,
                        /error.*resolved/i, /error.*fixed/i,
                    ];
                    const hitSignals = FAILURE_SIGNALS.filter(rx => rx.test(outputText));
                    const isFalsePositive = FALSE_POSITIVE_GUARDS.some(rx => rx.test(outputText));

                    if (hitSignals.length === 0 || isFalsePositive) {
                        // Clean success — no more retries needed
                        console.log(`   ✅ Step output looks clean (attempt ${attempt + 1})`);
                        break;
                    }

                    if (attempt === MAX_SELF_CORRECTION_RETRIES) {
                        // Exhausted retries — mark as completed-with-issues
                        step.verificationFlag = hitSignals.map(rx => rx.source).join(', ');
                        console.log(`   ⚠️  Exhausted ${MAX_SELF_CORRECTION_RETRIES} retries. Failure signals remain: ${step.verificationFlag}`);
                        // Append lesson learned to manifesto
                        appendLessonLearned(
                            `Step "${step.description}" still had issues after ${MAX_SELF_CORRECTION_RETRIES} retries. ` +
                            `Output signals: ${step.verificationFlag}. Last output: "${outputText.substring(0, 120)}..."`
                        );
                    } else {
                        console.log(`   ⚠️  Failure signals detected (attempt ${attempt + 1}): ${hitSignals.map(rx => rx.source).join(', ')}. Will retry...`);
                    }
                }

                // Capture what files changed
                const changesAfter = getGitChanges();
                const newChanges = changesAfter.filter(c => !changesBefore.includes(c));
                if (newChanges.length > 0) {
                    step.filesChanged = newChanges;
                    console.log(`   📁 Files changed: ${newChanges.join(', ')}`);
                }

                // Auto-commit the changes
                const commit = autoCommitStep(step.description, task.name);
                if (commit) {
                    step.commitHash = commit;
                }
            }
        } else {
            // Simulation mode
            const waitMs = 2000 + Math.random() * 5000;
            await new Promise(r => setTimeout(r, waitMs));
            step.output = `Completed: ${step.description}`;
        }

        // ─── Set final step status ─────────────────────────────
        // If the self-correction retry loop set a verificationFlag,
        // the step has unresolved issues. Otherwise it's clean.
        if (step.verificationFlag) {
            step.status = 'completed-with-issues';
        } else {
            step.status = 'completed';
        }
        step.completedAt = new Date();
        step.durationMs = Date.now() - startTime;

        const newCompletedCount = allSteps.filter(s => s.status === 'completed' || s.status === 'completed-with-issues').length;
        const newProgress = Math.round((newCompletedCount / allSteps.length) * 100);
        await reportSteps(allSteps, stepIndex, newProgress);

        await processCommands();

        return true;
    } catch (err) {
        console.log(`   ❌ Step crashed: ${err.message.substring(0, 120)}`);

        // ─── Tier 2: Rewrite & Retry from a different angle ─────
        if (process.env.USE_OPENCLAW === 'true') {
            for (let rewriteAttempt = 0; rewriteAttempt < MAX_STEP_REWRITE_ATTEMPTS; rewriteAttempt++) {
                console.log(`   🔄 Rewrite attempt ${rewriteAttempt + 1}/${MAX_STEP_REWRITE_ATTEMPTS}: Trying a different approach...`);
                step.status = 'in-progress';
                step.reasoning = `Recovery attempt ${rewriteAttempt + 1}: The previous approach failed with "${err.message.substring(0, 100)}". Trying a different angle.`;
                step.subSteps = [{ action: '🔄 Recovery', detail: `Rewrite attempt ${rewriteAttempt + 1}`, ts: new Date().toISOString() }];
                step.lastActivityAt = new Date().toISOString();
                await reportSteps(allSteps, stepIndex, -1, {
                    notes: `🔄 Recovering step ${stepIndex + 1} — rewrite attempt ${rewriteAttempt + 1}`,
                });

                try {
                    const recoveryPrompt = [
                        `RECOVERY MODE — A previous attempt at this task FAILED. You must try a DIFFERENT approach.`,
                        ``,
                        `## Original task:`,
                        `${step.description}`,
                        ``,
                        `## What went wrong:`,
                        `${err.message.substring(0, 500)}`,
                        ``,
                        `## Instructions:`,
                        `- Do NOT repeat the same approach that failed`,
                        `- Try an alternative strategy or workaround`,
                        `- If the original approach required a missing tool/resource, find another way`,
                        `- If the task is genuinely impossible, explain why clearly`,
                        `- Keep your response focused and concise`,
                    ].join('\n');

                    const progressCb = createProgressCallback(step, allSteps, stepIndex, -1);
                    const result = await invokeOpenClaw(recoveryPrompt, progressCb);
                    let outputText = (result.stdout || '').trim();
                    if (outputText) {
                        try {
                            const parsed = JSON.parse(outputText);
                            const payloadText = (parsed?.payloads || []).map(p => p?.text).filter(Boolean).join('\n\n');
                            if (payloadText) outputText = payloadText;
                        } catch { /* keep raw */ }
                    }
                    step.output = outputText.substring(0, 2000);

                    // Check if recovery was genuinely successful
                    const impossibleSignals = [/genuinely impossible/i, /cannot be done/i, /no way to/i, /not possible/i];
                    const isImpossible = impossibleSignals.some(rx => rx.test(step.output));

                    if (isImpossible) {
                        console.log(`   ⚠️ Recovery reported task as impossible`);
                        step.verificationFlag = 'impossible';
                        step.status = 'completed-with-issues';
                    } else {
                        console.log(`   ✅ Recovery succeeded!`);
                        step.status = 'completed';
                    }
                    step.completedAt = new Date();
                    step.durationMs = Date.now() - startTime;

                    const newCompletedCount = allSteps.filter(s => s.status === 'completed' || s.status === 'completed-with-issues').length;
                    const newProgress = Math.round((newCompletedCount / allSteps.length) * 100);
                    await reportSteps(allSteps, stepIndex, newProgress);
                    return true; // Recovery worked!
                } catch (rewriteErr) {
                    console.log(`   ❌ Rewrite attempt ${rewriteAttempt + 1} also failed: ${rewriteErr.message.substring(0, 80)}`);
                    appendLessonLearned(
                        `Step "${step.description}" failed even after rewrite. Original error: "${err.message.substring(0, 100)}". ` +
                        `Rewrite error: "${rewriteErr.message.substring(0, 100)}"`
                    );
                }
            }
        }

        // All recovery attempts exhausted
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
    if (process.env.USE_OPENCLAW === 'true') {
        console.log(`   Smoke test: ${OPENCLAW_SMOKE_TEST ? 'ON' : 'off'}`);
    }
    console.log(`   Messaging: ENABLED`);
    console.log(`   Auth: Firebase Admin SDK (service account)`);
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
                for (let w = 0; w < 6; w++) {
                    await new Promise(r => setTimeout(r, 5_000));
                    if (commandQueue.length > 0) {
                        await processCommands();
                    }
                }
                continue;
            }

            console.log(`📋 Found task: ${task.name} (${task.id})`);

            console.log('🧠 Breaking down task into steps...');
            const steps = await decomposeTask(task);
            console.log(`   → ${steps.length} steps planned`);

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

            let allPassed = true;
            let consecutiveFailures = 0;
            let lastFailureContext = '';

            for (let i = 0; i < steps.length; i++) {
                console.log(`\n⚡ Step ${i + 1}/${steps.length}: ${steps[i].description}`);

                // If previous step failed, inject failure context so agent can adapt
                if (lastFailureContext && steps[i].status !== 'failed') {
                    steps[i].reasoning = (steps[i].reasoning || '') +
                        `\n⚠️ Note: A previous step failed with: ${lastFailureContext}. Adapt your approach if needed.`;
                }

                const success = await executeStep(steps[i], task, i, steps);

                if (!success) {
                    consecutiveFailures++;
                    lastFailureContext = (steps[i].output || '').substring(0, 200);
                    console.log(`❌ Step ${i + 1} failed (${consecutiveFailures} consecutive).`);

                    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                        console.log(`🛑 ${MAX_CONSECUTIVE_FAILURES} consecutive failures — stopping task.`);
                        allPassed = false;
                        break;
                    }

                    console.log(`   ⏩ Skipping to next step...`);
                    allPassed = false;
                    // Don't break — continue to next step
                    if (i + 1 < steps.length) {
                        steps[i + 1].status = 'in-progress';
                        steps[i + 1].startedAt = new Date();
                    }
                    continue;
                }

                // Reset consecutive failures on success
                consecutiveFailures = 0;
                lastFailureContext = '';
                console.log(`✅ Step ${i + 1} completed${steps[i].durationMs ? ` (${formatMs(steps[i].durationMs)})` : ''}`);

                if (i + 1 < steps.length) {
                    steps[i + 1].status = 'in-progress';
                    steps[i + 1].startedAt = new Date();
                }
            }

            const hasIssues = steps.some(s => s.status === 'completed-with-issues');
            const finalStatus = hasIssues ? 'completed-with-issues' : 'completed';

            if (allPassed) {
                console.log(hasIssues
                    ? `\n⚠️  Task completed with issues: ${task.name}`
                    : `\n🎉 Task completed: ${task.name}`);
                await saveTaskHistory(task.name, task.id, steps, finalStatus, taskStartTime);
                await markTaskDone(task.id);
                await setStatus('idle', {
                    currentTask: '',
                    currentTaskId: '',
                    notes: hasIssues
                        ? `⚠️ Completed with issues: ${task.name}`
                        : `✅ Completed: ${task.name}`,
                    taskProgress: 100,
                });

                // Proactively report completion to the chat
                const durationStr = formatMs(Date.now() - taskStartTime.getTime());
                const stepsCompleted = steps.filter(s => s.status === 'completed' || s.status === 'completed-with-issues').length;
                const isSimulation = process.env.USE_OPENCLAW !== 'true';
                const stepSummary = steps
                    .filter(s => s.status === 'completed')
                    .map((s, i) => `${i + 1}. ${s.description}`)
                    .join('\n');

                if (isSimulation) {
                    await sendProactiveMessage(
                        `📋 Task plan completed: "${task.name}"\n\n` +
                        `⚠️ SIMULATION MODE — no actual files were created.\n` +
                        `Generated a ${stepsCompleted}-step execution plan in ${durationStr}.\n\n` +
                        `Planned steps:\n${stepSummary}\n\n` +
                        `To execute for real, run the agent on the Mac Mini with USE_OPENCLAW=true.`,
                        'completed'
                    );
                } else {
                    // Collect git commits from all steps
                    const commits = steps
                        .filter(s => s.commitHash)
                        .map(s => `  • ${s.commitHash}`)
                        .join('\n');

                    // Collect all files changed across steps
                    const allFiles = [...new Set(
                        steps.flatMap(s => s.filesChanged || [])
                    )];
                    const filesList = allFiles.length > 0
                        ? allFiles.map(f => `  • ${f}`).join('\n')
                        : '  (no file changes detected)';

                    // Try to push commits
                    let pushStatus = '';
                    if (commits) {
                        try {
                            execSync('git push', { cwd: projectDir, timeout: 30_000 });
                            pushStatus = '\n🚀 Changes pushed to remote.';
                        } catch {
                            pushStatus = '\n⚠️ Auto-push failed — please run `git push` manually.';
                        }
                    }

                    await sendProactiveMessage(
                        `✅ Task completed: "${task.name}"\n\n` +
                        `Finished ${stepsCompleted} steps in ${durationStr}.\n\n` +
                        `Steps completed:\n${stepSummary}\n\n` +
                        `📦 Deliverables:\n\n` +
                        `Files changed:\n${filesList}\n\n` +
                        (commits ? `Git commits:\n${commits}\n` : '') +
                        pushStatus +
                        `\n\nReady for the next task!`,
                        'completed'
                    );
                }
            } else {
                await saveTaskHistory(task.name, task.id, steps, 'failed', taskStartTime);

                // Proactively report failure to the chat
                const failedStep = steps.find(s => s.status === 'failed');
                const failedIndex = steps.indexOf(failedStep);
                await markTaskFailed(task.id, failedStep?.output || 'Unknown error');
                await sendProactiveMessage(
                    `❌ Task failed: "${task.name}"\n\n` +
                    `Failed at step ${failedIndex + 1}/${steps.length}: ${failedStep?.description}\n` +
                    `Error: ${failedStep?.output || 'Unknown error'}\n\n` +
                    `This task has been blocked from auto-retry to prevent loops.\n` +
                    `Would you like me to retry this task or skip it?`,
                    'failed'
                );
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
