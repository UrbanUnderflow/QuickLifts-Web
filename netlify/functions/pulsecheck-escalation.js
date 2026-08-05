/**
 * PulseCheck Escalation Handler Function
 * 
 * Handles escalation actions:
 * - Create escalation record
 * - Process consent decisions
 * - Trigger clinical handoff to AuntEDNA
 * - Generate conversation summaries
 * - Notify coaches
 * 
 * Endpoint: POST /.netlify/functions/pulsecheck-escalation
 * Body: { action, userId, conversationId, ... }
 */

const { initializeFirebaseAdmin, db, headers, admin } = require('./config/firebase');
const {
  applyPilotWatchList,
  emitPilotMetricEvent,
  evaluateCoachWorkflowContinuity,
  recordPilotMetricAlert,
  recomputePilotMetricRollups,
  resolvePilotEnrollmentContext,
  writePilotMetricOpsStatus,
  isTrueCareEscalationClassification,
} = require('./utils/pulsecheck-pilot-metrics');
const {
  buildPulseCallbackUrl,
  createClinicalBridge,
  resolveClinicalBridgeConfig,
} = require('./lib/clinical-bridge');

// Escalation Tier enum values
const EscalationTier = {
  None: 0,
  MonitorOnly: 1,
  ElevatedRisk: 2,
  CriticalRisk: 3
};

// Status enums
const ConsentStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Declined: 'declined',
  NotRequired: 'not-required'
};

const HandoffStatus = {
  Pending: 'pending',
  Initiated: 'initiated',
  Completed: 'completed',
  Failed: 'failed'
};

const EscalationRecordStatus = {
  Active: 'active',
  Resolved: 'resolved',
  Declined: 'declined'
};
const EscalationDisposition = {
  None: 'none',
  CoachReview: 'coach_review',
  ClinicalHandoff: 'clinical_handoff',
};
const EscalationClassificationFamily = {
  None: 'none',
  PerformanceSupport: 'performance_support',
  CoachReview: 'coach_review',
  CareEscalation: 'care_escalation',
  CriticalSafety: 'critical_safety',
};
const EscalationSeverity = {
  None: 'none',
  Low: 'low',
  Moderate: 'moderate',
  High: 'high',
  Critical: 'critical',
};
const EscalationIncidentStatus = {
  Open: 'open',
  Monitoring: 'monitoring',
  Resolved: 'resolved',
  Declined: 'declined',
  Merged: 'merged',
  Superseded: 'superseded',
};
const ESCALATION_DEDUPE_WINDOW_SECONDS = 30 * 60;
const INCIDENT_HISTORY_LIMIT = 10;
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ATHLETE_SAFETY_STATE_COLLECTION = 'pulsecheck-athlete-safety-state';
const CLINICAL_ESCALATIONS_COLLECTION = 'pulsecheck-clinical-escalations';
const HOTLINE_SUPPORT_RESOURCE = Object.freeze({
  name: '988 Suicide & Crisis Lifeline',
  phone: '988',
  url: 'https://988lifeline.org',
});

const clinicalBridgeConfig = resolveClinicalBridgeConfig();

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildClinicalStateSnapshotEnvelope(escalationData = {}) {
  const source = escalationData?.stateSnapshot && typeof escalationData.stateSnapshot === 'object'
    ? escalationData.stateSnapshot
    : {};
  const envelope = {};
  const addString = (key, value) => {
    const normalized = normalizeString(value);
    if (normalized) envelope[key] = normalized;
  };
  const addNumber = (key, value) => {
    const normalized = Number(value);
    if (Number.isFinite(normalized)) envelope[key] = normalized;
  };

  addString('snapshotId', source.snapshotId || source.id || escalationData.stateSnapshotId);
  addString('sourceDate', source.sourceDate || escalationData.stateSnapshotSourceDate);
  addString('overallReadiness', source.overallReadiness || escalationData.overallReadiness);
  addString('confidence', source.confidence || escalationData.stateConfidence);
  addString('freshness', source.freshness || escalationData.stateFreshness);
  addString('recommendedRouting', source.recommendedRouting || escalationData.recommendedRouting);
  addString('recommendedProtocolClass', source.recommendedProtocolClass || escalationData.recommendedProtocolClass);
  addString('summary', source.summary || escalationData.stateSummary);
  addString('trendSummary', source.trendSummary || escalationData.trendSummary);

  const readinessScore = source.readinessScore ?? escalationData.readinessScore;
  if (readinessScore !== undefined && readinessScore !== null && readinessScore !== '') {
    addNumber('readinessScore', readinessScore);
  }
  const capturedAt = source.capturedAt ?? source.updatedAt ?? escalationData.stateSnapshotCapturedAt;
  if (capturedAt !== undefined && capturedAt !== null && capturedAt !== '') {
    addNumber('capturedAt', capturedAt);
  }
  const supportFlag = source.supportFlag ?? escalationData.supportFlag;
  if (typeof supportFlag === 'boolean') envelope.supportFlag = supportFlag;

  if (source.stateDimensions && typeof source.stateDimensions === 'object') {
    const stateDimensions = {};
    for (const key of ['activation', 'focusReadiness', 'emotionalLoad', 'cognitiveFatigue']) {
      const value = Number(source.stateDimensions[key]);
      if (Number.isFinite(value)) stateDimensions[key] = Math.max(0, Math.min(100, value));
    }
    if (Object.keys(stateDimensions).length) envelope.stateDimensions = stateDimensions;
  }

  if (Array.isArray(source.sourcesUsed)) {
    const sourcesUsed = source.sourcesUsed
      .map((value) => normalizeString(value))
      .filter(Boolean)
      .slice(0, 10);
    if (sourcesUsed.length) envelope.sourcesUsed = sourcesUsed;
  }

  if (Array.isArray(source.contextTags)) {
    const contextTags = source.contextTags
      .map((value) => normalizeString(value))
      .filter(Boolean)
      .slice(0, 10);
    if (contextTags.length) envelope.contextTags = contextTags;
  }

  return Object.keys(envelope).length > 0 ? envelope : null;
}

function getRequestHeader(event, headerName) {
  const target = normalizeString(headerName).toLowerCase();
  const entry = Object.entries(event?.headers || {}).find(([key]) => String(key).toLowerCase() === target);
  return entry ? normalizeString(entry[1]) : '';
}

async function verifyEscalationCaller(event, runtimeDb = db) {
  const authorization = getRequestHeader(event, 'authorization');
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    const error = new Error('Sign in is required for escalation actions.');
    error.statusCode = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(match[1]);
  } catch (cause) {
    const error = new Error('Your sign-in session is invalid or expired.');
    error.statusCode = 401;
    error.cause = cause;
    throw error;
  }

  const uid = normalizeString(decoded?.uid);
  if (!uid) {
    const error = new Error('Firebase token is missing a user id.');
    error.statusCode = 401;
    throw error;
  }

  const email = normalizeString(decoded?.email).toLowerCase();
  let isAdmin = decoded?.admin === true || decoded?.isAdmin === true || decoded?.role === 'admin';
  if (!isAdmin && email) {
    try {
      const adminDoc = await runtimeDb.collection('admin').doc(email).get();
      isAdmin = adminDoc.exists;
    } catch (error) {
      console.warn('[pulsecheck-escalation] Admin lookup failed; continuing with athlete permissions only:', error?.message || error);
    }
  }

  return { uid, email, isAdmin, decoded };
}

async function authorizeEscalationAction({ caller, action, body, runtimeDb = db }) {
  if (caller?.isAdmin) return { ok: true };

  const athleteActions = new Set(['consent', 'care-state']);
  if (athleteActions.has(action)) {
    const claimedUserId = normalizeString(body?.userId);
    if (claimedUserId && claimedUserId === caller?.uid) return { ok: true };
    return { ok: false, statusCode: 403, error: 'You cannot perform an escalation action for another athlete.' };
  }

  if (action === 'summary') {
    const conversationId = normalizeString(body?.conversationId);
    if (!conversationId) return { ok: false, statusCode: 400, error: 'Missing conversationId' };
    const conversationDoc = await runtimeDb.collection('conversations').doc(conversationId).get();
    if (conversationDoc.exists && normalizeString(conversationDoc.data()?.userId) === caller?.uid) {
      return { ok: true };
    }
    return { ok: false, statusCode: 403, error: 'You cannot summarize another athlete\'s conversation.' };
  }

  if (action === 'resolve') {
    const clinicalEscalationId = normalizeString(body?.clinicalEscalationId || body?.escalationId);
    if (!clinicalEscalationId) {
      return { ok: false, statusCode: 400, error: 'Missing escalationId' };
    }

    let escalationData = null;
    const clinicalDoc = await runtimeDb
      .collection(CLINICAL_ESCALATIONS_COLLECTION)
      .doc(clinicalEscalationId)
      .get();
    if (clinicalDoc.exists) {
      escalationData = clinicalDoc.data() || {};
    } else {
      const legacyDoc = await runtimeDb.collection('escalation-records').doc(normalizeString(body?.escalationId)).get();
      if (legacyDoc.exists) escalationData = legacyDoc.data() || {};
    }

    const teamId = normalizeString(escalationData?.teamId);
    const athleteUserId = normalizeString(
      escalationData?.athleteUserId || escalationData?.userId || escalationData?.athleteId
    );
    if (!teamId || !athleteUserId || (normalizeString(body?.userId) && normalizeString(body.userId) !== athleteUserId)) {
      return { ok: false, statusCode: 403, error: 'You do not have access to resolve this escalation.' };
    }

    const [staffDoc, athleteDoc] = await Promise.all([
      runtimeDb.collection('pulsecheck-team-memberships').doc(`${teamId}_${caller.uid}`).get(),
      runtimeDb.collection('pulsecheck-team-memberships').doc(`${teamId}_${athleteUserId}`).get(),
    ]);
    const staff = staffDoc.exists ? staffDoc.data() || {} : {};
    const athlete = athleteDoc.exists ? athleteDoc.data() || {} : {};
    const capabilities = Array.isArray(staff.staffCapabilities) ? staff.staffCapabilities : [];
    const scope = normalizeString(staff.rosterVisibilityScope) || 'team';
    const allowedAthleteIds = Array.isArray(staff.allowedAthleteIds) ? staff.allowedAthleteIds : [];
    const hasClinicalCapability = capabilities.includes('admin') || capabilities.includes('athletic_trainer');
    const hasRosterAccess = scope === 'team' || (scope === 'assigned' && allowedAthleteIds.includes(athleteUserId));
    const authorized = staffDoc.exists
      && athleteDoc.exists
      && normalizeString(staff.status).toLowerCase() === 'active'
      && normalizeString(athlete.status).toLowerCase() === 'active'
      && normalizeString(staff.role).toLowerCase() !== 'athlete'
      && normalizeString(athlete.role).toLowerCase() === 'athlete'
      && hasClinicalCapability
      && hasRosterAccess;
    return authorized
      ? { ok: true }
      : { ok: false, statusCode: 403, error: 'You do not have access to resolve this escalation.' };
  }

  return { ok: false, statusCode: 403, error: 'Admin authorization is required for this escalation action.' };
}

function normalizeCategoryValue(value) {
  return normalizeString(value) || 'general';
}

function normalizeTeamEscalationRoute(value) {
  return normalizeString(value).toLowerCase() === 'hotline' ? 'hotline' : 'clinician';
}

function buildHotlineSupportMessage(isCritical = false) {
  return isCritical
    ? `Please call or text ${HOTLINE_SUPPORT_RESOURCE.phone} now, or visit ${HOTLINE_SUPPORT_RESOURCE.url} for immediate support. We have also added you to the watch list so an admin can keep following up.`
    : `Thank you. Please call or text ${HOTLINE_SUPPORT_RESOURCE.phone} now, or visit ${HOTLINE_SUPPORT_RESOURCE.url} for immediate support. We have also added you to the watch list so an admin can keep following up.`;
}

function mapTierToSeverity(tier) {
  switch (Number(tier) || 0) {
    case EscalationTier.MonitorOnly:
      return EscalationSeverity.Moderate;
    case EscalationTier.ElevatedRisk:
      return EscalationSeverity.High;
    case EscalationTier.CriticalRisk:
      return EscalationSeverity.Critical;
    default:
      return EscalationSeverity.None;
  }
}

function deriveClassificationFamily({ tier, category }) {
  const normalizedTier = Number(tier) || 0;
  const normalizedCategory = normalizeCategoryValue(category).toLowerCase();
  if (normalizedTier >= EscalationTier.CriticalRisk) return EscalationClassificationFamily.CriticalSafety;
  if (normalizedTier >= EscalationTier.ElevatedRisk) return EscalationClassificationFamily.CareEscalation;
  if (normalizedTier >= EscalationTier.MonitorOnly) return EscalationClassificationFamily.CoachReview;
  if (normalizedCategory === 'performance_support') return EscalationClassificationFamily.PerformanceSupport;
  return EscalationClassificationFamily.None;
}

function deriveDisposition({ tier, requiresClinicalHandoff, requiresCoachReview }) {
  if (requiresClinicalHandoff || (Number(tier) || 0) >= EscalationTier.ElevatedRisk) {
    return EscalationDisposition.ClinicalHandoff;
  }
  if (requiresCoachReview || (Number(tier) || 0) >= EscalationTier.MonitorOnly) {
    return EscalationDisposition.CoachReview;
  }
  return EscalationDisposition.None;
}

function buildIncidentSeed({ conversationId, classificationFamily }) {
  return {
    scope: 'same_conversation',
    status: EscalationIncidentStatus.Open,
    conversationId,
    dedupeWindowSeconds: ESCALATION_DEDUPE_WINDOW_SECONDS,
    family: classificationFamily,
  };
}

function sanitizeIncidentKeyPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

function buildIncidentKeyCandidate({ userId, classificationFamily, category, createdAtSec }) {
  const bucket = Math.floor(Number(createdAtSec || Math.floor(Date.now() / 1000)) / ESCALATION_DEDUPE_WINDOW_SECONDS);
  return [
    sanitizeIncidentKeyPart(userId),
    sanitizeIncidentKeyPart(classificationFamily),
    sanitizeIncidentKeyPart(category),
    String(bucket),
  ].join('::');
}

function appendBounded(entries = [], nextEntry) {
  const existing = Array.isArray(entries) ? entries : [];
  return [...existing, nextEntry].slice(-INCIDENT_HISTORY_LIMIT);
}

function buildIncidentRationaleEntry({ model, nowSec }) {
  return {
    at: nowSec,
    tier: Number(model?.tier) || 0,
    category: normalizeCategoryValue(model?.category),
    classificationFamily: normalizeString(model?.classificationFamily) || EscalationClassificationFamily.None,
    severity: normalizeString(model?.severity) || EscalationSeverity.None,
    reason: normalizeString(model?.classificationReason || model?.reason),
    explanation: normalizeString(model?.explanation) || undefined,
  };
}

function buildIncidentEvidenceEntry({ triggerMessageId, sourceTriggerMessageId, conversationId, triggerContent, mergeStrategy, incidentKeyCandidate, nowSec }) {
  return {
    at: nowSec,
    triggerMessageId: triggerMessageId || '',
    sourceTriggerMessageId: sourceTriggerMessageId || triggerMessageId || '',
    conversationId: conversationId || '',
    triggerContent: String(triggerContent || '').slice(0, 500),
    mergeStrategy: mergeStrategy || 'new',
    incidentKeyCandidate: incidentKeyCandidate || '',
  };
}

function buildIncidentLifecycleEntry(event, nowSec, detail) {
  return {
    at: nowSec,
    event,
    ...(detail ? { detail } : {}),
  };
}

function deriveIncidentStatus({ requiresClinicalHandoff, requiresCoachReview }) {
  if (requiresClinicalHandoff) return EscalationIncidentStatus.Open;
  if (requiresCoachReview) return EscalationIncidentStatus.Monitoring;
  return EscalationIncidentStatus.Open;
}

function normalizeEscalationModel(input = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const tier = Number(input.tier);
  const normalizedTier = Number.isFinite(tier)
    ? Math.max(EscalationTier.None, Math.min(EscalationTier.CriticalRisk, Math.round(tier)))
    : EscalationTier.None;
  const requiresClinicalHandoff = input.requiresClinicalHandoff === true || normalizedTier >= EscalationTier.ElevatedRisk;
  const requiresCoachReview = input.requiresCoachReview === true || normalizedTier >= EscalationTier.MonitorOnly;
  const classificationFamily = normalizeString(input.classificationFamily)
    || deriveClassificationFamily({ tier: normalizedTier, category: input.category });
  const disposition = normalizeString(input.disposition)
    || deriveDisposition({ tier: normalizedTier, requiresClinicalHandoff, requiresCoachReview });

  return {
    tier: normalizedTier,
    category: normalizeCategoryValue(input.category),
    classificationReason: normalizeString(input.classificationReason || input.reason),
    explanation: normalizeString(input.explanation || input.classificationReason || input.reason),
    classificationConfidence: Number.isFinite(Number(input.classificationConfidence ?? input.confidence))
      ? Math.max(0, Math.min(1, Number(input.classificationConfidence ?? input.confidence)))
      : 0,
    disposition,
    classificationFamily,
    severity: normalizeString(input.severity) || mapTierToSeverity(normalizedTier),
    requiresCoachReview,
    requiresClinicalHandoff,
    dedupeEligible: input.dedupeEligible !== false && normalizedTier >= EscalationTier.MonitorOnly,
    countsTowardCareKpi: requiresClinicalHandoff,
    sourceTriggerMessageId: normalizeString(input.sourceTriggerMessageId),
    incident: {
      ...buildIncidentSeed({
        conversationId: normalizeString(input.conversationId),
        classificationFamily,
      }),
      incidentKeyCandidate: normalizeString(input.incident?.incidentKeyCandidate)
        || buildIncidentKeyCandidate({
          userId: input.userId || 'athlete',
          classificationFamily,
          category: input.category,
          createdAtSec: nowSec,
        }),
      canonicalIncidentKey: normalizeString(input.incident?.canonicalIncidentKey) || undefined,
      mergedIntoIncidentKey: input.incident?.mergedIntoIncidentKey || null,
      supersededByIncidentKey: input.incident?.supersededByIncidentKey || null,
      sourceTriggerMessageId: normalizeString(input.incident?.sourceTriggerMessageId || input.sourceTriggerMessageId) || undefined,
      ...(input.incident && typeof input.incident === 'object' ? input.incident : {}),
    },
  };
}

function buildEscalationRecordPayload({
  userId,
  conversationId,
  triggerMessageId,
  triggerContent,
  model,
  nowSec,
  existingRecord = null,
}) {
  const consentStatus = model.requiresClinicalHandoff
    ? (model.tier === EscalationTier.CriticalRisk ? ConsentStatus.NotRequired : ConsentStatus.Pending)
    : ConsentStatus.NotRequired;
  const baseIncident = existingRecord?.incident && typeof existingRecord.incident === 'object'
    ? existingRecord.incident
    : {};
  const sourceTriggerMessageId = model.sourceTriggerMessageId || triggerMessageId || '';
  const incidentKeyCandidate = normalizeString(model?.incident?.incidentKeyCandidate)
    || buildIncidentKeyCandidate({
      userId,
      classificationFamily: model.classificationFamily,
      category: model.category,
      createdAtSec: nowSec,
    });
  const incidentStatus = deriveIncidentStatus({
    requiresClinicalHandoff: model.requiresClinicalHandoff,
    requiresCoachReview: model.requiresCoachReview,
  });
  const incident = {
    ...buildIncidentSeed({
      conversationId,
      classificationFamily: model.classificationFamily,
    }),
    ...baseIncident,
    status: incidentStatus,
    conversationId,
    openedAt: baseIncident.openedAt || existingRecord?.incidentOpenedAt || existingRecord?.createdAt || nowSec,
    lastActivityAt: nowSec,
    closedAt: null,
    recordCount: Math.max(1, Number(baseIncident.recordCount || existingRecord?.incidentRecordCount || 0) || 0),
    incidentKeyCandidate,
    canonicalIncidentKey: normalizeString(baseIncident.canonicalIncidentKey || existingRecord?.incidentKeyCandidate || incidentKeyCandidate) || incidentKeyCandidate,
    mergedIntoIncidentKey: baseIncident.mergedIntoIncidentKey || existingRecord?.mergedIntoIncidentKey || null,
    supersededByIncidentKey: baseIncident.supersededByIncidentKey || existingRecord?.supersededByIncidentKey || null,
    sourceTriggerMessageId,
    lastTriggerMessageId: triggerMessageId || '',
    lastTriggerContent: triggerContent || '',
    rationaleHistory: appendBounded(
      baseIncident.rationaleHistory,
      buildIncidentRationaleEntry({ model, nowSec })
    ),
    evidenceTrail: appendBounded(
      baseIncident.evidenceTrail,
      buildIncidentEvidenceEntry({
        triggerMessageId,
        sourceTriggerMessageId,
        conversationId,
        triggerContent,
        mergeStrategy: existingRecord ? 'same_conversation' : 'new',
        incidentKeyCandidate,
        nowSec,
      })
    ),
    lifecycleEvents: appendBounded(
      baseIncident.lifecycleEvents,
      buildIncidentLifecycleEntry(existingRecord ? 'merged' : incidentStatus === EscalationIncidentStatus.Monitoring ? 'monitoring' : 'opened', nowSec)
    ),
  };

  return {
    userId,
    conversationId,
    tier: model.tier,
    category: model.category,
    triggerMessageId: triggerMessageId || '',
    triggerContent: triggerContent || '',
    classificationReason: model.classificationReason,
    classificationConfidence: model.classificationConfidence,
    disposition: model.disposition,
    classificationFamily: model.classificationFamily,
    explanation: model.explanation,
    severity: model.severity,
    requiresCoachReview: model.requiresCoachReview,
    requiresClinicalHandoff: model.requiresClinicalHandoff,
    dedupeEligible: model.dedupeEligible,
    countsTowardCareKpi: model.countsTowardCareKpi,
    sourceTriggerMessageId,
    incidentKeyCandidate,
    mergedIntoIncidentKey: incident.mergedIntoIncidentKey,
    supersededByIncidentKey: incident.supersededByIncidentKey,
    consentStatus,
    handoffStatus: existingRecord?.handoffStatus || HandoffStatus.Pending,
    coachNotified: Boolean(existingRecord?.coachNotified),
    coachId: existingRecord?.coachId || undefined,
    coachNotifiedAt: existingRecord?.coachNotifiedAt || null,
    handoffInitiatedAt: existingRecord?.handoffInitiatedAt || null,
    handoffAcceptedAt: existingRecord?.handoffAcceptedAt || null,
    firstClinicianResponseAt: existingRecord?.firstClinicianResponseAt || null,
    handoffCompletedAt: existingRecord?.handoffCompletedAt || null,
    clinicalReferenceId: existingRecord?.clinicalReferenceId || null,
    resolvedAt: null,
    createdAt: existingRecord?.createdAt || nowSec,
    status: EscalationRecordStatus.Active,
    incident,
    incidentId: existingRecord?.incidentId || existingRecord?.id || '',
    incidentStatus: incidentStatus,
    incidentOpenedAt: incident.openedAt,
    incidentLastActivityAt: incident.lastActivityAt,
    incidentClosedAt: null,
    incidentRecordCount: incident.recordCount,
  };
}

async function findMergeableEscalationRecord({ userId, conversationId, model, runtimeDb = db }) {
  if (!userId || !conversationId || (Number(model?.tier) || 0) <= EscalationTier.None) {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const snapshot = await runtimeDb.collection('escalation-records')
    .where('userId', '==', userId)
    .where('conversationId', '==', conversationId)
    .where('status', '==', EscalationRecordStatus.Active)
    .get();

  const candidates = snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
    .filter((entry) => entry.dedupeEligible !== false)
    .filter((entry) => nowSec - Number(entry.createdAt || 0) <= ESCALATION_DEDUPE_WINDOW_SECONDS)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));

  const sameConversation = candidates.find((entry) => entry.conversationId === conversationId);
  if (sameConversation) {
    return { ...sameConversation, mergeStrategy: 'same_conversation' };
  }

  const fallbackCandidate = candidates.find((entry) => {
    const existingCandidate = normalizeString(entry?.incident?.incidentKeyCandidate || entry.incidentKeyCandidate);
    const existingCanonical = normalizeString(entry?.incident?.canonicalIncidentKey);
    const incomingCandidate = normalizeString(model?.incident?.incidentKeyCandidate)
      || buildIncidentKeyCandidate({
        userId,
        classificationFamily: model?.classificationFamily,
        category: model?.category,
        createdAtSec: nowSec,
      });
    return existingCandidate === incomingCandidate || existingCanonical === incomingCandidate;
  });

  return fallbackCandidate ? { ...fallbackCandidate, mergeStrategy: 'fallback_key' } : null;
}

async function resolveEscalationSupportContext({
  athleteId,
  preferredPilotEnrollmentId = null,
  preferredPilotId = null,
  preferredTeamMembershipId = null,
  preferredTeamId = null,
}, runtimeDb = db) {
  let pilotContext = null;
  try {
    pilotContext = await resolvePilotEnrollmentContext({
      db: runtimeDb,
      athleteId,
      preferredPilotEnrollmentId: normalizeString(preferredPilotEnrollmentId) || null,
      preferredPilotId: normalizeString(preferredPilotId) || null,
      preferredTeamMembershipId: normalizeString(preferredTeamMembershipId) || null,
      allowMembershipFallback: true,
    });
  } catch (error) {
    console.warn('[pulsecheck-escalation] Support context lookup failed; using the clinician route:', error?.message || error);
  }

  const teamId = normalizeString(preferredTeamId) || normalizeString(pilotContext?.teamId);
  if (!teamId) {
    return {
      route: 'clinician',
      teamId: '',
      team: null,
      pilotContext,
    };
  }

  let team = null;
  try {
    const teamDoc = await runtimeDb.collection(TEAMS_COLLECTION).doc(teamId).get();
    team = teamDoc.exists ? { id: teamDoc.id, ...(teamDoc.data() || {}) } : null;
  } catch (error) {
    team = null;
  }

  return {
    route: normalizeTeamEscalationRoute(team?.defaultEscalationRoute),
    teamId,
    team,
    pilotContext,
  };
}

async function applyHotlineSupportRouting(userId, escalationId, escalationData, supportContext, isCritical = false, runtimeDb = db) {
  const processedAt = Math.floor(Date.now() / 1000);
  let watchListState = null;

  try {
    watchListState = await applyPilotWatchList({
      db: runtimeDb,
      athleteId: userId,
      preferredPilotEnrollmentId: normalizeString(supportContext?.pilotContext?.pilotEnrollmentId) || null,
      preferredPilotId: normalizeString(supportContext?.pilotContext?.pilotId) || null,
      preferredTeamMembershipId: normalizeString(supportContext?.pilotContext?.teamMembershipId) || null,
      actorUserId: null,
      actorRole: 'system',
      reasonCode: 'operational_hold',
      reason: 'Hotline escalation route selected. Keep athlete on the watch list until an admin removes the hold.',
      watchListSource: 'system',
      linkedIncidentIds: [escalationId],
      createdAt: processedAt * 1000,
    });
  } catch (error) {
    console.warn('[pulsecheck-escalation] Failed to apply hotline watch list (non-blocking):', error?.message || error);
    try {
      if (supportContext?.pilotContext?.pilotId) {
        await recordPilotMetricAlert({
          db: runtimeDb,
          pilotId: supportContext.pilotContext.pilotId,
          scope: 'hotline_watch_list_apply',
          severity: 'warning',
          message: error?.message || 'Failed to apply hotline watch list automatically.',
          context: {
            athleteId: normalizeString(userId),
            escalationId: normalizeString(escalationId),
          },
        });
      }
    } catch (nestedError) {
      console.error('[pulsecheck-escalation] Failed to record hotline watch list alert:', nestedError);
    }
  }

  await runtimeDb.collection('escalation-records').doc(escalationId).set({
    supportRoute: 'hotline',
    supportRouteResolvedAt: processedAt,
    hotlineResource: HOTLINE_SUPPORT_RESOURCE,
    hotlineResourceProvidedAt: processedAt,
    watchListAutoApplied: Boolean(watchListState?.watchListActive),
    watchListAppliedAt: watchListState?.watchListAppliedAt || processedAt,
    pilotId: normalizeString(supportContext?.pilotContext?.pilotId) || null,
    pilotEnrollmentId: normalizeString(supportContext?.pilotContext?.pilotEnrollmentId) || null,
    organizationId: normalizeString(supportContext?.pilotContext?.organizationId) || null,
    teamId: normalizeString(supportContext?.teamId || supportContext?.pilotContext?.teamId) || null,
    teamMembershipId: normalizeString(supportContext?.pilotContext?.teamMembershipId) || null,
    handoffStatus: HandoffStatus.Completed,
    handoffInitiatedAt: escalationData?.handoffInitiatedAt || processedAt,
    handoffCompletedAt: processedAt,
    incidentLastActivityAt: processedAt,
    incident: {
      ...((escalationData?.incident && typeof escalationData.incident === 'object') ? escalationData.incident : {}),
      id: escalationData?.incidentId || escalationId,
      status: EscalationIncidentStatus.Open,
      lastActivityAt: processedAt,
      lifecycleEvents: appendBounded(
        escalationData?.incident?.lifecycleEvents,
        buildIncidentLifecycleEntry('opened', processedAt, 'hotline_route_applied')
      ),
    },
  }, { merge: true });

  await refreshPilotOutcomeRollupsForAthlete(userId, processedAt * 1000, runtimeDb);

  return {
    success: true,
    status: 'hotline_resource_provided',
    supportRoute: 'hotline',
    hotlineResource: HOTLINE_SUPPORT_RESOURCE,
    watchListApplied: Boolean(watchListState?.watchListActive),
    isCritical: Boolean(isCritical),
    message: buildHotlineSupportMessage(isCritical),
  };
}

async function executeCriticalSafetyOperations({
  userId,
  conversationId,
  escalationId,
  escalationData,
  supportContext,
  nowSec,
  runtimeDb = db,
  handoffRunner = triggerCriticalHandoff,
}) {
  const crisisWallTimestamp = admin?.firestore?.FieldValue?.serverTimestamp
    ? admin.firestore.FieldValue.serverTimestamp()
    : nowSec;
  const safetyTeamId = normalizeString(
    escalationData?.teamId || supportContext?.teamId || supportContext?.pilotContext?.teamId
  );
  let safetyStateWriteStatus = 'pending';
  let safetyStateError = null;

  try {
    await runtimeDb.collection(ATHLETE_SAFETY_STATE_COLLECTION).doc(userId).set({
      athleteUserId: userId,
      ...(safetyTeamId ? { teamId: safetyTeamId } : {}),
      crisisWallActive: true,
      crisisWallActivatedAt: crisisWallTimestamp,
      crisisWallActiveEscalationId: escalationId,
      crisisWallReason: 'pulsecheck_chat_tier_3',
    }, { merge: true });
    safetyStateWriteStatus = 'completed';
  } catch (error) {
    safetyStateWriteStatus = 'failed';
    safetyStateError = {
      code: error?.code || 'ATHLETE_SAFETY_STATE_WRITE_FAILED',
      message: error?.message || 'Private athlete safety-state write failed.',
    };
    console.error('[pulsecheck-escalation] Tier 3 safety-state write failed; continuing provider handoff:', safetyStateError);
  }

  try {
    await runtimeDb.collection('escalation-records').doc(escalationId).set({
      safetyStateWriteStatus,
      safetyStateWriteError: safetyStateError,
      safetyStateWriteAttemptedAt: nowSec,
    }, { merge: true });
  } catch (error) {
    console.warn('[pulsecheck-escalation] Could not persist Tier 3 safety-write audit state:', error?.message || error);
  }

  let handoffResult;
  try {
    handoffResult = await handoffRunner(
      userId,
      conversationId,
      escalationId,
      escalationData,
      supportContext,
      runtimeDb,
    );
  } catch (error) {
    console.error('[pulsecheck-escalation] Critical handoff error:', error);
    handoffResult = {
      success: false,
      status: 'failed',
      error: {
        code: error?.code || 'CRITICAL_HANDOFF_FAILED',
        message: error?.message || 'Critical handoff failed.',
      },
      requestId: error?.requestId || null,
    };
    try {
      await runtimeDb.collection('escalation-records').doc(escalationId).set({
        handoffStatus: HandoffStatus.Failed,
        handoffFailureReason: handoffResult.error.message,
        handoffFailureCode: handoffResult.error.code,
        clinicalRequestId: handoffResult.requestId,
        incidentLastActivityAt: Math.floor(Date.now() / 1000),
      }, { merge: true });
    } catch (auditError) {
      console.warn('[pulsecheck-escalation] Could not persist Tier 3 handoff-failure audit state:', auditError?.message || auditError);
    }
  }

  return { safetyStateWriteStatus, safetyStateError, handoffResult };
}

exports.handler = async (event, context) => {
  let requestBody = {};
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const body = JSON.parse(event.body || '{}');
    requestBody = body;
    const { action } = body;

    let caller;
    try {
      caller = await verifyEscalationCaller(event);
    } catch (authError) {
      return {
        statusCode: authError?.statusCode || 401,
        headers,
        body: JSON.stringify({ error: authError?.message || 'Sign in is required for escalation actions.' }),
      };
    }

    const authorization = await authorizeEscalationAction({ caller, action, body });
    if (!authorization.ok) {
      return {
        statusCode: authorization.statusCode || 403,
        headers,
        body: JSON.stringify({ error: authorization.error || 'Unauthorized escalation action.' }),
      };
    }

    switch (action) {
      case 'create':
        return await handleCreateEscalation(body);
      case 'consent':
        return await handleConsent(body);
      case 'handoff':
        return await handleClinicalHandoff(body);
      case 'summary':
        return await generateConversationSummary(body);
      case 'notify-coach':
        return await notifyCoach(body);
      case 'resolve':
        return await handleResolve({ ...body, resolvedBy: caller.uid });
      case 'care-state':
        return await handleCareState(body);
      default:
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    }

  } catch (error) {
    console.error('[pulsecheck-escalation] Error:', error);
    try {
      const candidatePilotId = typeof requestBody?.pilotId === 'string' ? requestBody.pilotId.trim() : '';
      if (candidatePilotId) {
        await recordPilotMetricAlert({
          db,
          pilotId: candidatePilotId,
          scope: 'escalation_handler',
          severity: 'error',
          message: error?.message || 'PulseCheck escalation handler failed.',
        });
      }
    } catch (nestedError) {
      console.error('[pulsecheck-escalation] Failed to record alert:', nestedError);
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

/**
 * Create a new escalation record
 */
async function handleCreateEscalation(body, runtimeDb = db) {
  const {
    userId,
    conversationId,
    tier,
    category,
    triggerMessageId,
    triggerContent,
    classificationReason,
    classificationConfidence,
    disposition,
    classificationFamily,
    explanation,
    severity,
    requiresCoachReview,
    requiresClinicalHandoff,
    dedupeEligible,
    sourceTriggerMessageId,
    incident,
  } = body;

  if (!userId || !conversationId || tier === undefined) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const conversationDoc = await runtimeDb.collection('conversations').doc(conversationId).get();
  if (conversationDoc.exists && normalizeString(conversationDoc.data()?.userId) !== normalizeString(userId)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Conversation does not belong to this athlete' }) };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const stateSnapshot = buildClinicalStateSnapshotEnvelope(body);
  const model = normalizeEscalationModel({
    userId,
    tier,
    category,
    conversationId,
    classificationReason,
    classificationConfidence,
    disposition,
    classificationFamily,
    explanation,
    severity,
    requiresCoachReview,
    requiresClinicalHandoff,
    dedupeEligible,
    sourceTriggerMessageId,
    incident,
  });
  const existingRecord = await findMergeableEscalationRecord({
    userId,
    conversationId,
    model,
    runtimeDb,
  });

  let escalationId = existingRecord?.id || '';
  let escalationData = null;
  let createdNewRecord = false;
  let deduped = false;

  if (existingRecord?.id && model.dedupeEligible !== false) {
    deduped = true;
    const incomingIncidentKey = normalizeString(model?.incident?.incidentKeyCandidate || model.incidentKeyCandidate);
    const existingCanonicalKey = normalizeString(existingRecord?.incident?.canonicalIncidentKey || existingRecord.incidentKeyCandidate || existingRecord.incidentId || existingRecord.id);
    const upgradeToIncoming = model.requiresClinicalHandoff
      || (Number(model.tier) || 0) > (Number(existingRecord.tier) || 0);
    escalationData = buildEscalationRecordPayload({
      userId,
      conversationId,
      triggerMessageId,
      triggerContent,
      model: upgradeToIncoming ? model : normalizeEscalationModel({
        ...existingRecord,
        conversationId,
      }),
      nowSec,
      existingRecord,
    });
    escalationData.dedupeMergedCount = Number(existingRecord.dedupeMergedCount || 0) + 1;
    escalationData.dedupeLastMergedAt = nowSec;
    escalationData.dedupeLastTriggerMessageId = triggerMessageId || '';
    escalationData.dedupeLastTriggerContent = triggerContent || '';
    escalationData.dedupeLastClassificationReason = model.classificationReason || '';
    escalationData.incident = {
      ...(escalationData.incident || {}),
      id: existingRecord.incidentId || existingRecord.id,
      recordCount: Math.max(1, Number(existingRecord.incidentRecordCount || existingRecord?.incident?.recordCount || 1)) + 1,
      lastActivityAt: nowSec,
      canonicalIncidentKey: upgradeToIncoming && incomingIncidentKey ? incomingIncidentKey : existingCanonicalKey,
      mergedIntoIncidentKey: existingRecord.mergeStrategy === 'fallback_key' && incomingIncidentKey && incomingIncidentKey !== existingCanonicalKey
        ? existingCanonicalKey
        : (escalationData.incident?.mergedIntoIncidentKey || null),
      supersededByIncidentKey: upgradeToIncoming && incomingIncidentKey && incomingIncidentKey !== existingCanonicalKey
        ? incomingIncidentKey
        : (escalationData.incident?.supersededByIncidentKey || null),
      sourceTriggerMessageId: model.sourceTriggerMessageId || triggerMessageId || '',
      lastTriggerMessageId: triggerMessageId || '',
      lastTriggerContent: triggerContent || '',
      rationaleHistory: appendBounded(
        escalationData.incident?.rationaleHistory,
        buildIncidentRationaleEntry({ model, nowSec })
      ),
      evidenceTrail: appendBounded(
        escalationData.incident?.evidenceTrail,
        buildIncidentEvidenceEntry({
          triggerMessageId,
          sourceTriggerMessageId: model.sourceTriggerMessageId || triggerMessageId,
          conversationId,
          triggerContent,
          mergeStrategy: existingRecord.mergeStrategy || 'same_conversation',
          incidentKeyCandidate: incomingIncidentKey || escalationData.incident?.incidentKeyCandidate,
          nowSec,
        })
      ),
      lifecycleEvents: appendBounded(
        escalationData.incident?.lifecycleEvents,
        buildIncidentLifecycleEntry(
          upgradeToIncoming && incomingIncidentKey && incomingIncidentKey !== existingCanonicalKey ? 'superseded' : 'merged',
          nowSec,
          existingRecord.mergeStrategy === 'fallback_key' ? 'fallback_grouping' : 'same_conversation'
        )
      ),
    };
    escalationData.incidentId = existingRecord.incidentId || existingRecord.id;
    escalationData.incidentKeyCandidate = escalationData.incident.incidentKeyCandidate;
    escalationData.mergedIntoIncidentKey = escalationData.incident.mergedIntoIncidentKey;
    escalationData.supersededByIncidentKey = escalationData.incident.supersededByIncidentKey;
    escalationData.sourceTriggerMessageId = escalationData.incident.sourceTriggerMessageId;
    escalationData.incidentRecordCount = escalationData.incident.recordCount;
    escalationData.incidentLastActivityAt = nowSec;
    if (stateSnapshot) escalationData.stateSnapshot = stateSnapshot;
    await runtimeDb.collection('escalation-records').doc(existingRecord.id).set(escalationData, { merge: true });
  } else {
    escalationData = buildEscalationRecordPayload({
      userId,
      conversationId,
      triggerMessageId,
      triggerContent,
      model,
      nowSec,
    });
    if (stateSnapshot) escalationData.stateSnapshot = stateSnapshot;
    const docRef = await runtimeDb.collection('escalation-records').add(escalationData);
    escalationId = docRef.id;
    escalationData.id = escalationId;
    escalationData.incidentId = escalationId;
    escalationData.incident = {
      ...(escalationData.incident || {}),
      id: escalationId,
    };
    escalationData.incidentRecordCount = Math.max(1, Number(escalationData.incidentRecordCount || 1));
    await docRef.update({
      id: escalationId,
      incidentId: escalationId,
      incident: escalationData.incident,
    });
    createdNewRecord = true;
  }

  if (createdNewRecord) {
    await emitPilotMetricEvent({
      db: runtimeDb,
      athleteId: userId,
      eventType: 'escalation_created',
      actorRole: 'system',
      actorUserId: userId,
      sourceCollection: 'escalation-records',
      sourceDocumentId: escalationId,
      metricPayload: {
        tier: escalationData.tier,
        category: escalationData.category,
        disposition: escalationData.disposition,
        classificationFamily: escalationData.classificationFamily,
        requiresClinicalHandoff: escalationData.requiresClinicalHandoff,
        countsTowardCareKpi: escalationData.countsTowardCareKpi,
        consentStatus: escalationData.consentStatus,
      },
      createdAt: nowSec * 1000,
    });
  }

  await refreshPilotOutcomeRollupsForAthlete(userId, nowSec * 1000, runtimeDb);

  // Update conversation with escalation state
  const activeTier = isTrueCareEscalationClassification({
    tier: escalationData.tier,
    classificationFamily: escalationData.classificationFamily,
    requiresClinicalHandoff: escalationData.requiresClinicalHandoff,
  }) ? escalationData.tier : EscalationTier.None;
  const supportContext = await resolveEscalationSupportContext({
    athleteId: userId,
    preferredPilotId: escalationData?.pilotId || null,
    preferredTeamMembershipId: escalationData?.teamMembershipId || null,
    preferredTeamId: escalationData?.teamId || null,
  }, runtimeDb);
  await runtimeDb.collection('conversations').doc(conversationId).set({
    escalationTier: activeTier,
    escalationStatus: EscalationRecordStatus.Active,
    escalationRecordId: escalationId,
    isInSafetyMode: activeTier === EscalationTier.CriticalRisk,
    lastEscalationAt: nowSec
  }, { merge: true });

  let handoffResult = null;
  let safetyStateWriteStatus = activeTier === EscalationTier.CriticalRisk ? 'pending' : 'not_required';
  let safetyStateError = null;

  // For Tier 3 (Critical), immediately initiate and await the safety handoff.
  if (activeTier === EscalationTier.CriticalRisk) {
    const criticalResult = await executeCriticalSafetyOperations({
      userId,
      conversationId,
      escalationId,
      escalationData,
      supportContext,
      nowSec,
      runtimeDb,
    });
    safetyStateWriteStatus = criticalResult.safetyStateWriteStatus;
    safetyStateError = criticalResult.safetyStateError;
    handoffResult = criticalResult.handoffResult;
  }

  console.log('[pulsecheck-escalation] Created escalation:', {
    id: escalationId,
    userId: userId.slice(0, 8) + '...',
    tier,
    category
  });

  const handoffStatus = activeTier === EscalationTier.CriticalRisk
    ? (handoffResult?.success === true ? HandoffStatus.Completed : HandoffStatus.Failed)
    : escalationData.handoffStatus;
  const handoffError = handoffStatus === HandoffStatus.Failed
    ? (typeof handoffResult?.error === 'string'
        ? { code: 'CLINICAL_HANDOFF_FAILED', message: handoffResult.error }
        : handoffResult?.error || {
            code: 'CLINICAL_HANDOFF_FAILED',
            message: 'Clinical handoff was not confirmed.',
          })
    : null;
  const operationSucceeded = activeTier === EscalationTier.CriticalRisk
    ? safetyStateWriteStatus === 'completed' && handoffStatus === HandoffStatus.Completed
    : true;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: operationSucceeded,
      recordCreated: Boolean(escalationId),
      escalationId,
      tier: escalationData.tier,
      deduped,
      requiresConsent: activeTier === EscalationTier.ElevatedRisk,
      consentRequired: activeTier === EscalationTier.ElevatedRisk,
      isCritical: activeTier === EscalationTier.CriticalRisk,
      safetyStateWriteStatus,
      safetyStateError,
      handoffStatus,
      handoffError,
      handoffResult,
      supportRoute: supportContext.route,
      hotlineResource: supportContext.route === 'hotline' ? HOTLINE_SUPPORT_RESOURCE : null,
      message:
        activeTier === EscalationTier.CriticalRisk && supportContext.route === 'hotline'
          ? buildHotlineSupportMessage(true)
          : null,
    })
  };
}

/**
 * Handle consent decision (Tier 2 only)
 */
async function handleConsent(body, runtimeDb = db, triggerHandoff = triggerElevatedHandoff) {
  const { escalationId, userId, consent } = body;

  if (!escalationId || !userId || typeof consent !== 'boolean') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const requestedStatus = consent ? ConsentStatus.Accepted : ConsentStatus.Declined;
  const docRef = runtimeDb.collection('escalation-records').doc(escalationId);
  const decision = await runtimeDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists) return { outcome: 'not_found' };

    const current = snapshot.data() || {};
    if (normalizeString(current.userId) !== normalizeString(userId)) {
      return { outcome: 'unauthorized' };
    }
    if (Number(current.tier) !== EscalationTier.ElevatedRisk) {
      return { outcome: 'wrong_tier' };
    }

    const existingStatus = normalizeString(current.consentStatus);
    if (existingStatus === ConsentStatus.Accepted || existingStatus === ConsentStatus.Declined) {
      return {
        outcome: existingStatus === requestedStatus ? 'repeat' : 'conflict',
        data: current,
        existingStatus,
      };
    }

    if (consent) {
      transaction.update(docRef, {
        consentStatus: ConsentStatus.Accepted,
        consentTimestamp: nowSec,
        consentHandoffClaimedAt: nowSec,
        handoffStatus: HandoffStatus.Pending,
        incidentStatus: EscalationIncidentStatus.Open,
        incidentLastActivityAt: nowSec,
        incident: {
          ...((current.incident && typeof current.incident === 'object') ? current.incident : {}),
          id: current.incidentId || escalationId,
          status: EscalationIncidentStatus.Open,
          lastActivityAt: nowSec,
          lifecycleEvents: appendBounded(
            current?.incident?.lifecycleEvents,
            buildIncidentLifecycleEntry('opened', nowSec, 'consent_accepted')
          ),
        },
      });
    } else {
      transaction.update(docRef, {
        consentStatus: ConsentStatus.Declined,
        consentTimestamp: nowSec,
        status: EscalationRecordStatus.Declined,
        incidentStatus: EscalationIncidentStatus.Declined,
        incidentClosedAt: nowSec,
        incidentLastActivityAt: nowSec,
        incident: {
          ...((current.incident && typeof current.incident === 'object') ? current.incident : {}),
          id: current.incidentId || escalationId,
          status: EscalationIncidentStatus.Declined,
          lastActivityAt: nowSec,
          closedAt: nowSec,
          lifecycleEvents: appendBounded(
            current?.incident?.lifecycleEvents,
            buildIncidentLifecycleEntry('declined', nowSec, 'consent_declined')
          ),
        },
      });
    }

    return { outcome: 'recorded', data: current };
  });

  if (decision.outcome === 'not_found') {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Escalation not found' }) };
  }
  if (decision.outcome === 'unauthorized') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (decision.outcome === 'wrong_tier') {
    return { statusCode: 409, headers, body: JSON.stringify({ error: 'Consent is only accepted for Tier 2 escalations' }) };
  }
  if (decision.outcome === 'conflict') {
    return {
      statusCode: 409,
      headers,
      body: JSON.stringify({
        success: false,
        consentRecorded: true,
        errorCode: 'CONSENT_DECISION_CONFLICT',
        error: `Consent was already recorded as ${decision.existingStatus}. A later request cannot change that decision.`,
        existingConsentStatus: decision.existingStatus,
        requestedConsentStatus: requestedStatus,
      }),
    };
  }
  if (decision.outcome === 'repeat') {
    if (requestedStatus === ConsentStatus.Declined) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          consentRecorded: true,
          deduped: true,
          status: 'consent_declined',
          handoffStatus: decision.data?.handoffStatus || null,
          message: 'Your earlier decision not to connect was already recorded.',
        }),
      };
    }

    const existingHandoffStatus = normalizeString(decision.data?.handoffStatus) || HandoffStatus.Pending;
    const providerConfirmed = existingHandoffStatus === HandoffStatus.Completed
      && Boolean(normalizeString(decision.data?.clinicalReferenceId));
    const hotlineCompleted = existingHandoffStatus === HandoffStatus.Completed
      && normalizeString(decision.data?.supportRoute) === 'hotline';
    const completionConfirmed = providerConfirmed || hotlineCompleted;
    const handoffFailed = existingHandoffStatus === HandoffStatus.Failed;
    const repeatedPayload = {
      success: completionConfirmed,
      consentRecorded: true,
      deduped: true,
      status: 'consent_accepted',
      handoffStatus: existingHandoffStatus,
      providerConfirmed,
      clinicalReferenceId: normalizeString(decision.data?.clinicalReferenceId) || null,
      providerRequestId: normalizeString(
        decision.data?.clinicalRequestId || decision.data?.clinicalAthleteUpsertRequestId
      ) || null,
      providerError: handoffFailed
        ? {
            code: normalizeString(decision.data?.handoffFailureCode) || 'CLINICAL_HANDOFF_FAILED',
            message: normalizeString(decision.data?.handoffFailureReason) || 'Clinical handoff was not confirmed.',
          }
        : null,
      message: completionConfirmed
        ? hotlineCompleted
          ? buildHotlineSupportMessage(false)
          : 'Your consent and clinical connection were already confirmed.'
        : handoffFailed
          ? 'Your consent is saved, but the clinical connection was not confirmed. Please contact your support team directly if you need help now.'
          : 'Your consent is saved and the clinical connection is still being confirmed.',
    };
    return {
      statusCode: completionConfirmed ? 200 : (handoffFailed ? 502 : 202),
      headers,
      body: JSON.stringify(repeatedPayload),
    };
  }

  const data = decision.data;

  if (consent) {
    let supportContext = null;
    let handoffResult;
    try {
      supportContext = await resolveEscalationSupportContext({
        athleteId: userId,
        preferredPilotId: data?.pilotId || null,
        preferredTeamMembershipId: data?.teamMembershipId || null,
        preferredTeamId: data?.teamId || null,
      }, runtimeDb);
      handoffResult = await triggerHandoff(
        userId,
        data.conversationId,
        escalationId,
        {
          ...data,
          consentStatus: ConsentStatus.Accepted,
          consentTimestamp: nowSec,
          handoffStatus: HandoffStatus.Pending,
        },
        supportContext,
        runtimeDb,
      );
    } catch (error) {
      console.error('[pulsecheck-escalation] Elevated handoff error:', error);
      handoffResult = {
        success: false,
        status: 'failed',
        requestId: error?.requestId || null,
        error: {
          code: error?.code || 'CLINICAL_HANDOFF_REQUEST_FAILED',
          message: error?.message || 'Elevated handoff failed.',
        },
      };
    }

    const handoffSucceeded = handoffResult?.success === true
      && handoffResult?.ok !== false
      && (
        supportContext?.route === 'hotline'
        || Boolean(normalizeString(handoffResult?.escalationId))
        || handoffResult?.deduped === true
      );
    if (!handoffSucceeded) {
      const providerError = typeof handoffResult?.error === 'string'
        ? { code: 'CLINICAL_HANDOFF_FAILED', message: handoffResult.error }
        : {
            code: handoffResult?.error?.code || 'CLINICAL_HANDOFF_FAILED',
            message: handoffResult?.error?.message || 'Clinical provider did not confirm the handoff.',
          };
      await docRef.set({
        handoffStatus: HandoffStatus.Failed,
        handoffFailureCode: providerError.code,
        handoffFailureReason: providerError.message,
        handoffFailedAt: Math.floor(Date.now() / 1000),
        clinicalRequestId: handoffResult?.requestId || null,
        incidentLastActivityAt: Math.floor(Date.now() / 1000),
      }, { merge: true });

      await refreshPilotOutcomeRollupsForAthlete(userId, nowSec * 1000, runtimeDb);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          success: false,
          consentRecorded: true,
          status: 'consent_accepted',
          handoffStatus: HandoffStatus.Failed,
          handoffResult,
          providerError,
          providerRequestId: handoffResult?.requestId || null,
          supportRoute: supportContext?.route || null,
          hotlineResource: supportContext?.route === 'hotline' ? HOTLINE_SUPPORT_RESOURCE : null,
          message: 'Your consent is saved, but the clinical connection was not confirmed. Please contact your support team directly if you need help now.',
        }),
      };
    }

    await refreshPilotOutcomeRollupsForAthlete(userId, nowSec * 1000, runtimeDb);

    console.log('[pulsecheck-escalation] Consent accepted:', escalationId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        consentRecorded: true,
        status: 'consent_accepted',
        handoffStatus: HandoffStatus.Completed,
        handoffResult,
        providerConfirmed: supportContext.route === 'clinician',
        providerRequestId: handoffResult?.requestId || null,
        supportRoute: supportContext.route,
        hotlineResource: supportContext.route === 'hotline' ? HOTLINE_SUPPORT_RESOURCE : null,
        message:
          supportContext.route === 'hotline'
            ? buildHotlineSupportMessage(false)
            : 'Thank you. A mental health professional will reach out soon.'
      })
    };
  }

  await runtimeDb.collection('conversations').doc(data.conversationId).set({
    escalationStatus: EscalationRecordStatus.Declined
  }, { merge: true });

  await refreshPilotOutcomeRollupsForAthlete(userId, nowSec * 1000, runtimeDb);

  console.log('[pulsecheck-escalation] Consent declined:', escalationId);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      consentRecorded: true,
      status: 'consent_declined',
      message: 'Understood. I\'m still here if you want to talk. Remember, you can always reach out to a professional if things change.'
    })
  };
}

/**
 * Trigger clinical handoff to AuntEDNA
 */
async function handleClinicalHandoff(body) {
  const { escalationId, userId, conversationId } = body;

  if (!escalationId || !userId || !conversationId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const escalationRef = db.collection('escalation-records').doc(escalationId);
  const escalationDoc = await escalationRef.get();

  if (!escalationDoc.exists) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Escalation not found' }) };
  }

  const escalationData = escalationDoc.data();
  if (normalizeString(escalationData?.userId) !== normalizeString(userId)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Escalation does not belong to this athlete' }) };
  }
  if (normalizeString(escalationData?.conversationId) !== normalizeString(conversationId)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Escalation conversation does not match' }) };
  }
  if (Number(escalationData?.tier) < EscalationTier.ElevatedRisk) {
    return { statusCode: 409, headers, body: JSON.stringify({ error: 'This escalation is not eligible for a clinical handoff' }) };
  }
  if (
    Number(escalationData?.tier) === EscalationTier.ElevatedRisk
    && escalationData?.consentStatus !== ConsentStatus.Accepted
  ) {
    return { statusCode: 409, headers, body: JSON.stringify({ error: 'Tier 2 handoff requires athlete consent' }) };
  }
  const supportContext = await resolveEscalationSupportContext({
    athleteId: userId,
    preferredPilotId: escalationData?.pilotId || null,
    preferredTeamMembershipId: escalationData?.teamMembershipId || null,
    preferredTeamId: escalationData?.teamId || null,
  });

  // Build handoff payload
  const handoffResult = supportContext.route === 'hotline'
    ? await applyHotlineSupportRouting(userId, escalationId, escalationData, supportContext, escalationData?.tier === EscalationTier.CriticalRisk)
    : await performClinicalHandoff(
        userId,
        conversationId,
        escalationId,
        escalationData,
        db,
        supportContext,
      );

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(handoffResult)
  };
}

/**
 * Generate AI summary of conversation for clinical handoff
 */
async function generateConversationSummary(body) {
  const { conversationId, escalationId } = body;

  if (!conversationId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing conversationId' }) };
  }

  // Load conversation
  const convoDoc = await db.collection('conversations').doc(conversationId).get();
  if (!convoDoc.exists) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Conversation not found' }) };
  }

  const convoData = convoDoc.data();
  const messages = Array.isArray(convoData.messages) ? convoData.messages : [];

  // Build conversation transcript
  const transcript = messages.map(m => 
    `${m.isFromUser ? 'Athlete' : 'AI'}: ${m.content}`
  ).join('\n');

  // Generate summary with OpenAI
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing OPEN_AI_SECRET_KEY' }) };
  }

  const summaryPrompt = `You are creating a clinical summary for a mental health professional reviewing an athlete's PulseCheck conversation.

Summarize the following conversation, focusing on:
1. Primary concerns expressed by the athlete
2. Emotional state and any distress indicators
3. Any safety concerns mentioned
4. Key themes or patterns
5. Current coping strategies mentioned

Be objective and clinical. Do not diagnose. Keep the summary under 200 words.

## Conversation:
${transcript}`;

  const completionRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a clinical documentation assistant. Write concise, professional summaries.' },
        { role: 'user', content: summaryPrompt }
      ],
      temperature: 0.3,
      max_tokens: 400
    })
  });

  if (!completionRes.ok) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Summary generation failed' }) };
  }

  const completion = await completionRes.json();
  const summary = completion.choices?.[0]?.message?.content?.trim() || 'Summary unavailable.';

  // Save summary to escalation record if provided
  if (escalationId) {
    await db.collection('escalation-records').doc(escalationId).update({
      conversationSummary: summary
    });
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      summary
    })
  };
}

const COACH_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

// Resolve a coach's SMS target from their PulseCheck team membership(s):
// only members who opted into SMS alerts AND have a phone on file qualify.
// Prefers the membership tied to the escalating athlete's team when known.
async function resolveCoachSmsTarget(coachUserId, preferredTeamId, runtimeDb = db) {
  const normalizedCoachId = normalizeString(coachUserId);
  if (!normalizedCoachId) return null;
  try {
    const snap = await runtimeDb
      .collection(COACH_MEMBERSHIPS_COLLECTION)
      .where('userId', '==', normalizedCoachId)
      .get();
    const candidates = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data() || {};
      const smsEnabled = data?.notificationPreferences?.sms === true;
      const phone = normalizeString(data.phone);
      if (!smsEnabled || !phone) continue;
      candidates.push({
        membershipId: docSnap.id,
        teamId: normalizeString(data.teamId),
        phone,
      });
    }
    if (candidates.length === 0) return null;
    const teamId = normalizeString(preferredTeamId);
    return (teamId && candidates.find((c) => c.teamId === teamId)) || candidates[0];
  } catch (error) {
    console.warn('[pulsecheck-escalation] Failed to resolve coach SMS target (non-blocking):', error?.message || error);
    return null;
  }
}

// Privacy-safe SMS copy — no athlete name or conversation content over SMS.
function buildCoachEscalationSms({ tier, siteUrl }) {
  const baseUrl = (siteUrl || process.env.SITE_URL || '').trim().replace(/\/+$/, '') || 'https://fitwithpulse.ai';
  const dashboardUrl = `${baseUrl}/coach/dashboard`;
  const lead = Number(tier) >= EscalationTier.CriticalRisk
    ? 'PulseCheck URGENT: an athlete you support had a critical check-in and the team support pathway was activated.'
    : 'PulseCheck: an athlete you support had an escalation and the support pathway was activated.';
  return `${lead} Open your dashboard: ${dashboardUrl} Reply STOP to opt out.`;
}

/**
 * Notify coach of escalation (Tier 1 and above)
 */
async function notifyCoach(body, runtimeDb = db) {
  const { sendCoachEscalationEmail } = require('./utils/sendCoachEscalationEmail');
  const { sendTwilioSms } = require('./utils/sendTwilioSms');
  const { escalationId, userId, coachId } = body;

  if (!escalationId || !userId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Find coach if not provided
  let targetCoachId = coachId;
  if (!targetCoachId) {
    // Look up athlete's connected coach
    const connectionSnap = await runtimeDb
      .collection('athlete-coach-connections')
      .where('athleteId', '==', userId)
      .where('status', '==', 'accepted')
      .limit(1)
      .get();

    if (!connectionSnap.empty) {
      targetCoachId = connectionSnap.docs[0].data().coachId;
    }
  }

  if (!targetCoachId) {
    console.log('[pulsecheck-escalation] No coach found for notification');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        reason: 'no_coach_connected'
      })
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  // Load tier (for correct coach messaging + email copy)
  let tier = EscalationTier.None;
  try {
    const escalationSnap = await runtimeDb.collection('escalation-records').doc(escalationId).get();
    if (escalationSnap.exists) {
      const data = escalationSnap.data() || {};
      if (typeof data.tier === 'number') tier = data.tier;
    }
  } catch (e) {
    console.warn('[pulsecheck-escalation] Failed to load escalation tier (non-blocking):', e?.message || e);
  }

  const escalationSnapForUpdate = await runtimeDb.collection('escalation-records').doc(escalationId).get();
  const escalationForUpdate = escalationSnapForUpdate.exists ? (escalationSnapForUpdate.data() || {}) : {};

  // Update escalation record
  await runtimeDb.collection('escalation-records').doc(escalationId).update({
    coachNotified: true,
    coachId: targetCoachId,
    coachNotifiedAt: nowSec,
    incidentLastActivityAt: nowSec,
  });
  await runtimeDb.collection('escalation-records').doc(escalationId).set({
    incident: {
      ...((escalationForUpdate.incident && typeof escalationForUpdate.incident === 'object') ? escalationForUpdate.incident : {}),
      id: escalationForUpdate.incidentId || escalationId,
      status: escalationForUpdate.incidentStatus || EscalationIncidentStatus.Open,
      lastActivityAt: nowSec,
    },
  }, { merge: true });

  await emitPilotMetricEvent({
    db: runtimeDb,
    athleteId: userId,
    eventType: 'coach_notified',
    actorRole: 'coach',
    actorUserId: targetCoachId,
    sourceCollection: 'escalation-records',
    sourceDocumentId: escalationId,
      metricPayload: {
        coachId: targetCoachId,
        tier,
        disposition: escalationForUpdate.disposition || deriveDisposition({
          tier,
          requiresClinicalHandoff: escalationForUpdate.requiresClinicalHandoff === true,
          requiresCoachReview: escalationForUpdate.requiresCoachReview !== false,
        }),
        classificationFamily: escalationForUpdate.classificationFamily || deriveClassificationFamily({
          tier,
          category: escalationForUpdate.category,
        }),
        countsTowardCareKpi: escalationForUpdate.countsTowardCareKpi === true,
      },
      createdAt: nowSec * 1000,
    });

  await refreshPilotOutcomeRollupsForAthlete(userId, nowSec * 1000, runtimeDb);

  // Create notification for coach
  // Note: This would integrate with your push notification system
  // For now, we create a notification document
  await runtimeDb.collection('notifications').add({
    userId: targetCoachId,
    type: 'escalation-alert',
    title: tier === EscalationTier.MonitorOnly ? 'Athlete Check-In (Monitor)' : 'Athlete Check-In Alert',
    message:
      tier === EscalationTier.MonitorOnly
        ? 'An athlete you coach was flagged for monitor-only concern. Please review when you can.'
        : tier === EscalationTier.ElevatedRisk || tier === EscalationTier.CriticalRisk
          ? 'An athlete you coach had an escalation event and the team support pathway was activated. Please check your dashboard.'
          : 'An athlete you coach has been flagged for elevated concern. Please check your dashboard.',
    escalationId,
    athleteId: userId,
    read: false,
    createdAt: nowSec
  });

  // Email coach (non-blocking). Do NOT include conversation details.
  try {
    const coachSnap = await runtimeDb.collection('users').doc(targetCoachId).get();
    const coach = coachSnap.exists ? (coachSnap.data() || {}) : {};
    const coachEmail = typeof coach.email === 'string' ? coach.email.trim() : '';
    const coachName = (coach.displayName || coach.username || '').trim();

    const athleteSnap = await runtimeDb.collection('users').doc(userId).get();
    const athlete = athleteSnap.exists ? (athleteSnap.data() || {}) : {};
    const athleteName = (athlete.displayName || athlete.username || 'An athlete').trim();

    if (coachEmail) {
      const siteUrl = process.env.SITE_URL || '';
      const result = await sendCoachEscalationEmail({
        coachEmail,
        coachName,
        athleteName,
        tier,
        siteUrl,
      });
      console.log('[pulsecheck-escalation] Coach email sent (best-effort):', {
        success: result?.success,
        skipped: result?.skipped,
        tier,
        coachId: targetCoachId,
      });

      // Log to Notification Logs dashboard (email channel; no FCM token)
      try {
        const FieldValue = admin.firestore.FieldValue;
        await runtimeDb.collection('notification-logs').add({
          fcmToken: coachEmail ? `email:${coachEmail.substring(0, 20)}...` : 'EMAIL',
          title: `Coach escalation email (Tier ${tier})`,
          body:
            tier === EscalationTier.MonitorOnly
              ? 'Tier 1 coach-review escalation email sent (privacy-safe).'
              : `Tier ${tier} support-path escalation email sent (privacy-safe).`,
          notificationType: 'COACH_ESCALATION_EMAIL',
          functionName: 'netlify/pulsecheck-escalation.notifyCoach',
          success: !!result?.success,
          messageId: result?.messageId || null,
          error: result?.success
            ? null
            : { code: result?.reason || 'EMAIL_FAILED', message: result?.error || 'Email send failed or skipped' },
          dataPayload: {
            channel: 'email',
            coachId: targetCoachId,
            athleteId: userId,
            escalationId,
            tier,
            skipped: !!result?.skipped,
          },
          recipients: [{
            userId: targetCoachId,
            displayName: coachName || '',
            email: coachEmail || '',
            deliveryChannel: 'email',
            success: !!result?.success,
            messageId: result?.messageId || null,
          }],
          timestamp: FieldValue.serverTimestamp(),
          timestampEpoch: nowSec,
          createdAt: FieldValue.serverTimestamp(),
          version: '1.0',
        });
      } catch (logErr) {
        console.warn('[pulsecheck-escalation] Failed to write notification-logs (non-blocking):', logErr?.message || logErr);
      }
    } else {
      console.log('[pulsecheck-escalation] Coach email missing; skipping email send', {
        coachId: targetCoachId,
      });

      // Log missing email to Notification Logs dashboard (helps debug why nothing appears)
      try {
        const FieldValue = admin.firestore.FieldValue;
        await runtimeDb.collection('notification-logs').add({
          fcmToken: 'EMAIL',
          title: `Coach escalation email skipped (Tier ${tier})`,
          body: 'Coach email missing on user profile; email not sent.',
          notificationType: 'COACH_ESCALATION_EMAIL',
          functionName: 'netlify/pulsecheck-escalation.notifyCoach',
          success: false,
          messageId: null,
          error: { code: 'MISSING_COACH_EMAIL', message: 'Coach user doc has no email.' },
          dataPayload: { channel: 'email', coachId: targetCoachId, athleteId: userId, escalationId, tier },
          recipients: [{
            userId: targetCoachId,
            displayName: coachName || '',
            email: coachEmail || '',
            deliveryChannel: 'email',
            success: false,
            error: { code: 'MISSING_COACH_EMAIL', message: 'Coach user doc has no email.' },
          }],
          timestamp: FieldValue.serverTimestamp(),
          timestampEpoch: nowSec,
          createdAt: FieldValue.serverTimestamp(),
          version: '1.0',
        });
      } catch (logErr) {
        console.warn('[pulsecheck-escalation] Failed to write notification-logs for missing email (non-blocking):', logErr?.message || logErr);
      }
    }
  } catch (emailErr) {
    console.warn('[pulsecheck-escalation] Coach email send failed (non-blocking):', emailErr?.message || emailErr);

    // Log email exception to Notification Logs dashboard
    try {
      const FieldValue = admin.firestore.FieldValue;
      await runtimeDb.collection('notification-logs').add({
        fcmToken: 'EMAIL',
        title: `Coach escalation email error (Tier ${tier})`,
        body: 'Coach escalation email threw an exception (privacy-safe).',
        notificationType: 'COACH_ESCALATION_EMAIL',
        functionName: 'netlify/pulsecheck-escalation.notifyCoach',
        success: false,
        messageId: null,
        error: { code: emailErr?.code || 'EMAIL_EXCEPTION', message: emailErr?.message || String(emailErr) },
        dataPayload: { channel: 'email', coachId: targetCoachId, athleteId: userId, escalationId, tier },
        recipients: [{
          userId: targetCoachId,
          displayName: coachName || '',
          email: coachEmail || '',
          deliveryChannel: 'email',
          success: false,
          error: { code: emailErr?.code || 'EMAIL_EXCEPTION', message: emailErr?.message || String(emailErr) },
        }],
        timestamp: FieldValue.serverTimestamp(),
        timestampEpoch: nowSec,
        createdAt: FieldValue.serverTimestamp(),
        version: '1.0',
      });
    } catch (logErr) {
      console.warn('[pulsecheck-escalation] Failed to write notification-logs for email exception (non-blocking):', logErr?.message || logErr);
    }
  }

  // SMS the coach (non-blocking) — only for urgent, time-sensitive tiers
  // (Elevated/Critical), only when they opted into SMS alerts and have a phone.
  // Privacy-safe: no athlete name or conversation content over SMS.
  if (tier >= EscalationTier.ElevatedRisk) {
    try {
      const smsTarget = await resolveCoachSmsTarget(targetCoachId, escalationForUpdate.teamId, runtimeDb);
      if (smsTarget?.phone) {
        const siteUrl = process.env.SITE_URL || '';
        const smsBody = buildCoachEscalationSms({ tier, siteUrl });
        const smsResult = await sendTwilioSms({ to: smsTarget.phone, body: smsBody });
        console.log('[pulsecheck-escalation] Coach SMS sent (best-effort):', {
          success: smsResult?.success,
          skipped: smsResult?.skipped,
          tier,
          coachId: targetCoachId,
        });

        try {
          const FieldValue = admin.firestore.FieldValue;
          await runtimeDb.collection('notification-logs').add({
            fcmToken: `sms:${smsTarget.phone.slice(-4).padStart(smsTarget.phone.length, '*')}`,
            title: `Coach escalation SMS (Tier ${tier})`,
            body: `Tier ${tier} support-path escalation SMS sent (privacy-safe).`,
            notificationType: 'COACH_ESCALATION_SMS',
            functionName: 'netlify/pulsecheck-escalation.notifyCoach',
            success: !!smsResult?.success,
            messageId: smsResult?.messageSid || null,
            error: smsResult?.success
              ? null
              : { code: smsResult?.skipped ? 'SMS_SKIPPED' : 'SMS_FAILED', message: smsResult?.reason || smsResult?.error || 'SMS send failed or skipped' },
            dataPayload: {
              channel: 'sms',
              coachId: targetCoachId,
              athleteId: userId,
              escalationId,
              tier,
              membershipId: smsTarget.membershipId,
              skipped: !!smsResult?.skipped,
            },
            recipients: [{
              userId: targetCoachId,
              deliveryChannel: 'sms',
              success: !!smsResult?.success,
              messageId: smsResult?.messageSid || null,
            }],
            timestamp: FieldValue.serverTimestamp(),
            timestampEpoch: nowSec,
            createdAt: FieldValue.serverTimestamp(),
            version: '1.0',
          });
        } catch (logErr) {
          console.warn('[pulsecheck-escalation] Failed to write SMS notification-logs (non-blocking):', logErr?.message || logErr);
        }
      } else {
        console.log('[pulsecheck-escalation] Coach SMS skipped — no opted-in phone on file', {
          coachId: targetCoachId,
          tier,
        });
      }
    } catch (smsErr) {
      console.warn('[pulsecheck-escalation] Coach SMS send failed (non-blocking):', smsErr?.message || smsErr);
    }
  }

  console.log('[pulsecheck-escalation] Coach notified:', {
    coachId: targetCoachId,
    escalationId
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      coachNotified: true,
      coachId: targetCoachId
    })
  };
}

async function notifyCoachForClinicalHandoff(
  body,
  runtimeDb = db,
  notifyRunner = notifyCoach,
) {
  try {
    const response = await notifyRunner(body, runtimeDb);
    let payload = null;
    try {
      payload = typeof response?.body === 'string' ? JSON.parse(response.body) : response;
    } catch (_error) {
      payload = null;
    }
    const delivered = response?.statusCode >= 200
      && response?.statusCode < 300
      && payload?.success !== false;
    return {
      success: delivered,
      status: delivered ? 'completed' : 'not_delivered',
      reason: payload?.reason || null,
    };
  } catch (error) {
    const failure = {
      success: false,
      status: 'failed',
      error: {
        code: error?.code || 'COACH_NOTIFICATION_FAILED',
        message: error?.message || 'Coach notification failed.',
      },
    };
    console.error('[pulsecheck-escalation] Coach notification failed; continuing clinical handoff:', failure.error);
    try {
      await runtimeDb.collection('escalation-records').doc(body.escalationId).set({
        coachNotificationStatus: 'failed',
        coachNotificationFailureCode: failure.error.code,
        coachNotificationFailureReason: failure.error.message,
        incidentLastActivityAt: Math.floor(Date.now() / 1000),
      }, { merge: true });
    } catch (auditError) {
      console.warn('[pulsecheck-escalation] Could not persist coach-notification failure state:', auditError?.message || auditError);
    }
    return failure;
  }
}

const PROTECTIVE_CLINICAL_APP_STATES = new Set([
  'protective',
  'reduced_functionality',
  'clinician_monitored',
  'crisis_support',
  'guided_reentry',
]);
const CLEAR_CLINICAL_APP_STATES = new Set(['normal', 'standard']);
const CLINICAL_RETURN_TO_TRAINING_STATES = new Set(['not_cleared', 'pending_review', 'cleared']);

function normalizeCareStateMirror(providerResponse) {
  if (providerResponse?.success !== true || providerResponse?.ok === false) {
    const error = providerResponse?.error;
    return {
      ok: false,
      errorCode: typeof error === 'object' && error ? error.code || 'CLINICAL_CARE_STATE_REJECTED' : 'CLINICAL_CARE_STATE_REJECTED',
      error: typeof error === 'string'
        ? error
        : error?.message || 'Clinical provider did not return a successful care state.',
    };
  }

  const data = providerResponse?.data && typeof providerResponse.data === 'object'
    ? providerResponse.data
    : {};
  const nested = data.careState && typeof data.careState === 'object' ? data.careState : {};
  const source = { ...data, ...nested };
  const watchListCandidates = [
    source.watchListActive,
    source.watchList,
    source.watchlistActive,
    source.watchlist,
  ];
  const explicitWatchList = watchListCandidates.find((value) => typeof value === 'boolean');
  const watchListActive = typeof explicitWatchList === 'boolean' ? explicitWatchList : null;
  const rawAppState = normalizeString(source.appState).toLowerCase();
  const appState = (
    PROTECTIVE_CLINICAL_APP_STATES.has(rawAppState)
    || CLEAR_CLINICAL_APP_STATES.has(rawAppState)
  ) ? rawAppState : null;
  const hasUnknownAppState = Boolean(rawAppState) && !appState;
  const rawReturnStatus = normalizeString(source.returnToTrainingStatus).toLowerCase();
  const returnToTrainingStatus = CLINICAL_RETURN_TO_TRAINING_STATES.has(rawReturnStatus)
    ? rawReturnStatus
    : null;
  const hasUnknownReturnStatus = Boolean(rawReturnStatus) && !returnToTrainingStatus;
  const clinicalCaseId = normalizeString(source.clinicalCaseId || source.caseId) || null;
  const pulseEscalationId = normalizeString(
    source.pulseEscalationId || source.escalationRecordId
  ) || null;
  const teamId = normalizeString(source.teamId) || null;

  if (watchListActive === null && !appState && !returnToTrainingStatus) {
    return {
      ok: false,
      errorCode: 'CLINICAL_CARE_STATE_UNRECOGNIZED',
      error: 'Clinical provider response did not include a recognized care-state field.',
    };
  }

  let crisisWallActive = null;
  if (
    watchListActive === true
    || PROTECTIVE_CLINICAL_APP_STATES.has(appState)
    || returnToTrainingStatus === 'not_cleared'
    || returnToTrainingStatus === 'pending_review'
  ) {
    crisisWallActive = true;
  } else {
    const clearAppState = !appState || CLEAR_CLINICAL_APP_STATES.has(appState);
    const clearTrainingState = !returnToTrainingStatus || returnToTrainingStatus === 'cleared';
    if (
      watchListActive === false
      && !hasUnknownAppState
      && !hasUnknownReturnStatus
      && clearAppState
      && clearTrainingState
    ) {
      crisisWallActive = false;
    }
  }

  return {
    ok: true,
    careState: {
      watchListActive,
      appState,
      returnToTrainingStatus,
      crisisWallActive,
      clinicalCaseId,
      pulseEscalationId,
      teamId,
    },
  };
}

/**
 * Reconcile the provider's authoritative coarse care state into the private
 * athlete safety document. Provider errors and ambiguous responses never clear
 * an existing protective state.
 */
async function handleCareState(body, runtimeDb = db, bridgeFactory = createClinicalBridge) {
  const userId = normalizeString(body?.userId);
  if (!userId) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing userId' }) };
  }

  let providerResponse;
  try {
    providerResponse = await bridgeFactory().getCareState(userId);
  } catch (error) {
    const errorCode = error?.code || 'CLINICAL_CARE_STATE_REQUEST_FAILED';
    return {
      statusCode: errorCode === 'CLINICAL_BRIDGE_API_KEY_MISSING' ? 503 : 502,
      headers,
      body: JSON.stringify({
        success: false,
        mirrored: false,
        errorCode,
        error: error?.message || 'Clinical care-state request failed.',
      }),
    };
  }

  const normalized = normalizeCareStateMirror(providerResponse);
  if (!normalized.ok) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        success: false,
        mirrored: false,
        errorCode: normalized.errorCode,
        error: normalized.error,
      }),
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const timestamp = admin?.firestore?.FieldValue?.serverTimestamp
    ? admin.firestore.FieldValue.serverTimestamp()
    : nowSec;
  const careState = normalized.careState;
  const safetyRef = runtimeDb.collection(ATHLETE_SAFETY_STATE_COLLECTION).doc(userId);
  const existingSafetyDoc = await safetyRef.get();
  const existingSafetyState = existingSafetyDoc.exists ? existingSafetyDoc.data() || {} : {};
  const mirror = {
    athleteUserId: userId,
    safetyStateSource: 'clinical_bridge',
    careStateLastSyncedAt: timestamp,
  };
  if (careState.teamId) mirror.teamId = careState.teamId;
  if (typeof careState.watchListActive === 'boolean') mirror.watchListActive = careState.watchListActive;
  if (careState.appState) mirror.appState = careState.appState;
  if (careState.returnToTrainingStatus) mirror.returnToTrainingStatus = careState.returnToTrainingStatus;
  if (careState.clinicalCaseId) mirror.clinicalCaseId = careState.clinicalCaseId;

  if (careState.crisisWallActive === true) {
    mirror.crisisWallActive = true;
    if (existingSafetyState.crisisWallActive !== true) {
      mirror.crisisWallActivatedAt = timestamp;
    }
    if (careState.pulseEscalationId) {
      mirror.crisisWallActiveEscalationId = careState.pulseEscalationId;
    }
    mirror.crisisWallReason = 'clinical_care_state_active';
  } else if (careState.crisisWallActive === false) {
    mirror.crisisWallActive = false;
    mirror.crisisWallClearedAt = timestamp;
    mirror.crisisWallClearReason = 'clinical_care_state_reconciled';
    mirror.crisisWallActiveEscalationId = null;
    mirror.crisisWallReason = null;
  }

  await safetyRef.set(mirror, { merge: true });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      userId,
      source: 'clinical_bridge',
      mirrored: true,
      careState: {
        watchListActive: careState.watchListActive,
        appState: careState.appState,
        returnToTrainingStatus: careState.returnToTrainingStatus,
        crisisWallActive: careState.crisisWallActive,
        clearanceApplied: careState.crisisWallActive === false,
      },
      providerRequestId: providerResponse?.requestId || null,
    }),
  };
}

async function findEscalationForResolution(runtimeDb, escalationId) {
  const directRef = runtimeDb.collection('escalation-records').doc(escalationId);
  const directDoc = await directRef.get();
  if (directDoc.exists) return { ref: directRef, data: directDoc.data() || {} };

  const mirrorQuery = await runtimeDb
    .collection('escalation-records')
    .where('escalationId', '==', escalationId)
    .limit(1)
    .get();
  if (mirrorQuery.empty) return null;
  return { ref: mirrorQuery.docs[0].ref, data: mirrorQuery.docs[0].data() || {} };
}

/**
 * Resolve an escalation. A linked provider case must confirm resolution before
 * the local case closes. Case resolution is not training clearance: this path
 * never changes the athlete's protective safety state. Only an authoritative
 * watchlist.removed callback or care-state reconciliation may clear it.
 */
async function handleResolve(body, runtimeDb = db, bridgeFactory = createClinicalBridge) {
  const {
    escalationId,
    userId,
    resolvedBy,
    resolutionNote,
    coachNote,
    resolutionStatus,
    clinicalEscalationId,
  } = body;

  if (!escalationId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing escalationId' }) };
  }

  const resolvedRecord = await findEscalationForResolution(runtimeDb, escalationId);
  if (!resolvedRecord) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Escalation not found' }) };
  }
  const escalationRef = resolvedRecord.ref;
  const data = resolvedRecord.data;
  const athleteUserId = normalizeString(data.userId || data.athleteUserId || data.athleteId);
  if (normalizeString(userId) && athleteUserId && normalizeString(userId) !== athleteUserId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Escalation athlete does not match userId.' }) };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const clinicalReferenceId = normalizeString(data.clinicalReferenceId);
  let providerResolution = null;
  let providerConfirmed = false;

  if (clinicalReferenceId) {
    await escalationRef.set({
      clinicalResolutionStatus: HandoffStatus.Initiated,
      clinicalResolutionRequestedAt: nowSec,
      clinicalResolutionFailureReason: null,
    }, { merge: true });

    try {
      providerResolution = await bridgeFactory().resolveEscalation(clinicalReferenceId, {
        status: normalizeString(resolutionStatus) || 'resolved',
        coachNote: normalizeString(resolutionNote || coachNote) || undefined,
      });
    } catch (error) {
      providerResolution = {
        success: false,
        status: 'failed',
        error: {
          code: error?.code || 'CLINICAL_RESOLUTION_REQUEST_FAILED',
          message: error?.message || 'Clinical provider resolution request failed.',
        },
      };
    }

    if (providerResolution?.success !== true || providerResolution?.ok === false) {
      const failureMessage = typeof providerResolution?.error === 'string'
        ? providerResolution.error
        : providerResolution?.error?.message || 'Clinical provider did not confirm resolution.';
      await escalationRef.set({
        clinicalResolutionStatus: HandoffStatus.Failed,
        clinicalResolutionFailureReason: failureMessage,
        clinicalResolutionFailedAt: Math.floor(Date.now() / 1000),
        clinicalResolutionRequestId: providerResolution?.requestId || null,
        incidentLastActivityAt: Math.floor(Date.now() / 1000),
        incident: {
          ...((data.incident && typeof data.incident === 'object') ? data.incident : {}),
          id: data.incidentId || escalationId,
          status: data.incidentStatus || EscalationIncidentStatus.Open,
          lastActivityAt: Math.floor(Date.now() / 1000),
          lifecycleEvents: appendBounded(
            data?.incident?.lifecycleEvents,
            buildIncidentLifecycleEntry('resolution_failed', Math.floor(Date.now() / 1000), failureMessage)
          ),
        },
      }, { merge: true });

      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          success: false,
          resolved: false,
          crisisWallCleared: false,
          clearancePending: Boolean(athleteUserId),
          providerConfirmed: false,
          clinicalReferenceId,
          providerResolution,
          error: failureMessage,
        }),
      };
    }

    providerConfirmed = true;
    await escalationRef.set({
      clinicalResolutionStatus: HandoffStatus.Completed,
      clinicalResolutionCompletedAt: Math.floor(Date.now() / 1000),
      clinicalResolutionRequestId: providerResolution.requestId || null,
      clinicalResolutionProviderStatus: providerResolution.status || null,
    }, { merge: true });
  }

  await escalationRef.update({
    status: EscalationRecordStatus.Resolved,
    resolvedAt: nowSec,
    resolvedBy: resolvedBy || 'system',
    incidentStatus: EscalationIncidentStatus.Resolved,
    incidentClosedAt: nowSec,
    incidentLastActivityAt: nowSec,
  });

  await escalationRef.set({
    incident: {
      ...((data.incident && typeof data.incident === 'object') ? data.incident : {}),
      id: data.incidentId || escalationId,
      status: EscalationIncidentStatus.Resolved,
      lastActivityAt: nowSec,
      closedAt: nowSec,
      lifecycleEvents: appendBounded(
        data?.incident?.lifecycleEvents,
        buildIncidentLifecycleEntry('resolved', nowSec, normalizeString(resolvedBy) || 'system')
      ),
    },
  }, { merge: true });

  const queueEscalationId = normalizeString(clinicalEscalationId || data.escalationId);
  if (queueEscalationId) {
    const queueRef = runtimeDb.collection(CLINICAL_ESCALATIONS_COLLECTION).doc(queueEscalationId);
    const queueDoc = await queueRef.get();
    if (queueDoc.exists) {
      await queueRef.set({
        deliveryStatus: 'resolved',
        resolvedAt: admin?.firestore?.FieldValue?.serverTimestamp
          ? admin.firestore.FieldValue.serverTimestamp()
          : nowSec,
        resolvedByUserId: normalizeString(resolvedBy) || 'system',
        resolutionNote: normalizeString(resolutionNote) || null,
      }, { merge: true });
    }
  }

  if (normalizeString(data.conversationId)) {
    await runtimeDb.collection('conversations').doc(data.conversationId).set({
      escalationStatus: EscalationRecordStatus.Resolved,
    }, { merge: true });
  }

  await refreshPilotOutcomeRollupsForAthlete(athleteUserId, nowSec * 1000, runtimeDb);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      resolved: true,
      crisisWallCleared: false,
      clearancePending: Boolean(athleteUserId),
      clearanceRequiresAuthoritativeSignal: true,
      providerConfirmed,
      clinicalReferenceId: clinicalReferenceId || null,
      providerResolution,
    })
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function refreshPilotOutcomeRollupsForAthlete(userId, timestampMs, runtimeDb = db) {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  if (!normalizedUserId) return;

  try {
    const pilotContext = await resolvePilotEnrollmentContext({
      db: runtimeDb,
      athleteId: normalizedUserId,
      allowMembershipFallback: false,
    });

    if (!pilotContext?.pilotId) return;

    await recomputePilotMetricRollups({
      db: runtimeDb,
      pilotId: pilotContext.pilotId,
      explicitDateKeys: [new Date(Number(timestampMs || Date.now())).toISOString().slice(0, 10)],
    });

    const workflowContinuity = await evaluateCoachWorkflowContinuity({
      db: runtimeDb,
      pilotContext,
      sampleLimit: 8,
    });

    if (workflowContinuity?.pilotId) {
      await writePilotMetricOpsStatus({
        db: runtimeDb,
        pilotId: pilotContext.pilotId,
        scope: 'coach_workflow_continuity',
        status: workflowContinuity.manualReviewRequired ? 'warning' : 'healthy',
        details: {
          athleteId: normalizedUserId,
          coachWorkflowEligibleTotal: workflowContinuity.coachWorkflowEligibleTotal || 0,
          coachWorkflowVisibleTotal: workflowContinuity.coachWorkflowVisibleTotal || 0,
          coachWorkflowActionableTotal: workflowContinuity.coachWorkflowActionableTotal || 0,
          coachWorkflowVisibilityGapTotal: workflowContinuity.coachWorkflowVisibilityGapTotal || 0,
          visibilityRate: workflowContinuity.visibilityRate,
          actionableRate: workflowContinuity.actionableRate,
          manualReviewRequired: Boolean(workflowContinuity.manualReviewRequired),
          samples: workflowContinuity.samples || [],
        },
      });

      if (workflowContinuity.manualReviewRequired) {
        await recordPilotMetricAlert({
          db: runtimeDb,
          pilotId: pilotContext.pilotId,
          scope: 'coach_workflow_continuity',
          severity: 'warning',
          message: 'Coach-review workflow continuity needs manual review after disposition update.',
          context: {
            athleteId: normalizedUserId,
            coachWorkflowEligibleTotal: workflowContinuity.coachWorkflowEligibleTotal || 0,
            coachWorkflowVisibleTotal: workflowContinuity.coachWorkflowVisibleTotal || 0,
            coachWorkflowActionableTotal: workflowContinuity.coachWorkflowActionableTotal || 0,
            coachWorkflowVisibilityGapTotal: workflowContinuity.coachWorkflowVisibilityGapTotal || 0,
            samples: workflowContinuity.samples || [],
          },
        });
      }
    }
  } catch (error) {
    console.warn('[pulsecheck-escalation] Failed to refresh pilot outcome rollups (non-blocking):', error?.message || error);
    try {
      const pilotContext = await resolvePilotEnrollmentContext({
        db: runtimeDb,
        athleteId: normalizedUserId,
        allowMembershipFallback: false,
      });
      if (pilotContext?.pilotId) {
        await recordPilotMetricAlert({
          db: runtimeDb,
          pilotId: pilotContext.pilotId,
          scope: 'escalation_rollup_refresh',
          severity: 'warning',
          message: error?.message || 'Failed to refresh pilot outcome rollups after escalation update.',
          context: {
            athleteId: normalizedUserId,
          },
        });
      }
    } catch (nestedError) {
      console.error('[pulsecheck-escalation] Failed to record rollup refresh alert:', nestedError);
    }
  }
}

/**
 * Perform clinical handoff through the provider-neutral clinical bridge.
 */
async function performClinicalHandoff(
  userId,
  conversationId,
  escalationId,
  escalationData,
  runtimeDb = db,
  providedSupportContext = null,
  bridgeFactory = createClinicalBridge,
) {
  if (escalationData?.handoffStatus === HandoffStatus.Completed && escalationData?.clinicalReferenceId) {
    return {
      success: true,
      escalationId: escalationData.clinicalReferenceId,
      deduped: true,
      status: 'already_completed',
      supportRoute: 'clinician',
    };
  }
  if (escalationData?.handoffStatus === HandoffStatus.Initiated) {
    const initiatedAt = Number(escalationData?.handoffInitiatedAt || 0);
    const isFreshAttempt = initiatedAt > 0 && Math.floor(Date.now() / 1000) - initiatedAt < 120;
    if (!isFreshAttempt) {
      await runtimeDb.collection('escalation-records').doc(escalationId).set({
        handoffStatus: HandoffStatus.Pending,
        handoffRecoveryStartedAt: Math.floor(Date.now() / 1000),
      }, { merge: true });
    } else {
      return {
        success: false,
        deduped: true,
        status: 'already_initiated',
        escalationId: escalationData?.clinicalReferenceId || null,
        supportRoute: 'clinician',
        error: { code: 'CLINICAL_HANDOFF_IN_PROGRESS', message: 'Clinical handoff is already in progress.' },
      };
    }
  }

  // Load user profile
  const userDoc = await runtimeDb.collection('users').doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : {};

  // Build a minimum-necessary profile from real values only. Do not invent a
  // display name to satisfy a downstream schema; provider validation must stay
  // visible when the source profile is incomplete.
  const displayName = normalizeString(userData.displayName || userData.username);
  const email = normalizeString(userData.email);
  const username = normalizeString(userData.username);
  const sport = normalizeString(userData.primarySport);
  const shortUser = {
    userId,
    ...(displayName ? { displayName } : {}),
    ...(email ? { email } : {}),
    ...(username ? { username } : {}),
    ...(sport ? { sport } : {}),
    ...(userData.goals !== undefined && userData.goals !== null ? { goals: userData.goals } : {}),
    ...(userData.dateOfBirth !== undefined && userData.dateOfBirth !== null
      ? { dateOfBirth: userData.dateOfBirth }
      : {}),
    ...(userData.emergencyContact !== undefined && userData.emergencyContact !== null
      ? { emergencyContact: userData.emergencyContact }
      : {}),
  };

  const supportContext = providedSupportContext || await resolveEscalationSupportContext({
    athleteId: userId,
    preferredPilotId: escalationData?.pilotId || null,
    preferredTeamMembershipId: escalationData?.teamMembershipId || null,
    preferredTeamId: escalationData?.teamId || null,
  }, runtimeDb);
  const organizationId = normalizeString(
    escalationData?.organizationId || supportContext?.pilotContext?.organizationId
  );
  const teamId = normalizeString(
    escalationData?.teamId || supportContext?.teamId || supportContext?.pilotContext?.teamId
  );

  // Load conversation for summary
  const convoDoc = await runtimeDb.collection('conversations').doc(conversationId).get();
  const convoData = convoDoc.exists ? convoDoc.data() : {};
  
  // Generate summary if not already done
  let summary = escalationData.conversationSummary;
  if (!summary) {
    const summaryResult = await generateConversationSummaryInternal(convoData.messages || []);
    summary = summaryResult;
    
    // Save to escalation record
    await runtimeDb.collection('escalation-records').doc(escalationId).update({
      conversationSummary: summary
    });
  }

  // Load relevant mental notes
  const notesSnap = await runtimeDb
    .collection('user-mental-notes')
    .doc(userId)
    .collection('notes')
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  const mentalNotes = notesSnap.docs.map(d => ({
    id: d.id,
    title: d.data().title,
    content: d.data().content,
    category: d.data().category,
    severity: d.data().severity
  }));

  // Build handoff payload
  const consentTimestamp = Number(escalationData?.consentTimestamp || 0);
  const stateSnapshot = buildClinicalStateSnapshotEnvelope(escalationData);
  const consentState = {
    status: Number(escalationData?.tier) >= EscalationTier.CriticalRisk
      ? 'emergency_safety_basis'
      : escalationData?.consentStatus === ConsentStatus.Accepted
        ? 'opted_in'
        : 'pending',
    disclosureVersion: 'pulsecheck-clinical-handoff-v1',
    consentedAt: Number.isFinite(consentTimestamp) && consentTimestamp > 0
      ? new Date(consentTimestamp * 1000).toISOString()
      : null,
  };
  const payload = {
    pulseUserId: userId,
    pulseConversationId: conversationId,
    escalationRecordId: escalationId,
    athlete: shortUser,
    tier: escalationData.tier,
    category: escalationData.category,
    triggerContent: escalationData.triggerContent,
    classificationReason: escalationData.classificationReason,
    conversationSummary: summary,
    relevantMentalNotes: mentalNotes,
    escalationTimestamp: Date.now(),
    pulseApiCallback: buildPulseCallbackUrl(),
    payloadVersion: 'pulse-manas-v1-draft',
    organizationId: organizationId || null,
    teamId: teamId || null,
    routingContext: {
      organizationId: organizationId || null,
      teamId: teamId || null,
      pilotId: normalizeString(supportContext?.pilotContext?.pilotId) || null,
      pilotEnrollmentId: normalizeString(supportContext?.pilotContext?.pilotEnrollmentId) || null,
      teamMembershipId: normalizeString(supportContext?.pilotContext?.teamMembershipId) || null,
      environment: normalizeString(process.env.CONTEXT || process.env.NODE_ENV) || 'production',
    },
    consentState,
    ...(stateSnapshot ? { stateSnapshot } : {}),
  };

  // Update handoff status
  const initiatedAt = Math.floor(Date.now() / 1000);
  await runtimeDb.collection('escalation-records').doc(escalationId).update({
    supportRoute: 'clinician',
    handoffStatus: HandoffStatus.Initiated,
    handoffInitiatedAt: initiatedAt,
    clinicalPayloadVersion: payload.payloadVersion,
    organizationId: organizationId || null,
    teamId: teamId || null,
    clinicalConsentState: consentState,
    incidentStatus: EscalationIncidentStatus.Open,
    incidentLastActivityAt: initiatedAt,
  });
  await runtimeDb.collection('escalation-records').doc(escalationId).set({
    incident: {
      ...((escalationData.incident && typeof escalationData.incident === 'object') ? escalationData.incident : {}),
      id: escalationData.incidentId || escalationId,
      status: EscalationIncidentStatus.Open,
      lastActivityAt: initiatedAt,
      lifecycleEvents: appendBounded(
        escalationData?.incident?.lifecycleEvents,
        buildIncidentLifecycleEntry('opened', initiatedAt, 'care_handoff_initiated')
      ),
    },
  }, { merge: true });

  await emitPilotMetricEvent({
    db: runtimeDb,
    athleteId: userId,
    eventType: 'care_handoff_initiated',
    actorRole: 'system',
    actorUserId: userId,
    sourceCollection: 'escalation-records',
    sourceDocumentId: escalationId,
      metricPayload: {
        tier: escalationData.tier,
        category: escalationData.category,
        handoffStatus: HandoffStatus.Initiated,
        disposition: escalationData.disposition,
        classificationFamily: escalationData.classificationFamily,
        countsTowardCareKpi: escalationData.countsTowardCareKpi !== false,
      },
      createdAt: initiatedAt * 1000,
    });

  await refreshPilotOutcomeRollupsForAthlete(userId, initiatedAt * 1000, runtimeDb);

  // Send through the clinical bridge. AuntEdna is the current provider, but
  // PulseCheck should only depend on the bridge contract here.
  let result;
  let handoffPhase = 'athlete_upsert';
  try {
    const bridge = bridgeFactory();
    const athleteUpsert = await bridge.upsertAthlete({
      externalId: userId,
      ...(shortUser.displayName ? { displayName: shortUser.displayName } : {}),
      ...(shortUser.email ? { email: shortUser.email } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(teamId ? { teamId } : {}),
    });
    if (athleteUpsert?.success !== true || athleteUpsert?.ok === false) {
      const upsertError = new Error(
        athleteUpsert?.error?.message || 'Clinical provider did not confirm the athlete upsert.'
      );
      upsertError.code = athleteUpsert?.error?.code || 'CLINICAL_ATHLETE_UPSERT_NOT_CONFIRMED';
      throw upsertError;
    }

    await runtimeDb.collection('escalation-records').doc(escalationId).set({
      clinicalAthleteUpsertStatus: HandoffStatus.Completed,
      clinicalAthleteUpsertAt: Math.floor(Date.now() / 1000),
      clinicalAthleteUpsertRequestId: athleteUpsert.requestId || null,
    }, { merge: true });

    handoffPhase = 'escalation_create';
    result = await bridge.createEscalation(payload);
    console.log('[pulsecheck-escalation] Clinical bridge response:', {
      provider: clinicalBridgeConfig.provider,
      success: result.success,
      status: result.status,
      escalationId: result.escalationId || null,
      requestId: result.requestId || null,
    });
  } catch (err) {
    console.error('[pulsecheck-escalation] Clinical bridge request failed:', err);
    result = {
      success: false,
      status: 'failed',
      phase: handoffPhase,
      error: {
        code: err?.code || 'CLINICAL_BRIDGE_REQUEST_FAILED',
        message: err?.message || 'Clinical bridge request failed.',
      },
    };
  }

  // Update final status
  if (result?.success === true && result?.ok !== false && result?.escalationId) {
    const completedAt = Math.floor(Date.now() / 1000);
    await runtimeDb.collection('escalation-records').doc(escalationId).update({
      supportRoute: 'clinician',
      handoffStatus: HandoffStatus.Completed,
      clinicalReferenceId: result.escalationId,
      handoffAcceptedAt: completedAt,
      handoffCompletedAt: completedAt,
      incidentLastActivityAt: completedAt,
    });
    await runtimeDb.collection('escalation-records').doc(escalationId).set({
      incident: {
        ...((escalationData.incident && typeof escalationData.incident === 'object') ? escalationData.incident : {}),
        id: escalationData.incidentId || escalationId,
        status: EscalationIncidentStatus.Open,
        lastActivityAt: completedAt,
        lifecycleEvents: appendBounded(
          escalationData?.incident?.lifecycleEvents,
          buildIncidentLifecycleEntry('opened', completedAt, 'care_handoff_completed')
        ),
      },
    }, { merge: true });

    await emitPilotMetricEvent({
      db: runtimeDb,
      athleteId: userId,
      eventType: 'care_handoff_completed',
      actorRole: 'system',
      actorUserId: userId,
      sourceCollection: 'escalation-records',
      sourceDocumentId: escalationId,
      metricPayload: {
        tier: escalationData.tier,
        category: escalationData.category,
        clinicalReferenceId: result.escalationId || null,
        disposition: escalationData.disposition,
        classificationFamily: escalationData.classificationFamily,
        countsTowardCareKpi: escalationData.countsTowardCareKpi !== false,
      },
      createdAt: completedAt * 1000,
    });

    await refreshPilotOutcomeRollupsForAthlete(userId, completedAt * 1000, runtimeDb);
  } else {
    const failureMessage = typeof result?.error === 'string'
      ? result.error
      : result?.error?.message || 'Clinical provider did not confirm the handoff.';
    await runtimeDb.collection('escalation-records').doc(escalationId).update({
      handoffStatus: HandoffStatus.Failed,
      handoffFailureReason: failureMessage,
      handoffFailurePhase: result?.phase || handoffPhase,
      handoffFailedAt: Math.floor(Date.now() / 1000),
    });
    result = {
      ...result,
      success: false,
      status: result?.status || 'failed',
      error: result?.error || { code: 'CLINICAL_HANDOFF_NOT_CONFIRMED', message: failureMessage },
    };
  }

  return {
    ...result,
    supportRoute: 'clinician',
  };
}

/**
 * Trigger critical handoff (Tier 3 - immediate)
 */
async function triggerCriticalHandoff(userId, conversationId, escalationId, escalationData, supportContext = null, runtimeDb = db) {
  console.log('[pulsecheck-escalation] Triggering critical handoff:', escalationId);

  // Attempt the coach alert immediately, but never let a notification-system
  // failure block the clinical or hotline handoff.
  const coachNotification = await notifyCoachForClinicalHandoff({ escalationId, userId }, runtimeDb);
  const resolvedSupportContext = supportContext || await resolveEscalationSupportContext({
    athleteId: userId,
    preferredPilotId: escalationData?.pilotId || null,
    preferredTeamMembershipId: escalationData?.teamMembershipId || null,
    preferredTeamId: escalationData?.teamId || null,
  }, runtimeDb);

  const result = resolvedSupportContext.route === 'hotline'
    ? await applyHotlineSupportRouting(userId, escalationId, escalationData, resolvedSupportContext, true, runtimeDb)
    : await performClinicalHandoff(
        userId,
        conversationId,
        escalationId,
        escalationData,
        runtimeDb,
        resolvedSupportContext,
      );
  
  console.log('[pulsecheck-escalation] Critical handoff complete:', result);
  return { ...result, coachNotification };
}

/**
 * Trigger elevated handoff (Tier 2 - after consent)
 */
async function triggerElevatedHandoff(userId, conversationId, escalationId, escalationData, supportContext = null, runtimeDb = db) {
  console.log('[pulsecheck-escalation] Triggering elevated handoff:', escalationId);

  // Notification delivery is important but must not prevent the consented
  // clinical handoff from reaching the provider.
  const coachNotification = await notifyCoachForClinicalHandoff({ escalationId, userId }, runtimeDb);
  const resolvedSupportContext = supportContext || await resolveEscalationSupportContext({
    athleteId: userId,
    preferredPilotId: escalationData?.pilotId || null,
    preferredTeamMembershipId: escalationData?.teamMembershipId || null,
    preferredTeamId: escalationData?.teamId || null,
  }, runtimeDb);

  const result = resolvedSupportContext.route === 'hotline'
    ? await applyHotlineSupportRouting(userId, escalationId, escalationData, resolvedSupportContext, false, runtimeDb)
    : await performClinicalHandoff(
        userId,
        conversationId,
        escalationId,
        escalationData,
        runtimeDb,
        resolvedSupportContext,
      );
  
  console.log('[pulsecheck-escalation] Elevated handoff complete:', result);
  return { ...result, coachNotification };
}

/**
 * Internal summary generation
 */
async function generateConversationSummaryInternal(messages) {
  if (!messages || messages.length === 0) {
    return 'No conversation history available.';
  }

  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) {
    return 'Summary unavailable.';
  }

  const transcript = messages.map(m => 
    `${m.isFromUser ? 'Athlete' : 'AI'}: ${m.content}`
  ).join('\n');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Create a brief clinical summary (under 150 words) focusing on concerns, emotional state, and safety indicators.' 
          },
          { role: 'user', content: `Summarize this conversation:\n\n${transcript}` }
        ],
        temperature: 0.3,
        max_tokens: 300
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || 'Summary unavailable.';
  } catch (err) {
    console.error('[pulsecheck-escalation] Summary generation error:', err);
    return 'Summary generation failed.';
  }
}

async function createEscalationFromTrustedRuntime(body, runtimeDb) {
  if (!runtimeDb || typeof runtimeDb.collection !== 'function') {
    throw new Error('A Firestore runtime is required for trusted escalation creation.');
  }
  const response = await handleCreateEscalation(body, runtimeDb);
  let payload = {};
  try {
    payload = JSON.parse(response?.body || '{}');
  } catch (_error) {
    payload = {};
  }
  if (!response || response.statusCode < 200 || response.statusCode >= 300) {
    const error = new Error(payload.error || 'Escalation creation failed.');
    error.statusCode = response?.statusCode || 500;
    error.payload = payload;
    throw error;
  }
  return payload;
}

exports.runtimeHelpers = {
  authorizeEscalationAction,
  createEscalationFromTrustedRuntime,
  executeCriticalSafetyOperations,
  handleCareState,
  handleConsent,
  handleResolve,
  normalizeCareStateMirror,
  notifyCoachForClinicalHandoff,
  performClinicalHandoff,
};
