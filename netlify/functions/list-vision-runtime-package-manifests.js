const { initializeFirebaseAdmin } = require('./config/firebase');

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const admin = initializeFirebaseAdmin();
    const firestore = admin.firestore();
    const snap = await firestore.collection('vision-runtime-packages').get();
    const manifests = snap.docs
      .map((doc) => ({
        packageId: doc.id,
        ...doc.data(),
      }))
      .sort((left, right) => {
        const leftName = String(left.packageName || left.packageId || '');
        const rightName = String(right.packageName || right.packageId || '');
        return leftName.localeCompare(rightName);
      });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ manifests }),
    };
  } catch (error) {
    console.error('Failed to list Vision runtime package manifests:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Failed to load Vision runtime package manifests' }),
    };
  }
};
