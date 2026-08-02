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
  deriveMentalSkillsBaselineProfile,
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

const MENTAL_SKILL_FAMILIES = [
  'breathing_body_awareness',
  'visualization',
  'attention_cues',
  'self_talk_reframing',
  'emotional_regulation',
  'reflection_learning',
  'belief_identity',
  'coherence',
];

const MENTAL_SKILL_FAMILIARITY = new Set([
  'new_to_me',
  'heard_of_it',
  'know_it',
  'practiced_it',
  'use_it',
]);
const MENTAL_SKILL_COMPONENT_WEIGHTS = {
  recognize: 25,
  understand: 20,
  choose: 20,
  rehearse: 15,
};
const MENTAL_SKILL_FAMILIARITY_SCORES = {
  new_to_me: 15,
  heard_of_it: 35,
  know_it: 55,
  practiced_it: 75,
  use_it: 95,
};
const MENTAL_SKILL_ARCHETYPES = new Set([
  'invasion',
  'net_racket',
  'race',
  'judged',
  'stage',
  'precision',
  'combat',
  'attempt',
  'general',
]);

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function stageForScore(score) {
  if (score < 35) return 'discovering';
  if (score < 55) return 'recognizing';
  if (score < 75) return 'choosing';
  return 'rehearsing';
}

function normalizeMentalSkillsBaseline(value) {
  if (!value || typeof value !== 'object') return null;

  const familiarity = Object.fromEntries(
    MENTAL_SKILL_FAMILIES.map((family) => {
      const selection = normalizeString(value.familiarity?.[family]);
      return [family, MENTAL_SKILL_FAMILIARITY.has(selection) ? selection : 'new_to_me'];
    })
  );
  const evidence = (Array.isArray(value.evidence) ? value.evidence : []).map((entry) => ({
    challengeId: normalizeString(entry?.challengeId),
    family: normalizeString(entry?.family),
    component: normalizeString(entry?.component),
    score: clamp(normalizeNumber(entry?.score, 0)),
    selectedOptionId: normalizeString(entry?.selectedOptionId) || null,
  })).filter((entry) => (
    entry.challengeId
    && MENTAL_SKILL_FAMILIES.includes(entry.family)
    && Object.hasOwn(MENTAL_SKILL_COMPONENT_WEIGHTS, entry.component)
  ));
  const missingEvidenceFamilies = MENTAL_SKILL_FAMILIES.filter(
    (family) => !evidence.some((entry) => entry.family === family)
  );
  if (missingEvidenceFamilies.length) {
    throw createError(
      400,
      `mentalSkillsBaseline is missing challenge evidence for: ${missingEvidenceFamilies.join(', ')}.`
    );
  }
  const familyScores = {};
  for (const family of MENTAL_SKILL_FAMILIES) {
    const componentValues = {};
    for (const component of Object.keys(MENTAL_SKILL_COMPONENT_WEIGHTS)) {
      const values = evidence
        .filter((entry) => entry.family === family && entry.component === component)
        .map((entry) => entry.score);
      if (values.length) {
        componentValues[component] = values.reduce((total, score) => total + score, 0) / values.length;
      }
    }

    const familiarityValue = MENTAL_SKILL_FAMILIARITY_SCORES[familiarity[family]];
    let evidenceTotal = 0;
    let evidenceWeight = 0;
    for (const [component, weight] of Object.entries(MENTAL_SKILL_COMPONENT_WEIGHTS)) {
      if (typeof componentValues[component] === 'number') {
        evidenceTotal += componentValues[component] * weight;
        evidenceWeight += weight;
      }
    }
    const demonstrated = evidenceWeight > 0 ? evidenceTotal / evidenceWeight : familiarityValue;
    const score = Math.round(clamp((familiarityValue * 0.2) + (demonstrated * 0.8)));
    familyScores[family] = {
      familiarity: familiarityValue,
      recognize: componentValues.recognize ?? null,
      understand: componentValues.understand ?? null,
      choose: componentValues.choose ?? null,
      rehearse: componentValues.rehearse ?? null,
      score,
      stage: stageForScore(score),
    };
  }

  const averageScore = MENTAL_SKILL_FAMILIES.reduce(
    (total, family) => total + familyScores[family].score,
    0
  ) / MENTAL_SKILL_FAMILIES.length;
  const mood = normalizeString(value.currentState?.mood);
  const validMoods = new Set(['drained', 'off', 'okay', 'solid', 'locked_in']);
  const normalizeStateRating = (rating) => Math.round(clamp(normalizeNumber(rating, 3), 1, 5));
  const sportArchetype = normalizeString(value.sportArchetype);
  const lowest = (families) => [...families].sort(
    (left, right) => familyScores[left].score - familyScores[right].score
  )[0];
  const disciplineFocus = {
    championMindset: lowest(['belief_identity', 'self_talk_reframing', 'reflection_learning']),
    mentalPerformance: lowest(['visualization', 'attention_cues']),
    emotionalRegulation: lowest(['breathing_body_awareness', 'emotional_regulation', 'coherence']),
  };
  const startingFocus = [...new Set(Object.values(disciplineFocus))];
  const strengths = [...MENTAL_SKILL_FAMILIES]
    .sort((left, right) => familyScores[right].score - familyScores[left].score)
    .slice(0, 3);

  return {
    version: Math.max(5, Math.round(normalizeNumber(value.version, 5))),
    completedAt: normalizeNumber(value.completedAt, Date.now()),
    source: normalizeString(value.source) || 'mental-skills-starting-point',
    sportName: normalizeString(value.sportName) || null,
    sportArchetype: MENTAL_SKILL_ARCHETYPES.has(sportArchetype) ? sportArchetype : 'general',
    currentState: {
      mood: validMoods.has(mood) ? mood : 'okay',
      rest: normalizeStateRating(value.currentState?.rest),
      energy: normalizeStateRating(value.currentState?.energy),
      confidence: normalizeStateRating(value.currentState?.confidence),
      motivation: normalizeStateRating(value.currentState?.motivation),
      sportConnection: normalizeStateRating(value.currentState?.sportConnection),
      selfBelief: normalizeStateRating(value.currentState?.selfBelief),
      improvementBelief: normalizeStateRating(value.currentState?.improvementBelief),
    },
    familiarity,
    familyScores,
    overallCompetencyScore: Math.round(clamp(averageScore)),
    beliefScore: familyScores.belief_identity.score,
    coherenceKnowledgeScore: familyScores.coherence.score,
    strengths,
    startingFocus,
    disciplineFocus,
    evidence,
  };
}

function normalizeLegacyBaselineProbe(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    completedAt: normalizeNumber(value.completedAt, Date.now()),
    composureRecoveryMs: normalizeNumber(value.composureRecoveryMs, 4500),
    composureConsistency: normalizeNumber(value.composureConsistency, 0.5),
    focusAccuracy: normalizeNumber(value.focusAccuracy, 0.5),
    focusDistractorCost: normalizeNumber(value.focusDistractorCost, 0),
    decisionAccuracy: normalizeNumber(value.decisionAccuracy, 0.5),
    decisionFalseStarts: Math.max(0, normalizeNumber(value.decisionFalseStarts, 0)),
    sessionType: normalizeString(value.sessionType) || 'probe',
  };
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

    const mentalSkillsBaseline = normalizeMentalSkillsBaseline(body.mentalSkillsBaseline);
    const baselineProbe = normalizeLegacyBaselineProbe(body.baselineProbe);
    if (!mentalSkillsBaseline && !baselineProbe) {
      throw createError(400, 'mentalSkillsBaseline is required.');
    }

    const completedAt = normalizeNumber(
      mentalSkillsBaseline?.completedAt || baselineProbe?.completedAt,
      Date.now()
    );
    const recommendedPathway = normalizeString(body.recommendedPathway) || 'foundation';
    const currentPathway = normalizeString(body.currentPathway) || recommendedPathway;
    const pathwayStep = normalizeNumber(body.pathwayStep, 0);
    const assessmentNeeded = typeof body.assessmentNeeded === 'boolean' ? body.assessmentNeeded : false;
    const source = normalizeString(body.source)
      || mentalSkillsBaseline?.source
      || 'mental-skills-starting-point';
    const trustDispositionBaseline = normalizeTrustDispositionBaseline(body.trustDispositionBaseline);

    const progressRef = db.collection(ATHLETE_PROGRESS_COLLECTION).doc(userId);
    const progressSnap = await progressRef.get();
    const existingProgress = progressSnap.exists
      ? (progressSnap.data() || {})
      : profileSnapshotRuntime.buildInitialAthleteProgress(userId, completedAt);

    const mprScore = mentalSkillsBaseline
      ? normalizeNumber(existingProgress.mprScore, 1)
      : normalizeNumber(body.mprScore, 1);
    const baselineFields = mentalSkillsBaseline
      ? { mentalSkillsBaseline }
      : { baselineProbe };
    const taxonomyProfile = mentalSkillsBaseline
      ? deriveMentalSkillsBaselineProfile({ ...existingProgress, mentalSkillsBaseline })
      : deriveBaselineProbeProfile({ ...existingProgress, baselineProbe });

    const nextProgress = {
      ...existingProgress,
      athleteId: userId,
      assessmentNeeded,
      ...baselineFields,
      mprScore,
      mprLastCalculated: mentalSkillsBaseline
        ? normalizeNumber(existingProgress.mprLastCalculated, completedAt)
        : completedAt,
      recommendedPathway,
      currentPathway,
      pathwayStep,
      completedPathways: Array.isArray(existingProgress.completedPathways) ? existingProgress.completedPathways : [],
      totalExercisesMastered: Number(existingProgress.totalExercisesMastered || 0),
      totalAssignmentsCompleted: Number(existingProgress.totalAssignmentsCompleted || 0),
      currentStreak: Number(existingProgress.currentStreak || 0),
      longestStreak: Number(existingProgress.longestStreak || 0),
      taxonomyProfile,
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
            baselineType: mentalSkillsBaseline ? 'mental_skills_starting_point' : 'legacy_probe',
            mentalSkillsCompetencyScore: mentalSkillsBaseline?.overallCompetencyScore ?? null,
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
