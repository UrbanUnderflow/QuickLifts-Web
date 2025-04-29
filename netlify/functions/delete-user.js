// netlify/functions/delete-user.js

// --- Use shared configuration ---
const { admin, db, headers } = require('./config/firebase'); // Assuming this exports initialized admin, db, and headers

// --- Get auth instance from the shared admin instance ---
const auth = admin.auth();

exports.handler = async (event, context) => {
  console.log('[delete-user] Function invoked.');

  // 1. Check HTTP Method & OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    console.warn(`[delete-user] Method Not Allowed: ${event.httpMethod}`);
    return {
      statusCode: 405,
      headers: { ...headers, Allow: 'POST' }, // Add Allow header
      body: JSON.stringify({ success: false, message: 'Method Not Allowed' }),
    };
  }

  // 2. TODO: Verify Admin Authentication (CRITICAL!)
  //    - Get token from event.headers.authorization
  //    - Verify using admin.auth().verifyIdToken()
  //    - Check custom claims or admin list
  console.warn('[delete-user] TODO: Implement admin authentication check!');
  const isAdmin = true; // <<<--- !!! REPLACE WITH ACTUAL ADMIN CHECK !!!
  if (!isAdmin) {
      console.error('[delete-user] Unauthorized attempt.');
      return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, message: 'Forbidden: Admin privileges required.' })
      };
  }

  // 3. Parse Request Body
  let body;
  try {
    body = JSON.parse(event.body || '{}'); // Added fallback for empty body
  } catch (e) {
    console.error('[delete-user] Error parsing request body:', e);
    return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'Invalid request body.' })
    };
  }

  const { userId } = body;

  if (!userId) {
    console.warn('[delete-user] Missing userId in request body.');
    return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'Missing required parameter: userId' })
    };
  }

  console.log(`[delete-user] Received request to delete user: ${userId}`);

  // 4. Perform Deletion
  try {
    // 4a. Delete Firebase Auth user
    console.log(`[delete-user] Attempting to delete Auth user: ${userId}`);
    await auth.deleteUser(userId);
    console.log(`[delete-user] Successfully deleted Auth user: ${userId}`);

    // 4b. Delete Firestore user document
    console.log(`[delete-user] Attempting to delete Firestore user document: users/${userId}`);
    const userDocRef = db.collection('users').doc(userId);
    await userDocRef.delete();
    console.log(`[delete-user] Successfully deleted Firestore user document: users/${userId}`);

    // 4c. TODO: Delete related data (optional but recommended)

    console.log(`[delete-user] Successfully deleted user ${userId} from Auth and Firestore.`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: `User ${userId} deleted successfully.` }),
    };

  } catch (error) {
    console.error(`[delete-user] Error deleting user ${userId}:`, error);

    // Handle specific errors (e.g., user not found)
    if (error.code === 'auth/user-not-found') {
      console.warn(`[delete-user] Auth user ${userId} not found, attempting to delete Firestore doc anyway.`);
      try {
         const userDocRef = db.collection('users').doc(userId);
         // Check if doc exists before deleting (optional, delete is idempotent)
         // const docSnap = await userDocRef.get();
         // if (docSnap.exists) {
            await userDocRef.delete();
            console.log(`[delete-user] Successfully deleted Firestore user document: users/${userId} (Auth user was already gone).`);
         // } else {
         //    console.log(`[delete-user] Firestore user document users/${userId} also not found.`);
         // }
         return {
           statusCode: 200,
           headers,
           body: JSON.stringify({ success: true, message: `User ${userId} deleted (Auth record not found, Firestore doc deleted).` }),
         };
      } catch (fsError) {
         console.error(`[delete-user] Error deleting Firestore user ${userId} after Auth user not found:`, fsError);
         return {
           statusCode: 500,
           headers,
           body: JSON.stringify({ success: false, message: `Failed to delete Firestore data for user ${userId}. Auth user may or may not exist. Error: ${fsError.message}` }),
         };
      }
    }

    // Generic error
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: `Failed to delete user ${userId}. Error: ${error.message}` }),
    };
  }
}; 