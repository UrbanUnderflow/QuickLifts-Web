const { createDeployedSnapshotPullHandler } = require('./lib/athleticmind-snapshot-pull');
const { ensurePartnerRuntimeConfig } = require('./lib/partner-runtime-config');

exports.handler = async event => {
  try { await ensurePartnerRuntimeConfig(); }
  catch { return { statusCode: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'partner_runtime_config_unavailable' }) }; }
  return createDeployedSnapshotPullHandler({
    getDb: () => require('./config/firebase').getFirebaseAdminApp({ headers: {} }).firestore(),
  })(event);
};
