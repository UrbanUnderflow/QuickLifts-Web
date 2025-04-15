const { admin, db, convertTimestamp, headers } = require('./config/firebase');

// Helper function to determine challenge status based on dates
function determineChallengeStatus(challenge, now) {
  if (!challenge?.startDate || !challenge?.endDate) {
    console.log('Challenge missing start or end date');
    return null;
  }

  try {
    const currentTimestamp = Math.floor(now.getTime() / 1000);
    
    const startTimestamp = typeof challenge.startDate === 'number' ? 
      challenge.startDate : 
      Math.floor(new Date(challenge.startDate).getTime() / 1000);
    
    const endTimestamp = typeof challenge.endDate === 'number' ? 
      challenge.endDate : 
      Math.floor(new Date(challenge.endDate).getTime() / 1000);

    const normalizedNow = Math.floor(currentTimestamp / 86400) * 86400;
    const normalizedStart = Math.floor(startTimestamp / 86400) * 86400;
    const normalizedEnd = Math.floor(endTimestamp / 86400) * 86400;

    let newStatus = null;
    
    // Only set to active if current status is 'published'
    if (normalizedNow >= normalizedStart && normalizedNow <= normalizedEnd) {
      newStatus = challenge.status === 'published' ? 'active' : null;
      if (!newStatus) {
        console.log(`Challenge is within active timeframe but status is ${challenge.status}, not 'published'. Skipping activation.`);
      }
    } else if (normalizedNow > normalizedEnd) {
      // We can complete any challenge that's past its end date
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

function logChallengeDetails(challenge, now, newStatus) {
  try {
    const startDate = challenge.startDate ? 
      new Date(typeof challenge.startDate === 'number' ? challenge.startDate * 1000 : challenge.startDate) : 
      'undefined';
    
    const endDate = challenge.endDate ? 
      new Date(typeof challenge.endDate === 'number' ? challenge.endDate * 1000 : challenge.endDate) : 
      'undefined';
    
    console.log(`Challenge Details:
      - Current Status: ${challenge.status}
      - Potential New Status: ${newStatus}
      - Start Date: ${startDate}
      - End Date: ${endDate}
      - Current Time: ${now}
    `);
  } catch (error) {
    console.error('Error logging challenge details:', error);
  }
}

// Function to handle status changes and send notifications
async function handleStatusChange(doc, newStatus, oldStatus, testMode) {
  if (testMode) {
    console.log(`[TEST] Would handle status change: ${oldStatus} -> ${newStatus}`);
    return;
  }

  const data = doc.data();
  const challenge = data.challenge;

  try {
    if (newStatus === 'active' && oldStatus !== 'active') {
      console.log(`Sending start notifications for challenge ${doc.id}`);
      // Send notifications (implementation would depend on your notification system)
    } 
    else if (newStatus === 'completed' && oldStatus !== 'completed') {
      console.log(`Marking challenge ${doc.id} as completed`);
      // Handle completion logic (implementation would depend on your system)
    }
  } catch (error) {
    console.error('Error handling status change:', error);
  }
}

// Process and update a collection of challenges
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
        
        // Handle notifications before updating status
        await handleStatusChange(doc, newStatus, data.challenge.status, testMode);
        
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
          'challenge.updatedAt': Math.floor(now.getTime() / 1000)
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

// Main function to update challenge statuses
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
      timestamp: Math.floor(now.getTime() / 1000),
      testMode
    };
  } catch (error) {
    console.error('Error in updateChallengeStatuses:', error);
    throw error;
  }
}

// This is a non-scheduled function that can be called directly from the admin UI
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  console.log('Manual trigger received:', {
    httpMethod: event.httpMethod,
    body: event.body,
    headers: event.headers
  });

  try {
    // Parse the body safely with a fallback to empty object
    const parsedBody = event.body ? JSON.parse(event.body) : {};
    const { testMode = false } = parsedBody;
    
    console.log(`Manually triggering challenge status update with testMode=${testMode}`);
    
    const result = await updateChallengeStatuses(testMode);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
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
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error',
        timestamp: Math.floor(Date.now() / 1000)
      })
    };
  }
}; 