import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../config';
import { FeedTaxonomyEntry } from './types';

const COLLECTION = 'feed-taxonomy';

export const feedTaxonomyService = {
  async create(entry: Omit<FeedTaxonomyEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    const ref = await addDoc(collection(db, COLLECTION), {
      ...entry,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(id: string, updates: Partial<Omit<FeedTaxonomyEntry, 'id' | 'createdAt'>>) {
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  async remove(id: string) {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  async fetchAll(): Promise<FeedTaxonomyEntry[]> {
    const snapshot = await getDocs(query(collection(db, COLLECTION), orderBy('taskType')));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...(data as FeedTaxonomyEntry),
        createdAt: data.createdAt?.toDate?.() || undefined,
        updatedAt: data.updatedAt?.toDate?.() || undefined,
      };
    });
  },

  listen(callback: (entries: FeedTaxonomyEntry[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('taskType'));
    return onSnapshot(q, (snap) => {
      const items: FeedTaxonomyEntry[] = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...(data as FeedTaxonomyEntry),
          createdAt: data.createdAt?.toDate?.() || undefined,
          updatedAt: data.updatedAt?.toDate?.() || undefined,
        };
      });
      callback(items);
    });
  },

  async get(id: string): Promise<FeedTaxonomyEntry | null> {
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      ...(data as FeedTaxonomyEntry),
      createdAt: data.createdAt?.toDate?.() || undefined,
      updatedAt: data.updatedAt?.toDate?.() || undefined,
    };
  },
};
