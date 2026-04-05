import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../lib/firebase-admin';
import {
  getDefaultPulseCheckTeamCommercialConfig,
  type PulseCheckTeamCommercialConfig,
} from '../../../../api/firebase/pulsecheckProvisioning/types';

const INVITE_LINKS_COLLECTION = 'pulsecheck-invite-links';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value: unknown) => normalizeString(value).toLowerCase();
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

const buildClaimedHandoffMetadata = (current: Record<string, unknown> | undefined, userId: string, userEmail: string, token: string) => ({
  ...(current || {}),
  state: 'claimed',
  claimedByUserId: normalizeString(userId),
  claimedByEmail: normalizeEmail(userEmail),
  claimedByInviteToken: normalizeString(token),
  claimedAt: admin.firestore.FieldValue.serverTimestamp(),
});

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
  if (!token) {
    return res.status(400).json({ error: 'Invite token is required.' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const userId = decoded.uid;
    const userEmail = normalizeEmail(decoded.email);
    if (!userEmail) {
      return res.status(400).json({ error: 'Authenticated user must have an email address.' });
    }

    const firestore = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const inviteRef = firestore.collection(INVITE_LINKS_COLLECTION).doc(token);

    const result = await firestore.runTransaction(async (transaction) => {
      const inviteSnap = await transaction.get(inviteRef);
      if (!inviteSnap.exists) {
        throw new Error('Invite not found.');
      }

      const invite = inviteSnap.data() || {};
      if ((invite.inviteType || '') !== 'admin-activation') {
        throw new Error('Invite type is invalid for this route.');
      }
      if ((invite.status || '') !== 'active') {
        throw new Error('Invite is no longer active.');
      }

      const targetEmail = normalizeEmail(invite.targetEmail);
      if (targetEmail && targetEmail !== userEmail) {
        throw new Error(`This invite is restricted to ${invite.targetEmail}.`);
      }

      const organizationId = normalizeString(invite.organizationId);
      const teamId = normalizeString(invite.teamId);
      if (!organizationId || !teamId) {
        throw new Error('Invite is missing organization or team context.');
      }

      const organizationRef = firestore.collection(ORGANIZATIONS_COLLECTION).doc(organizationId);
      const teamRef = firestore.collection(TEAMS_COLLECTION).doc(teamId);
      const organizationMembershipQuery = firestore
        .collection(ORGANIZATION_MEMBERSHIPS_COLLECTION)
        .where('organizationId', '==', organizationId)
        .where('role', '==', 'org-admin')
        .where('handoffMetadata.state', '==', 'reserved-pending-activation')
        .limit(1);
      const teamMembershipQuery = firestore
        .collection(TEAM_MEMBERSHIPS_COLLECTION)
        .where('organizationId', '==', organizationId)
        .where('teamId', '==', teamId)
        .where('role', '==', 'team-admin')
        .where('handoffMetadata.state', '==', 'reserved-pending-activation')
        .limit(1);

      const [organizationSnap, teamSnap, reservedOrganizationMembershipQuerySnap, reservedTeamMembershipQuerySnap] = await Promise.all([
        transaction.get(organizationRef),
        transaction.get(teamRef),
        transaction.get(organizationMembershipQuery),
        transaction.get(teamMembershipQuery),
      ]);

      if (!organizationSnap.exists) {
        throw new Error('Organization not found.');
      }
      if (!teamSnap.exists) {
        throw new Error('Team not found.');
      }

      const organizationName = normalizeString(organizationSnap.data()?.displayName) || 'PulseCheck Organization';
      const teamName = normalizeString(teamSnap.data()?.displayName) || 'Initial Team';
      const teamCommercialConfig = normalizeTeamCommercialConfig(teamSnap.data()?.commercialConfig);
      const nextTeamCommercialConfig = resolveTeamAdminCommercialConfig(teamCommercialConfig, userId);

      const reservedOrganizationMembershipDoc = reservedOrganizationMembershipQuerySnap.docs[0] || null;
      const reservedTeamMembershipDoc = reservedTeamMembershipQuerySnap.docs[0] || null;
      const organizationMembershipRef = reservedOrganizationMembershipDoc
        ? reservedOrganizationMembershipDoc.ref
        : firestore.collection(ORGANIZATION_MEMBERSHIPS_COLLECTION).doc(`${organizationId}_${userId}`);
      const teamMembershipRef = reservedTeamMembershipDoc
        ? reservedTeamMembershipDoc.ref
        : firestore.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(`${teamId}_${userId}`);
      const reservedOrganizationMembership = (reservedOrganizationMembershipDoc?.data() || {}) as Record<string, any>;
      const reservedTeamMembership = (reservedTeamMembershipDoc?.data() || {}) as Record<string, any>;

      transaction.set(
        organizationMembershipRef,
        {
          organizationId,
          userId,
          email: userEmail,
          role: 'org-admin',
          status: 'active',
          grantedByInviteToken: token,
          grantedAt: reservedOrganizationMembership.grantedAt || now,
          handoffMetadata: buildClaimedHandoffMetadata(reservedOrganizationMembership.handoffMetadata, userId, userEmail, token),
          createdAt: reservedOrganizationMembership.createdAt || now,
          updatedAt: now,
        },
        { merge: true }
      );

      transaction.set(
        teamMembershipRef,
        {
          organizationId,
          teamId,
          userId,
          email: userEmail,
          role: 'team-admin',
          title: 'Organization Admin',
          permissionSetId: 'pulsecheck-team-admin-v1',
          rosterVisibilityScope: 'team',
          allowedAthleteIds: Array.isArray(reservedTeamMembership.allowedAthleteIds) ? reservedTeamMembership.allowedAthleteIds : [],
          onboardingStatus: reservedTeamMembership.onboardingStatus || 'pending-profile',
          grantedByInviteToken: token,
          grantedAt: reservedTeamMembership.grantedAt || now,
          handoffMetadata: buildClaimedHandoffMetadata(reservedTeamMembership.handoffMetadata, userId, userEmail, token),
          createdAt: reservedTeamMembership.createdAt || now,
          updatedAt: now,
        },
        { merge: true }
      );

      transaction.set(
        organizationRef,
        {
          status: 'active',
          activatedByUserId: userId,
          activatedByEmail: userEmail,
          activatedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      transaction.set(
        teamRef,
        {
          status: 'active',
          activatedByUserId: userId,
          activatedByEmail: userEmail,
          activatedAt: now,
          commercialConfig: nextTeamCommercialConfig,
          defaultAdminUserIds: admin.firestore.FieldValue.arrayUnion(userId),
          updatedAt: now,
        },
        { merge: true }
      );

      transaction.set(
        inviteRef,
        {
          status: 'redeemed',
          redeemedByUserId: userId,
          redeemedByEmail: userEmail,
          redeemedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      return {
        organizationId,
        organizationName,
        teamId,
        teamName,
        organizationMembershipId: organizationMembershipRef.id,
        teamMembershipId: teamMembershipRef.id,
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

    console.error('[pulsecheck-admin-activation/redeem] Failed to redeem invite:', error);
    return res.status(statusCode).json({ error: message });
  }
}
