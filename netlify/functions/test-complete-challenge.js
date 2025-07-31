// FILE: netlify/functions/test-complete-challenge.js
// Testing function to manually complete a challenge and trigger winner calculations

const { db, admin } = require('./config/firebase');

const handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { challengeId, testMode = true } = JSON.parse(event.body || '{}');
    
    if (!challengeId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          success: false,
          error: 'challengeId is required'
        })
      };
    }

    console.log(`[TestCompleteChallenge] Starting test completion for challenge: ${challengeId}`);

    // 1. Get challenge data
    const challengeDoc = await db.collection('challenges').doc(challengeId).get();
    if (!challengeDoc.exists) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'Challenge not found'
        })
      };
    }

    const challengeData = challengeDoc.data();
    console.log(`[TestCompleteChallenge] Challenge: ${challengeData.title}`);
    
    // Check if prize money is enabled
    const hasPrizeMoney = challengeData.prizeMoney?.isEnabled && challengeData.prizeMoney?.totalAmount > 0;
    console.log(`[TestCompleteChallenge] Prize money enabled: ${hasPrizeMoney}`);
    if (hasPrizeMoney) {
      console.log(`[TestCompleteChallenge] Prize pool: $${challengeData.prizeMoney.totalAmount / 100}`);
    }

    // 2. Update challenge status to completed
    const batch = db.batch();
    const challengeRef = db.collection('challenges').doc(challengeId);
    
    batch.update(challengeRef, {
      status: 'completed',
      endDate: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      'metadata.testCompleted': testMode,
      'metadata.testCompletedAt': admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[TestCompleteChallenge] Updating challenge status to completed`);

    // 3. Get all participants and mark them as completed
    const participantsSnapshot = await db.collection('user-challenge')
      .where('challengeId', '==', challengeId)
      .get();

    console.log(`[TestCompleteChallenge] Found ${participantsSnapshot.size} participants`);
    
    const participants = [];
    participantsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      participants.push({
        userChallengeId: doc.id,
        userId: data.userId,
        username: data.username,
        currentScore: data.pulsePoints?.totalPoints || 0
      });
      
      // Update user challenge status to completed
      batch.update(doc.ref, {
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // Commit the batch updates
    await batch.commit();
    console.log(`[TestCompleteChallenge] Updated challenge and participant statuses`);

    // 4. If prize money is enabled, calculate winners
    let winnersResult = null;
    if (hasPrizeMoney) {
      console.log(`[TestCompleteChallenge] Calculating winners for prize distribution...`);
      
      try {
        // Call the calculate-winners function
        const calculateWinnersResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/calculate-winners`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId })
        });
        
        if (calculateWinnersResponse.ok) {
          winnersResult = await calculateWinnersResponse.json();
          console.log(`[TestCompleteChallenge] Winners calculated successfully:`, winnersResult.winners?.length || 0, 'winners');
        } else {
          console.error(`[TestCompleteChallenge] Failed to calculate winners:`, calculateWinnersResponse.status);
        }
      } catch (error) {
        console.error(`[TestCompleteChallenge] Error calling calculate-winners:`, error);
      }
    }

    // 5. Prepare response
    const response = {
      success: true,
      challengeId: challengeId,
      testMode: testMode,
      timestamp: new Date().toISOString(),
      participantsUpdated: participants.length,
      hasPrizeMoney: hasPrizeMoney,
      prizePool: hasPrizeMoney ? challengeData.prizeMoney.totalAmount / 100 : 0,
      participants: participants.map(p => ({
        username: p.username,
        userId: p.userId,
        score: p.currentScore
      })).sort((a, b) => b.score - a.score),
      winners: winnersResult?.winners || [],
      prizeRecords: winnersResult?.prizeRecords || [],
      message: `Challenge ${challengeData.title} completed successfully! ${participants.length} participants updated.${hasPrizeMoney ? ` Prize money will be distributed to ${winnersResult?.winners?.length || 0} winners.` : ''}`
    };

    console.log(`[TestCompleteChallenge] Test completion successful`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('[TestCompleteChallenge] Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

module.exports = { handler }; 