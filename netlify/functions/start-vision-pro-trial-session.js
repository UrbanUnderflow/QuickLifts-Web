const {
  cleanupSessionState,
  getSessionDoc,
  json,
  parseBody,
  sanitizeSession,
  sha256,
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
    const { db } = await withVisionProContext(event);
    const { sessionId, deviceId, deviceSessionToken } = parseBody(event);

    if (!sessionId || !deviceId || !deviceSessionToken) {
      return json(400, { error: 'sessionId, deviceId, and deviceSessionToken are required' });
    }

    const { ref, data } = await getSessionDoc(db, sessionId);
    const sessionData = await cleanupSessionState(ref, data);

    if (sessionData.status !== 'claimed') {
      return json(409, { error: `Session cannot start from status ${sessionData.status}` });
    }

    if (sessionData.claimedDeviceId !== deviceId) {
      return json(403, { error: 'This session was claimed by a different device' });
    }

    if (sessionData.deviceSessionTokenHash !== sha256(deviceSessionToken)) {
      return json(403, { error: 'Invalid device session token' });
    }

    const updates = {
      status: 'running',
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await ref.update(updates);

    return json(200, {
      session: sanitizeSession(sessionId, { ...sessionData, ...updates }),
    });
  } catch (error) {
    console.error('[start-vision-pro-trial-session] Error:', error);
    return json(500, {
      error: error.message || 'Failed to start Vision Pro session',
    });
  }
};
