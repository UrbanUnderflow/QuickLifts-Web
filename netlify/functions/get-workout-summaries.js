// netlify/functions/get-workout-summaries.js
const { admin } = require('./config/firebase');

const db = admin.firestore();

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

async function fetchWorkoutSummaries(userId) {
  try {
    const summariesRef = db.collection('users').doc(userId).collection('workoutSummary');
    const snapshot = await summariesRef.get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Helper function to safely convert timestamps
      const convertTimestamp = (timestamp) => {
        if (!timestamp) return null;
        if (timestamp._seconds) return new Date(timestamp._seconds * 1000).toISOString();
        if (timestamp.seconds) return new Date(timestamp.seconds * 1000).toISOString();
        if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
        if (timestamp instanceof Date) return timestamp.toISOString();
        return null;
      };

      return {
        id: doc.id,
        ...data,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
        completedAt: convertTimestamp(data.completedAt)
      };
    });
  } catch (error) {
    console.error('Error in fetchWorkoutSummaries:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  // Handle CORS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'userId parameter is required' 
        })
      };
    }

    const summaries = await fetchWorkoutSummaries(userId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        summaries
      })
    };

  } catch (error) {
    console.error('Handler error:', error); // Debug logging
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
