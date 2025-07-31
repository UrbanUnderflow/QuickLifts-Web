const functions = require("firebase-functions");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

// REMOVED: Initialization is now handled in index.js
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }

const db = admin.firestore();
const rootStacksCollection = "stacks"; // The name of the global stacks collection

/**
 * Synchronizes stack data from the user's subcollection 
 * ('users/{userId}/MyCreatedWorkouts/{stackId}') to the root-level 
 * 'stacks' collection using v2 Firestore trigger.
 *
 * Triggered on any write (create, update, delete) to a user's created workout/stack.
 */
exports.syncStackToRoot = onDocumentWritten(
  "users/{userId}/MyCreatedWorkouts/{stackId}", // Document path pattern
  async (event) => {                           // Event handler (uses event object)
    // The event object contains change (before/after data) and params
    const change = event.data;
    const context = event.params; // Params are directly on the event object in v2
    const { userId, stackId } = context;

    if (!change) {
      console.warn("Event data (change) is undefined. Cannot process trigger.");
      return;
    }

    const rootStackRef = db.collection(rootStacksCollection).doc(stackId);

    // Check if the document was deleted (after snapshot doesn't exist)
    if (!change.after.exists) {
      console.log(
        `User stack deleted: users/${userId}/MyCreatedWorkouts/${stackId}. Removing from root collection.`
      );
      try {
        // Also delete the logs subcollection from the root stacks collection
        const logsRef = rootStackRef.collection("logs");
        const logsSnapshot = await logsRef.get();
        const batch = db.batch();
        
        logsSnapshot.docs.forEach((logDoc) => {
          batch.delete(logDoc.ref);
        });
        
        // Delete the main stack document
        batch.delete(rootStackRef);
        
        await batch.commit();
        console.log(
          `Successfully deleted stack ${stackId} and its logs from root collection.`
        );
      } catch (error) {
        console.error(
          `Error deleting stack ${stackId} from root collection:`, error
        );
        // Consider adding error reporting here
      }
      return; // Exit function
    }

    // Document was created or updated
    const stackData = change.after.data();
    if (!stackData) {
      console.log(`No data found for stack users/${userId}/MyCreatedWorkouts/${stackId} after write. Skipping sync.`);
      return;
    }

    console.log(
      `User stack created/updated: users/${userId}/MyCreatedWorkouts/${stackId}. Syncing to root collection.`
    );

    // Add the userId to the data being written to the root collection
    const dataWithUserId = {
      ...stackData,
      userId: userId, // Add the user ID for ownership tracking
      // Optional: Add server timestamp for last sync if needed
      // _syncedAt: admin.firestore.FieldValue.serverTimestamp(), 
    };

    try {
      // Check if the stack already exists in the global collection (iOS apps save directly)
      const existingStackDoc = await rootStackRef.get();
      
      if (existingStackDoc.exists) {
        const existingData = existingStackDoc.data();
        
        // If it already has a userId field, it was likely synced before or came from iOS
        // Only update if the data is significantly different or missing userId
        if (existingData.userId) {
          console.log(
            `Stack ${stackId} already exists in root collection with userId. Skipping duplicate sync.`
          );
          return; // Skip sync to avoid duplicate writes
        } else {
          console.log(
            `Stack ${stackId} exists but missing userId. Adding userId field.`
          );
          // Just add the userId field without overwriting everything
          await rootStackRef.update({ userId: userId });
          return;
        }
      }
      
      // Document doesn't exist in root collection, proceed with full sync
      await rootStackRef.set(dataWithUserId, { merge: true }); 
      console.log(
        `Successfully synced stack ${stackId} (User: ${userId}) to root collection.`
      );

      // Sync logs subcollection if it exists
      await syncLogsSubcollection(userId, stackId, rootStackRef);

    } catch (error) {
      console.error(
        `Error syncing stack ${stackId} (User: ${userId}) to root collection:`, error
      );
      // Consider adding error reporting here
      // Let the function fail so Firebase retries (for creates/updates)
      throw error; 
    }
  }
);

/**
 * Helper function to sync the logs subcollection from user's stack to global stack
 */
async function syncLogsSubcollection(userId, stackId, rootStackRef) {
  try {
    const userLogsRef = db.collection("users").doc(userId).collection("MyCreatedWorkouts").doc(stackId).collection("logs");
    const rootLogsRef = rootStackRef.collection("logs");
    
    const userLogsSnapshot = await userLogsRef.get();
    
    if (userLogsSnapshot.empty) {
      console.log(`No logs found for stack ${stackId}, skipping logs sync.`);
      return;
    }

    const batch = db.batch();
    
    userLogsSnapshot.docs.forEach((logDoc) => {
      const logData = logDoc.data();
      const rootLogRef = rootLogsRef.doc(logDoc.id);
      
      // Add userId to log data as well
      const logDataWithUserId = {
        ...logData,
        userId: userId
      };
      
      batch.set(rootLogRef, logDataWithUserId, { merge: true });
    });
    
    await batch.commit();
    console.log(`Successfully synced ${userLogsSnapshot.docs.length} logs for stack ${stackId} to root collection.`);
    
  } catch (error) {
    console.error(`Error syncing logs for stack ${stackId}:`, error);
    // Don't throw here - we want the main sync to succeed even if logs fail
  }
} 