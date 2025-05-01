const functions = require("firebase-functions");
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
exports.sendNewUserJoinedChallengeNotification = functions.firestore
  .document(`${userChallengeCollection}/{userChallengeId}`)
  .onCreate(async (snap, context) => {
    const newUserChallengeData = snap.data();
    const newUserChallengeId = context.params.userChallengeId; // Document ID of the user-challenge entry

    if (!newUserChallengeData) {
      console.log(`No data found for new user challenge ${newUserChallengeId}. Exiting.`);
      return null;
    }

    const { challengeId, userId: newUserId, username: newUsername, fcmToken: newUserFcmToken } = newUserChallengeData;

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
          const challengeRef = db.collection(challengesCollection).doc(challengeId);
          const challengeDoc = await challengeRef.get();
          if (challengeDoc.exists && challengeDoc.data().title) {
              challengeTitle = challengeDoc.data().title;
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