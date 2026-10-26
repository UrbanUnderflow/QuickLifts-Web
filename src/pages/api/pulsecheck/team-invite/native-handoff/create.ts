import { phoneSession, assertOrganizationSignIn } from '../../../../../lib/pulsecheck/signInPolicy';
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
  validateNativeHandoffParents,
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
      authHeader.slice('Bearer '.length).trim(), true
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
      const inviteData = inviteSnapshot.exists ? inviteSnapshot.data() || {} : {};
      const [organizationSnapshot, profileSnapshot] = await Promise.all([
        transaction.get(firestore.collection('pulsecheck-organizations').doc(String(inviteData.organizationId || ''))),
        transaction.get(firestore.collection('users').doc(decoded.uid)),
      ]);
      const organization = organizationSnapshot.data() || {};
      const phoneAuthenticated = phoneSession(decoded);
      const referenceEmail = profileSnapshot.data()?.institutionalEmail || profileSnapshot.data()?.email;
      const email = phoneAuthenticated ? referenceEmail || decoded.email : decoded.email;
      assertOrganizationSignIn(organization, decoded, email);
      const binding = validateNativeAthleteInviteBinding(
        inviteSnapshot.exists ? inviteSnapshot.data() || {} : null,
        {
          uid: decoded.uid,
          email,
          emailVerified: decoded.email_verified,
          phoneVerified: phoneAuthenticated && organization.signInPolicy?.mode === 'institution-phone',
        },
        Math.floor(nowMs / 1000)
      );

      await validateNativeHandoffParents(firestore, transaction, binding);

      transaction.set(handoffRef, {
        version: 1,
        status: 'active',
        inviteToken,
        userId: binding.uid,
        userEmail: binding.email,
        userEmailVerified: binding.emailVerified,
        phoneAuthenticated,
        phoneReferenceAccepted: binding.phoneVerified,
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
    if ((error as { status?: number })?.status === 403) return res.status(403).json({ error: (error as Error).message });
    const response = nativeAthleteInviteHandoffErrorResponse(error);
    if (response.statusCode >= 500) {
      console.error('[pulsecheck-native-athlete-handoff/create] Failed:', error);
    }
    return res.status(response.statusCode).json({ error: response.message });
  }
}
