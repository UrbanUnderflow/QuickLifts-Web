import { db } from '../config';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import type { SimSessionRecord } from './taxonomy';

const ROOT = 'sim-sessions';

export const simSessionService = {
  async recordSession(session: SimSessionRecord): Promise<string> {
    const docRef = await addDoc(
      collection(db, ROOT, session.userId, 'sessions'),
      {
        ...session,
        createdAt: session.createdAt || Date.now(),
      }
    );

    return docRef.id;
  },

  async getRecentSessions(userId: string, limitCount = 20): Promise<SimSessionRecord[]> {
    const snap = await getDocs(
      query(
        collection(db, ROOT, userId, 'sessions'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      )
    );

    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as SimSessionRecord) }));
  },

  async getSessionsForSim(userId: string, simId: string, limitCount = 20): Promise<SimSessionRecord[]> {
    const snap = await getDocs(
      query(
        collection(db, ROOT, userId, 'sessions'),
        where('simId', '==', simId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      )
    );

    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as SimSessionRecord) }));
  },
};
