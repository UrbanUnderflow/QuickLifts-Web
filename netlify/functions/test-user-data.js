// test-user-data.js
// Simple function to check Calvin's user data

const { db, headers } = require('./config/firebase');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const userId = event.queryStringParameters?.userId || 'WcdbuVVg8zb9DIlXcqbPMzR4NyM2';
    
    console.log(`[TestUserData] Checking user: ${userId}`);
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }

    const userData = userDoc.data();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        userId,
        email: userData.email,
        username: userData.username,
        creator: userData.creator,
        hasCreator: !!userData.creator,
        creatorType: typeof userData.creator,
        creatorKeys: userData.creator ? Object.keys(userData.creator) : null
      })
    };

  } catch (error) {
    console.error('[TestUserData] Error:', error);
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
