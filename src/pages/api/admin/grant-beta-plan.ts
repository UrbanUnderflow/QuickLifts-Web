import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../lib/firebase-admin';
import { requireAdminRequest } from './_auth';

type GrantBetaPlanRequest = {
  id?: string;
  email?: string;
  displayName?: string;
  username?: string;
  subscriptionType?: string;
};

const BETA_ROOT_SUBSCRIPTION_VALUE = 'beta';

function shouldUseDevAdminApp(req: NextApiRequest): boolean {
  const host = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host || '';
  return host.includes('localhost')
    || host.includes('127.0.0.1')
    || req.headers['x-force-dev-firebase'] === 'true'
    || req.headers['x-force-dev-firebase'] === '1';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const body = (req.body || {}) as GrantBetaPlanRequest;
  const userId = typeof body.id === 'string' ? body.id.trim() : '';
  const normalizedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!userId || !normalizedEmail) {
    return res.status(400).json({ success: false, error: 'Missing user id or email' });
  }

  try {
    const adminApp = getFirebaseAdminApp(shouldUseDevAdminApp(req));
    const db = admin.firestore(adminApp);
    const now = new Date();
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 3);
    const expirationSeconds = Math.floor(expiresAt.getTime() / 1000);
    const username = typeof body.username === 'string' && body.username.trim() ? body.username.trim() : null;
    const displayName = typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : '';
    const name = displayName || username || normalizedEmail;
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    const previousSubscriptionType = userSnap.exists
      ? String(userSnap.data()?.subscriptionType || '')
      : String(body.subscriptionType || '');

    const batch = db.batch();

    batch.set(db.collection('beta').doc(normalizedEmail), {
      email: normalizedEmail,
      name,
      username: username || '',
      userId,
      isApproved: true,
      applyForFoundingCoaches: false,
      role: {
        trainer: false,
        enthusiast: true,
        coach: false,
        fitnessInstructor: false,
      },
      useCases: {
        oneOnOneCoaching: false,
        communityRounds: true,
        personalPrograms: true,
      },
      primaryUse: 'Admin beta plan grant',
      longTermGoal: 'Granted direct beta access by admin',
      clientCount: 'Not specified',
      yearsExperience: 'Not specified',
      isCertified: false,
      betaPlanGrant: {
        grantedBy: adminUser.email,
        grantedAt: nowSeconds,
        expiresAt: expirationSeconds,
        source: 'admin-users',
        previousSubscriptionType: previousSubscriptionType || null,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    batch.set(userRef, {
      subscriptionType: BETA_ROOT_SUBSCRIPTION_VALUE,
      subscriptionPlatform: 'web',
      isTrialing: false,
      betaPlanGrantedAt: nowSeconds,
      betaPlanGrantedBy: adminUser.email,
      betaPlanPreviousSubscriptionType: previousSubscriptionType || null,
      updatedAt: nowSeconds,
    }, { merge: true });

    batch.set(db.collection('subscriptions').doc(userId), {
      userId,
      userEmail: normalizedEmail,
      username,
      platform: 'web',
      subscriptionType: BETA_ROOT_SUBSCRIPTION_VALUE,
      status: 'active',
      updatedAt: nowSeconds,
      createdAt: nowSeconds,
      betaPlanGrant: {
        grantedBy: adminUser.email,
        grantedAt: nowSeconds,
        expiresAt: expirationSeconds,
        source: 'admin-users',
        previousSubscriptionType: previousSubscriptionType || null,
      },
      plans: admin.firestore.FieldValue.arrayUnion({
        type: 'pulsecheck-annual',
        expiration: expirationSeconds,
        createdAt: nowSeconds,
        updatedAt: nowSeconds,
        platform: 'web',
        productId: 'beta_grant_pc_1y',
        source: 'admin-users',
        grantedBy: adminUser.email,
      }),
    }, { merge: true });

    await batch.commit();

    return res.status(200).json({
      success: true,
      userId,
      email: normalizedEmail,
      rootSubscriptionType: BETA_ROOT_SUBSCRIPTION_VALUE,
      expiration: expirationSeconds,
    });
  } catch (error) {
    console.error('[grant-beta-plan] Failed to grant beta plan:', error);
    const message = error instanceof Error ? error.message : 'Failed to grant beta plan';
    return res.status(500).json({ success: false, error: message });
  }
}
