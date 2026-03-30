const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const profileSnapshotRuntime = require('../../src/api/firebase/mentaltraining/profileSnapshotRuntime.js');
const {
  OUTCOME_BACKFILL_LOOKBACK_DAYS,
  backfillPilotAthleteOutcomeHistory,
  emitPilotMetricEvent,
  isEnrollmentComplete,
  normalizeTrustDispositionBaseline,
  recordPilotMetricAlert,
  recomputePilotMetricRollups,
  upsertPilotMentalPerformanceSnapshot,
  deriveBaselineProbeProfile,
} = require('./utils/pulsecheck-pilot-metrics');

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const PILOT_ENROLLMENTS_COLLECTION = 'pulsecheck-pilot-enrollments';
const ATHLETE_PROGRESS_COLLECTION = 'athlete-mental-progress';

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function verifyAuth(event, adminApp) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Missing Authorization header');
  }

  return admin.auth(adminApp).verifyIdToken(authHeader.slice('Bearer '.length));
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value, fallback = null) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function timestampFromMillis(value) {
  return admin.firestore.Timestamp.fromMillis(Number(value || Date.now()));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let pilotIdsForAlert = [];

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(adminApp);
    const decodedToken = await verifyAuth(event, adminApp);
    const body = JSON.parse(event.body || '{}');

    const userId = normalizeString(body.userId || decodedToken.uid);
    if (!userId || userId !== decodedToken.uid) {
      throw createError(403, 'Authenticated user does not match requested user.');
    }

    const baselineProbe = body.baselineProbe && typeof body.baselineProbe === 'object' ? body.baselineProbe : null;
    if (!baselineProbe) {
      throw createError(400, 'baselineProbe is required.');
    }

    const completedAt = normalizeNumber(baselineProbe.completedAt, Date.now());
    const mprScore = normalizeNumber(body.mprScore, 1);
    const recommendedPathway = normalizeString(body.recommendedPathway) || 'foundation';
    const currentPathway = normalizeString(body.currentPathway) || recommendedPathway;
    const pathwayStep = normalizeNumber(body.pathwayStep, 0);
    const assessmentNeeded = typeof body.assessmentNeeded === 'boolean' ? body.assessmentNeeded : false;
    const source = normalizeString(body.source) || 'native-probe';
    const trustDispositionBaseline = normalizeTrustDispositionBaseline(body.trustDispositionBaseline);

    const progressRef = db.collection(ATHLETE_PROGRESS_COLLECTION).doc(userId);
    const progressSnap = await progressRef.get();
    const existingProgress = progressSnap.exists
      ? (progressSnap.data() || {})
      : profileSnapshotRuntime.buildInitialAthleteProgress(userId, completedAt);

    const nextProgress = {
      ...existingProgress,
      athleteId: userId,
      assessmentNeeded,
      baselineProbe: {
        completedAt,
        composureRecoveryMs: normalizeNumber(baselineProbe.composureRecoveryMs, 4500),
        composureConsistency: normalizeNumber(baselineProbe.composureConsistency, 0.5),
        focusAccuracy: normalizeNumber(baselineProbe.focusAccuracy, 0.5),
        focusDistractorCost: normalizeNumber(baselineProbe.focusDistractorCost, 0),
        decisionAccuracy: normalizeNumber(baselineProbe.decisionAccuracy, 0.5),
        decisionFalseStarts: Math.max(0, normalizeNumber(baselineProbe.decisionFalseStarts, 0)),
        sessionType: normalizeString(baselineProbe.sessionType) || 'probe',
      },
      mprScore,
      mprLastCalculated: completedAt,
      recommendedPathway,
      currentPathway,
      pathwayStep,
      completedPathways: Array.isArray(existingProgress.completedPathways) ? existingProgress.completedPathways : [],
      totalExercisesMastered: Number(existingProgress.totalExercisesMastered || 0),
      totalAssignmentsCompleted: Number(existingProgress.totalAssignmentsCompleted || 0),
      currentStreak: Number(existingProgress.currentStreak || 0),
      longestStreak: Number(existingProgress.longestStreak || 0),
      taxonomyProfile: deriveBaselineProbeProfile({
        ...existingProgress,
        baselineProbe: {
          completedAt,
          composureRecoveryMs: normalizeNumber(baselineProbe.composureRecoveryMs, 4500),
          composureConsistency: normalizeNumber(baselineProbe.composureConsistency, 0.5),
          focusAccuracy: normalizeNumber(baselineProbe.focusAccuracy, 0.5),
          focusDistractorCost: normalizeNumber(baselineProbe.focusDistractorCost, 0),
          decisionAccuracy: normalizeNumber(baselineProbe.decisionAccuracy, 0.5),
          decisionFalseStarts: Math.max(0, normalizeNumber(baselineProbe.decisionFalseStarts, 0)),
          sessionType: normalizeString(baselineProbe.sessionType) || 'probe',
        },
      }),
      lastProfileSyncAt: completedAt,
      profileVersion: profileSnapshotRuntime.PROFILE_VERSION,
      trustDispositionBaseline,
      updatedAt: completedAt,
    };
    nextProgress.activeProgram = profileSnapshotRuntime.prescribeNextSession({
      profile: nextProgress.taxonomyProfile,
    });

    await progressRef.set(nextProgress, { merge: true });

    const membershipsSnap = await db
      .collection(TEAM_MEMBERSHIPS_COLLECTION)
      .where('userId', '==', userId)
      .where('role', '==', 'athlete')
      .get();

    const contexts = [];
    const membershipWrites = membershipsSnap.docs.map(async (membershipSnap) => {
      const membership = { id: membershipSnap.id, ...(membershipSnap.data() || {}) };
      const onboarding = membership.athleteOnboarding || {};
      const pilotId = normalizeString(onboarding.targetPilotId);
      const cohortId = normalizeString(onboarding.targetCohortId) || null;
      const nextOnboarding = {
        ...onboarding,
        baselinePathStatus: 'complete',
        baselinePathwayId: recommendedPathway,
        ...(trustDispositionBaseline
          ? {
              optionalBaselineCovariates: {
                ...(onboarding.optionalBaselineCovariates || {}),
                trustDispositionBaseline,
              },
            }
          : {}),
      };

      await membershipSnap.ref.set(
        {
          athleteOnboarding: nextOnboarding,
          updatedAt: timestampFromMillis(completedAt),
        },
        { merge: true }
      );

      if (!pilotId) {
        return;
      }

      const enrollmentId = `${pilotId}_${userId}`;
      const enrollmentRef = db.collection(PILOT_ENROLLMENTS_COLLECTION).doc(enrollmentId);
      const enrollmentSnap = await enrollmentRef.get();
      const existingEnrollment = enrollmentSnap.exists ? (enrollmentSnap.data() || {}) : {};
      const nextEnrollment = {
        id: enrollmentId,
        organizationId: normalizeString(existingEnrollment.organizationId || membership.organizationId),
        teamId: normalizeString(existingEnrollment.teamId || membership.teamId),
        pilotId,
        cohortId,
        userId,
        teamMembershipId: membership.id,
        studyMode: normalizeString(existingEnrollment.studyMode) || 'operational',
        enrollmentMode: normalizeString(existingEnrollment.enrollmentMode || onboarding.enrollmentMode) || 'pilot',
        status: 'active',
        productConsentAccepted: Boolean(existingEnrollment.productConsentAccepted || onboarding.productConsentAccepted),
        productConsentAcceptedAt: existingEnrollment.productConsentAcceptedAt || onboarding.productConsentAcceptedAt || timestampFromMillis(completedAt),
        productConsentVersion: normalizeString(existingEnrollment.productConsentVersion || onboarding.productConsentVersion) || null,
        researchConsentStatus: normalizeString(existingEnrollment.researchConsentStatus || onboarding.researchConsentStatus) || 'not-required',
        researchConsentVersion: normalizeString(existingEnrollment.researchConsentVersion || onboarding.researchConsentVersion) || null,
        researchConsentRespondedAt: existingEnrollment.researchConsentRespondedAt || onboarding.researchConsentRespondedAt || null,
        requiredConsentIds: Array.isArray(existingEnrollment.requiredConsentIds)
          ? existingEnrollment.requiredConsentIds
          : Array.isArray(onboarding.requiredConsents)
            ? onboarding.requiredConsents.map((entry) => normalizeString(entry?.id)).filter(Boolean)
            : [],
        completedConsentIds: Array.isArray(existingEnrollment.completedConsentIds)
          ? existingEnrollment.completedConsentIds
          : Array.isArray(onboarding.completedConsentIds)
            ? onboarding.completedConsentIds
            : [],
        eligibleForResearchDataset: Boolean(existingEnrollment.eligibleForResearchDataset || onboarding.eligibleForResearchDataset),
        grantedByInviteToken: normalizeString(existingEnrollment.grantedByInviteToken || membership.grantedByInviteToken) || null,
        ...(trustDispositionBaseline
          ? {
              optionalBaselineCovariates: {
                ...(existingEnrollment.optionalBaselineCovariates || {}),
                trustDispositionBaseline,
              },
            }
          : {}),
        createdAt: existingEnrollment.createdAt || timestampFromMillis(completedAt),
        updatedAt: timestampFromMillis(completedAt),
      };

      await enrollmentRef.set(nextEnrollment, { merge: true });

      contexts.push({
        pilotEnrollmentId: enrollmentId,
        pilotId,
        organizationId: nextEnrollment.organizationId,
        teamId: nextEnrollment.teamId,
        cohortId,
        athleteId: userId,
        teamMembershipId: membership.id,
        teamMembership: {
          ...membership,
          athleteOnboarding: nextOnboarding,
        },
        pilotEnrollment: nextEnrollment,
      });
    });

    await Promise.all(membershipWrites);
    pilotIdsForAlert = [...new Set(contexts.map((context) => normalizeString(context.pilotId)).filter(Boolean))];

    const explicitDateKeys = new Set([new Date(completedAt).toISOString().slice(0, 10)]);

    await Promise.all(
      contexts.map(async (context) => {
        const enrollmentIsComplete = isEnrollmentComplete({
          teamMembership: context.teamMembership,
          pilotEnrollment: context.pilotEnrollment,
        });

        await emitPilotMetricEvent({
          db,
          pilotContext: context,
          eventType: 'baseline_completed',
          actorRole: 'athlete',
          actorUserId: userId,
          athleteId: userId,
          sourceCollection: `${ATHLETE_PROGRESS_COLLECTION}`,
          sourceDocumentId: userId,
          metricPayload: {
            source,
            recommendedPathway,
            mprScore,
            trustDispositionBaselineScore: trustDispositionBaseline?.score ?? null,
          },
          createdAt: completedAt,
        });

        if (enrollmentIsComplete) {
          await emitPilotMetricEvent({
            db,
            pilotContext: context,
            eventType: 'pilot_enrollment_activated',
            actorRole: 'system',
            actorUserId: userId,
            athleteId: userId,
            sourceCollection: TEAM_MEMBERSHIPS_COLLECTION,
            sourceDocumentId: context.teamMembershipId,
            metricPayload: {
              baselinePathStatus: 'complete',
              enrollmentMode: context.pilotEnrollment?.enrollmentMode || null,
            },
            createdAt: completedAt,
          });
        }

        await upsertPilotMentalPerformanceSnapshot({
          db,
          athleteId: userId,
          snapshotType: 'baseline',
          preferredPilotEnrollmentId: context.pilotEnrollmentId,
          preferredPilotId: context.pilotId,
          preferredTeamMembershipId: context.teamMembershipId,
          sourceEventId: `baseline_completion:${userId}:${completedAt}`,
        });

        await upsertPilotMentalPerformanceSnapshot({
          db,
          athleteId: userId,
          snapshotType: 'current_latest_valid',
          preferredPilotEnrollmentId: context.pilotEnrollmentId,
          preferredPilotId: context.pilotId,
          preferredTeamMembershipId: context.teamMembershipId,
          sourceEventId: `baseline_completion:${userId}:${completedAt}`,
        });

        if (enrollmentIsComplete) {
          const backfillResult = await backfillPilotAthleteOutcomeHistory({
            db,
            athleteId: userId,
            preferredPilotEnrollmentId: context.pilotEnrollmentId,
            preferredPilotId: context.pilotId,
            preferredTeamMembershipId: context.teamMembershipId,
            lookbackDays: OUTCOME_BACKFILL_LOOKBACK_DAYS,
            actorRole: 'system',
            actorUserId: userId,
            source: 'baseline_completion',
            stampAssignments: true,
            recompute: false,
          });

          (backfillResult?.explicitDateKeys || []).forEach((dateKey) => {
            if (dateKey) explicitDateKeys.add(dateKey);
          });
        }
      })
    );

    await Promise.all(
      [...new Set(contexts.map((context) => normalizeString(context.pilotId)).filter(Boolean))].map((pilotId) =>
        recomputePilotMetricRollups({
          db,
          pilotId,
          explicitDateKeys: [...explicitDateKeys],
        })
      )
    );

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        success: true,
        userId,
        pilotEnrollmentIds: contexts.map((context) => context.pilotEnrollmentId),
        completedAt,
      }),
    };
  } catch (error) {
    console.error('[complete-pulsecheck-baseline] Failed:', error);
    try {
      if (pilotIdsForAlert.length) {
        initializeFirebaseAdmin({ headers: event.headers || {} });
        const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
        const db = admin.firestore(adminApp);
        await Promise.all(pilotIdsForAlert.map((pilotId) => recordPilotMetricAlert({
          db,
          pilotId,
          scope: 'baseline_completion',
          severity: 'error',
          message: error?.message || 'Failed to complete PulseCheck baseline.',
        })));
      }
    } catch (nestedError) {
      console.error('[complete-pulsecheck-baseline] Failed to record alert:', nestedError);
    }
    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to complete PulseCheck baseline.',
      }),
    };
  }
};

function toUtcDateKey(value) {
  return new Date(Number(value || Date.now())).toISOString().slice(0, 10);
}
