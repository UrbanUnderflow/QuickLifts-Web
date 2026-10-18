const { admin, initializeFirebaseAdmin, getFirebaseAdminApp, headers } = require('./config/firebase');
const { responderForRecord, active, text, deny } = require('./lib/clinical-responder-scope');
const COLLECTION = 'pulsecheck-clinical-escalations';
const json = (statusCode, body) => ({ statusCode, headers: { ...headers, 'Content-Type': 'application/json', 'Access-Control-Allow-Headers': headers['Access-Control-Allow-Headers'] || 'Content-Type, Authorization, X-PulseCheck-Firebase-Mode', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: JSON.stringify(body) });
const seconds = value => value?.toMillis ? Math.floor(value.toMillis() / 1000) : typeof value === 'number' ? value : null;
function project(id, data) {
  return { id, athleteUserId: data.athleteUserId, teamId: data.teamId, organizationId: data.organizationId,
    tier: data.tier, detectedAt: data.detectedAt, recordedAt: seconds(data.recordedAt), deliveryStatus: data.deliveryStatus,
    acknowledgedAt: seconds(data.acknowledgedAt), acknowledgedByUserId: data.acknowledgedByUserId || null,
    resolvedAt: seconds(data.resolvedAt), resolvedByUserId: data.resolvedByUserId || null,
    deliveryNeedsAttention: data.deliveryNeedsAttention === true,
    stageStatus: Object.fromEntries(Object.entries(data.stages || {}).map(([key, stage]) => [key, stage.status])),
    // Clinical excerpts, signatures, provider contacts and raw records are never projected.
    signalSource: 'urgent_safety', evidence: [] };
}
async function processRequest(db, user, body) {
  if ((await db.collection('account-closure-jobs').doc(user.uid).get()).exists) deny('Account closure is in progress.');
  const action = text(body.action) || 'list';
  if (!['list', 'get', 'acknowledge', 'resolve', 'retry'].includes(action)) deny('Unknown responder action.', 400);
  if (action === 'list') {
    const members = await db.collection('pulsecheck-team-memberships').where('userId', '==', user.uid).get();
    const ids = members.docs.filter(doc => active(doc.data()) && doc.data().role === 'clinician').map(doc => doc.id);
    const records = [];
    for (const id of ids) {
      const rows = await db.collection(COLLECTION).where('pagedClinicianMembershipId', '==', id).orderBy('detectedAt', 'desc').limit(100).get();
      for (const row of rows.docs) {
        if (row.data().deliveryStatus === 'resolved') continue;
        try { await responderForRecord(db, row.data(), user.uid); records.push(project(row.id, row.data())); } catch (error) { if (error.statusCode !== 403) throw error; }
      }
    }
    return { records: [...new Map(records.map(row => [row.id, row])).values()].sort((a,b) => b.detectedAt-a.detectedAt).slice(0, 50) };
  }
  const id = text(body.escalationId);
  if (!id || id.includes('/')) deny('An escalation ID is required.', 400);
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) deny('Escalation unavailable.', 404);
  const scope = await responderForRecord(db, snap.data(), user.uid);
  if (action === 'retry') {
    const record = snap.data();
    const { _private: { runIncident } } = require('./record-clinical-escalation');
    // Scope above grants this single incident retry, never arbitrary athlete access.
    const result = await runIncident({ db, decoded: { uid: user.uid, admin: true }, resumeId: id,
      body: { athleteUserId: record.athleteUserId, teamId: record.teamId, organizationId: record.organizationId,
        tier: record.tier, signalSource: record.signalSource, detectedAt: record.detectedAt } });
    return { ...JSON.parse(result.body), httpStatus: result.statusCode };
  }
  if (action === 'get') {
    const profile = await db.collection('users').doc(snap.data().athleteUserId).get();
    return { record: { ...project(id, snap.data()), athleteDisplayName: profile.exists ? text(profile.data().displayName) : '', athletePhone: text(scope.membership.phone) } };
  }
  const result = await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    const data = current.data();
    if (!data || data.pagedClinicianMembershipId !== snap.data().pagedClinicianMembershipId) deny();
    if ((await tx.get(db.collection('account-closure-jobs').doc(user.uid))).exists) deny('Account closure is in progress.');
    await responderForRecord(db, data, user.uid, ref => tx.get(ref));
    if (action === 'acknowledge') {
      if (data.acknowledgedAt || data.deliveryStatus === 'resolved') return data;
      const patch = { acknowledgedAt: admin.firestore.FieldValue.serverTimestamp(), acknowledgedByUserId: user.uid,
        deliveryStatus: 'clinician_acknowledged' };
      tx.set(ref, patch, { merge: true }); return { ...data, ...patch };
    }
    if (!data.acknowledgedAt || data.acknowledgedByUserId !== user.uid) deny('Acknowledge receipt before resolving.', 409);
    if (data.deliveryStatus === 'resolved') return data;
    const note = text(body.resolutionNote);
    if (!note || note.length > 1000) deny('A short response note is required (maximum 1000 characters).', 400);
    const patch = { deliveryStatus: 'resolved', resolvedByUserId: user.uid, resolvedAt: admin.firestore.FieldValue.serverTimestamp(), resolutionNote: note };
    tx.set(ref, patch, { merge: true }); return { ...data, ...patch };
  });
  return { record: project(id, result), acknowledged: action === 'acknowledge', resolved: action === 'resolve',
    providerConfirmed: false, crisisWallCleared: false, clearancePending: true };
}
exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return json(200, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const app = getFirebaseAdminApp({ headers: event.headers || {} });
    const header = event.headers?.authorization || event.headers?.Authorization || '';
    if (!header.startsWith('Bearer ')) deny('Sign in is required.', 401);
    let user;
    try { user = await admin.auth(app).verifyIdToken(header.slice(7), true); } catch { deny('Sign in is required.', 401); }
    const result = await processRequest(admin.firestore(app), user, JSON.parse(event.body || '{}'));
    return json(result.httpStatus || 200, result);
  } catch (error) { return json(error.statusCode || 500, { error: error.statusCode ? error.message : 'Responder access could not be verified. Please retry.' }); }
};
exports._private = { processRequest, project };
