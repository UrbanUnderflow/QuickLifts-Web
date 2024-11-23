// get-challenge-by-id.js
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

// Updated timestamp converter
const convertTimestamp = (timestamp) => {
  try {
    // Handle Firestore Timestamp
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
    // Handle seconds/nanoseconds format
    if (timestamp && timestamp._seconds !== undefined) {
      return new Date(timestamp._seconds * 1000).toISOString();
    }
    // Handle regular Date objects
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    // Handle timestamp numbers
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toISOString();
    }
    console.log('Unable to convert timestamp:', timestamp);
    return null;
  } catch (error) {
    console.error('Error converting timestamp:', error);
    return null;
  }
};

// Helper function to process dates in nested objects
const processDateFields = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const processed = { ...obj };
  
  for (const [key, value] of Object.entries(processed)) {
    // Check if the field name suggests it's a date
    if (key.toLowerCase().includes('date') || 
        key === 'createdAt' || 
        key === 'updatedAt') {
      processed[key] = convertTimestamp(value);
    } 
    // Handle nested objects
    else if (value && typeof value === 'object' && !value.toDate) {
      if (Array.isArray(value)) {
        processed[key] = value.map(item => 
          typeof item === 'object' ? processDateFields(item) : item
        );
      } else {
        processed[key] = processDateFields(value);
      }
    }
  }
  
  return processed;
};

async function getCollectionById(collectionId) {
  console.log(`Fetching collection with ID: ${collectionId}`);
  
  try {
    const doc = await db.collection('sweatlist-collection').doc(collectionId).get();

    if (!doc.exists) {
      console.log('No collection found with the given ID.');
      return null;
    }

    const data = doc.data();
    console.log('Raw Firestore data:', JSON.stringify(data, null, 2));

    // Process the collection data with dates
    const collection = {
      id: doc.id,
      ...processDateFields(data)
    };

    // Verify this is a challenge collection
    if (!collection.challenge) {
      console.log('Collection does not contain a challenge.');
      return null;
    }

    // Log processed data for debugging
    console.log('Processed collection:', JSON.stringify(collection, null, 2));

    return collection;
  } catch (error) {
    console.error('Error fetching collection:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const collectionId = event.queryStringParameters?.id;
    if (!collectionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Collection ID is required' })
      };
    }

    const collection = await getCollectionById(collectionId);
    
    if (!collection) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Challenge not found or not available' })
      };
    }

    // Log final response for debugging
    console.log('Final response:', JSON.stringify({ success: true, collection }, null, 2));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, collection })
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