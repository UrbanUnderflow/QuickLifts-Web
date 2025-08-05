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


// Helper function to get all challenges for admin interface
async function getAllChallengesForAdmin() {
  console.log('Fetching all challenges for admin interface...');
  
  try {
    const snapshot = await db.collection('sweatlist-collection').get();

    if (snapshot.empty) {
      console.log('No collections found in database.');
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

    const challenges = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Only include documents that have a challenge
      if (!data.challenge) continue;

      // Get creator information
      let creatorInfo = null;
      if (data.ownerId) {
        try {
          const creatorDoc = await db.collection('users').doc(data.ownerId).get();
          if (creatorDoc.exists) {
            const creatorData = creatorDoc.data();
            creatorInfo = {
              username: creatorData.username || 'Unknown User',
              email: creatorData.email || 'No email'
            };
          }
        } catch (creatorError) {
          console.warn(`Failed to fetch creator info for ${data.ownerId}:`, creatorError);
        }
      }

      // Get participant count
      let participantCount = 0;
      try {
        const participantsSnapshot = await db.collection('user-challenge')
          .where('challengeId', '==', doc.id)
          .get();
        participantCount = participantsSnapshot.size;
      } catch (participantError) {
        console.warn(`Failed to get participant count for challenge ${doc.id}:`, participantError);
      }

      const challenge = {
        id: doc.id,
        title: data.challenge.title || 'Untitled Challenge',
        description: data.challenge.description || 'No description',
        startDate: convertTimestamp(data.challenge.startDate),
        endDate: convertTimestamp(data.challenge.endDate),
        status: data.challenge.status || 'unknown',
        createdBy: data.ownerId,
        creatorInfo,
        participantCount,
        // Include additional fields that might be useful
        category: data.challenge.category || null,
        difficulty: data.challenge.difficulty || null,
        isPublic: data.challenge.isPublic !== false, // default to public
        rules: data.challenge.rules || null,
        // Add prize info if it exists
        hasPrize: data.hasPrize || false,
        prizeAmount: data.prizeAmount || 0,
        prizeStructure: data.prizeStructure || null
      };

      challenges.push(challenge);
    }

    // Sort by creation date (newest first) or end date
    challenges.sort((a, b) => {
      const aDate = a.endDate || a.startDate || new Date(0);
      const bDate = b.endDate || b.startDate || new Date(0);
      return bDate - aDate;
    });

    console.log(`Found ${challenges.length} challenges for admin interface`);
    return challenges;

  } catch (error) {
    console.error('Error fetching challenges for admin:', error);
    throw error;
  }
}

exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const userId = event.queryStringParameters?.userId;
    const adminMode = event.queryStringParameters?.admin === 'true';

    // Admin mode - return all challenges
    if (adminMode) {
      const challenges = await getAllChallengesForAdmin();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, challenges })
      };
    }

    // Regular user mode - require userId and return only their active challenges
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'userId is required for user-specific challenges' })
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
