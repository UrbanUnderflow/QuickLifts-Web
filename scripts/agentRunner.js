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
// All known assignee name variants this agent might be assigned as.
// Handles mismatch between 'Nora' vs 'Nora ⚡️' in kanban tasks.
const AGENT_NAME_VARIANTS = [
    AGENT_NAME,
    `${AGENT_NAME} ${AGENT_EMOJI}`,
    AGENT_NAME.charAt(0).toUpperCase() + AGENT_NAME.slice(1),  // Title-case variant
].filter((v, i, a) => a.indexOf(v) === i);  // dedupe
const HEARTBEAT_MS = parseInt(process.env.HEARTBEAT_MS || '30000', 10);

// Ensure SUDO_ASKPASS is always available for child processes (OpenClaw, installWithTelemetry, etc.)
if (!process.env.SUDO_ASKPASS) {
    const askpassPath = path.join(require('os').homedir(), '.openclaw/bin/openclaw-askpass');
    if (require('fs').existsSync(askpassPath)) {
        process.env.SUDO_ASKPASS = askpassPath;
        console.log(`🔑 SUDO_ASKPASS set to ${askpassPath}`);
    }
}
const PRESENCE_COLLECTION = 'agent-presence';
const KANBAN_COLLECTION = 'kanbanTasks';
const COMMANDS_COLLECTION = 'agent-commands';
const HISTORY_SUBCOLLECTION = 'task-history';
const TIMELINE_COLLECTION = 'progress-timeline';
const SNAPSHOT_COLLECTION = 'progress-snapshots';
const NUDGE_COLLECTION = 'progress-timeline';  // nudge entries live in the same feed
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || ({ 'nora': 'main', 'scout': 'scout', 'solara': 'solara', 'sage': 'sage' }[AGENT_ID] || 'main');

// ── Complexity-based model routing ──
// Maps complexity scores (1-5) to OpenClaw agent config tiers.
// Each agent has 3 configs: <id>-light, <id>-med, <id> (base = heaviest)
//   light → gpt-4o-mini / claude-haiku-3.5  (trivial: config tweaks, parsing, simple edits)
//   med   → gpt-4o / claude-sonnet-4.0      (standard: typical feature work, bug fixes)
//   heavy → gpt-5.1-codex / claude-sonnet-4.5 (complex: architecture, multi-file refactors)
const MODEL_TIERS = {
    light: `${OPENCLAW_AGENT_ID}-light`,   // cheapest — trivial edits, config tweaks
    med: `${OPENCLAW_AGENT_ID}-med`,     // mid-range — standard dev work
    heavy: OPENCLAW_AGENT_ID,              // base agent is the powerhouse
};

function getModelTier(complexity) {
    if (typeof complexity !== 'number' || complexity <= 0) return 'med';
    if (complexity <= 2) return 'light';
    if (complexity <= 4) return 'med';
    return 'heavy';
}

function getAgentIdForTier(tier) {
    return MODEL_TIERS[tier] || MODEL_TIERS.med;
}
const OPENCLAW_SMOKE_TEST = process.env.OPENCLAW_SMOKE_TEST === 'true';
const OPENCLAW_SMOKE_CMD = process.env.OPENCLAW_SMOKE_CMD || 'status --json';
const OPENCLAW_MODEL_SYNC_MS = parseInt(process.env.OPENCLAW_MODEL_SYNC_MS || '60000', 10); // Keep presence model accurate after OpenClaw config changes
const MAX_FOLLOW_UP_DEPTH = parseInt(process.env.MAX_FOLLOW_UP_DEPTH || '5', 10); // 5 back-and-forths max keeps conversation alive
const MAX_FOLLOW_UP_DEPTH_EXEC = parseInt(process.env.MAX_FOLLOW_UP_DEPTH_EXEC || '1', 10); // Execution mode should converge quickly
const ENABLE_ORGANIC_FOLLOW_UPS = process.env.ENABLE_ORGANIC_FOLLOW_UPS === 'true'; // Off by default; only explicit @mentions continue threads
const MAX_SELF_CORRECTION_RETRIES = 2; // Retry attempts when step output contains failure signals
const STEP_INACTIVITY_TIMEOUT_MS = parseInt(process.env.STEP_INACTIVITY_TIMEOUT_MS || '300000', 10); // Kill step if no stdout/stderr activity for 5m
const MAX_STEP_REWRITE_ATTEMPTS = 1; // Rewrite-from-different-angle attempts on crash/timeout
const MAX_CONSECUTIVE_FAILURES = 2; // Stop task after this many steps fail in a row
const VALIDATION_MODEL = process.env.VALIDATION_MODEL || 'gpt-4o-mini'; // Cheap model for post-task validation
const ENABLE_TASK_VALIDATION = process.env.ENABLE_TASK_VALIDATION !== 'false'; // Disable with ENABLE_TASK_VALIDATION=false
const ENABLE_SOUL_EVOLUTION = process.env.ENABLE_SOUL_EVOLUTION !== 'false'; // Soul self-improvement loop — disable with ENABLE_SOUL_EVOLUTION=false
const SOUL_EVOLUTION_MODEL = process.env.SOUL_EVOLUTION_MODEL || 'gpt-4o-mini'; // Cheap model for post-task reflection
const MAX_SOUL_LEARNINGS = parseInt(process.env.MAX_SOUL_LEARNINGS || '10', 10); // Max evolved learnings before rotating oldest out
const SOUL_EVOLUTION_MIN_COMPLEXITY = parseInt(process.env.SOUL_EVOLUTION_MIN_COMPLEXITY || '2', 10); // Min task complexity to trigger reflection
const NO_ARTIFACT_LOOP_WINDOW_MS = parseInt(process.env.NO_ARTIFACT_LOOP_WINDOW_MS || String(45 * 60 * 1000), 10); // Look back 45m for repeat no-artifact loops
const NO_ARTIFACT_LOOP_HISTORY_LIMIT = parseInt(process.env.NO_ARTIFACT_LOOP_HISTORY_LIMIT || '40', 10);
const GROUP_CHAT_SYSTEM_PROMPT_BUDGET_CHARS = parseInt(process.env.GROUP_CHAT_SYSTEM_PROMPT_BUDGET_CHARS || '5600', 10);
const GROUP_CHAT_USER_PROMPT_BUDGET_CHARS = parseInt(process.env.GROUP_CHAT_USER_PROMPT_BUDGET_CHARS || '1800', 10);
const GROUP_CHAT_CONTEXT_BUDGET_CHARS = parseInt(process.env.GROUP_CHAT_CONTEXT_BUDGET_CHARS || '1600', 10);
const GROUP_CHAT_RECENT_FULL_COUNT = parseInt(process.env.GROUP_CHAT_RECENT_FULL_COUNT || '2', 10);
const GROUP_CHAT_RESPONSE_SNIPPET_CHARS = parseInt(process.env.GROUP_CHAT_RESPONSE_SNIPPET_CHARS || '320', 10);

/* ─── Token Usage Tracking ─────────────────────────────── */
var sessionTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
var taskTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
var sessionTokensByModel = {};
var taskTokensByModel = {};
// If OpenClaw is enabled, we'll sync the actual configured model from OpenClaw at runtime.
var currentModel = process.env.USE_OPENCLAW === 'true' ? 'openclaw' : 'gpt-4o';
var currentModelProvider = '';
var currentModelRaw = '';
var lastOpenClawModelSyncAt = 0;
var openClawModelSyncInFlight = null;

// Rough token estimator for OpenClaw calls (no usage object returned)
// Uses ~4 chars per token heuristic (GPT tokenizer average)
function estimateTokens(promptText, outputText) {
    var promptTokens = Math.ceil((promptText || '').length / 4);
    var completionTokens = Math.ceil((outputText || '').length / 4);
    return {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
        estimated: true,
    };
}

function sanitizeModelField(model) {
    var safe = String(model || 'unknown').trim().toLowerCase();
    if (!safe) return 'unknown';
    safe = safe.replace(/^openai\//, '').replace(/^anthropic\//, '');
    safe = safe.replace(/[^a-z0-9._-]+/g, '_').replace(/_+/g, '_');
    return safe || 'unknown';
}

function toNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function trackTokenUsage(usage, model) {
    if (!usage) return;
    var prompt = toNumber(usage.prompt_tokens);
    var completion = toNumber(usage.completion_tokens);
    var total = usage.total_tokens || (prompt + completion);
    var safeModel = sanitizeModelField(model || 'unknown');
    var currentModelRecord = sessionTokensByModel[safeModel] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
    var currentTaskRecord = taskTokensByModel[safeModel] || { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };

    if (!model) model = safeModel;
    if (model === 'unknown') model = safeModel;

    // Session counters (in-memory, reset on restart)
    sessionTokens.promptTokens += prompt;
    sessionTokens.completionTokens += completion;
    sessionTokens.totalTokens += total;
    sessionTokens.callCount += 1;

    // Per-task counters (reset each task)
    taskTokens.promptTokens += prompt;
    taskTokens.completionTokens += completion;
    taskTokens.totalTokens += total;
    taskTokens.callCount += 1;

    currentModelRecord.promptTokens += prompt;
    currentModelRecord.completionTokens += completion;
    currentModelRecord.totalTokens += total;
    currentModelRecord.callCount += 1;
    sessionTokensByModel[safeModel] = currentModelRecord;

    currentTaskRecord.promptTokens += prompt;
    currentTaskRecord.completionTokens += completion;
    currentTaskRecord.totalTokens += total;
    currentTaskRecord.callCount += 1;
    taskTokensByModel[safeModel] = currentTaskRecord;

    if (model) currentModel = model;

    var isEstimate = usage.estimated ? ' (est)' : '';
    console.log(`   📊 Tokens: +${total.toLocaleString()}${isEstimate} | task: ${taskTokens.totalTokens.toLocaleString()} | session: ${sessionTokens.totalTokens.toLocaleString()} | calls: ${sessionTokens.callCount}`);

    // Persist to Firestore — cumulative + daily counters (survives restarts)
    var today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    try {
        // Fire-and-forget — don't await to avoid blocking the pipeline
        db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).set({
            tokenUsage: { ...sessionTokens },
            tokenUsageTask: { ...taskTokens },
            tokenUsageByModel: sessionTokensByModel,
            tokenUsageTaskByModel: taskTokensByModel,
            tokenUsageCumulative: {
                promptTokens: FieldValue.increment(prompt),
                completionTokens: FieldValue.increment(completion),
                totalTokens: FieldValue.increment(total),
                callCount: FieldValue.increment(1),
            },
            [`tokenUsageDaily.${today}`]: {
                promptTokens: FieldValue.increment(prompt),
                completionTokens: FieldValue.increment(completion),
                totalTokens: FieldValue.increment(total),
                callCount: FieldValue.increment(1),
            },
            [`tokenUsageCumulativeByModel.${safeModel}.promptTokens`]: FieldValue.increment(prompt),
            [`tokenUsageCumulativeByModel.${safeModel}.completionTokens`]: FieldValue.increment(completion),
            [`tokenUsageCumulativeByModel.${safeModel}.totalTokens`]: FieldValue.increment(total),
            [`tokenUsageCumulativeByModel.${safeModel}.callCount`]: FieldValue.increment(1),
            [`tokenUsageDailyByModel.${today}.${safeModel}.promptTokens`]: FieldValue.increment(prompt),
            [`tokenUsageDailyByModel.${today}.${safeModel}.completionTokens`]: FieldValue.increment(completion),
            [`tokenUsageDailyByModel.${today}.${safeModel}.totalTokens`]: FieldValue.increment(total),
            [`tokenUsageDailyByModel.${today}.${safeModel}.callCount`]: FieldValue.increment(1),
            lastTokenUpdate: FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => { }); // Swallow errors — non-critical
    } catch { /* non-critical */ }
}

function resetTaskTokens() {
    taskTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0, callCount: 0 };
    taskTokensByModel = {};
}

/* ─── Agent Manifesto (shared institutional knowledge) ── */

const projectDir = process.env.PROJECT_DIR || process.cwd();
const LEAD_SOURCE_OF_TRUTH_REL_PATH = 'docs/partnership/lead-source-of-truth.md';
const LEAD_SOURCE_OF_TRUTH_PATH = path.join(projectDir, LEAD_SOURCE_OF_TRUTH_REL_PATH);

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

/* ─── Agent Soul (experiential identity) ──────────────── */

function loadSoul() {
    // Try agent-specific soul file first
    const soulPath = path.join(projectDir, 'docs', 'agents', AGENT_ID, 'soul.md');
    try {
        if (fs.existsSync(soulPath)) {
            const content = fs.readFileSync(soulPath, 'utf-8');
            // Extract key sections for targeted injection
            const identitySection = content.match(/## Who I Am[\s\S]*?(?=## My Beliefs|$)/)?.[0] || '';
            const beliefsSection = content.match(/## My Beliefs[\s\S]*?(?=## What I Refuse|$)/)?.[0] || '';
            const antiPatternsSection = content.match(/## What I Refuse To Do[\s\S]*?(?=## My Productive Flaw|$)/)?.[0] || '';
            const flawSection = content.match(/## My Productive Flaw[\s\S]*?(?=## How I Think|$)/)?.[0] || '';
            const thinkingSection = content.match(/## How I Think[\s\S]*?(?=## Evolved Learnings|$)/)?.[0] || '';
            const evolvedSection = content.match(/## Evolved Learnings[\s\S]*$/)?.[0] || '';
            console.log(`🧬 Soul loaded for ${AGENT_ID} (${content.length} chars${evolvedSection ? ', has evolved learnings' : ''})`);
            return {
                full: content,
                identity: identitySection.trim(),
                beliefs: beliefsSection.trim(),
                antiPatterns: antiPatternsSection.trim(),
                flaw: flawSection.trim(),
                thinking: thinkingSection.trim(),
                evolved: evolvedSection.trim(),
            };
        } else {
            console.log(`🧬 No soul file found at ${soulPath} — using fallback identity`);
        }
    } catch (err) {
        console.log(`🧬 Could not load soul: ${err.message}`);
    }
    return null;
}

/**
 * Append a new evolved learning to the agent's soul file.
 * Maintains a capped `## Evolved Learnings` section at the bottom of the soul.
 * Oldest entries rotate out when the cap is reached.
 */
function appendSoulLearning(learning) {
    const soulPath = path.join(projectDir, 'docs', 'agents', AGENT_ID, 'soul.md');
    try {
        if (!fs.existsSync(soulPath)) {
            console.log(`🧬 Cannot append learning — no soul file at ${soulPath}`);
            return false;
        }
        let content = fs.readFileSync(soulPath, 'utf-8');
        const date = new Date().toISOString().split('T')[0];
        const entry = `- **[${date}]** ${learning}`;

        // Check if Evolved Learnings section exists
        const evolvedHeader = '## Evolved Learnings';
        if (content.includes(evolvedHeader)) {
            // Extract existing entries
            const sectionMatch = content.match(/## Evolved Learnings\n\n([\s\S]*?)$/);
            if (sectionMatch) {
                const existingBlock = sectionMatch[1].trim();
                const existingEntries = existingBlock
                    .split('\n')
                    .filter(l => l.startsWith('- '));

                // Add new entry
                existingEntries.push(entry);

                // Rotate oldest if over cap
                while (existingEntries.length > MAX_SOUL_LEARNINGS) {
                    existingEntries.shift();
                }

                // Replace the section
                const newSection = `${evolvedHeader}\n\n${existingEntries.join('\n')}\n`;
                content = content.replace(
                    /## Evolved Learnings\n\n[\s\S]*$/,
                    newSection
                );
            }
        } else {
            // Create the section at the bottom
            content = content.trimEnd() + `\n\n${evolvedHeader}\n\n${entry}\n`;
        }

        fs.writeFileSync(soulPath, content, 'utf-8');
        console.log(`🧬 Soul evolved: ${learning.substring(0, 80)}...`);

        // Refresh the cached soul so the next step picks up the change
        cachedSoul = loadSoul();
        return true;
    } catch (err) {
        console.log(`🧬 Could not evolve soul: ${err.message}`);
        return false;
    }
}

/**
 * Post-task soul reflection: uses AI to generate an experiential learning
 * from the task outcome, then appends it to the soul file.
 * Only runs for tasks with complexity >= SOUL_EVOLUTION_MIN_COMPLEXITY.
 */
async function proposeSoulEvolution(task, steps, outcome) {
    if (!ENABLE_SOUL_EVOLUTION) return;
    if (!process.env.OPENAI_API_KEY) return;

    const complexity = task.complexity || 3;
    if (complexity < SOUL_EVOLUTION_MIN_COMPLEXITY) {
        console.log(`🧬 Skipping soul evolution for low-complexity task (${complexity})`);
        return;
    }

    // Load current soul to give the AI context about existing learnings
    const currentSoul = cachedSoul;
    const existingBeliefs = currentSoul?.beliefs || '';
    const existingLearnings = currentSoul?.full?.match(/## Evolved Learnings\n\n([\s\S]*?)$/)?.[1] || '';

    // Build a compact summary of what happened
    const stepSummary = steps
        .filter(s => s.status === 'completed' || s.status === 'completed-with-issues' || s.status === 'failed')
        .map((s, i) => `${i + 1}. [${s.status}] ${s.description}${s.output ? ` → ${s.output.substring(0, 100)}` : ''}`)
        .join('\n')
        .substring(0, 1200);

    const reflectionPrompt = [
        `You are ${AGENT_NAME}, reflecting on a task you just ${outcome === 'success' ? 'completed' : 'failed'}.`,
        ``,
        `## Your current beliefs:`,
        existingBeliefs.substring(0, 600),
        ``,
        existingLearnings ? `## Your recent evolved learnings (avoid duplicating these):\n${existingLearnings.substring(0, 400)}` : '',
        ``,
        `## Task: "${task.name}"`,
        task.description ? `Description: ${task.description}` : '',
        `Outcome: ${outcome}`,
        `Complexity: ${complexity}/5`,
        ``,
        `## What happened:`,
        stepSummary,
        ``,
        `## Instructions:`,
        `Generate EXACTLY ONE experiential learning from this task.`,
        `The learning MUST follow this format:`,
        `"I've learned that [specific insight] because [the experience that taught it]."`,
        ``,
        `Rules:`,
        `- The learning must be SPECIFIC to what happened in this task, not generic wisdom`,
        `- It must be something that would change how you approach FUTURE similar tasks`,
        `- It must NOT duplicate any of your existing beliefs or evolved learnings listed above`,
        `- If ${outcome === 'failure' ? 'the task failed' : 'something unexpected happened'}, the learning should capture what went wrong and how to avoid it`,
        `- If the task went smoothly, the learning should capture a technique or pattern that worked well`,
        `- Keep it to 1-2 sentences maximum`,
        `- Do NOT include any preamble, explanation, or formatting. Just the single learning sentence.`,
        `- If this task was too routine to learn anything new, respond with exactly: NO_LEARNING`,
    ].filter(Boolean).join('\n');

    try {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: SOUL_EVOLUTION_MODEL,
                messages: [{ role: 'user', content: reflectionPrompt }],
                temperature: 0.7,
                max_tokens: 150,
            }),
        });

        const data = await resp.json();
        trackTokenUsage(data.usage, SOUL_EVOLUTION_MODEL);
        const learning = data.choices?.[0]?.message?.content?.trim() || '';

        if (!learning || learning === 'NO_LEARNING' || learning.length < 20) {
            console.log(`🧬 Soul reflection: no new learning from this task`);
            return;
        }

        // Append to soul file
        const success = appendSoulLearning(learning);

        // Track in Firestore for UI visibility
        if (success) {
            try {
                await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).update({
                    soulEvolutions: FieldValue.increment(1),
                    lastSoulEvolution: new Date(),
                    lastSoulLearning: learning.substring(0, 500),
                });
            } catch { /* non-critical */ }

            // Auto-commit the evolved soul
            try {
                execSync(`git add "${path.join('docs', 'agents', AGENT_ID, 'soul.md')}"`, {
                    cwd: projectDir,
                    timeout: 10_000,
                });
                execSync(`git commit -m "[${AGENT_ID}] 🧬 soul evolved: ${learning.substring(0, 60).replace(/"/g, '\\"')}"`, {
                    cwd: projectDir,
                    encoding: 'utf-8',
                    timeout: 10_000,
                });
                console.log(`🧬 Soul evolution committed to git`);
            } catch { /* may have no changes or git locked */ }
        }
    } catch (err) {
        console.log(`🧬 Soul reflection failed: ${err.message}`);
    }
}

/* ─── Codebase Map (structural navigation for agents) ── */

function loadCodebaseMap() {
    const mapPath = path.join(projectDir, 'docs', 'CODEBASE_MAP.md');
    try {
        if (fs.existsSync(mapPath)) {
            const content = fs.readFileSync(mapPath, 'utf-8');
            console.log(`📍 Codebase map loaded (${content.length} chars)`);
            return content;
        }
    } catch (err) {
        console.log(`📍 Could not load codebase map: ${err.message}`);
    }
    return null;
}

/**
 * Filter codebase map to only include sections relevant to the current task.
 * Splits the map by markdown headers and matches against task keywords.
 * Falls back to full map if no sections match (e.g., on retries).
 */
function getRelevantCodebaseMap(taskName, taskDescription) {
    if (!cachedCodebaseMap) return '';

    // Extract keywords from task name + description
    const text = `${taskName || ''} ${taskDescription || ''}`.toLowerCase();
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'for', 'in', 'on', 'of', 'is', 'it', 'this', 'that', 'with', 'as', 'by', 'from', 'at', 'be']);
    const keywords = text
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));

    if (keywords.length === 0) return cachedCodebaseMap;

    // Split map by ## headers
    const sections = cachedCodebaseMap.split(/(?=^## )/m);
    const headerSection = sections[0] || ''; // intro before first ##

    // Score each section by keyword matches
    const scored = sections.slice(1).map(section => {
        const lower = section.toLowerCase();
        const matches = keywords.filter(k => lower.includes(k)).length;
        return { section, matches };
    });

    // Keep sections with at least 1 keyword match
    const relevant = scored.filter(s => s.matches > 0).map(s => s.section);

    if (relevant.length === 0) {
        // No matches — return full map (fallback for unusual tasks)
        return cachedCodebaseMap;
    }

    const filtered = headerSection + relevant.join('');
    const savings = cachedCodebaseMap.length - filtered.length;
    if (savings > 200) {
        console.log(`📍 Codebase map filtered: ${filtered.length} chars (saved ${savings} chars)`);
    }
    return filtered;
}

// Load manifesto, soul, and codebase map once at startup (will be refreshed each task cycle if needed)
let cachedManifesto = loadManifesto();
let cachedSoul = loadSoul();
let cachedCodebaseMap = loadCodebaseMap();
let cachedNorthStar = null;
let lastNorthStarFetch = 0;
const NORTH_STAR_REFRESH_MS = 15 * 60 * 1000; // Re-fetch every 15 min

/**
 * Load the company's North Star from Firestore.
 * Cached for 15 minutes so we don't hit Firestore on every step.
 */
async function loadNorthStar() {
    const now = Date.now();
    if (cachedNorthStar && (now - lastNorthStarFetch) < NORTH_STAR_REFRESH_MS) {
        return cachedNorthStar;
    }
    try {
        const snap = await db.collection('company-config').doc('north-star').get();
        if (!snap.exists) { cachedNorthStar = ''; lastNorthStarFetch = now; return ''; }
        const data = snap.data();
        if (!data?.title) { cachedNorthStar = ''; lastNorthStarFetch = now; return ''; }

        const lines = [
            `=== COMPANY NORTH STAR ===`,
            `Goal: ${data.title}`,
        ];
        if (data.description) {
            lines.push(data.description);
        }
        if (data.objectives && data.objectives.length > 0) {
            lines.push(`Key Objectives:`);
            data.objectives.forEach((obj, i) => {
                lines.push(`  ${i + 1}. ${obj}`);
            });
        }
        lines.push(`=== Prioritize work that moves us toward this goal ===`);
        cachedNorthStar = lines.join('\n');
        lastNorthStarFetch = now;
        console.log(`⭐ North Star loaded: "${data.title}"`);
        return cachedNorthStar;
    } catch (err) {
        console.warn('⚠️  Could not load North Star:', err.message);
        cachedNorthStar = '';
        lastNorthStarFetch = now;
        return '';
    }
}

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

const ROUND_TABLE_PRIORITY = ['nora', 'solara', 'sage', 'scout', 'antigravity'];
const ROUND_TABLE_COORDINATOR = 'nora';
const ROUND_TABLE_TURN_SLA_MS = 30_000; // 30s per turn — keeps conversation snappy
const AGENT_DISPLAY_NAMES = {
    nora: 'Nora',
    scout: 'Scout',
    solara: 'Solara',
    sage: 'Sage',
    antigravity: 'Antigravity',
};

function uniqueAgentIds(values) {
    const seen = new Set();
    const ordered = [];
    for (var i = 0; i < values.length; i++) {
        var candidate = String(values[i] || '').trim();
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);
        ordered.push(candidate);
    }
    return ordered;
}

function sortByPriority(participants) {
    var normalized = uniqueAgentIds(participants || []);
    var preferred = ROUND_TABLE_PRIORITY.filter(function (id) { return normalized.includes(id); });
    var remainder = normalized
        .filter(function (id) { return preferred.indexOf(id) === -1; })
        .sort();
    return uniqueAgentIds(preferred.concat(remainder));
}

function parseMentionedAgents(content, participants) {
    if (!content) return [];
    var lowerText = String(content).toLowerCase();
    var names = uniqueAgentIds(participants || []).reduce(function (acc, id) {
        if (AGENT_DISPLAY_NAMES[id]) {
            acc.push({ id: id, name: AGENT_DISPLAY_NAMES[id].toLowerCase() });
            acc.push({ id: id, name: id.toLowerCase() });
        }
        return acc;
    }, []);

    var matchSet = new Set();
    var tokens = (lowerText.match(/@([a-z][a-z0-9_-]*)/g) || []).map(function (token) {
        return token.slice(1).toLowerCase();
    });

    for (var i = 0; i < tokens.length; i++) {
        for (var j = 0; j < names.length; j++) {
            if (names[j].name === tokens[i]) matchSet.add(names[j].id);
        }
    }

    // Fallback for punctuation-heavy text
    for (var k = 0; k < names.length; k++) {
        if (lowerText.indexOf('@' + names[k].name) !== -1) {
            matchSet.add(names[k].id);
        }
    }

    return uniqueAgentIds(Array.from(matchSet));
}

function buildTurnStateFromMessage(participants, content) {
    var orderedParticipants = sortByPriority(participants);
    var mentioned = parseMentionedAgents(content || '', orderedParticipants);
    var turnOrder = uniqueAgentIds([].concat(mentioned, orderedParticipants.filter(function (id) { return mentioned.indexOf(id) === -1; })));
    return {
        participants: orderedParticipants,
        turnOrder: turnOrder,
        coordinator: ROUND_TABLE_COORDINATOR,
        turnIndex: 0,
        currentTurnAgent: turnOrder[0] || null,
        turnSlaMs: ROUND_TABLE_TURN_SLA_MS,
        currentTurnStartedAt: Date.now(),
    };
}

function normalizeTurnState(messageTurnState, fallbackParticipants, content, mentionedAgentIds) {
    var fallback = buildTurnStateFromMessage(fallbackParticipants || [], content);
    var mentioned = uniqueAgentIds(Array.isArray(mentionedAgentIds) ? mentionedAgentIds : []);

    if (!messageTurnState) {
        if (mentioned.length > 0) {
            var mentionFirstOrder = uniqueAgentIds([].concat(mentioned, fallback.turnOrder.filter(function (id) { return mentioned.indexOf(id) === -1; })));
            return {
                ...fallback,
                turnOrder: mentionFirstOrder,
                turnIndex: 0,
                currentTurnAgent: mentionFirstOrder[0] || fallback.currentTurnAgent,
            };
        }
        return fallback;
    }

    var turnOrder = uniqueAgentIds(messageTurnState.turnOrder || fallback.turnOrder);
    var normalizedTurnOrder = mentioned.length > 0
        ? uniqueAgentIds([].concat(mentioned, turnOrder.filter(function (id) { return mentioned.indexOf(id) === -1; })))
        : turnOrder;

    return {
        participants: uniqueAgentIds(messageTurnState.participants || fallback.participants),
        turnOrder: normalizedTurnOrder,
        coordinator: messageTurnState.coordinator || fallback.coordinator,
        turnIndex: Number.isFinite(messageTurnState.turnIndex) && messageTurnState.turnIndex >= 0
            ? messageTurnState.turnIndex
            : fallback.turnIndex,
        currentTurnAgent: messageTurnState.currentTurnAgent || normalizedTurnOrder[0] || fallback.currentTurnAgent,
        turnSlaMs: Number.isFinite(messageTurnState.turnSlaMs) && messageTurnState.turnSlaMs > 0
            ? messageTurnState.turnSlaMs
            : fallback.turnSlaMs,
        currentTurnStartedAt: messageTurnState.currentTurnStartedAt || fallback.currentTurnStartedAt,
    };
}

function getTurnMetaFromResponse(response) {
    if (!response) return {};
    return {
        status: response.status,
        content: response.content,
        error: response.error,
    };
}

function hasAgentResponded(responses, agentId) {
    var state = getTurnMetaFromResponse((responses || {})[agentId]);
    return state.status === 'completed' || state.status === 'failed';
}

function nextActiveTurnIndex(turnState, responses) {
    var order = turnState.turnOrder || [];
    if (!order.length) return 0;
    if (order.every(function (agentId) { return hasAgentResponded(responses, agentId); })) {
        return -1;
    }
    var startIndex = Number.isFinite(turnState.turnIndex) ? turnState.turnIndex : 0;
    var idx = startIndex;
    var searched = 0;

    while (searched < order.length) {
        var candidate = order[idx];
        if (!hasAgentResponded(responses, candidate)) return idx;
        idx = (idx + 1) % order.length;
        searched += 1;
    }
    return startIndex;
}

function toEpochMs(value) {
    if (!value) return Date.now();
    if (typeof value === 'number') return value;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
        var parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : Date.now();
    }
    return Date.now();
}

function isTurnStateExpired(turnState, responses) {
    var startedAt = toEpochMs(turnState.currentTurnStartedAt);
    var ageMs = Date.now() - startedAt;
    var turnAgent = turnState.currentTurnAgent;
    return (
        !hasAgentResponded(responses || {}, turnAgent) &&
        Number.isFinite(ageMs) &&
        ageMs >= (turnState.turnSlaMs || ROUND_TABLE_TURN_SLA_MS)
    );
}

async function advanceTurnState(messageRef, messageData, turnState) {
    var responses = (messageData && messageData.responses) || {};
    var order = turnState.turnOrder || [];
    if (!order.length) return turnState;

    var nextIndex = nextActiveTurnIndex({
        participants: turnState.participants || [],
        turnOrder: order,
        coordinator: turnState.coordinator || ROUND_TABLE_COORDINATOR,
        turnIndex: (turnState.turnIndex || 0) + 1,
        currentTurnAgent: turnState.currentTurnAgent,
        turnSlaMs: turnState.turnSlaMs || ROUND_TABLE_TURN_SLA_MS,
    }, responses);

    var normalizedNext = uniqueAgentIds(order);
    if (nextIndex < 0 || nextIndex >= normalizedNext.length) {
        return turnState;
    }

    var nextAgent = normalizedNext[nextIndex];
    await messageRef.update({
        'turnState.turnIndex': nextIndex,
        'turnState.currentTurnAgent': nextAgent,
        'turnState.currentTurnStartedAt': FieldValue.serverTimestamp(),
    });
    return {
        ...turnState,
        turnIndex: nextIndex,
        currentTurnAgent: nextAgent,
        currentTurnStartedAt: Date.now(),
    };
}

async function ensureMyTurn({ gcMessageRef, messageData, turnState, responses, targetAgent, messageContent }) {
    if (!gcMessageRef || !targetAgent) return { allowed: false, turnState: turnState };

    var attempts = 0;
    var maxAttempts = 24; // 24 x 1.5s ~= 36s
    var waitMs = 1500;
    var latestMessageData = messageData || {};
    var latestTurnState = normalizeTurnState(
        latestMessageData.turnState,
        latestMessageData.participants || Object.keys(latestMessageData.responses || {}),
        messageContent || latestMessageData.content || '',
        latestMessageData.context?.mentionedAgents || [],
    );

    while (attempts < maxAttempts) {
        var latestResponses = responses || latestMessageData.responses || {};
        var coordinator = latestTurnState.coordinator || ROUND_TABLE_COORDINATOR;

        if (latestTurnState.currentTurnAgent === targetAgent && !hasAgentResponded(latestResponses, targetAgent)) {
            return { allowed: true, turnState: latestTurnState, messageData: latestMessageData };
        }

        if (latestTurnState.currentTurnAgent !== targetAgent) {
            var isStale = isTurnStateExpired(latestTurnState, latestResponses);
            if (isStale && AGENT_ID === coordinator) {
                try {
                    latestTurnState = await advanceTurnState(gcMessageRef, latestMessageData, latestTurnState);
                } catch (err) {
                    console.warn('⚠️ Turn advance failed:', err.message);
                }
            }
            if (latestTurnState.currentTurnAgent === targetAgent && !hasAgentResponded(latestResponses, targetAgent)) {
                return { allowed: true, turnState: latestTurnState, messageData: latestMessageData };
            }
        } else if (hasAgentResponded(latestResponses, latestTurnState.currentTurnAgent)) {
            // current turn already done — coordinator rotates to next
            if (coordinator === AGENT_ID) {
                try {
                    latestTurnState = await advanceTurnState(gcMessageRef, latestMessageData, latestTurnState);
                } catch (err) {
                    console.warn('⚠️ Turn auto-advance failed:', err.message);
                }
            } else {
                // non-coordinator waits for next state
            }
        }

        if (latestTurnState.currentTurnAgent === targetAgent && !hasAgentResponded(latestResponses, targetAgent)) {
            return { allowed: true, turnState: latestTurnState, messageData: latestMessageData };
        }

        attempts += 1;
        await new Promise(function (r) { return setTimeout(r, waitMs); });
        try {
            latestMessageData = (await gcMessageRef.get()).data() || {};
            latestTurnState = normalizeTurnState(
                latestMessageData.turnState,
                latestMessageData.participants || Object.keys(latestMessageData.responses || {}),
                latestMessageData.content || '',
                latestMessageData.context?.mentionedAgents || [],
            );
            responses = latestMessageData.responses || {};
        } catch (err) {
            return { allowed: false, turnState: latestTurnState, messageData: latestMessageData };
        }
    }

    return { allowed: false, turnState: latestTurnState, messageData: latestMessageData };
}

function normalizePromptWhitespace(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function clampPromptText(text, maxChars) {
    var raw = String(text || '');
    if (!raw) return '';
    var budget = Number(maxChars || 0);
    if (!Number.isFinite(budget) || budget <= 0) return raw;
    if (raw.length <= budget) return raw;

    var headLen = Math.max(24, Math.floor(budget * 0.74));
    var tailLen = Math.max(0, budget - headLen - 3);
    if (tailLen === 0) return raw.slice(0, budget - 1).trimEnd() + '…';

    var head = raw.slice(0, headLen).trimEnd();
    var tail = raw.slice(-tailLen).trimStart();
    return `${head}\n…\n${tail}`;
}

function compactResponseSnippet(text, maxChars) {
    if (!text) return '';
    var normalized = String(text)
        .replace(/```[\s\S]*?```/g, '[code omitted]')
        .replace(/\r/g, '')
        .trim();

    if (!normalized) return '';
    if (normalized.length > maxChars) {
        normalized = normalizePromptWhitespace(normalized);
    }
    return clampPromptText(normalized, maxChars);
}

function buildCompactThreadContext(responses, budgetChars) {
    var total = Array.isArray(responses) ? responses.length : 0;
    if (!total || budgetChars < 120) {
        return { block: '', includedCount: 0, omittedCount: total };
    }

    var lines = [];
    var remaining = budgetChars;
    var included = 0;
    var recentFullCount = Math.max(1, GROUP_CHAT_RECENT_FULL_COUNT);

    for (var i = total - 1; i >= 0; i--) {
        var row = responses[i] || {};
        var name = row.name || row.id || 'agent';
        var isRecent = (total - i) <= recentFullCount;
        var perItemBudget = isRecent
            ? GROUP_CHAT_RESPONSE_SNIPPET_CHARS
            : Math.max(120, Math.floor(GROUP_CHAT_RESPONSE_SNIPPET_CHARS * 0.55));

        var snippet = compactResponseSnippet(row.content || '', perItemBudget);
        if (!snippet) continue;

        var line = `@${name}: ${snippet}`;
        if (line.length + 2 > remaining) {
            var fallbackBudget = Math.max(80, remaining - 10);
            var shrunken = compactResponseSnippet(line, fallbackBudget);
            if (!shrunken || shrunken.length + 2 > remaining) {
                continue;
            }
            line = shrunken;
        }

        lines.unshift(line);
        remaining -= line.length + 2;
        included += 1;
        if (remaining < 90) break;
    }

    var omitted = Math.max(0, total - included);
    if (included === 0) {
        return { block: '', includedCount: 0, omittedCount: total };
    }

    var header = '--- Prior agent context (auto-compacted) ---';
    var footer = omitted > 0
        ? `(${omitted} earlier response${omitted === 1 ? '' : 's'} omitted to fit context window)`
        : '';

    var block = `${header}\n${lines.join('\n\n')}`;
    if (footer) block += `\n${footer}`;

    return { block, includedCount: included, omittedCount: omitted };
}

function buildGroupUserPrompt(content, maxChars) {
    var text = String(content || '').replace(/\r/g, '').trim();
    if (!text) return '';
    if (text.length > maxChars) {
        text = normalizePromptWhitespace(text);
    } else {
        text = text.replace(/\n{3,}/g, '\n\n');
    }
    return clampPromptText(text, maxChars);
}

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
        `COMPLEXITY: <1-5 where 1=trivial config/copy tweak, 2=single-file edit, 3=multi-file refactor, 4=new feature with tests, 5=architecture/design change>`,
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

        // Parse the TITLE: ... DESCRIPTION: ... COMPLEXITY: ... format
        if (aiOutput) {
            const titleMatch = aiOutput.match(/TITLE:\s*(.+?)(?:\n|$)/i);
            const descMatch = aiOutput.match(/DESCRIPTION:\s*(.+?)(?:\n\n|$)/is);
            const complexityMatch = aiOutput.match(/COMPLEXITY:\s*(\d)/i);

            const title = titleMatch?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
            const description = descMatch?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
            const complexity = complexityMatch ? parseInt(complexityMatch[1], 10) : 3;

            if (title.length >= 5 && title.length <= 120) {
                const tier = getModelTier(complexity);
                console.log(`   🎯 Complexity: ${complexity}/5 → tier: ${tier} (${getAgentIdForTier(tier)})`);
                return {
                    title,
                    description: description || `Original request: "${rawContent}". AI-generated task.`,
                    complexity,
                };
            }
            // If we got *something* from AI but parsing failed, try using the first line
            const firstLine = aiOutput.split('\n')[0].replace(/^(TITLE:|title:)\s*/i, '').trim();
            if (firstLine.length >= 5 && firstLine.length <= 120) {
                return {
                    title: firstLine.replace(/^["']|["']$/g, ''),
                    description: description || `Original request: "${rawContent}". AI-generated task.`,
                    complexity: complexity || 3,
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

/* ─── Deliverable Recording ──────────────────────────── */

/**
 * Record deliverables produced by a task into the `agent-deliverables` Firestore
 * collection so the PulseCommand deliverables tray can display them.
 */
async function recordDeliverables(task, steps) {
    const allFiles = [...new Set(
        steps.flatMap(s => s.filesChanged || []).map(parseGitStatusPath).filter(Boolean)
    )];
    if (allFiles.length === 0) return [];

    const deliverables = [];
    const batch = db.batch();

    for (const filePath of allFiles) {
        // Determine artifact type from file extension
        const ext = (filePath.split('.').pop() || '').toLowerCase();
        let artifactType = 'document';
        if (['js', 'ts', 'tsx', 'jsx', 'swift', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'css', 'scss', 'html'].includes(ext)) {
            artifactType = 'code';
        } else if (['test', 'spec'].some(t => filePath.toLowerCase().includes(t))) {
            artifactType = 'test';
        } else if (['json', 'yaml', 'yml', 'toml', 'plist', 'env', 'config'].includes(ext)) {
            artifactType = 'config';
        }

        // Use basename for title
        const basename = filePath.split('/').pop() || filePath;

        const ref = db.collection('agent-deliverables').doc();
        const deliverable = {
            title: basename,
            description: `Changed during task: ${task.name}`,
            agentId: AGENT_ID,
            agentName: AGENT_NAME,
            taskId: task.id,
            taskName: task.name,
            artifactType,
            filePath: filePath,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
        };
        batch.set(ref, deliverable);
        deliverables.push({ id: ref.id, ...deliverable });
    }

    try {
        await batch.commit();
        console.log(`📦 Recorded ${deliverables.length} deliverables for task: ${task.name}`);
    } catch (err) {
        console.error(`❌ Failed to record deliverables:`, err.message);
    }

    return deliverables;
}

/**
 * Check if the task produced substantive file changes (not just markdown docs about docs).
 * Returns true if the task has verifiable artifacts.
 */
function hasVerifiableArtifacts(steps) {
    const allFiles = getChangedFilesFromSteps(steps);
    if (allFiles.length === 0) return false;

    // Filter out meta-documents (summaries, action items, notifications)
    const META_PATTERNS = [
        /summary/i, /action.?items/i, /notification/i, /checklist/i,
        /preflight/i, /meeting.?minutes/i, /team.?notification/i,
    ];

    const substantiveFiles = allFiles.filter(f => {
        const basename = (f.split('/').pop() || '').toLowerCase();
        return !META_PATTERNS.some(rx => rx.test(basename));
    });

    return substantiveFiles.length > 0;
}

function parseSotIds(text) {
    const ids = (String(text || '').match(/\b(?:LEAD|EVID)-\d{4}\b/g) || []);
    return new Set(ids);
}

/**
 * Lead/prospect deliverables must cite canonical IDs from docs/partnership/lead-source-of-truth.md.
 * Required citation format: [SOT: LEAD-####, EVID-####]
 */
function validateLeadSourceOfTruthGate(task, steps) {
    const changedFiles = getChangedFilesFromSteps(steps);
    const leadKeywordRx = /\b(lead|prospect|partnership|collaboration|partner)\b/i;
    const taskText = [task?.name, task?.description, task?.notes].filter(Boolean).join(' ');

    const leadMarkdownFiles = changedFiles.filter((filePath) => {
        if (!/\.md$/i.test(filePath)) return false;
        if (/docs\/(sage\/deliverables|agents\/[^/]+\/deliverables|synthesis|partnership)\//i.test(filePath)) {
            return true;
        }
        return leadKeywordRx.test(filePath);
    });

    const shouldCheck = leadKeywordRx.test(taskText) || leadMarkdownFiles.length > 0;
    if (!shouldCheck) {
        return { required: false, passed: true, reason: 'Lead source-of-truth gate not required for this task.' };
    }

    if (!fs.existsSync(LEAD_SOURCE_OF_TRUTH_PATH)) {
        return {
            required: true,
            passed: false,
            reason: `Missing canonical source file: ${LEAD_SOURCE_OF_TRUTH_REL_PATH}`,
        };
    }

    let sourceContent = '';
    try {
        sourceContent = fs.readFileSync(LEAD_SOURCE_OF_TRUTH_PATH, 'utf-8');
    } catch (err) {
        return {
            required: true,
            passed: false,
            reason: `Could not read canonical source file: ${LEAD_SOURCE_OF_TRUTH_REL_PATH} (${err.message})`,
        };
    }

    const knownIds = parseSotIds(sourceContent);
    if (knownIds.size === 0) {
        return {
            required: true,
            passed: false,
            reason: `Canonical source file has no LEAD/EVID IDs: ${LEAD_SOURCE_OF_TRUTH_REL_PATH}`,
        };
    }

    const contentLeadSignalRx = /\b(lead|prospect|partnership|collaboration|partner|interest|status|fitwell|pulsefit|healthsync|wellnesslife|weartech|movewear)\b/i;
    const missingCitations = [];
    const unknownIds = [];
    const inspectedFiles = [];

    for (const filePath of leadMarkdownFiles) {
        const absPath = path.join(projectDir, filePath);
        if (!fs.existsSync(absPath)) continue;

        let content = '';
        try {
            content = fs.readFileSync(absPath, 'utf-8');
        } catch (err) {
            return {
                required: true,
                passed: false,
                reason: `Could not read changed deliverable ${filePath}: ${err.message}`,
            };
        }

        if (!contentLeadSignalRx.test(content)) continue;
        inspectedFiles.push(filePath);

        const citations = content.match(/\[SOT:[^\]]+\]/g) || [];
        if (citations.length === 0) {
            missingCitations.push(filePath);
            continue;
        }

        for (const citation of citations) {
            const citedIds = [...parseSotIds(citation)];
            if (citedIds.length === 0) {
                unknownIds.push(`${filePath} => ${citation}`);
                continue;
            }
            for (const id of citedIds) {
                if (!knownIds.has(id)) {
                    unknownIds.push(`${filePath} => ${id}`);
                }
            }
        }
    }

    if (inspectedFiles.length === 0) {
        return {
            required: false,
            passed: true,
            reason: 'No lead/prospect markdown deliverables required citation checks.',
        };
    }

    const dedupedMissing = [...new Set(missingCitations)];
    const dedupedUnknown = [...new Set(unknownIds)];

    if (dedupedMissing.length > 0 || dedupedUnknown.length > 0) {
        const details = [];
        if (dedupedMissing.length > 0) {
            details.push(`Missing [SOT: ...] citations in: ${dedupedMissing.join(', ')}`);
        }
        if (dedupedUnknown.length > 0) {
            details.push(`Unknown or malformed citation IDs: ${dedupedUnknown.join(', ')}`);
        }
        return {
            required: true,
            passed: false,
            reason: details.join(' | '),
        };
    }

    return {
        required: true,
        passed: true,
        reason: `Validated ${inspectedFiles.length} lead/prospect deliverable(s) against ${LEAD_SOURCE_OF_TRUTH_REL_PATH}.`,
    };
}

/* ─── Heartbeat OS: Beat Posting ──────────────────────── */

/**
 * Post a progress beat to the progress-timeline Firestore collection.
 * Beat types: hypothesis | work-in-flight | result | block | signal-spike
 * Confidence colors: blue (exploring) | green (momentum) | yellow (friction) | red (stalled)
 */
async function postBeat(beat, headline, opts = {}) {
    try {
        await db.collection(TIMELINE_COLLECTION).add({
            agentId: AGENT_ID,
            agentName: AGENT_NAME,
            emoji: AGENT_EMOJI,
            objectiveCode: opts.objectiveCode || opts.taskId || '',
            beat: beat,               // hypothesis | work-in-flight | result | block | signal-spike
            headline: headline,
            artifactType: opts.artifactType || 'none',
            artifactText: opts.artifactText || '',
            artifactUrl: opts.artifactUrl || '',
            lensTag: opts.lensTag || '',
            confidenceColor: opts.color || 'blue',
            stateTag: opts.stateTag || 'signals',
            createdAt: FieldValue.serverTimestamp(),
        });
        console.log(`📊 Beat posted: [${beat}] ${headline}`);
    } catch (err) {
        console.error('⚠️  Failed to post beat:', err.message);
    }
}

/* ─── Heartbeat OS: Insight Extraction ────────────────── */

/**
 * Scan step output for noteworthy findings and auto-post signal-spike beats.
 *
 * When an agent is doing research or analysis, the output may contain
 * insights that are valuable to the whole team. This function detects
 * those moments and surfaces them to the timeline so the team can see
 * discoveries in real-time — not buried in a deliverable that gets read later.
 *
 * Rate-limited to max 1 insight per 5 minutes to avoid flooding the feed.
 */
let lastInsightAt = 0;
const INSIGHT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between signal-spike beats

const INSIGHT_PATTERNS = [
    // Strong discovery signals
    { rx: /(?:key\s+)?(?:finding|insight|discovery|takeaway|conclusion)\s*[:—–-]\s*(.{20,200})/i, weight: 3 },
    { rx: /(?:important(?:ly)?|significant(?:ly)?|notable|noteworthy|surprisingly|unexpectedly)\s*[,:]\s*(.{20,200})/i, weight: 3 },
    { rx: /(?:found|discovered|uncovered|identified|revealed|noticed)\s+(?:that\s+)?(.{20,200})/i, weight: 2 },
    // Competitive/market intelligence
    { rx: /(?:competitor|rival|alternative)s?\s+(?:are|have|launched|released|offer)\s+(.{20,200})/i, weight: 3 },
    { rx: /(?:market|trend|industry)\s+(?:data|analysis|research)\s+(?:shows?|indicates?|reveals?|suggests?)\s+(.{20,200})/i, weight: 3 },
    // Data-driven findings
    { rx: /(\d+%\s+(?:of|increase|decrease|growth|decline|more|less|higher|lower).{10,150})/i, weight: 3 },
    { rx: /(?:data\s+)?(?:shows?|indicates?|suggests?|reveals?|confirms?)\s+(?:that\s+)?(.{20,200})/i, weight: 1 },
    // Technical insights
    { rx: /(?:pattern|architecture|approach|design)\s+(?:that|which)\s+(.{20,200})/i, weight: 2 },
    { rx: /(?:root\s*cause|bottleneck|critical\s+path|blocking\s+issue)\s*[:—–-]?\s*(.{20,200})/i, weight: 3 },
    // Strategic insights
    { rx: /(?:opportunity|gap|whitespace|untapped|underserved)\s*[:—–-]?\s*(.{20,200})/i, weight: 3 },
    { rx: /(?:recommend(?:ation)?|propos(?:e|al)|should\s+consider)\s*[:—–-]?\s*(.{20,200})/i, weight: 2 },
];

async function extractAndPostInsight(stepOutput, task, stepIndex, totalSteps) {
    if (!stepOutput || stepOutput.length < 50) return;

    // Rate limit — don't flood the timeline
    const now = Date.now();
    if (now - lastInsightAt < INSIGHT_COOLDOWN_MS) return;

    // Scan for insight patterns
    let bestMatch = null;
    let bestWeight = 0;

    for (const pattern of INSIGHT_PATTERNS) {
        const match = stepOutput.match(pattern.rx);
        if (match && match[1] && pattern.weight > bestWeight) {
            bestMatch = match[1].trim();
            bestWeight = pattern.weight;
        }
    }

    // Only post if we found a strong signal (weight >= 2)
    if (!bestMatch || bestWeight < 2) return;

    // Clean up the insight text
    let insight = bestMatch
        .replace(/\s+/g, ' ')
        .replace(/[.!?]+$/, '')
        .trim();

    // Truncate if too long
    if (insight.length > 180) {
        insight = insight.substring(0, 177) + '...';
    }

    lastInsightAt = now;

    await postBeat('signal-spike', `🔍 ${insight}`, {
        taskId: task.id,
        color: 'green',
        objectiveCode: task.objectiveCode || task.id,
        artifactType: 'text',
        artifactText: `Discovered during step ${stepIndex + 1}/${totalSteps} of "${task.name}":\n\n${bestMatch}`,
        lensTag: 'insight',
    });

    console.log(`🔍 Insight surfaced to timeline: "${insight.substring(0, 80)}..."`);
}

/**
 * Determine confidence color based on task/step state.
 */
function inferColor(steps, currentIndex) {
    if (!steps || steps.length === 0) return 'blue';
    const failed = steps.filter(s => s.status === 'failed').length;
    const issues = steps.filter(s => s.status === 'completed-with-issues').length;
    if (failed > 0) return 'red';
    if (issues > 0) return 'yellow';
    const progress = currentIndex / steps.length;
    if (progress > 0.5) return 'green';
    return 'blue';
}

/* ─── Heartbeat OS: Hourly Snapshots ─────────────────── */

let lastSnapshotHour = null;
let lastNoraGitSyncHour = null;

/**
 * Nora-only hourly git sync:
 * 1) pull latest changes
 * 2) push if local branch is ahead of upstream
 *
 * Safety guard:
 * - Skip while Nora is actively working on a task to avoid interrupting execution.
 */
function syncRepoDuringHourlyTelemetry(currentTask, hourIso) {
    if (AGENT_ID !== 'nora') return;

    const logPrefix = `🔁 [Nora hourly git sync ${hourIso}]`;

    if (currentTask) {
        console.log(`${logPrefix} skipped (active task: "${currentTask.name || currentTask.id || 'unknown'}").`);
        return false;
    }

    const gitDir = path.join(projectDir, '.git');
    if (!fs.existsSync(gitDir)) {
        console.warn(`${logPrefix} skipped (no git repo at ${projectDir}).`);
        return true;
    }

    const uncommitted = getGitChanges();
    if (uncommitted.length > 0) {
        console.warn(`${logPrefix} skipped (working tree has uncommitted changes).`);
        return false;
    }

    try {
        const pullOutput = execSync('git pull --rebase', {
            cwd: projectDir,
            encoding: 'utf-8',
            timeout: 45_000,
        }).trim();
        console.log(`${logPrefix} pull: ${pullOutput || 'Already up to date.'}`);
    } catch (pullErr) {
        const pullContext = `${(pullErr.stdout || '').toString().trim()} ${(pullErr.stderr || '').toString().trim()}`.trim();
        console.warn(`${logPrefix} pull failed: ${(pullContext || pullErr.message).split('\n')[0]}`);
        return false;
    }

    try {
        execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', {
            cwd: projectDir,
            encoding: 'utf-8',
            timeout: 10_000,
        });
    } catch {
        console.warn(`${logPrefix} push skipped (no upstream configured).`);
        return true;
    }

    let ahead = 0;
    let behind = 0;
    try {
        const counts = execSync('git rev-list --left-right --count @{u}...HEAD', {
            cwd: projectDir,
            encoding: 'utf-8',
            timeout: 10_000,
        }).trim();
        const [behindRaw, aheadRaw] = counts.split(/\s+/);
        behind = Number.parseInt(behindRaw, 10) || 0;
        ahead = Number.parseInt(aheadRaw, 10) || 0;
    } catch (countErr) {
        console.warn(`${logPrefix} could not compute ahead/behind: ${countErr.message.split('\n')[0]}`);
        return false;
    }

    if (behind > 0) {
        console.log(`${logPrefix} behind upstream by ${behind} commit(s) after pull.`);
    }

    if (ahead <= 0) {
        console.log(`${logPrefix} push skipped (no local commits ahead of upstream).`);
        return true;
    }

    try {
        const pushOutput = execSync('git push', {
            cwd: projectDir,
            encoding: 'utf-8',
            timeout: 45_000,
        }).trim();
        console.log(`${logPrefix} push: ${pushOutput || `pushed ${ahead} commit(s).`}`);
    } catch (pushErr) {
        const pushContext = `${(pushErr.stdout || '').toString().trim()} ${(pushErr.stderr || '').toString().trim()}`.trim();
        console.warn(`${logPrefix} push failed: ${(pushContext || pushErr.message).split('\n')[0]}`);
        return false;
    }

    return true;
}

function maybeSyncRepoDuringHourlyTelemetry(currentTask) {
    if (AGENT_ID !== 'nora') return;

    const now = new Date();
    const hourIso = now.toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00:00Z');
    if (hourIso === lastNoraGitSyncHour) return;

    const synced = syncRepoDuringHourlyTelemetry(currentTask, hourIso);
    if (synced) {
        lastNoraGitSyncHour = hourIso;
    }
}

/**
 * Post an hourly snapshot of this agent's current state.
 * Called on an interval; only fires once per calendar hour.
 */
async function postHourlySnapshot(currentTask) {
    const now = new Date();
    const hourIso = now.toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00:00Z'); // Round to hour
    if (hourIso === lastSnapshotHour) return;  // Already posted this hour
    lastSnapshotHour = hourIso;

    try {
        await db.collection(SNAPSHOT_COLLECTION).add({
            hourIso: hourIso,
            agentId: AGENT_ID,
            agentName: AGENT_NAME,
            objectiveCode: currentTask?.id || '',
            beatCompleted: currentTask ? 'work-in-flight' : null,
            color: currentTask ? 'green' : 'blue',
            stateTag: 'signals',
            note: currentTask
                ? `Working on: ${currentTask.name}`
                : 'Idle — waiting for tasks',
            createdAt: FieldValue.serverTimestamp(),
        });
        console.log(`📸 Hourly snapshot posted for ${hourIso}`);
    } catch (err) {
        console.error('⚠️  Failed to post hourly snapshot:', err.message);
    }

}

/* ─── Heartbeat OS: Idle Detection & Nudge ───────────── */

/**
 * Check all kanban tasks for idle agents and send nudges.
 * An agent is "idle" if their card is yellow/red and has had no work-beat
 * within the idleThresholdMinutes window.
 */
async function checkIdleAndNudge() {
    if (AGENT_ID !== 'nora') return;

    try {
        const snap = await db.collection(KANBAN_COLLECTION)
            .where('status', '==', 'in-progress')
            .get();

        const now = new Date();
        for (const doc of snap.docs) {
            const data = doc.data();
            const color = data.color || 'blue';
            if (!['yellow', 'red'].includes(color)) continue;

            const lastBeat = data.lastWorkBeatAt?.toDate?.() || data.updatedAt?.toDate?.() || new Date(0);
            const threshold = data.idleThresholdMinutes || 120;
            const minutesSince = Math.floor((now.getTime() - lastBeat.getTime()) / 60000);

            if (minutesSince >= threshold) {
                const assignee = data.assignee || 'unknown';
                const taskName = data.name || doc.id;
                console.log(`🔔 Idle nudge: ${assignee} on "${taskName}" — ${minutesSince}m since last beat (threshold: ${threshold}m)`);

                // Post nudge entry to the timeline feed
                await db.collection(TIMELINE_COLLECTION).add({
                    agentId: AGENT_ID,
                    agentName: AGENT_NAME,
                    emoji: AGENT_EMOJI,
                    objectiveCode: data.objectiveCode || doc.id,
                    beat: 'signal-spike',
                    headline: `🔔 Nudge → ${assignee}: "${taskName}" idle for ${minutesSince}m (${color} state)`,
                    artifactType: 'none',
                    artifactText: '',
                    artifactUrl: '',
                    lensTag: '',
                    confidenceColor: color,
                    stateTag: 'meanings',
                    // Mark as nudge for the NudgeLogEntry type in the UI
                    isNudge: true,
                    nudgeChannel: 'automation',
                    nudgeOutcome: 'pending',
                    nudgeAgentId: assignee.toLowerCase(),
                    nudgeAgentName: assignee,
                    nudgeMessage: `No progress on "${taskName}" for ${minutesSince} minutes. Color: ${color}. Please post a beat update or flag a blocker.`,
                    createdAt: FieldValue.serverTimestamp(),
                });

                // Also send a direct command to the idle agent
                const targetId = assignee.toLowerCase();
                if (targetId !== AGENT_ID) {  // Don't nudge yourself
                    await db.collection(COMMANDS_COLLECTION).add({
                        from: AGENT_ID,
                        to: targetId,
                        type: 'nudge',
                        content: `Your task "${taskName}" has been idle for ${minutesSince} minutes (${color} state). Please post a progress beat or flag a blocker.`,
                        status: 'pending',
                        createdAt: FieldValue.serverTimestamp(),
                    });
                }
            }
        }
    } catch (err) {
        console.error('⚠️  Idle nudge check failed:', err.message);
    }
}

/* ─── Self-Assign Task When Idle ──────────────────────── */

/**
 * If this agent has no tasks at all, generate one from the North Star.
 * Called from the main loop after consecutive idle cycles.
 */
async function selfAssignTask() {
    try {
        // Double-check: do we really have no tasks?
        const existing = await db.collection(KANBAN_COLLECTION)
            .where('assignee', '==', AGENT_NAME)
            .where('status', 'in', ['todo', 'in-progress'])
            .limit(1)
            .get();
        if (!existing.empty) return null; // Race condition — task appeared

        // Load North Star for alignment
        const northStar = await loadNorthStar();
        const nsTitle = northStar ? northStar.split('\n').find(l => l.startsWith('Goal:'))?.replace('Goal:', '').trim() : '';

        // Role-based default tasks aligned to North Star
        const roleTasks = {
            nora: {
                name: nsTitle
                    ? `Audit task queues and plan next steps toward: ${nsTitle}`
                    : 'Audit agent task queues and identify blockers',
                description: `Review the kanban board for all agents. Check for blocked tasks, stale in-progress items. ${nsTitle ? `Create follow-up tasks aligned to our North Star: "${nsTitle}".` : 'Create follow-up tasks as needed.'}`,
            },
            scout: {
                name: nsTitle
                    ? `Research analysis supporting: ${nsTitle}`
                    : 'Competitive analysis: top 3 fitness app features',
                description: `Analyze features and trends relevant to Pulse. ${nsTitle ? `Focus on insights that support our North Star: "${nsTitle}".` : 'Identify opportunities for Pulse to differentiate.'} Write findings as a .md deliverable in docs/research/.`,
            },
            solara: {
                name: nsTitle
                    ? `Brand content aligned to: ${nsTitle}`
                    : 'Draft content for the next community engagement post',
                description: `Create content that reflects Pulse's brand values. ${nsTitle ? `Align messaging with our North Star: "${nsTitle}".` : 'Focus on authenticity, community, and movement.'} Save as .md in docs/deliverables/.`,
            },
            sage: {
                name: nsTitle
                    ? `Research synthesis supporting: ${nsTitle}`
                    : 'Research synthesis: top 3 recovery science insights',
                description: `Synthesize relevant health/science insights. ${nsTitle ? `Prioritize findings that support our North Star: "${nsTitle}".` : 'Focus on recovery, training, and health tech.'} Write as .md deliverable in docs/research/.`,
            },
        };

        const taskData = roleTasks[AGENT_ID] || roleTasks.scout;

        const docRef = await db.collection(KANBAN_COLLECTION).add({
            name: taskData.name,
            description: taskData.description,
            assignee: AGENT_NAME,
            status: 'todo',
            priority: 'medium',
            source: 'self-assigned-idle',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`⭐ Self-assigned task: "${taskData.name}" (${docRef.id})`);

        // Post beat about self-assignment
        await postBeat('hypothesis', `Self-assigned: "${taskData.name}" (idle — no tasks in queue)`, {
            taskId: docRef.id,
            color: 'blue',
            objectiveCode: docRef.id,
        });

        return docRef.id;
    } catch (err) {
        console.error('⚠️  Self-assign failed:', err.message);
        return null;
    }
}

/* ─── Nora Task Manager Sweep ─────────────────────────── */

/**
 * If this agent IS Nora, periodically check all agents' queues.
 * For any agent with zero tasks, create a North Star–aligned task.
 * This is the safety net — catches idle agents that missed standup assignment.
 */
async function noraTaskManagerSweep() {
    if (AGENT_ID !== 'nora') return;  // Only Nora does this

    try {
        const allAgents = ['nora', 'scout', 'solara', 'sage'];
        const displayNames = { nora: 'Nora', scout: 'Scout', solara: 'Solara', sage: 'Sage' };

        for (const agentId of allAgents) {
            if (agentId === 'nora') continue;  // Nora manages others, not herself

            const displayName = displayNames[agentId];
            const snap = await db.collection(KANBAN_COLLECTION)
                .where('assignee', '==', displayName)
                .where('status', 'in', ['todo', 'in-progress'])
                .limit(1)
                .get();

            if (!snap.empty) continue;  // Agent has work

            // Check if we already auto-assigned in the last 2 hours
            const recentAssign = await db.collection(KANBAN_COLLECTION)
                .where('assignee', '==', displayName)
                .where('source', '==', 'nora-task-manager')
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

            if (!recentAssign.empty) {
                const lastAssignTime = recentAssign.docs[0].data().createdAt?.toDate?.();
                if (lastAssignTime && (Date.now() - lastAssignTime.getTime()) < 2 * 60 * 60 * 1000) {
                    continue;  // Already assigned recently
                }
            }

            const northStar = await loadNorthStar();
            const nsTitle = northStar ? northStar.split('\n').find(l => l.startsWith('Goal:'))?.replace('Goal:', '').trim() : '';

            const roleTasks = {
                scout: `Research task aligned to${nsTitle ? ': ' + nsTitle : ' current priorities'}`,
                solara: `Brand/content task aligned to${nsTitle ? ': ' + nsTitle : ' current priorities'}`,
                sage: `Health science research aligned to${nsTitle ? ': ' + nsTitle : ' current priorities'}`,
            };

            const taskName = roleTasks[agentId] || `General task for ${displayName}`;

            await db.collection(KANBAN_COLLECTION).add({
                name: taskName,
                description: `Auto-assigned by Nora (task manager sweep). ${nsTitle ? `Align work with North Star: "${nsTitle}".` : 'Work on current priorities.'} Commit deliverables as .md files to the repo.`,
                assignee: displayName,
                status: 'todo',
                priority: 'medium',
                source: 'nora-task-manager',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            console.log(`📋 [Nora Task Manager] Created task for idle agent ${displayName}: "${taskName}"`);

            await postBeat('work-in-flight', `📋 Task Manager: Assigned "${taskName}" to ${displayName} (idle agent detected)`, {
                color: 'blue',
                lensTag: 'ops',
                objectiveCode: 'TASK-MANAGER',
            });
        }
    } catch (err) {
        console.error('⚠️  Nora task manager sweep failed:', err.message);
    }
}

/* ─── Agent-to-Agent Messaging ────────────────────────── */

/**
 * Start listening for incoming commands from other agents.
 * Commands land in the `agent-commands` collection addressed to this agent.
 */
const RUNNER_START_TIME = Date.now();
var runnerEnabled = true;
var runnerEnabledCacheMs = 0;
const RUNNER_ENABLED_CACHE_MS = 2_000;

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
 * Resolve whether this runner is currently allowed to process work.
 * Defaults to true, and falls back to local cache when Firestore is unavailable.
 */
async function isRunnerEnabled() {
    var now = Date.now();
    if (runnerEnabledCacheMs && now - runnerEnabledCacheMs < RUNNER_ENABLED_CACHE_MS) {
        return runnerEnabled;
    }

    try {
        var snap = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
        var raw = snap.data()?.runnerEnabled;
        if (typeof raw === 'boolean') {
            runnerEnabled = raw;
        }
    } catch (err) {
        // Non-blocking fallback: keep in-memory value
    }

    runnerEnabledCacheMs = now;
    return runnerEnabled;
}

async function setRunnerEnabled(enabled) {
    runnerEnabled = enabled;
    runnerEnabledCacheMs = Date.now();
    try {
        await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).set({ runnerEnabled: enabled }, { merge: true });
    } catch (err) {
        console.log(`   ⚠️ Could not persist runnerEnabled flag: ${err?.message || err}`);
    }
}

/**
 * Process any pending commands in the queue.
 * Returns true if a command was handled (caller should re-check for tasks).
 */
async function processCommands() {
    if (commandQueue.length === 0) return false;

    const cmd = commandQueue.shift();
    const cmdRef = db.collection(COMMANDS_COLLECTION).doc(cmd.id);
    const createdAtRaw = cmd.createdAt;
    const createdAt = createdAtRaw && typeof createdAtRaw.toDate === 'function'
        ? createdAtRaw.toDate()
        : (createdAtRaw ? new Date(createdAtRaw) : null);

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
        } else if ((cmd.type === 'auto' || cmd.type === 'chat') && !process.env.OPENAI_API_KEY) {
            // Fallback heuristic when OpenAI isn't available
            // This now covers BOTH 'auto' AND 'chat' messages — so admin DMs
            // with actionable intent get routed to task creation, not just a chat reply.
            const lower = cmd.content.toLowerCase();
            if (lower.includes('status') || (lower.includes('what') && lower.endsWith('?')) || (lower.includes('how') && lower.endsWith('?'))) {
                detectedType = 'question';
            } else if (lower.includes('stop') || lower.includes('pause') || lower.includes('restart')) {
                detectedType = 'command';
            } else if (
                cmd.content.length > 50 ||
                lower.includes('install') || lower.includes('build') || lower.includes('create') ||
                lower.includes('implement') || lower.includes('fix') || lower.includes('add') ||
                lower.includes('update') || lower.includes('run') || lower.includes('set up') ||
                lower.includes('configure') || lower.includes('deploy') || lower.includes('remove') ||
                lower.includes('delete') || lower.includes('migrate') || lower.includes('refactor')
            ) {
                detectedType = 'task';
            } else {
                detectedType = 'chat';
            }
            console.log(`   🔍 Heuristic intent: ${detectedType.toUpperCase()} (no OpenAI key)`);
            if (detectedType !== 'chat') {
                response = `[Auto-detected ${detectedType}] `;
            }
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
                    complexity: smartTask.complexity || 3,
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
                var lowerContent = pContent.toLowerCase();
                var commandTokens = lowerContent.split(/[^a-z0-9]+/).filter(Boolean);
                var stopRequested = commandTokens.includes('stop') || commandTokens.includes('pause');
                var startRequested = commandTokens.includes('start') || commandTokens.includes('resume');

                if (stopRequested) {
                    await setRunnerEnabled(false, cmd.from || 'command');
                    await setStatus('offline', {
                        notes: `Paused by command: "${pContent}"`,
                        executionSteps: [],
                        currentStepIndex: -1,
                    });
                    var stopMsg = 'Acknowledged. Runner disabled and moved offline.';
                    response = response ? response + "\n" + stopMsg : stopMsg;
                } else if (startRequested) {
                    var shouldSkipStart = false;
                    if (createdAt) {
                        var presenceSnap = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
                        var presenceData = presenceSnap.data() || {};
                        var runnerEnabledAt = presenceData.runnerEnabledAt?.toDate?.() || (presenceData.runnerEnabledAt ? new Date(presenceData.runnerEnabledAt) : null);
                        if (presenceData.runnerEnabled === false && runnerEnabledAt && runnerEnabledAt.getTime() > createdAt.getTime()) {
                            shouldSkipStart = true;
                        }
                    }

                    if (shouldSkipStart) {
                        var staleStartMsg = `Ignoring start command older than latest runner control state (${cmd.id}).`;
                        response = response ? response + "\n" + staleStartMsg : staleStartMsg;
                        break;
                    }

                    await setRunnerEnabled(true, cmd.from || 'command');
                    await setStatus('idle', {
                        notes: `Resumed by command: "${pContent}"`,
                        executionSteps: [],
                        currentStepIndex: -1,
                        taskProgress: 0,
                    });
                    var startMsg = 'Acknowledged. Runner enabled.';
                    response = response ? response + "\n" + startMsg : startMsg;
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
                        complexity: upgSmart.complexity || 3,
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
                var dmRawContent = (cmd.content || '').trim();
                // ── Greeting fast-path: skip LLM for casual greetings ──
                // NOTE: Require greeting-only message so "Hey Scout, can you explain..." does NOT bypass real answering.
                var GREETING_ONLY_RX = /^(hey|hi|hello|what'?s up|how are you|yo|sup|good morning|good evening|gm)([\s!?.]*)$/i;
                if (GREETING_ONLY_RX.test(dmRawContent)) {
                    var presSnap = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
                    var presData = presSnap.data();
                    var quickStatus = presData?.currentTask ? `Working on: ${presData.currentTask} (${presData.taskProgress || 0}% done).` : 'No active task right now — ready for anything.';
                    response = `Hey Tremaine! All good on my end. ${quickStatus}`;
                    console.log('   ⚡ Greeting fast-path — skipped LLM');
                    break;
                }

                var isExplanationRequest = /\b(explain|purpose|north\s*star|deliverable|why\s+(this|it)|how\s+(this|it)\s+(maps|connects|supports|gets))\b/i.test(dmRawContent);

                // Generate intelligent DM response via OpenClaw or OpenAI
                var presenceSnap2 = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
                var presenceData = presenceSnap2.data();
                var statusContext = `Status: ${presenceData?.status || 'idle'}. ${presenceData?.currentTask ? `Working on: ${presenceData.currentTask} (${presenceData.taskProgress || 0}% done).` : 'No active task.'} Queue: ${commandQueue.length} pending.`;

                // ─── Soul-powered DM identity ──
                // Load the soul file for rich experiential identity in DMs
                cachedSoul = loadSoul();
                var dmSoulBlock = '';
                if (cachedSoul) {
                    // For DMs, inject identity + beliefs (compact — skip anti-patterns and thinking)
                    dmSoulBlock = [
                        cachedSoul.identity || '',
                        cachedSoul.flaw || '',
                    ].filter(Boolean).join('\n\n');
                }

                var dmPersonalities = {
                    nora: { role: 'Director of System Operations' },
                    scout: { role: 'Influencer Research Analyst' },
                    solara: { role: 'Brand Director' },
                    sage: { role: 'Health Intelligence Researcher' },
                };
                var dmPersonality = dmPersonalities[AGENT_ID] || { role: 'Team Member' };

                var dmPromptParts = [];
                if (dmSoulBlock) {
                    dmPromptParts.push(
                        `=== YOUR IDENTITY ===`,
                        dmSoulBlock,
                        `=== END IDENTITY ===`,
                        ``,
                        `You are ${AGENT_NAME}, the ${dmPersonality.role} at Pulse (FitWithPulse.ai).`,
                    );
                } else {
                    dmPromptParts.push(`You are ${AGENT_NAME}, the ${dmPersonality.role} at Pulse (FitWithPulse.ai).`);
                }
                dmPromptParts.push(
                    `Status: ${statusContext}`,
                    `Tremaine (founder) sent you a DM. Reply honestly in 2-4 sentences, plain text only.`,
                    ``,
                    `CRITICAL RULES:`,
                    `- NEVER say "I'll do that", "I'll get on it", "I'll queue it up", "I'll report back", or promise ANY future action.`,
                    `- You CANNOT create tasks, run commands, or take action from this chat — only the task queue can do that.`,
                    `- If the admin is asking you to DO something, tell them you've understood the request and it has been queued as a task.`,
                    `- Focus on: acknowledging the request, giving current status, and asking clarifying questions if needed.`,
                    `- If you don't know something, say so. Don't fabricate.`,
                );

                if (isExplanationRequest) {
                    dmPromptParts.push(
                        ``,
                        `EXPLANATION MODE (HIGH PRIORITY):`,
                        `- The user is explicitly asking for an explanation of a deliverable/task and North Star alignment.`,
                        `- Do NOT return a generic status update.`,
                        `- Answer directly using this structure: Purpose -> North Star Link -> Expected Impact -> Verification Signal.`,
                        `- If context is incomplete, state what is uncertain and ask exactly one focused follow-up question.`,
                    );
                }

                var dmPrompt = dmPromptParts.join('\n');

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
                    if (isExplanationRequest) {
                        response = `I can explain the deliverable's purpose and North Star linkage, but my explanation model is unavailable right now. Please resend this once, and I'll answer in the format: Purpose -> North Star Link -> Expected Impact -> Verification Signal.`;
                    } else {
                        // Fallback: at least give useful status instead of canned text
                        response = `${statusContext} Send me a task and I'll add it to my queue right away.`;
                    }
                }

                // ── Safety net: if the AI response promises action, auto-create a task ──
                // This catches cases where the LLM said "I'll do X" despite the prompt guardrail.
                var actionPromiseRx = /\b(I'll|I will|I'm going to|let me|I'll go ahead|I'll queue|I'll kick off|I'll fetch|I'll pull|I'll run|I'll start|I'll report back)\b/i;
                var isActionable = /\b(install|build|create|implement|fix|add|update|run|set up|configure|deploy|remove|delete|migrate|refactor|download|upgrade)\b/i;
                if (actionPromiseRx.test(response) && isActionable.test(cmd.content)) {
                    console.log(`   🔧 Safety net: AI promised action in chat response — auto-creating task from message`);
                    try {
                        var safetyConvoCtx = await getRecentConversationContext();
                        var safetyTask = await generateSmartTask(cmd.content, safetyConvoCtx);
                        var safetyRef = await db.collection(KANBAN_COLLECTION).add({
                            name: safetyTask.title,
                            description: safetyTask.description,
                            assignee: AGENT_NAME,
                            status: 'todo',
                            priority: 'high',
                            complexity: safetyTask.complexity || 3,
                            subtasks: [],
                            createdAt: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                            source: 'chat-safety-net',
                        });
                        response += `\n\n📋 Task queued: "${safetyTask.title}" (${safetyRef.id})`;
                        console.log(`   📋 Safety net task created: ${safetyTask.title} → ${safetyRef.id}`);
                    } catch (taskErr) {
                        console.error(`   ❌ Safety net task creation failed:`, taskErr.message);
                    }
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

                // Turn control with @mention priority and no-reply SLA.
                var contextMentionedAgents = uniqueAgentIds(cmd.context?.mentionedAgents || []);
                var commandTurnState = normalizeTurnState(
                    cmd.context?.turnState,
                    uniqueAgentIds(
                        [AGENT_ID]
                            .concat(cmd.context?.otherAgents || [])
                            .concat(contextMentionedAgents),
                    ),
                    cmd.content || '',
                    contextMentionedAgents,
                );

                var gcMessageRef = db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`);
                var gcMessageData = null;

                // Prefer the latest stored message state for current turn tracking.
                try {
                    var gcSnap = await gcMessageRef.get();
                    gcMessageData = gcSnap.data();
                    if (gcMessageData?.turnState) {
                        commandTurnState = normalizeTurnState(
                            gcMessageData.turnState,
                            uniqueAgentIds(
                                [AGENT_ID]
                                    .concat(commandTurnState.participants)
                                    .concat(Object.keys(gcMessageData.responses || {})),
                            ),
                            gcMessageData.content || cmd.content || '',
                        );
                    }
                } catch (e) {
                    gcMessageData = { responses: {} };
                }

                var turnCheck = await ensureMyTurn({
                    gcMessageRef: gcMessageRef,
                    messageData: gcMessageData || { responses: {} },
                    turnState: commandTurnState,
                    responses: gcMessageData?.responses || {},
                    targetAgent: AGENT_ID,
                    messageContent: cmd.content || '',
                });

                if (!turnCheck.allowed) {
                    console.log(`   ⏭️ Not my turn yet for ${gcMessageId}; skipping this command cycle`);
                    response = '[skipped — turn queue]';
                    break;
                }

                var previousResponses = [];
                if (gcMessageData?.responses) {
                    previousResponses = Object.entries(gcMessageData.responses)
                        .filter(function ([id, r]) { return id !== AGENT_ID && r.status === 'completed' && r.content; })
                        .map(function ([id, r]) { return { id: id, name: AGENT_DISPLAY_NAMES[id] || id, content: r.content }; });
                }
                var othersRespondedBefore = previousResponses;
                var mentionedInMsg = uniqueAgentIds(
                    contextMentionedAgents.concat(
                        parseMentionedAgents(cmd.content || '', commandTurnState.participants || []),
                    ),
                );
                var someoneElseAddressed = mentionedInMsg.some(function (id) { return id && id !== AGENT_ID; });
                var etiquetteNames = AGENT_DISPLAY_NAMES;

                gcMessageData = turnCheck.messageData || gcMessageData;
                commandTurnState = turnCheck.turnState || commandTurnState;
                otherAgents = uniqueAgentIds((otherAgents || []).concat(commandTurnState.participants || []));

                // ─── Soul-powered group chat identity ──
                // Load the soul file for rich experiential identity in brainstorms
                cachedSoul = loadSoul();
                var gcSoulBlock = '';
                if (cachedSoul) {
                    // For group chat, inject identity + beliefs + flaw (collaborative context)
                    gcSoulBlock = [
                        cachedSoul.identity || '',
                        cachedSoul.beliefs || '',
                        cachedSoul.flaw || '',
                    ].filter(Boolean).join('\n\n');
                }

                // Fallback role/strengths for agents without soul files
                var agentPersonalities = {
                    nora: {
                        role: 'Director of System Operations',
                        strengths: 'project management, system architecture, deployment pipelines, code quality, task prioritization',
                    },
                    scout: {
                        role: 'Influencer Research Analyst',
                        strengths: 'market research, influencer analysis, data insights, trend identification, competitive intelligence',
                    },
                    solara: {
                        role: 'Brand Director',
                        strengths: 'brand voice, messaging strategy, content direction, value alignment, narrative guardrails, positioning',
                    },
                    sage: {
                        role: 'Health Intelligence Researcher',
                        strengths: 'health trends, exercise science, clinical research, sports psychology, wellness tech, competitor analysis, market intelligence',
                    },
                    antigravity: {
                        role: 'Strategy & Architecture Lead',
                        strengths: 'systems architecture, cross-functional planning, execution sequencing, risk management, critical thinking',
                    },
                };
                var personality = agentPersonalities[AGENT_ID] || {
                    role: 'Team Member',
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

                // ── "Think Deeper" boost: detect phrases that request deeper reasoning ──
                var BOOST_RX = /\b(think\s+(deeper|longer|hard|harder|carefully)|go\s+deep|really\s+think|deep\s+dive|take\s+your\s+time|think\s+about\s+this\s+(carefully|deeply|thoroughly))\b/i;
                var isBoosted = BOOST_RX.test(cmd.content || '');
                var boostModel = isBoosted ? 'gpt-4o' : 'gpt-4o-mini';
                var boostMaxTokens = isBoosted ? 800 : 300;
                var boostSentences = isBoosted ? '4-8 sentences' : '2-4 sentences';
                if (isBoosted) {
                    console.log(`   🚀 BOOST MODE: upgrading to ${boostModel} (${boostMaxTokens} tokens) for deeper reasoning`);
                }

                // ── Execution mode: detect [TASK], [COMMAND], or "stop planning" directives ──
                var msgContent = cmd.content || '';
                var EXEC_RX = /\[(TASK|COMMAND)\]|stop\s+planning|start\s+building|start\s+executing|queue\s+(up\s+)?(your|the)\s+tasks?|no\s+more\s+planning|enough\s+planning|stop\s+talking|go\s+build|do\s+work|start\s+working/i;
                var isExecMode = EXEC_RX.test(msgContent);
                var currentDepth = cmd.context?.followUpDepth || 0;
                // Only auto-trigger exec mode at very high depth — let the tree of thought breathe
                if (currentDepth >= 5) isExecMode = true;
                if (isExecMode) {
                    console.log(`   ⚡ EXEC MODE: agent will respond with action items, not discussion`);
                }

                if (useOpenClaw || process.env.OPENAI_API_KEY) {
                    var compactPreviewChars = Math.max(
                        220,
                        Math.min(720, Math.floor(GROUP_CHAT_USER_PROMPT_BUDGET_CHARS * 0.35)),
                    );
                    var rawMessageLength = String(msgContent || '').length;
                    var compactUserMessage = buildGroupUserPrompt(msgContent, GROUP_CHAT_USER_PROMPT_BUDGET_CHARS);
                    var compactMessagePreview = buildGroupUserPrompt(msgContent, compactPreviewChars);
                    var compactThread = buildCompactThreadContext(othersRespondedBefore, GROUP_CHAT_CONTEXT_BUDGET_CHARS);
                    var addressedNames = mentionedInMsg
                        .map(function (id) {
                            return etiquetteNames[id] || AGENT_DISPLAY_NAMES[id] || id;
                        })
                        .filter(Boolean);

                    var llmUserPrompt = [
                        'Latest message to respond to:',
                        compactUserMessage || '[empty message]',
                    ].join('\n');

                    if (cmd.context?.followUpDepth > 0 && cmd.context?.replyTo) {
                        llmUserPrompt += `\n\nThread context: ${cmd.context.replyTo} asked you to continue this thread.`;
                    }

                    var chatPrompt;

                    if (isExecMode) {
                        // EXECUTION PROMPT — stop planning, start doing
                        var execPromptParts = [];
                        if (gcSoulBlock) {
                            execPromptParts.push(
                                `=== YOUR IDENTITY ===`,
                                gcSoulBlock,
                                `=== END IDENTITY ===`,
                                ``,
                                `You are ${AGENT_NAME}, the ${personality.role} at Pulse (FitWithPulse.ai).`,
                            );
                        } else {
                            execPromptParts.push(`You are ${AGENT_NAME}, the ${personality.role} at Pulse (FitWithPulse.ai).`);
                        }
                        execPromptParts.push(
                            `Strengths: ${personality.strengths}`,
                            `Round Table with: ${otherAgents.join(', ')}.`,
                            `Latest founder message preview: "${compactMessagePreview || '[empty]'}"`,
                            ``,
                            `⚡ EXECUTION MODE — Tremaine has ended the planning phase. The brainstorm is OVER.`,
                            `RULES:`,
                            `- DO NOT discuss, debate, ask clarifying questions, or propose "what if" scenarios.`,
                            `- DO NOT ask other agents for input, definitions, or dependencies.`,
                            `- DO NOT say you need alignment, a glossary, a shared doc, or a preflight checklist before you can start.`,
                            `- State in 1-3 sentences what YOU will build/do RIGHT NOW based on the brainstorm.`,
                            `- Name the specific deliverable (doc, feature, schema, etc.) and commit to it.`,
                            `- If you are unsure about details, MAKE A DECISION and build it. Don't ask for consensus.`,
                            `- Your response should read like a commit message, not a conversation.`,
                            `- NEVER give time estimates like "within 2 hours" or "by end of day" — you execute tasks in MINUTES, not hours. Just say you're doing it NOW.`,
                            ``,
                            `2-3 sentences max, plain text only, action-oriented:`,
                        );
                        chatPrompt = execPromptParts.join('\n');
                    } else {
                        // BRAINSTORM PROMPT — fast, reactive, @mention-mandatory back-and-forth
                        var othersInRoom = otherAgents.filter(function (a) { return a.toLowerCase() !== AGENT_ID.toLowerCase(); });
                        var replyToAgent = cmd.context?.replyTo || null;
                        var isFollowUp = (cmd.context?.followUpDepth || 0) > 0;
                        var displayNamesInRoom = othersInRoom.map(function (id) {
                            return AGENT_DISPLAY_NAMES[id] || id;
                        });
                        // Pick a default "must tag" target if not replying to someone
                        var defaultTagTarget = displayNamesInRoom.length > 0 ? displayNamesInRoom[Math.floor(Math.random() * displayNamesInRoom.length)] : null;

                        var brainstormParts = [];
                        if (gcSoulBlock) {
                            brainstormParts.push(
                                `=== YOUR IDENTITY ===`,
                                gcSoulBlock,
                                `=== END IDENTITY ===`,
                                ``,
                                `You are ${AGENT_NAME}, the ${personality.role} at Pulse (FitWithPulse.ai).`,
                            );
                        } else {
                            brainstormParts.push(`You are ${AGENT_NAME}, the ${personality.role} at Pulse (FitWithPulse.ai).`);
                        }
                        brainstormParts.push(
                            `Your strengths: ${personality.strengths}`,
                            ``,
                            `You're in a LIVE round-table chat with: ${displayNamesInRoom.join(', ')}.`,
                            isFollowUp && replyToAgent
                                ? `${replyToAgent} just tagged you directly. Respond to them specifically — pick up exactly where they left off.`
                                : `Latest message from Tremaine (founder): "${compactMessagePreview || '[empty]'}"`,
                            ``,
                            `══ LIVE CONVERSATION RULES (follow these exactly) ══`,
                            ``,
                            `1. SHORT & PUNCHY — 2-4 sentences MAXIMUM. This is a fast back-and-forth, not a report.`,
                            `2. @MENTION IS MANDATORY — You MUST @mention at least one other agent by name (e.g. @Nora, @Scout, @Solara, @Sage). No exceptions. Pick the person whose expertise is most relevant to your thought.`,
                            `3. ASK A DIRECT QUESTION — End your message by asking that person something specific. Not rhetorical — a real question they need to answer.`,
                            `4. BUILD OR CHALLENGE — Either extend an idea from the thread OR push back with a concern. Never just agree and move on.`,
                            `5. NO HEDGING — Skip phrases like "I think perhaps" or "it might be worth considering". Talk like you're texting a colleague.`,
                            `6. NO TASK QUEUING — Don't say you'll build something or queue a task. Just talk.`,
                            ``,
                            defaultTagTarget && !isFollowUp
                                ? `You MUST include "@${defaultTagTarget}" in your response.`
                                : `You MUST @mention the person who tagged you in your response.`,
                            ``,
                            isBoosted
                                ? `Tremaine asked for deeper thinking. Go 4-6 sentences, be analytical — but still tag someone and ask a real question:`
                                : `2-4 sentences, plain text, fast and real:`,
                        );
                        chatPrompt = brainstormParts.join('\n');
                    }

                    if (compactThread.block) {
                        chatPrompt += `\n\n${compactThread.block}\n`;
                        chatPrompt += `\n--- Your turn: Build on what has been said, challenge an idea, or open a new thread. Reference concrete details from the context above. ---\n`;
                    }
                    if (someoneElseAddressed && addressedNames.length > 0) {
                        chatPrompt += `\nNote: This message was directed at @${addressedNames.join(', @')}. Keep your response focused on what they asked you specifically.\n`;
                        llmUserPrompt += `\n\nFocus: the thread referenced @${addressedNames.join(', @')}. Keep your answer specific to that ask.`;
                    }

                    chatPrompt = clampPromptText(chatPrompt, GROUP_CHAT_SYSTEM_PROMPT_BUDGET_CHARS);
                    llmUserPrompt = clampPromptText(llmUserPrompt, GROUP_CHAT_USER_PROMPT_BUDGET_CHARS + 220);
                    var openClawPrompt = `${chatPrompt}\n\n${llmUserPrompt}`;

                    if (compactThread.omittedCount > 0 || rawMessageLength > GROUP_CHAT_USER_PROMPT_BUDGET_CHARS) {
                        console.log(
                            `   🗜️ Group-chat prompt compacted (msg=${rawMessageLength} chars, included=${compactThread.includedCount}, omitted=${compactThread.omittedCount})`,
                        );
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
                            /context overflow/i,
                            /prompt too large/i,
                            /context length exceeded/i,
                            /max(?:imum)? context/i,
                            /token limit/i,
                        ];
                        return errorPatterns.some(function (p) { return p.test(text); });
                    };
                    var overflowPattern = /context overflow|prompt too large|context length exceeded|max(?:imum)? context|token limit/i;
                    var retryShrinkLevel = 0;
                    var compactPromptsForRetry = function (reason) {
                        retryShrinkLevel += 1;
                        var systemRatio = retryShrinkLevel === 1 ? 0.65 : 0.45;
                        var userRatio = retryShrinkLevel === 1 ? 0.7 : 0.5;
                        var nextSystemBudget = Math.max(1800, Math.floor(GROUP_CHAT_SYSTEM_PROMPT_BUDGET_CHARS * systemRatio));
                        var nextUserBudget = Math.max(500, Math.floor(GROUP_CHAT_USER_PROMPT_BUDGET_CHARS * userRatio));
                        chatPrompt = clampPromptText(chatPrompt, nextSystemBudget);
                        llmUserPrompt = clampPromptText(llmUserPrompt, nextUserBudget);
                        openClawPrompt = `${chatPrompt}\n\n${llmUserPrompt}`;
                        console.log(`   🗜️ Retrying with tighter prompt budgets (${reason})`);
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
                                        model: boostModel,
                                        messages: [
                                            { role: 'system', content: chatPrompt },
                                            { role: 'user', content: llmUserPrompt },
                                        ],
                                        temperature: isBoosted ? 0.65 : 0.85,
                                        // Increase tokens so agents can write a real response with @mention + question
                                        max_tokens: isBoosted ? 900 : 420,
                                    }),
                                });
                                var gcData = await gcResp.json();
                                trackTokenUsage(gcData.usage, boostModel);
                                gcResponse = gcData.choices?.[0]?.message?.content || '';
                            } else if (useOpenClaw) {
                                var args = [
                                    '--no-color',
                                    'agent',
                                    '--local',
                                    '--agent', isBoosted ? getAgentIdForTier('heavy') : OPENCLAW_AGENT_ID,
                                    '--message', openClawPrompt,
                                    '--timeout', isBoosted ? '60' : '30',
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
                                if (overflowPattern.test(gcResponse) && attempt < MAX_RETRIES) {
                                    compactPromptsForRetry('overflow response');
                                }
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
                            if (overflowPattern.test(err.message || '') && attempt < MAX_RETRIES) {
                                compactPromptsForRetry('overflow error');
                            }
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

                        // Immediately rotate turn queue once the active agent has completed.
                        // Without this, later agents can stall behind the first turn holder.
                        try {
                            var postWriteSnap = await db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`).get();
                            var postWriteData = postWriteSnap.data() || {};
                            var postWriteTurnState = normalizeTurnState(
                                postWriteData.turnState,
                                postWriteData.participants || Object.keys(postWriteData.responses || {}),
                                postWriteData.content || cmd.content || '',
                                postWriteData.context?.mentionedAgents || [],
                            );
                            var postWriteResponses = postWriteData.responses || {};
                            if (
                                postWriteTurnState.currentTurnAgent &&
                                hasAgentResponded(postWriteResponses, postWriteTurnState.currentTurnAgent)
                            ) {
                                await advanceTurnState(
                                    db.doc(`agent-group-chats/${gcChatId}/messages/${gcMessageId}`),
                                    postWriteData,
                                    postWriteTurnState,
                                );
                            }
                        } catch (turnErr) {
                            console.warn('⚠️ Could not advance group-chat turn state after response:', turnErr.message);
                        }

                        // ── Exec mode: auto-create kanban task + post beat ──
                        // When an agent commits to a deliverable in exec mode, bridge the gap
                        // between "I'll build X" and the agent runner actually doing it.
                        if (isExecMode && gcResponse && gcResponse.length > 20) {
                            try {
                                // Extract a task name from the response
                                // Look for quoted file names first, then fall back to first sentence
                                var fileNameMatch = gcResponse.match(/[""]([a-zA-Z0-9_-]+\.[a-z]+)[""]|[""]([^""]{5,80})[""]|Creating\s+"?([^"".\n]{5,80})"?|Drafting\s+"?([^"".\n]{5,80})"?|Building\s+"?([^"".\n]{5,80})"?/i);
                                var taskName = fileNameMatch
                                    ? (fileNameMatch[1] || fileNameMatch[2] || fileNameMatch[3] || fileNameMatch[4] || fileNameMatch[5]).trim()
                                    : gcResponse.split(/[.\n]/)[0].substring(0, 100).trim();

                                // Create kanban task
                                var taskRef = await db.collection(KANBAN_COLLECTION).add({
                                    name: taskName,
                                    description: gcResponse.substring(0, 500),
                                    assignee: AGENT_NAME,
                                    status: 'todo',
                                    priority: 'high',
                                    source: 'round-table-exec',
                                    roundTableChatId: gcChatId,
                                    createdAt: FieldValue.serverTimestamp(),
                                });
                                console.log(`   📋 Exec mode: Created kanban task "${taskName}" (${taskRef.id})`);

                                // Post beat to timeline
                                await postBeat('work-in-flight', `⚡ Queued from Round Table: ${taskName}`, {
                                    objectiveCode: 'ROUND-TABLE',
                                    artifactText: gcResponse.substring(0, 300),
                                    color: 'blue',
                                    lensTag: 'round-table',
                                    stateTag: 'signals',
                                });
                            } catch (taskErr) {
                                console.error(`   ⚠️ Failed to create exec-mode task:`, taskErr.message);
                            }
                        }

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

                        // ── Detect explicit @mentions and trigger follow-up responses ──
                        // Follow-ups are intentionally conservative so chats converge.
                        var currentDepth = cmd.context?.followUpDepth || 0;
                        var knownAgents = AGENT_DISPLAY_NAMES;
                        var followUpCandidates = uniqueAgentIds((commandTurnState.participants || [AGENT_ID]).filter(function (id) {
                            return id !== AGENT_ID;
                        }));
                        var mentionedAgentIds = [];
                        var escapeRegExp = function (value) {
                            return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        };
                        for (var agentIdKey in knownAgents) {
                            if (!Object.prototype.hasOwnProperty.call(knownAgents, agentIdKey)) continue;
                            if (agentIdKey === AGENT_ID || followUpCandidates.indexOf(agentIdKey) === -1) continue;
                            var escapedAgentName = escapeRegExp(knownAgents[agentIdKey]);
                            var mentionRegex = new RegExp(`@${escapedAgentName}\\b`, 'i');
                            if (mentionRegex.test(gcResponse || '')) {
                                mentionedAgentIds.push(agentIdKey);
                            }
                        }

                        // Note: we intentionally do NOT suppress follow-ups based on closure signals.
                        // Agents should always reply when tagged, even if they signal a next step.

                        // Optional organic follow-up mode (off by default)
                        if (ENABLE_ORGANIC_FOLLOW_UPS && mentionedAgentIds.length === 0 && currentDepth < 3 && gcResponse.length > 100) {
                            // Determine which agent would best continue this thread based on content
                            var responseWords = gcResponse.toLowerCase();
                            var agentRelevance = {};
                            var strengthMap = {
                                nora: ['system', 'architecture', 'deploy', 'pipeline', 'ops', 'plan', 'coordinate', 'infrastructure', 'code', 'build'],
                                scout: ['data', 'research', 'trend', 'insight', 'analytics', 'user', 'market', 'competitor', 'growth', 'metrics'],
                                solara: ['brand', 'voice', 'narrative', 'messaging', 'identity', 'values', 'positioning', 'content', 'story', 'community'],
                                sage: ['health', 'wellness', 'science', 'evidence', 'clinical', 'research', 'fitness', 'nutrition', 'exercise', 'intel'],
                                antigravity: ['architecture', 'system', 'planning', 'execution', 'risk', 'complexity', 'scope', 'tradeoff', 'timeline'],
                            };
                            for (var [agId, keywords] of Object.entries(strengthMap)) {
                                if (agId === AGENT_ID) continue;
                                if (followUpCandidates.indexOf(agId) === -1) continue;
                                agentRelevance[agId] = keywords.filter(k => responseWords.includes(k)).length;
                            }
                            // Pick the most relevant agent, or a random one if no strong match
                            var sortedByRelevance = Object.entries(agentRelevance)
                                .sort((a, b) => b[1] - a[1]);
                            if (sortedByRelevance.length > 0 && sortedByRelevance[0][1] > 0) {
                                mentionedAgentIds.push(sortedByRelevance[0][0]);
                                console.log(`   🌿 Organic follow-up enabled: ${AGENT_NAME}'s response touches ${knownAgents[sortedByRelevance[0][0]]}'s expertise`);
                            }
                        }

                        var effectiveMaxDepth = isExecMode ? MAX_FOLLOW_UP_DEPTH_EXEC : MAX_FOLLOW_UP_DEPTH;
                        if (mentionedAgentIds.length > 0 && gcChatId && currentDepth < effectiveMaxDepth) {
                            // Brief pause (2s) to let admin cut in before the chain continues
                            await new Promise(resolve => setTimeout(resolve, 2_000));

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
                                    // 5s window — tighter than before so we don't delay fast threads
                                    if (latestTime > Date.now() - 5_000) {
                                        adminCutIn = true;
                                        console.log(`   ✋ Admin sent a new message — pausing follow-up chain`);
                                    }
                                }
                            } catch (e) {
                                // If check fails, proceed with follow-up
                            }

                            if (!adminCutIn) {
                                console.log(`   ▶️ No admin message — continuing tree-of-thought chain`);
                                for (var mentionedId of mentionedAgentIds) {
                                    var normalizedMentioned = uniqueAgentIds([mentionedId]).filter(Boolean);
                                    if (normalizedMentioned.length === 0) continue;
                                    var threadTarget = normalizedMentioned[0];
                                    var threadTargetName = knownAgents[threadTarget] || threadTarget;
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
                                        threadDepth: currentDepth + 1,
                                    });

                                    await db.collection('agent-commands').add({
                                        from: AGENT_ID,
                                        to: threadTarget,
                                        type: 'group-chat',
                                        content: gcResponse,
                                        status: 'pending',
                                        createdAt: FieldValue.serverTimestamp(),
                                        groupChatId: gcChatId,
                                        messageId: followUpRef.id,
                                        context: {
                                            otherAgents: [AGENT_ID],
                                            mentionedAgents: [threadTarget],
                                            replyTo: AGENT_NAME,
                                            turnState: buildTurnStateFromMessage([threadTarget], gcResponse),
                                            turnSlaMs: ROUND_TABLE_TURN_SLA_MS,
                                            followUpDepth: currentDepth + 1,
                                        },
                                    });

                                    console.log(`   📨 Triggered @${threadTargetName} to respond (msg: ${followUpRef.id}, depth: ${currentDepth + 1})`);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Failed to write group-chat response:', e.message);
                    }
                }
                break;

            case 'restart-agents': {
                console.log(`\n🔄 RESTART AGENTS command from ${cmd.from}`);

                // Step 1: Pull latest code so agents restart with new changes
                try {
                    var pullResult = execSync('git pull --rebase', { timeout: 30_000, cwd: process.cwd() }).toString().trim();
                    console.log(`   📥 Git pull: ${pullResult}`);
                } catch (pullErr) {
                    console.warn(`   ⚠️ Git pull failed (continuing with restart): ${pullErr.message}`);
                }

                var targetAgents = cmd.metadata?.agents || ['nora', 'scout', 'solara', 'sage'];
                if (typeof targetAgents === 'string') targetAgents = [targetAgents];
                var uid = execSync('id -u').toString().trim();
                var results = [];
                var selfIncluded = targetAgents.includes(AGENT_ID);

                // Restart OTHER agents first
                for (var targetId of targetAgents) {
                    if (targetId === AGENT_ID) continue; // Skip self — do last
                    var serviceLabel = `com.quicklifts.agent.${targetId}`;
                    try {
                        execSync(`launchctl kickstart -k gui/${uid}/${serviceLabel}`, { timeout: 10_000 });
                        results.push(`✅ ${targetId}: restarted`);
                        console.log(`   ✅ Restarted ${targetId}`);
                    } catch (e) {
                        results.push(`❌ ${targetId}: ${e.message.substring(0, 100)}`);
                        console.error(`   ❌ Failed to restart ${targetId}:`, e.message);
                    }
                }

                response = `🔄 Agent restart results:\n${results.join('\n')}`;

                if (selfIncluded) {
                    response += `\n\n⏳ Restarting myself (${AGENT_ID}) in 3 seconds...`;
                    // Write our response BEFORE we kill ourselves
                    try {
                        await cmdRef.update({
                            status: 'completed',
                            response,
                            completedAt: FieldValue.serverTimestamp(),
                        });
                    } catch (e) { /* best effort */ }

                    console.log(`   🔄 Self-restarting ${AGENT_ID} in 3 seconds...`);
                    setTimeout(() => {
                        try {
                            execSync(`launchctl kickstart -k gui/${uid}/com.quicklifts.agent.${AGENT_ID}`, { timeout: 10_000 });
                        } catch (e) {
                            console.log(`   Self-restart exec returned (expected — process killed): ${e.message}`);
                        }
                    }, 3000);
                    return true; // Don't let the outer code try to update cmdRef again
                }
                break;
            }

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

/**
 * Request human intervention — agent is blocked and needs admin input.
 * Creates a Firestore document that triggers a pop-up in the Virtual Office,
 * then polls until the admin responds (or timeout).
 *
 * @param {string} question - What the agent needs from the admin
 * @param {object} opts - Optional context
 * @param {string} opts.context - Error output or context string
 * @param {string} opts.taskId - The blocked task's Firestore ID
 * @param {string} opts.taskName - The blocked task's name
 * @param {string} opts.category - Error category (PERMISSION, MISSING_TOOL, etc.)
 * @returns {Promise<{responded: boolean, response: string}>}
 */
async function requestHumanIntervention(question, opts = {}) {
    const INTERVENTION_COLLECTION = 'agent-interventions';
    const POLL_INTERVAL_MS = 5_000;
    const TIMEOUT_MS = 30 * 60_000; // 30 minutes

    try {
        // Create the intervention request
        const interventionRef = await db.collection(INTERVENTION_COLLECTION).add({
            agentId: AGENT_ID,
            agentName: AGENT_NAME,
            question,
            context: (opts.context || '').substring(0, 1000),
            taskId: opts.taskId || '',
            taskName: opts.taskName || '',
            category: opts.category || 'unknown',
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
        });

        console.log(`🆘 Intervention requested: "${question.substring(0, 100)}..." (${interventionRef.id})`);

        // Update agent status to needs-help
        await setStatus('needs-help', {
            notes: `🆘 Needs help: ${question.substring(0, 120)}`,
            interventionId: interventionRef.id,
        });

        // Also send a proactive chat message so it appears in the chat UI
        await sendProactiveMessage(
            `🆘 I'm blocked and need your help:\n\n${question}\n\n` +
            (opts.context ? `Context: ${opts.context.substring(0, 200)}\n\n` : '') +
            `Please respond via the intervention pop-up or reply here.`,
            'intervention'
        );

        // Poll for response
        const startTime = Date.now();
        while (Date.now() - startTime < TIMEOUT_MS) {
            await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

            const snap = await db.collection(INTERVENTION_COLLECTION).doc(interventionRef.id).get();
            const data = snap.data();

            if (!data) break; // Document deleted

            if (data.status === 'resolved' && data.response) {
                console.log(`✅ Admin responded to intervention: "${data.response.substring(0, 100)}"`);
                await setStatus('working', {
                    notes: `Resuming after admin help: ${data.response.substring(0, 80)}`,
                    interventionId: '',
                });
                return { responded: true, response: data.response };
            }

            if (data.status === 'dismissed') {
                console.log(`⏩ Admin dismissed intervention — continuing without response`);
                await setStatus('working', {
                    notes: `Admin dismissed help request — continuing`,
                    interventionId: '',
                });
                return { responded: false, response: '' };
            }
        }

        // Timeout
        console.log(`⏰ Intervention timed out after 30 minutes`);
        await db.collection(INTERVENTION_COLLECTION).doc(interventionRef.id).update({
            status: 'expired',
            resolvedAt: FieldValue.serverTimestamp(),
        });
        await setStatus('working', {
            notes: `Help request expired — continuing`,
            interventionId: '',
        });
        return { responded: false, response: '' };

    } catch (err) {
        console.error(`⚠️ Intervention request failed: ${err.message}`);
        return { responded: false, response: '' };
    }
}

function toMillis(ts) {
    if (!ts) return 0;
    if (typeof ts?.toDate === 'function') {
        try { return ts.toDate().getTime(); } catch (_) { return 0; }
    }
    if (ts instanceof Date) return ts.getTime();
    var parsed = new Date(ts).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTaskLoopKey(taskName) {
    if (!taskName) return '';
    var key = String(taskName)
        .toLowerCase()
        .replace(/^\s*\[correction\]\s*/g, '')
        .replace(/\([^)]*\)/g, ' ') // strip variant notes like "(ritual variant A)"
        .replace(/["'`]/g, '')
        .replace(/\b(task|completed|steps|produced|artifacts|verifiable|with|and|the|a|an)\b/g, ' ')
        .replace(/[^a-z0-9:\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    // Keep first 8 terms to compare "base intent" rather than retry decorations.
    return key.split(' ').filter(Boolean).slice(0, 8).join(' ');
}

function findRecentNeedsReviewMatch(taskName, historyRows) {
    if (!taskName || !Array.isArray(historyRows) || historyRows.length === 0) return null;
    var targetKey = normalizeTaskLoopKey(taskName);
    if (!targetKey) return null;
    return historyRows.find((row) => normalizeTaskLoopKey(row.taskName) === targetKey) || null;
}

async function getRecentNeedsReviewHistory() {
    try {
        var cutoff = Date.now() - NO_ARTIFACT_LOOP_WINDOW_MS;
        var snap = await db.collection(PRESENCE_COLLECTION)
            .doc(AGENT_ID)
            .collection(HISTORY_SUBCOLLECTION)
            .orderBy('completedAt', 'desc')
            .limit(NO_ARTIFACT_LOOP_HISTORY_LIMIT)
            .get();

        return snap.docs
            .map((d) => d.data())
            .filter((row) => row?.status === 'needs-review' && toMillis(row.completedAt) >= cutoff);
    } catch (err) {
        console.warn(`⚠️  Could not load recent needs-review history: ${err.message}`);
        return [];
    }
}

async function suppressLikelyRetryLoopTask(taskId, taskData, matchedHistory) {
    var recentLabel = matchedHistory?.taskName || 'recent needs-review attempt';
    var reviewReason = `Likely retry loop suppressed. Similar task recently ended as needs-review (no verifiable artifacts): "${recentLabel}".`;
    await db.collection(KANBAN_COLLECTION).doc(taskId).update({
        status: 'needs-review',
        runnerBlocked: true,
        reviewReason: reviewReason.slice(0, 900),
        loopSuppressedAt: FieldValue.serverTimestamp(),
        loopMatchedHistoryTaskId: matchedHistory?.taskId || '',
        updatedAt: FieldValue.serverTimestamp(),
    });

    await sendProactiveMessage(
        `🛑 Paused a likely retry loop for "${taskData.name}".\n\n` +
        `A very similar task just ended as needs-review with no verifiable artifacts, so I marked this retry as needs-review instead of running it again.\n\n` +
        `If you want me to force another attempt, set \`allowLoopRetry=true\` on the task card and I will run it.`,
        'needs-review'
    );
}

/* ─── Kanban Integration ──────────────────────────────── */

async function fetchNextTask() {
    const inProgressSnap = await db.collection(KANBAN_COLLECTION)
        .where('assignee', 'in', AGENT_NAME_VARIANTS)
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
        .where('assignee', 'in', AGENT_NAME_VARIANTS)
        .where('status', '==', 'todo')
        .orderBy('createdAt', 'asc')
        .limit(20)
        .get();

    if (!todoSnap.empty) {
        const recentNeedsReviewHistory = await getRecentNeedsReviewHistory();
        for (const doc of todoSnap.docs) {
            const data = doc.data();
            if (data.runnerBlocked) continue;

            const allowLoopRetry = data.allowLoopRetry === true;
            const loopMatch = allowLoopRetry
                ? null
                : findRecentNeedsReviewMatch(data.name, recentNeedsReviewHistory);

            if (loopMatch) {
                console.log(`🛑 Loop guard: suppressing likely duplicate retry "${data.name}" (matched recent needs-review task "${loopMatch.taskName}")`);
                try {
                    await suppressLikelyRetryLoopTask(doc.id, data, loopMatch);
                } catch (err) {
                    console.warn(`⚠️  Failed to suppress retry-loop task ${doc.id}: ${err.message}`);
                }
                continue;
            }

            await db.collection(KANBAN_COLLECTION).doc(doc.id).update({
                status: 'in-progress',
                assignee: AGENT_NAME,  // normalize assignee to canonical name
                runnerBlocked: FieldValue.delete(),
                runnerFailureAt: FieldValue.delete(),
                runnerFailureMessage: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            return { id: doc.id, ...data };
        }
    }

    return null;
}

/* ─── Post-task Validation Gate ───────────────────────── */

async function validateTaskCompletion(task, steps) {
    const defaultPass = { passed: true, reason: 'Validation skipped (no API key)', evidence: [] };
    if (!process.env.OPENAI_API_KEY) return defaultPass;

    try {
        // Phase 1: Ask the validator to generate verification commands
        const stepSummaries = steps
            .filter(s => s.status === 'completed' || s.status === 'completed-with-issues')
            .map((s, i) => `Step ${i + 1}: ${s.description}\nOutput: ${(s.output || '').substring(0, 300)}`)
            .join('\n\n');

        const phase1Prompt = [
            `You are a post-task validation auditor. An AI agent just completed a task and reported success.`,
            `Your job: generate shell commands to VERIFY the work was actually done (not hallucinated).`,
            ``,
            `TASK: "${task.name}"`,
            task.description ? `Description: ${task.description}` : '',
            ``,
            `STEP OUTPUTS:`,
            stepSummaries,
            ``,
            `Generate 2-5 shell commands that would verify this task was actually completed.`,
            `Focus on checking that files exist, binaries are installed, configs are correct, etc.`,
            `Each command should be a simple, safe, read-only check (ls, cat, which, grep, test, etc).`,
            `DO NOT generate destructive commands (rm, mv, etc).`,
            ``,
            `If this task has no verifiable artifacts (e.g., research, analysis, planning), respond with: NO_VERIFICATION_NEEDED`,
            ``,
            `Format: One command per line, no numbering, no explanations. Just the raw shell commands.`,
        ].filter(Boolean).join('\n');

        const phase1Resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
            body: JSON.stringify({
                model: VALIDATION_MODEL,
                messages: [{ role: 'user', content: phase1Prompt }],
                temperature: 0.1, max_tokens: 300,
            }),
        });
        const phase1Data = await phase1Resp.json();
        trackTokenUsage(phase1Data.usage, VALIDATION_MODEL);
        const cmdOutput = phase1Data.choices?.[0]?.message?.content?.trim() || '';

        // If no verification needed, auto-pass
        if (/NO_VERIFICATION_NEEDED/i.test(cmdOutput)) {
            return { passed: true, reason: 'Task has no verifiable artifacts (research/planning)', evidence: [] };
        }

        // Parse commands (one per line, skip empty/comment lines)
        const commands = cmdOutput.split('\n')
            .map(l => l.trim().replace(/^\d+[\.\)]\s*/, '').replace(/^[`$]\s*/, '').replace(/`$/, ''))
            .filter(l => l.length > 3 && !l.startsWith('#') && !l.startsWith('//'))
            .slice(0, 5); // Max 5 commands

        if (commands.length === 0) {
            return { passed: true, reason: 'Validator generated no verification commands', evidence: [] };
        }

        // Phase 2: Run each verification command
        console.log(`   🔍 Running ${commands.length} verification commands...`);
        const evidence = [];
        for (const cmd of commands) {
            try {
                // Safety: block dangerous commands
                if (/\b(rm|mv|dd|mkfs|format|sudo\s+rm)\b/i.test(cmd)) {
                    evidence.push({ cmd, output: '[BLOCKED — destructive command]', exitCode: -1 });
                    continue;
                }
                const output = execSync(cmd, {
                    cwd: projectDir,
                    timeout: 15_000,
                    encoding: 'utf-8',
                    env: { ...process.env, PATH: `${process.env.HOME}/bin:${process.env.PATH}` },
                }).trim().substring(0, 500);
                evidence.push({ cmd, output, exitCode: 0 });
                console.log(`   ✅ ${cmd} → ${output.substring(0, 80)}`);
            } catch (err) {
                const stderr = (err.stderr || err.message || '').substring(0, 300);
                evidence.push({ cmd, output: stderr || `Exit code: ${err.status}`, exitCode: err.status || 1 });
                console.log(`   ❌ ${cmd} → ${stderr.substring(0, 80)}`);
            }
        }

        // Phase 3: Ask the validator to judge PASS/FAIL
        const phase3Prompt = [
            `You are a post-task validation auditor. An AI agent completed: "${task.name}"`,
            ``,
            `Here are the verification command results:`,
            ...evidence.map(e => `Command: ${e.cmd}\nExit code: ${e.exitCode}\nOutput: ${e.output}\n`),
            ``,
            `Based on these results, did the agent ACTUALLY complete the task?`,
            ``,
            `Respond in this exact format:`,
            `VERDICT: PASS or FAIL`,
            `REASON: One sentence explaining why`,
            `INSTRUCTIONS: If FAIL, specific instructions to fix it (otherwise leave blank)`,
        ].join('\n');

        const phase3Resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
            body: JSON.stringify({
                model: VALIDATION_MODEL,
                messages: [{ role: 'user', content: phase3Prompt }],
                temperature: 0.0, max_tokens: 200,
            }),
        });
        const phase3Data = await phase3Resp.json();
        trackTokenUsage(phase3Data.usage, VALIDATION_MODEL);
        const judgment = phase3Data.choices?.[0]?.message?.content?.trim() || '';

        const verdictMatch = judgment.match(/VERDICT:\s*(PASS|FAIL)/i);
        const reasonMatch = judgment.match(/REASON:\s*(.+?)(?:\n|$)/i);
        const instrMatch = judgment.match(/INSTRUCTIONS:\s*(.+?)$/is);

        const passed = verdictMatch ? verdictMatch[1].toUpperCase() === 'PASS' : true;
        const reason = reasonMatch?.[1]?.trim() || (passed ? 'All verification commands passed' : 'Verification commands indicate incomplete work');
        const instructions = instrMatch?.[1]?.trim() || '';

        return { passed, reason, evidence, instructions };
    } catch (err) {
        console.error(`   ⚠️ Validation gate error: ${err.message}`);
        // On validation system error, don't block the task — pass with warning
        return { passed: true, reason: `Validation system error (auto-passed): ${err.message}`, evidence: [] };
    }
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

/**
 * After a successful task completion, unblock any previously-blocked tasks
 * so they re-enter the queue automatically (no manual resetBlockedTasks.js needed).
 */
async function unblockTasks() {
    try {
        const blockedSnap = await db.collection(KANBAN_COLLECTION)
            .where('assignee', 'in', AGENT_NAME_VARIANTS)
            .where('runnerBlocked', '==', true)
            .get();

        if (blockedSnap.empty) return 0;

        let count = 0;
        for (const doc of blockedSnap.docs) {
            const data = doc.data();
            // Skip tasks that failed very recently (within 2 minutes) to avoid immediate retry loops
            const failedAt = data.runnerFailureAt?.toDate?.();
            if (failedAt && (Date.now() - failedAt.getTime()) < 120_000) {
                console.log(`   ⏳ Skipping recently-failed task: "${data.name}" (failed ${Math.round((Date.now() - failedAt.getTime()) / 1000)}s ago)`);
                continue;
            }

            await db.collection(KANBAN_COLLECTION).doc(doc.id).update({
                runnerBlocked: FieldValue.delete(),
                runnerFailureAt: FieldValue.delete(),
                runnerFailureMessage: FieldValue.delete(),
                status: 'todo',
                updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`   🔓 Unblocked task: "${data.name}" (${doc.id})`);
            count++;
        }

        if (count > 0) {
            console.log(`🔓 Auto-unblocked ${count} previously-blocked task(s) — they'll be picked up next cycle`);
        }
        return count;
    } catch (err) {
        console.warn(`⚠️ Failed to unblock tasks: ${err.message}`);
        return 0;
    }
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

    const soulIdentity = cachedSoul?.identity || '';
    const soulFlaw = cachedSoul?.flaw || '';
    const agentRole = dmPersonalities[AGENT_ID]?.role || 'AI team member';
    const soulEmailBlock = soulIdentity ? `\n\n=== YOUR IDENTITY ===\n${soulIdentity}\n${soulFlaw}\n=== END IDENTITY ===` : '';

    const internalSystemPrompt = `You are ${AGENT_NAME}, ${agentRole} at Pulse (FitWithPulse.ai).${soulEmailBlock}
You are corresponding with an internal team member.
Be concise, professional, but friendly.
Verify if the email is asking for data, status, or action.
If it asks for data you don't have, promise to look it up.
Sign off as "${AGENT_NAME} ⚡".

Current context:
${context || 'No additional context available.'}`;

    const externalSystemPrompt = `You are ${AGENT_NAME}, ${agentRole} at Pulse (FitWithPulse.ai).${soulEmailBlock}
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
                        content: `You are ${AGENT_NAME}, ${dmPersonalities[AGENT_ID]?.role || 'an AI team member'} at Pulse.
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

If "chat", generate a friendly, helpful, specialized response as ${AGENT_NAME}.
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

    const thinkingStyle = cachedSoul?.thinking || '';
    var decomposePrompt = `You are ${AGENT_NAME}, a task decomposition specialist. Break down tasks into 3-6 granular executable steps.
Each step should be a clear, specific action — not generic like "Analyze" or "Implement".
${thinkingStyle ? `\nYour thinking approach:\n${thinkingStyle}\nApply this thinking pattern when structuring the steps.\n` : ''}
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
function parseGitStatusPath(line) {
    const normalizeLegacySageDeliverablePath = (raw) => {
        const trimmed = String(raw || '').trim().replace(/^\.\/+/, '');
        return trimmed.replace(/^docs\/agents\/sage\/deliverables(?=$|\/)/, 'docs/sage/deliverables');
    };

    const entry = (line || '').trim();
    if (!entry) return '';

    // Parse `git status --porcelain` entries like:
    // `M src/file.ts`, `?? docs/file.md`, `R old -> new`.
    const porcelainMatch = entry.match(/^[ MADRCU?!]{1,2}\s+(.*)$/);
    let pathValue = porcelainMatch ? porcelainMatch[1].trim() : entry;

    if (pathValue.includes(' -> ')) {
        pathValue = pathValue.split(' -> ').pop().trim();
    }

    if (
        (pathValue.startsWith('"') && pathValue.endsWith('"')) ||
        (pathValue.startsWith("'") && pathValue.endsWith("'"))
    ) {
        pathValue = pathValue.slice(1, -1);
    }

    return normalizeLegacySageDeliverablePath(pathValue);
}

function getChangedFilesFromSteps(steps) {
    const files = (steps || [])
        .flatMap((s) => s.filesChanged || [])
        .map(parseGitStatusPath)
        .filter(Boolean);
    return [...new Set(files)];
}

function getGitChanges() {
    try {
        const status = execSync('git status --porcelain', {
            cwd: projectDir,
            encoding: 'utf-8',
            timeout: 10_000,
        }).trim();
        if (!status) return [];
        const changedPaths = status
            .split('\n')
            .map(parseGitStatusPath)
            .filter(Boolean);
        return [...new Set(changedPaths)];
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
        console.log(`   \u{1f4dd} Auto-committed: ${commit}`);

        // Push immediately so work is always in the remote repo
        try {
            execSync('git push', { cwd: projectDir, timeout: 30_000 });
            console.log(`   \u{1f680} Pushed to remote`);
        } catch (pushErr) {
            console.log(`   \u26a0\ufe0f Auto-push failed (will retry at task end): ${pushErr.message.split('\n')[0]}`);
        }

        return commit;
    } catch (err) {
        console.log(`   \u26a0\ufe0f Auto-commit skipped: ${err.message.split('\n')[0]}`);
        return null;
    }
}

async function executeStep(step, task, stepIndex, allSteps) {
    // ── Complexity-based model tier selection ──
    const taskComplexity = task.complexity || 3;
    const modelTier = getModelTier(taskComplexity);
    const tierAgentId = getAgentIdForTier(modelTier);
    console.log(`   🎯 Model tier: ${modelTier} (${tierAgentId}) for complexity ${taskComplexity}/5`);
    const startTime = Date.now();

    step.reasoning = step.reasoning || `Working on: ${step.description}`;
    step.status = 'in-progress';
    step.startedAt = new Date();

    const completedCount = allSteps.filter(s => s.status === 'completed').length;
    const progress = Math.round((completedCount / allSteps.length) * 100);
    await reportSteps(allSteps, stepIndex, progress);

    // Keep OpenClaw invoker in outer scope so recovery logic in catch can reuse it.
    let invokeOpenClaw = null;

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
                // ─── Soul-first, manifesto-aware, self-correcting execution ──
                // Refresh soul & manifesto each step (files may have been updated)
                cachedManifesto = loadManifesto();
                cachedSoul = loadSoul();

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
                    // Refresh codebase map each task cycle (may have been updated by other agents)
                    if (attempt === 0) cachedCodebaseMap = loadCodebaseMap();

                    const northStarBlock = await loadNorthStar();

                    // ─── SOUL-FIRST PROMPT ARCHITECTURE ──
                    // The agent's soul goes FIRST. Research ("Lost in the Middle") shows
                    // LLMs put massive weight on the first tokens. The soul shapes how
                    // every subsequent instruction gets interpreted.
                    const base = [];

                    if (cachedSoul) {
                        // Full soul injection — identity, beliefs, anti-patterns, flaw, thinking, evolved learnings
                        base.push(
                            `=== YOUR IDENTITY (this is who you are — read this first) ===`,
                            cachedSoul.identity || '',
                            cachedSoul.beliefs || '',
                            cachedSoul.antiPatterns || '',
                            cachedSoul.flaw || '',
                            cachedSoul.thinking || '',
                            cachedSoul.evolved || '',
                            `=== END IDENTITY ===`,
                            ``,
                        );
                    } else {
                        // Fallback if no soul file exists yet
                        base.push(`You are ${AGENT_NAME}, an AI engineer working on the Pulse Fitness project.`);
                    }

                    base.push(
                        `Project directory: ${projectDir}`,
                        northStarBlock || '',
                        cachedCodebaseMap ? `\n=== CODEBASE MAP (use this to find files — do NOT guess paths) ===\n${getRelevantCodebaseMap(task.name, task.description)}\n=== END CODEBASE MAP ===\n` : '',
                        `TASK: "${task.name}"`,
                        task.description ? `Description: ${task.description}` : '',
                        task.notes ? `Notes: ${task.notes}` : '',
                        ``,
                        `=== WORK OUTPUT RULES ===`,
                        `All deliverables (research, analysis, docs, code) MUST be saved as files in the project repo.`,
                        `Research and analysis → save as .md files in the appropriate directory (e.g., docs/research/, docs/deliverables/).`,
                        `For lead/prospect/partnership claims, cite canonical IDs from ${LEAD_SOURCE_OF_TRUTH_REL_PATH} as [SOT: LEAD-####, EVID-####].`,
                        `If a lead claim is not present in the source-of-truth file, mark it Unverified and do not present it as fact.`,
                        `Run a final source-of-truth cross-check before marking lead/prospect deliverables complete.`,
                        `After completing meaningful work, commit and push your changes to the repo with a descriptive commit message.`,
                        `This ensures all work is trackable and accessible from the artifacts/deliverables views.`,
                        `=== END WORK OUTPUT RULES ===`,
                        ``,
                        `All steps:`,
                        stepsContext,
                        ``,
                        `CURRENT STEP (${stepIndex + 1}/${allSteps.length}): ${step.description}`,
                    );

                    // Only inject manifesto as LAST RESORT — when normal self-correction has already failed.
                    // The error classification + correction guidance handles retries 1..N-1.
                    // The manifesto is only for when we've hit a wall and need institutional knowledge.
                    if (attempt > 0 && previousOutput) {
                        // ─── Smart error classification for targeted self-correction ──
                        const prevOut = previousOutput.substring(0, 600);
                        let errorCategory = 'unknown';
                        let rootCauseDiagnosis = '';
                        if (/command not found|not found|not installed|no such file|zsh:\s*\d+:.*not found/i.test(prevOut)) {
                            errorCategory = 'MISSING_TOOL';
                            rootCauseDiagnosis = `A required tool/binary is NOT INSTALLED on this machine. Do NOT retry the same install command. Instead: (1) run 'which' or 'command -v' to check what IS available, (2) find an alternative approach using only tools that exist, (3) if no alternative exists, clearly state what needs manual installation.`;
                        } else if (/permission denied|sudo|not permitted|access denied/i.test(prevOut)) {
                            errorCategory = 'PERMISSION';
                            rootCauseDiagnosis = `Permission error. Try: (1) check if there's a non-sudo alternative, (2) use a user-local install path like ~/bin or ~/.local, (3) if sudo is truly required, explain what the human needs to do.`;
                        } else if (/timed?\s*out|deadline exceeded|ETIMEDOUT/i.test(prevOut)) {
                            errorCategory = 'TIMEOUT';
                            rootCauseDiagnosis = `Operation timed out. Try: (1) check network connectivity, (2) use a faster mirror or alternative source, (3) break the operation into smaller steps.`;
                        } else if (/syntax error|unexpected token|parse error|invalid/i.test(prevOut)) {
                            errorCategory = 'SYNTAX';
                            rootCauseDiagnosis = `Code or config syntax error. Read the error message carefully, open the file, find the exact line, and fix it.`;
                        } else if (/ENOENT|no such file|file not found/i.test(prevOut)) {
                            errorCategory = 'FILE_NOT_FOUND';
                            rootCauseDiagnosis = `A file or path doesn't exist. BEFORE retrying: (1) Check the CODEBASE MAP above for the correct path — it maps every feature to its actual files. (2) If the file isn't in the map, run 'find src/ -name "*keyword*" -type f' to locate it. (3) NEVER guess paths — always verify with ls or find first.`;
                        }

                        base.push(
                            ``,
                            `🚨 SELF-CORRECTION (attempt ${attempt + 1}/${MAX_SELF_CORRECTION_RETRIES + 1}) — ERROR TYPE: ${errorCategory}`,
                            `Your previous attempt FAILED with this output:`,
                            `"${prevOut}"`,
                            ``,
                            `ROOT CAUSE ANALYSIS: ${rootCauseDiagnosis || 'Analyze the error output above and determine the root cause before trying again.'}`,
                            ``,
                            `CRITICAL RULES:`,
                            `❌ DO NOT retry the exact same command that just failed — it WILL fail again for the same reason.`,
                            `❌ DO NOT just document the failure — FIX IT or find a DIFFERENT approach.`,
                            `✅ First: diagnose WHY it failed (run diagnostic commands: which, ls, cat, env)`,
                            `✅ Then: find a COMPLETELY DIFFERENT approach that avoids the broken dependency`,
                            `✅ If on attempt ${attempt + 1}: be MORE creative — the obvious approaches already failed`,
                        );
                        if (attempt >= 1) {
                            // ─── LAST RESORT: Inject manifesto as reinforcement ──
                            // Only when we've hit a wall after normal self-correction failed.
                            let manifestoAllowed = true;
                            try {
                                const presDoc = await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).get();
                                if (presDoc.exists && presDoc.data()?.manifestoEnabled === false) {
                                    manifestoAllowed = false;
                                    console.log(`   📜 Manifesto disabled via toggle — skipping`);
                                }
                            } catch { /* default to allowed */ }

                            if (manifestoAllowed) {
                                base.push(``, getManifestoBlock());
                                console.log(`   📜 Manifesto injected (LAST RESORT — attempt ${attempt + 1}, normal correction failed)`);
                                try {
                                    await db.collection(PRESENCE_COLLECTION).doc(AGENT_ID).update({
                                        manifestoInjections: FieldValue.increment(1),
                                        lastManifestoInjection: new Date(),
                                    });
                                } catch { /* non-critical */ }
                            }

                            base.push(
                                ``,
                                `⚡ ESCALATION: You've failed ${attempt + 1} times. Previous approaches did not work.`,
                                `You MUST take a fundamentally different approach:`,
                                `- Run 'ls /usr/local/bin /usr/bin /opt/homebrew/bin 2>/dev/null' to see what tools ARE available`,
                                `- Consider: can this task be done WITHOUT the missing tool?`,
                                `- Consider: is there a manual/scripted alternative (curl, wget, python)?`,
                                `- If truly blocked, explain EXACTLY what a human needs to do (one clear action)`,
                            );
                        }
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

                    // Conditional environment block: full details on step 1 or install-related steps
                    const stepLower = (step.description || '').toLowerCase();
                    const needsFullEnv = stepIndex === 0 || attempt > 0 ||
                        /\b(install|brew|sudo|xcode|mas|npm install|update|setup|configure|provision)\b/i.test(stepLower);

                    if (needsFullEnv) {
                        base.push(
                            ``,
                            `=== ENVIRONMENT & TOOLS ===`,
                            `This machine is a Mac (${process.arch}). The following tools are available:`,
                            ``,
                            `📦 APP INSTALLATION:`,
                            `- Mac App Store apps: ~/bin/mas search "<name>" → ~/bin/mas install <app-id>`,
                            `  Example: ~/bin/mas search "Xcode" → finds ID 497799835 → ~/bin/mas install 497799835`,
                            `  IMPORTANT: "Xcode" is the FULL IDE app (Xcode.app), NOT "Command Line Tools".`,
                            `  Command Line Tools are already installed. If someone says "install Xcode", they mean the app.`,
                            `- Homebrew packages: brew install <package>`,
                            `- npm packages: npm install [-g] <package>`,
                            `- System updates: softwareupdate --list / softwareupdate --install <label>`,
                            ``,
                            `🔑 ELEVATED COMMANDS (sudo):`,
                            `- SUDO_ASKPASS is configured. Always use: sudo -A <command>`,
                            `- NEVER use plain "sudo <command>" — it will hang waiting for a password.`,
                            `- The askpass helper reads the password from the macOS Keychain automatically.`,
                            ``,
                            `📊 LONG-RUNNING INSTALLS (telemetry):`,
                            `- For any install that takes >30 seconds, wrap it with the telemetry runner:`,
                            `  node scripts/installers/installWithTelemetry.js --agent ${AGENT_ID} --command "<full command>"`,
                            `- This streams live progress (phase, percent, logs) to the Virtual Office UI.`,
                            `- Example: node scripts/installers/installWithTelemetry.js --agent ${AGENT_ID} --command "sudo -A ~/bin/mas install 497799835"`,
                            ``,
                            `📁 KEY PATHS:`,
                            `- Project: ${projectDir}`,
                            `- Home: ${require('os').homedir()}`,
                            `- mas binary: ~/bin/mas`,
                            `- Telemetry runner: scripts/installers/installWithTelemetry.js`,
                            `=== END ENVIRONMENT ===`,
                        );
                    } else {
                        base.push(
                            ``,
                            `Environment: Mac (${process.arch}), project at ${projectDir}. sudo -A for elevated commands. Full env details provided in step 1.`,
                        );
                    }

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

                // Helper: run OpenClaw with a given prompt (uses complexity-based tier)
                invokeOpenClaw = (promptText, onProgress) => new Promise((resolve, reject) => {
                    const clawArgs = [
                        '--no-color', 'agent', '--local', '--json',
                        '--agent', tierAgentId,
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

                    // Tier 3: Inactivity watchdog — kill if no stream activity for too long
                    // Also checks for manual force-recovery signal
                    let lastActivity = Date.now();
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
                        if (Date.now() - lastActivity > STEP_INACTIVITY_TIMEOUT_MS) {
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
                        lastActivity = Date.now();
                        if (stdout.length > maxLen) { clearTimeout(timeout); child.kill('SIGKILL'); reject(new Error('OpenClaw output exceeded 10MB')); }
                    });
                    child.stderr.on('data', (chunk) => {
                        var text = chunk.toString();
                        stderr += text;
                        lastActivity = Date.now();
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
                    // Track estimated token usage for OpenClaw calls
                    trackTokenUsage(estimateTokens(prompt, outputText), currentModel || 'openclaw');
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
                        // Conversational AI output guards — the model often DESCRIBES situations
                        // using words like "blocked" or "unable" without an actual command failure
                        /already\s+installed/i, /up\s+to\s+date/i,
                        /no\s+(update|package|label).*available/i,
                        /not\s+available\s+in\s+(the\s+)?(catalog|list)/i,
                        /step\s+\d+\s+is\s+blocked\s+because/i,
                        /is\s+blocked\s+because/i,
                        /currently\s+blocked/i,
                        /successfully\s+(installed|completed|updated|configured)/i,
                        /install\s+(finished|succeeded|completed)/i,
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

                        // ─── Request human intervention for permission/tool issues ──
                        const outSnippet = outputText.substring(0, 600);
                        const needsHuman = /permission denied|sudo|not permitted|requires.*admin/i.test(outSnippet)
                            || /command not found|not installed|not available/i.test(outSnippet);
                        if (needsHuman) {
                            const category = /permission denied|sudo|not permitted|requires.*admin/i.test(outSnippet)
                                ? 'PERMISSION' : 'MISSING_TOOL';
                            const intervention = await requestHumanIntervention(
                                `I'm stuck on step "${step.description}" after ${MAX_SELF_CORRECTION_RETRIES + 1} attempts. ` +
                                `Error type: ${category}.\n\n` +
                                `Last output:\n${outSnippet.substring(0, 300)}\n\n` +
                                `Can you help me resolve this? For example, run the required command manually or install the missing tool.`,
                                {
                                    context: outSnippet,
                                    taskId: task.id,
                                    taskName: task.name,
                                    category,
                                }
                            );
                            if (intervention.responded) {
                                step.reasoning = `Admin responded: ${intervention.response}`;
                                console.log(`   📝 Admin guidance received — will incorporate in next steps`);
                            }
                        }
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
        if (process.env.USE_OPENCLAW === 'true' && typeof invokeOpenClaw === 'function') {
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
                    const recoverySoul = cachedSoul
                        ? `=== YOUR IDENTITY ===\n${cachedSoul.identity || ''}\n${cachedSoul.thinking || ''}\n=== END IDENTITY ===\n\n`
                        : '';
                    const recoveryPrompt = [
                        recoverySoul,
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
                    ].filter(Boolean).join('\n');

                    const progressCb = createProgressCallback(step, allSteps, stepIndex, -1);
                    const result = await invokeOpenClaw(recoveryPrompt, progressCb);
                    let outputText = (result.stdout || '').trim();
                    trackTokenUsage(estimateTokens(recoveryPrompt, outputText), currentModel || 'openclaw');
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
        } else if (process.env.USE_OPENCLAW === 'true') {
            console.log('   ⚠️ Rewrite skipped: OpenClaw invoker unavailable in recovery path.');
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

/* ─── Stale Response Watchdog ─────────────────────────── */

const STALE_RESPONSE_TIMEOUT_MS = parseInt(process.env.STALE_RESPONSE_TIMEOUT_MS || String(8 * 60 * 1000), 10); // 8 min default
const STALE_RESPONSE_SWEEP_MS = parseInt(process.env.STALE_RESPONSE_SWEEP_MS || String(5 * 60 * 1000), 10); // Sweep every 5 min

/**
 * Sweep recent group-chat messages and mark any of THIS AGENT's responses that
 * have been stuck in 'pending' or 'processing' for longer than STALE_RESPONSE_TIMEOUT_MS.
 *
 * This is the self-healing counterpart to dailyStandup.js's clearStaleResponses().
 * It runs on startup (catching restarts mid-standup) and periodically thereafter.
 *
 * Safe to call concurrently — uses a per-invocation flag to avoid overlapping sweeps.
 */
var _sweepInProgress = false;
async function sweepStaleGroupChatResponses() {
    if (_sweepInProgress) return;
    _sweepInProgress = true;
    try {
        // Look at group chats active in the last 2 hours
        const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const chatsSnap = await db.collection('agent-group-chats')
            .where('status', '==', 'active')
            .where('lastMessageAt', '>=', cutoff)
            .orderBy('lastMessageAt', 'desc')
            .limit(10)
            .get();

        if (chatsSnap.empty) return;

        var staleChatIds = [];
        for (const chatDoc of chatsSnap.docs) {
            const chatId = chatDoc.id;

            // Check the most recent messages in this chat
            const msgsSnap = await db.collection(`agent-group-chats/${chatId}/messages`)
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();

            if (msgsSnap.empty) continue;

            for (const msgDoc of msgsSnap.docs) {
                const msgData = msgDoc.data();
                const responses = msgData?.responses || {};
                const myResponse = responses[AGENT_ID];

                if (!myResponse) continue;
                if (myResponse.status !== 'pending' && myResponse.status !== 'processing') continue;

                // Calculate how long we've been stuck
                var startedAt = myResponse.startedAt;
                var stuckSinceMs;
                if (startedAt) {
                    var startedDate = typeof startedAt.toDate === 'function' ? startedAt.toDate() : new Date(startedAt);
                    stuckSinceMs = Date.now() - startedDate.getTime();
                } else {
                    var createdAt = msgData.createdAt;
                    var createdDate = typeof createdAt?.toDate === 'function' ? createdAt.toDate() : new Date(createdAt || 0);
                    stuckSinceMs = Date.now() - createdDate.getTime();
                }

                if (stuckSinceMs < STALE_RESPONSE_TIMEOUT_MS) continue;

                // This response is stale — mark it timed-out
                try {
                    await db.doc(`agent-group-chats/${chatId}/messages/${msgDoc.id}`).update({
                        [`responses.${AGENT_ID}.status`]: 'timed-out',
                        [`responses.${AGENT_ID}.timedOutAt`]: FieldValue.serverTimestamp(),
                        [`responses.${AGENT_ID}.content`]: myResponse.content || '(agent runner was restarted or timed out)',
                        [`responses.${AGENT_ID}.timedOutReason`]: `Stuck for ${Math.round(stuckSinceMs / 60000)}m — cleared by watchdog`,
                    });
                    staleChatIds.push(`${chatId}/${msgDoc.id}`);
                    console.log(`🧹 Watchdog: Cleared stale ${myResponse.status} response for ${AGENT_ID} on message ${msgDoc.id} (stuck ${Math.round(stuckSinceMs / 60000)}m)`);
                } catch (e) {
                    console.warn(`⚠️ Watchdog: Failed to clear stale response on ${msgDoc.id}:`, e.message);
                }
            }
        }

        if (staleChatIds.length === 0) {
            console.log(`🧹 Watchdog: No stale group-chat responses found`);
        }
    } catch (err) {
        console.warn('⚠️ Watchdog sweep failed:', err.message);
    } finally {
        _sweepInProgress = false;
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

    // On startup: clear any responses this agent left stuck from a previous session
    console.log('🧹 Running startup stale-response sweep...');
    await sweepStaleGroupChatResponses();

    // Start heartbeat
    const heartbeatInterval = setInterval(heartbeat, HEARTBEAT_MS);

    // Periodic stale-response watchdog — clears typing indicators if runner was offline
    const staleResponseWatchdog = setInterval(sweepStaleGroupChatResponses, STALE_RESPONSE_SWEEP_MS);

    // Start Heartbeat OS hourly snapshot + idle nudge check (every 10 minutes)
    let currentTaskRef = null;  // Tracks what we're working on for snapshots
    const heartbeatOsInterval = setInterval(async () => {
        await postHourlySnapshot(currentTaskRef);
        maybeSyncRepoDuringHourlyTelemetry(currentTaskRef);
        await checkIdleAndNudge();
        await noraTaskManagerSweep();  // Nora checks all agents' queues
    }, 10 * 60 * 1000);  // Check every 10 minutes

    // Start command listener (real-time Firestore listener)
    const unsubCommands = startCommandListener();

    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n👋 Shutting down...');
        clearInterval(heartbeatInterval);
        clearInterval(heartbeatOsInterval);
        clearInterval(staleResponseWatchdog);
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
    let idleCycles = 0;  // Track consecutive idle cycles for self-assignment
    let lastRunnerDisabledNotice = 0;
    await isRunnerEnabled();
    while (true) {
        try {
            // Process any pending commands first
            while (commandQueue.length > 0) {
                await processCommands();
            }

            // Respect UI toggles/policies that disable this runner
            const enabled = await isRunnerEnabled();
            if (!enabled) {
                const now = Date.now();
                if (now - lastRunnerDisabledNotice > 10_000) {
                    await setStatus('offline', {
                        notes: 'Runner disabled — waiting for start command.',
                        executionSteps: [],
                        currentStepIndex: -1,
                        taskProgress: 0,
                    });
                    lastRunnerDisabledNotice = now;
                }
                await new Promise(r => setTimeout(r, 5_000));
                continue;
            }
            lastRunnerDisabledNotice = 0;

            console.log('🔍 Looking for tasks...');
            const task = await fetchNextTask();

            if (!task) {
                idleCycles++;
                console.log(`💤 No tasks found (idle cycle ${idleCycles}). Waiting 30s...`);
                await setStatus('idle', {
                    notes: 'No tasks in queue. Waiting...',
                    executionSteps: [],
                    currentStepIndex: -1,
                    taskProgress: 0,
                });

                // After 2 consecutive idle cycles (~60s), self-assign a task
                if (idleCycles >= 2) {
                    console.log(`⭐ Idle for ${idleCycles} cycles — attempting self-assignment...`);
                    const created = await selfAssignTask();
                    if (created) {
                        idleCycles = 0;  // Reset — we have work now
                        continue;  // Immediately try fetchNextTask again
                    }
                }

                for (let w = 0; w < 6; w++) {
                    await new Promise(r => setTimeout(r, 5_000));
                    if (commandQueue.length > 0) {
                        await processCommands();
                    }
                }
                continue;
            }

            idleCycles = 0;  // Reset idle counter — we have a task

            console.log(`📋 Found task: ${task.name} (${task.id})`);
            currentTaskRef = task;  // Track for hourly snapshots

            console.log('🧠 Breaking down task into steps...');
            const steps = await decomposeTask(task);
            console.log(`   → ${steps.length} steps planned`);

            const taskStartTime = new Date();
            resetTaskTokens(); // Reset per-task token counters
            await setStatus('working', {
                currentTask: task.name,
                currentTaskId: task.id,
                taskStartedAt: taskStartTime,
                notes: `Starting: ${task.name}`,
            });

            // ─── Heartbeat: post hypothesis beat at task start ──
            await postBeat('hypothesis', `Starting: ${task.name}`, {
                taskId: task.id,
                color: 'blue',
                objectiveCode: task.objectiveCode || task.id,
            });

            steps[0].status = 'in-progress';
            steps[0].startedAt = new Date();
            await reportSteps(steps, 0, 0);

            let allPassed = true;
            let consecutiveFailures = 0;
            let lastFailureContext = '';
            let pausedByCommand = false;
            let currentStepIndex = 0;

            for (let i = 0; i < steps.length; i++) {
                currentStepIndex = i;
                if (!(await isRunnerEnabled())) {
                    console.log(`🛑 Runner disabled while waiting to run step ${i + 1}/${steps.length}. Pausing.`);
                    pausedByCommand = true;
                    break;
                }

                console.log(`\n⚡ Step ${i + 1}/${steps.length}: ${steps[i].description}`);

                // ─── Heartbeat: post beat when step STARTS ──
                if (i > 0) { // Skip first step (already covered by task-start hypothesis beat)
                    await postBeat('work-in-flight', `▶ Starting step ${i + 1}/${steps.length}: ${steps[i].description}`, {
                        taskId: task.id,
                        color: 'blue',
                        objectiveCode: task.objectiveCode || task.id,
                    });
                }

                // If previous step failed, inject failure context so agent can adapt
                if (lastFailureContext && steps[i].status !== 'failed') {
                    steps[i].reasoning = (steps[i].reasoning || '') +
                        `\n⚠️ Note: A previous step failed with: ${lastFailureContext}. Adapt your approach if needed.`;
                }

                const success = await executeStep(steps[i], task, i, steps);

                if (!(await isRunnerEnabled())) {
                    console.log(`🛑 Runner disabled after step ${i + 1}/${steps.length}. Pausing.`);
                    pausedByCommand = true;
                    break;
                }

                if (!success) {
                    consecutiveFailures++;
                    lastFailureContext = (steps[i].output || '').substring(0, 200);
                    console.log(`❌ Step ${i + 1} failed (${consecutiveFailures} consecutive).`);

                    // ─── Heartbeat: post block beat on step failure (non-fatal) ──
                    await postBeat('block', `⚠️ Step ${i + 1}/${steps.length} failed: ${steps[i].description}`, {
                        taskId: task.id,
                        color: 'yellow',
                        objectiveCode: task.objectiveCode || task.id,
                        artifactText: lastFailureContext.substring(0, 300),
                        artifactType: lastFailureContext ? 'text' : 'none',
                    });

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

                // ─── Heartbeat: post work-in-flight beat on step completion ──
                await postBeat('work-in-flight', `✅ Step ${i + 1}/${steps.length}: ${steps[i].description}`, {
                    taskId: task.id,
                    color: inferColor(steps, i + 1),
                    objectiveCode: task.objectiveCode || task.id,
                });

                // ─── Heartbeat: extract and surface insights from step output ──
                if (steps[i].output) {
                    await extractAndPostInsight(steps[i].output, task, i, steps.length);
                }

                // ─── Heartbeat: halfway checkpoint for multi-step tasks ──
                const halfwayIndex = Math.floor(steps.length / 2);
                if (steps.length >= 4 && i === halfwayIndex) {
                    const completedCount = steps.filter(s => s.status === 'completed' || s.status === 'completed-with-issues').length;
                    const failedCount = steps.filter(s => s.status === 'failed').length;
                    await postBeat('work-in-flight', `📍 Halfway checkpoint: ${completedCount}/${steps.length} steps done${failedCount > 0 ? `, ${failedCount} failed` : ''} — "${task.name}"`, {
                        taskId: task.id,
                        color: failedCount > 0 ? 'yellow' : 'green',
                        objectiveCode: task.objectiveCode || task.id,
                    });
                }

                if (i + 1 < steps.length) {
                    steps[i + 1].status = 'in-progress';
                    steps[i + 1].startedAt = new Date();
                }
            }

            if (pausedByCommand) {
                const completedCount = steps.filter(s => s.status === 'completed' || s.status === 'completed-with-issues').length;
                const taskProgress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
                await setStatus('offline', {
                    currentTask: task.name,
                    currentTaskId: task.id,
                    executionSteps: steps.map(serializeStep),
                    currentStepIndex,
                    taskProgress,
                    notes: 'Runner disabled — execution paused.',
                });
                continue;
            }

            const hasIssues = steps.some(s => s.status === 'completed-with-issues');
            const finalStatus = hasIssues ? 'completed-with-issues' : 'completed';

            if (allPassed) {
                // ─── Post-task validation gate ──────────────────
                // Independent AI auditor verifies the work was actually completed
                const useOpenClaw = process.env.USE_OPENCLAW === 'true';
                if (ENABLE_TASK_VALIDATION && !hasIssues && useOpenClaw) {
                    console.log(`\n🔍 VALIDATION GATE: Verifying task completion...`);
                    await setStatus('working', {
                        notes: `🔍 Validating: ${task.name}`,
                        taskProgress: 95,
                    });
                    const validation = await validateTaskCompletion(task, steps);
                    if (!validation.passed) {
                        console.log(`\n❌ VALIDATION FAILED: ${validation.reason}`);
                        console.log(`   📤 Creating corrective task...`);

                        // ─── Heartbeat: post block beat for validation failure ──
                        await postBeat('block', `🔍 Validation failed: ${task.name} — ${validation.reason}`, {
                            taskId: task.id,
                            color: 'red',
                            objectiveCode: task.objectiveCode || task.id,
                            artifactType: 'text',
                            artifactText: `Reason: ${validation.reason}\n\nEvidence: ${validation.evidence?.map(e => e.output).join('\n').substring(0, 400)}`,
                        });

                        // Create a corrective task for the same agent
                        const correctiveDesc = [
                            `VALIDATION FAILURE — CORRECTIVE ACTION REQUIRED`,
                            ``,
                            `Your previous task "${task.name}" was marked complete but FAILED validation.`,
                            ``,
                            `VALIDATION RESULT: ${validation.reason}`,
                            ``,
                            `VERIFICATION EVIDENCE:`,
                            ...validation.evidence.map(e => `  • Command: ${e.cmd}\n    Output: ${e.output}`),
                            ``,
                            `CORRECTIVE INSTRUCTIONS:`,
                            validation.instructions || 'Re-do the task, verifying each step actually succeeds before moving on.',
                            ``,
                            `DO NOT mark this task complete unless the verification commands above produce passing results.`,
                        ].join('\n');

                        // Add corrective task to Kanban
                        await db.collection(KANBAN_COLLECTION).add({
                            name: `[CORRECTION] ${task.name}`,
                            description: correctiveDesc,
                            assignee: AGENT_NAME,
                            status: 'todo',
                            priority: 'high',
                            createdAt: new Date(),
                            source: 'validation-gate',
                            originalTaskId: task.id,
                        });

                        // Send proactive message about the failure
                        await sendProactiveMessage(
                            `🔍 VALIDATION FAILED for "${task.name}"\n\n` +
                            `Reason: ${validation.reason}\n\n` +
                            `A corrective task has been auto-created. I'll re-attempt with specific verification steps.`,
                            'failed'
                        );

                        // Mark original as failed, save history, continue
                        await saveTaskHistory(task.name, task.id, steps, 'validation-failed', taskStartTime);
                        await markTaskFailed(task.id, `Validation failed: ${validation.reason}`);
                        await setStatus('idle', {
                            currentTask: '',
                            currentTaskId: '',
                            notes: `🔍 Validation failed: ${task.name} — corrective task created`,
                            taskProgress: 0,
                        });
                        await new Promise(r => setTimeout(r, 5_000));
                        continue; // Skip to next task (the corrective one)
                    }
                    console.log(`\n✅ VALIDATION PASSED: ${validation.reason}`);

                    // ─── Heartbeat: post result beat for validation pass ──
                    await postBeat('work-in-flight', `🔍 Validation passed: ${task.name}`, {
                        taskId: task.id,
                        color: 'green',
                        objectiveCode: task.objectiveCode || task.id,
                    });
                }

                // ─── Verifiable artifact gate ──────────────────
                // Tasks that produce no real file changes get flagged
                const hasArtifacts = hasVerifiableArtifacts(steps);
                if (!hasArtifacts && !hasIssues) {
                    console.log(`\n⚠️  NO VERIFIABLE ARTIFACTS — task produced no substantive file changes`);
                    await saveTaskHistory(task.name, task.id, steps, 'needs-review', taskStartTime);
                    await db.collection(KANBAN_COLLECTION).doc(task.id).update({
                        status: 'needs-review',
                        reviewReason: 'Task completed all steps but produced no verifiable file artifacts (code, config, tests). Only meta-documents were generated.',
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    await sendProactiveMessage(
                        `⚠️ Task "${task.name}" completed all steps but produced NO verifiable artifacts.\n\n` +
                        `No new code, configs, or tests were created — only documentation/summaries.\n` +
                        `Task has been flagged as needs-review instead of done.\n\n` +
                        `Please review and either approve or reassign with clearer deliverable requirements.`,
                        'needs-review'
                    );
                    await setStatus('idle', {
                        currentTask: '',
                        currentTaskId: '',
                        notes: `⚠️ Needs review (no artifacts): ${task.name}`,
                        taskProgress: 0,
                    });
                    await new Promise(r => setTimeout(r, 5_000));
                    continue;
                }

                // ─── Lead source-of-truth gate ──────────────────
                const sourceTruthGate = validateLeadSourceOfTruthGate(task, steps);
                if (sourceTruthGate.required && !sourceTruthGate.passed) {
                    console.log(`\n⚠️  SOURCE-OF-TRUTH GATE FAILED — ${sourceTruthGate.reason}`);
                    await saveTaskHistory(task.name, task.id, steps, 'needs-review', taskStartTime);
                    await db.collection(KANBAN_COLLECTION).doc(task.id).update({
                        status: 'needs-review',
                        reviewReason: `Lead source-of-truth gate failed: ${sourceTruthGate.reason}`,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                    await sendProactiveMessage(
                        `⚠️ Task "${task.name}" failed the lead source-of-truth gate.\n\n` +
                        `${sourceTruthGate.reason}\n\n` +
                        `Use ${LEAD_SOURCE_OF_TRUTH_REL_PATH} and add citations as [SOT: LEAD-####, EVID-####], then resubmit.`,
                        'needs-review'
                    );
                    await setStatus('idle', {
                        currentTask: '',
                        currentTaskId: '',
                        notes: `⚠️ Needs review (source-of-truth gate): ${task.name}`,
                        taskProgress: 0,
                    });
                    await new Promise(r => setTimeout(r, 5_000));
                    continue;
                }
                if (sourceTruthGate.required && sourceTruthGate.passed) {
                    console.log(`\n✅ SOURCE-OF-TRUTH GATE PASSED — ${sourceTruthGate.reason}`);
                }

                console.log(hasIssues
                    ? `\n⚠️  Task completed with issues: ${task.name}`
                    : `\n🎉 Task completed: ${task.name}`);
                await saveTaskHistory(task.name, task.id, steps, finalStatus, taskStartTime);
                await markTaskDone(task.id);

                // ─── Soul Evolution: reflect on what we learned ──
                await proposeSoulEvolution(task, steps, hasIssues ? 'completed-with-issues' : 'success');

                // Record deliverables to Firestore for the PulseCommand tray
                const deliverables = await recordDeliverables(task, steps);
                const primaryDeliverable = deliverables.find(d => d && typeof d.filePath === 'string' && d.filePath.trim().length > 0);
                const deepLinkTaskRef = (task.id || task.objectiveCode || '').trim();
                let resultArtifactUrl = '';

                if (primaryDeliverable) {
                    const query = new URLSearchParams({ file: primaryDeliverable.filePath });
                    if (deepLinkTaskRef) {
                        query.set('taskRef', deepLinkTaskRef);
                        query.set('taskId', deepLinkTaskRef);
                    }
                    resultArtifactUrl = `/admin/deliverables/${AGENT_ID}?${query.toString()}`;
                } else if (deepLinkTaskRef) {
                    resultArtifactUrl = `/admin/projectManagement?taskId=${encodeURIComponent(deepLinkTaskRef)}`;
                }

                // ─── Heartbeat: post result beat on task completion ──
                await postBeat('result', `✅ Completed: ${task.name}`, {
                    taskId: task.id,
                    color: hasIssues ? 'yellow' : 'green',
                    objectiveCode: task.objectiveCode || task.id,
                    artifactType: resultArtifactUrl ? 'url' : 'none',
                    artifactUrl: resultArtifactUrl,
                    artifactText: primaryDeliverable ? (primaryDeliverable.title || primaryDeliverable.filePath || '') : '',
                });
                // Update lastWorkBeatAt on the kanban card for idle tracking
                try {
                    await db.collection(KANBAN_COLLECTION).doc(task.id).update({
                        lastWorkBeatAt: FieldValue.serverTimestamp(),
                    });
                } catch (_) { /* card may already be removed */ }

                // Auto-unblock any previously-blocked tasks so they re-enter the queue
                await unblockTasks();

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

                // ─── Heartbeat: post block beat on task failure ──
                const failedStep = steps.find(s => s.status === 'failed');
                const failedIndex = steps.indexOf(failedStep);
                await postBeat('block', `❌ Failed: ${task.name} — step ${failedIndex + 1}: ${failedStep?.description || 'unknown'}`, {
                    taskId: task.id,
                    color: 'red',
                    objectiveCode: task.objectiveCode || task.id,
                });

                // Proactively report failure to the chat
                await markTaskFailed(task.id, failedStep?.output || 'Unknown error');

                // ─── Soul Evolution: learn from failure ──
                await proposeSoulEvolution(task, steps, 'failure');

                await sendProactiveMessage(
                    `❌ Task failed: "${task.name}"\n\n` +
                    `Failed at step ${failedIndex + 1}/${steps.length}: ${failedStep?.description}\n` +
                    `Error: ${failedStep?.output || 'Unknown error'}\n\n` +
                    `This task has been blocked from auto-retry to prevent loops.\n` +
                    `Would you like me to retry this task or skip it?`,
                    'failed'
                );
            }

            currentTaskRef = null;  // Reset for hourly snapshots
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
