import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp as fsServerTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config';

export type ReunionPaymentRecord = {
  id?: string;
  name: string; // Full name to search
  notes?: string; // optional notes
  // simple milestone booleans or amounts for dates
  apr1Amount?: number; // amount paid by Apr 1st
  aug1Amount?: number; // amount paid by Aug 1st
  dec1Amount?: number; // amount paid by Dec 1st
  apr1Note?: string; // e.g., T, R, cash app, etc
  aug1Note?: string;
  dec1Note?: string;
  createdAt?: number; // unix seconds
  updatedAt?: number; // unix seconds
};

const COLLECTION = 'reunion-payments';

export const reunionPaymentsService = {
  async upsert(record: ReunionPaymentRecord): Promise<string> {
    const normalizedName = record.name.trim();
    if (!normalizedName) throw new Error('Name is required');

    const nowSeconds = Math.floor(Date.now() / 1000);

    // If record has an ID, update that specific record
    if (record.id) {
      const docRef = doc(db, COLLECTION, record.id);
      
      // Build update data without undefined values
      const updateData: any = {
        name: normalizedName,
        nameLower: normalizedName.toLowerCase(),
        updatedAt: nowSeconds
      };
      
      // Only include payment amounts if they are defined
      if (record.apr1Amount !== undefined) updateData.apr1Amount = record.apr1Amount;
      if (record.aug1Amount !== undefined) updateData.aug1Amount = record.aug1Amount;
      if (record.dec1Amount !== undefined) updateData.dec1Amount = record.dec1Amount;
      if (record.apr1Note !== undefined) updateData.apr1Note = record.apr1Note;
      if (record.aug1Note !== undefined) updateData.aug1Note = record.aug1Note;
      if (record.dec1Note !== undefined) updateData.dec1Note = record.dec1Note;
      if (record.notes !== undefined) updateData.notes = record.notes;
      
      await updateDoc(docRef, updateData);
      return record.id;
    }

    // Try to find existing by exact lowercase name
    const q = query(
      collection(db, COLLECTION),
      where('nameLower', '==', normalizedName.toLowerCase())
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const existing = snap.docs[0];
      
      // Build update data without undefined values
      const updateData: any = {
        name: normalizedName,
        nameLower: normalizedName.toLowerCase(),
        updatedAt: nowSeconds
      };
      
      // Only include payment amounts if they are defined
      if (record.apr1Amount !== undefined) updateData.apr1Amount = record.apr1Amount;
      if (record.aug1Amount !== undefined) updateData.aug1Amount = record.aug1Amount;
      if (record.dec1Amount !== undefined) updateData.dec1Amount = record.dec1Amount;
      if (record.apr1Note !== undefined) updateData.apr1Note = record.apr1Note;
      if (record.aug1Note !== undefined) updateData.aug1Note = record.aug1Note;
      if (record.dec1Note !== undefined) updateData.dec1Note = record.dec1Note;
      if (record.notes !== undefined) updateData.notes = record.notes;
      
      await updateDoc(existing.ref, updateData);
      return existing.id;
    }

    const docRef = await addDoc(collection(db, COLLECTION), {
      ...record,
      name: normalizedName,
      nameLower: normalizedName.toLowerCase(),
      createdAt: nowSeconds,
      updatedAt: nowSeconds,
    });
    return docRef.id;
  },

  async searchByNamePrefix(prefix: string, limit = 10): Promise<ReunionPaymentRecord[]> {
    const q = query(
      collection(db, COLLECTION),
      where('nameLower', '>=', prefix.toLowerCase()),
      where('nameLower', '<=', prefix.toLowerCase() + '\uf8ff')
    );
    const snap = await getDocs(q);
    return snap.docs.slice(0, limit).map(d => ({ id: d.id, ...(d.data() as any) }));
  },

  async getById(id: string): Promise<ReunionPaymentRecord | null> {
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) };
  },

  async hasAny(): Promise<boolean> {
    const snap = await getDocs(collection(db, COLLECTION));
    return !snap.empty;
  },

  async listAll(): Promise<ReunionPaymentRecord[]> {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  },

  async deleteById(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  async addPaymentById(id: string, amount: number): Promise<void> {
    if (!id || !amount || amount <= 0) return;
    const existing = await this.getById(id);
    if (!existing) return;
    const apr = existing.apr1Amount ?? 0;
    const aug = existing.aug1Amount ?? 0;
    const dec = existing.dec1Amount ?? 0;
    let a1 = apr, a2 = aug, a3 = dec;
    if (!a1) a1 = amount;
    else if (!a2) a2 = amount;
    else a3 = a3 + amount;
    await updateDoc(doc(db, COLLECTION, id), {
      apr1Amount: a1 || null,
      aug1Amount: a2 || null,
      dec1Amount: a3 || null,
      updatedAt: Math.floor(Date.now() / 1000)
    } as any);
  }
};


