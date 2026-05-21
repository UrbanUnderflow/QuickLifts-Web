// netlify/functions/delete-user.js

const { admin, db, headers } = require('./config/firebase');

const auth = admin.auth();

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(payload),
  };
}

function getHeader(event, name) {
  const wanted = name.toLowerCase();
  const found = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return found ? found[1] : '';
}

async function verifyAdminRequest(event) {
  const authHeader = String(getHeader(event, 'authorization') || '').trim();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const decoded = await auth.verifyIdToken(match[1]);
  const email = String(decoded.email || '').trim().toLowerCase();
  const hasAdminClaim = decoded.admin === true || decoded.isAdmin === true || decoded.role === 'admin';
  if (hasAdminClaim) {
    return { uid: decoded.uid, email, source: 'claim' };
  }

  if (!email) return null;
  const adminSnap = await db.collection('admin').doc(email).get();
  if (!adminSnap.exists) return null;

  return { uid: decoded.uid, email, source: 'admin_collection' };
}

function normalizeUsernameCandidates(userData) {
  const raw = String(userData?.username || '').trim();
  if (!raw) return [];

  const normalized = raw.toLowerCase();
  return Array.from(new Set([raw, normalized]));
}

async function deleteUsernameDocs(userId, userData) {
  const usernames = normalizeUsernameCandidates(userData);
  let deleted = 0;

  for (const username of usernames) {
    const usernameRef = db.collection('usernames').doc(username);
    const usernameSnap = await usernameRef.get();
    if (!usernameSnap.exists) continue;

    const usernameData = usernameSnap.data() || {};
    if (!usernameData.userId || usernameData.userId === userId) {
      await usernameRef.delete();
      deleted += 1;
    }
  }

  return deleted;
}

async function deleteUserDoc(userDocRef) {
  if (typeof db.recursiveDelete === 'function') {
    await db.recursiveDelete(userDocRef);
    return 'recursive';
  }

  await userDocRef.delete();
  return 'document_only';
}

async function deleteAdminRecordForUser(userData) {
  const email = String(userData?.email || '').trim().toLowerCase();
  if (!email) return false;

  const adminRef = db.collection('admin').doc(email);
  const adminSnap = await adminRef.get();
  if (!adminSnap.exists) return false;

  await adminRef.delete();
  return true;
}

async function writeDeleteAuditLog({ userId, userData, adminContext, authDeleted, firestoreDeleteMode, usernameDocsDeleted, adminRecordDeleted }) {
  await db.collection('admin-audit-logs').add({
    action: 'delete_user',
    userId,
    deletedUserEmail: userData?.email || null,
    deletedUsername: userData?.username || null,
    requestedByUid: adminContext.uid || null,
    requestedByEmail: adminContext.email || null,
    requestedBySource: adminContext.source || null,
    authDeleted,
    firestoreDeleteMode,
    usernameDocsDeleted,
    adminRecordDeleted,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, message: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  let adminContext;
  try {
    adminContext = await verifyAdminRequest(event);
  } catch (error) {
    console.error('[delete-user] Admin token verification failed:', error);
    return json(401, { success: false, message: 'Unauthorized: could not verify admin session.' });
  }

  if (!adminContext) {
    return json(403, { success: false, message: 'Forbidden: Admin privileges required.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return json(400, { success: false, message: 'Invalid request body.' });
  }

  const userId = String(body.userId || '').trim();
  if (!userId) {
    return json(400, { success: false, message: 'Missing required parameter: userId' });
  }

  const userDocRef = db.collection('users').doc(userId);
  const userSnap = await userDocRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};

  let authDeleted = false;
  try {
    await auth.deleteUser(userId);
    authDeleted = true;
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      console.error(`[delete-user] Failed deleting Auth user ${userId}:`, error);
      return json(500, {
        success: false,
        message: `Failed to delete Auth user ${userId}. Error: ${error.message}`,
      });
    }
  }

  try {
    const usernameDocsDeleted = await deleteUsernameDocs(userId, userData);
    const adminRecordDeleted = await deleteAdminRecordForUser(userData);
    const firestoreDeleteMode = await deleteUserDoc(userDocRef);

    await writeDeleteAuditLog({
      userId,
      userData,
      adminContext,
      authDeleted,
      firestoreDeleteMode,
      usernameDocsDeleted,
      adminRecordDeleted,
    }).catch((error) => {
      console.warn('[delete-user] Failed to write audit log:', error);
    });

    return json(200, {
      success: true,
      message: `User ${userId} deleted successfully.`,
      authDeleted,
      firestoreDeleteMode,
      usernameDocsDeleted,
      adminRecordDeleted,
    });
  } catch (error) {
    console.error(`[delete-user] Firestore cleanup failed for ${userId}:`, error);
    return json(500, {
      success: false,
      message: `Deleted Auth user where possible, but Firestore cleanup failed for ${userId}. Error: ${error.message}`,
    });
  }
};
