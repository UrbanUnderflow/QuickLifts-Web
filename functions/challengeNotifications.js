// --- Imports for newer SDK ---
// Use v2 for HTTPS and Firestore triggers as recommended for newer projects
// const {onRequest} = require("firebase-functions/v2/https"); // Example for HTTPS
const {onDocumentCreated, onDocumentUpdated, onDocumentWritten} = require("firebase-functions/v2/firestore");
// Keep admin SDK import
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore"); // Used for potential timestamp updates

// Ensure Firebase Admin is initialized (likely done in index.js, but good practice)
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }
const db = admin.firestore();
const messaging = admin.messaging();

const userChallengeCollection = "user-challenge";
const challengesCollection = "challenges"; // Assuming this is the name

// --- COPIED HELPER FUNCTION --- 
/**
 * Sends a single push notification to a specific FCM token.
 * (Copied from sendSingleNotification.js for reuse)
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
    console.log('Helper: Successfully sent notification:', response);
    return { success: true, message: 'Notification sent successfully.' };
  } catch (error) {
    console.error('Helper: Error sending notification:', error);
    if (error.code === 'messaging/registration-token-not-registered') {
      console.log(`Helper: Invalid FCM token: ${fcmToken}. Consider removing it.`);
    }
    // Re-throw to be caught by caller
    throw error;
  }
}
// --- END HELPER FUNCTION ---

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
        
        // --- 4. Construct Notification Payload (moved inside loop) --- 
        /* // Payload definition moved outside loop
        const title = `New Challenger! 🤺`; // Fixed title quoting
        const body = `${newUsername} just joined "${challengeTitle}"! Let's welcome them in the chat! 🎉`; // Escape quotes
        const dataPayload = {
            challengeId: challengeId,
            type: 'NEW_PARTICIPANT',
            newUserId: newUserId,
            newUsername: newUsername,
            timestamp: String(Math.floor(Date.now() / 1000))
        };
        */

        // --- 5. Send Notification (moved inside loop) ---
        /* // Replaced with collecting tokens
        try {
            console.log(`Sending NEW_PARTICIPANT notification to user ${participantId} (${participantToken.substring(0,10)}...)`);
            await sendNotification(participantToken, title, body, dataPayload);
            sentCount++;
        } catch (error) {
            failedCount++;
            console.error(`Error sending NEW_PARTICIPANT notification to ${participantId} (token: ${participantToken.substring(0,10)}...):`, error);
            // Error already logged within sendNotification helper, don't need to re-log full details unless desired
        }
        */
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
                await sendNotification(fcmToken, notificationPayload.title, notificationPayload.body, dataPayload);
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
    const workoutRoundId = event.params.workoutRoundId;

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
        workoutRoundId: workoutRoundId,
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