const { initializeFirebaseAdmin } = require('./config/firebase');

const COLLECTION = 'sim-audio-assets';
const FAMILY = 'community-run-alerts';

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

    const cuesByTarget = new Map();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const cue = {
        cueKey: data.cueKey,
        label: data.label,
        bundleTarget: data.bundleTarget,
        downloadURL: data.downloadURL,
        updatedAt: data.updatedAt ?? 0,
      };

      if (!cue.bundleTarget || !cue.downloadURL) {
        return;
      }

      const existing = cuesByTarget.get(cue.bundleTarget);
      if (!existing || cue.updatedAt > existing.updatedAt) {
        cuesByTarget.set(cue.bundleTarget, cue);
      }
    });

    return json(200, { cues: Array.from(cuesByTarget.values()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[audio-run-alerts] Error:', message);
    return json(500, { error: 'Failed to fetch run alert sounds', detail: message });
  }
};
