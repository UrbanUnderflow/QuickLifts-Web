const { admin, db, headers } = require('./config/firebase');

// Configuration
const INACTIVITY_THRESHOLD_DAYS = 3; // Number of days before a user is considered inactive
const INACTIVITY_THRESHOLD_MS = INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

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
            // Optional: Add logic here to remove the invalid token from the user's record in Firestore
        }
        // Don't throw, allow the function to continue processing other users
        return { success: false, message: `Error sending notification: ${error.message}` };
    }
}

/**
 * Formats a timestamp (Firestore timestamp or Date) to a Date object
 * @param {object|Date} timestamp - Firestore timestamp or Date object
 * @returns {Date|null} JavaScript Date object or null if invalid
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return null;
    
    // Handle Firestore timestamp
    if (timestamp._seconds !== undefined) {
        return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
    }
    
    // Handle JavaScript Date
    if (timestamp instanceof Date) {
        return timestamp;
    }
    
    // Handle Unix timestamp (seconds)
    if (typeof timestamp === 'number') {
        return new Date(timestamp * 1000);
    }
    
    return null;
}

exports.handler = async (event, context) => {
    // Check if request method is POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method not allowed. Please use POST.' })
        };
    }

    // Parse request body
    let requestBody;
    try {
        requestBody = JSON.parse(event.body || '{}');
    } catch (error) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ success: false, message: 'Invalid JSON in request body.' })
        };
    }

    // Extract parameters from request
    const testMode = !!requestBody.testMode;
    const simulationMode = !!requestBody.simulationMode;

    console.log(`Starting workout inactivity check... Test Mode: ${testMode}, Simulation Mode: ${simulationMode}`);

    const now = Date.now();
    const cutoffTime = now - INACTIVITY_THRESHOLD_MS;
    let userChallengesProcessed = 0;
    let inactiveUsersFound = 0;
    let notificationsTriggered = 0;
    let simulatedUpdates = [];

    const batch = db.batch();
    const updatesToCommit = []; // Track refs to update

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
                body: JSON.stringify({
                    success: true,
                    message: 'No active challenges to check.',
                    results: {
                        userChallengesProcessed: 0,
                        inactiveUsersFound: 0,
                        notificationsTriggered: 0,
                        timestamp: now,
                        testMode,
                        simulationMode,
                        simulatedUpdates: []
                    }
                })
            };
        }

        userChallengesProcessed = snapshot.docs.length;
        console.log(`Found ${userChallengesProcessed} active user challenges to check.`);

        for (const doc of snapshot.docs) {
            const challengeData = doc.data();
            const docId = doc.id;
            const userId = challengeData.userId;
            const username = challengeData.username || 'User';
            const challengeId = challengeData.challengeId || '';
            const challengeTitle = challengeData.challenge?.title || '';

            if (!userId) {
                console.warn(`Skipping challenge ${docId}: Missing userId.`);
                continue;
            }

            // Format lastActive timestamp to Date object
            const lastActiveDate = formatTimestamp(challengeData.lastActive);
            const lastActiveTime = lastActiveDate ? lastActiveDate.getTime() : null;

            // Check if lastActive exists and is older than the threshold
            if ((lastActiveTime && lastActiveTime < cutoffTime) || !lastActiveTime) {
                inactiveUsersFound++;
                console.log(`User challenge ${docId} (User: ${userId}) is inactive. Last active: ${lastActiveDate ? lastActiveDate.toISOString() : 'Never'}`);

                // In simulation mode, just collect information but don't update or send notifications
                if (simulationMode) {
                    simulatedUpdates.push({
                        userId,
                        username,
                        challengeId,
                        challengeTitle,
                        lastActive: lastActiveDate
                    });
                    continue;
                }

                // Mark for update in the batch (if not in test or simulation mode)
                if (!testMode) {
                    updatesToCommit.push(doc.ref);
                }

                // Prepare and send notification (if not in simulation mode)
                const fcmToken = challengeData.fcmToken;

                if (fcmToken && !testMode) {
                    console.log(`Attempting to send inactivity notification to User: ${userId}`);
                    const notificationResult = await sendNotification(
                        fcmToken,
                        'Pulse Challenge Check-in',
                        `Hey ${username}, it's been a while since your last workout. Keep up your progress by doing a workout today!`,
                        {
                            type: 'challenge_inactivity_reminder',
                            userId,
                            challengeId
                        }
                    );
                    if (notificationResult.success) {
                        notificationsTriggered++;
                    }
                } else if (!fcmToken) {
                    console.warn(`User challenge ${docId} (User: ${userId}) is inactive but has no FCM token. Skipping notification.`);
                }
            } else {
                // User is still active - within the threshold
                console.log(`User challenge ${docId} (User: ${userId}) is still active. Last active: ${lastActiveDate ? lastActiveDate.toISOString() : 'Unknown'}`);
            }
        }

        // Commit the batch update if there are users to mark as inactive and not in test or simulation mode
        if (!testMode && !simulationMode && updatesToCommit.length > 0) {
            console.log(`Marking ${updatesToCommit.length} user challenges as inactive.`);
            updatesToCommit.forEach(ref => {
                batch.update(ref, {
                    isCurrentlyActive: false,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
            console.log('Batch update successful.');
        } else {
            console.log(`${testMode ? 'Test mode: ' : simulationMode ? 'Simulation mode: ' : ''}No user challenges updated.`);
        }

        const summaryMessage = `Check complete. Processed ${userChallengesProcessed} challenges, found ${inactiveUsersFound} inactive users.${!simulationMode ? ` Sent ${notificationsTriggered} notifications.` : ''} ${!testMode && !simulationMode ? `Updated ${updatesToCommit.length} records.` : ''}`;
        console.log(summaryMessage);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: summaryMessage,
                results: {
                    userChallengesProcessed,
                    inactiveUsersFound,
                    notificationsTriggered,
                    timestamp: now,
                    testMode,
                    simulationMode,
                    simulatedUpdates: simulationMode ? simulatedUpdates : undefined
                }
            })
        };

    } catch (error) {
        console.error('Error checking for inactive users:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: error.message || 'Unknown server error.',
                results: {
                    userChallengesProcessed,
                    inactiveUsersFound,
                    notificationsTriggered,
                    timestamp: now,
                    testMode,
                    simulationMode
                }
            })
        };
    }
}; 