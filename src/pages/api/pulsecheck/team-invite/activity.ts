import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../lib/firebase-admin';
import type {
  PulseCheckInviteActivityEmailSource,
  PulseCheckInviteActivityEventType,
  PulseCheckInviteLinkRedemptionMode,
  PulseCheckInviteLinkStatus,
} from '../../../../api/firebase/pulsecheckProvisioning/types';

const INVITE_LINKS_COLLECTION = 'pulsecheck-invite-links';
const INVITE_ACTIVITY_COLLECTION = 'pulsecheck-invite-activities';

const normalizeString = (value: unknown, maxLength = 500) =>
  (typeof value === 'string' ? value.trim() : '').slice(0, maxLength);
const normalizeEmail = (value: unknown) => normalizeString(value, 320).toLowerCase();
const normalizeInviteRedemptionMode = (value: unknown): PulseCheckInviteLinkRedemptionMode =>
  value === 'general' ? 'general' : 'single-use';
const resolveInviteLinkStatus = (status: unknown, redemptionMode: unknown): PulseCheckInviteLinkStatus => {
  const normalizedStatus = normalizeString(status, 32);
  if (normalizedStatus === 'revoked') {
    return 'revoked';
  }

  if (normalizedStatus === 'redeemed' && normalizeInviteRedemptionMode(redemptionMode) !== 'general') {
    return 'redeemed';
  }

  return 'active';
};
const normalizeEventType = (value: unknown): PulseCheckInviteActivityEventType => {
  switch (normalizeString(value, 64)) {
    case 'authenticated-view':
      return 'authenticated-view';
    case 'redeem-started':
      return 'redeem-started';
    case 'redeem-succeeded':
      return 'redeem-succeeded';
    case 'redeem-failed':
      return 'redeem-failed';
    case 'follow-up-requested':
      return 'follow-up-requested';
    case 'page-view':
    default:
      return 'page-view';
  }
};
const normalizeEmailSource = (value: unknown): PulseCheckInviteActivityEmailSource => {
  switch (normalizeString(value, 64)) {
    case 'authenticated-user':
      return 'authenticated-user';
    case 'manual-follow-up':
      return 'manual-follow-up';
    default:
      return 'unknown';
  }
};
const getClientIpHash = (req: NextApiRequest) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((entry) => entry.trim())
    .find(Boolean);
  if (!forwarded) return '';
  return crypto.createHash('sha256').update(forwarded).digest('hex').slice(0, 16);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const token = normalizeString(req.body?.token, 128);
  const eventType = normalizeEventType(req.body?.eventType);
  const sessionId = normalizeString(req.body?.sessionId, 128);
  const pageUrl = normalizeString(req.body?.pageUrl, 1000);
  const errorMessage = normalizeString(req.body?.errorMessage, 500);
  const forceDevFirebase = req.body?.forceDevFirebase === true;
  const manualEmail = normalizeEmail(req.body?.email);

  if (!token) {
    return res.status(400).json({ error: 'Invite token is required.' });
  }

  if (eventType === 'follow-up-requested' && !manualEmail) {
    return res.status(400).json({ error: 'Email is required for follow-up requests.' });
  }

  try {
    const adminApp = getFirebaseAdminApp(forceDevFirebase);
    const firestore = admin.firestore(adminApp);
    const authHeader = req.headers.authorization;
    let userId = '';
    let userEmail = '';

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await admin.auth(adminApp).verifyIdToken(authHeader.slice('Bearer '.length));
        userId = normalizeString(decoded.uid, 128);
        userEmail = normalizeEmail(decoded.email);
      } catch {
        userId = '';
        userEmail = '';
      }
    }

    const inviteSnap = await firestore.collection(INVITE_LINKS_COLLECTION).doc(token).get();
    if (!inviteSnap.exists) {
      return res.status(404).json({ error: 'Invite not found.' });
    }

    const invite = inviteSnap.data() || {};
    if ((invite.inviteType || '') !== 'team-access') {
      return res.status(400).json({ error: 'Invite type is invalid for this route.' });
    }

    const email = userEmail || manualEmail;
    const emailSource = normalizeEmailSource(
      userEmail ? 'authenticated-user' : manualEmail ? 'manual-follow-up' : 'unknown'
    );
    const needsFollowUp = eventType === 'redeem-failed' || eventType === 'follow-up-requested';

    await firestore.collection(INVITE_ACTIVITY_COLLECTION).add({
      token,
      inviteId: inviteSnap.id,
      eventType,
      organizationId: normalizeString(invite.organizationId, 128),
      teamId: normalizeString(invite.teamId, 128),
      pilotId: normalizeString(invite.pilotId, 128),
      cohortId: normalizeString(invite.cohortId, 128),
      inviteStatus: resolveInviteLinkStatus(invite.status, invite.redemptionMode),
      redemptionMode: normalizeInviteRedemptionMode(invite.redemptionMode),
      teamMembershipRole: normalizeString(invite.teamMembershipRole, 64),
      sessionId,
      userId,
      email,
      emailSource,
      source: 'browser',
      pageUrl,
      userAgent: normalizeString(req.headers['user-agent'], 500),
      ipHash: getClientIpHash(req),
      errorMessage,
      needsFollowUp,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[pulsecheck-team-invite-activity] Failed to record invite activity:', error);
    return res.status(500).json({ error: 'Failed to record invite activity.' });
  }
}
