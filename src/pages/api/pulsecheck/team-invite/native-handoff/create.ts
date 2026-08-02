import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import {
  generateNativeAthleteInviteHandoffCode,
  hashNativeAthleteInviteHandoffCode,
  nativeAthleteInviteHandoffErrorResponse,
  NATIVE_ATHLETE_INVITE_HANDOFFS_COLLECTION,
  NATIVE_ATHLETE_INVITE_HANDOFF_TTL_SECONDS,
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

  const authHeader = normalizeNativeHandoffString(req.headers.authorization);
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authenticated athlete session required.' });
  }

  const inviteToken = normalizeNativeHandoffString(req.body?.inviteToken);
  if (!inviteToken) {
    return res.status(400).json({ error: 'Invite token is required.' });
  }

  const forceDevFirebase = forceDevelopmentFirebase(req);
  try {
    const adminApp = getFirebaseAdminApp(forceDevFirebase);
    const auth = admin.auth(adminApp);
    const decoded = await auth.verifyIdToken(
      authHeader.slice('Bearer '.length).trim()
    );
    const firestore = admin.firestore(adminApp);
    const handoffCode = generateNativeAthleteInviteHandoffCode();
    const handoffId = hashNativeAthleteInviteHandoffCode(handoffCode);
    const nowMs = Date.now();
    const expiresAtMs =
      nowMs + NATIVE_ATHLETE_INVITE_HANDOFF_TTL_SECONDS * 1000;
    const inviteRef = firestore.collection(INVITE_LINKS_COLLECTION).doc(inviteToken);
    const handoffRef = firestore
      .collection(NATIVE_ATHLETE_INVITE_HANDOFFS_COLLECTION)
      .doc(handoffId);

    await firestore.runTransaction(async (transaction) => {
      const inviteSnapshot = await transaction.get(inviteRef);
      const binding = validateNativeAthleteInviteBinding(
        inviteSnapshot.exists ? inviteSnapshot.data() || {} : null,
        {
          uid: decoded.uid,
          email: decoded.email,
          emailVerified: decoded.email_verified,
        },
        Math.floor(nowMs / 1000)
      );

      transaction.set(handoffRef, {
        version: 1,
        status: 'active',
        inviteToken,
        userId: binding.uid,
        userEmail: binding.email,
        userEmailVerified: binding.emailVerified,
        organizationId: binding.organizationId,
        teamId: binding.teamId,
        firebaseMode: forceDevFirebase ? 'dev' : 'prod',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(expiresAtMs),
        expiresAtEpochSeconds: Math.floor(expiresAtMs / 1000),
        consumedAt: null,
      });
    });

    return res.status(201).json({
      handoffCode,
      expiresInSeconds: NATIVE_ATHLETE_INVITE_HANDOFF_TTL_SECONDS,
    });
  } catch (error) {
    const response = nativeAthleteInviteHandoffErrorResponse(error);
    if (response.statusCode >= 500) {
      console.error('[pulsecheck-native-athlete-handoff/create] Failed:', error);
    }
    return res.status(response.statusCode).json({ error: response.message });
  }
}
