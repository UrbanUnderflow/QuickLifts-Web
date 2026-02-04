import type { NextApiRequest, NextApiResponse } from 'next';
import admin from '../../../lib/firebase-admin';

const COLLECTION = 'investViews';
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes — don't log same IP again within this window

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.trim() ?? '';
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp;
  return (req.socket?.remoteAddress as string) ?? 'unknown';
}

function getLocationFromHeaders(req: NextApiRequest): string {
  // Vercel
  const country = req.headers['x-vercel-ip-country'] as string | undefined;
  const city = req.headers['x-vercel-ip-city'] as string | undefined;
  if (country || city) {
    return [city, country].filter(Boolean).join(', ') || 'Unknown';
  }
  // Netlify / other
  const geoCountry = req.headers['x-country-code'] as string | undefined;
  const geoCity = req.headers['x-city'] as string | undefined;
  if (geoCountry || geoCity) {
    return [geoCity, geoCountry].filter(Boolean).join(', ') || 'Unknown';
  }
  return 'Unknown';
}

function isPrivateOrLoopback(ip: string): boolean {
  if (ip === 'unknown' || !ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.')) return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) return true;
  return false;
}

/** Resolve location from IP using free ipapi.co (HTTPS, no key; rate-limited). */
async function getLocationFromIp(ip: string): Promise<string> {
  if (isPrivateOrLoopback(ip)) return 'Local';
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return 'Unknown';
    const data = (await res.json()) as { city?: string; region?: string; country_name?: string; error?: boolean };
    if (data.error) return 'Unknown';
    const parts = [data.city, data.region, data.country_name].filter(Boolean) as string[];
    return parts.length ? parts.join(', ') : 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const db = admin.firestore();
    const ip = getClientIp(req);
    let location = getLocationFromHeaders(req);
    if (location === 'Unknown') {
      location = await getLocationFromIp(ip);
    }
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;

    // Optional stable visitor ID from client (localStorage) — same person across IPs/devices if they use same browser
    let visitorId: string | null = null;
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
      if (typeof body.visitorId === 'string' && body.visitorId.length > 0 && body.visitorId.length <= 128) {
        visitorId = body.visitorId;
      }
    } catch {
      // ignore invalid body
    }

    // If same IP was logged within the last 5 minutes, skip to avoid noisy logs (no composite index: filter then find latest in memory)
    const sameIp = await db
      .collection(COLLECTION)
      .where('ip', '==', ip)
      .limit(100)
      .get();

    if (!sameIp.empty) {
      let latestTimeMs: number | null = null;
      sameIp.docs.forEach((d) => {
        const data = d.data();
        const ts = data.timestamp?.toDate?.();
        if (ts instanceof Date) {
          const t = ts.getTime();
          if (latestTimeMs === null || t > latestTimeMs) latestTimeMs = t;
        }
      });
      if (latestTimeMs !== null && Date.now() - latestTimeMs < COOLDOWN_MS) {
        return res.status(204).end();
      }
    }

    await db.collection(COLLECTION).add({
      ip,
      location,
      userAgent: userAgent ?? null,
      visitorId: visitorId ?? null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(204).end();
  } catch (error: unknown) {
    console.error('[invest/record-view] Error:', error);
    return res.status(500).json({ error: 'Failed to record view' });
  }
}
