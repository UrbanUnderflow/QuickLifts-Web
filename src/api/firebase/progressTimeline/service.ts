import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';

export type ProgressBeat = 'hypothesis' | 'work-in-flight' | 'result' | 'block' | 'signal-spike';
export type ArtifactType = 'none' | 'text' | 'url';
export type ConfidenceColor = 'blue' | 'green' | 'yellow' | 'red';

export interface ProgressTimelineEntry {
  id?: string;
  agentId: string;
  agentName: string;
  emoji?: string;
  objectiveCode: string;
  beat: ProgressBeat;
  headline: string;
  artifactType?: ArtifactType;
  artifactText?: string;
  artifactUrl?: string;
  lensTag?: string;
  confidenceColor: ConfidenceColor;
  stateTag?: 'signals' | 'meanings';
  createdAt?: Date;
}

const COLLECTION = 'progress-timeline';

export const progressTimelineService = {
  async publish(entry: Omit<ProgressTimelineEntry, 'id' | 'createdAt'>) {
    await addDoc(collection(db, COLLECTION), {
      agentId: entry.agentId,
      agentName: entry.agentName,
      emoji: entry.emoji || '⚡️',
      objectiveCode: entry.objectiveCode,
      beat: entry.beat,
      headline: entry.headline,
      artifactType: entry.artifactType || 'none',
      artifactText: entry.artifactText || '',
      artifactUrl: entry.artifactUrl || '',
      lensTag: entry.lensTag || '',
      confidenceColor: entry.confidenceColor,
      stateTag: entry.stateTag || 'signals',
      createdAt: serverTimestamp(),
    });
  },

  listen(callback: (entries: ProgressTimelineEntry[]) => void, opts?: { limit?: number }) {
    const q = query(
      collection(db, COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(opts?.limit ?? 100)
    );

    return onSnapshot(q, (snap) => {
      const items: ProgressTimelineEntry[] = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          agentId: data.agentId,
          agentName: data.agentName,
          emoji: data.emoji,
          objectiveCode: data.objectiveCode,
          beat: data.beat,
          headline: data.headline,
          artifactType: data.artifactType || 'none',
          artifactText: data.artifactText || '',
          artifactUrl: data.artifactUrl || '',
          lensTag: data.lensTag || '',
          confidenceColor: data.confidenceColor || 'blue',
          stateTag: data.stateTag || 'signals',
          createdAt: data.createdAt?.toDate?.() || undefined,
        };
      });
      callback(items);
    });
  },
};
