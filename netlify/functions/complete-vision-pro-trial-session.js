const {
  CURRICULUM_ASSIGNMENTS_COLLECTION,
  cleanupSessionState,
  getSessionDoc,
  json,
  normalizeBaselineReferences,
  normalizeCalibrationSummary,
  normalizeFamilyMetricSummary,
  normalizeReportSummary,
  normalizeTransferGapSummary,
  normalizeValiditySummary,
  normalizeVersionMetadata,
  parseBody,
  persistEventLog,
  recordCurriculumCompletion,
  recordLegacyAssignmentCompletion,
  resolveVisionProBaselineContext,
  sanitizeSession,
  sha256,
  syncTrialProfileSnapshot,
  withVisionProContext,
  writeSimSession,
  buildResultSummary,
  buildTransferGapSummaryFromSources,
  buildVisionProReportSummary,
  determineImmersiveBaselineFlag,
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

    const versionMetadata = normalizeVersionMetadata(
      resultPayload.versionMetadata || sessionData.versionMetadata
    );
    const calibrationSummary = normalizeCalibrationSummary(
      resultPayload.calibrationSummary || sessionData.calibrationSummary
    );
    const familyMetricSummary = normalizeFamilyMetricSummary(
      resultPayload.familyMetricSummary || sessionData.familyMetricSummary
    );
    const validitySummary = normalizeValiditySummary(
      resultPayload.validitySummary || sessionData.validitySummary
    );
    const baselineContext = await resolveVisionProBaselineContext(db, sessionData.athleteUserId, {
      simId: resultPayload.simId || sessionData.simId,
      baselineReferences: normalizeBaselineReferences(
        resultPayload.baselineReferences || sessionData.baselineReferences
      ),
      familyMetricSummary,
      currentSessionId: sessionId,
    });
    const baselineReferences = baselineContext.baselineReferences;
    const eventLog = await persistEventLog(ref, resultPayload.eventLog, {
      id: sessionId,
      athleteUserId: sessionData.athleteUserId,
    });
    const sessionOutcome = resultPayload.sessionOutcome || validitySummary.status || sessionData.sessionOutcome || null;
    const isImmersiveBaseline = determineImmersiveBaselineFlag({
      requestedFlag: resultPayload.isImmersiveBaseline,
      priorImmersiveBaselineSession: baselineContext.priorImmersiveBaselineSession,
      sessionOutcome,
    });
    const immersiveBaselineReferenceId =
      isImmersiveBaseline
        ? (resultPayload.immersiveBaselineReferenceId || sessionId)
        : (resultPayload.immersiveBaselineReferenceId ||
          sessionData.immersiveBaselineReferenceId ||
          baselineContext.priorImmersiveBaselineSession?.id ||
          null);
    const transferGapSummary = normalizeTransferGapSummary(
      buildTransferGapSummaryFromSources(
        familyMetricSummary,
        baselineReferences,
        baselineContext.baselineMetricSourceMap
      )
    );
    const reportSummary = normalizeReportSummary(
      buildVisionProReportSummary({
        familyMetricSummary,
        transferGapSummary,
        isImmersiveBaseline,
      })
    );

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
      trialType: resultPayload.trialType || sessionData.trialType || null,
      profileSnapshotMilestone: resultPayload.profileSnapshotMilestone || sessionData.profileSnapshotMilestone || null,
      versionMetadata,
      calibrationSummary,
      baselineReferences,
      familyMetricSummary,
      validitySummary,
      transferGapSummary,
      eventLog,
      reportSummary,
      sessionOutcome,
      isImmersiveBaseline,
      immersiveBaselineReferenceId,
      createdAt,
      visionProTrialSessionId: sessionId,
      assignmentId: sessionData.assignmentId,
      assignmentCollection: sessionData.assignmentCollection,
    };

    const simSessionId = await writeSimSession(db, sessionData.athleteUserId, simSessionPayload);
    await syncTrialProfileSnapshot(db, sessionData.athleteUserId, {
      id: simSessionId,
      createdAt,
      trialType: simSessionPayload.trialType || null,
      profileSnapshotMilestone: simSessionPayload.profileSnapshotMilestone || null,
    });

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
      versionMetadata,
      calibrationSummary,
      baselineReferences,
      familyMetricSummary,
      validitySummary,
      transferGapSummary,
      eventLog,
      reportSummary,
      sessionOutcome,
      isImmersiveBaseline,
      immersiveBaselineReferenceId,
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
