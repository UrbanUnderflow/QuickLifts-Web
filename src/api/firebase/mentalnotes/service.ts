import { db } from '../../firebase/config';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  orderBy,
  where,
  query,
  addDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  MentalNote,
  MentalNoteCategory,
  MentalNoteSeverity,
  MentalNoteStatus,
  MentalNoteStats,
  noteFromFirestore,
  noteToFirestore,
} from './types';

const ROOT = 'user-mental-notes';

export const mentalNotesService = {
  async save(note: MentalNote): Promise<string> {
    const ref = doc(db, ROOT, note.userId, 'notes', note.id);
    const payload = { ...noteToFirestore(note), createdAt: note.createdAt || serverTimestamp() };
    await setDoc(ref, payload, { merge: true });
    return note.id;
  },

  async loadAll(userId: string): Promise<MentalNote[]> {
    const q = query(collection(db, ROOT, userId, 'notes'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => noteFromFirestore(d.id, d.data()));
  },

  async loadActive(userId: string): Promise<MentalNote[]> {
    const q = query(collection(db, ROOT, userId, 'notes'), where('status', 'in', [MentalNoteStatus.Active, MentalNoteStatus.Improving, MentalNoteStatus.Monitoring]));
    const snap = await getDocs(q);
    return snap.docs.map(d => noteFromFirestore(d.id, d.data()));
  },

  async updateStatus(userId: string, noteId: string, status: MentalNoteStatus): Promise<void> {
    await updateDoc(doc(db, ROOT, userId, 'notes', noteId), { status, lastDiscussed: serverTimestamp() });
  },

  async addActionItems(userId: string, noteId: string, actionItems: string[]): Promise<void> {
    await updateDoc(doc(db, ROOT, userId, 'notes', noteId), { actionItems, lastDiscussed: serverTimestamp() });
  },

  async linkMessages(userId: string, noteId: string, messageIds: string[]): Promise<void> {
    await updateDoc(doc(db, ROOT, userId, 'notes', noteId), { relatedMessageIds: messageIds });
  },

  async remove(userId: string, noteId: string): Promise<void> {
    await deleteDoc(doc(db, ROOT, userId, 'notes', noteId));
  },

  listenActive(userId: string, cb: (notes: MentalNote[]) => void): Unsubscribe {
    const q = query(collection(db, ROOT, userId, 'notes'), where('status', 'in', [MentalNoteStatus.Active, MentalNoteStatus.Monitoring, MentalNoteStatus.Improving]), orderBy('lastDiscussed', 'asc'));
    return onSnapshot(q, snap => {
      const notes = snap.docs.map(d => noteFromFirestore(d.id, d.data()));
      cb(notes);
    });
  },

  async stats(userId: string): Promise<MentalNoteStats> {
    const all = await this.loadAll(userId);
    return {
      totalNotes: all.length,
      activeNotes: all.filter(n => n.status === MentalNoteStatus.Active).length,
      resolvedNotes: all.filter(n => n.status === MentalNoteStatus.Resolved).length,
      improvingNotes: all.filter(n => n.status === MentalNoteStatus.Improving).length,
      monitoringNotes: all.filter(n => n.status === MentalNoteStatus.Monitoring).length,
      highPriorityNotes: all.filter(n => n.severity === MentalNoteSeverity.High).length,
    };
  },
};

export type { MentalNote, MentalNoteStatus, MentalNoteCategory, MentalNoteSeverity };


