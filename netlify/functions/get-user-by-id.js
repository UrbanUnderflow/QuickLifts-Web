const { db, headers } = require('./config/firebase');

async function getUserById(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    console.log('User data:', userData);
    
    // Return only necessary profile data
    return {
      id: userDoc.id,
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
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const userId = event.queryStringParameters?.id;

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'User ID parameter is required' 
        })
      };
    }

    const user = await getUserById(userId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        user
      })
    };

  } catch (error) {
    console.error('Error fetching user profile:', error);

    return {
      statusCode: error.message === 'User not found' ? 404 : 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};