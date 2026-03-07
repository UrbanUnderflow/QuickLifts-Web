import type { Handler } from '@netlify/functions';
import { getFirestore } from './utils/getServiceAccount';
import { getBaseSiteUrl, toMillis } from './utils/emailSequenceHelpers';

const SEND_DELAY_MINUTES = 60;
const WINDOW_LENGTH_MINUTES = 30;
const BATCH_LIMIT = 300;

type CheckinRecord = Record<string, any>;

function toTrimmedString(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getCheckinTimestampMs(data: CheckinRecord): number | null {
  return toMillis(data.checkedInAt ?? data.createdAt ?? data.updatedAt);
}

function humanizeWords(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getAuthMethodLabel(value: string): string {
  switch (value.toLowerCase()) {
    case 'apple':
      return 'Apple';
    case 'email-signup':
      return 'Email signup';
    case 'email-signin':
      return 'Email sign-in';
    case 'existing':
      return 'Existing member';
    case 'unknown':
      return 'Unknown';
    default:
      return humanizeWords(value) || 'Unknown';
  }
}

function getPlatformLabel(value: string): string {
  switch (value.toLowerCase()) {
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    case 'web':
      return 'Web';
    case 'unknown':
      return 'Unknown';
    default:
      return humanizeWords(value) || 'Unknown';
  }
}

function buildBreakdownSummary(
  checkins: CheckinRecord[],
  fieldName: string,
  labeler: (value: string) => string
): string {
  if (!checkins.length) {
    return 'No check-ins recorded';
  }

  const counts = new Map<string, number>();

  for (const checkin of checkins) {
    const rawValue = toTrimmedString(checkin[fieldName]) || 'unknown';
    counts.set(rawValue, (counts.get(rawValue) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => `${labeler(value)}: ${count}`)
    .join(', ');
}

function getCheckinMetrics(checkins: CheckinRecord[]) {
  let firstCheckinAtMs: number | null = null;
  let lastCheckinAtMs: number | null = null;
  let shareDrivenCheckins = 0;

  for (const checkin of checkins) {
    const timestampMs = getCheckinTimestampMs(checkin);
    if (timestampMs) {
      firstCheckinAtMs = firstCheckinAtMs === null ? timestampMs : Math.min(firstCheckinAtMs, timestampMs);
      lastCheckinAtMs = lastCheckinAtMs === null ? timestampMs : Math.max(lastCheckinAtMs, timestampMs);
    }

    if (toTrimmedString(checkin.referredBy)) {
      shareDrivenCheckins++;
    }
  }

  return {
    attendeeCount: checkins.length,
    firstCheckinAtMs,
    lastCheckinAtMs,
    authMethodSummary: buildBreakdownSummary(checkins, 'authMethod', getAuthMethodLabel),
    platformSummary: buildBreakdownSummary(checkins, 'platform', getPlatformLabel),
    shareDrivenCheckins,
  };
}

async function sendIrlEventAnalyticsReport(args: {
  userId?: string;
  clubId?: string;
  eventId?: string;
  eventTitle: string;
  locationName?: string;
  address?: string;
  timezoneIdentifier?: string;
  eventStartDate?: any;
  eventEndDate?: any;
  attendeeCount: number;
  firstCheckinAt?: number | null;
  lastCheckinAt?: number | null;
  authMethodSummary: string;
  platformSummary: string;
  shareDrivenCheckins: number;
}): Promise<{ skipped: boolean }> {
  const resp = await fetch(`${getBaseSiteUrl()}/.netlify/functions/send-irl-event-analytics-report-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: args.userId,
      clubId: args.clubId,
      eventId: args.eventId,
      eventTitle: args.eventTitle,
      locationName: args.locationName,
      address: args.address,
      timezoneIdentifier: args.timezoneIdentifier,
      eventStartDate: args.eventStartDate,
      eventEndDate: args.eventEndDate,
      attendeeCount: args.attendeeCount,
      firstCheckinAt: args.firstCheckinAt,
      lastCheckinAt: args.lastCheckinAt,
      authMethodSummary: args.authMethodSummary,
      platformSummary: args.platformSummary,
      shareDrivenCheckins: args.shareDrivenCheckins,
    }),
  });

  const json = await resp.json().catch(() => ({} as any));
  if (!resp.ok || json?.success === false) {
    throw new Error(json?.error || `HTTP ${resp.status}`);
  }

  return { skipped: Boolean(json?.skipped) };
}

export const handler: Handler = async () => {
  try {
    const db = await getFirestore();
    const nowMs = Date.now();
    const minEndSec = Math.floor((nowMs - (SEND_DELAY_MINUTES + WINDOW_LENGTH_MINUTES) * 60 * 1000) / 1000);
    const maxEndSec = Math.floor((nowMs - SEND_DELAY_MINUTES * 60 * 1000) / 1000);

    const querySnap = await db
      .collectionGroup('events')
      .where('endDate', '>=', minEndSec)
      .where('endDate', '<=', maxEndSec)
      .orderBy('endDate', 'asc')
      .limit(BATCH_LIMIT)
      .get();

    if (querySnap.empty) {
      return { statusCode: 200, body: JSON.stringify({ success: true, scanned: 0, sent: 0, skipped: 0 }) };
    }

    let scanned = 0;
    let sent = 0;
    let skipped = 0;

    for (const doc of querySnap.docs) {
      scanned++;
      const eventData = (doc.data() || {}) as Record<string, any>;
      const state = (eventData.emailSequenceState || {}) as Record<string, any>;

      if (state.irlEventAnalyticsReportSentAt || state.irlEventAnalyticsReportSkippedAt) {
        skipped++;
        continue;
      }

      const eventTitle = toTrimmedString(eventData.title) || 'IRL Event';
      const clubId = toTrimmedString(eventData.clubId) || doc.ref.parent.parent?.id || '';
      const creatorId = toTrimmedString(eventData.creatorId);

      try {
        const checkinsSnap = await doc.ref.collection('checkins').get();
        const checkins = checkinsSnap.docs.map((checkinDoc) => (checkinDoc.data() || {}) as CheckinRecord);
        const metrics = getCheckinMetrics(checkins);

        const sendResult = await sendIrlEventAnalyticsReport({
          userId: creatorId || undefined,
          clubId: clubId || undefined,
          eventId: doc.id,
          eventTitle,
          locationName: toTrimmedString(eventData.locationName) || undefined,
          address: toTrimmedString(eventData.address) || undefined,
          timezoneIdentifier: toTrimmedString(eventData.timezoneIdentifier) || undefined,
          eventStartDate: eventData.startDate,
          eventEndDate: eventData.endDate,
          attendeeCount: metrics.attendeeCount,
          firstCheckinAt: metrics.firstCheckinAtMs,
          lastCheckinAt: metrics.lastCheckinAtMs,
          authMethodSummary: metrics.authMethodSummary,
          platformSummary: metrics.platformSummary,
          shareDrivenCheckins: metrics.shareDrivenCheckins,
        });

        const stateField = sendResult.skipped
          ? 'emailSequenceState.irlEventAnalyticsReportSkippedAt'
          : 'emailSequenceState.irlEventAnalyticsReportSentAt';

        await doc.ref.set(
          {
            [stateField]: new Date(),
          } as any,
          { merge: true } as any
        );

        if (sendResult.skipped) {
          skipped++;
        } else {
          sent++;
        }
      } catch (error) {
        console.warn('[schedule-irl-event-analytics-report-email] Failed for event:', doc.id, error);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, scanned, sent, skipped }),
    };
  } catch (error: any) {
    console.error('[schedule-irl-event-analytics-report-email] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }) };
  }
};
