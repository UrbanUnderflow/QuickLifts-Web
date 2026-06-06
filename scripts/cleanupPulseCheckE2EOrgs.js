/* eslint-disable */
/**
 * Cleanup PulseCheck E2E test-harness orgs from the DEV Firestore project,
 * keeping ONE org you've been working in.
 *
 * Safety:
 *  - Only deletes orgs whose fields match the test-harness predicate (e2e-,
 *    playwright, @pulse.test, ...). Real orgs are never touched.
 *  - Hard-excludes KEEP_ORG_ID (and its children).
 *  - DRY RUN by default. Pass --confirm to actually delete.
 *  - Pinned to project quicklifts-dev-01.
 *
 * Usage:
 *   node scripts/cleanupPulseCheckE2EOrgs.js            # dry run (prints plan)
 *   node scripts/cleanupPulseCheckE2EOrgs.js --confirm  # actually deletes
 */
const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = 'quicklifts-dev-01';
const KEEP_ORG_ID = 'e2e-pulsecheck-journey-workspace-org';
const CONFIRM = process.argv.includes('--confirm');

const ORGANIZATIONS = 'pulsecheck-organizations';
// Every collection that carries an `organizationId` and should cascade-delete.
const CHILD_COLLECTIONS = [
  'pulsecheck-teams',
  'pulsecheck-pilots',
  'pulsecheck-pilot-cohorts',
  'pulsecheck-pilot-enrollments',
  'pulsecheck-organization-memberships',
  'pulsecheck-team-memberships',
  'pulsecheck-invite-links',
  'pulsecheck-invite-activities',
];

const isTestHarnessText = (value) => {
  const n = String(value || '').trim().toLowerCase();
  if (!n) return false;
  return (
    n.startsWith('e2e ') ||
    n.startsWith('e2e-') ||
    n.startsWith('e2e_') ||
    n.includes(' e2e ') ||
    n.includes(' e2e-') ||
    n.includes('e2e-pulsecheck') ||
    n.endsWith('@pulse.test') ||
    n.endsWith('@pulsecheck.test') ||
    n.includes('playwright')
  );
};

const orgIsTestHarness = (id, data) =>
  [
    id,
    data.displayName,
    data.legalName,
    data.primaryCustomerAdminEmail,
    data.implementationOwnerEmail,
    data.notes,
  ].some(isTestHarnessText);

async function main() {
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const db = getFirestore();

  console.log(`\nProject: ${PROJECT_ID}`);
  console.log(`Mode: ${CONFIRM ? 'DELETE (--confirm)' : 'DRY RUN'}`);
  console.log(`Keeping org: ${KEEP_ORG_ID}\n`);

  const orgsSnap = await db.collection(ORGANIZATIONS).get();
  const deleteOrgIds = new Set();
  let keptFound = false;
  let nonTestCount = 0;

  orgsSnap.forEach((doc) => {
    const data = doc.data();
    if (doc.id === KEEP_ORG_ID) { keptFound = true; return; }
    if (orgIsTestHarness(doc.id, data)) {
      deleteOrgIds.add(doc.id);
    } else {
      nonTestCount += 1;
    }
  });

  console.log(`Total orgs: ${orgsSnap.size}`);
  console.log(`Kept org present: ${keptFound ? 'yes' : 'NO (aborting if not found)'}`);
  console.log(`Non-test orgs left untouched: ${nonTestCount}`);
  console.log(`Test-harness orgs to delete: ${deleteOrgIds.size}\n`);

  if (!keptFound) {
    console.error(`ERROR: keep org ${KEEP_ORG_ID} not found. Aborting to avoid mistakes.`);
    process.exit(1);
  }
  if (deleteOrgIds.has(KEEP_ORG_ID)) {
    console.error('ERROR: keep org is in the delete set. Aborting.');
    process.exit(1);
  }
  if (deleteOrgIds.size === 0) {
    console.log('Nothing to delete.');
    return;
  }

  // Collect child refs across all collections, filtering by organizationId.
  const refs = [];
  const perCollectionCounts = {};
  for (const col of CHILD_COLLECTIONS) {
    const snap = await db.collection(col).get();
    let count = 0;
    snap.forEach((doc) => {
      const orgId = doc.data().organizationId;
      if (orgId && deleteOrgIds.has(orgId)) {
        refs.push(doc.ref);
        count += 1;
      }
    });
    perCollectionCounts[col] = count;
  }
  // Org docs themselves.
  deleteOrgIds.forEach((id) => refs.push(db.collection(ORGANIZATIONS).doc(id)));

  console.log('Documents to delete by collection:');
  for (const col of CHILD_COLLECTIONS) console.log(`  ${col}: ${perCollectionCounts[col]}`);
  console.log(`  ${ORGANIZATIONS}: ${deleteOrgIds.size}`);
  console.log(`\nTotal documents to delete: ${refs.length}`);

  if (!CONFIRM) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --confirm to execute.');
    return;
  }

  console.log('\nDeleting...');
  const CHUNK = 450;
  let deleted = 0;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = db.batch();
    const slice = refs.slice(i, i + CHUNK);
    slice.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += slice.length;
    console.log(`  deleted ${deleted}/${refs.length}`);
  }
  console.log(`\nDone. Deleted ${deleted} documents across ${deleteOrgIds.size} test orgs. Kept ${KEEP_ORG_ID}.`);
}

main().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
