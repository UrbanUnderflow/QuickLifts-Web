const admin = require('firebase-admin');

// Add guard clauses to check for required environment variables
if (!process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error('Missing FIREBASE_PRIVATE_KEY environment variable.');
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Initialize Firebase only once

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: "quicklifts-dd3f1",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY,
      private_key: process.env.FIREBASE_SECRET_KEY_ALT.replace(/\\n/g, '\n'),
      client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      client_id: "111494077667496751062",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com"
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

async function getUserChallenges(challengeId) {
  try {
    const snapshot = await db.collection('user-challenge')
      .where('challengeId', '==', challengeId)
      .get();

    if (snapshot.empty) {
      console.log('No user challenges found for this challenge');
      return [];
    }

    const userChallenges = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('user-challenge data: ', JSON.stringify(data, null, 2));

      return {
        id: doc.id,
        challengeId: data.challengeId || '',
        userId: data.userId || '',
        username: data.username || '',
        profileImage: data.profileImage || null,
        progress: data.progress || 0,
        completedWorkouts: data.completedWorkouts || [],
        isCompleted: data.isCompleted || false,
        city: data.city || '',
        country: data.country || '',
        timezone: data.timezone || '',
        joinDate: convertTimestamp(data.joinDate),
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
        pulsePoints: data.pulsePoints || {
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
        currentStreak: data.currentStreak || 0,
        encouragedUsers: data.encouragedUsers || [],
        encouragedByUsers: data.encouragedByUsers || [],
        checkIns: Array.isArray(data.checkIns) ? 
          data.checkIns.map(checkIn => convertTimestamp(checkIn)).filter(Boolean) : []
      };
    });

    return userChallenges;
  } catch (error) {
    console.error('Error fetching user challenges:', error);
    throw error;
  }
}

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
    console.log("THIS IS THE PIN: " + data.pin);

    // Fetch participants from user-challenge collection
    const participants = await getUserChallenges(collectionId);
    console.log('Fetched participants:', JSON.stringify(participants, null, 2));

    console.log('Challenge data before processing:', JSON.stringify(data.challenge, null, 2));
    // Process the collection data with Unix timestamp handling    
    const collection = {
      id: doc.id,
      title: data.title || '',
      subtitle: data.subtitle || '',
      pin: data.pin || null, 
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
      challenge: data.challenge ? {
        id: data.challenge.id || doc.id,
        title: data.challenge.title || '',
        subtitle: data.challenge.subtitle || '',
        introVideos: (data.challenge.introVideos || []).map((v) => ({
          id: v.id || '',
          userId: v.userId || '',
          videoUrl: v.videoUrl || ''
        })),
        status: data.challenge.status || 'draft',
        startDate: convertTimestamp(data.challenge.startDate),
        endDate: convertTimestamp(data.challenge.endDate),
        createdAt: convertTimestamp(data.challenge.createdAt),
        updatedAt: convertTimestamp(data.challenge.updatedAt),
        pricingInfo: data.challenge.pricingInfo || { isEnabled: false, amount: 0, currency: 'USD' },
        participants: participants
      } : null
    };

    console.log('Challenge data after processing:', JSON.stringify(collection.challenge, null, 2));


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