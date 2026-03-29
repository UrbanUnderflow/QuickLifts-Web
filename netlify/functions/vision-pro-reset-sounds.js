const { initializeFirebaseAdmin } = require('./config/firebase');

const COLLECTION = 'sim-audio-assets';
const FAMILY = 'vision-pro-reset';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const admin = initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();
    const snapshot = await db.collection(COLLECTION).where('family', '==', FAMILY).get();

    if (snapshot.empty) {
      return json(200, { cues: [] });
    }

    const cues = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          cueKey: data.cueKey,
          label: data.label,
          downloadURL: data.downloadURL,
          updatedAt: data.updatedAt ?? 0,
        };
      })
      .filter((cue) => cue.cueKey && cue.downloadURL);

    return json(200, { cues });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[vision-pro-reset-sounds] Error:', message);
    return json(500, { error: 'Failed to fetch sound cues', detail: message });
  }
};
