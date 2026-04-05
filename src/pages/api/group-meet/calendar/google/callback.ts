import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import {
  encryptGuestGoogleCalendarTokens,
  exchangeGuestGoogleCalendarCode,
  findGroupMeetInviteByToken,
  shouldForceDevFirebase,
  verifyGuestCalendarState,
} from '../../../../../lib/groupMeetGuestGoogleCalendar';

function redirectToInvite(
  res: NextApiResponse,
  shareUrl: string,
  params: Record<string, string>
) {
  const url = new URL(shareUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  res.writeHead(302, { Location: url.toString() });
  res.end();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const rawState = typeof req.query.state === 'string' ? req.query.state.trim() : '';

  let inviteToken = '';
  try {
    inviteToken = verifyGuestCalendarState(rawState).token;
  } catch (error: any) {
    return res.status(400).json({
      error: error?.message || 'Google Calendar callback state could not be verified.',
    });
  }

  const db = getFirebaseAdminApp(shouldForceDevFirebase(req)).firestore();
  const found = await findGroupMeetInviteByToken(db, inviteToken);
  if (!found) {
    return res.status(404).json({ error: 'Invite not found.' });
  }

  const inviteData = found.inviteDoc.data() || {};
  const shareUrl = inviteData.shareUrl || '';

  const providerError = typeof req.query.error === 'string' ? req.query.error.trim() : '';
  if (providerError) {
    await found.inviteDoc.ref.set(
      {
        calendarImport: {
          provider: 'google',
          status: 'error',
          lastSyncStatus: 'error',
          lastSyncError:
            providerError === 'access_denied'
              ? 'Google Calendar connection was canceled.'
              : `Google Calendar returned ${providerError}.`,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return redirectToInvite(res, shareUrl, {
      calendarGoogleError:
        providerError === 'access_denied'
          ? 'Google Calendar connection was canceled.'
          : `Google Calendar returned ${providerError}.`,
    });
  }

  const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
  if (!code) {
    return redirectToInvite(res, shareUrl, {
      calendarGoogleError: 'Google Calendar did not return an authorization code.',
    });
  }

  try {
    const tokens = await exchangeGuestGoogleCalendarCode(req, code);

    await found.inviteDoc.ref.set(
      {
        calendarImport: {
          provider: 'google',
          status: 'connected',
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
          disconnectedAt: null,
          lastSyncedAt: null,
          lastSyncStatus: 'never',
          lastSyncError: null,
          googleAccountEmail: tokens.connectedEmail || null,
          tokenRefKey: 'invite_doc_encrypted',
          encryptedToken: encryptGuestGoogleCalendarTokens(tokens),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return redirectToInvite(res, shareUrl, {
      calendarGoogleSuccess: 'Google Calendar connected. Import availability when you are ready.',
    });
  } catch (error: any) {
    const message = error?.message || 'Google Calendar connection failed.';

    await found.inviteDoc.ref.set(
      {
        calendarImport: {
          provider: 'google',
          status: 'error',
          lastSyncStatus: 'error',
          lastSyncError: message,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return redirectToInvite(res, shareUrl, {
      calendarGoogleError: message,
    });
  }
}
