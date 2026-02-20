// web/lib/partners/getGymKpis.ts
// Partner-facing data loader for gym KPI metrics.
//
// This module provides a typed helper to fetch gym affiliate KPIs for the
// current gym partner from the `gymAffiliates` collection. It is intended
// for use by the partner dashboard UI (e.g., web/app/partners/dashboard.tsx).

import { db } from '../../../src/api/firebase/config';
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';

export type GymKpis = {
  gymAffiliateId: string;
  gymName: string;
  memberSignupCount: number;
  roundsCreated: number;
  uniqueParticipants: number;
};

/**
 * getGymKpisForAffiliate
 *
 * Fetches KPI metrics for a specific gym affiliate by ID.
 * This is the most direct path when the current user or session already
 * knows its gymAffiliateId.
 */
export async function getGymKpisForAffiliate(gymAffiliateId: string): Promise<GymKpis | null> {
  if (!gymAffiliateId) return null;

  const ref = doc(db, 'gymAffiliates', gymAffiliateId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data() as any;

  return {
    gymAffiliateId: snap.id,
    gymName: data.gymName ?? data.gymId ?? snap.id,
    memberSignupCount: typeof data.memberSignupCount === 'number' ? data.memberSignupCount : 0,
    roundsCreated: typeof data.roundsCreated === 'number' ? data.roundsCreated : 0,
    uniqueParticipants: typeof data.uniqueParticipants === 'number' ? data.uniqueParticipants : 0,
  };
}

/**
 * getGymKpisForUser
 *
 * Convenience helper to resolve the current user's gym affiliate KPIs.
 *
 * Resolution logic:
 * - If the user document contains `gymAffiliateId`, load that affiliate.
 * - Otherwise, if the user has `gymInviteCode`, try to find a matching
 *   gymAffiliate by `inviteCode` and then load KPIs for that affiliate.
 * - If neither path resolves, return null.
 */
export async function getGymKpisForUser(userId: string): Promise<GymKpis | null> {
  if (!userId) return null;

  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  const userData = userSnap.data() as any;

  // Prefer an explicit gymAffiliateId if present (set by backend triggers)
  if (typeof userData.gymAffiliateId === 'string' && userData.gymAffiliateId.trim() !== '') {
    return getGymKpisForAffiliate(userData.gymAffiliateId.trim());
  }

  // Fallback: resolve via gymInviteCode
  if (typeof userData.gymInviteCode === 'string' && userData.gymInviteCode.trim() !== '') {
    const affiliatesRef = collection(db, 'gymAffiliates');
    const q = query(
      affiliatesRef,
      where('inviteCode', '==', userData.gymInviteCode.trim()),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const affiliateDoc = snapshot.docs[0];
      return getGymKpisForAffiliate(affiliateDoc.id);
    }
  }

  return null;
}
