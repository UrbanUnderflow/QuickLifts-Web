const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
  MAX_PUSH_INSTALLATIONS,
  buildCoachAthletePushData,
  collectPulseCheckPushCandidateTokens,
  isStalePushTokenError,
  resolveCoachAthleteMessageEnvelope,
  resolvePulseCheckPushTargets,
  resolvePulseCheckSenderName,
} = require('./utils/coachAthleteMessageContract');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const PUSH_TOKEN_SUBCOLLECTION = 'pulsecheckPushTokens';
const PUSH_INSTALLATION_COLLECTION = 'pulsecheck-push-installations';
const PUSH_CLAIM_QUERY_CHUNK_SIZE = 30;

const chunk = (values, size) => {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

async function loadPulseCheckPushTargets(recipientId, userRef, userData) {
  const tokenSnapshot = await userRef
    .collection(PUSH_TOKEN_SUBCOLLECTION)
    .limit(MAX_PUSH_INSTALLATIONS)
    .get();
  const installationRecords = tokenSnapshot.docs.map((document) => ({
    id: document.id,
    data: document.data(),
  }));
  const candidates = collectPulseCheckPushCandidateTokens({
    recipientId,
    userData,
    installationRecords,
  });
  const claimRecords = [];

  for (const tokens of chunk(candidates.tokens, PUSH_CLAIM_QUERY_CHUNK_SIZE)) {
    const snapshot = await db
      .collection(PUSH_INSTALLATION_COLLECTION)
      .where('token', 'in', tokens)
      .get();
    snapshot.docs.forEach((document) => {
      claimRecords.push({
        id: document.id,
        data: document.data(),
      });
    });
  }

  return resolvePulseCheckPushTargets({
    recipientId,
    userData,
    installationRecords,
    claimRecords,
  });
}

async function deleteStaleInstallationTarget(recipientId, userRef, target) {
  for (const installation of target.installations) {
    const tokenRef = userRef
      .collection(PUSH_TOKEN_SUBCOLLECTION)
      .doc(installation.documentId);
    const claimRef = db
      .collection(PUSH_INSTALLATION_COLLECTION)
      .doc(installation.installationId);

    await db.runTransaction(async (transaction) => {
      const tokenDocument = await transaction.get(tokenRef);
      const claimDocument = await transaction.get(claimRef);
      const tokenData = tokenDocument.data() || {};
      const claimData = claimDocument.data() || {};

      if (
        tokenDocument.exists
        && tokenData.ownerUserId === recipientId
        && tokenData.installationId === installation.installationId
        && tokenData.token === target.token
      ) {
        transaction.delete(tokenRef);
      }
      if (
        claimDocument.exists
        && claimData.ownerUserId === recipientId
        && claimData.installationId === installation.installationId
        && claimData.token === target.token
      ) {
        transaction.delete(claimRef);
      }
    });
  }
}

async function deleteStaleLegacyTarget(userRef, target) {
  await db.runTransaction(async (transaction) => {
    const userDocument = await transaction.get(userRef);
    const userData = userDocument.data() || {};
    if (userDocument.exists && userData.pulseCheckFcmToken === target.token) {
      transaction.update(userRef, {
        pulseCheckFcmToken: admin.firestore.FieldValue.delete(),
        pulseCheckFcmTokenOwnerUserId: admin.firestore.FieldValue.delete(),
        pulseCheckFcmTokenUpdatedAt: admin.firestore.FieldValue.delete(),
        pushTokenSourceApp: admin.firestore.FieldValue.delete(),
      });
    }
  });
}

async function cleanupStalePushTargets(recipientId, userRef, targets, responses) {
  const cleanupTasks = [];
  responses.forEach((response, index) => {
    if (response.success || !isStalePushTokenError(response.error)) {
      return;
    }

    const target = targets[index];
    cleanupTasks.push(
      target.source === 'installation'
        ? deleteStaleInstallationTarget(recipientId, userRef, target)
        : deleteStaleLegacyTarget(userRef, target)
    );
  });
  await Promise.all(cleanupTasks);
}

function logPushSendFailures(recipientId, targets, responses) {
  const failures = responses
    .map((response, index) => ({
      response,
      target: targets[index],
    }))
    .filter(({response}) => !response.success);

  if (failures.length === 0) {
    return;
  }

  const errorCodes = [...new Set(failures.map(({response}) => (
    response.error?.code || 'unknown'
  )))];
  console.warn(
    `Coach-athlete message push failed for ${failures.length}/${targets.length} installation(s) on ${recipientId}.`,
    {errorCodes}
  );

  failures.slice(0, 5).forEach(({response, target}) => {
    console.warn('Coach-athlete message push target failure', {
      recipientId,
      source: target?.source || 'unknown',
      tokenPreview: target?.token ? `${target.token.substring(0, 12)}...` : '',
      code: response.error?.code || 'unknown',
      message: response.error?.message || '',
    });
  });

  if (errorCodes.includes('messaging/third-party-auth-error')) {
    console.error(
      'Coach-athlete iOS push failed because Firebase Messaging could not authenticate with APNs. Check the Firebase iOS app APNs auth key/certificate for com.fitwithpulse.pulsecheck.'
    );
  }
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
      logPushSendFailures(recipientId, targets, response.responses);
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
