const { db, headers } = require('./config/firebase');

// Check if we're in development mode (based on NODE_ENV)
const isDevelopmentMode = process.env.NODE_ENV === 'development';

// Check each environment variable separately for better error diagnosis
let missingVars = [];

if (!process.env.FIREBASE_SECRET_KEY) {
  missingVars.push('FIREBASE_SECRET_KEY');
  console.error('Missing environment variable: FIREBASE_SECRET_KEY');
}

if (!process.env.FIREBASE_PRIVATE_KEY) {
  missingVars.push('FIREBASE_PRIVATE_KEY_ALT');
  console.error('Missing environment variable: FIREBASE_PRIVATE_KEY_ALT');
}

// Mock configuration for development mode
const useMockData = isDevelopmentMode && missingVars.length > 0;

// If in production, throw error about missing variables
if (missingVars.length > 0 && !useMockData) {
  throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
}

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
      console.log(`[DEV MODE] Looking up mock data for username: ${username}`);
      const normalizedUsername = username.toLowerCase().trim();
      
      // Try case-insensitive lookup in mock data
      const mockUserKey = Object.keys(mockUsers).find(key => 
        key.toLowerCase().trim() === normalizedUsername
      );
      
      const mockUser = mockUserKey ? mockUsers[mockUserKey] : null;
      if (!mockUser) {
        console.log(`[DEV MODE] No mock user found for: ${username} (normalized: ${normalizedUsername})`);
        throw new Error('User not found');
      }
      console.log(`[DEV MODE] Found mock user: ${mockUserKey}`);
      return mockUser;
    }

    // Real implementation - case insensitive username lookup
    const usersRef = db.collection('users');
    const normalizedUsername = username.toLowerCase().trim();
    console.log(`Looking up username: "${username}" (normalized: "${normalizedUsername}")`);
    
    // First try exact match with normalized username
    let snapshot = await usersRef.where('username', '==', normalizedUsername).get();
    
    // If no exact match found, try case-insensitive search
    if (snapshot.empty) {
      console.log('No exact match found, trying case-insensitive search...');
      const allUsersSnapshot = await usersRef.get();
      const matchingDocs = allUsersSnapshot.docs.filter(doc => {
        const userData = doc.data();
        return userData.username && userData.username.toLowerCase().trim() === normalizedUsername;
      });
      
      if (matchingDocs.length > 0) {
        console.log(`Found case-insensitive match: "${matchingDocs[0].data().username}"`);
        // Create a fake snapshot object for consistency
        snapshot = {
          empty: false,
          docs: matchingDocs
        };
      }
    }

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