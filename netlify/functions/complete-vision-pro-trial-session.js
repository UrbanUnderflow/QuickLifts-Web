const {
  CURRICULUM_ASSIGNMENTS_COLLECTION,
  cleanupSessionState,
  getSessionDoc,
  json,
  parseBody,
  recordCurriculumCompletion,
  recordLegacyAssignmentCompletion,
  sanitizeSession,
  sha256,
  withVisionProContext,
  writeSimSession,
  buildResultSummary,
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
    const { sessionId, deviceId, deviceSessionToken, resultPayload } = parseBody(event);

    if (!sessionId || !deviceId || !deviceSessionToken || !resultPayload) {
      return json(400, {
        error: 'sessionId, deviceId, deviceSessionToken, and resultPayload are required',
      });
    }

    const { ref, data } = await getSessionDoc(db, sessionId);
    const sessionData = await cleanupSessionState(ref, data);

    if (!['claimed', 'running'].includes(sessionData.status)) {
      return json(409, { error: `Session cannot complete from status ${sessionData.status}` });
    }

    if (sessionData.claimedDeviceId !== deviceId) {
      return json(403, { error: 'This session belongs to a different device' });
    }

    if (sessionData.deviceSessionTokenHash !== sha256(deviceSessionToken)) {
      return json(403, { error: 'Invalid device session token' });
    }

    const createdAt = Date.now();
    const simSessionPayload = {
      userId: sessionData.athleteUserId,
      simId: resultPayload.simId || sessionData.simId,
      simName: resultPayload.simName || sessionData.simName,
      legacyExerciseId: resultPayload.legacyExerciseId || null,
      sessionType: resultPayload.sessionType || 'training_rep',
      durationMode: resultPayload.durationMode || 'standard',
      durationSeconds: resultPayload.durationSeconds || 0,
      coreMetricName: resultPayload.coreMetricName || 'score',
      coreMetricValue: resultPayload.coreMetricValue ?? 0,
      supportingMetrics: resultPayload.supportingMetrics || {},
      normalizedScore: resultPayload.normalizedScore ?? 0,
      targetSkills: Array.isArray(resultPayload.targetSkills) ? resultPayload.targetSkills : [],
      pressureTypes: Array.isArray(resultPayload.pressureTypes) ? resultPayload.pressureTypes : [],
      createdAt,
      visionProTrialSessionId: sessionId,
      assignmentId: sessionData.assignmentId,
      assignmentCollection: sessionData.assignmentCollection,
    };

    const simSessionId = await writeSimSession(db, sessionData.athleteUserId, simSessionPayload);

    if (sessionData.assignmentCollection === CURRICULUM_ASSIGNMENTS_COLLECTION) {
      await recordCurriculumCompletion(
        db,
        sessionData.assignmentId,
        simSessionPayload.durationSeconds,
        resultPayload.postMood
      );
    } else {
      await recordLegacyAssignmentCompletion(db, sessionData.assignmentId);
    }

    const updates = {
      status: 'completed',
      completedAt: createdAt,
      updatedAt: createdAt,
      deviceSessionTokenHash: null,
      resultSummary: {
        ...buildResultSummary(simSessionPayload),
        simSessionId,
      },
    };

    await ref.update(updates);

    return json(200, {
      session: sanitizeSession(sessionId, { ...sessionData, ...updates }),
      simSessionId,
    });
  } catch (error) {
    console.error('[complete-vision-pro-trial-session] Error:', error);
    return json(500, {
      error: error.message || 'Failed to complete Vision Pro session',
    });
  }
};
