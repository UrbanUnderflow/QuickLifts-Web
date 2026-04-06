import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../lib/firebase-admin';
import { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import {
  derivePulseCheckTeamPlanBypass,
  getDefaultPulseCheckTeamCommercialConfig,
  mergePulseCheckRequiredConsents,
} from '../../../../api/firebase/pulsecheckProvisioning/types';
import {
  resolvePilotEnrollmentStatus,
  resolveTeamMembershipOnboardingStatus,
} from '../../../../api/firebase/pulsecheckProvisioning/accessState';
import type {
  PulseCheckInviteLinkRedemptionMode,
  PulseCheckRequiredConsentDocument,
  PulseCheckPilotStudyMode,
  PulseCheckResearchConsentStatus,
  PulseCheckTeamCommercialConfig,
  PulseCheckTeamCommercialSnapshot,
  PulseCheckTeamMembershipRole,
} from '../../../../api/firebase/pulsecheckProvisioning/types';

const INVITE_LINKS_COLLECTION = 'pulsecheck-invite-links';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const PILOTS_COLLECTION = 'pulsecheck-pilots';
const PILOT_ENROLLMENTS_COLLECTION = 'pulsecheck-pilot-enrollments';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value: unknown) => normalizeString(value).toLowerCase();
const normalizeInviteRedemptionMode = (value: unknown): PulseCheckInviteLinkRedemptionMode =>
  value === 'general' ? 'general' : 'single-use';
const SubscriptionType = {
  unsubscribed: 'Unsubscribed',
  teamPlan: 'Team Plan Access',
};
const SubscriptionPlatform = {
  Web: 'Web',
};
const buildPilotEnrollmentId = (pilotId: string, userId: string) => `${normalizeString(pilotId)}_${normalizeString(userId)}`;
const normalizeRevenueRecipientRole = (value: unknown) => {
  const normalized = normalizeString(value);
  if (normalized === 'coach' || normalized === 'organization-owner') {
    return normalized;
  }
  return 'team-admin';
};
const normalizeReferralRevenueSharePct = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed * 100) / 100));
};
const normalizeTimestampLike = (
  value: unknown
): PulseCheckTeamCommercialConfig['teamPlanActivatedAt'] => {
  if (!value || typeof value !== 'object') return null;
  return value as PulseCheckTeamCommercialConfig['teamPlanActivatedAt'];
};
const normalizeTeamCommercialConfig = (value: unknown): PulseCheckTeamCommercialConfig => {
  const candidate = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const defaults = getDefaultPulseCheckTeamCommercialConfig();
  const commercialModel = normalizeString(candidate.commercialModel ?? defaults.commercialModel);
  const teamPlanStatus = normalizeString(candidate.teamPlanStatus ?? defaults.teamPlanStatus);

  return {
    commercialModel: commercialModel === 'team-plan' ? 'team-plan' : 'athlete-pay',
    teamPlanStatus: teamPlanStatus === 'active' ? 'active' : 'inactive',
    referralKickbackEnabled:
      typeof candidate.referralKickbackEnabled === 'boolean'
        ? candidate.referralKickbackEnabled
        : defaults.referralKickbackEnabled,
    referralRevenueSharePct: normalizeReferralRevenueSharePct(candidate.referralRevenueSharePct ?? defaults.referralRevenueSharePct),
    revenueRecipientRole: normalizeRevenueRecipientRole(candidate.revenueRecipientRole),
    revenueRecipientUserId: normalizeString(candidate.revenueRecipientUserId ?? defaults.revenueRecipientUserId),
    billingOwnerUserId: normalizeString(candidate.billingOwnerUserId ?? defaults.billingOwnerUserId),
    billingCustomerId: normalizeString(candidate.billingCustomerId ?? defaults.billingCustomerId),
    teamPlanActivatedAt: normalizeTimestampLike(candidate.teamPlanActivatedAt),
    teamPlanExpiresAt: normalizeTimestampLike(candidate.teamPlanExpiresAt),
  };
};
const resolveTeamAdminCommercialConfig = (commercialConfig: PulseCheckTeamCommercialConfig, userId: string): PulseCheckTeamCommercialConfig => {
  if (commercialConfig.revenueRecipientRole !== 'team-admin' || commercialConfig.revenueRecipientUserId) {
    return commercialConfig;
  }

  return {
    ...commercialConfig,
    revenueRecipientUserId: normalizeString(userId),
  };
};
const buildTeamCommercialSnapshot = (input: {
  organizationId: string;
  teamId: string;
  inviteToken: string;
  commercialConfig: PulseCheckTeamCommercialConfig;
}): PulseCheckTeamCommercialSnapshot => ({
  ...input.commercialConfig,
  sourceOrganizationId: normalizeString(input.organizationId),
  sourceTeamId: normalizeString(input.teamId),
  inviteToken: normalizeString(input.inviteToken),
  teamPlanBypassesPaywall: derivePulseCheckTeamPlanBypass(input.commercialConfig),
});
const normalizeRequiredConsentDocuments = (value: unknown): PulseCheckRequiredConsentDocument[] => {
  if (!Array.isArray(value)) return [];

  const normalized = value.reduce<PulseCheckRequiredConsentDocument[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const title = normalizeString(candidate.title);
    const body = normalizeString(candidate.body);
    const version = normalizeString(candidate.version) || 'v1';
    const id = normalizeString(candidate.id) || `consent-${index + 1}`;
    if (!title || !body) return acc;
    acc.push({ id, title, body, version });
    return acc;
  }, []);

  return mergePulseCheckRequiredConsents(normalized);
};
const normalizeCompletedConsentIds = (
  value: unknown,
  requiredConsents: PulseCheckRequiredConsentDocument[]
): string[] => {
  if (!Array.isArray(value) || requiredConsents.length === 0) return [];
  const allowedIds = new Set(requiredConsents.map((consent) => consent.id));
  return value
    .map((entry) => normalizeString(entry))
    .filter((entry, index, entries) => entry && allowedIds.has(entry) && entries.indexOf(entry) === index);
};
const resolveResearchConsentStatusForStudyMode = (
  studyMode: PulseCheckPilotStudyMode | null,
  currentStatus?: unknown
): PulseCheckResearchConsentStatus => {
  const normalizedCurrentStatus = normalizeString(String(currentStatus || '')) as PulseCheckResearchConsentStatus;
  if (normalizedCurrentStatus === 'accepted' || normalizedCurrentStatus === 'declined') {
    return normalizedCurrentStatus;
  }

  return studyMode === 'research' ? 'pending' : 'not-required';
};
const buildAthleteOnboardingFromInvite = (
  invite: Record<string, any>,
  currentState?: Record<string, any> | null,
  pilotStudyMode: PulseCheckPilotStudyMode | null = null,
  pilotRequiredConsents: PulseCheckRequiredConsentDocument[] = []
) => {
  const pilotId = normalizeString(invite.pilotId);
  const cohortId = normalizeString(invite.cohortId);
  const researchConsentStatus = resolveResearchConsentStatusForStudyMode(pilotStudyMode, currentState?.researchConsentStatus);
  const isResearchMode = pilotStudyMode === 'research';
  const requiredConsents = pilotRequiredConsents;
  const completedConsentIds = normalizeCompletedConsentIds(currentState?.completedConsentIds, requiredConsents);

  return {
    productConsentAccepted: Boolean(currentState?.productConsentAccepted),
    productConsentAcceptedAt: currentState?.productConsentAcceptedAt || null,
    productConsentVersion: normalizeString(currentState?.productConsentVersion),
    entryOnboardingStep: currentState?.entryOnboardingStep || 'name',
    entryOnboardingName: normalizeString(currentState?.entryOnboardingName),
    researchConsentStatus,
    researchConsentVersion: normalizeString(currentState?.researchConsentVersion),
    researchConsentRespondedAt: currentState?.researchConsentRespondedAt || null,
    eligibleForResearchDataset:
      researchConsentStatus === 'accepted'
        ? true
        : isResearchMode
          ? false
          : Boolean(currentState?.eligibleForResearchDataset),
    enrollmentMode:
      pilotId || cohortId
        ? isResearchMode
          ? researchConsentStatus === 'declined'
            ? 'pilot'
            : 'research'
          : 'pilot'
        : currentState?.enrollmentMode || 'product-only',
    targetPilotId: pilotId || normalizeString(currentState?.targetPilotId),
    targetPilotName: normalizeString(invite.pilotName) || normalizeString(currentState?.targetPilotName),
    targetCohortId: cohortId || normalizeString(currentState?.targetCohortId),
    targetCohortName: normalizeString(invite.cohortName) || normalizeString(currentState?.targetCohortName),
    requiredConsents,
    completedConsentIds,
    baselinePathStatus: currentState?.baselinePathStatus || 'pending',
    baselinePathwayId: normalizeString(currentState?.baselinePathwayId),
  };
};

const permissionSetByRole: Record<PulseCheckTeamMembershipRole, string> = {
  'team-admin': 'pulsecheck-team-admin-v1',
  coach: 'pulsecheck-coach-v1',
  'performance-staff': 'pulsecheck-performance-staff-v1',
  'support-staff': 'pulsecheck-support-staff-v1',
  clinician: 'pulsecheck-clinician-v1',
  athlete: 'pulsecheck-athlete-v1',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authenticated session required.' });
  }

  const idToken = authHeader.slice('Bearer '.length);
  const token = normalizeString(req.body?.token);
  const forceDevFirebase = req.body?.forceDevFirebase === true;
  if (!token) {
    return res.status(400).json({ error: 'Invite token is required.' });
  }

  try {
    const adminApp = getFirebaseAdminApp(forceDevFirebase);
    const decoded = await admin.auth(adminApp).verifyIdToken(idToken);
    const userId = decoded.uid;
    const userEmail = normalizeEmail(decoded.email);
    if (!userEmail) {
      return res.status(400).json({ error: 'Authenticated user must have an email address.' });
    }

    const firestore = admin.firestore(adminApp);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const inviteRef = firestore.collection(INVITE_LINKS_COLLECTION).doc(token);

    const result = await firestore.runTransaction(async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef);
      if (!inviteSnap.exists) {
        throw new Error('Invite not found.');
      }

      const invite = inviteSnap.data() || {};
      if ((invite.inviteType || '') !== 'team-access') {
        throw new Error('Invite type is invalid for this route.');
      }
      if ((invite.status || '') !== 'active') {
        throw new Error('Invite is no longer active.');
      }
      const redemptionMode = normalizeInviteRedemptionMode(invite.redemptionMode);

      const targetEmail = normalizeEmail(invite.targetEmail);
      if (targetEmail && targetEmail !== userEmail) {
        throw new Error(`This invite is restricted to ${invite.targetEmail}.`);
      }

      const organizationId = normalizeString(invite.organizationId);
      const teamId = normalizeString(invite.teamId);
      const pilotId = normalizeString(invite.pilotId);
      const cohortId = normalizeString(invite.cohortId);
      const teamMembershipRole = normalizeString(invite.teamMembershipRole) as PulseCheckTeamMembershipRole;
      const invitedTitle = normalizeString(invite.invitedTitle);
      if (!organizationId || !teamId || !teamMembershipRole) {
        throw new Error('Invite is missing organization, team, or role context.');
      }

      const organizationRef = firestore.collection(ORGANIZATIONS_COLLECTION).doc(organizationId);
      const teamRef = firestore.collection(TEAMS_COLLECTION).doc(teamId);
      const userRef = firestore.collection('users').doc(userId);
      const organizationMembershipRef = firestore
        .collection(ORGANIZATION_MEMBERSHIPS_COLLECTION)
        .doc(`${organizationId}_${userId}`);
      const teamMembershipRef = firestore.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(`${teamId}_${userId}`);
      const pilotRef = pilotId ? firestore.collection(PILOTS_COLLECTION).doc(pilotId) : null;
      const pilotEnrollmentRef = pilotId
        ? firestore.collection(PILOT_ENROLLMENTS_COLLECTION).doc(buildPilotEnrollmentId(pilotId, userId))
        : null;

      const [organizationSnap, teamSnap] = await Promise.all([
        transaction.get(organizationRef),
        transaction.get(teamRef),
      ]);
      const userSnap = await transaction.get(userRef);
      const existingTeamMembershipSnap = await transaction.get(teamMembershipRef);
      const hadExistingTeamMembership = existingTeamMembershipSnap.exists;
      const pilotSnap = pilotRef ? await transaction.get(pilotRef) : null;
      const existingPilotEnrollmentSnap = pilotEnrollmentRef ? await transaction.get(pilotEnrollmentRef) : null;
      const hadExistingPilotEnrollment = Boolean(existingPilotEnrollmentSnap?.exists);

      if (!organizationSnap.exists) {
        throw new Error('Organization not found.');
      }
      if (!teamSnap.exists) {
        throw new Error('Team not found.');
      }
      if (pilotId && !pilotSnap?.exists) {
        throw new Error('Pilot not found.');
      }

      const organizationName = normalizeString(organizationSnap.data()?.displayName) || 'PulseCheck Organization';
      const teamName = normalizeString(teamSnap.data()?.displayName) || 'Team';
      const teamCommercialConfig = normalizeTeamCommercialConfig(teamSnap.data()?.commercialConfig);
      const nextTeamCommercialConfig =
        teamMembershipRole === 'team-admin'
          ? resolveTeamAdminCommercialConfig(teamCommercialConfig, userId)
          : teamCommercialConfig;
      const commercialSnapshot = buildTeamCommercialSnapshot({
        organizationId,
        teamId,
        inviteToken: token,
        commercialConfig: nextTeamCommercialConfig,
      });
      const existingTeamMembership = existingTeamMembershipSnap.exists ? existingTeamMembershipSnap.data() || {} : {};
      const existingPilotEnrollment = existingPilotEnrollmentSnap?.exists ? existingPilotEnrollmentSnap.data() || {} : {};
      const pilotStudyMode = pilotSnap?.data()?.studyMode as PulseCheckPilotStudyMode | undefined;
      const pilotRequiredConsents = normalizeRequiredConsentDocuments(pilotSnap?.data()?.requiredConsents || []);
      const nextAthleteOnboarding =
        teamMembershipRole === 'athlete'
          ? buildAthleteOnboardingFromInvite(
              invite,
              existingTeamMembership.athleteOnboarding || null,
              pilotStudyMode || null,
              pilotRequiredConsents
            )
          : null;
      const nextMembershipOnboardingStatus = resolveTeamMembershipOnboardingStatus({
        role: teamMembershipRole,
        athleteOnboarding: nextAthleteOnboarding,
        studyMode: pilotStudyMode || null,
      });
      const nextPilotEnrollmentStatus = resolvePilotEnrollmentStatus({
        athleteOnboarding: nextAthleteOnboarding,
        studyMode: pilotStudyMode || null,
      });

      if (teamMembershipRole === 'team-admin') {
        transaction.set(
          organizationMembershipRef,
          {
            organizationId,
            userId,
            email: userEmail,
            role: 'org-admin',
            status: 'active',
            grantedByInviteToken: token,
            grantedAt: now,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

        transaction.set(
          teamRef,
          {
            commercialConfig: nextTeamCommercialConfig,
            defaultAdminUserIds: admin.firestore.FieldValue.arrayUnion(userId),
            updatedAt: now,
          },
          { merge: true }
        );
      }

      transaction.set(
        teamMembershipRef,
        {
          organizationId,
          teamId,
          userId,
          email: userEmail,
          role: teamMembershipRole,
          title: invitedTitle || null,
          permissionSetId: permissionSetByRole[teamMembershipRole] || 'pulsecheck-team-member-v1',
          rosterVisibilityScope: teamMembershipRole === 'athlete' ? 'none' : 'team',
          allowedAthleteIds: [],
          athleteOnboarding: nextAthleteOnboarding,
          onboardingStatus: nextMembershipOnboardingStatus,
          commercialAccess: commercialSnapshot,
          grantedByInviteToken: token,
          grantedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      if (teamMembershipRole === 'athlete') {
        const existingUserData = userSnap.exists ? userSnap.data() || {} : {};
        const currentSubscriptionType = normalizeString(existingUserData.subscriptionType);
        const shouldGrantTeamPlanAccess =
          commercialSnapshot.teamPlanBypassesPaywall &&
          (!currentSubscriptionType ||
            currentSubscriptionType === SubscriptionType.unsubscribed ||
            currentSubscriptionType === SubscriptionType.teamPlan);

        transaction.set(
          userRef,
          {
            pulseCheckTeamCommercialAccess: commercialSnapshot,
            onboardInvite: {
              ...(existingUserData.onboardInvite || {}),
              source: 'pulsecheck-team-invite',
              token,
              organizationId,
              teamId,
              pilotId,
              cohortId,
              teamMembershipRole,
              capturedAt: Math.floor(Date.now() / 1000),
            },
            ...(shouldGrantTeamPlanAccess
              ? {
                  subscriptionType: SubscriptionType.teamPlan,
                  subscriptionPlatform: SubscriptionPlatform.Web,
                }
              : {}),
            updatedAt: new Date(),
          },
          { merge: true }
        );
      }

      if (teamMembershipRole === 'athlete' && pilotId && pilotEnrollmentRef && nextAthleteOnboarding) {
        transaction.set(
          pilotEnrollmentRef,
          {
            organizationId,
            teamId,
            pilotId,
            cohortId,
            userId,
            teamMembershipId: teamMembershipRef.id,
            studyMode: pilotStudyMode || 'operational',
            enrollmentMode: nextAthleteOnboarding.enrollmentMode === 'research' ? 'research' : 'pilot',
            status: nextPilotEnrollmentStatus,
            productConsentAccepted: Boolean(existingPilotEnrollment.productConsentAccepted),
            productConsentAcceptedAt: existingPilotEnrollment.productConsentAcceptedAt || null,
            productConsentVersion: normalizeString(existingPilotEnrollment.productConsentVersion),
            researchConsentStatus: nextAthleteOnboarding.researchConsentStatus || 'not-required',
            researchConsentVersion: normalizeString(existingPilotEnrollment.researchConsentVersion),
            researchConsentRespondedAt: existingPilotEnrollment.researchConsentRespondedAt || null,
            requiredConsentIds: pilotRequiredConsents.map((consent) => consent.id),
            completedConsentIds: Array.isArray(nextAthleteOnboarding.completedConsentIds) ? nextAthleteOnboarding.completedConsentIds : [],
            eligibleForResearchDataset:
              nextAthleteOnboarding.researchConsentStatus === 'accepted'
                ? true
                : Boolean(existingPilotEnrollment.eligibleForResearchDataset),
            grantedByInviteToken: token,
            createdAt: existingPilotEnrollment.createdAt || now,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      if (redemptionMode === 'general') {
        const grantedNewScopeAccess =
          !hadExistingTeamMembership ||
          (teamMembershipRole === 'athlete' && Boolean(pilotId) && !hadExistingPilotEnrollment);

        if (grantedNewScopeAccess) {
          transaction.set(
            inviteRef,
            {
              redeemedByUserId: userId,
              redeemedByEmail: userEmail,
              redeemedAt: now,
              redemptionCount: admin.firestore.FieldValue.increment(1),
              updatedAt: now,
            },
            { merge: true }
          );
        }
      } else {
        transaction.set(
          inviteRef,
          {
            status: 'redeemed',
            redeemedByUserId: userId,
            redeemedByEmail: userEmail,
            redeemedAt: now,
            redemptionCount: 1,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      return {
        organizationId,
        organizationName,
        teamId,
        teamName,
        pilotId,
        cohortId,
        teamMembershipId: teamMembershipRef.id,
        teamMembershipRole,
        invitedTitle,
        commercialSnapshot,
        teamPlanBypassesPaywall: commercialSnapshot.teamPlanBypassesPaywall,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to redeem invite.';
    const statusCode =
      message === 'Invite not found.'
        ? 404
        : message === 'Invite is no longer active.' || message === 'Invite type is invalid for this route.'
          ? 409
          : message.startsWith('This invite is restricted to')
            ? 403
            : 400;

    console.error('[pulsecheck-team-invite/redeem] Failed to redeem invite:', error);
    return res.status(statusCode).json({ error: message });
  }
}
