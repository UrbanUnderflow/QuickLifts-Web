const { db, headers } = require('./config/firebase');

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const { assignmentId } = JSON.parse(event.body || '{}');
    if (!assignmentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing assignmentId' })
      };
    }

    const ref = db.collection('challenge-prizes').doc(assignmentId);
    const snap = await ref.get();
    if (!snap.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Assignment not found' })
      };
    }

    // Soft delete unless there is no escrow linked
    const data = snap.data();
    if (data.escrowRecordId) {
      await ref.update({ archived: true, archivedAt: new Date() });
    } else {
      await ref.delete();
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error('[delete-prize-assignment] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};

module.exports = { handler };


