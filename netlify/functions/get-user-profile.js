const admin = require('firebase-admin');

// Check if we're in development mode (based on NODE_ENV)
const isDevelopmentMode = process.env.NODE_ENV === 'development';

// Check each environment variable separately for better error diagnosis
let missingVars = [];

if (!process.env.FIREBASE_SECRET_KEY) {
  missingVars.push('FIREBASE_SECRET_KEY');
  console.error('Missing environment variable: FIREBASE_SECRET_KEY');
}

if (!process.env.FIREBASE_PRIVATE_KEY_ALT) {
  missingVars.push('FIREBASE_PRIVATE_KEY_ALT');
  console.error('Missing environment variable: FIREBASE_PRIVATE_KEY_ALT');
}

// Mock configuration for development mode
const useMockData = isDevelopmentMode && missingVars.length > 0;

// If in production, throw error about missing variables
if (missingVars.length > 0 && !useMockData) {
  throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
}

// Initialize Firebase if not already initialized
if (admin.apps.length === 0) {
  try {
    if (!useMockData) {
      // Real Firebase initialization
      const privateKey = process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n');
      
      admin.initializeApp({
        credential: admin.credential.cert({
          "type": "service_account",
          "project_id": "quicklifts-dd3f1",
          "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ALT,
          "private_key": privateKey,
          "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
          "client_id": "111494077667496751062",
          "auth_uri": "https://accounts.google.com/o/oauth2/auth",
          "token_uri": "https://oauth2.googleapis.com/token",
          "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
          "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
          "universe_domain": "googleapis.com"
        })
      });
      console.log('Firebase Admin SDK initialized with actual credentials');
    } else {
      // Development mode with mock data - no Firebase initialization needed
      console.warn('⚠️ Running in DEVELOPMENT MODE with MOCK DATA due to missing environment variables');
    }
  } catch (error) {
    if (isDevelopmentMode) {
      console.error('Firebase initialization error (continuing with mock data):', error);
    } else {
      throw error; // Re-throw in production
    }
  }
}

// Only initialize db if not using mock data
const db = useMockData ? null : admin.firestore();

// Mock user data for development testing
const mockUsers = {
  'thetrefecta': {
    id: 'mock-user-id-trefecta',
    displayName: 'Trefecta (Mock)',
    username: 'thetrefecta',
    bio: 'This is mock data for development testing',
    profileImage: { 
      profileImageURL: 'https://via.placeholder.com/150?text=Trefecta' 
    },
    creator: {
      stripeAccountId: 'mock-stripe-acct-123',
      onboardingStatus: 'complete'
    },
    workoutCount: 42,
    bodyWeight: [],
    following: [],
    followers: []
  },
  // Add more mock users as needed
};

async function getUserByUsername(username) {
  try {
    // If using mock data, return mocked user
    if (useMockData) {
      console.log(`[DEV MODE] Returning mock data for username: ${username}`);
      const mockUser = mockUsers[username];
      if (!mockUser) {
        throw new Error('User not found');
      }
      return mockUser;
    }

    // Real implementation
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();

    if (snapshot.empty) {
      throw new Error('User not found');
    }

    const userData = snapshot.docs[0].data();
    console.log('User data:', userData);
    
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
    console.error('Error getting user:', error);
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
    const username = event.queryStringParameters?.username;
    
    if (!username) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Username parameter is required' 
        })
      };
    }

    const user = await getUserByUsername(username);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user,
        mode: useMockData ? 'development (mock data)' : 'production'
      })
    };

  } catch (error) {
    console.error('Error in get-user-profile function:', error);
    
    return {
      statusCode: error.message === 'User not found' ? 404 : 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        mode: useMockData ? 'development (mock data)' : 'production',
        missingEnvVars: missingVars.length > 0 ? missingVars : undefined
      })
    };
  }
};