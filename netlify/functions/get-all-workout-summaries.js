// Import necessary modules
const { admin } = require('./config/firebase');

const db = admin.firestore();

// Handler function for Netlify
exports.handler = async (event) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': 'http://localhost:8888',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    const summaries = [];

    // For each user, get their workout summaries
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const summariesSnapshot = await userDoc.ref.collection('workoutSummary').get();
      
      summariesSnapshot.docs.forEach(doc => {
        summaries.push({
          id: doc.id,
          user: {
            userId: userDoc.id,
            username: userData.username || 'Unknown User'
          },
          ...doc.data()
        });
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        summaries
      })
    };

  } catch (error) {
    console.error('Error:', error);
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
