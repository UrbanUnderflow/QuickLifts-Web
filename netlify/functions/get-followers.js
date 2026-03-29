// get-followers.js
const { admin } = require('./config/firebase');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const db = admin.firestore();

async function getFollowers(userId) {
  const followRequestsRef = db.collection('followRequests');
  const snapshot = await followRequestsRef
    .where('toUser.id', '==', userId)
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

    const followers = await getFollowers(userId);
    
    return {
      statusCode: 200,
      headers, 
      body: JSON.stringify({
        success: true,
        followers
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
