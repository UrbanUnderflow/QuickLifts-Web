import type { NextApiRequest, NextApiResponse } from 'next';

type SyncBotRequest = {
  meetingId?: string;
  workerJobId?: string;
};

type VerifiedSimpBudgetUser = {
  uid: string;
  email: string;
};

const SIMPBUDGET_FIREBASE_API_KEY =
  process.env.SIMPBUDGET_FIREBASE_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_API_KEY?.trim() ||
  'AIzaSyCBoCQ4J9xoIhZuaUjFMPq_zltkXDQ_0e8';

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

    if (!response.ok) return null;

    const data = await response.json();
    const user = data?.users?.[0];
    const uid = typeof user?.localId === 'string' ? user.localId : '';
    const email = cleanEmail(user?.email);
    return uid && email ? { uid, email } : null;
  } catch (error) {
    console.error('[nora-notetaker-sync-bot] Auth verification error:', error);
    return null;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const verifiedUser = await verifySimpBudgetAuth(req.headers.authorization);
  if (!verifiedUser) {
    return res.status(401).json({ success: false, error: 'Please sign in again.' });
  }

  const body = req.body as SyncBotRequest;
  const meetingId = cleanText(body.meetingId, 180).replace(/[^\w.-]/g, '');
  const workerJobId = cleanText(body.workerJobId, 180);

  if (!meetingId) {
    return res.status(400).json({ success: false, error: 'A Nora meeting id is required.' });
  }
  if (workerJobId && workerJobId !== meetingId) {
    return res.status(403).json({ success: false, error: 'This Nora worker job belongs to a different meeting.' });
  }

  return res.status(200).json({
    success: true,
    provider: 'nora-owned-worker',
    workerJobId: meetingId,
    workerStatus: 'refresh-requested',
    transcriptStatus: 'read-from-firestore',
    message: 'Nora worker transcripts are written directly to the SimpBudget Firestore meeting record.',
  });
}
