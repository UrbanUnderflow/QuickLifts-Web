const { resolveProductConfig } = require('../../../src/lib/pulsecheck/productConfig');

/** Use persisted team/org records, never a client supplied brand or care model. */
async function resolveProgramProductConfig(db, { teamId, team, organizationId } = {}) {
  if (!team && teamId) {
    const snapshot = await db.collection('pulsecheck-teams').doc(teamId).get();
    team = snapshot.exists ? snapshot.data() : null;
  }
  const resolvedOrganizationId = team?.organizationId || organizationId || null;
  let organization = null;
  if (resolvedOrganizationId) {
    const snapshot = await db.collection('pulsecheck-organizations').doc(resolvedOrganizationId).get();
    organization = snapshot.exists ? snapshot.data() : null;
  }
  return { ...resolveProductConfig(organization), organizationId: resolvedOrganizationId };
}
function resolveIncidentSupportRoute(record, product, legacyRoute = 'clinician') {
  // A program switch must never reroute an existing case or pending consent.
  if (record?.supportRoute === 'hotline' || record?.supportRoute === 'clinician') return record.supportRoute;
  if (record?.clinicalReferenceId || record?.handoffInitiatedAt) return 'clinician';
  if (record?.createdAt && !record?.productBrand) return legacyRoute === 'hotline' ? 'hotline' : 'clinician';
  return product.escalationModel === '988' ? 'hotline' : 'clinician';
}
module.exports = { resolveProgramProductConfig, resolveIncidentSupportRoute };
