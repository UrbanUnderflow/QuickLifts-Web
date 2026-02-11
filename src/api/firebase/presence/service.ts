import { collection, doc, onSnapshot, serverTimestamp, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from '../config';

export type AgentStatus = 'offline' | 'idle' | 'working';

export interface AgentPresence {
  id: string;
  displayName: string;
  emoji?: string;
  status: AgentStatus;
  currentTask?: string;
  lastUpdate?: Date;
  notes?: string;
}

const COLLECTION = 'agent-presence';

export const presenceService = {
  async updateAgentPresence(agentId: string, payload: Partial<Omit<AgentPresence, 'id'>>) {
    const docRef = doc(db, COLLECTION, agentId);
    await setDoc(
      docRef,
      {
        displayName: payload.displayName || 'Unknown Agent',
        emoji: payload.emoji || '⚡️',
        status: payload.status || 'idle',
        currentTask: payload.currentTask || '',
        notes: payload.notes || '',
        lastUpdate: serverTimestamp()
      },
      { merge: true }
    );
  },

  listen(callback: (agents: AgentPresence[]) => void): Unsubscribe {
    const colRef = collection(db, COLLECTION);
    return onSnapshot(colRef, (snapshot) => {
      const agents: AgentPresence[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          displayName: data.displayName || docSnap.id,
          emoji: data.emoji || '⚡️',
          status: (data.status as AgentStatus) || 'idle',
          currentTask: data.currentTask || '',
          notes: data.notes || '',
          lastUpdate: data.lastUpdate?.toDate?.() || undefined
        };
      });
      callback(agents);
    });
  }
};
