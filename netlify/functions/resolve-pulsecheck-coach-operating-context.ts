import type { Handler } from '@netlify/functions';

const { admin } = require('./config/firebase');
const {
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');

const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const USERS_COLLECTION = 'users';
const COACHES_COLLECTION = 'coaches';
const ADMIN_COLLECTION = 'admin';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-PulseCheck-Firebase-Mode, X-PulseCheck-Dev-Firebase, X-PulseCheck-Firebase-Project-Id',
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const normalizeString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeEmail = (value: unknown) =>
  normalizeString(value).toLowerCase();

const normalizeStatus = (value: unknown) =>
  normalizeString(value).toLowerCase();

const requestError = (message: string, statusCode = 400) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

const isSafeDocumentId = (value: string) => {
  const id = normalizeString(value);
  return Boolean(id)
    && id.length <= 240
    && id !== '.'
    && id !== '..'
    && !id.includes('/');
};

const isActiveRecord = (value: Record<string, any> | null | undefined) => {
  if (!value) return false;
  const status = normalizeStatus(value.status);
  return (!status || status === 'active')
    && value.revokedAt == null
    && value.archivedAt == null
    && value.deletedAt == null
    && value.disabled !== true
    && value.isActive !== false;
};

const isActiveContainer = (value: Record<string, any> | null | undefined) =>
  Boolean(value)
  && normalizeStatus(value?.status) === 'active'
  && value?.revokedAt == null
  && value?.archivedAt == null
  && value?.deletedAt == null;

const staffRoles = new Set([
  'team-admin',
  'coach',
  'performance-staff',
  'support-staff',
  'clinician',
]);

const hasCoachCapability = (membership: Record<string, any>) => {
  const role = normalizeStatus(membership.role);
  const capabilities = Array.isArray(membership.staffCapabilities)
    ? membership.staffCapabilities.map(normalizeStatus).filter(Boolean)
    : [];
  return role === 'team-admin'
    || capabilities.includes('admin')
    || capabilities.includes('coaching')
    || (role === 'coach' && capabilities.length === 0);
};

const rolePriority = (membership: Record<string, any>) => {
  switch (normalizeStatus(membership.role)) {
    case 'team-admin': return 0;
    case 'coach': return 1;
    case 'performance-staff': return 2;
    case 'support-staff': return 3;
    case 'clinician': return 4;
    default: return 5;
  }
};

type OperatingContext = {
  organizationId: string;
  organizationName: string;
  teamId: string;
  teamName: string;
  membershipId: string;
  role: string;
};

const loadExistingOperatingContext = async (
  database: any,
  userId: string
): Promise<OperatingContext | null> => {
  const snapshot = await database
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('userId', '==', userId)
    .get();

  const candidates = snapshot.docs
    .map((document: any) => ({
      document,
      data: document.data() || {},
    }))
    .filter(({ document, data }: any) => {
      const teamId = normalizeString(data.teamId);
      const organizationId = normalizeString(data.organizationId);
      return document.id === `${teamId}_${userId}`
        && normalizeString(data.userId) === userId
        && isSafeDocumentId(teamId)
        && isSafeDocumentId(organizationId)
        && staffRoles.has(normalizeStatus(data.role))
        && hasCoachCapability(data)
        && isActiveRecord(data);
    })
    .sort((left: any, right: any) => {
      const priority = rolePriority(left.data) - rolePriority(right.data);
      if (priority !== 0) return priority;
      return normalizeString(left.data.teamId).localeCompare(
        normalizeString(right.data.teamId)
      );
    });

  for (const { document, data } of candidates) {
    const teamId = normalizeString(data.teamId);
    const organizationId = normalizeString(data.organizationId);
    const [teamSnapshot, organizationSnapshot] = await Promise.all([
      database.collection(TEAMS_COLLECTION).doc(teamId).get(),
      database.collection(ORGANIZATIONS_COLLECTION).doc(organizationId).get(),
    ]);
    const team = teamSnapshot.exists ? teamSnapshot.data() || {} : null;
    const organization = organizationSnapshot.exists
      ? organizationSnapshot.data() || {}
      : null;
    if (
      !isActiveContainer(team)
      || !isActiveContainer(organization)
      || normalizeString(team.organizationId) !== organizationId
    ) {
      continue;
    }

    return {
      organizationId,
      organizationName: normalizeString(organization.displayName) || 'your organization',
      teamId,
      teamName: normalizeString(team.displayName) || 'your team',
      membershipId: document.id,
      role: normalizeStatus(data.role),
    };
  }

  return null;
};

const isPlatformAdmin = async (database: any, decoded: Record<string, any>) => {
  if (decoded?.admin === true) return true;
  const email = normalizeEmail(decoded?.email);
  if (!isSafeDocumentId(email)) return false;
  const snapshot = await database.collection(ADMIN_COLLECTION).doc(email).get();
  return snapshot.exists;
};

const isActiveLegacyCoach = (
  snapshot: any,
  userId: string
) => {
  if (!snapshot?.exists) return false;
  const coach = snapshot.data() || {};
  return isActiveRecord(coach)
    && (!normalizeString(coach.userId) || normalizeString(coach.userId) === userId);
};

const validateOwnedLegacyContainer = ({
  kind,
  data,
  userId,
  organizationId,
}: {
  kind: 'organization' | 'team';
  data: Record<string, any> | null;
  userId: string;
  organizationId: string;
}) => {
  if (!data) return;
  const belongsToCoach = normalizeString(data.legacySource) === 'legacy-coach-roster'
    && normalizeString(data.legacyCoachId) === userId;
  const teamScopeMatches = kind !== 'team'
    || normalizeString(data.organizationId) === organizationId;
  if (!belongsToCoach || !teamScopeMatches || !isActiveContainer(data)) {
    throw requestError(
      `The deterministic legacy coach ${kind} id is already occupied.`,
      409
    );
  }
};

const validateExistingOrganizationMembership = ({
  data,
  userId,
  organizationId,
}: {
  data: Record<string, any> | null;
  userId: string;
  organizationId: string;
}) => {
  if (!data) return;
  if (
    normalizeString(data.userId) !== userId
    || normalizeString(data.organizationId) !== organizationId
    || normalizeStatus(data.role) === 'athlete'
    || !isActiveRecord(data)
  ) {
    throw requestError('The deterministic organization membership id is already occupied.', 409);
  }
};

const validateExistingTeamMembership = ({
  data,
  userId,
  organizationId,
  teamId,
}: {
  data: Record<string, any> | null;
  userId: string;
  organizationId: string;
  teamId: string;
}) => {
  if (!data) return;
  if (
    normalizeString(data.userId) !== userId
    || normalizeString(data.organizationId) !== organizationId
    || normalizeString(data.teamId) !== teamId
    || !staffRoles.has(normalizeStatus(data.role))
    || !isActiveRecord(data)
  ) {
    throw requestError('The deterministic team membership id is already occupied.', 409);
  }
};

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    };
  }

  try {
    const authenticated = await verifyFirebaseUser(event, {
      authErrorMessage: 'Sign in is required to resolve the coach team.',
    });
    const database = authenticated.app.firestore();
    const body = JSON.parse(event.body || '{}');
    const requestedCoachId = normalizeString(body.coachId);
    const userId = normalizeString(authenticated.userId);
    if (!isSafeDocumentId(userId) || (requestedCoachId && requestedCoachId !== userId)) {
      throw requestError('The signed-in coach does not match this request.', 403);
    }

    const existingContext = await loadExistingOperatingContext(database, userId);
    if (existingContext) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          provisioned: false,
          context: existingContext,
        }),
      };
    }

    const coachRef = database.collection(COACHES_COLLECTION).doc(userId);
    const [userSnapshot, coachSnapshot] = await Promise.all([
      database.collection(USERS_COLLECTION).doc(userId).get(),
      coachRef.get(),
    ]);
    const platformAdmin = await isPlatformAdmin(database, authenticated.decoded || {});
    if (!isActiveLegacyCoach(coachSnapshot, userId) && !platformAdmin) {
      throw requestError('An active legacy coach profile is required to create a team bridge.', 403);
    }

    const user = userSnapshot.exists ? userSnapshot.data() || {} : {};
    const coach = coachSnapshot.exists ? coachSnapshot.data() || {} : {};
    const email = normalizeEmail(
      authenticated.decoded?.email || user.email || coach.email
    );
    const displayName = normalizeString(
      user.displayName
      || user.username
      || authenticated.decoded?.name
      || coach.username
      || email
      || userId
    );
    const organizationId = `legacy-coach-org-${userId}`;
    const teamId = `legacy-coach-team-${userId}`;
    if (!isSafeDocumentId(organizationId) || !isSafeDocumentId(teamId)) {
      throw requestError('This coach id cannot be used for a legacy team bridge.', 400);
    }

    const organizationRef = database.collection(ORGANIZATIONS_COLLECTION).doc(organizationId);
    const teamRef = database.collection(TEAMS_COLLECTION).doc(teamId);
    const organizationMembershipRef = database
      .collection(ORGANIZATION_MEMBERSHIPS_COLLECTION)
      .doc(`${organizationId}_${userId}`);
    const teamMembershipRef = database
      .collection(TEAM_MEMBERSHIPS_COLLECTION)
      .doc(`${teamId}_${userId}`);
    const now = admin.firestore.FieldValue.serverTimestamp();
    // Keep the ownership checks and all four bridge writes atomic. Without a
    // transaction, another writer could occupy one of these deterministic ids
    // after validation and have its document merged into this coach's bridge.
    await database.runTransaction(async (transaction: any) => {
      const [
        currentCoachSnapshot,
        organizationSnapshot,
        teamSnapshot,
        organizationMembershipSnapshot,
        teamMembershipSnapshot,
      ] = await Promise.all([
        transaction.get(coachRef),
        transaction.get(organizationRef),
        transaction.get(teamRef),
        transaction.get(organizationMembershipRef),
        transaction.get(teamMembershipRef),
      ]);
      if (!platformAdmin && !isActiveLegacyCoach(currentCoachSnapshot, userId)) {
        throw requestError(
          'An active legacy coach profile is required to create a team bridge.',
          403
        );
      }
      const organization = organizationSnapshot.exists
        ? organizationSnapshot.data() || {}
        : null;
      const team = teamSnapshot.exists ? teamSnapshot.data() || {} : null;
      const organizationMembership = organizationMembershipSnapshot.exists
        ? organizationMembershipSnapshot.data() || {}
        : null;
      const teamMembership = teamMembershipSnapshot.exists
        ? teamMembershipSnapshot.data() || {}
        : null;

      validateOwnedLegacyContainer({
        kind: 'organization',
        data: organization,
        userId,
        organizationId,
      });
      validateOwnedLegacyContainer({
        kind: 'team',
        data: team,
        userId,
        organizationId,
      });
      validateExistingOrganizationMembership({
        data: organizationMembership,
        userId,
        organizationId,
      });
      validateExistingTeamMembership({
        data: teamMembership,
        userId,
        organizationId,
        teamId,
      });

      const membershipRole = normalizeStatus(teamMembership?.role) || 'team-admin';
      const staffCapabilities = Array.isArray(teamMembership?.staffCapabilities)
        ? teamMembership.staffCapabilities
        : ['admin', 'coaching'];
      transaction.set(organizationRef, {
        displayName: normalizeString(organization?.displayName) || `${displayName} Coaching`,
        legalName: normalizeString(organization?.legalName) || `${displayName} Coaching`,
        organizationType: normalizeString(organization?.organizationType) || 'coach-led',
        status: 'active',
        legacySource: 'legacy-coach-roster',
        legacyCoachId: userId,
        primaryCustomerAdminName: displayName,
        primaryCustomerAdminEmail: email,
        defaultStudyPosture: normalizeString(organization?.defaultStudyPosture) || 'operational',
        defaultClinicianBridgeMode:
          normalizeString(organization?.defaultClinicianBridgeMode) || 'none',
        notes: normalizeString(organization?.notes)
          || `Auto-created from the trusted coach bridge for ${displayName}.`,
        createdAt: organization?.createdAt || now,
        updatedAt: now,
      }, { merge: true });
      transaction.set(teamRef, {
        organizationId,
        displayName: normalizeString(team?.displayName) || `${displayName} Team`,
        teamType: normalizeString(team?.teamType) || 'coach-led',
        sportOrProgram: normalizeString(team?.sportOrProgram) || 'Coach-led organization',
        status: 'active',
        legacySource: 'legacy-coach-roster',
        legacyCoachId: userId,
        defaultAdminName: displayName,
        defaultAdminEmail: email,
        defaultInvitePolicy:
          normalizeString(team?.defaultInvitePolicy) || 'admin-staff-and-coaches',
        notes: normalizeString(team?.notes)
          || `Auto-created from the trusted coach bridge for ${displayName}.`,
        createdAt: team?.createdAt || now,
        updatedAt: now,
      }, { merge: true });
      transaction.set(organizationMembershipRef, {
        organizationId,
        userId,
        email,
        role: normalizeStatus(organizationMembership?.role) || 'org-admin',
        status: 'active',
        grantedAt: organizationMembership?.grantedAt || now,
        createdAt: organizationMembership?.createdAt || now,
        updatedAt: now,
      }, { merge: true });
      transaction.set(teamMembershipRef, {
        organizationId,
        teamId,
        userId,
        email,
        role: membershipRole,
        staffCapabilities,
        title: normalizeString(teamMembership?.title) || 'Coach',
        status: 'active',
        permissionSetId:
          normalizeString(teamMembership?.permissionSetId) || 'pulsecheck-team-admin-v1',
        rosterVisibilityScope:
          normalizeString(teamMembership?.rosterVisibilityScope) || 'team',
        allowedAthleteIds: Array.isArray(teamMembership?.allowedAthleteIds)
          ? teamMembership.allowedAthleteIds
          : [],
        onboardingStatus:
          normalizeString(teamMembership?.onboardingStatus) || 'pending-profile',
        grantedAt: teamMembership?.grantedAt || now,
        createdAt: teamMembership?.createdAt || now,
        updatedAt: now,
      }, { merge: true });
    });

    const persistedContext = await loadExistingOperatingContext(database, userId);
    if (
      !persistedContext
      || persistedContext.organizationId !== organizationId
      || persistedContext.teamId !== teamId
    ) {
      throw requestError('The coach team bridge could not be verified after creation.', 500);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        provisioned: true,
        context: persistedContext,
      }),
    };
  } catch (error) {
    console.error('[resolve-pulsecheck-coach-operating-context] Error:', error);
    const statusCode = Number((error as any)?.statusCode) || 500;
    const message = error instanceof Error
      ? error.message
      : 'The coach team could not be resolved.';
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: message, message }),
    };
  }
};

export { handler };
