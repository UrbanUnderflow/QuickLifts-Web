const crypto = require('crypto');
const { initializeFirebaseAdmin } = require('./config/firebase');

const COLLECTION = 'vision-pro-trial-sessions';
const USERS_COLLECTION = 'users';
const EXERCISES_COLLECTION = 'mental-exercises';
const LEGACY_ASSIGNMENTS_COLLECTION = 'mental-exercise-assignments';
const CURRICULUM_ASSIGNMENTS_COLLECTION = 'mental-curriculum-assignments';
const CURRICULUM_DAILY_COMPLETIONS_SUBCOLLECTION = 'daily-completions';
const SIM_SESSIONS_COLLECTION = 'sim-sessions';

const TOKEN_TTL_MS = 2 * 60 * 1000;
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...baseHeaders,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

function normalizeCollectionName(value) {
  if (value === CURRICULUM_ASSIGNMENTS_COLLECTION || value === LEGACY_ASSIGNMENTS_COLLECTION) {
    return value;
  }
  throw new Error('Unsupported assignmentCollection');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createLaunchToken() {
  const token = crypto.randomBytes(24).toString('base64url');
  const pairingCode = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  return {
    rawToken: token,
    tokenHash: sha256(token),
    pairingCode,
    pairingCodeHash: sha256(pairingCode),
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
}

function createDeviceSessionToken() {
  const token = crypto.randomBytes(24).toString('base64url');
  return {
    rawToken: token,
    tokenHash: sha256(token),
  };
}

function getDateString(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().split('T')[0];
}

function getCurrentDayNumber(startDate, currentDate = Date.now()) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const current = new Date(currentDate);
  current.setHours(0, 0, 0, 0);
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

async function verifyAuth(admin, event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header');
  }

  const idToken = authHeader.slice('Bearer '.length);
  return admin.auth().verifyIdToken(idToken);
}

async function getSessionDoc(db, sessionId) {
  const sessionRef = db.collection(COLLECTION).doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new Error('Vision Pro session not found');
  }

  return {
    ref: sessionRef,
    snap: sessionSnap,
    data: sessionSnap.data(),
  };
}

async function loadAssignmentContext(db, assignmentCollection, assignmentId) {
  const normalizedCollection = normalizeCollectionName(assignmentCollection);
  const assignmentRef = db.collection(normalizedCollection).doc(assignmentId);
  const assignmentSnap = await assignmentRef.get();

  if (!assignmentSnap.exists) {
    throw new Error('Assignment not found');
  }

  const assignment = assignmentSnap.data();
  const athleteUserId =
    normalizedCollection === CURRICULUM_ASSIGNMENTS_COLLECTION
      ? assignment.athleteId
      : assignment.athleteUserId;
  const coachId =
    normalizedCollection === CURRICULUM_ASSIGNMENTS_COLLECTION
      ? assignment.coachId
      : assignment.assignedBy;
  const exerciseId = assignment.exerciseId;

  let exercise = assignment.exercise || null;
  if (!exercise && exerciseId) {
    const exerciseSnap = await db.collection(EXERCISES_COLLECTION).doc(exerciseId).get();
    if (exerciseSnap.exists) {
      exercise = exerciseSnap.data();
    }
  }

  return {
    assignmentRef,
    assignment,
    athleteUserId,
    coachId,
    exerciseId,
    exercise,
    simId: assignment.simSpecId || exercise?.simSpecId || exerciseId || 'vision_pro_trial',
    simName: exercise?.name || assignment.exerciseName || assignment.exercise?.name || 'Vision Pro Trial',
  };
}

async function cleanupSessionState(sessionRef, sessionData) {
  const now = Date.now();
  const updates = {};

  if (
    sessionData.status === 'queued' &&
    typeof sessionData.tokenExpiresAt === 'number' &&
    sessionData.tokenExpiresAt <= now
  ) {
    updates.status = 'expired';
    updates.expiredAt = now;
  }

  if (
    sessionData.status === 'claimed' &&
    typeof sessionData.claimedAt === 'number' &&
    sessionData.claimedAt + CLAIM_TIMEOUT_MS <= now &&
    !sessionData.startedAt
  ) {
    updates.status = 'abandoned';
    updates.abandonedAt = now;
    updates.abandonReason = 'claim_timeout';
  }

  if (Object.keys(updates).length === 0) {
    return { ...sessionData };
  }

  updates.launchTokenHash = null;
  updates.launchCodeHash = null;
  updates.tokenExpiresAt = null;
  updates.deviceSessionTokenHash = null;
  updates.updatedAt = now;
  await sessionRef.update(updates);
  return { ...sessionData, ...updates };
}

function sanitizeSession(sessionId, sessionData) {
  return {
    id: sessionId,
    assignmentId: sessionData.assignmentId,
    assignmentCollection: sessionData.assignmentCollection,
    athleteUserId: sessionData.athleteUserId,
    simId: sessionData.simId,
    simName: sessionData.simName,
    status: sessionData.status,
    reservedDeviceId: sessionData.reservedDeviceId || null,
    claimedDeviceId: sessionData.claimedDeviceId || null,
    claimedDeviceName: sessionData.claimedDeviceName || null,
    claimedAt: sessionData.claimedAt || null,
    startedAt: sessionData.startedAt || null,
    completedAt: sessionData.completedAt || null,
    abandonedAt: sessionData.abandonedAt || null,
    tokenExpiresAt: sessionData.tokenExpiresAt || null,
    resultSummary: sessionData.resultSummary || null,
    createdByUserId: sessionData.createdByUserId || null,
    createdAt: sessionData.createdAt || null,
    updatedAt: sessionData.updatedAt || null,
  };
}

async function sendVisionProQueuedNotification(admin, db, {
  athleteUserId,
  sessionId,
  assignmentId,
  assignmentCollection,
  simId,
  simName,
  coachDisplayName,
}) {
  const userSnap = await db.collection(USERS_COLLECTION).doc(athleteUserId).get();
  if (!userSnap.exists) {
    return;
  }

  const userData = userSnap.data() || {};
  const fcmToken = userData.fcmToken;
  if (!fcmToken) {
    return;
  }

  const title = 'Vision Pro trial ready';
  const body = `${coachDisplayName || 'Your coach'} queued ${simName}. Open Pulse Check to pair the headset.`;

  await admin.messaging().send({
    token: fcmToken,
    notification: { title, body },
    data: {
      type: 'VISION_PRO_TRIAL_READY',
      sessionId,
      assignmentId,
      assignmentCollection,
      athleteUserId,
      simId,
      simName,
      coachDisplayName: coachDisplayName || 'Coach',
      queuedAt: String(Date.now()),
    },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
        },
      },
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
      },
    },
  });
}

async function recordCurriculumCompletion(db, assignmentId, durationSeconds, postMood) {
  const assignmentRef = db.collection(CURRICULUM_ASSIGNMENTS_COLLECTION).doc(assignmentId);
  const assignmentSnap = await assignmentRef.get();
  if (!assignmentSnap.exists) {
    throw new Error('Curriculum assignment not found');
  }

  const assignment = assignmentSnap.data();
  const now = Date.now();
  const dateString = getDateString(now);
  const dailyRef = assignmentRef.collection(CURRICULUM_DAILY_COMPLETIONS_SUBCOLLECTION).doc(dateString);
  const dailySnap = await dailyRef.get();
  const completionRecord = {
    completedAt: now,
    durationSeconds,
    postMood: typeof postMood === 'number' ? postMood : null,
  };

  if (dailySnap.exists) {
    const existing = dailySnap.data();
    const completions = Array.isArray(existing.completions) ? existing.completions : [];
    const updatedCompletions = [...completions, completionRecord];
    const targetCount = Number.isFinite(existing.targetCount) ? existing.targetCount : assignment.frequency || 1;

    await dailyRef.update({
      completionCount: updatedCompletions.length,
      completed: updatedCompletions.length >= targetCount,
      completions: updatedCompletions,
      updatedAt: now,
    });
  } else {
    const targetCount = assignment.frequency || 1;
    await dailyRef.set({
      date: dateString,
      completed: 1 >= targetCount,
      completionCount: 1,
      targetCount,
      completions: [completionRecord],
      createdAt: now,
      updatedAt: now,
    });
  }

  const dailySnapshots = await assignmentRef
    .collection(CURRICULUM_DAILY_COMPLETIONS_SUBCOLLECTION)
    .get();
  const completedDays = dailySnapshots.docs
    .map((doc) => doc.data())
    .filter((data) => data.completed)
    .length;
  const targetDays = assignment.targetDays || assignment.durationDays || 14;
  const completionRate = targetDays > 0
    ? Math.round((completedDays / targetDays) * 100)
    : 0;

  await assignmentRef.update({
    completedDays,
    currentDayNumber: getCurrentDayNumber(assignment.startDate || now, now),
    completionRate,
    updatedAt: now,
  });
}

async function recordLegacyAssignmentCompletion(db, assignmentId) {
  await db.collection(LEGACY_ASSIGNMENTS_COLLECTION).doc(assignmentId).update({
    status: 'completed',
    completedAt: Date.now() / 1000,
    updatedAt: Date.now() / 1000,
  });
}

async function writeSimSession(db, athleteUserId, payload) {
  const sessionRef = db.collection(SIM_SESSIONS_COLLECTION)
    .doc(athleteUserId)
    .collection('sessions');
  const docRef = await sessionRef.add(payload);
  return docRef.id;
}

function buildResultSummary(resultPayload) {
  return {
    normalizedScore: resultPayload.normalizedScore ?? null,
    coreMetricName: resultPayload.coreMetricName || null,
    coreMetricValue: resultPayload.coreMetricValue ?? null,
    durationSeconds: resultPayload.durationSeconds ?? null,
    completedAt: Date.now(),
  };
}

async function withVisionProContext(event) {
  const admin = initializeFirebaseAdmin({ headers: event.headers || {} });
  const db = admin.firestore();
  return { admin, db };
}

async function cleanupExpiredVisionProSessions(db) {
  const now = Date.now();
  const queuedSnap = await db.collection(COLLECTION)
    .where('status', '==', 'queued')
    .where('tokenExpiresAt', '<=', now)
    .get();

  const claimedSnap = await db.collection(COLLECTION)
    .where('status', '==', 'claimed')
    .where('claimedAt', '<=', now - CLAIM_TIMEOUT_MS)
    .get();

  const updates = [];

  queuedSnap.forEach((doc) => {
    updates.push(doc.ref.update({
      status: 'expired',
      expiredAt: now,
      launchTokenHash: null,
      launchCodeHash: null,
      tokenExpiresAt: null,
      updatedAt: now,
    }));
  });

  claimedSnap.forEach((doc) => {
    updates.push(doc.ref.update({
      status: 'abandoned',
      abandonedAt: now,
      abandonReason: 'claim_timeout',
      launchTokenHash: null,
      launchCodeHash: null,
      tokenExpiresAt: null,
      deviceSessionTokenHash: null,
      updatedAt: now,
    }));
  });

  await Promise.all(updates);

  return {
    expiredQueuedSessions: queuedSnap.size,
    abandonedClaimedSessions: claimedSnap.size,
  };
}

module.exports = {
  CLAIM_TIMEOUT_MS,
  COLLECTION,
  CURRICULUM_ASSIGNMENTS_COLLECTION,
  LEGACY_ASSIGNMENTS_COLLECTION,
  baseHeaders,
  buildResultSummary,
  cleanupExpiredVisionProSessions,
  cleanupSessionState,
  createDeviceSessionToken,
  createLaunchToken,
  getSessionDoc,
  json,
  loadAssignmentContext,
  normalizeCollectionName,
  parseBody,
  recordCurriculumCompletion,
  recordLegacyAssignmentCompletion,
  sanitizeSession,
  sendVisionProQueuedNotification,
  sha256,
  verifyAuth,
  withVisionProContext,
  writeSimSession,
};
