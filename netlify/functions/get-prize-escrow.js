// Function to get prize escrow records for admin visibility

const { db, headers } = require('./config/firebase');

const handler = async (event) => {
  console.log(`[GetPrizeEscrow] Received ${event.httpMethod} request`);

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
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    const { challengeId, escrowId, status } = event.queryStringParameters || {};

    let query = db.collection('prize-escrow');

    // Filter by specific challenge
    if (challengeId) {
      query = query.where('challengeId', '==', challengeId);
    }

    // Filter by status
    if (status) {
      query = query.where('status', '==', status);
    }

    // Order by creation date (newest first)
    query = query.orderBy('createdAt', 'desc');

    // Limit results for performance
    query = query.limit(100);

    let escrowRecords = [];

    if (escrowId) {
      // Get specific escrow record
      const escrowDoc = await db.collection('prize-escrow').doc(escrowId).get();
      if (escrowDoc.exists) {
        escrowRecords = [{
          id: escrowDoc.id,
          ...escrowDoc.data(),
          createdAt: escrowDoc.data().createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: escrowDoc.data().updatedAt?.toDate?.()?.toISOString() || null
        }];
      }
    } else {
      // Get multiple records based on filters
      const snapshot = await query.get();
      escrowRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null
      }));
    }

    // Calculate summary statistics
    const summary = {
      totalRecords: escrowRecords.length,
      totalHeld: escrowRecords
        .filter(record => record.status === 'held')
        .reduce((sum, record) => sum + (record.amount || 0), 0), // Use 'amount' not 'remainingAmount'
      totalDistributed: escrowRecords
        .reduce((sum, record) => sum + (record.distributedAmount || 0), 0),
      byStatus: {
        held: escrowRecords.filter(r => r.status === 'held').length,
        distributing: escrowRecords.filter(r => r.status === 'distributing').length,
        distributed: escrowRecords.filter(r => r.status === 'distributed').length,
        refunded: escrowRecords.filter(r => r.status === 'refunded').length
      }
    };

    console.log(`[GetPrizeEscrow] Returning ${escrowRecords.length} escrow records`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        escrowRecords: escrowRecords,
        summary: summary,
        filters: {
          challengeId: challengeId || null,
          status: status || null,
          escrowId: escrowId || null
        }
      })
    };

  } catch (error) {
    console.error('[GetPrizeEscrow] Error:', error);
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