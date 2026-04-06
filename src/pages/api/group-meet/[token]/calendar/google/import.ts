import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../../../lib/firebase-admin';
import { type GroupMeetImportedAvailabilitySuggestion, normalizeGroupMeetAvailabilitySlots } from '../../../../../../lib/groupMeet';
import { buildGoogleBusyMonthRequestWindow, convertGoogleBusyBlocksToAvailabilitySuggestions } from '../../../../../../lib/groupMeetGuestAvailabilityImport';
import {
  buildGroupMeetGuestCalendarImportSummary,
  fetchGuestGoogleCalendarBusyIntervals,
  findGroupMeetInviteByToken,
  getGuestGoogleCalendarAccessToken,
  shouldForceDevFirebase,
  toPublicGuestCalendarErrorMessage,
  toIso,
} from '../../../../../../lib/groupMeetGuestGoogleCalendar';

function dedupeAgainstSavedAvailability(
  importedSuggestions: GroupMeetImportedAvailabilitySuggestion[],
  savedAvailability: Array<{ date: string; startMinutes: number; endMinutes: number }>
) {
  const savedKeys = new Set(
    savedAvailability.map((slot) => `${slot.date}:${slot.startMinutes}:${slot.endMinutes}`)
  );

  return importedSuggestions.filter(
    (slot) => !savedKeys.has(`${slot.date}:${slot.startMinutes}:${slot.endMinutes}`)
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }

  const db = getFirebaseAdminApp(shouldForceDevFirebase(req)).firestore();
  const found = await findGroupMeetInviteByToken(db, token);
  if (!found) {
    return res.status(404).json({ error: 'Invite not found.' });
  }

  const { inviteDoc, requestDoc } = found;
  const requestData = requestDoc.data() || {};
  const inviteData = inviteDoc.data() || {};
  const deadlineAt = toIso(requestData.deadlineAt);
  const deadlinePassed = deadlineAt ? new Date(deadlineAt).getTime() <= Date.now() : false;
  if (deadlinePassed) {
    return res.status(403).json({ error: 'This availability window is closed.' });
  }

  try {
    const { accessToken, tokens } = await getGuestGoogleCalendarAccessToken({
      req,
      inviteData,
    });
    const targetMonth = requestData.targetMonth || '';
    const timeZone = requestData.timezone || 'America/New_York';
    const meetingDurationMinutes = Number(requestData.meetingDurationMinutes) || 30;
    const { timeMin, timeMax } = buildGoogleBusyMonthRequestWindow(targetMonth, timeZone);
    const busyIntervals = await fetchGuestGoogleCalendarBusyIntervals({
      accessToken,
      timeMin,
      timeMax,
      timeZone,
    });
    const importedAt = new Date().toISOString();
    const savedAvailability = normalizeGroupMeetAvailabilitySlots(
      inviteData.availabilityEntries,
      targetMonth
    );
    const suggestions = dedupeAgainstSavedAvailability(
      convertGoogleBusyBlocksToAvailabilitySuggestions({
        busyIntervals,
        targetMonth,
        timeZone,
        meetingDurationMinutes,
        importedAt,
      }),
      savedAvailability
    );

    await inviteDoc.ref.set(
      {
        calendarImport: {
          provider: 'google',
          status: 'connected',
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSyncStatus: 'success',
          lastSyncError: null,
          googleAccountEmail:
            tokens.connectedEmail || inviteData?.calendarImport?.googleAccountEmail || null,
          encryptedToken: tokens.encryptedToken,
          tokenRefKey: 'invite_doc_encrypted',
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const refreshedInviteDoc = await inviteDoc.ref.get();

    return res.status(200).json({
      suggestions,
      calendarImport: buildGroupMeetGuestCalendarImportSummary(
        refreshedInviteDoc.data()?.calendarImport
      ),
    });
  } catch (error: any) {
    const message = toPublicGuestCalendarErrorMessage(error);
    const requiresReconnect = /reconnected|read-only calendar access|insufficient authentication scopes|insufficient scopes/i.test(
      `${message} ${error?.message || ''}`
    );
    const nextCalendarImport: Record<string, unknown> = {
      provider: 'google',
      status: requiresReconnect ? 'disconnected' : inviteData?.calendarImport?.encryptedToken ? 'connected' : 'error',
      lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSyncStatus: 'error',
      lastSyncError: message,
    };

    if (requiresReconnect) {
      nextCalendarImport.disconnectedAt = admin.firestore.FieldValue.serverTimestamp();
      nextCalendarImport.encryptedToken = null;
      nextCalendarImport.tokenRefKey = null;
    }

    await inviteDoc.ref.set(
      {
        calendarImport: nextCalendarImport,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const refreshedInviteDoc = await inviteDoc.ref.get();

    console.error('[group-meet-public] Failed to import Google Calendar availability:', error);
    return res.status(requiresReconnect ? 409 : 500).json({
      error: message,
      calendarImport: buildGroupMeetGuestCalendarImportSummary(
        refreshedInviteDoc.data()?.calendarImport
      ),
    });
  }
}
