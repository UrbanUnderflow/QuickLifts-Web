import type { NextApiRequest, NextApiResponse } from 'next';

type QueueBotRequest = {
  meetingId?: string;
  meetingUrl?: string;
  startsAt?: string;
  title?: string;
};

type VerifiedSimpBudgetUser = {
  uid: string;
  email: string;
};

const SIMPBUDGET_FIREBASE_API_KEY =
  process.env.SIMPBUDGET_FIREBASE_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_API_KEY?.trim() ||
  'AIzaSyCBoCQ4J9xoIhZuaUjFMPq_zltkXDQ_0e8';

const NORA_BOT_NAME = 'Nora';
const OWNED_WORKER_PROVIDER = 'nora-owned-worker';

const cleanText = (value: unknown, maxLength = 500) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const cleanEmail = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const verifySimpBudgetAuth = async (authHeader: string | undefined): Promise<VerifiedSimpBudgetUser | null> => {
  if (!authHeader?.startsWith('Bearer ') || !SIMPBUDGET_FIREBASE_API_KEY) return null;
  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken) return null;

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${SIMPBUDGET_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.error('[nora-notetaker-queue-bot] Auth verification failed:', {
        status: response.status,
        body: body.slice(0, 300),
      });
      return null;
    }

    const data = await response.json();
    const user = data?.users?.[0];
    const uid = typeof user?.localId === 'string' ? user.localId : '';
    const email = cleanEmail(user?.email);
    return uid && email ? { uid, email } : null;
  } catch (error) {
    console.error('[nora-notetaker-queue-bot] Auth verification error:', error);
    return null;
  }
};

const isValidMeetingUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const resolveJoinAt = (startsAt: string) => {
  const parsed = startsAt ? new Date(startsAt) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;

  const tenMinutesFromNow = Date.now() + 10 * 60 * 1000;
  if (parsed.getTime() < tenMinutesFromNow) return null;
  return parsed.toISOString();
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const verifiedUser = await verifySimpBudgetAuth(req.headers.authorization);
  if (!verifiedUser) {
    return res.status(401).json({ success: false, error: 'Please sign in again.' });
  }

  const body = req.body as QueueBotRequest;
  const meetingId = cleanText(body.meetingId, 180).replace(/[^\w.-]/g, '');
  const meetingUrl = cleanText(body.meetingUrl, 1200);
  const title = cleanText(body.title, 180) || 'NoraNotetaker meeting';
  const joinAt = resolveJoinAt(cleanText(body.startsAt, 80));

  if (!meetingId) {
    return res.status(400).json({ success: false, error: 'A Nora meeting id is required.' });
  }
  if (!meetingUrl || !isValidMeetingUrl(meetingUrl)) {
    return res.status(400).json({ success: false, error: 'A valid Zoom, Google Meet, or Teams link is required.' });
  }

  return res.status(200).json({
    success: true,
    provider: OWNED_WORKER_PROVIDER,
    botName: NORA_BOT_NAME,
    workerJobId: meetingId,
    workerStatus: 'queued',
    workerMode: 'caption-browser',
    workerJoinAt: joinAt,
    workerQueuePath: `simpbudget-users/${verifiedUser.uid}/noraNotetakerMeetings/${meetingId}`,
    ownerUid: verifiedUser.uid,
    ownerEmail: verifiedUser.email,
    title,
  });
}
