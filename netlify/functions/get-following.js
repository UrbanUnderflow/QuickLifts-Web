// get-following.js
const { db, headers } = require('./config/firebase');

async function getFollowing(userId) {
  const followRequestsRef = db.collection('followRequests');
  const snapshot = await followRequestsRef
    .where('fromUser.id', '==', userId)
    .where('status', '==', 'accepted')
    .get();

  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map(doc => doc.data());
}

exports.handler = async (event) => {
  try {
    const userId = event.queryStringParameters.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'userId parameter is required' })
      };
    }

    const following = await getFollowing(userId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        following
      })
    };
  } catch (error) {
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