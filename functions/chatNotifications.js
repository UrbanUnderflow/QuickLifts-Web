// --- Imports for newer SDK ---
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

// Import notification logger
const { sendNotificationWithLogging, logMulticastNotification } = require('./notificationLogger');

// Ensure Firebase Admin is initialized
const db = admin.firestore();
const messaging = admin.messaging();

// Date utility functions following project standards
const dateToUnixTimestamp = (date) => {
  return Math.floor(date.getTime() / 1000);
};

const convertFirestoreTimestamp = (timestamp) => {
  // If null or undefined, return the current date.
  if (timestamp == null) return new Date();

  // If it's already a Date, return it.
  if (timestamp instanceof Date) return timestamp;

  // Convert to number if it's a string (using parseFloat preserves decimals).
  const numTimestamp = typeof timestamp === 'string' ? parseFloat(timestamp) : timestamp;

  // If the timestamp looks like seconds (less than 10 billion), convert to milliseconds.
  if (numTimestamp < 10000000000) {
    return new Date(numTimestamp * 1000);
  }

  // Otherwise, assume it's in milliseconds.
  return new Date(numTimestamp);
};

/**
 * Sends a push notification to multiple FCM tokens with logging.
 * @param {Array} tokens Array of FCM tokens
 * @param {string} title Notification title
 * @param {string} body Notification body
 * @param {object} dataPayload Additional data to send with the notification
 * @param {string} notificationType Type of notification for logging
 * @returns {Promise<object>} Result object with success/failure counts
 */
async function sendMulticastNotification(tokens, title, body, dataPayload = {}, notificationType = 'CHAT_MESSAGE') {
  if (!tokens || tokens.length === 0) {
    console.log('No tokens provided for multicast notification');
    return { successCount: 0, failureCount: 0 };
  }

  const message = {
    tokens: tokens,
    notification: { title, body },
    data: dataPayload,
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          badge: 1,
          sound: 'default'
        },
      },
    },
    android: {
      priority: 'high',
      notification: { sound: 'default' }
    }
  };

  try {
    console.log(`Sending ${notificationType} notification via sendEachForMulticast to ${tokens.length} tokens.`);
    const response = await messaging.sendEachForMulticast(message);
    
    // Log multicast notification
    await logMulticastNotification({
      tokens,
      title,
      body,
      dataPayload,
      notificationType,
      functionName: 'chatNotifications',
      response
    });
    
    console.log(`Finished sending ${notificationType} notifications. Sent: ${response.successCount}, Failed: ${response.failureCount}.`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(` - Failed sending to token [${idx}] (${tokens[idx].substring(0,10)}...): ${resp.error.code} - ${resp.error.message}`);
        }
      });
    }

    return { successCount: response.successCount, failureCount: response.failureCount };
  } catch (error) {
    console.error(`Error sending ${notificationType} multicast notification:`, error);
    return { successCount: 0, failureCount: tokens.length };
  }
}

/**
 * Sends notifications when a new direct message is created
 * Triggered when a new document is created in 'chats/{chatId}/messages/{messageId}'
 */
exports.sendDirectMessageNotification = onDocumentCreated("chats/{chatId}/messages/{messageId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    console.log(`No data associated with the event for chats/${event.params.chatId}/messages/${event.params.messageId}. Exiting.`);
    return null;
  }

  const messageData = snap.data();
  const messageId = event.params.messageId;
  const chatId = event.params.chatId;

  if (!messageData) {
    console.log(`No data found for new direct message ${messageId} in chat ${chatId}. Exiting.`);
    return null;
  }

  const { senderId, content, workout, request, peerChallengeData } = messageData;

  if (!senderId) {
    console.error(`Missing senderId in direct message ${messageId}. Cannot send notifications.`);
    return null;
  }

  // Skip notification if content is empty - indicates special message types (peer challenges, etc.) 
  // that have their own notification systems
  if (!content || !content.trim()) {
    console.log(`Empty content in direct message ${messageId}. Skipping notification to avoid duplicates.`);
    return null;
  }

  console.log(`New direct message ${messageId} from ${senderId} in chat ${chatId}. Preparing notifications.`);

  try {
    // Get chat document to find participants
    const chatDoc = await db.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) {
      console.error(`Chat document ${chatId} not found. Cannot send notifications.`);
      return null;
    }

    const chatData = chatDoc.data();
    const participants = chatData.participants || chatData.participantIds || [];

    if (!participants || participants.length === 0) {
      console.log(`No participants found in chat ${chatId}. No notifications to send.`);
      return null;
    }

    // Get sender information for notification
    let senderUsername = 'Someone';
    try {
      const senderDoc = await db.collection('users').doc(senderId).get();
      if (senderDoc.exists) {
        senderUsername = senderDoc.data().username || senderDoc.data().displayName || 'Someone';
      }
    } catch (error) {
      console.error(`Error fetching sender ${senderId} info:`, error);
    }

    // Collect FCM tokens for participants (excluding sender)
    const eligibleTokens = [];
    let missingTokenCount = 0;

    console.log(`Chat participants structure:`, participants);

    for (const participant of participants) {
      // Handle both string IDs and participant objects
      let participantId;
      if (typeof participant === 'string') {
        participantId = participant;
      } else if (participant && typeof participant === 'object') {
        // Try different possible ID fields
        participantId = participant.id || participant.userId || participant.uid;
      }

      console.log(`Processing participant:`, participant, `-> ID: ${participantId}`);

      // Skip if we couldn't extract a valid ID
      if (!participantId || typeof participantId !== 'string') {
        console.warn(`Invalid participant ID for participant:`, participant);
        continue;
      }

      // Skip if this is the sender
      if (participantId === senderId) {
        console.log(`Skipping sender ${participantId}`);
        continue;
      }

      try {
        const userDoc = await db.collection('users').doc(participantId).get();
        if (userDoc.exists) {
          const fcmToken = userDoc.data().fcmToken;
          if (fcmToken) {
            eligibleTokens.push(fcmToken);
            console.log(`Added FCM token for user ${participantId}`);
          } else {
            missingTokenCount++;
            console.warn(`User ${participantId} in chat ${chatId} is missing an FCM token.`);
          }
        } else {
          console.warn(`User ${participantId} not found in users collection.`);
        }
      } catch (error) {
        console.error(`Error fetching user ${participantId}:`, error);
      }
    }

    // Determine notification content based on message type
    let title = `💬 ${senderUsername}`;
    let body = '';

    if (content && content.trim()) {
      body = content.length > 100 ? content.substring(0, 100) + '...' : content;
    } else if (workout) {
      body = `Shared a workout: ${workout.title || 'Workout'}`;
    } else if (request) {
      body = `Sent a request`;
    } else if (peerChallengeData) {
      body = `Sent a peer challenge`;
    } else {
      body = `Sent a message`;
    }

    const dataPayload = {
      chatId: chatId,
      messageId: messageId,
      senderId: senderId,
      senderUsername: senderUsername,
      type: 'DIRECT_MESSAGE',
      timestamp: String(Math.floor(Date.now() / 1000))
    };

    // Send notifications
    if (eligibleTokens.length > 0) {
      const result = await sendMulticastNotification(
        eligibleTokens,
        title,
        body,
        dataPayload,
        'DIRECT_MESSAGE'
      );
      
      console.log(`Direct message notifications sent. Success: ${result.successCount}, Failed: ${result.failureCount}, Missing tokens: ${missingTokenCount}`);
    } else {
      console.log(`No eligible tokens found for direct message notification in chat ${chatId}. Missing tokens: ${missingTokenCount}`);
    }

  } catch (error) {
    console.error(`Error processing direct message notification for chat ${chatId}:`, error);
  }

  return null;
});

/**
 * Sends notifications when a new round table message is created
 * Triggered when a new document is created in 'sweatlist-collection/{challengeId}/messages/{messageId}'
 */
exports.sendRoundTableNotification = onDocumentCreated("sweatlist-collection/{challengeId}/messages/{messageId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    console.log(`No data associated with the event for sweatlist-collection/${event.params.challengeId}/messages/${event.params.messageId}. Exiting.`);
    return null;
  }

  const messageData = snap.data();
  const messageId = event.params.messageId;
  const challengeId = event.params.challengeId;

  if (!messageData) {
    console.log(`No data found for new round table message ${messageId} in challenge ${challengeId}. Exiting.`);
    return null;
  }

  const { senderId, content } = messageData;

  if (!senderId) {
    console.error(`Missing senderId in round table message ${messageId}. Cannot send notifications.`);
    return null;
  }

  if (!content || !content.trim()) {
    console.log(`Empty content in round table message ${messageId}. Skipping notification to avoid duplicates.`);
    return null;
  }

  console.log(`New round table message ${messageId} from ${senderId} in challenge ${challengeId}. Preparing notifications.`);

  try {
    // Get sender information for notification
    let senderUsername = 'Someone';
    try {
      const senderDoc = await db.collection('users').doc(senderId).get();
      if (senderDoc.exists) {
        senderUsername = senderDoc.data().username || senderDoc.data().displayName || 'Someone';
      }
    } catch (error) {
      console.error(`Error fetching sender ${senderId} info:`, error);
    }

    // Get challenge title for notification context
    let challengeTitle = 'Challenge';
    try {
      const challengeDoc = await db.collection('sweatlist-collection').doc(challengeId).get();
      if (challengeDoc.exists && challengeDoc.data()?.challenge?.title) {
        challengeTitle = challengeDoc.data().challenge.title;
      }
    } catch (error) {
      console.error(`Error fetching challenge ${challengeId} info:`, error);
    }

    // Find all challenge participants via user-challenge collection
    const participantsSnapshot = await db.collection('user-challenge')
      .where('challengeId', '==', challengeId)
      .get();

    if (participantsSnapshot.empty) {
      console.log(`No participants found for challenge ${challengeId}. No notifications to send.`);
      return null;
    }

    // Collect FCM tokens for participants (excluding sender)
    const eligibleTokens = [];
    let missingTokenCount = 0;

    for (const doc of participantsSnapshot.docs) {
      const participantData = doc.data();
      const participantId = participantData.userId;
      const fcmToken = participantData.fcmToken;

      // Skip if this is the sender
      if (participantId === senderId) continue;

      if (fcmToken) {
        eligibleTokens.push(fcmToken);
      } else {
        missingTokenCount++;
        console.warn(`Participant ${participantId} in challenge ${challengeId} is missing an FCM token.`);
      }
    }

    // Prepare notification content
    const title = `🗣️ ${challengeTitle}`;
    const body = `${senderUsername}: ${content.length > 100 ? content.substring(0, 100) + '...' : content}`;

    const dataPayload = {
      challengeId: challengeId,
      messageId: messageId,
      senderId: senderId,
      senderUsername: senderUsername,
      challengeTitle: challengeTitle,
      type: 'ROUND_TABLE_MESSAGE',
      timestamp: String(Math.floor(Date.now() / 1000))
    };

    // Send notifications
    if (eligibleTokens.length > 0) {
      const result = await sendMulticastNotification(
        eligibleTokens,
        title,
        body,
        dataPayload,
        'ROUND_TABLE_MESSAGE'
      );
      
      console.log(`Round table notifications sent. Success: ${result.successCount}, Failed: ${result.failureCount}, Missing tokens: ${missingTokenCount}`);
    } else {
      console.log(`No eligible tokens found for round table notification in challenge ${challengeId}. Missing tokens: ${missingTokenCount}`);
    }

  } catch (error) {
    console.error(`Error processing round table notification for challenge ${challengeId}:`, error);
  }

  return null;
});

/**
 * Alternative function for round table messages if they're stored in a different collection
 * Triggered when a new document is created in 'roundTableMessages/{messageId}'
 */
exports.sendRoundTableNotificationAlt = onDocumentCreated("roundTableMessages/{messageId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    console.log(`No data associated with the event for roundTableMessages/${event.params.messageId}. Exiting.`);
    return null;
  }

  const messageData = snap.data();
  const messageId = event.params.messageId;

  if (!messageData) {
    console.log(`No data found for new round table message ${messageId}. Exiting.`);
    return null;
  }

  const { senderId, content, challengeId } = messageData;

  if (!senderId || !challengeId) {
    console.error(`Missing senderId or challengeId in round table message ${messageId}. Cannot send notifications.`);
    return null;
  }

  if (!content || !content.trim()) {
    console.log(`Empty content in round table message ${messageId}. Skipping notification to avoid duplicates.`);
    return null;
  }

  console.log(`New round table message ${messageId} from ${senderId} for challenge ${challengeId}. Preparing notifications.`);

  // Use the same logic as the main round table function
  // This is essentially the same implementation but for a different collection structure
  // ... (implementation would be identical to sendRoundTableNotification)
  
  return null;
}); 