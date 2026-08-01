const MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';

const INACTIVE_MEMBERSHIP_STATUSES = new Set([
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

const VALID_STAFF_CAPABILITIES = new Set([
  'admin',
  'administrative',
  'coaching',
  'athletic_trainer',
]);

export type PulseCheckScheduleAccess = {
  membershipId: string;
  membership: Record<string, any>;
  organization: Record<string, any>;
  team: Record<string, any>;
};

export class PulseCheckScheduleAccessError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'PulseCheckScheduleAccessError';
    this.statusCode = statusCode;
  }
}

export const normalizeScheduleScopeId = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const isSafeScheduleScopeId = (value: string): boolean =>
  value.length > 0
  && value.length <= 240
  && !value.includes('/')
  && !/[\u0000-\u001f\u007f]/.test(value);

const normalizeStatus = (value: unknown): string =>
  normalizeScheduleScopeId(value).toLowerCase();

const isActiveMembership = (value: Record<string, any>): boolean => {
  const status = normalizeStatus(value.status);
  return !INACTIVE_MEMBERSHIP_STATUSES.has(status) && !value.revokedAt;
};

const isExplicitlyActiveResource = (value: Record<string, any>): boolean =>
  normalizeStatus(value.status) === 'active' && !value.revokedAt;

const legacyCapabilitiesForRole = (role: string): Set<string> => {
  switch (role) {
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

export const resolveScheduleCapabilities = (
  membership: Record<string, any>
): Set<string> => {
  const role = normalizeStatus(membership.role);
  const rawCapabilities = membership.staffCapabilities;
  if (
    rawCapabilities == null
    || (Array.isArray(rawCapabilities) && rawCapabilities.length === 0)
  ) {
    return legacyCapabilitiesForRole(role);
  }

  if (!Array.isArray(rawCapabilities)) {
    return role === 'team-admin' ? new Set(['admin']) : new Set();
  }

  const capabilities = new Set<string>();
  for (const rawCapability of rawCapabilities) {
    const capability = normalizeScheduleScopeId(rawCapability);
    if (!VALID_STAFF_CAPABILITIES.has(capability)) {
      return role === 'team-admin' ? new Set(['admin']) : new Set();
    }
    capabilities.add(capability);
  }
  if (role === 'team-admin') capabilities.add('admin');
  return capabilities;
};

export async function requirePulseCheckScheduleAccess({
  database,
  userId,
  teamId,
  organizationId,
}: {
  database: any;
  userId: string;
  teamId: string;
  organizationId: string;
}): Promise<PulseCheckScheduleAccess> {
  if (!isSafeScheduleScopeId(teamId) || !isSafeScheduleScopeId(organizationId)) {
    throw new PulseCheckScheduleAccessError(
      'Choose a valid team and organization.',
      400
    );
  }

  const membershipSnapshot = await database
    .collection(MEMBERSHIPS_COLLECTION)
    .where('userId', '==', userId)
    .get();
  const membershipDocument = membershipSnapshot.docs.find((document: any) => {
    const membership = document.data() || {};
    const capabilities = resolveScheduleCapabilities(membership);
    return (
      normalizeScheduleScopeId(membership.userId) === userId
      && normalizeScheduleScopeId(membership.teamId) === teamId
      && normalizeScheduleScopeId(membership.organizationId) === organizationId
      && normalizeStatus(membership.role) !== 'athlete'
      && isActiveMembership(membership)
      && (capabilities.has('admin') || capabilities.has('coaching'))
    );
  });

  if (!membershipDocument) {
    throw new PulseCheckScheduleAccessError(
      'Active coach access to the selected team is required.',
      403
    );
  }

  const [teamSnapshot, organizationSnapshot] = await Promise.all([
    database.collection(TEAMS_COLLECTION).doc(teamId).get(),
    database.collection(ORGANIZATIONS_COLLECTION).doc(organizationId).get(),
  ]);
  if (!teamSnapshot.exists || !organizationSnapshot.exists) {
    throw new PulseCheckScheduleAccessError(
      'The selected team or organization could not be found.',
      404
    );
  }

  const team = teamSnapshot.data() || {};
  const organization = organizationSnapshot.data() || {};
  if (
    normalizeScheduleScopeId(team.organizationId) !== organizationId
    || !isExplicitlyActiveResource(team)
    || !isExplicitlyActiveResource(organization)
  ) {
    throw new PulseCheckScheduleAccessError(
      'The selected team and organization must be active.',
      403
    );
  }

  return {
    membershipId: membershipDocument.id,
    membership: membershipDocument.data() || {},
    organization,
    team,
  };
}
