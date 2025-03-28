// get-challenges.js
const admin = require('firebase-admin');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

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

async function getCollectionsByOwnerId(ownerId) {
  const now = new Date();
  console.log(`Fetching collections for ownerId: ${ownerId}`);
  
  try {
    const snapshot = await db.collection('sweatlist-collection')
      .where('ownerId', '==', ownerId)
      .get();

    if (snapshot.empty) {
      console.log('No collections found for the given ownerId.');
      return [];
    }

    // Helper function to safely convert timestamps
    const convertTimestamp = (timestamp) => {
      if (!timestamp) return null;
      if (timestamp._seconds) return new Date(timestamp._seconds * 1000);
      if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
      if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate();
      if (timestamp instanceof Date) return timestamp;
      return null;
    };

    const collections = snapshot.docs
      .map(doc => {
        return {
          id: doc.id,
          ...doc.data()
        };
      })
      .filter(collection => {
        const hasChallenge = !!collection.challenge;
        return hasChallenge;
      })
      .filter(collection => {
        const startDate = convertTimestamp(collection.challenge.startDate);
        const endDate = convertTimestamp(collection.challenge.endDate);
        return startDate < now && endDate > now;
      })
      .filter(collection => {
        const isPublished = collection.challenge.status === 'published';
        return isPublished;
      });

    return collections;
  } catch (error) {
    throw error;
  }
}


exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const userId = event.queryStringParameters.userId;
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'userId is required' })
      };
    }

    const challenges = await getCollectionsByOwnerId(userId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, challenges })
    };
  } catch (error) {
    console.error('Error in handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
