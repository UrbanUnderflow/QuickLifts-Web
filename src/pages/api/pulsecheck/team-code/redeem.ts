import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../lib/firebase-admin';
import { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import { findTeamByCode, isTeamCodeShaped } from '../../../../api/firebase/pulsecheckProvisioning/teamCode';

const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

// A team code always grants access with no payment required, regardless of
// the team's commercialModel/price — a deliberate product decision (this is
// the manual fallback path, distinct from the paid checkout flow). Every
// write below is stamped with GRANTED_VIA so it stays distinguishable from a
// real paid subscription or genuine org-sponsored team-plan access in admin
// reporting, rather than silently blending in.
const GRANTED_VIA = 'team-code-manual-entry';
const SubscriptionType = {
  teamPlan: 'Team Plan Access',
};
const SubscriptionPlatform = {
  Web: 'Web',
};

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
  const rawCode = normalizeString(req.body?.teamCode);
  const forceDevFirebase = req.body?.forceDevFirebase === true;
  if (!rawCode || !isTeamCodeShaped(rawCode)) {
    return res.status(400).json({ error: 'Enter a valid team code.' });
  }
  const teamCode = rawCode.toUpperCase();

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

    const team = await findTeamByCode(firestore, teamCode);
    if (!team) {
      return res.status(404).json({ error: 'That team code was not found.' });
    }

    const teamId = team.id;
    const teamData = team.data;
    const organizationId = normalizeString(teamData.organizationId);
    const teamIsActive =
      normalizeString(teamData.status) === 'active'
      && teamData.archivedAt == null
      && teamData.deletedAt == null;
    if (!organizationId || !teamIsActive) {
      return res.status(409).json({ error: 'This team is not currently active.' });
    }

    const organizationSnap = await firestore.collection(ORGANIZATIONS_COLLECTION).doc(organizationId).get();
    const organizationData = organizationSnap.exists ? organizationSnap.data() || {} : {};
    const organizationIsActive =
      organizationSnap.exists
      && normalizeString(organizationData.status) === 'active'
      && organizationData.archivedAt == null
      && organizationData.deletedAt == null;
    if (!organizationIsActive) {
      return res.status(409).json({ error: 'This team\'s organization is not currently active.' });
    }

    const teamMembershipRef = firestore.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(`${teamId}_${userId}`);
    const userRef = firestore.collection('users').doc(userId);
    const teamName = normalizeString(teamData.displayName) || 'Team';
    const organizationName = normalizeString(organizationData.displayName) || 'PulseCheck Organization';

    const result = await firestore.runTransaction(async (transaction) => {
      const [membershipSnap, userSnap] = await Promise.all([
        transaction.get(teamMembershipRef),
        transaction.get(userRef),
      ]);

      const existingMembership = membershipSnap.exists ? membershipSnap.data() || {} : {};
      const alreadyActiveMember =
        membershipSnap.exists
        && normalizeString(existingMembership.status) === 'active'
        && existingMembership.revokedAt == null
        && existingMembership.archivedAt == null
        && existingMembership.deletedAt == null;

      if (!alreadyActiveMember) {
        transaction.set(
          teamMembershipRef,
          {
            organizationId,
            teamId,
            userId,
            email: userEmail,
            role: 'athlete',
            status: 'active',
            rosterVisibilityScope: 'none',
            allowedAthleteIds: [],
            grantedVia: GRANTED_VIA,
            grantedByTeamCode: teamCode,
            grantedAt: now,
            createdAt: existingMembership.createdAt || now,
            updatedAt: now,
          },
          { merge: true }
        );
      }

      const existingUserData = userSnap.exists ? userSnap.data() || {} : {};
      transaction.set(
        userRef,
        {
          subscriptionType: SubscriptionType.teamPlan,
          subscriptionPlatform: SubscriptionPlatform.Web,
          onboardInvite: {
            ...(existingUserData.onboardInvite || {}),
            source: 'pulsecheck-team-code',
            organizationId,
            teamId,
            grantedVia: GRANTED_VIA,
            capturedAt: Math.floor(Date.now() / 1000),
          },
          updatedAt: new Date(),
        },
        { merge: true }
      );

      return { alreadyMember: alreadyActiveMember };
    });

    return res.status(200).json({
      organizationId,
      organizationName,
      teamId,
      teamName,
      teamMembershipId: teamMembershipRef.id,
      teamMembershipRole: 'athlete',
      alreadyMember: result.alreadyMember,
    });
  } catch (error) {
    console.error('[pulsecheck-team-code/redeem] Failed to redeem team code:', error);
    return res.status(500).json({ error: 'Failed to join the team with that code.' });
  }
}
