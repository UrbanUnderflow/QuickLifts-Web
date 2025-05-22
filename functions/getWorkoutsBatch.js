const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions"); // Import logger for v2
const admin = require("firebase-admin");

// Ensure Firebase Admin SDK is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Batch fetches workout documents from Firestore using v2 API.
 *
 * @param {object} request - The request object from the client.
 * @param {object} request.data - The data passed to the function.
 * @param {string[]} request.data.ids - An array of workout document IDs to fetch.
 * @param {string} [request.data.uid] - Optional user ID.
 * @returns {Promise<object>} A promise that resolves to an object where keys are
 *                            workout IDs and values are the corresponding workout data.
 *                            Returns an empty object if ids array is empty or on error.
 */
exports.getWorkoutsBatch = onCall({ region: "us-central1", runtime: "nodejs22" }, async (request) => {
  const { ids, uid } = request.data;

  if (!Array.isArray(ids) || ids.length === 0) {
    logger.info("No IDs provided or IDs is not an array, returning empty object.");
    return {};
  }

  // Ensure all IDs are strings
  if (!ids.every(id => typeof id === 'string')) {
    logger.error("Invalid input: All IDs must be strings.", { ids });
    throw new HttpsError("invalid-argument", "The function must be called with an array of strings for 'ids'.");
  }

  logger.info(`Fetching ${ids.length} stacks for UID: ${uid || 'N/A'}`, { ids, uid });

  try {
    const workoutDocsRefs = ids.map(id => db.collection("stacks").doc(id));
    
    if (workoutDocsRefs.length === 0) {
      return {};
    }

    const workoutSnapshots = await db.getAll(...workoutDocsRefs);
    
    const workoutsData = {};
    workoutSnapshots.forEach(docSnapshot => {
      if (docSnapshot.exists) {
        workoutsData[docSnapshot.id] = docSnapshot.data();
      } else {
        logger.warn(`Stack document with ID ${docSnapshot.id} not found.`);
      }
    });

    logger.info(`Successfully fetched ${Object.keys(workoutsData).length} stacks.`);
    return workoutsData;

  } catch (error) {
    logger.error("Error fetching stacks batch:", error);
    throw new HttpsError("internal", "Failed to fetch stacks.", error.message);
  }
}); 