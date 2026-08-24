const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const pagePath = path.resolve(
  __dirname,
  '../../../src/pages/PulseCheck/team-invite/[token].tsx'
);
const source = fs.readFileSync(pagePath, 'utf8');
const serverHandler = source.slice(source.indexOf('export const getServerSideProps'));
const provisioningServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/api/firebase/pulsecheckProvisioning/service.ts'),
  'utf8'
);
const redeemHandlerSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/pages/api/pulsecheck/team-invite/redeem.ts'),
  'utf8'
);

test('team invite SSR keeps invite, team, and organization reads in one Firebase environment', () => {
  assert.match(
    serverHandler,
    /const forceDevFirebase = query\.devFirebase === ['"]1['"];/,
    'the signed link query must choose the Firebase environment before any invite read'
  );
  assert.match(
    serverHandler,
    /getFirebaseAdminApp\(forceDevFirebase\)/,
    'the selected Admin app must follow the invite environment'
  );
  assert.match(
    serverHandler,
    /const firestore = admin\.firestore\(adminApp\);/,
    'all related document reads must share the selected Admin Firestore instance'
  );
  assert.match(
    serverHandler,
    /let invite = await firestore\s*\.collection\(['"]pulsecheck-invite-links['"]\)/,
    'the invite must load from the selected environment'
  );
  assert.match(
    serverHandler,
    /firestore\.collection\(['"]pulsecheck-organizations['"]\)/,
    'the organization must load from the same environment as the invite'
  );
  assert.match(
    serverHandler,
    /firestore\.collection\(['"]pulsecheck-teams['"]\)/,
    'live team commercialization must load from the same environment as the invite'
  );
  assert.doesNotMatch(
    serverHandler,
    /admin\.firestore\(\)\s*\.collection\(/,
    'default Admin Firestore reads would silently mix production data into a development invite'
  );
});

test('production Firebase on localhost still mints a public phone-safe invite URL', () => {
  assert.match(
    provisioningServiceSource,
    /isLocalHostname\(window\.location\.hostname\) && isUsingDevFirebase\(\)[\s\S]*?window\.location\.origin[\s\S]*?: PULSECHECK_LINK_ORIGIN/,
    'localhost must only become the invite origin when the active Firebase environment is development'
  );
  assert.match(
    provisioningServiceSource,
    /const shouldStampDevFirebaseLinks = \(\) =>[\s\S]*?isLocalHostname\(window\.location\.hostname\) &&[\s\S]*?isUsingDevFirebase\(\)/,
    'devFirebase=1 must follow the active Firebase environment rather than hostname alone'
  );
});

test('reusable invite lifecycle preserves revocation and repairs only legacy redeemed status', () => {
  assert.match(
    provisioningServiceSource,
    /if \(normalizedStatus === 'revoked'\) \{[\s\S]*?return 'revoked';/,
    'a revoked reusable invite must remain revoked after client normalization'
  );
  assert.match(
    provisioningServiceSource,
    /normalizeInviteRedemptionMode\(data\.redemptionMode\) === 'general' &&[\s\S]*?normalizeString\(data\.status\) === 'redeemed'/,
    'only the legacy redeemed status may be repaired for reusable links'
  );
  assert.match(
    provisioningServiceSource,
    /return status === 'active' \|\| status === 'redeemed';/,
    'reusable-link token reuse must exclude revoked links so rotation produces a fresh bearer credential'
  );
});

test('pilot invite creation and redemption share the schedule-aware enrollment gate', () => {
  assert.match(
    provisioningServiceSource,
    /resolvePulseCheckPilotEnrollmentAcceptance\(pilotData\)[\s\S]*?!pilotEnrollmentAcceptance\.acceptsEnrollment/,
    'invite issuance must reject inactive, future, ended, or malformed pilot schedules'
  );
  assert.match(
    redeemHandlerSource,
    /resolvePulseCheckPilotEnrollmentAcceptance\(pilotData\)[\s\S]*?!pilotEnrollmentAcceptance\.acceptsEnrollment/,
    'invite redemption must apply the same pilot schedule gate as issuance'
  );
});

test('pilot and cohort invite redemption validates ownership and existing enrollment scope', () => {
  assert.match(redeemHandlerSource, /const PILOT_COHORTS_COLLECTION = 'pulsecheck-pilot-cohorts';/);
  assert.match(
    redeemHandlerSource,
    /normalizeString\(pilotData\.organizationId\) !== organizationId[\s\S]*?normalizeString\(pilotData\.teamId\) !== teamId/,
    'pilot redemption must require a pilot owned by the invite team and organization'
  );
  assert.match(
    redeemHandlerSource,
    /normalizeString\(cohortData\.status\) !== 'active'[\s\S]*?normalizeString\(cohortData\.pilotId\) !== pilotId/,
    'cohort redemption must require an active cohort owned by the selected pilot'
  );
  assert.match(
    redeemHandlerSource,
    /hasCurrentPilotEnrollment[\s\S]*?normalizeString\(existingPilotEnrollment\.cohortId\) !== cohortId[\s\S]*?already enrolled in a different pilot cohort/,
    'scanning a different QR must not move or clear an existing athlete cohort'
  );
});
