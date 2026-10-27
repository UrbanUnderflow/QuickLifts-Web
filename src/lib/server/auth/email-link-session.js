const fail = (status, reason, message) => { throw Object.assign(new Error(message), { status, reason }); };
const normalizedEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

/** Transfer only an existing, freshly verified email identity to a native session.
 * Firebase identifies both email-link and email/password sign-in as `password`.
 * No request email, UID, organization, role, or claims can select the account.
 */
async function verifyEmailLinkSession({ auth, db, bearer, now = Date.now() }) {
  const identity = await auth.verifyIdToken(bearer, true);
  const email = normalizedEmail(identity.email);
  if (typeof identity.uid !== 'string' || !identity.uid || identity.uid.length > 128 || identity.uid.includes('/') ||
      identity.firebase?.sign_in_provider !== 'password' || identity.email_verified !== true || !email ||
      !Number.isFinite(identity.auth_time) || now / 1000 - identity.auth_time > 600 || identity.auth_time > now / 1000 + 60) {
    fail(401, 'email-link-auth/recent-email-required', 'Open a fresh email sign-in link to continue.');
  }
  const user = await auth.getUser(identity.uid);
  if (user.disabled || user.emailVerified !== true || normalizedEmail(user.email) !== email ||
      !Array.isArray(user.providerData) || !user.providerData.some(provider => provider.providerId === 'password')) {
    fail(401, 'email-link-auth/verification-failed', 'Email ownership could not be verified.');
  }
  const [closure, profile] = await Promise.all([
    db.collection('account-closure-jobs').doc(identity.uid).get(),
    db.collection('users').doc(identity.uid).get(),
  ]);
  if (closure.exists) fail(403, 'email-link-auth/account-closing', 'This account is being closed.');
  if (!profile.exists) fail(403, 'email-link-auth/existing-account-required', 'Create your account first, then use a magic link to log in.');
  return { uid: identity.uid };
}

module.exports = { verifyEmailLinkSession };
