# Building Virtual Office UI

The Virtual Office UI sits inside the `admin/systemOverview.tsx` codebase in Next.js and operates via the `presenceService` helper.

## Requirements
*   `react` + `react-dom` + `next`
*   `firebase/app` + `firebase/firestore` (Web SDK)
*   Lucide React icons

## Creating `presenceService` (`src/api/firebase/presence/service.ts`)
This class queries the `agent-presence` collection with an `onSnapshot` listener to react to real-time status updates of agents. It then holds an internal state of `AgentPresence[]` objects.

```typescript
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore';
import { db } from '../config';

export interface AgentPresence {
  id: string;
  displayName: string;
  status: 'Online' | 'Offline' | 'Working';
  emoji: string;
  currentTask?: string;
  lastUpdate: Date | null;
}

class PresenceService {
  listen(callback: (agents: AgentPresence[]) => void) {
    const q = query(collection(db, 'agent-presence'));
    return onSnapshot(q, (snapshot) => {
      const agents = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          displayName: data.displayName || doc.id,
          status: data.status || 'Offline',
          emoji: data.emoji || '🤖',
          currentTask: data.currentTask || null,
          lastUpdate: data.lastUpdate ? (data.lastUpdate as Timestamp).toDate() : null,
        } as AgentPresence;
      });
      callback(agents);
    });
  }
}
export const presenceService = new PresenceService();
```

## Creating `HeartbeatProtocolTab.tsx`
This React component subscribes to `presenceService` to render a living dashboard of exactly which agents are online and how long ago they last polled.

## End to End Complete
Your system overview now actively reads, displays, and maps out the living infrastructure!
