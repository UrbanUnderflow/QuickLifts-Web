const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

const db = admin.firestore();

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userId, limit = '50' } = event.queryStringParameters || {};
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId is required' })
      };
    }

    // Fetch run summaries from user's subcollection
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .collection('runSummaries')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();

    const runSummaries = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      runSummaries.push({
        id: doc.id,
        ...data,
        // Convert timestamps to unix
        createdAt: data.createdAt?.toDate?.()?.getTime() / 1000 || null,
        updatedAt: data.updatedAt?.toDate?.()?.getTime() / 1000 || null,
        startTime: data.startTime?.toDate?.()?.getTime() / 1000 || data.startTime || null,
        completedAt: data.completedAt?.toDate?.()?.getTime() / 1000 || data.completedAt || null
      });
    });

    console.log(`✅ Fetched ${runSummaries.length} run summaries for user ${userId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        runSummaries,
        count: runSummaries.length
      })
    };

  } catch (error) {
    console.error('Error fetching run summaries:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch run summaries',
        details: error.message 
      })
    };
  }
};
