import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import {
  hashNativeAthleteInviteHandoffCode,
  nativeAthleteInviteHandoffErrorResponse,
  NativeAthleteInviteHandoffError,
  NATIVE_ATHLETE_INVITE_HANDOFFS_COLLECTION,
  normalizeNativeHandoffString,
  validateNativeAthleteInviteBinding,
} from '../../../../../lib/server/pulsecheck/native-athlete-invite-handoff';

const INVITE_LINKS_COLLECTION = 'pulsecheck-invite-links';

const forceDevelopmentFirebase = (req: NextApiRequest) =>
  req.body?.forceDevFirebase === true ||
  normalizeNativeHandoffString(req.headers['x-pulsecheck-firebase-mode']).toLowerCase() ===
    'dev';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const inviteToken = normalizeNativeHandoffString(req.body?.inviteToken);
  const handoffCode = normalizeNativeHandoffString(req.body?.handoffCode);
  if (!inviteToken || !handoffCode) {
    return res
      .status(400)
      .json({ error: 'Invite token and secure handoff code are required.' });
  }

  const forceDevFirebase = forceDevelopmentFirebase(req);
  try {
    const adminApp = getFirebaseAdminApp(forceDevFirebase);
    const firestore = admin.firestore(adminApp);
    const handoffId = hashNativeAthleteInviteHandoffCode(handoffCode);
    const handoffRef = firestore
      .collection(NATIVE_ATHLETE_INVITE_HANDOFFS_COLLECTION)
      .doc(handoffId);
    const inviteRef = firestore.collection(INVITE_LINKS_COLLECTION).doc(inviteToken);
    const nowEpochSeconds = Math.floor(Date.now() / 1000);

    const userId = await firestore.runTransaction(async (transaction) => {
      const handoffSnapshot = await transaction.get(handoffRef);
      if (!handoffSnapshot.exists) {
        throw new NativeAthleteInviteHandoffError(
          'Secure app handoff is invalid or has expired.',
          410
        );
      }

      const handoff = handoffSnapshot.data() || {};
      if (
        normalizeNativeHandoffString(handoff.status) !== 'active' ||
        handoff.consumedAt != null ||
        Number(handoff.expiresAtEpochSeconds || 0) <= nowEpochSeconds
      ) {
        throw new NativeAthleteInviteHandoffError(
          'Secure app handoff is invalid or has expired.',
          410
        );
      }
      if (
        normalizeNativeHandoffString(handoff.inviteToken) !== inviteToken ||
        normalizeNativeHandoffString(handoff.firebaseMode) !==
          (forceDevFirebase ? 'dev' : 'prod')
      ) {
        throw new NativeAthleteInviteHandoffError(
          'Secure app handoff does not match this invite.',
          403
        );
      }

      const inviteSnapshot = await transaction.get(inviteRef);
      const binding = validateNativeAthleteInviteBinding(
        inviteSnapshot.exists ? inviteSnapshot.data() || {} : null,
        {
          uid: handoff.userId,
          email: handoff.userEmail,
          emailVerified: handoff.userEmailVerified,
        },
        nowEpochSeconds
      );
      if (
        binding.organizationId !==
          normalizeNativeHandoffString(handoff.organizationId) ||
        binding.teamId !== normalizeNativeHandoffString(handoff.teamId)
      ) {
        throw new NativeAthleteInviteHandoffError(
          'Secure app handoff no longer matches this team.',
          403
        );
      }

      transaction.update(handoffRef, {
        status: 'consumed',
        consumedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return binding.uid;
    });

    // The token only establishes the already-verified Firebase identity. It
    // carries no entitlement or membership claim; checkout and invite
    // redemption remain separate server-authorized steps.
    const customToken = await admin.auth(adminApp).createCustomToken(userId);
    return res.status(200).json({ customToken });
  } catch (error) {
    const response = nativeAthleteInviteHandoffErrorResponse(error);
    if (response.statusCode >= 500) {
      console.error('[pulsecheck-native-athlete-handoff/consume] Failed:', error);
    }
    return res.status(response.statusCode).json({ error: response.message });
  }
}
