const {
  cleanupSessionState,
  createLaunchToken,
  getSessionDoc,
  json,
  sanitizeSession,
  parseBody,
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
    const { sessionId } = parseBody(event);

    if (!sessionId) {
      return json(400, { error: 'sessionId is required' });
    }

    const { ref, data } = await getSessionDoc(db, sessionId);
    const sessionData = await cleanupSessionState(ref, data);

    if (sessionData.athleteUserId !== decoded.uid) {
      return json(403, { error: 'You do not have permission to launch this session' });
    }

    if (!['queued', 'expired'].includes(sessionData.status)) {
      return json(409, { error: `Session cannot be launched from status ${sessionData.status}` });
    }

    const launchToken = createLaunchToken();
    const now = Date.now();
    const updates = {
      status: 'queued',
      launchTokenHash: launchToken.tokenHash,
      launchCodeHash: launchToken.pairingCodeHash,
      tokenExpiresAt: launchToken.expiresAt,
      updatedAt: now,
      expiredAt: null,
    };

    await ref.update(updates);

    return json(200, {
      session: sanitizeSession(sessionId, { ...sessionData, ...updates }),
      launchToken: {
        token: launchToken.rawToken,
        pairingCode: launchToken.pairingCode,
        expiresAt: launchToken.expiresAt,
      },
    });
  } catch (error) {
    console.error('[mint-vision-pro-launch-token] Error:', error);
    return json(500, {
      error: error.message || 'Failed to mint Vision Pro launch token',
    });
  }
};
