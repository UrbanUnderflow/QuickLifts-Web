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
        // console.log(`Challenge is within active timeframe but status is ${challenge.status}, not 'published'. Skipping activation.`);
      }
    } else if (normalizedNow > normalizedEnd) {
      // We can complete any challenge that's past its end date, regardless of current status (unless already completed)
       if (challenge.status !== 'completed') {
           newStatus = 'completed';
       }
    }

    // Don't log if no status change is proposed
    // if (newStatus && newStatus !== challenge.status) {
    //   logChallengeDetails(challenge, now, newStatus);
    // }
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

// Process and update a collection of challenges
async function updateChallengeCollection(collectionName, now, testMode = false) {
  console.log(`Processing ${collectionName}... ${testMode ? '(TEST MODE)' : ''}`);
  const batch = db.batch();
  const updates = [];
  const proposedUpdates = []; // Keep this for logging/result

  try {
    const snapshot = await db.collection(collectionName).get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.challenge) {
        // console.log(`Skipping document ${doc.id} in ${collectionName} - no challenge data`);
        continue;
      }

      const currentStatus = data.challenge.status;
      const newStatus = determineChallengeStatus(data.challenge, now);
      
      // Check if a valid new status was determined and it's different
      if (newStatus && newStatus !== currentStatus) {
        console.log(`${testMode ? '[TEST] Would update' : 'Updating'} ${collectionName}/${doc.id} from ${currentStatus} to ${newStatus}`);
        
        // --- REMOVED call to handleStatusChange --- 

        // Add to proposed updates for logging the result
        proposedUpdates.push({
          id: doc.id,
          collection: collectionName,
          currentStatus: currentStatus,
          newStatus,
          startDate: convertTimestamp(data.challenge.startDate),
          endDate: convertTimestamp(data.challenge.endDate)
        });

        // Only add to the actual batch if not in test mode
        if (!testMode) {
          updates.push({
            ref: doc.ref,
            status: newStatus
          });
        }
      }
    }

    // Commit the batch if not in test mode and there are updates
    if (!testMode && updates.length > 0) {
      const updateTimestamp = Math.floor(now.getTime() / 1000);
      updates.forEach(({ ref, status }) => {
        batch.update(ref, {
          'challenge.status': status,
          'challenge.updatedAt': updateTimestamp, // Update nested challenge timestamp
          'updatedAt': updateTimestamp          // Also update root doc timestamp
        });
      });
      await batch.commit();
      console.log(`Committed ${updates.length} status updates in ${collectionName}.`);
    }

    // Return counts regardless of test mode
    return {
      updatesApplied: testMode ? 0 : updates.length,
      proposedUpdates // Contains details of what would/did change
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
    // Update both collections. The function now handles the batch internally.
    const [sweatlistResults, userChallengeResults] = await Promise.all([
      updateChallengeCollection('sweatlist-collection', now, testMode),
      updateChallengeCollection('user-challenge', now, testMode)
    ]);

    return {
      sweatlistCollection: sweatlistResults,
      userChallengeCollection: userChallengeResults, // Changed key for clarity
      timestamp: Math.floor(now.getTime() / 1000),
      testMode
    };
  } catch (error) {
    console.error('Error in updateChallengeStatuses:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  // Handling OPTIONS request remains the same
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Use event context if available (for scheduled functions)
  const source = event.headers?.['x-netlify-event-source'] || 'manual'; 
  console.log(`Scheduled function update-challenge-status triggered via ${source}.`);

  try {
    // Scheduled functions don't have a body, testMode is always false
    const testMode = false; 
    
    console.log(`Running scheduled challenge status update (testMode=${testMode})`);
    
    const result = await updateChallengeStatuses(testMode);

    // Log success
    console.log("Scheduled update completed.", JSON.stringify(result, null, 2));

    // Return success, body might not be checked by scheduler but good practice
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Scheduled challenge statuses updated successfully.',
        results: result
      })
    };
  } catch (error) {
    console.error('Error during scheduled challenge status update:', error);
    
    // Return error status code
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error during scheduled update.',
        timestamp: Math.floor(Date.now() / 1000)
      })
    };
  }
};