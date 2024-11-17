// netlify/functions/get-workout-summaries.js
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      "type": "service_account",
      "project_id": "quicklifts-dd3f1",
      "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
      "private_key": process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
      "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      "client_id": "111494077667496751062",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com"
    })
  });
}

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

      // Debug log
      console.log('Raw data timestamps:', {
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        completedAt: data.completedAt
      });

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
    console.log('Event received:', event); // Debug logging

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

    console.log('Fetching workouts for userId:', userId); // Debug logging
    const summaries = await fetchWorkoutSummaries(userId);
    console.log('Fetched summaries:', summaries); // Debug logging

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