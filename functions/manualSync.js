// functions/manualSync.js
const functions = require("firebase-functions");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Ensure admin is initialized (already done in index.js, but safe to have here)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const ROOT_SESSIONS_COLLECTION = "workout-sessions";
const BATCH_LIMIT = 400; // Increased batch limit
const DELAY_MS = 0; // Removed delay

/**
 * Callable Cloud Function logic.
 */
const manualSyncLogic = async (data, context) => {
  // Optional: Add authentication check
  // if (!context.auth || !context.auth.token.admin) { ... }

  console.log("Starting manual workout session sync...");

  let currentBatch = db.batch();
  let batchCounter = 0;
  let totalSessionsSynced = 0;
  let totalUsersProcessed = 0;

  try {
    // 1. Fetch all user IDs
    console.log("Fetching user IDs...");
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.select().get();
    const userIds = usersSnapshot.docs.map(doc => doc.id);
    const totalUsers = userIds.length;
    console.log(`Found ${totalUsers} users.`);

    // 2. Iterate through users
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      totalUsersProcessed++;
      console.log(`Processing user ${totalUsersProcessed}/${totalUsers} (ID: ${userId})...`);

      // 3. Fetch workoutSessions subcollection
      const sessionsRef = db.collection('users', userId, 'workoutSessions');
      const sessionsSnapshot = await sessionsRef.get();

      if (!sessionsSnapshot.empty) {
        // 4. Add each session to the batch
        for (const sessionDoc of sessionsSnapshot.docs) {
          const sessionId = sessionDoc.id;
          const sessionData = sessionDoc.data();
          const rootSessionRef = db.collection(ROOT_SESSIONS_COLLECTION).doc(sessionId);

          const dataToSync = { ...sessionData, userId: userId };
          currentBatch.set(rootSessionRef, dataToSync, { merge: true });
          batchCounter++;
          totalSessionsSynced++;

          // 5. Commit batch if limit reached
          if (batchCounter >= BATCH_LIMIT) {
            console.log(`Committing batch of ${batchCounter} sessions...`);
            await currentBatch.commit();
            console.log("Batch committed.");
            currentBatch = db.batch();
            batchCounter = 0;
          }
        }
      }
    }

    // 6. Commit final batch
    if (batchCounter > 0) {
      console.log(`Committing final batch of ${batchCounter} sessions...`);
      await currentBatch.commit();
      console.log("Final batch committed.");
    }

    const successMessage = `Sync complete. Processed ${totalUsersProcessed} users and synced ${totalSessionsSynced} sessions.`;
    console.log(successMessage);
    return { success: true, message: successMessage, sessionsSynced: totalSessionsSynced };

  } catch (err) {
    console.error('[Manual Sync] Error:', err);
    throw new functions.https.HttpsError('internal', `Manual sync failed: ${err.message || 'Unknown error'}`);
  }
};

// Define the function using v2 syntax with options and point to the logic
exports.manualSyncWorkoutSessions = onCall(
  { timeoutSeconds: 540, memory: "1GiB" },
  manualSyncLogic
); 