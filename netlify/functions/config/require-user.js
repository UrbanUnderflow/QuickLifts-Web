const { admin } = require('./firebase');

async function requireUser(event, userId) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1];
  if (!token) return { error: 'Authentication required', statusCode: 401 };
  try {
    const user = await admin.auth().verifyIdToken(token, true);
    if (!user.uid || user.uid !== userId) return { error: 'Access denied', statusCode: 403 };
    return { user };
  } catch {
    return { error: 'Invalid or expired session', statusCode: 401 };
  }
}
module.exports = { requireUser };
