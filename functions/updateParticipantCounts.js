// functions/updateParticipantCounts.js
const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore"); // Required for serverTimestamp

// Ensure admin is initialized (often done in index.js, but safe check)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const ROUNDS_COLLECTION = "sweatlist-collection";
const PARTICIPANT_SUBCOLLECTION = "userChallengeds"; // Verify this is the correct name
const LOCK_DOC_PATH = "syncStatus/participantCountLock";
const BATCH_LIMIT = 400; // Number of updates per Firestore batch

/**
 * Logic for the updateParticipantCounts callable function.
 */
const updateCountsLogic = async (data, context) => {
  // Optional: Add admin check if needed
  // if (!context.auth || !context.auth.token.admin) {
  //   throw new HttpsError('permission-denied', 'Must be an admin to run this operation.');
  // }

  console.log("Attempting to start participant count update...");
  const lockRef = db.doc(LOCK_DOC_PATH);
  let lockAcquired = false;

  try {
    // 1. Try to acquire lock using a transaction
    await db.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      if (lockDoc.exists && lockDoc.data()?.status === 'running') {
        // Check for stale lock (e.g., older than 15 minutes)
        const lockTime = lockDoc.data()?.startTime?.toDate();
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        if (lockTime && lockTime < fifteenMinutesAgo) {
            console.warn("Found stale lock, overriding.");
            // Continue to acquire lock below
        } else {
            console.log("Lock already held by another process.");
            throw new HttpsError('already-exists', 'Participant count update is already in progress.');
        }
      }
      // Acquire lock
      transaction.set(lockRef, {
        status: 'running',
        startTime: FieldValue.serverTimestamp(),
      });
      lockAcquired = true;
      console.log("Lock acquired.");
    });

    if (!lockAcquired) {
        // Should not happen if transaction succeeded/failed correctly, but safety check
        throw new HttpsError('internal', 'Failed to acquire lock.');
    }

    // 2. Perform the update (inside another try...finally to ensure lock release)
    let roundsUpdated = 0;
    try {
        console.log(`Fetching all rounds from ${ROUNDS_COLLECTION}...`);
        const roundsSnapshot = await db.collection(ROUNDS_COLLECTION).get();
        console.log(`Found ${roundsSnapshot.size} rounds to process.`);

        if (roundsSnapshot.empty) {
            console.log("No rounds found to update.");
            return { success: true, message: "No rounds found to update.", roundsUpdated: 0 };
        }

        let currentBatch = db.batch();
        let batchCounter = 0;

        for (const roundDoc of roundsSnapshot.docs) {
            const roundId = roundDoc.id;
            const participantsRef = db.collection(ROUNDS_COLLECTION)
                                     .doc(roundId)
                                     .collection(PARTICIPANT_SUBCOLLECTION);

            // Get count for the subcollection
            const countSnapshot = await participantsRef.count().get(); // Use .count() for efficiency
            const participantCount = countSnapshot.data().count;

            // Add update operation to batch
            currentBatch.update(roundDoc.ref, { numberOfParticipants: participantCount });
            batchCounter++;
            roundsUpdated++;
            console.log(`Round ${roundId}: Found ${participantCount} participants. Added update to batch.`);

            // Commit batch if limit reached
            if (batchCounter >= BATCH_LIMIT) {
                console.log(`Committing batch of ${batchCounter} updates...`);
                await currentBatch.commit();
                console.log("Batch committed.");
                currentBatch = db.batch(); // Start new batch
                batchCounter = 0;
            }
        }

        // Commit final batch if anything is left
        if (batchCounter > 0) {
            console.log(`Committing final batch of ${batchCounter} updates...`);
            await currentBatch.commit();
            console.log("Final batch committed.");
        }

        const successMessage = `Successfully updated participant counts for ${roundsUpdated} rounds.`;
        console.log(successMessage);
        return { success: true, message: successMessage, roundsUpdated: roundsUpdated };

    } catch (error) {
        console.error("Error during participant count update process:", error);
        // Rethrow as HttpsError for the client
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', `Failed during update process: ${error.message}`);
    } finally {
        // 3. Release lock
        console.log("Releasing lock...");
        await lockRef.set({ status: 'idle', endTime: FieldValue.serverTimestamp() }, { merge: true });
        console.log("Lock released.");
    }

  } catch (err) {
    console.error('[Lock Acquisition or Final Error] Error:', err);
    // Ensure HttpsError is thrown back to the client
    if (err instanceof HttpsError) {
      throw err;
    } else {
      throw new HttpsError('internal', `Operation failed: ${err.message || 'Unknown error'}`);
    }
  }
};

// Export the function with runtime options
exports.updateParticipantCounts = onCall(
  {
    timeoutSeconds: 540, // Allow up to 9 minutes
    memory: "1GiB",    // Allocate 1 GiB of memory
  },
  updateCountsLogic
); 