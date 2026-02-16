import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config';
import { ConfidenceColor, HourlySnapshotEntry, ProgressTimelineEntry, TimelineStateTag } from './types';

const TIMELINE_COLLECTION = 'progress-timeline';
const SNAPSHOT_COLLECTION = 'progress-snapshots';

export const progressTimelineService = {
  async publish(entry: Omit<ProgressTimelineEntry, 'id' | 'createdAt'>) {
    await addDoc(collection(db, TIMELINE_COLLECTION), {
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
      collection(db, TIMELINE_COLLECTION),
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

  async logHourlySnapshot(entry: Omit<HourlySnapshotEntry, 'id' | 'createdAt'>) {
    await addDoc(collection(db, SNAPSHOT_COLLECTION), {
      hourIso: entry.hourIso,
      agentId: entry.agentId,
      agentName: entry.agentName,
      objectiveCode: entry.objectiveCode,
      beatCompleted: entry.beatCompleted || null,
      color: entry.color,
      stateTag: entry.stateTag,
      note: entry.note || '',
      createdAt: serverTimestamp(),
    });
  },

  listenSnapshots(callback: (entries: HourlySnapshotEntry[]) => void, opts?: { limit?: number }) {
    const q = query(
      collection(db, SNAPSHOT_COLLECTION),
      orderBy('hourIso', 'desc'),
      limit(opts?.limit ?? 100)
    );

    return onSnapshot(q, (snap) => {
      const items: HourlySnapshotEntry[] = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          hourIso: data.hourIso,
          agentId: data.agentId,
          agentName: data.agentName,
          objectiveCode: data.objectiveCode,
          beatCompleted: data.beatCompleted || undefined,
          color: (data.color || 'blue') as ConfidenceColor,
          stateTag: (data.stateTag || 'signals') as TimelineStateTag,
          note: data.note || '',
          createdAt: data.createdAt?.toDate?.() || undefined,
        };
      });
      callback(items);
    });
  },
};
