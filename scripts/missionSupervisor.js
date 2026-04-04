#!/usr/bin/env node
'use strict';

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
    DEFAULT_STALL_WINDOW_MINUTES,
    MISSION_SYSTEM_VERSION,
    OUTCOME_COLLECTION,
    advanceOutcomeObservation,
    buildObjectiveId,
    isExecuteMissionActive,
    normalizeMissionPolicy,
    recordMissionRunEvent,
    summarizeMissionOutcomes,
    toMillis,
} = require('./missionOsV2');

const SERVICE_ACCOUNT = {
    type: 'service_account',
    project_id: 'quicklifts-dd3f1',
    private_key_id: 'abbd015806ef3b43d93101522f12d029e736f447',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEZkOP1Kz/jfQc\nLrN2SKLVdRNCZHGHN+wcfqQXknnD47Y6GBA35O1573Ipk5FaRNvxysB/YP/Z9dLP\nOO/xk8yRA+FFI32kzQlBIpVHDVN/upfXRWS/38+1kktPD3EjwEFRB8HvYVopCm1k\nCaFOZZfrrHM2IEdboKDt3ByLoNNPLZhivcurhBm4PENNEVlyMiqqWBwTu0sFGkZ8\nLHQ4JGtaPe5VomlpVlokKmdQzEwVTWexSeQkbdXnYkd1m/sfT3mjP6RLBlXlJ4f/\nOp36QofqPxNRV7TJ/YkrL2nOLo6gq6XWS3ciVINUS9cuPlEIg+5OrR4eQUYhay3N\n5dakXn+ZAgMBAAECggEAJv+de9KB1a8E4ZG+bgbnWpaIT/8s8eo/Vrso70tVJXoy\nhZ+gnNC2/Sb4VtwoGTIiMIWPqtuCgm/HQAGw15n/HW6VTUrKWK6kH0x0MuspAOx2\n2Ta81kLldksJ7DWHRE+ZSLNPJa8BnbOl3B7zamNPAuu35vAK611eh0zVWD6Dpy1v\n7933i/pOMpvDY0ieoT0pl0GJcCVOBTS2f8z1+huepW5++G0TrTCZdq9ixCF68xEc\nyGTr1Dz/Qdv4gIO2SNk3TfKmw/HaL3tQM1izdMsJVs+nPxzmHj3tLnppyQJJFwcF\nZ1njhg6eSHPOINU/wu2KL2B+pXiROBLQr1JnvJsCZwKBgQDsYNrmbDhShYeU+OSs\nSaQx0POBeZFtlsMIbJomTSDr73Gn4ZXJaXfNoqvIuJel5SCTytK36Y+84/S3xeuy\nmXGMpfqBmEilMU5D4VOmSH/HFH6+35m1LWFw3aWSVGuUSIEQoWTKjWB9zQVwFd5w\nEw6HsuNm1IJvsEfZpzXpcydBMwKBgQDUs9cLfY93MbkT5M/WL9jbPp846HZxvzeW\nGiBR7gMAPMre32DPDKQKqnRVAvXJPhd8mKjC3T4gRm+NBWKLQjIUO0RQoVG39HN/\n9yGBTyLMccJf5d9MZe5OIwkVhbN5ekPucNhqHJQEIVz0duZ7UhFgfgLSroy/04vA\ndjgGeGxUAwKBgD+9Pkm0FNvrtcut8bujf+sO9RqMtXJfnOfAoTCCy8XTI0qpwcI1\n9mA05S2S2RGa31X68yc0i9Xbgjmr3Qqj5cKPXyVi8vPYf8o+EFheZFZCaIr/sGry\nebv9iJAUw42Qn3zkiFE2HjbN+hFnVDvUZ66fxkIMO7/yQO2n8RmqO4ORAoGAFbqV\nglf+WvfaZ1zdmoziw2r/Swn8Z5xYKl5a5OPCrLiJJQF+20f4ThqhrbmSsE9GiPTz\ncIy3dwabCLX/HijSAt0XGoGQXpF7Zxww8QvLi0UnzTIngJ99G8BagjdZYVSLMgWX\nJifrOwzJeTPYUcrNeaUF1s38FPCgezXYfVi6AE8CgYEAv+9EP3q6zY51CMtXKb04\n1yLrnZze20aUMmAQ0KE1nH9ZRk7GgT+Bbmq1Nw6Ro3xItPffX42S5w8jDhiZJK/j\neVGloaXM9MHG2uTPWSVlUJ2ew2LcYpq42PbJUuS06teFFPohMCOs7urTc0Vdya5u\ngTynFJmBFslLO3UKNPAshn0=\n-----END PRIVATE KEY-----\n',
    client_email: 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com',
    client_id: '111494077667496751062',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com',
    universe_domain: 'googleapis.com',
};

const appName = `mission-supervisor-${process.pid}`;
const existing = getApps().find((app) => app.name === appName);
const app = existing || initializeApp({ credential: cert(SERVICE_ACCOUNT) }, appName);
const db = getFirestore(app);

const MISSION_DOC = 'company-config/mission-status';
const KANBAN_COLLECTION = 'agent-tasks';
const POLL_MS = parseInt(process.env.MISSION_SUPERVISOR_POLL_MS || '30000', 10);
const MISSION_ID = (process.argv.find((arg) => arg.startsWith('--mission-id=')) || '').split('=')[1] || process.env.MISSION_ID || '';

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function dependenciesSatisfied(task, tasksById) {
    const dependencyIds = Array.isArray(task?.dependencyIds) ? task.dependencyIds : [];
    if (dependencyIds.length === 0) return true;
    return dependencyIds.every((dependencyId) => {
        const dependency = tasksById.get(dependencyId);
        return dependency && String(dependency.status || '').toLowerCase() === 'done';
    });
}

function computeObjectiveProgress(mission, tasks) {
    const existing = mission?.objectiveProgress && typeof mission.objectiveProgress === 'object'
        ? mission.objectiveProgress
        : {};
    const progress = {};

    for (const task of tasks) {
        const objectiveId = String(task?.objectiveId || buildObjectiveId(task?.northStarObjectiveLink || task?.northStarObjective || task?.name, 'OBJECTIVE')).trim();
        if (!objectiveId) continue;
        const entry = progress[objectiveId] || {
            title: existing?.[objectiveId]?.title || task?.northStarObjectiveLink || task?.northStarObjective || objectiveId,
            verifiedDeliverableCount: Number(existing?.[objectiveId]?.verifiedDeliverableCount || 0),
            openTaskCount: 0,
            completedTaskCount: 0,
            blockedTaskCount: 0,
            needsReviewTaskCount: 0,
        };

        const status = String(task?.status || '').toLowerCase();
        if (status === 'done') {
            entry.completedTaskCount += 1;
        } else if (status === 'needs-review') {
            entry.needsReviewTaskCount += 1;
        } else if (status === 'blocked') {
            entry.blockedTaskCount += 1;
            entry.openTaskCount += 1;
        } else if (status === 'todo' || status === 'in-progress' || status === 'needs-spec') {
            entry.openTaskCount += 1;
        }

        progress[objectiveId] = entry;
    }

    for (const [objectiveId, entry] of Object.entries(existing)) {
        if (!progress[objectiveId]) {
            progress[objectiveId] = entry;
        }
    }

    return progress;
}

async function releaseBlockedExecuteTasks(tasks, missionPolicy) {
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const executeTasksByAgent = {};

    for (const task of tasks) {
        const assignee = String(task?.assignee || '').trim();
        if (!assignee) continue;
        if (!executeTasksByAgent[assignee]) executeTasksByAgent[assignee] = [];
        executeTasksByAgent[assignee].push(task);
    }

    let releasedCount = 0;
    for (const [assignee, agentTasks] of Object.entries(executeTasksByAgent)) {
        const activeOrQueued = agentTasks.filter((task) => ['todo', 'in-progress'].includes(String(task?.status || '').toLowerCase()));
        if (activeOrQueued.length >= missionPolicy.maxQueuedExecuteTasksPerAgent) continue;

        const blockedCandidates = agentTasks
            .filter((task) => String(task?.status || '').toLowerCase() === 'blocked')
            .filter((task) => dependenciesSatisfied(task, tasksById))
            .sort((a, b) => Number(b?.priorityScore || 0) - Number(a?.priorityScore || 0));

        const nextTask = blockedCandidates[0];
        if (!nextTask) continue;

        await db.collection(KANBAN_COLLECTION).doc(nextTask.id).update({
            status: 'todo',
            plannerReleasedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        releasedCount += 1;
        await recordMissionRunEvent(db, FieldValue, MISSION_ID, 'planner-release', {
            taskId: nextTask.id,
            assignee,
            objectiveId: nextTask.objectiveId || '',
        });
    }

    return releasedCount;
}

async function updateMissionState(mission, tasks, outcomes = []) {
    const missionPolicy = normalizeMissionPolicy(mission);
    const objectiveProgress = computeObjectiveProgress(mission, tasks);
    const quarantinedTaskCount = tasks.filter((task) => String(task?.status || '').toLowerCase() === 'quarantined').length;
    const outcomeSummary = summarizeMissionOutcomes(outcomes);
    const lastVerifiedAtMs = toMillis(mission?.lastVerifiedDeliverableAt || mission?.startedAt || mission?.updatedAt);
    const stallWindowMs = (missionPolicy.stallWindowMinutes || DEFAULT_STALL_WINDOW_MINUTES) * 60 * 1000;
    const nowMs = Date.now();
    const stalled = lastVerifiedAtMs > 0 && (nowMs - lastVerifiedAtMs) >= stallWindowMs;

    if (stalled) {
        const lastVerifiedAtIso = new Date(lastVerifiedAtMs).toISOString();
        const pausedPatch = {
            status: 'paused',
            missionPhase: 'paused',
            plannerState: 'paused-stalled',
            autopauseReason: `Mission auto-paused after ${missionPolicy.stallWindowMinutes} minutes without a newly verified deliverable. Last verified deliverable: ${lastVerifiedAtIso}.`,
            updatedAt: FieldValue.serverTimestamp(),
            objectiveProgress,
            quarantinedTaskCount,
            ...outcomeSummary,
        };
        await db.doc(MISSION_DOC).set(pausedPatch, { merge: true });
        await db.collection('mission-runs').doc(MISSION_ID).set({
            missionId: MISSION_ID,
            updatedAt: FieldValue.serverTimestamp(),
            objectiveProgress,
            quarantinedTaskCount,
            ...outcomeSummary,
        }, { merge: true });
        await recordMissionRunEvent(db, FieldValue, MISSION_ID, 'stall-pause', {
            lastVerifiedDeliverableAt: lastVerifiedAtIso,
            stallWindowMinutes: missionPolicy.stallWindowMinutes,
        });
        return 'paused';
    }

    const releasedCount = await releaseBlockedExecuteTasks(tasks, missionPolicy);
    const activePatch = {
        plannerState: releasedCount > 0 ? 'releasing-work' : 'supervising',
        updatedAt: FieldValue.serverTimestamp(),
        objectiveProgress,
        quarantinedTaskCount,
        supervisorHeartbeatAt: FieldValue.serverTimestamp(),
        missionPhase: 'execution',
        ...outcomeSummary,
    };
    await db.doc(MISSION_DOC).set(activePatch, { merge: true });
    await db.collection('mission-runs').doc(MISSION_ID).set({
        missionId: MISSION_ID,
        updatedAt: FieldValue.serverTimestamp(),
        objectiveProgress,
        quarantinedTaskCount,
        ...outcomeSummary,
    }, { merge: true });
    return 'active';
}

async function loadMissionTasks(missionId) {
    const snap = await db.collection(KANBAN_COLLECTION)
        .where('missionId', '==', missionId)
        .get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function loadMissionOutcomes(missionId) {
    const snap = await db.collection(OUTCOME_COLLECTION)
        .where('missionId', '==', missionId)
        .get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function advanceObservingOutcomes(outcomes) {
    let confirmedCount = 0;
    for (const outcome of outcomes) {
        const patch = advanceOutcomeObservation(outcome, Date.now());
        if (!patch) continue;
        await db.collection(OUTCOME_COLLECTION).doc(outcome.id).set({
            ...patch,
        }, { merge: true });
        confirmedCount += 1;
        await recordMissionRunEvent(db, FieldValue, MISSION_ID, 'confirmed-outcome', {
            outcomeId: outcome.id,
            objectiveId: outcome.objectiveId || '',
            previousStatus: outcome.status || 'observing',
        });
    }
    return confirmedCount;
}

async function run() {
    if (!MISSION_ID) {
        console.error('Missing mission id. Use --mission-id=<id> or set MISSION_ID.');
        process.exit(1);
    }

    console.log(`🧭 Mission supervisor started for ${MISSION_ID}`);
    while (true) {
        try {
            const missionSnap = await db.doc(MISSION_DOC).get();
            const mission = missionSnap.exists ? (missionSnap.data() || {}) : {};
            if (String(mission?.missionId || '') !== MISSION_ID) {
                console.log(`Mission ${MISSION_ID} is no longer current. Exiting supervisor.`);
                break;
            }

            const missionPolicy = normalizeMissionPolicy(mission);
            if (!isExecuteMissionActive(mission) || missionPolicy.systemVersion < MISSION_SYSTEM_VERSION) {
                if (String(mission?.status || '').toLowerCase() !== 'active') {
                    console.log(`Mission ${MISSION_ID} is ${mission?.status || 'unknown'}. Exiting supervisor.`);
                    break;
                }
                await sleep(POLL_MS);
                continue;
            }

            const tasks = await loadMissionTasks(MISSION_ID);
            await advanceObservingOutcomes(await loadMissionOutcomes(MISSION_ID));
            const outcomes = await loadMissionOutcomes(MISSION_ID);
            const result = await updateMissionState(mission, tasks, outcomes);
            if (result === 'paused') break;
        } catch (err) {
            console.error(`Mission supervisor loop failed: ${err.message}`);
        }

        await sleep(POLL_MS);
    }

    process.exit(0);
}

run();
