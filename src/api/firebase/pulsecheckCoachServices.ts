import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
} from 'firebase/firestore';
import { db } from './config';

export type PulseCheckCoachServiceType = 'one_time' | 'subscription';
export type PulseCheckCoachServiceStatus = 'active' | 'inactive';

export type PulseCheckCoachService = {
  id: string;
  coachUserId: string;
  teamId: string;
  organizationId: string;
  title: string;
  description: string;
  serviceType: PulseCheckCoachServiceType;
  priceCents: number;
  currency: string;
  status: PulseCheckCoachServiceStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const PULSECHECK_COACH_SERVICES_COLLECTION = 'pulsecheck-coach-services';
export const PULSECHECK_SERVICE_PLATFORM_FEE_PERCENT = 3;
export const PULSECHECK_SERVICE_STRIPE_PERCENT = 2.9;
export const PULSECHECK_SERVICE_STRIPE_FIXED_CENTS = 30;

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeType = (value: unknown): PulseCheckCoachServiceType =>
  normalizeString(value) === 'subscription' ? 'subscription' : 'one_time';
const normalizeStatus = (value: unknown): PulseCheckCoachServiceStatus =>
  normalizeString(value) === 'inactive' ? 'inactive' : 'active';

export const calculatePulseCheckServiceFees = (coachPriceCents: number) => {
  const priceCents = Math.max(0, Math.round(Number(coachPriceCents) || 0));
  const platformFeeCents = Math.round(priceCents * (PULSECHECK_SERVICE_PLATFORM_FEE_PERCENT / 100));
  const grossedUpTotalCents = priceCents > 0
    ? Math.ceil(
        (priceCents + platformFeeCents + PULSECHECK_SERVICE_STRIPE_FIXED_CENTS)
        / (1 - PULSECHECK_SERVICE_STRIPE_PERCENT / 100)
      )
    : 0;
  const processingFeeCents = Math.max(0, grossedUpTotalCents - priceCents);
  const stripeFeeCents =
    grossedUpTotalCents > 0
      ? Math.round(grossedUpTotalCents * (PULSECHECK_SERVICE_STRIPE_PERCENT / 100))
        + PULSECHECK_SERVICE_STRIPE_FIXED_CENTS
      : 0;

  return {
    coachPriceCents: priceCents,
    platformFeeCents,
    stripeFeeCents,
    processingFeeCents,
    totalCents: priceCents + processingFeeCents,
  };
};

const mapDoc = (snapshot: { id: string; data: () => Record<string, unknown> }): PulseCheckCoachService => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    coachUserId: normalizeString(data.coachUserId),
    teamId: normalizeString(data.teamId),
    organizationId: normalizeString(data.organizationId),
    title: normalizeString(data.title) || 'Coach service',
    description: normalizeString(data.description),
    serviceType: normalizeType(data.serviceType),
    priceCents: Math.max(0, Math.round(Number(data.priceCents ?? data.amountCents) || 0)),
    currency: normalizeString(data.currency).toLowerCase() || 'usd',
    status: normalizeStatus(data.status),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

export const pulseCheckCoachServices = {
  async listForCoach(coachUserId: string): Promise<PulseCheckCoachService[]> {
    const normalizedCoachId = normalizeString(coachUserId);
    if (!normalizedCoachId) return [];
    const snapshot = await getDocs(
      query(
        collection(db, PULSECHECK_COACH_SERVICES_COLLECTION),
        where('coachUserId', '==', normalizedCoachId)
      )
    );
    return snapshot.docs.map(mapDoc).sort((left, right) => {
      const leftMs = typeof (left.createdAt as { toMillis?: () => number })?.toMillis === 'function'
        ? (left.createdAt as { toMillis: () => number }).toMillis()
        : 0;
      const rightMs = typeof (right.createdAt as { toMillis?: () => number })?.toMillis === 'function'
        ? (right.createdAt as { toMillis: () => number }).toMillis()
        : 0;
      return rightMs - leftMs;
    });
  },

  async create(input: Omit<PulseCheckCoachService, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, PULSECHECK_COACH_SERVICES_COLLECTION), {
      coachUserId: normalizeString(input.coachUserId),
      teamId: normalizeString(input.teamId),
      organizationId: normalizeString(input.organizationId),
      title: normalizeString(input.title),
      description: normalizeString(input.description),
      serviceType: normalizeType(input.serviceType),
      priceCents: Math.max(0, Math.round(Number(input.priceCents) || 0)),
      currency: normalizeString(input.currency).toLowerCase() || 'usd',
      status: normalizeStatus(input.status),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async update(serviceId: string, updates: Partial<PulseCheckCoachService>): Promise<void> {
    const normalizedId = normalizeString(serviceId);
    if (!normalizedId) throw new Error('A service id is required.');
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.title !== undefined) payload.title = normalizeString(updates.title);
    if (updates.description !== undefined) payload.description = normalizeString(updates.description);
    if (updates.serviceType !== undefined) payload.serviceType = normalizeType(updates.serviceType);
    if (updates.priceCents !== undefined) {
      payload.priceCents = Math.max(0, Math.round(Number(updates.priceCents) || 0));
    }
    if (updates.status !== undefined) payload.status = normalizeStatus(updates.status);
    await updateDoc(doc(db, PULSECHECK_COACH_SERVICES_COLLECTION, normalizedId), payload);
  },
};
