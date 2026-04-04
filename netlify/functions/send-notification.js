const { db, admin } = require('./config/firebase');

const NOTIFICATION_LOGS_COLLECTION = 'notification-logs';
const LIVE_USER_TOKEN_NOTIFICATION_TYPES = new Set([
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
      messageId,
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
      functionName: 'netlify/send-notification',
      recipients: resolvedTarget.recipients
    });

    return { success: true, message: 'Notification sent successfully.', messageId: response, logId };
  } catch (error) {
    console.error('Error sending notification:', error);

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
      functionName: 'netlify/send-notification',
      recipients: resolvedTarget.recipients
    });

    throw error;
  }
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

    const { fcmToken, payload, recipient } = body;
    
    if (!fcmToken || !payload?.notification?.title || !payload?.notification?.body) {
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
      payload.notification.title, 
      payload.notification.body,
      payload.data || {},
      recipient ? [recipient] : (payload?.recipient ? [payload.recipient] : [])
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
