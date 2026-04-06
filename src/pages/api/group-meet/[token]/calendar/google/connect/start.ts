import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { getFirebaseAdminApp } from '../../../../../../../lib/firebase-admin';
import {
  buildGuestGoogleCalendarConnectUrl,
  findGroupMeetInviteByToken,
  getPublicGuestCalendarDebugInfo,
  shouldForceDevFirebase,
  toPublicGuestCalendarErrorMessage,
  toIso,
} from '../../../../../../../lib/groupMeetGuestGoogleCalendar';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }

  try {
    const db = getFirebaseAdminApp(shouldForceDevFirebase(req)).firestore();
    const found = await findGroupMeetInviteByToken(db, token);
    if (!found) {
      return res.status(404).json({ error: 'Invite not found.' });
    }

    const requestData = found.requestDoc.data() || {};
    const deadlineAt = toIso(requestData.deadlineAt);
    const deadlinePassed = deadlineAt ? new Date(deadlineAt).getTime() <= Date.now() : false;
    if (deadlinePassed) {
      return res.status(403).json({ error: 'This availability window is closed.' });
    }

    return res.status(200).json({
      url: await buildGuestGoogleCalendarConnectUrl(req, token),
    });
  } catch (error: any) {
    const debugId = randomUUID();
    const debug = getPublicGuestCalendarDebugInfo(error);

    console.error('[group-meet-public] Failed to start Google Calendar connect:', {
      debugId,
      token,
      debug,
      message: error instanceof Error ? error.message : String(error || ''),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res
      .status(500)
      .json({
        error: toPublicGuestCalendarErrorMessage(error),
        debugCode: debug.code,
        debugHint: debug.hint,
        debugId,
      });
  }
}
