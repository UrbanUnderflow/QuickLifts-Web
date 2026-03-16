const {
  buildVisionProProtocolIssues,
  cleanupSessionState,
  getSessionDoc,
  json,
  parseBody,
  resolveVisionProProtocolContext,
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
    const { sessionId, deviceId, deviceSessionToken, comfortCleared } = parseBody(event);

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

    const protocolContext = await resolveVisionProProtocolContext(db, sessionData.athleteUserId);
    const requiredFamilies =
      Array.isArray(sessionData.protocolContext?.requiredFamilies) && sessionData.protocolContext.requiredFamilies.length
        ? sessionData.protocolContext.requiredFamilies
        : sessionData.simId === 'vision_pro_football_package'
          ? ['reset', 'signal-window']
          : [sessionData.simId];
    const protocolIssues = buildVisionProProtocolIssues({
      trackedFamilies: requiredFamilies.map((family) => ({ family })),
      baselineReferences: sessionData.baselineReferences || [],
      protocolContext,
      comfortCleared: typeof comfortCleared === 'boolean' ? comfortCleared : sessionData.calibrationSummary?.comfortCleared,
      calibrationStatus: sessionData.calibrationSummary?.status || null,
      requireComfortScreen: true,
    });

    if (protocolIssues.length) {
      return json(409, {
        error: protocolIssues[0],
        protocolIssues,
      });
    }

    const updates = {
      status: 'running',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      calibrationSummary: {
        ...(sessionData.calibrationSummary || {}),
        comfortCleared: typeof comfortCleared === 'boolean' ? comfortCleared : true,
      },
      protocolContext: {
        ...(sessionData.protocolContext || {}),
        requiredFamilies,
        startValidatedAt: Date.now(),
      },
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
