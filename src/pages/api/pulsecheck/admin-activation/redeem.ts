import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../lib/firebase-admin';

const INVITE_LINKS_COLLECTION = 'pulsecheck-invite-links';
const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value: unknown) => normalizeString(value).toLowerCase();

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
      const organizationMembershipRef = firestore
        .collection(ORGANIZATION_MEMBERSHIPS_COLLECTION)
        .doc(`${organizationId}_${userId}`);
      const teamMembershipRef = firestore.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(`${teamId}_${userId}`);

      const [organizationSnap, teamSnap] = await Promise.all([
        transaction.get(organizationRef),
        transaction.get(teamRef),
      ]);

      if (!organizationSnap.exists) {
        throw new Error('Organization not found.');
      }
      if (!teamSnap.exists) {
        throw new Error('Team not found.');
      }

      const organizationName = normalizeString(organizationSnap.data()?.displayName) || 'PulseCheck Organization';
      const teamName = normalizeString(teamSnap.data()?.displayName) || 'Initial Team';

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
        teamMembershipRef,
        {
          organizationId,
          teamId,
          userId,
          email: userEmail,
          role: 'team-admin',
          title: 'Organization Admin',
          permissionSetId: 'pulsecheck-team-admin-v1',
          onboardingStatus: 'complete',
          grantedByInviteToken: token,
          grantedAt: now,
          createdAt: now,
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
