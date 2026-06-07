import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth } from '../config';

/**
 * Nora Training Vault
 * ------------------------------------------------------------------
 * A coach-owned knowledge base ("Train Nora"). Coaches drop in files,
 * images, links, and free-form notes — team logistics, playbooks,
 * schedules, policies, etc. Each entry is stored in Firestore so the
 * athlete-facing Nora assistant can pull it into context and answer
 * questions like "what time is the team meeting?".
 *
 * Scope: entries are owned by a single coach (coachId). The athlete's
 * Nora resolves the athlete's linked coach(es) and reads that coach's
 * vault. Text content (`content`) is what Nora actually reasons over;
 * uploaded files keep a `downloadUrl` + optional `content` summary the
 * coach types in so Nora has something textual to ground on.
 */

export type NoraVaultEntryType = 'note' | 'file' | 'image' | 'link';

export interface NoraVaultEntry {
  id: string;
  coachId: string;
  type: NoraVaultEntryType;
  title: string;
  /** The text Nora reasons over — note body, link description, or a coach-written summary of a file. */
  content: string;
  /** Optional: free tag for grouping (e.g. "Schedule", "Playbook", "Policies"). */
  category?: string;
  // File/image fields
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  downloadUrl?: string;
  storagePath?: string;
  // Link field
  url?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION = 'coach-nora-vault';

const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  return undefined;
};

class NoraVaultService {
  private storage = getStorage();

  /** Load all vault entries for a coach, newest first. */
  async getEntries(coachId: string): Promise<NoraVaultEntry[]> {
    if (!coachId) return [];
    try {
      const q = query(
        collection(db, COLLECTION),
        where('coachId', '==', coachId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        } as NoraVaultEntry;
      });
    } catch (err) {
      // Fallback for environments missing the composite index — query without orderBy.
      console.warn('[noraVault] ordered query failed, falling back', err);
      const q = query(collection(db, COLLECTION), where('coachId', '==', coachId));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            ...data,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          } as NoraVaultEntry;
        })
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    }
  }

  /** Create a text note or link entry. */
  async addNote(
    coachId: string,
    entry: { title: string; content: string; category?: string; type?: 'note' | 'link'; url?: string }
  ): Promise<NoraVaultEntry> {
    const docRef = doc(collection(db, COLLECTION));
    const payload: Record<string, any> = {
      id: docRef.id,
      coachId,
      type: entry.type || 'note',
      title: entry.title.trim() || 'Untitled note',
      content: entry.content.trim(),
      category: entry.category || null,
      url: entry.url || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, payload);
    return { ...(payload as any), createdAt: new Date(), updatedAt: new Date() };
  }

  /**
   * Upload a file/image to Storage and record it in the vault.
   * `summary` is an optional coach-written description Nora can read.
   */
  async addFile(
    coachId: string,
    file: File,
    opts?: { title?: string; summary?: string; category?: string; onProgress?: (pct: number) => void }
  ): Promise<NoraVaultEntry> {
    const user = auth.currentUser;
    if (!user) throw new Error('You must be signed in to upload to the Nora vault.');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}_${safeName}`;
    const storagePath = `coach-nora-vault/${coachId}/${fileName}`;
    const storageRef = ref(this.storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, file);
    if (opts?.onProgress) {
      uploadTask.on('state_changed', (snap) => {
        opts.onProgress!(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      });
    }
    const snapshot = await uploadTask;
    const downloadUrl = await getDownloadURL(snapshot.ref);

    const isImage = file.type.startsWith('image/');
    const docRef = doc(collection(db, COLLECTION));
    const payload: Record<string, any> = {
      id: docRef.id,
      coachId,
      type: isImage ? 'image' : 'file',
      title: opts?.title?.trim() || file.name,
      content: opts?.summary?.trim() || '',
      category: opts?.category || null,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      downloadUrl,
      storagePath,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, payload);
    return { ...(payload as any), createdAt: new Date(), updatedAt: new Date() };
  }

  /** Remove an entry (and its underlying file, if any). */
  async deleteEntry(entry: NoraVaultEntry): Promise<void> {
    if (entry.storagePath) {
      try {
        await deleteObject(ref(this.storage, entry.storagePath));
      } catch (err) {
        console.warn('[noraVault] failed to delete storage object', err);
      }
    }
    await deleteDoc(doc(db, COLLECTION, entry.id));
  }
}

export const noraVaultService = new NoraVaultService();
