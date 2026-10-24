const { createHash, randomUUID } = require('node:crypto');
const { athleteScope, responderAllowed } = require('./lib/clinical-responder-scope');
// Tier 3 safety routing only. Active athlete/team/org and designated recipient
// scope are rechecked server-side. PulseCheck provides resources; AthleticMind
// pages its configured clinician. Routine requests use the canonical consent route.
// Durable incident/stage claims preserve completed work and expose unknown provider
// outcomes for reconciliation. A page receipt never claims delivered clinical care.

const { admin, getFirebaseAdminApp, headers, initializeFirebaseAdmin } = require('./config/firebase');
const { buildEmailDedupeKey, sendBrevoTransactionalEmail } = require('./utils/sendBrevoTransactionalEmail');
const { sendTwilioSms } = require('./utils/sendTwilioSms');

const CLINICAL_ESCALATIONS_COLLECTION = 'pulsecheck-clinical-escalations';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ATHLETE_SAFETY_STATE_COLLECTION = 'pulsecheck-athlete-safety-state';
const LEGACY_ESCALATION_RECORDS_COLLECTION = 'escalation-records';

const DEFAULT_DEDUPE_WINDOW_SECONDS = 60 * 60;
const DEFAULT_BREVO_SENDER_EMAIL = 'no-reply@fitwithpulse.ai';
const DEFAULT_BREVO_SENDER_NAME = 'Pulse Sports Intelligence';

const RESPONSE_HEADERS = {
  ...headers,
  'Content-Type': 'application/json',
  'Access-Control-Allow-Headers': headers['Access-Control-Allow-Headers'] || 'Content-Type, Authorization, X-PulseCheck-Firebase-Mode',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body),
  };
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nowSeconds() {
  return Math.round(Date.now() / 1000);
}

function dayBucket(unixSec, windowSec) {
  const bucketStart = Math.floor(unixSec / windowSec) * windowSec;
  return new Date(bucketStart * 1000).toISOString().slice(0, 16);
}

function buildDedupeKey(athleteUserId, signalSource, bucket) {
  return `${athleteUserId}|${signalSource}|${bucket}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isAdminClaim(claims) {
  if (!claims) return false;
  return Boolean(claims.admin || claims.adminAccess || claims.role === 'admin');
}

async function requireFirebaseAuth(event, app) {
  const header = event?.headers?.authorization || event?.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) {
    const error = new Error('Missing or malformed Authorization header');
    error.statusCode = 401;
    throw error;
  }
  try {
    return await admin.auth(app).verifyIdToken(header.slice(7).trim(), true);
  } catch (verifyErr) {
    const error = new Error('Invalid Firebase ID token');
    error.statusCode = 401;
    error.cause = verifyErr;
    throw error;
  }
}

async function resolveDesignatedClinician(db, teamId, scope, athleteUserId) {
  const snap = await db
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('teamId', '==', teamId)
    .where('role', '==', 'clinician')
    .where('status', '==', 'active')
    .get();

  const candidates = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const email = normalizeString(data.email || data.workEmail).toLowerCase();
    const userId = normalizeString(data.userId);
    if (!email || !userId || !scope || !responderAllowed(data, scope, athleteUserId, teamId)) continue;
    candidates.push({
      userId,
      membershipId: docSnap.id,
      email,
      phone: normalizeString(data.phone) || null,
      displayName: normalizeString(data.displayName) || null,
      isPrimary: Boolean(data.isPrimaryClinician),
      addedAt: typeof data.addedAt === 'number' ? data.addedAt : Number.MAX_SAFE_INTEGER,
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.addedAt - b.addedAt;
  });
  return candidates[0];
}

function buildClinicianEmail({
  escalationId,
  athleteUserId,
  athleteDisplayName,
  athletePhone,
  teamName,
  evidence,
  detectedAt,
  acknowledgeUrl,
}) {
  const detectedAtIso = new Date(detectedAt * 1000).toISOString();
  const evidenceList = (evidence || [])
    .map(
      (entry) =>
        `<li><strong>${escapeHtml(entry.label)}</strong>${
          entry.excerpt ? `: <em>${escapeHtml(entry.excerpt)}</em>` : ''
        }</li>`,
    )
    .join('\n');

  return {
    subject: `Tier 3 athlete welfare alert — ${teamName}`,
    htmlContent: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111;">
        <p style="background: #ffe9e9; border-left: 4px solid #c00; padding: 12px 16px; margin: 0 0 16px 0;">
          <strong>Tier 3 athlete welfare alert.</strong> Pulse detected a critical-tier signal on an athlete on your team.
          You are receiving this because you are the designated clinician staff member for this team.
        </p>
        <p>Urgent resources include 988, Crisis Text Line (741741), and 911. Sign in to review the current safety and delivery status before responding.</p>
        <p><strong>Athlete:</strong> ${escapeHtml(athleteDisplayName || athleteUserId)}<br/>
        <strong>Athlete phone:</strong> ${
          athletePhone
            ? `<a href="tel:${escapeHtml(athletePhone)}">${escapeHtml(athletePhone)}</a>`
            : 'not on file'
        }<br/>
        <strong>Team:</strong> ${escapeHtml(teamName)}<br/>
        <strong>Detected at:</strong> ${escapeHtml(detectedAtIso)}<br/>
        <strong>Escalation id:</strong> ${escapeHtml(escalationId)}</p>
        <p><strong>Signal evidence:</strong></p>
        <ul>${evidenceList}</ul>
        <p style="margin-top: 24px;">
          <a href="${escapeHtml(acknowledgeUrl)}" style="display: inline-block; background: #111; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none;">
            Acknowledge that you have received this and are responding
          </a>
        </p>
        <p style="color: #666; font-size: 12px; margin-top: 24px;">
          Pulse is not a clinical service and is not initiating contact with 988 or any emergency line on the athlete's behalf.
          The athlete has been prompted to call 988 themselves; this notification gives you the chance to apply clinical judgment
          and reach out to the athlete or the athlete's emergency contact directly. If the athlete is in immediate danger,
          please initiate appropriate emergency response per your standing protocol.
        </p>
      </div>
    `.trim(),
  };
}

function buildClinicianSms({
  athleteDisplayName,
  athleteUserId,
  athletePhone,
  teamName,
  acknowledgeUrl,
}) {
  return [
    'PULSE TIER 3 ALERT.',
    `Athlete ${athleteDisplayName || athleteUserId} on ${teamName} flagged.${athletePhone ? ` Reach them at ${athletePhone}.` : ''} Athlete prompted to call 988.`,
    'Apply clinical judgment per your protocol. Acknowledge:',
    acknowledgeUrl,
  ].join(' ');
}

async function setAthleteCrisisWall(db, athleteUserId, teamId, escalationId, reason) {
  await db.collection(ATHLETE_SAFETY_STATE_COLLECTION).doc(athleteUserId).set(
    {
      athleteUserId,
      teamId,
      crisisWallActive: true,
      crisisWallActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      crisisWallActiveEscalationId: escalationId,
      crisisWallReason: reason,
    },
    { merge: true },
  );
}

function getSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || '').replace(/\/+$/, '');
  return raw || 'https://fitwithpulse.ai';
}

function buildAcknowledgeUrl(escalationId) {
  return `${getSiteUrl()}/staff/clinical-escalations?ack=${encodeURIComponent(escalationId)}`;
}

// A durable incident claim serializes all workers. An interrupted outbound stage is
// unknown, never silently resent: providers without idempotency cannot guarantee exactly once.
async function runIncident({ db, decoded, body, email = sendBrevoTransactionalEmail, sms = sendTwilioSms, now = nowSeconds, resumeId = null }) {
  if ((await db.collection('account-closure-jobs').doc(decoded.uid).get()).exists) return json(403, { error: 'Account closure is in progress.' });
  const athleteUserId = normalizeString(body.athleteUserId);
  const teamId = normalizeString(body.teamId);
  const signalSource = normalizeString(body.signalSource);
  if (!athleteUserId || !teamId || !signalSource || [athleteUserId, teamId].some(id => id.length > 240 || id.includes('/')) || signalSource.length > 100) return json(400, { error: 'Athlete, team and signal source are required.' });
  if (Number(body.tier) !== 3) return json(400, { error: 'This endpoint handles urgent Tier 3 safety only. Routine support requires the consent-based handoff.', code: 'ROUTINE_CONSENT_ROUTE_REQUIRED' });
  if (decoded.uid !== athleteUserId && !isAdminClaim(decoded)) return json(403, { error: 'You may only record your own safety event.' });
  const scope = await athleteScope(db, athleteUserId, teamId);
  if (body.organizationId && body.organizationId !== scope.organizationId) return json(403, { error: 'Organization does not match current membership.' });
  // A program may temporarily use athlete-initiated 988 while clinical coverage is prepared.
  const hotlineOnly = scope.organization.productBrand === 'pulsecheck' || scope.team.defaultEscalationRoute === 'hotline';
  const clinician = hotlineOnly ? null : await resolveDesignatedClinician(db, teamId, scope, athleteUserId);
  if (!hotlineOnly && !clinician) return json(409, { error: 'No active designated clinician covers this athlete.' });
  const detectedAt = Number.isFinite(Number(body.detectedAt)) ? Number(body.detectedAt) : now();
  if (!resumeId && Math.abs(detectedAt - now()) > 86400) return json(400, { error: 'Safety event time must be within the last day.' });
  // A server-fixed window prevents clients disabling dedupe; team is part of identity.
  const dedupeKey = buildDedupeKey(athleteUserId, `${teamId}|${signalSource}`, dayBucket(detectedAt, DEFAULT_DEDUPE_WINDOW_SECONDS));
  const legacyKey = buildDedupeKey(athleteUserId, signalSource, dayBucket(detectedAt, DEFAULT_DEDUPE_WINDOW_SECONDS));
  const legacy = await db.collection(CLINICAL_ESCALATIONS_COLLECTION).where('athleteUserId', '==', athleteUserId).where('dedupeKey', '==', legacyKey).limit(10).get();
  const legacyRecord = legacy.docs.find(doc => doc.data().teamId === teamId);
  const id = resumeId || legacyRecord?.id || createHash('sha256').update(dedupeKey).digest('hex');
  const ref = db.collection(CLINICAL_ESCALATIONS_COLLECTION).doc(id);
  const worker = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const previous = snap.exists ? snap.data() : null;
    if ((await tx.get(db.collection('account-closure-jobs').doc(decoded.uid))).exists) throw Object.assign(new Error('Account closure is in progress.'), { statusCode: 403 });
    const currentScope = await athleteScope(db, athleteUserId, teamId, ref => tx.get(ref));
    if (currentScope.organizationId !== scope.organizationId || currentScope.organization.productBrand !== scope.organization.productBrand || currentScope.team.defaultEscalationRoute !== scope.team.defaultEscalationRoute) throw Object.assign(new Error('Program scope changed.'), { statusCode: 409 });
    if (clinician) {
      const currentResponder = await tx.get(db.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(clinician.membershipId));
      if (!currentResponder.exists || !responderAllowed(currentResponder.data(), currentScope, athleteUserId, teamId)) throw Object.assign(new Error('Responder access changed.'), { statusCode: 403 });
    }
    if (resumeId && !previous) throw Object.assign(new Error('Incident unavailable.'), { statusCode: 404 });
    if (previous?.leaseUntil > now()) return { busy: true, record: previous };
    if (previous && (previous.supportRoute !== (hotlineOnly ? 'hotline' : 'clinician') || previous.pagedClinicianMembershipId !== (clinician?.membershipId || null))) {
      return { conflict: true, record: previous }; // Program/recipient change never reroutes an existing incident.
    }
    const record = previous || { athleteUserId, teamId, organizationId: scope.organizationId,
      productBrand: scope.organization.productBrand, supportRoute: hotlineOnly ? 'hotline' : 'clinician',
      tier: 3, signalSource, detectedAt, recordedAt: admin.firestore.FieldValue.serverTimestamp(),
      triggeredBySource: decoded.uid, dedupeKey, pagedClinicianMembershipId: clinician?.membershipId || null,
      pagedClinicianUserId: clinician?.userId || null, deliveryStatus: 'pending', stages: {} };
    tx.set(ref, { ...record, worker, leaseUntil: now() + 300 });
    return { record, created: !previous };
  });
  if (claim.busy) return json(202, { success: false, recorded: true, escalationId: id, deliveryStatus: 'pending', retryable: true });
  if (claim.conflict) return json(409, { success: false, recorded: true, escalationId: id, error: 'Incident route changed. Authorized reconciliation is required.' });
  let record = claim.record;
  const stages = { ...(record.stages || {}) };
  if (!record.stages && !claim.created && !hotlineOnly) {
    // Old rows predate durable stages. Known successful sends are retained;
    // an absent receipt is ambiguous and must never be automatically resent.
    for (const [name, result] of [['email', record.emailDelivery], ['sms', record.smsDelivery]]) {
      stages[name] = { status: result?.success ? 'complete' : result?.skipped && name === 'sms' && !clinician.phone ? 'not_applicable' : 'unknown', providerId: result?.messageId || result?.messageSid || null };
    }
  }
  const save = async patch => {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.worker !== worker) throw new Error('Incident lease changed; retry current state.');
      const existing = snap.data();
      const next = { ...patch };
      if (next.deliveryStatus && ['clinician_acknowledged', 'resolved'].includes(existing.deliveryStatus)) next.deliveryStatus = existing.deliveryStatus;
      tx.set(ref, next, { merge: true });
    });
  };
  const stage = async (name, action, outbound = false) => {
    if (stages[name]?.status === 'complete' || stages[name]?.status === 'not_applicable') return;
    if (outbound && ['sending', 'unknown'].includes(stages[name]?.status)) {
      stages[name] = { ...stages[name], status: 'unknown' };
      await save({ stages }); return;
    }
    stages[name] = { status: outbound ? 'sending' : 'pending', attemptedAt: now() };
    await save({ stages });
    let result;
    try { result = await action(); } catch { result = { success: false, outcomeUnknown: outbound, error: 'Stage could not be confirmed.' }; }
    if (outbound && result?.success && !result.messageId && !result.messageSid) result = { outcomeUnknown: true };
    stages[name] = { status: result?.success ? 'complete' : result?.outcomeUnknown ? 'unknown' : result?.notApplicable ? 'not_applicable' : 'failed',
      attemptedAt: now(), providerId: result?.messageId || result?.messageSid || null };
    await save({ stages });
  };
  try {
    await stage('safety', async () => { await setAthleteCrisisWall(db, athleteUserId, teamId, id, signalSource); return { success: true }; });
    if (!hotlineOnly) {
      // Revalidate current tenant/responder authorization immediately before disclosure.
      const freshScope = await athleteScope(db, athleteUserId, teamId);
      const fresh = await db.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(clinician.membershipId).get();
      if (freshScope.organization.productBrand === 'pulsecheck' || freshScope.team.defaultEscalationRoute === 'hotline'
        || !fresh.exists || !responderAllowed(fresh.data(), freshScope, athleteUserId, teamId)
        || normalizeString(fresh.data().email || fresh.data().workEmail).toLowerCase() !== clinician.email
        || (normalizeString(fresh.data().phone) || null) !== clinician.phone) throw Object.assign(new Error('Responder access changed.'), { statusCode: 403 });
      const acknowledgeUrl = buildAcknowledgeUrl(id);
      const emailCopy = buildClinicianEmail({ escalationId: id, athleteUserId, athleteDisplayName: null,
        athletePhone: null, teamName: scope.team.displayName || 'Your team', evidence: [], detectedAt, acknowledgeUrl });
      await stage('email', () => email({ toEmail: clinician.email, subject: emailCopy.subject, htmlContent: emailCopy.htmlContent,
        sender: { email: process.env.BREVO_SENDER_EMAIL || DEFAULT_BREVO_SENDER_EMAIL, name: DEFAULT_BREVO_SENDER_NAME },
        idempotencyKey: buildEmailDedupeKey(['clinical-escalation-v2', id, clinician.membershipId]), bypassDailyRecipientLimit: true }), true);
      await stage('sms', () => clinician.phone ? sms({ to: clinician.phone, body: `PULSE urgent safety alert. Sign in to review and acknowledge: ${acknowledgeUrl}` }) : Promise.resolve({ notApplicable: true }), true);
      // Mirror a minimal pointer only. No raw excerpts/consent summaries enter the legacy dashboard.
      await stage('mirror', async () => { await db.collection(LEGACY_ESCALATION_RECORDS_COLLECTION).doc(`clinical-${id}`).set({
        escalationId: id, userId: athleteUserId, athleteUserId, teamId, organizationId: scope.organizationId,
        productBrand: record.productBrand, supportRoute: record.supportRoute, tier: 3,
        classificationFamily: 'critical_safety', status: 'active', sourceType: 'clinical-responder',
      }, { merge: true }); return { success: true }; });
    }
    const paged = stages.email?.status === 'complete' || stages.sms?.status === 'complete';
    const attention = Object.values(stages).some(stage => ['failed', 'unknown', 'sending'].includes(stage.status));
    const complete = stages.safety?.status === 'complete' && (hotlineOnly || paged) && !attention;
    const deliveryStatus = record.acknowledgedAt ? 'clinician_acknowledged' : hotlineOnly ? (complete ? 'not_applicable' : 'failed') : paged ? 'clinician_paged' : 'failed';
    await save({ stages, deliveryStatus, deliveryNeedsAttention: attention, leaseUntil: 0, worker: null });
    return json(complete ? 200 : 502, { success: complete, recorded: !!claim.created, escalationId: id,
      record: { id, athleteUserId, teamId, organizationId: scope.organizationId, tier: 3, signalSource, detectedAt, deliveryStatus, evidence: [] },
      supportRoute: record.supportRoute, deliveryStatus, deliveryNeedsAttention: attention,
      stageStatus: Object.fromEntries(Object.entries(stages).map(([key, value]) => [key, value.status])),
      crisisWallActivated: stages.safety?.status === 'complete', providerConfirmed: false,
      ...(hotlineOnly ? { hotlineResource: { name: '988 Suicide & Crisis Lifeline', phone: '988', url: 'https://988lifeline.org' } } : {}),
      ...(!complete ? { error: 'Some safety delivery steps remain unconfirmed. Review status before retrying or using your backup protocol.' } : {}) });
  } finally {
    await save({ leaseUntil: 0, worker: null }).catch(() => {});
  }
}
exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const app = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(app);
    const decoded = await requireFirebaseAuth(event, app);
    return await runIncident({ db, decoded, body: JSON.parse(event.body || '{}') });
  } catch (error) {
    return json(error.statusCode || 500, { success: false, error: error.statusCode ? error.message : 'Safety event could not be confirmed. Retry or follow your backup protocol.' });
  }
};

exports._private = {
  runIncident,
  buildDedupeKey,
  dayBucket,
  buildClinicianEmail,
  buildClinicianSms,
  resolveDesignatedClinician,
  isAdminClaim,
  normalizeString,
};
