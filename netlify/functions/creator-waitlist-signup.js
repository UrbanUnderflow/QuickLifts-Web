const { db, headers } = require('./config/firebase');

exports.handler = async (event) => {
  // CORS preflight
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
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }

  try {
    const { username, page, name, email } = JSON.parse(event.body || '{}');
    if (!username || !page || !name || !email) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Missing fields' }) };
    }

    // Lookup userId by username
    const usersRef = db.collection('users');
    const snap = await usersRef.where('username', '==', username).limit(1).get();
    if (snap.empty) {
      return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: 'User not found' }) };
    }
    const userId = snap.docs[0].id;

    const ref = db.collection('creator-pages').doc(userId).collection('waitlist').doc();
    await ref.set({
      id: ref.id,
      username,
      page,
      name,
      email: String(email).toLowerCase(),
      createdAt: db.FieldValue.serverTimestamp()
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: ref.id }) };
  } catch (error) {
    console.error('[creator-waitlist-signup] Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
  }
};



