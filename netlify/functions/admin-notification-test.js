const { db, headers, admin } = require('./config/firebase');

const SEARCH_LIMIT = 10;

function buildSearchText(user) {
  return [
    user.username || '',
    user.displayName || '',
    user.email || '',
  ]
    .join(' ')
    .trim()
    .toLowerCase();
}

function scoreUser(user, query) {
  const username = String(user.username || '').toLowerCase();
  const displayName = String(user.displayName || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();

  if (username === query) return 0;
  if (email === query) return 1;
  if (displayName === query) return 2;
  if (username.startsWith(query)) return 3;
  if (displayName.startsWith(query)) return 4;
  if (email.startsWith(query)) return 5;
  if (username.includes(query)) return 6;
  if (displayName.includes(query)) return 7;
  if (email.includes(query)) return 8;
  return 99;
}

function sanitizeUser(doc) {
  const data = doc.data() || {};
  const pulseFcmToken = typeof data.fcmToken === 'string' ? data.fcmToken.trim() : '';
  const pulseCheckFcmToken = typeof data.pulseCheckFcmToken === 'string' ? data.pulseCheckFcmToken.trim() : '';
  return {
    id: doc.id,
    username: data.username || '',
    displayName: data.displayName || '',
    email: data.email || '',
    hasFcmToken: pulseFcmToken.length > 0 || pulseCheckFcmToken.length > 0,
    hasPulseFcmToken: pulseFcmToken.length > 0,
    hasPulseCheckFcmToken: pulseCheckFcmToken.length > 0,
    profileImageUrl: data.profileImage?.profileImageURL || data.profileImage?.profileImageUrl || '',
  };
}

function resolveScopedFcmToken(userData, productScope) {
  const pulseFcmToken = typeof userData.fcmToken === 'string' ? userData.fcmToken.trim() : '';
  const pulseCheckFcmToken = typeof userData.pulseCheckFcmToken === 'string' ? userData.pulseCheckFcmToken.trim() : '';
  const pulseCheckSourceApp = typeof userData.pushTokenSourceApp === 'string'
    ? userData.pushTokenSourceApp.trim().toLowerCase()
    : '';

  if (productScope === 'pulsecheck') {
    if (!pulseCheckFcmToken) {
      return { token: '', reason: 'missing_pulsecheck_fcm_token' };
    }

    if (pulseCheckSourceApp !== 'pulsecheck') {
      return {
        token: '',
        reason: pulseCheckSourceApp ? 'pulsecheck_source_app_mismatch' : 'missing_pulsecheck_source_app',
      };
    }

    return { token: pulseCheckFcmToken, reason: 'eligible' };
  }

  return {
    token: pulseFcmToken,
    reason: pulseFcmToken ? 'eligible' : 'missing_fcm_token',
  };
}

async function logNotification({
  fcmToken,
  title,
  body,
  dataPayload = {},
  notificationType,
  functionName,
  success,
  messageId = null,
  error = null,
  additionalContext = {},
}) {
  try {
    const FieldValue = admin.firestore.FieldValue;

    await db.collection('notification-logs').add({
      fcmToken: fcmToken ? `${String(fcmToken).substring(0, 20)}...` : 'MISSING',
      title,
      body,
      dataPayload,
      notificationType,
      functionName,
      success,
      messageId,
      error: error
        ? {
            code: error.code || 'UNKNOWN',
            message: error.message || 'Unknown error',
            details: error.details || null,
          }
        : null,
      additionalContext,
      timestamp: FieldValue.serverTimestamp(),
      timestampEpoch: Math.floor(Date.now() / 1000),
      createdAt: FieldValue.serverTimestamp(),
      version: '1.0',
    });
  } catch (logError) {
    console.error('[admin-notification-test] Failed to log notification:', logError);
  }
}

async function sendNotificationWithLogging({
  fcmToken,
  title,
  body,
  dataPayload,
  notificationType,
  functionName,
  additionalContext,
}) {
  const messaging = admin.messaging();
  const message = {
    token: fcmToken,
    notification: { title, body },
    data: dataPayload,
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          badge: 1,
          sound: 'default',
        },
      },
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
      },
    },
  };

  try {
    const messageId = await messaging.send(message);
    await logNotification({
      fcmToken,
      title,
      body,
      dataPayload,
      notificationType,
      functionName,
      success: true,
      messageId,
      additionalContext,
    });

    return { success: true, messageId };
  } catch (error) {
    await logNotification({
      fcmToken,
      title,
      body,
      dataPayload,
      notificationType,
      functionName,
      success: false,
      error,
      additionalContext,
    });
    throw error;
  }
}

async function handleSearch(event) {
  const q = String(event.queryStringParameters?.q || '').trim().toLowerCase();

  if (q.length < 2) {
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: true, users: [] }),
    };
  }

  const snapshot = await db.collection('users').get();
  const users = snapshot.docs
    .map((doc) => sanitizeUser(doc))
    .filter((user) => buildSearchText(user).includes(q))
    .sort((a, b) => scoreUser(a, q) - scoreUser(b, q))
    .slice(0, SEARCH_LIMIT);

  return {
    statusCode: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ success: true, users }),
  };
}

async function handleSend(event) {
  const body = JSON.parse(event.body || '{}');
  const {
    userId,
    title,
    body: notificationBody,
    dataPayload = {},
    notificationId,
    notificationName,
    productScope = 'pulse',
  } = body;

  if (!userId || !title || !notificationBody) {
    return {
      statusCode: 400,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: 'Missing required parameters: userId, title, or body',
      }),
    };
  }

  const userDoc = await db.collection('users').doc(String(userId)).get();
  if (!userDoc.exists) {
    return {
      statusCode: 404,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: false, message: 'User not found' }),
    };
  }

  const userData = userDoc.data() || {};
  const scopedToken = resolveScopedFcmToken(userData, productScope);
  if (!scopedToken.token) {
    return {
      statusCode: 400,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message:
          productScope === 'pulsecheck'
            ? `Selected user is not eligible for a Pulse Check push (${scopedToken.reason})`
            : 'Selected user does not have a valid FCM token',
      }),
    };
  }
  const fcmToken = scopedToken.token;

  const notificationType = String(dataPayload.type || notificationId || 'ADMIN_NOTIFICATION_TEST');
  const result = await sendNotificationWithLogging({
    fcmToken,
    title,
    body: notificationBody,
    dataPayload,
    notificationType,
    functionName: 'netlify/admin-notification-test',
    additionalContext: {
      mode: 'admin-test',
      userId: userDoc.id,
      username: userData.username || '',
      productScope,
      notificationId: notificationId || '',
      notificationName: notificationName || '',
    },
  });

  return {
    statusCode: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      message: 'Test notification sent successfully',
      messageId: result.messageId,
      selectedUser: sanitizeUser(userDoc),
    }),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      return await handleSearch(event);
    }

    if (event.httpMethod === 'POST') {
      return await handleSend(event);
    }

    return {
      statusCode: 405,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: false, message: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('[admin-notification-test] Error:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        message: error.message || 'Unexpected error',
      }),
    };
  }
};
