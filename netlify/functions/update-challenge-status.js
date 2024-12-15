const admin = require('firebase-admin');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: "quicklifts-dd3f1",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY,
      private_key: process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
      client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      client_id: "111494077667496751062",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      universe_domain: "googleapis.com",
    }),
  });
}

const db = admin.firestore();

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

function logChallengeDetails(challenge, now, newStatus) {
  console.log({
    currentStatus: challenge.status,
    proposedStatus: newStatus,
    startDate: convertTimestamp(challenge.startDate),
    endDate: convertTimestamp(challenge.endDate),
    currentTime: convertTimestamp(now)
  });
}

function determineChallengeStatus(challenge, now) {
  if (!challenge?.startDate || !challenge?.endDate) {
    console.log('Challenge missing start or end date');
    return null;
  }

  try {
    // Convert the current time to Unix timestamp (seconds)
    const currentTimestamp = Math.floor(now.getTime() / 1000);
    
    // Get start and end timestamps - assuming they're stored as Unix timestamps
    const startTimestamp = typeof challenge.startDate === 'number' ? 
      challenge.startDate : 
      Math.floor(new Date(challenge.startDate).getTime() / 1000);
    
    const endTimestamp = typeof challenge.endDate === 'number' ? 
      challenge.endDate : 
      Math.floor(new Date(challenge.endDate).getTime() / 1000);

    // Normalize to start of day by removing hours, minutes, seconds
    const normalizedNow = Math.floor(currentTimestamp / 86400) * 86400;
    const normalizedStart = Math.floor(startTimestamp / 86400) * 86400;
    const normalizedEnd = Math.floor(endTimestamp / 86400) * 86400;

    let newStatus = null;
    if (normalizedNow >= normalizedStart && normalizedNow <= normalizedEnd) {
      newStatus = 'active';
    } else if (normalizedNow > normalizedEnd) {
      newStatus = 'completed';
    }

    logChallengeDetails(challenge, now, newStatus);
    return newStatus;
  } catch (error) {
    console.error('Error determining challenge status:', error, {
      challenge: JSON.stringify(challenge),
      now: now
    });
    return null;
  }
}

async function updateChallengeCollection(collectionName, now, testMode = false) {
  console.log(`Processing ${collectionName}... ${testMode ? '(TEST MODE)' : ''}`);
  const batch = db.batch();
  const updates = [];
  const proposedUpdates = [];

  try {
    const snapshot = await db.collection(collectionName).get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.challenge) {
        console.log(`Skipping document ${doc.id} - no challenge data`);
        continue;
      }

      const newStatus = determineChallengeStatus(data.challenge, now);
      
      if (newStatus && newStatus !== data.challenge.status) {
        console.log(`${testMode ? '[TEST] Would update' : 'Updating'} ${doc.id} from ${data.challenge.status} to ${newStatus}`);
        
        proposedUpdates.push({
          id: doc.id,
          currentStatus: data.challenge.status,
          newStatus,
          startDate: convertTimestamp(data.challenge.startDate),
          endDate: convertTimestamp(data.challenge.endDate)
        });

        if (!testMode) {
          updates.push({
            ref: doc.ref,
            status: newStatus
          });
        }
      }
    }

    if (!testMode && updates.length > 0) {
      updates.forEach(({ ref, status }) => {
        batch.update(ref, {
          'challenge.status': status,
          'challenge.updatedAt': Math.floor(now.getTime() / 1000) // Store as Unix timestamp
        });
      });
      await batch.commit();
      console.log(`Updated ${updates.length} documents in ${collectionName}`);
    }

    return {
      updatesApplied: testMode ? 0 : updates.length,
      proposedUpdates
    };
  } catch (error) {
    console.error(`Error processing ${collectionName}:`, error);
    throw error;
  }
}

async function updateChallengeStatuses(testMode = false) {
  const now = new Date();
  console.log(`Starting challenge status updates at: ${now.toISOString()} ${testMode ? '(TEST MODE)' : ''}`);

  try {
    const [sweatlistResults, userChallengeResults] = await Promise.all([
      updateChallengeCollection('sweatlist-collection', now, testMode),
      updateChallengeCollection('user-challenge', now, testMode)
    ]);

    return {
      sweatlistCollection: sweatlistResults,
      userChallengeCollection: userChallengeResults,
      timestamp: Math.floor(now.getTime() / 1000), // Store as Unix timestamp
      testMode
    };
  } catch (error) {
    console.error('Error in updateChallengeStatuses:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  console.log('Event received:', {
    httpMethod: event.httpMethod,
    body: event.body,
    headers: event.headers
  });

  try {
    const { testMode = false } = event.body ? JSON.parse(event.body) : {};
    const result = await updateChallengeStatuses(testMode);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: testMode ? 'Test run completed successfully' : 'Challenge statuses updated successfully',
        results: result
      })
    };
  } catch (error) {
    console.error('Error updating challenge statuses:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: Math.floor(Date.now() / 1000) // Store as Unix timestamp
      })
    };
  }
};