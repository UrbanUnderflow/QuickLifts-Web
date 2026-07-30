const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function resolvePulseCheckPushTarget(userData = {}) {
  const pulseCheckToken = typeof userData.pulseCheckFcmToken === 'string'
    ? userData.pulseCheckFcmToken.trim()
    : '';
  const sourceApp = typeof userData.pushTokenSourceApp === 'string'
    ? userData.pushTokenSourceApp.trim().toLowerCase()
    : '';

  if (pulseCheckToken && sourceApp === 'pulsecheck') {
    return {
      token: pulseCheckToken,
      field: 'pulseCheckFcmToken',
      reason: 'pulsecheck_token',
    };
  }

  if (pulseCheckToken) {
    return {
      token: pulseCheckToken,
      field: 'pulseCheckFcmToken',
      reason: sourceApp ? 'source_app_mismatch' : 'missing_source_app',
    };
  }

  return {
    token: '',
    field: '',
    reason: 'missing_token',
  };
}

function timestampToISOString(value) {
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Send push notification when a new coach-athlete message is created
 */
exports.sendCoachAthleteMessageNotification = functions.firestore
  .document('coach-athlete-messages/{messageId}')
  .onCreate(async (snap, context) => {
    try {
      const messageData = snap.data();
      const messageId = context.params.messageId;
      
      console.log(`Processing new coach-athlete message: ${messageId}`);
      
      // Get conversation details
      const conversationRef = db.collection('coach-athlete-conversations').doc(messageData.conversationId);
      const conversationDoc = await conversationRef.get();
      
      if (!conversationDoc.exists) {
        console.error(`Conversation not found: ${messageData.conversationId}`);
        return;
      }
      
      const conversationData = conversationDoc.data();
      
      // Determine recipient
      const isFromCoach = messageData.senderType === 'coach';
      const recipientId = isFromCoach ? conversationData.athleteId : conversationData.coachId;
      const senderName = isFromCoach ? conversationData.coachName : conversationData.athleteName;
      
      console.log(`Sending notification to ${isFromCoach ? 'athlete' : 'coach'}: ${recipientId}`);
      
      // Get recipient's FCM token
      const userDoc = await db.collection('users').doc(recipientId).get();
      
      if (!userDoc.exists) {
        console.error(`Recipient user not found: ${recipientId}`);
        return;
      }
      
      const userData = userDoc.data() || {};
      const pushTarget = resolvePulseCheckPushTarget(userData);
      const fcmToken = pushTarget.token;
      
      if (!fcmToken) {
        console.log(`No PulseCheck FCM token found for user: ${recipientId}`);
        return;
      }

      console.log(`Resolved ${pushTarget.field} for ${recipientId} (${pushTarget.reason}).`);
      
      // Prepare notification payload
      const notificationTitle = isFromCoach ? 
        `Message from ${senderName}` : 
        `Message from ${senderName}`;
      
      const rawContent = typeof messageData.content === 'string'
        ? messageData.content.trim()
        : '';
      const messagePreview = rawContent || 'Sent a message';
      const notificationBody = messagePreview.length > 100
        ? `${messagePreview.substring(0, 100)}...`
        : messagePreview;
      
      const payload = {
        token: fcmToken,
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          type: 'COACH_MESSAGE',
          conversationId: String(messageData.conversationId || ''),
          senderId: String(messageData.senderId || ''),
          senderType: String(messageData.senderType || ''),
          coachId: String(conversationData.coachId || ''),
          athleteId: String(conversationData.athleteId || ''),
          message: notificationBody,
          messageId: String(messageId || ''),
          timestamp: timestampToISOString(messageData.timestamp)
        },
        apns: {
          headers: {
            'apns-priority': '10'
          },
          payload: {
            aps: {
              alert: {
                title: notificationTitle,
                body: notificationBody
              },
              badge: 1,
              sound: 'default',
              category: 'MESSAGE_CATEGORY'
            }
          }
        },
        android: {
          notification: {
            channelId: 'coach_athlete_messages',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true
          }
        }
      };
      
      // Send notification
      const response = await admin.messaging().send(payload);
      console.log(`Successfully sent message notification: ${response}`);
      
      // Update user's unread message count in their document
      const userUpdateData = {};
      if (isFromCoach) {
        userUpdateData['unreadCoachMessages'] = admin.firestore.FieldValue.increment(1);
      } else {
        userUpdateData['unreadAthleteMessages'] = admin.firestore.FieldValue.increment(1);
      }
      
      await db.collection('users').doc(recipientId).update(userUpdateData);
      console.log(`Updated unread count for user: ${recipientId}`);
      
    } catch (error) {
      console.error('Error sending coach-athlete message notification:', error);
    }
  });

/**
 * Update unread counts when messages are marked as read
 */
exports.updateCoachAthleteMessageReadStatus = functions.firestore
  .document('coach-athlete-messages/{messageId}')
  .onUpdate(async (change, context) => {
    try {
      const beforeData = change.before.data();
      const afterData = change.after.data();
      const messageId = context.params.messageId;
      
      // Check if readBy field was updated
      const beforeReadBy = beforeData.readBy || {};
      const afterReadBy = afterData.readBy || {};
      
      // Find newly read users
      const newlyReadUsers = [];
      for (const userId in afterReadBy) {
        if (!beforeReadBy[userId] && afterReadBy[userId]) {
          newlyReadUsers.push(userId);
        }
      }
      
      if (newlyReadUsers.length === 0) {
        return; // No new reads
      }
      
      console.log(`Message ${messageId} newly read by users: ${newlyReadUsers.join(', ')}`);
      
      // Get conversation details
      const conversationRef = db.collection('coach-athlete-conversations').doc(afterData.conversationId);
      const conversationDoc = await conversationRef.get();
      
      if (!conversationDoc.exists) {
        console.error(`Conversation not found: ${afterData.conversationId}`);
        return;
      }
      
      const conversationData = conversationDoc.data();
      
      // Update unread counts for users who read the message
      const batch = db.batch();
      
      for (const userId of newlyReadUsers) {
        const isCoach = userId === conversationData.coachId;
        const userRef = db.collection('users').doc(userId);
        
        const updateData = {};
        if (isCoach) {
          updateData['unreadAthleteMessages'] = admin.firestore.FieldValue.increment(-1);
        } else {
          updateData['unreadCoachMessages'] = admin.firestore.FieldValue.increment(-1);
        }
        
        batch.update(userRef, updateData);
      }
      
      await batch.commit();
      console.log(`Updated read status for ${newlyReadUsers.length} users`);
      
    } catch (error) {
      console.error('Error updating message read status:', error);
    }
  });

/**
 * Clean up old messages (optional - run periodically)
 */
exports.cleanupOldCoachAthleteMessages = functions.pubsub
  .schedule('0 2 * * 0') // Run every Sunday at 2 AM
  .onRun(async (context) => {
    try {
      console.log('Starting cleanup of old coach-athlete messages');
      
      // Delete messages older than 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      
      const oldMessagesQuery = db.collection('coach-athlete-messages')
        .where('timestamp', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
        .limit(500); // Process in batches
      
      const snapshot = await oldMessagesQuery.get();
      
      if (snapshot.empty) {
        console.log('No old messages to clean up');
        return;
      }
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Deleted ${snapshot.size} old messages`);
      
    } catch (error) {
      console.error('Error cleaning up old messages:', error);
    }
  });
