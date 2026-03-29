import type { Handler } from '@netlify/functions';
import {
  buildEmailDedupeKey,
  escapeHtml,
  getBaseSiteUrl,
  resolveRecipient,
  resolveSequenceTemplate,
  sendBrevoTransactionalEmail,
  toMillis,
} from './utils/emailSequenceHelpers';

type SendResponse = {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
};

type RequestBody = {
  userId?: string;
  toEmail?: string;
  firstName?: string;
  clubId?: string;
  eventId?: string;
  eventTitle?: string;
  locationName?: string;
  address?: string;
  timezoneIdentifier?: string;
  eventStartDate?: any;
  eventEndDate?: any;
  attendeeCount?: number;
  firstCheckinAt?: any;
  lastCheckinAt?: any;
  authMethodSummary?: string;
  platformSummary?: string;
  shareDrivenCheckins?: number;
  isTest?: boolean;
  subjectOverride?: string;
  htmlOverride?: string;
  scheduledAt?: string;
};

const DEFAULT_TIME_ZONE = 'UTC';

function normalizeTimeZone(value?: string): string {
  const candidate = (value || '').trim() || DEFAULT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function getDisplayLocation(locationName?: string, address?: string): string {
  const trimmedLocationName = (locationName || '').trim();
  const trimmedAddress = (address || '').trim();

  if (trimmedLocationName && trimmedAddress) {
    return `${trimmedLocationName} • ${trimmedAddress}`;
  }

  if (trimmedLocationName) {
    return trimmedLocationName;
  }

  if (trimmedAddress) {
    return trimmedAddress;
  }

  return 'Location TBD';
}

function formatDateLabel(timestampMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestampMs));
}

function formatTimeLabel(timestampMs: number, timeZone: string, includeTimeZoneName = false): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    ...(includeTimeZoneName ? { timeZoneName: 'short' as const } : {}),
  }).format(new Date(timestampMs));
}

function formatDateTimeLabel(timestampMs: number, timeZone: string): string {
  return `${formatDateLabel(timestampMs, timeZone)} • ${formatTimeLabel(timestampMs, timeZone, true)}`;
}

function isSameDayInTimeZone(leftMs: number, rightMs: number, timeZone: string): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date(leftMs)) === formatter.format(new Date(rightMs));
}

function formatEventWindow(startMs: number | null, endMs: number | null, timeZone: string): string {
  if (startMs && endMs) {
    if (isSameDayInTimeZone(startMs, endMs, timeZone)) {
      return `${formatDateLabel(startMs, timeZone)} • ${formatTimeLabel(startMs, timeZone)} - ${formatTimeLabel(endMs, timeZone, true)}`;
    }

    return `${formatDateTimeLabel(startMs, timeZone)} - ${formatDateTimeLabel(endMs, timeZone)}`;
  }

  const fallbackMs = startMs || endMs;
  return fallbackMs ? formatDateTimeLabel(fallbackMs, timeZone) : 'Time TBD';
}

function metricRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid #2a2f36;font-size:13px;font-weight:700;color:#8e8e95;vertical-align:top;width:180px;">
      ${escapeHtml(label)}
    </td>
    <td style="padding:12px 0;border-bottom:1px solid #2a2f36;font-size:14px;line-height:1.6;color:#f4f4f5;">
      ${escapeHtml(value)}
    </td>
  </tr>`;
}

function renderFallbackHtml(args: {
  firstName: string;
  eventTitle: string;
  eventWindow: string;
  location: string;
  attendeeCount: number;
  firstCheckinLabel: string;
  lastCheckinLabel: string;
  authMethodSummary: string;
  platformSummary: string;
  shareDrivenSummary: string;
  clubUrl: string;
}): string {
  const attendeeLabel = `${args.attendeeCount} attendee${args.attendeeCount === 1 ? '' : 's'}`;
  const intro =
    args.attendeeCount > 0
      ? `We recorded ${attendeeLabel} for ${args.eventTitle}.`
      : `No event check-ins were recorded for ${args.eventTitle}, but your post-event report is ready.`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#0b0b0b;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0b0b;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background:#15171b;border:1px solid #2a2f36;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px;font-family:Arial,sans-serif;color:#f4f4f5;">
                <p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#8e8e95;">
                  IRL Event Report
                </p>
                <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.2;color:#e0fe10;">
                  ${escapeHtml(args.eventTitle)}
                </h1>
                <p style="margin:0 0 18px 0;font-size:14px;line-height:1.7;color:#d4d4d8;">
                  ${escapeHtml(args.firstName)}, ${escapeHtml(intro)}
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 20px 0;">
                  ${metricRow('Event window', args.eventWindow)}
                  ${metricRow('Location', args.location)}
                  ${metricRow('Total attendees', attendeeLabel)}
                  ${metricRow('First check-in', args.firstCheckinLabel)}
                  ${metricRow('Last check-in', args.lastCheckinLabel)}
                  ${metricRow('Auth methods', args.authMethodSummary)}
                  ${metricRow('Platforms', args.platformSummary)}
                  ${metricRow('Share-driven check-ins', args.shareDrivenSummary)}
                </table>

                <p style="margin:0 0 20px 0;">
                  <a href="${escapeHtml(args.clubUrl)}" style="display:inline-block;background:#e0fe10;color:#101113;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">
                    Open Club
                  </a>
                </p>

                <p style="margin:0;font-size:12px;line-height:1.7;color:#8e8e95;">
                  Pulse generated this summary from event QR check-ins and check-in attribution data.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' } satisfies SendResponse),
    };
  }

  try {
    const body = (event.body ? JSON.parse(event.body) : {}) as RequestBody;
    const {
      userId,
      toEmail,
      firstName,
      clubId,
      eventId,
      eventTitle,
      locationName,
      address,
      timezoneIdentifier,
      eventStartDate,
      eventEndDate,
      attendeeCount,
      firstCheckinAt,
      lastCheckinAt,
      authMethodSummary,
      platformSummary,
      shareDrivenCheckins,
      isTest,
      subjectOverride,
      htmlOverride,
      scheduledAt,
    } = body;

    const recipient = await resolveRecipient({ userId, toEmail, firstName });
    if (!recipient) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, skipped: true } satisfies SendResponse),
      };
    }

    const siteUrl = getBaseSiteUrl();
    const timeZone = normalizeTimeZone(timezoneIdentifier);
    const nowMs = Date.now();
    const sampleEndMs = nowMs - 60 * 60 * 1000;
    const sampleStartMs = sampleEndMs - 90 * 60 * 1000;

    const effectiveEventTitle = (eventTitle || (isTest ? 'Sunrise Strength Social' : 'IRL Event')).trim() || 'IRL Event';
    const eventStartMs = toMillis(eventStartDate) ?? (isTest ? sampleStartMs : null);
    const eventEndMs = toMillis(eventEndDate) ?? (isTest ? sampleEndMs : null);
    const effectiveAttendeeCount =
      typeof attendeeCount === 'number' && Number.isFinite(attendeeCount)
        ? Math.max(0, Math.floor(attendeeCount))
        : isTest
          ? 18
          : 0;
    const firstCheckinMs = toMillis(firstCheckinAt) ?? (isTest && effectiveAttendeeCount > 0 && eventStartMs ? eventStartMs + 10 * 60 * 1000 : null);
    const lastCheckinMs = toMillis(lastCheckinAt) ?? (isTest && effectiveAttendeeCount > 0 && eventEndMs ? eventEndMs - 5 * 60 * 1000 : null);
    const effectiveAuthMethodSummary = (authMethodSummary || '').trim() || (isTest ? 'Email signup: 9, Existing member: 5, Apple: 4' : 'No check-ins recorded');
    const effectivePlatformSummary = (platformSummary || '').trim() || (isTest ? 'Web: 18' : 'No check-ins recorded');
    const effectiveShareDrivenCheckins =
      typeof shareDrivenCheckins === 'number' && Number.isFinite(shareDrivenCheckins)
        ? Math.max(0, Math.floor(shareDrivenCheckins))
        : isTest
          ? 6
          : 0;

    const location = getDisplayLocation(locationName, address);
    const eventWindow = formatEventWindow(eventStartMs, eventEndMs, timeZone);
    const firstCheckinLabel = firstCheckinMs ? formatDateTimeLabel(firstCheckinMs, timeZone) : 'No check-ins recorded';
    const lastCheckinLabel = lastCheckinMs ? formatDateTimeLabel(lastCheckinMs, timeZone) : 'No check-ins recorded';
    const shareDrivenSummary = `${effectiveShareDrivenCheckins} attendee${effectiveShareDrivenCheckins === 1 ? '' : 's'} via shared QR/link`;
    const clubUrl = clubId ? `${siteUrl}/club/${encodeURIComponent(clubId)}` : `${siteUrl}/manage-clubs`;

    const fallbackSubject = `Your ${effectiveEventTitle} analytics report`;
    const fallbackHtml = renderFallbackHtml({
      firstName: recipient.firstName,
      eventTitle: effectiveEventTitle,
      eventWindow,
      location,
      attendeeCount: effectiveAttendeeCount,
      firstCheckinLabel,
      lastCheckinLabel,
      authMethodSummary: effectiveAuthMethodSummary,
      platformSummary: effectivePlatformSummary,
      shareDrivenSummary,
      clubUrl,
    });

    const template = await resolveSequenceTemplate({
      templateDocId: 'irl-event-analytics-report-v1',
      fallbackSubject,
      fallbackHtml,
      subjectOverride,
      htmlOverride,
      vars: {
        firstName: recipient.firstName,
        first_name: recipient.firstName,
        username: recipient.username,
        clubId: clubId || '',
        club_id: clubId || '',
        clubUrl,
        club_url: clubUrl,
        eventId: eventId || '',
        event_id: eventId || '',
        eventTitle: effectiveEventTitle,
        event_title: effectiveEventTitle,
        eventWindow,
        event_window: eventWindow,
        location,
        eventLocation: location,
        event_location: location,
        attendeeCount: effectiveAttendeeCount,
        attendee_count: effectiveAttendeeCount,
        attendeeLabel: `${effectiveAttendeeCount} attendee${effectiveAttendeeCount === 1 ? '' : 's'}`,
        attendee_label: `${effectiveAttendeeCount} attendee${effectiveAttendeeCount === 1 ? '' : 's'}`,
        firstCheckinAtLabel: firstCheckinLabel,
        first_checkin_at_label: firstCheckinLabel,
        lastCheckinAtLabel: lastCheckinLabel,
        last_checkin_at_label: lastCheckinLabel,
        authMethodSummary: effectiveAuthMethodSummary,
        auth_method_summary: effectiveAuthMethodSummary,
        platformSummary: effectivePlatformSummary,
        platform_summary: effectivePlatformSummary,
        shareDrivenCheckins: effectiveShareDrivenCheckins,
        share_driven_checkins: effectiveShareDrivenCheckins,
        shareDrivenSummary,
        share_driven_summary: shareDrivenSummary,
        timezoneIdentifier: timeZone,
        timezone_identifier: timeZone,
      },
    });

    const idempotencyKey = !isTest
      ? buildEmailDedupeKey(['irl-event-analytics-report-v1', eventId || '', userId || recipient.toEmail || clubId || ''])
      : '';

    const sendResult = await sendBrevoTransactionalEmail({
      toEmail: recipient.toEmail,
      toName: recipient.toName,
      subject: template.subject,
      htmlContent: template.html,
      tags: ['irl-event-analytics-report', isTest ? 'test' : ''],
      scheduledAt,
      idempotencyKey,
      idempotencyMetadata: idempotencyKey
        ? {
            sequence: 'irl-event-analytics-report-v1',
            userId: userId || null,
            clubId: clubId || null,
            eventId: eventId || null,
          }
        : undefined,
    });

    if (!sendResult.success) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: sendResult.error || 'Failed to send' } satisfies SendResponse),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: sendResult.messageId } satisfies SendResponse),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error?.message || 'Internal error' } satisfies SendResponse),
    };
  }
};
