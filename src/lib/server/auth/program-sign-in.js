const { normalizeSignInPolicy, assertOrganizationSignIn } = require('../../pulsecheck/signInPolicy');
const active = row => row && (!row.status || row.status === 'active') && !row.revokedAt && !row.archivedAt && !row.deletedAt && !row.lifecycleState;
async function assertMemberSignIn(db, identity) {
  const profile = (await db.collection('users').doc(identity.uid).get()).data() || {};
  // Preserve the existing platform-admin authority used by provisioning and
  // database rules. A typed reference email can never qualify for this exception.
  if (identity.email_verified === true && typeof identity.email === 'string' && !identity.email.includes('/') && (await db.collection('admin').doc(identity.email).get()).exists) return profile;
  const memberships = await Promise.all(['pulsecheck-organization-memberships', 'pulsecheck-team-memberships'].map(collection => db.collection(collection).where('userId', '==', identity.uid).get()));
  const ids = [...new Set(memberships.flatMap(result => result.docs.map(doc => doc.data()).filter(active).map(row => row.organizationId)).filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id)))];
  for (const id of ids) {
    const organization = (await db.collection('pulsecheck-organizations').doc(id).get()).data();
    if (active(organization)) assertOrganizationSignIn(organization, identity, profile.institutionalEmail || profile.email || identity.email);
  }
  return profile;
}
async function resolvePublicSignInPolicy(db, { email, organizationId } = {}) {
  if (typeof organizationId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(organizationId)) {
    const row = (await db.collection('pulsecheck-organizations').doc(organizationId).get()).data();
    if (active(row)) return normalizeSignInPolicy(row.signInPolicy);
  }
  const domain = typeof email === 'string' && email.length <= 254 ? email.trim().toLowerCase().split('@')[1] : '';
  if (domain && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    const matches = await db.collection('pulsecheck-organizations').where('signInPolicy.emailDomains', 'array-contains', domain).limit(25).get();
    const policies = matches.docs.map(doc => doc.data()).filter(active).map(row => normalizeSignInPolicy(row.signInPolicy));
    if (policies.length) return policies.find(policy => policy.mode === 'institution-phone') || policies[0];
  }
  // The public entrance starts with phone. Legacy methods require an explicitly
  // configured program context; a caller cannot use this lookup to grant access.
  return { mode: 'institution-phone', emailDomains: [] };
}
module.exports = { assertMemberSignIn, resolvePublicSignInPolicy };
