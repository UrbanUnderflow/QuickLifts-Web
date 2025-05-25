const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

// Initialize Firestore
const db = admin.firestore();

const NOTIFICATION_LOGS_COLLECTION = 'notification-logs';

/**
 * Logs notification data to Firebase for debugging purposes
 * @param {string} fcmToken - The FCM token the notification was sent to
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} dataPayload - Custom data payload
 * @param {string} notificationType - Type of notification (e.g., 'CALLOUT_ANSWERED', 'WORKOUT_STARTED')
 * @param {boolean} success - Whether the notification was sent successfully
 * @param {string} messageId - Firebase message ID (if successful)
 * @param {object} error - Error details (if failed)
 * @param {string} functionName - Name of the function that sent the notification
 * @returns {Promise<string>} - Document ID of the logged entry
 */
async function logNotification({
  fcmToken,
  title,
  body,
  dataPayload = {},
  notificationType = 'UNKNOWN',
  success = false,
  messageId = null,
  error = null,
  functionName = 'UNKNOWN',
  additionalContext = {}
}) {
  try {
    const logEntry = {
      // Notification details
      fcmToken: fcmToken ? fcmToken.substring(0, 20) + '...' : 'MISSING', // Truncate for privacy
      title,
      body,
      dataPayload,
      notificationType,
      functionName,
      
      // Status
      success,
      messageId,
      error: error ? {
        code: error.code || 'UNKNOWN',
        message: error.message || 'Unknown error',
        details: error.details || null
      } : null,
      
      // Additional context
      additionalContext,
      
      // Timestamps
      timestamp: FieldValue.serverTimestamp(),
      timestampEpoch: Math.floor(Date.now() / 1000),
      
      // Metadata
      createdAt: FieldValue.serverTimestamp(),
      version: '1.0'
    };

    const docRef = await db.collection(NOTIFICATION_LOGS_COLLECTION).add(logEntry);
    console.log(`Notification logged with ID: ${docRef.id}`);
    return docRef.id;
  } catch (logError) {
    console.error('Error logging notification:', logError);
    // Don't throw - logging shouldn't break the main function
    return null;
  }
}

/**
 * Enhanced notification sender with logging
 * @param {string} fcmToken - The target device's FCM token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} customData - Additional data to send with the notification
 * @param {string} notificationType - Type of notification for logging
 * @param {string} functionName - Name of the calling function
 * @returns {Promise<object>} Result object with success status and message
 */
async function sendNotificationWithLogging(fcmToken, title, body, customData = {}, notificationType = 'UNKNOWN', functionName = 'UNKNOWN') {
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
          sound: 'default'
        },
      },
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default'
      }
    }
  };

  let result;
  let logId;

  try {
    const response = await messaging.send(message);
    console.log(`Successfully sent ${notificationType} notification:`, response);
    
    // Log successful notification
    logId = await logNotification({
      fcmToken,
      title,
      body,
      dataPayload: customData,
      notificationType,
      success: true,
      messageId: response,
      functionName,
      additionalContext: {
        messageStructure: {
          hasApnsPayload: !!message.apns,
          hasAndroidConfig: !!message.android,
          dataKeysCount: Object.keys(customData).length
        }
      }
    });
    
    result = { success: true, message: 'Notification sent successfully.', messageId: response, logId };
  } catch (error) {
    console.error(`Error sending ${notificationType} notification:`, error);
    
    // Log failed notification
    logId = await logNotification({
      fcmToken,
      title,
      body,
      dataPayload: customData,
      notificationType,
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      functionName,
      additionalContext: {
        errorType: error.constructor.name,
        isTokenError: error.code === 'messaging/registration-token-not-registered'
      }
    });

    if (error.code === 'messaging/registration-token-not-registered') {
      console.log(`Invalid FCM token: ${fcmToken}. Consider removing it.`);
    }
    
    // Re-throw to be caught by caller
    throw error;
  }

  return result;
}

/**
 * Logs multicast notification attempts
 * @param {Array} tokens - Array of FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} dataPayload - Custom data payload
 * @param {string} notificationType - Type of notification
 * @param {string} functionName - Name of the calling function
 * @param {object} response - Firebase multicast response
 * @returns {Promise<string>} - Document ID of the logged entry
 */
async function logMulticastNotification({
  tokens,
  title,
  body,
  dataPayload,
  notificationType,
  functionName,
  response
}) {
  try {
    // Create detailed individual results with truncated tokens for privacy
    const individualResults = response.responses.map((resp, index) => ({
      tokenPreview: tokens[index] ? tokens[index].substring(0, 20) + '...' : 'MISSING_TOKEN',
      success: resp.success,
      messageId: resp.messageId || null,
      error: resp.error ? {
        code: resp.error.code || 'UNKNOWN',
        message: resp.error.message || 'Unknown error'
      } : null
    }));

    const logEntry = {
      notificationType,
      functionName,
      multicast: true,
      
      // Notification details
      title,
      body,
      dataPayload,
      
      // Multicast details
      totalTokens: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      
      // Individual results with detailed breakdown
      individualResults,
      
      // Individual results summary (keeping for backward compatibility)
      results: {
        successful: response.successCount,
        failed: response.failureCount,
        failureReasons: response.responses
          .filter(resp => !resp.success)
          .map(resp => ({
            errorCode: resp.error?.code || 'UNKNOWN',
            errorMessage: resp.error?.message || 'Unknown error'
          }))
      },
      
      // Timestamps
      timestamp: FieldValue.serverTimestamp(),
      timestampEpoch: Math.floor(Date.now() / 1000),
      createdAt: FieldValue.serverTimestamp(),
      version: '1.0'
    };

    const docRef = await db.collection(NOTIFICATION_LOGS_COLLECTION).add(logEntry);
    console.log(`Multicast notification logged with ID: ${docRef.id}`);
    return docRef.id;
  } catch (logError) {
    console.error('Error logging multicast notification:', logError);
    return null;
  }
}

module.exports = {
  logNotification,
  sendNotificationWithLogging,
  logMulticastNotification,
  NOTIFICATION_LOGS_COLLECTION
}; 