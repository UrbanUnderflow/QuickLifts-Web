const { admin } = require('./config/firebase');

const db = admin.firestore();

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  }

  try {
    // Check if Firebase Admin is properly initialized
    if (!admin.apps.length || !admin.apps[0]) {
      return {
        statusCode: 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ 
          message: 'Service temporarily unavailable - Firebase Admin not initialized',
          coach: null 
        }),
      };
    }

    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ message: 'userId is required' }),
      };
    }

    console.log(`[GetCoachProfile] Checking coach profile for userId: ${userId}`);

    // Check if coach profile exists
    const coachDoc = await db.collection('coaches').doc(userId).get();

    if (!coachDoc.exists) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: JSON.stringify({ 
          message: 'Coach profile not found',
          coach: null 
        }),
      };
    }

    const coachData = coachDoc.data();
    console.log(`[GetCoachProfile] Found coach profile:`, {
      userId,
      subscriptionStatus: coachData.subscriptionStatus,
      userType: coachData.userType,
      referralCode: coachData.referralCode
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({
        coach: {
          userId: coachData.userId,
          referralCode: coachData.referralCode,
          subscriptionStatus: coachData.subscriptionStatus,
          userType: coachData.userType,
          createdAt: coachData.createdAt,
          updatedAt: coachData.updatedAt
        }
      }),
    };

  } catch (error) {
    console.error('[GetCoachProfile] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ 
        message: 'Internal server error',
        error: error.message 
      }),
    };
  }
};
