const {
  CURRICULUM_ASSIGNMENTS_COLLECTION,
  LEGACY_ASSIGNMENTS_COLLECTION,
  json,
  loadAssignmentContext,
  parseBody,
  sanitizeSession,
  sendVisionProQueuedNotification,
  verifyAuth,
  withVisionProContext,
} = require('./vision-pro-trials-utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const { admin, db } = await withVisionProContext(event);
    const decoded = await verifyAuth(admin, event);
    const body = parseBody(event);

    const assignmentCollection = body.assignmentCollection;
    const assignmentId = body.assignmentId;

    if (!assignmentId || !assignmentCollection) {
      return json(400, { error: 'assignmentId and assignmentCollection are required' });
    }

    if (
      assignmentCollection !== CURRICULUM_ASSIGNMENTS_COLLECTION &&
      assignmentCollection !== LEGACY_ASSIGNMENTS_COLLECTION
    ) {
      return json(400, { error: 'Unsupported assignmentCollection' });
    }

    const assignmentContext = await loadAssignmentContext(db, assignmentCollection, assignmentId);
    if (assignmentContext.coachId !== decoded.uid) {
      return json(403, { error: 'You do not have permission to queue this assignment' });
    }

    const now = Date.now();
    const sessionRef = db.collection('vision-pro-trial-sessions').doc();
    const sessionData = {
      assignmentId,
      assignmentCollection,
      athleteUserId: assignmentContext.athleteUserId,
      simId: body.simId || assignmentContext.simId,
      simName: body.simName || assignmentContext.simName,
      status: 'queued',
      reservedDeviceId: body.reservedDeviceId || null,
      reservedDeviceName: body.reservedDeviceName || null,
      launchTokenHash: null,
      launchCodeHash: null,
      tokenExpiresAt: null,
      claimedAt: null,
      claimedDeviceId: null,
      claimedDeviceName: null,
      deviceSessionTokenHash: null,
      startedAt: null,
      completedAt: null,
      abandonedAt: null,
      resultSummary: null,
      createdByUserId: decoded.uid,
      createdByName: body.createdByName || decoded.name || decoded.email || 'Coach',
      createdAt: now,
      updatedAt: now,
    };

    await sessionRef.set(sessionData);
    await sendVisionProQueuedNotification(admin, db, {
      athleteUserId: assignmentContext.athleteUserId,
      sessionId: sessionRef.id,
      assignmentId,
      assignmentCollection,
      simId: sessionData.simId,
      simName: sessionData.simName,
      coachDisplayName: sessionData.createdByName,
    });

    return json(200, {
      session: sanitizeSession(sessionRef.id, sessionData),
    });
  } catch (error) {
    console.error('[create-vision-pro-trial-session] Error:', error);
    return json(500, {
      error: error.message || 'Failed to create Vision Pro trial session',
    });
  }
};
