const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

// Initialize Firestore
const db = admin.firestore();

const NOTIFICATION_LOGS_COLLECTION = 'notification-logs';

function truncateToken(token) {
  if (!token) return 'MISSING';
  return `${String(token).substring(0, 20)}...`;
}

function normalizeRecipient(recipient = {}, fallback = {}) {
  if (!recipient || typeof recipient !== 'object') {
    return null;
  }

  const normalized = {};
  const userId = recipient.userId || recipient.uid || recipient.id || fallback.userId || null;
  const username = recipient.username || fallback.username || null;
  const displayName = recipient.displayName || recipient.name || fallback.displayName || null;
  const email = recipient.email || fallback.email || null;
  const tokenPreview = recipient.tokenPreview || truncateToken(recipient.fcmToken || recipient.token || fallback.fcmToken || null);
  const deliveryChannel = recipient.deliveryChannel || recipient.channel || fallback.deliveryChannel || (email ? 'email' : 'push');

  if (userId) normalized.userId = String(userId);
  if (username) normalized.username = String(username);
  if (displayName) normalized.displayName = String(displayName);
  if (email) normalized.email = String(email);
  if (tokenPreview && tokenPreview !== 'MISSING') normalized.tokenPreview = tokenPreview;
  if (deliveryChannel) normalized.deliveryChannel = deliveryChannel;
  if (typeof recipient.success === 'boolean') normalized.success = recipient.success;
  if (recipient.messageId) normalized.messageId = recipient.messageId;
  if (recipient.error) {
    normalized.error = {
      code: recipient.error.code || 'UNKNOWN',
      message: recipient.error.message || 'Unknown error'
    };
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function buildRecipients({ recipients = [], fcmToken = null, deliveryChannel = 'push' }) {
  const normalizedRecipients = Array.isArray(recipients)
    ? recipients
        .map((recipient) => normalizeRecipient(recipient, { deliveryChannel }))
        .filter(Boolean)
    : [];

  if (normalizedRecipients.length > 0) {
    return normalizedRecipients;
  }

  if (!fcmToken) {
    return [];
  }

  const fallbackRecipient = normalizeRecipient({ fcmToken, deliveryChannel });
  return fallbackRecipient ? [fallbackRecipient] : [];
}

function buildRecipientSummary(recipients = []) {
  const deliveryChannels = Array.from(
    new Set(
      recipients
        .map((recipient) => recipient.deliveryChannel)
        .filter(Boolean)
    )
  );

  return {
    total: recipients.length,
    identifiedUsers: recipients.filter(
      (recipient) => recipient.userId || recipient.username || recipient.displayName || recipient.email
    ).length,
    deliveryChannels
  };
}

function mergeRecipientsWithResults(recipients = [], tokens = [], response) {
  const normalizedRecipients = buildRecipients({ recipients, deliveryChannel: 'push' });

  return (response?.responses || []).map((resp, index) => {
    const normalizedRecipient = normalizedRecipients[index] || {};

    return {
      ...normalizedRecipient,
      tokenPreview: normalizedRecipient.tokenPreview || truncateToken(tokens[index]),
      deliveryChannel: normalizedRecipient.deliveryChannel || 'push',
      success: resp.success,
      messageId: resp.messageId || null,
      error: resp.error ? {
        code: resp.error.code || 'UNKNOWN',
        message: resp.error.message || 'Unknown error'
      } : null
    };
  });
}

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
  additionalContext = {},
  recipients = []
}) {
  try {
    const normalizedRecipients = buildRecipients({ recipients, fcmToken });
    const logEntry = {
      // Notification details
      fcmToken: truncateToken(fcmToken),
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
      recipients: normalizedRecipients,
      recipientSummary: buildRecipientSummary(normalizedRecipients),
      
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
 * @param {object} loggingContext - Recipient metadata and extra logging context
 * @returns {Promise<object>} Result object with success status and message
 */
async function sendNotificationWithLogging(
  fcmToken,
  title,
  body,
  customData = {},
  notificationType = 'UNKNOWN',
  functionName = 'UNKNOWN',
  loggingContext = {}
) {
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
      recipients: loggingContext.recipients || [],
      additionalContext: {
        ...(loggingContext.additionalContext || {}),
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
      recipients: loggingContext.recipients || [],
      additionalContext: {
        ...(loggingContext.additionalContext || {}),
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
  response,
  recipients = []
}) {
  try {
    const normalizedRecipients = mergeRecipientsWithResults(recipients, tokens, response);
    const individualResults = normalizedRecipients.map((recipient) => ({
      tokenPreview: recipient.tokenPreview || 'MISSING_TOKEN',
      success: recipient.success === true,
      messageId: recipient.messageId || null,
      error: recipient.error || null
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
      recipients: normalizedRecipients,
      recipientSummary: buildRecipientSummary(normalizedRecipients),
      
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
