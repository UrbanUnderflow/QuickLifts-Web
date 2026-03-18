const { initializeFirebaseAdmin, admin, headers } = require('./config/firebase');
const profileSnapshotRuntime = require('../../src/api/firebase/mentaltraining/profileSnapshotRuntime.js');
const protocolRegistryRuntime = require('../../src/api/firebase/mentaltraining/protocolRegistryRuntime.js');

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CHECKINS_ROOT = 'mental-check-ins';
const PROGRESS_COLLECTION = 'athlete-mental-progress';
const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';
const ASSIGNMENT_REVISIONS_SUBCOLLECTION = 'revisions';
const SNAPSHOTS_COLLECTION = 'state-snapshots';
const ASSIGNMENT_CANDIDATE_SETS_COLLECTION = 'pulsecheck-assignment-candidate-sets';
const PROTOCOLS_COLLECTION = 'pulsecheck-protocols';
const PROTOCOL_RESPONSIVENESS_COLLECTION = 'pulsecheck-protocol-responsiveness-profiles';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const DAY_MS = 24 * 60 * 60 * 1000;
const CURRENT_RESPONSIVENESS_WINDOW_DAYS = 21;
const DEGRADED_RESPONSIVENESS_WINDOW_DAYS = 45;

const VALID_ROUTING = new Set([
  'protocol_only',
  'sim_only',
  'trial_only',
  'protocol_then_sim',
  'sim_then_protocol',
  'defer_alternate_path',
]);

const VALID_PROTOCOL_CLASSES = new Set(['regulation', 'priming', 'recovery', 'none']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);
const VALID_CANDIDATE_TYPES = new Set(['sim', 'protocol', 'trial']);
const VALID_PRIMARY_FACTORS = new Set([
  'activation',
  'focus_readiness',
  'emotional_load',
  'cognitive_fatigue',
  'mixed',
]);

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isValidSourceDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function humanizeRuntimeLabel(value) {
  return value ? String(value).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)).filter((entry) => entry !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, entry]) => {
      const cleaned = stripUndefinedDeep(entry);
      if (cleaned !== undefined) {
        accumulator[key] = cleaned;
      }
      return accumulator;
    }, {});
  }

  return value === undefined ? undefined : value;
}

function buildCandidateSetId(athleteId, sourceDate) {
  return `${athleteId}_${sourceDate}_candidates`;
}

function normalizeProtocolRegistryRecord(record, now = Date.now()) {
  return protocolRegistryRuntime.normalizeProtocolRecord(record, now);
}

async function listLiveProtocolRegistry(db) {
  const collectionRef = db.collection(PROTOCOLS_COLLECTION);
  const snap = await collectionRef.get();

  if (snap.empty) {
    const seededRecords = protocolRegistryRuntime.listPulseCheckProtocolSeedRecords(Date.now());
    const batch = db.batch();
    seededRecords.forEach((record) => {
      batch.set(collectionRef.doc(record.id), record, { merge: true });
    });
    await batch.commit();
    return seededRecords.filter((record) => record.isActive && record.publishStatus === 'published');
  }

  return snap.docs
    .map((entry) => normalizeProtocolRegistryRecord({ id: entry.id, ...entry.data() }))
    .filter((record) => record.isActive && record.publishStatus === 'published')
    .sort((left, right) => {
      if ((left.sortOrder || 999) !== (right.sortOrder || 999)) {
        return (left.sortOrder || 999) - (right.sortOrder || 999);
      }
      return String(left.label || '').localeCompare(String(right.label || ''));
    });
}

function deriveResponsivenessDirection(positiveSignals, negativeSignals) {
  if (negativeSignals > positiveSignals && negativeSignals > 0) return 'negative';
  if (positiveSignals > negativeSignals && positiveSignals > 0) return 'positive';
  if (positiveSignals > 0 && negativeSignals > 0) return 'mixed';
  return 'neutral';
}

function deriveResponsivenessConfidence(sampleSize, positiveSignals, negativeSignals) {
  const decisiveSignals = positiveSignals + negativeSignals;
  const dominantSignals = Math.max(positiveSignals, negativeSignals);
  const dominance = decisiveSignals > 0 ? dominantSignals / decisiveSignals : 0;

  if (sampleSize >= 6 && decisiveSignals >= 4 && dominance >= 0.66) return 'high';
  if (sampleSize >= 3 && decisiveSignals >= 2) return 'medium';
  return 'low';
}

function deriveResponsivenessFreshness(lastObservedAt) {
  if (!lastObservedAt) return 'refresh_required';
  const ageDays = (Date.now() - lastObservedAt) / DAY_MS;
  if (ageDays <= CURRENT_RESPONSIVENESS_WINDOW_DAYS) return 'current';
  if (ageDays <= DEGRADED_RESPONSIVENESS_WINDOW_DAYS) return 'degraded';
  return 'refresh_required';
}

function buildResponsivenessStaleAt(lastObservedAt) {
  const anchor = lastObservedAt || Date.now();
  return anchor + DEGRADED_RESPONSIVENESS_WINDOW_DAYS * DAY_MS;
}

function buildResponsivenessSummary(bucket) {
  return {
    protocolFamilyId: bucket.protocolFamilyId,
    protocolFamilyLabel: bucket.protocolFamilyLabel,
    variantId: bucket.variantId,
    variantLabel: bucket.variantLabel,
    protocolClass: bucket.protocolClass,
    responseFamily: bucket.responseFamily,
    responseDirection: deriveResponsivenessDirection(bucket.positiveSignals, bucket.negativeSignals),
    confidence: deriveResponsivenessConfidence(bucket.sampleSize, bucket.positiveSignals, bucket.negativeSignals),
    freshness: deriveResponsivenessFreshness(bucket.lastConfirmedAt || bucket.lastObservedAt),
    sampleSize: bucket.sampleSize,
    positiveSignals: bucket.positiveSignals,
    neutralSignals: bucket.neutralSignals,
    negativeSignals: bucket.negativeSignals,
    stateFit: Array.from(bucket.stateFit || []).slice(0, 8),
    supportingEvidence: (bucket.supportingEvidence || []).slice(0, 6),
    lastObservedAt: bucket.lastObservedAt || undefined,
    lastConfirmedAt: bucket.lastConfirmedAt || undefined,
  };
}

function classifyResponsivenessWindow({ assignment, runtime, events, snapshot, downstreamAssignments }) {
  const supportingEvidence = [];
  const sourceEventIds = events.map((entry) => entry.id);
  const latestMeaningfulEvent = events.find((entry) =>
    entry.eventType === 'completed' || entry.eventType === 'deferred' || entry.eventType === 'overridden'
  );

  let score = 0;
  let lastObservedAt = latestMeaningfulEvent?.eventAt || assignment.updatedAt || assignment.createdAt || Date.now();
  let lastConfirmedAt;

  if (latestMeaningfulEvent?.eventType === 'completed' || assignment.status === 'completed') {
    score += 1;
    lastConfirmedAt = Math.max(lastConfirmedAt || 0, latestMeaningfulEvent?.eventAt || assignment.completedAt || assignment.updatedAt || assignment.createdAt);
    supportingEvidence.push('Protocol assignment completed successfully.');
  } else if (
    latestMeaningfulEvent?.eventType === 'deferred'
    || latestMeaningfulEvent?.eventType === 'overridden'
    || assignment.status === 'deferred'
    || assignment.status === 'overridden'
  ) {
    score -= 1;
    lastConfirmedAt = Math.max(lastConfirmedAt || 0, latestMeaningfulEvent?.eventAt || assignment.updatedAt || assignment.createdAt);
    supportingEvidence.push('Protocol was deferred or replaced before a clean completion.');
  } else if (assignment.status === 'started' || assignment.status === 'viewed') {
    supportingEvidence.push('Protocol was engaged but the outcome is still incomplete.');
  } else {
    supportingEvidence.push('Protocol was assigned without enough outcome signal yet.');
  }

  if (snapshot && typeof assignment.readinessScore === 'number' && typeof snapshot.readinessScore === 'number') {
    const readinessDelta = snapshot.readinessScore - assignment.readinessScore;
    lastObservedAt = Math.max(lastObservedAt, snapshot.updatedAt || 0);

    if (readinessDelta >= 5) {
      score += 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, snapshot.updatedAt || 0);
      supportingEvidence.push(`Same-day readiness improved from ${assignment.readinessScore} to ${snapshot.readinessScore}.`);
    } else if (readinessDelta <= -5) {
      score -= 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, snapshot.updatedAt || 0);
      supportingEvidence.push(`Same-day readiness dropped from ${assignment.readinessScore} to ${snapshot.readinessScore}.`);
    } else {
      supportingEvidence.push('Same-day readiness stayed near baseline after the protocol.');
    }
  }

  const downstreamSim = downstreamAssignments
    .slice()
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))[0];

  if (downstreamSim) {
    lastObservedAt = Math.max(lastObservedAt, downstreamSim.updatedAt || downstreamSim.createdAt || 0);
    if (downstreamSim.status === 'completed') {
      score += 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, downstreamSim.completedAt || downstreamSim.updatedAt || 0);
      supportingEvidence.push(`Downstream ${downstreamSim.actionType === 'lighter_sim' ? 'lighter sim' : 'sim'} completed on the same day.`);
    } else if (downstreamSim.status === 'deferred' || downstreamSim.status === 'overridden') {
      score -= 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, downstreamSim.updatedAt || 0);
      supportingEvidence.push(`Downstream ${downstreamSim.actionType === 'lighter_sim' ? 'lighter sim' : 'sim'} was deferred or overridden.`);
    } else {
      supportingEvidence.push('Downstream execution exists but is still inconclusive.');
    }
  }

  return {
    responseDirection: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
    stateFit: uniqueStrings([
      assignment.readinessBand ? `${assignment.readinessBand}_readiness` : '',
      snapshot?.overallReadiness ? `${snapshot.overallReadiness}_snapshot` : '',
      snapshot?.recommendedRouting || '',
      snapshot?.recommendedProtocolClass && snapshot.recommendedProtocolClass !== 'none'
        ? snapshot.recommendedProtocolClass
        : '',
      ...(snapshot?.contextTags || []),
      ...(runtime.preferredContextTags || []),
    ]),
    supportingEvidence: uniqueStrings(supportingEvidence).slice(0, 6),
    sourceEventIds,
    lastObservedAt,
    lastConfirmedAt,
  };
}

async function getOrRefreshProtocolResponsivenessProfile({ db, athleteId, protocolRegistry }) {
  const profileRef = db.collection(PROTOCOL_RESPONSIVENESS_COLLECTION).doc(athleteId);
  const existingSnap = await profileRef.get();
  const existing = existingSnap.exists ? { id: existingSnap.id, ...existingSnap.data() } : null;
  if (existing && typeof existing.staleAt === 'number' && existing.staleAt > Date.now()) {
    return existing;
  }

  const [assignmentsSnap, eventsSnap, snapshotsSnap] = await Promise.all([
    db.collection(DAILY_ASSIGNMENTS_COLLECTION).where('athleteId', '==', athleteId).get(),
    db.collection(ASSIGNMENT_EVENTS_COLLECTION).where('athleteId', '==', athleteId).get(),
    db.collection(SNAPSHOTS_COLLECTION).where('athleteId', '==', athleteId).get(),
  ]);

  const assignments = assignmentsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const eventsByAssignmentId = new Map();
  eventsSnap.docs.forEach((docSnap) => {
    const event = { id: docSnap.id, ...docSnap.data() };
    const existingEvents = eventsByAssignmentId.get(event.assignmentId) || [];
    existingEvents.push(event);
    existingEvents.sort((left, right) => (right.eventAt || 0) - (left.eventAt || 0));
    eventsByAssignmentId.set(event.assignmentId, existingEvents);
  });
  const snapshotsById = new Map();
  const snapshotsByDate = new Map();
  snapshotsSnap.docs.forEach((docSnap) => {
    const snapshot = { id: docSnap.id, ...docSnap.data() };
    snapshotsById.set(snapshot.id, snapshot);
    snapshotsByDate.set(snapshot.sourceDate, snapshot);
  });

  const runtimeById = new Map((Array.isArray(protocolRegistry) ? protocolRegistry : []).map((runtime) => [runtime.id, runtime]));
  const familyBuckets = new Map();
  const variantBuckets = new Map();
  const sourceEventIds = new Set();
  let latestObservedAt = 0;

  assignments
    .filter((assignment) => assignment.actionType === 'protocol' && assignment.protocolId && runtimeById.has(assignment.protocolId))
    .forEach((assignment) => {
      const runtime = runtimeById.get(assignment.protocolId);
      if (!runtime) return;

      const snapshot = assignment.sourceStateSnapshotId
        ? (snapshotsById.get(assignment.sourceStateSnapshotId) || snapshotsByDate.get(assignment.sourceDate) || null)
        : (snapshotsByDate.get(assignment.sourceDate) || null);
      const downstreamAssignments = assignments.filter((candidate) =>
        candidate.athleteId === assignment.athleteId
        && candidate.sourceDate === assignment.sourceDate
        && candidate.id !== assignment.id
        && (candidate.actionType === 'sim' || candidate.actionType === 'lighter_sim')
      );
      const window = classifyResponsivenessWindow({
        assignment,
        runtime,
        events: eventsByAssignmentId.get(assignment.id) || [],
        snapshot,
        downstreamAssignments,
      });

      latestObservedAt = Math.max(latestObservedAt, window.lastObservedAt || 0);
      window.sourceEventIds.forEach((eventId) => sourceEventIds.add(eventId));

      const familyBucket = familyBuckets.get(runtime.familyId) || {
        protocolFamilyId: runtime.familyId,
        protocolFamilyLabel: runtime.familyLabel,
        protocolClass: runtime.protocolClass,
        responseFamily: runtime.responseFamily,
        sampleSize: 0,
        positiveSignals: 0,
        neutralSignals: 0,
        negativeSignals: 0,
        stateFit: new Set(),
        supportingEvidence: [],
        lastObservedAt: 0,
        lastConfirmedAt: undefined,
      };
      familyBucket.sampleSize += 1;
      if (window.responseDirection === 'positive') familyBucket.positiveSignals += 1;
      else if (window.responseDirection === 'negative') familyBucket.negativeSignals += 1;
      else familyBucket.neutralSignals += 1;
      window.stateFit.forEach((tag) => familyBucket.stateFit.add(tag));
      familyBucket.supportingEvidence = uniqueStrings([...familyBucket.supportingEvidence, ...window.supportingEvidence]).slice(0, 6);
      familyBucket.lastObservedAt = Math.max(familyBucket.lastObservedAt, window.lastObservedAt || 0);
      if (window.lastConfirmedAt) familyBucket.lastConfirmedAt = Math.max(familyBucket.lastConfirmedAt || 0, window.lastConfirmedAt);
      familyBuckets.set(runtime.familyId, familyBucket);

      const variantBucket = variantBuckets.get(runtime.variantId) || {
        protocolFamilyId: runtime.familyId,
        protocolFamilyLabel: runtime.familyLabel,
        variantId: runtime.variantId,
        variantLabel: runtime.variantLabel,
        protocolClass: runtime.protocolClass,
        responseFamily: runtime.responseFamily,
        sampleSize: 0,
        positiveSignals: 0,
        neutralSignals: 0,
        negativeSignals: 0,
        stateFit: new Set(),
        supportingEvidence: [],
        lastObservedAt: 0,
        lastConfirmedAt: undefined,
      };
      variantBucket.sampleSize += 1;
      if (window.responseDirection === 'positive') variantBucket.positiveSignals += 1;
      else if (window.responseDirection === 'negative') variantBucket.negativeSignals += 1;
      else variantBucket.neutralSignals += 1;
      window.stateFit.forEach((tag) => variantBucket.stateFit.add(tag));
      variantBucket.supportingEvidence = uniqueStrings([...variantBucket.supportingEvidence, ...window.supportingEvidence]).slice(0, 6);
      variantBucket.lastObservedAt = Math.max(variantBucket.lastObservedAt, window.lastObservedAt || 0);
      if (window.lastConfirmedAt) variantBucket.lastConfirmedAt = Math.max(variantBucket.lastConfirmedAt || 0, window.lastConfirmedAt);
      variantBuckets.set(runtime.variantId, variantBucket);
    });

  const profile = {
    id: athleteId,
    athleteId,
    familyResponses: Object.fromEntries(Array.from(familyBuckets.entries()).map(([familyId, bucket]) => [familyId, buildResponsivenessSummary(bucket)])),
    variantResponses: Object.fromEntries(Array.from(variantBuckets.entries()).map(([variantId, bucket]) => [variantId, buildResponsivenessSummary(bucket)])),
    sourceEventIds: Array.from(sourceEventIds).slice(0, 100),
    staleAt: buildResponsivenessStaleAt(latestObservedAt || existing?.updatedAt),
    lastUpdatedAt: Date.now(),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  await profileRef.set(stripUndefinedDeep(profile), { merge: true });
  return profile;
}

function buildProtocolResponsivenessScore({ snapshot, runtime, responsivenessProfile }) {
  if (!responsivenessProfile) return 0;

  const familySummary = responsivenessProfile.familyResponses?.[runtime.familyId];
  const variantSummary = responsivenessProfile.variantResponses?.[runtime.variantId];
  const summary = variantSummary || familySummary;
  if (!summary) return 0;

  const confidenceWeight = summary.confidence === 'high' ? 1 : summary.confidence === 'medium' ? 0.6 : 0.3;
  const freshnessWeight = summary.freshness === 'current' ? 1 : summary.freshness === 'degraded' ? 0.55 : 0.2;
  const stateWeight = snapshot.confidence === 'high' ? 1 : snapshot.confidence === 'medium' ? 0.72 : 0.45;
  const fitTags = new Set([
    snapshot.overallReadiness ? `${snapshot.overallReadiness}_snapshot` : '',
    snapshot.recommendedRouting || '',
    snapshot.recommendedProtocolClass || '',
    ...(snapshot.contextTags || []),
    snapshot.readinessScore < 45 ? 'low_readiness' : snapshot.readinessScore < 65 ? 'medium_readiness' : 'high_readiness',
  ]);
  const fitBonus = Math.min((summary.stateFit || []).filter((tag) => fitTags.has(tag)).length * 4, 12);

  let base = 0;
  switch (summary.responseDirection) {
    case 'positive':
      base = 18;
      break;
    case 'negative':
      base = -24;
      break;
    case 'mixed':
      base = -6;
      break;
    default:
      base = 0;
      break;
  }

  const weighted = (base + fitBonus) * confidenceWeight * freshnessWeight * stateWeight;
  if (summary.responseDirection === 'negative' && summary.confidence === 'high') {
    return weighted - 10;
  }
  return weighted;
}

function buildResponsivenessPlannerSummary(runtime, responsivenessProfile) {
  if (!responsivenessProfile) return undefined;
  const summary =
    responsivenessProfile.variantResponses?.[runtime.variantId]
    || responsivenessProfile.familyResponses?.[runtime.familyId];
  if (!summary) return undefined;

  const evidenceLead = summary.supportingEvidence?.[0];
  const posture = `${summary.freshness} ${summary.confidence}-confidence ${summary.responseDirection}`;
  return evidenceLead
    ? `Athlete responsiveness is ${posture} for ${runtime.variantLabel || runtime.label}. ${evidenceLead}`
    : `Athlete responsiveness is ${posture} for ${runtime.variantLabel || runtime.label}.`;
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch (nestedError) {
        return null;
      }
    }
  }

  return null;
}

function toTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (value instanceof admin.firestore.Timestamp) return value.toMillis();
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return Number(value.seconds) * 1000;
  }
  return 0;
}

function normalizeReadinessScore({ checkIn, progress }) {
  const profileReadiness = progress?.taxonomyProfile?.modifierScores?.readiness;
  if (typeof profileReadiness === 'number' && Number.isFinite(profileReadiness)) {
    return clamp(profileReadiness);
  }

  return clamp(((Number(checkIn.readinessScore || 1) - 1) / 4) * 100);
}

function deriveStateDimensions({ checkIn, progress }) {
  const readiness = normalizeReadinessScore({ checkIn, progress });
  const energy = typeof checkIn.energyLevel === 'number' ? ((checkIn.energyLevel - 1) / 4) * 100 : readiness;
  const stress = typeof checkIn.stressLevel === 'number' ? ((checkIn.stressLevel - 1) / 4) * 100 : 100 - readiness;
  const sleep = typeof checkIn.sleepQuality === 'number' ? ((checkIn.sleepQuality - 1) / 4) * 100 : readiness;
  const fatigability = progress?.taxonomyProfile?.modifierScores?.fatigability;
  const pressureSensitivity = progress?.taxonomyProfile?.modifierScores?.pressure_sensitivity;

  return {
    activation: clamp(stress * 0.65 + (pressureSensitivity ?? stress) * 0.35),
    focusReadiness: clamp(readiness * 0.55 + energy * 0.3 + sleep * 0.15),
    emotionalLoad: clamp(stress * 0.7 + (100 - readiness) * 0.3),
    cognitiveFatigue: clamp((100 - sleep) * 0.55 + (100 - energy) * 0.3 + (fatigability ?? (100 - readiness)) * 0.15),
  };
}

function deriveOverallReadiness({ readinessScore, dimensions }) {
  if (readinessScore >= 70 && dimensions.focusReadiness >= 65 && dimensions.cognitiveFatigue <= 45) return 'green';
  if (readinessScore < 45 || dimensions.cognitiveFatigue >= 70 || dimensions.emotionalLoad >= 70) return 'red';
  return 'yellow';
}

function deriveConfidence({ checkIn, progress }) {
  let signalCount = 1;
  if (typeof checkIn.energyLevel === 'number') signalCount += 1;
  if (typeof checkIn.stressLevel === 'number') signalCount += 1;
  if (typeof checkIn.sleepQuality === 'number') signalCount += 1;
  if (checkIn.taxonomyState) signalCount += 1;
  if (progress?.taxonomyProfile) signalCount += 1;

  if (signalCount >= 4) return 'high';
  if (signalCount >= 2) return 'medium';
  return 'low';
}

function deriveRouting({ readiness, progress }) {
  const sessionType = progress?.activeProgram?.sessionType;
  if (readiness === 'red') {
    return sessionType === 'recovery_rep' ? 'protocol_only' : 'defer_alternate_path';
  }
  if (readiness === 'yellow') {
    return 'protocol_then_sim';
  }
  if (sessionType === 'reassessment') return 'trial_only';
  return 'sim_only';
}

function deriveProtocolClass({ dimensions, progress }) {
  const sessionType = progress?.activeProgram?.sessionType;
  if (sessionType === 'recovery_rep' || dimensions.cognitiveFatigue >= 70) return 'recovery';
  if (dimensions.activation >= 65 || dimensions.emotionalLoad >= 65) return 'regulation';
  if (dimensions.focusReadiness <= 45) return 'priming';
  return 'none';
}

function deriveContextTags(progress) {
  const tags = new Set();
  const sessionType = progress?.activeProgram?.sessionType;
  const durationMode = progress?.activeProgram?.durationMode;
  if (sessionType) tags.add(sessionType);
  if (durationMode) tags.add(durationMode);
  if (durationMode === 'extended_stress_test') tags.add('high_load_window');
  return Array.from(tags);
}

function detectContradictionFlags({ checkIn, normalizedScore, dimensions }) {
  const contradictions = [];
  const explicitReadiness = Number(checkIn.readinessScore || 0);

  if (explicitReadiness >= 4 && (dimensions.emotionalLoad >= 70 || dimensions.cognitiveFatigue >= 70)) {
    contradictions.push('high_self_report_vs_heavy_state_markers');
  }

  if (explicitReadiness <= 2 && dimensions.focusReadiness >= 70) {
    contradictions.push('low_self_report_vs_high_focus_markers');
  }

  if (typeof checkIn.sleepQuality === 'number' && checkIn.sleepQuality <= 2 && explicitReadiness >= 4) {
    contradictions.push('high_readiness_vs_poor_sleep');
  }

  if (typeof checkIn.stressLevel === 'number' && checkIn.stressLevel >= 4 && explicitReadiness >= 4) {
    contradictions.push('high_readiness_vs_high_stress');
  }

  if (normalizedScore >= 75 && dimensions.activation >= 70) {
    contradictions.push('profile_readiness_vs_activation_spike');
  }

  return uniqueStrings(contradictions);
}

function buildRawSignalSummary({ checkIn, progress, normalizedScore, contradictionFlags }) {
  let signalCount = 1;
  if (typeof checkIn.energyLevel === 'number') signalCount += 1;
  if (typeof checkIn.stressLevel === 'number') signalCount += 1;
  if (typeof checkIn.sleepQuality === 'number') signalCount += 1;
  if (checkIn.taxonomyState) signalCount += 1;
  if (progress?.taxonomyProfile) signalCount += 1;
  if (progress?.activeProgram) signalCount += 1;

  return {
    explicitSelfReport: {
      readinessScore: Number(checkIn.readinessScore || 1),
      moodWord: typeof checkIn.moodWord === 'string' ? checkIn.moodWord : undefined,
      energyLevel: typeof checkIn.energyLevel === 'number' ? checkIn.energyLevel : undefined,
      stressLevel: typeof checkIn.stressLevel === 'number' ? checkIn.stressLevel : undefined,
      sleepQuality: typeof checkIn.sleepQuality === 'number' ? checkIn.sleepQuality : undefined,
      notes: typeof checkIn.notes === 'string' ? checkIn.notes : undefined,
    },
    activeProgramContext: progress?.activeProgram
      ? {
          sessionType: progress.activeProgram.sessionType,
          durationMode: progress.activeProgram.durationMode,
          recommendedSimId: progress.activeProgram.recommendedSimId,
          recommendedLegacyExerciseId: progress.activeProgram.recommendedLegacyExerciseId,
        }
      : undefined,
    normalizedReadinessScore: normalizedScore,
    signalCount,
    contradictionFlags,
  };
}

function buildFallbackInterpretation({ snapshot }) {
  const dimensions = snapshot.stateDimensions || {};
  const dimensionEntries = [
    ['activation', dimensions.activation ?? 0],
    ['focus_readiness', dimensions.focusReadiness ?? 0],
    ['emotional_load', dimensions.emotionalLoad ?? 0],
    ['cognitive_fatigue', dimensions.cognitiveFatigue ?? 0],
  ].sort((left, right) => right[1] - left[1]);

  const primaryFactor = VALID_PRIMARY_FACTORS.has(dimensionEntries[0]?.[0]) ? dimensionEntries[0][0] : 'mixed';
  const supportingSignals = [];

  if ((dimensions.activation ?? 0) >= 65) supportingSignals.push('activation is elevated');
  if ((dimensions.focusReadiness ?? 0) <= 45) supportingSignals.push('focus readiness looks limited');
  if ((dimensions.emotionalLoad ?? 0) >= 65) supportingSignals.push('emotional load is elevated');
  if ((dimensions.cognitiveFatigue ?? 0) >= 65) supportingSignals.push('cognitive fatigue markers are elevated');
  if (!supportingSignals.length) supportingSignals.push(`overall readiness reads ${snapshot.overallReadiness}`);

  const contradictions = uniqueStrings(snapshot.rawSignalSummary?.contradictionFlags);
  const candidateClassHints =
    snapshot.recommendedRouting === 'trial_only'
      ? ['trial']
      : snapshot.recommendedRouting === 'protocol_only'
        ? ['protocol']
        : snapshot.recommendedRouting === 'protocol_then_sim' || snapshot.recommendedRouting === 'sim_then_protocol'
          ? ['protocol', 'sim']
          : snapshot.recommendedRouting === 'defer_alternate_path'
            ? []
            : ['sim'];

  return {
    summary: `Fallback interpretation: today's signal most likely reflects ${humanizeRuntimeLabel(primaryFactor)} pressure inside a ${snapshot.overallReadiness} readiness posture.`,
    likelyPrimaryFactor: primaryFactor,
    supportingSignals,
    contradictions,
    plannerNotes: contradictions.length
      ? ['Contradictions are present, so Nora should prefer bounded and reversible decisions.']
      : ['Signals are reasonably aligned for a bounded assignment decision.'],
    confidence: snapshot.confidence,
    confidenceRationale:
      snapshot.confidence === 'high'
        ? 'Multiple aligned signals are present.'
        : snapshot.confidence === 'medium'
          ? 'Some support exists, but the evidence is not fully dense.'
          : 'Evidence is sparse or conflicting.',
    recommendedRouting: snapshot.recommendedRouting,
    recommendedProtocolClass: snapshot.recommendedProtocolClass || 'none',
    candidateClassHints,
    supportFlag: snapshot.overallReadiness === 'red' && contradictions.length > 0,
    modelSource: 'fallback_rules',
  };
}

async function callOpenAiJson({ systemPrompt, userPayload }) {
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${errorText.slice(0, 240)}`);
  }

  const completion = await response.json();
  const content = completion?.choices?.[0]?.message?.content;
  return extractJsonObject(content);
}

async function enrichStateSnapshotWithAI({ snapshot, progress }) {
  const fallback = buildFallbackInterpretation({ snapshot });

  try {
    const raw = await callOpenAiJson({
      systemPrompt: [
        'You are enriching a sports mental-performance state snapshot for Nora.',
        'Return only valid JSON.',
        'Do not invent medical claims.',
        'Use only the evidence provided.',
        'You may adjust confidence, routing recommendation, protocol class hint, and candidate class hints.',
        'Allowed confidence: high, medium, low.',
        'Allowed routing: protocol_only, sim_only, trial_only, protocol_then_sim, sim_then_protocol, defer_alternate_path.',
        'Allowed protocolClass: regulation, priming, recovery, none.',
        'Allowed candidateClassHints values: sim, protocol, trial.',
        'Allowed likelyPrimaryFactor: activation, focus_readiness, emotional_load, cognitive_fatigue, mixed.',
        'JSON shape: {"summary":"","likelyPrimaryFactor":"","supportingSignals":[],"contradictions":[],"plannerNotes":[],"confidence":"","confidenceRationale":"","recommendedRouting":"","recommendedProtocolClass":"","candidateClassHints":[],"supportFlag":false}',
      ].join(' '),
      userPayload: {
        stateSnapshot: snapshot,
        activeProgram: progress?.activeProgram || null,
      },
    });

    if (!raw || typeof raw !== 'object') {
      return {
        ...snapshot,
        enrichedInterpretation: {
          summary: fallback.summary,
          likelyPrimaryFactor: fallback.likelyPrimaryFactor,
          supportingSignals: fallback.supportingSignals,
          contradictions: fallback.contradictions,
          plannerNotes: fallback.plannerNotes,
          confidenceRationale: fallback.confidenceRationale,
          supportFlag: fallback.supportFlag,
          modelSource: fallback.modelSource,
        },
        candidateClassHints: fallback.candidateClassHints,
        decisionSource: fallback.modelSource,
        supportFlag: fallback.supportFlag,
      };
    }

    const confidence = VALID_CONFIDENCE.has(raw.confidence) ? raw.confidence : fallback.confidence;
    const recommendedRouting = VALID_ROUTING.has(raw.recommendedRouting)
      ? raw.recommendedRouting
      : fallback.recommendedRouting;
    const recommendedProtocolClass = VALID_PROTOCOL_CLASSES.has(raw.recommendedProtocolClass)
      ? raw.recommendedProtocolClass
      : fallback.recommendedProtocolClass;
    const candidateClassHints = uniqueStrings(raw.candidateClassHints).filter((value) => VALID_CANDIDATE_TYPES.has(value));

    return {
      ...snapshot,
      confidence,
      recommendedRouting,
      recommendedProtocolClass,
      candidateClassHints: candidateClassHints.length ? candidateClassHints : fallback.candidateClassHints,
      supportFlag: typeof raw.supportFlag === 'boolean' ? raw.supportFlag : fallback.supportFlag,
      decisionSource: 'ai',
      enrichedInterpretation: {
        summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim() : fallback.summary,
        likelyPrimaryFactor: VALID_PRIMARY_FACTORS.has(raw.likelyPrimaryFactor)
          ? raw.likelyPrimaryFactor
          : fallback.likelyPrimaryFactor,
        supportingSignals: uniqueStrings(raw.supportingSignals).length
          ? uniqueStrings(raw.supportingSignals)
          : fallback.supportingSignals,
        contradictions: uniqueStrings(raw.contradictions).length
          ? uniqueStrings(raw.contradictions)
          : fallback.contradictions,
        plannerNotes: uniqueStrings(raw.plannerNotes).length
          ? uniqueStrings(raw.plannerNotes)
          : fallback.plannerNotes,
        confidenceRationale:
          typeof raw.confidenceRationale === 'string' && raw.confidenceRationale.trim()
            ? raw.confidenceRationale.trim()
            : fallback.confidenceRationale,
        supportFlag: typeof raw.supportFlag === 'boolean' ? raw.supportFlag : fallback.supportFlag,
        modelSource: 'ai',
      },
    };
  } catch (error) {
    console.warn('[submit-pulsecheck-checkin] AI snapshot enrichment failed, using fallback interpretation:', error?.message || error);
    return {
      ...snapshot,
      candidateClassHints: fallback.candidateClassHints,
      decisionSource: fallback.modelSource,
      supportFlag: fallback.supportFlag,
      enrichedInterpretation: {
        summary: fallback.summary,
        likelyPrimaryFactor: fallback.likelyPrimaryFactor,
        supportingSignals: fallback.supportingSignals,
        contradictions: fallback.contradictions,
        plannerNotes: fallback.plannerNotes,
        confidenceRationale: fallback.confidenceRationale,
        supportFlag: fallback.supportFlag,
        modelSource: fallback.modelSource,
      },
    };
  }
}

function buildProtocolCandidates({ snapshot, liveProtocolRegistry, responsivenessProfile }) {
  const protocolClass = snapshot.recommendedProtocolClass;
  if (!protocolClass || protocolClass === 'none') {
    return { candidates: [], inventoryGap: null };
  }

  const protocols = (Array.isArray(liveProtocolRegistry) ? liveProtocolRegistry : [])
    .filter((entry) => entry.protocolClass === protocolClass)
    .map((protocol) => ({
      protocol,
      responsivenessSummary: buildResponsivenessPlannerSummary(protocol, responsivenessProfile),
      responsivenessScore: buildProtocolResponsivenessScore({
        snapshot,
        runtime: protocol,
        responsivenessProfile,
      }),
    }))
    .sort((left, right) => {
      if (right.responsivenessScore !== left.responsivenessScore) {
        return right.responsivenessScore - left.responsivenessScore;
      }
      return (left.protocol.sortOrder || 999) - (right.protocol.sortOrder || 999);
    });

  if (!protocols.length) {
    return {
      candidates: [],
      inventoryGap: `No live ${protocolClass} protocol is registered yet for the bounded planner inventory.`,
    };
  }

  return {
    candidates: protocols.map(({ protocol, responsivenessSummary }) => {
      const summary =
        responsivenessProfile?.variantResponses?.[protocol.variantId]
        || responsivenessProfile?.familyResponses?.[protocol.familyId];

      return {
        id: `${snapshot.athleteId}_${snapshot.sourceDate}_${protocol.id}`,
        type: 'protocol',
        label: protocol.label,
        actionType: 'protocol',
        rationale: [protocol.rationale || `Bounded protocol candidate for ${protocolClass} work from the live protocol registry.`, responsivenessSummary]
          .filter(Boolean)
          .join(' '),
        legacyExerciseId: protocol.legacyExerciseId,
        protocolId: protocol.id,
        protocolLabel: protocol.label,
        protocolClass,
        protocolCategory: protocol.category,
        protocolResponseFamily: protocol.responseFamily,
        protocolDeliveryMode: protocol.deliveryMode,
        responsivenessDirection: summary?.responseDirection,
        responsivenessConfidence: summary?.confidence,
        responsivenessFreshness: summary?.freshness,
        responsivenessSummary,
        responsivenessStateFit: summary?.stateFit,
        durationSeconds: protocol.durationSeconds,
      };
    }),
    inventoryGap: null,
  };
}

function buildAssignmentCandidateSet({ athleteId, sourceDate, snapshot, progress, liveProtocolRegistry, responsivenessProfile }) {
  const id = buildCandidateSetId(athleteId, sourceDate);
  const candidates = [];
  const constraintReasons = [];
  const inventoryGaps = [];
  const activeProgram = progress?.activeProgram;
  const wantsProtocol = (snapshot.candidateClassHints || []).includes('protocol')
    || snapshot.recommendedRouting === 'protocol_only'
    || snapshot.recommendedRouting === 'protocol_then_sim'
    || snapshot.recommendedRouting === 'sim_then_protocol';

  if (wantsProtocol) {
    const protocolResult = buildProtocolCandidates({ snapshot, liveProtocolRegistry, responsivenessProfile });
    if (protocolResult.candidates.length) {
      candidates.push(...protocolResult.candidates);
    } else if (protocolResult.inventoryGap) {
      inventoryGaps.push(protocolResult.inventoryGap);
    }
  }

  if (activeProgram?.recommendedSimId || activeProgram?.recommendedLegacyExerciseId) {
    const isTrial = activeProgram.sessionType === 'reassessment';
    candidates.push({
      id: `${athleteId}_${sourceDate}_${activeProgram.recommendedSimId || activeProgram.recommendedLegacyExerciseId}`,
      type: isTrial ? 'trial' : 'sim',
      label: humanizeRuntimeLabel(
        activeProgram.recommendedSimId || activeProgram.recommendedLegacyExerciseId || activeProgram.sessionType || 'sim'
      ),
      actionType:
        snapshot.recommendedRouting === 'protocol_then_sim'
        || snapshot.recommendedRouting === 'defer_alternate_path'
        || snapshot.overallReadiness === 'yellow'
          ? 'lighter_sim'
          : 'sim',
      rationale: 'Bounded simulation candidate from the active program recommendation.',
      simSpecId: activeProgram.recommendedSimId,
      legacyExerciseId: activeProgram.recommendedLegacyExerciseId,
      sessionType: activeProgram.sessionType,
      durationMode: activeProgram.durationMode,
      durationSeconds: activeProgram.durationSeconds,
    });
  } else {
    constraintReasons.push('No active program simulation candidate is currently available.');
  }

  if (snapshot.recommendedRouting === 'trial_only' && !candidates.some((candidate) => candidate.type === 'trial')) {
    inventoryGaps.push('The state recommends a trial-style day, but the active program did not resolve a trial candidate.');
  }

  const candidateClassHints = uniqueStrings([
    ...(snapshot.candidateClassHints || []),
    ...candidates.map((candidate) => candidate.type),
  ]).filter((value) => VALID_CANDIDATE_TYPES.has(value));

  return {
    id,
    athleteId,
    sourceDate,
    sourceStateSnapshotId: snapshot.id,
    candidates,
    candidateIds: candidates.map((candidate) => candidate.id),
    candidateClassHints,
    constraintReasons,
    inventoryGaps,
    plannerEligible: candidates.length > 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function buildFallbackPlannerDecision({ snapshot, candidateSet }) {
  const protocolCandidate = candidateSet.candidates.find((candidate) => candidate.type === 'protocol');
  const simCandidate = candidateSet.candidates.find((candidate) => candidate.type === 'sim' || candidate.type === 'trial');

  if ((snapshot.overallReadiness === 'red' || snapshot.recommendedRouting === 'protocol_only') && protocolCandidate) {
    return {
      decisionSource: 'fallback_rules',
      selectedCandidateId: protocolCandidate.id,
      selectedCandidateType: protocolCandidate.type,
      actionType: protocolCandidate.actionType,
      confidence: snapshot.confidence,
      rationaleSummary: `Fallback planner selected ${protocolCandidate.label} because the enriched snapshot favors protocol-first work today.`,
      supportFlag: Boolean(snapshot.supportFlag),
    };
  }

  if (simCandidate) {
    return {
      decisionSource: 'fallback_rules',
      selectedCandidateId: simCandidate.id,
      selectedCandidateType: simCandidate.type,
      actionType: simCandidate.actionType,
      confidence: snapshot.confidence,
      rationaleSummary: `Fallback planner selected ${simCandidate.label} from the bounded candidate set.`,
      supportFlag: Boolean(snapshot.supportFlag),
    };
  }

  if (protocolCandidate) {
    return {
      decisionSource: 'fallback_rules',
      selectedCandidateId: protocolCandidate.id,
      selectedCandidateType: protocolCandidate.type,
      actionType: protocolCandidate.actionType,
      confidence: 'low',
      rationaleSummary: `Fallback planner selected ${protocolCandidate.label} because no simulation candidate was available.`,
      supportFlag: true,
    };
  }

  return {
    decisionSource: 'fallback_rules',
    actionType: 'defer',
    confidence: 'low',
    rationaleSummary: 'No valid bounded candidate was available, so Nora deferred today’s main task.',
    supportFlag: true,
  };
}

async function planAssignmentWithAI({ snapshot, candidateSet, progress, responsivenessProfile }) {
  const fallback = buildFallbackPlannerDecision({ snapshot, candidateSet });
  if (!candidateSet.plannerEligible) {
    return fallback;
  }

  try {
    const raw = await callOpenAiJson({
      systemPrompt: [
        'You are Nora’s bounded assignment planner.',
        'Return only valid JSON.',
        'You must choose only from the provided candidate ids or defer.',
        'Never invent a new exercise, protocol, or candidate id.',
        'Treat protocol responsiveness as a ranking input inside the current state posture, not as permission to ignore a strong current-state signal.',
        'Allowed actionType values: sim, lighter_sim, protocol, defer.',
        'Allowed confidence values: high, medium, low.',
        'JSON shape: {"selectedCandidateId":"","selectedCandidateType":"","actionType":"","confidence":"","rationaleSummary":"","supportFlag":false}',
      ].join(' '),
      userPayload: {
        stateSnapshot: snapshot,
        candidateSet,
        activeProgram: progress?.activeProgram || null,
        protocolResponsivenessProfile: responsivenessProfile || null,
      },
    });

    if (!raw || typeof raw !== 'object') {
      return fallback;
    }

    return {
      decisionSource: 'ai',
      selectedCandidateId: typeof raw.selectedCandidateId === 'string' ? raw.selectedCandidateId : undefined,
      selectedCandidateType: VALID_CANDIDATE_TYPES.has(raw.selectedCandidateType) ? raw.selectedCandidateType : undefined,
      actionType: ['sim', 'lighter_sim', 'protocol', 'defer'].includes(raw.actionType) ? raw.actionType : fallback.actionType,
      confidence: VALID_CONFIDENCE.has(raw.confidence) ? raw.confidence : fallback.confidence,
      rationaleSummary:
        typeof raw.rationaleSummary === 'string' && raw.rationaleSummary.trim()
          ? raw.rationaleSummary.trim()
          : fallback.rationaleSummary,
      supportFlag: typeof raw.supportFlag === 'boolean' ? raw.supportFlag : fallback.supportFlag,
    };
  } catch (error) {
    console.warn('[submit-pulsecheck-checkin] AI assignment planner failed, using fallback decision:', error?.message || error);
    return fallback;
  }
}

function validatePlannerDecision({ decision, candidateSet, snapshot }) {
  if (decision.actionType === 'defer' || !decision.selectedCandidateId) {
    return {
      decision: {
        ...decision,
        selectedCandidateId: undefined,
        selectedCandidateType: undefined,
        actionType: 'defer',
      },
      selectedCandidate: null,
    };
  }

  const selectedCandidate = candidateSet.candidates.find((candidate) => candidate.id === decision.selectedCandidateId);
  if (!selectedCandidate) {
    const fallback = buildFallbackPlannerDecision({ snapshot, candidateSet });
    return validatePlannerDecision({ decision: fallback, candidateSet, snapshot });
  }

  return {
    decision: {
      decisionSource: decision.decisionSource || 'fallback_rules',
      selectedCandidateId: selectedCandidate.id,
      selectedCandidateType: selectedCandidate.type,
      actionType: selectedCandidate.actionType,
      confidence: VALID_CONFIDENCE.has(decision.confidence) ? decision.confidence : snapshot.confidence,
      rationaleSummary: decision.rationaleSummary || `Selected ${selectedCandidate.label} from the bounded candidate set.`,
      supportFlag: Boolean(decision.supportFlag),
    },
    selectedCandidate,
  };
}

function buildPlannerAudit({ snapshot, candidateSet, plannerOutput, selectedCandidate }) {
  const rankedCandidates = (candidateSet?.candidates || []).slice(0, 5).map((candidate) => ({
    candidateId: candidate.id,
    label: candidate.label,
    type: candidate.type,
    actionType: candidate.actionType,
    rationale: candidate.rationale,
    selected: candidate.id === selectedCandidate?.id,
    responsivenessDirection: candidate.responsivenessDirection,
    responsivenessConfidence: candidate.responsivenessConfidence,
    responsivenessFreshness: candidate.responsivenessFreshness,
    responsivenessSummary: candidate.responsivenessSummary,
  }));

  return {
    generatedAt: Date.now(),
    stateConfidence: snapshot?.confidence || plannerOutput?.confidence || 'low',
    responsivenessApplied: rankedCandidates.some((candidate) => Boolean(candidate.responsivenessDirection || candidate.responsivenessSummary)),
    selectedCandidateId: selectedCandidate?.id,
    rankedCandidates,
  };
}

function toReadinessBand(readinessScore) {
  if (typeof readinessScore !== 'number') return undefined;
  if (readinessScore < 45) return 'low';
  if (readinessScore < 65) return 'medium';
  return 'high';
}

function resolveSnapshotDrivenActionType({ snapshot, hasResolvedExercise, fallbackActionType }) {
  if (!snapshot) return fallbackActionType;

  switch (snapshot.recommendedRouting) {
    case 'defer_alternate_path':
      return 'defer';
    case 'protocol_only':
    case 'protocol_then_sim':
      return hasResolvedExercise ? 'lighter_sim' : 'defer';
    case 'sim_only':
    case 'sim_then_protocol':
    case 'trial_only':
    default:
      return hasResolvedExercise ? 'sim' : 'defer';
  }
}

function buildSnapshotDrivenRationale({ snapshot, actionType, fallbackRationale }) {
  if (!snapshot) return fallbackRationale || '';

  const confidenceLabel = humanizeRuntimeLabel(snapshot.confidence) || 'current';
  const routingLabel = humanizeRuntimeLabel(snapshot.recommendedRouting) || 'sim only';
  const readinessLabel = snapshot.overallReadiness ? `${snapshot.overallReadiness} readiness` : 'current readiness';
  const protocolLabel =
    snapshot.recommendedProtocolClass && snapshot.recommendedProtocolClass !== 'none'
      ? `${humanizeRuntimeLabel(snapshot.recommendedProtocolClass)} protocol`
      : '';

  let runtimeLead = '';
  switch (actionType) {
    case 'defer':
      runtimeLead = `Nora paused the main task because today's state snapshot reads ${readinessLabel} with ${confidenceLabel} confidence.`;
      break;
    case 'lighter_sim':
      runtimeLead = protocolLabel
        ? `Nora is front-loading ${protocolLabel} work because today's state snapshot reads ${readinessLabel} and routes ${routingLabel}.`
        : `Nora softened today's entry because the state snapshot reads ${readinessLabel} and routes ${routingLabel}.`;
      break;
    case 'sim':
    default:
      runtimeLead = `Nora kept today's task live because the state snapshot reads ${readinessLabel} and routes ${routingLabel}.`;
      break;
  }

  return fallbackRationale ? `${runtimeLead} ${fallbackRationale}` : runtimeLead;
}

async function verifyAuth(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header');
  }

  const idToken = authHeader.slice('Bearer '.length);
  return admin.auth().verifyIdToken(idToken);
}

async function loadOrInitializeProgress(db, athleteId) {
  const progressRef = db.collection(PROGRESS_COLLECTION).doc(athleteId);
  const progressSnap = await progressRef.get();
  if (progressSnap.exists) {
    return progressSnap.data() || {};
  }

  const initialProgress = profileSnapshotRuntime.buildInitialAthleteProgress(athleteId, Date.now());
  await progressRef.set(initialProgress, { merge: true });
  return initialProgress;
}

async function syncTaxonomyProfile(db, athleteId, currentProgress) {
  const [checkInsSnap, simSessionsSnap] = await Promise.all([
    db.collection(CHECKINS_ROOT).doc(athleteId).collection('check-ins').orderBy('createdAt', 'desc').limit(20).get(),
    db.collection('sim-sessions').doc(athleteId).collection('sessions').orderBy('createdAt', 'desc').limit(30).get(),
  ]);

  const checkIns = checkInsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const simSessions = simSessionsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

  const taxonomyProfile = profileSnapshotRuntime.deriveTaxonomyProfile({
    baselineAssessment: currentProgress?.baselineAssessment,
    checkIns,
    simSessions,
  });

  const latestCheckIn = checkIns[0];
  const activeProgram = profileSnapshotRuntime.prescribeNextSession({
    profile: taxonomyProfile,
    checkInState: latestCheckIn?.taxonomyState,
  });

  const updates = {
    taxonomyProfile,
    activeProgram,
    lastProfileSyncAt: Date.now(),
    profileVersion: profileSnapshotRuntime.PROFILE_VERSION,
    updatedAt: Date.now(),
  };

  await db.collection(PROGRESS_COLLECTION).doc(athleteId).set(updates, { merge: true });
  return { ...currentProgress, ...updates };
}

async function getSnapshotById(db, id) {
  const snap = await db.collection(SNAPSHOTS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

async function upsertStateSnapshot({ db, athleteId, checkIn, progress }) {
  const snapshotId = `${athleteId}_${checkIn.date}`;
  const existing = await getSnapshotById(db, snapshotId);
  const readinessScore = normalizeReadinessScore({ checkIn, progress });
  const stateDimensions = deriveStateDimensions({ checkIn, progress });
  const overallReadiness = deriveOverallReadiness({ readinessScore, dimensions: stateDimensions });
  const confidence = deriveConfidence({ checkIn, progress });
  const contradictionFlags = detectContradictionFlags({ checkIn, normalizedScore: readinessScore, dimensions: stateDimensions });
  const rawSignalSummary = buildRawSignalSummary({
    checkIn,
    progress,
    normalizedScore: readinessScore,
    contradictionFlags,
  });
  const now = Date.now();

  const nextSnapshot = {
    id: snapshotId,
    athleteId,
    sourceDate: checkIn.date,
    sourceCheckInId: checkIn.id,
    rawSignalSummary,
    stateDimensions,
    overallReadiness,
    confidence,
    freshness: 'current',
    sourcesUsed: [
      'explicit_self_report',
      ...(checkIn.taxonomyState ? ['taxonomy_checkin_state'] : []),
      ...(progress?.taxonomyProfile ? ['taxonomy_profile'] : []),
      ...(progress?.activeProgram ? ['active_program_context'] : []),
    ],
    sourceEventIds: Array.from(new Set([...(existing?.sourceEventIds || []), checkIn.id])),
    contextTags: deriveContextTags(progress),
    recommendedRouting: deriveRouting({ readiness: overallReadiness, progress }),
    recommendedProtocolClass: deriveProtocolClass({ dimensions: stateDimensions, progress }),
    candidateClassHints: [],
    readinessScore,
    supportFlag: false,
    decisionSource: 'fallback_rules',
    executionLink: existing?.executionLink,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await db.collection(SNAPSHOTS_COLLECTION).doc(snapshotId).set(stripUndefinedDeep(nextSnapshot), { merge: true });
  return nextSnapshot;
}

async function resolveActiveAthleteMembership(db, athleteId) {
  const membershipSnap = await db
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('userId', '==', athleteId)
    .where('role', '==', 'athlete')
    .get();

  const memberships = membershipSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((left, right) => toTimestampMillis(right.grantedAt) - toTimestampMillis(left.grantedAt));

  return memberships[0] || null;
}

function rolePriority(role) {
  switch (role) {
    case 'coach':
      return 0;
    case 'team-admin':
      return 1;
    case 'performance-staff':
      return 2;
    case 'support-staff':
      return 3;
    default:
      return 9;
  }
}

async function resolveCoachId(db, athleteId, athleteMembership, existingCoachId) {
  if (existingCoachId && existingCoachId !== athleteId) {
    return existingCoachId;
  }

  if (athleteMembership?.legacyCoachId && athleteMembership.legacyCoachId !== athleteId) {
    return athleteMembership.legacyCoachId;
  }

  if (!athleteMembership?.teamId) {
    return undefined;
  }

  const teamMembershipSnap = await db
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('teamId', '==', athleteMembership.teamId)
    .get();

  const candidate = teamMembershipSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((membership) => membership.userId !== athleteId && membership.role !== 'athlete' && membership.role !== 'clinician')
    .sort((left, right) => {
      const byRole = rolePriority(left.role) - rolePriority(right.role);
      if (byRole !== 0) return byRole;
      return toTimestampMillis(right.grantedAt) - toTimestampMillis(left.grantedAt);
    })[0];

  return candidate?.userId;
}

async function attachExecutionLink(db, snapshotId, assignmentId) {
  if (!snapshotId || !assignmentId) return;
  await db.collection(SNAPSHOTS_COLLECTION).doc(snapshotId).set({
    executionLink: assignmentId,
    updatedAt: Date.now(),
  }, { merge: true });
}

function assignmentLineageChanged(existing, nextAssignment) {
  if (!existing) return true;

  const comparableKeys = [
    'actionType',
    'chosenCandidateId',
    'chosenCandidateType',
    'simSpecId',
    'legacyExerciseId',
    'protocolId',
    'protocolLabel',
    'protocolClass',
    'protocolCategory',
    'protocolResponseFamily',
    'protocolDeliveryMode',
    'sessionType',
    'durationMode',
    'durationSeconds',
    'rationale',
    'plannerSummary',
    'plannerConfidence',
    'decisionSource',
    'readinessScore',
    'readinessBand',
    'supportFlag',
    'sourceCheckInId',
    'sourceStateSnapshotId',
    'sourceCandidateSetId',
  ];

  return comparableKeys.some((key) => {
    const left = existing[key];
    const right = nextAssignment[key];
    if (typeof left === 'object' || typeof right === 'object') {
      return JSON.stringify(left || null) !== JSON.stringify(right || null);
    }
    return left !== right;
  });
}

async function archiveAssignmentRevision({
  db,
  assignmentRef,
  existing,
  nextRevision,
  now,
}) {
  if (!existing) return;

  const currentRevision = typeof existing.revision === 'number' ? existing.revision : 1;
  const revisionId = `r${String(currentRevision).padStart(4, '0')}`;
  await assignmentRef.collection(ASSIGNMENT_REVISIONS_SUBCOLLECTION).doc(revisionId).set(stripUndefinedDeep({
    ...existing,
    lineageId: existing.lineageId || assignmentRef.id,
    revision: currentRevision,
    supersededAt: now,
    supersededByRevision: nextRevision,
    archivedAt: now,
  }), { merge: true });
}

async function orchestratePostCheckIn({
  db,
  athleteId,
  sourceCheckInId,
  sourceStateSnapshotId,
  sourceCandidateSetId,
  sourceDate,
  progress,
  candidateSet,
  plannerDecision,
  liveProtocolRegistry,
}) {
  if (!progress?.activeProgram) {
    return null;
  }

  const snapshot =
    (sourceStateSnapshotId ? await getSnapshotById(db, sourceStateSnapshotId) : null) ||
    await getSnapshotById(db, `${athleteId}_${sourceDate}`);

  const athleteMembership = await resolveActiveAthleteMembership(db, athleteId);
  if (!athleteMembership) {
    return null;
  }

  const coachId = await resolveCoachId(db, athleteId, athleteMembership, progress.coachId);
  if (coachId) {
    await db.collection(PROGRESS_COLLECTION).doc(athleteId).set({
      coachId,
      updatedAt: Date.now(),
    }, { merge: true });
  }

  const readinessScore = snapshot?.readinessScore ?? progress?.taxonomyProfile?.modifierScores?.readiness;
  const assignmentId = `${athleteId}_${sourceDate}`;
  const assignmentRef = db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(assignmentId);
  const existingSnap = await assignmentRef.get();
  const existing = existingSnap.exists ? { id: existingSnap.id, ...existingSnap.data() } : null;

  if (existing && !['assigned', 'viewed'].includes(String(existing.status || ''))) {
    await attachExecutionLink(db, sourceStateSnapshotId, assignmentId);
    return existing;
  }

  const activeProgram = progress.activeProgram;
  const fallbackActionType = activeProgram.recommendedSimId
    ? (activeProgram.sessionType === 'recovery_rep' || activeProgram.sessionType === 'probe' ? 'lighter_sim' : 'sim')
    : 'defer';
  const validatedPlannerDecision = validatePlannerDecision({
    decision: plannerDecision || buildFallbackPlannerDecision({ snapshot, candidateSet: candidateSet || buildAssignmentCandidateSet({ athleteId, sourceDate, snapshot, progress, liveProtocolRegistry, responsivenessProfile: null }) }),
    candidateSet: candidateSet || buildAssignmentCandidateSet({ athleteId, sourceDate, snapshot, progress, liveProtocolRegistry, responsivenessProfile: null }),
    snapshot,
  });
  const selectedCandidate = validatedPlannerDecision.selectedCandidate;
  const plannerOutput = validatedPlannerDecision.decision;
  const actionType =
    plannerOutput.actionType
    || (selectedCandidate?.actionType
      ? selectedCandidate.actionType
      : resolveSnapshotDrivenActionType({
          snapshot,
          hasResolvedExercise: Boolean(activeProgram.recommendedSimId || activeProgram.recommendedLegacyExerciseId),
          fallbackActionType,
        }));

  const now = Date.now();
  const baselineRevision = typeof existing?.revision === 'number' ? existing.revision : 1;
  const draftAssignment = {
    id: assignmentId,
    lineageId: existing?.lineageId || assignmentId,
    revision: baselineRevision,
    athleteId,
    teamId: athleteMembership.teamId,
    teamMembershipId: athleteMembership.id,
    coachId,
    sourceCheckInId,
    sourceStateSnapshotId,
    sourceCandidateSetId,
    sourceDate,
    assignedBy: 'nora',
    status: actionType === 'defer' ? 'deferred' : (existing?.status || 'assigned'),
    actionType,
    chosenCandidateId: selectedCandidate?.id,
    chosenCandidateType: selectedCandidate?.type,
    simSpecId: selectedCandidate?.simSpecId || activeProgram.recommendedSimId,
    legacyExerciseId: selectedCandidate?.legacyExerciseId || activeProgram.recommendedLegacyExerciseId,
    protocolId: selectedCandidate?.protocolId,
    protocolLabel: selectedCandidate?.protocolLabel,
    protocolClass: selectedCandidate?.protocolClass,
    protocolCategory: selectedCandidate?.protocolCategory,
    protocolResponseFamily: selectedCandidate?.protocolResponseFamily,
    protocolDeliveryMode: selectedCandidate?.protocolDeliveryMode,
    sessionType: selectedCandidate?.sessionType || activeProgram.sessionType,
    durationMode: selectedCandidate?.durationMode || activeProgram.durationMode,
    durationSeconds: selectedCandidate?.durationSeconds || activeProgram.durationSeconds,
    rationale: plannerOutput.rationaleSummary || buildSnapshotDrivenRationale({
      snapshot,
      actionType,
      fallbackRationale: activeProgram.rationale,
    }),
    plannerSummary: plannerOutput.rationaleSummary,
    plannerAudit: buildPlannerAudit({
      snapshot,
      candidateSet,
      plannerOutput,
      selectedCandidate,
    }),
    plannerConfidence: plannerOutput.confidence,
    decisionSource: plannerOutput.decisionSource || snapshot?.decisionSource || 'fallback_rules',
    readinessScore,
    readinessBand: toReadinessBand(readinessScore),
    escalationTier: existing?.escalationTier ?? 0,
    supportFlag: plannerOutput.supportFlag ?? existing?.supportFlag ?? snapshot?.supportFlag ?? false,
    programSnapshot: activeProgram,
    coachNotifiedAt: existing?.coachNotifiedAt,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const lineageChanged = assignmentLineageChanged(existing, draftAssignment);
  const nextRevision = existing ? (lineageChanged ? baselineRevision + 1 : baselineRevision) : 1;
  if (existing && lineageChanged) {
    await archiveAssignmentRevision({
      db,
      assignmentRef,
      existing,
      nextRevision,
      now,
    });
  }

  const assignment = {
    ...draftAssignment,
    revision: nextRevision,
    previousRevision: existing && lineageChanged ? baselineRevision : existing?.previousRevision,
    status:
      draftAssignment.actionType === 'defer'
        ? 'deferred'
        : existing && lineageChanged
          ? 'assigned'
          : draftAssignment.status,
    supersededAt: undefined,
    supersededByRevision: undefined,
  };

  await assignmentRef.set(stripUndefinedDeep(assignment), { merge: true });
  await attachExecutionLink(db, sourceStateSnapshotId, assignmentId);
  return assignment;
}

async function rematerializeAssignmentFromSnapshot({
  db,
  athleteId,
  sourceCheckInId,
  sourceStateSnapshotId,
  sourceDate,
  progress,
}) {
  const snapshot =
    (sourceStateSnapshotId ? await getSnapshotById(db, sourceStateSnapshotId) : null) ||
    await getSnapshotById(db, `${athleteId}_${sourceDate}`);

  if (!snapshot) {
    return {
      stateSnapshot: null,
      candidateSet: null,
      plannerDecision: null,
      dailyAssignment: null,
    };
  }

  const liveProtocolRegistry = await listLiveProtocolRegistry(db);
  const responsivenessProfile = await getOrRefreshProtocolResponsivenessProfile({
    db,
    athleteId,
    protocolRegistry: liveProtocolRegistry,
  });
  const candidateSet = buildAssignmentCandidateSet({
    athleteId,
    sourceDate,
    snapshot,
    progress,
    liveProtocolRegistry,
    responsivenessProfile,
  });
  await db.collection(ASSIGNMENT_CANDIDATE_SETS_COLLECTION).doc(candidateSet.id).set(stripUndefinedDeep(candidateSet), { merge: true });

  const plannerDecision = await planAssignmentWithAI({
    snapshot,
    candidateSet,
    progress,
    responsivenessProfile,
  });

  const dailyAssignment = await orchestratePostCheckIn({
    db,
    athleteId,
    sourceCheckInId,
    sourceStateSnapshotId: snapshot.id,
    sourceCandidateSetId: candidateSet.id,
    sourceDate,
    progress,
    candidateSet,
    plannerDecision,
    liveProtocolRegistry,
  });

  return {
    stateSnapshot: dailyAssignment ? { ...snapshot, executionLink: dailyAssignment.id } : snapshot,
    candidateSet,
    plannerDecision,
    dailyAssignment,
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

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();
    const decodedToken = await verifyAuth(event);

    const body = JSON.parse(event.body || '{}');
    const userId = body.userId || decodedToken.uid;
    if (userId !== decodedToken.uid) {
      return {
        statusCode: 403,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ error: 'Authenticated user does not match requested user.' }),
      };
    }

    const readinessScore = Number(body.readinessScore);
    if (!Number.isFinite(readinessScore) || readinessScore < 1 || readinessScore > 5) {
      return {
        statusCode: 400,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ error: 'readinessScore must be a number from 1 to 5.' }),
      };
    }

    const sourceDate = isValidSourceDate(body.sourceDate)
      ? body.sourceDate
      : new Date().toISOString().split('T')[0];

    const now = Date.now();
    const priorProgress = await loadOrInitializeProgress(db, userId);
    const taxonomyState = body.taxonomyState || profileSnapshotRuntime.buildTaxonomyCheckInState({
      readinessScore,
      energyLevel: typeof body.energyLevel === 'number' ? body.energyLevel : undefined,
      stressLevel: typeof body.stressLevel === 'number' ? body.stressLevel : undefined,
      sleepQuality: typeof body.sleepQuality === 'number' ? body.sleepQuality : undefined,
      moodWord: typeof body.moodWord === 'string' ? body.moodWord : undefined,
      priorProfile: priorProgress?.taxonomyProfile,
    });

    const nextCheckIn = {
      userId,
      type: typeof body.type === 'string' && body.type.trim() ? body.type.trim() : 'morning',
      readinessScore,
      moodWord: typeof body.moodWord === 'string' ? body.moodWord : undefined,
      energyLevel: typeof body.energyLevel === 'number' ? body.energyLevel : undefined,
      stressLevel: typeof body.stressLevel === 'number' ? body.stressLevel : undefined,
      sleepQuality: typeof body.sleepQuality === 'number' ? body.sleepQuality : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      taxonomyState,
      createdAt: now,
      date: sourceDate,
    };

    const checkInRef = await db.collection(CHECKINS_ROOT).doc(userId).collection('check-ins').add(nextCheckIn);
    const persistedCheckIn = { id: checkInRef.id, ...nextCheckIn };

    const syncedProgress = await syncTaxonomyProfile(db, userId, priorProgress);
    const rawStateSnapshot = await upsertStateSnapshot({
      db,
      athleteId: userId,
      checkIn: persistedCheckIn,
      progress: syncedProgress,
    });

    const stateSnapshot = await enrichStateSnapshotWithAI({
      snapshot: rawStateSnapshot,
      progress: syncedProgress,
    });
    await db.collection(SNAPSHOTS_COLLECTION).doc(stateSnapshot.id).set(stripUndefinedDeep(stateSnapshot), { merge: true });

    const {
      candidateSet,
      dailyAssignment,
    } = await rematerializeAssignmentFromSnapshot({
      db,
      athleteId: userId,
      sourceCheckInId: persistedCheckIn.id,
      sourceStateSnapshotId: stateSnapshot.id,
      sourceDate,
      progress: syncedProgress,
    });

    await db.collection(PROGRESS_COLLECTION).doc(userId).collection('check-ins').add({
      date: admin.firestore.FieldValue.serverTimestamp(),
      readinessLevel: readinessScore,
      readinessLabel: body.moodWord || '',
    });

    const responseSnapshot = dailyAssignment
      ? { ...stateSnapshot, executionLink: dailyAssignment.id }
      : stateSnapshot;

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        checkIn: persistedCheckIn,
        stateSnapshot: responseSnapshot,
        candidateSet,
        dailyAssignment,
      }),
    };
  } catch (error) {
    console.error('[submit-pulsecheck-checkin] Failed:', error);
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to submit PulseCheck check-in.',
      }),
    };
  }
};

exports.runtimeHelpers = {
  loadOrInitializeProgress,
  syncTaxonomyProfile,
  getSnapshotById,
  listLiveProtocolRegistry,
  getOrRefreshProtocolResponsivenessProfile,
  buildAssignmentCandidateSet,
  planAssignmentWithAI,
  orchestratePostCheckIn,
  rematerializeAssignmentFromSnapshot,
};
