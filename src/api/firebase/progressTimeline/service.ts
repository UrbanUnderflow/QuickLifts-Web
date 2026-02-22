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
import { ConfidenceColor, HourlySnapshotEntry, ProgressTimelineEntry, ReviewStatus, TimelineStateTag } from './types';

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
  objectiveCodeLabel: entry.objectiveCodeLabel || '',
  reviewStatus: entry.reviewStatus || 'none',
  reviewRequired: entry.reviewRequired || false,
  reviewedAt: entry.reviewedAt || null,
  reviewDeniedReason: entry.reviewDeniedReason || '',
  movementImpact: entry.movementImpact || null,
  isValidatedResult: entry.isValidatedResult || false,
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
          objectiveCodeLabel: data.objectiveCodeLabel || '',
          confidenceColor: data.confidenceColor || 'blue',
          stateTag: data.stateTag || 'signals',
          reviewStatus: (data.reviewStatus || 'none') as ReviewStatus,
          reviewRequired: !!data.reviewRequired,
          reviewedAt: data.reviewedAt?.toDate?.() || undefined,
          reviewDeniedReason: data.reviewDeniedReason || '',
          movementImpact: data.movementImpact || undefined,
          isValidatedResult: !!data.isValidatedResult,
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
      objectiveCodeLabel: entry.objectiveCodeLabel || '',
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
          objectiveCodeLabel: data.objectiveCodeLabel || '',
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
