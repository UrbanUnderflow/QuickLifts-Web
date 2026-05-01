const crypto = require('crypto');
const { db, admin } = require('./config/firebase');

const NOTIFICATION_LOGS_COLLECTION = 'notification-logs';
const NOTIFICATION_DEDUPE_COLLECTION = 'notification-dedupe';
const FALLBACK_DEDUPE_WINDOW_SECONDS = 10 * 60;
const LIVE_USER_TOKEN_NOTIFICATION_TYPES = new Set([
  'run_round_session_started',
  'run_round_session_completed',
]);
const DEDUPED_NOTIFICATION_TYPES = new Set([
  'run_round_session_started',
  'run_round_session_completed',
]);

function truncateToken(token) {
  if (!token) return 'MISSING';
  return `${String(token).substring(0, 20)}...`;
}

function normalizeRecipients(recipients = [], fcmToken) {
  if (Array.isArray(recipients) && recipients.length > 0) {
    return recipients
      .filter((recipient) => recipient && typeof recipient === 'object')
      .map((recipient) => ({
        userId: recipient.userId || recipient.uid || recipient.id || null,
        username: recipient.username || null,
        displayName: recipient.displayName || recipient.name || null,
        email: recipient.email || null,
        profileImageUrl: recipient.profileImageUrl || null,
        tokenPreview: recipient.tokenPreview || truncateToken(recipient.fcmToken || recipient.token || fcmToken),
        deliveryChannel: recipient.deliveryChannel || recipient.channel || (recipient.email ? 'email' : 'push'),
        requestedTokenPreview: recipient.requestedTokenPreview || null,
        resolvedFromUserRecord: recipient.resolvedFromUserRecord === true,
      }))
      .map((recipient) => Object.fromEntries(Object.entries(recipient).filter(([, value]) => value !== null && value !== '')))
      .filter((recipient) => Object.keys(recipient).length > 0);
  }

  return fcmToken ? [{ tokenPreview: truncateToken(fcmToken), deliveryChannel: 'push' }] : [];
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (value !== null && value !== undefined && typeof value !== 'object') {
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
  }
  return '';
}

function dedupeDocId(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function buildNotificationDedupeKey(customData = {}, recipients = [], title = '', body = '') {
  const notificationType = firstNonEmptyString(customData?.type);
  if (!DEDUPED_NOTIFICATION_TYPES.has(notificationType)) return '';

  const explicitKey = firstNonEmptyString(customData?.dedupeKey);
  if (explicitKey) return explicitKey;

  const recipient = Array.isArray(recipients) && recipients.length > 0 ? recipients[0] : {};
  const recipientUserId = firstNonEmptyString(customData?.userId, recipient?.userId, recipient?.uid, recipient?.id);
  const roundId = firstNonEmptyString(customData?.roundId, customData?.challengeId);
  const senderId = firstNonEmptyString(customData?.fromUserId, customData?.fromUsername);
  const eventId = firstNonEmptyString(customData?.eventId, customData?.sourceWorkoutId, customData?.workoutId, customData?.runId, customData?.summaryId);

  if (!recipientUserId || !roundId || !senderId) return '';
  if (eventId) {
    return `${notificationType}:${roundId}:${senderId}:${recipientUserId}:${eventId}`;
  }

  // Older app versions did not send eventId. Use a short time bucket so rapid retry storms
  // collapse without permanently blocking future same-distance runs.
  const fallbackBucket = Math.floor(Date.now() / 1000 / FALLBACK_DEDUPE_WINDOW_SECONDS);
  const fallbackFingerprint = dedupeDocId([
    firstNonEmptyString(title),
    firstNonEmptyString(body),
    firstNonEmptyString(customData?.distanceMiles),
  ].join('|')).substring(0, 16);

  return `${notificationType}:${roundId}:${senderId}:${recipientUserId}:fallback:${fallbackBucket}:${fallbackFingerprint}`;
}

async function reserveNotificationDedupe(customData = {}, recipients = [], title = '', body = '') {
  const key = buildNotificationDedupeKey(customData, recipients, title, body);
  if (!key) {
    return { reserved: true, key: '', docId: '' };
  }

  const docId = dedupeDocId(key);
  try {
    await db.collection(NOTIFICATION_DEDUPE_COLLECTION).doc(docId).create({
      key,
      notificationType: firstNonEmptyString(customData?.type) || 'UNKNOWN',
      recipientUserId: firstNonEmptyString(customData?.userId, recipients?.[0]?.userId, recipients?.[0]?.uid, recipients?.[0]?.id),
      roundId: firstNonEmptyString(customData?.roundId, customData?.challengeId),
      fromUserId: firstNonEmptyString(customData?.fromUserId),
      fromUsername: firstNonEmptyString(customData?.fromUsername),
      eventId: firstNonEmptyString(customData?.eventId, customData?.sourceWorkoutId, customData?.workoutId, customData?.runId, customData?.summaryId),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      timestampEpoch: Math.floor(Date.now() / 1000),
    });
    return { reserved: true, key, docId };
  } catch (error) {
    const code = firstNonEmptyString(error?.code);
    const message = firstNonEmptyString(error?.message);
    if (code === '6' || code === 'already-exists' || message.includes('ALREADY_EXISTS') || message.includes('already exists')) {
      return { reserved: false, key, docId };
    }

    console.warn('[send-notification] Dedupe reservation failed open:', error);
    return { reserved: true, key, docId };
  }
}

async function resolveLiveRecipientTarget(fcmToken, customData = {}, recipients = []) {
  const notificationType = String(customData?.type || '').trim();
  const recipientUserId = typeof customData?.userId === 'string' ? customData.userId.trim() : '';

  const fallbackRecipients = normalizeRecipients(
    recipients.length > 0
      ? recipients
      : recipientUserId
        ? [{ userId: recipientUserId, fcmToken, deliveryChannel: 'push' }]
        : [],
    fcmToken
  );

  if (!LIVE_USER_TOKEN_NOTIFICATION_TYPES.has(notificationType) || !recipientUserId) {
    return {
      fcmToken,
      recipients: fallbackRecipients,
    };
  }

  try {
    const userDoc = await db.collection('users').doc(recipientUserId).get();
    if (!userDoc.exists) {
      console.warn('[send-notification] Recipient user doc not found for live token resolution:', {
        notificationType,
        recipientUserId,
      });
      return {
        fcmToken,
        recipients: fallbackRecipients,
      };
    }

    const userData = userDoc.data() || {};
    const liveToken = typeof userData.fcmToken === 'string' ? userData.fcmToken.trim() : '';
    const resolvedToken = liveToken || fcmToken;

    if (!resolvedToken) {
      return {
        fcmToken,
        recipients: fallbackRecipients,
      };
    }

    if (liveToken && liveToken !== fcmToken) {
      console.log('[send-notification] Replacing requested token with live user token:', {
        notificationType,
        recipientUserId,
        requestedTokenPreview: truncateToken(fcmToken),
        resolvedTokenPreview: truncateToken(liveToken),
      });
    }

    return {
      fcmToken: resolvedToken,
      recipients: [{
        userId: recipientUserId,
        username: userData.username || '',
        displayName: userData.displayName || '',
        email: userData.email || '',
        profileImageUrl:
          userData.profileImage?.profileImageURL ||
          userData.profileImage?.profileImageUrl ||
          userData.profileImageUrl ||
          '',
        fcmToken: resolvedToken,
        tokenPreview: truncateToken(resolvedToken),
        requestedTokenPreview: truncateToken(fcmToken),
        deliveryChannel: 'push',
        resolvedFromUserRecord: !!liveToken,
      }],
    };
  } catch (resolutionError) {
    console.error('[send-notification] Error resolving live recipient token:', resolutionError);
    return {
      fcmToken,
      recipients: fallbackRecipients,
    };
  }
}

async function logNotification({
  fcmToken,
  title,
  body,
  dataPayload = {},
  notificationType = 'UNKNOWN',
  success = false,
  messageId = null,
  error = null,
  skipped = false,
  dedupeKey = null,
  functionName = 'netlify/send-notification',
  recipients = []
}) {
  try {
    const FieldValue = admin.firestore.FieldValue;
    const normalizedRecipients = normalizeRecipients(recipients, fcmToken);

    const logEntry = {
      // Notification details (token truncated for privacy)
      fcmToken: truncateToken(fcmToken),
      title,
      body,
      dataPayload,
      notificationType,
      functionName,
      recipients: normalizedRecipients,
      recipientSummary: {
        total: normalizedRecipients.length,
        identifiedUsers: normalizedRecipients.filter(
          (recipient) => recipient.userId || recipient.username || recipient.displayName || recipient.email
        ).length,
      },

      // Status
      success,
      skipped,
      messageId,
      dedupeKey,
      error: error
        ? {
            code: error.code || 'UNKNOWN',
            message: error.message || 'Unknown error',
            details: error.details || null
          }
        : null,

      // Timestamps
      timestamp: FieldValue.serverTimestamp(),
      timestampEpoch: Math.floor(Date.now() / 1000),
      createdAt: FieldValue.serverTimestamp(),
      version: '1.0'
    };

    const docRef = await db.collection(NOTIFICATION_LOGS_COLLECTION).add(logEntry);
    return docRef.id;
  } catch (logError) {
    console.error('Error logging notification:', logError);
    // Don't throw; logging failure shouldn't break sending
    return null;
  }
}

async function sendNotification(fcmToken, title, body, customData = {}, recipients = []) {
  const resolvedTarget = await resolveLiveRecipientTarget(fcmToken, customData, recipients);
  const messaging = admin.messaging();
  const dedupe = await reserveNotificationDedupe(customData, resolvedTarget.recipients, title, body);

  if (!dedupe.reserved) {
    const notificationType = customData?.type || 'SINGLE_NOTIFICATION';
    const logId = await logNotification({
      fcmToken: resolvedTarget.fcmToken,
      title,
      body,
      dataPayload: {
        ...customData,
        dedupeSkipped: 'true',
      },
      notificationType,
      success: true,
      skipped: true,
      messageId: 'deduped',
      dedupeKey: dedupe.key,
      functionName: 'netlify/send-notification',
      recipients: resolvedTarget.recipients
    });

    console.log('[send-notification] Duplicate notification skipped:', {
      notificationType,
      dedupeKey: dedupe.key,
      dedupeDocId: dedupe.docId,
    });

    return {
      success: true,
      skipped: true,
      deduped: true,
      message: 'Duplicate notification skipped.',
      dedupeKey: dedupe.key,
      logId,
    };
  }

  const message = {
    token: resolvedTarget.fcmToken,
    notification: {
      title: title,
      body: body,
    },
    data: customData,
    apns: {
      payload: {
        aps: {
          alert: {
            title: title,
            body: body,
          },
          badge: 1,
        },
      },
    },
  };
  if (dedupe.key) {
    message.apns.headers = {
      'apns-collapse-id': dedupe.docId.substring(0, 64),
    };
  }

  try {
    const response = await messaging.send(message);
    console.log('Successfully sent notification:', response);

    // Log success to Firestore for the Notification Logs dashboard
    const notificationType = customData?.type || 'SINGLE_NOTIFICATION';
    const logId = await logNotification({
      fcmToken: resolvedTarget.fcmToken,
      title,
      body,
      dataPayload: customData,
      notificationType,
      success: true,
      messageId: response,
      dedupeKey: dedupe.key || null,
      functionName: 'netlify/send-notification',
      recipients: resolvedTarget.recipients
    });

    return { success: true, message: 'Notification sent successfully.', messageId: response, logId };
  } catch (error) {
    console.error('Error sending notification:', error);
    if (dedupe.key && dedupe.docId) {
      try {
        await db.collection(NOTIFICATION_DEDUPE_COLLECTION).doc(dedupe.docId).delete();
      } catch (releaseError) {
        console.warn('[send-notification] Failed to release dedupe reservation after send error:', releaseError);
      }
    }

    // Log failure to Firestore for the Notification Logs dashboard
    const notificationType = customData?.type || 'SINGLE_NOTIFICATION';
    await logNotification({
      fcmToken: resolvedTarget.fcmToken,
      title,
      body,
      dataPayload: customData,
      notificationType,
      success: false,
      error,
      dedupeKey: dedupe.key || null,
      functionName: 'netlify/send-notification',
      recipients: resolvedTarget.recipients
    });

    throw error;
  }
}

function normalizeIncomingNotificationRequest(body = {}) {
  const nestedPayload = body && typeof body.payload === 'object' && body.payload !== null ? body.payload : null;
  const rootNotification = body && typeof body.notification === 'object' && body.notification !== null ? body.notification : null;
  const nestedNotification =
    nestedPayload && typeof nestedPayload.notification === 'object' && nestedPayload.notification !== null
      ? nestedPayload.notification
      : null;

  const notificationSource = nestedNotification || rootNotification || body;
  const title = typeof notificationSource?.title === 'string' ? notificationSource.title : '';
  const bodyText = typeof notificationSource?.body === 'string' ? notificationSource.body : '';

  const nestedData = nestedPayload && typeof nestedPayload.data === 'object' && nestedPayload.data !== null ? nestedPayload.data : null;
  const rootData = body && typeof body.data === 'object' && body.data !== null ? body.data : null;
  const customData = nestedData || rootData || {};

  const nestedRecipient =
    nestedPayload && typeof nestedPayload.recipient === 'object' && nestedPayload.recipient !== null
      ? nestedPayload.recipient
      : null;
  const rootRecipient = body && typeof body.recipient === 'object' && body.recipient !== null ? body.recipient : null;

  return {
    fcmToken: typeof body?.fcmToken === 'string' ? body.fcmToken : '',
    title,
    body: bodyText,
    customData,
    recipient: rootRecipient || nestedRecipient || null,
  };
}

exports.handler = async (event) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // For POST requests, parse the body
    const body = JSON.parse(event.body);
    console.log('Received request body:', body); // Debug log

    const {
      fcmToken,
      title,
      body: notificationBody,
      customData,
      recipient,
    } = normalizeIncomingNotificationRequest(body);
    
    if (!fcmToken || !title || !notificationBody) {
      await logNotification({
        fcmToken,
        title: title || 'Invalid notification request',
        body: notificationBody || 'Notification request was rejected before send because required fields were missing.',
        dataPayload: customData,
        notificationType: customData?.type || 'INVALID_NOTIFICATION_REQUEST',
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required parameters: fcmToken, title, or body',
        },
        functionName: 'netlify/send-notification',
        recipients: recipient ? [recipient] : []
      });

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Missing required parameters: fcmToken, title, or body'
        })
      };
    }

    const result = await sendNotification(
      fcmToken, 
      title, 
      notificationBody,
      customData,
      recipient ? [recipient] : []
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: error.message 
      })
    };
  }
};
