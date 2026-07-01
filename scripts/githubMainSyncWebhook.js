#!/usr/bin/env node
'use strict';

/**
 * GitHub main-branch sync webhook.
 *
 * Receives GitHub push webhooks, fetches the matching local repo, and pulls
 * main only when the local checkout is clean and fast-forwardable. Operator
 * updates are written to PulseCommand through the existing agent-commands
 * Firestore inbox.
 */

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');

const COMMANDS_COLLECTION = 'agent-commands';
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');

const PORT = parseInt(process.env.GITHUB_MAIN_SYNC_PORT || process.env.PORT || '3797', 10);
const HOST = process.env.GITHUB_MAIN_SYNC_HOST || '127.0.0.1';
const WEBHOOK_PATH = process.env.GITHUB_MAIN_SYNC_PATH || '/github-webhook';
const HEALTH_PATH = process.env.GITHUB_MAIN_SYNC_HEALTH_PATH || '/healthz';
const SYNC_BRANCH = process.env.GITHUB_MAIN_SYNC_BRANCH || 'main';
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';
const AGENT_ID = process.env.REPO_SYNC_AGENT_ID || 'repo-sync';
const AGENT_NAME = process.env.REPO_SYNC_AGENT_NAME || 'Repo Sync';
const WATCH_REPO_ROOT = process.env.WATCH_REPO_ROOT || DEFAULT_REPO_ROOT;
const MAX_BODY_BYTES = parseInt(process.env.GITHUB_MAIN_SYNC_MAX_BODY_BYTES || String(2 * 1024 * 1024), 10);
const GIT_TIMEOUT_MS = parseInt(process.env.GITHUB_MAIN_SYNC_GIT_TIMEOUT_MS || '120000', 10);
const REPO_MAP_CACHE_MS = parseInt(process.env.GITHUB_MAIN_SYNC_REPO_CACHE_MS || '60000', 10);
const PROCESS_INLINE = envFlag('GITHUB_MAIN_SYNC_PROCESS_INLINE');
const ALLOW_UNSIGNED_WEBHOOK = envFlag('ALLOW_UNSIGNED_WEBHOOK');
const DISABLE_NOTIFICATIONS = envFlag('DISABLE_PULSECOMMAND_NOTIFICATIONS');
const NOTIFY_SUCCESS = process.env.GITHUB_MAIN_SYNC_NOTIFY_SUCCESS !== 'false';
const DISCOVER_WATCH_REPOS = process.env.GITHUB_MAIN_SYNC_DISCOVER_REPOS !== 'false';
const DRY_RUN = envFlag('GITHUB_MAIN_SYNC_DRY_RUN');

let firestoreDb = null;
let repoMapCache = null;
let repoMapCacheExpiresAt = 0;
const repoQueues = new Map();
const handledDeliveries = [];
const handledDeliverySet = new Set();

function envFlag(name) {
    const raw = String(process.env[name] || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(raw);
}

function shortSha(sha) {
    return String(sha || '').slice(0, 7);
}

function json(res, statusCode, body) {
    const payload = JSON.stringify(body);
    res.writeHead(statusCode, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
    });
    res.end(payload);
}

function text(res, statusCode, body) {
    res.writeHead(statusCode, {
        'content-type': 'text/plain; charset=utf-8',
        'content-length': Buffer.byteLength(body),
    });
    res.end(body);
}

function normalizeRemoteToFullName(remoteUrl) {
    let value = String(remoteUrl || '').trim();
    if (!value) return '';

    value = value.replace(/\.git$/i, '');

    const sshMatch = value.match(/^git@github\.com:([^/]+\/[^/]+)$/i);
    if (sshMatch) return sshMatch[1].toLowerCase();

    const sshUrlMatch = value.match(/^ssh:\/\/git@github\.com\/([^/]+\/[^/]+)$/i);
    if (sshUrlMatch) return sshUrlMatch[1].toLowerCase();

    const httpsMatch = value.match(/^https:\/\/(?:[^@/]+@)?github\.com\/([^/]+\/[^/?#]+)$/i);
    if (httpsMatch) return httpsMatch[1].toLowerCase();

    const bareFullNameMatch = value.match(/^([^/\s]+\/[^/\s]+)$/);
    if (bareFullNameMatch) return bareFullNameMatch[1].toLowerCase();

    return '';
}

function normalizeFullName(value) {
    return normalizeRemoteToFullName(value) || String(value || '').trim().toLowerCase();
}

function parseWatchReposJson() {
    const raw = process.env.WATCH_REPOS_JSON;
    if (!raw) return [];

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        throw new Error(`WATCH_REPOS_JSON is not valid JSON: ${err.message}`);
    }

    if (Array.isArray(parsed)) {
        return parsed
            .map((item) => ({
                fullName: normalizeFullName(item.fullName || item.repo || item.repository || item.remote || ''),
                dir: item.dir || item.path || item.repoDir || '',
            }))
            .filter((item) => item.fullName && item.dir);
    }

    if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed)
            .map(([key, value]) => ({
                fullName: normalizeFullName(key),
                dir: typeof value === 'string' ? value : value?.dir || value?.path || value?.repoDir || '',
            }))
            .filter((item) => item.fullName && item.dir);
    }

    return [];
}

function configuredRepoDirs() {
    const raw = [
        process.env.WATCH_REPO_DIR,
        process.env.WATCH_REPO_DIRS,
    ].filter(Boolean).join(',');

    return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function discoverRepoDirs(rootDir) {
    if (!rootDir || !fs.existsSync(rootDir)) return [];

    return fs.readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(rootDir, entry.name))
        .filter((dir) => fs.existsSync(path.join(dir, '.git')));
}

function runGit(repoDir, args, opts = {}) {
    return new Promise((resolve, reject) => {
        execFile(
            'git',
            ['-C', repoDir, ...args],
            {
                encoding: 'utf8',
                maxBuffer: opts.maxBuffer || 1024 * 1024,
                timeout: opts.timeout || GIT_TIMEOUT_MS,
            },
            (error, stdout, stderr) => {
                if (error) {
                    error.stdout = stdout;
                    error.stderr = stderr;
                    error.gitArgs = args;
                    reject(error);
                    return;
                }

                resolve({
                    stdout: String(stdout || '').trim(),
                    stderr: String(stderr || '').trim(),
                });
            },
        );
    });
}

async function getOriginFullName(repoDir) {
    const { stdout } = await runGit(repoDir, ['remote', 'get-url', 'origin']);
    return normalizeRemoteToFullName(stdout);
}

async function buildRepoMap() {
    const now = Date.now();
    if (repoMapCache && now < repoMapCacheExpiresAt) return repoMapCache;

    const map = new Map();

    for (const item of parseWatchReposJson()) {
        map.set(item.fullName, path.resolve(item.dir));
    }

    const repoDirs = new Set([
        ...configuredRepoDirs(),
        ...(DISCOVER_WATCH_REPOS ? discoverRepoDirs(WATCH_REPO_ROOT) : []),
    ].map((dir) => path.resolve(dir)));

    for (const repoDir of repoDirs) {
        if (!fs.existsSync(path.join(repoDir, '.git'))) continue;

        try {
            const fullName = await getOriginFullName(repoDir);
            if (fullName && !map.has(fullName)) {
                map.set(fullName, repoDir);
            }
        } catch (err) {
            console.warn(`[repo-sync] Skipping ${repoDir}: ${err.message}`);
        }
    }

    repoMapCache = map;
    repoMapCacheExpiresAt = now + REPO_MAP_CACHE_MS;
    return map;
}

async function resolveRepoDir(payload) {
    const fullName = normalizeFullName(payload?.repository?.full_name);
    if (!fullName) {
        throw new Error('Webhook payload did not include repository.full_name.');
    }

    const repoMap = await buildRepoMap();
    const repoDir = repoMap.get(fullName);
    if (!repoDir) {
        const known = Array.from(repoMap.keys()).sort().join(', ') || '(none)';
        throw new Error(`No local repo is configured for ${fullName}. Known repos: ${known}`);
    }

    return { fullName, repoDir };
}

function extractBranch(ref) {
    const value = String(ref || '');
    return value.startsWith('refs/heads/') ? value.slice('refs/heads/'.length) : value;
}

function commitPreview(payload) {
    const commits = Array.isArray(payload?.commits) ? payload.commits : [];
    return commits.slice(-5).map((commit) => {
        const id = shortSha(commit.id);
        const firstLine = String(commit.message || '').split('\n')[0].trim();
        return `- ${id} ${firstLine}`.trim();
    }).filter(Boolean);
}

function pusherName(payload) {
    return (
        payload?.sender?.login ||
        payload?.pusher?.name ||
        payload?.pusher?.email ||
        'unknown'
    );
}

async function getWorkingTreeStatus(repoDir) {
    const { stdout } = await runGit(repoDir, ['status', '--porcelain=v1']);
    return stdout;
}

async function getCurrentBranch(repoDir) {
    const { stdout } = await runGit(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    return stdout;
}

async function getRev(repoDir, rev) {
    const { stdout } = await runGit(repoDir, ['rev-parse', rev]);
    return stdout;
}

async function getAheadBehind(repoDir) {
    const { stdout } = await runGit(repoDir, ['rev-list', '--left-right', '--count', `HEAD...origin/${SYNC_BRANCH}`]);
    const [aheadRaw, behindRaw] = stdout.split(/\s+/);
    return {
        ahead: parseInt(aheadRaw || '0', 10) || 0,
        behind: parseInt(behindRaw || '0', 10) || 0,
    };
}

function getFirestoreDb() {
    if (DISABLE_NOTIFICATIONS) return null;
    if (firestoreDb) return firestoreDb;

    const app = initializeApp({
        credential: resolveAdminCredential({ quiet: true }),
    }, `github-main-sync-${process.pid}`);
    firestoreDb = getFirestore(app);
    return firestoreDb;
}

function operatorPriorityFor(type) {
    switch (type) {
        case 'repo-sync-pulled':
            return 'result';
        case 'repo-sync-blocked':
            return 'warning';
        case 'repo-sync-failed':
            return 'blocker';
        default:
            return 'update';
    }
}

async function notifyOperator({ type, summary, content, requiresReply = false, evidenceRefs = [], metadata = {} }) {
    const db = getFirestoreDb();
    if (!db) {
        console.log(`[repo-sync][notification-disabled] ${summary}`);
        return null;
    }

    const safeEvidenceRefs = Array.from(new Set(evidenceRefs.filter(Boolean).map(String))).slice(0, 12);
    const safeMetadata = Object.fromEntries(
        Object.entries(metadata)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => [key, String(value)]),
    );

    const doc = {
        from: AGENT_ID,
        to: 'admin',
        type: 'chat',
        content,
        metadata: safeMetadata,
        proactiveType: type,
        operatorEvent: type,
        operatorPriority: operatorPriorityFor(type),
        operatorSummary: summary,
        evidenceRefs: safeEvidenceRefs,
        artifactUrls: [],
        taskId: '',
        taskName: `GitHub main sync: ${safeMetadata.repoFullName || ''}`.trim(),
        missionId: '',
        requiresReply,
        status: 'completed',
        createdAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection(COMMANDS_COLLECTION).add(doc);
    console.log(`[repo-sync] PulseCommand notification sent: ${ref.id} ${summary}`);
    return ref.id;
}

async function notifyFailure(payload, error, context = {}) {
    const fullName = normalizeFullName(payload?.repository?.full_name) || context.fullName || 'unknown repo';
    const branch = extractBranch(payload?.ref);
    const summary = `${AGENT_NAME} failed: ${fullName} ${branch || SYNC_BRANCH}`;
    const details = [
        `GitHub main sync failed for ${fullName}.`,
        branch ? `Branch: ${branch}` : '',
        `Error: ${error.message}`,
        error.stderr ? `stderr:\n${String(error.stderr).slice(0, 1600)}` : '',
    ].filter(Boolean).join('\n\n');

    await notifyOperator({
        type: 'repo-sync-failed',
        summary,
        content: details,
        requiresReply: true,
        evidenceRefs: [context.repoDir].filter(Boolean),
        metadata: {
            repoFullName: fullName,
            repoDir: context.repoDir,
            branch,
            deliveryId: context.deliveryId,
            after: payload?.after,
        },
    });
}

async function notifyBlocked(payload, reason, repoDir, extra = {}) {
    const fullName = normalizeFullName(payload?.repository?.full_name);
    const branch = extractBranch(payload?.ref);
    const after = payload?.after || extra.remoteSha || '';
    const commits = commitPreview(payload);
    const summary = `${AGENT_NAME} blocked: ${fullName} ${SYNC_BRANCH}`;
    const content = [
        `GitHub main sync is blocked for ${fullName}.`,
        `I fetched origin/${SYNC_BRANCH}, but I did not pull because ${reason}.`,
        after ? `Remote target: ${shortSha(after)}` : '',
        extra.currentBranch ? `Current branch: ${extra.currentBranch}` : '',
        typeof extra.ahead === 'number' || typeof extra.behind === 'number'
            ? `Ahead/behind: ${extra.ahead || 0} ahead, ${extra.behind || 0} behind origin/${SYNC_BRANCH}`
            : '',
        extra.status ? `Local changes:\n${String(extra.status).slice(0, 1600)}` : '',
        commits.length ? `Recent pushed commits:\n${commits.join('\n')}` : '',
        `Repo: ${repoDir}`,
    ].filter(Boolean).join('\n\n');

    await notifyOperator({
        type: 'repo-sync-blocked',
        summary,
        content,
        requiresReply: true,
        evidenceRefs: [repoDir, ...String(extra.status || '').split('\n').map((line) => line.trim().split(/\s+/).pop())].filter(Boolean),
        metadata: {
            repoFullName: fullName,
            repoDir,
            branch,
            after,
            pusher: pusherName(payload),
        },
    });
}

async function notifyPulled(payload, repoDir, beforeSha, afterSha) {
    if (!NOTIFY_SUCCESS) return;

    const fullName = normalizeFullName(payload?.repository?.full_name);
    const commits = commitPreview(payload);
    const summary = `${AGENT_NAME} pulled: ${fullName} ${shortSha(afterSha)}`;
    const content = [
        `GitHub main sync completed for ${fullName}.`,
        `Pulled ${SYNC_BRANCH} from ${shortSha(beforeSha)} to ${shortSha(afterSha)} after a push by ${pusherName(payload)}.`,
        commits.length ? `Recent pushed commits:\n${commits.join('\n')}` : '',
        `GitHub Desktop should now show local ${SYNC_BRANCH} up to date.`,
        `Repo: ${repoDir}`,
    ].filter(Boolean).join('\n\n');

    await notifyOperator({
        type: 'repo-sync-pulled',
        summary,
        content,
        requiresReply: false,
        evidenceRefs: [repoDir],
        metadata: {
            repoFullName: fullName,
            repoDir,
            branch: SYNC_BRANCH,
            before: beforeSha,
            after: afterSha,
            pusher: pusherName(payload),
        },
    });
}

async function syncRepoFromPush(payload, deliveryId) {
    const branch = extractBranch(payload.ref);
    if (branch !== SYNC_BRANCH) {
        console.log(`[repo-sync] Ignored ${payload.repository?.full_name || 'unknown'} ${branch}: only ${SYNC_BRANCH} is synced.`);
        return { status: 'ignored', reason: `branch ${branch}` };
    }

    const { fullName, repoDir } = await resolveRepoDir(payload);
    console.log(`[repo-sync] Push received for ${fullName} ${SYNC_BRANCH}; repoDir=${repoDir}`);

    const queueKey = fullName;
    return enqueueRepo(queueKey, async () => {
        const beforeSha = await getRev(repoDir, 'HEAD');

        await runGit(repoDir, ['fetch', '--prune', 'origin', SYNC_BRANCH]);

        const currentBranch = await getCurrentBranch(repoDir);
        const remoteSha = await getRev(repoDir, `origin/${SYNC_BRANCH}`);

        if (currentBranch !== SYNC_BRANCH) {
            await notifyBlocked(payload, `the checkout is on ${currentBranch}, not ${SYNC_BRANCH}`, repoDir, {
                currentBranch,
                remoteSha,
            });
            return { status: 'blocked', reason: 'wrong-branch', repoDir };
        }

        const status = await getWorkingTreeStatus(repoDir);
        if (status) {
            await notifyBlocked(payload, 'the working tree has local changes', repoDir, {
                currentBranch,
                remoteSha,
                status,
            });
            return { status: 'blocked', reason: 'dirty-worktree', repoDir };
        }

        const { ahead, behind } = await getAheadBehind(repoDir);
        if (ahead > 0) {
            await notifyBlocked(payload, `local ${SYNC_BRANCH} has commits that are not on origin/${SYNC_BRANCH}`, repoDir, {
                currentBranch,
                remoteSha,
                ahead,
                behind,
            });
            return { status: 'blocked', reason: 'local-ahead', repoDir };
        }

        if (behind === 0 || beforeSha === remoteSha) {
            console.log(`[repo-sync] ${fullName} already up to date at ${shortSha(remoteSha)}.`);
            return { status: 'up-to-date', repoDir, sha: remoteSha };
        }

        if (DRY_RUN) {
            console.log(`[repo-sync] Dry run: would pull ${fullName} ${shortSha(beforeSha)} -> ${shortSha(remoteSha)}.`);
            return { status: 'dry-run', repoDir, beforeSha, remoteSha };
        }

        await runGit(repoDir, ['pull', '--ff-only', 'origin', SYNC_BRANCH]);
        const afterSha = await getRev(repoDir, 'HEAD');

        await notifyPulled(payload, repoDir, beforeSha, afterSha);
        return { status: 'pulled', repoDir, beforeSha, afterSha };
    }).catch(async (error) => {
        await notifyFailure(payload, error, { fullName, repoDir, deliveryId });
        throw error;
    });
}

function enqueueRepo(queueKey, work) {
    const previous = repoQueues.get(queueKey) || Promise.resolve();
    const next = previous
        .catch(() => undefined)
        .then(work)
        .finally(() => {
            if (repoQueues.get(queueKey) === next) {
                repoQueues.delete(queueKey);
            }
        });

    repoQueues.set(queueKey, next);
    return next;
}

function rememberDelivery(deliveryId) {
    if (!deliveryId) return false;
    if (handledDeliverySet.has(deliveryId)) return true;

    handledDeliverySet.add(deliveryId);
    handledDeliveries.push(deliveryId);

    while (handledDeliveries.length > 1000) {
        const old = handledDeliveries.shift();
        handledDeliverySet.delete(old);
    }

    return false;
}

function verifySignature(rawBody, signatureHeader) {
    if (ALLOW_UNSIGNED_WEBHOOK) return true;
    if (!WEBHOOK_SECRET) return false;
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

    const expected = `sha256=${crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')}`;

    const actualBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function readRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;

        req.on('data', (chunk) => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
                reject(new Error(`Request body exceeded ${MAX_BODY_BYTES} bytes.`));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });

        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

async function handleWebhook(req, res) {
    let rawBody;
    try {
        rawBody = await readRawBody(req);
    } catch (err) {
        json(res, 413, { ok: false, error: err.message });
        return;
    }

    if (!verifySignature(rawBody, req.headers['x-hub-signature-256'])) {
        json(res, 401, { ok: false, error: 'Invalid or missing GitHub webhook signature.' });
        return;
    }

    const event = String(req.headers['x-github-event'] || '');
    const deliveryId = String(req.headers['x-github-delivery'] || '');

    if (rememberDelivery(deliveryId)) {
        json(res, 202, { ok: true, status: 'duplicate-delivery' });
        return;
    }

    let payload;
    try {
        payload = JSON.parse(rawBody.toString('utf8'));
    } catch (err) {
        json(res, 400, { ok: false, error: `Invalid JSON payload: ${err.message}` });
        return;
    }

    if (event === 'ping') {
        json(res, 200, { ok: true, status: 'pong' });
        return;
    }

    if (event !== 'push') {
        json(res, 202, { ok: true, status: 'ignored', reason: `event ${event}` });
        return;
    }

    if (PROCESS_INLINE) {
        try {
            const result = await syncRepoFromPush(payload, deliveryId);
            json(res, 200, { ok: true, ...result });
        } catch (err) {
            json(res, 500, { ok: false, error: err.message });
        }
        return;
    }

    syncRepoFromPush(payload, deliveryId).catch((err) => {
        console.error(`[repo-sync] Async sync failed: ${err.stack || err.message}`);
    });

    json(res, 202, { ok: true, status: 'accepted' });
}

async function handleHealth(res) {
    let watchedRepos = [];
    try {
        const repoMap = await buildRepoMap();
        watchedRepos = Array.from(repoMap.entries()).map(([fullName, dir]) => ({ fullName, dir }));
    } catch (err) {
        json(res, 500, { ok: false, error: err.message });
        return;
    }

    json(res, 200, {
        ok: true,
        service: 'github-main-sync-webhook',
        branch: SYNC_BRANCH,
        webhookPath: WEBHOOK_PATH,
        watchedRepos,
        notifications: DISABLE_NOTIFICATIONS ? 'disabled' : 'pulsecommand',
        dryRun: DRY_RUN,
    });
}

function createServer() {
    return http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

        if (req.method === 'GET' && url.pathname === HEALTH_PATH) {
            await handleHealth(res);
            return;
        }

        if (req.method === 'POST' && url.pathname === WEBHOOK_PATH) {
            await handleWebhook(req, res);
            return;
        }

        text(res, 404, 'not found\n');
    });
}

function main() {
    if (!WEBHOOK_SECRET && !ALLOW_UNSIGNED_WEBHOOK) {
        console.error('GITHUB_WEBHOOK_SECRET is required unless ALLOW_UNSIGNED_WEBHOOK=true is set for local-only testing.');
        process.exit(1);
    }

    const server = createServer();
    server.listen(PORT, HOST, () => {
        console.log(`[repo-sync] Listening on http://${HOST}:${PORT}${WEBHOOK_PATH}`);
        console.log(`[repo-sync] Health: http://${HOST}:${PORT}${HEALTH_PATH}`);
        console.log(`[repo-sync] Watching branch: ${SYNC_BRANCH}`);
        console.log(`[repo-sync] Repo root: ${WATCH_REPO_ROOT}`);
    });
}

if (require.main === module) {
    main();
}

module.exports = {
    buildRepoMap,
    createServer,
    extractBranch,
    normalizeFullName,
    normalizeRemoteToFullName,
    parseWatchReposJson,
    syncRepoFromPush,
};
