import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { convertFirestoreTimestamp } from '../../../utils/formatDate';

export interface SubscriptionDoc {
  id: string;
  userId: string;
  platform?: string;
  status?: string;
  isTrialing?: boolean;
  trialEndDate?: any;
  expirationHistory?: any[];
  updatedAt?: any;
}

export interface SubscriptionStatusResult {
  isActive: boolean;
  latestExpiration: Date | null;
  sourceDocId?: string;
}

function getLatestExpirationFromDoc(docData: SubscriptionDoc): Date | null {
  const expirations: Date[] = [];

  if (Array.isArray(docData.expirationHistory)) {
    for (const item of docData.expirationHistory) {
      expirations.push(convertFirestoreTimestamp(item));
    }
  }

  if (docData.trialEndDate) {
    expirations.push(convertFirestoreTimestamp(docData.trialEndDate));
  }

  if (expirations.length === 0) return null;

  return expirations.reduce((max, cur) => (cur > max ? cur : max));
}

async function fetchUserSubscriptions(userId: string): Promise<SubscriptionDoc[]> {
  const subsRef = collection(db, 'subscriptions');
  const q = query(subsRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

async function computeStatusFromSubscriptions(userId: string): Promise<SubscriptionStatusResult> {
  const subs = await fetchUserSubscriptions(userId);
  let latest: { exp: Date; id: string } | null = null;

  for (const sub of subs) {
    const exp = getLatestExpirationFromDoc(sub);
    if (!exp || isNaN(exp.valueOf())) continue;
    if (!latest || exp > latest.exp) {
      latest = { exp, id: sub.id };
    }
  }

  const now = new Date();
  if (!latest) return { isActive: false, latestExpiration: null };

  return {
    isActive: latest.exp > now,
    latestExpiration: latest.exp,
    sourceDocId: latest.id,
  };
}

async function syncWithRevenueCat(userId: string): Promise<void> {
  try {
    const res = await fetch('/.netlify/functions/sync-revenuecat-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      // Swallow errors to avoid blocking UX; server will log details
      return;
    }
  } catch (_) {
    // Network errors ignored deliberately
  }
}

async function syncWithStripe(userId: string, stripeCustomerId?: string | null): Promise<void> {
  try {
    const res = await fetch('/.netlify/functions/sync-stripe-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, stripeCustomerId }),
    });
    if (!res.ok) return;
  } catch (_) {}
}

export const subscriptionService = {
  getStatus: computeStatusFromSubscriptions,
  ensureActiveOrSync: async (userId: string): Promise<SubscriptionStatusResult> => {
    const status = await computeStatusFromSubscriptions(userId);
    if (status.isActive) return status;
    // Run RC and Stripe sync in parallel; then recompute
    await Promise.all([
      syncWithRevenueCat(userId),
      syncWithStripe(userId),
    ]);
    return await computeStatusFromSubscriptions(userId);
  },
};

export default subscriptionService;


