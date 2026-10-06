import type { firestore } from 'firebase-admin';
import { participationTimestamp } from './participationSources';

/** One thread with an athlete-authored turn in the window is one conversation. */
export function countNoraThreads(rows: Array<{id: string; source: 'chat' | 'prompt'; data: Record<string, any>}>, from: string, to: string): number | null {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + 86400000;
  const active = new Set<string>();
  for (const {id, source, data} of rows) {
    if (data.syntheticRedTeam === true) continue;
    const turns = source === 'chat' ? data.messages : data.turns;
    if (!Array.isArray(turns)) return null;
    for (const turn of turns) {
      const authored = source === 'chat' ? turn.isFromUser === true : turn.role === 'athlete-reply';
      if (!authored) continue;
      const at = participationTimestamp(source === 'chat' ? turn.timestamp : turn.createdAt);
      if (at === null) return null;
      if (at >= start && at < end) { active.add(`${source}:${id}`); break; }
    }
  }
  return active.size;
}

/** Raw arrays stay on the server; only the count enters the allowlisted coach DTO. */
export async function loadNoraConversationCount(db: firestore.Firestore, athleteId: string, from: string, to: string): Promise<number | null> {
  try {
    const [chats, prompts] = await Promise.all([
      db.collection('conversations').where('userId', '==', athleteId).select('messages', 'syntheticRedTeam').limit(1001).get(),
      db.collection('pulsecheck-nora-conversations').where('athleteUserId', '==', athleteId).select('turns', 'syntheticRedTeam').limit(1001).get(),
    ]);
    if (chats.size > 1000 || prompts.size > 1000) return null;
    return countNoraThreads([
      ...chats.docs.map(doc => ({id: doc.id, source: 'chat' as const, data: doc.data()})),
      ...prompts.docs.map(doc => ({id: doc.id, source: 'prompt' as const, data: doc.data()})),
    ], from, to);
  } catch { return null; }
}
