import { useEffect, useState } from 'react';
import {
  collection, deleteDoc, doc, onSnapshot, query, runTransaction,
  serverTimestamp, Timestamp, where, type Firestore,
} from 'firebase/firestore';

const HEARTBEAT_MS = 20_000;
export const PRESENCE_LIFETIME_MS = 90_000;

type Session = { uid: string; initials: string; seenAt: number };

export function activePipeListPeople(sessions: Session[], now: number) {
  const people = new Map<string, Session>();
  for (const session of sessions) {
    if (session.seenAt <= now - PRESENCE_LIFETIME_MS) continue;
    const previous = people.get(session.uid);
    if (!previous || previous.seenAt < session.seenAt) people.set(session.uid, session);
  }
  return Array.from(people.values()).sort((left, right) => left.uid.localeCompare(right.uid));
}

export function pipeListInitials(name: string) {
  const words = name.trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!words.length) return '?';
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : '';
  return Array.from((first + last).toUpperCase()).slice(0, 2).join('');
}

export default function PipeListPresence({ db, shareId, uid, initials }: {
  db: Firestore; shareId: string; uid: string; initials: string;
}) {
  const [people, setPeople] = useState<Session[]>([]);

  useEffect(() => {
    const sessions = collection(db, 'pipeListProtectedShares', shareId, 'presence');
    const session = doc(sessions);
    let rows: Session[] = [];
    let active = true;
    let writing = false;
    let disposed = false;
    const refresh = () => {
      if (!disposed) setPeople(activePipeListPeople(rows, Date.now()));
    };

    const heartbeat = async () => {
      if (!active || writing || !navigator.onLine) return;
      writing = true;
      try {
        // Transactions require a connection. A closed offline tab must never
        // publish an old heartbeat with a fresh server timestamp on reconnect.
        await runTransaction(db, async transaction => {
          await transaction.get(session);
          if (active) transaction.set(session, { uid, initials, seenAt: serverTimestamp() });
        });
      } catch {
        // Losing access or connectivity lets this session's lease expire.
      } finally {
        writing = false;
      }
    };

    const leave = () => {
      active = false;
      void deleteDoc(session).catch(() => {});
    };
    const enter = () => {
      active = true;
      void heartbeat();
    };

    const unsubscribe = onSnapshot(query(sessions, where('seenAt', '>', Timestamp.fromMillis(Date.now() - PRESENCE_LIFETIME_MS))), { includeMetadataChanges: true }, snapshot => {
      // Wait for authorization on this connection before displaying any cached identities.
      rows = snapshot.metadata.fromCache ? [] : snapshot.docs.map(record => {
        const data = record.data();
        return { uid: data.uid, initials: data.initials, seenAt: data.seenAt?.toMillis() ?? 0 };
      });
      refresh();
    }, () => {
      rows = [];
      refresh();
    });
    const timer = window.setInterval(() => { refresh(); void heartbeat(); }, HEARTBEAT_MS);
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', enter);
    window.addEventListener('online', heartbeat);
    void heartbeat();
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', enter);
      window.removeEventListener('online', heartbeat);
      unsubscribe();
      leave();
    };
  }, [db, initials, shareId, uid]);

  if (!people.length) return null;
  return (
    <ul aria-label="People with this list open" className="flex flex-wrap gap-1">
      {people.map(person => (
        <li key={person.uid} aria-label={person.uid === uid ? 'You' : person.initials}
          title={person.uid === uid ? 'You' : person.initials}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-900">
          {person.initials}
        </li>
      ))}
    </ul>
  );
}
