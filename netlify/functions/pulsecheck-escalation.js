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
  emitPilotMetricEvent,
  evaluateCoachWorkflowContinuity,
  recordPilotMetricAlert,
  recomputePilotMetricRollups,
  resolvePilotEnrollmentContext,
  writePilotMetricOpsStatus,
  isTrueCareEscalationClassification,
} = require('./utils/pulsecheck-pilot-metrics');

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

// AuntEDNA placeholder URLs (replace with real endpoints)
const AUNTEDNA_BASE_URL = process.env.AUNTEDNA_API_URL || 'https://api.auntedna.com/v1';
const AUNTEDNA_API_KEY = process.env.AUNTEDNA_API_KEY || '';
const USE_MOCK = process.env.AUNTEDNA_MOCK === 'true' || !AUNTEDNA_API_KEY;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCategoryValue(value) {
  return normalizeString(value) || 'general';
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

async function findMergeableEscalationRecord({ userId, conversationId, model }) {
  if (!userId || !conversationId || (Number(model?.tier) || 0) <= EscalationTier.None) {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const snapshot = await db.collection('escalation-records')
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
        return await handleResolve(body);
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
async function handleCreateEscalation(body) {
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

  const nowSec = Math.floor(Date.now() / 1000);
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
    await db.collection('escalation-records').doc(existingRecord.id).set(escalationData, { merge: true });
  } else {
    escalationData = buildEscalationRecordPayload({
      userId,
      conversationId,
      triggerMessageId,
      triggerContent,
      model,
      nowSec,
    });
    const docRef = await db.collection('escalation-records').add(escalationData);
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
      db,
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

  await refreshPilotOutcomeRollupsForAthlete(userId, nowSec * 1000);

  // Update conversation with escalation state
  const activeTier = isTrueCareEscalationClassification({
    tier: escalationData.tier,
    classificationFamily: escalationData.classificationFamily,
    requiresClinicalHandoff: escalationData.requiresClinicalHandoff,
  }) ? escalationData.tier : EscalationTier.None;
  await db.collection('conversations').doc(conversationId).set({
    escalationTier: activeTier,
    escalationStatus: EscalationRecordStatus.Active,
    escalationRecordId: escalationId,
    isInSafetyMode: activeTier === EscalationTier.CriticalRisk,
    lastEscalationAt: nowSec
  }, { merge: true });

  // For Tier 3 (Critical), immediately initiate handoff
  if (activeTier === EscalationTier.CriticalRisk) {
    // Trigger async handoff (don't wait)
    triggerCriticalHandoff(userId, conversationId, escalationId, escalationData).catch(err => {
      console.error('[pulsecheck-escalation] Critical handoff error:', err);
    });
  }

  console.log('[pulsecheck-escalation] Created escalation:', {
    id: escalationId,
    userId: userId.slice(0, 8) + '...',
    tier,
    category
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      escalationId,
      tier: escalationData.tier,
      deduped,
      requiresConsent: activeTier === EscalationTier.ElevatedRisk,
      isCritical: activeTier === EscalationTier.CriticalRisk
    })
  };
}

/**
 * Handle consent decision (Tier 2 only)
 */
async function handleConsent(body) {
  const { escalationId, userId, consent } = body;

  if (!escalationId || !userId || consent === undefined) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const docRef = db.collection('escalation-records').doc(escalationId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Escalation not found' }) };
  }

  const data = doc.data();

  // Verify ownership
  if (data.userId !== userId) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  if (consent) {
    // User accepted - initiate clinical handoff
    await docRef.update({
      consentStatus: ConsentStatus.Accepted,
      consentTimestamp: nowSec,
      incidentStatus: EscalationIncidentStatus.Open,
      incidentLastActivityAt: nowSec,
      incident: {
        ...((data.incident && typeof data.incident === 'object') ? data.incident : {}),
        id: data.incidentId || escalationId,
        status: EscalationIncidentStatus.Open,
        lastActivityAt: nowSec,
        lifecycleEvents: appendBounded(
          data?.incident?.lifecycleEvents,
          buildIncidentLifecycleEntry('opened', nowSec, 'consent_accepted')
        ),
      },
    });

    // Trigger handoff
    triggerElevatedHandoff(userId, data.conversationId, escalationId, data).catch(err => {
      console.error('[pulsecheck-escalation] Elevated handoff error:', err);
    });

    await refreshPilotOutcomeRollupsForAthlete(userId, nowSec * 1000);

    console.log('[pulsecheck-escalation] Consent accepted:', escalationId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: 'consent_accepted',
        message: 'Thank you. A mental health professional will reach out soon.'
      })
    };
  } else {
    // User declined
    await docRef.update({
      consentStatus: ConsentStatus.Declined,
      consentTimestamp: nowSec,
      status: EscalationRecordStatus.Declined,
      incidentStatus: EscalationIncidentStatus.Declined,
      incidentClosedAt: nowSec,
      incidentLastActivityAt: nowSec,
      incident: {
        ...((data.incident && typeof data.incident === 'object') ? data.incident : {}),
        id: data.incidentId || escalationId,
        status: EscalationIncidentStatus.Declined,
        lastActivityAt: nowSec,
        closedAt: nowSec,
        lifecycleEvents: appendBounded(
          data?.incident?.lifecycleEvents,
          buildIncidentLifecycleEntry('declined', nowSec, 'consent_declined')
        ),
      },
    });

    // Update conversation state
    await db.collection('conversations').doc(data.conversationId).set({
      escalationStatus: EscalationRecordStatus.Declined
    }, { merge: true });

    await refreshPilotOutcomeRollupsForAthlete(userId, nowSec * 1000);

    console.log('[pulsecheck-escalation] Consent declined:', escalationId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: 'consent_declined',
        message: 'Understood. I\'m still here if you want to talk. Remember, you can always reach out to a professional if things change.'
      })
    };
  }
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

  // Build handoff payload
  const handoffResult = await performClinicalHandoff(
    userId,
    conversationId,
    escalationId,
    escalationData
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

/**
 * Notify coach of escalation (Tier 1 and above)
 */
async function notifyCoach(body) {
  const { sendCoachEscalationEmail } = require('./utils/sendCoachEscalationEmail');
  const { escalationId, userId, coachId } = body;

  if (!escalationId || !userId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Find coach if not provided
  let targetCoachId = coachId;
  if (!targetCoachId) {
    // Look up athlete's connected coach
    const connectionSnap = await db
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
    const escalationSnap = await db.collection('escalation-records').doc(escalationId).get();
    if (escalationSnap.exists) {
      const data = escalationSnap.data() || {};
      if (typeof data.tier === 'number') tier = data.tier;
    }
  } catch (e) {
    console.warn('[pulsecheck-escalation] Failed to load escalation tier (non-blocking):', e?.message || e);
  }

  const escalationSnapForUpdate = await db.collection('escalation-records').doc(escalationId).get();
  const escalationForUpdate = escalationSnapForUpdate.exists ? (escalationSnapForUpdate.data() || {}) : {};

  // Update escalation record
  await db.collection('escalation-records').doc(escalationId).update({
    coachNotified: true,
    coachId: targetCoachId,
    coachNotifiedAt: nowSec,
    incidentLastActivityAt: nowSec,
  });
  await db.collection('escalation-records').doc(escalationId).set({
    incident: {
      ...((escalationForUpdate.incident && typeof escalationForUpdate.incident === 'object') ? escalationForUpdate.incident : {}),
      id: escalationForUpdate.incidentId || escalationId,
      status: escalationForUpdate.incidentStatus || EscalationIncidentStatus.Open,
      lastActivityAt: nowSec,
    },
  }, { merge: true });

  await emitPilotMetricEvent({
    db,
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

  await refreshPilotOutcomeRollupsForAthlete(userId, nowSec * 1000);

  // Create notification for coach
  // Note: This would integrate with your push notification system
  // For now, we create a notification document
  await db.collection('notifications').add({
    userId: targetCoachId,
    type: 'escalation-alert',
    title: tier === EscalationTier.MonitorOnly ? 'Athlete Check-In (Monitor)' : 'Athlete Check-In Alert',
    message:
      tier === EscalationTier.MonitorOnly
        ? 'An athlete you coach was flagged for monitor-only concern. Please review when you can.'
        : tier === EscalationTier.ElevatedRisk || tier === EscalationTier.CriticalRisk
          ? 'An athlete you coach had an escalation event and was handed off to a clinical professional. Please check your dashboard.'
          : 'An athlete you coach has been flagged for elevated concern. Please check your dashboard.',
    escalationId,
    athleteId: userId,
    read: false,
    createdAt: nowSec
  });

  // Email coach (non-blocking). Do NOT include conversation details.
  try {
    const coachSnap = await db.collection('users').doc(targetCoachId).get();
    const coach = coachSnap.exists ? (coachSnap.data() || {}) : {};
    const coachEmail = typeof coach.email === 'string' ? coach.email.trim() : '';
    const coachName = (coach.displayName || coach.username || '').trim();

    const athleteSnap = await db.collection('users').doc(userId).get();
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
        await db.collection('notification-logs').add({
          fcmToken: coachEmail ? `email:${coachEmail.substring(0, 20)}...` : 'EMAIL',
          title: `Coach escalation email (Tier ${tier})`,
          body:
            tier === EscalationTier.MonitorOnly
              ? 'Tier 1 coach-review escalation email sent (privacy-safe).'
              : `Tier ${tier} clinical-handoff escalation email sent (privacy-safe).`,
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
        await db.collection('notification-logs').add({
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
      await db.collection('notification-logs').add({
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

/**
 * Resolve an escalation
 */
async function handleResolve(body) {
  const { escalationId, userId, resolvedBy } = body;

  if (!escalationId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing escalationId' }) };
  }

  const nowSec = Math.floor(Date.now() / 1000);

  await db.collection('escalation-records').doc(escalationId).update({
    status: EscalationRecordStatus.Resolved,
    resolvedAt: nowSec,
    resolvedBy: resolvedBy || 'system',
    incidentStatus: EscalationIncidentStatus.Resolved,
    incidentClosedAt: nowSec,
    incidentLastActivityAt: nowSec,
  });

  // Update conversation state
  const escalationDoc = await db.collection('escalation-records').doc(escalationId).get();
  if (escalationDoc.exists) {
    const data = escalationDoc.data();
    await db.collection('escalation-records').doc(escalationId).set({
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
    await db.collection('conversations').doc(data.conversationId).set({
      escalationStatus: EscalationRecordStatus.Resolved,
      isInSafetyMode: false
    }, { merge: true });
  }

  await refreshPilotOutcomeRollupsForAthlete(userId || escalationDoc.data()?.userId, nowSec * 1000);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      resolved: true
    })
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function refreshPilotOutcomeRollupsForAthlete(userId, timestampMs) {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  if (!normalizedUserId) return;

  try {
    const pilotContext = await resolvePilotEnrollmentContext({
      db,
      athleteId: normalizedUserId,
      allowMembershipFallback: false,
    });

    if (!pilotContext?.pilotId) return;

    await recomputePilotMetricRollups({
      db,
      pilotId: pilotContext.pilotId,
      explicitDateKeys: [new Date(Number(timestampMs || Date.now())).toISOString().slice(0, 10)],
    });

    const workflowContinuity = await evaluateCoachWorkflowContinuity({
      db,
      pilotContext,
      sampleLimit: 8,
    });

    if (workflowContinuity?.pilotId) {
      await writePilotMetricOpsStatus({
        db,
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
          db,
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
        db,
        athleteId: normalizedUserId,
        allowMembershipFallback: false,
      });
      if (pilotContext?.pilotId) {
        await recordPilotMetricAlert({
          db,
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
 * Perform clinical handoff to AuntEDNA
 */
async function performClinicalHandoff(userId, conversationId, escalationId, escalationData) {
  if (escalationData?.handoffStatus === HandoffStatus.Completed && escalationData?.clinicalReferenceId) {
    return {
      success: true,
      escalationId: escalationData.clinicalReferenceId,
      deduped: true,
      status: 'already_completed',
    };
  }
  if (escalationData?.handoffStatus === HandoffStatus.Initiated) {
    return {
      success: true,
      deduped: true,
      status: 'already_initiated',
      escalationId: escalationData?.clinicalReferenceId || null,
    };
  }

  // Load user profile
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : {};

  // Build short user object
  const shortUser = {
    userId,
    displayName: userData.displayName || userData.username || 'Unknown',
    email: userData.email,
    username: userData.username,
    sport: userData.primarySport,
    goals: userData.goals,
    dateOfBirth: userData.dateOfBirth,
    emergencyContact: userData.emergencyContact
  };

  // Load conversation for summary
  const convoDoc = await db.collection('conversations').doc(conversationId).get();
  const convoData = convoDoc.exists ? convoDoc.data() : {};
  
  // Generate summary if not already done
  let summary = escalationData.conversationSummary;
  if (!summary) {
    const summaryResult = await generateConversationSummaryInternal(convoData.messages || []);
    summary = summaryResult;
    
    // Save to escalation record
    await db.collection('escalation-records').doc(escalationId).update({
      conversationSummary: summary
    });
  }

  // Load relevant mental notes
  const notesSnap = await db
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
    pulseApiCallback: `${process.env.URL || 'https://pulsefitness.app'}/.netlify/functions/auntedna-callback`
  };

  // Update handoff status
  const initiatedAt = Math.floor(Date.now() / 1000);
  await db.collection('escalation-records').doc(escalationId).update({
    handoffStatus: HandoffStatus.Initiated,
    handoffInitiatedAt: initiatedAt,
    incidentStatus: EscalationIncidentStatus.Open,
    incidentLastActivityAt: initiatedAt,
  });
  await db.collection('escalation-records').doc(escalationId).set({
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
    db,
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

  await refreshPilotOutcomeRollupsForAthlete(userId, initiatedAt * 1000);

  // Send to AuntEDNA
  let result;
  if (USE_MOCK) {
    // Mock response
    result = {
      success: true,
      escalationId: `ae-${escalationId.slice(0, 8)}`,
      status: escalationData.tier === EscalationTier.CriticalRisk ? 'assigned' : 'received',
      estimatedContactTime: escalationData.tier === EscalationTier.CriticalRisk ? 'Within 15 minutes' : 'Within 24 hours'
    };
    console.log('[pulsecheck-escalation] Mock AuntEDNA response:', result);
  } else {
    try {
      const response = await fetch(`${AUNTEDNA_BASE_URL}/escalations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUNTEDNA_API_KEY}`
        },
        body: JSON.stringify(payload)
      });
      result = await response.json();
    } catch (err) {
      console.error('[pulsecheck-escalation] AuntEDNA request failed:', err);
      result = { success: false, error: err.message };
    }
  }

  // Update final status
  if (result.success) {
    const completedAt = Math.floor(Date.now() / 1000);
    await db.collection('escalation-records').doc(escalationId).update({
      handoffStatus: HandoffStatus.Completed,
      clinicalReferenceId: result.escalationId,
      handoffAcceptedAt: completedAt,
      handoffCompletedAt: completedAt,
      incidentLastActivityAt: completedAt,
    });
    await db.collection('escalation-records').doc(escalationId).set({
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
      db,
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

    await refreshPilotOutcomeRollupsForAthlete(userId, completedAt * 1000);
  } else {
    await db.collection('escalation-records').doc(escalationId).update({
      handoffStatus: HandoffStatus.Failed
    });
  }

  return result;
}

/**
 * Trigger critical handoff (Tier 3 - immediate)
 */
async function triggerCriticalHandoff(userId, conversationId, escalationId, escalationData) {
  console.log('[pulsecheck-escalation] Triggering critical handoff:', escalationId);
  
  // Notify coach immediately
  await notifyCoach({ escalationId, userId });
  
  // Perform clinical handoff
  const result = await performClinicalHandoff(userId, conversationId, escalationId, escalationData);
  
  console.log('[pulsecheck-escalation] Critical handoff complete:', result);
  return result;
}

/**
 * Trigger elevated handoff (Tier 2 - after consent)
 */
async function triggerElevatedHandoff(userId, conversationId, escalationId, escalationData) {
  console.log('[pulsecheck-escalation] Triggering elevated handoff:', escalationId);
  
  // Notify coach
  await notifyCoach({ escalationId, userId });
  
  // Perform clinical handoff
  const result = await performClinicalHandoff(userId, conversationId, escalationId, escalationData);
  
  console.log('[pulsecheck-escalation] Elevated handoff complete:', result);
  return result;
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
