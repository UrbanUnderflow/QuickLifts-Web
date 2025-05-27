const functions = require("firebase-functions");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Ensure admin is initialized (already done in index.js, but safe to have here)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const ROOT_MEALS_COLLECTION = "meals-logged";
const BATCH_LIMIT = 400; // Increased batch limit
const DELAY_MS = 0; // Removed delay

/**
 * Callable Cloud Function logic for syncing meal logs.
 */
const manualSyncMealLogsLogic = async (data, context) => {
  // Optional: Add authentication check
  // if (!context.auth || !context.auth.token.admin) { ... }

  console.log("Starting manual meal logs sync...");

  let currentBatch = db.batch();
  let batchCounter = 0;
  let totalMealsSynced = 0;
  let totalMealsSkipped = 0;
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

      // 3. Fetch mealLogs subcollection
      const mealsRef = db.collection('users', userId, 'mealLogs');
      const mealsSnapshot = await mealsRef.get();

      if (!mealsSnapshot.empty) {
        // 4. Check each meal and add to batch if it doesn't exist in root collection
        for (const mealDoc of mealsSnapshot.docs) {
          const mealId = mealDoc.id;
          const mealData = mealDoc.data();
          const rootMealRef = db.collection(ROOT_MEALS_COLLECTION).doc(mealId);

          // Check if the meal already exists in the root collection
          try {
            const existingMeal = await rootMealRef.get();
            
            if (existingMeal.exists) {
              // Meal already exists, skip it
              totalMealsSkipped++;
              console.log(`Meal ${mealId} already exists in root collection, skipping...`);
              continue;
            }

            // Meal doesn't exist, add it to the batch
            const dataToSync = { ...mealData, userId: userId };
            currentBatch.set(rootMealRef, dataToSync, { merge: true });
            batchCounter++;
            totalMealsSynced++;

            // 5. Commit batch if limit reached
            if (batchCounter >= BATCH_LIMIT) {
              console.log(`Committing batch of ${batchCounter} meals...`);
              await currentBatch.commit();
              console.log("Batch committed.");
              currentBatch = db.batch();
              batchCounter = 0;
            }
          } catch (error) {
            console.error(`Error checking/syncing meal ${mealId}:`, error);
            // Continue with next meal instead of failing the entire operation
          }
        }
      }
    }

    // 6. Commit final batch
    if (batchCounter > 0) {
      console.log(`Committing final batch of ${batchCounter} meals...`);
      await currentBatch.commit();
      console.log("Final batch committed.");
    }

    const successMessage = `Meal sync complete. Processed ${totalUsersProcessed} users. Synced ${totalMealsSynced} new meals, skipped ${totalMealsSkipped} existing meals.`;
    console.log(successMessage);
    return { 
      success: true, 
      message: successMessage, 
      mealsSynced: totalMealsSynced,
      mealsSkipped: totalMealsSkipped,
      usersProcessed: totalUsersProcessed
    };

  } catch (err) {
    console.error('[Manual Meal Sync] Error:', err);
    throw new functions.https.HttpsError('internal', `Manual meal sync failed: ${err.message || 'Unknown error'}`);
  }
};

// Define the function using v2 syntax with options and point to the logic
exports.manualSyncMealLogs = onCall(
  { timeoutSeconds: 540, memory: "1GiB" },
  manualSyncMealLogsLogic
); 