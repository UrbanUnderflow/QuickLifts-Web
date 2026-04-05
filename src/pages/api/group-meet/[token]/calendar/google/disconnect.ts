import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../../../lib/firebase-admin';
import {
  buildGroupMeetGuestCalendarImportSummary,
  findGroupMeetInviteByToken,
  shouldForceDevFirebase,
} from '../../../../../../lib/groupMeetGuestGoogleCalendar';

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

  try {
    await found.inviteDoc.ref.set(
      {
        calendarImport: {
          provider: 'google',
          status: 'disconnected',
          disconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSyncError: null,
          encryptedToken: null,
          tokenRefKey: null,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const refreshedInviteDoc = await found.inviteDoc.ref.get();

    return res.status(200).json({
      calendarImport: buildGroupMeetGuestCalendarImportSummary(
        refreshedInviteDoc.data()?.calendarImport
      ),
    });
  } catch (error: any) {
    console.error('[group-meet-public] Failed to disconnect Google Calendar:', error);
    return res
      .status(500)
      .json({ error: error?.message || 'Failed to disconnect Google Calendar.' });
  }
}
