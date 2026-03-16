const {
  CURRICULUM_ASSIGNMENTS_COLLECTION,
  LEGACY_ASSIGNMENTS_COLLECTION,
  buildVisionProProtocolIssues,
  json,
  loadAthleteIdentity,
  loadAssignmentContext,
  normalizeBaselineReferences,
  normalizeCalibrationSummary,
  normalizeEventLogReference,
  normalizeFamilyMetricSummary,
  normalizeReportSummary,
  normalizeTransferGapSummary,
  normalizeValiditySummary,
  normalizeVersionMetadata,
  parseBody,
  resolveVisionProBaselineContext,
  resolveVisionProProtocolContext,
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
    const athleteIdentity = await loadAthleteIdentity(db, assignmentContext.athleteUserId);
    const requestedSimId = body.simId || assignmentContext.simId;
    const baselineContext = await resolveVisionProBaselineContext(db, assignmentContext.athleteUserId, {
      simId: requestedSimId,
      baselineReferences: normalizeBaselineReferences(body.baselineReferences),
      familyMetricSummary: normalizeFamilyMetricSummary(body.familyMetricSummary),
      currentSessionId: sessionRef.id,
    });
    const protocolContext = await resolveVisionProProtocolContext(db, assignmentContext.athleteUserId);
    const trackedFamilies =
      requestedSimId === 'vision_pro_football_package'
        ? [{ family: 'reset' }, { family: 'signal-window' }]
        : [{ family: requestedSimId }];
    const protocolIssues = buildVisionProProtocolIssues({
      trackedFamilies,
      baselineReferences: baselineContext.baselineReferences,
      protocolContext,
    });

    if (protocolIssues.length) {
      return json(409, {
        error: protocolIssues[0],
        protocolIssues,
      });
    }

    const sessionData = {
      assignmentId,
      assignmentCollection,
      athleteUserId: assignmentContext.athleteUserId,
      athleteDisplayName: athleteIdentity.athleteDisplayName,
      athleteEmail: athleteIdentity.athleteEmail,
      simId: requestedSimId,
      simName: body.simName || assignmentContext.simName,
      organizationId: protocolContext.membership?.organizationId || null,
      teamId: protocolContext.membership?.teamId || null,
      teamName: protocolContext.membership?.teamName || null,
      pilotId: protocolContext.pilot?.id || protocolContext.onboarding?.targetPilotId || null,
      pilotName: protocolContext.pilot?.name || protocolContext.onboarding?.targetPilotName || null,
      cohortId: protocolContext.cohort?.id || protocolContext.onboarding?.targetCohortId || null,
      cohortName: protocolContext.cohort?.name || protocolContext.onboarding?.targetCohortName || null,
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
      trialType: body.trialType || null,
      profileSnapshotMilestone: body.profileSnapshotMilestone || assignmentContext.assignment.profileSnapshotMilestone || null,
      resultSummary: null,
      versionMetadata: normalizeVersionMetadata(body.versionMetadata),
      calibrationSummary: normalizeCalibrationSummary(body.calibrationSummary),
      baselineReferences: baselineContext.baselineReferences,
      familyMetricSummary: normalizeFamilyMetricSummary(body.familyMetricSummary),
      validitySummary: normalizeValiditySummary(body.validitySummary),
      transferGapSummary: normalizeTransferGapSummary(body.transferGapSummary),
      eventLog: normalizeEventLogReference(body.eventLog),
      reportSummary: normalizeReportSummary(body.reportSummary),
      protocolContext: {
        baselineWindowDays: 14,
        requiredFamilies: trackedFamilies.map((entry) => entry.family).filter(Boolean),
        enrollmentMode: protocolContext.enrollmentMode,
        comfortScreenRequired: true,
        activeEscalationTier: protocolContext.activeEscalation?.tier || null,
        activeEscalationRecordId: protocolContext.activeEscalation?.id || null,
        queueValidatedAt: now,
        startValidatedAt: null,
      },
      sessionOutcome: body.sessionOutcome || null,
      isImmersiveBaseline: typeof body.isImmersiveBaseline === 'boolean' ? body.isImmersiveBaseline : null,
      immersiveBaselineReferenceId: body.immersiveBaselineReferenceId || null,
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
