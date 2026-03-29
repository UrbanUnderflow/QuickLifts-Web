const { admin } = require('./config/firebase');

const db = admin.firestore();

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  try {
    const userId = event.queryStringParameters.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'userId parameter is required' })
      };
    }

    // Get user's body weight subcollection
    const bodyWeightRef = db.collection('users').doc(userId).collection('bodyWeight');
    const limit = event.queryStringParameters.limit ? parseInt(event.queryStringParameters.limit) : 1;
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
