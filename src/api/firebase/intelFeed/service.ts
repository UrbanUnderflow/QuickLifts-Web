import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';

export interface IntelFeedEntry {
  id?: string;
  agentId: string;
  agentName: string;
  emoji?: string;
  headline: string;
  summary: string;
  impact?: string;
  urgency: 'routine' | 'priority' | 'urgent';
  sources: Array<{ label: string; url?: string }>;
  nextAction?: string;
  tags?: string[];
  createdAt?: Date;
}

const COLLECTION = 'intel-feed';

export const intelFeedService = {
  async publish(entry: Omit<IntelFeedEntry, 'id' | 'createdAt'>) {
    await addDoc(collection(db, COLLECTION), {
      agentId: entry.agentId,
      agentName: entry.agentName,
      emoji: entry.emoji || '🧠',
      headline: entry.headline,
      summary: entry.summary,
      impact: entry.impact || '',
      urgency: entry.urgency || 'routine',
      sources: entry.sources || [],
      nextAction: entry.nextAction || '',
      tags: entry.tags || [],
      createdAt: serverTimestamp(),
    });
  },

  listen(callback: (entries: IntelFeedEntry[]) => void) {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      const items: IntelFeedEntry[] = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          agentId: data.agentId,
          agentName: data.agentName,
          emoji: data.emoji,
          headline: data.headline,
          summary: data.summary,
          impact: data.impact,
          urgency: data.urgency,
          sources: data.sources || [],
          nextAction: data.nextAction,
          tags: data.tags || [],
          createdAt: data.createdAt?.toDate?.() || undefined,
        };
      });
      callback(items);
    });
  },
};
