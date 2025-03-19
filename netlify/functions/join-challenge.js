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

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400'
};

exports.handler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  // Add CORS headers to all responses
  const headers = {
    ...corsHeaders,
    'Content-Type': 'application/json'
  };

  try {
    console.log('📥 Received request:', event.body);
    const { username, challengeId } = JSON.parse(event.body);

    if (!username || !challengeId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Username and challengeId are required'
        })
      };
    }

    // Get user by username
    const usersRef = db.collection('users');
    const userSnapshot = await usersRef.where('username', '==', username).get();

    if (userSnapshot.empty) {
      console.log('❌ User not found:', username);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userSnapshot.docs[0].data();
    const userId = userSnapshot.docs[0].id;

    // Get challenge
    const challengeRef = db.collection('sweatlist-collection').doc(challengeId);
    const challengeDoc = await challengeRef.get();

    if (!challengeDoc.exists) {
      console.log('❌ Challenge not found:', challengeId);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Challenge not found'
        })
      };
    }

    const challenge = challengeDoc.data();
    const userChallengeId = `${challengeId}-${userId}-${Date.now()}`;

    // Create user challenge document
    const userRound = {
      id: userChallengeId,
      challenge: challenge,
      challengeId: challengeId,
      userId: userId,
      fcmToken: userData.fcmToken || '',
      profileImage: userData.profileImage || {},
      progress: 0,
      completedWorkouts: [],
      isCompleted: false,
      uid: userId,
      location: userData.location || null,
      city: '',
      country: '',
      timezone: '',
      username: username,
      joinDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      pulsePoints: {
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
      currentStreak: 0,
      encouragedUsers: [],
      encouragedByUsers: [],
      checkIns: []
    };

    console.log('🆕 Creating new UserTogetherRound with ID:', userChallengeId);
    console.log('📤 Data to Firestore:', userRound);

    // Save to Firestore
    await db.collection('user-challenge').doc(userChallengeId).set(userRound);
    console.log('✅ User challenge created successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Successfully joined challenge'
      })
    };

  } catch (error) {
    console.error('❌ Error creating user challenge:', error);
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