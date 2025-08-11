// Function to get existing prize assignments
const { db, headers } = require('./config/firebase');

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Firebase database not available'
        })
      };
    }

    console.log('[GetPrizeAssignments] Fetching all prize assignments...');

    // Get all prize assignments, ordered by creation date (newest first)
    const prizeAssignmentsSnapshot = await db.collection('challenge-prizes')
      .orderBy('createdAt', 'desc')
      .get();

    const assignments = [];

    for (const doc of prizeAssignmentsSnapshot.docs) {
      const data = doc.data();
      
      // Convert Firestore timestamps to ISO strings for JSON serialization
      const assignment = {
        id: doc.id,
        challengeId: data.challengeId,
        challengeTitle: data.challengeTitle,
        prizeAmount: data.prizeAmount,
        prizeStructure: data.prizeStructure,
        customDistribution: data.customDistribution || null,
        description: data.description,
        status: data.status,
        distributionStatus: data.distributionStatus || 'pending',
        winnerConfirmed: data.winnerConfirmed || false,
        hostConfirmed: data.hostConfirmed || false,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
        distributionPlan: data.distributionPlan || [],
        // Include funding-related fields
        fundingStatus: data.fundingStatus || 'pending',
        depositedAmount: data.depositedAmount || 0,
        escrowRecordId: data.escrowRecordId || null,
        totalAmountCharged: data.totalAmountCharged || 0,
        platformFeeCollected: data.platformFeeCollected || 0,
        depositedAt: data.depositedAt?.toDate?.() || data.depositedAt || null,
        depositedBy: data.depositedBy || null,
        // Include host email fields
        hostEmailSent: data.hostEmailSent || false,
        hostEmailSentAt: data.hostEmailSentAt?.toDate?.() || data.hostEmailSentAt || null,
        hostConfirmedAt: data.hostConfirmedAt?.toDate?.() || data.hostConfirmedAt || null
      };

      assignments.push(assignment);
    }

    console.log(`[GetPrizeAssignments] Found ${assignments.length} prize assignments`);

    // Also get some summary statistics
    const totalPrizeAmount = assignments.reduce((sum, assignment) => {
      return sum + (assignment.prizeAmount || 0);
    }, 0);

    const statusCounts = assignments.reduce((counts, assignment) => {
      const status = assignment.status || 'unknown';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});

    const summary = {
      totalAssignments: assignments.length,
      totalPrizeAmount,
      statusCounts,
      averagePrizeAmount: assignments.length > 0 ? totalPrizeAmount / assignments.length : 0
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        assignments,
        summary,
        message: `Found ${assignments.length} prize assignments`
      })
    };

  } catch (error) {
    console.error('[GetPrizeAssignments] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

module.exports = { handler }; 