import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { convertFirestoreTimestamp } from '../../../utils/formatDate';

export interface SubscriptionDoc {
  id: string;
  userId: string;
  platform?: string;
  // New append-only plans array (authoritative)
  plans?: Array<{
    type: string; // e.g., pulsecheck-weekly | pulsecheck-monthly | pulsecheck-annual | legacy types
    expiration: number; // seconds since epoch
    createdAt?: number; // seconds since epoch
    updatedAt?: number; // seconds since epoch
    platform?: 'web' | 'ios';
    productId?: string;
  }>;
  // Legacy fields kept for backward compatibility in reads (will be ignored if plans exist)
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
  // Prefer new plans array
  if (Array.isArray(docData.plans) && docData.plans.length > 0) {
    const latestPlan = docData.plans.reduce<null | { exp: number }>((acc, p) => {
      const expSec = typeof p.expiration === 'number' ? p.expiration : NaN;
      if (!expSec || isNaN(expSec)) return acc;
      if (!acc || expSec > acc.exp) return { exp: expSec };
      return acc;
    }, null);
    if (latestPlan && latestPlan.exp) {
      return new Date(latestPlan.exp * 1000);
    }
    // fallthrough to legacy if no valid expiration found
  }

  // Legacy fallback (to be phased out): expirationHistory/trialEndDate
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

// Compute latest expiration limited to PulseCheck plans only (types prefixed with 'pulsecheck-')
function getPulseCheckExpirationFromDoc(docData: SubscriptionDoc): Date | null {
  if (Array.isArray(docData.plans) && docData.plans.length > 0) {
    const latest = docData.plans.reduce<null | { exp: number }>((acc, p) => {
      if (!p || typeof p.expiration !== 'number') return acc;
      const t = (p.type || '').toLowerCase();
      if (!t.startsWith('pulsecheck-')) return acc;
      const expSec = p.expiration;
      if (!acc || expSec > acc.exp) return { exp: expSec };
      return acc;
    }, null);
    if (latest && latest.exp) return new Date(latest.exp * 1000);
  }
  return null;
}

async function fetchUserSubscriptions(userId: string): Promise<SubscriptionDoc[]> {
  console.log('[subscriptionService] fetchUserSubscriptions start', { userId });
  const subsRef = collection(db, 'subscriptions');
  const q = query(subsRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const subs = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  console.log('[subscriptionService] fetchUserSubscriptions result', { count: subs.length, ids: subs.map(s => s.id) });
  return subs;
}

async function computeStatusFromSubscriptions(userId: string): Promise<SubscriptionStatusResult> {
  console.log('[subscriptionService] computeStatusFromSubscriptions start', { userId });
  const subs = await fetchUserSubscriptions(userId);
  let latest: { exp: Date; id: string } | null = null;

  for (const sub of subs) {
    const exp = getLatestExpirationFromDoc(sub);
    console.log('[subscriptionService] candidate expiration', { docId: sub.id, exp: exp?.toISOString() });
    if (!exp || isNaN(exp.valueOf())) continue;
    if (!latest || exp > latest.exp) {
      latest = { exp, id: sub.id };
    }
  }

  const now = new Date();
  if (!latest) {
    console.log('[subscriptionService] computeStatusFromSubscriptions no expiration (no plans)');
    return { isActive: false, latestExpiration: null };
  }

  const result = {
    isActive: latest.exp > now,
    latestExpiration: latest.exp,
    sourceDocId: latest.id,
  };
  console.log('[subscriptionService] computeStatusFromSubscriptions result', { ...result, latestISO: latest.exp.toISOString() });
  return result;
}

// PulseCheck-only status (ignores Pulse plans)
async function computePulseCheckStatus(userId: string): Promise<SubscriptionStatusResult> {
  console.log('[subscriptionService] computePulseCheckStatus start', { userId });
  const subs = await fetchUserSubscriptions(userId);
  let latest: { exp: Date; id: string } | null = null;
  for (const sub of subs) {
    const exp = getPulseCheckExpirationFromDoc(sub);
    console.log('[subscriptionService] pulsecheck candidate expiration', { docId: sub.id, exp: exp?.toISOString() });
    if (!exp || isNaN(exp.valueOf())) continue;
    if (!latest || exp > latest.exp) latest = { exp, id: sub.id };
  }
  const now = new Date();
  if (!latest) {
    console.log('[subscriptionService] computePulseCheckStatus no PC plan found');
    return { isActive: false, latestExpiration: null };
  }
  const result = { isActive: latest.exp > now, latestExpiration: latest.exp, sourceDocId: latest.id };
  console.log('[subscriptionService] computePulseCheckStatus result', { ...result, latestISO: latest.exp.toISOString() });
  return result;
}

async function syncWithRevenueCat(userId: string): Promise<void> {
  try {
    console.log('[subscriptionService] syncWithRevenueCat POST', { userId, userIdType: typeof userId, userIdLength: userId?.length });
    const res = await fetch('/.netlify/functions/sync-revenuecat-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const text = await res.text().catch(() => '');
    console.log('[subscriptionService] syncWithRevenueCat response', { status: res.status, text });
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
    console.log('[subscriptionService] syncWithStripe POST', { userId, hasCustomerId: !!stripeCustomerId });
    const res = await fetch('/.netlify/functions/sync-stripe-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, stripeCustomerId }),
    });
    const text = await res.text().catch(() => '');
    console.log('[subscriptionService] syncWithStripe response', { status: res.status, text });
    if (!res.ok) return;
  } catch (_) {}
}

export const subscriptionService = {
  getStatus: computeStatusFromSubscriptions,
  getPulseCheckStatus: computePulseCheckStatus,
  ensureActiveOrSync: async (userId: string): Promise<SubscriptionStatusResult> => {
    console.log('[subscriptionService] ensureActiveOrSync start', { userId });
    const status = await computeStatusFromSubscriptions(userId);
    // If we already have plans with active expiration, return
    if (status.isActive) return status;
    // Otherwise, attempt to rebuild plans from providers and recompute
    await Promise.all([
      syncWithRevenueCat(userId),
      syncWithStripe(userId),
    ]);
    const after = await computeStatusFromSubscriptions(userId);
    console.log('[subscriptionService] ensureActiveOrSync after sync', { isActive: after.isActive, latest: after.latestExpiration?.toISOString() });
    return after;
  },
  ensureActiveOrSyncPulseCheck: async (userId: string): Promise<SubscriptionStatusResult> => {
    console.log('[subscriptionService] ensureActiveOrSyncPulseCheck start', { userId });
    const status = await computePulseCheckStatus(userId);
    if (status.isActive) return status;
    await Promise.all([
      syncWithRevenueCat(userId),
      syncWithStripe(userId),
    ]);
    const after = await computePulseCheckStatus(userId);
    console.log('[subscriptionService] ensureActiveOrSyncPulseCheck after sync', { isActive: after.isActive, latest: after.latestExpiration?.toISOString() });
    return after;
  }
};

export default subscriptionService;


