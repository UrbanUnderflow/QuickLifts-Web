const { resolveAppBranding } = require('../../src/lib/pulsecheck/productConfig');
const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PulseCheck-Firebase-Mode', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const active = row => row && (row.status == null || row.status === 'active') && !row.revokedAt && !row.removedAt && !row.archivedAt && !row.deletedAt && row.revoked !== true;
const branding = organization => ({ appBranding: { pulsecheck: resolveAppBranding(organization, 'pulsecheck').brand, athleticmind: resolveAppBranding(organization, 'athleticmind').brand } });
const forbidden = () => Object.assign(new Error('This team is not available to your account.'), { statusCode: 403 });

async function loadAppBranding(db, uid, teamId) {
  let query = db.collection('pulsecheck-team-memberships').where('userId', '==', uid);
  if (teamId) query = query.where('teamId', '==', teamId);
  const memberships = await query.limit(101).get();
  // Do not choose an arbitrary program when a full context cannot be established.
  if (memberships.docs.length > 100) return branding(null);
  const organizations = new Map();
  for (const snapshot of memberships.docs) {
    const member = snapshot.data();
    if (member.userId !== uid || !active(member) || !validId(member.teamId) || !validId(member.organizationId) || (teamId && member.teamId !== teamId)) continue;
    const teamSnapshot = await db.collection('pulsecheck-teams').doc(member.teamId).get();
    const team = teamSnapshot.data();
    if (!teamSnapshot.exists || !active(team) || team.status !== 'active' || team.organizationId !== member.organizationId) continue;
    const orgSnapshot = await db.collection('pulsecheck-organizations').doc(member.organizationId).get();
    const organization = orgSnapshot.data();
    if (!orgSnapshot.exists || !active(organization) || organization.status !== 'active') continue;
    organizations.set(member.organizationId, organization);
  }
  if (teamId && organizations.size !== 1) throw forbidden();
  return branding(organizations.size === 1 ? organizations.values().next().value : null);
}
async function authorize(event, token) {
  const { initializeFirebaseAdmin, getFirebaseAdminApp, admin } = require('./config/firebase');
  initializeFirebaseAdmin({ headers: event.headers || {} });
  const app = getFirebaseAdminApp({ headers: event.headers || {} });
  const identity = await admin.auth(app).verifyIdToken(token);
  return { uid: identity.uid, db: admin.firestore(app) };
}
function createHandler(deps = {}) {
  return async event => {
    const respond = (statusCode, body) => ({ statusCode, headers: HEADERS, body: JSON.stringify(body) });
    if (event.httpMethod === 'OPTIONS') return respond(204, null);
    if (event.httpMethod !== 'GET') return respond(405, { error: 'Method not allowed' });
    const token = (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return respond(401, { error: 'Sign in to load app branding.' });
    const teamId = event.queryStringParameters?.teamId;
    if (teamId != null && !validId(teamId)) return respond(400, { error: 'Choose a valid team.' });
    let identity;
    try { identity = await (deps.authorize || authorize)(event, token); if (!identity?.uid) throw new Error('No user'); }
    catch { return respond(401, { error: 'Sign in to load app branding.' }); }
    try { return respond(200, await (deps.load || loadAppBranding)(identity.db, identity.uid, teamId)); }
    catch (error) { return respond(error.statusCode === 403 ? 403 : 503, { error: error.statusCode === 403 ? error.message : 'App branding is temporarily unavailable.' }); }
  };
}
module.exports = { handler: createHandler(), createHandler, loadAppBranding };
