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
    const runSummary = JSON.parse(event.body);
    
    if (!runSummary.userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId is required' })
      };
    }

    // Generate ID if not provided
    const docId = runSummary.id || db.collection('users').doc().id;
    
    // Prepare data for Firestore
    const firestoreData = {
      ...runSummary,
      id: docId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Remove undefined values
    Object.keys(firestoreData).forEach(key => {
      if (firestoreData[key] === undefined) {
        delete firestoreData[key];
      }
    });

    // Save to user's runSummaries subcollection
    await db
      .collection('users')
      .doc(runSummary.userId)
      .collection('runSummaries')
      .doc(docId)
      .set(firestoreData);

    console.log(`✅ Run summary saved: ${docId} for user ${runSummary.userId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        id: docId,
        message: 'Run summary saved successfully'
      })
    };

  } catch (error) {
    console.error('Error saving run summary:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to save run summary',
        details: error.message 
      })
    };
  }
};
