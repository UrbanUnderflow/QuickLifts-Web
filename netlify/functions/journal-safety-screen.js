/**
 * Journal safety screening.
 *
 * Every saved journal entry is screened once with the same classifier Nora chat uses, and Tier 2 and Tier 3
 * results go through the same trusted escalation path as chat (see PulseCheck journal TDD, section 7).
 *
 * Endpoint: POST /.netlify/functions/journal-safety-screen
 * Body: { entryId }
 * Auth: the athlete's own Firebase ID token. The entry text is read from Firestore, never taken from the request,
 * and a finished screening is returned as-is on repeat calls, so an athlete can only ever trigger the one
 * screening of their own entry.
 *
 * Returns: { safety: { status: 'clear' | 'skipped' | 'checkIn' | 'critical', escalationId?, handoff? } }
 */

const { initializeFirebaseAdmin, getFirebaseAdminApp, headers, admin } = require('./config/firebase');
const { runtimeHelpers: chatRuntime } = require('./pulsecheck-chat');
const { runtimeHelpers: escalationRuntime } = require('./pulsecheck-escalation');
const { isTrueCareEscalationClassification } = require('./utils/pulsecheck-pilot-metrics');
const { resolvePulseCheckFcmToken, sendLoggedNoraPush } = require('./pulsecheck-notification-utils');

const JOURNAL_COLLECTION = 'pulsecheck-evidence-journals';
const SAFETY_STATE_COLLECTION = 'pulsecheck-athlete-safety-state';
const CLASSIFIER_VERSION = 'journal-v1';
const MAX_ATTEMPTS = 3;
// Journals are written without Nora in the conversation, so there is no chance to ask a clarifying question.
// A Tier 3 result below this confidence is routed as Tier 2 with same-day clinical review (decision D2).
const TIER_3_CONFIDENCE_FLOOR = 0.85;
const EXCERPT_LIMIT = 280;
const ElevatedRisk = 2;
const CriticalRisk = 3;

const entryRef = (db, userId, entryId) => db.collection(JOURNAL_COLLECTION).doc(userId).collection('entries').doc(entryId);
const screeningRef = (db, userId, entryId) => db.collection(JOURNAL_COLLECTION).doc(userId).collection('screenings').doc(entryId);
const validEntryId = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const TYPE_LABELS = { evidence: 'an evidence entry', gratitude: 'a gratitude entry', freewrite: 'a free write', workout: 'a workout entry', food: 'a food entry', injury: 'an injury recovery entry' };
const SECOND_FIELD_LABELS = { evidence: 'What I did', gratitude: 'Why it mattered', workout: 'How it felt', food: 'Around it', injury: 'What supported my recovery' };

/** The text the classifier sees. The note calibrates for sport language, since journals have no conversation to clarify. */
function classifierMessage(entry) {
  const type = TYPE_LABELS[entry.type] ? entry.type : 'evidence';
  const lines = [
    `[Private journal entry, ${TYPE_LABELS[type]}. The athlete wrote this alone and did not send it to anyone. ` +
      'Sport figures of speech such as "I was killing it" or "I wanted to die after that miss", past struggles the athlete ' +
      'has already come through, song lyrics, quotes, and writing about someone else are common here. Classify the ' +
      'athlete\'s own current risk.]',
    '',
    String(entry.moment || ''),
  ];
  if (entry.action && SECOND_FIELD_LABELS[type]) lines.push('', `${SECOND_FIELD_LABELS[type]}: ${entry.action}`);
  return lines.join('\n');
}

function approvedExcerpt(entry) {
  const text = String(entry.moment || '').trim();
  return text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT - 1)}…` : text;
}

/** Decision R11: screening is on unless every organization the athlete belongs to has turned it off. */
async function screeningDisabledForAthlete(db, userId) {
  const memberships = await db.collection('pulsecheck-team-memberships').where('userId', '==', userId).get();
  const organizationIds = [...new Set((memberships.docs || [])
    .map((doc) => String(doc.data()?.organizationId || '').trim())
    .filter(Boolean))];
  if (!organizationIds.length) return false;
  const organizations = await Promise.all(organizationIds.map((id) => db.collection('pulsecheck-organizations').doc(id).get()));
  return organizations.every((doc) => doc.exists && doc.data()?.journalSafetyScreeningDisabled === true);
}

function handoffWording(outcome) {
  const status = String(outcome?.handoffStatus || '').toLowerCase();
  if (status === 'completed' && outcome?.success !== false) return 'confirmed';
  if (status === 'failed') return 'unavailable';
  return 'inProgress';
}

/** A neutral push so nothing about the entry or the risk shows on a lock screen (R7). */
async function sendNeutralPush({ db, messaging, userId, tier, escalationId }) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const fcmToken = resolvePulseCheckFcmToken(userDoc.exists ? userDoc.data() : {});
    if (!fcmToken || !messaging) return { success: false, error: 'No push target' };
    const critical = tier === CriticalRisk;
    return await sendLoggedNoraPush({
      messaging,
      db,
      userId,
      fcmToken,
      title: 'Nora',
      body: critical ? 'Nora needs to check in with you. Open PulseCheck.' : 'Nora wants to check in with you.',
      data: { type: critical ? 'crisisWall' : 'journalCheckIn', escalationId },
      notificationType: critical ? 'JOURNAL_CRISIS_WALL' : 'JOURNAL_CHECK_IN',
      functionName: 'netlify/journal-safety-screen',
    });
  } catch (error) {
    console.error('[journal-safety-screen] Push failed:', error?.message || error);
    return { success: false, error: error?.message || 'Push failed' };
  }
}

/**
 * Shared by saved-entry screening and the Nora guide: turns a Tier 2 or Tier 3 classification into the same trusted
 * escalation chat uses, keeps a check-in waiting in safety state for Tier 2, and sends a neutral push.
 * Returns { outcome: 'clear' | 'checkIn' | 'critical', escalationId, handoff?, push? }.
 */
async function escalateJournalClassification({ db, userId, messaging, now = Date.now, message, classification, requiresClinicalReview = false, sourceType, sourceRef, excerpt }) {
  const tier = Number(classification.tier) || 0;
  if (tier < ElevatedRisk || !isTrueCareEscalationClassification(classification, message, [])) return { outcome: 'clear', escalationId: null };
  const created = await escalationRuntime.createEscalationFromTrustedRuntime({
    userId,
    conversationId: `${sourceType}-${sourceRef}`,
    sourceType,
    sourceRef,
    tier,
    category: classification.category,
    triggerMessageId: sourceRef,
    triggerContent: excerpt,
    classificationReason: classification.reason,
    classificationConfidence: Number(classification.confidence) || 0,
    disposition: classification.disposition,
    classificationFamily: classification.classificationFamily,
    explanation: classification.explanation,
    severity: classification.severity,
    requiresCoachReview: classification.requiresCoachReview,
    requiresClinicalHandoff: classification.requiresClinicalHandoff,
    dedupeEligible: classification.dedupeEligible,
    sourceTriggerMessageId: sourceRef,
    incident: classification.incident,
  }, db);
  const outcome = chatRuntime.buildTrustedEscalationOutcome(created);
  const result = { escalationId: outcome.escalationRecordId };
  if (tier === CriticalRisk) {
    result.outcome = 'critical';
    result.handoff = handoffWording(outcome);
  } else {
    result.outcome = 'checkIn';
    await db.collection(SAFETY_STATE_COLLECTION).doc(userId).set({
      athleteUserId: userId,
      journalCheckIn: { escalationId: outcome.escalationRecordId, sourceType, sourceRef, createdAt: now() },
    }, { merge: true });
  }
  if (requiresClinicalReview && outcome.escalationRecordId) {
    await db.collection('escalation-records').doc(outcome.escalationRecordId).set({ requiresClinicalReview: true }, { merge: true });
  }
  result.push = (await sendNeutralPush({ db, messaging, userId, tier, escalationId: outcome.escalationRecordId })).success === true;
  return result;
}

function safetyBlockFromScreening(screening) {
  if (!screening || screening.status === 'skipped') return { status: 'skipped' };
  if (screening.outcome === 'critical') return { status: 'critical', escalationId: screening.escalationId || null, handoff: screening.handoff || 'inProgress' };
  if (screening.outcome === 'checkIn') return { status: 'checkIn', escalationId: screening.escalationId || null };
  if (screening.status === 'done') return { status: 'clear' };
  return { status: 'pending' };
}

/**
 * Screens one entry exactly once. Safe to call again: a finished screening is returned unchanged, and a screening
 * another caller is running is left alone unless it has gone stale.
 */
async function screenJournalEntry({ db, userId, entryId, messaging = null, classify = chatRuntime.classifyEscalation, now = Date.now }) {
  const screeningDoc = screeningRef(db, userId, entryId);
  const claim = await db.runTransaction(async (tx) => {
    const [entrySnap, screeningSnap] = await Promise.all([tx.get(entryRef(db, userId, entryId)), tx.get(screeningDoc)]);
    const existing = screeningSnap.exists ? screeningSnap.data() : null;
    if (!entrySnap.exists) {
      tx.set(screeningDoc, { status: 'skipped', reason: 'entry_deleted', screenedAt: now() }, { merge: true });
      return { done: { status: 'skipped' } };
    }
    if (existing?.status === 'done' || existing?.status === 'skipped') return { done: existing };
    const runningFresh = existing?.status === 'running' && now() - Number(existing.claimedAt || 0) < 60_000;
    if (runningFresh) return { done: existing };
    if (Number(existing?.attempts || 0) >= MAX_ATTEMPTS) {
      tx.set(screeningDoc, { status: 'failed', failedAt: now() }, { merge: true });
      return { done: { status: 'failed' } };
    }
    tx.set(screeningDoc, {
      status: 'running',
      attempts: Number(existing?.attempts || 0) + 1,
      claimedAt: now(),
      createdAt: existing?.createdAt || now(),
      classifierVersion: CLASSIFIER_VERSION,
    }, { merge: true });
    return { entry: entrySnap.data() };
  });
  if (claim.done) return claim.done;

  try {
    if (await screeningDisabledForAthlete(db, userId)) {
      const skipped = { status: 'skipped', reason: 'organization_disabled', screenedAt: now() };
      await screeningDoc.set(skipped, { merge: true });
      return skipped;
    }

    const entry = claim.entry;
    const message = classifierMessage(entry);
    const classification = await classify(db, userId, message, [], `journal-${entryId}`);
    if (!classification) throw new Error('Classifier returned no result');

    let tier = Number(classification.tier) || 0;
    const confidence = Number(classification.confidence) || 0;
    let requiresClinicalReview = false;
    if (tier === CriticalRisk && confidence < TIER_3_CONFIDENCE_FLOOR) {
      tier = ElevatedRisk;
      requiresClinicalReview = true;
    }

    const record = {
      status: 'done',
      tier,
      category: classification.category || null,
      confidence,
      requiresClinicalReview,
      screenedAt: now(),
      outcome: 'clear',
      escalationId: null,
    };

    // Decision D4: below Tier 2 a journal only leaves a screening record, so private writing never reaches coaches.
    const escalated = await escalateJournalClassification({
      db, userId, messaging, now, message,
      classification: { ...classification, tier },
      requiresClinicalReview,
      sourceType: 'journal',
      sourceRef: entryId,
      excerpt: approvedExcerpt(entry),
    });
    Object.assign(record, escalated);

    await screeningDoc.set(record, { merge: true });
    return record;
  } catch (error) {
    console.error('[journal-safety-screen] Screening failed:', error?.message || error);
    await screeningDoc.set({ status: 'pending', lastError: String(error?.message || error).slice(0, 300) }, { merge: true });
    return { status: 'pending' };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const request = { headers: event.headers || {} };
    initializeFirebaseAdmin(request);
    const app = getFirebaseAdminApp(request);
    const caller = await chatRuntime.verifyPulseCheckCaller(app, event);
    const { entryId } = JSON.parse(event.body || '{}');
    if (!validEntryId(entryId)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Choose a valid entry.' }) };
    const screening = await screenJournalEntry({
      db: app.firestore(),
      userId: caller.userId,
      entryId: entryId.toLowerCase(),
      messaging: app.messaging ? app.messaging() : admin.messaging(),
    });
    return { statusCode: 200, headers, body: JSON.stringify({ safety: safetyBlockFromScreening(screening) }) };
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return { statusCode, headers, body: JSON.stringify({ error: statusCode === 401 ? 'Sign in is required.' : 'Screening is unavailable right now.' }) };
  }
};

exports.screenJournalEntry = screenJournalEntry;
exports.safetyBlockFromScreening = safetyBlockFromScreening;
exports.escalateJournalClassification = escalateJournalClassification;
exports.classifierMessage = classifierMessage;
exports._private = { classifierMessage, approvedExcerpt, screeningDisabledForAthlete, handoffWording, TIER_3_CONFIDENCE_FLOOR };
