console.log("--- manual-sync-meal-logs.js loaded ---");

const { admin, db, headers } = require('./config/firebase');
const { FieldValue } = require("firebase-admin/firestore");

// --- Configuration ---
const ROOT_MEALS_COLLECTION = "meals-logged";
const BATCH_LIMIT = 400;
const LOCK_DOC_PATH = "syncStatus/manualMealSyncLock";

// --- Logic ---
exports.handler = async (event, context) => {
    console.log("--- manual-sync-meal-logs handler invoked ---");

    console.log("Received manual meal sync request.");

    // Check for HTTP method
    if (event.httpMethod !== 'POST') {
        if (event.httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers, body: '' };
        }
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    const lockRef = db.doc(LOCK_DOC_PATH);
    let lockAcquired = false;
    let totalMealsSynced = 0;
    let totalMealsSkipped = 0;

    try {
        // Debug: Verify Firebase connection
        console.log(`[Netlify Meal Sync] Connected to Firebase project: ${admin.app().options.projectId || 'unknown'}`);
        
        // 1. Try to acquire lock
        await db.runTransaction(async (transaction) => {
            const lockDoc = await transaction.get(lockRef);
            if (lockDoc.exists && lockDoc.data()?.status === 'running-netlify') {
                const lockTime = lockDoc.data()?.startTime?.toDate();
                const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
                if (lockTime && lockTime < twentyMinutesAgo) {
                    console.warn("[Netlify Meal Sync] Found stale lock, overriding.");
                } else {
                    console.log("[Netlify Meal Sync] Lock already held.");
                    throw new Error('Meal sync process is already running.');
                }
            }
            transaction.set(lockRef, {
                status: 'running-netlify',
                startTime: FieldValue.serverTimestamp(),
            });
            lockAcquired = true;
            console.log("[Netlify Meal Sync] Lock acquired.");
        });

        if (!lockAcquired) {
            throw new Error('Failed to acquire lock.');
        }

        // 2. Perform the sync
        let totalUsersProcessed = 0;
        try {
            console.log("[Netlify Meal Sync] Fetching user IDs...");
            const usersRef = db.collection('users');
            const usersSnapshot = await usersRef.select().get();
            const userIds = usersSnapshot.docs.map(doc => doc.id);
            const totalUsers = userIds.length;
            console.log(`[Netlify Meal Sync] Found ${totalUsers} users.`);

            if (totalUsers === 0) {
                console.log("[Netlify Meal Sync] No users found to process.");
                return {
                    statusCode: 200,
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        success: true, 
                        message: "No users found to sync.", 
                        mealsSynced: 0,
                        mealsSkipped: 0,
                        usersProcessed: 0
                    })
                };
            }

            // Debug: Log first few user IDs
            console.log(`[Netlify Meal Sync] First 5 user IDs:`, userIds.slice(0, 5));

            // Debug: Test query for first user
            if (userIds.length > 0) {
                const testUserId = userIds[0];
                console.log(`[Netlify Meal Sync] Testing meal logs query for user: ${testUserId}`);
                try {
                    const testMealsRef = db.collection('users').doc(testUserId).collection('mealLogs');
                    const testSnapshot = await testMealsRef.limit(3).get();
                    console.log(`[Netlify Meal Sync] Test query result: ${testSnapshot.size} documents found`);
                    if (!testSnapshot.empty) {
                        const testDoc = testSnapshot.docs[0];
                        console.log(`[Netlify Meal Sync] Test document ID: ${testDoc.id}`);
                        console.log(`[Netlify Meal Sync] Test document data keys: ${Object.keys(testDoc.data()).join(', ')}`);
                        console.log(`[Netlify Meal Sync] Test document name: ${testDoc.data().name}`);
                    }
                } catch (testError) {
                    console.error(`[Netlify Meal Sync] Test query failed:`, testError);
                }
            }

            let currentBatch = db.batch();
            let batchCounter = 0;

            for (let i = 0; i < userIds.length; i++) {
                const userId = userIds[i];
                totalUsersProcessed++;
                
                // Log progress every 10 users
                if (totalUsersProcessed % 10 === 0 || totalUsersProcessed === totalUsers) {
                    console.log(`[Netlify Meal Sync] Processing user ${totalUsersProcessed}/${totalUsers} (ID: ${userId})...`);
                }

                const mealsRef = db.collection('users').doc(userId).collection('mealLogs');
                const mealsSnapshot = await mealsRef.get();

                console.log(`[Netlify Meal Sync] User ${userId}: Found ${mealsSnapshot.size} meal documents`);

                if (!mealsSnapshot.empty) {
                    // Debug: Log first few meal documents for this user
                    if (totalUsersProcessed <= 3) {
                        console.log(`[Netlify Meal Sync] DEBUG - User ${userId} meal docs:`, 
                            mealsSnapshot.docs.slice(0, 3).map(doc => ({
                                id: doc.id,
                                data: doc.data(),
                                hasName: !!doc.data()?.name
                            }))
                        );
                    }

                    for (const mealDoc of mealsSnapshot.docs) {
                        const mealId = mealDoc.id;
                        const mealData = mealDoc.data();
                        
                        // Enhanced validation and debugging
                        if (!mealData) {
                            console.warn(`[Netlify Meal Sync] Skipping meal ${mealId} for user ${userId} - no data found.`);
                            continue;
                        }

                        if (!mealData.name) {
                            console.warn(`[Netlify Meal Sync] Skipping meal ${mealId} for user ${userId} - missing name field. Available fields: ${Object.keys(mealData).join(', ')}`);
                            continue;
                        }

                        const rootMealRef = db.collection(ROOT_MEALS_COLLECTION).doc(mealId);
                        
                        // Check if meal already exists in root collection
                        try {
                            const existingMeal = await rootMealRef.get();
                            
                            if (existingMeal.exists) {
                                totalMealsSkipped++;
                                continue; // Skip existing meals
                            }

                            // Meal doesn't exist, add it to batch
                            const dataToSync = { ...mealData, userId: userId };
                            currentBatch.set(rootMealRef, dataToSync, { merge: true });
                            batchCounter++;
                            totalMealsSynced++;

                            if (batchCounter >= BATCH_LIMIT) {
                                console.log(`[Netlify Meal Sync] Committing batch of ${batchCounter} meals...`);
                                await currentBatch.commit();
                                console.log("[Netlify Meal Sync] Batch committed.");
                                currentBatch = db.batch();
                                batchCounter = 0;
                            }
                        } catch (error) {
                            console.error(`[Netlify Meal Sync] Error checking/syncing meal ${mealId}:`, error);
                            // Continue with next meal
                        }
                    }
                }
            }

            // Commit final batch
            if (batchCounter > 0) {
                console.log(`[Netlify Meal Sync] Committing final batch of ${batchCounter} meals...`);
                await currentBatch.commit();
                console.log("[Netlify Meal Sync] Final batch committed.");
            }

            const successMessage = `[Netlify Meal Sync] Sync process completed. Processed ${totalUsersProcessed} users. Synced ${totalMealsSynced} new meals, skipped ${totalMealsSkipped} existing meals.`;
            console.log(successMessage);

        } catch (error) {
            console.error("[Netlify Meal Sync] Error during sync data processing:", error);
            throw error;
        } finally {
            // 3. Release lock
            if (lockAcquired) {
                console.log("[Netlify Meal Sync] Releasing lock...");
                await lockRef.set({ 
                    status: 'idle-netlify', 
                    endTime: FieldValue.serverTimestamp(),
                    lastSyncStats: {
                        mealsSynced: totalMealsSynced,
                        mealsSkipped: totalMealsSkipped,
                        usersProcessed: totalUsersProcessed
                    }
                }, { merge: true });
                console.log("[Netlify Meal Sync] Lock released.");
            }
        }

        // Success response
        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                message: `Meal sync completed successfully. Synced ${totalMealsSynced} new meals, skipped ${totalMealsSkipped} existing meals from ${totalUsersProcessed} users.`,
                mealsSynced: totalMealsSynced,
                mealsSkipped: totalMealsSkipped,
                usersProcessed: totalUsersProcessed
            })
        };

    } catch (err) {
        console.error('[Netlify Meal Sync] Top-level operation failed:', err.message);
        
        // Ensure lock is released if acquired but failed
        if (lockAcquired && !(err.message === 'Meal sync process is already running.')) {
            try {
                console.log("[Netlify Meal Sync] Releasing lock due to error...");
                await lockRef.set({ 
                    status: 'failed-netlify', 
                    error: err.message, 
                    endTime: FieldValue.serverTimestamp() 
                }, { merge: true });
                console.log("[Netlify Meal Sync] Lock released after error.");
            } catch (lockError) {
                console.error("[Netlify Meal Sync] Failed to release lock after error:", lockError);
            }
        }

        // Determine status code based on error
        const statusCode = err.message === 'Meal sync process is already running.' ? 409 : 500;
        return {
            statusCode: statusCode,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                error: err.message || 'Unknown error during meal sync operation.',
                mealsSynced: totalMealsSynced,
                mealsSkipped: totalMealsSkipped
            })
        };
    }
}; 