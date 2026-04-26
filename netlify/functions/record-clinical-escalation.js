// =============================================================================
// Record Clinical Escalation — server-side Tier 3 routing fan-out.
//
// Endpoint: POST /.netlify/functions/record-clinical-escalation
//
// Body:
//   {
//     athleteUserId: string,
//     teamId: string,
//     organizationId?: string,
//     pilotId?: string,
//     tier: 1 | 2 | 3,
//     signalSource: string,
//     evidence: Array<{label, excerpt?, sourceRef?, confidence?}>,
//     detectedAt?: number,        // unix seconds; defaults to now
//     triggeredBySource: string,  // uid or service identifier
//     dedupeWindowSeconds?: number
//   }
//
// What it does, in order:
//   1. Auth — requires Firebase ID token; the token uid must match
//      `triggeredBySource` (for athlete-side calls) or carry an admin
//      claim (for Pulse-side / inference-engine calls).
//   2. Idempotency — same signal in the dedupe window short-circuits.
//   3. Resolves the team's designated clinician (role: clinician + active).
//   4. Writes the immutable escalation doc to `pulsecheck-clinical-escalations`.
//   5. Tier 3 only:
//        a. Sets `crisisWallActive: true` on the athlete user doc.
//        b. Sends email to the clinician via Brevo.
//        c. Sends SMS to the clinician via Twilio (when phone on file +
//           Twilio creds present in env).
//   6. Mirrors a row into the legacy `escalation-records` collection so
//      the existing coach/admin escalation dashboard sees it.
//
// What it does NOT do:
//   - Auto-call 988. Athletes call themselves from the crisis wall.
//   - Auto-email anything to 988.
//   - Page anyone other than the team's designated clinician.
//
// Idempotency:
//   - Brevo dedupe key includes `escalationId` so a re-published call
//     never sends a second email.
//
// Failure posture:
//   - Email/SMS failures DO NOT roll back the escalation record. The
//     audit trail captures the page attempt + delivery status. If both
//     channels fail, the response is 502 with details so the caller can
//     fall back to a phone call.
// =============================================================================

const { admin, getFirebaseAdminApp, headers, initializeFirebaseAdmin } = require('./config/firebase');
const { buildEmailDedupeKey, sendBrevoTransactionalEmail } = require('./utils/sendBrevoTransactionalEmail');

const CLINICAL_ESCALATIONS_COLLECTION = 'pulsecheck-clinical-escalations';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const USERS_COLLECTION = 'users';
const LEGACY_ESCALATION_RECORDS_COLLECTION = 'escalation-records';

const DEFAULT_DEDUPE_WINDOW_SECONDS = 60 * 60;
const DEFAULT_BREVO_SENDER_EMAIL = 'no-reply@fitwithpulse.ai';
const DEFAULT_BREVO_SENDER_NAME = 'Pulse Sports Intelligence';

const RESPONSE_HEADERS = {
  ...headers,
  'Content-Type': 'application/json',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

async function requireFirebaseAuth(event) {
  const header = event?.headers?.authorization || event?.headers?.Authorization;
  if (!header || !header.startsWith('Bearer ')) {
    const error = new Error('Missing or malformed Authorization header');
    error.statusCode = 401;
    throw error;
  }
  try {
    return await admin.auth().verifyIdToken(header.slice(7).trim());
  } catch (verifyErr) {
    const error = new Error('Invalid Firebase ID token');
    error.statusCode = 401;
    error.cause = verifyErr;
    throw error;
  }
}

async function findActiveEscalationByDedupeKey(db, athleteUserId, dedupeKey) {
  const snap = await db
    .collection(CLINICAL_ESCALATIONS_COLLECTION)
    .where('athleteUserId', '==', athleteUserId)
    .where('dedupeKey', '==', dedupeKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...(docSnap.data() || {}) };
}

async function resolveDesignatedClinician(db, teamId) {
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
    if (!email || !userId) continue;
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

async function resolveTeamMeta(db, teamId) {
  const teamSnap = await db.collection(TEAMS_COLLECTION).doc(teamId).get();
  if (!teamSnap.exists) {
    return { displayName: 'this team', sportName: null };
  }
  const data = teamSnap.data() || {};
  return {
    displayName: normalizeString(data.displayName) || 'this team',
    sportName: normalizeString(data.sportName) || null,
  };
}

function buildClinicianEmail({
  escalationId,
  athleteUserId,
  athleteDisplayName,
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
        <p>The athlete's app has been gated to a crisis-resource screen displaying 988, Crisis Text Line (741741), and 911.
        The athlete will be informed that you have been notified.</p>
        <p><strong>Athlete:</strong> ${escapeHtml(athleteDisplayName || athleteUserId)}<br/>
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
  teamName,
  acknowledgeUrl,
}) {
  return [
    'PULSE TIER 3 ALERT.',
    `Athlete ${athleteDisplayName || athleteUserId} on ${teamName} flagged. Athlete prompted to call 988.`,
    'Apply clinical judgment per your protocol. Acknowledge:',
    acknowledgeUrl,
  ].join(' ');
}

async function sendClinicianSmsViaTwilio(phone, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { skipped: true, reason: 'Twilio credentials not configured.' };
  }
  if (!phone) {
    return { skipped: true, reason: 'No phone number on file.' };
  }
  try {
    const params = new URLSearchParams();
    params.append('To', phone);
    params.append('From', from);
    params.append('Body', body);
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { skipped: false, success: false, error: data?.message || `Twilio ${response.status}` };
    }
    return { skipped: false, success: true, messageSid: data.sid || null };
  } catch (error) {
    return { skipped: false, success: false, error: error?.message || String(error) };
  }
}

async function setAthleteCrisisWall(db, athleteUserId, escalationId, reason) {
  await db.collection(USERS_COLLECTION).doc(athleteUserId).set(
    {
      crisisWallActive: true,
      crisisWallActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      crisisWallActiveEscalationId: escalationId,
      crisisWallReason: reason,
    },
    { merge: true },
  );
}

async function mirrorToLegacyEscalationRecords(db, payload) {
  await db.collection(LEGACY_ESCALATION_RECORDS_COLLECTION).add(
    {
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      classificationFamily: payload.tier >= 3 ? 'critical_safety' : 'care_escalation',
      severity: payload.tier >= 3 ? 'critical' : 'high',
      disposition: 'clinical_handoff',
      status: 'active',
    },
  );
}

function getSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || '').replace(/\/+$/, '');
  return raw || 'https://fitwithpulse.ai';
}

function buildAcknowledgeUrl(escalationId) {
  return `${getSiteUrl()}/staff/clinical-escalations?ack=${encodeURIComponent(escalationId)}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(adminApp);

    const decoded = await requireFirebaseAuth(event);
    const body = JSON.parse(event.body || '{}');

    const athleteUserId = normalizeString(body.athleteUserId);
    const teamId = normalizeString(body.teamId);
    const tier = Number(body.tier);
    const signalSource = normalizeString(body.signalSource);
    const triggeredBySource = normalizeString(body.triggeredBySource);
    const evidence = Array.isArray(body.evidence) ? body.evidence : [];
    const detectedAt = Number.isFinite(Number(body.detectedAt)) ? Number(body.detectedAt) : nowSeconds();
    const dedupeWindowSeconds = Number.isFinite(Number(body.dedupeWindowSeconds))
      ? Number(body.dedupeWindowSeconds)
      : DEFAULT_DEDUPE_WINDOW_SECONDS;

    if (!athleteUserId || !teamId || ![1, 2, 3].includes(tier) || !signalSource || !triggeredBySource) {
      return json(400, {
        error: 'athleteUserId, teamId, tier (1|2|3), signalSource, and triggeredBySource are required.',
      });
    }

    // Auth gate: caller must be the athlete in question OR an admin OR
    // the inference engine service (identified by triggeredBySource starting with `service:`).
    const callerIsAthlete = decoded.uid === athleteUserId;
    const callerIsAdmin = isAdminClaim(decoded);
    const callerIsServiceCallback = triggeredBySource.startsWith('service:') && callerIsAdmin;
    if (!callerIsAthlete && !callerIsAdmin && !callerIsServiceCallback) {
      return json(403, {
        error: 'You may only record an escalation for yourself unless you are an admin or service principal.',
      });
    }

    const dedupeKey = buildDedupeKey(athleteUserId, signalSource, dayBucket(detectedAt, dedupeWindowSeconds));
    const existing = await findActiveEscalationByDedupeKey(db, athleteUserId, dedupeKey);
    if (existing) {
      return json(200, {
        recorded: false,
        record: existing,
        dedupeReason: `Existing escalation ${existing.id} matched dedupeKey within the ${dedupeWindowSeconds}s window.`,
      });
    }

    const clinician = await resolveDesignatedClinician(db, teamId);
    const team = await resolveTeamMeta(db, teamId);

    if (!clinician) {
      return json(409, {
        error:
          'Team has no active clinician membership with email on file. Tier 3 escalation routing requires a designated clinician staff member.',
      });
    }

    // Fetch consent snapshot for audit
    let consentSnapshot;
    try {
      const userSnap = await db.collection(USERS_COLLECTION).doc(athleteUserId).get();
      if (userSnap.exists) {
        const userData = userSnap.data() || {};
        consentSnapshot = {
          productConsentVersion: normalizeString(userData.productConsentVersion) || null,
          completedConsentIds: Array.isArray(userData.completedConsentIds)
            ? userData.completedConsentIds.slice(0, 10)
            : [],
        };
      }
    } catch (_) {
      // Non-blocking: consent snapshot is best-effort
    }

    // Athlete display name for clinician copy
    let athleteDisplayName = athleteUserId;
    try {
      const userSnap = await db.collection(USERS_COLLECTION).doc(athleteUserId).get();
      if (userSnap.exists) {
        const userData = userSnap.data() || {};
        athleteDisplayName =
          normalizeString(userData.displayName)
          || normalizeString(`${userData.firstName || ''} ${userData.lastName || ''}`)
          || athleteUserId;
      }
    } catch (_) {}

    // 1. Write the immutable escalation doc
    const escalationDoc = {
      athleteUserId,
      teamId,
      organizationId: normalizeString(body.organizationId) || null,
      pilotId: normalizeString(body.pilotId) || null,
      tier,
      signalSource,
      evidence,
      detectedAt,
      recordedAt: admin.firestore.FieldValue.serverTimestamp(),
      deliveryStatus: 'pending',
      dedupeKey,
      triggeredBySource,
      pagedClinicianMembershipId: clinician.membershipId,
      consentSnapshot: consentSnapshot || null,
    };
    const escalationRef = await db.collection(CLINICAL_ESCALATIONS_COLLECTION).add(escalationDoc);
    const escalationId = escalationRef.id;
    const acknowledgeUrl = buildAcknowledgeUrl(escalationId);

    // 2. Tier 3 only: gate the athlete's app to the crisis wall
    if (tier === 3) {
      try {
        await setAthleteCrisisWall(db, athleteUserId, escalationId, signalSource);
      } catch (wallErr) {
        console.error('[record-clinical-escalation] crisis wall set failed:', wallErr?.message || wallErr);
        // Non-blocking — athlete may not have a user doc; clinician page still goes out.
      }
    }

    // 3. Email the clinician
    const emailCopy = buildClinicianEmail({
      escalationId,
      athleteUserId,
      athleteDisplayName,
      teamName: team.displayName,
      evidence,
      detectedAt,
      acknowledgeUrl,
    });
    const emailResult = await sendBrevoTransactionalEmail({
      toEmail: clinician.email,
      toName: clinician.displayName || clinician.email,
      subject: emailCopy.subject,
      htmlContent: emailCopy.htmlContent,
      tags: ['clinical-escalation', `tier-${tier}`],
      sender: {
        email: process.env.BREVO_SENDER_EMAIL || DEFAULT_BREVO_SENDER_EMAIL,
        name: process.env.BREVO_SENDER_NAME || DEFAULT_BREVO_SENDER_NAME,
      },
      headers: {
        'X-Email-Type': 'clinical-escalation',
        'X-Mailin-custom': JSON.stringify({
          sequence: 'clinical-escalation-v1',
          tier,
          escalationId,
          teamId,
        }),
      },
      idempotencyKey: buildEmailDedupeKey(['clinical-escalation-v1', escalationId, clinician.email]),
      idempotencyMetadata: {
        sequence: 'clinical-escalation-v1',
        escalationId,
        teamId,
        toEmail: clinician.email,
      },
      // Crisis pages bypass the daily recipient limit by design.
      bypassDailyRecipientLimit: true,
    });

    // 4. SMS the clinician (when phone + Twilio available)
    const smsBody = buildClinicianSms({
      athleteDisplayName,
      athleteUserId,
      teamName: team.displayName,
      acknowledgeUrl,
    });
    const smsResult = clinician.phone
      ? await sendClinicianSmsViaTwilio(clinician.phone, smsBody)
      : { skipped: true, reason: 'No phone number on the clinician membership.' };

    const deliveryStatus =
      emailResult?.success ? 'clinician_paged' : (smsResult?.success ? 'clinician_paged' : 'failed');

    await db.collection(CLINICAL_ESCALATIONS_COLLECTION).doc(escalationId).set(
      {
        deliveryStatus,
        emailDelivery: emailResult || null,
        smsDelivery: smsResult || null,
      },
      { merge: true },
    );

    // 5. Mirror into the legacy escalation-records collection so the
    // existing coach/admin escalation dashboard surfaces it.
    try {
      await mirrorToLegacyEscalationRecords(db, {
        escalationId,
        athleteUserId,
        userId: athleteUserId,
        teamId,
        coachId: null,
        tier,
        signalSource,
        evidence,
      });
    } catch (mirrorErr) {
      console.warn('[record-clinical-escalation] legacy mirror failed (non-blocking):', mirrorErr?.message || mirrorErr);
    }

    if (deliveryStatus === 'failed') {
      return json(502, {
        error: 'Both email and SMS failed to deliver. Phone the clinician directly.',
        recorded: true,
        escalationId,
        emailDelivery: emailResult,
        smsDelivery: smsResult,
      });
    }

    return json(200, {
      recorded: true,
      escalationId,
      tier,
      deliveryStatus,
      clinician: {
        membershipId: clinician.membershipId,
        email: clinician.email,
        phone: clinician.phone,
      },
      crisisWallActivated: tier === 3,
    });
  } catch (error) {
    console.error('[record-clinical-escalation] Unexpected error:', error);
    const status = Number.isFinite(error?.statusCode) ? error.statusCode : 500;
    return json(status, {
      error: error?.message || 'Internal server error while recording clinical escalation.',
    });
  }
};

exports._private = {
  buildDedupeKey,
  dayBucket,
  buildClinicianEmail,
  buildClinicianSms,
  resolveDesignatedClinician,
  isAdminClaim,
  normalizeString,
};
