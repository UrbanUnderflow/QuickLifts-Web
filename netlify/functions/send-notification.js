const { db, admin } = require('./config/firebase');

const NOTIFICATION_LOGS_COLLECTION = 'notification-logs';

async function logNotification({
  fcmToken,
  title,
  body,
  dataPayload = {},
  notificationType = 'UNKNOWN',
  success = false,
  messageId = null,
  error = null,
  functionName = 'netlify/send-notification'
}) {
  try {
    const FieldValue = admin.firestore.FieldValue;

    const logEntry = {
      // Notification details (token truncated for privacy)
      fcmToken: fcmToken ? `${String(fcmToken).substring(0, 20)}...` : 'MISSING',
      title,
      body,
      dataPayload,
      notificationType,
      functionName,

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

async function sendNotification(fcmToken, title, body, customData = {}) {
  const messaging = admin.messaging();

  const message = {
    token: fcmToken,
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
      fcmToken,
      title,
      body,
      dataPayload: customData,
      notificationType,
      success: true,
      messageId: response,
      functionName: 'netlify/send-notification'
    });

    return { success: true, message: 'Notification sent successfully.', messageId: response, logId };
  } catch (error) {
    console.error('Error sending notification:', error);

    // Log failure to Firestore for the Notification Logs dashboard
    const notificationType = customData?.type || 'SINGLE_NOTIFICATION';
    await logNotification({
      fcmToken,
      title,
      body,
      dataPayload: customData,
      notificationType,
      success: false,
      error,
      functionName: 'netlify/send-notification'
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

    const { fcmToken, payload } = body;
    
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
      payload.data || {}
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