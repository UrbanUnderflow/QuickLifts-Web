const ALLOWED_KEYS = Object.freeze([
  'PARTNER_API_KEY_ENCRYPTION_KEYS_JSON',
  'PARTNER_API_KEY_ACTIVE_ENCRYPTION_VERSION',
  'PARTNER_API_ENVIRONMENT',
  'DEVELOPER_DOCS_PASSWORD_HASH',
  'DEVELOPER_DOCS_PASSWORD_SALT',
  'DEVELOPER_DOCS_COOKIE_SECRET',
]);
const TTL_MS = 5 * 60 * 1000;
const unavailable = () => Object.assign(new Error('partner_runtime_config_unavailable'), { code: 'partner_runtime_config_unavailable', statusCode: 503 });
async function runtimeAccessToken() {
  const { resolveFirebaseAdminCredential } = require('../../../src/lib/server/firebase/credential-source');
  const credential = resolveFirebaseAdminCredential({ mode: 'prod' });
  if (!credential.clientEmail || !credential.privateKey) throw unavailable();
  const { JWT } = require('google-auth-library');
  const client = new JWT({ email: credential.clientEmail, key: credential.privateKey, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const result = await client.getAccessToken();
  const token = typeof result === 'string' ? result : result?.token;
  if (!token) throw unavailable();
  return token;
}
function createPartnerRuntimeConfigLoader({ env = process.env, getAccessToken = runtimeAccessToken, getProjectId = () => require('../../../src/lib/server/firebase/credential-source').resolveFirebaseAdminCredential({ mode: 'prod' }).projectId, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let cachedReference = null, expiresAt = 0, pending = null;
  return async function ensurePartnerRuntimeConfig() {
    const reference = env.PULSE_PARTNER_CONFIG_SECRET;
    if (!reference) return;
    if (typeof reference !== 'string' || !(/^[A-Za-z0-9_-]+$/.test(reference) || /^projects\/[A-Za-z0-9_-]+\/secrets\/[A-Za-z0-9_-]+\/versions\/(?:latest|[1-9][0-9]*)$/.test(reference))) throw unavailable();
    if (cachedReference === reference && pending && expiresAt > now()) return pending;
    cachedReference = reference;
    // In-flight requests share a promise even before the first fetch completes.
    expiresAt = Infinity;
    const operation = (async () => {
      try {
        const projectId = reference.includes('/') ? null : getProjectId();
        if (!reference.includes('/') && (typeof projectId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(projectId))) throw unavailable();
        const resource = reference.includes('/') ? reference : `projects/${projectId}/secrets/${reference}/versions/latest`;
        const token = await getAccessToken();
        const response = await fetchImpl(`https://secretmanager.googleapis.com/v1/${resource}:access`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw unavailable();
        const body = await response.json();
        const encoded = body?.payload?.data;
        if (typeof encoded !== 'string' || encoded.length > 32768 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw unavailable();
        const config = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
        if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some(key => !ALLOWED_KEYS.includes(key)) || ALLOWED_KEYS.some(key => typeof config[key] !== 'string' || !config[key])) throw unavailable();
        // No partial publication: validate the entire bundle before hydration.
        if (env.PULSE_PARTNER_CONFIG_SECRET !== reference) throw unavailable();
        for (const key of ALLOWED_KEYS) env[key] = config[key];
        expiresAt = now() + TTL_MS;
      } catch {
        // Provider errors may include bodies or request credentials; never expose them.
        if (cachedReference === reference) { expiresAt = 0; pending = null; }
        throw unavailable();
      }
    })();
    pending = operation;
    return operation;
  };
}
const ensurePartnerRuntimeConfig = createPartnerRuntimeConfigLoader();
module.exports = { ensurePartnerRuntimeConfig, createPartnerRuntimeConfigLoader, ALLOWED_KEYS, TTL_MS };
