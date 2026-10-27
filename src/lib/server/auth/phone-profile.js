const { assertMemberSignIn } = require('./program-sign-in');
const { assertOrganizationSignIn } = require('../../pulsecheck/signInPolicy');
const TERMS_VERSION = '2026-04-08';
const PRIVACY_VERSION = '2026-04-08';
const fail = (status, reason, message) => { throw Object.assign(new Error(message), { status, reason }); };

/** Email is reference data. Only the SMS-verified Firebase UID owns the account. */
async function completePhoneProfile({ auth, db, bearer, body, now = Date.now() }) {
  const identity = await auth.verifyIdToken(bearer, true);
  if (identity.firebase?.sign_in_provider !== 'phone' || !identity.phone_number ||
      !Number.isFinite(identity.auth_time) || now / 1000 - identity.auth_time > 600 || identity.auth_time > now / 1000 + 60) {
    fail(401, 'phone-auth/recent-phone-required', 'Request a fresh text message to verify your phone.');
  }
  const user = await auth.getUser(identity.uid);
  if (user.disabled || user.phoneNumber !== identity.phone_number || !user.providerData.some((provider) => provider.providerId === 'phone')) {
    fail(401, 'phone-auth/verification-failed', 'Phone ownership could not be verified.');
  }
  const ref = db.collection('users').doc(identity.uid);
  const existing = await ref.get();
  // Signing in must never replace an existing email, baseline, role, or consent.
  if (existing.exists) { await assertMemberSignIn(db, identity); return { uid: identity.uid, created: false }; }
  // Institutional enrollment is an explicit organization registration flow.
  // The general login surface only opens existing, phone-linked profiles.
  if (typeof body.organizationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.organizationId)) {
    fail(400, 'phone-auth/registration-required', 'Create your account first, then connect your phone to sign in.');
  }
  const organization = (await db.collection('pulsecheck-organizations').doc(body.organizationId).get()).data();
  if (!organization || organization.deletedAt || organization.archivedAt || organization.lifecycleState || (organization.status && organization.status !== 'active')) fail(403, 'program/unavailable', 'This program is unavailable.');
  if (organization.signInPolicy?.mode !== 'institution-phone') {
    fail(400, 'phone-auth/registration-required', 'Create your account first, then connect your phone to sign in.');
  }
  const email = String(body.institutionalEmail || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(400, 'phone-auth/invalid-email', 'Enter your institutional email address.');
  }
  assertOrganizationSignIn(organization, identity, email);
  if (body.acceptTerms !== true || body.termsVersion !== TERMS_VERSION || body.privacyVersion !== PRIVACY_VERSION) {
    fail(400, 'phone-auth/legal-required', 'Agree to the Terms and Privacy Policy before creating an account.');
  }
  let emailOwner = null;
  try { emailOwner = await auth.getUserByEmail(email); }
  catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
  const matches = await Promise.all([
    db.collection('users').where('email', '==', email).limit(1).get(),
    db.collection('users').where('institutionalEmail', '==', email).limit(1).get(),
    db.collection('users').where('signInEmails', 'array-contains', email).limit(1).get(),
  ]);
  if (emailOwner && emailOwner.uid !== identity.uid) {
    fail(409, 'phone-auth/existing-account', 'This email is already on an account. Use an email sign-in link once, then connect your phone in Settings. Your existing answers will stay on that account.');
  }
  if (matches.some((match) => match.docs.some((document) => document.id !== identity.uid))) {
    fail(409, 'phone-auth/reference-email-in-use', 'An account already uses this reference email. Sign in with its connected phone or existing sign-in method, then connect your new phone in Settings. Contact support if you no longer have access.');
  }
  return db.runTransaction(async (transaction) => {
    if ((await transaction.get(ref)).exists) return { uid: identity.uid, created: false };
    transaction.create(ref, {
      id: identity.uid, email, institutionalEmail: email, institutionalEmailVerified: false,
      phoneNumber: identity.phone_number, authProviders: ['phone'],
      // No signInEmails: an unverified reference email is not an auth credential.
      displayName: '', registrationComplete: false, subscriptionType: 'Unsubscribed',
      createdAt: new Date(now), platform: ['web', 'ios', 'android'].includes(body.platform) ? body.platform : 'web',
      legalAcceptance: {
        termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION,
        acceptedAt: new Date(now), acceptanceMethod: 'phone_sms_signup', termsPath: '/terms', privacyPath: '/privacy',
      },
    });
    return { uid: identity.uid, created: true };
  });
}

module.exports = { completePhoneProfile };
