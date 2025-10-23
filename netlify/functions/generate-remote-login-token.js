// generate-remote-login-token.js
// Function to generate a secure token for remote login (admin impersonation)

const { db, headers } = require('./config/firebase');
const crypto = require('crypto');

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
    const { targetUserId, adminUserId } = JSON.parse(event.body);

    if (!targetUserId || !adminUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing targetUserId or adminUserId' 
        })
      };
    }

    // Verify admin user has admin privileges
    const adminUserDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminUserDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Admin user not found' })
      };
    }

    const adminData = adminUserDoc.data();
    const adminEmail = (adminData?.email || '').toLowerCase();

    // Accept either flag on user doc or presence in `admin` collection (email as doc id)
    let isAdmin = !!adminData?.adminVerified;
    try {
      if (!isAdmin && adminEmail) {
        const adminCollectionDoc = await db.collection('admin').doc(adminEmail).get();
        isAdmin = !!adminCollectionDoc?.exists;
      }
    } catch (e) {
      // fall through, isAdmin stays as computed
    }

    if (!isAdmin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Unauthorized: Admin privileges required' 
        })
      };
    }

    // Verify target user exists
    const targetDoc = await db.collection('users').doc(targetUserId).get();
    if (!targetDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Target user not found' })
      };
    }

    const targetData = targetDoc.data();

    // Generate a secure token with expiration
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Store the token in Firestore with metadata
    await db.collection('remoteLoginTokens').doc(token).set({
      targetUserId,
      adminUserId,
      adminEmail: adminData.email,
      targetEmail: targetData.email,
      targetUsername: targetData.username,
      createdAt: new Date(),
      expiresAt,
      used: false,
      usedAt: null
    });

    console.log(`[GenerateRemoteLoginToken] Generated token for admin ${adminData.email} to impersonate ${targetData.email}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token,
        expiresAt: expiresAt.toISOString(),
        targetUser: {
          id: targetUserId,
          email: targetData.email,
          username: targetData.username
        }
      })
    };

  } catch (error) {
    console.error('[GenerateRemoteLoginToken] Error:', error);
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
