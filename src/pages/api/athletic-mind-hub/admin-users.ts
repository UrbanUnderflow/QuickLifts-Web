import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../lib/firebase-admin';
import { renderAthleticMindHubInviteEmail } from '../../../lib/emails/athleticMindHubInviteEmail';
import { buildEmailDedupeKey, sendBrevoTransactionalEmail } from '../../../../netlify/functions/utils/emailSequenceHelpers';

const USERS_COLLECTION = 'users';
const MEMBERS_COLLECTION = 'athletic-mind-hub-members';
const INVITES_COLLECTION = 'athletic-mind-hub-invites';
const CHANGES_COLLECTION = 'athletic-mind-hub-change-log';
const ATHLETIC_MIND_HUB_FOUNDER_EMAIL = 'tre@fitwithpulse.ai';

type HubPermission = 'readOnly' | 'wikiEditor' | 'admin';

const permissionLabels: Record<HubPermission, string> = {
  readOnly: 'Read only',
  wikiEditor: 'Read + update wiki',
  admin: 'Admin',
};

const validPermissions = new Set<HubPermission>(['readOnly', 'wikiEditor', 'admin']);

type HubAdminContext = {
  app: admin.app.App;
  uid: string;
  email: string;
  name: string;
};

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function shouldUseDevFirebase(req: NextApiRequest) {
  const firebaseMode = headerValue(req.headers['x-pulsecheck-firebase-mode']);
  const pulsecheckDevFirebase = headerValue(req.headers['x-pulsecheck-dev-firebase']);
  return (
    firebaseMode === 'dev' ||
    pulsecheckDevFirebase === 'true' ||
    pulsecheckDevFirebase === '1' ||
    req.headers['x-force-dev-firebase'] === 'true' ||
    req.headers['x-force-dev-firebase'] === '1'
  );
}

function normalizeEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function resolveRequestOrigin(req: NextApiRequest) {
  const origin = headerValue(req.headers.origin);
  if (origin) return origin.replace(/\/$/, '');

  const host = headerValue(req.headers.host) || 'fitwithpulse.ai';
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

async function requireHubAdmin(req: NextApiRequest): Promise<HubAdminContext | null> {
  const authHeader = headerValue(req.headers.authorization);
  if (!authHeader?.startsWith('Bearer ')) return null;

  const idToken = authHeader.slice('Bearer '.length);
  const apps = shouldUseDevFirebase(req)
    ? [getFirebaseAdminApp(true), admin.app()]
    : [admin.app(), getFirebaseAdminApp(true)];

  for (const app of apps) {
    try {
      const decoded = await app.auth().verifyIdToken(idToken);
      const db = app.firestore();
      const uid = decoded.uid;
      const userSnap = await db.collection(USERS_COLLECTION).doc(uid).get();
      const userData = userSnap.exists ? userSnap.data() || {} : {};
      const email = normalizeEmail(decoded.email || userData.email);
      const name = String(userData.displayName || userData.username || decoded.name || email || 'Hub admin');

      if (!email) continue;
      if (email === ATHLETIC_MIND_HUB_FOUNDER_EMAIL) {
        return { app, uid, email, name };
      }

      const memberSnap = await db.collection(MEMBERS_COLLECTION).doc(uid).get();
      if (memberSnap.exists && memberSnap.data()?.permission === 'admin') {
        return { app, uid, email, name };
      }
    } catch {
      // Tokens can belong to the other configured Firebase app; keep trying.
    }
  }

  return null;
}

function mapUserSuggestion(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = snapshot.data() || {};
  return {
    userId: snapshot.id,
    email: String(data.email || ''),
    displayName: String(data.displayName || data.username || ''),
    username: String(data.username || ''),
    profileImageUrl: typeof data.profileImage?.profileImageURL === 'string' ? data.profileImage.profileImageURL : '',
  };
}

async function searchUsers(req: NextApiRequest, res: NextApiResponse, context: HubAdminContext) {
  const emailPrefix = normalizeEmail(req.query.emailPrefix);
  if (emailPrefix.length < 2) {
    return res.status(200).json({ users: [] });
  }

  const db = context.app.firestore();
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .orderBy('email')
    .startAt(emailPrefix)
    .endAt(`${emailPrefix}\uf8ff`)
    .limit(10)
    .get();

  return res.status(200).json({
    users: snapshot.docs
      .map(mapUserSuggestion)
      .filter((user) => user.email.toLowerCase().startsWith(emailPrefix)),
  });
}

async function logChange(
  db: FirebaseFirestore.Firestore,
  context: HubAdminContext,
  action: 'created' | 'updated',
  targetType: 'member' | 'invite',
  targetId: string,
  targetTitle: string,
) {
  await db.collection(CHANGES_COLLECTION).add({
    action,
    targetType,
    targetId,
    targetTitle,
    authorUid: context.uid,
    authorName: context.name,
    authorEmail: context.email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function grantExistingUser(req: NextApiRequest, res: NextApiResponse, context: HubAdminContext) {
  const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  const permission = req.body?.permission as HubPermission;

  if (!userId || !validPermissions.has(permission)) {
    return res.status(400).json({ error: 'A valid user and permission are required.' });
  }

  const db = context.app.firestore();
  const userSnap = await db.collection(USERS_COLLECTION).doc(userId).get();
  if (!userSnap.exists) {
    return res.status(404).json({ error: 'Pulse account not found.' });
  }

  const userData = userSnap.data() || {};
  const email = normalizeEmail(userData.email);
  if (!email) {
    return res.status(400).json({ error: 'That account is missing an email address.' });
  }

  const memberRef = db.collection(MEMBERS_COLLECTION).doc(userId);
  const existingMember = await memberRef.get();
  const displayName = String(userData.displayName || userData.username || email);

  await memberRef.set(
    {
      userId,
      email,
      displayName,
      permission,
      createdByUid: existingMember.exists ? existingMember.data()?.createdByUid || context.uid : context.uid,
      createdByName: existingMember.exists ? existingMember.data()?.createdByName || context.name : context.name,
      createdByEmail: existingMember.exists ? existingMember.data()?.createdByEmail || context.email : context.email,
      updatedByUid: context.uid,
      updatedByName: context.name,
      updatedByEmail: context.email,
      createdAt: existingMember.exists
        ? existingMember.data()?.createdAt || admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await logChange(db, context, existingMember.exists ? 'updated' : 'created', 'member', userId, `${displayName} access set to ${permission}`);

  return res.status(200).json({
    success: true,
    member: {
      id: userId,
      userId,
      email,
      displayName,
      permission,
    },
    hubLink: `${resolveRequestOrigin(req)}/athletic-mind-hub?signin=1`,
  });
}

async function inviteEmail(req: NextApiRequest, res: NextApiResponse, context: HubAdminContext) {
  const email = normalizeEmail(req.body?.email);
  const recipientName = typeof req.body?.recipientName === 'string' ? req.body.recipientName.trim() : '';
  const permission = req.body?.permission as HubPermission;

  if (!email || !email.includes('@') || !validPermissions.has(permission)) {
    return res.status(400).json({ error: 'A valid email and permission are required.' });
  }

  const db = context.app.firestore();
  const existingUserSnap = await db
    .collection(USERS_COLLECTION)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!existingUserSnap.empty) {
    return res.status(409).json({
      error: 'This person already has a Pulse account. Select them from suggestions to grant access directly.',
      user: mapUserSuggestion(existingUserSnap.docs[0]),
    });
  }

  const inviteRef = db.collection(INVITES_COLLECTION).doc();
  const origin = resolveRequestOrigin(req);
  const inviteLink = `${origin}/athletic-mind-hub?invite=${encodeURIComponent(inviteRef.id)}&signup=1&email=${encodeURIComponent(email)}`;

  await inviteRef.set({
    token: inviteRef.id,
    permission,
    status: 'active',
    inviteeEmail: email,
    inviteeName: recipientName,
    registrationEntryPoint: 'athletic_council',
    createdByUid: context.uid,
    createdByName: context.name,
    createdByEmail: context.email,
    updatedByUid: context.uid,
    updatedByName: context.name,
    updatedByEmail: context.email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const sendResult = await sendBrevoTransactionalEmail({
    toEmail: email,
    toName: recipientName || email,
    subject: 'You have been invited to Athletic Mind Hub',
    htmlContent: renderAthleticMindHubInviteEmail({
      activationUrl: inviteLink,
      permissionLabel: permissionLabels[permission],
      recipientName,
      senderName: context.name,
    }),
    sender: {
      email: process.env.BREVO_AUTOMATED_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL || 'hello@fitwithpulse.ai',
      name: 'Athletic Mind Council',
    },
    replyTo: {
      email: context.email,
      name: context.name,
    },
    tags: ['athletic-mind-hub', 'invite'],
    headers: {
      'X-Mailin-custom': JSON.stringify({
        product: 'athletic_mind_hub',
        emailSequenceId: 'athletic-mind-hub-invite-v1',
        inviteId: inviteRef.id,
      }),
    },
    idempotencyKey: buildEmailDedupeKey(['athletic-mind-hub-invite-v1', inviteRef.id, email]),
    idempotencyMetadata: {
      sequence: 'athletic-mind-hub-invite-v1',
      product: 'athletic_mind_hub',
      inviteId: inviteRef.id,
      recipientEmail: email,
      permission,
    },
    dailyRecipientMetadata: {
      sequence: 'athletic-mind-hub-invite-v1',
      product: 'athletic_mind_hub',
      inviteId: inviteRef.id,
    },
  });

  await inviteRef.set(
    {
      messageId: sendResult.messageId || null,
      emailSendSkipped: sendResult.skipped === true,
      emailSuppressed: sendResult.suppressed === true,
      emailError: sendResult.success ? null : sendResult.error || 'Brevo send failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await logChange(db, context, 'created', 'invite', inviteRef.id, `${email} invited as ${permission}`);

  if (!sendResult.success) {
    return res.status(502).json({
      error: sendResult.error || 'Invite was created, but the email could not be sent.',
      inviteLink,
    });
  }

  return res.status(200).json({
    success: true,
    invite: {
      id: inviteRef.id,
      token: inviteRef.id,
      permission,
      status: 'active',
      inviteeEmail: email,
      inviteeName: recipientName,
      messageId: sendResult.messageId || '',
    },
    inviteLink,
    emailSkipped: sendResult.skipped === true,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireHubAdmin(req);
  if (!context) {
    return res.status(401).json({ error: 'Athletic Mind Hub admin access is required.' });
  }

  try {
    if (req.method === 'GET') {
      return searchUsers(req, res, context);
    }

    if (req.method === 'POST') {
      const action = req.body?.action;
      if (action === 'grantExistingUser') {
        return grantExistingUser(req, res, context);
      }
      if (action === 'inviteEmail') {
        return inviteEmail(req, res, context);
      }
      return res.status(400).json({ error: 'Unsupported admin user action.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('[athletic-mind-hub/admin-users] Request failed', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Request failed.' });
  }
}
