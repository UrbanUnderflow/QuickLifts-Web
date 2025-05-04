// --- Imports for newer SDK ---
// Use v2 for HTTPS and Firestore triggers as recommended for newer projects
// const {onRequest} = require("firebase-functions/v2/https"); // Example for HTTPS
const {onDocumentCreated, onDocumentUpdated} = require("firebase-functions/v2/firestore");
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


    // --- 2. Find Other Participants and Collect Tokens ---
    const tokens = [];
    try {
      const participantsSnapshot = await db.collection(userChallengeCollection)
        .where("challengeId", "==", challengeId)
        .get();

      if (participantsSnapshot.empty) {
        console.log(`No participants found for challenge ${challengeId} (this shouldn't happen).`);
        return null;
      }

      participantsSnapshot.forEach(doc => {
        const participantData = doc.data();
        // Send to everyone *except* the user who just joined
        if (participantData.userId !== newUserId && participantData.fcmToken) {
          tokens.push(participantData.fcmToken);
        }
      });

      console.log(`Found ${tokens.length} other participants with FCM tokens in challenge ${challengeId}.`);

    } catch (error) {
      console.error(`Error querying participants for challenge ${challengeId}:`, error);
      return null; // Exit if we can't get participants
    }

    // --- 3. Check if there are tokens to send to ---
    if (tokens.length === 0) {
      console.log(`No other participants with tokens found for challenge ${challengeId}. No notifications sent.`);
      return null;
    }

    // --- 4. Construct Notification Payload ---
    const payload = {
      notification: {
        title: `New Participant in "${challengeTitle}"!`,
        body: `${newUsername} just joined the challenge! 🎉`,
        // You might want to add sound, badge, etc.
        // sound: "default",
        // badge: "1", // Careful with badge count management
      },
      // You can add 'data' for handling background taps if needed
      // data: {
      //   challengeId: challengeId,
      //   type: 'NEW_PARTICIPANT'
      // }
    };

    // --- 5. Send Notifications ---
    console.log(`Sending notification to ${tokens.length} tokens.`);
    try {
      const response = await messaging.sendToDevice(tokens, payload);
      // Log results, especially failures and potentially clean up invalid tokens
      console.log(`Successfully sent message to ${response.successCount} devices.`);
      if (response.failureCount > 0) {
        console.warn(`Failed to send message to ${response.failureCount} devices.`);
        // Optional: Log specific errors or handle token cleanup
        response.results.forEach((result, index) => {
          if (!result.error) return;
          console.error(`Failure sending to token ${tokens[index]}: ${result.error}`);
          // Consider removing invalid tokens from Firestore here based on error codes
          // e.g., if (error.code === 'messaging/registration-token-not-registered') { ... remove token ... }
        });
      }
    } catch (error) {
      console.error("Error sending FCM message:", error);
      // Depending on the error, you might want the function to fail for retries
      // throw error; // Uncomment if retry is desired for send errors
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
    const userChallengeRef = change.after.ref; // Reference to the document that was updated
    const userChallengeId = event.params.userChallengeId;

    // --- Essential checks --- 
    if (!before?.challenge?.status || !after?.challenge?.status) {
        console.log(`User challenge ${userChallengeId}: Skipping update, challenge status missing in before or after state.`);
        return null;
    }
    const oldStatus = before.challenge.status;
    const newStatus = after.challenge.status;

    if (oldStatus === newStatus) {
        // console.log(`User challenge ${userChallengeId}: Status (${newStatus}) did not change. No notification needed.`);
        return null; // Status didn't change
    }

    // --- Get common data --- 
    const userId = after.userId;
    const fcmToken = after.fcmToken;
    const challengeTitle = after.challenge.title || 'Challenge';
    const challengeId = after.challengeId;

    if (!userId) {
         console.error(`User challenge ${userChallengeId}: Missing userId in 'after' data. Cannot send notification.`);
         return null;
    }
    if (!fcmToken) {
        console.log(`User challenge ${userChallengeId} (User: ${userId}): No FCM token found. Skipping notification.`);
        return null; // Skip if no token
    }

    let notificationPayload = null;
    let dataPayload = { challengeId: challengeId || '', timestamp: String(Math.floor(Date.now() / 1000)) };

    // --- Handle specific transitions --- 

    // 1. Draft -> Published (Waiting Room Notification)
    if (oldStatus === 'draft' && newStatus === 'published') {
        console.log(`User challenge ${userChallengeId}: Status change ${oldStatus} -> ${newStatus}. Sending waiting room notification.`);
        notificationPayload = {
            title: '🎉 Released from the Waiting Room!',
            body: `It's happening! The waiting room doors for "${challengeTitle}" are now open. Get ready – the challenge begins soon!`
        };
        dataPayload.type = 'challenge_published';
    }

    // 2. Published -> Active (Challenge Started Notification)
    else if (oldStatus === 'published' && newStatus === 'active') {
        console.log(`User challenge ${userChallengeId}: Status change ${oldStatus} -> ${newStatus}. Sending challenge started notification.`);
        notificationPayload = {
            title: '🏃‍♂️ Challenge Started!',
            body: `The challenge "${challengeTitle}" has begun! Get ready to compete!`
        };
        dataPayload.type = 'challenge_started';
    }

    // 3. Active -> Completed (Challenge Completed Notification)
    // (Also handles other transitions TO completed, e.g., draft->completed, published->completed)
    else if (newStatus === 'completed' && oldStatus !== 'completed') {
        console.log(`User challenge ${userChallengeId}: Status change ${oldStatus} -> ${newStatus}. Sending challenge completed notification.`);
        
        // --- Calculate Winner --- 
        // Note: calculateWinner might need adjustments based on how participants are stored 
        // It currently expects participants data within the challenge object passed to it.
        const winner = await calculateWinner(after.challenge); // Pass the challenge object from the updated data
        
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

            // Update the user-challenge doc with winner info (only needed if not already done elsewhere)
            // Consider if the Netlify function should still handle this DB update.
            // If we do it here, it might run for *every* participant completion.
            /* 
            try {
                 await userChallengeRef.update({
                     'challenge.winner': winner,
                     'challenge.finalScores': Math.floor(winner.score)
                 });
                 console.log(`User challenge ${userChallengeId}: Updated with winner info.`);
            } catch (updateError) {
                 console.error(`User challenge ${userChallengeId}: Failed to update with winner info:`, updateError);
            }
            */

        } else {
            body = `The challenge "${challengeTitle}" has ended! 🎯 What an amazing effort by everyone! Thanks for participating and keep crushing those workouts! 💪🔥`;
            dataPayload.noWinner = 'true';
        }
        
        notificationPayload = { title, body };
    }

    // --- Send the notification if a payload was created --- 
    if (notificationPayload) {
        const message = {
            notification: notificationPayload,
            data: dataPayload,
            token: fcmToken,
            apns: { /* ... APNS config ... */ 
                 headers: {
                    'apns-priority': '10',
                },
                payload: {
                    aps: {
                        alert: notificationPayload, // Use the same title/body
                        sound: 'default',
                        badge: 1
                    }
                }
            },
            android: { /* ... Android config ... */ 
                priority: 'high',
                notification: {
                    sound: 'default',
                }
            }
        };

        try {
            console.log(`Sending ${dataPayload.type || 'notification'} to user ${userId} for user challenge ${userChallengeId}.`);
            await messaging.send(message);
            console.log(`Successfully sent notification to user ${userId}.`);
            return true; // Indicate success
        } catch (error) {
            console.error(`Error sending notification to user ${userId} (UserChallenge: ${userChallengeId}):`, error);
            if (error.code === 'messaging/registration-token-not-registered') {
                 console.log(`FCM token for user ${userId} is invalid. Consider removing it.`);
                // await db.collection('users').doc(userId).update({ fcmToken: FieldValue.delete() });
            }
            return false; // Indicate failure
        }
    } else {
        // Log if status changed but wasn't one we handle notifications for
        // console.log(`User challenge ${userChallengeId}: Status change from ${oldStatus} to ${newStatus} - no specific notification defined.`);
    }

    return null; // No notification sent for this specific change
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