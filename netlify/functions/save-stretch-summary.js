const { admin } = require('./config/firebase');

const db = admin.firestore();

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const stretchSummary = JSON.parse(event.body);

    if (!stretchSummary.userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId is required' })
      };
    }

    // Generate ID if not provided
    const docId = stretchSummary.id || db.collection('users').doc().id;

    // Prepare data for Firestore
    const firestoreData = {
      ...stretchSummary,
      id: docId,
      workoutType: 'stretch', // Mark as stretch for querying
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Remove undefined values
    Object.keys(firestoreData).forEach(key => {
      if (firestoreData[key] === undefined) {
        delete firestoreData[key];
      }
    });

    // Save to user's stretchSummaries subcollection
    await db
      .collection('users')
      .doc(stretchSummary.userId)
      .collection('stretchSummaries')
      .doc(docId)
      .set(firestoreData);

    console.log(`✅ Stretch summary saved: ${docId} for user ${stretchSummary.userId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        id: docId,
        message: 'Stretch summary saved successfully'
      })
    };

  } catch (error) {
    console.error('Error saving stretch summary:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to save stretch summary',
        details: error.message
      })
    };
  }
};
