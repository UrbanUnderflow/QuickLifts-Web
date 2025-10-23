// consume-remote-login-token.js
// Function to consume a remote login token and authenticate as the target user

const { db, headers } = require('./config/firebase');
const admin = require('firebase-admin');

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { token } = JSON.parse(event.body);

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing token' 
        })
      };
    }

    // Verify token exists and is valid
    const tokenDoc = await db.collection('remoteLoginTokens').doc(token).get();
    if (!tokenDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid token' })
      };
    }

    const tokenData = tokenDoc.data();
    
    // Check if token is expired
    if (new Date() > tokenData.expiresAt.toDate()) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ success: false, error: 'Token expired' })
      };
    }

    // Check if token has already been used
    if (tokenData.used) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({ success: false, error: 'Token already used' })
      };
    }

    // Mark token as used
    await db.collection('remoteLoginTokens').doc(token).update({
      used: true,
      usedAt: new Date()
    });

    // Get target user data
    const targetDoc = await db.collection('users').doc(tokenData.targetUserId).get();
    if (!targetDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Target user not found' })
      };
    }

    const targetUserData = targetDoc.data();

    // Create a custom token for the target user
    const customToken = await admin.auth().createCustomToken(tokenData.targetUserId, {
      adminImpersonation: true,
      impersonatedBy: tokenData.adminUserId,
      impersonatedAt: new Date().toISOString()
    });

    console.log(`[ConsumeRemoteLoginToken] Admin ${tokenData.adminEmail} successfully impersonated ${tokenData.targetEmail}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        customToken,
        user: {
          id: tokenData.targetUserId,
          email: targetUserData.email,
          username: targetUserData.username,
          adminImpersonation: true,
          impersonatedBy: tokenData.adminEmail
        }
      })
    };

  } catch (error) {
    console.error('[ConsumeRemoteLoginToken] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
