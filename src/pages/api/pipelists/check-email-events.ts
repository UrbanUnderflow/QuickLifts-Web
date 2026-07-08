import type { NextApiRequest, NextApiResponse } from 'next';

type CheckEmailEventsRequest = {
  messageId?: string;
};

type BrevoEventSummary = {
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'soft_bounce' | 'hard_bounce' | 'blocked' | 'deferred' | 'spam' | 'unsubscribed' | 'invalid_email' | 'error';
  eventAt: string | null;
  link?: string;
};

type VerifiedSimpBudgetUser = {
  uid: string;
  email: string;
};

const OWNER_EMAIL = 'tremaine.grant@gmail.com';
const SIMPBUDGET_FIREBASE_API_KEY =
  process.env.SIMPBUDGET_FIREBASE_API_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SIMPBUDGET_FIREBASE_API_KEY?.trim() ||
  'AIzaSyCBoCQ4J9xoIhZuaUjFMPq_zltkXDQ_0e8';
const BREVO_API_KEY = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;

const cleanEmail = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const cleanText = (value: unknown, maxLength = 5000) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

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
  } catch {
    return null;
  }
};

const normalizeBrevoEvent = (value: unknown): BrevoEventSummary['status'] | '' => {
  const event = cleanText(value, 80);
  if (event === 'opened' || event === 'unique_opened' || event === 'uniqueOpened' || event === 'proxy_open' || event === 'unique_proxy_open' || event === 'uniqueProxyOpen') return 'opened';
  if (event === 'click' || event === 'clicks' || event === 'clicked') return 'clicked';
  if (event === 'delivered') return 'delivered';
  if (event === 'request' || event === 'requests' || event === 'sent') return 'sent';
  if (event === 'unsubscribe' || event === 'unsubscribed') return 'unsubscribed';
  if (event === 'softBounce') return 'soft_bounce';
  if (event === 'hardBounce') return 'hard_bounce';
  if (event === 'invalid') return 'invalid_email';
  if (
    event === 'soft_bounce' ||
    event === 'hard_bounce' ||
    event === 'blocked' ||
    event === 'deferred' ||
    event === 'spam' ||
    event === 'invalid_email' ||
    event === 'error'
  ) {
    return event;
  }
  return '';
};

const eventRank = (status: string) => {
  switch (status) {
    case 'sent':
      return 1;
    case 'delivered':
      return 2;
    case 'opened':
      return 3;
    case 'clicked':
      return 4;
    case 'soft_bounce':
    case 'hard_bounce':
    case 'blocked':
    case 'deferred':
    case 'spam':
    case 'unsubscribed':
    case 'invalid_email':
    case 'error':
      return 10;
    default:
      return 0;
  }
};

const normalizeEventDate = (event: Record<string, unknown>) => {
  const dateValue = event.date || event.ts_event || event.ts_epoch || event.ts;
  if (typeof dateValue === 'number' && Number.isFinite(dateValue)) {
    const date = new Date(dateValue < 1_000_000_000_000 ? dateValue * 1000 : dateValue);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof dateValue === 'string' && dateValue.trim()) {
    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
};

const summarizeBrevoEvents = (events: Array<Record<string, unknown>>): BrevoEventSummary | null => {
  let best: BrevoEventSummary | null = null;
  let bestRank = 0;

  events.forEach((event) => {
    const status = normalizeBrevoEvent(event.event);
    if (!status) return;
    const rank = eventRank(status);
    if (rank < bestRank) return;
    bestRank = rank;
    best = {
      status,
      eventAt: normalizeEventDate(event),
      link: typeof event.link === 'string' ? event.link : undefined,
    };
  });

  return best;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: true; summary: BrevoEventSummary | null; eventCount: number } | { success: false; error: string }>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const verifiedUser = await verifySimpBudgetAuth(req.headers.authorization);
  if (!verifiedUser) {
    return res.status(401).json({ success: false, error: 'Please sign in again.' });
  }
  if (verifiedUser.email !== OWNER_EMAIL) {
    return res.status(403).json({ success: false, error: 'Pulse Brevo status checks are only enabled for the PipeLists owner.' });
  }
  if (!BREVO_API_KEY) {
    return res.status(500).json({ success: false, error: 'Brevo is not configured.' });
  }

  const { messageId } = req.body as CheckEmailEventsRequest;
  const cleanedMessageId = cleanText(messageId, 500);
  if (!cleanedMessageId) {
    return res.status(400).json({ success: false, error: 'Message ID is required.' });
  }

  const response = await fetch(
    `https://api.brevo.com/v3/smtp/statistics/events?messageId=${encodeURIComponent(cleanedMessageId)}&limit=50&sort=desc`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'api-key': BREVO_API_KEY,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return res.status(response.status === 404 ? 200 : response.status).json(
      response.status === 404
        ? { success: true, summary: null, eventCount: 0 }
        : { success: false, error: body || `Brevo status check failed (${response.status}).` },
    );
  }

  const data = await response.json().catch(() => ({}));
  const events = Array.isArray(data?.events) ? data.events : [];
  return res.status(200).json({
    success: true,
    summary: summarizeBrevoEvents(events),
    eventCount: events.length,
  });
}
