import type { Handler } from '@netlify/functions';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import {
  buildCoachCheckInReminderMessage,
  loadPulseCheckNudgeSuppressionState,
  resolveAthleteFirstName,
  resolvePulseCheckPushTarget,
  sendLoggedNoraPush,
} from './pulsecheck-notification-utils';

const COLLECTION = 'pulsecheck-coach-reminders';
const MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const BATCH_LIMIT = 500;
const WINDOW_MINUTES = 10;

type ReminderKind = 'checkIn' | 'custom';
type ReminderScope = 'athlete' | 'team';
type ReminderRecurrence = 'once' | 'daily';
type ReminderSlot = 'morning' | 'evening';

interface CoachReminderDoc {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  kind: ReminderKind;
  scope: ReminderScope;
  coachId: string;
  teamId: string;
  organizationId: string;
  athleteId?: string;
  title?: string;
  message?: string;
  recurrence?: ReminderRecurrence;
  slot?: ReminderSlot;
  hour: number;
  minute: number;
  startDateKey?: string;
  lastSentLocalDate?: string;
  lastSentLocalDateByAthlete?: Record<string, string>;
}

interface AthleteCandidate {
  athleteId: string;
  membershipId?: string;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localNowFor(nowUtc: Date, timeZone: string): Date | null {
  try {
    return new Date(nowUtc.toLocaleString('en-US', { timeZone }));
  } catch {
    return null;
  }
}

function isWithinWindow(
  currentHour: number,
  currentMinute: number,
  targetHour: number,
  targetMinute: number,
  windowMinutes: number,
): boolean {
  const current = currentHour * 60 + currentMinute;
  const target = targetHour * 60 + targetMinute;
  return Math.abs(current - target) <= windowMinutes;
}

function isActiveMembership(data: Record<string, unknown>): boolean {
  const status = stringValue(data.status).toLowerCase();
  const role = stringValue(data.role).toLowerCase();
  return role === 'athlete'
    && (!status || status === 'active')
    && data.archivedAt == null
    && data.deletedAt == null;
}

function mapReminder(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): CoachReminderDoc | null {
  const data = doc.data() || {};
  const kind = stringValue(data.kind) as ReminderKind;
  const scope = stringValue(data.scope) as ReminderScope;
  const hour = numberValue(data.hour);
  const minute = numberValue(data.minute);
  const coachId = stringValue(data.coachId);
  const teamId = stringValue(data.teamId);
  const organizationId = stringValue(data.organizationId);

  if (!['checkIn', 'custom'].includes(kind) || !['athlete', 'team'].includes(scope)) {
    return null;
  }
  if (!coachId || !teamId || !organizationId || hour == null || minute == null) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  if (kind === 'checkIn' && scope !== 'athlete') {
    return null;
  }

  return {
    id: doc.id,
    ref: doc.ref,
    kind,
    scope,
    coachId,
    teamId,
    organizationId,
    athleteId: stringValue(data.athleteId) || undefined,
    title: stringValue(data.title) || undefined,
    message: stringValue(data.message) || undefined,
    recurrence: stringValue(data.recurrence) as ReminderRecurrence || undefined,
    slot: ['morning', 'evening'].includes(stringValue(data.slot))
      ? stringValue(data.slot) as ReminderSlot
      : undefined,
    hour,
    minute,
    startDateKey: stringValue(data.startDateKey) || undefined,
    lastSentLocalDate: stringValue(data.lastSentLocalDate) || undefined,
    lastSentLocalDateByAthlete:
      data.lastSentLocalDateByAthlete && typeof data.lastSentLocalDateByAthlete === 'object'
        ? data.lastSentLocalDateByAthlete as Record<string, string>
        : undefined,
  };
}

function isDateEligible(reminder: CoachReminderDoc, localDateStr: string): boolean {
  if (reminder.kind === 'checkIn') {
    return true;
  }

  const recurrence = reminder.recurrence || 'once';
  const startDateKey = reminder.startDateKey || localDateStr;
  if (recurrence === 'once') {
    return localDateStr === startDateKey;
  }
  return localDateStr >= startDateKey;
}

function wasAlreadySent(
  reminder: CoachReminderDoc,
  athleteId: string,
  localDateStr: string,
): boolean {
  if (reminder.scope === 'team') {
    return reminder.lastSentLocalDateByAthlete?.[athleteId] === localDateStr;
  }
  return reminder.lastSentLocalDate === localDateStr;
}

async function markSent(
  admin: typeof import('firebase-admin'),
  reminder: CoachReminderDoc,
  athleteId: string,
  localDateStr: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (reminder.scope === 'team') {
    update.lastSentLocalDateByAthlete = { [athleteId]: localDateStr };
    await reminder.ref.set(update, { merge: true });
  } else {
    update.lastSentLocalDate = localDateStr;
    await reminder.ref.update(update);
  }
}

async function loadTeamAthletes(
  db: FirebaseFirestore.Firestore,
  teamId: string,
  cache: Map<string, AthleteCandidate[]>,
): Promise<AthleteCandidate[]> {
  if (cache.has(teamId)) {
    return cache.get(teamId) || [];
  }

  const snap = await db.collection(MEMBERSHIPS_COLLECTION)
    .where('teamId', '==', teamId)
    .limit(500)
    .get();

  const athletes = snap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .filter(({ data }) => isActiveMembership(data))
    .map(({ id, data }) => ({
      athleteId: stringValue(data.userId),
      membershipId: id,
    }))
    .filter((candidate) => candidate.athleteId);

  cache.set(teamId, athletes);
  return athletes;
}

async function resolveAthletesForReminder(
  db: FirebaseFirestore.Firestore,
  reminder: CoachReminderDoc,
  teamCache: Map<string, AthleteCandidate[]>,
): Promise<AthleteCandidate[]> {
  if (reminder.scope === 'athlete') {
    return reminder.athleteId ? [{ athleteId: reminder.athleteId }] : [];
  }
  return loadTeamAthletes(db, reminder.teamId, teamCache);
}

function resolveTimeZone(userData: Record<string, unknown>): string {
  const dailyPrefs = userData.dailyReflectionPreferences;
  if (dailyPrefs && typeof dailyPrefs === 'object') {
    const tz = stringValue((dailyPrefs as Record<string, unknown>).timezone);
    if (tz) return tz;
  }

  const pact = userData.adherencePact;
  if (pact && typeof pact === 'object') {
    const tz = stringValue((pact as Record<string, unknown>).timezone);
    if (tz) return tz;
  }

  return 'America/New_York';
}

function customReminderMessage(reminder: CoachReminderDoc, localDateStr: string) {
  return {
    title: reminder.title || 'Reminder from your coach',
    body: reminder.message || 'Open PulseCheck when you have a moment.',
    subtitle: 'Coach reminder',
    notificationType: 'COACH_CUSTOM_REMINDER',
    data: {
      type: 'COACH_CUSTOM_REMINDER',
      dmKind: 'coach_custom_reminder',
      route: 'nora_chat',
      reminderId: reminder.id,
      localDate: localDateStr,
      timestamp: String(Date.now()),
    },
  };
}

export const handler: Handler = async () => {
  const admin = initAdmin();
  const db = await getFirestore();
  const messaging = admin.messaging();
  const nowUtc = new Date();
  const runId = nowUtc.toISOString();
  const teamCache = new Map<string, AthleteCandidate[]>();

  const summary = {
    runId,
    scanned: 0,
    reminders: 0,
    expandedCandidates: 0,
    eligibleWindow: 0,
    sent: 0,
    skippedInactiveShape: 0,
    skippedNoAthlete: 0,
    skippedTimezone: 0,
    skippedDateGate: 0,
    skippedAlreadySent: 0,
    skippedSuppressed: 0,
    skippedNoPushTarget: 0,
    failed: 0,
  };
  const errors: Array<Record<string, string>> = [];
  const recipients: Array<Record<string, unknown>> = [];

  const snap = await db.collection(COLLECTION)
    .where('active', '==', true)
    .limit(BATCH_LIMIT)
    .get();

  summary.scanned = snap.size;
  const reminders = snap.docs
    .map(mapReminder)
    .filter((reminder): reminder is CoachReminderDoc => {
      if (!reminder) {
        summary.skippedInactiveShape += 1;
        return false;
      }
      return true;
    });
  summary.reminders = reminders.length;

  for (const reminder of reminders) {
    let athleteCandidates: AthleteCandidate[] = [];
    try {
      athleteCandidates = await resolveAthletesForReminder(db, reminder, teamCache);
    } catch (error: any) {
      summary.failed += 1;
      if (errors.length < 10) {
        errors.push({ reminderId: reminder.id, error: error?.message || String(error) });
      }
      continue;
    }

    if (athleteCandidates.length === 0) {
      summary.skippedNoAthlete += 1;
      continue;
    }

    for (const candidate of athleteCandidates) {
      summary.expandedCandidates += 1;
      const athleteId = candidate.athleteId;
      if (!athleteId) {
        summary.skippedNoAthlete += 1;
        continue;
      }

      const userSnap = await db.collection('users').doc(athleteId).get();
      const userData = userSnap.exists ? (userSnap.data() || {}) as Record<string, unknown> : {};
      const timeZone = resolveTimeZone(userData);
      const localNow = localNowFor(nowUtc, timeZone);
      if (!localNow) {
        summary.skippedTimezone += 1;
        continue;
      }

      if (!isWithinWindow(
        localNow.getHours(),
        localNow.getMinutes(),
        reminder.hour,
        reminder.minute,
        WINDOW_MINUTES,
      )) {
        continue;
      }
      summary.eligibleWindow += 1;

      const localDateStr = formatYmd(localNow);
      if (!isDateEligible(reminder, localDateStr)) {
        summary.skippedDateGate += 1;
        continue;
      }
      if (wasAlreadySent(reminder, athleteId, localDateStr)) {
        summary.skippedAlreadySent += 1;
        continue;
      }

      let suppression: { suppressed?: boolean; reason?: string } = { suppressed: false };
      try {
        suppression = await loadPulseCheckNudgeSuppressionState({ db, athleteId });
      } catch {
        suppression = { suppressed: false, reason: 'load_failed' };
      }
      if (suppression?.suppressed) {
        summary.skippedSuppressed += 1;
        continue;
      }

      const target = resolvePulseCheckPushTarget(userData);
      if (!target?.eligible || !target.token) {
        summary.skippedNoPushTarget += 1;
        continue;
      }

      const athleteName = resolveAthleteFirstName(userData);
      const message = reminder.kind === 'checkIn'
        ? buildCoachCheckInReminderMessage({ athleteName, localDate: localDateStr, slot: reminder.slot })
        : customReminderMessage(reminder, localDateStr);

      const result = await sendLoggedNoraPush({
        messaging,
        db,
        userId: athleteId,
        fcmToken: target.token,
        title: message.title,
        body: message.body,
        subtitle: message.subtitle,
        data: {
          ...message.data,
          reminderId: reminder.id,
          coachId: reminder.coachId,
          teamId: reminder.teamId,
          organizationId: reminder.organizationId,
          athleteId,
        },
        notificationType: message.notificationType,
        functionName: 'netlify/scheduled-coach-reminders',
        additionalContext: {
          reminderId: reminder.id,
          reminderKind: reminder.kind,
          reminderScope: reminder.scope,
          coachId: reminder.coachId,
          teamId: reminder.teamId,
          organizationId: reminder.organizationId,
          displayName: stringValue(userData.displayName),
          username: stringValue(userData.username),
          email: stringValue(userData.email),
        },
      });

      recipients.push({
        athleteId,
        reminderId: reminder.id,
        kind: reminder.kind,
        scope: reminder.scope,
        localDate: localDateStr,
        success: result.success,
        messageId: result.messageId || null,
        error: result.error || null,
      });

      if (!result.success) {
        summary.failed += 1;
        if (errors.length < 10) {
          errors.push({
            athleteId,
            reminderId: reminder.id,
            error: result.error || 'Unknown push failure',
          });
        }
        continue;
      }

      await markSent(admin, reminder, athleteId, localDateStr);
      summary.sent += 1;
    }
  }

  await db.collection('notification-logs').add({
    type: 'COACH_REMINDER_BATCH',
    runAt: admin.firestore.FieldValue.serverTimestamp(),
    runId,
    summary,
    recipients,
    errors,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, summary }),
  };
};
