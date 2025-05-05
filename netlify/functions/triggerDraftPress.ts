import { Handler } from '@netlify/functions';
import { admin, db, headers } from './config/firebase';
import { generatePressRelease } from './draftPress';

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
    const result = await generatePressRelease();

    return {
      statusCode: result.success ? 200 : 500,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error in triggerDraftPress:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}; 