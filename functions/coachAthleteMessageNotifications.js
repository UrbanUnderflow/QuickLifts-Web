const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
  buildCoachAthletePushData,
  resolveCoachAthleteMessageEnvelope,
  resolvePulseCheckSenderName,
} = require('./utils/coachAthleteMessageContract');
const {
  cleanupStalePushTargets,
  loadPulseCheckPushTargets,
  logPushSendFailures,
} = require('./utils/pulsecheckPushTargets');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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
      const conversationId = typeof messageData.conversationId === 'string'
        ? messageData.conversationId.trim()
        : '';
      
      console.log(`Processing new coach-athlete message: ${messageId}`);

      if (!conversationId) {
        console.error(`Message is missing a conversation id: ${messageId}`);
        return;
      }
      
      // Get conversation details
      const conversationRef = db.collection('coach-athlete-conversations').doc(conversationId);
      const conversationDoc = await conversationRef.get();
      
      if (!conversationDoc.exists) {
        console.error(`Conversation not found: ${conversationId}`);
        return;
      }
      
      const conversationData = conversationDoc.data();
      const envelope = resolveCoachAthleteMessageEnvelope(
        messageData,
        conversationData
      );
      if (!envelope) {
        console.error(`Message contract validation failed: ${messageId}`);
        return;
      }
      
      // Determine recipient
      const isFromCoach = envelope.senderType === 'coach';
      const recipientId = envelope.recipientId;
      
      console.log(`Sending notification to ${isFromCoach ? 'athlete' : 'coach'}: ${recipientId}`);
      
      // Resolve every current installation and verify canonical ownership. The
      // ownership check prevents an old account from receiving previews after
      // the same device or FCM token has moved to another account.
      const userRef = db.collection('users').doc(recipientId);
      const senderRef = db.collection('users').doc(envelope.senderId);
      const [userDoc, senderDoc] = await Promise.all([
        userRef.get(),
        senderRef.get(),
      ]);
      
      if (!userDoc.exists) {
        console.error(`Recipient user not found: ${recipientId}`);
        return;
      }
      
      const userData = userDoc.data() || {};
      const senderName = resolvePulseCheckSenderName(
        senderDoc.data() || {},
        envelope.senderType
      );
      const {targets} = await loadPulseCheckPushTargets(
        recipientId,
        userRef,
        userData
      );

      if (targets.length === 0) {
        console.log(`No PulseCheck FCM token found for user: ${recipientId}`);
        return;
      }

      console.log(
        `Resolved ${targets.length} current PulseCheck installation(s) for ${recipientId}.`
      );
      
      // Prepare notification payload
      const notificationTitle = isFromCoach ? 
        `Message from ${senderName}` : 
        `Message from ${senderName}`;
      
      const messagePreview = envelope.content;
      const notificationBody = messagePreview.length > 100
        ? `${messagePreview.substring(0, 100)}...`
        : messagePreview;
      const timestamp = timestampToISOString(messageData.timestamp);
      
      const payload = {
        tokens: targets.map(({token}) => token),
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        data: buildCoachAthletePushData({
          envelope,
          messageId,
          messagePreview: notificationBody,
          timestamp,
        }),
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
      
      const response = await admin.messaging().sendEachForMulticast(payload);
      logPushSendFailures(
        'Coach-athlete message',
        recipientId,
        targets,
        response.responses
      );
      await cleanupStalePushTargets(
        recipientId,
        userRef,
        targets,
        response.responses
      );
      console.log(
        `Sent message notification to ${response.successCount}/${targets.length} installation(s).`
      );

      if (response.successCount === 0) {
        return;
      }
    } catch (error) {
      console.error('Error sending coach-athlete message notification:', error);
    }
  });

/**
 * Clean up old messages (optional - run periodically)
 */
exports.cleanupOldCoachAthleteMessages = functions.pubsub
  .schedule('0 2 * * 0') // Run every Sunday at 2 AM
  .onRun(async (_context) => {
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
