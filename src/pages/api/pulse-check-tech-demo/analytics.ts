import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const COLLECTION = 'pulseCheckTechDemoViews';
const ADMIN_COLLECTION = 'admin';

type NotificationEmail = {
  status?: string | null;
  to?: string | null;
  messageId?: string | null;
  error?: string | null;
};

type DemoViewEvent = {
  id: string;
  timestamp: string | null;
  ip: string;
  location: string;
  userAgent: string | null;
  visitorId: string | null;
  pageUrl: string | null;
  referrer: string | null;
  referrerHost: string | null;
  viewerName: string | null;
  viewerEmail: string | null;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  notificationEmail: NotificationEmail | null;
};

type VisitorSummary = {
  key: string;
  ip: string;
  visitorId: string | null;
  viewerName: string | null;
  viewerEmail: string | null;
  location: string;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
  latestSource: string | null;
  latestReferrer: string | null;
  latestReferrerHost: string | null;
  latestUserAgent: string | null;
  emailStatusCounts: Record<string, number>;
};

async function requireAdmin(req: NextApiRequest): Promise<{ email: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const idToken = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email;
    if (!email) return null;

    const adminDoc = await admin.firestore().doc(`${ADMIN_COLLECTION}/${email}`).get();
    if (!adminDoc.exists) return null;

    return { email };
  } catch {
    return null;
  }
}

function toIsoTimestamp(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    const date = new Date(value < 1_000_000_000_000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') {
      const date = toDate();
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
  }

  return null;
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getReferrerHost(referrer: string | null): string | null {
  if (!referrer) return null;

  try {
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return referrer;
  }
}

function toEvent(doc: FirebaseFirestore.QueryDocumentSnapshot): DemoViewEvent {
  const data = doc.data();
  const referrer = cleanText(data.referrer);
  const notificationEmail =
    data.notificationEmail && typeof data.notificationEmail === 'object'
      ? (data.notificationEmail as NotificationEmail)
      : null;

  return {
    id: doc.id,
    timestamp: toIsoTimestamp(data.timestamp),
    ip: cleanText(data.ip) || 'unknown',
    location: cleanText(data.location) || 'Unknown',
    userAgent: cleanText(data.userAgent),
    visitorId: cleanText(data.visitorId),
    pageUrl: cleanText(data.pageUrl),
    referrer,
    referrerHost: getReferrerHost(referrer),
    viewerName: cleanText(data.viewerName),
    viewerEmail: cleanText(data.viewerEmail),
    source: cleanText(data.source),
    utmSource: cleanText(data.utmSource),
    utmMedium: cleanText(data.utmMedium),
    utmCampaign: cleanText(data.utmCampaign),
    notificationEmail,
  };
}

function incrementCounter(map: Record<string, number>, key: string | null | undefined) {
  const safeKey = key?.trim() || 'Unknown';
  map[safeKey] = (map[safeKey] || 0) + 1;
}

function sortCounters(map: Record<string, number>) {
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildAnalytics(events: DemoViewEvent[]) {
  const visitorMap = new Map<string, VisitorSummary>();
  const sourceCounts: Record<string, number> = {};
  const referrerCounts: Record<string, number> = {};
  const emailStatusCounts: Record<string, number> = {};
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  let viewsLast24Hours = 0;
  let viewsToday = 0;
  let knownReviewerViews = 0;

  const todayKey = new Date().toISOString().slice(0, 10);

  events.forEach((event) => {
    const timestampMs = event.timestamp ? new Date(event.timestamp).getTime() : Number.NaN;
    if (Number.isFinite(timestampMs) && now - timestampMs <= dayMs) {
      viewsLast24Hours += 1;
    }
    if (event.timestamp?.startsWith(todayKey)) {
      viewsToday += 1;
    }
    if (event.viewerName || event.viewerEmail) {
      knownReviewerViews += 1;
    }

    incrementCounter(sourceCounts, event.source || event.utmSource || 'Direct / unknown');
    incrementCounter(referrerCounts, event.referrerHost || 'Direct / none');
    incrementCounter(emailStatusCounts, event.notificationEmail?.status || 'not_recorded');

    const key = event.visitorId || event.ip || event.id;
    const existing = visitorMap.get(key);
    const emailStatus = event.notificationEmail?.status || 'not_recorded';

    if (!existing) {
      visitorMap.set(key, {
        key,
        ip: event.ip,
        visitorId: event.visitorId,
        viewerName: event.viewerName,
        viewerEmail: event.viewerEmail,
        location: event.location,
        count: 1,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        latestSource: event.source || event.utmSource,
        latestReferrer: event.referrer,
        latestReferrerHost: event.referrerHost,
        latestUserAgent: event.userAgent,
        emailStatusCounts: { [emailStatus]: 1 },
      });
      return;
    }

    existing.count += 1;
    existing.viewerName = event.viewerName || existing.viewerName;
    existing.viewerEmail = event.viewerEmail || existing.viewerEmail;
    existing.location = event.location || existing.location;
    existing.emailStatusCounts[emailStatus] = (existing.emailStatusCounts[emailStatus] || 0) + 1;

    if (!existing.firstSeen || (event.timestamp && event.timestamp < existing.firstSeen)) {
      existing.firstSeen = event.timestamp;
    }

    if (!existing.lastSeen || (event.timestamp && event.timestamp > existing.lastSeen)) {
      existing.lastSeen = event.timestamp;
      existing.ip = event.ip;
      existing.latestSource = event.source || event.utmSource;
      existing.latestReferrer = event.referrer;
      existing.latestReferrerHost = event.referrerHost;
      existing.latestUserAgent = event.userAgent;
    }
  });

  const visitors = Array.from(visitorMap.values()).sort((a, b) =>
    (b.lastSeen || '').localeCompare(a.lastSeen || '')
  );

  return {
    summary: {
      totalViews: events.length,
      uniqueVisitors: visitors.length,
      knownReviewerViews,
      viewsToday,
      viewsLast24Hours,
      latestViewAt: events[0]?.timestamp || null,
      emailStatusCounts,
    },
    visitors,
    recentEvents: events.slice(0, 250),
    sources: sortCounters(sourceCounts).slice(0, 12),
    referrers: sortCounters(referrerCounts).slice(0, 12),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const limitParam = Number(req.query.limit || 1500);
    const safeLimit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 50), 5000) : 1500;
    const snapshot = await admin
      .firestore()
      .collection(COLLECTION)
      .orderBy('timestamp', 'desc')
      .limit(safeLimit)
      .get();

    const events = snapshot.docs.map(toEvent);

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      collection: COLLECTION,
      ...buildAnalytics(events),
    });
  } catch (error: unknown) {
    console.error('[pulse-check-tech-demo/analytics] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch Pulse Check tech demo analytics' });
  }
}
