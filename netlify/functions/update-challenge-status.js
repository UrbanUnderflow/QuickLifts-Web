const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
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
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
      universe_domain: "googleapis.com",
    }),
  });
}

const db = admin.firestore();

function logChallengeDetails(challenge, now, newStatus) {
  console.log({
    currentStatus: challenge.status,
    proposedStatus: newStatus,
    startDate: challenge.startDate.toDate().toISOString(),
    endDate: challenge.endDate.toDate().toISOString(),
    currentTime: now.toISOString()
  });
}

function determineChallengeStatus(challenge, now) {
  // Ensure we have valid dates to compare
  if (!challenge?.startDate || !challenge?.endDate) {
    console.log('Challenge missing start or end date');
    return null;
  }

  try {
    const startDate = challenge.startDate.toDate();
    const endDate = challenge.endDate.toDate();

    // Normalize all dates to midnight UTC for consistent comparison
    const normalizedNow = new Date(now.setHours(0, 0, 0, 0));
    const normalizedStart = new Date(startDate.setHours(0, 0, 0, 0));
    const normalizedEnd = new Date(endDate.setHours(0, 0, 0, 0));

    // Determine the new status
    let newStatus = null;
    if (normalizedNow >= normalizedStart && normalizedNow <= normalizedEnd) {
      newStatus = 'active';
    } else if (normalizedNow > normalizedEnd) {
      newStatus = 'completed';
    }

    // Log the details
    logChallengeDetails(challenge, now, newStatus);

    return newStatus;
  } catch (error) {
    console.error('Error determining challenge status:', error);
    return null;
  }
}

async function updateChallengeCollection(collectionName, now, testMode = false) {
  console.log(`Processing ${collectionName} collection... ${testMode ? '(TEST MODE)' : ''}`);
  const batch = db.batch();
  const updates = [];
  const proposedUpdates = [];

  const snapshot = await db.collection(collectionName).get();
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.challenge) return;

    const newStatus = determineChallengeStatus(data.challenge, now);
    
    // Only update if we have a new status and it's different from the current one
    if (newStatus && newStatus !== data.challenge.status) {
      console.log(`${testMode ? 'Would update' : 'Updating'} ${doc.id} status to ${newStatus}`);
      
      // Store the proposed update
      proposedUpdates.push({
        id: doc.id,
        currentStatus: data.challenge.status,
        newStatus: newStatus,
        startDate: data.challenge.startDate.toDate().toISOString(),
        endDate: data.challenge.endDate.toDate().toISOString()
      });

      if (!testMode) {
        updates.push({
          ref: doc.ref,
          status: newStatus
        });
      }
    }
  });

  // Only apply updates if not in test mode
  if (!testMode && updates.length > 0) {
    updates.forEach(({ ref, status }) => {
      batch.update(ref, {
        'challenge.status': status,
        'challenge.updatedAt': admin.firestore.Timestamp.fromDate(now)
      });
    });
    await batch.commit();
    console.log(`Updated ${updates.length} documents in ${collectionName}`);
  }

  return {
    updatesApplied: testMode ? 0 : updates.length,
    proposedUpdates: proposedUpdates
  };
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
      sweatlistCollection: {
        updatesApplied: sweatlistResults.updatesApplied,
        proposedUpdates: sweatlistResults.proposedUpdates
      },
      userChallengeCollection: {
        updatesApplied: userChallengeResults.updatesApplied,
        proposedUpdates: userChallengeResults.proposedUpdates
      },
      timestamp: now.toISOString(),
      testMode: testMode
    };
  } catch (error) {
    console.error('Error in updateChallengeStatuses:', error);
    throw error;
  }
}

// Handler function for Netlify
exports.handler = async (event) => {
  try {
    // Parse the request body if it exists
    const { testMode = false } = event.body ? JSON.parse(event.body) : {};
    
    const result = await updateChallengeStatuses(testMode);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: testMode ? 'Test run completed successfully' : 'Challenge statuses updated successfully',
        results: result
      }),
    };
  } catch (error) {
    console.error('Error updating challenge statuses:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
    };
  }
};