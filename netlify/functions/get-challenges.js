// get-challenges.js
const { db, headers } = require('./config/firebase');

async function getCollectionsByOwnerId(ownerId) {
  const now = new Date();
  console.log(`Fetching collections for ownerId: ${ownerId}`);
  
  try {
    const snapshot = await db.collection('sweatlist-collection')
      .where('ownerId', '==', ownerId)
      .get();

    if (snapshot.empty) {
      console.log('No collections found for the given ownerId.');
      return [];
    }

    // Helper function to safely convert timestamps
    const convertTimestamp = (timestamp) => {
      if (!timestamp) return null;
      if (timestamp._seconds) return new Date(timestamp._seconds * 1000);
      if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
      if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate();
      if (timestamp instanceof Date) return timestamp;
      return null;
    };

    const collections = snapshot.docs
      .map(doc => {
        return {
          id: doc.id,
          ...doc.data()
        };
      })
      .filter(collection => {
        const hasChallenge = !!collection.challenge;
        return hasChallenge;
      })
      .filter(collection => {
        const startDate = convertTimestamp(collection.challenge.startDate);
        const endDate = convertTimestamp(collection.challenge.endDate);
        return startDate < now && endDate > now;
      })
      .filter(collection => {
        const isPublished = collection.challenge.status === 'published';
        return isPublished;
      });

    return collections;
  } catch (error) {
    throw error;
  }
}


exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const userId = event.queryStringParameters.userId;
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'userId is required' })
      };
    }

    const challenges = await getCollectionsByOwnerId(userId);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, challenges })
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
