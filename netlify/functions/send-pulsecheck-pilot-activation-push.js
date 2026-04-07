const { admin, headers, initializeFirebaseAdmin } = require('./config/firebase');
const {
  resolvePulseCheckPushTarget,
  sendLoggedNoraPush,
} = require('./pulsecheck-notification-utils');

const OUTREACH_COLLECTION = 'pulsecheck-pilot-athlete-communications';
const OUTREACH_CHANNEL = 'push';
const DEFAULT_OPEN_APP_URL = 'pulsecheck://open';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildOutreachDocId(pilotId, athleteId, channel) {
  return `${pilotId || 'unknown-pilot'}__${athleteId || 'unknown-athlete'}__${channel}`;
}

function buildPushTitle({ teamName, organizationName, pilotName }) {
  const baseLabel = normalizeString(teamName) || normalizeString(organizationName) || normalizeString(pilotName) || 'PulseCheck';
  return /\bpilot\b/i.test(baseLabel) ? baseLabel : `${baseLabel} Pilot`;
}

function buildPushBody(enrollmentStatus) {
  return normalizeString(enrollmentStatus) === 'active'
    ? 'Your PulseCheck app is ready! Open the app and you should be good to go.'
    : 'Your PulseCheck app is ready! Open the app, complete consent, and you should be good to go.';
}

function buildPushStatusRecord(docId, data) {
  if (!data) return null;
  return {
    id: docId,
    channel: OUTREACH_CHANNEL,
    status: normalizeString(data.status) || 'not-sent',
    messageId: normalizeString(data.messageId) || null,
    sentAt: data.sentAt || null,
    deliveredAt: data.deliveredAt || null,
    openedAt: data.openedAt || null,
    updatedAt: data.updatedAt || null,
    lastError: normalizeString(data.lastError) || null,
    preview: data.preview || null,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();
    const body = event.body ? JSON.parse(event.body) : {};
    const athleteId = normalizeString(body.athleteId) || normalizeString(body.userId);
    const pilotId = normalizeString(body.pilotId);
    const teamName = normalizeString(body.teamName);
    const organizationName = normalizeString(body.organizationName);
    const pilotName = normalizeString(body.pilotName);
    const athleteName = normalizeString(body.athleteName);
    const athleteEmail = normalizeString(body.athleteEmail);
    const enrollmentStatus = normalizeString(body.enrollmentStatus);
    const openAppUrl = normalizeString(body.openAppUrl) || DEFAULT_OPEN_APP_URL;
    const previewOnly = body.previewOnly === true;

    if (!athleteId) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing athlete id' }),
      };
    }

    const outreachDocRef = db.collection(OUTREACH_COLLECTION).doc(buildOutreachDocId(pilotId, athleteId, OUTREACH_CHANNEL));
    const outreachSnap = await outreachDocRef.get();
    const existingOutreach = buildPushStatusRecord(outreachDocRef.id, outreachSnap.exists ? outreachSnap.data() : null);

    const preview = {
      channel: OUTREACH_CHANNEL,
      title: buildPushTitle({ teamName, organizationName, pilotName }),
      subtitle: 'Open the app to continue',
      body: buildPushBody(enrollmentStatus),
      ctaLabel: 'Open Pulse Check App',
      ctaUrl: openAppUrl,
    };

    if (previewOnly) {
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          preview,
          outreach: existingOutreach,
        }),
      };
    }

    const userDoc = await db.collection('users').doc(athleteId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'User not found' }),
      };
    }

    const userData = userDoc.data() || {};
    const pushTarget = resolvePulseCheckPushTarget(userData);
    if (!pushTarget.eligible || !pushTarget.token) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `Selected user is not eligible for a PulseCheck push (${pushTarget.reason})`,
        }),
      };
    }

    const sendResult = await sendLoggedNoraPush({
      messaging: admin.messaging(),
      db,
      userId: athleteId,
      fcmToken: pushTarget.token,
      title: preview.title,
      body: preview.body,
      subtitle: preview.subtitle,
      data: {
        type: 'PULSECHECK_PILOT_READY',
        route: 'app_home',
        deepLinkUrl: openAppUrl,
        pilotId,
        athleteId,
        channel: OUTREACH_CHANNEL,
        outreachDocId: outreachDocRef.id,
      },
      notificationType: 'PULSECHECK_PILOT_READY',
      functionName: 'netlify/send-pulsecheck-pilot-activation-push',
      additionalContext: {
        productScope: 'pulsecheck',
        sourceApp: 'pulsecheck',
        athleteId,
        athleteName: athleteName || userData.displayName || '',
        email: athleteEmail || userData.email || '',
        pilotId,
        teamName,
        organizationName,
      },
    });

    if (!sendResult.success) {
      await outreachDocRef.set(
        {
          pilotId: pilotId || null,
          athleteId,
          athleteName: athleteName || userData.displayName || '',
          athleteEmail: athleteEmail || userData.email || '',
          channel: OUTREACH_CHANNEL,
          status: 'failed',
          lastError: sendResult.error || 'Failed to send push',
          preview,
          updatedAt: new Date(),
          createdAt: outreachSnap.exists ? (outreachSnap.data() || {}).createdAt || new Date() : new Date(),
        },
        { merge: true }
      );

      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: sendResult.error || 'Failed to send push' }),
      };
    }

    await outreachDocRef.set(
      {
        pilotId: pilotId || null,
        athleteId,
        athleteName: athleteName || userData.displayName || '',
        athleteEmail: athleteEmail || userData.email || '',
        channel: OUTREACH_CHANNEL,
        status: 'sent',
        messageId: sendResult.messageId || null,
        logId: sendResult.logId || null,
        sentAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
        preview,
        createdAt: outreachSnap.exists ? (outreachSnap.data() || {}).createdAt || new Date() : new Date(),
      },
      { merge: true }
    );

    const nextOutreachSnap = await outreachDocRef.get();
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        messageId: sendResult.messageId || null,
        preview,
        outreach: buildPushStatusRecord(outreachDocRef.id, nextOutreachSnap.exists ? nextOutreachSnap.data() : null),
      }),
    };
  } catch (error) {
    console.error('[send-pulsecheck-pilot-activation-push] Error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error while sending push.',
      }),
    };
  }
};
