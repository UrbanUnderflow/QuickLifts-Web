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
const rootMealsCollection = "meals-logged"; // The name of the new root collection

/**
 * Synchronizes meal log data from the user's subcollection 
 * ('users/{userId}/mealLogs/{mealId}') to the root-level 
 * 'meals-logged' collection using v2 Firestore trigger.
 *
 * Triggered on any write (create, update, delete) to a user's meal log.
 */
exports.syncMealLogToRoot = onDocumentWritten(
  "users/{userId}/mealLogs/{mealId}", // Document path pattern
  async (event) => {                  // Event handler (uses event object)
    // The event object contains change (before/after data) and params
    const change = event.data;
    const context = event.params; // Params are directly on the event object in v2
    const { userId, mealId } = context;

    if (!change) {
      console.warn("Event data (change) is undefined. Cannot process trigger.");
      return;
    }

    const rootMealRef = db.collection(rootMealsCollection).doc(mealId);

    // Check if the document was deleted (after snapshot doesn't exist)
    if (!change.after.exists) {
      console.log(
        `User meal deleted: users/${userId}/mealLogs/${mealId}. Removing from root collection.`
      );
      try {
        await rootMealRef.delete();
        console.log(
          `Successfully deleted meal ${mealId} from root collection.`
        );
      } catch (error) {
        console.error(
          `Error deleting meal ${mealId} from root collection:`, error
        );
        // Consider adding error reporting here
      }
      return; // Exit function
    }

    // Document was created or updated
    const mealData = change.after.data();
    if (!mealData) {
      console.log(`No data found for meal users/${userId}/mealLogs/${mealId} after write. Skipping sync.`);
      return;
    }

    console.log(
      `User meal created/updated: users/${userId}/mealLogs/${mealId}. Syncing to root collection.`
    );

    // Add the userId to the data being written to the root collection
    const dataWithUserId = {
      ...mealData,
      userId: userId, // Add the user ID
      // Optional: Add server timestamp for last sync if needed
      // _syncedAt: admin.firestore.FieldValue.serverTimestamp(), 
    };

    try {
      // Use set with merge: true to handle both creates and updates cleanly
      await rootMealRef.set(dataWithUserId, { merge: true }); 
      console.log(
        `Successfully synced meal ${mealId} (User: ${userId}) to root collection.`
      );
    } catch (error) {
      console.error(
        `Error syncing meal ${mealId} (User: ${userId}) to root collection:`, error
      );
      // Consider adding error reporting here
      // Let the function fail so Firebase retries (for creates/updates)
      // Note: Error handling might need adjustment for v2 triggers depending on desired retry behavior
      throw error; 
    }
  }
); 