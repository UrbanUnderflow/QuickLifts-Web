const PHONE_MODE = 'institution-phone';
function normalizeSignInPolicy(value) {
  if (value == null) return { mode: 'standard', emailDomains: [] };
  if (!value || !['standard', PHONE_MODE].includes(value.mode) || !Array.isArray(value.emailDomains)) throw new Error('Choose a valid sign-in method.');
  const emailDomains = [...new Set(value.emailDomains.map(domain => String(domain).trim().toLowerCase().replace(/^@/, '')))];
  if (emailDomains.length > 20 || emailDomains.some(domain => !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain) || domain.includes('..')) || (value.mode === PHONE_MODE && !emailDomains.length)) throw new Error('Add the institution’s email domains, such as umes.edu.');
  return { mode: value.mode, emailDomains };
}
function phoneSession(identity) {
  return identity?.firebase?.sign_in_provider === 'phone' || (identity?.firebase?.sign_in_provider === 'custom' && identity.pulse_phone_auth === true);
}
function assertOrganizationSignIn(organization, identity, email) {
  if (organization?.signInPolicy?.mode !== PHONE_MODE) return;
  const policy = normalizeSignInPolicy(organization.signInPolicy);
  if (!phoneSession(identity)) throw Object.assign(new Error('Use your institutional email and phone number to register for this program.'), { status: 403, code: 'program/phone-required' });
  const domain = String(email || '').trim().toLowerCase().split('@')[1];
  if (!policy.emailDomains.includes(domain)) throw Object.assign(new Error('Use an email address from your institution.'), { status: 403, code: 'program/institution-email-required' });
}
module.exports = { PHONE_MODE, normalizeSignInPolicy, phoneSession, assertOrganizationSignIn };
