const {
  cleanupSessionState,
  createDeviceSessionToken,
  json,
  parseBody,
  sanitizeSession,
  sha256,
  withVisionProContext,
} = require('./vision-pro-trials-utils');

async function findSessionByToken(db, token, pairingCode) {
  if (token) {
    const tokenHash = sha256(token);
    const snap = await db.collection('vision-pro-trial-sessions')
      .where('launchTokenHash', '==', tokenHash)
      .limit(1)
      .get();
    if (!snap.empty) {
      return snap.docs[0];
    }
  }

  if (pairingCode) {
    const codeHash = sha256(pairingCode);
    const snap = await db.collection('vision-pro-trial-sessions')
      .where('launchCodeHash', '==', codeHash)
      .limit(1)
      .get();
    if (!snap.empty) {
      return snap.docs[0];
    }
  }

  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const { db } = await withVisionProContext(event);
    const { token, pairingCode, deviceId, deviceName } = parseBody(event);

    if ((!token && !pairingCode) || !deviceId) {
      return json(400, { error: 'token or pairingCode and deviceId are required' });
    }

    const sessionDoc = await findSessionByToken(db, token, pairingCode);
    if (!sessionDoc) {
      return json(404, { error: 'No matching Vision Pro session found' });
    }

    const sessionRef = sessionDoc.ref;
    const sessionData = await cleanupSessionState(sessionRef, sessionDoc.data());

    if (sessionData.status !== 'queued') {
      return json(409, { error: `Session is not claimable from status ${sessionData.status}` });
    }

    if (sessionData.reservedDeviceId && sessionData.reservedDeviceId !== deviceId) {
      return json(403, { error: 'This session is reserved for a different headset' });
    }

    const deviceSession = createDeviceSessionToken();
    const now = Date.now();
    const updates = {
      status: 'claimed',
      claimedAt: now,
      claimedDeviceId: deviceId,
      claimedDeviceName: deviceName || 'Vision Pro',
      deviceSessionTokenHash: deviceSession.tokenHash,
      launchTokenHash: null,
      launchCodeHash: null,
      tokenExpiresAt: null,
      updatedAt: now,
    };

    await sessionRef.update(updates);

    return json(200, {
      session: sanitizeSession(sessionDoc.id, { ...sessionData, ...updates }),
      deviceSessionToken: deviceSession.rawToken,
    });
  } catch (error) {
    console.error('[claim-vision-pro-trial-session] Error:', error);
    return json(500, {
      error: error.message || 'Failed to claim Vision Pro session',
    });
  }
};
