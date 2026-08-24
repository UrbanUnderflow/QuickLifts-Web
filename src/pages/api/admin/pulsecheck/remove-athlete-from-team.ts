import type { NextApiRequest, NextApiResponse } from 'next';
import type { DecodedIdToken } from 'firebase-admin/auth';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';

const ADMIN_COLLECTION = 'admin';
const USERS_COLLECTION = 'users';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const PILOT_ENROLLMENTS_COLLECTION = 'pulsecheck-pilot-enrollments';
const PILOT_OPERATIONAL_STATES_COLLECTION = 'pulsecheck-pilot-operational-states';
const AUDIT_EVENTS_COLLECTION = 'pulsecheck-provisioning-audit-events';
const AUDIT_ACTION = 'remove-athlete-from-team';
const TEAM_CODE_GRANTED_VIA = 'team-code-manual-entry';
const TEAM_PLAN_SUBSCRIPTION_TYPE = 'Team Plan Access';
const UNSUBSCRIBED_SUBSCRIPTION_TYPE = 'Unsubscribed';

type JsonRecord = Record<string, unknown>;

type RemovalResult = {
  alreadyRemoved: boolean;
  withdrawnPilotIds: string[];
  withdrawnEnrollmentCount: number;
};

type AdminIdentity = {
  uid: string;
  email: string;
  authorizationSource: 'custom-claim' | 'admin-document' | 'user-isAdmin';
};

class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const normalizeString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const firstHeaderValue = (value: string | string[] | undefined): string =>
  normalizeString(Array.isArray(value) ? value[0] : value).toLowerCase();

export const requestUsesDevFirebase = (req: Pick<NextApiRequest, 'headers'>): boolean => {
  const explicitMode = firstHeaderValue(req.headers['x-pulsecheck-firebase-mode']);
  if (explicitMode === 'dev') return true;
  if (explicitMode === 'prod') return false;

  const pulseCheckDev = firstHeaderValue(req.headers['x-pulsecheck-dev-firebase']);
  const forceDev = firstHeaderValue(req.headers['x-force-dev-firebase']);
  return pulseCheckDev === 'true'
    || pulseCheckDev === '1'
    || forceDev === 'true'
    || forceDev === '1';
};

export const isSafeDocumentId = (value: string): boolean =>
  value.length > 0 && value.length <= 240 && !value.includes('/');

export const isSafeOperationId = (value: string): boolean =>
  value.length > 0
  && value.length <= 128
  && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};

const normalizedIdList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => normalizeString(entry)).filter(Boolean))
  ).sort();
};

const resolveMembershipTeamPlanAccess = (value: unknown): JsonRecord | null => {
  const membership = asRecord(value);
  const commercialAccess = asRecord(membership.commercialAccess);
  const sourceTeamId = normalizeString(
    commercialAccess.sourceTeamId || commercialAccess.teamId || membership.teamId
  );
  const sourceOrganizationId = normalizeString(
    commercialAccess.sourceOrganizationId || commercialAccess.organizationId || membership.organizationId
  );

  if (commercialAccess.teamPlanBypassesPaywall === true && sourceTeamId) {
    return {
      ...commercialAccess,
      sourceTeamId,
      sourceOrganizationId,
      teamPlanBypassesPaywall: true,
    };
  }

  if (normalizeString(membership.grantedVia) === TEAM_CODE_GRANTED_VIA && sourceTeamId) {
    return {
      sourceTeamId,
      sourceOrganizationId,
      teamPlanBypassesPaywall: true,
      grantedVia: TEAM_CODE_GRANTED_VIA,
    };
  }

  return null;
};

const hasPlatformAdminClaim = (decoded: DecodedIdToken): boolean =>
  decoded.admin === true || decoded.isAdmin === true || decoded.role === 'admin';

const bearerToken = (req: NextApiRequest): string => {
  const authorization = normalizeString(req.headers.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const authenticatePlatformAdmin = async (
  req: NextApiRequest,
  adminApp: import('firebase-admin').app.App
): Promise<AdminIdentity> => {
  const token = bearerToken(req);
  if (!token) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Sign in is required.');
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await admin.auth(adminApp).verifyIdToken(token);
  } catch {
    throw new ApiError(401, 'AUTH_INVALID', 'Your sign-in expired. Sign in again and retry.');
  }

  const firestore = admin.firestore(adminApp);
  const email = normalizeString(decoded.email).toLowerCase();
  const [adminDocument, userDocument] = await Promise.all([
    email
      ? firestore.collection(ADMIN_COLLECTION).doc(email).get()
      : Promise.resolve(null),
    firestore.collection(USERS_COLLECTION).doc(decoded.uid).get(),
  ]);

  let authorizationSource: AdminIdentity['authorizationSource'] | null = null;
  if (hasPlatformAdminClaim(decoded)) {
    authorizationSource = 'custom-claim';
  } else if (adminDocument?.exists) {
    authorizationSource = 'admin-document';
  } else if (userDocument.data()?.isAdmin === true) {
    authorizationSource = 'user-isAdmin';
  }

  if (!authorizationSource) {
    throw new ApiError(403, 'PLATFORM_ADMIN_REQUIRED', 'Platform admin access is required.');
  }

  return {
    uid: decoded.uid,
    email,
    authorizationSource,
  };
};

export const onboardingHasActivePilotScope = (value: unknown): boolean => {
  const onboarding = asRecord(value);
  const enrollmentMode = normalizeString(onboarding.enrollmentMode);
  return enrollmentMode === 'pilot'
    || enrollmentMode === 'research'
    || Boolean(normalizeString(onboarding.targetPilotId))
    || Boolean(normalizeString(onboarding.targetPilotName))
    || Boolean(normalizeString(onboarding.targetCohortId))
    || Boolean(normalizeString(onboarding.targetCohortName))
    || (Array.isArray(onboarding.requiredConsents) && onboarding.requiredConsents.length > 0)
    || normalizeString(onboarding.researchConsentStatus) !== ''
      && normalizeString(onboarding.researchConsentStatus) !== 'not-required'
    || onboarding.eligibleForResearchDataset === true;
};

export const clearOnboardingPilotScope = (value: unknown): JsonRecord => ({
  ...asRecord(value),
  enrollmentMode: 'product-only',
  targetPilotId: '',
  targetPilotName: '',
  targetCohortId: '',
  targetCohortName: '',
  requiredConsents: [],
  completedConsentIds: [],
  completedConsentVersions: {},
  researchConsentStatus: 'not-required',
  researchConsentVersion: '',
  researchConsentRespondedAt: null,
  eligibleForResearchDataset: false,
});

const readCompletedAuditResult = (data: JsonRecord): RemovalResult => {
  const storedResult = asRecord(data.result);
  const withdrawnPilotIds = normalizedIdList(
    storedResult.withdrawnPilotIds ?? data.withdrawnPilotIds
  );
  const rawCount = storedResult.withdrawnEnrollmentCount ?? data.withdrawnEnrollmentCount;
  const withdrawnEnrollmentCount = Number(rawCount);

  return {
    alreadyRemoved: storedResult.alreadyRemoved === true || data.alreadyRemoved === true,
    withdrawnPilotIds,
    withdrawnEnrollmentCount: Number.isFinite(withdrawnEnrollmentCount)
      ? Math.max(0, Math.floor(withdrawnEnrollmentCount))
      : 0,
  };
};

const validateAuditReplay = (
  data: JsonRecord,
  teamId: string,
  athleteId: string
): RemovalResult => {
  if (
    normalizeString(data.action) !== AUDIT_ACTION
    || normalizeString(data.teamId) !== teamId
    || normalizeString(data.athleteId) !== athleteId
  ) {
    throw new ApiError(
      409,
      'OPERATION_ID_CONFLICT',
      'This operation ID is already assigned to a different action.'
    );
  }

  if (normalizeString(data.status) !== 'completed') {
    throw new ApiError(409, 'OPERATION_IN_PROGRESS', 'This removal operation is still in progress.');
  }

  return readCompletedAuditResult(data);
};

const parseRequestBody = (body: unknown): {
  teamId: string;
  athleteId: string;
  operationId: string;
} => {
  const input = asRecord(body);
  const teamId = normalizeString(input.teamId);
  const athleteId = normalizeString(input.athleteId);
  const operationId = normalizeString(input.operationId);

  if (!isSafeDocumentId(teamId)) {
    throw new ApiError(400, 'INVALID_TEAM_ID', 'A valid team ID is required.');
  }
  if (!isSafeDocumentId(athleteId)) {
    throw new ApiError(400, 'INVALID_ATHLETE_ID', 'A valid athlete ID is required.');
  }
  if (!isSafeOperationId(operationId)) {
    throw new ApiError(400, 'INVALID_OPERATION_ID', 'A valid operation ID is required.');
  }

  return { teamId, athleteId, operationId };
};

const removeAthlete = async (
  adminApp: import('firebase-admin').app.App,
  actor: AdminIdentity,
  input: { teamId: string; athleteId: string; operationId: string }
): Promise<RemovalResult> => {
  const firestore = admin.firestore(adminApp);
  const { teamId, athleteId, operationId } = input;
  const membershipId = `${teamId}_${athleteId}`;
  const membershipRef = firestore.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(membershipId);
  const userRef = firestore.collection(USERS_COLLECTION).doc(athleteId);
  const auditRef = firestore.collection(AUDIT_EVENTS_COLLECTION).doc(operationId);
  const enrollmentsQuery = firestore
    .collection(PILOT_ENROLLMENTS_COLLECTION)
    .where('userId', '==', athleteId);
  const membershipsQuery = firestore
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('userId', '==', athleteId);

  return firestore.runTransaction(async (transaction) => {
    const auditSnapshot = await transaction.get(auditRef);
    if (auditSnapshot.exists) {
      return validateAuditReplay(auditSnapshot.data() || {}, teamId, athleteId);
    }

    const [membershipSnapshot, userSnapshot, enrollmentSnapshot, membershipsSnapshot] = await Promise.all([
      transaction.get(membershipRef),
      transaction.get(userRef),
      transaction.get(enrollmentsQuery),
      transaction.get(membershipsQuery),
    ]);

    if (!membershipSnapshot.exists) {
      throw new ApiError(404, 'TEAM_MEMBERSHIP_NOT_FOUND', 'The athlete team membership was not found.');
    }

    const membership = membershipSnapshot.data() || {};
    if (
      normalizeString(membership.teamId) !== teamId
      || normalizeString(membership.userId) !== athleteId
      || normalizeString(membership.role) !== 'athlete'
    ) {
      throw new ApiError(
        409,
        'TEAM_MEMBERSHIP_MISMATCH',
        'The stored team membership does not match this athlete removal request.'
      );
    }

    const matchingEnrollments = enrollmentSnapshot.docs.filter((document) => {
      const data = document.data();
      return normalizeString(data.teamId) === teamId
        && normalizeString(data.userId) === athleteId;
    });

    const operationalStateSnapshots = [];
    for (const enrollmentDocument of matchingEnrollments) {
      const operationalStateRef = firestore
        .collection(PILOT_OPERATIONAL_STATES_COLLECTION)
        .doc(enrollmentDocument.id);
      operationalStateSnapshots.push({
        enrollmentDocument,
        operationalState: await transaction.get(operationalStateRef),
      });
    }

    const activeWatchListEnrollmentIds = operationalStateSnapshots
      .filter(({ operationalState }) => operationalState.data()?.watchListActive === true)
      .map(({ enrollmentDocument }) => enrollmentDocument.id)
      .sort();

    if (activeWatchListEnrollmentIds.length > 0) {
      throw new ApiError(
        409,
        'ACTIVE_WATCH_LIST',
        'Clear the athlete watch list before removing this team membership.'
      );
    }

    const membershipAlreadyRevoked = normalizeString(membership.status) === 'removed'
      && membership.revokedAt != null
      && membership.removedAt != null;
    const membershipHasActiveScope = onboardingHasActivePilotScope(membership.athleteOnboarding);
    const membershipNeedsUpdate = !membershipAlreadyRevoked || membershipHasActiveScope;

    const withdrawnEnrollmentDocuments = matchingEnrollments.filter((document) => {
      const data = document.data();
      return normalizeString(data.status) !== 'withdrawn'
        || data.eligibleForResearchDataset === true;
    });

    const user = userSnapshot.data() || {};
    const commercialAccess = asRecord(user.pulseCheckTeamCommercialAccess);
    const onboardInvite = asRecord(user.onboardInvite);
    const alternativeActiveMemberships = membershipsSnapshot.docs
      .filter((document) => document.id !== membershipId)
      .filter((document) => {
        const data = document.data();
        const status = normalizeString(data.status).toLowerCase();
        return normalizeString(data.role) === 'athlete'
          && (!status || status === 'active')
          && data.revokedAt == null
          && data.removedAt == null
          && data.archivedAt == null
          && data.deletedAt == null
          && data.revoked !== true;
      })
      .sort((left, right) => left.id.localeCompare(right.id));
    const alternativeCommercialAccess = alternativeActiveMemberships
      .map((document) => resolveMembershipTeamPlanAccess(document.data()))
      .find((candidate): candidate is JsonRecord => Boolean(candidate));
    const clearCommercialAccess = userSnapshot.exists
      && normalizeString(commercialAccess.sourceTeamId || commercialAccess.teamId) === teamId;
    const clearOnboardInvite = userSnapshot.exists
      && normalizeString(onboardInvite.teamId) === teamId;
    const removedTeamPlanAccess = Boolean(resolveMembershipTeamPlanAccess(membership))
      || clearCommercialAccess
      || (
        clearOnboardInvite
        && (
          normalizeString(onboardInvite.source) === 'pulsecheck-team-code'
          || normalizeString(onboardInvite.grantedVia) === TEAM_CODE_GRANTED_VIA
        )
      );
    const shouldDowngradeTeamPlan = normalizeString(user.subscriptionType) === TEAM_PLAN_SUBSCRIPTION_TYPE
      && removedTeamPlanAccess
      && !alternativeCommercialAccess;
    const shouldSwitchCommercialAccess = removedTeamPlanAccess && Boolean(alternativeCommercialAccess);
    const userNeedsUpdate = clearCommercialAccess
      || clearOnboardInvite
      || shouldDowngradeTeamPlan
      || shouldSwitchCommercialAccess;

    const alreadyRemoved = !membershipNeedsUpdate
      && withdrawnEnrollmentDocuments.length === 0
      && !userNeedsUpdate;
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    if (membershipNeedsUpdate) {
      const membershipUpdate: JsonRecord = {
        status: 'removed',
        athleteOnboarding: clearOnboardingPilotScope(membership.athleteOnboarding),
        updatedAt: timestamp,
      };

      if (normalizeString(membership.status) !== 'removed') {
        membershipUpdate.revokedAt = timestamp;
        membershipUpdate.removedAt = timestamp;
        membershipUpdate.removedByUserId = actor.uid;
        membershipUpdate.removedByEmail = actor.email;
        membershipUpdate.removalReason = 'platform-admin-removal';
        membershipUpdate.removalOperationId = operationId;
      } else {
        if (membership.revokedAt == null) membershipUpdate.revokedAt = timestamp;
        if (membership.removedAt == null) membershipUpdate.removedAt = timestamp;
        if (!normalizeString(membership.removedByUserId)) membershipUpdate.removedByUserId = actor.uid;
        if (!normalizeString(membership.removedByEmail)) membershipUpdate.removedByEmail = actor.email;
        if (!normalizeString(membership.removalReason)) membershipUpdate.removalReason = 'platform-admin-removal';
        if (!normalizeString(membership.removalOperationId)) membershipUpdate.removalOperationId = operationId;
      }

      transaction.update(membershipRef, membershipUpdate);
    }

    for (const enrollmentDocument of withdrawnEnrollmentDocuments) {
      const enrollment = enrollmentDocument.data();
      const enrollmentUpdate: JsonRecord = {
        eligibleForResearchDataset: false,
        removalOperationId: operationId,
        updatedAt: timestamp,
      };
      if (normalizeString(enrollment.status) !== 'withdrawn') {
        enrollmentUpdate.status = 'withdrawn';
        enrollmentUpdate.withdrawnAt = timestamp;
        enrollmentUpdate.withdrawnByUserId = actor.uid;
        enrollmentUpdate.withdrawnByEmail = actor.email;
        enrollmentUpdate.withdrawalReason = 'team-removal';
      }
      transaction.set(
        enrollmentDocument.ref,
        enrollmentUpdate,
        { merge: true }
      );
    }

    if (userNeedsUpdate) {
      const userUpdate: JsonRecord = { updatedAt: timestamp };
      if (clearCommercialAccess || shouldSwitchCommercialAccess) {
        userUpdate.pulseCheckTeamCommercialAccess = alternativeCommercialAccess
          || admin.firestore.FieldValue.delete();
      }
      if (shouldDowngradeTeamPlan) {
        userUpdate.subscriptionType = UNSUBSCRIBED_SUBSCRIPTION_TYPE;
      }
      if (clearOnboardInvite) {
        userUpdate.onboardInvite = admin.firestore.FieldValue.delete();
      }
      transaction.update(userRef, userUpdate);
    }

    const withdrawnPilotIds = Array.from(
      new Set(
        withdrawnEnrollmentDocuments
          .map((document) => normalizeString(document.data().pilotId))
          .filter(Boolean)
      )
    ).sort();
    const result: RemovalResult = {
      alreadyRemoved,
      withdrawnPilotIds,
      withdrawnEnrollmentCount: withdrawnEnrollmentDocuments.length,
    };

    transaction.create(auditRef, {
      action: AUDIT_ACTION,
      status: 'completed',
      operationId,
      teamId,
      athleteId,
      teamMembershipId: membershipId,
      actorUserId: actor.uid,
      actorEmail: actor.email,
      actorAuthorizationSource: actor.authorizationSource,
      withdrawnEnrollmentIds: withdrawnEnrollmentDocuments.map((document) => document.id).sort(),
      withdrawnPilotIds,
      withdrawnEnrollmentCount: withdrawnEnrollmentDocuments.length,
      retainedTeamMembershipIds: alternativeActiveMemberships.map((document) => document.id),
      alreadyRemoved,
      result,
      createdAt: timestamp,
      completedAt: timestamp,
      updatedAt: timestamp,
    });

    return result;
  });
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'POST is required.', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const adminApp = getFirebaseAdminApp(requestUsesDevFirebase(req));
    const actor = await authenticatePlatformAdmin(req, adminApp);
    const input = parseRequestBody(req.body);
    const result = await removeAthlete(adminApp, actor, input);
    res.status(200).json(result);
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const code = error instanceof ApiError ? error.code : 'TEAM_REMOVAL_FAILED';
    const message = error instanceof ApiError
      ? error.message
      : 'The athlete could not be removed from this team.';

    if (statusCode >= 500) {
      console.error('[remove-athlete-from-team] Failed:', error);
    }
    res.status(statusCode).json({ error: message, code });
  }
}
