// Import necessary Firebase modules
import * as admin from 'firebase-admin';
import { HttpsError, onCall } from "firebase-functions/v2/https"; // Gen 2 imports
import * as logger from "firebase-functions/logger"; // Gen 2 logger
// const cors = require('cors')({origin: true}); // CORS typically handled by Cloud Functions v2 automatically or via framework

// Ensure Firebase Admin SDK is initialized (typically done in index.js)
// Use admin.initializeApp() if not initialized elsewhere, 
// but it's typically done once in index.js
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }

// Adjust initialization for potential ES Module default export
const adminInstance = admin.default ?? admin;
const messaging = adminInstance.messaging();

/**
 * Sends a single push notification to a specific FCM token.
 * @param {string} fcmToken The target device's FCM token.
 * @param {string} title Notification title.
 * @param {string} body Notification body.
 * @param {object} customData Additional data to send with the notification.
 * @returns {Promise<object>} Result object with success status and message.
 */
async function sendNotification(fcmToken, title, body, customData = {}) {
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
          badge: 1, // Consider if badge count should be dynamic
          sound: 'default' // Ensure sound is configured correctly for your app
        },
      },
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default' // Ensure sound is configured correctly for your app
      }
    }
  };

  try {
    const response = await messaging.send(message);
    logger.info('Successfully sent notification:', response); // Use Gen 2 logger
    return { success: true, message: 'Notification sent successfully.' };
  } catch (error) {
    logger.error('Error sending notification:', error); // Use Gen 2 logger
    // Handle specific errors like invalid token
    // Use optional chaining and check error code safely
    const errorCode = error?.code;
    if (errorCode === 'messaging/registration-token-not-registered') {
      // Optional: Add logic here to remove the invalid token from Firestore
      logger.warn(`Invalid FCM token: ${fcmToken}. Consider removing it.`); // Use Gen 2 logger
    }
    // Re-throw the error
    // Use optional chaining for error message
    throw new HttpsError('internal', 'Error sending notification', error?.message || 'Unknown error');
  }
}

/**
 * Firebase Callable Function (Gen 2) to send a single notification.
 * Expects data in format: { fcmToken: "...", payload: { notification: { title: "...", body: "..." }, data: { ... } } }
 */
export const sendSingleNotification = onCall(async (request) => {
  // Gen 2 uses request.auth instead of context.auth
  // --- SECURITY NOTE --- 
  // Consider adding additional authentication checks here.
  // const auth = request.auth;
  // if (!auth) {
  //   throw new HttpsError('unauthenticated', 'You must be logged in to send notifications');
  // }
  // 
  // To check for admin role:
  // const isAdmin = auth.token.admin === true;
  // if (!isAdmin) {
  //   throw new HttpsError('permission-denied', 'Only admins can send notifications');
  // }
  // --- END SECURITY NOTE --- 

  // Gen 2 uses request.data for the payload
  const inputData = request.data;
  logger.info('Received notification request with data:', JSON.stringify(inputData)); // Use Gen 2 logger
  
  // Validate input
  const { fcmToken, payload } = inputData;
  
  if (!fcmToken || !payload?.notification?.title || !payload?.notification?.body) {
    logger.error('Missing required parameters:', JSON.stringify(inputData)); // Use Gen 2 logger
    throw new HttpsError(
      'invalid-argument',
      'Missing required parameters: fcmToken, payload.notification.title, or payload.notification.body'
    );
  }

  try {
    // Send the notification
    const result = await sendNotification(
      fcmToken,
      payload.notification.title,
      payload.notification.body,
      payload.data || {}
    );

    return result; // Return data directly in Gen 2
  } catch (error) {
    logger.error('Error processing notification request:', error); // Use Gen 2 logger
    // Re-throw HttpsError if it's already formatted correctly
    if (error instanceof HttpsError) {
      throw error;
    }
    // Otherwise wrap in a new HttpsError
    // Use optional chaining for error message
    throw new HttpsError(
      'internal',
      'Error sending notification',
      error?.message || 'Unknown error'
    );
  }
}); 