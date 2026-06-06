import type { Handler } from '@netlify/functions';
import { sendBrevoTransactionalEmail } from './utils/emailSequenceHelpers';

type RequestBody = {
  toEmail?: string;
  toName?: string;
  meetingTitle?: string; // e.g. "Meeting 1 — Coach kickoff"
  description?: string;
  startISO?: string; // ISO datetime
  endISO?: string; // ISO datetime (optional; defaults to start + 1h)
  location?: string;
  teamName?: string;
  organizationName?: string;
};

const escapeHtml = (input: string) =>
  (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

// ICS timestamps are UTC: YYYYMMDDTHHMMSSZ
const toIcsStamp = (iso: string) => {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
};

const icsEscape = (input: string) =>
  (input || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const buildIcs = (opts: {
  title: string;
  description: string;
  startISO: string;
  endISO: string;
  location: string;
  organizerEmail: string;
  organizerName: string;
  attendeeEmail: string;
  attendeeName: string;
  uid: string;
}) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulse Intelligence Labs//PulseCheck//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${toIcsStamp(new Date().toISOString())}`,
    `DTSTART:${toIcsStamp(opts.startISO)}`,
    `DTEND:${toIcsStamp(opts.endISO)}`,
    `SUMMARY:${icsEscape(opts.title)}`,
    `DESCRIPTION:${icsEscape(opts.description)}`,
    opts.location ? `LOCATION:${icsEscape(opts.location)}` : '',
    `ORGANIZER;CN=${icsEscape(opts.organizerName)}:mailto:${opts.organizerEmail}`,
    `ATTENDEE;CN=${icsEscape(opts.attendeeName)};RSVP=TRUE:mailto:${opts.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
};

const googleCalendarUrl = (opts: { title: string; description: string; startISO: string; endISO: string; location: string }) => {
  const dates = `${toIcsStamp(opts.startISO)}/${toIcsStamp(opts.endISO)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates,
    details: opts.description,
  });
  if (opts.location) params.set('location', opts.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) };
  }
  try {
    const body = (event.body ? JSON.parse(event.body) : {}) as RequestBody;
    const toEmail = (body.toEmail || '').trim();
    const meetingTitle = (body.meetingTitle || '').trim() || 'PulseCheck onboarding meeting';
    const startISO = (body.startISO || '').trim();
    if (!toEmail) return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing toEmail' }) };
    if (!startISO || Number.isNaN(new Date(startISO).getTime())) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing or invalid startISO' }) };
    }

    const endISO = body.endISO && !Number.isNaN(new Date(body.endISO).getTime())
      ? body.endISO
      : new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();
    const teamName = (body.teamName || '').trim();
    const organizationName = (body.organizationName || '').trim();
    const toName = (body.toName || '').trim() || toEmail;
    const location = (body.location || '').trim();
    const contextLine = [teamName, organizationName].filter(Boolean).join(' · ');
    const description = (body.description || '').trim()
      || `Your PulseCheck onboarding meeting${contextLine ? ` for ${contextLine}` : ''}.`;

    const senderEmail = process.env.BREVO_AUTOMATED_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL || 'tre@fitwithpulse.ai';
    const ics = buildIcs({
      title: meetingTitle,
      description,
      startISO,
      endISO,
      location,
      organizerEmail: senderEmail,
      organizerName: 'PulseCheck',
      attendeeEmail: toEmail,
      attendeeName: toName,
      uid: `pulsecheck-meeting-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@fitwithpulse.ai`,
    });

    const when = new Date(startISO).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const gcalUrl = googleCalendarUrl({ title: meetingTitle, description, startISO, endISO, location });

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#00a085;font-weight:700;margin:0 0 6px;">PulseCheck Onboarding</p>
        <h1 style="font-size:22px;margin:0 0 12px;color:#0a0a0b;">${escapeHtml(meetingTitle)}</h1>
        <p style="font-size:15px;margin:0 0 4px;"><strong>When:</strong> ${escapeHtml(when)}</p>
        ${contextLine ? `<p style="font-size:14px;color:#555;margin:0 0 14px;">${escapeHtml(contextLine)}</p>` : ''}
        <p style="font-size:14px;line-height:1.6;color:#333;margin:0 0 18px;">${escapeHtml(description)}</p>
        <a href="${gcalUrl}" style="display:inline-block;background:#00d4aa;color:#06100e;font-weight:700;font-size:14px;text-decoration:none;padding:11px 18px;border-radius:10px;">Add to Google Calendar</a>
        <p style="font-size:12px;color:#888;margin:16px 0 0;">A calendar invite (.ics) is attached — open it to add this to Apple Calendar or Outlook.</p>
      </div>
    `;

    const result = await sendBrevoTransactionalEmail({
      toEmail,
      toName,
      subject: `You're invited: ${meetingTitle}${teamName ? ` (${teamName})` : ''}`,
      htmlContent: html,
      tags: ['pulsecheck-meeting-invite'],
      bypassDailyRecipientLimit: true,
      attachment: [{ content: Buffer.from(ics, 'utf-8').toString('base64'), name: 'pulsecheck-meeting.ics' }],
    });

    if (!result.success) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: result.error || 'Email send failed' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ success: true, messageId: result.messageId, skipped: result.skipped }) };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: e?.message || 'Internal error' }) };
  }
};
