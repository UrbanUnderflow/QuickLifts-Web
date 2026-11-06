const assert = require('node:assert/strict');

// Run before promoting a candidate and again against the published origin.
// An unauthenticated probe cannot issue assignments or alter athlete progress.
async function verifyCurriculumRelease({ deployment, origin, fetchImpl = fetch }) {
  assert.equal(deployment.context, 'production',
    'Curriculum release requires production context; publishing a preview does not apply production-only environment flags.');
  const url = new URL('/api/curriculum/runtime', origin);
  assert.equal(url.protocol, 'https:', 'Use the HTTPS candidate or published origin');
  const response = await fetchImpl(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'today' }), redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json();
  assert.equal(response.status, 401,
    `Curriculum must reach its sign-in gate; received ${response.status} (${body.status || 'no runtime status'}).`);
  assert.equal(body.error, 'Sign in to continue', 'Unexpected curriculum authentication response');
  return { deployId: deployment.id, context: deployment.context, runtimeGateVerified: true,
    authenticatedAssignmentVerified: false };
}
module.exports = { verifyCurriculumRelease };
if (require.main === module) {
  const fs = require('node:fs');
  const [metadataPath, origin] = process.argv.slice(2);
  if (!metadataPath || !origin) throw Error('Usage: node scripts/verify-curriculum-release.cjs DEPLOYMENT_JSON HTTPS_ORIGIN');
  verifyCurriculumRelease({ deployment: JSON.parse(fs.readFileSync(metadataPath, 'utf8')), origin })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
