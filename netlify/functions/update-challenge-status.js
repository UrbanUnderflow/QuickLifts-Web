const { admin, db, convertTimestamp, headers } = require('./config/firebase');

async function sendNotification(userId, title, body, data = {}) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const fcmToken = userDoc.data()?.fcmToken;

    if (!fcmToken) {
      console.log(`No FCM token found for user ${userId}`);
      return;
    }

    const requestBody = {
      fcmToken,
      payload: {
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          timestamp: String(Math.floor(Date.now() / 1000))
        }
      }
    };

    const response = await fetch('/.netlify/functions/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Failed to send notification: ${response.statusText}`);
    }

    console.log(`Notification sent successfully to user ${userId}`);
  } catch (error) {
    console.error(`Error sending notification to user ${userId}:`, error);
  }
}

async function calculateWinner(challenge) {
  try {
    const participantScores = [];
    const startTimestamp = challenge.startDate;
    const endTimestamp = challenge.endDate;

    for (const participant of challenge.participants) {
      const workouts = await db.collection('users')
        .doc(participant.userId)
        .collection('workoutSummary')
        .where('completedAt', '>=', startTimestamp)
        .where('completedAt', '<=', endTimestamp)
        .get();

      let totalScore = 0;
      workouts.forEach(doc => {
        const workout = doc.data();
        totalScore += workout.workScore || 0;
      });

      participantScores.push({
        userId: participant.userId,
        username: participant.username,
        score: totalScore
      });
    }

    participantScores.sort((a, b) => b.score - a.score);
    return participantScores[0] || null;
  } catch (error) {
    console.error('Error calculating winner:', error);
    return null;
  }
}

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
      for (const participant of challenge.participants) {
        await sendNotification(
          participant.userId,
          '🏃‍♂️ Challenge Started!',
          `The challenge "${challenge.title}" has begun! Get ready to compete!`,
          {
            type: 'challenge_started',
            challengeId: doc.id,
            challengeTitle: challenge.title
          }
        );
      }
    } 
    else if (newStatus === 'completed' && oldStatus !== 'completed') {
      console.log(`Calculating winner for challenge ${doc.id}`);
      const winner = await calculateWinner(challenge);

      if (winner) {
        await doc.ref.update({
          'challenge.winner': winner,
          'challenge.finalScores': Math.floor(winner.score)
        });

        for (const participant of challenge.participants) {
          const isWinner = participant.userId === winner.userId;
          
          await sendNotification(
            participant.userId,
            isWinner ? '🏆 Congratulations, Champion!' : '🎉 Challenge Complete!',
            isWinner 
              ? `You won "${challenge.title}" with a score of ${Math.floor(winner.score)}!`
              : `"${challenge.title}" has ended. ${winner.username} won with a score of ${Math.floor(winner.score)}!`,
            {
              type: 'challenge_completed',
              challengeId: doc.id,
              challengeTitle: challenge.title,
              winnerId: winner.userId,
              winnerUsername: winner.username,
              winnerScore: String(Math.floor(winner.score)),
              isWinner: String(isWinner)
            }
          );
        }
      } else {
        console.log(`No winner determined for challenge ${doc.id}`);
        for (const participant of challenge.participants) {
          await sendNotification(
            participant.userId,
            '🎯 Challenge Complete',
            `The challenge "${challenge.title}" has ended. Thanks for participating!`,
            {
              type: 'challenge_completed',
              challengeId: doc.id,
              challengeTitle: challenge.title,
              noWinner: 'true'
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error handling status change:', error);
  }
}

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
    // Parse the body safely with a fallback to empty object
    const parsedBody = event.body ? JSON.parse(event.body) : {};
    const { testMode = false } = parsedBody;
    
    // Log what we're doing
    console.log(`Running challenge status update with testMode=${testMode}`);
    
    const result = await updateChallengeStatuses(testMode);

    // Always return JSON with the proper Content-Type header
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
    
    // Make sure the error response also has the proper Content-Type
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