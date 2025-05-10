const { admin, db, headers } = require('./config/firebase');

// Configuration
const INACTIVITY_REMINDER_THRESHOLD_HOURS = 4; // Hours before a reminder is sent
const AUTO_STOP_WORKOUT_THRESHOLD_HOURS = 12; // Hours before workout is auto-stopped

const INACTIVITY_REMINDER_THRESHOLD_MS = INACTIVITY_REMINDER_THRESHOLD_HOURS * 60 * 60 * 1000;
const AUTO_STOP_WORKOUT_THRESHOLD_MS = AUTO_STOP_WORKOUT_THRESHOLD_HOURS * 60 * 60 * 1000;

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
    console.log(`Reminder threshold: ${INACTIVITY_REMINDER_THRESHOLD_HOURS} hours. Auto-stop threshold: ${AUTO_STOP_WORKOUT_THRESHOLD_HOURS} hours.`);

    const now = Date.now();
    let userChallengesProcessed = 0;
    let inactiveUsersFound = 0; // This will now count users triggering any action (4h or 12h)
    let remindersSent = 0;
    let autoStopsProcessed = 0;
    let simulatedUpdates = [];

    const batchUserChallenge = db.batch(); // Batch for UserChallenge updates
    const userChallengesToMarkInactiveRefs = []; // Refs for UserChallenges to set isCurrentlyActive = false (12h)

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
                        remindersSent: 0,
                        autoStopsProcessed: 0,
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
            const docId = doc.id; // This is the UserChallenge document ID
            const userId = challengeData.userId;
            const username = challengeData.username || 'User';
            const challengeId = challengeData.challengeId || ''; // Actual Challenge ID
            const challengeTitle = challengeData.challenge?.title || '';
            const lastActiveRoundWorkoutId = challengeData.lastActiveRoundWorkoutId; // New field

            if (!userId) {
                console.warn(`Skipping UserChallenge ${docId}: Missing userId.`);
                continue;
            }

            const lastActiveDate = formatTimestamp(challengeData.lastActive);
            const lastActiveTime = lastActiveDate ? lastActiveDate.getTime() : null;

            if (!lastActiveTime) {
                console.log(`UserChallenge ${docId} (User: ${userId}) has no lastActive time. Skipping inactivity checks for this entry.`);
                continue;
            }

            const timeSinceLastActive = now - lastActiveTime;

            // Check for 12+ hour inactivity first (auto-stop)
            if (timeSinceLastActive > AUTO_STOP_WORKOUT_THRESHOLD_MS) {
                inactiveUsersFound++;
                console.log(`UserChallenge ${docId} (User: ${userId}) inactive for >${AUTO_STOP_WORKOUT_THRESHOLD_HOURS} hours. Last active: ${lastActiveDate.toISOString()}. Auto-stopping.`);

                if (simulationMode) {
                    simulatedUpdates.push({
                        userId,
                        username,
                        userChallengeId: docId,
                        challengeId,
                        challengeTitle,
                        lastActive: lastActiveDate,
                        lastActiveRoundWorkoutId,
                        action: 'auto_stop_12h',
                        currentIsActive: challengeData.isCurrentlyActive,
                        timeSinceLastActiveHours: (timeSinceLastActive / (1000 * 60 * 60)).toFixed(2)
                    });
                    continue;
                }

                if (!testMode) {
                    // 1. Mark UserChallenge as inactive
                    userChallengesToMarkInactiveRefs.push(doc.ref);

                    // 2. Update WorkoutSession
                    if (lastActiveRoundWorkoutId && userId) {
                        const workoutSessionQuery = await db.collection('users').doc(userId).collection('workoutSessions')
                            .where('roundWorkoutId', '==', lastActiveRoundWorkoutId)
                            // .where('status', '!=', 'completed') // Ensure we only stop ongoing ones
                            .limit(1)
                            .get();

                        if (!workoutSessionQuery.empty) {
                            const workoutSessionDoc = workoutSessionQuery.docs[0];
                            if (workoutSessionDoc.data().status !== 'completed') {
                                console.log(`User: ${userId}, Auto-stopping WorkoutSession ${workoutSessionDoc.id} (located in user's subcollection) (RoundWorkoutId: ${lastActiveRoundWorkoutId})`);
                                await workoutSessionDoc.ref.update({
                                    endTime: admin.firestore.Timestamp.now(),
                                    status: 'completed',
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                });
                                console.log(`User: ${userId}, WorkoutSession ${workoutSessionDoc.id} in subcollection updated.`);
                            } else {
                                console.log(`User: ${userId}, WorkoutSession ${workoutSessionDoc.id} (RoundWorkoutId: ${lastActiveRoundWorkoutId}) in subcollection already completed.`);
                            }
                        } else {
                            console.warn(`User: ${userId}, No matching active WorkoutSession found in subcollection for RoundWorkoutId: ${lastActiveRoundWorkoutId} to auto-stop.`);
                        }
                    } else {
                        console.warn(`User: ${userId}, Cannot auto-stop workout session: missing lastActiveRoundWorkoutId or userId for UserChallenge ${docId}.`);
                    }

                    // 3. Send Notification
                    const fcmToken = challengeData.fcmToken;
                    if (fcmToken) {
                        console.log(`Attempting to send 12h auto-stop notification to User: ${userId}`);
                        const notificationResult = await sendNotification(
                            fcmToken,
                            'Workout Auto-Stopped',
                            `Hey ${username}, your workout was automatically stopped after ${AUTO_STOP_WORKOUT_THRESHOLD_HOURS} hours of inactivity.`,
                            {
                                type: 'INACTIVITY_AUTO_STOP_12H',
                                userId,
                                userChallengeId: docId,
                                challengeId,
                                roundWorkoutId: lastActiveRoundWorkoutId || ''
                            }
                        );
                        if (notificationResult.success) {
                            autoStopsProcessed++; // Counts successful notifications for auto-stops
                        }
                    } else {
                        console.warn(`UserChallenge ${docId} (User: ${userId}) inactive >12h but no FCM token. Skipping auto-stop notification.`);
                    }
                } else {
                     console.log(`TEST MODE: Would auto-stop for User: ${userId} (UserChallenge ${docId}) and send notification.`);
                }

            } else if (timeSinceLastActive > INACTIVITY_REMINDER_THRESHOLD_MS) {
                inactiveUsersFound++;
                console.log(`UserChallenge ${docId} (User: ${userId}) inactive for >${INACTIVITY_REMINDER_THRESHOLD_HOURS} hours. Last active: ${lastActiveDate.toISOString()}. Sending reminder.`);

                if (simulationMode) {
                    simulatedUpdates.push({
                        userId,
                        username,
                        userChallengeId: docId,
                        challengeId,
                        challengeTitle,
                        lastActive: lastActiveDate,
                        lastActiveRoundWorkoutId,
                        action: 'reminder_4h',
                        currentIsActive: challengeData.isCurrentlyActive,
                        timeSinceLastActiveHours: (timeSinceLastActive / (1000 * 60 * 60)).toFixed(2)
                    });
                    continue;
                }
                
                // IMPORTANT: Do NOT set isCurrentlyActive to false for a 4-hour reminder.

                if (!testMode) {
                    // Send Notification
                    const fcmToken = challengeData.fcmToken;
                    if (fcmToken) {
                        console.log(`Attempting to send 4h reminder notification to User: ${userId}`);
                        const notificationResult = await sendNotification(
                            fcmToken,
                            'Active Workout Reminder',
                            `Hey ${username}, you have an active workout in progress. Tap to resume or stop it.`,
                            {
                                type: 'INACTIVITY_REMINDER_4H',
                                userId,
                                userChallengeId: docId,
                                challengeId,
                                roundWorkoutId: lastActiveRoundWorkoutId || ''
                            }
                        );
                        if (notificationResult.success) {
                            remindersSent++;
                        }
                    } else {
                        console.warn(`UserChallenge ${docId} (User: ${userId}) inactive >4h but no FCM token. Skipping reminder notification.`);
                    }
                } else {
                    console.log(`TEST MODE: Would send 4h reminder for User: ${userId} (UserChallenge ${docId}).`);
                }

            } else {
                // User is still active - within the 4-hour threshold
                console.log(`UserChallenge ${docId} (User: ${userId}) is still active. Last active: ${lastActiveDate.toISOString()}`);
            }
        }

        // Commit the batch update for UserChallenges that need isCurrentlyActive set to false (12h+ users)
        if (!testMode && !simulationMode && userChallengesToMarkInactiveRefs.length > 0) {
            console.log(`Marking ${userChallengesToMarkInactiveRefs.length} user challenges as inactive (due to 12h+ inactivity).`);
            userChallengesToMarkInactiveRefs.forEach(ref => {
                batchUserChallenge.update(ref, {
                    isCurrentlyActive: false,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batchUserChallenge.commit();
            console.log('UserChallenge batch update successful for 12h+ inactive users.');
        } else {
            console.log(`${testMode ? 'Test mode: ' : simulationMode ? 'Simulation mode: ' : ''}No UserChallenges updated via batch for 12h+ inactivity.`);
        }

        const summaryMessage = `Check complete. Processed ${userChallengesProcessed} challenges. Found ${inactiveUsersFound} users needing attention (4h or 12h). Reminders sent: ${remindersSent}. Workouts auto-stopped: ${autoStopsProcessed}.`;
        console.log(summaryMessage);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: summaryMessage,
                results: {
                    userChallengesProcessed,
                    inactiveUsersFound, // Total users past either threshold
                    remindersSent,      // Specifically 4h reminders
                    autoStopsProcessed, // Specifically 12h auto-stops (notifications/DB updates)
                    userChallengesMarkedInactive: userChallengesToMarkInactiveRefs.length, // UC records updated
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
                    remindersSent,
                    autoStopsProcessed,
                    timestamp: now,
                    testMode,
                    simulationMode
                }
            })
        };
    }
}; 