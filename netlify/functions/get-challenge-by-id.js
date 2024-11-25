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

// Updated timestamp converter for Unix timestamps
const convertTimestamp = (timestamp) => {
  if (!timestamp) return null;
  
  // If it's a number (Unix timestamp), convert it
  if (typeof timestamp === 'number') {
    return new Date(timestamp * 1000).toISOString();
  }
  
  // Handle already converted date
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  return null;
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

    // Process the collection data with Unix timestamp handling
    const collection = {
      id: doc.id,
      title: data.title || '',
      subtitle: data.subtitle || '',
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
      challenge: data.challenge ? {
        id: data.challenge.id || doc.id,
        title: data.challenge.title || '',
        subtitle: data.challenge.subtitle || '',
        introVideoURL: data.challenge.introVideoURL || '',
        status: data.challenge.status || 'draft',
        startDate: convertTimestamp(data.challenge.startDate),
        endDate: convertTimestamp(data.challenge.endDate),
        createdAt: convertTimestamp(data.challenge.createdAt),
        updatedAt: convertTimestamp(data.challenge.updatedAt),
        participants: Array.isArray(data.challenge.participants) ? data.challenge.participants.map(participant => ({
          id: participant.id || '',
          challengeId: participant.challengeId || '',
          userId: participant.userId || '',
          username: participant.username || '',
          profileImage: participant.profileImage || null,
          progress: participant.progress || 0,
          completedWorkouts: participant.completedWorkouts || [],
          isCompleted: participant.isCompleted || false,
          city: participant.city || '',
          country: participant.country || '',
          timezone: participant.timezone || '',
          joinDate: convertTimestamp(participant.joinDate),
          createdAt: convertTimestamp(participant.createdAt),
          updatedAt: convertTimestamp(participant.updatedAt),
          pulsePoints: participant.pulsePoints || {
            baseCompletion: 0,
            firstCompletion: 0,
            streakBonus: 0,
            checkInBonus: 0,
            effortRating: 0,
            chatParticipation: 0,
            locationCheckin: 0,
            contentEngagement: 0,
            encouragementSent: 0,
            encouragementReceived: 0
          },
          currentStreak: participant.currentStreak || 0,
          encouragedUsers: participant.encouragedUsers || [],
          encouragedByUsers: participant.encouragedByUsers || [],
          checkIns: Array.isArray(participant.checkIns) ? 
            participant.checkIns.map(checkIn => convertTimestamp(checkIn)).filter(Boolean) : []
        })) : []
      } : null
    };

    if (!collection.challenge) {
      console.log('Collection does not contain a challenge.');
      return null;
    }

    console.log('Processed collection:', JSON.stringify(collection, null, 2));
    return collection;
  } catch (error) {
    console.error('Error fetching collection:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers,
      body: '' 
    };
  }

  try {
    const collectionId = event.queryStringParameters?.id;
    if (!collectionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Collection ID is required' 
        })
      };
    }

    const collection = await getCollectionById(collectionId);
    
    if (!collection) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Challenge not found or not available' 
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        collection
      })
    };

  } catch (error) {
    console.error('Error in handler:', error);
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