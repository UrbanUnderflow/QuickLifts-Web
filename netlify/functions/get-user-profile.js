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
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    })
  });
}

const db = admin.firestore();

async function getUserByUsername(username) {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();

    if (snapshot.empty) {
      throw new Error('User not found');
    }

    const userData = snapshot.docs[0].data();
    
    // Return only necessary profile data
    return {
      id: snapshot.docs[0].id,
      displayName: userData.displayName,
      username: userData.username,
      bio: userData.bio || '',
      profileImage: userData.profileImage || {},
      creator: userData.creator || {},
      workoutCount: userData.workoutCount || 0,
      bodyWeight: userData.bodyWeight || [],
      following: userData.following || [],
      followers: userData.followers || []
    };
  } catch (error) {
    throw error;
  }
}


exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
        statusCode: 200,
        headers,
        body: ''
    };
  }

  try {
    const username = event.queryStringParameters.username;
    
    if (!username) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false, 
          error: 'Username parameter is required' 
        })
      };
    }

    const user = await getUserByUsername(username);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        user
      })
    };

  } catch (error) {
    console.error('Error fetching user profile:', error);
    
    return {
      statusCode: error.message === 'User not found' ? 404 : 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};