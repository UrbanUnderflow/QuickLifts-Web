// Clone an existing prize assignment into a brand-new record (new document ID)
// Resets distribution-related fields so the flow (deposit -> email -> confirm -> payout)
// can be executed again without tripping idempotency on transfers.

const { db, headers } = require('./config/firebase');

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
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
        body: JSON.stringify({ success: false, error: 'Firebase database not available' })
      };
    }

    const { assignmentId, overridePrizeAmount, archiveOriginal = true, requestedBy } = JSON.parse(event.body || '{}');
    if (!assignmentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing assignmentId' })
      };
    }

    const srcRef = db.collection('challenge-prizes').doc(assignmentId);
    const srcSnap = await srcRef.get();
    if (!srcSnap.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Source assignment not found' })
      };
    }

    const src = srcSnap.data();

    // Build the new assignment payload
    const now = new Date();
    const newPayload = {
      challengeId: src.challengeId,
      challengeTitle: src.challengeTitle,
      prizeAmount: typeof overridePrizeAmount === 'number' ? overridePrizeAmount : src.prizeAmount,
      prizeStructure: src.prizeStructure || 'winner_takes_all',
      customDistribution: src.customDistribution || null,
      description: src.description || '',
      status: 'assigned',
      distributionStatus: 'pending',
      // Reset host/deposit fields
      hostEmailSent: false,
      hostEmailSentAt: null,
      hostConfirmed: false,
      hostConfirmedAt: null,
      fundingStatus: 'pending', // never copy funded to clone
      depositedAmount: 0,
      escrowRecordId: null,
      depositedAt: null,
      depositedBy: null,
      totalAmountCharged: 0,
      platformFeeCollected: 0,
      // Versioning metadata
      versionOf: assignmentId,
      createdAt: now,
      createdBy: requestedBy || src.createdBy || 'system',
      updatedAt: now
    };

    const newRef = await db.collection('challenge-prizes').add(newPayload);

    if (archiveOriginal) {
      await srcRef.update({ archived: true, archivedAt: now, distributionStatus: src.distributionStatus || 'archived' });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, newAssignmentId: newRef.id, newAssignment: { id: newRef.id, ...newPayload } })
    };
  } catch (error) {
    console.error('[clone-prize-assignment] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};

module.exports = { handler };


