const { admin } = require('./config/firebase');

const db = admin.firestore();
const { requireCheckinReader } = require('./config/require-user');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  headers['Cache-Control'] = 'no-store';
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };

  try {
    const userId = event.queryStringParameters?.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'userId parameter is required' })
      };
    }

    const access = await requireCheckinReader(event, userId);
    if (access.error) return { statusCode: access.statusCode, headers, body: JSON.stringify({ success: false, error: access.error }) };

    // Get user's body weight subcollection
    const bodyWeightRef = db.collection('users').doc(userId).collection('bodyWeight');
    const requestedLimit = event.queryStringParameters.limit || '1';
    const limit = Number(requestedLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'limit must be an integer from 1 to 100' }) };
    const snapshot = await bodyWeightRef
      .orderBy('createdAt', 'desc')
      .limit(limit)  // Support fetching multiple entries for profile view
      .get();

    if (snapshot.empty) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          bodyWeight: []
        })
      };
    }

    const bodyWeight = snapshot.docs.map(doc => ({
      id: doc.id,
      oldWeight: doc.data().oldWeight || 0,
      newWeight: doc.data().newWeight || 0,
      frontUrl: doc.data().frontUrl || "",
      backUrl: doc.data().backUrl || "",
      sideUrl: doc.data().sideUrl || "",
      createdAt: doc.data().createdAt || 0,
      updatedAt: doc.data().updatedAt || 0
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        bodyWeight
      })
    };
  } catch (error) {
    console.error('Error fetching body weight:', error);
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
