import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from '../config';
import { NudgeLogEntry, NudgeOutcome } from '../progressTimeline/types';

const COLLECTION = 'nudge-log';

export const nudgeLogService = {
  async log(entry: Omit<NudgeLogEntry, 'id' | 'createdAt' | 'respondedAt'>) {
    await addDoc(collection(db, COLLECTION), {
      ...entry,
      respondedAt: null,
      createdAt: serverTimestamp(),
    });
  },

  async updateOutcome(id: string, outcome: NudgeOutcome) {
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, {
      outcome,
      respondedAt: outcome !== 'pending' ? serverTimestamp() : null,
    });
  },

  listen(callback: (entries: NudgeLogEntry[]) => void, opts?: { limit?: number }) {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(opts?.limit ?? 200));
    return onSnapshot(q, (snap) => {
      const items: NudgeLogEntry[] = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          agentId: data.agentId,
          agentName: data.agentName,
          objectiveCode: data.objectiveCode,
          color: data.color,
          lane: data.lane,
          message: data.message,
          channel: data.channel,
          outcome: data.outcome || 'pending',
          respondedAt: data.respondedAt?.toDate?.() || undefined,
          createdAt: data.createdAt?.toDate?.() || undefined,
        };
      });
      callback(items);
    });
  },
};
