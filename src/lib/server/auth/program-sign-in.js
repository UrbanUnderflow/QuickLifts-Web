const { normalizeSignInPolicy } = require('../../pulsecheck/signInPolicy');
const active = row => row && (!row.status || row.status === 'active') && !row.revokedAt && !row.archivedAt && !row.deletedAt && !row.lifecycleState;
async function assertMemberSignIn(db, identity) {
  const profile = (await db.collection('users').doc(identity.uid).get()).data() || {};
  // Organization policy governs enrollment. Existing members may choose any
  // credential linked to their account when returning to the platform.
  return profile;
}
async function resolvePublicSignInPolicy(db, { organizationId } = {}) {
  if (typeof organizationId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(organizationId)) {
    const row = (await db.collection('pulsecheck-organizations').doc(organizationId).get()).data();
    if (active(row)) return normalizeSignInPolicy(row.signInPolicy);
  }
  // Email domains cannot select an organization. Registration policy applies
  // only when the caller supplies an explicit active organization context.
  return { mode: 'standard', emailDomains: [] };
}
module.exports = { assertMemberSignIn, resolvePublicSignInPolicy };
