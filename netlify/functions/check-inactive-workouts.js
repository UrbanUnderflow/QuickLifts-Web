// netlify/functions/check-inactive-workouts.js

const { admin, db, headers } = require('./config/firebase'); // Adjust path if needed

// Configuration
const INACTIVITY_THRESHOLD_HOURS = 2;
const INACTIVITY_THRESHOLD_MS = INACTIVITY_THRESHOLD_HOURS * 60 * 60 * 1000;

/**
 * Sends a push notification using Firebase Admin SDK.
 * @param {string} fcmToken - The recipient's FCM token.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 * @param {object} [customData={}] - Additional data payload.
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendNotification(fcmToken, title, body, customData = {}) {
    if (!fcmToken) {
        console.warn('Attempted to send notification but no FCM token was provided.');
        return { success: false, message: 'No FCM token provided.' };
    }

    const messaging = admin.messaging();

    // Ensure all data values are strings as required by FCM
    const stringifiedData = Object.entries(customData).reduce((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
    }, {});

    const message = {
        token: fcmToken,
        notification: {
            title: title,
            body: body,
        },
        data: stringifiedData, // Use the stringified data
        apns: { // iOS specific settings
            payload: {
                aps: {
                    alert: { // Rich notification structure
                        title: title,
                        body: body,
                    },
                    badge: 1, // Optional: Set badge count
                    sound: 'default' // Optional: Play default sound
                },
            },
        },
        android: { // Optional: Android specific settings
            notification: {
              sound: 'default'
            }
        }
    };

    try {
        const response = await messaging.send(message);
        console.log(`Successfully sent notification to token starting with ${fcmToken.substring(0, 10)}...:`, response);
        return { success: true, message: 'Notification sent successfully.' };
    } catch (error) {
        console.error(`Error sending notification to token starting with ${fcmToken.substring(0, 10)}...:`, error);
        // Handle specific errors if needed, e.g., 'messaging/registration-token-not-registered'
        if (error.code === 'messaging/registration-token-not-registered') {
             console.warn(`Token ${fcmToken.substring(0, 10)}... is invalid. Consider removing it.`);
             // Optional: Add logic here to remove the invalid token from the user's record in Firestore.
        }
        // Don't throw, allow the function to continue processing other users
        return { success: false, message: `Error sending notification: ${error.message}` };
    }
}

exports.handler = async (event) => {
    console.log('Starting check-inactive-workouts function...');
    const now = Date.now();
    const cutoffTime = now - INACTIVITY_THRESHOLD_MS;
    let inactiveUsersCount = 0;
    let notificationAttempts = 0;
    let notificationSuccesses = 0;

    const batch = db.batch();
    const updatesToCommit = []; // Track refs to update
    const usersToUpdate = new Set(); // Track unique user IDs to update in users collection

    try {
        // Query for active user challenges
        const snapshot = await db.collection('user-challenge')
                                 .where('isCurrentlyActive', '==', true)
                                 .get();

        if (snapshot.empty) {
            console.log('No active user challenges found.');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'No active challenges to check.' })
            };
        }

        console.log(`Found ${snapshot.docs.length} active user challenges to check.`);

        for (const doc of snapshot.docs) {
            const challengeData = doc.data();
            const docId = doc.id; // UserChallenge doc ID (often same as userId)
            const userId = challengeData.userId; // Explicit userId field

            if (!userId) {
                console.warn(`Skipping challenge ${docId}: Missing userId.`);
                continue;
            }

            const lastActiveTimestamp = challengeData.lastActive ?
                (challengeData.lastActive._seconds * 1000 + (challengeData.lastActive._nanoseconds || 0) / 1000000) :
                null;

            // Check if lastActive exists and is older than the threshold
            if (lastActiveTimestamp && lastActiveTimestamp < cutoffTime) {
                inactiveUsersCount++;
                console.log(`User challenge ${docId} (User: ${userId}) is inactive (threshold exceeded). Last active: ${new Date(lastActiveTimestamp).toISOString()}. Marking inactive and notifying.`);

                // Mark for update in the batch
                updatesToCommit.push(doc.ref);
                usersToUpdate.add(userId); // Track user to update in users collection

                // Prepare and send notification
                const fcmToken = challengeData.fcmToken; // Get FCM token from the challenge doc
                const username = challengeData.username || 'there';

                if (fcmToken) {
                    console.log(`Attempting to send inactive workout notification to User: ${userId}`);
                    notificationAttempts++;
                    const notificationResult = await sendNotification(
                        fcmToken,
                        'Still working out? 💪',
                        `Hey ${username}, your Pulse workout session is still running. Don't forget to end it if you're finished!`,
                        {
                            type: 'inactive_workout_reminder', // Custom data for client handling
                            userId: userId,
                            challengeId: challengeData.challengeId || ''
                        }
                    );
                    if (notificationResult.success) {
                         notificationSuccesses++;
                    }
                } else {
                    console.warn(`User challenge ${docId} (User: ${userId}) is inactive but has no FCM token. Marking inactive.`);
                }
            } else if (!lastActiveTimestamp) {
                 console.warn(`User challenge ${docId} (User: ${userId}) is active but has no 'lastActive' timestamp. Marking inactive without notification.`);
                 // Mark for update in the batch because lastActive is missing
                 updatesToCommit.push(doc.ref);
                 usersToUpdate.add(userId); // Track user to update in users collection
                 // Do not increment inactiveUsersCount or send notification for this case
            } else {
                // lastActiveTimestamp exists and is within the threshold - do nothing
                console.log(`User challenge ${docId} (User: ${userId}) is still active (within threshold). Last active: ${new Date(lastActiveTimestamp).toISOString()}.`);
            }
        }

        // Commit the batch update if there are users to mark as inactive
        if (updatesToCommit.length > 0) {
            console.log(`Marking ${updatesToCommit.length} user challenges as inactive.`);
            updatesToCommit.forEach(ref => {
                batch.update(ref, {
                    isCurrentlyActive: false,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp() // Use server timestamp
                });
            });
            
            // Also update the users collection for each unique user
            console.log(`Updating ${usersToUpdate.size} user documents in users collection.`);
            usersToUpdate.forEach(userId => {
                const userRef = db.collection('users').doc(userId);
                batch.update(userRef, {
                    isCurrentlyActive: false,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            
            await batch.commit();
            console.log('Batch update successful (user-challenge and users collections updated).');
        } else {
            console.log('No user challenges needed to be marked as inactive.');
        }

        const summaryMessage = `Check complete. Found ${inactiveUsersCount} inactive sessions. Attempted ${notificationAttempts} notifications, ${notificationSuccesses} succeeded. Marked ${updatesToCommit.length} challenges as inactive.`;
        console.log(summaryMessage);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: summaryMessage,
                inactiveSessionsFound: inactiveUsersCount,
                notificationsAttempted: notificationAttempts,
                notificationsSucceeded: notificationSuccesses,
                sessionsMarkedInactive: updatesToCommit.length
            })
        };

    } catch (error) {
        console.error('Error checking for inactive workouts:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message || 'Unknown server error.' })
        };
    }
};