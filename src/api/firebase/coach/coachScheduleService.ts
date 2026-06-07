import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config';

/**
 * Coach Team Schedule
 * ------------------------------------------------------------------
 * Practices, meetings, lifts, competitions, travel — the team's
 * calendar. Coaches add events three ways:
 *   1) Manually (the composer in the Schedule tab),
 *   2) By importing a link to a published schedule (e.g. an athletics
 *      site's competition schedule), which Nora scrapes and writes in,
 *   3) Implicitly, via documents dropped into Train Nora.
 *
 * Every event is owned by a single coach (coachId). The athlete-facing
 * Nora can read these so an athlete can ask "when's our next meet?" and
 * get an answer grounded in what the coach actually put on the calendar.
 *
 * Mirrors the shape/conventions of noraVaultService so the two read the
 * same way and the demo path can mock both identically.
 */

export type ScheduleEventType =
  | 'practice'
  | 'meeting'
  | 'lift'
  | 'competition'
  | 'travel'
  | 'event';

export type ScheduleEventSource = 'manual' | 'link' | 'file';

export interface ScheduleEvent {
  id: string;
  coachId: string;
  /** Short label — "vs. Florida", "Team meeting", "Lift". */
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  /** YYYY-MM-DD for multi-day meets (optional). */
  endDate?: string;
  /** Free text — "3:30 PM", "All Day", "TBA". */
  time?: string;
  location?: string;
  /** Opponent / host for competitions. */
  opponent?: string;
  type: ScheduleEventType;
  notes?: string;
  source: ScheduleEventSource;
  /** When source === 'link', the page it was imported from. */
  sourceUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** What the scraper / composer hands us before we stamp ids + ownership. */
export type ScheduleEventDraft = Omit<
  ScheduleEvent,
  'id' | 'coachId' | 'createdAt' | 'updatedAt' | 'source'
> & { source?: ScheduleEventSource };

const COLLECTION = 'coach-team-schedule';

const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  return undefined;
};

const VALID_TYPES: ScheduleEventType[] = [
  'practice',
  'meeting',
  'lift',
  'competition',
  'travel',
  'event',
];

const normalizeType = (t: any): ScheduleEventType =>
  VALID_TYPES.includes(t) ? t : 'event';

/** Strip undefined keys — Firestore rejects them. */
const clean = (obj: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v === '' ? null : v;
  });
  return out;
};

const buildPayload = (
  coachId: string,
  draft: ScheduleEventDraft,
  id: string
): Record<string, any> =>
  clean({
    id,
    coachId,
    title: (draft.title || '').trim() || 'Untitled event',
    date: draft.date,
    endDate: draft.endDate,
    time: draft.time,
    location: draft.location,
    opponent: draft.opponent,
    type: normalizeType(draft.type),
    notes: draft.notes,
    source: draft.source || 'manual',
    sourceUrl: draft.sourceUrl,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

class CoachScheduleService {
  /** Load all schedule events for a coach, soonest first. */
  async getEvents(coachId: string): Promise<ScheduleEvent[]> {
    if (!coachId) return [];
    const map = (d: any): ScheduleEvent => {
      const data = d.data() as any;
      return {
        ...data,
        id: d.id,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      } as ScheduleEvent;
    };
    try {
      const q = query(
        collection(db, COLLECTION),
        where('coachId', '==', coachId),
        orderBy('date', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(map);
    } catch (err) {
      // Fallback for environments missing the composite index.
      console.warn('[coachSchedule] ordered query failed, falling back', err);
      const q = query(collection(db, COLLECTION), where('coachId', '==', coachId));
      const snap = await getDocs(q);
      return snap.docs.map(map).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }
  }

  /** Add a single event. */
  async addEvent(coachId: string, draft: ScheduleEventDraft): Promise<ScheduleEvent> {
    const docRef = doc(collection(db, COLLECTION));
    const payload = buildPayload(coachId, draft, docRef.id);
    await setDoc(docRef, payload);
    return { ...(payload as any), createdAt: new Date(), updatedAt: new Date() };
  }

  /**
   * Add many events at once (used by link import). Batched so a 30-event
   * meet schedule lands in a single round-trip.
   */
  async addEvents(coachId: string, drafts: ScheduleEventDraft[]): Promise<ScheduleEvent[]> {
    if (!drafts.length) return [];
    const batch = writeBatch(db);
    const created: ScheduleEvent[] = [];
    drafts.forEach((draft) => {
      const docRef = doc(collection(db, COLLECTION));
      const payload = buildPayload(coachId, draft, docRef.id);
      batch.set(docRef, payload);
      created.push({ ...(payload as any), createdAt: new Date(), updatedAt: new Date() });
    });
    await batch.commit();
    return created;
  }

  /** Remove an event. */
  async deleteEvent(eventId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, eventId));
  }

  /**
   * Import a published schedule from a URL. Hits the server-side scraper
   * (fetch + LLM extraction) and returns drafts the UI can animate in and
   * then persist with addEvents. Does NOT write to Firestore itself, so
   * the Schedule tab controls the "Nora is writing it in" sequence.
   *
   * Overridden in demo mode to return canned events with no network call.
   */
  async scrapeUrl(url: string): Promise<{ sourceTitle: string; events: ScheduleEventDraft[] }> {
    const res = await fetch('/api/coach/schedule-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Couldn’t import that link (${res.status}).`);
    }
    return {
      sourceTitle: data.sourceTitle || 'Imported schedule',
      events: (Array.isArray(data.events) ? data.events : []).map((e: any) => ({
        ...e,
        source: 'link' as const,
        sourceUrl: url,
      })),
    };
  }
}

export const coachScheduleService = new CoachScheduleService();
