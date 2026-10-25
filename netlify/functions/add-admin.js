// Administrator provisioning requires a verified, existing administrator session.
// No shared or hard-coded bootstrap credential is accepted.
const { admin, db, headers } = require('./config/firebase');

const response = (statusCode, message) => ({
  statusCode,
  headers: { ...headers, 'Cache-Control': 'no-store' },
  body: JSON.stringify({ success: statusCode === 200, message }),
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') return response(405, 'Method not allowed');

  const authorization = event.headers?.authorization || event.headers?.Authorization || '';
  const match = /^Bearer (\S+)$/i.exec(authorization);
  if (!match) return response(401, 'Authentication required');

  try {
    const decoded = await admin.auth().verifyIdToken(match[1], true);
    if (!decoded.email || !decoded.email_verified) {
      return response(403, 'Verified administrator email required');
    }
    const existingAdmin = await db.collection('admin').doc(decoded.email.toLowerCase()).get();
    if (!existingAdmin.exists || !existingAdmin.data()?.permissions?.includes('all')) {
      return response(403, 'Administrator permission required');
    }

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return response(400, 'Invalid JSON'); }

    const email = String(payload.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response(400, 'Valid email is required');
    }

    await db.collection('admin').doc(email).set({
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: decoded.email.toLowerCase(),
      permissions: ['all'],
    });
    return response(200, 'Administrator added successfully');
  } catch (error) {
    if (error?.code?.startsWith('auth/')) return response(401, 'Invalid session');
    console.error('[AddAdmin] Provisioning failed:', error);
    return response(500, 'Administrator provisioning failed');
  }
};
