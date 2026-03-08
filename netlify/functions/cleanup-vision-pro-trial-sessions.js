const {
  cleanupExpiredVisionProSessions,
  json,
  withVisionProContext,
} = require('./vision-pro-trials-utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const { db } = await withVisionProContext(event);
    const cleanup = await cleanupExpiredVisionProSessions(db);
    return json(200, { cleanup });
  } catch (error) {
    console.error('[cleanup-vision-pro-trial-sessions] Error:', error);
    return json(500, {
      error: error.message || 'Failed to clean up Vision Pro sessions',
    });
  }
};
