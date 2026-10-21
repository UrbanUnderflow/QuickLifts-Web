const keys = require('./partner-api-keys');

const PATH = '/.netlify/functions/auntedna-snapshot-auth-check';
const CONTRACT = 'athleticmind-snapshot-v2';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const header = (event, name) => String(Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === name)?.[1] || '');
const denied = result => json(result.reason === 'rate_limited' ? 429 : result.reason === 'scope_not_authorized' ? 403 : 401, { error: result.reason });

function createSnapshotAuthCheckHandler({ getDb, env = process.env, now = () => Date.now() }) {
  return async event => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
    const environment = env.PARTNER_API_ENVIRONMENT;
    if (!['test', 'production'].includes(environment)) return json(503, { error: 'partner_environment_unconfigured' });
    const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : String(event.body || '');
    if (Buffer.byteLength(rawBody) > 1024) return json(413, { error: 'request_too_large' });
    let input;
    try {
      input = JSON.parse(rawBody);
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || typeof input.teamId !== 'string' || !ID.test(input.teamId)) throw new Error('invalid_request');
    } catch { return json(400, { error: 'invalid_request' }); }
    try {
      const db = await getDb(); // Deployment chooses Firebase; request headers cannot select it.
      const authentication = { keyId: header(event, 'x-auntedna-key-id'), signature: header(event, 'x-auntedna-signature'), method: 'POST', path: PATH, rawBody, scope: keys.SCOPE, environment, teamId: input.teamId, now: now(), env };
      const authenticated = await keys.authenticatePartnerRequest(db, authentication);
      if (!authenticated.ok) return denied(authenticated);
      const team = await db.collection('pulsecheck-teams').doc(input.teamId).get();
      const data = team.data();
      if (!team.exists || data.organizationId !== authenticated.principal.organizationId) return json(403, { error: 'scope_not_authorized' });
      const delivery = data.snapshotDelivery;
      let snapshotPullStatus = 'athlete_eligibility_required';
      if (env.ATHLETICMIND_SNAPSHOT_PULL_ENABLED !== 'true') snapshotPullStatus = 'snapshot_pull_disabled';
      else if (delivery?.pullEnabled !== true) snapshotPullStatus = 'program_snapshot_pull_disabled';
      else if (delivery?.receiver?.status !== 'verified' || !delivery.receiver.verifiedAt || !delivery.receiver.verifiedBy || delivery.receiver.contractVersion !== CONTRACT) snapshotPullStatus = 'receiver_verification_required';
      else if (environment === 'test' && env.ATHLETICMIND_SNAPSHOT_SANDBOX_ENABLED !== 'true') snapshotPullStatus = 'synthetic_fixture_source_unconfigured';
      const current = await keys.revalidatePartnerPrincipal(db, { ...authentication, principal: authenticated.principal, now: now() });
      if (!current.ok) return denied(current);
      // No athlete source, consent record, snapshot, delivery or watermark is read or written.
      return json(200, { authenticated: true, contractVersion: CONTRACT, snapshotPullStatus });
    } catch { return json(503, { error: 'authentication_check_unavailable' }); }
  };
}

module.exports = { createSnapshotAuthCheckHandler, PATH };
