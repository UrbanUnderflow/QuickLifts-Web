// --- Imports for newer SDK ---
// Use v2 for HTTPS and Firestore triggers as recommended for newer projects
// const {onRequest} = require("firebase-functions/v2/https"); // Example for HTTPS
const {onDocumentCreated, onDocumentUpdated, onDocumentWritten} = require("firebase-functions/v2/firestore");
// Keep admin SDK import
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore"); // Used for potential timestamp updates

// Import notification logger
const { sendNotificationWithLogging, logMulticastNotification } = require('./notificationLogger');

// Ensure Firebase Admin is initialized (likely done in index.js, but good practice)
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }
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

const userChallengeCollection = "user-challenge";
const challengesCollection = "challenges"; // Assuming this is the name

// --- ENHANCED HELPER FUNCTION WITH LOGGING --- 
/**
 * Sends a single push notification to a specific FCM token with logging.
 * @param {string} fcmToken The target device's FCM token.
 * @param {string} title Notification title.
 * @param {string} body Notification body.
 * @param {object} customData Additional data to send with the notification.
 * @param {string} notificationType Type of notification for logging (optional).
 * @returns {Promise<object>} Result object with success status and message.
 */
async function sendNotification(fcmToken, title, body, customData = {}, notificationType = 'CHALLENGE_NOTIFICATION') {
  return await sendNotificationWithLogging(
    fcmToken, 
    title, 
    body, 
    customData, 
    notificationType, 
    'challengeNotifications'
  );
}

/**
 * Sends a push notification to all participants of a challenge (except the new joiner)
 * when a new user joins the challenge.
 *
 * Triggered when a new document is created in the 'user-challenge' collection.
 */
exports.sendNewUserJoinedChallengeNotification = onDocumentCreated(`${userChallengeCollection}/{userChallengeId}`, async (event) => {
    // --- Access data using event.data ---
    const snap = event.data;
    if (!snap) {
      console.log(`No data associated with the event for ${userChallengeCollection}/${event.params.userChallengeId}. Exiting.`);
      return null;
    }
    const newUserChallengeData = snap.data();
    const newUserChallengeId = event.params.userChallengeId; // Access params from event

    if (!newUserChallengeData) {
      console.log(`No data found for new user challenge ${newUserChallengeId}. Exiting.`);
      return null;
    }

    const { challengeId, userId: newUserId, username: newUsername } = newUserChallengeData;

    if (!challengeId || !newUserId || !newUsername) {
      console.error(`Missing essential data (challengeId, userId, or username) in ${newUserChallengeId}. Cannot send notifications.`);
      return null;
    }

    console.log(`New user ${newUsername} (ID: ${newUserId}) joined challenge ${challengeId}. Preparing notifications.`);

    // --- 1. Get Challenge Title ---
    let challengeTitle = "a challenge"; // Default title
    try {
      // Attempt to get title from the trigger data first (if denormalized)
      if (newUserChallengeData.challenge && newUserChallengeData.challenge.title) {
          challengeTitle = newUserChallengeData.challenge.title;
          console.log(`Using challenge title from trigger data: "${challengeTitle}"`);
      } else {
          // Fallback: Fetch from the challenges collection
          // IMPORTANT: Adjust 'challengesCollection' if the actual collection name is different
          const challengeRef = db.collection(challengesCollection).doc(challengeId);
          const challengeDoc = await challengeRef.get();
          if (challengeDoc.exists && challengeDoc.data()?.title) { // Safe navigation
              challengeTitle = challengeDoc.data()?.title;
              console.log(`Fetched challenge title from collection: "${challengeTitle}"`);
          } else {
              console.warn(`Challenge document ${challengeId} not found or has no title. Using default title.`);
          }
      }
    } catch (error) {
        console.error(`Error fetching challenge title for ${challengeId}:`, error);
        // Continue with default title
    }


    // --- 2. Find Other Participants and Send Notifications --- 
    // Removed eligibleTokens array, sending individually now
    // const eligibleTokens = []; 
    const eligibleTokens = []; // Re-introduce for sendEachForMulticast
    const skippedUserCount = { ignored: 0, missing: 0 };
    let sentCount = 0;
    let failedCount = 0;
    
    // Define the common payload components outside the loop
    const title = `New Challenger! 🤺`; // Fixed title quoting
    const body = `${newUsername} just joined "${challengeTitle}"! Let's welcome them in the chat! 🎉`; // Escape quotes
    const dataPayload = {
        challengeId: challengeId,
        type: 'NEW_PARTICIPANT',
        newUserId: newUserId,
        newUsername: newUsername,
        timestamp: String(Math.floor(Date.now() / 1000))
    };


    try {
      const participantsSnapshot = await db.collection(userChallengeCollection)
        .where("challengeId", "==", challengeId)
        .get();

      if (participantsSnapshot.empty) {
        console.log(`No participants found for challenge ${challengeId} (this shouldn't happen).`);
        return null;
      }

      for (const doc of participantsSnapshot.docs) {
        const participantData = doc.data();
        const participantId = participantData.userId;
        const participantToken = participantData.fcmToken;
        
        // Skip if this is the user who just joined
        if (participantId === newUserId) continue;
        
        // Skip if no FCM token
        if (!participantToken) {
          skippedUserCount.missing++;
          continue;
        }

        eligibleTokens.push(participantToken); // Collect token
      }

      // --- Send using sendEachForMulticast ---
      if (eligibleTokens.length > 0) {
        const message = {
          tokens: eligibleTokens,
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

        console.log(`Sending NEW_PARTICIPANT notification via sendEachForMulticast to ${eligibleTokens.length} tokens.`);
        const response = await messaging.sendEachForMulticast(message);
        sentCount = response.successCount;
        failedCount = response.failureCount;
        
        // Log multicast notification
        await logMulticastNotification({
          tokens: eligibleTokens,
          title,
          body,
          dataPayload,
          notificationType: 'NEW_PARTICIPANT',
          functionName: 'sendNewUserJoinedChallengeNotification',
          response
        });
        
        console.log(`Finished sending NEW_PARTICIPANT notifications. Sent: ${sentCount}, Failed: ${failedCount}, Missing tokens: ${skippedUserCount.missing}.`);

        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              console.error(` - Failed sending to token [${idx}] (${eligibleTokens[idx].substring(0,10)}...): ${resp.error.code} - ${resp.error.message}`);
              // TODO: Optionally handle removing invalid tokens based on error codes like 'messaging/registration-token-not-registered'
            }
          });
        }
      } else {
          console.log(`No eligible tokens found for NEW_PARTICIPANT notification. Sent: 0, Failed: 0, Missing tokens: ${skippedUserCount.missing}.`);
      }

      // console.log(`Finished sending NEW_PARTICIPANT notifications. Sent: ${sentCount}, Failed: ${failedCount}, Missing tokens: ${skippedUserCount.missing}.`); // Moved logging inside the if/else block

    } catch (error) {
      console.error(`Error querying participants or sending notifications for challenge ${challengeId}:`, error);
      return null; // Exit if we can't get participants or encounter a major loop error
    }

    return null; // Indicate successful completion (or handled errors)
});

// --- UPDATED FUNCTION: Triggered on User Challenge Update ---
/**
 * Sends notifications based on user-challenge status changes.
 * Handles: draft -> published, published -> active, active -> completed
 *
 * Triggered when a document in the 'user-challenge' collection is updated.
 */
exports.onChallengeStatusChange = onDocumentUpdated(`${userChallengeCollection}/{userChallengeId}`, async (event) => {
    const change = event.data;
    if (!change) {
        console.log(`No change data associated with the event for ${userChallengeCollection}/${event.params.userChallengeId}. Exiting.`);
        return null;
    }
    const before = change.before.data();
    const after = change.after.data();
    const userChallengeId = event.params.userChallengeId;

    // --- Essential checks --- 
    if (!before?.challenge?.status || !after?.challenge?.status) {
        console.log(`User challenge ${userChallengeId}: Skipping update, challenge status missing in before or after state.`);
        return null;
    }
    const oldStatus = before.challenge.status;
    const newStatus = after.challenge.status;

    if (oldStatus === newStatus) {
        return null; // Status didn't change
    }

    // --- Get common data --- 
    const userId = after.userId; // User whose doc triggered this instance
    const fcmToken = after.fcmToken; // Specific user's token
    const challengeTitle = after.challenge.title || 'Challenge';
    const challengeId = after.challengeId;

    if (!challengeId) {
        console.error(`User challenge ${userChallengeId}: Missing challengeId in 'after' data. Cannot process status change.`);
        return null;
    }

    let notificationPayload = null;
    let dataPayload = { challengeId: challengeId, timestamp: String(Math.floor(Date.now() / 1000)) };
    let sendToIndividual = false; // Flag to track if we send to one or many

    // --- Handle specific transitions --- 

    // 1. Draft -> Published (Waiting Room Notification) - SEND TO ALL
    /* // REMOVED: Logic moved to onMainChallengeStatusChange
    if (oldStatus === 'draft' && newStatus === 'published') {
        console.log(`Challenge ${challengeId}: Status change ${oldStatus} -> ${newStatus}. Preparing multicast notification.`);
        notificationPayload = {
            title: '🎉 Released from the Waiting Room!',
            body: `It's happening! The waiting room doors for "${challengeTitle}" are now open. Get ready – the challenge begins soon!`
        };
        dataPayload.type = 'challenge_published';
        sendToIndividual = false;
    }
    */

    // 2. Published -> Active (Challenge Started Notification) - SEND TO ALL
    /* // REMOVED: Logic moved to onMainChallengeStatusChange
    else if (oldStatus === 'published' && newStatus === 'active') {
        console.log(`Challenge ${challengeId}: Status change ${oldStatus} -> ${newStatus}. Preparing multicast notification.`);
        notificationPayload = {
            title: '🏃‍♂️ Challenge Started!',
            body: `The challenge "${challengeTitle}" has begun! Get ready to compete!`
        };
        dataPayload.type = 'challenge_started';
        sendToIndividual = false;
    }
    */

    // 3. Active -> Completed (Challenge Completed Notification) - SEND TO INDIVIDUAL
    // Use if instead of else if now that preceding blocks are removed
    if (newStatus === 'completed' && oldStatus !== 'completed') { 
        console.log(`User challenge ${userChallengeId}: Status change ${oldStatus} -> ${newStatus}. Preparing individual notification.`);
        sendToIndividual = true; // Set flag

        const winner = await calculateWinner(after.challenge); 
        
        let title = '🎉 Challenge Complete!';
        let body = '';
        dataPayload.type = 'challenge_completed';

        if (winner) {
            const isWinner = userId === winner.userId;
            title = isWinner ? '🏆 Congratulations, Champion!' : '🏆 Challenge Complete!';
            body = isWinner
                ? `You won "${challengeTitle}" with a score of ${Math.floor(winner.score)}! Amazing work! 🔥`
                : `"${challengeTitle}" has ended! ${winner.username || 'A participant'} won with a score of ${Math.floor(winner.score)}! Thanks for participating! 💪`;
            
            dataPayload.winnerId = winner.userId;
            dataPayload.winnerUsername = winner.username || '';
            dataPayload.winnerScore = String(Math.floor(winner.score));
            dataPayload.isWinner = String(isWinner);
        } else {
            body = `The challenge "${challengeTitle}" has ended! 🎯 What an amazing effort by everyone! Thanks for participating and keep crushing those workouts! 💪🔥`;
            dataPayload.noWinner = 'true';
        }
        
        notificationPayload = { title, body };
    }

    // --- Send the notification if a payload was created --- 
    if (notificationPayload) {
        try {
            if (sendToIndividual) {
                // --- Send to the specific user --- 
                if (!fcmToken) {
                    console.log(`User challenge ${userChallengeId} (User: ${userId}): No FCM token found for individual notification. Skipping.`);
                    return null;
                }
                console.log(`Sending ${dataPayload.type || 'notification'} to individual user ${userId} for user challenge ${userChallengeId}.`);
                await sendNotification(fcmToken, notificationPayload.title, notificationPayload.body, dataPayload, 'CHALLENGE_COMPLETED');
                console.log(`Successfully sent individual notification to user ${userId}.`);

            } else {
                // --- Send to ALL participants by iterating --- 
                // REMOVED: Logic moved to onMainChallengeStatusChange
                /* 
                console.log(`Querying participants for challenge ${challengeId} to send ${dataPayload.type} notification.`);
                const participantsSnapshot = await db.collection(userChallengeCollection)
                    .where("challengeId", "==", challengeId)
                    .get();

                const eligibleTokens = []; // Re-introduce for sendEachForMulticast
                let sentCount = 0;
                let failedCount = 0;
                let missingTokenCount = 0;

                if (!participantsSnapshot.empty) {
                    for (const doc of participantsSnapshot.docs) {
                        const token = doc.data().fcmToken;
                        if (token) {
                            eligibleTokens.push(token); // Collect token
                        } else {
                            missingTokenCount++;
                            console.warn(`Participant ${doc.id} in challenge ${challengeId} is missing an FCM token.`);
                        }
                    }
                } else {
                    console.log(`No participants found for challenge ${challengeId}. No ${dataPayload.type} notifications sent.`);
                    return null; // Early exit if no participants
                }
                
                // --- Send using sendEachForMulticast ---
                if (eligibleTokens.length > 0) {
                    const message = {
                        tokens: eligibleTokens,
                        notification: notificationPayload, // Uses title/body from outer scope
                        data: dataPayload,
                        apns: {
                            payload: {
                                aps: {
                                    alert: notificationPayload, // Use the whole payload for alert
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
                    console.log(`Sending ${dataPayload.type} notification via sendEachForMulticast to ${eligibleTokens.length} tokens.`);
                    const response = await messaging.sendEachForMulticast(message);
                    sentCount = response.successCount;
                    failedCount = response.failureCount;
                    console.log(`Finished sending ${dataPayload.type} notifications. Sent: ${sentCount}, Failed: ${failedCount}, Missing tokens: ${missingTokenCount}.`);

                    if (response.failureCount > 0) {
                        response.responses.forEach((resp, idx) => {
                          if (!resp.success) {
                            console.error(` - Failed sending to token [${idx}] (${eligibleTokens[idx].substring(0,10)}...): ${resp.error.code} - ${resp.error.message}`);
                            // TODO: Optionally handle removing invalid tokens
                          }
                        });
                    }
                } else {
                    console.log(`No eligible tokens found for ${dataPayload.type} notification. Sent: 0, Failed: 0, Missing tokens: ${missingTokenCount}.`);
                }
                */
            }
            return true; // Indicate success (or handled errors)

        } catch (error) {
            console.error(`Error sending notification(s) for ${dataPayload.type} (Challenge: ${challengeId}, Trigger Doc: ${userChallengeId}):`, error);
            // Don't return false here unless you want Firebase to potentially retry the *entire* trigger
            // Logging the error is usually sufficient.
        }
    }

    return null; // No notification sent or error handled
});

// --- Add calculateWinner function (adapted from Netlify function) ---
/**
 * Calculates the winner of a challenge based on workout summaries.
 * NOTE: This requires workout summaries to be stored correctly and accessible.
 * @param {object} challenge The challenge object from the user-challenge document.
 * @returns {Promise<object|null>} The winner object { userId, username, score } or null.
 */
async function calculateWinner(challenge) {
  // Need challenge ID and participant user IDs from the input challenge object
  const challengeId = challenge?.id || challenge?.challengeId; // Get ID from challenge obj if present
  const participants = challenge?.participants || []; // Get participants array
  const startDate = challenge?.startDate; // Expecting Firestore Timestamp or similar
  const endDate = challenge?.endDate;

  if (!challengeId || participants.length === 0 || !startDate || !endDate) {
    console.error("calculateWinner: Missing required challenge data (id, participants, startDate, endDate).");
    return null;
  }

  console.log(`Calculating winner for challenge ${challengeId}...`);

  try {
    const participantScores = [];

    // Ensure dates are usable for comparison (e.g., convert Timestamps to seconds)
    const startSeconds = typeof startDate.seconds === 'number' ? startDate.seconds : Math.floor(new Date(startDate).getTime() / 1000);
    const endSeconds = typeof endDate.seconds === 'number' ? endDate.seconds : Math.floor(new Date(endDate).getTime() / 1000);

    for (const participant of participants) {
      const userId = participant.userId; // Assuming participant object has userId
      const username = participant.username || 'Unknown User'; // Get username if available

      if (!userId) {
        console.warn("Skipping participant with missing userId.");
        continue;
      }

      // Query workoutSummary collection for this user within the challenge timeframe
      const summariesRef = db.collection('users').doc(userId).collection('workoutSummary');
      const q = summariesRef
                .where('challengeId', '==', challengeId) // Filter by challengeId if summaries have it
                .where('completedAt', '>=', admin.firestore.Timestamp.fromMillis(startSeconds * 1000))
                .where('completedAt', '<=', admin.firestore.Timestamp.fromMillis(endSeconds * 1000));

      const workoutsSnapshot = await q.get();

      let totalScore = 0;
      let workoutCount = 0;
      workoutsSnapshot.forEach(doc => {
        const summary = doc.data();
        // --- Use pulsePoints.totalPoints for scoring --- 
        totalScore += summary.pulsePoints?.totalPoints || 0;
        workoutCount++;
      });

      console.log(` - User ${username} (${userId}): Score ${totalScore} from ${workoutCount} summaries.`);
      participantScores.push({
        userId: userId,
        username: username,
        score: totalScore
      });
    }

    if (participantScores.length === 0) {
       console.log("No participants found or scored for winner calculation.");
       return null;
    }

    // Sort by score descending
    participantScores.sort((a, b) => b.score - a.score);

    const winner = participantScores[0];
    console.log(`Winner determined: ${winner.username} with score ${winner.score}`);
    return winner; // Return the participant with the highest score

  } catch (error) {
    console.error(`Error calculating winner for challenge ${challengeId}:`, error);
    return null;
  }
}

// --- REMOVED sendWaitingRoomNotification helper function as it's now inline --- 


// --- NEW FUNCTION: Triggered on Workout Session Start --- 
/**
 * Sends notifications to challenge participants when a user starts a workout
 * associated with that challenge.
 *
 * Triggered when a document in 'users/{userId}/workoutSessions/{sessionId}' is created or updated
 * to 'inProgress' status and has a challengeId.
 */
exports.sendWorkoutStartNotification = onDocumentWritten("users/{userId}/workoutSessions/{sessionId}", async (event) => {
    const userId = event.params.userId; // Get userId from path params
    const sessionId = event.params.sessionId;

    console.log(`sendWorkoutStartNotification (onWrite, user subcollection) triggered for session: ${sessionId}, user: ${userId}`);
    
    const change = event.data;
    if (!change) {
        console.log(`[DEBUG onWriteUser] No change data (event.data is falsy) for session: ${sessionId}. Exiting.`);
        return null;
    }

    const beforeSnap = change.before;
    const afterSnap = change.after;

    if (!afterSnap.exists) {
        console.log(`[DEBUG onWriteUser] Session ${sessionId} was deleted. No notification needed.`);
        return null;
    }

    const afterData = afterSnap.data();
    const beforeData = beforeSnap.exists ? beforeSnap.data() : null;

    // No need to check for userId in afterData, we get it from params
    console.log(`[DEBUG onWriteUser] Session ${sessionId} for User ${userId} - Before status: ${beforeData?.workoutStatus}, After status: ${afterData?.workoutStatus}`);

    if (afterData?.workoutStatus !== 'inProgress') {
        console.log(`[DEBUG onWriteUser] Session ${sessionId}: After status is not 'inProgress' (Is: ${afterData?.workoutStatus}). No notification needed.`);
        return null;
    }

    if (beforeSnap.exists && beforeData?.workoutStatus === 'inProgress' && afterData?.workoutStatus === 'inProgress') {
        console.log(`[DEBUG onWriteUser] Session ${sessionId}: Status was already 'inProgress' and remained 'inProgress'. No notification needed.`);
        return null;
    }

    const challengeId = afterData.challengeId || afterData.collectionId;
    console.log(`[DEBUG onWriteUser] Session ${sessionId} - Extracted challengeId: ${challengeId}`);
    if (!challengeId) {
        console.log(`[DEBUG onWriteUser] Session ${sessionId} is not part of a challenge (challengeId is falsy: ${challengeId}). Skipping notification.`);
        return null;
    }

    console.log(`User ${userId} started workout session ${sessionId} for challenge ${challengeId} (onWriteUser). Preparing notifications.`);

    const workoutTitle = afterData.title || 'Workout';
    let startingUsername = 'Someone';

    // Fetch the username of the user starting the workout (using userId from params)
    try {
        const userChallengeDoc = await db.collection(userChallengeCollection)
                                       .where('userId', '==', userId) // userId from params
                                       .where('challengeId', '==', challengeId)
                                       .limit(1)
                                       .get();
        if (!userChallengeDoc.empty) {
            startingUsername = userChallengeDoc.docs[0].data().username || startingUsername;
        }
    } catch (err) {
        console.error(`Error fetching username for user ${userId} in challenge ${challengeId}:`, err);
    }

    // --- Find Other Participants and Send Notifications ---
    const eligibleTokens = [];
    const skippedUserCount = { ignored: 0, missing: 0 };
    let sentCount = 0;
    let failedCount = 0;
    
    const notificationPayload = {
        title: `🔥 Challenge Activity!`,
        body: `${startingUsername} just started "${workoutTitle}"! 💪`
    };
    const dataPayload = {
        challengeId: challengeId,
        workoutId: sessionId,
        userId: userId, // userId from params
        username: startingUsername,
        type: 'WORKOUT_STARTED',
        timestamp: String(Math.floor(Date.now() / 1000))
    };

    try {
      const participantsSnapshot = await db.collection(userChallengeCollection)
        .where("challengeId", "==", challengeId)
        .get();

      if (participantsSnapshot.empty) {
        console.log(`No participants found for challenge ${challengeId}.`);
        return null;
      }

      for (const doc of participantsSnapshot.docs) {
        const participantData = doc.data();
        const participantId = participantData.userId;
        const participantToken = participantData.fcmToken;
        
        // Skip if this is the user who started the workout (compare participantId with userId from params)
        if (participantId === userId) continue;
        
        if (!participantToken) {
          skippedUserCount.missing++;
          continue;
        }
        
        // Check if this user has ignored notifications from the workout starter (use userId from params as the senderId)
        const hasIgnoredSender = Array.isArray(participantData.ignoreNotifications) && 
                                 participantData.ignoreNotifications.includes(userId);
        
        if (hasIgnoredSender) {
          console.log(`User ${participantId} has muted notifications from ${userId}, skipping.`);
          skippedUserCount.ignored++;
          continue;
        }
        
        eligibleTokens.push(participantToken); // Collect token
      }

      // --- Send using sendEachForMulticast ---
      if (eligibleTokens.length > 0) {
          const message = {
              tokens: eligibleTokens,
              notification: notificationPayload,
              data: dataPayload,
              apns: { 
                  headers: { 'apns-priority': '5' }, 
                  payload: { aps: { sound: 'default', alert: notificationPayload } } 
              },
              android: { 
                  priority: 'normal',
                  notification: { sound: 'default', clickAction: 'FLUTTER_NOTIFICATION_CLICK' } 
              }
          };

          console.log(`Sending WORKOUT_STARTED notification via sendEachForMulticast to ${eligibleTokens.length} tokens.`);
          const response = await messaging.sendEachForMulticast(message);
          sentCount = response.successCount;
          failedCount = response.failureCount;
          
          // Log multicast notification
          await logMulticastNotification({
            tokens: eligibleTokens,
            title: notificationPayload.title,
            body: notificationPayload.body,
            dataPayload,
            notificationType: 'WORKOUT_STARTED',
            functionName: 'sendWorkoutStartNotification',
            response
          });
          
          console.log(`Finished sending WORKOUT_STARTED notifications. Sent: ${sentCount}, Failed: ${failedCount}, Ignored: ${skippedUserCount.ignored}, Missing tokens: ${skippedUserCount.missing}.`);

          if (response.failureCount > 0) {
              response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                  console.error(` - Failed sending to token [${idx}] (${eligibleTokens[idx].substring(0,10)}...): ${resp.error.code} - ${resp.error.message}`);
                  // TODO: Optionally handle removing invalid tokens
                }
              });
          }
      } else {
          console.log(`No eligible tokens found for WORKOUT_STARTED notification. Sent: 0, Failed: 0, Ignored: ${skippedUserCount.ignored}, Missing tokens: ${skippedUserCount.missing}.`);
      }

    } catch (error) {
      console.error(`Error querying participants or sending notifications for challenge ${challengeId}:`, error);
      return null; 
    }
    
    return null; // Indicate completion
}); 

// --- NEW FUNCTION: Triggered on Main Challenge Update --- 
/**
 * Sends notifications when the main challenge status changes to published or active.
 *
 * Triggered when a document in the 'challenges' collection is updated.
 * Triggered when a document in the 'sweatlist-collection' collection is updated, and its nested challenge status changes.
 */
exports.onMainChallengeStatusChange = onDocumentUpdated(`sweatlist-collection/{sweatlistId}`, async (event) => {
    const change = event.data;
    if (!change) {
        console.log(`No change data associated with the event for challenge ${event.params.challengeId}. Exiting.`);
        console.log(`No change data associated with the event for sweatlist ${event.params.sweatlistId}. Exiting.`);
        return null;
    }
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const sweatlistId = event.params.sweatlistId; // Use sweatlistId from params

    // --- Essential checks for nested challenge status --- 
    if (!beforeData?.challenge?.status || !afterData?.challenge?.status) {
        console.log(`Challenge ${event.params.challengeId}: Skipping update, status missing in before or after state.`);
        console.log(`Sweatlist ${sweatlistId}: Skipping update, challenge status missing in before or after state.`);
        return null;
    }
    const oldStatus = beforeData.challenge.status;
    const newStatus = afterData.challenge.status;

    if (oldStatus === newStatus) {
        return null; // Status didn't change
    }

    // --- Get common data --- 
    const challengeTitle = afterData.challenge.title || 'Challenge';
    const challengeId = afterData.challenge.id; // Get challenge ID from nested object

    let notificationPayload = null;
    let dataPayload = { challengeId: challengeId, timestamp: String(Math.floor(Date.now() / 1000)) };

    // --- Handle specific transitions --- 

    // 1. Draft -> Published (Waiting Room Notification)
    if (oldStatus === 'draft' && newStatus === 'published') {
        console.log(`Main Challenge ${challengeId}: Status change ${oldStatus} -> ${newStatus}. Preparing multicast notification.`);
        console.log(`Sweatlist ${sweatlistId} (Challenge ${challengeId}): Status change ${oldStatus} -> ${newStatus}. Preparing multicast notification.`);
        notificationPayload = {
            title: '🎉 Released from the Waiting Room!',
            body: `It's happening! The waiting room doors for "${challengeTitle}" are now open. Get ready – the challenge begins soon!`
        };
        dataPayload.type = 'challenge_published';
    }

    // 2. Published -> Active (Challenge Started Notification)
    else if (oldStatus === 'published' && newStatus === 'active') {
        console.log(`Main Challenge ${challengeId}: Status change ${oldStatus} -> ${newStatus}. Preparing multicast notification.`);
        console.log(`Sweatlist ${sweatlistId} (Challenge ${challengeId}): Status change ${oldStatus} -> ${newStatus}. Preparing multicast notification.`);
        notificationPayload = {
            title: '🏃‍♂️ Challenge Started!',
            body: `The challenge "${challengeTitle}" has begun! Get ready to compete!`
        };
        dataPayload.type = 'challenge_started';
    }

    // --- Send the notification if a relevant status change occurred --- 
    if (notificationPayload) {
        try {
            // --- Send to ALL participants by querying user-challenge --- 
            console.log(`Querying participants for challenge ${challengeId} to send ${dataPayload.type} notification.`);
            const participantsSnapshot = await db.collection(userChallengeCollection)
                .where("challengeId", "==", challengeId) // Use the extracted challengeId
                .get();

            const eligibleTokens = []; 
            let sentCount = 0;
            let failedCount = 0;
            let missingTokenCount = 0;

            if (!participantsSnapshot.empty) {
                participantsSnapshot.docs.forEach(doc => { // Can use forEach here as no async inside
                    const token = doc.data().fcmToken;
                    if (token) {
                        eligibleTokens.push(token);
                    } else {
                        missingTokenCount++;
                        console.warn(`Participant ${doc.id} in challenge ${challengeId} is missing an FCM token.`);
                    }
                });
            } else {
                console.log(`No participants found for challenge ${challengeId}. No ${dataPayload.type} notifications sent.`);
                return null; // Early exit if no participants
            }
            
            // --- Send using sendEachForMulticast ---
            if (eligibleTokens.length > 0) {
                const message = {
                    tokens: eligibleTokens,
                    notification: notificationPayload, 
                    data: dataPayload,
                    apns: {
                        payload: {
                            aps: {
                                alert: notificationPayload, 
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
                console.log(`Sending ${dataPayload.type} notification via sendEachForMulticast to ${eligibleTokens.length} tokens.`);
                const response = await messaging.sendEachForMulticast(message);
                sentCount = response.successCount;
                failedCount = response.failureCount;
                
                // Log multicast notification
                await logMulticastNotification({
                  tokens: eligibleTokens,
                  title: notificationPayload.title,
                  body: notificationPayload.body,
                  dataPayload,
                  notificationType: dataPayload.type.toUpperCase(),
                  functionName: 'onMainChallengeStatusChange',
                  response
                });
                
                console.log(`Finished sending ${dataPayload.type} notifications. Sent: ${sentCount}, Failed: ${failedCount}, Missing tokens: ${missingTokenCount}.`);

                if (response.failureCount > 0) {
                    response.responses.forEach((resp, idx) => {
                        if (!resp.success) {
                        console.error(` - Failed sending to token [${idx}] (${eligibleTokens[idx].substring(0,10)}...): ${resp.error.code} - ${resp.error.message}`);
                        // TODO: Optionally handle removing invalid tokens
                        }
                    });
                }
            } else {
                console.log(`No eligible tokens found for ${dataPayload.type} notification. Sent: 0, Failed: 0, Missing tokens: ${missingTokenCount}.`);
            }

        } catch (error) {
            console.error(`Error sending notification(s) for ${dataPayload.type} (Challenge: ${challengeId}):`, error);
            console.error(`Error sending notification(s) for ${dataPayload.type} (Sweatlist: ${sweatlistId}, Challenge: ${challengeId}):`, error);
        }
    }

    return null; // No relevant status change or error handled
}); 

// --- NEW FUNCTION: Send Notification on Check-in Callout ---
/**
 * Sends a notification to a user when they are called out in a check-in.
 *
 * Triggered when a new document is created in the 'checkins' collection.
 */
exports.sendCheckinCalloutNotification = onDocumentCreated("checkins/{checkinId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    console.log(`No data associated with the event for checkins/${event.params.checkinId}. Exiting.`);
    return null;
  }
  const checkinData = snap.data();
  const checkinId = event.params.checkinId;

  if (!checkinData) {
    console.log(`No data found for new check-in ${checkinId}. Exiting.`);
    return null;
  }

  const { 
    originalChallengerUserId, 
    originalChallengerFCMToken, 
    calloutUserFCMToken, 
    user: checkinUser, // This is the user performing the current check-in
    calloutUser,       // This is the user who was called out (if it's an initial callout)
    roundId       // Assuming challengeId is present in checkinData
  } = checkinData;

  // Determine the effective challengeId - use challengeId if available, otherwise fallback to roundId
  const effectiveChallengeId = roundId;

  const responderUsername = checkinUser?.username || "Someone"; // User who is responding to a callout

  // Scenario 1: This is a RESPONSE to a callout
  if (originalChallengerUserId && originalChallengerFCMToken) {
    console.log(`Check-in ${checkinId}: User ${responderUsername} (ID: ${checkinUser?.id}) responded to callout from ${originalChallengerUserId}.`);

    if (!effectiveChallengeId) {
      console.error(`Check-in ${checkinId} (Callout Response): Missing challengeId and roundId. Cannot award points.`);
      // Proceed with notification but log error for points
    }

    // --- Award Points ---
    if (effectiveChallengeId) {
      try {
        // Award 25 points to Responder (changed from 50)
        const responderUserChallengeRef = db.collection(userChallengeCollection)
                                          .where("userId", "==", checkinUser?.id)
                                          .where("challengeId", "==", effectiveChallengeId)
                                          .limit(1);
        const responderUserChallengeSnap = await responderUserChallengeRef.get();
        if (!responderUserChallengeSnap.empty) {
          const userChallengeDoc = responderUserChallengeSnap.docs[0];
          const currentPoints = userChallengeDoc.data().pulsePoints?.peerChallengeBonus || 0;
          await userChallengeDoc.ref.update({ 
            "pulsePoints.peerChallengeBonus": currentPoints + 25, // Changed from 50 to 25
            "pulsePoints.totalPoints": FieldValue.increment(25) // Changed from 50 to 25
          });
          console.log(`Awarded 25 peerChallengeBonus points to responder ${checkinUser?.id} for challenge ${effectiveChallengeId}.`);
        } else {
          console.warn(`Could not find user-challenge for responder ${checkinUser?.id} in challenge ${effectiveChallengeId}.`);
        }

        // Award 50 points to Original Challenger (changed from 25)
        const originalChallengerUserChallengeRef = db.collection(userChallengeCollection)
                                                  .where("userId", "==", originalChallengerUserId)
                                                  .where("challengeId", "==", effectiveChallengeId)
                                                  .limit(1);
        const originalChallengerUserChallengeSnap = await originalChallengerUserChallengeRef.get();
        if (!originalChallengerUserChallengeSnap.empty) {
          const userChallengeDoc = originalChallengerUserChallengeSnap.docs[0];
          const currentPoints = userChallengeDoc.data().pulsePoints?.peerChallengeBonus || 0;
          await userChallengeDoc.ref.update({ 
            "pulsePoints.peerChallengeBonus": currentPoints + 50, // Changed from 25 to 50
            "pulsePoints.totalPoints": FieldValue.increment(50) // Changed from 25 to 50
           });
          console.log(`Awarded 50 peerChallengeBonus points to original challenger ${originalChallengerUserId} for challenge ${effectiveChallengeId}.`);
        } else {
          console.warn(`Could not find user-challenge for original challenger ${originalChallengerUserId} in challenge ${effectiveChallengeId}.`);
        }
      } catch (pointError) {
        console.error(`Error awarding points for callout response on check-in ${checkinId}:`, pointError);
      }
    }

    // --- Send Notification to Original Challenger ---
    const title = `🔗 Chain Linked!`;
    const body = `${responderUsername} completed the chain! You earned +50 points! Now it's up to them to continue the chain. 🔥`;
    const dataPayload = {
      checkinId: checkinId,
      responderId: checkinUser?.id || '',
      responderUsername: responderUsername,
      originalChallengerId: originalChallengerUserId,
      type: 'CALLOUT_ANSWERED',
      timestamp: String(Math.floor(Date.now() / 1000))
    };

    // Only add challengeId to payload if it exists and is not empty
    if (effectiveChallengeId) {
      dataPayload.challengeId = effectiveChallengeId;
    }

    try {
      await sendNotification(originalChallengerFCMToken, title, body, dataPayload, 'CALLOUT_ANSWERED');
      console.log(`Successfully sent CALLOUT_ANSWERED notification for check-in ${checkinId} to original challenger ${originalChallengerUserId}.`);
    } catch (error) {
      console.error(`Error sending CALLOUT_ANSWERED notification for check-in ${checkinId} to original challenger ${originalChallengerUserId}:`, error);
    }

  // Scenario 2: This is an INITIAL callout
  } else if (calloutUserFCMToken) {
    const initialChallengerUsername = checkinUser?.username || "Someone"; // User performing the initial callout
    
    if (!calloutUser || !calloutUser.id) {
      console.log(`Check-in ${checkinId} (Initial Callout): calloutUser data is missing or incomplete. No notification will be sent.`);
      return null;
    }
    
    console.log(`Check-in ${checkinId}: User ${initialChallengerUsername} called out user ID ${calloutUser.id}. Preparing notification to token ${calloutUserFCMToken.substring(0,10)}...`);

    const title = `⛓️ ${initialChallengerUsername} Chained You!`;
    const body = `You've been called out to join the chain! Post your check-in today to claim +25 points and keep it alive! 🔥`;

    const dataPayload = {
      checkinId: checkinId,
      challengerId: checkinUser?.id || '',
      challengerUsername: initialChallengerUsername,
      chainedUserId: calloutUser.id, // Updated from calloutUserId
      type: 'CHECKIN_CHAIN', // Updated from CHECKIN_CALLOUT
      timestamp: String(Math.floor(Date.now() / 1000))
    };

    // Only add challengeId to payload if it exists and is not empty
    if (effectiveChallengeId) {
      dataPayload.challengeId = effectiveChallengeId;
    }

    try {
      await sendNotification(calloutUserFCMToken, title, body, dataPayload, 'CHECKIN_CALLOUT');
      console.log(`Successfully sent CHECKIN_CALLOUT notification for check-in ${checkinId} to user ID ${calloutUser.id}.`);
    } catch (error) {
      console.error(`Error sending CHECKIN_CALLOUT notification for check-in ${checkinId} to user ID ${calloutUser.id}:`, error);
    }
  } else {
    console.log(`Check-in ${checkinId}: Neither a callout response nor an initial callout with FCM token. No notification sent.`);
  }

  return null;
}); 

// --- NEW FUNCTION: Handle Referral Bonus ---
/**
 * Firebase Function to handle referral bonuses when a new UserChallenge is created
 * Triggers on: user-challenge/{docId} onCreate
 */
exports.handleReferralBonus = onDocumentCreated(`${userChallengeCollection}/{userChallengeId}`, async (event) => {
    try {
      const snap = event.data;
      if (!snap) {
        console.log(`[Referral Bonus] No data associated with the event for ${userChallengeCollection}/${event.params.userChallengeId}. Exiting.`);
        return null;
      }
      
      const newUserChallenge = snap.data();
      const userChallengeId = event.params.userChallengeId;
      
      console.log(`[Referral Bonus] Processing new UserChallenge: ${userChallengeId}`);
      
      // Check if this UserChallenge has a referral chain with a sharedBy value
      const referralChain = newUserChallenge.referralChain;
      if (!referralChain || !referralChain.sharedBy || referralChain.sharedBy === '') {
        console.log(`[Referral Bonus] No referral chain or sharedBy value found for UserChallenge: ${userChallengeId}`);
        return null;
      }
      
      const referrerId = referralChain.sharedBy;
      const newUserId = newUserChallenge.userId;
      const challengeId = newUserChallenge.challengeId;
      
      // Don't award bonus if user referred themselves
      if (referrerId === newUserId) {
        console.log(`[Referral Bonus] User ${newUserId} referred themselves, skipping bonus`);
        return null;
      }
      
      console.log(`[Referral Bonus] Looking for referrer ${referrerId} in challenge ${challengeId}`);
      
      // Find the referrer's UserChallenge for this specific challenge
      const referrerQuery = await db.collection(userChallengeCollection)
        .where('userId', '==', referrerId)
        .where('challengeId', '==', challengeId)
        .limit(1)
        .get();
      
      if (referrerQuery.empty) {
        console.log(`[Referral Bonus] Referrer ${referrerId} not found in challenge ${challengeId}. They may not be a participant yet.`);
        return null;
      }
      
      const referrerDoc = referrerQuery.docs[0];
      const referrerUserChallenge = referrerDoc.data();
      const referrerDocId = referrerDoc.id;
      
      console.log(`[Referral Bonus] Found referrer ${referrerUserChallenge.username} (${referrerId}) in challenge ${challengeId}`);
      
      // Award 25 points to the referrer
      const currentReferralBonus = referrerUserChallenge.pulsePoints?.referralBonus || 0;
      const newReferralBonus = currentReferralBonus + 25;
      
      // Update the referrer's UserChallenge with bonus points
      await db.collection(userChallengeCollection).doc(referrerDocId).update({
        'pulsePoints.referralBonus': newReferralBonus,
        'pulsePoints.totalPoints': FieldValue.increment(25), // Also update total points
        'updatedAt': dateToUnixTimestamp(new Date())
      });
      
      console.log(`[Referral Bonus] Successfully awarded 25 points to ${referrerUserChallenge.username} (${referrerId}). New referral bonus total: ${newReferralBonus}`);
      
      // Send push notification to referrer
      const referrerFcmToken = referrerUserChallenge.fcmToken;
      if (referrerFcmToken && referrerFcmToken !== '') {
        try {
          // Get challenge title for notification
          const challengeDoc = await db.collection('sweatlist-collection').doc(challengeId).get();
          const challengeTitle = challengeDoc.exists ? 
            (challengeDoc.data().challenge?.title || challengeDoc.data().title || 'Challenge') : 
            'Challenge';
          
          const title = '💰 +25 Pulse Points!';
          const body = `Your friend ${newUserChallenge.username} just joined "${challengeTitle}" using your link! You earned 25 points.`;
          const dataPayload = {
            type: 'referral_join_bonus',
            challengeId: challengeId,
            userId: referrerId,
            referredUserId: newUserId,
            referredUsername: newUserChallenge.username || 'Unknown',
            pointsEarned: '25',
            timestamp: String(Math.floor(Date.now() / 1000))
          };
          
          await sendNotification(referrerFcmToken, title, body, dataPayload, 'REFERRAL_BONUS');
          console.log(`[Referral Bonus] Successfully sent notification to ${referrerUserChallenge.username} (${referrerId})`);
          
        } catch (notificationError) {
          console.error(`[Referral Bonus] Failed to send notification to ${referrerId}:`, notificationError);
          // Don't fail the entire function if notification fails
        }
      } else {
        console.log(`[Referral Bonus] No FCM token found for referrer ${referrerId}, skipping notification`);
      }
      
      // Log successful referral bonus for analytics
      console.log(`[Referral Bonus] COMPLETED: Referrer ${referrerUserChallenge.username} (${referrerId}) earned 25 points for referring ${newUserChallenge.username} (${newUserId}) to challenge ${challengeId}`);
      
      return null;
      
    } catch (error) {
      console.error('[Referral Bonus] Error processing referral bonus:', error);
      // Don't throw error to avoid retries - log and continue
      return null;
    }
});

// --- Import for HTTPS functions ---
const {onCall} = require("firebase-functions/v2/https");

// --- Removed processRetroactiveReferralBonuses function ---
// This functionality is better handled by the existing Netlify function /netlify/functions/link-referral.js
// which provides more precise control for individual referral cases through the admin UI 

// --- NEW FUNCTION: Send Chain Reaction Notification for Daily Reflections ---
/**
 * Sends notifications to challenge participants when a new daily reflection is created
 * that's linked to their challenge, announcing a "Chain Reaction" event.
 *
 * Triggered when a new document is created in the 'daily-reflections' collection.
 */
exports.sendChainReactionNotification = onDocumentCreated("daily-reflections/{reflectionId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    console.log(`No data associated with the event for daily-reflections/${event.params.reflectionId}. Exiting.`);
    return null;
  }
  
  const reflectionData = snap.data();
  const reflectionId = event.params.reflectionId;

  if (!reflectionData) {
    console.log(`No data found for new daily reflection ${reflectionId}. Exiting.`);
    return null;
  }

  const { challengeId, text: reflectionText } = reflectionData;

  // Only proceed if this reflection is linked to a challenge
  if (!challengeId) {
    console.log(`Daily reflection ${reflectionId} is not linked to a challenge. No Chain Reaction notification needed.`);
    return null;
  }

  console.log(`Daily reflection ${reflectionId} created for challenge ${challengeId}. Preparing Chain Reaction notifications.`);

  // --- 1. Get Challenge Title ---
  let challengeTitle = "a challenge";
  try {
    const challengeRef = db.collection('sweatlist-collection').doc(challengeId);
    const challengeDoc = await challengeRef.get();
    if (challengeDoc.exists && challengeDoc.data()?.challenge?.title) {
      challengeTitle = challengeDoc.data().challenge.title;
      console.log(`Fetched challenge title: "${challengeTitle}"`);
    } else {
      console.warn(`Challenge document ${challengeId} not found or has no title. Using default title.`);
    }
  } catch (error) {
    console.error(`Error fetching challenge title for ${challengeId}:`, error);
  }

  // --- 2. Find Challenge Participants and Send Notifications ---
  const eligibleTokens = [];
  let sentCount = 0;
  let failedCount = 0;
  let missingTokenCount = 0;

  // Define the notification payload
  const title = `⛓️‍💥 Chain Event!`;
  const body = `A special reflection has been shared for "${challengeTitle}"! Join the chain and earn up to +75 bonus points! 🔥`;
  const dataPayload = {
    challengeId: challengeId,
    reflectionId: reflectionId,
    type: 'CHAIN_REACTION',
    maxBonusPoints: '75',
    timestamp: String(Math.floor(Date.now() / 1000))
  };

  try {
    const participantsSnapshot = await db.collection(userChallengeCollection)
      .where("challengeId", "==", challengeId)
      .get();

    if (participantsSnapshot.empty) {
      console.log(`No participants found for challenge ${challengeId}. No Chain notifications sent.`);
      return null;
    }

    // Collect eligible FCM tokens
    for (const doc of participantsSnapshot.docs) {
      const participantData = doc.data();
      const participantToken = participantData.fcmToken;
      
      if (!participantToken) {
        missingTokenCount++;
        console.warn(`Participant ${doc.id} in challenge ${challengeId} is missing an FCM token.`);
        continue;
      }
      
      eligibleTokens.push(participantToken);
    }

    // --- Send using sendEachForMulticast ---
    if (eligibleTokens.length > 0) {
      const message = {
        tokens: eligibleTokens,
        notification: { title, body },
        data: dataPayload,
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              badge: 1,
              sound: 'chain_reaction.mp3' // Custom sound for chain reaction events
            },
          },
        },
        android: {
          priority: 'high',
          notification: { 
            sound: 'chain_reaction', // Custom sound for Android (without extension)
            channelId: 'chain_events' // Custom notification channel for chain events
          }
        }
      };

      console.log(`Sending CHAIN_REACTION notification via sendEachForMulticast to ${eligibleTokens.length} tokens.`);
      const response = await messaging.sendEachForMulticast(message);
      sentCount = response.successCount;
      failedCount = response.failureCount;
      
      // Log multicast notification
      await logMulticastNotification({
        tokens: eligibleTokens,
        title,
        body,
        dataPayload,
        notificationType: 'CHAIN_REACTION',
        functionName: 'sendChainReactionNotification',
        response
      });
      
      console.log(`Finished sending CHAIN_REACTION notifications. Sent: ${sentCount}, Failed: ${failedCount}, Missing tokens: ${missingTokenCount}.`);

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(` - Failed sending to token [${idx}] (${eligibleTokens[idx].substring(0,10)}...): ${resp.error.code} - ${resp.error.message}`);
          }
        });
      }
    } else {
      console.log(`No eligible tokens found for CHAIN_REACTION notification. Sent: 0, Failed: 0, Missing tokens: ${missingTokenCount}.`);
    }

  } catch (error) {
    console.error(`Error querying participants or sending Chain Reaction notifications for challenge ${challengeId}:`, error);
    return null;
  }

  return null;
}); 

// --- Import for HTTPS functions --- 