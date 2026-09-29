import { createHash, randomBytes, randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminApp } from './firebase-admin';
import { getGoogleCalendarAuth, getGoogleCalendarId } from './googleCalendar';
import { BookingError, BookingProfile, BookingSlot, DEFAULT_BOOKING_PROFILE, generateBookingSlots, overlaps } from './groupMeetBooking';

// Server-only collections. Public callers never choose a Firebase environment or calendar.
const db = () => getFirebaseAdminApp(false).firestore();
const settingsRef = () => db().doc('groupMeetBookingSettings/host');
const bookings = () => db().collection('groupMeetBookings');
const guardRef = () => db().doc('groupMeetBookingSettings/reservationGuard');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
type Operation = { action: 'create' | 'reschedule' | 'cancel'; start: string; end: string; leaseUntil: number; owner: string; attempted?: boolean };
export type BookingRecord = BookingSlot & {
  name: string; email: string; status: 'pending' | 'scheduled' | 'cancelled'; managementToken: string;
  slug: string; calendarId: string; eventId: string; meetLink: string | null; bufferMinutes: number;
  blockedUntil: string; operation: Operation | null; fingerprint: string; createdAt: string;
};
export async function getBookingProfile(): Promise<BookingProfile> {
  const doc = await settingsRef().get();
  return doc.exists ? doc.data() as BookingProfile : { ...DEFAULT_BOOKING_PROFILE };
}
export async function saveBookingProfile(profile: BookingProfile) {
  await db().runTransaction(async tx => {
    await tx.get(guardRef());
    tx.set(settingsRef(), profile);
    tx.set(guardRef(), { revision: randomUUID() });
  });
}
export async function requirePublicProfile(slug: unknown) {
  const p = await getBookingProfile();
  if (!p.enabled || typeof slug !== 'string' || p.slug !== slug) throw new BookingError('This booking page is unavailable.', 404);
  return p;
}
export async function googleBookingRequest(calendarId: string, path: string, method = 'GET', body?: unknown) {
  if (process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true') throw new BookingError('Calendar operations are disabled in the test environment.', 503);
  const { accessToken } = await getGoogleCalendarAuth();
  const url = path === 'freeBusy' ? 'https://www.googleapis.com/calendar/v3/freeBusy'
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/${path}`;
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data };
}
async function readBusy(profile: BookingProfile, calendarId = getGoogleCalendarId()): Promise<BookingSlot[]> {
  const now = Date.now();
  const result = await googleBookingRequest(calendarId, 'freeBusy', 'POST', {
    timeMin: new Date(now - 86400000).toISOString(),
    timeMax: new Date(now + (profile.horizonDays + 1) * 86400000).toISOString(), items: [{ id: calendarId }],
  });
  const calendar = result.data.calendars?.[calendarId];
  if (!result.ok || !calendar || calendar.errors?.length || !Array.isArray(calendar.busy))
    throw new BookingError('Calendar availability is temporarily unavailable. Please try again.', 503);
  if (!calendar.busy.every((b: BookingSlot) => Number.isFinite(Date.parse(b.start)) && Number.isFinite(Date.parse(b.end))))
    throw new BookingError('Calendar availability is temporarily unavailable. Please try again.', 503);
  return calendar.busy;
}
function recordBlocks(record: BookingRecord): BookingSlot[] {
  if (record.status === 'cancelled') return [];
  const result: BookingSlot[] = [{ start: record.start, end: record.end }];
  if (record.operation && record.operation.action !== 'cancel') result.push(record.operation);
  return result;
}
export async function listBookingSlots(profile: BookingProfile, duration: number) {
  const [busy, reservations] = await Promise.all([
    readBusy(profile), bookings().where('blockedUntil', '>=', new Date().toISOString()).get(),
  ]);
  const slots = generateBookingSlots(profile, duration, busy);
  return slots.filter(slot => !reservations.docs.some(doc => {
    const record = doc.data() as BookingRecord;
    return recordBlocks(record).some(block => overlaps(slot, block, Math.max(profile.bufferMinutes, record.bufferMinutes)));
  }));
}
function validateSlot(profile: BookingProfile, start: unknown, duration: unknown): BookingSlot {
  if (typeof start !== 'string' || !Number.isInteger(duration) || !Number.isFinite(Date.parse(start)))
    throw new BookingError('Choose an available meeting time.');
  const slot = generateBookingSlots(profile, duration as number, []).find(s => s.start === start);
  if (!slot) throw new BookingError('That time is no longer available. Choose another time.', 409);
  return slot;
}
function safeBooking(b: BookingRecord) {
  return { name: b.name, start: b.start, end: b.end, status: b.status, meetLink: b.meetLink,
    managementToken: b.managementToken, updating: Boolean(b.operation),
    pendingAction: b.operation ? { action: b.operation.action, start: b.operation.start, end: b.operation.end } : null };
}
export async function findBooking(token: unknown) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new BookingError('Booking not found.', 404);
  const snapshot = await bookings().where('managementToken', '==', token).limit(1).get();
  if (snapshot.empty) throw new BookingError('Booking not found.', 404);
  return { ref: snapshot.docs[0].ref, record: snapshot.docs[0].data() as BookingRecord };
}
export { safeBooking };
/** Persistent throttles work across serverless instances. No raw IP addresses are stored. */
export async function limitBookingRequests(req: NextApiRequest, write: boolean) {
  const ip = String(req.headers['x-nf-client-connection-ip'] || req.socket.remoteAddress || 'unknown');
  const bucket = Math.floor(Date.now() / 600000);
  const ref = db().doc(`groupMeetBookingLimits/${hash(`${ip}:${write}`)}`);
  await db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const count = snap.data()?.bucket === bucket ? Number(snap.data()?.count || 0) : 0;
    if (count >= (write ? 20 : 120)) throw new BookingError('Too many requests. Please try again in a few minutes.', 429);
    tx.set(ref, { bucket, count: count + 1, expiresAt: new Date((bucket + 2) * 600000) });
  });
}
export function bookingApiError(res: NextApiResponse, error: unknown) {
  if (error instanceof BookingError) return res.status(error.status).json({ error: error.message });
  // Do not expose credentials, provider payloads, or guest information.
  console.error('[group-meet-booking] Request failed:', error instanceof Error ? error.name : 'unknown');
  return res.status(503).json({ error: 'Booking could not be confirmed yet. Please retry the same request.' });
}
async function reserveOperation(ref: FirebaseFirestore.DocumentReference, profile: BookingProfile,
  action: Operation['action'], slot: BookingSlot, initial?: BookingRecord) {
  const owner = randomUUID();
  return db().runTransaction(async tx => {
    // All scheduling and settings transactions share a guard, avoiding phantom reservations.
    await tx.get(guardRef());
    const [current, latestProfile, reservations] = await Promise.all([
      tx.get(ref), tx.get(settingsRef()), tx.get(bookings().where('blockedUntil', '>=', new Date().toISOString())),
    ]);
    const record = current.exists ? current.data() as BookingRecord : initial;
    if (!record) throw new BookingError('Booking not found.', 404);
    if (initial && record.fingerprint !== initial.fingerprint) throw new BookingError('Use a new request for a different meeting.', 409);
    if (action === 'create' && record.status === 'scheduled') return { record, complete: true };
    if (record.status === 'cancelled') {
      if (action === 'cancel') return { record, complete: true };
      throw new BookingError('This booking has been cancelled.', 409);
    }
    if (record.operation?.leaseUntil && record.operation.leaseUntil > Date.now())
      throw new BookingError('Your booking update is still being confirmed. Please retry the same request shortly.', 409);
    if (record.operation && (record.operation.action !== action || record.operation.start !== slot.start || record.operation.end !== slot.end))
      throw new BookingError('Please retry your previous booking update before making another change.', 409);
    if (action !== 'cancel' && !record.operation) {
      const latest = latestProfile.exists ? latestProfile.data() as BookingProfile : DEFAULT_BOOKING_PROFILE;
      if (!latest.enabled || JSON.stringify(latest) !== JSON.stringify(profile)) {
        // Compare normalized fields, since Firestore does not preserve object key order.
        if (!latest.enabled || Object.keys(profile).some(key => JSON.stringify(latest[key as keyof BookingProfile]) !== JSON.stringify(profile[key as keyof BookingProfile])))
          throw new BookingError('Availability settings changed. Please refresh and choose a time.', 409);
      }
      for (const other of reservations.docs) {
        if (other.id === ref.id) continue;
        const b = other.data() as BookingRecord;
        if (recordBlocks(b).some(block => overlaps(slot, block, Math.max(profile.bufferMinutes, b.bufferMinutes))))
          throw new BookingError('That time was just booked. Choose another time.', 409);
      }
    }
    const operation = { action, start: slot.start, end: slot.end, owner, attempted: record.operation?.attempted || false, leaseUntil: Date.now() + 120000 };
    const next = { ...record, operation, blockedUntil: new Date(Math.max(Date.parse(record.end), Date.parse(slot.end)) + 120 * 60000).toISOString() };
    tx.set(ref, next);
    tx.set(guardRef(), { revision: randomUUID() });
    return { record: next, complete: false };
  });
}
async function releaseOperation(ref: FirebaseFirestore.DocumentReference, record: BookingRecord, definitiveFailure = false) {
  await db().runTransaction(async tx => {
    await tx.get(guardRef());
    const snap = await tx.get(ref);
    if (snap.data()?.operation?.owner !== record.operation?.owner) return;
    if (definitiveFailure && record.operation?.action === 'create') tx.delete(ref);
    else tx.update(ref, { operation: definitiveFailure ? null : { ...record.operation, leaseUntil: 0 } });
    tx.set(guardRef(), { revision: randomUUID() });
  });
}
async function completeOperation(ref: FirebaseFirestore.DocumentReference, record: BookingRecord, event: Record<string, any>) {
  const operation = record.operation!;
  const next: BookingRecord = { ...record, start: operation.start, end: operation.end,
    status: operation.action === 'cancel' ? 'cancelled' : 'scheduled', operation: null,
    meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.find((p: {entryPointType: string}) => p.entryPointType === 'video')?.uri || record.meetLink,
    blockedUntil: new Date(Date.parse(operation.end) + 120 * 60000).toISOString() };
  await db().runTransaction(async tx => {
    await tx.get(guardRef());
    const snap = await tx.get(ref);
    if (snap.data()?.operation?.owner !== operation.owner) throw new BookingError('Booking update is still being confirmed. Please retry.', 409);
    tx.set(ref, next);
    tx.set(guardRef(), { revision: randomUUID() });
  });
  return safeBooking(next);
}
async function executeOperation(ref: FirebaseFirestore.DocumentReference, record: BookingRecord, profile: BookingProfile) {
  const operation = record.operation!;
  let attemptedWrite = Boolean(operation.attempted);
  let definitiveFailure = false;
  const markWrite = async () => {
    await db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.operation?.owner !== operation.owner) throw new BookingError('Your booking update is still being confirmed. Please retry shortly.', 409);
      tx.update(ref, { operation: { ...operation, attempted: true } });
    });
    operation.attempted = true; attemptedWrite = true;
  };
  try {
    const eventPath = `events/${record.eventId}`;
    const existing = await googleBookingRequest(record.calendarId, eventPath);
    if (!existing.ok && ![404, 410].includes(existing.status)) throw new BookingError('Calendar is temporarily unavailable. Please retry the same request.', 503);
    if (operation.action === 'cancel') {
      if (existing.ok && existing.data.status !== 'cancelled') {
        await markWrite();
        const deleted = await googleBookingRequest(record.calendarId, `${eventPath}?sendUpdates=all`, 'DELETE');
        if (!deleted.ok && ![404,410].includes(deleted.status)) {
          definitiveFailure = [400,401,403,422].includes(deleted.status);
          throw new Error('Calendar cancellation failed');
        }
      }
      return await completeOperation(ref, record, {});
    }
    // Recover a successful provider write if the prior response or database commit was lost.
    if (existing.ok && existing.data.status !== 'cancelled' &&
        Date.parse(existing.data.start?.dateTime) === Date.parse(operation.start) &&
        Date.parse(existing.data.end?.dateTime) === Date.parse(operation.end))
      return await completeOperation(ref, record, existing.data);
    if (operation.action === 'create' && existing.ok) throw new BookingError('This booking was changed on the calendar. Please contact the host.', 409);
    if (operation.action === 'reschedule' && (!existing.ok || existing.data.status === 'cancelled'))
      throw new BookingError('This meeting is no longer on the calendar. Please contact the host.', 409);
    const busy = operation.action === 'reschedule' ? await readBusyExcludingEvent(profile, record) : await readBusy(profile, record.calendarId);
    if (busy.some(block => overlaps(operation, block, profile.bufferMinutes))) {
      await releaseOperation(ref, record, true);
      throw new BookingError('That time is no longer available. Choose another time.', 409);
    }
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || 'https://fitwithpulse.ai').replace(/\/+$/, '');
    const payload = {
      ...(operation.action === 'create' ? { id: record.eventId,
        summary: `${profile.name} / ${record.name}`,
        description: `Individual meeting booked through GroupMeet.\n\nReschedule or cancel: ${baseUrl}/group-meet/booking/${record.managementToken}`,
        attendees: [{ email: record.email, displayName: record.name }],
        guestsCanModify: false, guestsCanInviteOthers: false, visibility: 'private',
        conferenceData: { createRequest: { requestId: record.eventId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      } : {}),
      start: { dateTime: operation.start, timeZone: profile.timezone },
      end: { dateTime: operation.end, timeZone: profile.timezone },
    };
    await markWrite();
    const result = await googleBookingRequest(record.calendarId,
      `${operation.action === 'create' ? 'events' : eventPath}?conferenceDataVersion=1&sendUpdates=all`,
      operation.action === 'create' ? 'POST' : 'PATCH', payload);
    if (!result.ok || !result.data.id) {
      definitiveFailure = [400,401,403,422].includes(result.status);
      throw new Error('Calendar update not confirmed');
    }
    return await completeOperation(ref, record, result.data);
  } catch (error) {
    // Keep uncertain reservations until the same request reconciles its deterministic event ID.
    // A failure before any write is safe to abandon, except when recovering an earlier write.
    await releaseOperation(ref, record, definitiveFailure || !attemptedWrite).catch(() => undefined);
    if (attemptedWrite && !(error instanceof BookingError))
      throw new BookingError('Booking could not be confirmed yet. Please retry the same request.', 503);
    throw error;
  }
}
export async function createIndividualBooking(profile: BookingProfile, input: any) {
  if (!input || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 100 ||
      typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
      typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(input.requestId))
    throw new BookingError('Enter your name and a valid email address.');
  const fingerprint = hash(JSON.stringify([input.name.trim(), input.email.trim().toLowerCase(), input.start, input.duration]));
  const id = hash(input.requestId);
  const ref = bookings().doc(id);
  const current = await ref.get();
  const saved = current.data() as BookingRecord | undefined;
  if (saved && saved.fingerprint !== fingerprint) throw new BookingError('Use a new request for a different meeting.', 409);
  if (saved?.status === 'scheduled') return safeBooking(saved);
  const slot = saved?.operation ? { start: saved.operation.start, end: saved.operation.end } : validateSlot(profile, input.start, input.duration);
  const record: BookingRecord = { ...slot, name: input.name.trim(), email: input.email.trim().toLowerCase(),
    status: 'pending', slug: profile.slug, managementToken: randomBytes(32).toString('hex'), calendarId: getGoogleCalendarId(), eventId: `b${id}`,
    meetLink: null, bufferMinutes: profile.bufferMinutes, blockedUntil: slot.end, operation: null, fingerprint,
    createdAt: new Date().toISOString() };
  const reserved = await reserveOperation(ref, profile, 'create', slot, record);
  return reserved.complete ? safeBooking(reserved.record) : executeOperation(ref, reserved.record, profile);
}
export async function changeIndividualBooking(token: unknown, input: any) {
  const { ref, record } = await findBooking(token);
  const profile = await getBookingProfile();
  if (input?.action === 'retry' && record.operation) {
    const reserved = await reserveOperation(ref, profile, record.operation.action, record.operation);
    return reserved.complete ? safeBooking(reserved.record) : executeOperation(ref, reserved.record, profile);
  }
  if (input?.action === 'retry') return safeBooking(record);
  if (!['cancel', 'reschedule'].includes(input?.action)) throw new BookingError('Choose cancel or reschedule.');
  if (record.status === 'cancelled' && input.action === 'cancel') return safeBooking(record);
  if (Date.parse(record.start) <= Date.now() && !record.operation) throw new BookingError('This meeting has already started. Please contact the host.', 409);
  let slot: BookingSlot = { start: record.start, end: record.end };
  if (input.action === 'reschedule') {
    if (!record.operation && record.status === 'scheduled' && input.start === record.start && input.duration * 60000 === Date.parse(record.end) - Date.parse(record.start)) return safeBooking(record);
    if (record.operation) {
      if (record.operation.start !== input.start || Date.parse(record.operation.end) - Date.parse(record.operation.start) !== input.duration * 60000)
        throw new BookingError('Please retry your previous booking update before making another change.', 409);
      slot = record.operation;
    } else {
      if (!profile.enabled) throw new BookingError('Rescheduling is unavailable. Please contact the host.', 409);
      slot = validateSlot(profile, input.start, input.duration);
    }
  }
  const reserved = await reserveOperation(ref, profile, input.action, slot);
  return reserved.complete ? safeBooking(reserved.record) : executeOperation(ref, reserved.record, profile);
}

/** Events expansion is needed for rescheduling: free/busy cannot subtract one event safely. */
async function readBusyExcludingEvent(profile: BookingProfile, record: BookingRecord): Promise<BookingSlot[]> {
  const now = Date.now();
  const blocks: BookingSlot[] = [];
  let pageToken = '';
  const midnight = (date: string, zone: string) => {
    const base = Date.parse(`${date}T00:00:00Z`);
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    let instant = base;
    for (let i = 0; i < 5; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value]));
      const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
      if (local === base) break;
      instant += base - local;
    }
    return new Date(instant).toISOString();
  };
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ timeMin: new Date(now - 86400000).toISOString(),
      timeMax: new Date(now + (profile.horizonDays + 1) * 86400000).toISOString(), singleEvents: 'true', maxResults: '2500',
      ...(pageToken ? { pageToken } : {}), });
    const result = await googleBookingRequest(record.calendarId, `events?${params}`);
    if (!result.ok || !Array.isArray(result.data.items)) throw new BookingError('Calendar availability is temporarily unavailable. Please try again.', 503);
    for (const event of result.data.items) {
      if (event.id === record.eventId || event.status === 'cancelled' || event.transparency === 'transparent' ||
          event.attendees?.some((a: {self?: boolean; responseStatus?: string}) => a.self && a.responseStatus === 'declined')) continue;
      const zone = result.data.timeZone || profile.timezone;
      const start = event.start?.dateTime || (event.start?.date ? midnight(event.start.date, zone) : null);
      const end = event.end?.dateTime || (event.end?.date ? midnight(event.end.date, zone) : null);
      if (!start || !end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)))
        throw new BookingError('Calendar availability is temporarily unavailable. Please try again.', 503);
      blocks.push({ start, end });
    }
    pageToken = result.data.nextPageToken || '';
    if (!pageToken) return blocks;
  }
  throw new BookingError('Calendar availability is temporarily unavailable. Please try again.', 503);
}
export async function listRescheduleSlots(token: unknown, duration: number) {
  const { ref, record } = await findBooking(token);
  const profile = await getBookingProfile();
  if (!profile.enabled || record.status !== 'scheduled' || record.operation || Date.parse(record.start) <= Date.now())
    throw new BookingError('This meeting cannot be rescheduled right now.', 409);
  const [busy, reservations] = await Promise.all([readBusyExcludingEvent(profile, record),
    bookings().where('blockedUntil', '>=', new Date().toISOString()).get()]);
  return generateBookingSlots(profile, duration, busy).filter(slot => !reservations.docs.some(doc => {
    if (doc.id === ref.id) return false;
    const b = doc.data() as BookingRecord;
    return recordBlocks(b).some(block => overlaps(slot, block, Math.max(profile.bufferMinutes, b.bufferMinutes)));
  }));
}
/** A saved request can be reconciled after the host pauses or renames their booking page. */
export async function resolveCreateProfile(slug: unknown, input: {requestId?: unknown}) {
  const profile = await getBookingProfile();
  if (profile.enabled && profile.slug === slug) return profile;
  if (typeof input?.requestId === 'string' && /^[a-zA-Z0-9-]{20,80}$/.test(input.requestId)) {
    const record = (await bookings().doc(hash(input.requestId)).get()).data() as BookingRecord | undefined;
    if (record && record.slug === slug) return profile;
  }
  throw new BookingError('This booking page is unavailable.', 404);
}
export async function refreshBookingMeetingLink(ref: FirebaseFirestore.DocumentReference, record: BookingRecord) {
  if (record.status !== 'scheduled' || record.meetLink || record.operation) return record;
  try {
    const result = await googleBookingRequest(record.calendarId, `events/${record.eventId}`);
    const link = result.data.hangoutLink || result.data.conferenceData?.entryPoints?.find((p: {entryPointType: string}) => p.entryPointType === 'video')?.uri;
    if (result.ok && link) {
      await ref.update({ meetLink: link });
      return { ...record, meetLink: link };
    }
  } catch { /* An already confirmed booking remains usable while Meet is being created. */ }
  return record;
}
/** Verify against the same Firebase project that owns booking records. No localhost/dev bypass. */
export async function requireBookingAdmin(req: NextApiRequest) {
  if (req.headers['x-force-dev-firebase'] === 'true' || req.headers['x-force-dev-firebase'] === '1' ||
      req.headers['x-pulsecheck-firebase-mode'] === 'dev' || req.headers['x-pulsecheck-dev-firebase'] === 'true' ||
      req.headers['x-pulsecheck-dev-firebase'] === '1') return null;
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const app = getFirebaseAdminApp(false);
    const decoded = await app.auth().verifyIdToken(header.slice(7), true);
    if (!decoded.email) return null;
    const candidates = [...new Set([decoded.email, decoded.email.toLowerCase(), decoded.email.toUpperCase()])];
    for (const email of candidates) if ((await app.firestore().doc(`admin/${email}`).get()).exists) return { email };
  } catch { return null; }
  return null;
}
