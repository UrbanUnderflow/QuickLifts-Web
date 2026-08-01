import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  getFirebaseModeRequestHeaders,
} from '../config';

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

export type ScheduleEventSource = 'manual' | 'link' | 'file' | 'booking';

export interface ScheduleEvent {
  id: string;
  coachId: string;
  teamId: string;
  organizationId: string;
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
  'id' | 'coachId' | 'teamId' | 'organizationId' | 'createdAt' | 'updatedAt' | 'source'
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
  teamId: string,
  organizationId: string,
  draft: ScheduleEventDraft,
  id: string
): Record<string, any> =>
  clean({
    id,
    coachId,
    teamId,
    organizationId,
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

const buildUpdatePayload = (draft: Partial<ScheduleEventDraft>): Record<string, any> =>
  clean({
    title: draft.title !== undefined ? (draft.title || '').trim() || 'Untitled event' : undefined,
    date: draft.date,
    endDate: draft.endDate,
    time: draft.time,
    location: draft.location,
    opponent: draft.opponent,
    type: draft.type !== undefined ? normalizeType(draft.type) : undefined,
    notes: draft.notes,
    source: draft.source,
    sourceUrl: draft.sourceUrl,
    updatedAt: serverTimestamp(),
  });

class CoachScheduleService {
  /** Load all schedule events for a coach, soonest first. */
  async getEvents(
    coachId: string,
    teamId: string,
    organizationId: string
  ): Promise<ScheduleEvent[]> {
    if (!coachId || !teamId || !organizationId) return [];
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
        where('teamId', '==', teamId),
        orderBy('date', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs
        .map(map)
        .filter(
          (event) =>
            event.coachId === coachId &&
            event.teamId === teamId &&
            event.organizationId === organizationId
        );
    } catch (err) {
      // Fallback for environments missing the composite index.
      console.warn('[coachSchedule] ordered query failed, falling back', err);
      const q = query(
        collection(db, COLLECTION),
        where('coachId', '==', coachId),
        where('teamId', '==', teamId)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map(map)
        .filter(
          (event) =>
            event.coachId === coachId &&
            event.teamId === teamId &&
            event.organizationId === organizationId
        )
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }
  }

  /** Add a single event. */
  async addEvent(
    coachId: string,
    teamId: string,
    organizationId: string,
    draft: ScheduleEventDraft
  ): Promise<ScheduleEvent> {
    const docRef = doc(collection(db, COLLECTION));
    const payload = buildPayload(coachId, teamId, organizationId, draft, docRef.id);
    await setDoc(docRef, payload);
    return { ...(payload as any), createdAt: new Date(), updatedAt: new Date() };
  }

  /** Update a coach-owned schedule event. Paid booking events are managed by the booking flow. */
  async updateEvent(eventId: string, draft: Partial<ScheduleEventDraft>): Promise<ScheduleEvent> {
    if (!eventId) throw new Error('Missing event id.');
    const payload = buildUpdatePayload(draft);
    await updateDoc(doc(db, COLLECTION, eventId), payload);
    return { id: eventId, ...(payload as any), updatedAt: new Date() } as ScheduleEvent;
  }

  /**
   * Add many events at once (used by link import). Batched so a 30-event
   * meet schedule lands in a single round-trip.
   */
  async addEvents(
    coachId: string,
    teamId: string,
    organizationId: string,
    drafts: ScheduleEventDraft[]
  ): Promise<ScheduleEvent[]> {
    if (!drafts.length) return [];
    const batch = writeBatch(db);
    const created: ScheduleEvent[] = [];
    drafts.forEach((draft) => {
      const docRef = doc(collection(db, COLLECTION));
      const payload = buildPayload(coachId, teamId, organizationId, draft, docRef.id);
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
   * Import a published schedule from a URL. Two hops:
   *   1) `/api/coach/schedule-scrape` fetches the page server-side (no CORS)
   *      and returns its readable text.
   *   2) The shared **openai-bridge** (`/api/openai/v1/chat/completions`,
   *      feature `coachScheduleImport`) turns that text into structured
   *      events — reusing the configured OpenAI key + auth + rate limits.
   * Returns drafts the UI animates in and then persists with addEvents.
   * Does NOT write to Firestore itself, so the Schedule tab controls the
   * "Nora is writing it in" sequence.
   *
   * Overridden in demo mode to return canned events with no network call.
   */
  async scrapeUrl(
    url: string,
    teamId: string,
    organizationId: string
  ): Promise<{ sourceTitle: string; events: ScheduleEventDraft[] }> {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error('Please sign in again to import a schedule.');
    }
    if (!teamId || !organizationId) {
      throw new Error('Choose an active team before importing a schedule.');
    }
    const firebaseModeHeaders = getFirebaseModeRequestHeaders();

    // 1) Fetch + clean the page text.
    const pageRes = await fetch('/api/coach/schedule-scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${idToken}`,
        ...firebaseModeHeaders,
      },
      body: JSON.stringify({ url, teamId, organizationId }),
    });
    const page = await pageRes.json().catch(() => ({}));
    if (!pageRes.ok) {
      throw new Error(page?.error || `Couldn’t read that link (${pageRes.status}).`);
    }
    const { title, text } = page as { title?: string; text?: string };
    if (!text || !text.trim()) {
      throw new Error('Couldn’t read anything useful from that page.');
    }

    // 2) Extract events on a background job. A full season of meets is a long
    //    single LLM completion that used to run past the synchronous function
    //    timeout — the gateway killed it with a 504 ("Inactivity Timeout").
    //    We kick the extraction onto a background worker (15-min ceiling) and
    //    poll for the result. See netlify/functions/coach-schedule-import*.ts.
    const startRes = await fetch('/api/coach/schedule-import', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`,
        ...firebaseModeHeaders,
      },
      body: JSON.stringify({
        teamId,
        organizationId,
        sourceURL: url,
        sourceTitle: title || '',
        pageText: text,
      }),
    });
    const startJson = await startRes.json().catch(() => ({} as any));
    const jobId: string | undefined = startJson?.jobId;
    if (!startRes.ok || !jobId) {
      throw new Error(
        startJson?.error?.message || startJson?.error || `Nora couldn’t start that import (${startRes.status}).`
      );
    }

    // Poll until the worker writes the result back. The job has a ~15-min
    // ceiling on Netlify; the UI sits in its "fetching" state meanwhile.
    const POLL_INTERVAL_MS = 2000;
    const MAX_POLLS = 90; // ~3 min of headroom for a long season
    let completion: any = null;
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const statusRes = await fetch(
        `/api/coach/schedule-import-status?jobId=${encodeURIComponent(jobId)}`,
        {
          headers: {
            authorization: `Bearer ${idToken}`,
            ...firebaseModeHeaders,
          },
        }
      );
      const statusJson = await statusRes.json().catch(() => ({} as any));
      if (!statusRes.ok) continue; // transient — keep polling until attempts run out
      if (statusJson.status === 'succeeded') {
        completion = statusJson.result || {};
        break;
      }
      if (statusJson.status === 'failed') {
        throw new Error(statusJson.errorMessage || 'Nora couldn’t read that schedule.');
      }
    }
    if (!completion) {
      throw new Error('Nora is still reading that schedule — give it another try in a moment.');
    }
    const raw = completion?.choices?.[0]?.message?.content || '{}';
    let parsed: { sourceTitle?: string; events?: any[] };
    try {
      parsed = JSON.parse(
        String(raw).replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim()
      );
    } catch {
      throw new Error('Nora couldn’t make sense of that schedule.');
    }

    const ISO = /^\d{4}-\d{2}-\d{2}$/;
    const events: ScheduleEventDraft[] = (Array.isArray(parsed.events) ? parsed.events : [])
      .filter((e) => e && typeof e.title === 'string' && ISO.test(String(e.date)))
      .map((e) => ({
        title: String(e.title).trim().slice(0, 140),
        date: e.date,
        endDate: ISO.test(String(e.endDate)) ? e.endDate : undefined,
        time: e.time ? String(e.time).trim().slice(0, 40) : undefined,
        location: e.location ? String(e.location).trim().slice(0, 120) : undefined,
        opponent: e.opponent ? String(e.opponent).trim().slice(0, 120) : undefined,
        type: normalizeType(e.type),
        notes: e.notes ? String(e.notes).trim().slice(0, 200) : undefined,
        source: 'link' as const,
        sourceUrl: url,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      sourceTitle: (parsed.sourceTitle || title || 'Imported schedule').toString().trim().slice(0, 120),
      events,
    };
  }
}

export const coachScheduleService = new CoachScheduleService();
