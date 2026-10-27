const { normalizeSignInPolicy } = require('../../pulsecheck/signInPolicy');
const { createHash } = require('crypto');
const { validateProductBrand, normalizeAppBranding } = require('../../pulsecheck/productConfig');

async function provisionEntity(db, { kind, operationId, actor, actorUid, payload }, timestamp) {
  if (!['organization', 'team'].includes(kind) || !/^[a-zA-Z0-9_-]{16,100}$/.test(operationId || '') || !actor) throw new Error('Valid provisioning operation required.');
  if (!payload?.displayName?.trim()) throw new Error('Display name required.');
  const data = { ...payload };
  delete data.createdAt; delete data.updatedAt;
  if (data.implementationMetadata) data.implementationMetadata = { ...data.implementationMetadata, provisionedAt: timestamp };
  if (kind === 'organization') {
    data.productBrand = validateProductBrand(data.productBrand);
    data.appBranding = normalizeAppBranding(data.appBranding);
    delete data.appExperience;
    data.signInPolicy = normalizeSignInPolicy(data.signInPolicy);
  }
  const id = createHash('sha256').update(`${actorUid || actor.toLowerCase()}:${kind}:${operationId}`).digest('hex');
  const ref = db.collection(kind === 'organization' ? 'pulsecheck-organizations' : 'pulsecheck-teams').doc(id);
  return db.runTransaction(async transaction => {
    if (actorUid) {
      const closure = await transaction.get(db.collection('account-closure-jobs').doc(actorUid));
      if (closure.exists) throw new Error('Account closure is pending.');
    }
    const existing = await transaction.get(ref);
    if (existing.exists) {
      const row = existing.data();
      if (row.lifecycleState || row.deletedAt) throw new Error('This program is decommissioned. Restore it from Deleted organizations before making changes.');
      if (row.displayName !== data.displayName || (kind === 'team' && row.organizationId !== data.organizationId) ||
        (kind === 'organization' && row.productBrand !== data.productBrand)) throw new Error('This saved operation already created a different program. Resume that program or start a separate organization.');
      return { id, created: false };
    }
    if (kind === 'team') {
      if (typeof data.organizationId !== 'string' || !data.organizationId || data.organizationId.includes('/')) throw new Error('Organization required.');
      const organization = await transaction.get(db.collection('pulsecheck-organizations').doc(data.organizationId));
      if (!organization.exists) throw new Error('Organization not found.');
      if (organization.data().lifecycleState || organization.data().deletedAt) throw new Error('This organization is decommissioned.');
      validateProductBrand(organization.data().productBrand);
    }
    transaction.set(ref, { ...data, provisioningOperationId: operationId, provisionedBy: actor,
      createdAt: timestamp, updatedAt: timestamp });
    return { id, created: true };
  });
}
module.exports = { provisionEntity };
