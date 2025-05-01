console.log("--- manual-sync-sessions.js loaded ---"); // Add this top-level log

const { admin, db, headers } = require('./config/firebase'); // Assuming shared config
const { FieldValue } = require("firebase-admin/firestore"); // Required for serverTimestamp

// --- Configuration ---
const ROOT_SESSIONS_COLLECTION = "workout-sessions";
const BATCH_LIMIT = 400; // Keep the optimized batch limit
const LOCK_DOC_PATH = "syncStatus/manualSyncLock"; // Reuse or use a new lock path if needed

// --- Logic ---
exports.handler = async (event, context) => {
    console.log("--- manual-sync-sessions handler invoked --- "); // Add this very first log in handler

    // Netlify functions run in response to HTTP requests.
    // Background functions are triggered but don't return a response directly to the *original* caller.
    // We log progress and errors to Netlify function logs.
    // This handler will run the logic directly, relying on the 15min background limit.

    console.log("Received manual sync request.");

    // Optional: Check for HTTP method if needed, e.g., ensure it's POST
    if (event.httpMethod !== 'POST') {
        // Allow OPTIONS for CORS preflight
        if (event.httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers, body: '' };
        }
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const lockRef = db.doc(LOCK_DOC_PATH);
    let lockAcquired = false;
    let totalSessionsSynced = 0; // Initialize here to be accessible in final response

    try {
        // 1. Try to acquire lock
        await db.runTransaction(async (transaction) => {
            const lockDoc = await transaction.get(lockRef);
            if (lockDoc.exists && lockDoc.data()?.status === 'running-netlify') {
                const lockTime = lockDoc.data()?.startTime?.toDate();
                // Check for stale lock (e.g., older than 20 minutes to be safe with 15 min runtime)
                const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
                if (lockTime && lockTime < twentyMinutesAgo) {
                    console.warn("[Netlify Sync] Found stale lock, overriding.");
                } else {
                    console.log("[Netlify Sync] Lock already held.");
                    throw new Error('Sync process is already running.'); // Throw specific error
                }
            }
            transaction.set(lockRef, {
                status: 'running-netlify',
                startTime: FieldValue.serverTimestamp(),
            });
            lockAcquired = true;
            console.log("[Netlify Sync] Lock acquired.");
        });

        if (!lockAcquired) {
            throw new Error('Failed to acquire lock.'); // Safety check
        }

        // 2. Perform the sync (inside try/finally for lock release)
        let totalUsersProcessed = 0;
        try {
            console.log("[Netlify Sync] Fetching user IDs...");
            const usersRef = db.collection('users');
            const usersSnapshot = await usersRef.select().get(); // Fetch only IDs
            const userIds = usersSnapshot.docs.map(doc => doc.id);
            const totalUsers = userIds.length;
            console.log(`[Netlify Sync] Found ${totalUsers} users.`);

            if (totalUsers === 0) {
              console.log("[Netlify Sync] No users found to process.");
              // Consider releasing lock early and returning success if no users
              return {
                 statusCode: 200,
                 headers: { ...headers, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ success: true, message: "No users found to sync.", sessionsSynced: 0 })
              };
            }

            let currentBatch = db.batch();
            let batchCounter = 0;

            for (let i = 0; i < userIds.length; i++) {
                const userId = userIds[i];
                totalUsersProcessed++;
                // Log progress less frequently to avoid excessive logging? e.g., every 10 users
                if (totalUsersProcessed % 10 === 0 || totalUsersProcessed === totalUsers) {
                   console.log(`[Netlify Sync] Processing user ${totalUsersProcessed}/${totalUsers} (ID: ${userId})...`);
                }

                const sessionsRef = db.collection('users', userId, 'workoutSessions');
                const sessionsSnapshot = await sessionsRef.get();

                if (!sessionsSnapshot.empty) {
                    for (const sessionDoc of sessionsSnapshot.docs) {
                        const sessionId = sessionDoc.id;
                        const sessionData = sessionDoc.data();
                        // Ensure crucial fields exist before copying, add default if necessary
                         if (!sessionData || !sessionData.startTime) {
                            console.warn(`[Netlify Sync] Skipping session ${sessionId} for user ${userId} due to missing data/startTime.`);
                            continue;
                         }

                        const rootSessionRef = db.collection(ROOT_SESSIONS_COLLECTION).doc(sessionId);
                        const dataToSync = { ...sessionData, userId: userId }; // Add userId

                        currentBatch.set(rootSessionRef, dataToSync, { merge: true });
                        batchCounter++;
                        totalSessionsSynced++;

                        if (batchCounter >= BATCH_LIMIT) {
                            console.log(`[Netlify Sync] Committing batch of ${batchCounter} sessions...`);
                            await currentBatch.commit();
                            console.log("[Netlify Sync] Batch committed.");
                            currentBatch = db.batch();
                            batchCounter = 0;
                        }
                    }
                }
            }

            if (batchCounter > 0) {
                console.log(`[Netlify Sync] Committing final batch of ${batchCounter} sessions...`);
                await currentBatch.commit();
                console.log("[Netlify Sync] Final batch committed.");
            }

            const successMessage = `[Netlify Sync] Sync process completed. Processed ${totalUsersProcessed} users and synced ${totalSessionsSynced} sessions.`;
            console.log(successMessage);

        } catch (error) {
            console.error("[Netlify Sync] Error during sync data processing:", error);
            throw error; // Rethrow to be caught by outer handler and release lock
        } finally {
            // 3. Release lock (needs to happen even if data processing fails)
            if (lockAcquired) {
                console.log("[Netlify Sync] Releasing lock...");
                await lockRef.set({ status: 'idle-netlify', endTime: FieldValue.serverTimestamp() }, { merge: true });
                console.log("[Netlify Sync] Lock released.");
            }
        }

        // If execution reaches here, the main process succeeded
        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: `Sync completed successfully. Synced ${totalSessionsSynced} sessions.` })
        };

    } catch (err) {
        console.error('[Netlify Sync] Top-level operation failed:', err.message);
        // Ensure lock is released if acquired but failed before final 'finally' block
        if (lockAcquired && !(err.message === 'Sync process is already running.')) {
             try {
                 console.log("[Netlify Sync] Releasing lock due to error...");
                 await lockRef.set({ status: 'failed-netlify', error: err.message, endTime: FieldValue.serverTimestamp() }, { merge: true });
                 console.log("[Netlify Sync] Lock released after error.");
             } catch (lockError) {
                 console.error("[Netlify Sync] Failed to release lock after error:", lockError);
             }
        }

        // Determine status code based on error
        const statusCode = err.message === 'Sync process is already running.' ? 409 : 500; // 409 Conflict or 500 Internal Server Error
        return {
            statusCode: statusCode,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: err.message || 'Unknown error during sync operation.' })
        };
    }
}; 