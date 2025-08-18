const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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
      
      const userData = userDoc.data();
      const fcmToken = userData.fcmToken;
      
      if (!fcmToken) {
        console.log(`No FCM token found for user: ${recipientId}`);
        return;
      }
      
      // Prepare notification payload
      const notificationTitle = isFromCoach ? 
        `Message from ${senderName}` : 
        `Message from ${senderName}`;
      
      const notificationBody = messageData.content.length > 100 ? 
        `${messageData.content.substring(0, 100)}...` : 
        messageData.content;
      
      const payload = {
        token: fcmToken,
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: {
          type: 'coach_athlete_message',
          conversationId: messageData.conversationId,
          senderId: messageData.senderId,
          senderType: messageData.senderType,
          messageId: messageId,
          timestamp: messageData.timestamp.toDate().toISOString()
        },
        apns: {
          payload: {
            aps: {
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
