const { getFirebaseAdminApp, admin } = require('./config/firebase');
const { bucketFor, removeExpiredInputs } = require('./lib/pulsecheck-clay-self');
// A failed dispatch or killed worker must not retain reference photos indefinitely.
// This hourly sweep is a fallback; the worker deletes inputs immediately on completion.
exports.handler = async () => {
  let removed = 0;
  for (const mode of ['prod', 'dev']) {
    try {
      const app = getFirebaseAdminApp({ headers: { 'x-pulsecheck-firebase-mode': mode } });
      removed += await removeExpiredInputs(bucketFor(admin, app, mode));
    } catch {
      // Do not include object names or credentials in scheduled logs.
      console.error(`[Clay Self cleanup] ${mode} sweep failed`);
    }
  }
  return { statusCode: 200, body: JSON.stringify({ removed }) };
};
