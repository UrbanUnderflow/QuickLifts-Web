const { admin } = require('./firebase');

async function requireSession(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1];
  if (!token) return { error: 'Authentication required', statusCode: 401 };
  try {
    const user = await admin.auth().verifyIdToken(token, true);
    if (!user.uid) return { error: 'Invalid session', statusCode: 401 };
    return { user };
  } catch {
    return { error: 'Invalid or expired session', statusCode: 401 };
  }
}

async function requireUser(event, userId) {
  const access = await requireSession(event);
  if (access.error) return access;
  if (access.user.uid !== userId) return { error: 'Access denied', statusCode: 403 };
  return access;
}

// Only body-weight reads honor the profile owner's explicit sharing choices.
// Workout history, statements, and writes remain strictly owner-only.
async function requireCheckinReader(event, userId) {
  const header = event.headers?.authorization || event.headers?.Authorization;
  const access = header ? await requireSession(event) : { user: null };
  if (access.error) return access;
  if (access.user?.uid === userId) return access;

  const db = admin.firestore();
  const privateAccount = await db.collection('pulsecheck-private-users').doc(userId).get();
  if (privateAccount.exists) return { error: 'Access denied', statusCode: 403 };
  const profile = await db.collection('users').doc(userId).get();
  const data = profile.exists ? profile.data() : {};
  if (data.checkinsPrivacy === 'publicAccess') return access;
  if (!access.user) return { error: 'Authentication required', statusCode: 401 };
  if (Array.isArray(data.checkinsAccessList) && data.checkinsAccessList.includes(access.user.uid)) return access;
  if (data.checkinsPrivacy === 'followersOnly') {
    const follow = await db.collection('followRequests').doc(`${access.user.uid}${userId}`).get();
    const relationship = follow.exists ? follow.data() : null;
    if (relationship?.status === 'accepted'
      && relationship.fromUser?.id === access.user.uid
      && relationship.toUser?.id === userId) return access;
  }
  return { error: 'Access denied', statusCode: 403 };
}

module.exports = { requireUser, requireCheckinReader };
