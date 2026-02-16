import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../config';
import { PredictionScoreEntry, PredictionStatus } from './types';

const COLLECTION = 'prediction-scoreboard';

export const predictionScoreboardService = {
  async create(entry: Omit<PredictionScoreEntry, 'id' | 'createdAt' | 'resolvedAt'>) {
    const ref = await addDoc(collection(db, COLLECTION), {
      ...entry,
      status: entry.status || 'pending',
      createdAt: serverTimestamp(),
      resolvedAt: null,
    });
    return ref.id;
  },

  async update(id: string, updates: Partial<Omit<PredictionScoreEntry, 'id'>>) {
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, {
      ...updates,
      resolvedAt: updates.status && updates.status !== 'pending' ? serverTimestamp() : updates.resolvedAt ?? null,
    });
  },

  async remove(id: string) {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  async fetchByStatus(status: PredictionStatus, max = 25): Promise<PredictionScoreEntry[]> {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => predictionScoreboardService.mapDoc(docSnap.id, docSnap.data()));
  },

  listen(callback: (entries: PredictionScoreEntry[]) => void, status: PredictionStatus | 'all' = 'all') {
    const base = collection(db, COLLECTION);
    const q = status === 'all'
      ? query(base, orderBy('createdAt', 'desc'), limit(50))
      : query(base, where('status', '==', status), orderBy('createdAt', 'desc'), limit(50));

    return onSnapshot(q, (snap) => {
      const items = snap.docs.map((docSnap) => predictionScoreboardService.mapDoc(docSnap.id, docSnap.data()));
      callback(items);
    });
  },

  async get(id: string): Promise<PredictionScoreEntry | null> {
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return predictionScoreboardService.mapDoc(snap.id, snap.data());
  },

  mapDoc(id: string, data: any): PredictionScoreEntry {
    return {
      id,
      agentId: data.agentId,
      agentName: data.agentName,
      objectiveCode: data.objectiveCode,
      headline: data.headline,
      confidencePercent: data.confidencePercent,
      expectedTrigger: data.expectedTrigger,
      observedDelta: data.observedDelta || '',
      feltSenseNote: data.feltSenseNote || '',
      status: data.status || 'pending',
      createdAt: data.createdAt?.toDate?.() || undefined,
      resolvedAt: data.resolvedAt?.toDate?.() || undefined,
    };
  },
};
