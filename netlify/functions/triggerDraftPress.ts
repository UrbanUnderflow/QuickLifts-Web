import { Handler } from '@netlify/functions';
import { admin, db, headers } from './config/firebase';
import { handler as draftPressHandler } from './draftPress';
import { schedule } from '@netlify/functions';

// Admin authentication middleware
// This checks if the request includes a valid Firebase ID token for an admin user
const verifyAdminAuth = async (authHeader: string | undefined): Promise<boolean> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No bearer token provided');
    return false;
  }

  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if user is an admin
    const userRef = db.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log('User document not found');
      return false;
    }
    
    const userData = userDoc.data();
    return userData?.isAdmin === true;
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return false;
  }
};

/**
 * Netlify Function Handler
 * Manually triggers press release generation (admin only)
 */
export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST methods
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Verify admin authentication
  const isAdmin = await verifyAdminAuth(event.headers?.authorization);
  if (!isAdmin) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ success: false, error: 'Unauthorized. Admin access required.' })
    };
  }

  // All checks passed, trigger the press release generation
  try {
    console.log('Manual trigger for press release generation');
    await draftPressHandler({}, {});
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Press release generation triggered successfully' })
    };
  } catch (error) {
    console.error('Error triggering press release generation:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Failed to trigger press release generation',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

// "0 9 * * 1" // Monday 9 AM UTC
const CRON_SCHEDULE = "*/5 * * * *"; // Run every 5 minutes for testing

// Schedule handler - Wrapped with schedule()
export const scheduleHandler = schedule(CRON_SCHEDULE, async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST methods
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Verify admin authentication
  const isAdmin = await verifyAdminAuth(event.headers?.authorization);
  if (!isAdmin) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ success: false, error: 'Unauthorized. Admin access required.' })
    };
  }

  // All checks passed, trigger the press release generation
  try {
    console.log(`Scheduled trigger (${CRON_SCHEDULE}) started, invoking draftPress...`);
    
    // Invoke the draftPress function (imported as draftPressHandler)
    await draftPressHandler({}, {}); // Pass empty event and context if needed by handler
    
    console.log("Scheduled trigger: draftPress invoked successfully.");
    return {
      statusCode: 200,
      // No headers/body needed for scheduled function success usually
    };
  } catch (error) {
    console.error('Error in scheduledHandler:', error);
    return {
      statusCode: 500,
      // No headers/body needed for scheduled function failure usually
    };
  }
}); 