const { verifyFirebaseUser } = require('./pulsecheck-coach-services');

const INVITES_COLLECTION = 'pulsecheck-invite-links';
const MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const ADMIN_COLLECTION = 'admin';

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeEmail = (value) => normalizeString(value).toLowerCase();

const inactiveStatuses = new Set([
  'inactive',
  'removed',
  'revoked',
  'declined',
  'expired',
  'pending',
  'invited',
  'suspended',
  'disabled',
]);

const isActiveMembership = (membership) => {
  const status = normalizeString(membership?.status).toLowerCase();
  return !inactiveStatuses.has(status) && !membership?.revokedAt;
};

const legacyCapabilitiesForRole = (role) => {
  switch (normalizeString(role).toLowerCase()) {
    case 'team-admin':
      return new Set(['admin']);
    case 'coach':
      return new Set(['coaching']);
    case 'performance-staff':
    case 'clinician':
      return new Set(['athletic_trainer']);
    case 'support-staff':
      return new Set(['administrative']);
    default:
      return new Set();
  }
};

const resolveCapabilities = (membership) => {
  const role = normalizeString(membership?.role).toLowerCase();
  const rawCapabilities = membership?.staffCapabilities;
  if (rawCapabilities == null || (
    Array.isArray(rawCapabilities) && rawCapabilities.length === 0
  )) {
    return legacyCapabilitiesForRole(role);
  }

  const validCapabilities = new Set([
    'admin',
    'administrative',
    'coaching',
    'athletic_trainer',
  ]);
  if (!Array.isArray(rawCapabilities)) {
    return role === 'team-admin' ? new Set(['admin']) : new Set();
  }

  const capabilities = new Set();
  for (const value of rawCapabilities) {
    const normalized = normalizeString(value);
    if (!validCapabilities.has(normalized)) {
      return role === 'team-admin' ? new Set(['admin']) : new Set();
    }
    capabilities.add(normalized);
  }
  if (role === 'team-admin') capabilities.add('admin');
  return capabilities;
};

const inviteTokenFromUrl = (activationUrl) => {
  const value = normalizeString(activationUrl);
  if (!value) return '';

  try {
    const parsed = new URL(value);
    const directToken = normalizeString(parsed.searchParams.get('inviteToken'));
    if (directToken) return directToken;

    const fallbackUrl = normalizeString(parsed.searchParams.get('af_r'));
    if (fallbackUrl && fallbackUrl !== value) {
      const fallbackToken = inviteTokenFromUrl(fallbackUrl);
      if (fallbackToken) return fallbackToken;
    }

    const segments = parsed.pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment).trim())
      .filter(Boolean);
    const inviteSegmentIndex = segments.findIndex(
      (segment) => segment.toLowerCase() === 'team-invite'
    );
    if (inviteSegmentIndex >= 0) {
      return normalizeString(segments[inviteSegmentIndex + 1]);
    }
  } catch (_error) {
    return '';
  }

  return '';
};

const isPlatformAdmin = async ({ database, decoded }) => {
  if (decoded?.admin === true) return true;
  const email = normalizeEmail(decoded?.email);
  if (!email) return false;
  const snapshot = await database.collection(ADMIN_COLLECTION).doc(email).get();
  return snapshot.exists;
};

const loadTeamMemberships = async ({ database, userId, teamId }) => {
  const snapshot = await database
    .collection(MEMBERSHIPS_COLLECTION)
    .where('userId', '==', userId)
    .get();
  return snapshot.docs
    .map((document) => document.data() || {})
    .filter(
      (membership) =>
        normalizeString(membership.teamId) === teamId
        && normalizeString(membership.role).toLowerCase() !== 'athlete'
        && isActiveMembership(membership)
    );
};

const permissionError = (message, statusCode = 403) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const authorizePulseCheckInviteEmail = async (
  event,
  {
    activationUrl,
    toEmail,
    expectedRecipientRole,
    allowedCapabilities,
  }
) => {
  const authenticated = await verifyFirebaseUser(event, {
    authErrorMessage: 'Sign in is required to send a PulseCheck invite.',
  });
  const database = authenticated.app.firestore();
  const token = inviteTokenFromUrl(activationUrl);
  if (!token) {
    throw permissionError('The invite link could not be verified.', 400);
  }

  const inviteSnapshot = await database
    .collection(INVITES_COLLECTION)
    .doc(token)
    .get();
  if (!inviteSnapshot.exists) {
    throw permissionError('The invite link is no longer available.');
  }

  const invite = inviteSnapshot.data() || {};
  const status = normalizeString(invite.status).toLowerCase();
  const teamId = normalizeString(invite.teamId);
  const storedRole = normalizeString(invite.teamMembershipRole).toLowerCase();
  const storedUrl = normalizeString(invite.activationUrl);
  const storedEmail = normalizeEmail(invite.targetEmail);
  const requestedEmail = normalizeEmail(toEmail);

  if (
    normalizeString(invite.inviteType) !== 'team-access'
    || status !== 'active'
    || invite.revokedAt
    || !teamId
    || (expectedRecipientRole === 'athlete' && storedRole !== 'athlete')
    || (expectedRecipientRole === 'staff' && storedRole === 'athlete')
    || (storedUrl && storedUrl !== normalizeString(activationUrl))
    || (storedEmail && storedEmail !== requestedEmail)
  ) {
    throw permissionError('The invite link could not be verified.');
  }

  if (await isPlatformAdmin({ database, decoded: authenticated.decoded })) {
    return {
      ...authenticated,
      database,
      invite,
      inviteId: inviteSnapshot.id,
      teamId,
    };
  }

  const memberships = await loadTeamMemberships({
    database,
    userId: authenticated.userId,
    teamId,
  });
  const requiredCapabilities = new Set(allowedCapabilities);
  const authorized = memberships.some((membership) => {
    const capabilities = resolveCapabilities(membership);
    return [...requiredCapabilities].some(
      (capability) =>
        capabilities.has('admin') || capabilities.has(capability)
    );
  });
  if (!authorized) {
    throw permissionError(
      'This account does not have permission to send this team invite.'
    );
  }

  return {
    ...authenticated,
    database,
    invite,
    inviteId: inviteSnapshot.id,
    teamId,
  };
};

module.exports = {
  authorizePulseCheckInviteEmail,
  inviteTokenFromUrl,
  isActiveMembership,
  resolveCapabilities,
};
