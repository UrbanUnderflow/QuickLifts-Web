// Function to get prize history and earnings for a winner

const { db } = require('./config/firebase');

const handler = async (event) => {
  console.log(`[GetWinnerPrizeHistory] Received ${event.httpMethod} request`);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    const { userId } = event.queryStringParameters || {};
    console.log(`[GetWinnerPrizeHistory] Fetching prize history for user: ${userId}`);

    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          error: 'userId parameter is required'
        })
      };
    }

    // Get all prize records for this user, newest first
    const prizeRecordsSnapshot = await db.collection('prizeRecords')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const prizeRecords = [];
    prizeRecordsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      prizeRecords.push({
        id: data.id,
        challengeId: data.challengeId,
        challengeTitle: data.challengeTitle,
        placement: data.placement,
        score: data.score,
        prizeAmount: data.prizeAmount,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        paidAt: data.paidAt || null,
        stripeTransferId: data.stripeTransferId || null
      });
    });

    console.log(`[GetWinnerPrizeHistory] Found ${prizeRecords.length} prize records for user ${userId}`);

    // Get user's winner summary data
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const winner = userData?.winner || {};

    const summary = {
      totalEarnings: winner.totalEarnings || 0,
      totalWins: prizeRecords.length,
      pendingAmount: prizeRecords
        .filter(record => record.status === 'pending' || record.status === 'processing')
        .reduce((sum, record) => sum + record.prizeAmount, 0),
      paidAmount: prizeRecords
        .filter(record => record.status === 'paid')
        .reduce((sum, record) => sum + record.prizeAmount, 0),
      onboardingStatus: winner.onboardingStatus || 'not_started',
      stripeAccountId: winner.stripeAccountId || null,
      lastPayoutDate: prizeRecords
        .filter(record => record.status === 'paid' && record.paidAt)
        .map(record => record.paidAt)
        .sort((a, b) => b - a)[0] || null
    };

    console.log(`[GetWinnerPrizeHistory] Summary for ${userId}:`, {
      totalEarnings: summary.totalEarnings / 100,
      totalWins: summary.totalWins,
      pendingAmount: summary.pendingAmount / 100,
      paidAmount: summary.paidAmount / 100
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        prizeRecords: prizeRecords,
        summary: summary,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('[GetWinnerPrizeHistory] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

module.exports = { handler }; 