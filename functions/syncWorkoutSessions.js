const functions = require("firebase-functions");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// REMOVED: Initialization is now handled in index.js
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }

const db = admin.firestore();
const rootSessionsCollection = "workout-sessions"; // The name of the new root collection

/**
 * Synchronizes workout session data from the user's subcollection 
 * ('users/{userId}/workoutSessions/{sessionId}') to the root-level 
 * 'workout-sessions' collection using v2 Firestore trigger.
 *
 * Triggered on any write (create, update, delete) to a user's workout session.
 */
exports.syncWorkoutSessionToRoot = onDocumentWritten(
  "users/{userId}/workoutSessions/{sessionId}", // Document path pattern
  async (event) => {                           // Event handler (uses event object)
    // The event object contains change (before/after data) and params
    const change = event.data;
    const context = event.params; // Params are directly on the event object in v2
    const { userId, sessionId } = context;

    if (!change) {
      console.warn("Event data (change) is undefined. Cannot process trigger.");
      return;
    }

    const rootSessionRef = db.collection(rootSessionsCollection).doc(sessionId);

    // Check if the document was deleted (after snapshot doesn't exist)
    if (!change.after.exists) {
      console.log(
        `User session deleted: users/${userId}/workoutSessions/${sessionId}. Removing from root collection.`
      );
      try {
        await rootSessionRef.delete();
        console.log(
          `Successfully deleted session ${sessionId} from root collection.`
        );
      } catch (error) {
        console.error(
          `Error deleting session ${sessionId} from root collection:`, error
        );
        // Consider adding error reporting here
      }
      return; // Exit function
    }

    // Document was created or updated
    const sessionData = change.after.data();
    if (!sessionData) {
      console.log(`No data found for session users/${userId}/workoutSessions/${sessionId} after write. Skipping sync.`);
      return;
    }

    console.log(
      `User session created/updated: users/${userId}/workoutSessions/${sessionId}. Syncing to root collection.`
    );

    // Add the userId to the data being written to the root collection
    const dataWithUserId = {
      ...sessionData,
      userId: userId, // Add the user ID
      // Optional: Add server timestamp for last sync if needed
      // _syncedAt: admin.firestore.FieldValue.serverTimestamp(), 
    };

    try {
      // Use set with merge: true to handle both creates and updates cleanly
      await rootSessionRef.set(dataWithUserId, { merge: true }); 
      console.log(
        `Successfully synced session ${sessionId} (User: ${userId}) to root collection.`
      );
    } catch (error) {
      console.error(
        `Error syncing session ${sessionId} (User: ${userId}) to root collection:`, error
      );
      // Consider adding error reporting here
      // Let the function fail so Firebase retries (for creates/updates)
      // Note: Error handling might need adjustment for v2 triggers depending on desired retry behavior
      throw error; 
    }
  }
); 