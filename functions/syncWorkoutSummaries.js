const functions = require("firebase-functions");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// Initialization should ideally be handled centrally (e.g., in index.js)
// Ensure admin is initialized before this function is loaded.
// Example check (consider a more robust initialization strategy):
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }

const db = admin.firestore();
const rootSummariesCollection = "workout-summaries"; // The name of the new root collection

/**
 * Synchronizes workout summary data from the user's subcollection 
 * ('users/{userId}/workoutSummaries/{summaryId}') to the root-level 
 * 'workout-summaries' collection using v2 Firestore trigger.
 *
 * Triggered on any write (create, update, delete) to a user's workout summary.
 */
exports.syncWorkoutSummaryToRoot = onDocumentWritten(
  "users/{userId}/workoutSummaries/{summaryId}", // Document path pattern
  async (event) => {                           // Event handler (uses event object)
    // The event object contains change (before/after data) and params
    const change = event.data;
    const context = event.params; // Params are directly on the event object in v2
    const { userId, summaryId } = context;

    if (!change) {
      console.warn("Event data (change) is undefined. Cannot process trigger.");
      return;
    }

    const rootSummaryRef = db.collection(rootSummariesCollection).doc(summaryId);

    // Check if the document was deleted (after snapshot doesn't exist)
    if (!change.after.exists) {
      console.log(
        `User summary deleted: users/${userId}/workoutSummaries/${summaryId}. Removing from root collection.`
      );
      try {
        await rootSummaryRef.delete();
        console.log(
          `Successfully deleted summary ${summaryId} from root collection.`
        );
      } catch (error) {
        console.error(
          `Error deleting summary ${summaryId} from root collection:`, error
        );
        // Consider adding error reporting here
      }
      return; // Exit function
    }

    // Document was created or updated
    const summaryData = change.after.data();
    if (!summaryData) {
      console.log(`No data found for summary users/${userId}/workoutSummaries/${summaryId} after write. Skipping sync.`);
      return;
    }

    console.log(
      `User summary created/updated: users/${userId}/workoutSummaries/${summaryId}. Syncing to root collection.`
    );

    // Add the userId to the data being written to the root collection
    const dataWithUserId = {
      ...summaryData,
      userId: userId, // Add the user ID
      // Optional: Add server timestamp for last sync if needed
      // _syncedAt: admin.firestore.FieldValue.serverTimestamp(), 
    };

    try {
      // Use set with merge: true to handle both creates and updates cleanly
      await rootSummaryRef.set(dataWithUserId, { merge: true }); 
      console.log(
        `Successfully synced summary ${summaryId} (User: ${userId}) to root collection.`
      );
    } catch (error) {
      console.error(
        `Error syncing summary ${summaryId} (User: ${userId}) to root collection:`, error
      );
      // Consider adding error reporting here
      // Let the function fail so Firebase retries (for creates/updates)
      // Note: Error handling might need adjustment for v2 triggers depending on desired retry behavior
      throw error; 
    }
  }
); 