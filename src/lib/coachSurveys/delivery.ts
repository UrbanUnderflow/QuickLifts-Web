import { coachEmail } from './messages';
import { cadenceDays, effectiveSchedule, type TeamCadence } from './cadence';
import { randomBytes } from 'crypto';
import { CADENCE_DAYS, VERSION } from './questionnaire';
import { COLLECTION, ROOT, tokenDigest } from './service';

export const DELIVERY_RELEASE_APPROVED = false;
export const enrollmentIdFor = (participantId: string, programId: string) => tokenDigest(JSON.stringify([participantId, programId]));
export type Channel = 'email' | 'sms';
export type Enrollment = {
  cadenceDaysOverride?: number | null; cadenceChangedAtMs?: number;
  enabled: boolean; stoppedAtMs?: number; participantId: string; programId: string; teamId: string;
  baselineResponseId: string; startDate: string; endDate: string; timeZone: string; sendHour: number;
  messageVersion: 'coach-check-in-v1'; approved: boolean;
  channels: Partial<Record<Channel, { destination: string; consentRecordedAtMs: number; recipientVerifiedAtMs: number; suppressed: boolean }>>;
};
export function validateEnrollment(v: Enrollment): Enrollment {
  cadenceDays(v?.cadenceDaysOverride);
  if (!v || !['participantId', 'programId', 'teamId'].every(k => /^[A-Za-z0-9_-]{1,128}$/.test(String(v[k as keyof Enrollment] || '')))) throw Error('Verified participant, program and team are required.');
  if (!/^[a-f0-9]{64}$/.test(v.baselineResponseId || '')) throw Error('Completed baseline linkage is required.');
  for (const d of [v.startDate, v.endDate]) if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || !Number.isFinite(Date.parse(d)) || new Date(d).toISOString().slice(0, 10) !== d) throw Error('Valid start and stop dates are required.');
  if (v.endDate < v.startDate || !Number.isInteger(v.sendHour) || v.sendHour < 0 || v.sendHour > 23) throw Error('Review schedule dates and local hour.');
  new Intl.DateTimeFormat('en-US', { timeZone: v.timeZone }).format();
  if (!v.timeZone || !v.channels || !Object.keys(v.channels).length || Object.keys(v.channels).some(c => !['email', 'sms'].includes(c))) throw Error('Choose approved channels.');
  for (const [channel, c] of Object.entries(v.channels)) {
    if (!c || !Number.isFinite(c.consentRecordedAtMs) || c.consentRecordedAtMs <= 0 || !Number.isFinite(c.recipientVerifiedAtMs) || c.recipientVerifiedAtMs <= 0 || typeof c.suppressed !== 'boolean') throw Error('Each channel needs recipient verification, consent and suppression state.');
    if (!(channel === 'sms' ? /^\+[1-9]\d{9,14}$/ : /^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/).test(c.destination)) throw Error('Invalid recipient address.');
  }
  if (v.messageVersion !== 'coach-check-in-v1') throw Error('Review message wording.');
  return v;
}
// Calendar-day cadence preserves the local hour across daylight saving changes.
// A missed send window is surfaced operationally, never caught up as a burst.
export function duePeriod(v: Enrollment, now: Date, team: TeamCadence = {}): string | null {
  validateEnrollment(v);
  if (v.enabled !== true || v.approved !== true || v.stoppedAtMs) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: v.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const schedule = effectiveSchedule(v,team);
  const elapsed = (Date.parse(day) - Date.parse(schedule.startDate)) / 86400000;
  return day >= schedule.startDate && day <= v.endDate && elapsed % schedule.days === 0 && Number(parts.hour) >= v.sendHour ? day : null;
}
export function messageFor(link: string, stopLink: string, days=21) {
  return {...coachEmail('check-in',link,stopLink,days),link,stopLink,
    sms: `AthleticMind: Your coach check-in is ready: ${link} Reply STOP to opt out. Manage check-ins: ${stopLink}`};
}
export type SendResult = { status: 'sent' | 'suppressed' | 'retryable' | 'uncertain'; messageId?: string };
export type DeliveryDependencies = {
  // Must revalidate active team/organization and coach membership, account closure,
  // channel opt-out state, and destination ownership immediately before dispatch.
  eligible: (enrollment: Enrollment, channel: Channel) => Promise<boolean>;
  send: (channel: Channel, destination: string, message: ReturnType<typeof messageFor>, idempotencyKey: string) => Promise<SendResult>;
};
export async function runCoachSurveyDeliveries(db: FirebaseFirestore.Firestore, now: Date, origin: string, deps: DeliveryDependencies) {
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(origin)) throw Error('Use an approved HTTPS origin.');
  const root = db.collection(COLLECTION).doc(ROOT);
  const enrollments = await root.collection('enrollments').limit(101).get();
  const stats = { sent: 0, held: 0, skipped: 0 };
  if (enrollments.docs.length > 100) return { ...stats, held: enrollments.docs.length }; // Review pagination before expanding this pilot.
  const startedAt = Date.now();
  for (const doc of enrollments.docs) {
    if (Date.now() - startedAt > 20000) break;
    let v: Enrollment, period: string | null;
    try { v = validateEnrollment(doc.data() as Enrollment); if (doc.id !== enrollmentIdFor(v.participantId, v.programId)) throw Error('Noncanonical enrollment'); period = duePeriod(v, now, (await root.collection('team-settings').doc(v.teamId).get()).data()); } catch { stats.held++; continue; }
    if (!period) { stats.skipped++; continue; }
    const schedule = effectiveSchedule(v,(await root.collection('team-settings').doc(v.teamId).get()).data());
    const baseline = (await root.collection('responses').doc(v.baselineResponseId).get()).data();
    if (!baseline || baseline.kind !== 'baseline' || baseline.participantId !== v.participantId || baseline.programId !== v.programId) { stats.held++; continue; }
    const packetRef = root.collection('delivery-packets').doc(tokenDigest(JSON.stringify([doc.id, period])));
    const packet = await db.runTransaction(async tx => {
      const prior = (await tx.get(packetRef)).data(); if (prior) return prior;
      const token = randomBytes(32).toString('base64url'), stopToken = randomBytes(32).toString('base64url');
      const created = { token, stopToken, period, enrollmentId: doc.id, recallDays:schedule.days };
      tx.create(packetRef, created);
      tx.create(root.collection('invitations').doc(tokenDigest(token)), { enabled: true, version: VERSION, kind: 'check-in', recallDays:schedule.days, teamId:v.teamId, participantId: v.participantId, programId: v.programId, periodId: period, baselineResponseId: v.baselineResponseId, enrollmentId: doc.id, opensAtMs: now.getTime(), expiresAtMs: now.getTime() + 21 * 86400000 });
      tx.create(root.collection('stop-tokens').doc(tokenDigest(stopToken)), { enrollmentId: doc.id });
      return created;
    });
    for (const channel of Object.keys(v.channels) as Channel[]) {
      const delivery = root.collection('deliveries').doc(tokenDigest(JSON.stringify([doc.id, period, channel])));
      const claimed = await db.runTransaction(async tx => {
        const prior = (await tx.get(delivery)).data();
        // A stale 'sending' claim remains held. Reclaiming could duplicate a send
        // accepted by the provider before a process crash. Reconcile manually.
        if (prior && (prior.status !== 'retryable' || prior.attempts >= 3 || prior.retryAtMs > now.getTime())) return false;
        tx.set(delivery, { enrollmentId: doc.id, period, channel, status: 'sending', attempts: (prior?.attempts || 0) + 1, updatedAtMs: now.getTime() }); return true;
      });
      if (!claimed) { stats.skipped++; continue; }
      let outcome: SendResult = { status: 'uncertain' };
      try {
        const current = validateEnrollment((await doc.ref.get()).data() as Enrollment);
        const target = current.channels[channel];
        if (duePeriod(current, now, (await root.collection('team-settings').doc(current.teamId).get()).data()) !== period || !target || target.suppressed || target.destination !== v.channels[channel]?.destination || !(await deps.eligible(current, channel))) outcome = { status: 'suppressed' };
        else outcome = await deps.send(channel, target.destination, messageFor(`${origin}/PulseCheck/coach-survey/check-in#token=${packet.token}`, `${origin}/PulseCheck/coach-survey/stop#token=${packet.stopToken}`, packet.recallDays || CADENCE_DAYS), delivery.id);
      } catch { outcome = { status: 'uncertain' }; }
      await delivery.set({ ...outcome, updatedAtMs: now.getTime(), ...(outcome.status === 'retryable' ? { retryAtMs: now.getTime() + 3600000 } : {}) }, { merge: true });
      if (outcome.status === 'sent') stats.sent++; else stats.held++;
    }
  }
  return stats;
}
