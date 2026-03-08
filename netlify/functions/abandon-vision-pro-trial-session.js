const {
  cleanupSessionState,
  getSessionDoc,
  json,
  parseBody,
  sanitizeSession,
  sha256,
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
    const { sessionId, deviceId, deviceSessionToken, reason } = parseBody(event);

    if (!sessionId) {
      return json(400, { error: 'sessionId is required' });
    }

    const { ref, data } = await getSessionDoc(db, sessionId);
    const sessionData = await cleanupSessionState(ref, data);

    let authorized = false;

    if (deviceId && deviceSessionToken) {
      authorized =
        sessionData.claimedDeviceId === deviceId &&
        sessionData.deviceSessionTokenHash === sha256(deviceSessionToken);
    }

    if (!authorized) {
      try {
        const decoded = await verifyAuth(admin, event);
        authorized = decoded.uid === sessionData.athleteUserId || decoded.uid === sessionData.createdByUserId;
      } catch (error) {
        authorized = false;
      }
    }

    if (!authorized) {
      return json(403, { error: 'Not authorized to abandon this session' });
    }

    if (['completed', 'abandoned'].includes(sessionData.status)) {
      return json(409, { error: `Session is already ${sessionData.status}` });
    }

    const updates = {
      status: 'abandoned',
      abandonedAt: Date.now(),
      abandonReason: reason || 'user_cancelled',
      launchTokenHash: null,
      launchCodeHash: null,
      tokenExpiresAt: null,
      deviceSessionTokenHash: null,
      updatedAt: Date.now(),
    };

    await ref.update(updates);

    return json(200, {
      session: sanitizeSession(sessionId, { ...sessionData, ...updates }),
    });
  } catch (error) {
    console.error('[abandon-vision-pro-trial-session] Error:', error);
    return json(500, {
      error: error.message || 'Failed to abandon Vision Pro session',
    });
  }
};
