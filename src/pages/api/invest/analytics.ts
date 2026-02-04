import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const COLLECTION = 'investViews';
const ADMIN_COLLECTION = 'admin';

const ONEUP_SECRET = process.env.INVEST_ONEUP_SECRET || 'ONEUP';

async function requireAdmin(req: NextApiRequest): Promise<{ email?: string } | null> {
  // 1) Firebase admin token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7);
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const email = decoded.email as string | undefined;
      if (!email) return null;
      const adminDoc = await admin.firestore().doc(`${ADMIN_COLLECTION}/${email}`).get();
      if (!adminDoc.exists) return null;
      return { email };
    } catch {
      // fall through to passcode check
    }
  }
  // 2) ONEUP private passcode (header set when user unlocked with ONEUP)
  const passcode = req.headers['x-invest-passcode'] as string | undefined;
  if (passcode === ONEUP_SECRET) return {};
  return null;
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
    const db = admin.firestore();
    const { ip: queryIp } = req.query as { ip?: string };

    if (queryIp) {
      // Detail: access log for a single IP (no composite index: filter then sort in memory)
      const snapshot = await db
        .collection(COLLECTION)
        .where('ip', '==', queryIp)
        .limit(500)
        .get();

      const logs = snapshot.docs
        .map((doc) => {
          const d = doc.data();
          const ts = d.timestamp?.toDate?.() ?? (d.timestamp as unknown as Date);
          return {
            id: doc.id,
            timestamp: ts instanceof Date ? ts.toISOString() : String(ts),
            location: d.location ?? null,
            userAgent: d.userAgent ?? null,
            visitorId: (d.visitorId as string) ?? null,
          };
        })
        .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));

      return res.status(200).json({
        ip: queryIp,
        total: logs.length,
        logs,
      });
    }

    // List: unique IPs with count, location, lastSeen
    const snapshot = await db
      .collection(COLLECTION)
      .orderBy('timestamp', 'desc')
      .limit(5000)
      .get();

    const byIp: Record<
      string,
      { ip: string; location: string; count: number; lastSeen: string; firstSeen: string; visitorId: string | null }
    > = {};

    snapshot.docs.forEach((doc) => {
      const d = doc.data();
      const ts = d.timestamp?.toDate?.();
      const iso = ts ? ts.toISOString() : '';
      const ip = (d.ip as string) || 'unknown';
      const visitorId = (d.visitorId as string) || null;
      if (!byIp[ip]) {
        byIp[ip] = {
          ip,
          location: (d.location as string) ?? 'Unknown',
          count: 0,
          lastSeen: iso,
          firstSeen: iso,
          visitorId: visitorId ?? null,
        };
      }
      byIp[ip].count += 1;
      if (iso > (byIp[ip].lastSeen || '')) byIp[ip].lastSeen = iso;
      if (iso < (byIp[ip].firstSeen || '') || !byIp[ip].firstSeen) byIp[ip].firstSeen = iso;
      // Prefer non-null visitorId when we have it (most recent doc wins for display)
      if (visitorId) byIp[ip].visitorId = visitorId;
    });

    const list = Object.values(byIp).sort((a, b) => (b.lastSeen > a.lastSeen ? 1 : -1));

    return res.status(200).json({
      visitors: list,
      totalViews: snapshot.size,
    });
  } catch (error: unknown) {
    console.error('[invest/analytics] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
