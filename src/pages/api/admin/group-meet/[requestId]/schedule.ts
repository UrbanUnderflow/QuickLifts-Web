import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../../../lib/firebase-admin';
import { requireAdminRequest } from '../../_auth';
import { convertLocalDateMinutesToUtcIso, getGoogleCalendarAuth, getGoogleCalendarId } from '../../../../../lib/googleCalendar';
import {
  type GroupMeetCalendarInvite,
  type GroupMeetFinalSelection,
} from '../../../../../lib/groupMeet';

const REQUESTS_COLLECTION = 'groupMeetRequests';
const INVITES_SUBCOLLECTION = 'groupMeetInvites';

type GoogleCalendarEventResponse = {
  id?: string;
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
    }>;
  };
};

function buildEventDescription(args: {
  title: string;
  timezone: string;
  finalSelection: GroupMeetFinalSelection;
  aiSummary: string | null;
}) {
  const lines = [
    `${args.title}`,
    '',
    `Scheduled in Group Meet`,
    `Timezone: ${args.timezone}`,
    `Selected window: ${args.finalSelection.date} ${args.finalSelection.startMinutes} -> ${args.finalSelection.endMinutes}`,
  ];

  if (args.aiSummary) {
    lines.push('', `AI summary: ${args.aiSummary}`);
  }

  if (args.finalSelection.hostNote) {
    lines.push('', `Host note: ${args.finalSelection.hostNote}`);
  }

  lines.push(
    '',
    `Included participants: ${args.finalSelection.participantNames.join(', ') || 'None'}`,
    `Missing participants: ${args.finalSelection.missingParticipantNames.join(', ') || 'None'}`
  );

  return lines.join('\n');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';
  if (!requestId) {
    return res.status(400).json({ error: 'Request id is required.' });
  }

  try {
    const requestRef = admin.firestore().collection(REQUESTS_COLLECTION).doc(requestId);
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      return res.status(404).json({ error: 'Group Meet request not found.' });
    }

    const requestData = requestDoc.data() || {};
    const finalSelection = (requestData.finalSelection || null) as GroupMeetFinalSelection | null;
    if (!finalSelection) {
      return res.status(400).json({ error: 'Select a final meeting block before creating the invite.' });
    }

    const timezone = requestData.timezone || 'America/New_York';
    const title = requestData.title || 'Group Meet';
    const calendarId = getGoogleCalendarId();
    const { accessToken, organizerEmail } = await getGoogleCalendarAuth();

    const invitesSnapshot = await requestRef.collection(INVITES_SUBCOLLECTION).orderBy('createdAt', 'asc').get();
    const invites = invitesSnapshot.docs.map((docSnap) => docSnap.data());
    const attendeeEmails = Array.from(
      new Set(
        invites
          .map((invite) => (typeof invite.email === 'string' ? invite.email.trim().toLowerCase() : ''))
          .filter(Boolean)
      )
    );
    const skippedParticipantNames = invites
      .filter((invite) => !invite.email)
      .map((invite) => invite.name || 'Unknown');

    const startDateTime = convertLocalDateMinutesToUtcIso(finalSelection.date, finalSelection.startMinutes, timezone);
    const endDateTime = convertLocalDateMinutesToUtcIso(finalSelection.date, finalSelection.endMinutes, timezone);

    const eventPayload: Record<string, unknown> = {
      summary: title,
      description: buildEventDescription({
        title,
        timezone,
        finalSelection,
        aiSummary: requestData.aiRecommendation?.summary || null,
      }),
      start: {
        dateTime: startDateTime,
        timeZone: timezone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: timezone,
      },
      attendees: attendeeEmails.map((email) => ({ email })),
      guestsCanModify: false,
      guestsCanInviteOthers: false,
      guestsCanSeeOtherGuests: true,
      reminders: { useDefault: true },
    };

    const existingInvite = requestData.calendarInvite as GroupMeetCalendarInvite | undefined;
    let requestUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    let method = 'POST';

    if (existingInvite?.eventId) {
      requestUrl = `${requestUrl}/${encodeURIComponent(existingInvite.eventId)}?sendUpdates=all`;
      method = 'PATCH';
    } else {
      requestUrl = `${requestUrl}?conferenceDataVersion=1&sendUpdates=all`;
      eventPayload.conferenceData = {
        createRequest: {
          requestId: `${requestId}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const response = await fetch(requestUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    const payload = (await response.json().catch(() => ({}))) as GoogleCalendarEventResponse & { error?: { message?: string } };
    if (!response.ok || !payload.id) {
      throw new Error(payload?.error?.message || `Google Calendar error (${response.status})`);
    }

    const meetLink =
      payload.hangoutLink ||
      payload.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.entryPointType === 'video')?.uri ||
      existingInvite?.meetLink ||
      null;

    const calendarInvite: GroupMeetCalendarInvite = {
      status: existingInvite?.eventId ? 'updated' : 'scheduled',
      eventId: payload.id,
      htmlLink: payload.htmlLink || existingInvite?.htmlLink || null,
      meetLink,
      calendarId,
      createdAt: existingInvite?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attendeeEmails,
      skippedParticipantNames,
      organizerEmail,
    };

    await requestRef.set(
      {
        calendarInvite,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        calendarInviteUpdatedByEmail: adminUser.email,
      },
      { merge: true }
    );

    return res.status(200).json({ calendarInvite });
  } catch (error: any) {
    console.error('[group-meet-schedule] Failed to create calendar invite:', error);
    return res.status(500).json({ error: error?.message || 'Failed to create Google Calendar invite.' });
  }
}

